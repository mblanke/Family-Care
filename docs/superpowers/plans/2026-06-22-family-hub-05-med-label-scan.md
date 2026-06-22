# family-hub — Plan 05: Medication-Label Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Implement **after Plan 02** (Care Tracking). Steps
> use checkbox (`- [ ]`) syntax. Read the overview + the design spec
> (`docs/superpowers/specs/2026-06-22-contacts-and-med-label-scan-design.md`). The clinical
> boundaries are enforced **structurally** here — read them before writing code.

**Goal:** Let the admin photograph a **pharmacy label/printout** to pre-fill the medication form.
The scan extracts text only and **never writes to the database** — the admin reviews and confirms
every field, and only the existing add/change path persists anything. Admin-only.

**Architecture:** A pluggable `MedicationLabelExtractor` interface (shipped impl posts the image to
the household `llm-router` hosted vision model — allowed because family data has no sovereignty
constraint). A `scan` endpoint returns candidates + stashes the image short-term; the existing
medication-add path optionally keeps the photo, recording its path on the append-only history row.

**Tech Stack:** Same as Plans 00–02, plus `httpx` (already a dev dep; promote to a runtime dep) for
the llm-router call, and `python-multipart` (already present) for the upload.

## Global Constraints

(Full list in overview.) The boundaries that bite here — **the app must never** compute/suggest/
infer a dose, flag interactions, or interpret a regimen. The scan is **transcription only**; the
review step is **mandatory and non-skippable**; nothing auto-commits. Manual entry stays fully
available, so **core function never requires egress**. Medication writes remain **admin-only**.
Plus all Plan 00 accessibility tokens.

**Shared interfaces consumed (Plan 02):** `services.medications.add_med/change_dose` (extended here
with an optional `photo_path`), `Medication`, `MedicationChange`, `MED_SLOTS`; `require_role("admin")`,
`current_user`, `get_db`, `resolve`/`get_person`. Frontend: the admin `<Medications>` screen, `api`,
`<Button>`, `<Confirmation>`.

---

### Task 1: Config + extractor interface + LlmRouterExtractor (fake-tested)

**Files:**
- Modify: `backend/app/config.py`, `.env.example`, `backend/pyproject.toml` (move `httpx` to runtime deps)
- Create: `backend/app/services/med_scan.py`
- Test: `backend/tests/test_med_scan_extractor.py`

**Interfaces:**
- Produces:
  - Settings: `llm_router_url:str`, `llm_router_token:str`, `llm_router_vision_model:str` (defaults empty).
  - `ExtractedMed` dataclass `{name:str, dose:str, slot:str, prescriber:str|None}`.
  - `MedicationLabelExtractor` Protocol: `extract(image_bytes:bytes) -> list[ExtractedMed]`.
  - `LlmRouterExtractor` — posts the image to `llm_router_url` with a **transcription-only** vision
    prompt and parses the JSON reply into `ExtractedMed`s. Slot is normalized into `MED_SLOTS`
    (unknown → `"morning"`). Raises `ScanUnavailable` with an actionable message if the router isn't
    configured/reachable.
  - `get_extractor() -> MedicationLabelExtractor` — returns the configured impl (swappable; tests
    inject a fake).
  - `normalize_slot(raw:str) -> str` and `parse_candidates(payload:dict) -> list[ExtractedMed]`
    (pure functions, unit-tested without network).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_med_scan_extractor.py`

```python
import pytest
from app.services import med_scan

def test_parse_candidates_maps_fields_and_normalizes_slot():
    payload = {"medications": [
        {"name": "Amlodipine", "dose": "5 mg", "time_of_day": "Morning", "prescriber": "Dr. Lee"},
        {"name": "Atorvastatin", "dose": "20 mg", "time_of_day": "at bedtime", "prescriber": None},
        {"name": "Mystery", "dose": "1 tab", "time_of_day": "whenever", "prescriber": None},
    ]}
    out = med_scan.parse_candidates(payload)
    assert [m.name for m in out] == ["Amlodipine", "Atorvastatin", "Mystery"]
    assert out[0].slot == "morning"
    assert out[1].slot == "bedtime"
    assert out[2].slot == "morning"          # unknown → default, never guessed/dropped

def test_normalize_slot_known_and_unknown():
    assert med_scan.normalize_slot("NOON") == "noon"
    assert med_scan.normalize_slot("supper-time") == "evening"   # 'evening' synonyms map
    assert med_scan.normalize_slot("") == "morning"

def test_get_extractor_unconfigured_raises_actionable(monkeypatch):
    monkeypatch.setenv("LLM_ROUTER_URL", "")
    from app.config import get_settings; get_settings.cache_clear()
    ex = med_scan.get_extractor()
    with pytest.raises(med_scan.ScanUnavailable) as e:
        ex.extract(b"fake-image-bytes")
    assert "LLM_ROUTER_URL" in str(e.value)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_med_scan_extractor.py -v`
Expected: FAIL — no module `app.services.med_scan`.

- [ ] **Step 3: Add settings** to `backend/app/config.py`

```python
    # append to Settings:
    llm_router_url: str = ""
    llm_router_token: str = ""
    llm_router_vision_model: str = "claude-opus-4-8"
```

Add to `.env.example`:
```dotenv
# Medication-label scan (optional aid; manual entry always works without these)
LLM_ROUTER_URL=
LLM_ROUTER_TOKEN=
LLM_ROUTER_VISION_MODEL=claude-opus-4-8
```

Move `httpx` from `[project.optional-dependencies].dev` into `[project].dependencies` in `pyproject.toml`.

- [ ] **Step 4: Write `backend/app/services/med_scan.py`**

```python
import base64
import json
from dataclasses import dataclass
from typing import Protocol
import httpx
from app.config import get_settings
from app.models.medication import MED_SLOTS

class ScanUnavailable(Exception):
    pass

@dataclass
class ExtractedMed:
    name: str
    dose: str
    slot: str
    prescriber: str | None

_SLOT_SYNONYMS = {
    "morning": "morning", "am": "morning", "breakfast": "morning",
    "noon": "noon", "lunch": "noon", "midday": "noon",
    "evening": "evening", "supper": "evening", "supper-time": "evening", "dinner": "evening", "pm": "evening",
    "bedtime": "bedtime", "bed": "bedtime", "night": "bedtime", "hs": "bedtime",
}

def normalize_slot(raw: str) -> str:
    key = (raw or "").strip().lower()
    for token, slot in _SLOT_SYNONYMS.items():
        if token in key:
            return slot
    return "morning"   # never drop a med over an unreadable slot; default + let the admin fix it

def parse_candidates(payload: dict) -> list[ExtractedMed]:
    out: list[ExtractedMed] = []
    for m in payload.get("medications", []):
        name = (m.get("name") or "").strip()
        if not name:
            continue
        out.append(ExtractedMed(
            name=name,
            dose=(m.get("dose") or "").strip(),
            slot=normalize_slot(m.get("time_of_day", "")),
            prescriber=(m.get("prescriber") or None),
        ))
    return out

# Transcription-only — the model must NOT interpret, compute, or infer anything.
_PROMPT = (
    "You are transcribing a pharmacy medication label/printout into structured data. "
    "Return ONLY JSON: {\"medications\":[{\"name\",\"dose\",\"time_of_day\",\"prescriber\"}]}. "
    "Copy text exactly as printed. Do NOT calculate, infer, correct, or add doses. "
    "Do NOT comment on interactions or appropriateness. If a field is absent, use null."
)

class MedicationLabelExtractor(Protocol):
    def extract(self, image_bytes: bytes) -> list[ExtractedMed]: ...

class LlmRouterExtractor:
    def extract(self, image_bytes: bytes) -> list[ExtractedMed]:
        s = get_settings()
        if not s.llm_router_url:
            raise ScanUnavailable("Scanning is not configured. Set LLM_ROUTER_URL (and token) in .env.")
        b64 = base64.b64encode(image_bytes).decode()
        try:
            r = httpx.post(
                s.llm_router_url,
                headers={"Authorization": f"Bearer {s.llm_router_token}"},
                json={"model": s.llm_router_vision_model, "prompt": _PROMPT,
                      "image_base64": b64, "response_format": "json"},
                timeout=60.0,
            )
            r.raise_for_status()
            payload = r.json()
            # router returns the model's JSON text; tolerate either parsed dict or a JSON string
            if isinstance(payload, str):
                payload = json.loads(payload)
            if "medications" not in payload and "content" in payload:
                payload = json.loads(payload["content"])
        except (httpx.HTTPError, json.JSONDecodeError, KeyError) as e:
            raise ScanUnavailable(f"Could not read the label via llm-router: {e}. You can enter it manually.")
        return parse_candidates(payload)

def get_extractor() -> MedicationLabelExtractor:
    return LlmRouterExtractor()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_med_scan_extractor.py -v`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/app/services/med_scan.py backend/pyproject.toml \
        .env.example backend/tests/test_med_scan_extractor.py
git commit -m "feat(med-scan): pluggable transcription-only extractor with llm-router impl"
```

---

### Task 2: `photo_path` column + scan endpoint + photo-keeping add path

**Files:**
- Create: `backend/app/services/scan_store.py`, `backend/app/routers/med_scan.py`
- Modify: `backend/app/models/medication.py` (add `photo_path`), `backend/app/services/medications.py`
  (thread optional `photo_path`), `backend/app/schemas/medication.py` (add `scan_id`/`keep_photo`),
  `backend/app/routers/medications.py` (handle keep-photo on add), `backend/app/main.py`
- Test: `backend/tests/test_med_scan_api.py`

**Interfaces:**
- Produces:
  - `MedicationChange.photo_path: str | None` (new nullable column).
  - `scan_store.stash(image_bytes:bytes) -> str` (returns `scan_id`; writes to a temp dir),
    `scan_store.peek(scan_id) -> bytes | None`, `scan_store.keep(scan_id) -> str | None`
    (moves temp → permanent `med-photos` dir, returns the stored relative path),
    `scan_store.discard(scan_id) -> None`, `scan_store.sweep(max_age_seconds=3600) -> int`.
  - `medications.add_med(..., photo_path=None)` and `change_dose(..., photo_path=None)` — when given,
    the logged `MedicationChange` carries `photo_path`.
  - REST:
    - `POST /api/people/{pid}/medications/scan` (**admin**) — multipart `file`; returns
      `{scan_id, candidates:[{name,dose,slot,prescriber}]}`. **No DB write.** 403 for family/parent.
    - `MedIn` gains `scan_id:str|None`, `keep_photo:bool=False`; the existing
      `POST /api/people/{pid}/medications` moves the kept image into permanent storage and records
      its path on the "added" history row when `keep_photo` is set with a valid `scan_id`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_med_scan_api.py`

```python
import io, pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db
from app.main import app
from app.services import auth, people, medications, med_scan
from app.models.medication import Medication, MedicationChange
import app.models  # noqa: F401

class FakeExtractor:
    def extract(self, image_bytes):
        return [med_scan.ExtractedMed(name="Amlodipine", dose="5 mg", slot="morning", prescriber="Dr. Lee")]

@pytest.fixture()
def env(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine); TS = sessionmaker(bind=engine); db = TS()
    auth.create_user(db, username="admin", password="pw", display_name="Admin", role="admin")
    auth.create_user(db, username="mom", password="pw", display_name="Mom", role="parent")
    p = people.create_person(db, name="Dad", slug="dad", color="#1f6feb")
    monkeypatch.setattr(med_scan, "get_extractor", lambda: FakeExtractor())
    app.dependency_overrides[get_db] = lambda: TS()
    c = TestClient(app); c.pid = p.id; c.TS = TS; yield c
    app.dependency_overrides.clear()

def _login(c, u): c.post("/api/auth/login", json={"username": u, "password": "pw"})
def _img(): return {"file": ("label.jpg", io.BytesIO(b"jpegbytes"), "image/jpeg")}

def test_scan_returns_candidates_and_writes_nothing(env):
    _login(env, "admin")
    r = env.post(f"/api/people/{env.pid}/medications/scan", files=_img())
    assert r.status_code == 200
    body = r.json()
    assert body["candidates"][0]["name"] == "Amlodipine" and body["scan_id"]
    db = env.TS()
    assert db.scalar(select(Medication)) is None          # scan alone persisted nothing

def test_parent_cannot_scan(env):
    _login(env, "mom")
    assert env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).status_code == 403

def test_confirm_with_keep_photo_sets_photo_path(env):
    _login(env, "admin")
    scan_id = env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).json()["scan_id"]
    r = env.post(f"/api/people/{env.pid}/medications",
                 json={"name": "Amlodipine", "dose": "5 mg", "slot": "morning",
                       "scan_id": scan_id, "keep_photo": True})
    assert r.status_code == 200
    db = env.TS()
    ch = db.scalar(select(MedicationChange).where(MedicationChange.change_type == "added"))
    assert ch.photo_path is not None

def test_confirm_without_keep_photo_has_no_path(env):
    _login(env, "admin")
    scan_id = env.post(f"/api/people/{env.pid}/medications/scan", files=_img()).json()["scan_id"]
    env.post(f"/api/people/{env.pid}/medications",
             json={"name": "Amlodipine", "dose": "5 mg", "slot": "morning",
                   "scan_id": scan_id, "keep_photo": False})
    db = env.TS()
    ch = db.scalar(select(MedicationChange).where(MedicationChange.change_type == "added"))
    assert ch.photo_path is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_med_scan_api.py -v`
Expected: FAIL — no module `app.routers.med_scan`.

- [ ] **Step 3: Add the column** — `backend/app/models/medication.py`

```python
    # add to MedicationChange:
    photo_path: Mapped[str | None] = mapped_column(nullable=True)
```

- [ ] **Step 4: Thread `photo_path`** through `backend/app/services/medications.py`

```python
# update _log signature + the two callers:
def _log(db, *, person_id, medication_id, change_type, summary, reason, recorded_by, photo_path=None):
    c = MedicationChange(person_id=person_id, medication_id=medication_id, change_type=change_type,
                         summary=summary, reason=reason, recorded_by=recorded_by, photo_path=photo_path)
    db.add(c)
    return c

# add_med: add `photo_path=None` param; pass photo_path=photo_path into the _log call.
# change_dose: add `photo_path=None` param; pass photo_path=photo_path into the _log call.
```

(Concretely, change `add_med(db, *, person_id, name, dose, slot, recorded_by, purpose=None,
prescriber=None, prn=False, reason=None, photo_path=None)` and forward `photo_path=photo_path` to
`_log`. Same for `change_dose(..., photo_path=None)`.)

- [ ] **Step 5: Write `backend/app/services/scan_store.py`**

```python
import os, shutil, time, uuid
TEMP_DIR = os.environ.get("SCAN_TEMP_DIR", "/tmp/familyhub-scans")
KEEP_DIR = os.environ.get("MED_PHOTO_DIR", "/data/med-photos")

def _ensure(d): os.makedirs(d, exist_ok=True)

def stash(image_bytes: bytes) -> str:
    _ensure(TEMP_DIR)
    scan_id = uuid.uuid4().hex
    with open(os.path.join(TEMP_DIR, scan_id), "wb") as f:
        f.write(image_bytes)
    return scan_id

def peek(scan_id: str) -> bytes | None:
    path = os.path.join(TEMP_DIR, scan_id)
    if not os.path.isfile(path): return None
    with open(path, "rb") as f:
        return f.read()

def keep(scan_id: str) -> str | None:
    src = os.path.join(TEMP_DIR, scan_id)
    if not os.path.isfile(src): return None
    _ensure(KEEP_DIR)
    rel = f"{scan_id}.jpg"
    shutil.move(src, os.path.join(KEEP_DIR, rel))
    return rel

def discard(scan_id: str) -> None:
    path = os.path.join(TEMP_DIR, scan_id)
    if os.path.isfile(path): os.remove(path)

def sweep(max_age_seconds: int = 3600) -> int:
    _ensure(TEMP_DIR)
    now = time.time(); n = 0
    for name in os.listdir(TEMP_DIR):
        p = os.path.join(TEMP_DIR, name)
        if os.path.isfile(p) and now - os.path.getmtime(p) > max_age_seconds:
            os.remove(p); n += 1
    return n
```

- [ ] **Step 6: Write `backend/app/routers/med_scan.py`**

```python
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_role
from app.services import med_scan, scan_store

router = APIRouter(prefix="/api", tags=["med-scan"])
_admin = require_role("admin")

@router.post("/people/{pid}/medications/scan")
def scan(pid: int, file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(_admin)):
    """Read a pharmacy label and return editable candidates. WRITES NOTHING — the admin confirms via the normal add path."""
    image = file.file.read()
    scan_store.sweep()                       # opportunistic cleanup of abandoned scans
    candidates = med_scan.get_extractor().extract(image)
    scan_id = scan_store.stash(image)
    return {"scan_id": scan_id,
            "candidates": [{"name": c.name, "dose": c.dose, "slot": c.slot, "prescriber": c.prescriber}
                           for c in candidates]}
```

Wire in `main.py`: `from app.routers import med_scan` + `app.include_router(med_scan.router)`.

- [ ] **Step 7: Extend the add path** — `backend/app/schemas/medication.py` + `routers/medications.py`

```python
# schemas/medication.py — add to MedIn:
    scan_id: str | None = None
    keep_photo: bool = False
```

```python
# routers/medications.py — replace the `add` handler body to honor keep_photo:
from app.services import scan_store  # add import

@router.post("/people/{pid}/medications", response_model=MedOut)
def add(pid: int, body: MedIn, db: Session = Depends(get_db), user: User = Depends(_admin)):
    photo_path = None
    if body.scan_id:
        photo_path = scan_store.keep(body.scan_id) if body.keep_photo else None
        if not body.keep_photo:
            scan_store.discard(body.scan_id)
    return svc.add_med(db, person_id=pid, name=body.name, dose=body.dose, slot=body.slot,
                       purpose=body.purpose, prescriber=body.prescriber, prn=body.prn,
                       reason=body.reason, recorded_by=user.id, photo_path=photo_path)
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && pytest tests/test_med_scan_api.py -v`
Expected: PASS (all four).

- [ ] **Step 9: Migration + Compose volume + commit**

Run: `cd backend && alembic revision --autogenerate -m "medication_changes.photo_path" && alembic upgrade head`
Add a `med-photos` mount to the `api` service in `docker-compose.yml`:
```yaml
    volumes:
      - medphotos:/data/med-photos
# and under top-level volumes:
  medphotos:
```

```bash
git add backend/app/models/medication.py backend/app/services/medications.py \
        backend/app/services/scan_store.py backend/app/routers/med_scan.py \
        backend/app/schemas/medication.py backend/app/routers/medications.py \
        backend/app/main.py docker-compose.yml backend/tests/test_med_scan_api.py backend/migrations/versions
git commit -m "feat(med-scan): scan endpoint (no-write) + opt-in photo retention on history"
```

---

### Task 3: Frontend — Scan button + review-and-confirm on admin Medications

**Files:**
- Create: `frontend/src/admin/ScanReview.tsx`
- Modify: `frontend/src/screens/Medications.tsx`
- Test: `frontend/src/admin/ScanReview.test.tsx`

**Interfaces:**
- Consumes: `POST /api/people/{pid}/medications/scan`, `POST /api/people/{pid}/medications`.
- Produces:
  - `<ScanReview>` — given `personId`, renders a **"📷 Scan label"** camera/file input
    (`accept="image/*" capture="environment"`). On upload it calls `/scan`, then shows each candidate
    as an **editable** row (name, dose, slot picker, prescriber) with a per-row "Add to regimen"
    button and a **"Keep photo with this entry"** toggle (off by default). Confirming a row calls the
    normal add endpoint with `scan_id` + `keep_photo`. A `Confirmation` banner on each add.
  - Shown only inside the admin Medications screen (admin-gated already).

- [ ] **Step 1: Write the failing test** — `frontend/src/admin/ScanReview.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScanReview } from "./ScanReview";
import { api } from "../api/client";

vi.mock("../api/client");
beforeEach(() => {
  (api.post as any) = vi.fn().mockResolvedValue({
    scan_id: "abc", candidates: [{ name: "Amlodipine", dose: "5 mg", slot: "morning", prescriber: "Dr. Lee" }],
  });
});

describe("ScanReview", () => {
  it("shows extracted candidates as editable rows after a scan, pre-filled not saved", async () => {
    render(<ScanReview personId={1} onAdded={() => {}} />);
    const input = screen.getByLabelText(/scan label/i);
    fireEvent.change(input, { target: { files: [new File(["x"], "label.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => screen.getByDisplayValue("Amlodipine"));
    expect(screen.getByDisplayValue("5 mg")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add to regimen/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/admin/ScanReview.test.tsx`
Expected: FAIL — cannot resolve `./ScanReview`.

- [ ] **Step 3: Write `frontend/src/admin/ScanReview.tsx`**

```tsx
import { useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Confirmation } from "../components/Confirmation";

interface Cand { name: string; dose: string; slot: string; prescriber: string | null; }
const SLOTS: [string, string][] = [["morning","Morning"],["noon","Noon"],["evening","Evening"],["bedtime","Bedtime"]];

export function ScanReview({ personId, onAdded }: { personId: number; onAdded: () => void }) {
  const [scanId, setScanId] = useState<string | null>(null);
  const [rows, setRows] = useState<Cand[]>([]);
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`/api/people/${personId}/medications/scan`, {
        method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "Scan failed");
      const data = await res.json();
      setScanId(data.scan_id); setRows(data.candidates);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  function edit(i: number, patch: Partial<Cand>) {
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  async function addRow(i: number) {
    const r = rows[i];
    await api.post(`/api/people/${personId}/medications`, {
      name: r.name, dose: r.dose, slot: r.slot, prescriber: r.prescriber || null,
      scan_id: scanId, keep_photo: keepPhoto });
    setAck(`Added ${r.name}`); setRows(rs => rs.filter((_, j) => j !== i)); onAdded();
  }

  return (
    <div className="border-4 rounded-2xl p-4 flex flex-col gap-3">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <label className="min-h-touch px-6 rounded-2xl bg-dad text-paper text-big font-bold
                        inline-flex items-center gap-3 cursor-pointer w-fit">
        📷 Scan label
        <input aria-label="Scan label" type="file" accept="image/*" capture="environment"
               className="hidden" onChange={onFile} />
      </label>
      {busy && <p className="text-big">Reading the label…</p>}
      {err && <p className="text-big text-red-700" role="alert">{err} — you can still type it in manually.</p>}
      {rows.length > 0 && (
        <p className="text-base italic">Check each line against the label before adding — the scan can misread; nothing is saved until you press Add.</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="border-2 rounded-xl p-3 flex flex-col gap-2">
          <input className="text-big p-2 border-4 rounded-xl" value={r.name} onChange={e => edit(i, { name: e.target.value })} />
          <input className="text-big p-2 border-4 rounded-xl" value={r.dose} onChange={e => edit(i, { dose: e.target.value })} />
          <select className="text-big p-2 border-4 rounded-xl" value={r.slot} onChange={e => edit(i, { slot: e.target.value })}>
            {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="text-big p-2 border-4 rounded-xl" placeholder="Prescriber"
                 value={r.prescriber ?? ""} onChange={e => edit(i, { prescriber: e.target.value })} />
          <Button onClick={() => addRow(i)} icon={<span aria-hidden>＋</span>}>Add to regimen</Button>
        </div>
      ))}
      {rows.length > 0 && (
        <label className="text-base flex items-center gap-3">
          <input type="checkbox" className="w-7 h-7" checked={keepPhoto} onChange={e => setKeepPhoto(e.target.checked)} />
          Keep photo with these entries
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount in `frontend/src/screens/Medications.tsx`** (admin only)

```tsx
// import { ScanReview } from "../admin/ScanReview";
// inside the isAdmin block, near the "Add medication" button:
{isAdmin && selected != null && <ScanReview personId={selected} onAdded={load} />}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/admin/ScanReview.test.tsx`
Expected: PASS.

- [ ] **Step 6: Build + commit**

Run: `cd frontend && npm run build` (strict typecheck clean).

```bash
git add frontend/src
git commit -m "feat(frontend): scan-label review-and-confirm on admin medications screen"
```

---

### Task 4: End-to-end verification + README + backup path

**Files:**
- Modify: `README.md`
- (No code; verifies the feature + documents config and the photo backup path.)

- [ ] **Step 1: Configure + bring up**

Set `LLM_ROUTER_URL`, `LLM_ROUTER_TOKEN`, `LLM_ROUTER_VISION_MODEL` in `.env`, then
`docker compose up -d --build`.

- [ ] **Step 2: Manual verification (admin, iPad)**

- On the admin Medications screen, tap **📷 Scan label**, take a photo of a real pharmacy label.
- Candidates appear pre-filled and **editable**; correct anything; nothing is in the regimen yet.
- Press **Add to regimen** on a row → it's saved via the normal path; the history shows the "added" entry.
- With **Keep photo** on, confirm the image is stored and the entry references it; with it off, no image is kept.
- As **family/parent**, confirm the Scan button is absent and `/scan` returns 403.
- With `LLM_ROUTER_URL` unset, confirm scanning reports it's not configured and **manual entry still works**.

- [ ] **Step 3: Update `README.md`**

```markdown
## Medication-label scan (optional, admin-only)
On the admin Medications screen, "📷 Scan label" photographs a pharmacy label and pre-fills the
medication form via your `llm-router` hosted vision model (set `LLM_ROUTER_URL`, `LLM_ROUTER_TOKEN`,
`LLM_ROUTER_VISION_MODEL` in `.env`). The scan only transcribes text — it never saves, computes, or
interprets anything; you review and confirm every field, and the normal add path does the write.
Manual entry always works, with or without the router configured.

### Backup: medication photos
If "Keep photo with this entry" is used, images live in the `medphotos` Docker volume
(`/data/med-photos`). Back it up alongside the database:
docker run --rm -v family-hub_medphotos:/v -v "$PWD":/out alpine tar czf /out/medphotos-$(date +%F).tgz -C /v .
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: medication-label scan setup, boundaries, and photo backup path"
```

---

## Self-Review

**Spec coverage (med-label scan):**
- Photograph the **pharmacy label** to pre-fill meds → Tasks 1–3.
- **Never writes to DB**; review-and-confirm mandatory; existing add path does the write → Task 2 scan endpoint writes nothing (asserted), Task 3 per-row Add via the normal endpoint.
- **Transcription only**, no dose compute/inference/interaction/interpretation → Task 1 `_PROMPT` + `parse_candidates` (verbatim copy; unknown slot defaulted, never invented), Task 3 copy warning.
- **Admin-only** → `require_role("admin")` on scan + add (Task 2); test asserts parent 403; Scan UI admin-gated (Task 3).
- Engine via **llm-router hosted** (allowed: family data, no sovereignty constraint) → `LlmRouterExtractor` (Task 1).
- **Pluggable + mockable** extractor → Protocol + `get_extractor()`; tests inject a fake, never hit the network (Tasks 1–2).
- Photo **discarded by default, opt-in keep** on the history row → `scan_store` + `photo_path` (Task 2); toggle off by default (Task 3); both paths tested.
- Manual entry always available; **core needs no egress** → unset-router path verified (Task 4); add form from Plan 02 untouched.
- Backup path for kept photos documented → Task 4.

**Placeholder scan:** none — complete code throughout. The llm-router request/response shape in
`LlmRouterExtractor` tolerates a couple of common envelopes; adjust the exact keys to match the real
router contract during implementation (the parse is isolated and unit-tested via `parse_candidates`).

**Type consistency:** `ExtractedMed` fields (`name/dose/slot/prescriber`) match across the extractor,
the scan response, and the `Cand` TS interface. `slot` values stay within `MED_SLOTS`
(`morning|noon|evening|bedtime`) via `normalize_slot`. `add_med`'s new `photo_path` param matches the
threaded `_log` arg and the new `MedicationChange.photo_path` column. `MedIn.scan_id/keep_photo`
match the router handler and the frontend payload.
