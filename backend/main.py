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
from auth import create_access_token, decode_access_token, hash_password, verify_password
from database import Base, engine, get_db
from models import Reservation, User, now_utc

Base.metadata.create_all(bind=engine)

RESERVATION_WINDOW_MIN = int(os.environ.get("RESERVATION_WINDOW_MIN", 15))
EXTEND_MIN = int(os.environ.get("EXTEND_MIN", 10))
EXTEND_FEE_CENTS = int(os.environ.get("EXTEND_FEE_CENTS", 150))
MAX_EXTENDS = int(os.environ.get("MAX_EXTENDS", 1))

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
    start = now_utc()
    # ETA-linked: the hold window opens counting toward the driver's reported
    # arrival time, not a fixed clock -- window_end = now + ETA + buffer.
    window_end = start + timedelta(minutes=payload.eta_minutes + RESERVATION_WINDOW_MIN)

    r = Reservation(
        user_id=user.id,
        carpark_id=payload.carpark_id,
        carpark_name=payload.carpark_name,
        lat=payload.lat, lon=payload.lon,
        name=payload.name, plate=payload.plate,
        arrive_time=payload.arrive_time, leave_time=payload.leave_time,
        lot_type=payload.lot_type, payment_method=payload.payment_method, fee_cents=payload.fee_cents,
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
    if r.extended_count >= MAX_EXTENDS:
        raise HTTPException(400, "Extend limit reached for this hold")
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
    r.status = "cancelled"
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reservations/{res_id}/arrive", response_model=ReservationOut)
def mark_arrived(res_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = _owned_reservation(res_id, user, db)
    r.status = "arrived"
    db.commit()
    db.refresh(r)
    return r


@app.get("/api/health")
def health():
    return {"ok": True, "datamall_key_configured": bool(os.environ.get("DATAMALL_ACCOUNT_KEY"))}
