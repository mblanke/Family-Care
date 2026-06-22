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


def _login(c, u):
    c.post("/api/auth/login", json={"username": u, "password": "pw"})


def test_parent_can_view_not_edit(env):
    _login(env, "admin")
    assert env.post("/api/contacts", json={"name": "Dr. Lee", "role": "doctor", "phone": "555-1000"}).status_code == 200
    _login(env, "mom")
    assert env.get("/api/contacts").status_code == 200
    assert env.post("/api/contacts", json={"name": "x", "role": "other", "phone": "1"}).status_code == 403


def test_invalid_role_rejected(env):
    _login(env, "admin")
    assert env.post("/api/contacts", json={"name": "x", "role": "wizard", "phone": "1"}).status_code == 422


def test_family_can_create_update_delete(env):
    _login(env, "fam")
    r = env.post("/api/contacts", json={"name": "Ambulance", "role": "paramedics", "phone": "911", "is_emergency": True})
    assert r.status_code == 200
    cid = r.json()["id"]

    r2 = env.put(f"/api/contacts/{cid}", json={"name": "Ambulance", "role": "paramedics", "phone": "000"})
    assert r2.status_code == 200
    assert r2.json()["phone"] == "000"

    r3 = env.delete(f"/api/contacts/{cid}")
    assert r3.status_code == 200
    assert r3.json() == {"ok": True}


def test_put_404(env):
    _login(env, "admin")
    r = env.put("/api/contacts/9999", json={"name": "X", "role": "doctor", "phone": "1"})
    assert r.status_code == 404


def test_delete_404(env):
    _login(env, "admin")
    r = env.delete("/api/contacts/9999")
    assert r.status_code == 404
