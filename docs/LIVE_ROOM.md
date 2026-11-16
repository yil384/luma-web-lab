# 集美小喵直播间 · `/live/`

2026-11-16。公开访问 `https://tanchensiyi.com/live/`，虎牙房号 `156324`。

## 视觉与交互

- 手机竖屏优先：大图直播封面、小猫手绘艺术字和与主站相同的 `xiaomiao-mark-v2` favicon；底部四项导航「直播 / 弹幕 / 记录 / 关于」。删除了旧版本冗长的解释性文案和占空间的后台卡片。
- 小猫艺术字是单独的 WebP 图片资产，不是系统字体；字体使用浏览器原生楷体候选及系统无衬线回退，不向用户发送字体文件。
- 封面只能来自虎牙可信图片域名。图像不可用时显示本地小猫插画，绝不冒用录制画面。
- 录像卡片来自虎牙官方素材库、具有真实日期、时长、播放链接；`public/live/data/recordings.json` 是 **2026-11-16 的验证快照**，不是持续更新的实时视频目录。不得将过期资料标成当前录像。

## 分层采集

1. **静态保底：** GitHub Pages `gh-pages/live/data/room.json` 和 `history.json`。GitHub Actions `.github/workflows/live-room-snapshot.yml` 每 15 分钟计划采样一次，也支持修改代码后触发、手动运行。实际时间可能延迟或跳过。`scripts/huya_snapshot.py` 使用公开页面，在必要时尝试浏览器渲染以读取真实页面指标；失败保持上一次可用数据，不发布伪造记录。历史点按观察时间去重并限制 672 条。
2. **浏览器尝试直接收弹幕：** 当可信页面中发现主播协议 `topic_uid` 时，页面使用 `wss://cdnws.api.huya.com/` 和现代房间组 Tars 订阅在当前浏览器中尝试实时接收。真实 Tars 消息才进入界面。是否能够跨域连接取决于虎牙当前 WebSocket 策略；这不是跨设备历史同步，也没有持续运行保证。手机锁屏、离页或上游变更会中断。
3. **持久化后端：** `services/huya-monitor`（FastAPI + SQLite WAL + 公共页面 + Tars）。可部署在自己的 Mac、VM 或其他支持持久磁盘的主机；`/live/`「关于」可填已存在的 HTTPS `/api` 地址。API 没有部署成功之前，不能声称后端弹幕已经在线。
4. **免费后端模板：** 根目录 `render.yaml` 是 Render 免费实例的烟雾测试方案，不保证常驻或 SQLite 持久性。`services/huya-monitor/cloud` 包含 Ubuntu/OCI Always Free 持久部署示例；云账号、VM、域名 DNS/HTTPS 均必须真实创建，不能用 GitHub Pages 代替。

## 数据意义

- 热度为虎牙公开页面展示热度，不能映射为真实在线人数。
- 关注数为平台公开展示值，可能有取整。直播状态是观察结果，超过有效期退化为历史快照，不冒充实时。
- 礼物、贵宾、真实礼物现金金额没有经实网解析确认，不得虚构。
- `ok: true` 只表示本地 HTTP API 正常，不代表已经收到弹幕；应看 `collectors.chat.messages` 与 `last_success`。
- 不要将公开弹幕采集扩展至 Cookie、私有 UID 或账号敏感数据。不要将本地 SQLite 上传 GitHub Pages。

## 质量门禁

- 后端测试：`cd services/huya-monitor && PYTHONPATH=.:scripts python -m pytest -q tests`；前端静态测试：`node --test tests/live-visual.test.mjs`。
- 手机 320px、390px 和桌面 1440px 冒烟测试覆盖导航、页面数据、录像链接、无水平溢出；另用合成 Tars 1400/batch 消息验证 JS 解析，不把合成测试视为实网采集成功。
- 正式发布只同步 `dist/live/` 或 `gh-pages/live/`，不触动主站 `CNAME`、`/letter/` 或 `/christmas/`，不切回 ChatGPT Sites。