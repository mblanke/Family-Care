# family-hub — Plan 02: v1.1 Care Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Implement **after Plan 01**. Steps use checkbox
> (`- [ ]`) syntax. Read the overview for locked decisions + global constraints, especially the
> **clinical boundaries** — they are enforced in code and copy here.

**Goal:** Add the medication record (current regimen per person + append-only change history,
admin-only edits) and the blood-pressure log (per-person, optional doctor target, two-line trend
view), with the clinical boundaries firmly in place.

**Architecture:** Two new concerns each get a model + service + thin router, reusing Plan 00's
`Person`, roles, and accessibility primitives. Medication history is **append-only** —
`medication_changes` rows are never updated or deleted; corrections are new rows. BP is **additive**;
the optional doctor target lives per-person and only ever yields factual within/above/below status.

**Tech Stack:** Same as Plans 00–01. No charting library dependency — the trend chart is a small
hand-rolled SVG (line **style** + legend distinguish the two series, never color alone).

## Global Constraints

(Full list in overview.) The boundaries that bite here — **the app must never** compute/suggest
doses, recommend changes, flag interactions, or interpret a regimen or reading medically. The
**only** exception: a doctor's BP target a **human enters** — readings shown within/above/below it,
always attributed to the doctor, factual wording ("above target", never "high"/"abnormal"), no
pass/fail color (no red/green), no alerts. History is **append-only**. Medication regimen edits are
**admin-only**; family + parent are **view-only** for meds; family/admin (and optionally the parent
themselves) may log BP. Plus all Plan 00 a11y tokens.

**Shared interfaces consumed:** `Base`, `get_db`, `current_user`, `require_role`, `Person`,
`services.people`, `get_settings`; frontend `api`, `useAuth`, `<Button>`, `<PersonBadge>`,
`<Confirmation>`, `<ConfirmDialog>`, `personStyle`, `Person`.

---

### Task 1: Medication models (regimen + append-only history)

**Files:**
- Create: `backend/app/models/medication.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_medication_model.py`

**Interfaces:**
- Produces:
  - `Medication` ORM (current regimen row): `id`, `person_id:int` (FK people), `name:str`,
    `dose:str` (strength/dose text, e.g. "5 mg"), `purpose:str|None`, `slot:str`
    (`"morning"|"noon"|"evening"|"bedtime"`), `prescriber:str|None`, `prn:bool` (as-needed),
    `active:bool` (False once stopped — row kept for history linkage), `pack_pickup:date|None`.
  - `MedicationChange` ORM (**append-only** history): `id`, `person_id:int`, `medication_id:int|None`
    (nullable — a "stopped" change may outlive its row's edits), `change_type:str`
    (`"added"|"stopped"|"dose_changed"|"note"`), `summary:str` (human text, e.g. "Dr. Lee reduced to 5 mg"),
    `reason:str|None`, `recorded_by:int` (FK users), `recorded_at:datetime`. **No update/delete path.**

- [ ] **Step 1: Write the failing test** — `backend/tests/test_medication_model.py`

```python
from app.models.medication import Medication, MedicationChange, MED_SLOTS, CHANGE_TYPES

def test_models_define_slots_and_change_types(db):
    m = Medication(person_id=1, name="Amlodipine", dose="5 mg", slot="morning")
    db.add(m); db.commit(); db.refresh(m)
    assert m.active is True and m.prn is False
    assert set(MED_SLOTS) == {"morning", "noon", "evening", "bedtime"}
    assert set(CHANGE_TYPES) == {"added", "stopped", "dose_changed", "note"}
    c = MedicationChange(person_id=1, medication_id=m.id, change_type="added",
                         summary="Started Amlodipine 5 mg", recorded_by=1)
    db.add(c); db.commit(); db.refresh(c)
    assert c.recorded_at is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_medication_model.py -v`
Expected: FAIL — no module `app.models.medication`.

- [ ] **Step 3: Write `backend/app/models/medication.py`**

```python
from datetime import datetime, date, UTC
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

MED_SLOTS = ("morning", "noon", "evening", "bedtime")
CHANGE_TYPES = ("added", "stopped", "dose_changed", "note")

def _now() -> datetime: return datetime.now(UTC).replace(tzinfo=None)

class Medication(Base):
    __tablename__ = "medications"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(nullable=False)
    dose: Mapped[str] = mapped_column(nullable=False)               # human text; app never computes
    purpose: Mapped[str | None] = mapped_column(nullable=True)
    slot: Mapped[str] = mapped_column(default="morning", nullable=False)
    prescriber: Mapped[str | None] = mapped_column(nullable=True)
    prn: Mapped[bool] = mapped_column(default=False, nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    pack_pickup: Mapped[date | None] = mapped_column(nullable=True)

class MedicationChange(Base):
    __tablename__ = "medication_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    medication_id: Mapped[int | None] = mapped_column(ForeignKey("medications.id"), nullable=True)
    change_type: Mapped[str] = mapped_column(nullable=False)
    summary: Mapped[str] = mapped_column(nullable=False)
    reason: Mapped[str | None] = mapped_column(nullable=True)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(default=_now, nullable=False)
```

Append to `__init__.py`:
`from app.models.medication import Medication, MedicationChange  # noqa: F401`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_medication_model.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/medication.py backend/app/models/__init__.py backend/tests/test_medication_model.py
git commit -m "feat(meds): Medication + append-only MedicationChange models"
```

---

### Task 2: Medication service (regimen + auto-logged history; no interpretation)

**Files:**
- Create: `backend/app/services/medications.py`
- Test: `backend/tests/test_medications_service.py`

**Interfaces:**
- Produces (every mutation **also writes** a `MedicationChange`; history is the side effect):
  - `list_regimen(db, person_id:int) -> list[Medication]` (active first, by slot order then name).
  - `history(db, person_id:int) -> list[MedicationChange]` (newest first).
  - `add_med(db, *, person_id, name, dose, slot, recorded_by, purpose=None, prescriber=None,
    prn=False, reason=None) -> Medication` → also logs `change_type="added"`.
  - `change_dose(db, *, medication_id, new_dose, recorded_by, reason=None) -> Medication | None`
    → updates the row's `dose`, logs `change_type="dose_changed"` with old→new in the summary.
  - `stop_med(db, *, medication_id, recorded_by, reason=None) -> Medication | None`
    → sets `active=False`, logs `change_type="stopped"`.
  - `add_note(db, *, person_id, summary, recorded_by, medication_id=None) -> MedicationChange`.
  - The service **never** computes/validates a dose — `dose`/`new_dose` are opaque strings stored verbatim.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_medications_service.py`

```python
from app.services import medications as meds
from app.services import auth, people

def _setup(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    return u, p

def test_add_logs_history(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="Amlodipine", dose="10 mg", slot="morning", recorded_by=u.id)
    assert [x.name for x in meds.list_regimen(db, p.id)] == ["Amlodipine"]
    hist = meds.history(db, p.id)
    assert hist[0].change_type == "added" and "Amlodipine" in hist[0].summary

def test_dose_change_records_old_and_new_and_keeps_history(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="Amlodipine", dose="10 mg", slot="morning", recorded_by=u.id)
    meds.change_dose(db, medication_id=m.id, new_dose="5 mg", recorded_by=u.id,
                     reason="Dr. Lee reduced after Feb stroke follow-up")
    reg = meds.list_regimen(db, p.id)
    assert reg[0].dose == "5 mg"
    hist = meds.history(db, p.id)        # newest first: dose_changed, then added — both kept
    assert hist[0].change_type == "dose_changed"
    assert "10 mg" in hist[0].summary and "5 mg" in hist[0].summary
    assert hist[1].change_type == "added"

def test_stop_marks_inactive_but_history_remains(db):
    u, p = _setup(db)
    m = meds.add_med(db, person_id=p.id, name="X", dose="1", slot="noon", recorded_by=u.id)
    meds.stop_med(db, medication_id=m.id, recorded_by=u.id)
    assert meds.list_regimen(db, p.id)[0].active is False
    assert any(h.change_type == "stopped" for h in meds.history(db, p.id))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_medications_service.py -v`
Expected: FAIL — no module `app.services.medications`.

- [ ] **Step 3: Write `backend/app/services/medications.py`**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.medication import Medication, MedicationChange, MED_SLOTS

_SLOT_ORDER = {s: i for i, s in enumerate(MED_SLOTS)}

def list_regimen(db: Session, person_id: int) -> list[Medication]:
    rows = db.scalars(select(Medication).where(Medication.person_id == person_id)).all()
    return sorted(rows, key=lambda m: (not m.active, _SLOT_ORDER.get(m.slot, 9), m.name))

def history(db: Session, person_id: int) -> list[MedicationChange]:
    return list(db.scalars(
        select(MedicationChange).where(MedicationChange.person_id == person_id)
        .order_by(MedicationChange.recorded_at.desc(), MedicationChange.id.desc())))

def _log(db, *, person_id, medication_id, change_type, summary, reason, recorded_by) -> MedicationChange:
    c = MedicationChange(person_id=person_id, medication_id=medication_id, change_type=change_type,
                         summary=summary, reason=reason, recorded_by=recorded_by)
    db.add(c)
    return c

def add_med(db: Session, *, person_id, name, dose, slot, recorded_by,
            purpose=None, prescriber=None, prn=False, reason=None) -> Medication:
    m = Medication(person_id=person_id, name=name, dose=dose, slot=slot,
                   purpose=purpose, prescriber=prescriber, prn=prn)
    db.add(m); db.flush()
    _log(db, person_id=person_id, medication_id=m.id, change_type="added",
         summary=f"Started {name} {dose} ({slot})", reason=reason, recorded_by=recorded_by)
    db.commit(); db.refresh(m)
    return m

def change_dose(db: Session, *, medication_id, new_dose, recorded_by, reason=None) -> Medication | None:
    m = db.get(Medication, medication_id)
    if m is None: return None
    old = m.dose
    m.dose = new_dose
    _log(db, person_id=m.person_id, medication_id=m.id, change_type="dose_changed",
         summary=f"{m.name} dose changed from {old} to {new_dose}", reason=reason, recorded_by=recorded_by)
    db.commit(); db.refresh(m)
    return m

def stop_med(db: Session, *, medication_id, recorded_by, reason=None) -> Medication | None:
    m = db.get(Medication, medication_id)
    if m is None: return None
    m.active = False
    _log(db, person_id=m.person_id, medication_id=m.id, change_type="stopped",
         summary=f"Stopped {m.name}", reason=reason, recorded_by=recorded_by)
    db.commit(); db.refresh(m)
    return m

def add_note(db: Session, *, person_id, summary, recorded_by, medication_id=None) -> MedicationChange:
    c = _log(db, person_id=person_id, medication_id=medication_id, change_type="note",
             summary=summary, reason=None, recorded_by=recorded_by)
    db.commit(); db.refresh(c)
    return c
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_medications_service.py -v`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/medications.py backend/tests/test_medications_service.py
git commit -m "feat(meds): regimen service with append-only change logging"
```

---

### Task 3: Medication router (admin-only edits; family/parent view-only)

**Files:**
- Create: `backend/app/schemas/medication.py`, `backend/app/routers/medications.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_medications_api.py`

**Interfaces:**
- Produces REST:
  - `GET /api/people/{pid}/medications` → `{regimen:[...], history:[...]}` (any authed role — view).
  - `POST /api/people/{pid}/medications` (**admin only**) → add med.
  - `POST /api/medications/{mid}/dose` (**admin only**) → `{new_dose, reason?}`.
  - `POST /api/medications/{mid}/stop` (**admin only**) → `{reason?}`.
  - `POST /api/people/{pid}/medications/note` (**admin only**) → `{summary}`.
  - Family/parent get **403** on every mutating route; GET succeeds for all roles.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_medications_api.py`

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
def env():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="fam", password="pw", display_name="Fam", role="family")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    app.dependency_overrides[get_db] = lambda: TS()
    c = TestClient(app); c.pid = p.id; yield c
    app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})

def test_only_admin_edits_meds_family_can_view(env):
    _login(env, "fam")
    assert env.post(f"/api/people/{env.pid}/medications",
                    json={"name": "X", "dose": "1", "slot": "morning"}).status_code == 403
    _login(env, "admin")
    r = env.post(f"/api/people/{env.pid}/medications",
                 json={"name": "Amlodipine", "dose": "10 mg", "slot": "morning"})
    assert r.status_code == 200
    _login(env, "fam")
    got = env.get(f"/api/people/{env.pid}/medications")
    assert got.status_code == 200 and got.json()["regimen"][0]["name"] == "Amlodipine"

def test_dose_change_appends_history(env):
    _login(env, "admin")
    mid = env.post(f"/api/people/{env.pid}/medications",
                   json={"name": "Amlodipine", "dose": "10 mg", "slot": "morning"}).json()["id"]
    assert env.post(f"/api/medications/{mid}/dose",
                    json={"new_dose": "5 mg", "reason": "Dr. Lee"}).status_code == 200
    hist = env.get(f"/api/people/{env.pid}/medications").json()["history"]
    assert hist[0]["change_type"] == "dose_changed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_medications_api.py -v`
Expected: FAIL — no module `app.routers.medications`.

- [ ] **Step 3: Write `backend/app/schemas/medication.py`**

```python
from datetime import datetime, date
from pydantic import BaseModel

class MedIn(BaseModel):
    name: str
    dose: str
    slot: str = "morning"
    purpose: str | None = None
    prescriber: str | None = None
    prn: bool = False
    reason: str | None = None

class DoseIn(BaseModel):
    new_dose: str
    reason: str | None = None

class StopIn(BaseModel):
    reason: str | None = None

class NoteIn(BaseModel):
    summary: str

class MedOut(BaseModel):
    id: int
    name: str
    dose: str
    slot: str
    purpose: str | None
    prescriber: str | None
    prn: bool
    active: bool
    pack_pickup: date | None
    class Config: from_attributes = True

class ChangeOut(BaseModel):
    id: int
    change_type: str
    summary: str
    reason: str | None
    recorded_at: datetime
    medication_id: int | None
    class Config: from_attributes = True

class RegimenOut(BaseModel):
    regimen: list[MedOut]
    history: list[ChangeOut]
```

- [ ] **Step 4: Write `backend/app/routers/medications.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.medication import MedIn, DoseIn, StopIn, NoteIn, MedOut, ChangeOut, RegimenOut
from app.services import medications as svc

router = APIRouter(prefix="/api", tags=["medications"])
_admin = require_role("admin")

@router.get("/people/{pid}/medications", response_model=RegimenOut)
def get_regimen(pid: int, db: Session = Depends(get_db), _=Depends(current_user)):
    return RegimenOut(regimen=svc.list_regimen(db, pid), history=svc.history(db, pid))

@router.post("/people/{pid}/medications", response_model=MedOut)
def add(pid: int, body: MedIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    return svc.add_med(db, person_id=pid, name=body.name, dose=body.dose, slot=body.slot,
                       purpose=body.purpose, prescriber=body.prescriber, prn=body.prn,
                       reason=body.reason, recorded_by=user.id)

@router.post("/medications/{mid}/dose", response_model=MedOut)
def change_dose(mid: int, body: DoseIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    m = svc.change_dose(db, medication_id=mid, new_dose=body.new_dose, reason=body.reason, recorded_by=user.id)
    if m is None: raise HTTPException(404, "Medication not found")
    return m

@router.post("/medications/{mid}/stop", response_model=MedOut)
def stop(mid: int, body: StopIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    m = svc.stop_med(db, medication_id=mid, reason=body.reason, recorded_by=user.id)
    if m is None: raise HTTPException(404, "Medication not found")
    return m

@router.post("/people/{pid}/medications/note", response_model=ChangeOut)
def note(pid: int, body: NoteIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    return svc.add_note(db, person_id=pid, summary=body.summary, recorded_by=user.id)
```

Wire in `main.py`: `from app.routers import medications` + `app.include_router(medications.router)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_medications_api.py -v`
Expected: PASS (both).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/medication.py backend/app/routers/medications.py \
        backend/app/main.py backend/tests/test_medications_api.py
git commit -m "feat(meds): admin-only edit router, view-only for family/parent"
```

---

### Task 4: BP models + target + status (factual within/above/below only)

**Files:**
- Create: `backend/app/models/bp_reading.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/services/bp.py`
- Test: `backend/tests/test_bp_service.py`

**Interfaces:**
- Produces:
  - `BpReading` ORM: `id`, `person_id:int`, `systolic:int`, `diastolic:int`, `pulse:int|None`,
    `taken_at:datetime`, `note:str|None`, `recorded_by:int`.
  - `BpTarget` ORM (per person, optional, human-entered): `person_id:int` (PK/unique),
    `sys_low:int`, `sys_high:int`, `dia_low:int`, `dia_high:int`, `doctor_label:str` (e.g. "Dr. Lee").
  - `services.bp.log_reading(db, *, person_id, systolic, diastolic, recorded_by, pulse=None,
    taken_at=None, note=None) -> BpReading` (additive only; no edits).
  - `list_readings(db, person_id:int, *, since:datetime|None=None) -> list[BpReading]` (newest first).
  - `get_target(db, person_id) -> BpTarget | None`; `set_target(db, *, person_id, sys_low, sys_high,
    dia_low, dia_high, doctor_label) -> BpTarget` (admin sets; upsert).
  - `status_for(reading, target) -> dict | None` → `None` if no target; else
    `{"systolic": "within|above|below", "diastolic": "within|above|below"}`. **Factual words only.**

- [ ] **Step 1: Write the failing test** — `backend/tests/test_bp_service.py`

```python
from datetime import datetime
from app.services import bp, auth, people

def _setup(db):
    u = auth.create_user(db, username="a", password="p", display_name="A", role="admin")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    return u, p

def test_log_and_list_newest_first(db):
    u, p = _setup(db)
    bp.log_reading(db, person_id=p.id, systolic=130, diastolic=80, recorded_by=u.id, taken_at=datetime(2026, 6, 20, 9))
    bp.log_reading(db, person_id=p.id, systolic=128, diastolic=78, recorded_by=u.id, taken_at=datetime(2026, 6, 21, 9))
    rows = bp.list_readings(db, p.id)
    assert [r.systolic for r in rows] == [128, 130]

def test_status_only_with_target_and_is_factual(db):
    u, p = _setup(db)
    r = bp.log_reading(db, person_id=p.id, systolic=145, diastolic=85, recorded_by=u.id)
    assert bp.status_for(r, None) is None        # no target → no status at all
    bp.set_target(db, person_id=p.id, sys_low=110, sys_high=135, dia_low=70, dia_high=85, doctor_label="Dr. Lee")
    t = bp.get_target(db, p.id)
    st = bp.status_for(r, t)
    assert st == {"systolic": "above", "diastolic": "within"}   # never "high"/"abnormal"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_bp_service.py -v`
Expected: FAIL — no module `app.models.bp_reading`.

- [ ] **Step 3: Write `backend/app/models/bp_reading.py`**

```python
from datetime import datetime, UTC
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def _now() -> datetime: return datetime.now(UTC).replace(tzinfo=None)

class BpReading(Base):
    __tablename__ = "bp_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), nullable=False, index=True)
    systolic: Mapped[int] = mapped_column(nullable=False)
    diastolic: Mapped[int] = mapped_column(nullable=False)
    pulse: Mapped[int | None] = mapped_column(nullable=True)
    taken_at: Mapped[datetime] = mapped_column(default=_now, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(nullable=True)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

class BpTarget(Base):
    __tablename__ = "bp_targets"
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), primary_key=True)
    sys_low: Mapped[int] = mapped_column(nullable=False)
    sys_high: Mapped[int] = mapped_column(nullable=False)
    dia_low: Mapped[int] = mapped_column(nullable=False)
    dia_high: Mapped[int] = mapped_column(nullable=False)
    doctor_label: Mapped[str] = mapped_column(nullable=False)   # always attribute to the clinician
```

Append to `__init__.py`:
`from app.models.bp_reading import BpReading, BpTarget  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/bp.py`**

```python
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.bp_reading import BpReading, BpTarget

def log_reading(db: Session, *, person_id, systolic, diastolic, recorded_by,
                pulse=None, taken_at=None, note=None) -> BpReading:
    r = BpReading(person_id=person_id, systolic=systolic, diastolic=diastolic, pulse=pulse,
                  note=note, recorded_by=recorded_by, **({"taken_at": taken_at} if taken_at else {}))
    db.add(r); db.commit(); db.refresh(r)
    return r

def list_readings(db: Session, person_id: int, *, since: datetime | None = None) -> list[BpReading]:
    stmt = select(BpReading).where(BpReading.person_id == person_id)
    if since is not None:
        stmt = stmt.where(BpReading.taken_at >= since)
    return list(db.scalars(stmt.order_by(BpReading.taken_at.desc())))

def get_target(db: Session, person_id: int) -> BpTarget | None:
    return db.get(BpTarget, person_id)

def set_target(db: Session, *, person_id, sys_low, sys_high, dia_low, dia_high, doctor_label) -> BpTarget:
    t = db.get(BpTarget, person_id)
    if t is None:
        t = BpTarget(person_id=person_id)
        db.add(t)
    t.sys_low, t.sys_high = sys_low, sys_high
    t.dia_low, t.dia_high = dia_low, dia_high
    t.doctor_label = doctor_label
    db.commit(); db.refresh(t)
    return t

def _band(value: int, low: int, high: int) -> str:
    if value < low: return "below"
    if value > high: return "above"
    return "within"

def status_for(reading: BpReading, target: BpTarget | None) -> dict | None:
    if target is None:
        return None
    return {
        "systolic": _band(reading.systolic, target.sys_low, target.sys_high),
        "diastolic": _band(reading.diastolic, target.dia_low, target.dia_high),
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_bp_service.py -v`
Expected: PASS (both).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/bp_reading.py backend/app/models/__init__.py \
        backend/app/services/bp.py backend/tests/test_bp_service.py
git commit -m "feat(bp): readings + optional doctor target with factual within/above/below status"
```

---

### Task 5: BP router (log: admin/family/parent; target: admin-only)

**Files:**
- Create: `backend/app/schemas/bp.py`, `backend/app/routers/bp.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_bp_api.py`

**Interfaces:**
- Produces REST:
  - `GET /api/people/{pid}/bp?days=30|90|0` → `{readings:[{...,status}], target}` (any authed role).
    `days=0` ⇒ all. `status` per reading is `null` unless a target is set.
  - `POST /api/people/{pid}/bp` → log reading (**admin, family, parent** — parents may log their own).
  - `PUT /api/people/{pid}/bp/target` (**admin only**) → set/replace the doctor target.
  - Parents get **403** on the target route, **200** on logging.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_bp_api.py`

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
def env():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    app.dependency_overrides[get_db] = lambda: TS()
    c = TestClient(app); c.pid = p.id; yield c
    app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})

def test_parent_logs_but_cannot_set_target(env):
    _login(env, "mom")
    assert env.post(f"/api/people/{env.pid}/bp", json={"systolic": 130, "diastolic": 80}).status_code == 200
    assert env.put(f"/api/people/{env.pid}/bp/target",
                   json={"sys_low": 110, "sys_high": 135, "dia_low": 70, "dia_high": 85,
                         "doctor_label": "Dr. Lee"}).status_code == 403

def test_status_appears_only_after_admin_sets_target(env):
    _login(env, "mom")
    env.post(f"/api/people/{env.pid}/bp", json={"systolic": 145, "diastolic": 85})
    assert env.get(f"/api/people/{env.pid}/bp").json()["readings"][0]["status"] is None
    _login(env, "admin")
    env.put(f"/api/people/{env.pid}/bp/target",
            json={"sys_low": 110, "sys_high": 135, "dia_low": 70, "dia_high": 85, "doctor_label": "Dr. Lee"})
    body = env.get(f"/api/people/{env.pid}/bp").json()
    assert body["readings"][0]["status"] == {"systolic": "above", "diastolic": "within"}
    assert body["target"]["doctor_label"] == "Dr. Lee"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_bp_api.py -v`
Expected: FAIL — no module `app.routers.bp`.

- [ ] **Step 3: Write `backend/app/schemas/bp.py`**

```python
from datetime import datetime
from pydantic import BaseModel

class BpIn(BaseModel):
    systolic: int
    diastolic: int
    pulse: int | None = None
    taken_at: datetime | None = None
    note: str | None = None

class TargetIn(BaseModel):
    sys_low: int
    sys_high: int
    dia_low: int
    dia_high: int
    doctor_label: str

class TargetOut(BaseModel):
    sys_low: int
    sys_high: int
    dia_low: int
    dia_high: int
    doctor_label: str
    class Config: from_attributes = True

class ReadingOut(BaseModel):
    id: int
    systolic: int
    diastolic: int
    pulse: int | None
    taken_at: datetime
    note: str | None
    status: dict | None       # None unless a target is set; factual within/above/below

class BpView(BaseModel):
    readings: list[ReadingOut]
    target: TargetOut | None
```

- [ ] **Step 4: Write `backend/app/routers/bp.py`**

```python
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.user import User
from app.schemas.bp import BpIn, TargetIn, TargetOut, ReadingOut, BpView
from app.services import bp as svc

router = APIRouter(prefix="/api", tags=["bp"])
_logger = require_role("admin", "family", "parent")
_admin = require_role("admin")

@router.get("/people/{pid}/bp", response_model=BpView)
def get_bp(pid: int, days: int = Query(30), db: Session = Depends(get_db), _=Depends(current_user)):
    since = None if days == 0 else datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    target = svc.get_target(db, pid)
    rows = svc.list_readings(db, pid, since=since)
    readings = [ReadingOut(id=r.id, systolic=r.systolic, diastolic=r.diastolic, pulse=r.pulse,
                           taken_at=r.taken_at, note=r.note, status=svc.status_for(r, target)) for r in rows]
    return BpView(readings=readings, target=TargetOut.model_validate(target) if target else None)

@router.post("/people/{pid}/bp", response_model=ReadingOut)
def log(pid: int, body: BpIn, db: Session = Depends(get_db), user: User = Depends(_logger)):
    r = svc.log_reading(db, person_id=pid, systolic=body.systolic, diastolic=body.diastolic,
                        pulse=body.pulse, taken_at=body.taken_at, note=body.note, recorded_by=user.id)
    return ReadingOut(id=r.id, systolic=r.systolic, diastolic=r.diastolic, pulse=r.pulse,
                      taken_at=r.taken_at, note=r.note, status=svc.status_for(r, svc.get_target(db, pid)))

@router.put("/people/{pid}/bp/target", response_model=TargetOut)
def set_target(pid: int, body: TargetIn, db: Session = Depends(get_db), _: User = Depends(_admin)):
    return svc.set_target(db, person_id=pid, **body.model_dump())
```

Wire in `main.py`: `from app.routers import bp` + `app.include_router(bp.router)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_bp_api.py -v`
Expected: PASS (both).

- [ ] **Step 6: Migration for care-tracking tables + commit**

Run: `cd backend && alembic revision --autogenerate -m "care tracking tables" && alembic upgrade head`
Expected: migration creating `medications`, `medication_changes`, `bp_readings`, `bp_targets`.

```bash
git add backend/app/schemas/bp.py backend/app/routers/bp.py backend/app/main.py \
        backend/tests/test_bp_api.py backend/migrations/versions
git commit -m "feat(bp): logging (all roles) + admin-only target router; care-tracking migration"
```

---

### Task 6: Frontend — Medications screen (view-all, admin edit, history timeline)

**Files:**
- Create: `frontend/src/screens/Medications.tsx`, `frontend/src/lib/personPicker.tsx`
- Modify: `AdminLayout.tsx`, `ParentLayout.tsx`
- Test: `frontend/src/screens/Medications.test.tsx`

**Interfaces:**
- Consumes: `/api/people`, `/api/people/{pid}/medications` (+ admin POST routes).
- Produces:
  - `usePersonPicker()` / `<PersonPicker>` — the one-tap **Dad | Mom** filter using `PersonBadge`
    (color + name), reused by Medications + BP.
  - `<Medications>` — grouped by slot (Morning/Noon/Evening/Bedtime), each med shows name + dose +
    purpose + prescriber + PRN tag; an **append-only history timeline** below (newest first, with
    date + who + reason). Admin sees add / change-dose / stop / note controls; family + parent see
    **read-only**. A persistent plain line: *"A personal record to share with your doctor or
    pharmacist — not medical advice."*

- [ ] **Step 1: Write the failing test** — `frontend/src/screens/Medications.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Medications } from "./Medications";
import { api } from "../api/client";
import * as auth from "../lib/auth";

vi.mock("../api/client");
beforeEach(() => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { role: "family" } } as any);
  (api.get as any) = vi.fn().mockImplementation((p: string) => {
    if (p === "/api/people") return Promise.resolve([{ id: 1, name: "Dad", slug: "dad", color: "#1f6feb" }]);
    if (p.includes("/medications")) return Promise.resolve({
      regimen: [{ id: 9, name: "Amlodipine", dose: "5 mg", slot: "morning", purpose: "BP",
        prescriber: "Dr. Lee", prn: false, active: true, pack_pickup: null }],
      history: [{ id: 1, change_type: "added", summary: "Started Amlodipine 5 mg (morning)",
        reason: null, recorded_at: "2026-06-01T10:00:00", medication_id: 9 }],
    });
    return Promise.resolve([]);
  });
});

describe("Medications", () => {
  it("shows the not-medical-advice line and hides edit controls for family", async () => {
    render(<Medications />);
    await waitFor(() => screen.getByText("Amlodipine"));
    expect(screen.getByText(/not medical advice/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /change dose/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/screens/Medications.test.tsx`
Expected: FAIL — cannot resolve `./Medications`.

- [ ] **Step 3: Write `frontend/src/lib/personPicker.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "./people";
import { PersonBadge } from "../components/PersonBadge";

export function usePersonPicker() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    void api.get<Person[]>("/api/people").then(ps => { setPeople(ps); setSelected(ps[0]?.id ?? null); });
  }, []);
  const picker = (
    <div className="flex gap-touch flex-wrap">
      {people.map(p => (
        <button key={p.id} onClick={() => setSelected(p.id)}
          className={`min-h-touch rounded-xl ${selected === p.id ? "ring-4" : "opacity-70"}`}>
          <PersonBadge person={p} /></button>
      ))}
    </div>
  );
  return { people, selected, picker };
}
```

- [ ] **Step 4: Write `frontend/src/screens/Medications.tsx`**

```tsx
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { usePersonPicker } from "../lib/personPicker";
import { Button } from "../components/Button";

interface Med { id: number; name: string; dose: string; slot: string; purpose: string | null;
  prescriber: string | null; prn: boolean; active: boolean; pack_pickup: string | null; }
interface Change { id: number; change_type: string; summary: string; reason: string | null;
  recorded_at: string; medication_id: number | null; }
const SLOTS: [string, string][] = [["morning","Morning"],["noon","Noon"],["evening","Evening"],["bedtime","Bedtime"]];

export function Medications() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selected, picker } = usePersonPicker();
  const [regimen, setRegimen] = useState<Med[]>([]);
  const [history, setHistory] = useState<Change[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", slot: "morning", purpose: "", prescriber: "", reason: "" });

  const load = useCallback(async () => {
    if (selected == null) return;
    const r = await api.get<{ regimen: Med[]; history: Change[] }>(`/api/people/${selected}/medications`);
    setRegimen(r.regimen); setHistory(r.history);
  }, [selected]);
  useEffect(() => { void load(); }, [load]);

  async function addMed() {
    await api.post(`/api/people/${selected}/medications`, {
      name: form.name, dose: form.dose, slot: form.slot,
      purpose: form.purpose || null, prescriber: form.prescriber || null, reason: form.reason || null });
    setForm({ name: "", dose: "", slot: "morning", purpose: "", prescriber: "", reason: "" });
    setAdding(false); await load();
  }
  async function changeDose(m: Med) {
    const nd = prompt(`New dose for ${m.name} (current ${m.dose}). This is recorded verbatim — the app does not check doses.`);
    if (!nd) return;
    const reason = prompt("Reason (optional, e.g. 'Dr. Lee reduced')") || null;
    await api.post(`/api/medications/${m.id}/dose`, { new_dose: nd, reason }); await load();
  }
  async function stop(m: Med) {
    const reason = prompt(`Stop ${m.name}? Reason (optional)`) || null;
    await api.post(`/api/medications/${m.id}/stop`, { reason }); await load();
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h2 className="text-huge font-bold">Medications</h2>
      {picker}
      <p className="text-base italic">A personal record to share with your doctor or pharmacist — not medical advice.</p>

      {SLOTS.map(([key, label]) => {
        const meds = regimen.filter(m => m.slot === key && m.active);
        if (meds.length === 0) return null;
        return (
          <section key={key}>
            <h3 className="text-big font-bold mb-2">{label}</h3>
            {meds.map(m => (
              <div key={m.id} className="border-4 rounded-2xl p-4 mb-2">
                <p className="text-big font-semibold">{m.name} — {m.dose}{m.prn ? " (as needed)" : ""}</p>
                {m.purpose && <p className="text-base">For: {m.purpose}</p>}
                {m.prescriber && <p className="text-base">Prescriber: {m.prescriber}</p>}
                {isAdmin && (
                  <div className="flex gap-touch mt-2">
                    <button onClick={() => changeDose(m)} className="min-h-touch px-4 border-4 rounded-xl text-base">Change dose</button>
                    <button onClick={() => stop(m)} className="min-h-touch px-4 border-4 rounded-xl text-base">Stop</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {isAdmin && (adding ? (
        <div className="border-4 rounded-2xl p-4 flex flex-col gap-2 max-w-xl">
          <input className="text-big p-2 border-4 rounded-xl" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="text-big p-2 border-4 rounded-xl" placeholder="Dose (e.g. 5 mg)" value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} />
          <select className="text-big p-2 border-4 rounded-xl" value={form.slot} onChange={e => setForm({ ...form, slot: e.target.value })}>
            {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="text-big p-2 border-4 rounded-xl" placeholder="For (optional)" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
          <input className="text-big p-2 border-4 rounded-xl" placeholder="Prescriber (optional)" value={form.prescriber} onChange={e => setForm({ ...form, prescriber: e.target.value })} />
          <input className="text-big p-2 border-4 rounded-xl" placeholder="Reason for the record (optional)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <Button onClick={addMed} icon={<span aria-hidden>＋</span>}>Save medication</Button>
        </div>
      ) : <Button onClick={() => setAdding(true)} icon={<span aria-hidden>＋</span>}>Add medication</Button>)}

      <section>
        <h3 className="text-big font-bold mb-2">Change history</h3>
        <ul className="flex flex-col gap-2">
          {history.map(h => (
            <li key={h.id} className="border-l-4 pl-3 text-base">
              <span className="font-semibold">{h.recorded_at.slice(0, 10)}</span> — {h.summary}
              {h.reason ? <span className="italic"> ({h.reason})</span> : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Mount** — `AdminLayout.tsx` add a `meds` tab → `<Medications />`; `ParentLayout.tsx`
  add a `meds` tab → `<Medications />` (read-only is enforced by role inside the component + server).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/screens/Medications.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): medications screen with slot grouping, admin edits, history timeline"
```

---

### Task 7: Frontend — BP log + two-line trend chart (style + legend, not color)

**Files:**
- Create: `frontend/src/screens/BpLog.tsx`, `frontend/src/components/BpChart.tsx`
- Modify: `AdminLayout.tsx`, `ParentLayout.tsx`
- Test: `frontend/src/components/BpChart.test.tsx`

**Interfaces:**
- Consumes: `/api/people/{pid}/bp?days=` (+ POST log, admin PUT target).
- Produces:
  - `<BpChart>` — a hand-rolled SVG: **two series** systolic + diastolic over time, distinguished by
    **line style** (systolic solid, diastolic dashed) **and a plain-language legend**
    ("Systolic — top number" / "Diastolic — bottom number"), pulse off by default behind a toggle.
    If a target exists, faint labeled reference lines ("Dr. ___'s target"). **No** good/bad color
    bands, **no** generic thresholds, **no** diagnosis.
  - `<BpLog>` — big 3-field entry (systolic / diastolic / pulse) with steppers, person picker, the
    trend chart, a 30/90/all range control, and a readable recent-readings list showing the factual
    within/above/below status **only when a target is set** (neutral styling, no red/green).

- [ ] **Step 1: Write the failing test** — `frontend/src/components/BpChart.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BpChart } from "./BpChart";

describe("BpChart", () => {
  it("draws two distinct series and a plain-language legend, not color-only", () => {
    const { container, getByText } = render(
      <BpChart readings={[
        { taken_at: "2026-06-20T09:00:00", systolic: 130, diastolic: 80, pulse: 70 },
        { taken_at: "2026-06-21T09:00:00", systolic: 128, diastolic: 78, pulse: 72 },
      ]} target={null} showPulse={false} />
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);                 // systolic + diastolic
    // one solid, one dashed → distinguished by style, not just color
    const dashed = Array.from(paths).some(p => p.getAttribute("stroke-dasharray"));
    expect(dashed).toBe(true);
    expect(getByText(/Systolic — top number/i)).toBeTruthy();
    expect(getByText(/Diastolic — bottom number/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/BpChart.test.tsx`
Expected: FAIL — cannot resolve `./BpChart`.

- [ ] **Step 3: Write `frontend/src/components/BpChart.tsx`**

```tsx
interface R { taken_at: string; systolic: number; diastolic: number; pulse: number | null; }
interface Target { sys_low: number; sys_high: number; dia_low: number; dia_high: number; doctor_label: string; }

export function BpChart({ readings, target, showPulse }:
  { readings: R[]; target: Target | null; showPulse: boolean }) {
  const W = 700, H = 320, P = 40;
  const data = [...readings].reverse();              // oldest → newest, left → right
  if (data.length === 0) return <p className="text-big">No readings yet.</p>;

  const ys = data.flatMap(d => [d.systolic, d.diastolic, ...(showPulse && d.pulse ? [d.pulse] : [])]);
  const lo = Math.min(...ys, target ? target.dia_low : Infinity) - 10;
  const hi = Math.max(...ys, target ? target.sys_high : -Infinity) + 10;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);
  const line = (key: "systolic" | "diastolic" | "pulse") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key] as number)}`).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-4 rounded-2xl" role="img"
           aria-label="Blood pressure over time">
        {target && (
          <>
            <line x1={P} x2={W - P} y1={y(target.sys_high)} y2={y(target.sys_high)}
                  stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 6" />
            <line x1={P} x2={W - P} y1={y(target.dia_low)} y2={y(target.dia_low)}
                  stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 6" />
            <text x={W - P} y={y(target.sys_high) - 4} textAnchor="end" fontSize="14" opacity="0.6">
              {target.doctor_label}'s target</text>
          </>
        )}
        <path d={line("systolic")} fill="none" stroke="currentColor" strokeWidth="3" />
        <path d={line("diastolic")} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 6" />
        {showPulse && <path d={line("pulse")} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="1 5" />}
      </svg>
      <ul className="text-base flex flex-col gap-1">
        <li>━━ Systolic — top number</li>
        <li>╌╌ Diastolic — bottom number</li>
        {showPulse && <li>···· Pulse</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/screens/BpLog.tsx`**

```tsx
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { usePersonPicker } from "../lib/personPicker";
import { Button } from "../components/Button";
import { Confirmation } from "../components/Confirmation";
import { BpChart } from "../components/BpChart";

interface Reading { id: number; systolic: number; diastolic: number; pulse: number | null;
  taken_at: string; note: string | null; status: { systolic: string; diastolic: string } | null; }
interface Target { sys_low: number; sys_high: number; dia_low: number; dia_high: number; doctor_label: string; }

export function BpLog() {
  const { selected, picker } = usePersonPicker();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [days, setDays] = useState(30);
  const [showPulse, setShowPulse] = useState(false);
  const [sys, setSys] = useState(120); const [dia, setDia] = useState(80); const [pulse, setPulse] = useState(70);
  const [ack, setAck] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (selected == null) return;
    const v = await api.get<{ readings: Reading[]; target: Target | null }>(`/api/people/${selected}/bp?days=${days}`);
    setReadings(v.readings); setTarget(v.target);
  }, [selected, days]);
  useEffect(() => { void load(); }, [load]);

  async function log() {
    await api.post(`/api/people/${selected}/bp`, { systolic: sys, diastolic: dia, pulse });
    setAck("Reading saved ✓"); await load();
  }
  const Step = ({ label, value, set }: { label: string; value: number; set: (n: number) => void }) => (
    <div className="flex flex-col items-center">
      <span className="text-base font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => set(value - 1)} className="w-12 h-12 border-4 rounded-xl text-big" aria-label={`${label} less`}>−</button>
        <span className="text-huge w-20 text-center">{value}</span>
        <button onClick={() => set(value + 1)} className="w-12 h-12 border-4 rounded-xl text-big" aria-label={`${label} more`}>＋</button>
      </div>
    </div>
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <h2 className="text-huge font-bold">Blood pressure</h2>
      {picker}
      <div className="flex gap-6 flex-wrap items-end">
        <Step label="Top (systolic)" value={sys} set={setSys} />
        <Step label="Bottom (diastolic)" value={dia} set={setDia} />
        <Step label="Pulse" value={pulse} set={setPulse} />
        <Button onClick={log} icon={<span aria-hidden>＋</span>}>Save reading</Button>
      </div>
      <div className="flex gap-touch items-center">
        {[30, 90, 0].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`min-h-touch px-4 rounded-xl text-base font-bold ${days === d ? "bg-dad text-paper" : "border-4"}`}>
            {d === 0 ? "All" : `${d} days`}</button>
        ))}
        <label className="text-base flex items-center gap-2 ml-4">
          <input type="checkbox" className="w-6 h-6" checked={showPulse} onChange={e => setShowPulse(e.target.checked)} /> Show pulse
        </label>
      </div>
      <BpChart readings={readings} target={target} showPulse={showPulse} />
      <section>
        <h3 className="text-big font-bold mb-2">Recent readings</h3>
        <ul className="flex flex-col gap-2">
          {readings.map(r => (
            <li key={r.id} className="border-4 rounded-xl p-3 text-big flex flex-wrap gap-3 items-center">
              <span className="font-bold">{r.systolic}/{r.diastolic}</span>
              {r.pulse && <span className="text-base">♥ {r.pulse}</span>}
              <span className="text-base">{r.taken_at.slice(0, 10)}</span>
              {r.status && (
                <span className="text-base italic">
                  systolic {r.status.systolic} target · diastolic {r.status.diastolic} target</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Mount** — `AdminLayout.tsx` + `ParentLayout.tsx`: add a `bp` tab → `<BpLog />`.

- [ ] **Step 6: Run test + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: chart test PASS; strict typecheck clean; build OK.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): BP log with steppers and neutral two-line trend chart"
```

---

### Task 8: BP export (printable summary) + v1.1 verification + README

**Files:**
- Create: `backend/app/routers/bp_export.py`
- Modify: `backend/app/main.py`, `frontend/src/screens/BpLog.tsx` (add an Export button), `README.md`
- Test: `backend/tests/test_bp_export.py`

**Interfaces:**
- Produces:
  - `GET /api/people/{pid}/bp/export?days=90` → `text/html` printable summary (person name, the
    last-N readings table, the doctor target attributed by label if set) — handed to a clinician via
    the browser's Print → Save as PDF. **Data only; no interpretation beyond the factual status.**
  - A frontend "Print / Save PDF" button opening that URL.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_bp_export.py`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth, people, bp
import app.models  # noqa: F401

@pytest.fixture()
def env():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    u = auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    p = people.create_person(db, name="Mom", slug="mom", color="#a371f7")
    bp.log_reading(db, person_id=p.id, systolic=130, diastolic=80, recorded_by=u.id)
    app.dependency_overrides[get_db] = lambda: TS()
    c = TestClient(app); c.pid = p.id; yield c
    app.dependency_overrides.clear()

def test_export_renders_html_with_reading(env):
    env.post("/api/auth/login", json={"username": "admin", "password": "pw"})
    r = env.get(f"/api/people/{env.pid}/bp/export?days=90")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert "130/80" in r.text and "Mom" in r.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_bp_export.py -v`
Expected: FAIL — no module `app.routers.bp_export`.

- [ ] **Step 3: Write `backend/app/routers/bp_export.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from app.services import bp, people

router = APIRouter(prefix="/api", tags=["bp-export"])

@router.get("/people/{pid}/bp/export", response_class=HTMLResponse)
def export(pid: int, days: int = 90, db: Session = Depends(get_db), _=Depends(current_user)):
    person = people.get_person(db, pid)
    if person is None:
        raise HTTPException(404, "Person not found")
    since = None if days == 0 else datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    rows = bp.list_readings(db, pid, since=since)
    target = bp.get_target(db, pid)
    trs = "".join(
        f"<tr><td>{r.taken_at:%Y-%m-%d %H:%M}</td><td>{r.systolic}/{r.diastolic}</td>"
        f"<td>{r.pulse or ''}</td><td>{r.note or ''}</td></tr>" for r in rows)
    tgt = (f"<p>Doctor's target ({target.doctor_label}): systolic {target.sys_low}–{target.sys_high}, "
           f"diastolic {target.dia_low}–{target.dia_high}</p>") if target else ""
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>BP summary — {person.name}</title>
<style>body{{font-family:system-ui;font-size:16px;padding:24px}}
table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #999;padding:6px;text-align:left}}</style>
</head><body>
<h1>Blood pressure summary — {person.name}</h1>
<p>Last {days or 'all'} days · {len(rows)} readings · generated for sharing with a clinician.</p>
{tgt}
<table><thead><tr><th>When</th><th>BP</th><th>Pulse</th><th>Note</th></tr></thead><tbody>{trs}</tbody></table>
<p style="margin-top:16px;font-style:italic">A personal record — not medical advice.</p>
</body></html>"""
```

Wire in `main.py`: `from app.routers import bp_export` + `app.include_router(bp_export.router)`.

- [ ] **Step 4: Add the Export button** to `frontend/src/screens/BpLog.tsx`

```tsx
// inside the range-control row, after the Show pulse label:
<a href={`/api/people/${selected}/bp/export?days=${days || 90}`} target="_blank" rel="noopener"
   className="min-h-touch px-4 rounded-xl border-4 text-base font-bold inline-flex items-center">
  Print / Save PDF</a>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_bp_export.py -v` and `cd frontend && npm run build`
Expected: backend PASS; frontend build OK.

- [ ] **Step 6: Full suite + manual verification**

Run: `cd backend && pytest -q` (all green). Then `docker compose up -d --build` and verify over Tailscale:
- Admin: add a med for Dad → appears under Morning; change its dose → history shows "dose changed from X to Y"; the entry is **not** removed.
- Family + parent: see the med + history **read-only** (no Change dose / Stop buttons); the "not medical advice" line shows.
- BP: log a reading as parent; chart shows two distinguishable lines + legend; with **no** target, no status text appears; admin sets a target → readings show factual "above/within target" in neutral styling (no red/green); Print/Save PDF opens the summary.

- [ ] **Step 7: Update `README.md` + commit**

```markdown
## v1.1 — care tracking
Per-person medication record with an append-only change history (admin maintains the regimen;
family and parents view only) and a blood-pressure log with an optional doctor-entered target and
a neutral two-line trend chart. These are records to share with a clinician — the app gives no
medical advice and never decides what is "normal".
```

```bash
git add backend/app/routers/bp_export.py backend/app/main.py frontend/src/screens/BpLog.tsx \
        backend/tests/test_bp_export.py README.md
git commit -m "feat(bp): printable export; document and verify v1.1 care tracking"
```

---

## Self-Review

**Spec coverage (v1.1):**
- Current regimen per person, all fields, slot grouping, PRN, pack-pickup → Tasks 1–3, 6.
- **Append-only change history**, dated, who + reason, never overwritten/deleted → Tasks 1–2 (every mutation logs; no update/delete path), shown as a timeline in Task 6.
- "Track changes" timeline through stroke recovery → Task 6 history section.
- Medication edits **admin-only**; family/parent **view-only** → Task 3 `require_role("admin")` + Task 6 role-gated controls; tests assert 403.
- "Record, not advice" line near the feature → Task 6 copy; export copy Task 8.
- Hard boundaries (no dose compute/suggest/interactions/interpretation) → service stores dose as opaque string (Tasks 2), change-dose UI states "recorded verbatim — the app does not check doses" (Task 6).
- BP per person, big 3-field entry with steppers, optional pulse/note → Tasks 4–5, 7.
- **Doctor target** human-entered, off until set, attributed, factual within/above/below, no pass/fail color, no alerts → Tasks 4 (`status_for` returns None w/o target; factual words), 5 (admin-only PUT; status null w/o target), 7 (neutral styling, no red/green).
- Two-line trend (systolic + diastolic), **line style + legend not color**, pulse toggle, time-range, recent list, target reference lines, nothing else → Task 7 `BpChart` (solid/dashed + plain legend; faint labeled target lines; no bands/thresholds/diagnosis).
- Export/printable summary for a clinician → Task 8.
- Same logger boundary for BP → Tasks 4–5, 7, 8 (data only).

**Placeholder scan:** none — every code step is complete. (`prompt()` dialogs in Task 6 are
deliberate minimal admin-only inputs; acceptable for the admin edit path, not parent-facing.)

**Type consistency:** `MED_SLOTS`/`slot` values consistent model→service→schema→UI
(`morning|noon|evening|bedtime`). `change_type` values consistent (`added|stopped|dose_changed|note`).
BP `status` shape `{"systolic","diastolic"} | None` identical across service, schema (`dict | None`),
and both TS consumers. `BpTarget` fields (`sys_low/sys_high/dia_low/dia_high/doctor_label`) match
across model, schema, router, chart, and export.

**Consumed by Plan 03 (MCP):** `medications.list_regimen`, `medications.add_med`/`change_dose`/`stop_med`,
`bp.log_reading`, `bp.list_readings`, `bp.status_for`, `bp.get_target` — signatures fixed here.
