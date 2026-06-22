from dataclasses import dataclass
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.appointment import Appointment

@dataclass
class Occurrence:
    appointment_id: int
    title: str
    start: datetime
    end: datetime | None
    location: str | None
    person_id: int | None
    for_both: bool
    needs_ride: bool
    notes: str | None

def create(db: Session, *, title, start, end=None, location=None, person_id=None,
           for_both=False, needs_ride=False, notes=None, recurrence="none",
           recur_day=None, created_by) -> Appointment:
    a = Appointment(title=title, start=start, end=end, location=location, person_id=person_id,
                    for_both=for_both, needs_ride=needs_ride, notes=notes, recurrence=recurrence,
                    recur_day=recur_day, created_by=created_by)
    db.add(a); db.commit(); db.refresh(a)
    return a

def get(db: Session, appt_id: int) -> Appointment | None:
    return db.get(Appointment, appt_id)

def update(db: Session, appt_id: int, **fields) -> Appointment | None:
    a = db.get(Appointment, appt_id)
    if a is None:
        return None
    for k, v in fields.items():
        setattr(a, k, v)
    db.commit(); db.refresh(a)
    return a

def cancel(db: Session, appt_id: int) -> bool:
    a = db.get(Appointment, appt_id)
    if a is None:
        return False
    a.canceled = True; db.commit()
    return True

def _add_months(d: datetime, months: int) -> datetime:
    m = d.month - 1 + months
    year = d.year + m // 12
    month = m % 12 + 1
    return d.replace(year=year, month=month)

def expand_occurrences(a: Appointment, window_start: datetime, window_end: datetime) -> list[Occurrence]:
    def occ(start: datetime) -> Occurrence:
        return Occurrence(a.id, a.title, start, a.end, a.location, a.person_id,
                          a.for_both, a.needs_ride, a.notes)
    if a.recurrence == "none":
        return [occ(a.start)] if window_start <= a.start <= window_end else []
    out: list[Occurrence] = []
    cur = a.start
    # fast-forward to window
    while cur < window_start:
        cur = _add_months(cur, 1)
    while cur <= window_end:
        out.append(occ(cur))
        cur = _add_months(cur, 1)
    return out

def list_between(db: Session, start: datetime, end: datetime, *, include_canceled=False) -> list[Occurrence]:
    stmt = select(Appointment)
    if not include_canceled:
        stmt = stmt.where(Appointment.canceled.is_(False))
    rows = db.scalars(stmt).all()
    out: list[Occurrence] = []
    for a in rows:
        out.extend(expand_occurrences(a, start, end))
    out.sort(key=lambda o: o.start)
    return out
