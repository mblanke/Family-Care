from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.bp import BpIn, TargetIn, TargetOut, ReadingOut, BpView
from app.services import bp as svc

router = APIRouter(prefix="/api", tags=["bp"])
_logger = require_role("admin", "family", "parent")
_admin = require_role("admin")


@router.get("/people/{pid}/bp", response_model=BpView)
def get_bp(
    pid: int,
    days: int = Query(30),
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
):
    since = None if days == 0 else datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    target = svc.get_target(db, pid)
    rows = svc.list_readings(db, pid, since=since)
    readings = [
        ReadingOut(
            id=r.id,
            systolic=r.systolic,
            diastolic=r.diastolic,
            pulse=r.pulse,
            taken_at=r.taken_at,
            note=r.note,
            status=svc.status_for(r, target),
        )
        for r in rows
    ]
    return BpView(readings=readings, target=TargetOut.model_validate(target) if target else None)


@router.post("/people/{pid}/bp", response_model=ReadingOut)
def log_reading(
    pid: int,
    body: BpIn,
    db: Session = Depends(get_db),
    user: User = Depends(_logger),
):
    r = svc.log_reading(
        db,
        person_id=pid,
        systolic=body.systolic,
        diastolic=body.diastolic,
        pulse=body.pulse,
        taken_at=body.taken_at,
        note=body.note,
        recorded_by=user.id,
    )
    return ReadingOut(
        id=r.id,
        systolic=r.systolic,
        diastolic=r.diastolic,
        pulse=r.pulse,
        taken_at=r.taken_at,
        note=r.note,
        status=svc.status_for(r, svc.get_target(db, pid)),
    )


@router.put("/people/{pid}/bp/target", response_model=TargetOut)
def set_target(
    pid: int,
    body: TargetIn,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
):
    return svc.set_target(db, person_id=pid, **body.model_dump())
