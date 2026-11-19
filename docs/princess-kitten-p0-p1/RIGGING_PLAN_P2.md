# P2 Rigging & Animation 落地方案（解决 `princess.pet_cat` 与 `princess.adjust_hold` 的 `BLOCKED_BY_RIG`）

实测 `luma-princess-hug-v73.glb` 与 `luma-princess-hug-v74.glb` 均为 `skinCount: 0`、`animationCount: 0`、`morphMeshCount: 0`。遵循交接规范，**绝不用整体 `PrincessPivot` 旋转冒充抬手抚摸**。如需在 P2 实现真实的「手抚小猫」「轻托调整抱姿」与「温柔低头对视」，建议按以下最小可靠骨骼管线在 Blender 4.2+ 中完成：

## 1. 最小可靠骨骼层级（Upper-Body Only，不动裙摆与下身）

为控制移动端蒙皮开销（保持 33 万面主网格在手机端流畅），**不要绑定整条大裙摆**，只做轻量级上半身骨骼（共 12 根骨头，单顶点最多 4 权重）：

```text
root (原点 [0, 0, 0]，锁住下身裙摆顶点权重 = 1.0)
└─ spine_chest (胸部中心，约 Pivot Y=3.20)
   ├─ neck (Y=3.85)
   │  └─ head (Y=4.05，带动头部、头发与 Eye insert 0/1 同步刚性跟随)
   ├─ shoulder_L -> upperArm_L -> forearm_L -> wrist_L -> hand_L
   └─ shoulder_R -> upperArm_R -> forearm_R -> wrist_R -> hand_R
```

* **关键防变形要点**：
  1. `Eye insert 0` 和 `Eye insert 1` 必须以 **100% 权重绑定到 `head` 骨**（或直接作为 `head` 骨的子节点），确保低头看猫时眼球与眼眶零错位。
  2. 裙摆、腰部蝴蝶结、下身顶点 **100% 绑定到 `root`**，保证 0% 误变形。
  3. 泡泡袖（puff sleeves）顶部与 `spine_chest` 平滑过渡，上臂/前臂/手掌在 `upperArm_L/R` → `forearm_L/R` → `wrist_L/R` 间做权重衰减（Preserve Volume / Dual Quaternion 检查肘部折痕）。
  4. **抱持锚点同步**：导出时在 `hand_L` 或 `forearm_L` 下放置一个空节点 `HoldAnchorSocket`，运行时将 `HeldKittenRoot` 挂到 `HoldAnchorSocket` 下，这样托举时猫与手天然零延迟同步。

## 2. 需导出的 3 条最小 AnimationClip（glTF 2.0 `.glb`）

| Clip 名称 | 建议时长 | 动作设计 | 运行时混合策略 |
|---|---:|---|---|
| `hold_idle` | 4.0s（循环） | 极轻微呼吸起伏 + 双手轻稳托住小猫 | 常驻底轨（weight = 1.0） |
| `pet_cat` | 2.4s（单次） | 右手稳托猫腹，左手抬起 10–15cm 轻抚猫头 2 次后平滑落回 `hold_idle` | `AnimationMixer` 0.25s 淡入/淡出，与 `held.nuzzle` 同步触发 |
| `adjust_hold` | 2.2s（单次） | 双手轻微向上轻托约 4cm 再柔和落下，配合 `head` 轻微低头微笑 | 低频稀有事件，与 `held.adjust_posture` 同步 |

## 3. Blender 导出与前端接入契约

* **Blender 导出选项**：glTF 2.0 Binary (`.glb`)，开启 `EXT_texture_webp`、`+Y Up`、勾选 `Skinning` 与 `Animation`（关闭 `Always Sample Animations` 或采样率设为 24fps 控制体积），目标总大小 `<= 16 MB`。
* **自动解锁机制**：前端在加载新 GLB 后运行结构自检（等价于 `inspect_glb.py`），仅当检测到 `skinCount > 0` 且存在 `upperArm_L` / `forearm_L` / `wrist_L` 及对应 clip 时，自动将 `DEFAULT_CAPABILITIES.princess.canUseArmPose` 置为 `true`，无需改写状态机即可解锁 `princess.pet_cat` 与 `princess.adjust_hold`。
* **小猫眨眼（`cat.blink`）补充**：若需在 P2 增加真实眨眼，可在 Blender 中为 `chonky-cat-trio` 的每只猫增加一对 `blink_L` / `blink_R` Shape Key（Morph Target），导出后调度器会自动解锁 `cat.blink`。
