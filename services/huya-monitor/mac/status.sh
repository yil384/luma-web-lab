#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(uname -s)" == "Darwin" ]] || { echo 'Only supported on macOS.' >&2; exit 1; }
uid="$(id -u)"
echo '—— launchd ——'
launchctl print "gui/$uid/com.tanchensiyi.huya-monitor" 2>&1 | sed -n '1,22p' || true
echo '—— collection health ——'
if curl --silent --show-error --fail --max-time 5 http://127.0.0.1:8765/api/health | python3 -m json.tool; then
  :
else
  echo 'Collector API unavailable. Inspect logs under ~/Library/Application Support/XiaomiaoLive/logs/' >&2
  exit 1
fi
echo '—— last events & snapshots ——'
database="$HOME/Library/Application Support/XiaomiaoLive/data/monitor.sqlite3"
if [[ -f "$database" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 -readonly "$database" 'SELECT "events",COUNT(*),MAX(ts) FROM events UNION ALL SELECT "snapshots",COUNT(*),MAX(ts) FROM snapshots;' || true
fi
