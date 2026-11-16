# 集美小喵直播间：Mac 本地备用采集器

**用途：**让一台已登录的 macOS 电脑在后台持续采集虎牙房间 `156324` 的公开页面资料和可解析的公开弹幕，写入本地 SQLite；系统重新登录时自动启动，进程退出时由 `launchd` 重启；每日 03:15（电脑处于唤醒状态时）做一致性备份，保留 14 份。

**边界：**这不是 GitHub Pages 提供的常驻服务器；不是已经实网验证的虎牙弹幕协议；不提供虎牙无法公开确认的在线人数或礼物总额。Mac 必须开机、已登录、保持网络连接并处于唤醒状态。合盖休眠的 MacBook 不会继续采集。

## 安装

1. 在 Mac 的 Terminal 中打开 `luma-web-lab` 仓库目录，确认包含 `services/huya-monitor`。
2. 需要 Python 3.11+，建议 `brew install python@3.12`。Mac 的 Terminal 必须处于已登录的图形用户会话。
3. 执行：

```bash
bash services/huya-monitor/mac/install.sh
bash services/huya-monitor/mac/status.sh
```

安装脚本只修改当前用户的 `~/Library/LaunchAgents/com.tanchensiyi.huya-monitor*.plist`，并在 `~/Library/Application Support/XiaomiaoLive/` 创建虚拟环境、数据、日志及备份目录；**不需要 sudo、不修改系统级 daemon、DNS 或现有的 SSH / Tailscale / tunnel 服务**。重装/更新保留数据。

启动后检查：

```bash
curl -fsS http://127.0.0.1:8765/api/health | python3 -m json.tool
```

返回 `ok: true` 仅表示 HTTP API 正常，并**不意味着 WebSocket 已收到有效弹幕**。应继续检查 `collectors.chat.state` 是 `receiving` 还是 `transport_connected` / `waiting` / `error`，以及 `messages` 和 `last_success`。只有真正收到并解析成功的消息才算采集成功。主播没开播时长期没有弹幕可能是正常情况。

## 日常运维

```bash
bash services/huya-monitor/mac/status.sh
bash services/huya-monitor/mac/backup-now.sh
bash services/huya-monitor/mac/uninstall.sh   # 停止服务，不删历史数据
```

手动重启：

```bash
launchctl kickstart -k "gui/$(id -u)/com.tanchensiyi.huya-monitor"
```

查看日志：

```bash
tail -n 100 "$HOME/Library/Application Support/XiaomiaoLive/logs/collector.stderr.log"
```

数据在 `~/Library/Application Support/XiaomiaoLive/data/monitor.sqlite3`；务必用 SQLite 在线备份命令，不要在程序运行时只拷贝 `.sqlite3` 主文件而遗漏 WAL 文件。每日备份保留 14 份，备份机制只在电脑唤醒时工作。建议定期另外备份到加密外置盘。

## 手机怎么看？

- GitHub Pages 的 `https://tanchensiyi.com/live/` 使用 `live/data/room.json` 的公开静态快照，不会在手机上直接连接 `127.0.0.1:8765`（那指的是**手机自身**）。
- 要让手机网页直接查询 Mac 的实时采集 API，必须另行部署一个受保护的 **HTTPS** 入口（如自有 VPS 反向代理/安全隧道），并明确限定允许的来源、速率、可见字段及 HTTPS 域名。不应直接开放 Mac 8765 端口给公网。
- 在没有部署 HTTPS 入口之前，Mac 可独立备份历史，但不能让所有网站访问者实时查看它；网页仍可用 GitHub Actions 定时提供公开页面快照。
- 个人回看 Mac 端的实时 API，可以在电脑上访问 `http://127.0.0.1:8765/docs`，或者用你已经配置的受控 SSH/Tailscale 连接访问，而非公网裸奔。

## 停止和回退

`uninstall.sh` 仅停掉两个 LaunchAgent 并移除当前用户的 `.plist`，保留 SQLite、日志、备份、Python venv 和 Git 源码。要彻底删除这些文件，请先手动备份并确认不再需要数据。

## 重要限制

- 本项目使用非官方公开协议，平台可能变更，不能保证无损收集每条弹幕。
- SQLite 按配置默认保留 90 天事件，不适合无限量存储；可在安装脚本中调整 `RETENTION_DAYS`。
- 不采集私密信息。未经用户明确授权，不把全量互动记录上传到公开 GitHub 仓库。
- 不用 `caffeinate` 冒充全天在线：合盖、断电、断网仍会中断。若有 Mac mini，通常比笔记本更适合 24/7 节点。
