from datetime import date
from app.services import birthdays


def test_upcoming_within_window_and_days_until(db):
    birthdays.add(db, name="Mom", month=6, day=25, year=1941)
    birthdays.add(db, name="Cousin", month=12, day=1)
    up = birthdays.upcoming(db, today=date(2026, 6, 22), within_days=30)
    assert [u.name for u in up] == ["Mom"]
    assert up[0].days_until == 3
    assert up[0].turning == 85


def test_upcoming_wraps_year_boundary(db):
    birthdays.add(db, name="NewYear", month=1, day=2)
    up = birthdays.upcoming(db, today=date(2026, 12, 28), within_days=10)
    assert up and up[0].days_until == 5
