#!/usr/bin/env bash
# Safe, local-only launchd deployment for Huya room 156324 on macOS.
set -Eeuo pipefail

[[ "$(uname -s)" == "Darwin" ]] || { echo 'Only supported on macOS.' >&2; exit 1; }
[[ -n "${HOME:-}" ]] || { echo 'Missing HOME.' >&2; exit 1; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SERVICE_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
APP_ROOT="$HOME/Library/Application Support/XiaomiaoLive"
VENV="$APP_ROOT/venv"
DATA_DIR="$APP_ROOT/data"
LOG_DIR="$APP_ROOT/logs"
BACKUP_DIR="$APP_ROOT/backups"
AGENTS_DIR="$HOME/Library/LaunchAgents"
MAIN_PLIST="$AGENTS_DIR/com.tanchensiyi.huya-monitor.plist"
BACKUP_PLIST="$AGENTS_DIR/com.tanchensiyi.huya-monitor-backup.plist"

if [[ -n "${XIAOMIAO_PYTHON:-}" ]]; then
  PYTHON_BIN="$XIAOMIAO_PYTHON"
else
  PYTHON_BIN=''
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert sys.version_info >= (3,11)' >/dev/null 2>&1; then
      PYTHON_BIN="$(command -v "$candidate")"
      break
    fi
  done
fi
if [[ -z "$PYTHON_BIN" ]] || ! "$PYTHON_BIN" -c 'import sys; assert sys.version_info >= (3,11)' >/dev/null 2>&1; then
  echo 'Python >=3.11 is required. Install with: brew install python@3.12' >&2
  exit 1
fi
command -v launchctl >/dev/null || { echo 'launchctl missing.' >&2; exit 1; }

umask 077
mkdir -p "$APP_ROOT" "$DATA_DIR" "$LOG_DIR" "$BACKUP_DIR" "$AGENTS_DIR"
if [[ ! -f "$VENV/pyvenv.cfg" ]]; then
  "$PYTHON_BIN" -m venv "$VENV"
fi
"$VENV/bin/python" -m pip install --disable-pip-version-check -r "$SERVICE_DIR/requirements.txt"
"$VENV/bin/python" -m compileall -q "$SERVICE_DIR/app" "$SERVICE_DIR/scripts"

# Use plistlib rather than interpolating unescaped paths into XML.
"$VENV/bin/python" - "$SERVICE_DIR" "$VENV" "$DATA_DIR" "$LOG_DIR" "$BACKUP_DIR" "$MAIN_PLIST" "$BACKUP_PLIST" <<'PY'
import plistlib
import sys
from pathlib import Path
service, venv, data, logs, backups, main, backup = map(Path, sys.argv[1:])
prefix = str(venv / 'bin' / 'python')
common = {
    'WorkingDirectory': str(service),
    'ProcessType': 'Background',
    'StandardOutPath': str(logs / 'collector.stdout.log'),
    'StandardErrorPath': str(logs / 'collector.stderr.log'),
}
pl = {
    **common,
    'Label': 'com.tanchensiyi.huya-monitor',
    'ProgramArguments': [prefix, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                         '--port', '8765', '--workers', '1', '--log-level', 'warning'],
    'EnvironmentVariables': {
        'DATA_DIR': str(data), 'DEMO_MODE': '0', 'HUYA_CHAT_ENABLED': '1',
        'HUYA_CHAT_PROTOCOL': 'topic', 'POLL_SECONDS': '60',
        'RETENTION_DAYS': '90', 'CORS_ORIGINS': 'https://tanchensiyi.com',
        'PYTHONUNBUFFERED': '1',
    },
    'RunAtLoad': True,
    'KeepAlive': True,
    'ThrottleInterval': 20,
}
with main.open('wb') as fh:
    plistlib.dump(pl, fh, sort_keys=False)
pl = {
    'Label': 'com.tanchensiyi.huya-monitor-backup',
    'ProgramArguments': [prefix, str(service / 'scripts' / 'backup_sqlite.py'),
                         '--database', str(data / 'monitor.sqlite3'),
                         '--directory', str(backups), '--keep', '14'],
    'WorkingDirectory': str(service),
    'StandardOutPath': str(logs / 'backup.stdout.log'),
    'StandardErrorPath': str(logs / 'backup.stderr.log'),
    'StartCalendarInterval': {'Hour': 3, 'Minute': 15},
}
with backup.open('wb') as fh:
    plistlib.dump(pl, fh, sort_keys=False)
PY
chmod 600 "$MAIN_PLIST" "$BACKUP_PLIST"

uid="$(id -u)"
if ! launchctl print "gui/$uid" >/dev/null 2>&1; then
  echo "launchd GUI session unavailable for uid $uid." >&2
  echo 'Install from a logged-in macOS Terminal session, not a headless SSH-only session.' >&2
  exit 1
fi
for label in com.tanchensiyi.huya-monitor com.tanchensiyi.huya-monitor-backup; do
  launchctl bootout "gui/$uid/$label" >/dev/null 2>&1 || true
done
launchctl bootstrap "gui/$uid" "$MAIN_PLIST"
launchctl bootstrap "gui/$uid" "$BACKUP_PLIST"
launchctl enable "gui/$uid/com.tanchensiyi.huya-monitor"
launchctl enable "gui/$uid/com.tanchensiyi.huya-monitor-backup"
launchctl kickstart -k "gui/$uid/com.tanchensiyi.huya-monitor"

echo
printf 'Installed: %s\n' "$MAIN_PLIST"
printf 'Local API: http://127.0.0.1:8765/api/health\n'
printf 'SQLite database: %s/monitor.sqlite3\n' "$DATA_DIR"
printf 'Backups: %s\n' "$BACKUP_DIR"
echo 'Status: bash services/huya-monitor/mac/status.sh'
echo 'Important: Mac must stay awake, powered, connected and logged into this account.'
