from datetime import date, datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import auth, appointments, todos, birthdays, today
import app.models  # noqa: F401


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()


def test_today_rollup_filters_to_today_and_rides(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    appointments.create(db, title="Cardio", start=datetime(2026, 6, 22, 14, 0), needs_ride=True, created_by=u.id)
    appointments.create(db, title="Tomorrow", start=datetime(2026, 6, 23, 9, 0), created_by=u.id)
    todos.add(db, text="Milk", created_by=u.id)
    birthdays.add(db, name="Mom", month=6, day=25)
    roll = today.today_rollup(db, today=date(2026, 6, 22))
    assert [a.title for a in roll["appointments"]] == ["Cardio"]
    assert [a.title for a in roll["rides_today"]] == ["Cardio"]
    assert roll["open_todos"][0].text == "Milk"
    assert roll["upcoming_birthdays"][0].name == "Mom"


def test_week_rollup_collects_driver_runs(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    appointments.create(db, title="Ride1", start=datetime(2026, 6, 22, 9, 0), needs_ride=True, created_by=u.id)
    appointments.create(db, title="Ride2", start=datetime(2026, 6, 25, 9, 0), needs_ride=True, created_by=u.id)
    wk = today.week_rollup(db, week_start=date(2026, 6, 22))
    assert [r.title for r in wk["driver_runs"]] == ["Ride1", "Ride2"]
    assert len(wk["days"]) == 7
