import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth, people
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
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    db.close()

    def override():
        s = TS()
        try:
            yield s
        finally:
            s.close()

    _app.dependency_overrides[get_db] = override
    c = TestClient(_app)
    c.pid = p.id
    yield c
    _app.dependency_overrides.clear()


def _login(c, u):
    c.post("/api/auth/login", json={"username": u, "password": "pw"})


def test_parent_logs_but_cannot_set_target(env):
    _login(env, "mom")
    assert env.post(f"/api/people/{env.pid}/bp", json={"systolic": 130, "diastolic": 80}).status_code == 200
    assert env.put(
        f"/api/people/{env.pid}/bp/target",
        json={"sys_low": 110, "sys_high": 135, "dia_low": 70, "dia_high": 85, "doctor_label": "Dr. Lee"},
    ).status_code == 403


def test_status_appears_only_after_admin_sets_target(env):
    _login(env, "mom")
    env.post(f"/api/people/{env.pid}/bp", json={"systolic": 145, "diastolic": 85})
    assert env.get(f"/api/people/{env.pid}/bp").json()["readings"][0]["status"] is None
    _login(env, "admin")
    env.put(
        f"/api/people/{env.pid}/bp/target",
        json={"sys_low": 110, "sys_high": 135, "dia_low": 70, "dia_high": 85, "doctor_label": "Dr. Lee"},
    )
    body = env.get(f"/api/people/{env.pid}/bp").json()
    assert body["readings"][0]["status"] == {"systolic": "above", "diastolic": "within"}
    assert body["target"]["doctor_label"] == "Dr. Lee"
