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

## Migrations

Schema changes ship as Alembic migrations and run automatically on `api` container start
(`alembic upgrade head`). To add one:
```bash
docker compose exec api alembic revision --autogenerate -m "msg"
```
