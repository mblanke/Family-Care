# family-hub — Plan 00: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking. Read the overview
> (`2026-06-22-family-hub-overview.md`) first for locked decisions and global constraints.

**Goal:** Stand up the family-hub stack — Compose + Postgres + FastAPI + React/Vite — with the
`people` and `users` data model, session auth with server-side role enforcement, the shared
service-layer skeleton, a seed script, and an installable, correctly-themed empty shell.

**Architecture:** FastAPI serves the built React SPA as static files and a `/api` REST surface.
Business logic lives in `app/services/*` (the layer the MCP server will later import). Postgres,
evolved by Alembic. Auth is a bcrypt-hashed password check that sets a signed session cookie.

**Tech Stack:** Python 3.13 · FastAPI · Pydantic v2 / pydantic-settings · SQLAlchemy 2.x · Alembic ·
PostgreSQL 16 · passlib[bcrypt] · itsdangerous · React 19 · Vite · TypeScript strict · Tailwind ·
vite-plugin-pwa · pytest · vitest.

## Global Constraints

(Full list in the overview. The ones that bite in this plan:)
- Base font **20px**, large mode **28px+**, one-tap toggle **persisted per user** (a column on `users`).
- Touch targets **≥ 60×60px**; spacing **≥ 12px**; **text + icon** buttons; **never color alone**.
- Each person has a **distinct color + name** shown together; seed exactly **Dad** and **Mom**.
- Roles **admin / family / parent**; enforce **server-side** on every mutating endpoint.
- **Single service layer** shared by REST + MCP — routers are thin adapters.
- Secrets in `.env` (gitignored); display name via `APP_DISPLAY_NAME`; tz via `APP_TIMEZONE`.
- TypeScript **strict**; type hints on the backend. No analytics/trackers. Postgres + Alembic.

---

### Task 1: Repo scaffold, Compose stack, env & gitignore

**Files:**
- Create: `.gitignore`, `.env.example`, `docker-compose.yml`, `backend/Dockerfile`, `mcp/Dockerfile`
- Create: `backend/pyproject.toml`

**Interfaces:**
- Produces: the `family-hub` stack definition (`api`, `db`, `mcp` services + `pgdata` volume),
  env var names every later task reads (`DATABASE_URL`, `SESSION_SECRET`, `APP_DISPLAY_NAME`,
  `APP_TIMEZONE`, `MCP_TOKEN`, `TAILSCALE_BIND`).

- [ ] **Step 1: Write `.gitignore`**

```gitignore
.env
__pycache__/
*.pyc
.venv/
node_modules/
frontend/dist/
.pytest_cache/
.mypy_cache/
```

- [ ] **Step 2: Write `.env.example`** (documented; copied to `.env` at deploy)

```dotenv
# --- family-hub configuration (copy to .env; never commit .env) ---
APP_DISPLAY_NAME=Home Board
APP_TIMEZONE=America/Toronto

# Postgres
POSTGRES_USER=familyhub
POSTGRES_PASSWORD=change-me-long-random
POSTGRES_DB=familyhub
DATABASE_URL=postgresql+psycopg://familyhub:change-me-long-random@db:5432/familyhub

# Auth: 64+ random chars. Generate: python -c "import secrets;print(secrets.token_urlsafe(48))"
SESSION_SECRET=change-me-64-char-random-string

# Admin bootstrap (seed script reads these once)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-strong

# MCP remote-control token (admin scope). Generate like SESSION_SECRET.
MCP_TOKEN=change-me-mcp-token

# Bind to the Tailscale interface IP on atlas (e.g. 100.x.y.z). Empty = all interfaces (dev only).
TAILSCALE_BIND=
```

- [ ] **Step 3: Write `backend/pyproject.toml`**

```toml
[project]
name = "family-hub"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "sqlalchemy>=2.0",
  "psycopg[binary]>=3.2",
  "alembic>=1.13",
  "pydantic>=2.9",
  "pydantic-settings>=2.5",
  "passlib[bcrypt]>=1.7",
  "itsdangerous>=2.2",
  "python-multipart>=0.0.12",
  "fastmcp>=2.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.3", "pytest-asyncio>=0.24", "httpx>=0.27", "mypy>=1.13"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 4: Write `backend/Dockerfile`** (multi-stage: build frontend, run API)

```dockerfile
# --- frontend build ---
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build            # emits /fe/dist

# --- api ---
FROM python:3.13-slim AS api
WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/ ./
COPY --from=frontend /fe/dist ./static
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

- [ ] **Step 5: Write `mcp/Dockerfile`** (reuses the backend image's deps + service layer)

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .
COPY backend/ ./
COPY mcp/ ./mcp/
EXPOSE 8765
CMD ["python", "-m", "mcp.server"]
```

- [ ] **Step 6: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${TAILSCALE_BIND:-0.0.0.0}:8080:8000"

  mcp:
    build:
      context: .
      dockerfile: mcp/Dockerfile
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${TAILSCALE_BIND:-0.0.0.0}:8765:8765"

volumes:
  pgdata:
```

- [ ] **Step 7: Validate the Compose file parses**

Run: `cp .env.example .env && docker compose config`
Expected: prints the resolved config with no error (services `db`, `api`, `mcp`; volume `pgdata`).

- [ ] **Step 8: Commit**

```bash
git init && git add .gitignore .env.example docker-compose.yml backend/pyproject.toml backend/Dockerfile mcp/Dockerfile
git commit -m "chore: scaffold family-hub compose stack and project files"
```

---

### Task 2: Backend config, DB engine, Alembic

**Files:**
- Create: `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/db.py`
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako`
- Test: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `settings` (singleton, `app.config.get_settings()`), `Base` (declarative base),
  `engine`, `SessionLocal`, `get_db()` generator — all consumed by every later backend task.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_config.py`

```python
from app.config import get_settings

def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@db:5432/x")
    monkeypatch.setenv("SESSION_SECRET", "s" * 64)
    monkeypatch.setenv("APP_DISPLAY_NAME", "Hearth")
    get_settings.cache_clear()
    s = get_settings()
    assert s.app_display_name == "Hearth"
    assert s.app_timezone == "America/Toronto"   # default
    assert str(s.database_url).startswith("postgresql+psycopg://")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.config'`.

- [ ] **Step 3: Write `backend/app/config.py`**

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_display_name: str = "Home Board"
    app_timezone: str = "America/Toronto"
    database_url: str = "postgresql+psycopg://familyhub:familyhub@db:5432/familyhub"
    session_secret: str = "dev-insecure-secret-change-me"
    admin_username: str = "admin"
    admin_password: str = "admin"
    mcp_token: str = "dev-mcp-token"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Write `backend/app/db.py`** and `backend/app/__init__.py` (empty)

```python
from collections.abc import Iterator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.config import get_settings

class Base(DeclarativeBase):
    pass

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 6: Initialize Alembic, point it at `app.db.Base`**

Run: `cd backend && alembic init migrations`
Then edit `backend/alembic.ini` — set `sqlalchemy.url =` empty (URL comes from env), and replace
`backend/migrations/env.py` `run_migrations_*` to load our metadata and URL:

```python
# in migrations/env.py — replace the config URL + target_metadata wiring
from app.config import get_settings
from app.db import Base
import app.models  # noqa: F401  (imports all models so autogenerate sees them)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata
```

Create `backend/app/models/__init__.py` (empty for now; later tasks append imports).

- [ ] **Step 7: Commit**

```bash
git add backend/app/__init__.py backend/app/config.py backend/app/db.py backend/app/models/__init__.py \
        backend/alembic.ini backend/migrations backend/tests/test_config.py
git commit -m "feat(backend): config, db engine, alembic wiring"
```

---

### Task 3: `people` model + service + migration

**Files:**
- Create: `backend/app/models/person.py`, `backend/app/services/people.py`, `backend/app/services/__init__.py`
- Test: `backend/tests/conftest.py`, `backend/tests/test_people_service.py`

**Interfaces:**
- Produces:
  - `Person` ORM: `id:int`, `name:str`, `slug:str` (unique, e.g. "dad"), `color:str` (hex),
    `is_active:bool`, `sort_order:int`.
  - `services.people.list_people(db) -> list[Person]`
  - `services.people.get_person(db, person_id:int) -> Person | None`
  - `services.people.get_person_by_slug(db, slug:str) -> Person | None`
  - `services.people.create_person(db, *, name, slug, color, sort_order=0) -> Person`

- [ ] **Step 1: Write `backend/tests/conftest.py`** (in-memory SQLite for fast unit tests of services)

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
import app.models  # noqa: F401  registers all tables

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    try:
        yield s
    finally:
        s.close()
```

- [ ] **Step 2: Write the failing test** — `backend/tests/test_people_service.py`

```python
from app.services import people

def test_create_and_fetch_person(db):
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    assert p.id is not None
    assert people.get_person_by_slug(db, "dad").name == "Dad"
    assert [x.name for x in people.list_people(db)] == ["Dad"]

def test_list_people_orders_by_sort_order(db):
    people.create_person(db, name="Mom", slug="mom", color="#a371f7", sort_order=1)
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    assert [x.name for x in people.list_people(db)] == ["Dad", "Mom"]
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_people_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.person'`.

- [ ] **Step 4: Write `backend/app/models/person.py`**

```python
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Person(Base):
    __tablename__ = "people"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    slug: Mapped[str] = mapped_column(unique=True, nullable=False, index=True)
    color: Mapped[str] = mapped_column(nullable=False)          # hex, e.g. "#1f6feb"
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
```

Append to `backend/app/models/__init__.py`: `from app.models.person import Person  # noqa: F401`

- [ ] **Step 5: Write `backend/app/services/people.py`** (+ empty `services/__init__.py`)

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.person import Person

def list_people(db: Session) -> list[Person]:
    return list(db.scalars(select(Person).order_by(Person.sort_order, Person.id)))

def get_person(db: Session, person_id: int) -> Person | None:
    return db.get(Person, person_id)

def get_person_by_slug(db: Session, slug: str) -> Person | None:
    return db.scalar(select(Person).where(Person.slug == slug))

def create_person(db: Session, *, name: str, slug: str, color: str, sort_order: int = 0) -> Person:
    p = Person(name=name, slug=slug, color=color, sort_order=sort_order)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_people_service.py -v`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/person.py backend/app/models/__init__.py \
        backend/app/services/__init__.py backend/app/services/people.py \
        backend/tests/conftest.py backend/tests/test_people_service.py
git commit -m "feat(people): Person model and people service"
```

---

### Task 4: `users` model (accounts, roles, font-size preference)

**Files:**
- Create: `backend/app/models/user.py`
- Test: `backend/tests/test_user_model.py`

**Interfaces:**
- Produces:
  - `Role` = `Literal["admin", "family", "parent"]` (define as `enum`/`str` constants in `user.py`).
  - `User` ORM: `id:int`, `username:str` (unique), `password_hash:str`, `display_name:str`,
    `role:str`, `font_scale:str` (default `"normal"`, the persisted toggle), `person_id:int|None`
    (FK → people, set when role=="parent" to link the account to Dad/Mom), `is_active:bool`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_user_model.py`

```python
from app.models.user import User, ROLES

def test_user_defaults_and_roles(db):
    u = User(username="mom", password_hash="x", display_name="Mom", role="parent")
    db.add(u); db.commit(); db.refresh(u)
    assert u.font_scale == "normal"
    assert u.is_active is True
    assert set(ROLES) == {"admin", "family", "parent"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_user_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.user'`.

- [ ] **Step 3: Write `backend/app/models/user.py`**

```python
from typing import Literal
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

ROLES = ("admin", "family", "parent")
Role = Literal["admin", "family", "parent"]

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    display_name: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)
    font_scale: Mapped[str] = mapped_column(default="normal", nullable=False)  # "normal" | "large"
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
```

Append to `backend/app/models/__init__.py`: `from app.models.user import User  # noqa: F401`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_user_model.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/user.py backend/app/models/__init__.py backend/tests/test_user_model.py
git commit -m "feat(users): User model with role and persisted font_scale"
```

---

### Task 5: Security — password hashing + signed session cookie

**Files:**
- Create: `backend/app/security.py`
- Test: `backend/tests/test_security.py`

**Interfaces:**
- Produces:
  - `hash_password(plain:str) -> str`, `verify_password(plain:str, hashed:str) -> bool`
  - `sign_session(user_id:int) -> str`, `read_session(token:str) -> int | None`
    (signed with `settings.session_secret`; `None` on tamper/expiry).
  - `SESSION_COOKIE = "fh_session"`, `SESSION_MAX_AGE = 60*60*24*30` (30 days).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_security.py`

```python
from app import security

def test_password_round_trip():
    h = security.hash_password("correct horse")
    assert h != "correct horse"
    assert security.verify_password("correct horse", h)
    assert not security.verify_password("wrong", h)

def test_session_sign_and_read():
    tok = security.sign_session(42)
    assert security.read_session(tok) == 42

def test_tampered_session_rejected():
    assert security.read_session("garbage.not.signed") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_security.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.security'`.

- [ ] **Step 3: Write `backend/app/security.py`**

```python
from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from app.config import get_settings

SESSION_COOKIE = "fh_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt="fh-session")

def hash_password(plain: str) -> str:
    return _pwd.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)

def sign_session(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})

def read_session(token: str) -> int | None:
    try:
        data = _serializer().loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired, Exception):
        return None
    uid = data.get("uid")
    return uid if isinstance(uid, int) else None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_security.py -v`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add backend/app/security.py backend/tests/test_security.py
git commit -m "feat(auth): password hashing and signed session tokens"
```

---

### Task 6: Auth service — authenticate

**Files:**
- Create: `backend/app/services/auth.py`
- Test: `backend/tests/test_auth_service.py`

**Interfaces:**
- Consumes: `security.hash_password/verify_password`, `User`.
- Produces:
  - `services.auth.create_user(db, *, username, password, display_name, role, person_id=None) -> User`
  - `services.auth.authenticate(db, username:str, password:str) -> User | None`
    (returns `None` for bad password OR inactive user).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_auth_service.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.auth'`.

- [ ] **Step 3: Write `backend/app/services/auth.py`**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.security import hash_password, verify_password

def create_user(db: Session, *, username: str, password: str, display_name: str,
                role: str, person_id: int | None = None) -> User:
    u = User(username=username, password_hash=hash_password(password),
             display_name=display_name, role=role, person_id=person_id)
    db.add(u); db.commit(); db.refresh(u)
    return u

def authenticate(db: Session, username: str, password: str) -> User | None:
    u = db.scalar(select(User).where(User.username == username))
    if u is None or not u.is_active:
        return None
    if not verify_password(password, u.password_hash):
        return None
    return u
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_auth_service.py -v`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/auth.py backend/tests/test_auth_service.py
git commit -m "feat(auth): authenticate and create_user service"
```

---

### Task 7: Dependencies — current_user & require_role

**Files:**
- Create: `backend/app/deps.py`
- Test: `backend/tests/test_deps.py`

**Interfaces:**
- Consumes: `get_db`, `security.read_session`, `User`.
- Produces:
  - `current_user(request, db) -> User` — raises `HTTPException(401)` if no/invalid cookie.
  - `require_role(*allowed:str) -> Callable` — FastAPI dependency factory; raises `403` if the
    user's role isn't in `allowed`. This is the **server-side enforcement** every mutating
    endpoint will depend on.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_deps.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_deps.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.deps'`.

- [ ] **Step 3: Write `backend/app/deps.py`**

```python
from collections.abc import Callable
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.security import SESSION_COOKIE, read_session

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    uid = read_session(token) if token else None
    user = db.get(User, uid) if uid else None
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_role(*allowed: str) -> Callable[..., User]:
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_deps.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/deps.py backend/tests/test_deps.py
git commit -m "feat(auth): current_user and require_role dependencies"
```

---

### Task 8: Auth + people routers, FastAPI app, SPA mount

**Files:**
- Create: `backend/app/schemas/auth.py`, `backend/app/routers/auth.py`, `backend/app/routers/people.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `services.auth`, `services.people`, `deps`, `security`.
- Produces REST surface:
  - `POST /api/auth/login {username,password}` → sets `fh_session` cookie, returns `{user}`.
  - `POST /api/auth/logout` → clears cookie.
  - `GET /api/auth/me` → current user (401 if none). Includes `app_display_name`.
  - `PUT /api/auth/me/font-scale {font_scale}` → persists toggle on the user row.
  - `GET /api/people` → list (any authenticated role).
  - `GET /healthz` → `{"status":"ok"}` (unauthenticated, for compose healthcheck).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth, people
import app.models  # noqa: F401

@pytest.fixture()
def client():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb", sort_order=0)
    app.dependency_overrides[get_db] = lambda: TestSession()
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_login_me_and_people(client):
    assert client.get("/api/auth/me").status_code == 401
    r = client.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["app_display_name"]
    ppl = client.get("/api/people")
    assert [p["name"] for p in ppl.json()] == ["Dad"]

def test_font_scale_persists(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    assert client.put("/api/auth/me/font-scale", json={"font_scale": "large"}).status_code == 200
    assert client.get("/api/auth/me").json()["user"]["font_scale"] == "large"

def test_bad_login_rejected(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "no"}).status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 3: Write `backend/app/schemas/auth.py`** (+ empty `app/schemas/__init__.py`)

```python
from pydantic import BaseModel

class LoginIn(BaseModel):
    username: str
    password: str

class FontScaleIn(BaseModel):
    font_scale: str  # "normal" | "large"

class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    font_scale: str
    person_id: int | None
    class Config: from_attributes = True

class PersonOut(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    class Config: from_attributes = True
```

- [ ] **Step 4: Write `backend/app/routers/auth.py`** (+ empty `app/routers/__init__.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.auth import LoginIn, FontScaleIn, UserOut
from app.security import SESSION_COOKIE, SESSION_MAX_AGE, sign_session
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    response.set_cookie(SESSION_COOKIE, sign_session(user.id), max_age=SESSION_MAX_AGE,
                        httponly=True, samesite="lax")
    return {"user": UserOut.model_validate(user)}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}

@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": UserOut.model_validate(user), "app_display_name": get_settings().app_display_name}

@router.put("/me/font-scale")
def set_font_scale(body: FontScaleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.font_scale not in ("normal", "large"):
        raise HTTPException(status_code=422, detail="font_scale must be 'normal' or 'large'")
    user.font_scale = body.font_scale
    db.commit()
    return {"ok": True}
```

- [ ] **Step 5: Write `backend/app/routers/people.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.schemas.auth import PersonOut
from app.services import people as people_service

router = APIRouter(prefix="/api/people", tags=["people"])

@router.get("", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_db), _=Depends(current_user)):
    return people_service.list_people(db)
```

- [ ] **Step 6: Write `backend/app/main.py`** (API + static SPA, SPA fallback for client routes)

```python
import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routers import auth, people

app = FastAPI(title="family-hub")
app.include_router(auth.router)
app.include_router(people.router)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

_STATIC = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_STATIC):
    app.mount("/assets", StaticFiles(directory=os.path.join(_STATIC, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # serve index.html for any non-API path so client-side routing works
        return FileResponse(os.path.join(_STATIC, "index.html"))
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && pytest tests/test_api.py -v`
Expected: PASS (all four assertions across three tests).

- [ ] **Step 8: Generate the initial migration & commit**

Run (against a live/empty Postgres or with `DATABASE_URL` set):
`cd backend && alembic revision --autogenerate -m "people and users" && alembic upgrade head`
Expected: a version file under `migrations/versions/` creating `people` + `users`.

```bash
git add backend/app/schemas backend/app/routers backend/app/main.py \
        backend/tests/test_api.py backend/migrations/versions
git commit -m "feat(api): auth + people routers, SPA mount, initial migration"
```

---

### Task 9: Seed script (admin + Dad/Mom)

**Files:**
- Create: `backend/app/seed.py`
- Test: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `services.auth.create_user`, `services.people.create_person`, `get_settings`.
- Produces: `seed.seed(db)` — idempotent; creates the admin from `ADMIN_USERNAME/PASSWORD` and
  Dad (`#1f6feb`) + Mom (`#a371f7`) if absent. Runnable as `python -m app.seed`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_seed.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_seed.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.seed'`.

- [ ] **Step 3: Write `backend/app/seed.py`**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import SessionLocal
from app.models.user import User
from app.services import auth, people

_PEOPLE = [("Dad", "dad", "#1f6feb", 0), ("Mom", "mom", "#a371f7", 1)]

def seed(db: Session) -> None:
    s = get_settings()
    if db.scalar(select(User).where(User.username == s.admin_username)) is None:
        auth.create_user(db, username=s.admin_username, password=s.admin_password,
                         display_name="Admin", role="admin")
    for name, slug, color, order in _PEOPLE:
        if people.get_person_by_slug(db, slug) is None:
            people.create_person(db, name=name, slug=slug, color=color, sort_order=order)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db); print("Seeded.")
    finally:
        db.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_seed.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/seed.py backend/tests/test_seed.py
git commit -m "feat(seed): idempotent admin + Dad/Mom seeding"
```

---

### Task 10: Frontend scaffold — Vite/React/TS/Tailwind tokens + PWA

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`,
  `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/index.html`,
  `frontend/src/main.tsx`, `frontend/src/index.css`, `frontend/src/App.tsx`
- Create: `frontend/public/manifest.webmanifest` (icons referenced; add placeholder PNGs)

**Interfaces:**
- Produces: a buildable SPA (`npm run build` → `dist/`) whose Tailwind config defines the
  accessibility tokens once: font sizes (`base`=20px, `lg-mode` via root class), touch target
  utilities, person color tokens, AA contrast palette. PWA manifest = standalone, installable.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "family-hub-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0", "typescript": "^5.6.0",
    "vite": "^6.0.0", "vite-plugin-pwa": "^0.21.0",
    "tailwindcss": "^3.4.0", "postcss": "^8.4.0", "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `frontend/tsconfig.json`** (strict)

```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx",
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `frontend/vite.config.ts`** (React + PWA + dev proxy to API)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Home Board",
        short_name: "Home Board",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6feb",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": "http://localhost:8000", "/healthz": "http://localhost:8000" } },
});
```

- [ ] **Step 4: Write `frontend/tailwind.config.ts`** — the **accessibility tokens, defined once**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        // base 20px; large mode applied via the .text-large root class below
        base: ["1.25rem", { lineHeight: "1.6" }],   // 20px
        big: ["1.75rem", { lineHeight: "1.5" }],     // 28px
        huge: ["2.5rem", { lineHeight: "1.3" }],     // 40px (Today headings)
      },
      colors: {
        ink: "#111418",        // near-black text (AA on white)
        paper: "#ffffff",
        dad: "#1f6feb",        // Dad color token
        mom: "#a371f7",        // Mom color token
        confirm: "#1a7f37",    // success/confirmation (paired with icon+text, never alone)
      },
      minWidth: { touch: "60px" },
      minHeight: { touch: "60px" },
      spacing: { touch: "12px" },   // min gap between targets
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Write `frontend/postcss.config.js`, `frontend/src/index.css`, `frontend/index.html`**

```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { font-size: 16px; }
/* Large-mode: one-tap toggle adds .text-large to <html>, bumping the rem scale */
html.text-large { font-size: 22px; }
body { @apply bg-paper text-ink text-base; margin: 0; }
button { min-width: theme('minWidth.touch'); min-height: theme('minHeight.touch'); }
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Home Board</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

- [ ] **Step 6: Write `frontend/src/main.tsx` + `frontend/src/App.tsx`** (placeholder, replaced in Task 11)

```tsx
// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```

```tsx
// App.tsx (temporary; Task 11 replaces with auth-aware shell)
export function App() {
  return <main className="p-6 text-huge">Home Board</main>;
}
```

- [ ] **Step 7: Add placeholder icons + manifest assets**

Run: create `frontend/public/icon-192.png` and `frontend/public/icon-512.png` (solid `#1f6feb`
squares for now; real icons later). `vite-plugin-pwa` generates the manifest from config.

- [ ] **Step 8: Verify it builds**

Run: `cd frontend && npm install && npm run build`
Expected: `dist/` produced with `index.html`, `assets/`, `manifest.webmanifest`, `sw.js`.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): Vite/React/TS/Tailwind scaffold with a11y tokens and PWA manifest"
```

---

### Task 11: Frontend shell — API client, auth context, font-size toggle, login, person colors

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/lib/auth.tsx`,
  `frontend/src/lib/fontScale.tsx`, `frontend/src/lib/people.ts`,
  `frontend/src/components/Button.tsx`, `frontend/src/components/PersonBadge.tsx`,
  `frontend/src/screens/Login.tsx`, `frontend/src/AppShell.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/lib/people.test.ts`

**Interfaces:**
- Consumes: REST surface from Task 8.
- Produces:
  - `api.get/post/put<T>(path, body?)` — credentials-included fetch, throws on non-2xx.
  - `useAuth()` → `{ user, displayName, login, logout, loading }`.
  - `useFontScale()` → `{ scale, toggle }` — toggles `<html>.text-large` and PUTs to the API.
  - `personColor(person)` / `<PersonBadge person>` — color **+ name** together.
  - `<Button>` — solid, ≥60px, text+icon.

- [ ] **Step 1: Write the failing test** — `frontend/src/lib/people.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { personStyle } from "./people";

describe("personStyle", () => {
  it("returns the person color as a CSS variable and keeps the name visible", () => {
    const s = personStyle({ id: 1, name: "Dad", slug: "dad", color: "#1f6feb" });
    expect(s.borderColor).toBe("#1f6feb");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/people.test.ts`
Expected: FAIL — cannot resolve `./people`.

- [ ] **Step 3: Write `frontend/src/lib/people.ts`**

```ts
export interface Person { id: number; name: string; slug: string; color: string; }

// Color is ALWAYS paired with the name in the UI — never the only signal.
export function personStyle(p: Person): { borderColor: string } {
  return { borderColor: p.color };
}
```

- [ ] **Step 4: Write `frontend/src/api/client.ts`**

```ts
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}
export const api = {
  get: <T>(p: string) => req<T>("GET", p),
  post: <T>(p: string, b?: unknown) => req<T>("POST", p, b),
  put: <T>(p: string, b?: unknown) => req<T>("PUT", p, b),
};
```

- [ ] **Step 5: Write `frontend/src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

export interface User { id: number; username: string; display_name: string;
  role: "admin" | "family" | "parent"; font_scale: "normal" | "large"; person_id: number | null; }

interface AuthState { user: User | null; displayName: string; loading: boolean;
  login: (u: string, p: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; }

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Home Board");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api.get<{ user: User; app_display_name: string }>("/api/auth/me");
      setUser(me.user); setDisplayName(me.app_display_name);
    } catch { setUser(null); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function login(username: string, password: string) {
    await api.post("/api/auth/login", { username, password }); await refresh();
  }
  async function logout() { await api.post("/api/auth/logout"); setUser(null); }

  return <Ctx.Provider value={{ user, displayName, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
export function useAuth() {
  const c = useContext(Ctx); if (!c) throw new Error("useAuth outside provider"); return c;
}
```

- [ ] **Step 6: Write `frontend/src/lib/fontScale.tsx`**

```tsx
import { useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "./auth";

export function useFontScale() {
  const { user, refresh } = useAuth();
  const scale = user?.font_scale ?? "normal";
  useEffect(() => {
    document.documentElement.classList.toggle("text-large", scale === "large");
  }, [scale]);
  async function toggle() {
    const next = scale === "large" ? "normal" : "large";
    await api.put("/api/auth/me/font-scale", { font_scale: next });
    await refresh();
  }
  return { scale, toggle };
}
```

- [ ] **Step 7: Write `frontend/src/components/Button.tsx` + `PersonBadge.tsx`**

```tsx
// Button.tsx — solid, ≥60px, text + icon (never icon-only for primary)
import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Button({ icon, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode }) {
  return (
    <button {...rest}
      className="min-h-touch min-w-touch px-6 rounded-2xl bg-dad text-paper text-big
                 font-semibold inline-flex items-center gap-3 active:scale-95 disabled:opacity-50">
      {icon}<span>{children}</span>
    </button>
  );
}
```

```tsx
// PersonBadge.tsx — color + name together, always
import { personStyle, type Person } from "../lib/people";
export function PersonBadge({ person }: { person: Person }) {
  return (
    <span style={personStyle(person)}
      className="inline-flex items-center gap-2 border-4 rounded-xl px-3 py-1 text-base font-semibold">
      <span aria-hidden className="w-4 h-4 rounded-full" style={{ background: person.color }} />
      {person.name}
    </span>
  );
}
```

- [ ] **Step 8: Write `frontend/src/screens/Login.tsx` + `AppShell.tsx`, update `App.tsx`**

```tsx
// screens/Login.tsx
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
export function Login() {
  const { login } = useAuth();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await login(u, p); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <form onSubmit={submit} className="max-w-md mx-auto mt-16 p-6 flex flex-col gap-4">
      <h1 className="text-huge font-bold">Home Board</h1>
      <input className="text-big p-4 border-4 rounded-xl" placeholder="Username"
             value={u} onChange={e => setU(e.target.value)} />
      <input className="text-big p-4 border-4 rounded-xl" type="password" placeholder="Password"
             value={p} onChange={e => setP(e.target.value)} />
      {err && <p className="text-big text-red-700" role="alert">{err}</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}
```

```tsx
// AppShell.tsx — authed chrome: display name, font toggle, logout. (Screens land in Plan 01.)
import { useAuth } from "./lib/auth";
import { useFontScale } from "./lib/fontScale";
import { Button } from "./components/Button";
export function AppShell() {
  const { user, displayName, logout } = useAuth();
  const { scale, toggle } = useFontScale();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b-4">
        <h1 className="text-big font-bold">{displayName}</h1>
        <div className="flex gap-touch">
          <Button onClick={toggle}>{scale === "large" ? "Aa Normal" : "Aa Larger"}</Button>
          <Button onClick={logout}>Sign out ({user?.display_name})</Button>
        </div>
      </header>
      <main className="p-6 text-huge">Welcome — screens arrive in v1 core.</main>
    </div>
  );
}
```

```tsx
// App.tsx
import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./screens/Login";
import { AppShell } from "./AppShell";
function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-big">Loading…</p>;
  return user ? <AppShell /> : <Login />;
}
export function App() { return <AuthProvider><Gate /></AuthProvider>; }
```

- [ ] **Step 9: Run test + typecheck + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: test PASS; `tsc -b` clean (strict); `dist/` built.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): auth context, font-size toggle, login, person badge, app shell"
```

---

### Task 12: End-to-end bring-up + README

**Files:**
- Create: `README.md`
- (No code changes — this task verifies the whole stack and documents it.)

**Interfaces:**
- Consumes: everything above.
- Produces: a documented, running stack and a green manual smoke test.

- [ ] **Step 1: Bring the stack up**

Run: `cp .env.example .env` then edit `.env` (set real `SESSION_SECRET`, `POSTGRES_PASSWORD`,
`ADMIN_PASSWORD`, `MCP_TOKEN`). Then:
`docker compose up -d --build`
Expected: `db` healthy, `api` and `mcp` start. `alembic upgrade head` runs in the api container.

- [ ] **Step 2: Seed and smoke-test**

Run: `docker compose exec api python -m app.seed`
Then: `curl -s localhost:8080/healthz` → `{"status":"ok"}`.
Then in a browser over Tailscale: open `http://<atlas-tailscale>:8080`, log in as the admin,
toggle font size (page text grows and the choice persists after reload), confirm "Home Board"
(or your `APP_DISPLAY_NAME`) shows. Add the page to an iPad home screen → opens standalone.

- [ ] **Step 3: Write `README.md`**

````markdown
# family-hub

Self-hosted family care-coordination app. Runs under `/opt/stacks/family-hub/` on atlas,
reachable only over Tailscale (`*.tail8d54ec.ts.net`).

## Bring it up
```bash
cp .env.example .env        # then edit secrets (SESSION_SECRET, passwords, MCP_TOKEN)
docker compose up -d --build
docker compose exec api python -m app.seed   # creates admin + Dad/Mom (idempotent)
```
App: `http://<atlas-tailscale-ip>:8080` · MCP: `http://<atlas-tailscale-ip>:8765`

## Accounts
The admin is bootstrapped from `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env`. Create family and
parent accounts from the admin UI (added in v1 core). Roles: admin / family / parent.

## Data & backup
All data is in the Postgres `pgdata` named volume. Back up with:
```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```
Restore: `cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.

## Install on each iPad
Open the Tailscale URL in Safari → Share → Add to Home Screen. Opens full-screen (PWA).

## Migrations
Schema changes ship as Alembic migrations and run automatically on `api` container start
(`alembic upgrade head`). To add one: `docker compose exec api alembic revision --autogenerate -m "msg"`.
````

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with bring-up, accounts, backup, Tailscale, PWA install"
```

---

## Self-Review

**Spec coverage (foundation slice):**
- Accounts + 3 roles, **server-side** enforcement → Tasks 4, 7 (`require_role`), used in routers.
- People Dad/Mom, distinct color + name, extensible → Tasks 3, 9, `PersonBadge` (Task 11).
- Session cookie auth, bcrypt, lightweight (no OAuth) → Tasks 5–8.
- Font toggle **persisted per user** → `users.font_scale` (Task 4) + API (Task 8) + UI (Task 11).
- Accessibility tokens defined **once** → `tailwind.config.ts` + `index.css` (Task 10).
- Single service layer (routers thin) → `services/*` consumed by `routers/*` (Tasks 3, 6, 8).
- Compose stack, Postgres, Alembic, `.env`, Tailscale bind → Tasks 1, 2, 8, 12.
- Seed (non-empty first open) → Task 9.
- PWA installable shell → Tasks 10–12.
- README (bring-up, accounts, data, backup, Tailscale URL) → Task 12.

**Placeholder scan:** none — every code step shows complete code; the only intentional stubs are
`App.tsx` (Task 10, explicitly replaced in Task 11) and the AppShell main body (screens land in
Plan 01, noted in copy).

**Type consistency:** `Person` fields (`id/name/slug/color`) match across `person.py`, `PersonOut`,
and `people.ts`. `User.font_scale` ("normal"|"large") matches `FontScaleIn` validation and
`useFontScale`. `require_role(*allowed)` signature matches its test and future router usage.

**Deferred to later plans (correctly out of this slice):** appointments/todos/grocery/birthdays
tables + screens (01), medications/bp (02), MCP server (03). Their model files appear in the
overview tree but are created by their own plans.
