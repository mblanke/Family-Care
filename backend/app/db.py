from collections.abc import Iterator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.config import get_settings

class Base(DeclarativeBase):
    pass

_engine = None
_SessionLocal = None

def _init_db():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(get_settings().database_url, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def _get_session_local():
    _init_db()
    return _SessionLocal

# Lazy-load SessionLocal for backwards compatibility
class _SessionLocalProxy:
    def __call__(self):
        _init_db()
        return _SessionLocal()

SessionLocal = _SessionLocalProxy()

def get_db() -> Iterator[Session]:
    _init_db()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
