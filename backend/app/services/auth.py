from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.security import hash_password, verify_password


def create_user(db: Session, *, username: str, password: str, display_name: str,
                role: str, person_id: int | None = None) -> User:
    u = User(username=username, password_hash=hash_password(password),
             display_name=display_name, role=role, person_id=person_id)
    db.add(u); db.commit(); db.refresh(u)
    return u


def authenticate(db: Session, username: str, password: str) -> User | None:
    u = db.scalar(select(User).where(User.username == username))
    if u is None or not u.is_active:
        return None
    if not verify_password(password, u.password_hash):
        return None
    return u


def set_font_scale(db: Session, user: User, font_scale: str) -> None:
    user.font_scale = font_scale
    db.commit()
