# family-hub — Master Plan & Overview

> **For agentic workers:** This is the index. Implement the numbered plans in order
> (`00-foundation` → `01-core` → `02-care-tracking` → `03-mcp-server`). Each plan is
> self-contained and ends with working, testable software. Use
> `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`
> to implement each plan task-by-task.

**Goal:** A self-hosted, touch-first family web app that helps a son coordinate the care
of two elderly parents (Dad 90, Mom 85) — shared schedule with ride flags, to-do, grocery,
birthdays, a medication record with change history, and a blood-pressure log — installable
as a PWA on iPads and remote-controllable through Claude via an MCP server.

**Architecture:** A FastAPI backend exposes a small REST API and serves the built React SPA
as static files from the same container. All business logic lives in **one service-layer
package** that both the REST handlers and the FastMCP server call — no duplicated logic.
PostgreSQL holds the data, evolved with Alembic migrations. Session auth via signed cookies.
Everything runs as a Docker Compose stack on `atlas`, reachable only over Tailscale.

**Tech Stack:** Python 3.13 · FastAPI · Pydantic v2 · SQLAlchemy 2.x · Alembic · PostgreSQL 16 ·
FastMCP · React 19 · Vite · TypeScript (strict) · Tailwind CSS · vite-plugin-pwa · Docker Compose.

---

## Locked Decisions (chosen where the spec said "your call")

| Area | Decision | Rationale |
|---|---|---|
| Database | **PostgreSQL 16** (not SQLite) | Spec default; durable for years of care history; clean schema evolution |
| Migrations | **Alembic** from day one | v1.1 adds tables additively; no manual edits on a live family DB |
| Frontend serving | **Served by the API container** as static files | Fewest containers; SPA + API same origin → simplest cookie auth |
| MCP process | **Separate container** in the same Compose stack | Clean separation, independent restart; imports the shared service package |
| MCP transport | **streamable HTTP**, bound to Tailscale, token-gated | Remote use from the Claude app is the whole point |
| Auth | **Signed-cookie sessions** (itsdangerous), bcrypt password hashes | Spec: lightweight, role separation, not internet-facing |
| Display name | **Configurable via `.env`** (`APP_DISPLAY_NAME`, default "Home Board") | Spec: let admin set it |
| Font-size toggle | **Persisted per user** (server-side on the `users` row) | Spec: one-tap, persisted per user; survives device swaps |
| Timezone | **Single configured tz** (`APP_TIMEZONE`, default `America/Toronto`); store UTC, render local | Stable IDs + real datetimes → ICS exporter is a thin later add |

These are **decided** — do not re-litigate without a concrete reason (CLAUDE.md rule).

---

## Global Constraints

Every task in every plan implicitly includes these. Exact values copied from the spec.

**Accessibility tokens (minimums, not targets):**
- Base font **20px**; large mode **28px+**; one-tap toggle, persisted per user.
- Touch targets **≥ 60×60px**; spacing between targets **≥ 12px**.
- Contrast: meet/exceed WCAG AA for large text; near-black on near-white. No gray-on-gray.
- Buttons: solid, **text + icon** (never icon-only for primary actions).
- Confirmations: full-width banner/modal with large text — **never a small corner toast**.
- **Never color alone** for meaning — always icon + text label.
- Motion gentle/brief; nothing flashes; parent-facing confirmations stay visible **≥ 6s**.
- No hover-dependent behavior. Touch-first. Landscape + portrait both clean.

**People model:**
- `people` (care recipients) are first-class. Seed exactly **Dad** and **Mom**, extensible to a third.
- Each person has a **distinct color + name** shown together everywhere; color is never the only signal.
- Person-specific items attach to a person or to "both." Filter "Dad | Mom | Both" is one tap.

**Roles (server-side enforcement on every mutating endpoint — not just hidden UI):**
- **admin** — full CRUD on everything incl. medication regimen + accounts + roll-ups + month view.
- **family** — view schedule/lists; add/edit appointments + birthdays; **may log BP**; **view** meds; **cannot** edit meds, manage accounts, or delete others' data.
- **parent** — stripped-down accessible layout (its **own** UI, not hidden buttons): manage to-do + grocery, see today + reminders, **view own meds + BP trend**, optionally log own BP. **Cannot** edit meds, see accounts/month grid.

**Clinical boundaries (hard — the app must never):** compute/suggest doses, recommend changes,
flag interactions, or interpret a regimen or BP reading medically. The **only** exception:
a doctor's BP target range that a **human enters** — readings may be shown within/above/below it,
always attributed to the doctor, factual wording, no pass/fail color, no alerts. No app-decided
"normal." Medication & BP features are **records**, not clinical tools. Append-only history is
never overwritten or deleted; corrections are new entries.

**Build conventions:**
- TypeScript **strict** on the frontend; type hints on the backend.
- Keep the data model small and obvious. Don't over-normalize.
- **Single service layer** shared by REST + MCP. Both are thin adapters.
- Seed script: admin account + Dad/Mom + a few example entries (non-empty first open).
- PWA-installable (manifest + icons + standalone) so it adds to the iPad home screen.
- No analytics, telemetry, or third-party trackers. No cloud egress for core function.
- Secrets in `.env`, never in git. `apt` not `snap` for any host packages.

---

## Whole-System File Tree

```
family-hub/
├── docker-compose.yml                # api, db, mcp services + named volume
├── .env.example                      # documented; real .env is gitignored
├── .gitignore
├── README.md                         # bring-up, accounts, data location, backup, Tailscale URL
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile                    # builds frontend, serves it + API
│   ├── alembic.ini
│   ├── migrations/                   # Alembic versions
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app, static SPA mount, router include
│   │   ├── config.py                 # pydantic-settings; reads .env
│   │   ├── db.py                     # engine, SessionLocal, Base, get_db
│   │   ├── security.py               # password hashing, session cookie signing
│   │   ├── deps.py                   # current_user, require_role(...) dependencies
│   │   ├── models/                   # SQLAlchemy ORM (one file per concern)
│   │   │   ├── __init__.py
│   │   │   ├── person.py
│   │   │   ├── user.py
│   │   │   ├── appointment.py        # (plan 01)
│   │   │   ├── todo.py               # (plan 01)
│   │   │   ├── grocery.py            # (plan 01)
│   │   │   ├── birthday.py           # (plan 01)
│   │   │   ├── medication.py         # (plan 02)
│   │   │   └── bp_reading.py         # (plan 02)
│   │   ├── schemas/                  # Pydantic request/response models, by concern
│   │   ├── services/                 # THE SERVICE LAYER — shared by REST + MCP
│   │   │   ├── __init__.py
│   │   │   ├── people.py
│   │   │   ├── auth.py
│   │   │   ├── appointments.py       # (plan 01)
│   │   │   ├── todos.py              # (plan 01)
│   │   │   ├── grocery.py            # (plan 01)
│   │   │   ├── birthdays.py          # (plan 01)
│   │   │   ├── today.py              # (plan 01) roll-up: today + week + driver view
│   │   │   ├── medications.py        # (plan 02)
│   │   │   └── bp.py                 # (plan 02)
│   │   ├── routers/                  # thin REST adapters over services, by concern
│   │   └── seed.py                   # admin + Dad/Mom + examples
│   └── tests/                        # pytest; mirrors app/ structure
├── mcp/
│   ├── Dockerfile
│   └── server.py                     # FastMCP; imports backend.app.services.* — thin wrapper
└── frontend/
    ├── package.json
    ├── vite.config.ts                # + vite-plugin-pwa
    ├── tsconfig.json                 # strict
    ├── tailwind.config.ts            # accessibility tokens defined ONCE here
    ├── index.html
    ├── public/                       # PWA icons, manifest assets
    └── src/
        ├── main.tsx
        ├── api/                      # typed fetch client
        ├── tokens.css                # CSS vars mirroring Tailwind tokens
        ├── lib/                      # FontSizeContext, auth context, person colors
        ├── components/               # shared accessible primitives (Button, ConfirmDialog, PersonBadge, BigCheckbox…)
        ├── parent/                   # the stripped-down parent layout + screens
        ├── admin/                    # admin/family layout + screens (responsive to iPhone for add/edit)
        └── screens/                  # shared screens (Today, Schedule, Todo, Grocery, Birthdays)
```

---

## Phase Map (the whole build)

Each phase is a separate plan document with full bite-sized TDD tasks.

### Plan 00 — Foundation  → `2026-06-22-family-hub-00-foundation.md`
Repo scaffold, Compose stack, Postgres + Alembic, config, `people` + `users` tables,
password + session auth with server-side role enforcement, the `services` + `routers`
skeleton, the seed script (admin + Dad/Mom), the React/Vite/Tailwind shell with the
accessibility tokens, font-size toggle, login, person colors, and PWA manifest.
**Deliverable:** the stack comes up, you can log in as each role, and you see an empty,
correctly-themed, installable shell.

### Plan 01 — v1 Core  → `2026-06-22-family-hub-01-core.md`
- Today screen (default, huge): today's appointments, ride-needed items, todos, upcoming birthdays.
- Schedule: appointments CRUD with `needs_ride`, the **Bank-bills recurring** item, This-Week agenda, admin month view, driver roll-up.
- To-do list (parents create/edit/check/delete; done area; optional assignee).
- Grocery list with **Costco | Grocery | All** grouping/toggle, store tags, clear-checked, qty stepper.
- Birthdays entity + upcoming-reminder surface.
- The distinct **parent layout** wired across these; admin add/edit responsive to iPhone width.
**Deliverable:** full v1 usable on an iPad mini, PWA-installable, role-correct.

### Plan 02 — v1.1 Care Tracking  → `2026-06-22-family-hub-02-care-tracking.md`
- Medications per person: current regimen + **append-only `medication_changes`** timeline; admin-only edits; family/parent view-only; the "record, not advice" line; light pack-pickup note.
- BP log per person: big 3-field entry, optional doctor target range (within/above/below, factual, no pass/fail color), two-line trend chart (line-style + legend, not color), time-range control, recent list, optional export.
**Deliverable:** care tracking live, clinical boundaries enforced in code + copy.

### Plan 03 — MCP Server  → `2026-06-22-family-hub-03-mcp-server.md`
FastMCP streamable-HTTP server importing the shared service layer. Tools: `familyhub_get_today`,
`_get_week`, `_add_appointment`, `_update_appointment`, `_cancel_appointment`, `_add_todo`,
`_complete_todo`, `_add_grocery_item`, `_check_grocery_item`, `_clear_checked`, `_list_grocery`,
`_add_birthday`, `_list_upcoming_birthdays`, `_log_bp`, `_list_bp`, `_get_medications`,
`_log_medication_change`. Honest annotations (`readOnlyHint`/`destructiveHint`), in-conversation
confirmation for destructive ops, admin scope only, never touches accounts/roles.
**Deliverable:** "add a cardiology appointment for Dad next Thursday at 2, he needs a ride"
works from the Claude app over Tailscale.

### Plan 04 — Contacts  → `2026-06-22-family-hub-04-contacts.md`
A care-team & emergency contacts list (doctor, paramedics, occupational therapist, pharmacist,
other) with one-tap `tel:` calling, emergency numbers pinned, family/admin editing and parents
view-and-call. Depends only on Foundation. See spec
`docs/superpowers/specs/2026-06-22-contacts-and-med-label-scan-design.md`.
**Deliverable:** a large-format, tap-to-call contacts screen in both layouts.

### Plan 05 — Medication-label scan  → `2026-06-22-family-hub-05-med-label-scan.md`
Admin-only: photograph a pharmacy label to **pre-fill** the medication form via the household
`llm-router` hosted vision model. Transcription only — never writes, computes, or interprets;
the admin reviews and confirms every field, and the existing add path does the write. Optional
opt-in photo retention on the append-only history. Depends on Plan 02. Same spec as Plan 04.
**Deliverable:** scan-assisted med entry that stays inside the "record, not advice" boundary.

### Parked (do NOT build now) — external calendar sync
One-way per-person ICS feed first, CalDAV write-back only if ever needed. The foundation's
stable appointment IDs + UTC datetimes keep this a thin later add-on.

---

## Cross-Plan Self-Review (spec coverage check)

| Spec requirement | Covered by |
|---|---|
| Accounts + 3 roles, server-side enforcement | 00 (auth/roles) + every mutating endpoint |
| People labels Dad/Mom, color+name, filter | 00 (people) + used in 01/02 |
| Today screen, ride flags, bank-bills recurring | 01 |
| To-do, grocery w/ store sort, birthdays | 01 |
| Parent stripped-down layout (own layout) | 00 shell + 01 screens |
| Admin add/edit from iPhone width | 01 (responsive admin forms) |
| Medications + append-only history, admin-only | 02 |
| BP log + doctor target + two-line trend, no interpretation | 02 |
| MCP server, shared service layer, honest annotations | 03 (service layer built in 00–02) |
| PWA install on iPad | 00 (manifest/shell) verified in 01 |
| Docker Compose under /opt/stacks, Tailscale-only, .env | 00 |
| Seed script (non-empty first open) | 00 + extended in 01/02/04 |
| README (bring-up, accounts, data, backup, Tailscale URL) | 00, updated each plan |
| Contacts (doctor/paramedics/OT/pharmacist), tap-to-call, emergency pinned | 04 |
| Medication-label scan (admin, transcription-only, review-before-save) | 05 |

No spec requirement is left without a home.

> **Added after initial planning (2026-06-22):** Plans 04 (Contacts) and 05 (Medication-label scan)
> come from `docs/superpowers/specs/2026-06-22-contacts-and-med-label-scan-design.md`. They add the
> `contacts` table, a `medication_changes.photo_path` column, the `LLM_ROUTER_*` env keys, and a
> `medphotos` volume — none of which disturb Plans 00–03.
