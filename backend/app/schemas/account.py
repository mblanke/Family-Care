from pydantic import BaseModel, ConfigDict


class AccountIn(BaseModel):
    username: str
    password: str
    display_name: str
    role: str
    person_id: int | None = None


class AccountOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    person_id: int | None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)
