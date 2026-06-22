from pydantic import BaseModel, ConfigDict


class ContactIn(BaseModel):
    name: str
    role: str
    phone: str
    address: str | None = None
    notes: str | None = None
    person_id: int | None = None
    is_emergency: bool = False
    sort_order: int = 0


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    phone: str
    address: str | None
    notes: str | None
    person_id: int | None
    is_emergency: bool
