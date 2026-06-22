import pytest
from fastapi import HTTPException
from app import deps
from app.models.user import User

def _user(role): return User(id=1, username="u", password_hash="x", display_name="U", role=role)

def test_require_role_allows_and_blocks():
    checker = deps.require_role("admin")
    assert checker(user=_user("admin")).role == "admin"
    with pytest.raises(HTTPException) as e:
        checker(user=_user("parent"))
    assert e.value.status_code == 403
