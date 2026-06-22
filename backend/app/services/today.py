from datetime import date, datetime, time, timedelta
from sqlalchemy.orm import Session
from app.services import appointments, todos, birthdays


def _day_window(d: date) -> tuple[datetime, datetime]:
    return datetime.combine(d, time.min), datetime.combine(d, time.max)


def today_rollup(db: Session, today: date) -> dict:
    start, end = _day_window(today)
    occ = appointments.list_between(db, start, end)
    open_todos = [t for t in todos.list_todos(db) if not t.done]
    return {
        "appointments": occ,
        "rides_today": [o for o in occ if o.needs_ride],
        "open_todos": open_todos,
        "upcoming_birthdays": birthdays.upcoming(db, today=today, within_days=14),
    }


def week_rollup(db: Session, week_start: date) -> dict:
    days: list[list] = []
    driver_runs: list = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        start, end = _day_window(d)
        occ = appointments.list_between(db, start, end)
        days.append(occ)
        driver_runs.extend(o for o in occ if o.needs_ride)
    driver_runs.sort(key=lambda o: o.start)
    return {"week_start": week_start, "days": days, "driver_runs": driver_runs}
