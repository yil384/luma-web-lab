# 集美小喵直播间 · 采集 API

配套前端：`/live/`（位于主站源码 `public/live/index.html`），房间号固定为 [156324](https://www.huya.com/156324)。本服务不依赖主站的 Three.js/React 构建。

## 自行部署

```bash
cd services/huya-monitor
cp .env.example .env
# 自行检查 .env，设置 CORS_ORIGINS=https://tanchensiyi.com，确保 DEMO_MODE=0
# 如果要允许礼物等外部授权写入，必须设置长随机 INGEST_TOKEN
docker compose up -d --build
curl http://127.0.0.1:8765/api/health
```

Compose **仅监听 `127.0.0.1:8765`**。如需供 `https://tanchensiyi.com/live/` 访问，请在你控制的服务器前部署 HTTPS 反向代理，例如 `https://monitor.example.com/api/*` 转发到 `http://127.0.0.1:8765/api/*`，并配置适当的访问控制、日志、流量限额、SSE 超时和备份。CORS 白名单默认为 `https://tanchensiyi.com`，只开放跨域 GET；公开只读接口仍应评估公开展示互动昵称带来的隐私风险。没有 HTTPS 后端时不要在网站上伪装为实时服务。

前端顶部「数据连接」填写 `https://monitor.example.com/api`；该配置仅保存本地浏览器。面向所有用户统一接入时，在 `public/live/index.html` 的 `<meta name="xiaomiao-monitor-api-base" content="">` 设置已部署的 HTTPS API；**不要**将私密令牌放到这里。

接口：`/api/overview`、`/api/events`、`/api/trend`、`/api/ranking`、`/api/sessions`、`/api/sources`、`/api/health`、`/api/export`、`/api/stream`。`POST /api/ingest` 需要单独设置 `INGEST_TOKEN`，不启用公开跨域 POST。

## 采集事实边界

- 房间公开网页每 45 秒左右尝试拉取；实际可用性由目标网络和虎牙页面结构决定。
- 非官方 WebSocket/Tars 弹幕采集是 **待验证的实验性支持**，真实收到并解析文本弹幕后才标记可用。
- 礼物、贵宾、关注需要另外授权数据源；金额不推算。
- 平台热度 **不等于真实同时在线人数**，互动昵称数也不等于所有观众。
- 只能保存监控启动之后可实际采集的公开事件；启动前的历史无法凭空补回。
- 不采集密码、私密 Cookie、用户私信或未公开个人信息。遵守平台规则和适用法律。

运行测试：在本目录执行 `python -m pytest -q`。默认模式不播种演示数据。
