# 集美小喵直播间：免费/低成本常驻后端选项（2026-11）

前端仍部署在 GitHub Pages `https://tanchensiyi.com/live/`，后台与静态站点分开运行；主域名 `/`、`/christmas/`、`/letter/` 不修改。采集目标只限虎牙公开房间 `156324`。

## 先分清“永久免费 VM”和“永久免费公网服务”

- **Oracle Cloud Always Free**: 可申请 Always Free E2 Micro / Ampere A1 VM，包括基础网络。可能暂时没有空余资源，或因长期低使用被回收；创建时核对控制台的 *Always Free eligible* 标签、配额，务必启用预算通知。常驻采集优先考虑 OCI，但需要你自己的账号。官方链接 https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- **Google Cloud e2-micro**: 指定美国 `us-west1/us-central1/us-east1` 等免费区域的 1 台合规实例、30 GB 标准持久盘和部分出网流量有 Always Free 额度。**公网 IPv4 另外计费**（公开价约 $0.005/小时）且前往中国大陆的数据流量不在 1 GB 免费规则内。不要将整套服务误称为保证 $0。官方链接 https://docs.cloud.google.com/free/docs/free-cloud-features 和 https://cloud.google.com/vpc/network-pricing
- **Render Free**: `render.yaml` 是一键试部署蓝图，不保证常驻。15 分钟无入站请求会休眠，磁盘在重启/重新部署时丢失。可验证 API 是否正常，但不能保留长期 SQLite 历史。官方链接 https://render.com/docs/free
- **Koyeb Free**: 1 小时无入站流量后自动缩容，不能使用永久卷，不作为连续弹幕采集器。

## Render 快速冒烟测试（免费但不常驻）

1. 在 Render 登录自己的账号，选择 New → Blueprint，链接 GitHub 项目 `yil384/luma-web-lab`，读取仓库根目录 `render.yaml`。
2. 选择 Free 实例，检查部署路径 `services/huya-monitor`；部署后访问 `https://<service>.onrender.com/api/health`。
3. `ok:true` 仅表示 HTTP 已启动。检查 `/api/sources` 的 `page/chat state`, `frames/messages`；只在实际收到弹幕时认定 WebSocket 成功。
4. 如果想在网站里临时试用，打开 `/live/` 的「关于」填入 `https://<service>.onrender.com/api`。该地址由你实际部署后提供，不能预先臆造。
5. 体验结束后删除 Render 免费服务；**不要**用它存长期 SQLite 记录，避免实例休眠/重启时丢失。

## OCI Always Free 持久化方案（需你创建 VM）

- Ubuntu 22.04/24.04 或 Debian 12 / 1 GB+ RAM；确保选中 Always Free 的实例类型、磁盘和配额。
- 选择单独的 API 子域名（例如 `api.tanchensiyi.com`），**不是**重定向主域名到新服务。DNS A 指向 OCI VM 的公网 IP；安全组仅放行 80/443 和来自受信 IP 的 SSH。
- 在 VM 上运行：`sudo bash services/huya-monitor/cloud/install-ubuntu.sh`。脚本使用独立系统用户、Python venv、SQLite 数据目录、systemd，HTTP 只监听回环 `127.0.0.1:8765`。
- 安装 Caddy 后，以 [Caddyfile.example](Caddyfile.example) 为模板填写你自己的 API 域名。Caddy 会在 DNS 生效且 80/443 可达时自动申请 HTTPS。**不要**对公网直接暴露 8765。
- `https://api.<domain>/api/health` 用来验证服务是否存活；随后检查 `/api/sources` 中的真实消息数量。Safari/Chrome 页面「关于」中配置 `https://api.<domain>/api`。
- 常驻实例需要外部自动备份 SQLite（云磁盘/系统可能损坏或被平台收回），按数据量设置留存；只记录公开互动，避免公开原始用户标识或 private cookie。

即便机器和服务正常，非官方虎牙 WebSocket 接口可能改变，导致“有连接但无弹幕”。此时状态必须显示真实情况，不能造数据。
