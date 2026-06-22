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


def test_only_admin_manages_accounts(env):
    _login(env, "mom")
    assert env.get("/api/accounts").status_code == 403
    _login(env, "admin")
    assert env.get("/api/accounts").status_code == 200
    r = env.post("/api/accounts", json={"username": "sis", "password": "x",
                 "display_name": "Sister", "role": "family"})
    assert r.status_code == 200
    assert any(u["username"] == "sis" for u in env.get("/api/accounts").json())


def test_invalid_role_returns_422(env):
    _login(env, "admin")
    r = env.post("/api/accounts", json={"username": "x", "password": "x",
                 "display_name": "X", "role": "superuser"})
    assert r.status_code == 422


def test_duplicate_username_returns_409(env):
    _login(env, "admin")
    env.post("/api/accounts", json={"username": "dup", "password": "x",
             "display_name": "Dup", "role": "family"})
    r = env.post("/api/accounts", json={"username": "dup", "password": "x",
                 "display_name": "Dup2", "role": "family"})
    assert r.status_code == 409
