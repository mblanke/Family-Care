from datetime import datetime, timedelta, date
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import SessionLocal
from app.models.appointment import Appointment
from app.models.contact import Contact
from app.models.user import User
from app.services import auth, people, appointments, todos, grocery, birthdays, contacts as contacts_svc

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
        now = datetime.now()
        appointments.create(db, title="Pay bills at bank",
                            start=now.replace(day=5, hour=10, minute=0, second=0, microsecond=0),
                            location="Bank", recurrence="monthly", recur_day=5,
                            created_by=admin.id)
        appointments.create(db, title="Cardiology follow-up",
                            start=now.replace(hour=14, minute=0, second=0, microsecond=0),
                            needs_ride=True, created_by=admin.id)
        todos.add(db, text="Refill Dad's pill pack", created_by=admin.id)
        grocery.add(db, name="Eggs", store="costco", created_by=admin.id)
        grocery.add(db, name="Milk", store="grocery", created_by=admin.id)
        bday = (now + timedelta(days=5)).date()
        birthdays.add(db, name="Mom", month=bday.month, day=bday.day, year=1941)
    if db.scalar(select(Contact)) is None:
        contacts_svc.create(db, name="Dr. Lee (Family Doctor)", role="doctor",
                            phone="555-0100", is_emergency=False, sort_order=0)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db); print("Seeded.")
    finally:
        db.close()
