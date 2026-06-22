from contextlib import contextmanager
from datetime import datetime
from sqlalchemy import select
from app.config import get_settings
from app.db import SessionLocal
from app.models.person import Person
from app.models.user import User
from app.services import people


class PersonNotFound(Exception):
    def __init__(self, who: str, available: list[str]):
        super().__init__(
            f"No care recipient matches '{who}'. "
            f"Available: {', '.join(available) or 'none'}."
        )


class AmbiguousDate(Exception):
    def __init__(self, text: str):
        super().__init__(
            f"Could not read an exact date/time from '{text}'. "
            f"Provide an explicit ISO value like 2026-07-02T14:00."
        )


@contextmanager
def session():
    """Yield a SQLAlchemy DB session and close it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def admin_user_id(db) -> int:
    """Return the id of the configured admin user; raise RuntimeError if missing."""
    name = get_settings().admin_username
    u = db.scalar(select(User).where(User.username == name, User.role == "admin"))
    if u is None:
        raise RuntimeError(
            f"No admin account '{name}' exists. Run the seed script first."
        )
    return u.id


def resolve_person(db, who: str) -> Person:
    """Resolve a care-recipient by slug or case-insensitive name; raise PersonNotFound if none."""
    key = who.strip().lower()
    p = people.get_person_by_slug(db, key)
    if p is None:
        for cand in people.list_people(db):
            if cand.name.lower() == key:
                p = cand
                break
    if p is None:
        raise PersonNotFound(who, [c.name for c in people.list_people(db)])
    return p


def parse_when(text_or_iso: str) -> datetime:
    """Parse an ISO datetime string; raise AmbiguousDate on anything non-ISO."""
    try:
        return datetime.fromisoformat(text_or_iso)
    except ValueError:
        raise AmbiguousDate(text_or_iso)
