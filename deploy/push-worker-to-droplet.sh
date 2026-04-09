#!/usr/bin/env bash
# Sync worker runtime files from this repo to a DigitalOcean droplet.
# Usage: ./deploy/push-worker-to-droplet.sh user@146.x.x.x
set -euo pipefail

DEST="${1:?Usage: $0 user@DROPLET_IP_OR_HOST}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

echo "Syncing from $ROOT to $DEST:/opt/bofbot/ ..."
ssh "$DEST" "mkdir -p /opt/bofbot/worker /opt/bofbot/fonts /opt/bofbot/deploy/systemd"

RSYNC=(rsync -avz --delete --mkpath)
"${RSYNC[@]}" tiktoked.py requirements.txt requirements-worker.txt config.json "$DEST:/opt/bofbot/"
"${RSYNC[@]}" worker/ "$DEST:/opt/bofbot/worker/"
"${RSYNC[@]}" fonts/ "$DEST:/opt/bofbot/fonts/"

if [[ -d emoji ]]; then
  "${RSYNC[@]}" emoji/ "$DEST:/opt/bofbot/emoji/"
fi

"${RSYNC[@]}" deploy/systemd/bofbot-worker.service "$DEST:/opt/bofbot/deploy/systemd/"

echo ""
echo "On the droplet:"
echo "  1. Ensure /opt/bofbot/.env exists (see deploy/env.worker.example)"
echo "  2. sudo cp /opt/bofbot/deploy/systemd/bofbot-worker.service /etc/systemd/system/"
echo "  3. sudo systemctl daemon-reload && sudo systemctl enable --now bofbot-worker"
