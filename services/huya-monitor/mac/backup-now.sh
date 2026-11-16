#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$HOME/Library/Application Support/XiaomiaoLive"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SERVICE_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
"$ROOT/venv/bin/python" "$SERVICE_DIR/scripts/backup_sqlite.py" \
  --database "$ROOT/data/monitor.sqlite3" \
  --directory "$ROOT/backups" --keep 14
