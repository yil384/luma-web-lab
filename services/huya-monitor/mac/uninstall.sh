#!/usr/bin/env bash
# Stops launch agents. Data, backups, logs and venv are deliberately retained.
set -Eeuo pipefail
[[ "$(uname -s)" == "Darwin" ]] || { echo 'Only supported on macOS.' >&2; exit 1; }
uid="$(id -u)"
for label in com.tanchensiyi.huya-monitor com.tanchensiyi.huya-monitor-backup; do
  launchctl bootout "gui/$uid/$label" >/dev/null 2>&1 || true
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done
echo 'Collector and backups stopped. Local database and archives were preserved.'
