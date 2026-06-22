from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class MedIn(BaseModel):
    name: str
    dose: str
    slot: str = "morning"
    purpose: str | None = None
    prescriber: str | None = None
    prn: bool = False
    reason: str | None = None


class DoseIn(BaseModel):
    new_dose: str
    reason: str | None = None


class StopIn(BaseModel):
    reason: str | None = None


class NoteIn(BaseModel):
    summary: str


class MedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    dose: str
    slot: str
    purpose: str | None
    prescriber: str | None
    prn: bool
    active: bool
    pack_pickup: date | None


class ChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    change_type: str
    summary: str
    reason: str | None
    recorded_at: datetime
    medication_id: int | None


class RegimenOut(BaseModel):
    regimen: list[MedOut]
    history: list[ChangeOut]
