import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth, todos
import app.models  # noqa: F401

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()

def test_done_moves_to_end_with_timestamp(db):
    u = auth.create_user(db, username="mom", password="p", display_name="Mom", role="parent")
    a = todos.add(db, text="Milk", created_by=u.id)
    todos.add(db, text="Bread", created_by=u.id)
    todos.set_done(db, a.id, True)
    ordered = todos.list_todos(db)
    assert [t.text for t in ordered] == ["Bread", "Milk"]   # open first, done last
    assert ordered[-1].done and ordered[-1].done_at is not None

@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TS = sessionmaker(bind=engine)
    db = TS()
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

def test_parent_can_manage_todos(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/todos", json={"text": "Call pharmacy"})
    assert r.status_code == 200
    tid = r.json()["id"]
    assert client.post(f"/api/todos/{tid}/done", json={"done": True}).status_code == 200
