from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.contact import CONTACT_ROLES
from app.schemas.contact import ContactIn, ContactOut
from app.services import contacts as svc

router = APIRouter(prefix="/api/contacts", tags=["contacts"])
_editor = require_role("admin", "family")


@router.get("", response_model=list[ContactOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_contacts(db)


@router.post("", response_model=ContactOut)
def create(body: ContactIn, db: Session = Depends(get_db), _=Depends(_editor)):
    if body.role not in CONTACT_ROLES:
        raise HTTPException(422, f"role must be one of: {', '.join(CONTACT_ROLES)}")
    return svc.create(db, **body.model_dump())


@router.put("/{contact_id}", response_model=ContactOut)
def update(contact_id: int, body: ContactIn, db: Session = Depends(get_db), _=Depends(_editor)):
    if body.role not in CONTACT_ROLES:
        raise HTTPException(422, f"role must be one of: {', '.join(CONTACT_ROLES)}")
    c = svc.update(db, contact_id, **body.model_dump())
    if c is None:
        raise HTTPException(404, "Contact not found")
    return c


@router.delete("/{contact_id}")
def delete(contact_id: int, db: Session = Depends(get_db), _=Depends(_editor)):
    if not svc.delete(db, contact_id):
        raise HTTPException(404, "Contact not found")
    return {"ok": True}
