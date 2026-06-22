import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import auth, people
import app.models  # noqa: F401
from mcpserver import context


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


def test_resolve_person_by_name_or_slug(db):
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    assert context.resolve_person(db, "dad").name == "Dad"
    assert context.resolve_person(db, "Dad").name == "Dad"
    with pytest.raises(context.PersonNotFound) as e:
        context.resolve_person(db, "Grandpa")
    assert "Dad" in str(e.value)  # actionable: lists available names


def test_parse_when_requires_explicit_datetime():
    from datetime import datetime
    assert context.parse_when("2026-07-02T14:00") == datetime(2026, 7, 2, 14, 0)
    with pytest.raises(context.AmbiguousDate):
        context.parse_when("next Thursday")


def test_admin_user_id_resolves(db, monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    from app.config import get_settings
    get_settings.cache_clear()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    assert context.admin_user_id(db) > 0
