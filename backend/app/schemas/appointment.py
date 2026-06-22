from datetime import datetime
from pydantic import BaseModel


class AppointmentIn(BaseModel):
    title: str
    start: datetime
    end: datetime | None = None
    location: str | None = None
    person_id: int | None = None
    for_both: bool = False
    needs_ride: bool = False
    notes: str | None = None
    recurrence: str = "none"        # none | monthly
    recur_day: int | None = None


class OccurrenceOut(BaseModel):
    appointment_id: int
    title: str
    start: datetime
    end: datetime | None
    location: str | None
    person_id: int | None
    for_both: bool
    needs_ride: bool
    notes: str | None
