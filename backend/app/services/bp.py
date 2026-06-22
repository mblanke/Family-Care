from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.bp_reading import BpReading, BpTarget


def log_reading(
    db: Session,
    *,
    person_id: int,
    systolic: int,
    diastolic: int,
    recorded_by: int,
    pulse: int | None = None,
    taken_at: datetime | None = None,
    note: str | None = None,
) -> BpReading:
    r = BpReading(
        person_id=person_id,
        systolic=systolic,
        diastolic=diastolic,
        pulse=pulse,
        note=note,
        recorded_by=recorded_by,
        **({"taken_at": taken_at} if taken_at else {}),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def list_readings(
    db: Session, person_id: int, *, since: datetime | None = None
) -> list[BpReading]:
    stmt = select(BpReading).where(BpReading.person_id == person_id)
    if since is not None:
        stmt = stmt.where(BpReading.taken_at >= since)
    return list(db.scalars(stmt.order_by(BpReading.taken_at.desc())))


def get_target(db: Session, person_id: int) -> BpTarget | None:
    return db.get(BpTarget, person_id)


def set_target(
    db: Session,
    *,
    person_id: int,
    sys_low: int,
    sys_high: int,
    dia_low: int,
    dia_high: int,
    doctor_label: str,
) -> BpTarget:
    t = db.get(BpTarget, person_id)
    if t is None:
        t = BpTarget(person_id=person_id)
        db.add(t)
    t.sys_low = sys_low
    t.sys_high = sys_high
    t.dia_low = dia_low
    t.dia_high = dia_high
    t.doctor_label = doctor_label
    db.commit()
    db.refresh(t)
    return t


def _band(value: int, low: int, high: int) -> str:
    if value < low:
        return "below"
    if value > high:
        return "above"
    return "within"


def status_for(reading: BpReading, target: BpTarget | None) -> dict | None:
    if target is None:
        return None
    return {
        "systolic": _band(reading.systolic, target.sys_low, target.sys_high),
        "diastolic": _band(reading.diastolic, target.dia_low, target.dia_high),
    }
