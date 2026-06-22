from app.services import auth


def test_authenticate_success_and_failure(db):
    auth.create_user(db, username="admin", password="s3cret", display_name="Admin", role="admin")
    assert auth.authenticate(db, "admin", "s3cret").role == "admin"
    assert auth.authenticate(db, "admin", "wrong") is None
    assert auth.authenticate(db, "ghost", "s3cret") is None


def test_inactive_user_cannot_authenticate(db):
    u = auth.create_user(db, username="old", password="pw", display_name="Old", role="family")
    u.is_active = False; db.commit()
    assert auth.authenticate(db, "old", "pw") is None
