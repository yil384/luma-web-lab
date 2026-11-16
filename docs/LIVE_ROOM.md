# 集美小喵直播间 /live/

用户于 2026-11-16 要求把虎牙房间 [156324](https://www.huya.com/156324) 的监控网页接入 `https://tanchensiyi.com/xxx`，命名和视觉使用主站风格。本分支采用 `https://tanchensiyi.com/live/`。

## 路由与界面

- 代码：`public/live/index.html`，由 Vite 的 `public/` 资源复制到 `dist/live/index.html`。**独立静态入口**，不需要也不应修改 `src/lib/experience-route.ts` 的季节逻辑。
- `/` 继续固定圣诞树；`/christmas/` 和 `/letter/` 不变。`scripts/finalize-build.mjs` 保留它们的独立 HTML 元信息。
- 标题「集美小喵直播间」，主站 `xiaomiao-mark-v2` SVG/PNG/ICO/apple-touch-icon 一套图标共享，保持深海蓝、奶油白、香槟金、红色点缀与相同文字风格。
- 页面支持趋势、历史、事件/关键词/贵族等级筛选、排行、直播场次和 CSV（在 API 可用时）。可在网页「数据连接」设置 HTTPS 的 `/api` 前缀；默认**不连接后端，也不提供虚假的数字**。

## 数据与发布边界

这不是完整服务上线：GitHub `main` 源码和 ChatGPT Sites **生产源码/部署是不同系统**。GitHub 提交不等于 `tanchensiyi.com/live/` 可访问。正式上线需在原 Sites 项目 `appgprj_6aef1795eb688191a80ffb20460dbab1` 将改动同步到最新源码，保留 `.openai/hosting.json` 与用户既有访问权限，使用官方 build/deploy 流程确认部署完成，最后实测 `/`、`/letter/`、`/christmas/`、`/live/`。**不要**把 GitHub Pages 预览误认为主域名部署。

主站静态托管无法持续运行 Python、SQLite、WebSocket。采集后端源码在 `services/huya-monitor/`，部署时需要单独的常驻、可出网的服务、持久化数据卷、HTTPS 反向代理和访问控制。页面元信息的 `xiaomiao-monitor-api-base` 空值表示尚未有正式公共 API；不能将 localhost 当成线上服务。完整部署前，访问新页面只能看到状态诚实的 UI 框架。

## 验证清单

1. `npm test` 覆盖静态路径与共享图标引用；`npm run build` 检查最终 `dist/live/index.html` 存在。
2. 浏览器分别检查桌面、手机、弹幕检索、数据来源与连接弹窗，确认断线状态没有伪造统计。
3. 单独验证采集服务 `/api/health`、CORS、SSE 长连接、弹幕真值、时间戳、重连和 CSV 下载；只在验证成功后说“实时采集已经上线”。
4. 正式 Sites 发布后实测域名内的四条路径，并记录生产部署 ID。不要只凭 GitHub commit 或静态截图宣布网站上线。
