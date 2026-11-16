#!/usr/bin/env bash
# Run only on an explicitly provisioned VM: sudo bash cloud/install-ubuntu.sh
# Does not modify domain DNS / HTTPS or expose the backend TCP port.
set -Eeuo pipefail
[[ "$(uname -s)" == "Linux" ]] || { echo 'This installer targets Linux only' >&2; exit 1; }
[[ "$(id -u)" == 0 ]] || { echo 'Run with sudo on your VM' >&2; exit 1; }
command -v apt-get >/dev/null || { echo 'Requires Ubuntu/Debian apt-get' >&2; exit 1; }
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_DIR='/opt/xiaomiao-huya-monitor'
DATA_DIR='/var/lib/xiaomiao-huya-monitor'
USER='xiaomiao-huya'

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv python3-pip ca-certificates
if ! id "$USER" >/dev/null 2>&1; then
  useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$USER"
fi
install -d -o "$USER" -g "$USER" -m 0750 "$DATA_DIR"
install -d -m 0755 "$APP_DIR"
cp -a "$SOURCE/app" "$SOURCE/requirements.txt" "$APP_DIR/"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --disable-pip-version-check -r "$APP_DIR/requirements.txt"
chown -R root:root "$APP_DIR"
cat >/etc/systemd/system/xiaomiao-huya-monitor.service <<'UNIT'
[Unit]
Description=Xiaomiao Huya 156324 public room collector
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=xiaomiao-huya
Group=xiaomiao-huya
WorkingDirectory=/opt/xiaomiao-huya-monitor
Environment=DATA_DIR=/var/lib/xiaomiao-huya-monitor
Environment=DEMO_MODE=0
Environment=HUYA_CHAT_ENABLED=1
Environment=HUYA_CHAT_PROTOCOL=topic
Environment=POLL_SECONDS=60
Environment=RETENTION_DAYS=90
Environment=CORS_ORIGINS=https://tanchensiyi.com
ExecStart=/opt/xiaomiao-huya-monitor/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765 --workers 1 --log-level warning
Restart=always
RestartSec=10
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/xiaomiao-huya-monitor
PrivateTmp=yes
UMask=0077
MemoryMax=650M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now xiaomiao-huya-monitor.service
sleep 3
curl -fsS --max-time 8 http://127.0.0.1:8765/api/health || {
  journalctl -u xiaomiao-huya-monitor -n 50 --no-pager
  echo 'Collector not yet ready. Review errors above.' >&2
  exit 1
}
echo
echo 'Collector is bound to 127.0.0.1:8765; configure your own Caddy HTTPS domain separately.'
