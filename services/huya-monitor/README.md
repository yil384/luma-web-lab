# 集美小喵直播间采集服务

对虎牙房间 `156324` 进行公开网页轮询和非官方 WebSocket 弹幕尝试，写入本地 SQLite WAL 数据库，提供只读 HTTP API 和 SSE 事件流。默认 `DEMO_MODE=0`，不会生成模拟互动。

## Mac 备用采集器（推荐）

详见 [`mac/README.md`](mac/README.md)：使用当前 macOS 用户的 `launchd` 管理后台 Python，自动重连、进程自动重启、每日数据库一致性备份。本机默认访问 `http://127.0.0.1:8765/api/health`。本机采集器不会自动让手机网页获得实时数据，必须另配安全 HTTPS 通道。

## 服务器部署

```bash
cp .env.example .env
# 修改后再启动；仅绑定 127.0.0.1:8765
# INGEST_TOKEN 为自愿集成（不提供就无法写入外部事件）
docker compose up -d --build
curl http://127.0.0.1:8765/api/health
```

HTTP API: `/api/overview`, `/api/events`, `/api/trend`, `/api/ranking`, `/api/sessions`, `/api/sources`, `/api/health`, `/api/export`, `/api/stream`。公开互动昵称应视作可能的个人数据，开放到公网前应按需求进行隐私审核、脱敏和访问限速。CORS 只配置允许的网页来源，不代表真正的认证措施。

默认优先 `HUYA_CHAT_PROTOCOL=topic`，使用直播间公开页面确认的 `lp` / `ayyuid` 主播 UID 订阅 `live:<uid>` 和 `chat:<uid>`；可在适配器失效时设置 `legacy` 尝试旧式匿名注册。只有收到真实并解析成功的公开聊天才将 `chat.state` 变为 `receiving`。必须先完成房间 `156324` 的实网测试，不能仅凭协议代码断言虎牙当前可用。

测试：`python -m pytest -q`。默认 90 天事件保留，数据库和历史备份归用户所有。不存用户 Cookie、私信、真实在线人数或未验证的礼物现金价值。
