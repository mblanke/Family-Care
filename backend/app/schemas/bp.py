from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BpIn(BaseModel):
    systolic: int
    diastolic: int
    pulse: int | None = None
    taken_at: datetime | None = None
    note: str | None = None


class TargetIn(BaseModel):
    sys_low: int
    sys_high: int
    dia_low: int
    dia_high: int
    doctor_label: str


class TargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sys_low: int
    sys_high: int
    dia_low: int
    dia_high: int
    doctor_label: str


class ReadingOut(BaseModel):
    id: int
    systolic: int
    diastolic: int
    pulse: int | None
    taken_at: datetime
    note: str | None
    status: dict | None  # None unless a target is set; factual within/above/below


class BpView(BaseModel):
    readings: list[ReadingOut]
    target: TargetOut | None
