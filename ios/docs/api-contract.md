# family-hub REST contract (as consumed by the iOS app)

Audited from `backend/app/routers/*` + `backend/app/schemas/*` (July 2026).
Everything is JSON under `/api/*` unless noted. **No trailing slashes** — they fall
through to the SPA catch-all and return HTML 200. Unknown non-`/api` paths also
return HTML 200, never a JSON 404.

## Auth
- `POST /api/auth/login {username, password}` → `{user}` + `Set-Cookie: fh_session`
  (signed, 30-day, no Secure flag, SameSite=Lax; no CSRF anywhere)
- `POST /api/auth/logout` → `{ok}`
- `GET /api/auth/me` → `{user, app_display_name}`
- `PUT /api/auth/me/font-scale {font_scale: "normal"|"large"}` → `{ok}`
- Errors: 401 `{"detail":"Not authenticated"}`, 403 `{"detail":"Forbidden"}`, 422 pydantic

Roles: `admin | family | parent`. Server enforces per route; UI gating is cosmetic.

## Datetime convention
All datetimes are **naive ISO strings rendered verbatim** (`frontend/src/lib/format.ts`).
Appointments are local wall-clock end-to-end. Server-generated stamps (BP `taken_at`,
history `recorded_at`) are naive UTC — a web quirk mirrored, not fixed.

## Endpoints by screen
| Screen | Endpoints |
|---|---|
| Today | `GET /api/today` → `{appointments, rides_today, open_todos, upcoming_birthdays}` (birthdays ≤14d) |
| Schedule | `GET /api/week?start=` → `{week_start, days[7], driver_runs}` |
| Month | `GET /api/appointments?start=&end=` (both required) → `[Occurrence]` |
| Appointments | `POST /api/appointments` (AppointmentIn), `PUT /api/appointments/{id}`, `POST /api/appointments/{id}/cancel` (soft; no DELETE, no single-GET). Monthly recurrence expands server-side; occurrences carry `appointment_id`, repeated for recurring | admin+family |
| To-do | `GET/POST /api/todos`, `PUT /api/todos/{id}`, `POST /api/todos/{id}/done {done}`, `DELETE /api/todos/{id}` | any role |
| Grocery | `GET /api/grocery?store=`, `POST /api/grocery {name, store, qty}`, `POST .../{id}/check {checked}`, `POST .../{id}/qty {qty}` (floors at 1), `PUT .../{id} {name}`, `DELETE .../{id}`, `POST /api/grocery/clear-checked` → `{removed}`. Item store: `costco|grocery|either`; filter uses `all` (unfiltered) | any role |
| Birthdays | `GET /api/birthdays`, `GET /api/birthdays/upcoming?within=`, `POST /api/birthdays {name, month, day, year?}`, `DELETE .../{id}` (no PUT — edit = delete+re-add) | write: admin+family |
| People | `GET /api/people` → `[{id, name, slug, color}]` (read-only) |
| Medications | `GET /api/people/{pid}/medications` → `{regimen, history}`; `POST` same path (MedIn, incl. `scan_id`/`keep_photo`); `POST /api/medications/{mid}/dose {new_dose, reason?}`; `POST /api/medications/{mid}/stop {reason?}`; `POST /api/people/{pid}/medications/note {summary}`. History is append-only; dose is free text, never interpreted | write: admin only |
| Label scan | `POST /api/people/{pid}/medications/scan` — multipart, field **`file`** → `{scan_id, candidates[{name, dose, slot, prescriber}]}`. Writes nothing; unavailable scanner surfaces as raw **500** | admin only |
| BP | `GET /api/people/{pid}/bp?days=` (0=all) → `{readings, target?}`; `POST` same path (BpIn) — any role; `PUT /api/people/{pid}/bp/target` (upsert) — admin. `status` per reading only when target set: `within|above|below`, purely factual |
| BP export | `GET /api/people/{pid}/bp/export?days=` returns **HTML**, not JSON — the app renders its own PDF from `/bp` instead |
| Accounts | `GET/POST /api/accounts`, `POST /api/accounts/{id}/deactivate`. No delete, password change, or reactivate. Dup username → 409 | admin only |
| Contacts | `GET/POST /api/contacts`, `PUT/DELETE /api/contacts/{id}`. Roles: `doctor|paramedics|occupational_therapist|pharmacist|other`; `is_emergency` pins to top | write: admin+family |
| Health | `GET /healthz` → `{status}` (no auth) |
