from app import seed
from app.services import people
from app.models.user import User
from sqlalchemy import select

def test_seed_is_idempotent(db, monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAME", "boss"); monkeypatch.setenv("ADMIN_PASSWORD", "pw")
    from app.config import get_settings; get_settings.cache_clear()
    seed.seed(db); seed.seed(db)   # twice → no duplicates
    assert len(people.list_people(db)) == 2
    assert db.scalar(select(User).where(User.username == "boss")) is not None
    assert {p.slug for p in people.list_people(db)} == {"dad", "mom"}
