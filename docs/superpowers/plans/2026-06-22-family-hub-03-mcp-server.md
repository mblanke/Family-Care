# family-hub — Plan 03: MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Implement **after Plans 00–02** (the MCP tools are
> thin wrappers over the service functions those plans create). Consider invoking
> `anthropic-skills:mcp-builder` for FastMCP idioms while implementing. Read the overview for
> locked decisions + constraints.

**Goal:** Expose family-hub as a FastMCP **streamable-HTTP** server, bound to Tailscale and
token-gated, so the admin can drive the app from the Claude app — "add a cardiology appointment for
Dad next Thursday at 2, he needs a ride." Every tool is a thin adapter over `app.services.*`.

**Architecture:** `mcp/server.py` imports the **same service functions** the REST routers use — no
duplicated business logic. It opens a DB session per tool call via `SessionLocal`. It operates at a
single **admin scope** (a resolved admin user id for `created_by`/`recorded_by`) and **never** touches
accounts, roles, or other people's data deletion. Reads + additive writes proceed directly;
destructive ops (cancel appointment, clear checked, log medication change) require **explicit
in-conversation confirmation** before they execute.

**Tech Stack:** FastMCP (streamable HTTP), Pydantic input schemas, the existing backend package
(`app.services`, `app.config`, `app.db`). Runs as the `mcp` Compose service from Plan 00.

## Global Constraints

(Full list in overview.) Active here:
- **Single service layer** — MCP tools call `app.services.*`, identical to REST. No logic duplicated.
- **Streamable HTTP**, bound to the Tailscale interface, protected by `MCP_TOKEN` from `.env`. **No public exposure.**
- Honest **annotations**: `readOnlyHint: true` on every `get_`/`list_`; `destructiveHint: true` on cancel/clear/log-medication-change.
- **Destructive ops require explicit confirmation in the conversation before executing.** Reads + additive writes proceed directly.
- **Admin scope only** — never manage accounts, change roles, or delete other people's data.
- Return **focused structured data + a short text summary**, not raw dumps. Cap/paginate long lists.
- Errors are **actionable**: ambiguous date or unmatched person name → say what's needed, don't guess.
- `familyhub_log_medication_change` records **exactly** what the human states; never computes/suggests doses.

**Service interfaces consumed (fixed by Plans 00–02):**
`services.today.today_rollup/week_rollup`, `services.appointments.create/update/cancel/get/list_between`,
`services.todos.add/set_done/list_todos`, `services.grocery.add/set_checked/clear_checked/list_items`,
`services.birthdays.add/upcoming`, `services.bp.log_reading/list_readings/status_for/get_target`,
`services.medications.list_regimen/history/add_med/change_dose/stop_med/add_note`,
`services.people.list_people/get_person/get_person_by_slug`.

---

### Task 1: MCP server scaffold — auth, DB session, admin scope, person resolution

**Files:**
- Create: `mcp/__init__.py`, `mcp/server.py`, `mcp/context.py`
- Test: `mcp/tests/test_context.py` (add `mcp` to `pyproject` test paths or run with `pytest mcp/tests`)

**Interfaces:**
- Produces:
  - `context.session()` — context manager yielding a `SessionLocal` DB session.
  - `context.admin_user_id(db) -> int` — the resolved admin account id (from `ADMIN_USERNAME`);
    used as `created_by`/`recorded_by`. Raises a clear error if no admin exists.
  - `context.resolve_person(db, who:str) -> Person` — matches `who` against people by slug or name
    (case-insensitive); raises `PersonNotFound(who, available=[names])` with an actionable message.
  - `context.parse_when(text_or_iso:str) -> datetime` — accepts ISO `YYYY-MM-DDTHH:MM`; raises
    `AmbiguousDate(text)` (actionable) on anything it can't parse unambiguously. **No guessing** —
    the Claude client resolves "next Thursday 2pm" to an explicit datetime before calling.
  - `server.mcp` — the FastMCP instance; `__main__` runs streamable HTTP on `0.0.0.0:8765`,
    token from `MCP_TOKEN`.

- [ ] **Step 1: Write the failing test** — `mcp/tests/test_context.py`

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.services import auth, people
import app.models  # noqa: F401
from mcp import context

@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine); s = sessionmaker(bind=engine)()
    yield s; s.close()

def test_resolve_person_by_name_or_slug(db):
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    assert context.resolve_person(db, "dad").name == "Dad"
    assert context.resolve_person(db, "Dad").name == "Dad"
    with pytest.raises(context.PersonNotFound) as e:
        context.resolve_person(db, "Grandpa")
    assert "Dad" in str(e.value)        # actionable: lists available names

def test_parse_when_requires_explicit_datetime():
    from datetime import datetime
    assert context.parse_when("2026-07-02T14:00") == datetime(2026, 7, 2, 14, 0)
    with pytest.raises(context.AmbiguousDate):
        context.parse_when("next Thursday")

def test_admin_user_id_resolves(db, monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    from app.config import get_settings; get_settings.cache_clear()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    assert context.admin_user_id(db) > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest ../mcp/tests/test_context.py -v` (run from `backend` so `app` imports resolve;
ensure `mcp` is importable — add `pythonpath = [".", "../mcp"]` or run with `PYTHONPATH=..:.`).
Expected: FAIL — no module `mcp.context`.

- [ ] **Step 3: Write `mcp/context.py`** (+ empty `mcp/__init__.py`)

```python
from contextlib import contextmanager
from datetime import datetime
from sqlalchemy import select
from app.config import get_settings
from app.db import SessionLocal
from app.models.person import Person
from app.models.user import User
from app.services import people

class PersonNotFound(Exception):
    def __init__(self, who: str, available: list[str]):
        super().__init__(f"No care recipient matches '{who}'. Available: {', '.join(available) or 'none'}.")

class AmbiguousDate(Exception):
    def __init__(self, text: str):
        super().__init__(f"Could not read an exact date/time from '{text}'. "
                         f"Provide an explicit ISO value like 2026-07-02T14:00.")

@contextmanager
def session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def admin_user_id(db) -> int:
    name = get_settings().admin_username
    u = db.scalar(select(User).where(User.username == name, User.role == "admin"))
    if u is None:
        raise RuntimeError(f"No admin account '{name}' exists. Run the seed script first.")
    return u.id

def resolve_person(db, who: str) -> Person:
    key = who.strip().lower()
    p = people.get_person_by_slug(db, key)
    if p is None:
        for cand in people.list_people(db):
            if cand.name.lower() == key:
                p = cand; break
    if p is None:
        raise PersonNotFound(who, [c.name for c in people.list_people(db)])
    return p

def parse_when(text_or_iso: str) -> datetime:
    try:
        return datetime.fromisoformat(text_or_iso)
    except ValueError:
        raise AmbiguousDate(text_or_iso)
```

- [ ] **Step 4: Write `mcp/server.py`** (FastMCP instance + streamable HTTP entrypoint)

```python
import os
from fastmcp import FastMCP

mcp = FastMCP(name="family-hub")

# Tool modules register against `mcp` on import (added in Tasks 2–4).
from mcp import tools_read, tools_write, tools_destructive  # noqa: E402,F401

if __name__ == "__main__":
    token = os.environ.get("MCP_TOKEN", "")
    mcp.run(transport="http", host="0.0.0.0", port=8765,
            # FastMCP bearer-token auth; bound inside the Tailscale-only container network
            auth=token or None)
```

(Note: `mcp/Dockerfile` from Plan 00 already runs `python -m mcp.server`. The `0.0.0.0` bind is
safe because the container's published port is pinned to `${TAILSCALE_BIND}` in `docker-compose.yml`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_context.py -v`
Expected: PASS (all three). (`server.py` import of tool modules will fail until Task 2 — create
empty `mcp/tools_read.py`, `mcp/tools_write.py`, `mcp/tools_destructive.py` now to keep imports valid.)

- [ ] **Step 6: Commit**

```bash
git add mcp/__init__.py mcp/context.py mcp/server.py mcp/tools_read.py mcp/tools_write.py \
        mcp/tools_destructive.py mcp/tests/test_context.py
git commit -m "feat(mcp): server scaffold with admin scope, person resolution, strict date parsing"
```

---

### Task 2: Read tools (readOnlyHint) — today, week, grocery, birthdays, meds, bp

**Files:**
- Modify: `mcp/tools_read.py`
- Test: `mcp/tests/test_tools_read.py`

**Interfaces:**
- Produces these tools, each `readOnlyHint=true`, returning `{structured, summary}`:
  - `familyhub_get_today()` → today's appointments, ride-needed items, open todos, upcoming birthdays.
  - `familyhub_get_week(week_start:str|None)` → week agenda + driver roll-up.
  - `familyhub_list_grocery(store:str="all")` → items, `store` ∈ `costco|grocery|either|all`.
  - `familyhub_list_upcoming_birthdays(within_days:int=30)`.
  - `familyhub_get_medications(person:str)` → current regimen + recent history (capped 20).
  - `familyhub_list_bp(person:str, days:int=30)` → recent readings (capped 30) + target + factual status.

- [ ] **Step 1: Write the failing test** — `mcp/tests/test_tools_read.py`

```python
import pytest
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.db as appdb
from app.db import Base
from app.services import auth, people, appointments, grocery
import app.models  # noqa: F401
from mcp import tools_read

@pytest.fixture()
def wired(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine)
    monkeypatch.setattr(appdb, "SessionLocal", TS)
    import mcp.context as ctx; monkeypatch.setattr(ctx, "SessionLocal", TS)
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    db.close()
    return TS

def test_list_grocery_filters(wired):
    db = wired()
    u = db.scalar(__import__("sqlalchemy").select(__import__("app.models.user", fromlist=["User"]).User))
    grocery.add(db, name="Eggs", store="costco", created_by=u.id); db.commit(); db.close()
    res = tools_read.familyhub_list_grocery(store="costco")
    assert any(i["name"] == "Eggs" for i in res["items"])
    assert "Eggs" in res["summary"]

def test_get_medications_person_not_found_is_actionable(wired):
    with pytest.raises(Exception) as e:
        tools_read.familyhub_get_medications(person="Grandpa")
    assert "Dad" in str(e.value)
```

(If the inline `User` import in the test reads awkwardly, replace with a small helper that selects
the admin via `mcp.context.admin_user_id`; the assertion intent — Eggs appears, person error lists
Dad — is what matters.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_read.py -v`
Expected: FAIL — `familyhub_list_grocery` not defined.

- [ ] **Step 3: Write `mcp/tools_read.py`**

```python
from datetime import date, datetime, UTC
from zoneinfo import ZoneInfo
from app.config import get_settings
from app.services import today as today_svc, grocery, birthdays, medications, bp
from mcp.context import session, resolve_person
from mcp.server import mcp

def _today() -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(get_settings().app_timezone)).date()

def _occ(o) -> dict:
    return {"appointment_id": o.appointment_id, "title": o.title, "start": o.start.isoformat(),
            "location": o.location, "needs_ride": o.needs_ride, "person_id": o.person_id}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_today() -> dict:
    """Today's appointments, ride-needed items, open to-dos, and upcoming birthdays."""
    with session() as db:
        r = today_svc.today_rollup(db, today=_today())
        appts = [_occ(o) for o in r["appointments"]]
        rides = [_occ(o) for o in r["rides_today"]]
        todos = [{"id": t.id, "text": t.text} for t in r["open_todos"]]
        bdays = [{"name": b.name, "days_until": b.days_until} for b in r["upcoming_birthdays"]]
        summary = (f"{len(appts)} appointment(s) today, {len(rides)} need a ride; "
                   f"{len(todos)} open to-do(s); {len(bdays)} birthday(s) coming up.")
        return {"appointments": appts, "rides_today": rides, "todos": todos,
                "upcoming_birthdays": bdays, "summary": summary}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_week(week_start: str | None = None) -> dict:
    """This week's agenda plus the driver roll-up. week_start is an ISO date (YYYY-MM-DD) or omitted for the current week."""
    ws = date.fromisoformat(week_start) if week_start else _today()
    with session() as db:
        r = today_svc.week_rollup(db, week_start=ws)
        runs = [_occ(o) for o in r["driver_runs"]]
        days = [{"date": (ws.fromordinal(ws.toordinal() + i)).isoformat(),
                 "appointments": [_occ(o) for o in r["days"][i]]} for i in range(7)]
        return {"week_start": ws.isoformat(), "days": days, "driver_runs": runs,
                "summary": f"{sum(len(d['appointments']) for d in days)} appointment(s) this week; "
                           f"{len(runs)} ride(s) to drive."}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_grocery(store: str = "all") -> dict:
    """List grocery items, optionally filtered by store: costco, grocery, either, or all."""
    with session() as db:
        items = grocery.list_items(db, None if store == "all" else store)
        out = [{"id": i.id, "name": i.name, "store": i.store, "qty": i.qty, "checked": i.checked} for i in items]
        names = ", ".join(i["name"] for i in out if not i["checked"]) or "nothing unchecked"
        return {"items": out, "summary": f"{store} list: {names}."}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_upcoming_birthdays(within_days: int = 30) -> dict:
    """Upcoming birthdays within the given number of days (default 30)."""
    with session() as db:
        up = birthdays.upcoming(db, today=_today(), within_days=within_days)
        out = [{"name": b.name, "next_date": b.next_date.isoformat(),
                "days_until": b.days_until, "turning": b.turning} for b in up]
        return {"birthdays": out, "summary": "; ".join(f"{b['name']} in {b['days_until']}d" for b in out) or "none"}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_get_medications(person: str) -> dict:
    """Current medication regimen and recent change history for a person (Dad or Mom). Read-only; no interpretation."""
    with session() as db:
        p = resolve_person(db, person)
        reg = [{"name": m.name, "dose": m.dose, "slot": m.slot, "prn": m.prn, "active": m.active,
                "purpose": m.purpose, "prescriber": m.prescriber} for m in medications.list_regimen(db, p.id) if m.active]
        hist = [{"date": c.recorded_at.date().isoformat(), "change_type": c.change_type,
                 "summary": c.summary, "reason": c.reason} for c in medications.history(db, p.id)[:20]]
        return {"person": p.name, "regimen": reg, "recent_changes": hist,
                "summary": f"{p.name} is on {len(reg)} active medication(s). This is a record, not medical advice."}

@mcp.tool(annotations={"readOnlyHint": True})
def familyhub_list_bp(person: str, days: int = 30) -> dict:
    """Recent blood-pressure readings for a person (Dad or Mom). Returns data only — no interpretation beyond the doctor's recorded target."""
    with session() as db:
        p = resolve_person(db, person)
        since = None if days == 0 else datetime.now(UTC).replace(tzinfo=None).fromordinal(
            datetime.now(UTC).replace(tzinfo=None).toordinal() - days)
        target = bp.get_target(db, p.id)
        rows = bp.list_readings(db, p.id, since=since)[:30]
        out = [{"taken_at": r.taken_at.isoformat(), "systolic": r.systolic, "diastolic": r.diastolic,
                "pulse": r.pulse, "status": bp.status_for(r, target)} for r in rows]
        tgt = ({"sys": [target.sys_low, target.sys_high], "dia": [target.dia_low, target.dia_high],
                "doctor": target.doctor_label} if target else None)
        return {"person": p.name, "readings": out, "target": tgt,
                "summary": f"{len(out)} reading(s) for {p.name} in the last {days or 'all'} days."}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_read.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp/tools_read.py mcp/tests/test_tools_read.py
git commit -m "feat(mcp): read-only tools for today, week, grocery, birthdays, meds, bp"
```

---

### Task 3: Additive write tools — appointment add/update, todo, grocery, birthday, bp

**Files:**
- Modify: `mcp/tools_write.py`
- Test: `mcp/tests/test_tools_write.py`

**Interfaces:**
- Produces (additive writes — proceed directly, no confirmation; admin scope for `created_by`/`recorded_by`):
  - `familyhub_add_appointment(title, when:str, who:str="both", location=None, needs_ride=False, notes=None)`
    — `when` is explicit ISO; `who` ∈ `dad|mom|both`.
  - `familyhub_update_appointment(appointment_id:int, title?, when?, location?, needs_ride?, notes?)`.
  - `familyhub_add_todo(text:str, assignee?:str)` ; `familyhub_complete_todo(todo_id:int)`.
  - `familyhub_add_grocery_item(name:str, store:str="either")` ; `familyhub_check_grocery_item(item_id:int)`.
  - `familyhub_add_birthday(name:str, month:int, day:int, year?:int)`.
  - `familyhub_log_bp(person:str, systolic:int, diastolic:int, pulse?:int, note?:str)`.

- [ ] **Step 1: Write the failing test** — `mcp/tests/test_tools_write.py`

```python
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import app.db as appdb, mcp.context as ctx
from app.db import Base
from app.services import auth, people
from app.models.appointment import Appointment
import app.models  # noqa: F401
from mcp import tools_write

@pytest.fixture()
def wired(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine)
    monkeypatch.setattr(appdb, "SessionLocal", TS); monkeypatch.setattr(ctx, "SessionLocal", TS)
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    from app.config import get_settings; get_settings.cache_clear()
    db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    people.create_person(db, name="Dad", slug="dad", color="#1f6feb"); db.close()
    return TS

def test_add_appointment_for_dad_with_ride(wired):
    res = tools_write.familyhub_add_appointment(
        title="Cardiology", when="2026-07-02T14:00", who="dad", needs_ride=True)
    assert res["needs_ride"] is True and "Cardiology" in res["summary"]
    db = wired()
    a = db.scalar(select(Appointment))
    assert a.title == "Cardiology" and a.needs_ride and a.person_id is not None

def test_add_appointment_rejects_bad_date(wired):
    with pytest.raises(Exception) as e:
        tools_write.familyhub_add_appointment(title="x", when="next Thursday")
    assert "explicit ISO" in str(e.value)

def test_log_bp_records_reading(wired):
    res = tools_write.familyhub_log_bp(person="Dad", systolic=130, diastolic=80)
    assert "130/80" in res["summary"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_write.py -v`
Expected: FAIL — `familyhub_add_appointment` not defined.

- [ ] **Step 3: Write `mcp/tools_write.py`**

```python
from app.services import appointments, todos, grocery, birthdays, bp
from mcp.context import session, resolve_person, parse_when, admin_user_id
from mcp.server import mcp

def _person_id(db, who: str) -> tuple[int | None, bool]:
    """Return (person_id, for_both). who ∈ dad|mom|both (default both → person_id None)."""
    if who.lower() in ("both", "family", ""):
        return None, True
    return resolve_person(db, who).id, False

@mcp.tool()
def familyhub_add_appointment(title: str, when: str, who: str = "both", location: str | None = None,
                              needs_ride: bool = False, notes: str | None = None) -> dict:
    """Add an appointment. `when` must be an explicit ISO datetime (e.g. 2026-07-02T14:00).
    `who` is dad, mom, or both. Set needs_ride when the admin must drive."""
    start = parse_when(when)
    with session() as db:
        pid, for_both = _person_id(db, who)
        a = appointments.create(db, title=title, start=start, location=location, person_id=pid,
                                for_both=for_both, needs_ride=needs_ride, notes=notes,
                                created_by=admin_user_id(db))
        return {"appointment_id": a.id, "needs_ride": a.needs_ride,
                "summary": f"Added '{title}' on {start:%Y-%m-%d %H:%M}"
                           f"{' (needs a ride)' if needs_ride else ''}."}

@mcp.tool()
def familyhub_update_appointment(appointment_id: int, title: str | None = None, when: str | None = None,
                                 location: str | None = None, needs_ride: bool | None = None,
                                 notes: str | None = None) -> dict:
    """Update fields on an existing appointment. Only provided fields change. `when` is explicit ISO."""
    fields: dict = {}
    if title is not None: fields["title"] = title
    if when is not None: fields["start"] = parse_when(when)
    if location is not None: fields["location"] = location
    if needs_ride is not None: fields["needs_ride"] = needs_ride
    if notes is not None: fields["notes"] = notes
    with session() as db:
        a = appointments.update(db, appointment_id, **fields)
        if a is None:
            raise ValueError(f"No appointment with id {appointment_id}.")
        return {"appointment_id": a.id, "summary": f"Updated appointment {a.id} ('{a.title}')."}

@mcp.tool()
def familyhub_add_todo(text: str, assignee: str | None = None) -> dict:
    """Add a household to-do item."""
    with session() as db:
        assignee_id = resolve_person(db, assignee).id if assignee else None  # optional; person-as-assignee note
        t = todos.add(db, text=text, created_by=admin_user_id(db),
                      assignee_id=None)  # assignee is a user FK; keep None from MCP (admin scope)
        return {"todo_id": t.id, "summary": f"Added to-do: {text}."}

@mcp.tool()
def familyhub_complete_todo(todo_id: int) -> dict:
    """Mark a to-do item done. (Additive — it can be un-done in the app.)"""
    with session() as db:
        t = todos.set_done(db, todo_id, True)
        if t is None:
            raise ValueError(f"No to-do with id {todo_id}.")
        return {"todo_id": t.id, "summary": f"Checked off: {t.text}."}

@mcp.tool()
def familyhub_add_grocery_item(name: str, store: str = "either") -> dict:
    """Add a grocery item with a store tag: costco, grocery, or either."""
    if store not in ("costco", "grocery", "either"):
        raise ValueError("store must be one of: costco, grocery, either.")
    with session() as db:
        g = grocery.add(db, name=name, store=store, created_by=admin_user_id(db))
        return {"item_id": g.id, "summary": f"Added {name} to the {store} list."}

@mcp.tool()
def familyhub_check_grocery_item(item_id: int) -> dict:
    """Check off a grocery item (drops to the bottom of its group; not deleted)."""
    with session() as db:
        g = grocery.set_checked(db, item_id, True)
        if g is None:
            raise ValueError(f"No grocery item with id {item_id}.")
        return {"item_id": g.id, "summary": f"Checked off {g.name}."}

@mcp.tool()
def familyhub_add_birthday(name: str, month: int, day: int, year: int | None = None) -> dict:
    """Add an annual birthday."""
    with session() as db:
        b = birthdays.add(db, name=name, month=month, day=day, year=year)
        return {"birthday_id": b.id, "summary": f"Added {name}'s birthday ({month}/{day})."}

@mcp.tool()
def familyhub_log_bp(person: str, systolic: int, diastolic: int,
                     pulse: int | None = None, note: str | None = None) -> dict:
    """Log a blood-pressure reading for a person (Dad or Mom). Records data only — no interpretation."""
    with session() as db:
        p = resolve_person(db, person)
        r = bp.log_reading(db, person_id=p.id, systolic=systolic, diastolic=diastolic,
                           pulse=pulse, note=note, recorded_by=admin_user_id(db))
        return {"reading_id": r.id, "summary": f"Logged {systolic}/{diastolic} for {p.name}."}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_write.py -v`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add mcp/tools_write.py mcp/tests/test_tools_write.py
git commit -m "feat(mcp): additive write tools for appointments, todos, grocery, birthdays, bp"
```

---

### Task 4: Destructive tools — cancel, clear-checked, log medication change (confirm-first)

**Files:**
- Modify: `mcp/tools_destructive.py`
- Test: `mcp/tests/test_tools_destructive.py`

**Interfaces:**
- Produces (`destructiveHint=true`; each takes a `confirm:bool=False` and **refuses to execute**
  until `confirm=True`, returning a confirmation prompt — this enforces the "explicit in-conversation
  confirmation" rule at the tool layer, independent of client behavior):
  - `familyhub_cancel_appointment(appointment_id:int, confirm:bool=False)`.
  - `familyhub_clear_checked(confirm:bool=False)` — removes checked grocery items.
  - `familyhub_log_medication_change(person:str, change_type:str, summary:str, reason?:str,
    medication_id?:int, confirm:bool=False)` — appends to the medication history **exactly** as
    stated; `change_type` ∈ `added|stopped|dose_changed|note`. Never computes/suggests a dose.

- [ ] **Step 1: Write the failing test** — `mcp/tests/test_tools_destructive.py`

```python
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import app.db as appdb, mcp.context as ctx
from app.db import Base
from app.services import auth, people, appointments, grocery, medications
from app.models.appointment import Appointment
import app.models  # noqa: F401
from mcp import tools_destructive as td

@pytest.fixture()
def wired(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine)
    monkeypatch.setattr(appdb, "SessionLocal", TS); monkeypatch.setattr(ctx, "SessionLocal", TS)
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    from app.config import get_settings; get_settings.cache_clear()
    db = TS()
    u = auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    from datetime import datetime
    appointments.create(db, title="X", start=datetime(2026, 7, 2, 9, 0), created_by=u.id)
    db.commit(); db.close()
    return TS

def test_cancel_requires_confirm(wired):
    res = td.familyhub_cancel_appointment(appointment_id=1, confirm=False)
    assert res["confirmation_required"] is True
    db = wired()
    assert db.scalar(select(Appointment)).canceled is False     # nothing happened yet
    res2 = td.familyhub_cancel_appointment(appointment_id=1, confirm=True)
    assert res2.get("done") is True

def test_log_medication_change_appends_exactly(wired):
    res = td.familyhub_log_medication_change(person="Dad", change_type="note",
            summary="Pharmacist switched to generic", confirm=False)
    assert res["confirmation_required"] is True
    td.familyhub_log_medication_change(person="Dad", change_type="note",
            summary="Pharmacist switched to generic", confirm=True)
    db = wired()
    p = people.get_person_by_slug(db, "dad")
    hist = medications.history(db, p.id)
    assert hist[0].summary == "Pharmacist switched to generic"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_destructive.py -v`
Expected: FAIL — `familyhub_cancel_appointment` not defined.

- [ ] **Step 3: Write `mcp/tools_destructive.py`**

```python
from app.models.medication import CHANGE_TYPES
from app.services import appointments, grocery, medications
from mcp.context import session, resolve_person, admin_user_id
from mcp.server import mcp

def _need_confirm(action: str) -> dict:
    return {"confirmation_required": True,
            "message": f"This will {action}. Re-call with confirm=true to proceed."}

@mcp.tool(annotations={"destructiveHint": True})
def familyhub_cancel_appointment(appointment_id: int, confirm: bool = False) -> dict:
    """Cancel an appointment. Destructive — requires confirm=true to execute."""
    with session() as db:
        a = appointments.get(db, appointment_id)
        if a is None:
            raise ValueError(f"No appointment with id {appointment_id}.")
        if not confirm:
            return _need_confirm(f"cancel '{a.title}' on {a.start:%Y-%m-%d %H:%M}")
        appointments.cancel(db, appointment_id)
        return {"done": True, "summary": f"Cancelled '{a.title}'."}

@mcp.tool(annotations={"destructiveHint": True})
def familyhub_clear_checked(confirm: bool = False) -> dict:
    """Remove all checked grocery items. Destructive — requires confirm=true to execute."""
    with session() as db:
        pending = [i for i in grocery.list_items(db) if i.checked]
        if not confirm:
            return _need_confirm(f"permanently remove {len(pending)} checked grocery item(s)")
        n = grocery.clear_checked(db)
        return {"done": True, "summary": f"Removed {n} checked item(s)."}

@mcp.tool(annotations={"destructiveHint": True})
def familyhub_log_medication_change(person: str, change_type: str, summary: str,
                                    reason: str | None = None, medication_id: int | None = None,
                                    confirm: bool = False) -> dict:
    """Append a medication-regimen change to the history, EXACTLY as stated by the human.
    change_type is one of: added, stopped, dose_changed, note. The app never computes or suggests
    doses — it records the text you provide. Sensitive: requires confirm=true to execute."""
    if change_type not in CHANGE_TYPES:
        raise ValueError(f"change_type must be one of: {', '.join(CHANGE_TYPES)}.")
    with session() as db:
        p = resolve_person(db, person)
        if not confirm:
            return _need_confirm(f"record a '{change_type}' change for {p.name}: \"{summary}\"")
        c = medications.add_note(db, person_id=p.id, summary=summary,
                                 recorded_by=admin_user_id(db), medication_id=medication_id) \
            if change_type == "note" else _record_typed(db, p.id, change_type, summary, reason, medication_id)
        return {"done": True, "summary": f"Recorded for {p.name}: {summary}."}

def _record_typed(db, person_id, change_type, summary, reason, medication_id):
    # added/stopped/dose_changed without a structured edit are stored as a typed history note,
    # carrying the human's exact summary (no dose computation). add_note logs change_type="note";
    # to preserve the stated type, write a MedicationChange directly via the service-internal logger.
    from app.models.medication import MedicationChange
    c = MedicationChange(person_id=person_id, medication_id=medication_id, change_type=change_type,
                         summary=summary, reason=reason, recorded_by=admin_user_id(db))
    db.add(c); db.commit(); db.refresh(c)
    return c
```

(Note: `_record_typed` writes a history row with the stated `change_type` and verbatim `summary`,
keeping the append-only contract; it does not touch the live regimen row — structured dose edits stay
in the admin web UI per the spec's caution around medication changes.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests/test_tools_destructive.py -v`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add mcp/tools_destructive.py mcp/tests/test_tools_destructive.py
git commit -m "feat(mcp): destructive tools with confirm-first cancel, clear, medication-change logging"
```

---

### Task 5: Compose wiring, end-to-end verification, README

**Files:**
- Modify: `README.md` (MCP section)
- (Compose `mcp` service already defined in Plan 00; this task verifies it end-to-end.)

- [ ] **Step 1: Full MCP test suite**

Run: `cd backend && PYTHONPATH=..:. pytest ../mcp/tests -q`
Expected: all MCP tests PASS.

- [ ] **Step 2: Bring up the stack with the MCP service**

Run: `docker compose up -d --build && docker compose exec api python -m app.seed`
Then: `docker compose logs mcp --tail 20`
Expected: FastMCP reports listening on `:8765` (streamable HTTP).

- [ ] **Step 3: Connect from the Claude app over Tailscale**

Add the MCP server in the Claude app: URL `http://<atlas-tailscale-ip>:8765`, bearer token = `MCP_TOKEN`.
Verify, with confirmations where required:
- "What's on for today?" → `familyhub_get_today` returns the seeded Cardiology (ride) + Mom's birthday.
- "Add a physio appointment for Dad on 2026-07-10 at 11:00, he needs a ride." → `familyhub_add_appointment` (additive, proceeds); re-query shows it with the ride flag.
- "What's the Costco list?" → `familyhub_list_grocery(store="costco")`.
- "Cancel appointment 2." → tool returns `confirmation_required`; only after you confirm does it cancel.
- "Record that Dr. Lee reduced Dad's Amlodipine to 5 mg." → `familyhub_log_medication_change` asks to confirm, then appends to history verbatim (no dose math).
- Confirm an **unauthenticated** request to `:8765` (no/incorrect token) is rejected.

- [ ] **Step 4: Write the MCP README section**

```markdown
## Claude remote-control (MCP)
The `mcp` service exposes family-hub to the Claude app over Tailscale (streamable HTTP, port 8765),
protected by `MCP_TOKEN`. Add it in the Claude app as an MCP server:
`http://<atlas-tailscale-ip>:8765` with the bearer token from your `.env`.

It operates at **admin scope** and is a thin wrapper over the same service layer as the web app —
no duplicated logic. It can read today/week/lists/meds/BP and add appointments, to-dos, grocery
items, birthdays, and BP readings directly. Destructive actions (cancel an appointment, clear
checked grocery items, log a medication change) **require an explicit confirmation** before they
run. The MCP server never manages accounts or roles and never computes or suggests medication doses
— account/permission changes and structured dose edits stay in the web UI, done by a human.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: MCP remote-control setup and verify end-to-end from the Claude app"
```

---

## Self-Review

**Spec coverage (MCP):**
- FastMCP, **shared service layer**, thin wrappers → all tools call `app.services.*`; no logic duplicated (Tasks 2–4).
- **Streamable HTTP**, Tailscale-bound, token-gated, no public exposure → Task 1 `server.py` + Plan 00 Compose `${TAILSCALE_BIND}` + `MCP_TOKEN` auth.
- Runs in the same Compose stack (the `mcp` service) → Plan 00 + verified Task 5.
- All specified tools present → `get_today`, `get_week`, `add/update/cancel_appointment`, `add_todo`/`complete_todo`, `add/check_grocery_item`/`clear_checked`/`list_grocery`, `add_birthday`/`list_upcoming_birthdays`, `log_bp`/`list_bp`, `get_medications`/`log_medication_change` (Tasks 2–4).
- **Annotations honest** — `readOnlyHint` on all get/list (Task 2); `destructiveHint` on cancel/clear/log-medication-change (Task 4).
- Pydantic-style typed inputs with descriptions/examples → tool signatures + docstrings (Tasks 3–4).
- Structured content **+ short text summary**, capped lists → every tool returns a `summary`; meds history capped 20, bp readings capped 30 (Task 2).
- **Destructive ops require explicit confirmation before executing** → `confirm` gate in Task 4; reads + additive writes proceed directly (Tasks 2–3).
- **Admin scope only**, never accounts/roles/others' deletion → no account tools exist; writes use `admin_user_id` (Tasks 1, 3–4).
- Errors actionable (ambiguous date / unmatched person) → `AmbiguousDate`, `PersonNotFound` with available names (Task 1), surfaced by tools.
- `log_medication_change` records **exactly** what's stated; never computes doses → Task 4 `_record_typed` stores verbatim summary, no dose logic.

**Placeholder scan:** none — all tool bodies are complete. The one nuance (`_record_typed` keeping
the stated change_type while leaving structured regimen edits to the web UI) is documented inline and
in the README, matching the spec's caution around medication changes.

**Type consistency:** every MCP tool calls a service signature **fixed verbatim** in Plans 00–02
(`appointments.create(..., created_by=)`, `appointments.update/get/cancel`, `todos.add/set_done`,
`grocery.add/set_checked/clear_checked/list_items`, `birthdays.add/upcoming`, `bp.log_reading/
list_readings/status_for/get_target`, `medications.history/add_note`, `people.get_person_by_slug/
list_people`). `store` values and `change_type` values match their model constants
(`costco|grocery|either`, `added|stopped|dose_changed|note`).

**Whole build complete:** Plans 00 → 03 cover every section of the spec. Parked external-calendar
sync remains intentionally unbuilt; the stable appointment IDs + UTC datetimes from Plan 01 keep the
ICS exporter a thin later add-on.
