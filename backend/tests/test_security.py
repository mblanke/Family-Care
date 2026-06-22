from app import security

def test_password_round_trip():
    h = security.hash_password("password123")
    assert h != "password123"
    assert security.verify_password("password123", h)
    assert not security.verify_password("wrong", h)

def test_session_sign_and_read():
    tok = security.sign_session(42)
    assert security.read_session(tok) == 42

def test_tampered_session_rejected():
    assert security.read_session("garbage.not.signed") is None
