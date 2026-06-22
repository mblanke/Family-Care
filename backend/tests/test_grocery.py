import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app as _app
from app.services import auth, grocery
import app.models  # noqa: F401


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


def test_store_filter_and_clear_checked(db):
    u = auth.create_user(db, username="dad", password="p", display_name="Dad", role="parent")
    grocery.add(db, name="Eggs", store="costco", created_by=u.id)
    g = grocery.add(db, name="Milk", store="grocery", created_by=u.id)
    grocery.add(db, name="Bananas", store="either", created_by=u.id)
    assert [i.name for i in grocery.list_items(db, store="costco")] == ["Eggs"]
    assert {i.name for i in grocery.list_items(db)} == {"Eggs", "Milk", "Bananas"}
    grocery.set_checked(db, g.id, True)
    assert grocery.clear_checked(db) == 1
    assert {i.name for i in grocery.list_items(db)} == {"Eggs", "Bananas"}


def test_checked_sorts_after_unchecked(db):
    u = auth.create_user(db, username="d", password="p", display_name="D", role="parent")
    a = grocery.add(db, name="A", store="either", created_by=u.id)
    grocery.add(db, name="B", store="either", created_by=u.id)
    grocery.set_checked(db, a.id, True)
    assert [i.name for i in grocery.list_items(db)][-1] == "A"


def test_set_qty_clamps_to_one(db):
    u = auth.create_user(db, username="mom", password="p", display_name="Mom", role="parent")
    g = grocery.add(db, name="Juice", store="either", created_by=u.id)
    result = grocery.set_qty(db, g.id, 0)
    assert result is not None
    assert result.qty == 1


def test_edit_name(db):
    u = auth.create_user(db, username="kid", password="p", display_name="Kid", role="child")
    g = grocery.add(db, name="Old Name", store="either", created_by=u.id)
    result = grocery.edit(db, g.id, name="New Name")
    assert result is not None
    assert result.name == "New Name"


def test_delete_returns_false_for_missing(db):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    assert grocery.delete(s, 9999) is False
    s.close()


def test_set_checked_sets_checked_at(db):
    u = auth.create_user(db, username="p2", password="p", display_name="P2", role="parent")
    g = grocery.add(db, name="Cheese", store="grocery", created_by=u.id)
    result = grocery.set_checked(db, g.id, True)
    assert result is not None
    assert result.checked is True
    assert result.checked_at is not None
    result2 = grocery.set_checked(db, g.id, False)
    assert result2 is not None
    assert result2.checked is False
    assert result2.checked_at is None


# --- API tests ---

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


def test_get_list_empty(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.get("/api/grocery")
    assert r.status_code == 200
    assert r.json() == []


def test_post_add_item(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery", json={"name": "Apples", "store": "grocery", "qty": 3})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Apples"
    assert data["store"] == "grocery"
    assert data["qty"] == 3
    assert data["checked"] is False
    assert "id" in data


def test_get_list_with_items(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    client.post("/api/grocery", json={"name": "Bread", "store": "either", "qty": 1})
    client.post("/api/grocery", json={"name": "Butter", "store": "grocery", "qty": 2})
    r = client.get("/api/grocery")
    assert r.status_code == 200
    names = {item["name"] for item in r.json()}
    assert names == {"Bread", "Butter"}


def test_get_list_with_store_filter(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    client.post("/api/grocery", json={"name": "Bulk Rice", "store": "costco", "qty": 1})
    client.post("/api/grocery", json={"name": "Tomatoes", "store": "grocery", "qty": 4})
    r = client.get("/api/grocery?store=costco")
    assert r.status_code == 200
    names = [item["name"] for item in r.json()]
    assert names == ["Bulk Rice"]


def test_post_check_item(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery", json={"name": "Yogurt", "store": "either", "qty": 1})
    item_id = r.json()["id"]
    r2 = client.post(f"/api/grocery/{item_id}/check", json={"checked": True})
    assert r2.status_code == 200
    assert r2.json()["checked"] is True


def test_post_qty_item(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery", json={"name": "Oranges", "store": "grocery", "qty": 1})
    item_id = r.json()["id"]
    r2 = client.post(f"/api/grocery/{item_id}/qty", json={"qty": 5})
    assert r2.status_code == 200
    assert r2.json()["qty"] == 5


def test_put_edit_item(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery", json={"name": "Bannas", "store": "either", "qty": 1})
    item_id = r.json()["id"]
    r2 = client.put(f"/api/grocery/{item_id}", json={"name": "Bananas"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Bananas"


def test_delete_item(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery", json={"name": "Spinach", "store": "grocery", "qty": 1})
    item_id = r.json()["id"]
    r2 = client.delete(f"/api/grocery/{item_id}")
    assert r2.status_code == 200
    assert r2.json() == {"ok": True}
    r3 = client.get("/api/grocery")
    assert all(item["id"] != item_id for item in r3.json())


def test_delete_not_found(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.delete("/api/grocery/99999")
    assert r.status_code == 404


def test_post_clear_checked(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r1 = client.post("/api/grocery", json={"name": "Item1", "store": "either", "qty": 1})
    r2 = client.post("/api/grocery", json={"name": "Item2", "store": "either", "qty": 1})
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]
    client.post(f"/api/grocery/{id1}/check", json={"checked": True})
    client.post(f"/api/grocery/{id2}/check", json={"checked": True})
    r3 = client.post("/api/grocery/clear-checked")
    assert r3.status_code == 200
    assert r3.json() == {"removed": 2}
    r4 = client.get("/api/grocery")
    assert r4.json() == []


def test_check_not_found(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery/99999/check", json={"checked": True})
    assert r.status_code == 404


def test_qty_not_found(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/grocery/99999/qty", json={"qty": 3})
    assert r.status_code == 404


def test_edit_not_found(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.put("/api/grocery/99999", json={"name": "Ghost"})
    assert r.status_code == 404
