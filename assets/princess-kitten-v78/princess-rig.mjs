/**
 * Real arm and eyelid skin adapter for luma-princess-rigged-v77.glb.
 * Deliberately imports no Three.js: it operates on the loaded scene's instances.
 * The high-poly face, hair, gown and original eyeballs stay completely static.
 * update(..., {deferMatrices: true}) leaves final matrix/skin uploads to the
 * renderer and avoids rewriting an unchanged idle pose. CPU callers keep the
 * synchronous default, including explicit rest-pose restoration on each call.
 */
const ARM_BONES = ['upperArm_L', 'forearm_L', 'hand_L', 'upperArm_R', 'forearm_R', 'hand_R'];
const LID_BONES = ['eyelid_upper_L', 'eyelid_lower_L', 'eyelid_upper_R', 'eyelid_lower_R'];
const clamp01 = value => Math.max(0, Math.min(1, value));
const envelope = progress => Math.sin(Math.PI * clamp01(progress)) ** 2;
const smooth = value => { const x = clamp01(value); return x * x * (3 - 2 * x); };

function blinkAmount(elapsed, duration = 0.26) {
  if (elapsed < 0 || elapsed >= duration) return 0;
  const p = elapsed / duration;
  if (p < 0.35) return smooth(p / 0.35);
  if (p < 0.48) return 1;
  return 1 - smooth((p - 0.48) / 0.52);
}

export function bindPrincessRig(root) {
  if (!root?.traverse) throw new TypeError('bindPrincessRig requires a loaded GLTF scene.');
  const bones = new Map();
  const skins = [];
  const skeletons = new Set();
  root.traverse(object => {
    if (!object.isSkinnedMesh || !object.skeleton) return;
    const joints = object.geometry?.getAttribute('skinIndex');
    const weights = object.geometry?.getAttribute('skinWeight');
    if (!joints || !weights || joints.count !== weights.count || joints.count !== object.geometry.getAttribute('position')?.count) return;
    skins.push(object);
    skeletons.add(object.skeleton);
    for (const bone of object.skeleton.bones) if (bone.isBone) bones.set(bone.name, bone);
    // The eyelids expand from their retracted bind pose. A static bind-pose
    // bounding sphere cannot safely represent every pose.
    object.frustumCulled = false;
  });
  // Capability claims require vertices with positive weights on each joint,
  // not simply named bones somewhere in the loaded scene.
  function usesBone(mesh, name) {
    const joint = mesh.skeleton.bones.findIndex(bone => bone.name === name);
    if (joint < 0) return false;
    const indices = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    for (let vertex = 0; vertex < indices.count; vertex++) {
      for (let lane = 0; lane < 4; lane++) {
        if (indices.getComponent(vertex, lane) === joint && weights.getComponent(vertex, lane) > 0.0001) return true;
      }
    }
    return false;
  }
  const arms = skins.filter(mesh => mesh.name.includes('CradleArms'));
  const lids = skins.filter(mesh => mesh.userData?.role === 'eyelid-surface' && mesh.name.includes('eyelid_'));
  const canUseArmPose = ARM_BONES.every(name => bones.has(name) && arms.some(mesh => usesBone(mesh, name)));
  const canBlink = LID_BONES.every(name => bones.has(name) && lids.some(mesh => mesh.name.includes(name) && usesBone(mesh, name)));
  const capabilities = Object.freeze({
    skinned: skins.length > 0,
    bones: Object.freeze([...bones.keys()]),
    clips: Object.freeze([...(canUseArmPose ? ['hold_idle', 'pet_cat', 'adjust_hold'] : []), ...(canBlink ? ['blink'] : [])]),
    morphTargets: Object.freeze([]),
    canUseArmPose,
    canBlink,
    canUseHeadPose: false,
    supportedActions: Object.freeze([
      ...(canUseArmPose ? ['princess.pet_cat', 'princess.adjust_hold', 'pair.cuddle_response'] : []),
      ...(canBlink ? ['princess.blink'] : []),
    ]),
  });
  const rest = new Map();
  for (const name of [...ARM_BONES, ...LID_BONES]) {
    const bone = bones.get(name);
    if (bone) rest.set(name, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    });
  }
  const lidBindings = LID_BONES.flatMap(name => {
    const bone = bones.get(name);
    if (!bone) return [];
    const upper = name.includes('_upper_');
    const offset = bone.userData?.openOffset ?? [0, upper ? 0.015 : -0.015, -0.008];
    const bind = bone.position.clone();
    bind.x -= offset[0]; bind.y -= offset[1]; bind.z -= offset[2];
    return [{ bone, bind, dy: offset[1], dz: offset[2] }];
  });
  let holdAnchor = null;
  let anchorRest = null;
  let disposed = false;
  let poseValid = false;
  let lastArm = null, lastAmount = NaN, lastStroke = NaN, lastBlink = NaN;

  function setHoldAnchor(anchor) {
    if (holdAnchor && anchorRest) holdAnchor.position.copy(anchorRest);
    holdAnchor = anchor ?? null;
    anchorRest = anchor?.position?.clone() ?? null;
    poseValid = false;
  }

  function reset() {
    for (const [name, pose] of rest) {
      const bone = bones.get(name);
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.quaternion);
      bone.scale.copy(pose.scale);
    }
    if (holdAnchor && anchorRest) holdAnchor.position.copy(anchorRest);
  }

  function rotate(name, x, y, z) {
    const bone = bones.get(name);
    if (!bone) return;
    if (x) bone.rotateX(x);
    if (y) bone.rotateY(y);
    if (z) bone.rotateZ(z);
    bone.quaternion.normalize();
  }

  function update(clock, action, reducedMotion = false, renderOptions) {
    if (disposed) return;
    const time = Number.isFinite(clock) ? Math.max(0, clock) : 0;
    const duration = Number.isFinite(action?.duration) && action.duration > 0 ? action.duration : 1;
    const elapsed = Number.isFinite(action?.elapsed) ? Math.max(0, action.elapsed) : 0;
    const progress = elapsed / duration;
    const arm = capabilities.canUseArmPose && !reducedMotion
      && (action?.id === 'princess.pet_cat' || action?.id === 'princess.adjust_hold' || action?.id === 'pair.cuddle_response') ? action.id : null;
    const amount = arm ? envelope(progress) * clamp01(action?.intensity ?? 1) : 0;
    const stroke = arm === 'princess.pet_cat' ? (0.10 + 0.06 * Math.sin(progress * Math.PI * 4)) * amount : 0;
    const blink = !capabilities.canBlink || reducedMotion ? 0 : action?.id === 'princess.blink'
      ? blinkAmount(elapsed, duration)
      : action?.id === 'pair.cuddle_response'
        ? blinkAmount(elapsed - 0.35)
        : blinkAmount(time % 4.9 - 4.3);
    const deferred = Boolean(renderOptions?.deferMatrices);
    if (deferred && poseValid && arm === lastArm && amount === lastAmount && stroke === lastStroke && blink === lastBlink) return false;
    reset();
    if (capabilities.canUseArmPose && !reducedMotion) {
      if (action?.id === 'princess.pet_cat') {
        // Right hand remains at its exact support pose. Only the left elbow and
        // wrist lift and make two soft strokes over the kitten.
        rotate('forearm_L', -0.08 * amount, 0, -0.32 * amount);
        rotate('hand_L', stroke, -0.08 * amount, 0);
      } else if (action?.id === 'princess.adjust_hold') {
        rotate('forearm_L', 0, 0, -0.05 * amount);
        rotate('forearm_R', 0, 0, 0.05 * amount);
        // Forearm length ~0.085 asset units, normalization ~5.12; this matches
        // the measured palm rise (~0.0295 pivot units) and never drifts from the base.
        if (holdAnchor && anchorRest) holdAnchor.position.y += 0.0295 * amount;
      } else if (action?.id === 'pair.cuddle_response') {
        // Gentle fingers/wrist acknowledgement while both forearms support.
        rotate('hand_L', 0.06 * amount, -0.03 * amount, 0);
        rotate('hand_R', 0.04 * amount, 0.03 * amount, 0);
      }
    }
    if (capabilities.canBlink) {
      const open = 1 - blink;
      for (const { bone, bind, dy, dz } of lidBindings) {
        bone.position.copy(bind);
        bone.position.y += dy * open;
        // Curve forward over the convex eye as the lid descends; the open
        // sheet retracts behind the rim instead of sitting on the iris.
        bone.position.z += dz * open ** 6;
      }
    }
    poseValid = true;
    lastArm = arm; lastAmount = amount; lastStroke = stroke; lastBlink = blink;
    if (!deferred) {
      root.updateWorldMatrix(true, true);
      for (const skeleton of skeletons) skeleton.update();
    }
    return true;
  }

  function dispose() {
    if (disposed) return;
    reset();
    holdAnchor = null;
    anchorRest = null;
    disposed = true;
  }
  return { capabilities, update, setHoldAnchor, dispose };
}
