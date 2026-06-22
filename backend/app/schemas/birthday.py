from datetime import date
from pydantic import BaseModel, ConfigDict


class BirthdayIn(BaseModel):
    name: str
    month: int
    day: int
    year: int | None = None


class BirthdayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    month: int
    day: int
    year: int | None


class UpcomingOut(BaseModel):
    birthday_id: int
    name: str
    next_date: date
    days_until: int
    turning: int | None
