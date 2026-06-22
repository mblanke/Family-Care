import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.config import get_settings

SESSION_COOKIE = "fh_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt="fh-session")

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def sign_session(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})

def read_session(token: str) -> int | None:
    try:
        data = _serializer().loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired, Exception):
        return None
    uid = data.get("uid")
    return uid if isinstance(uid, int) else None
