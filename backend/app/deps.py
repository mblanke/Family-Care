from collections.abc import Callable
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.security import SESSION_COOKIE, read_session

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    uid = read_session(token) if token else None
    user = db.get(User, uid) if uid else None
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_role(*allowed: str) -> Callable[..., User]:
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker
