import pytest
from datetime import datetime, date
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import app.db as appdb
from app.db import Base
from app.services import auth, people, grocery
import app.models  # noqa: F401
import mcpserver.context as ctx
from mcpserver import tools_read


@pytest.fixture()
def wired(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    TS = sessionmaker(bind=engine)
    monkeypatch.setattr(appdb, "SessionLocal", TS)
    monkeypatch.setattr(ctx, "SessionLocal", TS)
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    db.close()
    return TS


def test_list_grocery_filters(wired):
    from app.models.user import User
    db = wired()
    u = db.scalar(select(User))
    grocery.add(db, name="Eggs", store="costco", created_by=u.id)
    db.commit()
    db.close()
    res = tools_read.familyhub_list_grocery(store="costco")
    assert any(i["name"] == "Eggs" for i in res["items"])
    assert "Eggs" in res["summary"]


def test_get_medications_person_not_found_is_actionable(wired):
    with pytest.raises(Exception) as e:
        tools_read.familyhub_get_medications(person="Grandpa")
    assert "Dad" in str(e.value)
