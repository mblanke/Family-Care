# family-hub — Plan 01: v1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Implement **after Plan 00**. Steps use checkbox
> (`- [ ]`) syntax. Read the overview for locked decisions + global constraints.

**Goal:** Ship v1 — the Today screen, the shared schedule (ride flags + recurring bank-bills),
to-do, grocery with Costco/Grocery/All sorting, and birthday reminders — with a distinct parent
layout and admin add/edit working down to iPhone width, all PWA-installable.

**Architecture:** New tables (`appointments`, `todos`, `grocery_items`, `birthdays`) each get a
service module (the shared layer) + a thin router. A `today` service composes the home roll-up.
The frontend gains a role-aware router: a stripped-down **parent** layout and a fuller **admin/family**
layout, sharing accessible primitives from Plan 00.

**Tech Stack:** Same as Plan 00. Dates: store UTC `datetime`, render in `APP_TIMEZONE`.

## Global Constraints

(Full list in overview.) Active here:
- **Today-first**: parent's first screen is today, no navigation to reach it.
- **Ride flag** is first-class; ride-needed items surface distinctly + roll up into a driver view.
- **Bank-bills** is a recurring scheduled item (location "Bank"), not a workaround.
- Grocery store tag **costco | grocery | either**; one-tap **Costco | Grocery | All** grouping.
- To-do/grocery: parents create/edit/check/delete; completed items move to a **done area**, never deleted.
- **Never color alone**; touch targets ≥60px; confirmations are big modals, not toasts; undo where practical.
- Roles enforced **server-side**: family may add/edit appointments + birthdays; parents manage todo/grocery only.
- Admin add/edit forms **responsive to iPhone width**; parent screens stay iPad-first.

**Shared interfaces produced in Plan 00 (consumed here):** `Base`, `get_db`, `current_user`,
`require_role(*roles)`, `Person`, `services.people`, `api.get/post/put`, `useAuth()`,
`useFontScale()`, `<Button>`, `<PersonBadge>`, `personStyle`, `Person` (TS).

---

### Task 1: Appointments model + service (CRUD, ride flag, recurrence)

**Files:**
- Create: `backend/app/models/appointment.py`, `backend/app/services/appointments.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_appointments_service.py`

**Interfaces:**
- Produces:
  - `Appointment` ORM: `id:int`, `title:str`, `start:datetime` (UTC, tz-aware stored naive-UTC),
    `end:datetime|None`, `location:str|None`, `person_id:int|None` (None ⇒ "family/both"),
    `for_both:bool`, `needs_ride:bool`, `notes:str|None`, `recurrence:str` (`"none"|"monthly"`),
    `recur_day:int|None` (day-of-month for monthly), `created_by:int` (FK users), `canceled:bool`.
  - `services.appointments.create(db, *, title, start, end=None, location=None, person_id=None,
    for_both=False, needs_ride=False, notes=None, recurrence="none", recur_day=None, created_by) -> Appointment`
  - `update(db, appt_id, **fields) -> Appointment | None`
  - `cancel(db, appt_id) -> bool`
  - `get(db, appt_id) -> Appointment | None`
  - `list_between(db, start:datetime, end:datetime, *, include_canceled=False) -> list[Appointment]`
    — expands `monthly` recurrences into concrete occurrences within the window (each occurrence
    carries the parent `id` + its computed `start`).
  - `expand_occurrences(appt, window_start, window_end) -> list[Occurrence]` where
    `Occurrence` is a dataclass `{appointment_id:int, title, start, end, location, person_id,
    for_both, needs_ride, notes}`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_appointments_service.py`

```python
from datetime import datetime
from app.services import appointments as appt
from app.services import auth

def _admin(db): return auth.create_user(db, username="a", password="p", display_name="A", role="admin")

def test_create_and_list_single(db):
    u = _admin(db)
    a = appt.create(db, title="Cardiology", start=datetime(2026, 7, 2, 14, 0),
                    needs_ride=True, person_id=None, created_by=u.id)
    occ = appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 7, 31))
    assert len(occ) == 1 and occ[0].needs_ride and occ[0].title == "Cardiology"
    assert occ[0].appointment_id == a.id

def test_monthly_recurrence_expands(db):
    u = _admin(db)
    appt.create(db, title="Pay bills at bank", start=datetime(2026, 7, 5, 10, 0),
                location="Bank", recurrence="monthly", recur_day=5, created_by=u.id)
    occ = appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 9, 30))
    assert [o.start.month for o in occ] == [7, 8, 9]
    assert all(o.location == "Bank" for o in occ)

def test_cancel_hides_from_list(db):
    u = _admin(db)
    a = appt.create(db, title="X", start=datetime(2026, 7, 2, 9, 0), created_by=u.id)
    assert appt.cancel(db, a.id) is True
    assert appt.list_between(db, datetime(2026, 7, 1), datetime(2026, 7, 31)) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_appointments_service.py -v`
Expected: FAIL — no module `app.models.appointment`.

- [ ] **Step 3: Write `backend/app/models/appointment.py`**

```python
from datetime import datetime
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Appointment(Base):
    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(nullable=False)
    start: Mapped[datetime] = mapped_column(nullable=False, index=True)   # UTC
    end: Mapped[datetime | None] = mapped_column(nullable=True)
    location: Mapped[str | None] = mapped_column(nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    for_both: Mapped[bool] = mapped_column(default=False, nullable=False)
    needs_ride: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(nullable=True)
    recurrence: Mapped[str] = mapped_column(default="none", nullable=False)  # none | monthly
    recur_day: Mapped[int | None] = mapped_column(nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    canceled: Mapped[bool] = mapped_column(default=False, nullable=False)
```

Append to `__init__.py`: `from app.models.appointment import Appointment  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/appointments.py`**

```python
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.appointment import Appointment

@dataclass
class Occurrence:
    appointment_id: int
    title: str
    start: datetime
    end: datetime | None
    location: str | None
    person_id: int | None
    for_both: bool
    needs_ride: bool
    notes: str | None

def create(db: Session, *, title, start, end=None, location=None, person_id=None,
           for_both=False, needs_ride=False, notes=None, recurrence="none",
           recur_day=None, created_by) -> Appointment:
    a = Appointment(title=title, start=start, end=end, location=location, person_id=person_id,
                    for_both=for_both, needs_ride=needs_ride, notes=notes, recurrence=recurrence,
                    recur_day=recur_day, created_by=created_by)
    db.add(a); db.commit(); db.refresh(a)
    return a

def get(db: Session, appt_id: int) -> Appointment | None:
    return db.get(Appointment, appt_id)

def update(db: Session, appt_id: int, **fields) -> Appointment | None:
    a = db.get(Appointment, appt_id)
    if a is None:
        return None
    for k, v in fields.items():
        setattr(a, k, v)
    db.commit(); db.refresh(a)
    return a

def cancel(db: Session, appt_id: int) -> bool:
    a = db.get(Appointment, appt_id)
    if a is None:
        return False
    a.canceled = True; db.commit()
    return True

def _add_months(d: datetime, months: int) -> datetime:
    m = d.month - 1 + months
    year = d.year + m // 12
    month = m % 12 + 1
    return d.replace(year=year, month=month)

def expand_occurrences(a: Appointment, window_start: datetime, window_end: datetime) -> list[Occurrence]:
    def occ(start: datetime) -> Occurrence:
        return Occurrence(a.id, a.title, start, a.end, a.location, a.person_id,
                          a.for_both, a.needs_ride, a.notes)
    if a.recurrence == "none":
        return [occ(a.start)] if window_start <= a.start <= window_end else []
    out: list[Occurrence] = []
    cur = a.start
    # fast-forward to window
    while cur < window_start:
        cur = _add_months(cur, 1)
    while cur <= window_end:
        out.append(occ(cur))
        cur = _add_months(cur, 1)
    return out

def list_between(db: Session, start: datetime, end: datetime, *, include_canceled=False) -> list[Occurrence]:
    stmt = select(Appointment)
    if not include_canceled:
        stmt = stmt.where(Appointment.canceled.is_(False))
    rows = db.scalars(stmt).all()
    out: list[Occurrence] = []
    for a in rows:
        out.extend(expand_occurrences(a, start, end))
    out.sort(key=lambda o: o.start)
    return out
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_appointments_service.py -v`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/appointment.py backend/app/models/__init__.py \
        backend/app/services/appointments.py backend/tests/test_appointments_service.py
git commit -m "feat(appointments): model and service with ride flag and monthly recurrence"
```

---

### Task 2: Appointments router (role-enforced) + schema

**Files:**
- Create: `backend/app/schemas/appointment.py`, `backend/app/routers/appointments.py`
- Modify: `backend/app/main.py` (include router)
- Test: `backend/tests/test_appointments_api.py`

**Interfaces:**
- Consumes: `services.appointments`, `require_role`, `current_user`.
- Produces REST:
  - `GET /api/appointments?start=ISO&end=ISO` → `list[OccurrenceOut]` (any authed role).
  - `POST /api/appointments` (admin **or** family) → creates; `created_by` = current user.
  - `PUT /api/appointments/{id}` (admin or family) → update.
  - `POST /api/appointments/{id}/cancel` (admin or family) → cancel.
  - Parents get **403** on the mutating routes.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_appointments_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth
import app.models  # noqa: F401

@pytest.fixture()
def env():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TS = sessionmaker(bind=engine)
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="fam", password="pw", display_name="Fam", role="family")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    app.dependency_overrides[get_db] = lambda: TS()
    yield TestClient(app)
    app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})

def test_family_can_create_parent_cannot(env):
    _login(env, "fam")
    r = env.post("/api/appointments", json={"title": "Physio", "start": "2026-07-03T10:00:00",
                 "needs_ride": True})
    assert r.status_code == 200
    _login(env, "mom")
    assert env.post("/api/appointments", json={"title": "x", "start": "2026-07-03T10:00:00"}).status_code == 403

def test_list_returns_occurrences(env):
    _login(env, "admin")
    env.post("/api/appointments", json={"title": "Bank", "start": "2026-07-05T10:00:00",
             "location": "Bank", "recurrence": "monthly", "recur_day": 5})
    r = env.get("/api/appointments", params={"start": "2026-07-01T00:00:00", "end": "2026-09-30T00:00:00"})
    assert [o["start"][:7] for o in r.json()] == ["2026-07", "2026-08", "2026-09"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_appointments_api.py -v`
Expected: FAIL — no module `app.routers.appointments`.

- [ ] **Step 3: Write `backend/app/schemas/appointment.py`**

```python
from datetime import datetime
from pydantic import BaseModel

class AppointmentIn(BaseModel):
    title: str
    start: datetime
    end: datetime | None = None
    location: str | None = None
    person_id: int | None = None
    for_both: bool = False
    needs_ride: bool = False
    notes: str | None = None
    recurrence: str = "none"        # none | monthly
    recur_day: int | None = None

class OccurrenceOut(BaseModel):
    appointment_id: int
    title: str
    start: datetime
    end: datetime | None
    location: str | None
    person_id: int | None
    for_both: bool
    needs_ride: bool
    notes: str | None
```

- [ ] **Step 4: Write `backend/app/routers/appointments.py`**

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.appointment import AppointmentIn, OccurrenceOut
from app.services import appointments as svc

router = APIRouter(prefix="/api/appointments", tags=["appointments"])
_editor = require_role("admin", "family")

@router.get("", response_model=list[OccurrenceOut])
def list_appointments(start: datetime = Query(...), end: datetime = Query(...),
                      db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_between(db, start, end)

@router.post("", response_model=OccurrenceOut)
def create(body: AppointmentIn, db: Session = Depends(get_db), user: User = Depends(_editor)):
    a = svc.create(db, created_by=user.id, **body.model_dump())
    return svc.expand_occurrences(a, a.start, a.start)[0]

@router.put("/{appt_id}")
def update(appt_id: int, body: AppointmentIn, db: Session = Depends(get_db), _: User = Depends(_editor)):
    if svc.update(db, appt_id, **body.model_dump()) is None:
        raise HTTPException(404, "Appointment not found")
    return {"ok": True}

@router.post("/{appt_id}/cancel")
def cancel(appt_id: int, db: Session = Depends(get_db), _: User = Depends(_editor)):
    if not svc.cancel(db, appt_id):
        raise HTTPException(404, "Appointment not found")
    return {"ok": True}
```

- [ ] **Step 5: Wire the router** — add to `backend/app/main.py`

```python
from app.routers import appointments
app.include_router(appointments.router)
```
(Add the import beside the existing `from app.routers import auth, people` and the include beside the others — **before** the SPA catch-all mount so `/api/...` is matched first.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_appointments_api.py -v`
Expected: PASS (both).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/appointment.py backend/app/routers/appointments.py \
        backend/app/main.py backend/tests/test_appointments_api.py
git commit -m "feat(appointments): role-enforced REST router"
```

---

### Task 3: Todos model + service + router

**Files:**
- Create: `backend/app/models/todo.py`, `backend/app/services/todos.py`,
  `backend/app/schemas/todo.py`, `backend/app/routers/todos.py`
- Modify: `backend/app/models/__init__.py`, `backend/app/main.py`
- Test: `backend/tests/test_todos.py`

**Interfaces:**
- Produces:
  - `Todo` ORM: `id`, `text:str`, `done:bool`, `assignee_id:int|None` (FK users, optional),
    `created_by:int`, `created_at:datetime`, `done_at:datetime|None`.
  - `services.todos.list_todos(db) -> list[Todo]` (open first by created_at, then done by done_at desc).
  - `add(db, *, text, created_by, assignee_id=None) -> Todo`
  - `set_done(db, todo_id, done:bool) -> Todo | None` (sets/clears `done_at`).
  - `edit(db, todo_id, *, text) -> Todo | None`; `delete(db, todo_id) -> bool`.
  - REST under `/api/todos`: GET (authed), POST/PUT/`{id}/done`/DELETE allowed for **all** roles
    (parents manage their own list) — this list is shared/household, parent-editable by design.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_todos.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth, todos
import app.models  # noqa: F401

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()

def test_done_moves_to_end_with_timestamp(db):
    u = auth.create_user(db, username="mom", password="p", display_name="Mom", role="parent")
    a = todos.add(db, text="Milk", created_by=u.id)
    todos.add(db, text="Bread", created_by=u.id)
    todos.set_done(db, a.id, True)
    ordered = todos.list_todos(db)
    assert [t.text for t in ordered] == ["Bread", "Milk"]   # open first, done last
    assert ordered[-1].done and ordered[-1].done_at is not None

@pytest.fixture()
def client():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    app.dependency_overrides[get_db] = lambda: TS(); yield TestClient(app)
    app.dependency_overrides.clear()

def test_parent_can_manage_todos(client):
    client.post("/api/auth/login", json={"username": "mom", "password": "pw"})
    r = client.post("/api/todos", json={"text": "Call pharmacy"})
    assert r.status_code == 200
    tid = r.json()["id"]
    assert client.post(f"/api/todos/{tid}/done", json={"done": True}).status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_todos.py -v`
Expected: FAIL — no module `app.models.todo`.

- [ ] **Step 3: Write `backend/app/models/todo.py`**

```python
from datetime import datetime, UTC
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Todo(Base):
    __tablename__ = "todos"
    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(nullable=False)
    done: Mapped[bool] = mapped_column(default=False, nullable=False)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC).replace(tzinfo=None))
    done_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

Append to `__init__.py`: `from app.models.todo import Todo  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/todos.py`**

```python
from datetime import datetime, UTC
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.todo import Todo

def _now() -> datetime: return datetime.now(UTC).replace(tzinfo=None)

def list_todos(db: Session) -> list[Todo]:
    open_ = db.scalars(select(Todo).where(Todo.done.is_(False)).order_by(Todo.created_at)).all()
    done_ = db.scalars(select(Todo).where(Todo.done.is_(True)).order_by(Todo.done_at.desc())).all()
    return list(open_) + list(done_)

def add(db: Session, *, text: str, created_by: int, assignee_id: int | None = None) -> Todo:
    t = Todo(text=text, created_by=created_by, assignee_id=assignee_id)
    db.add(t); db.commit(); db.refresh(t)
    return t

def set_done(db: Session, todo_id: int, done: bool) -> Todo | None:
    t = db.get(Todo, todo_id)
    if t is None: return None
    t.done = done; t.done_at = _now() if done else None
    db.commit(); db.refresh(t)
    return t

def edit(db: Session, todo_id: int, *, text: str) -> Todo | None:
    t = db.get(Todo, todo_id)
    if t is None: return None
    t.text = text; db.commit(); db.refresh(t)
    return t

def delete(db: Session, todo_id: int) -> bool:
    t = db.get(Todo, todo_id)
    if t is None: return False
    db.delete(t); db.commit()
    return True
```

- [ ] **Step 5: Write `backend/app/schemas/todo.py` + `backend/app/routers/todos.py`**

```python
# schemas/todo.py
from datetime import datetime
from pydantic import BaseModel

class TodoIn(BaseModel):
    text: str
    assignee_id: int | None = None

class TodoDoneIn(BaseModel):
    done: bool

class TodoOut(BaseModel):
    id: int
    text: str
    done: bool
    assignee_id: int | None
    done_at: datetime | None
    class Config: from_attributes = True
```

```python
# routers/todos.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.todo import TodoIn, TodoDoneIn, TodoOut
from app.services import todos as svc

router = APIRouter(prefix="/api/todos", tags=["todos"])

@router.get("", response_model=list[TodoOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_todos(db)

@router.post("", response_model=TodoOut)
def add(body: TodoIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.add(db, text=body.text, created_by=user.id, assignee_id=body.assignee_id)

@router.put("/{todo_id}", response_model=TodoOut)
def edit(todo_id: int, body: TodoIn, db: Session = Depends(get_db), _=Depends(current_user)):
    t = svc.edit(db, todo_id, text=body.text)
    if t is None: raise HTTPException(404, "Todo not found")
    return t

@router.post("/{todo_id}/done", response_model=TodoOut)
def done(todo_id: int, body: TodoDoneIn, db: Session = Depends(get_db), _=Depends(current_user)):
    t = svc.set_done(db, todo_id, body.done)
    if t is None: raise HTTPException(404, "Todo not found")
    return t

@router.delete("/{todo_id}")
def delete(todo_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    if not svc.delete(db, todo_id): raise HTTPException(404, "Todo not found")
    return {"ok": True}
```

Wire in `main.py`: `from app.routers import todos` + `app.include_router(todos.router)`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_todos.py -v`
Expected: PASS (both).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/todo.py backend/app/models/__init__.py backend/app/services/todos.py \
        backend/app/schemas/todo.py backend/app/routers/todos.py backend/app/main.py backend/tests/test_todos.py
git commit -m "feat(todos): model, service, parent-editable router"
```

---

### Task 4: Grocery model + service + router (store tags, grouping, clear-checked)

**Files:**
- Create: `backend/app/models/grocery.py`, `backend/app/services/grocery.py`,
  `backend/app/schemas/grocery.py`, `backend/app/routers/grocery.py`
- Modify: `__init__.py`, `main.py`
- Test: `backend/tests/test_grocery.py`

**Interfaces:**
- Produces:
  - `GroceryItem` ORM: `id`, `name:str`, `store:str` (`"costco"|"grocery"|"either"`),
    `qty:int` (default 1), `checked:bool`, `created_by:int`, `checked_at:datetime|None`.
  - `services.grocery.list_items(db, store:str|None=None) -> list[GroceryItem]`
    (store filter; `None` ⇒ all; within result, unchecked before checked).
  - `add(db, *, name, store="either", qty=1, created_by) -> GroceryItem`
  - `set_checked(db, item_id, checked:bool) -> GroceryItem | None`
  - `set_qty(db, item_id, qty:int) -> GroceryItem | None`
  - `edit(db, item_id, *, name) -> GroceryItem | None`; `delete(db, item_id) -> bool`
  - `clear_checked(db) -> int` (returns count removed).
  - REST `/api/grocery`: GET `?store=`, POST/PUT/DELETE/`{id}/check`/`{id}/qty`/`clear-checked`,
    **all roles** (parents manage grocery by design).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_grocery.py`

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import auth, grocery
import app.models  # noqa: F401

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_grocery.py -v`
Expected: FAIL — no module `app.models.grocery`.

- [ ] **Step 3: Write `backend/app/models/grocery.py`**

```python
from datetime import datetime
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class GroceryItem(Base):
    __tablename__ = "grocery_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    store: Mapped[str] = mapped_column(default="either", nullable=False)  # costco | grocery | either
    qty: Mapped[int] = mapped_column(default=1, nullable=False)
    checked: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

Append to `__init__.py`: `from app.models.grocery import GroceryItem  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/grocery.py`**

```python
from datetime import datetime, UTC
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.orm import Session
from app.models.grocery import GroceryItem

def _now(): return datetime.now(UTC).replace(tzinfo=None)

def list_items(db: Session, store: str | None = None) -> list[GroceryItem]:
    stmt = select(GroceryItem)
    if store and store != "all":
        stmt = stmt.where(GroceryItem.store == store)
    stmt = stmt.order_by(GroceryItem.checked, GroceryItem.id)
    return list(db.scalars(stmt))

def add(db: Session, *, name: str, store: str = "either", qty: int = 1, created_by: int) -> GroceryItem:
    g = GroceryItem(name=name, store=store, qty=qty, created_by=created_by)
    db.add(g); db.commit(); db.refresh(g)
    return g

def set_checked(db: Session, item_id: int, checked: bool) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.checked = checked; g.checked_at = _now() if checked else None
    db.commit(); db.refresh(g)
    return g

def set_qty(db: Session, item_id: int, qty: int) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.qty = max(1, qty); db.commit(); db.refresh(g)
    return g

def edit(db: Session, item_id: int, *, name: str) -> GroceryItem | None:
    g = db.get(GroceryItem, item_id)
    if g is None: return None
    g.name = name; db.commit(); db.refresh(g)
    return g

def delete(db: Session, item_id: int) -> bool:
    g = db.get(GroceryItem, item_id)
    if g is None: return False
    db.delete(g); db.commit()
    return True

def clear_checked(db: Session) -> int:
    n = db.execute(sa_delete(GroceryItem).where(GroceryItem.checked.is_(True))).rowcount
    db.commit()
    return n
```

- [ ] **Step 5: Write `backend/app/schemas/grocery.py` + `backend/app/routers/grocery.py`**

```python
# schemas/grocery.py
from pydantic import BaseModel

class GroceryIn(BaseModel):
    name: str
    store: str = "either"   # costco | grocery | either
    qty: int = 1

class GroceryCheckIn(BaseModel):
    checked: bool

class GroceryQtyIn(BaseModel):
    qty: int

class GroceryNameIn(BaseModel):
    name: str

class GroceryOut(BaseModel):
    id: int
    name: str
    store: str
    qty: int
    checked: bool
    class Config: from_attributes = True
```

```python
# routers/grocery.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.models.user import User
from app.schemas.grocery import GroceryIn, GroceryCheckIn, GroceryQtyIn, GroceryNameIn, GroceryOut
from app.services import grocery as svc

router = APIRouter(prefix="/api/grocery", tags=["grocery"])

@router.get("", response_model=list[GroceryOut])
def list_(store: str | None = Query(None), db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_items(db, store)

@router.post("", response_model=GroceryOut)
def add(body: GroceryIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.add(db, name=body.name, store=body.store, qty=body.qty, created_by=user.id)

@router.put("/{item_id}", response_model=GroceryOut)
def edit(item_id: int, body: GroceryNameIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.edit(db, item_id, name=body.name)
    if g is None: raise HTTPException(404, "Item not found")
    return g

@router.post("/{item_id}/check", response_model=GroceryOut)
def check(item_id: int, body: GroceryCheckIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.set_checked(db, item_id, body.checked)
    if g is None: raise HTTPException(404, "Item not found")
    return g

@router.post("/{item_id}/qty", response_model=GroceryOut)
def qty(item_id: int, body: GroceryQtyIn, db: Session = Depends(get_db), _=Depends(current_user)):
    g = svc.set_qty(db, item_id, body.qty)
    if g is None: raise HTTPException(404, "Item not found")
    return g

@router.delete("/{item_id}")
def delete(item_id: int, db: Session = Depends(get_db), _=Depends(current_user)):
    if not svc.delete(db, item_id): raise HTTPException(404, "Item not found")
    return {"ok": True}

@router.post("/clear-checked")
def clear(db: Session = Depends(get_db), _=Depends(current_user)):
    return {"removed": svc.clear_checked(db)}
```

Wire in `main.py`: `from app.routers import grocery` + `app.include_router(grocery.router)`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_grocery.py -v`
Expected: PASS (both).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/grocery.py backend/app/models/__init__.py backend/app/services/grocery.py \
        backend/app/schemas/grocery.py backend/app/routers/grocery.py backend/app/main.py backend/tests/test_grocery.py
git commit -m "feat(grocery): store-tagged items with grouping and clear-checked"
```

---

### Task 5: Birthdays model + service + router (upcoming calc)

**Files:**
- Create: `backend/app/models/birthday.py`, `backend/app/services/birthdays.py`,
  `backend/app/schemas/birthday.py`, `backend/app/routers/birthdays.py`
- Modify: `__init__.py`, `main.py`
- Test: `backend/tests/test_birthdays.py`

**Interfaces:**
- Produces:
  - `Birthday` ORM: `id`, `name:str`, `month:int` (1–12), `day:int` (1–31), `year:int|None` (optional).
  - `services.birthdays.add(db, *, name, month, day, year=None) -> Birthday`; `delete(db, id) -> bool`;
    `list_all(db) -> list[Birthday]`.
  - `upcoming(db, today:date, within_days:int=30) -> list[UpcomingBirthday]` where
    `UpcomingBirthday` = dataclass `{birthday_id, name, next_date:date, days_until:int, turning:int|None}`.
    Sorted by `days_until`. Wraps year boundary.
  - REST `/api/birthdays`: GET, GET `/upcoming?within=30`, POST/DELETE (admin **or** family).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_birthdays.py`

```python
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import birthdays
import app.models  # noqa: F401

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()

def test_upcoming_within_window_and_days_until(db):
    birthdays.add(db, name="Mom", month=6, day=25, year=1941)
    birthdays.add(db, name="Cousin", month=12, day=1)
    up = birthdays.upcoming(db, today=date(2026, 6, 22), within_days=30)
    assert [u.name for u in up] == ["Mom"]
    assert up[0].days_until == 3
    assert up[0].turning == 85

def test_upcoming_wraps_year_boundary(db):
    birthdays.add(db, name="NewYear", month=1, day=2)
    up = birthdays.upcoming(db, today=date(2026, 12, 28), within_days=10)
    assert up and up[0].days_until == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_birthdays.py -v`
Expected: FAIL — no module `app.models.birthday`.

- [ ] **Step 3: Write `backend/app/models/birthday.py`**

```python
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Birthday(Base):
    __tablename__ = "birthdays"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    month: Mapped[int] = mapped_column(nullable=False)
    day: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int | None] = mapped_column(nullable=True)
```

Append to `__init__.py`: `from app.models.birthday import Birthday  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/birthdays.py`**

```python
from dataclasses import dataclass
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.birthday import Birthday

@dataclass
class UpcomingBirthday:
    birthday_id: int
    name: str
    next_date: date
    days_until: int
    turning: int | None

def add(db: Session, *, name: str, month: int, day: int, year: int | None = None) -> Birthday:
    b = Birthday(name=name, month=month, day=day, year=year)
    db.add(b); db.commit(); db.refresh(b)
    return b

def delete(db: Session, birthday_id: int) -> bool:
    b = db.get(Birthday, birthday_id)
    if b is None: return False
    db.delete(b); db.commit()
    return True

def list_all(db: Session) -> list[Birthday]:
    return list(db.scalars(select(Birthday).order_by(Birthday.month, Birthday.day)))

def _next_occurrence(today: date, month: int, day: int) -> date:
    year = today.year
    try:
        cand = date(year, month, day)
    except ValueError:                      # Feb 29 in a non-leap year → treat as Mar 1
        cand = date(year, month, 28)
    if cand < today:
        cand = date(year + 1, month, min(day, 28))
    return cand

def upcoming(db: Session, today: date, within_days: int = 30) -> list[UpcomingBirthday]:
    out: list[UpcomingBirthday] = []
    for b in db.scalars(select(Birthday)):
        nxt = _next_occurrence(today, b.month, b.day)
        days = (nxt - today).days
        if 0 <= days <= within_days:
            turning = (nxt.year - b.year) if b.year else None
            out.append(UpcomingBirthday(b.id, b.name, nxt, days, turning))
    out.sort(key=lambda u: u.days_until)
    return out
```

- [ ] **Step 5: Write `backend/app/schemas/birthday.py` + `backend/app/routers/birthdays.py`**

```python
# schemas/birthday.py
from datetime import date
from pydantic import BaseModel

class BirthdayIn(BaseModel):
    name: str
    month: int
    day: int
    year: int | None = None

class BirthdayOut(BaseModel):
    id: int
    name: str
    month: int
    day: int
    year: int | None
    class Config: from_attributes = True

class UpcomingOut(BaseModel):
    birthday_id: int
    name: str
    next_date: date
    days_until: int
    turning: int | None
```

```python
# routers/birthdays.py
from datetime import date, UTC, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import get_db
from app.deps import current_user, require_role
from app.schemas.birthday import BirthdayIn, BirthdayOut, UpcomingOut
from app.services import birthdays as svc
from zoneinfo import ZoneInfo

router = APIRouter(prefix="/api/birthdays", tags=["birthdays"])
_editor = require_role("admin", "family")

def _today() -> date:
    tz = ZoneInfo(get_settings().app_timezone)
    return datetime.now(UTC).astimezone(tz).date()

@router.get("", response_model=list[BirthdayOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_all(db)

@router.get("/upcoming", response_model=list[UpcomingOut])
def upcoming(within: int = Query(30), db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.upcoming(db, today=_today(), within_days=within)

@router.post("", response_model=BirthdayOut)
def add(body: BirthdayIn, db: Session = Depends(get_db), _=Depends(_editor)):
    return svc.add(db, **body.model_dump())

@router.delete("/{birthday_id}")
def delete(birthday_id: int, db: Session = Depends(get_db), _=Depends(_editor)):
    if not svc.delete(db, birthday_id): raise HTTPException(404, "Birthday not found")
    return {"ok": True}
```

Wire in `main.py`: `from app.routers import birthdays` + `app.include_router(birthdays.router)`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_birthdays.py -v`
Expected: PASS (both).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/birthday.py backend/app/models/__init__.py backend/app/services/birthdays.py \
        backend/app/schemas/birthday.py backend/app/routers/birthdays.py backend/app/main.py backend/tests/test_birthdays.py
git commit -m "feat(birthdays): annual birthdays with upcoming-window calculation"
```

---

### Task 6: Today roll-up service + router + driver view

**Files:**
- Create: `backend/app/services/today.py`, `backend/app/schemas/today.py`, `backend/app/routers/today.py`
- Modify: `main.py`
- Test: `backend/tests/test_today.py`

**Interfaces:**
- Consumes: `services.appointments`, `services.todos`, `services.birthdays`, `get_settings`.
- Produces:
  - `services.today.today_rollup(db, today:date) -> dict` with keys
    `appointments:list[Occurrence]` (today only, sorted), `rides_today:list[Occurrence]`
    (needs_ride subset), `open_todos:list[Todo]`, `upcoming_birthdays:list[UpcomingBirthday]` (≤14d).
  - `services.today.week_rollup(db, week_start:date) -> dict` with `days` (7 lists of Occurrence)
    and `driver_runs:list[Occurrence]` (all needs_ride in the week, sorted) — the driver view.
  - REST: `GET /api/today`, `GET /api/week?start=YYYY-MM-DD` (any authed role; week's driver
    roll-up returned for all but surfaced in admin/family UI).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_today.py`

```python
from datetime import date, datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import auth, appointments, todos, birthdays, today
import app.models  # noqa: F401

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()

def test_today_rollup_filters_to_today_and_rides(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    appointments.create(db, title="Cardio", start=datetime(2026, 6, 22, 14, 0), needs_ride=True, created_by=u.id)
    appointments.create(db, title="Tomorrow", start=datetime(2026, 6, 23, 9, 0), created_by=u.id)
    todos.add(db, text="Milk", created_by=u.id)
    birthdays.add(db, name="Mom", month=6, day=25)
    roll = today.today_rollup(db, today=date(2026, 6, 22))
    assert [a.title for a in roll["appointments"]] == ["Cardio"]
    assert [a.title for a in roll["rides_today"]] == ["Cardio"]
    assert roll["open_todos"][0].text == "Milk"
    assert roll["upcoming_birthdays"][0].name == "Mom"

def test_week_rollup_collects_driver_runs(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    appointments.create(db, title="Ride1", start=datetime(2026, 6, 22, 9, 0), needs_ride=True, created_by=u.id)
    appointments.create(db, title="Ride2", start=datetime(2026, 6, 25, 9, 0), needs_ride=True, created_by=u.id)
    wk = today.week_rollup(db, week_start=date(2026, 6, 22))
    assert [r.title for r in wk["driver_runs"]] == ["Ride1", "Ride2"]
    assert len(wk["days"]) == 7
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_today.py -v`
Expected: FAIL — no module `app.services.today`.

- [ ] **Step 3: Write `backend/app/services/today.py`**

```python
from datetime import date, datetime, time, timedelta
from sqlalchemy.orm import Session
from app.services import appointments, todos, birthdays

def _day_window(d: date) -> tuple[datetime, datetime]:
    return datetime.combine(d, time.min), datetime.combine(d, time.max)

def today_rollup(db: Session, today: date) -> dict:
    start, end = _day_window(today)
    occ = appointments.list_between(db, start, end)
    open_todos = [t for t in todos.list_todos(db) if not t.done]
    return {
        "appointments": occ,
        "rides_today": [o for o in occ if o.needs_ride],
        "open_todos": open_todos,
        "upcoming_birthdays": birthdays.upcoming(db, today=today, within_days=14),
    }

def week_rollup(db: Session, week_start: date) -> dict:
    days: list[list] = []
    driver_runs: list = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        start, end = _day_window(d)
        occ = appointments.list_between(db, start, end)
        days.append(occ)
        driver_runs.extend(o for o in occ if o.needs_ride)
    driver_runs.sort(key=lambda o: o.start)
    return {"week_start": week_start, "days": days, "driver_runs": driver_runs}
```

- [ ] **Step 4: Write `backend/app/schemas/today.py` + `backend/app/routers/today.py`**

```python
# schemas/today.py
from datetime import date
from pydantic import BaseModel
from app.schemas.appointment import OccurrenceOut
from app.schemas.todo import TodoOut
from app.schemas.birthday import UpcomingOut

class TodayOut(BaseModel):
    appointments: list[OccurrenceOut]
    rides_today: list[OccurrenceOut]
    open_todos: list[TodoOut]
    upcoming_birthdays: list[UpcomingOut]

class DayOut(BaseModel):
    date: date
    appointments: list[OccurrenceOut]

class WeekOut(BaseModel):
    week_start: date
    days: list[DayOut]
    driver_runs: list[OccurrenceOut]
```

```python
# routers/today.py
from datetime import date, datetime, timedelta, UTC
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db import get_db
from app.deps import current_user
from app.schemas.today import TodayOut, WeekOut, DayOut
from app.services import today as svc

router = APIRouter(prefix="/api", tags=["today"])

def _local_today() -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(get_settings().app_timezone)).date()

@router.get("/today", response_model=TodayOut)
def today(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.today_rollup(db, today=_local_today())

@router.get("/week", response_model=WeekOut)
def week(start: date | None = Query(None), db: Session = Depends(get_db), _=Depends(current_user)):
    ws = start or _local_today()
    roll = svc.week_rollup(db, week_start=ws)
    days = [DayOut(date=ws + timedelta(days=i), appointments=roll["days"][i]) for i in range(7)]
    return WeekOut(week_start=ws, days=days, driver_runs=roll["driver_runs"])
```

Wire in `main.py`: `from app.routers import today` + `app.include_router(today.router)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_today.py -v`
Expected: PASS (both).

- [ ] **Step 6: Generate migration for all v1 tables + commit**

Run: `cd backend && alembic revision --autogenerate -m "v1 core tables" && alembic upgrade head`
Expected: a migration creating `appointments`, `todos`, `grocery_items`, `birthdays`.

```bash
git add backend/app/services/today.py backend/app/schemas/today.py backend/app/routers/today.py \
        backend/app/main.py backend/tests/test_today.py backend/migrations/versions
git commit -m "feat(today): today + week roll-ups with driver view; v1 core migration"
```

---

### Task 7: Frontend — role-aware routing, parent vs admin layouts, Today screen

**Files:**
- Create: `frontend/src/api/types.ts`, `frontend/src/lib/format.ts`,
  `frontend/src/components/ConfirmDialog.tsx`, `frontend/src/components/Confirmation.tsx`,
  `frontend/src/screens/Today.tsx`, `frontend/src/parent/ParentLayout.tsx`,
  `frontend/src/admin/AdminLayout.tsx`
- Modify: `frontend/src/AppShell.tsx`
- Test: `frontend/src/lib/format.test.ts`

**Interfaces:**
- Consumes: `/api/today`, `useAuth`, `useFontScale`.
- Produces:
  - TS types mirroring the API (`Occurrence`, `Todo`, `GroceryItem`, `Birthday`, `Upcoming`, `Today`).
  - `formatTime(iso)` / `formatDay(iso)` in `APP_TIMEZONE`-naive local rendering.
  - `<ConfirmDialog>` — full-screen big modal (never a toast), icon + text, two large buttons.
  - `<Confirmation>` — full-width success banner, icon + text, visible ≥6s (the visual ack).
  - `ParentLayout` (today-first, max 4 huge tab buttons: Today · To-do · Grocery — no month/accounts).
  - `AdminLayout` (Today · Schedule · To-do · Grocery · Birthdays · Accounts; responsive to iPhone).
  - `<Today>` screen used by both layouts (rendered larger in parent).

- [ ] **Step 1: Write the failing test** — `frontend/src/lib/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("renders a 12-hour time with am/pm", () => {
    expect(formatTime("2026-06-22T14:05:00")).toMatch(/2:05\s?pm/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Write `frontend/src/lib/format.ts` + `frontend/src/api/types.ts`**

```ts
// lib/format.ts — server sends naive-local ISO; render without re-zoning
export function formatTime(iso: string): string {
  const [, hms] = iso.split("T");
  const [h, m] = hms.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
export function formatDay(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
```

```ts
// api/types.ts
export interface Occurrence { appointment_id: number; title: string; start: string;
  end: string | null; location: string | null; person_id: number | null;
  for_both: boolean; needs_ride: boolean; notes: string | null; }
export interface Todo { id: number; text: string; done: boolean;
  assignee_id: number | null; done_at: string | null; }
export interface GroceryItem { id: number; name: string; store: "costco" | "grocery" | "either";
  qty: number; checked: boolean; }
export interface Upcoming { birthday_id: number; name: string; next_date: string;
  days_until: number; turning: number | null; }
export interface TodayData { appointments: Occurrence[]; rides_today: Occurrence[];
  open_todos: Todo[]; upcoming_birthdays: Upcoming[]; }
```

- [ ] **Step 4: Write `frontend/src/components/ConfirmDialog.tsx` + `Confirmation.tsx`**

```tsx
// ConfirmDialog.tsx — big modal for destructive actions (never a small toast)
import type { ReactNode } from "react";
import { Button } from "./Button";
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal>
      <div className="bg-paper rounded-3xl p-8 max-w-lg w-full flex flex-col gap-6">
        <h2 className="text-huge font-bold">{title}</h2>
        {body && <div className="text-big">{body}</div>}
        <div className="flex gap-touch justify-end">
          <button onClick={onCancel}
            className="min-h-touch px-6 rounded-2xl border-4 text-big font-semibold">Keep</button>
          <button onClick={onConfirm}
            className="min-h-touch px-6 rounded-2xl bg-red-700 text-paper text-big font-semibold">
            {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// Confirmation.tsx — full-width success banner, icon + text, visible ≥6s
import { useEffect } from "react";
export function Confirmation({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 6000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div role="status" className="fixed top-0 inset-x-0 bg-confirm text-paper text-big
                                  font-bold p-5 flex items-center gap-3 justify-center">
      <span aria-hidden>✓</span><span>{message}</span>
    </div>
  );
}
```

- [ ] **Step 5: Write `frontend/src/screens/Today.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TodayData } from "../api/types";
import { formatTime } from "../lib/format";

export function Today() {
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => { void api.get<TodayData>("/api/today").then(setData); }, []);
  if (!data) return <p className="p-6 text-big">Loading today…</p>;
  return (
    <div className="p-6 flex flex-col gap-8">
      <section>
        <h2 className="text-huge font-bold mb-3">Today</h2>
        {data.appointments.length === 0 && <p className="text-big">Nothing scheduled today.</p>}
        {data.appointments.map(a => (
          <div key={`${a.appointment_id}-${a.start}`}
               className="border-4 rounded-2xl p-4 mb-3 flex items-center gap-4">
            <span className="text-big font-bold w-28">{formatTime(a.start)}</span>
            <span className="text-big flex-1">{a.title}{a.location ? ` · ${a.location}` : ""}</span>
            {a.needs_ride && (
              <span className="text-base font-bold bg-dad text-paper rounded-xl px-3 py-1
                               inline-flex items-center gap-2">🚗 Needs a ride</span>
            )}
          </div>
        ))}
      </section>
      {data.upcoming_birthdays.length > 0 && (
        <section>
          <h2 className="text-big font-bold mb-2">Coming up</h2>
          {data.upcoming_birthdays.map(b => (
            <p key={b.birthday_id} className="text-big">🎂 {b.name}'s birthday
              {b.days_until === 0 ? " is today!" : ` in ${b.days_until} day${b.days_until === 1 ? "" : "s"}`}
              {b.turning ? ` (turning ${b.turning})` : ""}</p>
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write `ParentLayout.tsx` + `AdminLayout.tsx`, update `AppShell.tsx`**

```tsx
// parent/ParentLayout.tsx — today-first, huge tabs, no month/accounts
import { useState } from "react";
import { Today } from "../screens/Today";
type Tab = "today" | "todo" | "grocery";
export function ParentLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const T = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`flex-1 min-h-touch text-big font-bold rounded-2xl ${tab === id ? "bg-dad text-paper" : "border-4"}`}>
      {label}</button>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-touch p-4">
        <T id="today" label="Today" /><T id="todo" label="To-do" /><T id="grocery" label="Grocery" />
      </nav>
      {tab === "today" && <Today />}
      {/* TodoScreen / GroceryScreen mounted in Tasks 8–9 */}
    </div>
  );
}
```

```tsx
// admin/AdminLayout.tsx — fuller nav; wraps to iPhone width
import { useState } from "react";
import { Today } from "../screens/Today";
type Tab = "today" | "schedule" | "todo" | "grocery" | "birthdays" | "accounts";
export function AdminLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const tabs: [Tab, string][] = [["today","Today"],["schedule","Schedule"],["todo","To-do"],
    ["grocery","Grocery"],["birthdays","Birthdays"],["accounts","Accounts"]];
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-touch p-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`min-h-touch px-5 text-base font-bold rounded-2xl ${tab === id ? "bg-dad text-paper" : "border-4"}`}>
            {label}</button>
        ))}
      </nav>
      {tab === "today" && <Today />}
      {/* Schedule / Todo / Grocery / Birthdays / Accounts mounted in later tasks */}
    </div>
  );
}
```

```tsx
// AppShell.tsx — choose layout by role
import { useAuth } from "./lib/auth";
import { useFontScale } from "./lib/fontScale";
import { Button } from "./components/Button";
import { ParentLayout } from "./parent/ParentLayout";
import { AdminLayout } from "./admin/AdminLayout";
export function AppShell() {
  const { user, displayName, logout } = useAuth();
  const { scale, toggle } = useFontScale();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b-4">
        <h1 className="text-big font-bold">{displayName}</h1>
        <div className="flex gap-touch">
          <Button onClick={toggle}>{scale === "large" ? "Aa Normal" : "Aa Larger"}</Button>
          <Button onClick={logout}>Sign out</Button>
        </div>
      </header>
      {user?.role === "parent" ? <ParentLayout /> : <AdminLayout />}
    </div>
  );
}
```

- [ ] **Step 7: Run test + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: test PASS; strict typecheck clean; `dist/` built.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): role-aware layouts, Today screen, confirm dialog + banner"
```

---

### Task 8: Frontend — To-do screen (parent-editable, done area, big check)

**Files:**
- Create: `frontend/src/screens/TodoScreen.tsx`
- Modify: `frontend/src/parent/ParentLayout.tsx`, `frontend/src/admin/AdminLayout.tsx`
- Test: `frontend/src/screens/TodoScreen.test.tsx`

**Interfaces:**
- Consumes: `/api/todos` (GET/POST/`{id}/done`/DELETE).
- Produces: `<TodoScreen>` — add field + big button, big checkboxes with a satisfying check,
  open items on top, a clearly separated "Done" area below (items never disappear), delete with a
  `ConfirmDialog`. Renders a `Confirmation` banner on add/complete.

- [ ] **Step 1: Write the failing test** — `frontend/src/screens/TodoScreen.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TodoScreen } from "./TodoScreen";
import { api } from "../api/client";

vi.mock("../api/client");

beforeEach(() => {
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, text: "Milk", done: false, assignee_id: null, done_at: null },
    { id: 2, text: "Eggs", done: true, assignee_id: null, done_at: "2026-06-22T10:00:00" },
  ]);
});

describe("TodoScreen", () => {
  it("separates open items from the Done area", async () => {
    render(<TodoScreen />);
    await waitFor(() => screen.getByText("Milk"));
    expect(screen.getByText("Done")).toBeTruthy();   // the done section header
    expect(screen.getByText("Eggs")).toBeTruthy();   // completed item still visible
  });
});
```

(Add `@testing-library/react` + `@testing-library/jest-dom` + jsdom to devDeps and a
`vitest.config.ts` with `environment: "jsdom"` — fold this setup into this task's first commit.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/screens/TodoScreen.test.tsx`
Expected: FAIL — cannot resolve `./TodoScreen`.

- [ ] **Step 3: Write `frontend/src/screens/TodoScreen.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Todo } from "../api/types";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";

export function TodoScreen() {
  const [items, setItems] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [ack, setAck] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Todo | null>(null);

  async function load() { setItems(await api.get<Todo[]>("/api/todos")); }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!text.trim()) return;
    await api.post("/api/todos", { text: text.trim() });
    setText(""); setAck("Added to the list"); await load();
  }
  async function toggle(t: Todo) {
    await api.post(`/api/todos/${t.id}/done`, { done: !t.done });
    if (!t.done) setAck("Checked off ✓"); await load();
  }
  async function remove(t: Todo) {
    await api.get; setToDelete(null);
    await fetch(`/api/todos/${t.id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  return (
    <div className="p-6 flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <div className="flex gap-touch">
        <input className="flex-1 text-big p-4 border-4 rounded-xl" placeholder="Add an item"
               value={text} onChange={e => setText(e.target.value)}
               onKeyDown={e => e.key === "Enter" && add()} />
        <Button onClick={add} icon={<span aria-hidden>＋</span>}>Add</Button>
      </div>
      <ul className="flex flex-col gap-3">
        {open.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
      </ul>
      <h3 className="text-big font-bold mt-4">Done</h3>
      <ul className="flex flex-col gap-3 opacity-70">
        {done.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
      </ul>
      <ConfirmDialog open={!!toDelete} title="Remove this item?"
        body={toDelete?.text} confirmLabel="Remove"
        onConfirm={() => toDelete && remove(toDelete)} onCancel={() => setToDelete(null)} />
    </div>
  );
}

function Row({ t, onToggle, onDelete }:
  { t: Todo; onToggle: (t: Todo) => void; onDelete: (t: Todo) => void }) {
  return (
    <li className="flex items-center gap-4 border-4 rounded-2xl p-4">
      <button onClick={() => onToggle(t)} aria-label={t.done ? "Uncheck" : "Check"}
        className={`w-14 h-14 rounded-xl border-4 flex items-center justify-center text-huge
                    ${t.done ? "bg-confirm text-paper" : ""} transition-transform active:scale-90`}>
        {t.done ? "✓" : ""}
      </button>
      <span className={`flex-1 text-big ${t.done ? "line-through" : ""}`}>{t.text}</span>
      <button onClick={() => onDelete(t)} aria-label="Delete" className="min-h-touch px-4 text-big">🗑</button>
    </li>
  );
}
```

- [ ] **Step 4: Mount it in both layouts**

In `ParentLayout.tsx`: add `import { TodoScreen } from "../screens/TodoScreen";` and
`{tab === "todo" && <TodoScreen />}`. Same in `AdminLayout.tsx`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/screens/TodoScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src frontend/vitest.config.ts frontend/package.json
git commit -m "feat(frontend): to-do screen with done area, big checks, confirm-on-delete"
```

---

### Task 9: Frontend — Grocery screen (Costco | Grocery | All toggle, qty stepper)

**Files:**
- Create: `frontend/src/screens/GroceryScreen.tsx`
- Modify: `ParentLayout.tsx`, `AdminLayout.tsx`
- Test: `frontend/src/screens/GroceryScreen.test.tsx`

**Interfaces:**
- Consumes: `/api/grocery` (GET `?store=`, POST, `{id}/check`, `{id}/qty`, `clear-checked`).
- Produces: `<GroceryScreen>` — a big segmented control **Costco | Grocery | All** (text labels,
  not color-only), default grouped by store with large section headers, checked items grey out and
  drop to the bottom of their group, a `+/-` qty stepper with large buttons, `Clear checked` behind
  a `ConfirmDialog`.

- [ ] **Step 1: Write the failing test** — `frontend/src/screens/GroceryScreen.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GroceryScreen } from "./GroceryScreen";
import { api } from "../api/client";

vi.mock("../api/client");
beforeEach(() => {
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, name: "Eggs", store: "costco", qty: 1, checked: false },
    { id: 2, name: "Milk", store: "grocery", qty: 2, checked: false },
  ]);
});

describe("GroceryScreen", () => {
  it("shows the store segmented control with Costco/Grocery/All", async () => {
    render(<GroceryScreen />);
    await waitFor(() => screen.getByText("Eggs"));
    expect(screen.getByRole("button", { name: /costco/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /grocery/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^all$/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/screens/GroceryScreen.test.tsx`
Expected: FAIL — cannot resolve `./GroceryScreen`.

- [ ] **Step 3: Write `frontend/src/screens/GroceryScreen.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { GroceryItem } from "../api/types";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";

type Filter = "costco" | "grocery" | "all";
const STORE_LABEL: Record<string, string> = { costco: "Costco", grocery: "Grocery", either: "Either" };

export function GroceryScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [store, setStore] = useState<"costco" | "grocery" | "either">("either");
  const [ack, setAck] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load() { setItems(await api.get<GroceryItem[]>(`/api/grocery?store=${filter}`)); }
  useEffect(() => { void load(); }, [filter]);

  async function add() {
    if (!name.trim()) return;
    await api.post("/api/grocery", { name: name.trim(), store });
    setName(""); setAck("Added"); await load();
  }
  async function check(i: GroceryItem) {
    await api.post(`/api/grocery/${i.id}/check`, { checked: !i.checked }); await load();
  }
  async function step(i: GroceryItem, d: number) {
    await api.post(`/api/grocery/${i.id}/qty`, { qty: i.qty + d }); await load();
  }
  async function clear() {
    await api.post("/api/grocery/clear-checked"); setConfirmClear(false); setAck("Cleared checked items"); await load();
  }

  // group by store for display; within a group, unchecked first
  const groups = filter === "all"
    ? (["costco", "grocery", "either"] as const).map(s => [STORE_LABEL[s], items.filter(i => i.store === s)] as const)
    : [[STORE_LABEL[filter], items] as const];

  const Seg = ({ id, label }: { id: Filter; label: string }) => (
    <button onClick={() => setFilter(id)}
      className={`flex-1 min-h-touch text-big font-bold rounded-2xl ${filter === id ? "bg-dad text-paper" : "border-4"}`}>
      {label}</button>
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <div className="flex gap-touch"><Seg id="costco" label="Costco" /><Seg id="grocery" label="Grocery" /><Seg id="all" label="All" /></div>
      <div className="flex gap-touch flex-wrap">
        <input className="flex-1 text-big p-4 border-4 rounded-xl" placeholder="Add an item"
               value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <select className="text-big p-4 border-4 rounded-xl" value={store}
                onChange={e => setStore(e.target.value as typeof store)}>
          <option value="either">Either</option><option value="costco">Costco</option><option value="grocery">Grocery</option>
        </select>
        <Button onClick={add} icon={<span aria-hidden>＋</span>}>Add</Button>
      </div>
      {groups.map(([label, list]) => (
        <section key={label}>
          <h3 className="text-big font-bold mb-2">{label}</h3>
          <ul className="flex flex-col gap-3">
            {[...list].sort((a, b) => Number(a.checked) - Number(b.checked)).map(i => (
              <li key={i.id} className={`flex items-center gap-4 border-4 rounded-2xl p-4 ${i.checked ? "opacity-50" : ""}`}>
                <button onClick={() => check(i)} aria-label={i.checked ? "Uncheck" : "Check"}
                  className={`w-14 h-14 rounded-xl border-4 text-huge ${i.checked ? "bg-confirm text-paper" : ""}`}>
                  {i.checked ? "✓" : ""}</button>
                <span className={`flex-1 text-big ${i.checked ? "line-through" : ""}`}>{i.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => step(i, -1)} className="w-12 h-12 border-4 rounded-xl text-big" aria-label="Less">−</button>
                  <span className="text-big w-8 text-center">{i.qty}</span>
                  <button onClick={() => step(i, 1)} className="w-12 h-12 border-4 rounded-xl text-big" aria-label="More">＋</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Button onClick={() => setConfirmClear(true)}>Clear checked</Button>
      <ConfirmDialog open={confirmClear} title="Clear all checked items?"
        confirmLabel="Clear" onConfirm={clear} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Mount in both layouts** (`{tab === "grocery" && <GroceryScreen />}` in each).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/screens/GroceryScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): grocery screen with store toggle, grouping, qty stepper, clear-checked"
```

---

### Task 10: Frontend — Schedule (week agenda + driver roll-up), Birthdays, admin month view

**Files:**
- Create: `frontend/src/screens/Schedule.tsx`, `frontend/src/screens/Birthdays.tsx`,
  `frontend/src/admin/MonthView.tsx`, `frontend/src/admin/AppointmentForm.tsx`
- Modify: `AdminLayout.tsx` (mount schedule + birthdays), `ParentLayout.tsx` (read-only week optional)
- Test: `frontend/src/screens/Schedule.test.tsx`

**Interfaces:**
- Consumes: `/api/week`, `/api/appointments`, `/api/birthdays`, `/api/birthdays/upcoming`, `/api/people`.
- Produces:
  - `<Schedule>` — vertical large agenda for the week (per-day sections), a **Driver roll-up**
    card listing all `needs_ride` runs ("what am I driving to this week"), and (admin/family) an
    `AppointmentForm` to add/edit, responsive down to iPhone width.
  - `<AppointmentForm>` — title, date, start/end time, person (Dad/Mom/Both via `PersonBadge` chips),
    location, `needs_ride` big toggle, notes, monthly-recurrence + day (for the Bank-bills routine).
  - `<Birthdays>` — list + add form (admin/family).
  - `<MonthView>` — admin-only compact month grid (parents never see it).

- [ ] **Step 1: Write the failing test** — `frontend/src/screens/Schedule.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Schedule } from "./Schedule";
import { api } from "../api/client";

vi.mock("../api/client");
beforeEach(() => {
  (api.get as any) = vi.fn().mockImplementation((p: string) => {
    if (p.startsWith("/api/week")) return Promise.resolve({
      week_start: "2026-06-22",
      days: [{ date: "2026-06-22", appointments: [
        { appointment_id: 1, title: "Cardio", start: "2026-06-22T14:00:00", end: null,
          location: "Clinic", person_id: 1, for_both: false, needs_ride: true, notes: null }] }],
      driver_runs: [{ appointment_id: 1, title: "Cardio", start: "2026-06-22T14:00:00", end: null,
        location: "Clinic", person_id: 1, for_both: false, needs_ride: true, notes: null }],
    });
    if (p === "/api/people") return Promise.resolve([{ id: 1, name: "Dad", slug: "dad", color: "#1f6feb" }]);
    return Promise.resolve([]);
  });
});

describe("Schedule", () => {
  it("renders a driver roll-up listing ride-needed runs", async () => {
    render(<Schedule canEdit={false} />);
    await waitFor(() => screen.getByText(/driving this week/i));
    expect(screen.getAllByText(/Cardio/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/screens/Schedule.test.tsx`
Expected: FAIL — cannot resolve `./Schedule`.

- [ ] **Step 3: Write `frontend/src/admin/AppointmentForm.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../lib/people";
import { PersonBadge } from "../components/PersonBadge";
import { Button } from "../components/Button";

export function AppointmentForm({ onSaved }: { onSaved: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [title, setTitle] = useState(""); const [date, setDate] = useState("");
  const [time, setTime] = useState(""); const [location, setLocation] = useState("");
  const [personId, setPersonId] = useState<number | null>(null);
  const [needsRide, setNeedsRide] = useState(false);
  const [monthly, setMonthly] = useState(false);
  useEffect(() => { void api.get<Person[]>("/api/people").then(setPeople); }, []);

  async function save() {
    if (!title || !date || !time) return;
    const start = `${date}T${time}:00`;
    await api.post("/api/appointments", {
      title, start, location: location || null, person_id: personId,
      needs_ride: needsRide, recurrence: monthly ? "monthly" : "none",
      recur_day: monthly ? Number(date.slice(8, 10)) : null,
    });
    setTitle(""); setDate(""); setTime(""); setLocation(""); setNeedsRide(false); setMonthly(false);
    onSaved();
  }
  return (
    <div className="border-4 rounded-2xl p-4 flex flex-col gap-3 max-w-xl">
      <input className="text-big p-3 border-4 rounded-xl" placeholder="What is it?" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="flex gap-touch flex-wrap">
        <input type="date" className="text-big p-3 border-4 rounded-xl" value={date} onChange={e => setDate(e.target.value)} />
        <input type="time" className="text-big p-3 border-4 rounded-xl" value={time} onChange={e => setTime(e.target.value)} />
      </div>
      <input className="text-big p-3 border-4 rounded-xl" placeholder="Location (e.g. Bank)" value={location} onChange={e => setLocation(e.target.value)} />
      <div className="flex gap-touch flex-wrap items-center">
        <button onClick={() => setPersonId(null)} className={`min-h-touch px-4 rounded-xl border-4 text-base ${personId === null ? "bg-dad text-paper" : ""}`}>Both / Family</button>
        {people.map(p => (
          <button key={p.id} onClick={() => setPersonId(p.id)}
            className={`min-h-touch rounded-xl ${personId === p.id ? "ring-4" : ""}`}><PersonBadge person={p} /></button>
        ))}
      </div>
      <label className="text-big flex items-center gap-3">
        <input type="checkbox" className="w-8 h-8" checked={needsRide} onChange={e => setNeedsRide(e.target.checked)} /> 🚗 Needs a ride
      </label>
      <label className="text-big flex items-center gap-3">
        <input type="checkbox" className="w-8 h-8" checked={monthly} onChange={e => setMonthly(e.target.checked)} /> Repeat monthly (e.g. pay bills at the bank)
      </label>
      <Button onClick={save} icon={<span aria-hidden>＋</span>}>Save appointment</Button>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/screens/Schedule.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Occurrence } from "../api/types";
import { formatTime, formatDay } from "../lib/format";
import { AppointmentForm } from "../admin/AppointmentForm";

interface Day { date: string; appointments: Occurrence[]; }
interface Week { week_start: string; days: Day[]; driver_runs: Occurrence[]; }

export function Schedule({ canEdit }: { canEdit: boolean }) {
  const [week, setWeek] = useState<Week | null>(null);
  async function load() { setWeek(await api.get<Week>("/api/week")); }
  useEffect(() => { void load(); }, []);
  if (!week) return <p className="p-6 text-big">Loading schedule…</p>;
  return (
    <div className="p-6 flex flex-col gap-8">
      {week.driver_runs.length > 0 && (
        <section className="border-4 border-dad rounded-2xl p-4">
          <h2 className="text-big font-bold mb-2">🚗 What I'm driving this week</h2>
          {week.driver_runs.map(r => (
            <p key={`${r.appointment_id}-${r.start}`} className="text-big">
              {formatDay(r.start)} · {formatTime(r.start)} — {r.title}{r.location ? ` (${r.location})` : ""}</p>
          ))}
        </section>
      )}
      {canEdit && <AppointmentForm onSaved={load} />}
      {week.days.map(d => (
        <section key={d.date}>
          <h3 className="text-big font-bold mb-2">{formatDay(d.date)}</h3>
          {d.appointments.length === 0 && <p className="text-base opacity-60">—</p>}
          {d.appointments.map(a => (
            <div key={`${a.appointment_id}-${a.start}`} className="border-4 rounded-2xl p-3 mb-2 flex gap-4">
              <span className="text-big font-bold w-24">{formatTime(a.start)}</span>
              <span className="text-big flex-1">{a.title}{a.location ? ` · ${a.location}` : ""}</span>
              {a.needs_ride && <span className="text-base font-bold">🚗 Ride</span>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `frontend/src/screens/Birthdays.tsx` + `frontend/src/admin/MonthView.tsx`**

```tsx
// screens/Birthdays.tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/Button";
interface B { id: number; name: string; month: number; day: number; year: number | null; }
export function Birthdays({ canEdit }: { canEdit: boolean }) {
  const [list, setList] = useState<B[]>([]);
  const [name, setName] = useState(""); const [date, setDate] = useState("");
  async function load() { setList(await api.get<B[]>("/api/birthdays")); }
  useEffect(() => { void load(); }, []);
  async function add() {
    if (!name || !date) return;
    const [, m, d] = date.split("-");
    await api.post("/api/birthdays", { name, month: Number(m), day: Number(d) });
    setName(""); setDate(""); await load();
  }
  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-huge font-bold">Birthdays</h2>
      {canEdit && (
        <div className="flex gap-touch flex-wrap">
          <input className="text-big p-3 border-4 rounded-xl" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input type="date" className="text-big p-3 border-4 rounded-xl" value={date} onChange={e => setDate(e.target.value)} />
          <Button onClick={add} icon={<span aria-hidden>🎂</span>}>Add</Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {list.map(b => <li key={b.id} className="text-big border-4 rounded-xl p-3">🎂 {b.name} — {b.month}/{b.day}</li>)}
      </ul>
    </div>
  );
}
```

```tsx
// admin/MonthView.tsx — admin-only compact grid (parents never see this)
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Occurrence } from "../api/types";
export function MonthView() {
  const [occ, setOcc] = useState<Occurrence[]>([]);
  useEffect(() => {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-28T23:59:59`;
    void api.get<Occurrence[]>(`/api/appointments?start=${start}&end=${end}`).then(setOcc);
  }, []);
  return (
    <div className="p-4">
      <h3 className="text-big font-bold mb-2">Month overview (admin)</h3>
      <ul className="text-base">{occ.map(o => <li key={`${o.appointment_id}-${o.start}`}>{o.start.slice(0,10)} {o.title}</li>)}</ul>
    </div>
  );
}
```

- [ ] **Step 6: Mount in `AdminLayout.tsx`**

Add imports and: `{tab === "schedule" && <><Schedule canEdit /><MonthView /></>}`,
`{tab === "birthdays" && <Birthdays canEdit />}`. (Parent layout may add a read-only
`{tab === ... }` later; not required for v1 parent scope.)

- [ ] **Step 7: Run test + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: test PASS; strict typecheck clean; build OK.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): schedule agenda + driver roll-up, appointment form, birthdays, admin month view"
```

---

### Task 11: Account management (admin) + parent linkage + seed extension

**Files:**
- Create: `backend/app/schemas/account.py`, `backend/app/routers/accounts.py`,
  `frontend/src/admin/Accounts.tsx`
- Modify: `backend/app/main.py`, `backend/app/seed.py`, `AdminLayout.tsx`
- Test: `backend/tests/test_accounts_api.py`

**Interfaces:**
- Consumes: `services.auth.create_user`, `require_role("admin")`, `services.people`.
- Produces:
  - `GET /api/accounts` (admin) → list users (no hashes).
  - `POST /api/accounts` (admin) → create user `{username, password, display_name, role, person_id?}`.
  - `POST /api/accounts/{id}/deactivate` (admin) → set `is_active=False` (never hard-delete others' data).
  - `<Accounts>` admin screen — create family/parent accounts, link a parent to Dad/Mom.
  - Seed extension: a couple of example appointments (incl. the Bank-bills monthly), a few todos,
    grocery items, and Mom's birthday so first open is non-empty.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_accounts_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth
import app.models  # noqa: F401

@pytest.fixture()
def env():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    app.dependency_overrides[get_db] = lambda: TS(); yield TestClient(app)
    app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})

def test_only_admin_manages_accounts(env):
    _login(env, "mom")
    assert env.get("/api/accounts").status_code == 403
    _login(env, "admin")
    assert env.get("/api/accounts").status_code == 200
    r = env.post("/api/accounts", json={"username": "sis", "password": "x",
                 "display_name": "Sister", "role": "family"})
    assert r.status_code == 200
    assert any(u["username"] == "sis" for u in env.get("/api/accounts").json())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_accounts_api.py -v`
Expected: FAIL — no module `app.routers.accounts`.

- [ ] **Step 3: Write `backend/app/schemas/account.py` + `backend/app/routers/accounts.py`**

```python
# schemas/account.py
from pydantic import BaseModel

class AccountIn(BaseModel):
    username: str
    password: str
    display_name: str
    role: str                  # admin | family | parent
    person_id: int | None = None

class AccountOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    person_id: int | None
    is_active: bool
    class Config: from_attributes = True
```

```python
# routers/accounts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_role
from app.models.user import User, ROLES
from app.schemas.account import AccountIn, AccountOut
from app.services import auth

router = APIRouter(prefix="/api/accounts", tags=["accounts"])
_admin = require_role("admin")

@router.get("", response_model=list[AccountOut])
def list_(db: Session = Depends(get_db), _=Depends(_admin)):
    return list(db.scalars(select(User).order_by(User.id)))

@router.post("", response_model=AccountOut)
def create(body: AccountIn, db: Session = Depends(get_db), _=Depends(_admin)):
    if body.role not in ROLES:
        raise HTTPException(422, "Invalid role")
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(409, "Username already exists")
    return auth.create_user(db, username=body.username, password=body.password,
                            display_name=body.display_name, role=body.role, person_id=body.person_id)

@router.post("/{user_id}/deactivate", response_model=AccountOut)
def deactivate(user_id: int, db: Session = Depends(get_db), _=Depends(_admin)):
    u = db.get(User, user_id)
    if u is None: raise HTTPException(404, "User not found")
    u.is_active = False; db.commit(); db.refresh(u)
    return u
```

Wire in `main.py`: `from app.routers import accounts` + `app.include_router(accounts.router)`.

- [ ] **Step 4: Extend `backend/app/seed.py`** — add example content (idempotent guard on count)

```python
# append inside seed(), after people are ensured:
from datetime import datetime, date
from app.services import appointments, todos, grocery, birthdays
from app.models.appointment import Appointment
from sqlalchemy import select as _select

admin = db.scalar(_select(User).where(User.username == s.admin_username))
if db.scalar(_select(Appointment)) is None and admin:
    appointments.create(db, title="Pay bills at bank", start=datetime(2026, 7, 5, 10, 0),
                        location="Bank", recurrence="monthly", recur_day=5, created_by=admin.id)
    appointments.create(db, title="Cardiology follow-up", start=datetime(2026, 7, 9, 14, 0),
                        needs_ride=True, created_by=admin.id)
    todos.add(db, text="Refill Dad's pill pack", created_by=admin.id)
    grocery.add(db, name="Eggs", store="costco", created_by=admin.id)
    grocery.add(db, name="Milk", store="grocery", created_by=admin.id)
    birthdays.add(db, name="Mom", month=6, day=25, year=1941)
```

- [ ] **Step 5: Write `frontend/src/admin/Accounts.tsx`** and mount in `AdminLayout`

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../lib/people";
import { Button } from "../components/Button";
interface Acct { id: number; username: string; display_name: string; role: string;
  person_id: number | null; is_active: boolean; }
export function Accounts() {
  const [accts, setAccts] = useState<Acct[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState({ username: "", password: "", display_name: "", role: "family", person_id: "" });
  async function load() {
    setAccts(await api.get<Acct[]>("/api/accounts"));
    setPeople(await api.get<Person[]>("/api/people"));
  }
  useEffect(() => { void load(); }, []);
  async function create() {
    await api.post("/api/accounts", { ...form,
      person_id: form.role === "parent" && form.person_id ? Number(form.person_id) : null });
    setForm({ username: "", password: "", display_name: "", role: "family", person_id: "" }); await load();
  }
  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-huge font-bold">Accounts</h2>
      <div className="border-4 rounded-2xl p-4 flex flex-col gap-3 max-w-xl">
        <input className="text-big p-3 border-4 rounded-xl" placeholder="Username"
               value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <input className="text-big p-3 border-4 rounded-xl" placeholder="Display name"
               value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
        <input type="password" className="text-big p-3 border-4 rounded-xl" placeholder="Password"
               value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <select className="text-big p-3 border-4 rounded-xl" value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="family">Family</option><option value="parent">Parent</option><option value="admin">Admin</option>
        </select>
        {form.role === "parent" && (
          <select className="text-big p-3 border-4 rounded-xl" value={form.person_id}
                  onChange={e => setForm({ ...form, person_id: e.target.value })}>
            <option value="">Link to…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <Button onClick={create} icon={<span aria-hidden>＋</span>}>Create account</Button>
      </div>
      <ul className="flex flex-col gap-2">
        {accts.map(a => <li key={a.id} className="text-big border-4 rounded-xl p-3">
          {a.display_name} — {a.role}{a.is_active ? "" : " (inactive)"}</li>)}
      </ul>
    </div>
  );
}
```

Mount: in `AdminLayout.tsx` add `{tab === "accounts" && <Accounts />}`.

- [ ] **Step 6: Run tests + build**

Run: `cd backend && pytest -q` and `cd frontend && npx vitest run && npm run build`
Expected: all backend tests PASS; frontend tests PASS; build OK.

- [ ] **Step 7: Migration (no schema change here) + commit**

```bash
git add backend/app/schemas/account.py backend/app/routers/accounts.py backend/app/main.py \
        backend/app/seed.py backend/tests/test_accounts_api.py frontend/src
git commit -m "feat(accounts): admin account management, parent linkage, seeded example content"
```

---

### Task 12: v1 end-to-end verification + README update

**Files:**
- Modify: `README.md`
- (No code; verifies the full v1 across roles + PWA on an iPad-sized viewport.)

- [ ] **Step 1: Rebuild + reseed**

Run: `docker compose up -d --build && docker compose exec api python -m app.seed`
Expected: app serves the built SPA; example content present.

- [ ] **Step 2: Manual smoke across roles** (over Tailscale, iPad mini viewport)

Verify:
- Parent login → lands on **Today** with no navigation; sees Cardiology (ride badge) + Mom's birthday.
- Parent can add/check/delete a to-do and a grocery item; checked items drop to the done/bottom; big visual ✓ banner appears and stays ~6s; cannot see Schedule/Accounts/month.
- Grocery **Costco | Grocery | All** toggle filters/groups; qty stepper works.
- Family login → can add an appointment + birthday; **cannot** open Accounts (403 / hidden).
- Admin login → Schedule shows the driver roll-up; month view visible; can create a family account.
- Font toggle enlarges text and persists after reload (per user).
- Add to iPad home screen → opens standalone full-screen.

- [ ] **Step 3: Update `README.md`** — add a "v1 features" section and the account-roles table.

```markdown
## v1 features
Today screen (default), shared schedule with ride flags + the monthly Bank-bills routine,
a driver roll-up, to-do and grocery (Costco/Grocery/All) lists parents manage themselves,
and birthday reminders. Parent accounts get a simplified Today-first layout; admin/family
add and edit (admin add/edit works on iPhone width too).
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document v1 features and verify end-to-end across roles"
```

---

## Self-Review

**Spec coverage (v1):**
- Today-first, huge, no-nav for parents → Task 7 `ParentLayout` defaults to `<Today>`.
- Appointments w/ all fields, **ride flag**, distinct ride surfacing → Tasks 1–2, 6, 7, 10.
- **Bank-bills monthly recurring** as first-class scheduled item → Task 1 recurrence + Task 10 form toggle + Task 11 seed.
- Today / This-Week agenda / admin-only month → Tasks 6, 7, 10 (`MonthView` admin-only).
- Driver roll-up ("what am I driving this week") → Task 6 `week_rollup.driver_runs` + Task 10 card.
- To-do: parent CRUD, big checks, done area not deleted, optional assignee → Tasks 3, 8.
- Grocery: parent CRUD, store tag, **Costco/Grocery/All** toggle, group headers, clear-checked, qty stepper → Tasks 4, 9.
- Birthdays entity + upcoming surface on Today → Tasks 5, 6, 7, 10.
- Roles enforced server-side (family vs parent vs admin) → `require_role` in Tasks 2, 5, 11; tests assert 403s.
- Parent = distinct layout, not hidden buttons → Task 7 separate `ParentLayout`.
- Admin add/edit responsive to iPhone width → Task 10 `AppointmentForm` (flex-wrap, no fixed widths).
- Visual confirmation (banner ≥6s, never toast); big confirm modals; never color-alone → Task 7 components, used throughout.
- Seed non-empty first open → Task 11.

**Placeholder scan:** none. Screens are mounted as they're built; the only forward references
(`TodoScreen`/`GroceryScreen` slots in Task 7 layouts) are filled in Tasks 8–9, explicitly noted.

**Type consistency:** `Occurrence` fields identical across `OccurrenceOut` (Py) and `types.ts` (TS).
Service signatures (`appointments.create(..., created_by=)`, `todos.set_done`, `grocery.set_checked`,
`grocery.clear_checked`, `birthdays.upcoming`) match their router callers and the names Plan 03 will
import. `store` values `costco|grocery|either` consistent model→schema→UI; filter adds `all`/`None`.

**Carried to Plan 02 (correctly out of scope):** medications + BP. **Plan 03:** MCP wraps these
exact service functions.
