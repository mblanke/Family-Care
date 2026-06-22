# family-hub

Self-hosted family care-coordination app. Runs under `/opt/stacks/family-hub/` on atlas,
reachable only over Tailscale (`*.tail8d54ec.ts.net`).

## Bring it up

> **Note:** The MCP service is a placeholder stub added in a later milestone. Only `db` and `api`
> are functional in this release. The `mcp` service block exists in `docker-compose.yml` but its
> implementation ships in a later plan.

```bash
cp .env.example .env        # then edit secrets (SESSION_SECRET, passwords, MCP_TOKEN)
docker compose up -d --build db api    # do NOT include mcp — it has no code yet
docker compose exec api python -m app.seed   # creates admin + Dad/Mom (idempotent)
```

App: `http://<atlas-tailscale-ip>:8080` · MCP (future): `http://<atlas-tailscale-ip>:8765`

## Accounts

The admin is bootstrapped from `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env`. Create family and
parent accounts from the admin UI (added in v1 core). Roles: `admin` / `family` / `parent`.

## Data & backup

All data is in the Postgres `pgdata` named volume. Back up with:
```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```
Restore: `cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.

## Install on each iPad (verify manually)

Open the Tailscale URL in Safari → Share → Add to Home Screen. Opens full-screen (PWA).

> **Manual step:** This requires an iPad with Safari and access to the Tailscale network.
> Verify: (1) open `http://<atlas-tailscale-ip>:8080` in Safari, (2) tap Share → Add to Home Screen,
> (3) confirm the app opens standalone (no browser chrome) from the home screen icon.

## Login smoke test (verify manually in browser)

> **Manual step:** Open `http://<atlas-tailscale-ip>:8080` in a browser, log in as admin,
> toggle font size (page text should grow and persist after reload), confirm
> `APP_DISPLAY_NAME` (default: "Home Board") shows in the header.

## v1 features

Today screen (default), shared schedule with ride flags + the monthly Bank-bills routine,
a driver roll-up, to-do and grocery (Costco/Grocery/All) lists parents manage themselves,
and birthday reminders. Parent accounts get a simplified Today-first layout; admin/family
add and edit (admin add/edit works on iPhone width too).

### Screens and capabilities

| Screen | Who sees it | Notes |
|---|---|---|
| **Today** | everyone | Appointments today, open to-dos, upcoming birthdays (within 14 days) |
| **Schedule** | admin + family | Week view with ride-flag badge; admin also gets month view |
| **Driver roll-up** | admin + family | "What am I driving this week" — appointments needing a ride |
| **To-do** | everyone | Parents add/check/delete; big visual confirmation banner (~6s) |
| **Grocery** | everyone | Costco / Grocery / All toggle; qty stepper; clear-checked |
| **Birthdays** | admin + family | Add/edit upcoming birthdays; surfaced on Today |
| **Accounts** | admin only | Create family + parent accounts; not visible to family/parent |

### Role table

| Role | Layout | Can do |
|---|---|---|
| `admin` | Full nav (Today + Schedule + month + Accounts) | Everything |
| `family` | Full nav minus Accounts | Add/edit appointments, birthdays; manage to-dos + grocery |
| `parent` | Today-first, no nav bar | Manage to-dos + grocery only |

### Manual verification steps

> The steps below require an iPad/browser on the Tailscale network and cannot be automated.

- **Parent login** — lands on Today with no navigation; sees Cardiology (ride badge) and upcoming birthday.
- **Parent to-do/grocery** — add/check/delete a to-do and grocery item; big visual confirmation banner appears and stays ~6s; checked grocery items drop to the bottom; cannot see Schedule/Accounts/month.
- **Grocery filters** — Costco | Grocery | All toggle filters correctly; qty stepper works.
- **Family login** — can add an appointment + birthday; cannot open Accounts (403 / hidden).
- **Admin login** — Schedule shows driver roll-up; month view visible; can create family/parent accounts.
- **Font toggle** — enlarges text and persists after reload (stored per user).
- **PWA** — Add to iPad home screen (Safari Share → Add to Home Screen) → opens standalone full-screen.

## v1.1 — care tracking

Per-person medication record with an append-only change history (admin maintains the regimen;
family and parents view only) and a blood-pressure log with an optional doctor-entered target and
a neutral two-line trend chart. These are records to share with a clinician — the app gives no
medical advice and never decides what is "normal".

The BP screen includes a **Print / Save PDF** link that opens a plain HTML summary of recent
readings (including the attributed doctor target if set) in a new tab, ready for browser Print →
Save as PDF to hand to a clinician.

## Migrations

Schema changes ship as Alembic migrations and run automatically on `api` container start
(`alembic upgrade head`). To add one:
```bash
docker compose exec api alembic revision --autogenerate -m "msg"
```
