import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import app.db as appdb
import mcpserver.context as ctx
from app.db import Base
from app.services import auth, people
from app.models.appointment import Appointment
import app.models  # noqa: F401
from mcpserver import tools_write


@pytest.fixture()
def wired(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    TS = sessionmaker(bind=engine)
    monkeypatch.setattr(appdb, "SessionLocal", TS)
    monkeypatch.setattr(ctx, "SessionLocal", TS)
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    from app.config import get_settings
    get_settings.cache_clear()
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    db.close()
    return TS


def test_add_appointment_for_dad_with_ride(wired):
    res = tools_write.familyhub_add_appointment(
        title="Cardiology", when="2026-07-02T14:00", who="dad", needs_ride=True)
    assert res["needs_ride"] is True and "Cardiology" in res["summary"]
    db = wired()
    a = db.scalar(select(Appointment))
    assert a.title == "Cardiology" and a.needs_ride and a.person_id is not None
    db.close()


def test_add_appointment_rejects_bad_date(wired):
    with pytest.raises(Exception) as e:
        tools_write.familyhub_add_appointment(title="x", when="next Thursday")
    assert "explicit ISO" in str(e.value)


def test_log_bp_records_reading(wired):
    res = tools_write.familyhub_log_bp(person="Dad", systolic=130, diastolic=80)
    assert "130/80" in res["summary"]
