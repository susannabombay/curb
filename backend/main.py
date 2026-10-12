import math
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

import datamall
from auth import (
    create_access_token,
    create_share_token,
    decode_access_token,
    decode_share_token,
    hash_password,
    verify_password,
)
from database import Base, engine, get_db
from models import Reservation, User, now_utc

Base.metadata.create_all(bind=engine)

RESERVATION_WINDOW_MIN = int(os.environ.get("RESERVATION_WINDOW_MIN", 15))
EXTEND_MIN = int(os.environ.get("EXTEND_MIN", 10))
EXTEND_FEE_CENTS = int(os.environ.get("EXTEND_FEE_CENTS", 150))
MAX_EXTENDS = int(os.environ.get("MAX_EXTENDS", 1))
# Check-in ("I've arrived") only opens this many minutes before the driver's
# stated arrival time, and only from within ARRIVE_RADIUS_M of the carpark.
CHECKIN_OPENS_BEFORE_MIN = int(os.environ.get("CHECKIN_OPENS_BEFORE_MIN", 10))
ARRIVE_RADIUS_M = int(os.environ.get("ARRIVE_RADIUS_M", 300))
# Extra slack for a fuzzy GPS fix (phones report their own accuracy), capped
# so a wildly inaccurate fix can't stretch the radius to cover half the city.
MAX_ACCURACY_ALLOWANCE_M = 150

# Reliability tiers, earned by a streak of on-time check-ins (any no-show
# resets it). Better tiers get a cheaper hold, free extends and an extra
# extend -- a reason to book and show up, not just a penalty for not.
# Mirrored in the frontend's rewards.js.
TIERS = [
    {"id": "gold", "label": "Gold", "min_streak": 8, "hold_fee_cents": 100, "free_extend": True, "max_extends": MAX_EXTENDS + 1},
    {"id": "silver", "label": "Silver", "min_streak": 3, "hold_fee_cents": 150, "free_extend": True, "max_extends": MAX_EXTENDS},
    {"id": "starter", "label": "Starter", "min_streak": 0, "hold_fee_cents": 200, "free_extend": False, "max_extends": MAX_EXTENDS},
]

# Where each bookable carpark actually is. The arrival check measures
# against these, never against coordinates the client sent at booking
# time -- otherwise a driver could book with their home's lat/lon and then
# "arrive" from the sofa. Keyed by the frontend's mall ids (mockData.js).
CARPARK_COORDS = {
    "vivocity": (1.2645, 103.8222),
    "ion": (1.3039, 103.8318),
    "marina": (1.2926, 103.8573),
    "jem": (1.3331, 103.7436),
    "westgate": (1.3345, 103.7430),
}

app = FastAPI(title="Curb API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    user_id = decode_access_token(creds.credentials)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


# ---------- schemas ----------

class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    email: str


class UserOut(BaseModel):
    email: str


class ReservationCreate(BaseModel):
    carpark_id: str
    carpark_name: str
    lat: float | None = None
    lon: float | None = None
    eta_minutes: int
    name: str | None = None
    plate: str | None = None
    arrive_time: str | None = None
    leave_time: str | None = None
    lot_type: str = "standard"
    payment_method: str = "card"
    fee_cents: int = 0


class ArriveRequest(BaseModel):
    lat: float
    lon: float
    accuracy_m: float | None = None


class ReliabilityOut(BaseModel):
    streak: int
    arrived_count: int
    no_show_count: int
    tier: str


class SharedReservationOut(BaseModel):
    carpark_name: str
    lat: float | None
    lon: float | None
    arrive_time: str | None
    leave_time: str | None
    window_end: datetime
    status: str


class ShareOut(BaseModel):
    token: str


class ReservationOut(BaseModel):
    id: str
    carpark_id: str
    carpark_name: str
    lat: float | None
    lon: float | None
    name: str | None
    plate: str | None
    arrive_time: str | None
    leave_time: str | None
    lot_type: str
    payment_method: str
    fee_cents: int
    eta_minutes: int
    window_start: datetime
    window_end: datetime
    status: str
    extended_count: int
    extend_dismissed: bool
    updated_at: datetime

    class Config:
        from_attributes = True


def _refresh_status(r: Reservation):
    """Lazily compute expiry -- no background scheduler needed for a demo."""
    if r.status in ("cancelled", "arrived", "expired"):
        return
    if now_utc() > r.grace_end:
        r.status = "expired"


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle (haversine) distance in metres."""
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _format_distance(m: float) -> str:
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{round(m)} m"


def _require_live(r: Reservation, db: Session, action: str):
    """Refresh expiry, then refuse to act on a hold that's already finished --
    e.g. turning an expired no-show into "arrived" or "cancelled"."""
    _refresh_status(r)
    if r.status not in ("active", "extended"):
        db.commit()  # persist a just-detected expiry before bailing out
        raise HTTPException(400, f"Can't {action} -- this hold is already {r.status}")


def _reliability(user: User, db: Session) -> ReliabilityOut:
    """Streak = on-time check-ins since the most recent no-show."""
    rows = db.query(Reservation).filter(Reservation.user_id == user.id).order_by(Reservation.created_at.desc()).all()
    for r in rows:
        _refresh_status(r)
    db.commit()
    finished = [r.status for r in rows if r.status in ("arrived", "expired")]
    streak = 0
    for status in finished:
        if status != "arrived":
            break
        streak += 1
    tier = next(t for t in TIERS if streak >= t["min_streak"])
    return ReliabilityOut(
        streak=streak,
        arrived_count=finished.count("arrived"),
        no_show_count=finished.count("expired"),
        tier=tier["id"],
    )


def _tier(user: User, db: Session) -> dict:
    tier_id = _reliability(user, db).tier
    return next(t for t in TIERS if t["id"] == tier_id)


def _owned_reservation(res_id: str, user: User, db: Session) -> Reservation:
    r = db.query(Reservation).filter(Reservation.id == res_id, Reservation.user_id == user.id).first()
    if not r:
        raise HTTPException(404, "Reservation not found")
    return r


# ---------- auth routes ----------

@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address")
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists")

    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_access_token(user.id), email=user.email)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    return AuthResponse(token=create_access_token(user.id), email=user.email)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(email=user.email)


@app.get("/api/me/reliability", response_model=ReliabilityOut)
def my_reliability(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _reliability(user, db)


# ---------- carpark routes ----------

@app.get("/api/carparks")
async def list_carparks(q: str | None = None):
    records, source = await datamall.fetch_carparks()
    if q:
        records = [r for r in records if q.upper() in (r.get("Development") or "").upper()]

    out = []
    for r in records:
        lat, lon = None, None
        loc = r.get("Location")
        if loc:
            parts = loc.split(" ")
            if len(parts) == 2:
                lat, lon = float(parts[0]), float(parts[1])
        out.append({
            "carpark_id": r.get("CarParkID"),
            "name": r.get("Development"),
            "area": r.get("Area"),
            "available_lots": r.get("AvailableLots"),
            "lot_type": r.get("LotType"),
            "agency": r.get("Agency"),
            "lat": lat,
            "lon": lon,
        })
    return {"source": source, "carparks": out}


# ---------- reservation routes (all scoped to the authenticated user) ----------

@app.post("/api/reservations", response_model=ReservationOut)
def create_reservation(
    payload: ReservationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    coords = CARPARK_COORDS.get(payload.carpark_id)
    if not coords:
        raise HTTPException(400, "Unknown carpark")
    # The hold fee comes from the driver's tier, never from the client.
    fee_cents = _tier(user, db)["hold_fee_cents"]
    start = now_utc()
    # ETA-linked: the hold window opens counting toward the driver's reported
    # arrival time, not a fixed clock -- window_end = now + ETA + buffer.
    window_end = start + timedelta(minutes=payload.eta_minutes + RESERVATION_WINDOW_MIN)

    r = Reservation(
        user_id=user.id,
        carpark_id=payload.carpark_id,
        carpark_name=payload.carpark_name,
        lat=coords[0], lon=coords[1],
        name=payload.name, plate=payload.plate,
        arrive_time=payload.arrive_time, leave_time=payload.leave_time,
        lot_type=payload.lot_type, payment_method=payload.payment_method, fee_cents=fee_cents,
        eta_minutes=payload.eta_minutes,
        window_start=start, window_end=window_end, grace_end=window_end,
        status="active",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@app.get("/api/reservations/active", response_model=ReservationOut | None)
def get_active_reservation(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = (
        db.query(Reservation)
        .filter(Reservation.user_id == user.id, Reservation.status.in_(["active", "extended"]))
        .order_by(Reservation.created_at.desc())
        .first()
    )
    if not r:
        return None
    _refresh_status(r)
    db.commit()
    return r


@app.get("/api/reservations/history", response_model=list[ReservationOut])
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Reservation)
        .filter(Reservation.user_id == user.id, Reservation.status.in_(["arrived", "cancelled", "expired"]))
        .order_by(Reservation.created_at.desc())
        .limit(20)
        .all()
    )
    for r in rows:
        _refresh_status(r)
    db.commit()
    return rows


@app.get("/api/reservations/{res_id}", response_model=ReservationOut)
def get_reservation(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    _refresh_status(r)
    db.commit()
    return r


@app.post("/api/reservations/{res_id}/extend", response_model=ReservationOut)
def extend_reservation(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    _refresh_status(r)
    if r.status not in ("active", "extended"):
        raise HTTPException(400, f"Cannot extend a reservation with status '{r.status}'")
    tier = _tier(user, db)
    if r.extended_count >= tier["max_extends"]:
        raise HTTPException(400, "Extend limit reached for this hold")
    # fee_cents is the running total charged for this booking, so receipts
    # include any paid extensions.
    if not tier["free_extend"]:
        r.fee_cents += EXTEND_FEE_CENTS
    r.window_end = r.window_end + timedelta(minutes=EXTEND_MIN)
    r.grace_end = r.window_end
    r.extended_count += 1
    r.extend_dismissed = False
    r.status = "extended"
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reservations/{res_id}/dismiss-prompt", response_model=ReservationOut)
def dismiss_prompt(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    r.extend_dismissed = True
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reservations/{res_id}/cancel", response_model=ReservationOut)
def cancel_reservation(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    _require_live(r, db, "cancel")
    r.status = "cancelled"
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reservations/{res_id}/arrive", response_model=ReservationOut)
def mark_arrived(
    res_id: str,
    payload: ArriveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    r = _owned_reservation(res_id, user, db)
    _require_live(r, db, "check in")

    # Arrival time = when the booking was made + the ETA given at the time.
    arrive_at = r.window_start + timedelta(minutes=r.eta_minutes)
    opens_at = arrive_at - timedelta(minutes=CHECKIN_OPENS_BEFORE_MIN)
    if now_utc() < opens_at:
        raise HTTPException(
            400, f"Check-in opens {CHECKIN_OPENS_BEFORE_MIN} minutes before your arrival time"
        )

    coords = CARPARK_COORDS.get(r.carpark_id)
    if not coords:
        raise HTTPException(400, "Can't verify arrival for this carpark")
    distance = _distance_m(payload.lat, payload.lon, *coords)
    allowance = ARRIVE_RADIUS_M + min(max(payload.accuracy_m or 0, 0), MAX_ACCURACY_ALLOWANCE_M)
    if distance > allowance:
        raise HTTPException(
            400,
            f"You're about {_format_distance(distance)} from {r.carpark_name}. "
            "Check in once you're at the carpark.",
        )

    r.status = "arrived"
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reservations/{res_id}/share", response_model=ShareOut)
def share_reservation(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    _require_live(r, db, "share")
    return ShareOut(token=create_share_token(r.id))


# Public, read-only view for a passenger's share link -- no login, and only
# what a passenger needs (no plate, name or payment details).
@app.get("/api/shared/{token}", response_model=SharedReservationOut)
def get_shared_reservation(token: str, db: Session = Depends(get_db)):
    res_id = decode_share_token(token)
    r = db.query(Reservation).filter(Reservation.id == res_id).first() if res_id else None
    if not r:
        raise HTTPException(404, "This share link is invalid or has expired")
    _refresh_status(r)
    db.commit()
    return r


@app.get("/api/health")
def health():
    return {"ok": True, "datamall_key_configured": bool(os.environ.get("DATAMALL_ACCOUNT_KEY"))}
