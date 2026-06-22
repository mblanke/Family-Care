from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.medication import MedIn, DoseIn, StopIn, NoteIn, MedOut, ChangeOut, RegimenOut
from app.services import medications as svc

router = APIRouter(prefix="/api", tags=["medications"])
_admin = require_role("admin")


@router.get("/people/{pid}/medications", response_model=RegimenOut)
def get_regimen(pid: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    return RegimenOut(regimen=svc.list_regimen(db, pid), history=svc.history(db, pid))


@router.post("/people/{pid}/medications", response_model=MedOut)
def add_med(pid: int, body: MedIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    return svc.add_med(
        db,
        person_id=pid,
        name=body.name,
        dose=body.dose,
        slot=body.slot,
        purpose=body.purpose,
        prescriber=body.prescriber,
        prn=body.prn,
        reason=body.reason,
        recorded_by=user.id,
    )


@router.post("/medications/{mid}/dose", response_model=MedOut)
def change_dose(mid: int, body: DoseIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    m = svc.change_dose(db, medication_id=mid, new_dose=body.new_dose, reason=body.reason, recorded_by=user.id)
    if m is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    return m


@router.post("/medications/{mid}/stop", response_model=MedOut)
def stop_med(mid: int, body: StopIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    m = svc.stop_med(db, medication_id=mid, reason=body.reason, recorded_by=user.id)
    if m is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    return m


@router.post("/people/{pid}/medications/note", response_model=ChangeOut)
def add_note(pid: int, body: NoteIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    return svc.add_note(db, person_id=pid, summary=body.summary, recorded_by=user.id)
