from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from uuid import uuid4
import hashlib
import json
from fastapi import HTTPException
from sqlalchemy import select
from . import db
from .config import settings

STATUSES = ("Pending", "Confirmed", "Done", "Cancelled")
TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Done", "Cancelled"},
    "Done": set(),
    "Cancelled": set(),
}


def now():
    return datetime.now(ZoneInfo(settings.salon_timezone))


def minutes(value):
    try:
        parsed = datetime.strptime(value, "%H:%M")
        if parsed.strftime("%H:%M") != value:
            raise ValueError
        return parsed.hour * 60 + parsed.minute
    except (ValueError, TypeError):
        raise HTTPException(422, "Time must use HH:MM (24 hour).") from None


def clock(value):
    return f"{value // 60:02d}:{value % 60:02d}"


def valid_date(value):
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(422, "Date must use YYYY-MM-DD.") from None
    if parsed < now().date():
        raise HTTPException(422, "Choose today or a future date.")
    if parsed > now().date() + timedelta(days=365):
        raise HTTPException(422, "Bookings open up to one year ahead.")
    return parsed


def get_service(conn, service_id):
    service = (
        conn.execute(
            select(db.services).where(
                db.services.c.id == service_id, db.services.c.active.is_(True)
            )
        )
        .mappings()
        .first()
    )
    if not service:
        raise HTTPException(404, "Service is unavailable.")
    return dict(service)


def get_booking(conn, booking_id):
    row = (
        conn.execute(select(db.bookings).where(db.bookings.c.id == booking_id))
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(404, "Booking not found.")
    return dict(row)


def availability(conn, day, service_id, exclude_id=None):
    valid_date(day)
    service = get_service(conn, service_id)
    occupied = (
        conn.execute(
            select(db.bookings).where(
                db.bookings.c.date == day, db.bookings.c.status != "Cancelled"
            )
        )
        .mappings()
        .all()
    )
    result = []
    current = now()
    for start in range(
        minutes(settings.salon_open),
        minutes(settings.salon_close) - service["duration"] + 1,
        settings.slot_minutes,
    ):
        end = start + service["duration"]
        if (
            day == current.date().isoformat()
            and start <= current.hour * 60 + current.minute
        ):
            continue
        if any(
            b["id"] != exclude_id
            and start < minutes(b["end_time"])
            and end > minutes(b["time"])
            for b in occupied
        ):
            continue
        result.append(clock(start))
    return result


def serialize_booking(conn, booking):
    service = (
        conn.execute(
            select(db.services).where(db.services.c.id == booking["service_id"])
        )
        .mappings()
        .one()
    )
    return {
        k: v
        for k, v in dict(booking).items()
        if k not in ("idempotency_key", "request_fingerprint")
    } | {"service_name": service["name"], "duration": service["duration"]}


def create_booking(payload, key=None):
    data = payload.model_dump()
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    with db.transaction() as conn:
        if key:
            existing = (
                conn.execute(
                    select(db.bookings).where(db.bookings.c.idempotency_key == key)
                )
                .mappings()
                .first()
            )
            if existing:
                if existing["request_fingerprint"] != fingerprint:
                    raise HTTPException(
                        409,
                        "This submission key was already used for different details.",
                    )
                return serialize_booking(conn, existing)
        minutes(data["time"])
        service = get_service(conn, data["service_id"])
        if data["time"] not in availability(conn, data["date"], data["service_id"]):
            raise HTTPException(
                409, "This slot is unavailable. Please select another time."
            )
        stamp = now().isoformat()
        booking = data | {
            "id": "BK-" + uuid4().hex[:12].upper(),
            "end_time": clock(minutes(data["time"]) + service["duration"]),
            "price_paise": service["price_paise"],
            "status": "Pending",
            "created_at": stamp,
            "updated_at": stamp,
            "idempotency_key": key,
            "request_fingerprint": fingerprint,
        }
        conn.execute(db.bookings.insert().values(**booking))
        return serialize_booking(conn, booking)


def update_booking(booking_id, payload):
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "Provide a status or a new date and time.")
    if ("date" in data) != ("time" in data):
        raise HTTPException(422, "Rescheduling needs both date and time.")
    if "status" in data and "date" in data:
        raise HTTPException(422, "Change status and reschedule in separate requests.")
    with db.transaction() as conn:
        old = get_booking(conn, booking_id)
        if "status" in data:
            if data["status"] not in TRANSITIONS[old["status"]]:
                raise HTTPException(
                    409, f"Cannot change {old['status']} to {data['status']}."
                )
        if "date" in data:
            if old["status"] in ("Done", "Cancelled"):
                raise HTTPException(
                    409, "Completed or cancelled bookings cannot be moved."
                )
            minutes(data["time"])
            if data["time"] not in availability(
                conn, data["date"], old["service_id"], old["id"]
            ):
                raise HTTPException(
                    409, "This slot is unavailable. Please select another time."
                )
            data["previous_slot"] = old["date"] + " " + old["time"]
            service = get_service(conn, old["service_id"])
            data["end_time"] = clock(minutes(data["time"]) + service["duration"])
        data["updated_at"] = now().isoformat()
        conn.execute(
            db.bookings.update().where(db.bookings.c.id == booking_id).values(**data)
        )
        return serialize_booking(conn, old | data)


def initialize(seed=True):
    db.metadata.create_all(db.engine)
    with db.transaction() as conn:
        for idx, (name, price, duration) in enumerate(
            [
                ("Haircut", 200, 30),
                ("Beard Trim", 100, 15),
                ("Hair Spa", 800, 45),
                ("Facial", 500, 40),
                ("Bridal Makeup", 5000, 120),
            ],
            1,
        ):
            if not conn.execute(
                select(db.services.c.id).where(db.services.c.id == idx)
            ).first():
                conn.execute(
                    db.services.insert().values(
                        id=idx,
                        name=name,
                        price_paise=price * 100,
                        duration=duration,
                        active=True,
                    )
                )
        if seed:
            today = now().date().isoformat()
            for idx, status in enumerate(["Pending", "Confirmed", "Done"], 1):
                ident = f"DEMO-{idx}"
                if not conn.execute(
                    select(db.bookings.c.id).where(db.bookings.c.id == ident)
                ).first():
                    service = get_service(conn, idx)
                    stamp = now().isoformat()
                    conn.execute(
                        db.bookings.insert().values(
                            id=ident,
                            customer_name=["Aarav Shah", "Meera Patil", "Rohan Desai"][
                                idx - 1
                            ],
                            phone=f"900000000{idx}",
                            service_id=idx,
                            date=today,
                            time=f"{9 + idx:02d}:00",
                            end_time=clock((9 + idx) * 60 + service["duration"]),
                            price_paise=service["price_paise"],
                            status=status,
                            created_at=stamp,
                            updated_at=stamp,
                        )
                    )
