from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_role
from app.models.user import User, ROLES
from app.schemas.account import AccountIn, AccountOut
from app.services import auth

router = APIRouter(prefix="/api/accounts", tags=["accounts"])
_admin = require_role("admin")


@router.get("", response_model=list[AccountOut])
def list_(db: Session = Depends(get_db), _: User = Depends(_admin)):
    return list(db.scalars(select(User).order_by(User.id)))


@router.post("", response_model=AccountOut)
def create(body: AccountIn, db: Session = Depends(get_db), _: User = Depends(_admin)):
    if body.role not in ROLES:
        raise HTTPException(422, "Invalid role")
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(409, "Username already exists")
    return auth.create_user(db, username=body.username, password=body.password,
                            display_name=body.display_name, role=body.role,
                            person_id=body.person_id)


@router.post("/{user_id}/deactivate", response_model=AccountOut)
def deactivate(user_id: int, db: Session = Depends(get_db), _: User = Depends(_admin)):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(404, "User not found")
    u.is_active = False
    db.commit()
    db.refresh(u)
    return u
