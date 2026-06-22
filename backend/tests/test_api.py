import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
import app.models  # noqa: F401

from app.main import app as _app
from app.services import auth, people


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    db.close()

    def override():
        s = TestSession()
        try:
            yield s
        finally:
            s.close()

    _app.dependency_overrides[get_db] = override
    yield TestClient(_app)
    _app.dependency_overrides.clear()


def test_login_me_and_people(client):
    assert client.get("/api/auth/me").status_code == 401
    r = client.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["app_display_name"]
    ppl = client.get("/api/people")
    assert [p["name"] for p in ppl.json()] == ["Dad"]


def test_font_scale_persists(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    assert client.put("/api/auth/me/font-scale", json={"font_scale": "large"}).status_code == 200
    assert client.get("/api/auth/me").json()["user"]["font_scale"] == "large"


def test_bad_login_rejected(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "no"}).status_code == 401
