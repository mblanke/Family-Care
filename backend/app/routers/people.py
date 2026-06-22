from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.schemas.auth import PersonOut
from app.services import people as people_service

router = APIRouter(prefix="/api/people", tags=["people"])

@router.get("", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_db), _=Depends(current_user)):
    return people_service.list_people(db)
