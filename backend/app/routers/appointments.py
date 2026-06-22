from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.appointment import AppointmentIn, OccurrenceOut
from app.services import appointments as svc

router = APIRouter(prefix="/api/appointments", tags=["appointments"])
_editor = require_role("admin", "family")


@router.get("", response_model=list[OccurrenceOut])
def list_appointments(start: datetime = Query(...), end: datetime = Query(...),
                      db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_between(db, start, end)


@router.post("", response_model=OccurrenceOut)
def create(body: AppointmentIn, db: Session = Depends(get_db), user: User = Depends(_editor)):
    a = svc.create(db, created_by=user.id, **body.model_dump())
    return svc.expand_occurrences(a, a.start, a.start)[0]


@router.put("/{appt_id}")
def update(appt_id: int, body: AppointmentIn, db: Session = Depends(get_db), _: User = Depends(_editor)):
    if svc.update(db, appt_id, **body.model_dump()) is None:
        raise HTTPException(404, "Appointment not found")
    return {"ok": True}


@router.post("/{appt_id}/cancel")
def cancel(appt_id: int, db: Session = Depends(get_db), _: User = Depends(_editor)):
    if not svc.cancel(db, appt_id):
        raise HTTPException(404, "Appointment not found")
    return {"ok": True}
