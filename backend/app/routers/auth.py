from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.auth import LoginIn, FontScaleIn, UserOut
from app.security import SESSION_COOKIE, SESSION_MAX_AGE, sign_session
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    response.set_cookie(SESSION_COOKIE, sign_session(user.id), max_age=SESSION_MAX_AGE,
                        httponly=True, samesite="lax")
    return {"user": UserOut.model_validate(user)}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}

@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": UserOut.model_validate(user), "app_display_name": get_settings().app_display_name}

@router.put("/me/font-scale")
def set_font_scale(body: FontScaleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.font_scale not in ("normal", "large"):
        raise HTTPException(status_code=422, detail="font_scale must be 'normal' or 'large'")
    auth_service.set_font_scale(db, user, body.font_scale)
    return {"ok": True}
