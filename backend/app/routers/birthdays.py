from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import current_user, require_role
from app.schemas.birthday import BirthdayIn, BirthdayOut, UpcomingOut
from app.services import birthdays as svc

router = APIRouter(prefix="/api/birthdays", tags=["birthdays"])
_editor = require_role("admin", "family")


def _today():
    tz = ZoneInfo(get_settings().app_timezone)
    return datetime.now(UTC).astimezone(tz).date()


@router.get("", response_model=list[BirthdayOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_all(db)


@router.get("/upcoming", response_model=list[UpcomingOut])
def upcoming(within: int = Query(30), db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.upcoming(db, today=_today(), within_days=within)


@router.post("", response_model=BirthdayOut)
def add(body: BirthdayIn, db: Session = Depends(get_db), _=Depends(_editor)):
    return svc.add(db, **body.model_dump())


@router.delete("/{birthday_id}")
def delete(birthday_id: int, db: Session = Depends(get_db), _=Depends(_editor)):
    if not svc.delete(db, birthday_id):
        raise HTTPException(404, "Birthday not found")
    return {"ok": True}
