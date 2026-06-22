from app.models.user import User, ROLES


def test_user_defaults_and_roles(db):
    u = User(username="mom", password_hash="x", display_name="Mom", role="parent")
    db.add(u)
    db.commit()
    db.refresh(u)
    assert u.font_scale == "normal"
    assert u.is_active is True
    assert set(ROLES) == {"admin", "family", "parent"}
