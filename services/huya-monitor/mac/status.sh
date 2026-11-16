#!/usr/bin/env bash
# launchd may report the process as running before uvicorn binds its port.
# Wait briefly for a real, room-specific health response and show startup logs
# on failure instead of treating the initial connection refusal as fatal.
set -Eeuo pipefail
[[ "$(uname -s)" == "Darwin" ]] || { echo 'Only supported on macOS.' >&2; exit 1; }
uid="$(id -u)"
app_root="$HOME/Library/Application Support/XiaomiaoLive"
log_file="$app_root/logs/collector.stderr.log"
url='http://127.0.0.1:8765/api/health'

echo '—— launchd ——'
launchctl print "gui/$uid/com.tanchensiyi.huya-monitor" 2>&1 | sed -n '1,30p' || true

echo '—— collection health ——'
health=''
ready=0
for attempt in {1..15}; do
  if health="$(curl --silent --fail --max-time 2 "$url" 2>/dev/null)" && \
      printf '%s' "$health" | python3 -c 'import json,sys; x=json.load(sys.stdin); sys.exit(0 if x.get("ok") is True and x.get("room_id") == "156324" else 1)' 2>/dev/null; then
    ready=1
    break
  fi
  if [[ $attempt -lt 15 ]]; then sleep 1; fi
done

if [[ "$ready" != 1 ]]; then
  echo 'Collector API did not become ready. Last network error:' >&2
  curl --silent --show-error --fail --max-time 3 "$url" >/dev/null || true
  echo "—— last 80 lines: $log_file ——" >&2
  if [[ -f "$log_file" ]]; then
    tail -n 80 "$log_file" >&2
  else
    echo 'No stderr log yet; check whether launchd started the process.' >&2
  fi
  echo 'To retry after checking the error: launchctl kickstart -k "gui/$(id -u)/com.tanchensiyi.huya-monitor"' >&2
  exit 1
fi
printf '%s\n' "$health" | python3 -m json.tool
echo 'HTTP ready does not prove Huya chat is receiving events. Check collectors.chat.state / messages / last_success.'

echo '—— last events & snapshots ——'
database="$app_root/data/monitor.sqlite3"
if [[ -f "$database" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 -readonly "$database" 'SELECT "events",COUNT(*),MAX(ts) FROM events UNION ALL SELECT "snapshots",COUNT(*),MAX(ts) FROM snapshots;' || true
fi
