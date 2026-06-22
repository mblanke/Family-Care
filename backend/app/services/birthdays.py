from dataclasses import dataclass
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.birthday import Birthday


@dataclass
class UpcomingBirthday:
    birthday_id: int
    name: str
    next_date: date
    days_until: int
    turning: int | None


def add(db: Session, *, name: str, month: int, day: int, year: int | None = None) -> Birthday:
    b = Birthday(name=name, month=month, day=day, year=year)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def delete(db: Session, birthday_id: int) -> bool:
    b = db.get(Birthday, birthday_id)
    if b is None:
        return False
    db.delete(b)
    db.commit()
    return True


def list_all(db: Session) -> list[Birthday]:
    return list(db.scalars(select(Birthday).order_by(Birthday.month, Birthday.day)))


def _next_occurrence(today: date, month: int, day: int) -> date:
    try:
        cand = date(today.year, month, day)
    except ValueError:  # e.g. Feb 29 in a non-leap year
        cand = date(today.year, month, 28)
    if cand < today:
        cand = date(today.year + 1, month, min(day, 28))
    return cand


def upcoming(db: Session, today: date, within_days: int = 30) -> list[UpcomingBirthday]:
    out: list[UpcomingBirthday] = []
    for b in db.scalars(select(Birthday)):
        nxt = _next_occurrence(today, b.month, b.day)
        days = (nxt - today).days
        if 0 <= days <= within_days:
            turning = (nxt.year - b.year) if b.year else None
            out.append(UpcomingBirthday(b.id, b.name, nxt, days, turning))
    out.sort(key=lambda u: u.days_until)
    return out
