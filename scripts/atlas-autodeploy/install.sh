#!/usr/bin/env bash
# Home Board auto-update for atlas.
#
# Run once on atlas:
#   curl -fsSL https://raw.githubusercontent.com/mblanke/family-care/main/scripts/atlas-autodeploy/install.sh | sudo bash
#
# Installs a systemd timer that checks GitHub every 5 minutes. When main has a new
# commit it copies the code into the stack directory (never touching .env or backups)
# and runs `docker compose up -d --build`. The API container applies database
# migrations on start. No keys or secrets are needed: the repository is public.
#
# Settings live in /etc/default/family-hub-update. Remove with:
#   sudo systemctl disable --now family-hub-update.timer
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo." >&2
  exit 1
fi

STACK_DIR_DEFAULT=/opt/stacks/family-hub
if [ ! -f /etc/default/family-hub-update ]; then
  cat > /etc/default/family-hub-update <<CONF
# Where docker-compose.yml and .env live
STACK_DIR=${STACK_DIR_DEFAULT}
# GitHub repository and branch to follow
REPO=mblanke/family-care
BRANCH=main
CONF
fi
# shellcheck disable=SC1091
. /etc/default/family-hub-update

if [ ! -f "$STACK_DIR/docker-compose.yml" ] || [ ! -f "$STACK_DIR/.env" ]; then
  echo "Expected docker-compose.yml and .env in $STACK_DIR." >&2
  echo "Edit STACK_DIR in /etc/default/family-hub-update and run this again." >&2
  exit 1
fi
for tool in curl tar docker; do
  command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }
done

cat > /usr/local/bin/family-hub-update <<'UPDATER'
#!/usr/bin/env bash
# Pulls the latest Home Board code from GitHub and rebuilds when main changes.
set -euo pipefail
. /etc/default/family-hub-update
STATE_DIR=/var/lib/family-hub-update
mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
flock -n 9 || { echo "Another update is running."; exit 0; }

LATEST=$(curl -fsSL -H "Accept: application/vnd.github.sha" \
  "https://api.github.com/repos/$REPO/commits/$BRANCH") || { echo "Could not reach GitHub; will retry."; exit 0; }
case "$LATEST" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;;
  *) echo "Unexpected answer from GitHub; will retry."; exit 0 ;;
esac
CURRENT=$(cat "$STATE_DIR/deployed" 2>/dev/null || true)
if [ "$LATEST" = "$CURRENT" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

echo "Updating ${CURRENT:0:7} -> ${LATEST:0:7}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$LATEST" -o "$TMP/src.tgz"

# Unpack over the stack directory. Only files in the repo are written; .env,
# backups and anything else that lives only on atlas are left alone.
tar -xzf "$TMP/src.tgz" -C "$STACK_DIR" --strip-components=1 \
  --exclude='*/.env' --exclude='*/ios' --exclude='*/.github' \
  --exclude='*/backup-*.sql' --exclude='*/*.tgz'

cd "$STACK_DIR"
docker compose up -d --build

ok=0
for _ in $(seq 1 24); do
  if docker compose exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=5)" 2>/dev/null; then
    ok=1; break
  fi
  sleep 5
done
if [ "$ok" -ne 1 ]; then
  echo "API did not become healthy; will try again next run."
  docker compose logs --tail=60 api || true
  exit 1
fi

echo "$LATEST" > "$STATE_DIR/deployed"
echo "Deployed ${LATEST:0:7}."
UPDATER
chmod 755 /usr/local/bin/family-hub-update

cat > /etc/systemd/system/family-hub-update.service <<'UNIT'
[Unit]
Description=Update Home Board from GitHub and rebuild
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/family-hub-update
UNIT

cat > /etc/systemd/system/family-hub-update.timer <<'UNIT'
[Unit]
Description=Check GitHub for Home Board updates every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now family-hub-update.timer
echo "Running the first update now (this rebuilds the stack, a few minutes)..."
systemctl start family-hub-update.service || true
journalctl -u family-hub-update.service -n 20 --no-pager || true
echo
echo "Installed. Check progress any time with: journalctl -u family-hub-update -f"
