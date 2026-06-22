import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth
import app.models  # noqa: F401


@pytest.fixture()
def env():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TS = sessionmaker(bind=engine)
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="fam", password="pw", display_name="Fam", role="family")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    db.close()

    def override():
        s = TS()
        try:
            yield s
        finally:
            s.close()

    _app.dependency_overrides[get_db] = override
    yield TestClient(_app)
    _app.dependency_overrides.clear()


def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})


def test_family_can_create_parent_cannot(env):
    _login(env, "fam")
    r = env.post("/api/appointments", json={"title": "Physio", "start": "2026-07-03T10:00:00",
                 "needs_ride": True})
    assert r.status_code == 200
    _login(env, "mom")
    assert env.post("/api/appointments", json={"title": "x", "start": "2026-07-03T10:00:00"}).status_code == 403


def test_list_returns_occurrences(env):
    _login(env, "admin")
    env.post("/api/appointments", json={"title": "Bank", "start": "2026-07-05T10:00:00",
             "location": "Bank", "recurrence": "monthly", "recur_day": 5})
    r = env.get("/api/appointments", params={"start": "2026-07-01T00:00:00", "end": "2026-09-30T00:00:00"})
    assert [o["start"][:7] for o in r.json()] == ["2026-07", "2026-08", "2026-09"]
