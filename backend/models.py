import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, String, DateTime, Float, Boolean, Integer
from database import Base


def now_utc():
    # Naive (no tzinfo), not aware -- SQLite drops tzinfo on write, so a
    # value read back from the DB is always naive. Storing/comparing naive
    # throughout avoids "can't compare offset-naive and offset-aware
    # datetimes" once a row has done a round trip.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def gen_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=now_utc)


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, nullable=False, index=True)
    carpark_id = Column(String, nullable=False)
    carpark_name = Column(String, nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)

    # Display-only booking details -- not used for any timing math, just
    # echoed back so the driver's confirmation/tracking screens can show
    # what they actually booked.
    name = Column(String, nullable=True)
    plate = Column(String, nullable=True)
    arrive_time = Column(String, nullable=True)  # "HH:MM"
    leave_time = Column(String, nullable=True)  # "HH:MM"
    lot_type = Column(String, default="standard")
    payment_method = Column(String, default="card")
    fee_cents = Column(Integer, default=0)

    eta_minutes = Column(Integer, nullable=False)  # driver-reported ETA at booking time
    window_start = Column(DateTime, default=now_utc)
    window_end = Column(DateTime, nullable=False)  # when the hold expires (ETA + reservation window)
    grace_end = Column(DateTime, nullable=False)  # auto-release cutoff after window_end

    status = Column(String, default="active")  # active, extended, arrived, expired, cancelled
    extended_count = Column(Integer, default=0)
    extend_dismissed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)
