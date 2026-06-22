# Design — Contacts & Medication-Label Scan

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — ready for implementation planning
**Adds to:** the family-hub build (see `docs/superpowers/plans/2026-06-22-family-hub-overview.md`)

Two independent additions to family-hub. They share nothing except the existing People entity,
roles, and accessibility tokens, so they become two separate plans:

- **Plan 04 — Contacts** (depends only on Foundation / Plan 00).
- **Plan 05 — Medication-label scan** (depends on Care Tracking / Plan 02).

Both obey every global constraint in the overview (accessibility tokens, server-side role
enforcement, single service layer shared by REST + MCP, no analytics, Tailscale-only, `.env` config,
clinical boundaries).

---

## Part A — Contacts

### Purpose
A place to keep the care team and emergency numbers — family doctor, paramedics/emergency,
occupational therapist, pharmacist, others — reachable in **one tap-to-call** from the parents'
iPad, with emergency numbers pinned and obvious.

### Data model
New table `contacts` (don't over-normalize):
- `id: int`
- `name: str`
- `role: str` — one of `doctor | paramedics | occupational_therapist | pharmacist | other`
- `phone: str`
- `address: str | None`
- `notes: str | None`
- `person_id: int | None` — FK people; `None` ⇒ "Both / family" (whose care team this is)
- `is_emergency: bool` — pins the card to the top with an Emergency label
- `sort_order: int`

### Service & API
- `services.contacts`: `list_contacts(db) -> list[Contact]` (emergency first, then `sort_order`, then name);
  `create/update/delete`.
- REST `/api/contacts`: `GET` (any authed role); `POST/PUT/DELETE` require **admin or family**
  (`require_role("admin", "family")`). Parents are **view + call only**, enforced server-side.

### UI (both layouts; parent-facing must be maximally accessible)
- A **Contacts** screen of large cards. Each card: name, the role as an **icon + text** badge
  (never color alone), and a full-width **"📞 Call <name>"** button that is a `tel:` link
  (≥ 60×60px). Address, if present, is a tap target that opens Maps; notes shown in large text.
- **Emergency** contacts (`is_emergency`) render first, in a clearly-labeled "Emergency" group with
  an icon + the word "Emergency" (icon + text, not color).
- Person tagging shown with `<PersonBadge>` (color + name) when a contact belongs to Dad or Mom.
- Admin/family see add/edit/delete controls (delete behind the big `ConfirmDialog`); parents do not.
- Seeded with the family doctor as an example so the screen isn't empty.

### Boundaries / notes
- No external directory lookup, no auto-dialing — `tel:` only hands the number to the OS dialer.
- No clinical content; this is contact info only.

### Testing
- Service: ordering (emergency first), CRUD.
- API: parent gets 403 on POST/PUT/DELETE, 200 on GET; family can create.
- Frontend: emergency group renders first; call button is a `tel:` link; parent view hides edit controls.

---

## Part B — Medication-label scan (pre-fill only)

### Purpose
Let the admin photograph a **pharmacy label/printout** and have its text pre-fill the medication
form, instead of typing it. Speeds entry; never replaces human judgment.

### The hard rule (enforced structurally, not just by copy)
The scan **never writes to the database.** It extracts text and returns *candidates* that pre-fill
the existing admin med form. The admin reviews and edits every field and confirms; only then does the
**existing** `medications.add_med` / `change_dose` path persist anything. The vision prompt is
instructed to **transcribe only — never interpret, never compute or infer a dose, never flag
interactions.** This keeps the feature inside the spec's "record, not advice" boundary. The whole
feature is **admin-only** (consistent with medication edits being admin-only).

### Architecture — pluggable extractor
- Interface `MedicationLabelExtractor.extract(image_bytes: bytes) -> list[ExtractedMed]`
  where `ExtractedMed = {name: str, dose: str, slot: str, prescriber: str | None}`.
- Shipped implementation `LlmRouterExtractor`: POSTs the image to the household `llm-router` on the
  hosted lane (family data has **no sovereignty constraint** per CLAUDE.md, so hosted vision is
  allowed). Config in `.env`: `LLM_ROUTER_URL`, `LLM_ROUTER_TOKEN`, `LLM_ROUTER_VISION_MODEL`.
  Parses structured JSON back into `ExtractedMed`s.
- The interface keeps the engine swappable and — importantly — **mockable**: tests inject a fake
  extractor and never touch the network.

### Flow
1. **Scan (no DB write):** `POST /api/people/{pid}/medications/scan` (admin) — multipart image upload.
   Calls the extractor, returns `{scan_id, candidates: [ExtractedMed…]}`. The uploaded image is
   stashed in a short-TTL temp area keyed by `scan_id` (so the photo can be kept later without
   re-uploading). Nothing is persisted to the regimen.
2. **Review:** the admin Medications screen shows the candidates pre-filled and editable (name, dose,
   slot picker, prescriber). The admin corrects anything wrong and can tick **"Keep photo with this
   entry"** (off by default).
3. **Confirm (the real write):** the existing add/change endpoint is called with optional
   `scan_id` + `keep_photo`. If `keep_photo`, the temp image is moved into a persistent `med-photos`
   volume and its path recorded on the resulting `medication_changes` row (new nullable
   `photo_path` column), surfaced on the history timeline. If not kept, the temp image is discarded.
   Temp images also expire on their own so abandoned scans don't accumulate.

### Image retention
- Default: **discarded** after extraction.
- Opt-in per entry: stored in the `med-photos` volume, linked from the medication-change history
  (useful provenance to show a doctor/pharmacist). Documented in the backup path.

### UI
- A **"📷 Scan label"** button on the admin Medications screen → iPad camera / file input
  (`<input type="file" accept="image/*" capture="environment">`) → review-and-confirm form.
- Family and parents never see this control; the scan + add endpoints reject them server-side.

### Boundaries / notes
- Transcription-only prompt; no dose math; no interaction checks; no "normal/abnormal" judgments.
- Mis-reads are expected — the review step is mandatory and non-skippable; nothing auto-commits.
- Manual entry remains fully available; the scan is an optional aid, so **core function never
  requires egress** (the household convention holds).

### Testing
- Extractor interface with a fake impl (no network).
- `POST .../scan` returns candidates and **writes nothing** to the regimen (assert empty after scan).
- Confirm-with-`keep_photo` stores the file and sets `photo_path`; confirm-without discards it.
- Admin-only: family + parent get 403 on `scan` and on the photo-keeping add path.
- Dose strings round-trip **verbatim** (no transformation).

---

## Plan impact
- New: `docs/superpowers/plans/2026-06-22-family-hub-04-contacts.md`
- New: `docs/superpowers/plans/2026-06-22-family-hub-05-med-label-scan.md`
- Update: overview phase map gets two entries; data-model line gains `contacts`; `medication_changes`
  gains `photo_path`; `.env` gains the `LLM_ROUTER_*` keys; MCP optionally gains a
  `familyhub_add_contact` / `familyhub_list_contacts` pair later (not required now).
