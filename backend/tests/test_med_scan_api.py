import io, tempfile, pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth, people, medications, med_scan
from app.services import scan_store
from app.models.medication import Medication, MedicationChange
import app.models  # noqa: F401

class FakeExtractor:
    def extract(self, image_bytes):
        return [med_scan.ExtractedMed(name="Amlodipine", dose="5 mg", slot="morning", prescriber="Dr. Lee")]

@pytest.fixture()
def env(monkeypatch, tmp_path):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    monkeypatch.setattr(med_scan, "get_extractor", lambda: FakeExtractor())
    monkeypatch.setattr(scan_store, "TEMP_DIR", str(tmp_path / "scans"))
    monkeypatch.setattr(scan_store, "KEEP_DIR", str(tmp_path / "med-photos"))
    _app.dependency_overrides[get_db] = lambda: TS()
    c = TestClient(_app); c.pid = p.id; c.TS = TS; yield c
    _app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})
def _img(): return {"file": ("label.jpg", io.BytesIO(b"jpegbytes"), "image/jpeg")}

def test_scan_returns_candidates_and_writes_nothing(env):
    _login(env, "admin")
    r = env.post(f"/api/people/{env.pid}/medications/scan", files=_img())
    assert r.status_code == 200
    body = r.json()
    assert body["candidates"][0]["name"] == "Amlodipine" and body["scan_id"]
    db = env.TS()
    assert db.scalar(select(Medication)) is None          # scan alone persisted nothing
    assert db.scalar(select(MedicationChange)) is None    # no history writes from scan

def test_parent_cannot_scan(env):
    _login(env, "mom")
    assert env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).status_code == 403

def test_confirm_with_keep_photo_sets_photo_path(env):
    _login(env, "admin")
    scan_id = env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).json()["scan_id"]
    r = env.post(f"/api/people/{env.pid}/medications",
                 json={"name": "Amlodipine", "dose": "5 mg", "slot": "morning",
                       "scan_id": scan_id, "keep_photo": True})
    assert r.status_code == 200
    db = env.TS()
    ch = db.scalar(select(MedicationChange).where(MedicationChange.change_type == "added"))
    assert ch.photo_path is not None

def test_confirm_without_keep_photo_has_no_path(env):
    _login(env, "admin")
    scan_id = env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).json()["scan_id"]
    env.post(f"/api/people/{env.pid}/medications",
             json={"name": "Amlodipine", "dose": "5 mg", "slot": "morning",
                   "scan_id": scan_id, "keep_photo": False})
    db = env.TS()
    ch = db.scalar(select(MedicationChange).where(MedicationChange.change_type == "added"))
    assert ch.photo_path is None
