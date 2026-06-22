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
    auth.create_user(db, username="fam", password="pw", display_name="Fam", role="family")
    auth.create_user(db, username="par", password="pw", display_name="Par", role="parent")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
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


def test_only_admin_edits_meds_family_can_view(env):
    # family cannot add a med
    _login(env, "fam")
    assert env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "X", "dose": "1", "slot": "morning"},
    ).status_code == 403

    # admin can add a med
    _login(env, "admin")
    r = env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "Amlodipine", "dose": "10 mg", "slot": "morning"},
    )
    assert r.status_code == 200

    # family can view the regimen
    _login(env, "fam")
    got = env.get(f"/api/people/{env.pid}/medications")
    assert got.status_code == 200
    assert got.json()["regimen"][0]["name"] == "Amlodipine"


def test_parent_cannot_edit_meds(env):
    # parent cannot add a med
    _login(env, "par")
    assert env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "X", "dose": "1", "slot": "morning"},
    ).status_code == 403

    # parent can view
    _login(env, "admin")
    env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "Metformin", "dose": "500 mg", "slot": "evening"},
    )
    _login(env, "par")
    got = env.get(f"/api/people/{env.pid}/medications")
    assert got.status_code == 200
    assert got.json()["regimen"][0]["name"] == "Metformin"


def test_dose_change_appends_history(env):
    _login(env, "admin")
    mid = env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "Amlodipine", "dose": "10 mg", "slot": "morning"},
    ).json()["id"]
    assert (
        env.post(
            f"/api/medications/{mid}/dose",
            json={"new_dose": "5 mg", "reason": "Dr. Lee"},
        ).status_code
        == 200
    )
    hist = env.get(f"/api/people/{env.pid}/medications").json()["history"]
    assert hist[0]["change_type"] == "dose_changed"


def test_stop_med(env):
    _login(env, "admin")
    mid = env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "OldMed", "dose": "50 mg", "slot": "noon"},
    ).json()["id"]
    r = env.post(f"/api/medications/{mid}/stop", json={"reason": "no longer needed"})
    assert r.status_code == 200
    assert r.json()["active"] is False


def test_add_note(env):
    _login(env, "admin")
    r = env.post(
        f"/api/people/{env.pid}/medications/note",
        json={"summary": "Patient doing well"},
    )
    assert r.status_code == 200
    assert r.json()["change_type"] == "note"


def test_family_cannot_stop_or_note(env):
    _login(env, "admin")
    mid = env.post(
        f"/api/people/{env.pid}/medications",
        json={"name": "TestMed", "dose": "10 mg", "slot": "morning"},
    ).json()["id"]
    _login(env, "fam")
    assert env.post(f"/api/medications/{mid}/stop", json={}).status_code == 403
    assert env.post(
        f"/api/people/{env.pid}/medications/note", json={"summary": "note"}
    ).status_code == 403


def test_dose_change_404_unknown_med(env):
    _login(env, "admin")
    assert env.post("/api/medications/9999/dose", json={"new_dose": "1 mg"}).status_code == 404


def test_parent_403_on_add_med(env):
    _login(env, "par")
    assert (
        env.post(
            f"/api/people/{env.pid}/medications",
            json={"name": "X", "dose": "1", "slot": "morning"},
        ).status_code
        == 403
    )


def test_parent_403_on_change_dose(env):
    _login(env, "par")
    assert (
        env.post(
            "/api/medications/1/dose", json={"new_dose": "5 mg", "reason": "test"}
        ).status_code
        == 403
    )


def test_parent_403_on_stop_med(env):
    _login(env, "par")
    assert env.post("/api/medications/1/stop", json={"reason": "test"}).status_code == 403


def test_parent_403_on_add_note(env):
    _login(env, "par")
    assert (
        env.post(
            f"/api/people/{env.pid}/medications/note",
            json={"summary": "test note"},
        ).status_code
        == 403
    )


def test_family_403_on_change_dose(env):
    _login(env, "fam")
    assert (
        env.post(
            "/api/medications/1/dose", json={"new_dose": "5 mg", "reason": "test"}
        ).status_code
        == 403
    )


def test_stop_med_404_unknown_med(env):
    _login(env, "admin")
    assert env.post("/api/medications/99999/stop", json={"reason": "test"}).status_code == 404
