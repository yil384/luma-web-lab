/**
 * One interaction clock shared by the princess, held kitten and ground trio.
 * No DOM, React or second Three.js instance. Bind the actual loaded scene objects.
 *
 * Frame order:
 *   runtime.step(delta)                      // once, before the actor components
 *   syncChonkyTrio(trio, runtime.composeGroundSnapshot(behavior.update(delta)), delta, opts)
 *   runtime.applyGround()                    // additive head/ears/tail only, after IK
 *   runtime.applyHeld()                      // princess skin, then held kitten (never ground IK)
 */
import { createInteractionScheduler, DEFAULT_CAPABILITIES } from './interaction-scheduler.mjs';
import { HELD_KITTEN_BASE_POSE, createHeldKittenPose, evaluateHeldKittenAdditivePose } from './held-kitten-rig.mjs';
import { createGroundCatPose, evaluateGroundCatAdditivePose } from './ground-cat-adapter.mjs';

const GROUND_ROLES = new Set(['head', 'ear_L', 'ear_R', 'tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4']);
const roleOf = bone => { const index = bone.name.lastIndexOf('__'); return index < 0 ? bone.name : bone.name.slice(index + 2); };
const isVigorous = id => id === 'cat.one_paw_reach' || id === 'cat.crouch_pounce';

function addRotation(bone, delta) {
  if (!delta) return;
  // Equivalent to a YXZ additive quaternion, without per-frame Euler allocation.
  if (delta[1]) bone.rotateY(delta[1]);
  if (delta[0]) bone.rotateX(delta[0]);
  if (delta[2]) bone.rotateZ(delta[2]);
  bone.quaternion.normalize();
}

function updateMatrices(cat) {
  cat.group.updateMatrixWorld(true);
  for (const mesh of cat.meshes) mesh.skeleton.update();
}

function bindCat(cat, held = false, basePose = HELD_KITTEN_BASE_POSE) {
  if (!cat || !Array.isArray(cat.rest) || !cat.rest.length || !cat.meshes?.length) {
    throw new Error('Character interactions require a loaded, skinned Chonky cat record.');
  }
  const pose = held ? createHeldKittenPose() : createGroundCatPose();
  const bindings = cat.rest.map(rest => {
    const role = roleOf(rest.bone);
    return { ...rest, role, base: held ? basePose[role] : null,
      additive: pose[role], lastBase: rest.quaternion.clone() };
  });
  return { cat, pose, bindings: held ? bindings : bindings.filter(binding => GROUND_ROLES.has(binding.role)), applied: false };
}

export function createCharacterInteractionRuntime(options = {}) {
  const scheduler = createInteractionScheduler(options);
  let princess = null;
  let held = null;
  let grounds = [];
  let behavior = null;
  let disposed = false;
  let frameNumber = 0;
  let heldFrame = -1;
  let groundFrame = -1;
  let snapshot = scheduler.peek();
  let lastGroundTap = null;
  let lastGroundTapAt = -Infinity;
  let overlaySeed = null;
  let overlayCat = null;

  function setPrincessRig(rig) {
    princess = rig;
    scheduler.setCapabilities('princess', rig?.capabilities ?? DEFAULT_CAPABILITIES.princess);
    heldFrame = -1;
  }

  function setHeldCat(cat, basePose = HELD_KITTEN_BASE_POSE) {
    held = cat ? bindCat(cat, true, basePose) : null;
    if (cat) cat.group.traverse(object => { object.userData.characterActor = 'held-cat'; });
    heldFrame = -1;
  }

  function setGroundTrio(trio, nativeBehavior) {
    grounds = trio ? trio.cats.map(cat => bindCat(cat)) : [];
    behavior = nativeBehavior ?? null;
    groundFrame = -1;
    overlaySeed = null;
    overlayCat = null;
  }

  function restoreGroundAdditives() {
    for (const record of grounds) {
      if (!record.applied) continue;
      for (const binding of record.bindings) binding.bone.quaternion.copy(binding.lastBase);
      record.applied = false;
      updateMatrices(record.cat);
    }
  }

  function dispatch(event) {
    if (disposed) return { handled: false, reason: 'DISPOSED' };
    const result = scheduler.dispatch(event);
    snapshot = scheduler.peek();
    if (event?.type === 'reduced-motion' && event.enabled) {
      restoreGroundAdditives();
      heldFrame = -1;
      applyHeld(true);
    }
    if (event?.type === 'tap' && result.handled && event.actor?.startsWith('ground-')) {
      const id = event.actor.slice(7);
      lastGroundTap = id;
      lastGroundTapAt = snapshot.clock;
      // Native focus gracefully finishes an existing play action before it brakes.
      behavior?.focus?.(id, 3.2);
    }
    return result;
  }

  function step(delta) {
    if (disposed) return snapshot;
    scheduler.advance(delta);
    snapshot = scheduler.peek();
    frameNumber++;
    return snapshot;
  }

  function applyHeld(force = false) {
    if (disposed || heldFrame === frameNumber || (snapshot.frozen && !force)) return;
    heldFrame = frameNumber;
    princess?.update(snapshot.clock, snapshot.actions.princess, snapshot.reducedMotion);
    if (!held) return;
    const { cat, pose, bindings } = held;
    evaluateHeldKittenAdditivePose(snapshot.clock, snapshot.actions['held-cat'], snapshot.reducedMotion, pose);
    for (const binding of bindings) {
      const { bone } = binding;
      bone.position.copy(binding.position);
      bone.quaternion.copy(binding.quaternion);
      bone.scale.copy(binding.scale);
      addRotation(bone, binding.base);
      addRotation(bone, binding.additive);
      if (binding.role === 'body') bone.position.y += pose.bodyLiftY;
    }
    updateMatrices(cat);
  }

  /**
   * The native behavior returns fresh pose records, so editing them never changes
   * its state. Keep its travel/IK authority; only start a tap pose while settled.
   * A tap during native social play gets an attentive head response instead.
   */
  function composeGroundSnapshot(poses) {
    if (!Array.isArray(poses) || snapshot.reducedMotion || snapshot.frozen || disposed) return poses;
    const nativeVigorous = poses.some(pose => pose.action === 'paw' || pose.action === 'pounce');
    const nativePlay = nativeVigorous || poses.some(pose => pose.partnerId);
    for (const pose of poses) {
      const actor = `ground-${pose.id}`;
      const active = snapshot.actions[actor];
      if (!active || !isVigorous(active.id)) continue;
      const continuing = overlaySeed === active.seed && overlayCat === pose.id;
      if (nativeVigorous || (!continuing && (nativePlay || pose.speed > 0.025))) {
        scheduler.dispatch({ type: 'request-action', actor, actionId: 'cat.head_tilt', priority: active.priority });
        snapshot = scheduler.peek();
        continue;
      }
      overlaySeed = active.seed;
      overlayCat = pose.id;
      pose.action = active.id === 'cat.one_paw_reach' ? 'paw' : 'pounce';
      pose.actionTime = active.elapsed;
      pose.actionDuration = active.duration;
      pose.attention = Math.max(pose.attention ?? 0, 0.8);
    }
    return poses;
  }

  function applyGround() {
    if (disposed || groundFrame === frameNumber || snapshot.frozen) return;
    groundFrame = frameNumber;
    if (snapshot.reducedMotion) { restoreGroundAdditives(); return; }
    for (const record of grounds) {
      const { cat, pose, bindings } = record;
      let glance = 0;
      const sinceTap = snapshot.clock - lastGroundTapAt;
      if (lastGroundTap && cat.id !== lastGroundTap && sinceTap >= 0 && sinceTap < 1.8) {
        const target = grounds.find(other => other.cat.id === lastGroundTap)?.cat;
        if (target) {
          const yaw = Math.atan2(target.group.position.x - cat.group.position.x, target.group.position.z - cat.group.position.z);
          const relative = Math.atan2(Math.sin(yaw - cat.group.rotation.y), Math.cos(yaw - cat.group.rotation.y));
          glance = Math.max(-0.18, Math.min(0.18, relative)) * Math.sin(Math.PI * sinceTap / 1.8) ** 2;
        }
      }
      evaluateGroundCatAdditivePose(cat.id, snapshot.clock, snapshot.actions[`ground-${cat.id}`], glance, false, pose);
      for (const binding of bindings) {
        // Capture the native pose just written by syncChonkyTrio, never the prior additive pose.
        binding.lastBase.copy(binding.bone.quaternion);
        addRotation(binding.bone, binding.additive);
      }
      record.applied = true;
      updateMatrices(cat);
    }
  }

  function dispose() {
    if (disposed) return;
    restoreGroundAdditives();
    disposed = true;
    princess = null;
    held = null;
    grounds = [];
    behavior = null;
  }

  return { setPrincessRig, setHeldCat, setGroundTrio, dispatch, step, applyHeld, applyGround, composeGroundSnapshot,
    tap: actor => dispatch({ type: 'tap', actor }),
    getSnapshot: () => scheduler.getSnapshot(),
    getBlockedLog: actor => scheduler.getBlockedLog(actor),
    dispose };
}
