# 集美小喵直播间：公开数据观察与监控

目标：`https://tanchensiyi.com/live/`，虎牙房间 `https://www.huya.com/156324`。

## 组成与数据可信度

- **静态手机页面：** `public/live/index.html`，移动竖屏单列优先，复用主站 `public/icons/xiaomiao-mark-v2.*` favicon。页面默认读取 `public/live/data/room.json`；时间过期后提示“数据已过期”，不能把旧热度或开播状态冒充实时值。
- **GitHub Actions 定时快照：** `scripts/huya_snapshot.py` 与 `.github/workflows/live-room-snapshot.yml`，每 30 分钟尝试拉取一次公开网页，并将真实获得的字段更新到 `gh-pages/live/data/room.json`。运行失败保持上一份可信记录，不能伪造。Actions 的 cron 可能延迟/跳过，也不能补全弹幕。
- **Mac 或服务器常驻采集器：** `services/huya-monitor/`，FastAPI + SQLite WAL + 公开 WebSocket/Tars。可对比现代 topic 订阅和旧版匿名注册，心跳、断线退避重连、事件校验和失败状态分离。
- **Mac 备用节点：** `services/huya-monitor/mac/` 安装单用户 launchd 服务，自动重启、日志、本地数据库和每日在线备份。详细说明见 `services/huya-monitor/mac/README.md`。

## 前后端数据连接

- GitHub Pages 只提供静态 HTML/JS/JSON，不能运行 Python 常驻进程。
- 实时接口必须在自有 HTTPS 域名提供（比如 `https://monitor.example.com/api`）；前端的「连接」设置可以覆盖默认 API。不要将 Mac 的 8765 端口直接公开。
- 如果没有 HTTPS 实时入口，页面仍显示公开房间快照，但无法显示实时弹幕/礼物/排行。不能把 GitHub Actions 的定时抓取称作实时监控。
- 原始公开页面 `heat` 是平台展示热度，**不是当前真实在线人数**。
- 非官方 WebSocket 对房间组订阅与批量弹幕的支持属于实验性适配，必须以实网接收到有效弹幕为准。连接到 WebSocket 不代表已经成功解析消息。
- 暂不声称已解析礼物、贵族、关注、礼物现金金额或平台私有指标。所有此类字段必须经实际验证的事件协议或授权集成提供。

## 测试与部署

在 `services/huya-monitor` 目录：

```bash
python3 -m pip install -r requirements.txt
python3 -m pytest -q
```

在完整主站仓库根目录：

```bash
npm test
npm run lint
npm run build
```

发布 GitHub Pages 时仅将 `dist/live/` 的新页面同步到 `gh-pages/live/`，保留主站 `/`、`/letter/`、`/christmas/` 和根目录 `CNAME`；不要切回旧 Sites 服务。

本次状态：完成代码和本地单元测试；**没有远程登录用户 Mac，也没有完成 24 小时实际采集验收**。安装 launchd 和联通 HTTPS 需要在用户 Mac/服务器上实际执行并确认。MacBook 合盖休眠、网络中断或上游限流都会造成记录间隙。
