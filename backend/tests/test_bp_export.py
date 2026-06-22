import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth, people, bp
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
    u = auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    bp.log_reading(db, person_id=p.id, systolic=130, diastolic=80, recorded_by=u.id)
    pid = p.id
    db.close()

    def override():
        s = TS()
        try:
            yield s
        finally:
            s.close()

    _app.dependency_overrides[get_db] = override
    c = TestClient(_app)
    c.pid = pid
    yield c
    _app.dependency_overrides.clear()


def test_export_renders_html_with_reading(env):
    env.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    r = env.get(f"/api/people/{env.pid}/bp/export?days=90")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert "130/80" in r.text and "Mom" in r.text
