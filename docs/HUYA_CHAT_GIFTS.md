# 集美小喵 · 弹幕与礼物采集

部署目标：`https://tanchensiyi.com/live/`；虎牙房间 `156324`。

## 为什么之前没有礼物/发言

原版仅能从公开网页定时读取主播、热度、封面、录像信息。WebSocket 解析只处理 `command=7` 的一部分推送，缺少新版 `command=22` 和礼物 `URI=6501` 的 schema 解析。GitHub Pages 不运行持续采集进程；仅浏览器打开时建立的连接，也不能保存离线期间的消息。

## 这次实现的协议兼容

- 匿名房间组注册：`command=16`，`live:<主播 UID>` / `chat:<主播 UID>`；首包和每 20 秒发送 `command=20` 空字节心跳。
- 默认 WebSocket：`wss://wsapi.huya.com/`；保留 legacy `wss://cdnws.api.huya.com/` + WUP 心跳的配置开关。连接成功与收到有效消息是两种状态。
- 旧版 `command=7` 和新版 `command=22`：V2 广播包含 `{groupId, items: [{uri, msg, messageId}]}`。解析输入有长度、数量、递归界限。
- 发言：`URI=1400`，用户昵称与弹幕内容；礼物：`URI=6501`（SendItemSubBroadcastPacket），严格校验礼物 ID、赠送数量、主播 UID、送礼者。名称缺失则仅显示礼物编号，不猜礼物名称。
- 有 messageId 的事件以 `房间+URI+messageId` 在 SQLite 去重。没有可靠 ID 的旧消息不会按昵称/内容强行去重，避免误删相同发言。
- **不承诺礼物现金价值**：尚未验证该礼物的官方单价与平台结算口径；`lPayTotal` 原始字段不会被当作人民币收入。也不宣称能读取所有类型的贵宾/关注事件。
- `/api/events?kind=gift`、`/api/ranking?metric=gift`、`/api/export?kind=gift`、`/api/stream` 可供外部 HTTPS 前端查询真实持久记录；离线时仍显示最后一次真实记录与最后接收时间。

## 真实连通性与安全

1. `python -m pytest -q`：协议合成帧、恶意/截断帧、发言、送礼、错房间过滤、数据库查询和去重的本地单元测试，**不能当作实网成功**。
2. 公开仓库新增 GitHub Actions 的**一次性、限时探测** `.github/workflows/huya-ws-probe.yml`。它只输出帧/命令/URI/有效弹幕和礼物数量，不上传弹幕正文、用户名、原始二进制或用户标识；如暂时没人送礼，结果可能为 0，不能推论采集完全无效。
3. 后端常驻运行需要 Mac 或云端实例。Mac 用户已经安装但健康检查尚未确认成功，需要重新运行 `services/huya-monitor/mac/status.sh`。Render / Oracle VM 尚未创建；只有可用的 HTTPS `/api` 地址后，网页才可以跨设备查询服务器保存的完整历史。
4. 浏览器页面也尝试直接订阅虎牙的公开 WebSocket；跨源策略、上游协议变化或手机锁屏都可能使它中断，不能代替常驻后端。
5. 不把全量用户消息写入公开 GitHub Actions 日志或 GitHub Pages JSON；公开的快照只包含房间级数据。请在对外公开用户昵称和礼物记录前评估平台条款及隐私要求。

## 开发者手动验证

```bash
cd services/huya-monitor
python3 -m pip install -r requirements.txt
python3 -m pytest -q

# 在有网络、房间开播时执行，不记录正文和昵称。
cd ../..
python3 scripts/huya_ws_probe.py --seconds 45
```

### 参考

- [Pure Live 当前虎牙 Tars command=22 群组推送实现](https://github.com/liuchuancong/pure_live/blob/master/lib/shared/platforms/huya/huya_danmaku.dart)
- [Huya SendItemSubBroadcastPacket 公开 schema](https://github.com/yaobiao131/BililiveRecorder.Avalonia/blob/main/Platform/BIliliveRecorder.Huya/Proto/SendItemSubBroadcastPacket.cs)
- [开源项目对 URI=6501 礼物消息的适配说明](https://github.com/superxyline/purelive)

本代码依据观察到的字段格式独立实现解析，不引入这些仓库的源码依赖；若平台后续改版，应通过真实协议样本验证后再更新。
