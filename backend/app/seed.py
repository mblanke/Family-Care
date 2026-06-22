from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import SessionLocal
from app.models.user import User
from app.services import auth, people

_PEOPLE = [("Dad", "dad", "#1f6feb", 0), ("Mom", "mom", "#a371f7", 1)]

def seed(db: Session) -> None:
    s = get_settings()
    if db.scalar(select(User).where(User.username == s.admin_username)) is None:
        auth.create_user(db, username=s.admin_username, password=s.admin_password,
                         display_name="Admin", role="admin")
    for name, slug, color, order in _PEOPLE:
        if people.get_person_by_slug(db, slug) is None:
            people.create_person(db, name=name, slug=slug, color=color, sort_order=order)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db); print("Seeded.")
    finally:
        db.close()
