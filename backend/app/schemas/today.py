from datetime import date
from pydantic import BaseModel
from app.schemas.appointment import OccurrenceOut
from app.schemas.todo import TodoOut
from app.schemas.birthday import UpcomingOut


class TodayOut(BaseModel):
    appointments: list[OccurrenceOut]
    rides_today: list[OccurrenceOut]
    open_todos: list[TodoOut]
    upcoming_birthdays: list[UpcomingOut]


class DayOut(BaseModel):
    date: date
    appointments: list[OccurrenceOut]


class WeekOut(BaseModel):
    week_start: date
    days: list[DayOut]
    driver_runs: list[OccurrenceOut]
