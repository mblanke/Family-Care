from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import SessionLocal
from app.models.appointment import Appointment
from app.models.user import User
from app.services import auth, people, appointments, todos, grocery, birthdays

_PEOPLE = [("Dad", "dad", "#1f6feb", 0), ("Mom", "mom", "#a371f7", 1)]

def seed(db: Session) -> None:
    s = get_settings()
    if db.scalar(select(User).where(User.username == s.admin_username)) is None:
        auth.create_user(db, username=s.admin_username, password=s.admin_password,
                         display_name="Admin", role="admin")
    for name, slug, color, order in _PEOPLE:
        if people.get_person_by_slug(db, slug) is None:
            people.create_person(db, name=name, slug=slug, color=color, sort_order=order)

    admin = db.scalar(select(User).where(User.username == s.admin_username))
    if db.scalar(select(Appointment)) is None and admin:
        appointments.create(db, title="Pay bills at bank",
                            start=datetime(2026, 7, 5, 10, 0),
                            location="Bank", recurrence="monthly", recur_day=5,
                            created_by=admin.id)
        appointments.create(db, title="Cardiology follow-up",
                            start=datetime(2026, 7, 9, 14, 0),
                            needs_ride=True, created_by=admin.id)
        todos.add(db, text="Refill Dad's pill pack", created_by=admin.id)
        grocery.add(db, name="Eggs", store="costco", created_by=admin.id)
        grocery.add(db, name="Milk", store="grocery", created_by=admin.id)
        birthdays.add(db, name="Mom", month=6, day=25, year=1941)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db); print("Seeded.")
    finally:
        db.close()
