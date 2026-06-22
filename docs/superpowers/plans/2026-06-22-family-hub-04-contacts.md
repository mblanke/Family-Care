# family-hub — Plan 04: Contacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Implement **after Plan 00** (depends only on
> Foundation). Steps use checkbox (`- [ ]`) syntax. Read the overview + the design spec
> (`docs/superpowers/specs/2026-06-22-contacts-and-med-label-scan-design.md`).

**Goal:** A care-team & emergency contacts list — doctor, paramedics, occupational therapist,
pharmacist, others — with one-tap calling, emergency numbers pinned, family/admin editing and
parents view-and-call.

**Architecture:** New `contacts` table + `services.contacts` + a thin `/api/contacts` router
(role-enforced) + a large-format Contacts screen in both layouts. Reuses Plan 00 primitives.

**Tech Stack:** Same as Plans 00–01.

## Global Constraints

(Full list in overview.) Active here: accessibility tokens (≥60px tap targets, **icon + text**,
never color alone, big confirm dialogs); server-side role enforcement; single service layer.

**Shared interfaces consumed (Plan 00/01):** `Base`, `get_db`, `current_user`, `require_role`,
`Person`, `PersonOut`; frontend `api`, `useAuth`, `<Button>`, `<PersonBadge>`, `<ConfirmDialog>`,
`<Confirmation>`, the layout `tab` pattern.

---

### Task 1: Contact model + service + migration

**Files:**
- Create: `backend/app/models/contact.py`, `backend/app/services/contacts.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_contacts_service.py`

**Interfaces:**
- Produces:
  - `Contact` ORM: `id:int`, `name:str`, `role:str` (`doctor|paramedics|occupational_therapist|
    pharmacist|other`), `phone:str`, `address:str|None`, `notes:str|None`,
    `person_id:int|None` (FK people; None ⇒ both/family), `is_emergency:bool`, `sort_order:int`.
  - `CONTACT_ROLES` tuple.
  - `services.contacts.list_contacts(db) -> list[Contact]` (emergency first, then sort_order, then name).
  - `create(db, *, name, role, phone, address=None, notes=None, person_id=None, is_emergency=False,
    sort_order=0) -> Contact`; `update(db, contact_id, **fields) -> Contact | None`;
    `delete(db, contact_id) -> bool`.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_contacts_service.py`

```python
from app.services import contacts

def test_emergency_sorts_first_then_name(db):
    contacts.create(db, name="Dr. Lee", role="doctor", phone="555-1000", sort_order=1)
    contacts.create(db, name="Ambulance", role="paramedics", phone="911", is_emergency=True)
    contacts.create(db, name="Aimee OT", role="occupational_therapist", phone="555-2000", sort_order=0)
    names = [c.name for c in contacts.list_contacts(db)]
    assert names[0] == "Ambulance"                 # emergency pinned first
    assert names[1:] == ["Aimee OT", "Dr. Lee"]    # then by sort_order

def test_update_and_delete(db):
    c = contacts.create(db, name="Pharmacy", role="pharmacist", phone="555-3000")
    contacts.update(db, c.id, phone="555-3001")
    assert contacts.list_contacts(db)[0].phone == "555-3001"
    assert contacts.delete(db, c.id) is True
    assert contacts.list_contacts(db) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_contacts_service.py -v`
Expected: FAIL — no module `app.models.contact`.

- [ ] **Step 3: Write `backend/app/models/contact.py`**

```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

CONTACT_ROLES = ("doctor", "paramedics", "occupational_therapist", "pharmacist", "other")

class Contact(Base):
    __tablename__ = "contacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)
    phone: Mapped[str] = mapped_column(nullable=False)
    address: Mapped[str | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    is_emergency: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
```

Append to `__init__.py`: `from app.models.contact import Contact  # noqa: F401`

- [ ] **Step 4: Write `backend/app/services/contacts.py`**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.contact import Contact

def list_contacts(db: Session) -> list[Contact]:
    return list(db.scalars(
        select(Contact).order_by(Contact.is_emergency.desc(), Contact.sort_order, Contact.name)))

def create(db: Session, *, name, role, phone, address=None, notes=None,
           person_id=None, is_emergency=False, sort_order=0) -> Contact:
    c = Contact(name=name, role=role, phone=phone, address=address, notes=notes,
                person_id=person_id, is_emergency=is_emergency, sort_order=sort_order)
    db.add(c); db.commit(); db.refresh(c)
    return c

def update(db: Session, contact_id: int, **fields) -> Contact | None:
    c = db.get(Contact, contact_id)
    if c is None: return None
    for k, v in fields.items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

def delete(db: Session, contact_id: int) -> bool:
    c = db.get(Contact, contact_id)
    if c is None: return False
    db.delete(c); db.commit()
    return True
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_contacts_service.py -v`
Expected: PASS (both).

- [ ] **Step 6: Generate migration + commit**

Run: `cd backend && alembic revision --autogenerate -m "contacts table" && alembic upgrade head`

```bash
git add backend/app/models/contact.py backend/app/models/__init__.py \
        backend/app/services/contacts.py backend/tests/test_contacts_service.py backend/migrations/versions
git commit -m "feat(contacts): model and service with emergency-first ordering"
```

---

### Task 2: Contacts router (role-enforced) + schema + seed

**Files:**
- Create: `backend/app/schemas/contact.py`, `backend/app/routers/contacts.py`
- Modify: `backend/app/main.py`, `backend/app/seed.py`
- Test: `backend/tests/test_contacts_api.py`

**Interfaces:**
- Produces REST:
  - `GET /api/contacts` → `list[ContactOut]` (any authed role).
  - `POST /api/contacts` / `PUT /api/contacts/{id}` / `DELETE /api/contacts/{id}` —
    **admin or family** (`require_role("admin", "family")`); parents get **403**.
  - Seed adds the family doctor as an example.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_contacts_api.py`

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

def test_parent_can_view_not_edit(env):
    _login(env, "admin")
    assert env.post("/api/contacts", json={"name": "Dr. Lee", "role": "doctor", "phone": "555-1000"}).status_code == 200
    _login(env, "mom")
    assert env.get("/api/contacts").status_code == 200
    assert env.post("/api/contacts", json={"name": "x", "role": "other", "phone": "1"}).status_code == 403

def test_invalid_role_rejected(env):
    _login(env, "admin")
    assert env.post("/api/contacts", json={"name": "x", "role": "wizard", "phone": "1"}).status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_contacts_api.py -v`
Expected: FAIL — no module `app.routers.contacts`.

- [ ] **Step 3: Write `backend/app/schemas/contact.py`**

```python
from pydantic import BaseModel

class ContactIn(BaseModel):
    name: str
    role: str            # doctor | paramedics | occupational_therapist | pharmacist | other
    phone: str
    address: str | None = None
    notes: str | None = None
    person_id: int | None = None
    is_emergency: bool = False
    sort_order: int = 0

class ContactOut(BaseModel):
    id: int
    name: str
    role: str
    phone: str
    address: str | None
    notes: str | None
    person_id: int | None
    is_emergency: bool
    class Config: from_attributes = True
```

- [ ] **Step 4: Write `backend/app/routers/contacts.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_role
from app.models.contact import CONTACT_ROLES
from app.schemas.contact import ContactIn, ContactOut
from app.services import contacts as svc

router = APIRouter(prefix="/api/contacts", tags=["contacts"])
_editor = require_role("admin", "family")

@router.get("", response_model=list[ContactOut])
def list_(db: Session = Depends(get_db), _=Depends(current_user)):
    return svc.list_contacts(db)

@router.post("", response_model=ContactOut)
def create(body: ContactIn, db: Session = Depends(get_db), _=Depends(_editor)):
    if body.role not in CONTACT_ROLES:
        raise HTTPException(422, f"role must be one of: {', '.join(CONTACT_ROLES)}")
    return svc.create(db, **body.model_dump())

@router.put("/{contact_id}", response_model=ContactOut)
def update(contact_id: int, body: ContactIn, db: Session = Depends(get_db), _=Depends(_editor)):
    if body.role not in CONTACT_ROLES:
        raise HTTPException(422, f"role must be one of: {', '.join(CONTACT_ROLES)}")
    c = svc.update(db, contact_id, **body.model_dump())
    if c is None: raise HTTPException(404, "Contact not found")
    return c

@router.delete("/{contact_id}")
def delete(contact_id: int, db: Session = Depends(get_db), _=Depends(_editor)):
    if not svc.delete(db, contact_id): raise HTTPException(404, "Contact not found")
    return {"ok": True}
```

Wire in `main.py`: `from app.routers import contacts` + `app.include_router(contacts.router)`.

- [ ] **Step 5: Extend `backend/app/seed.py`** — add an example contact (guard on count)

```python
# inside seed(), after example content; needs: from app.services import contacts as contacts_svc
from app.models.contact import Contact as _Contact
from sqlalchemy import select as _sel
if db.scalar(_sel(_Contact)) is None:
    contacts_svc.create(db, name="Dr. Lee (Family Doctor)", role="doctor",
                        phone="555-0100", is_emergency=False, sort_order=0)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/test_contacts_api.py -v`
Expected: PASS (both).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/contact.py backend/app/routers/contacts.py backend/app/main.py \
        backend/app/seed.py backend/tests/test_contacts_api.py
git commit -m "feat(contacts): role-enforced router and seeded example contact"
```

---

### Task 3: Frontend — Contacts screen (tap-to-call, emergency pinned)

**Files:**
- Create: `frontend/src/screens/Contacts.tsx`
- Modify: `frontend/src/parent/ParentLayout.tsx`, `frontend/src/admin/AdminLayout.tsx`
- Test: `frontend/src/screens/Contacts.test.tsx`

**Interfaces:**
- Consumes: `/api/contacts` (+ admin/family POST/PUT/DELETE).
- Produces: `<Contacts>` — emergency group first (icon + "Emergency" label), then the rest; each card
  has a full-width **"📞 Call"** `tel:` button (≥60px), role as **icon + text** badge, address as a
  Maps link, large notes. Admin/family see add + delete (delete via `ConfirmDialog`); parents view + call only.

- [ ] **Step 1: Write the failing test** — `frontend/src/screens/Contacts.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Contacts } from "./Contacts";
import { api } from "../api/client";
import * as auth from "../lib/auth";

vi.mock("../api/client");
beforeEach(() => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { role: "parent" } } as any);
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, name: "Ambulance", role: "paramedics", phone: "911", address: null, notes: null,
      person_id: null, is_emergency: true },
    { id: 2, name: "Dr. Lee", role: "doctor", phone: "555-0100", address: null, notes: null,
      person_id: null, is_emergency: false },
  ]);
});

describe("Contacts", () => {
  it("pins emergency contacts and renders tap-to-call tel: links; hides edit for parent", async () => {
    render(<Contacts />);
    await waitFor(() => screen.getByText("Ambulance"));
    expect(screen.getByText(/Emergency/i)).toBeTruthy();
    const call = screen.getByRole("link", { name: /call ambulance/i }) as HTMLAnchorElement;
    expect(call.getAttribute("href")).toBe("tel:911");
    expect(screen.queryByRole("button", { name: /add contact/i })).toBeNull();  // parent: no edit
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/screens/Contacts.test.tsx`
Expected: FAIL — cannot resolve `./Contacts`.

- [ ] **Step 3: Write `frontend/src/screens/Contacts.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface Contact { id: number; name: string; role: string; phone: string;
  address: string | null; notes: string | null; person_id: number | null; is_emergency: boolean; }

const ROLE: Record<string, { icon: string; label: string }> = {
  doctor: { icon: "🩺", label: "Doctor" },
  paramedics: { icon: "🚑", label: "Paramedics" },
  occupational_therapist: { icon: "🧑‍⚕️", label: "Occupational Therapist" },
  pharmacist: { icon: "💊", label: "Pharmacist" },
  other: { icon: "📇", label: "Other" },
};

function Card({ c, canEdit, onDelete }: { c: Contact; canEdit: boolean; onDelete: (c: Contact) => void }) {
  const r = ROLE[c.role] ?? ROLE.other;
  return (
    <div className="border-4 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-big font-bold flex-1">{c.name}</span>
        <span className="text-base font-semibold border-2 rounded-xl px-3 py-1">{r.icon} {r.label}</span>
      </div>
      {c.notes && <p className="text-base">{c.notes}</p>}
      <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}
         className="min-h-touch rounded-2xl bg-confirm text-paper text-big font-bold
                    inline-flex items-center justify-center gap-3">
        📞 Call {c.name}</a>
      {c.address && (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noopener"
           className="text-base underline">📍 {c.address}</a>
      )}
      {canEdit && (
        <button onClick={() => onDelete(c)} className="min-h-touch px-4 border-4 rounded-xl text-base self-start">
          🗑 Remove</button>
      )}
    </div>
  );
}

export function Contacts() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "family";
  const [list, setList] = useState<Contact[]>([]);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", role: "doctor", phone: "", is_emergency: false });

  async function load() { setList(await api.get<Contact[]>("/api/contacts")); }
  useEffect(() => { void load(); }, []);
  async function add() {
    if (!form.name || !form.phone) return;
    await api.post("/api/contacts", form);
    setForm({ name: "", role: "doctor", phone: "", is_emergency: false }); await load();
  }
  async function remove(c: Contact) {
    setToDelete(null);
    await fetch(`/api/contacts/${c.id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  const emergency = list.filter(c => c.is_emergency);
  const rest = list.filter(c => !c.is_emergency);
  return (
    <div className="p-6 flex flex-col gap-6">
      <h2 className="text-huge font-bold">Contacts</h2>
      {emergency.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-big font-bold">🚨 Emergency</h3>
          {emergency.map(c => <Card key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />)}
        </section>
      )}
      <section className="flex flex-col gap-3">
        {rest.map(c => <Card key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />)}
      </section>
      {canEdit && (
        <div className="border-4 rounded-2xl p-4 flex flex-col gap-3 max-w-xl">
          <input className="text-big p-3 border-4 rounded-xl" placeholder="Name"
                 value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="text-big p-3 border-4 rounded-xl" placeholder="Phone"
                 value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <select className="text-big p-3 border-4 rounded-xl" value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="text-big flex items-center gap-3">
            <input type="checkbox" className="w-8 h-8" checked={form.is_emergency}
                   onChange={e => setForm({ ...form, is_emergency: e.target.checked })} /> 🚨 Emergency contact
          </label>
          <Button onClick={add} icon={<span aria-hidden>＋</span>}>Add contact</Button>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} title="Remove this contact?" body={toDelete?.name}
        confirmLabel="Remove" onConfirm={() => toDelete && remove(toDelete)} onCancel={() => setToDelete(null)} />
    </div>
  );
}
```

- [ ] **Step 4: Mount in both layouts** — add a `contacts` tab to `ParentLayout.tsx` and
  `AdminLayout.tsx`: `{tab === "contacts" && <Contacts />}` and a nav button labeled "Contacts".

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/screens/Contacts.test.tsx`
Expected: PASS.

- [ ] **Step 6: Build + commit**

Run: `cd frontend && npm run build` (strict typecheck clean).

```bash
git add frontend/src
git commit -m "feat(frontend): contacts screen with tap-to-call and pinned emergency group"
```

---

## Self-Review

**Spec coverage (Contacts):**
- Care-team + emergency roles (doctor, paramedics, OT, pharmacist, other) → `CONTACT_ROLES` (Task 1).
- One-tap calling → `tel:` button ≥60px (Task 3).
- Emergency pinned + obvious (icon + "Emergency" label, not color alone) → Tasks 1 (ordering), 3 (group).
- Family/admin edit, **parents view + call only**, server-enforced → `require_role("admin","family")` (Task 2), role-gated UI (Task 3); test asserts parent 403 + hidden controls.
- Person tagging optional → `person_id` (Task 1); shown via badge when present.
- Big confirm on delete; never color-alone; large text → Task 3.
- Non-empty first open → seeded family doctor (Task 2).

**Placeholder scan:** none — complete code throughout.

**Type consistency:** `Contact` fields identical across model, `ContactOut`, and the TS `Contact`
interface. `role` values consistent model→schema→UI (`doctor|paramedics|occupational_therapist|
pharmacist|other`). `require_role("admin","family")` matches the established signature.

**Optional later:** MCP `familyhub_list_contacts` / `familyhub_add_contact` (thin wrappers over
`services.contacts`) — not required now; the service layer is ready if wanted.
