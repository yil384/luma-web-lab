# V77：独立手臂与真实眼睑蒙皮

V77 从原 V76 GLB 确定性生成。保留原始脸、头发、裙子、眼球插片以及全部纹理的二进制数据；为原有 `CradleArmsV75` 添加蒙皮，另外生成贴合眼球曲面的上下眼睑。运行时直接改变真实 `Bone`，由 glTF 的 `JOINTS_0`、`WEIGHTS_0` 和逆绑定矩阵驱动顶点。

| 资产 | 值 |
| --- | --- |
| 输入 | `public/princess/luma-princess-hug-v76.glb` |
| 输入 SHA-256 | `fad8b2e3b63a2c9866c8d12c64a94375a2cbf4a1f6d9591c73b10e948b187189` |
| 输出 | `public/princess/luma-princess-rigged-v77.glb` |
| 输出 SHA-256 | `9b1cd945157dc1dc8645758bcf33d41ce54e4993cb7e299e5e9fe3bf780994e0` |
| 输出大小 | 15,727,656 bytes，比 V76 增加 241,792 bytes |
| 蒙皮 | 1 个 skin，7 个 SkinnedMesh，12 根骨骼 |
| 参与蒙皮的顶点 | 原手臂 2,798；四片眼睑 2,132；两条细睫毛边 164；合计 5,094 |
| 原主网格 | 287,940 顶点，保持静态 |
| glTF 动画片段 | `hold_idle`、`pet_cat`、`adjust_hold`、`blink` |

## 骨骼和实际范围

骨骼层级为 `root → chest → upperArm_L/R → forearm_L/R → hand_L/R`；四根 `eyelid_upper_L/R`、`eyelid_lower_L/R` 直接挂在 `root`。左右肩、肘、腕各有独立的有效顶点权重。生产中的小动作维持上臂的基础姿势，避免改变原静态袖口的接合处。

每片眼睑有 533 个顶点和 960 个三角形。其闭眼形状由原眼球的最前侧曲面拟合；睁眼时，眼睑向上下眼眶收回并向后退入原眼球边缘。闭眼过程中，眼睑沿曲线前移后覆盖眼球。眼睑外围埋在原眼眶皮肤下，使用原眼球曲面的平滑法线，减少额外的圆形接缝。颜色取自原眼部纹理的皮肤区域，睫毛边使用很细的棕色曲面。

原 GLB 的两个眼球插片是有效的独立 scene roots，V77 保留了这两个根节点。主网格的脸部有对应的眼眶孔，因此不可删除眼球插片。

头颈、嘴、眉毛和裙摆没有新增骨骼。适配器明确返回 `canUseHeadPose: false`，不声明支持 `pair.mutual_gaze`。没有为眨眼缩放整张脸、压扁眼球、替换黑色面片或切换模型可见性。

## 运行时接口

`src/scene/princess-kitten/princess-rig.mjs` 不导入 Three.js，只使用 GLTFLoader 已经创建的实例，避免生产包出现第二份 Three.js。

```js
import { bindPrincessRig } from './princess-rig.mjs';

const rig = bindPrincessRig(gltf.scene);
rig.setHoldAnchor(holdAnchorGroup);
runtime.setPrincessRig(rig);
// runtime.applyHeld 内调用：
rig.update(clock, activePrincessAction, reducedMotion);
```

动作对象使用 `{ id, elapsed, duration, intensity }`。每帧先恢复骨骼与托抱锚点的基础姿势，再计算当前动作，避免累积位移。能力检查会确认对应骨骼实际拥有正的蒙皮权重；只有名称、没有有效皮肤权重的对象不会获得能力。未绑定模型的 `supportedActions` 为空。

| 动作 | 实际行为 |
| --- | --- |
| `princess.pet_cat` | 左肘和左腕抬起并轻抚；右侧承托手和手臂维持原位置 |
| `princess.adjust_hold` | 两侧前臂小幅托起；怀猫锚点同步上移，最高 0.0295 个公主 pivot 单位 |
| `princess.blink` | 四根眼睑骨骼驱动闭合与张开；默认完整周期 0.26 秒 |
| `pair.cuddle_response` | 双腕轻微回应，并在动作开始 0.35 秒后短暂眨眼 |

无显式眨眼动作时，每 4.9 秒有一次自然眨眼。`reducedMotion` 为真时，手臂、眼睑、锚点回到基础姿势并停止自动眨眼。暂停由上层 runtime 控制，不推进动作时钟。

托抱锚点仍以现有 `[0, 2.95, 0.77]` 为基础位置，位于高度 5.12 的公主 pivot 空间。调整动作中，实际掌心顶点平均上升量为 0.0294569，锚点同步上升 0.0295，相差约 0.0000431。抚摸动作保持另一侧承托手完全静止。

应使用 GLTFLoader 的原 scene，或用 `SkeletonUtils.clone` 做骨骼正确的克隆。普通 `scene.clone(true)` 无法可靠地复制骨骼关联。适配器 `dispose()` 恢复本地姿势；场景所有者卸载模型时还需要去重调用 `Skeleton.dispose()`，并处理原有 geometry、material 和 texture 的释放。

## 验证证据

`tests/princess-rig-v77.test.mjs` 使用真实 Three.js GLTFLoader、骨骼矩阵和 `SkinnedMesh.applyBoneTransform`。Node 环境仅跳过图片解码；视觉检查另外使用原始纹理和 Blender 渲染。

7 项测试覆盖原始二进制与纹理保护、实际有效权重能力、六根手臂关节逐一驱动的左右隔离、四片眼睑逐一驱动的隔离、闭眼覆盖、承托接触和回到静止姿势。闭眼测试向每个眼球的可见中央区域投射 29 条射线，确认眼睑命中位于原眼球前方。

实测结果：

- 手臂静止姿势相对原几何的最大误差：`1.4901161193847656e-8` 模型单位。
- 抚摸中左手臂最大顶点位移：`0.047257912830147346` 模型单位。
- 抚摸中右承托手臂最大顶点位移：`0`。
- 原静态主网格和全部原图片、几何缓冲字节保持不变。
- 托抱锚点与实际掌心平均抬升量相差小于 `0.0001` pivot 单位。
- 同一动作连续更新 20 帧不会累积偏移；reduced motion 恢复双臂、眼睑和锚点。

CPU 渲染检查了正面睁眼、半闭、完全闭眼、35°侧面，以及相同镜头下的原始手臂、静止手臂和抚摸极值。完全闭眼时没有虹膜或眼白穿透；睁眼时新眼睑退到原眼眶下。原 V76 肘上方已有的锯齿状布料/皮肤边缘在中立和动作图中都存在，生产抚摸未扩大该处裂缝。闭眼保留原眼球凸面的造型，因此极近景仍能看到圆润眼睑的体积。

这些渲染用于检查模型和变形。正式场景中持猫位置、点击事件、暂停与减少动态效果，还由生产场景浏览器 smoke test 验证；这里不把离线渲染当作移动设备性能测试。

## 复现

资产生成环境：Python 3.12、NumPy 2.3.5、SciPy 1.17.0。无需外部模型服务。

```sh
python tools/princess-rig/build_v77.py
node --test tests/princess-rig-v77.test.mjs
node tools/princess-rig/verify-and-pose.mjs /tmp/luma-rig-qa
blender -b -t 4 --python tools/princess-rig/render_qa.py -- /tmp/luma-rig-qa
```

`verify-and-pose.mjs` 用真实 Three.js CPU 蒙皮生成静态 QA GLB；保留原纹理，将骨骼动作准确应用到顶点和法线后，交给 Blender Cycles CPU 渲染。低采样渲染有轻微噪点，用于几何检查，不作为美术宣传图。

生成报告在 `evidence/reports/princess_v77_rig.json`，实际顶点变形报告在 `evidence/reports/princess_v77_deformation.json`。上述命令可以复现各视角的视觉验证文件。
