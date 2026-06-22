import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import app.db as appdb
import mcpserver.context as ctx
from app.db import Base
from app.services import auth, people, appointments, grocery, medications
from app.models.appointment import Appointment
import app.models  # noqa: F401
from mcpserver import tools_destructive as td


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
    u = auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    from datetime import datetime
    appointments.create(db, title="X", start=datetime(2026, 7, 2, 9, 0), created_by=u.id)
    db.commit()
    db.close()
    return TS


def test_cancel_requires_confirm(wired):
    res = td.familyhub_cancel_appointment(appointment_id=1, confirm=False)
    assert res["confirmation_required"] is True
    db = wired()
    assert db.scalar(select(Appointment)).canceled is False  # nothing happened yet
    db.close()
    res2 = td.familyhub_cancel_appointment(appointment_id=1, confirm=True)
    assert res2.get("done") is True


def test_clear_checked_requires_confirm(wired):
    # seed a checked grocery item
    db = wired()
    from app.models.user import User
    u = db.scalar(select(User))
    g = grocery.add(db, name="Bananas", store="grocery", created_by=u.id)
    grocery.set_checked(db, g.id, True)
    db.close()

    res = td.familyhub_clear_checked(confirm=False)
    assert res["confirmation_required"] is True
    # item still exists
    db = wired()
    from app.models.grocery import GroceryItem
    assert db.scalar(select(GroceryItem)) is not None
    db.close()

    res2 = td.familyhub_clear_checked(confirm=True)
    assert res2.get("done") is True


def test_log_medication_change_appends_exactly(wired):
    res = td.familyhub_log_medication_change(
        person="Dad",
        change_type="note",
        summary="Pharmacist switched to generic",
        confirm=False,
    )
    assert res["confirmation_required"] is True

    td.familyhub_log_medication_change(
        person="Dad",
        change_type="note",
        summary="Pharmacist switched to generic",
        confirm=True,
    )
    db = wired()
    p = people.get_person_by_slug(db, "dad")
    hist = medications.history(db, p.id)
    assert hist[0].summary == "Pharmacist switched to generic"
    db.close()


def test_log_medication_change_invalid_type(wired):
    with pytest.raises(ValueError, match="change_type must be one of"):
        td.familyhub_log_medication_change(
            person="Dad",
            change_type="unknown",
            summary="test",
            confirm=True,
        )


def test_cancel_nonexistent_appointment(wired):
    with pytest.raises(ValueError, match="No appointment with id 999"):
        td.familyhub_cancel_appointment(appointment_id=999, confirm=False)
