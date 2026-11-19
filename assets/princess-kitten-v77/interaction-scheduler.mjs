/**
 * Pure deterministic interaction scheduler for Princess + Held Kitten + 3 Ground Cats.
 * Zero React/DOM dependencies; safe for Node unit tests and single R3F useFrame execution.
 */

export const ACTORS = /** @type {const} */ ([
  'princess',
  'held-cat',
  'ground-black',
  'ground-cream',
  'ground-calico',
]);

export const VERIFIED_CAT_BONES = Object.freeze([
  'root', 'body', 'chest', 'neck', 'head', 'ear_L', 'ear_R',
  'LF_upper', 'LF_lower', 'LF_paw', 'RF_upper', 'RF_lower', 'RF_paw',
  'tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4',
  'LH_upper', 'LH_lower', 'LH_paw', 'RH_upper', 'RH_lower', 'RH_paw',
]);

export const DEFAULT_CAPABILITIES = Object.freeze({
  princess: Object.freeze({
    bones: Object.freeze([]),
    morphTargets: Object.freeze([]),
    clips: Object.freeze([]),
    supportedActions: Object.freeze([]),
    canUseArmPose: false, // Verified from luma-princess-hug-v73.glb & v74.glb: skinCount = 0
  }),
  'held-cat': Object.freeze({
    bones: VERIFIED_CAT_BONES,
    morphTargets: Object.freeze([]),
    clips: Object.freeze([]),
    canUseArmPose: false,
  }),
  'ground-black': Object.freeze({
    bones: VERIFIED_CAT_BONES,
    morphTargets: Object.freeze([]),
    clips: Object.freeze([]),
    canUseArmPose: false,
  }),
  'ground-cream': Object.freeze({
    bones: VERIFIED_CAT_BONES,
    morphTargets: Object.freeze([]),
    clips: Object.freeze([]),
    canUseArmPose: false,
  }),
  'ground-calico': Object.freeze({
    bones: VERIFIED_CAT_BONES,
    morphTargets: Object.freeze([]),
    clips: Object.freeze([]),
    canUseArmPose: false,
  }),
});

export const ACTION_CATALOG = Object.freeze({
  // P1 Ground & Held Cat low-cost skeletal actions
  'cat.look_at_camera':   { duration: 1.4,  priority: 20, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  'cat.ear_twitch':       { duration: 0.45, priority: 10, vigorous: false, channel: 'ears',  requiresArmRig: false, requiresMorph: false },
  'cat.tail_swish':       { duration: 1.25, priority: 10, vigorous: false, channel: 'tail',  requiresArmRig: false, requiresMorph: false },
  'cat.head_tilt':        { duration: 1.1,  priority: 15, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  'cat.one_paw_reach':    { duration: 1.05, priority: 30, vigorous: true,  channel: 'paws',  requiresArmRig: false, requiresMorph: false },
  'cat.crouch_pounce':    { duration: 1.55, priority: 30, vigorous: true,  channel: 'root',  requiresArmRig: false, requiresMorph: false },
  // P1 Held Kitten independent skeletal actions (no ground IK)
  'held.nuzzle':          { duration: 1.5,  priority: 30, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  'held.adjust_posture':  { duration: 1.6,  priority: 12, vigorous: false, channel: 'body',  requiresArmRig: false, requiresMorph: false },
  // Coupled reactions. The loaded princess rig explicitly declares supported actions.
  'pair.mutual_gaze':     { duration: 2.0,  priority: 35, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  'pair.cuddle_response': { duration: 1.9,  priority: 40, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  // Require the actual loaded skin and its independently weighted arm/eyelid joints.
  'princess.pet_cat':     { duration: 2.4,  priority: 45, vigorous: false, channel: 'arms',  requiresArmRig: true,  requiresMorph: false },
  'princess.adjust_hold': { duration: 2.2,  priority: 45, vigorous: false, channel: 'arms',  requiresArmRig: true,  requiresMorph: false },
  'princess.blink':       { duration: 0.22, priority: 5,  vigorous: false, channel: 'eyes',  requiresArmRig: false, requiresMorph: false, requiresEyelidRig: true },
  'cat.blink':            { duration: 0.18, priority: 5,  vigorous: false, channel: 'eyes',  requiresArmRig: false, requiresMorph: true  },
});

const HELD_IDLE_POOL = ['cat.ear_twitch', 'cat.tail_swish', 'cat.head_tilt', 'held.adjust_posture'];
const GROUND_IDLE_POOL = ['cat.ear_twitch', 'cat.tail_swish', 'cat.head_tilt', 'cat.look_at_camera'];
const GROUND_TAP_POOL = ['cat.one_paw_reach', 'cat.head_tilt', 'cat.look_at_camera', 'cat.crouch_pounce'];

function createPrng(seed = 20261118) {
  let s = (Number.isFinite(seed) ? seed : 20261118) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canExecuteAction(actionId, capability) {
  const spec = Object.hasOwn(ACTION_CATALOG, actionId) ? ACTION_CATALOG[actionId] : null;
  if (!spec) return { allowed: false, reason: 'UNKNOWN_ACTION' };
  if (spec.requiresArmRig && (!capability?.canUseArmPose || !capability.skinned
    || !['upperArm_L', 'upperArm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'].every(name => capability.bones?.includes(name)))) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  if (spec.requiresMorph && (!capability?.morphTargets || capability.morphTargets.length === 0)) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  if (spec.requiresEyelidRig && (!capability?.canBlink || !capability.skinned
    || !['eyelid_upper_L', 'eyelid_upper_R', 'eyelid_lower_L', 'eyelid_lower_R'].every(name => capability.bones?.includes(name)))) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  if (capability?.supportedActions && !capability.supportedActions.includes(actionId)) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  return { allowed: true, reason: 'OK' };
}

function actionMatchesActor(actor, id) {
  if (id.startsWith('princess.')) return actor === 'princess';
  if (id.startsWith('pair.')) return actor === 'princess' || actor === 'held-cat';
  if (id.startsWith('held.')) return actor === 'held-cat';
  if (id === 'cat.one_paw_reach' || id === 'cat.crouch_pounce') return actor.startsWith('ground-');
  return id.startsWith('cat.') && actor !== 'princess';
}

/**
 * Create a pure interaction scheduler.
 * @param {object} [options]
 */
export function createInteractionScheduler(options = {}) {
  const rand = createPrng(options.seed ?? 20261118);
  const capabilities = { ...DEFAULT_CAPABILITIES, ...options.capabilities };
  const lowPower = Boolean(options.lowPower);
  const tapCooldownSec = Number.isFinite(options.tapCooldownSec) ? Math.max(0, options.tapCooldownSec) : 2.0;
  const maxDeltaSec = 0.05;

  let clock = 0;
  let paused = false;
  let visible = true;
  let dialogOpen = false;
  let cameraDragging = false;
  let reducedMotion = Boolean(options.reducedMotion);

  const actorState = {};
  ACTORS.forEach((actor, idx) => {
    // Staggered initial calm period: 3.0s - 5.0s + per-actor stagger so cats never sync
    const initialDelay = 3.2 + idx * 1.45 + rand() * 1.6;
    actorState[actor] = {
      active: null,
      lastActionId: null,
      lastTapTime: -Infinity,
      nextIdleAt: initialDelay,
      blockedLog: [],
    };
  });

  function isFrozen() {
    return paused || !visible || dialogOpen;
  }

  function hasVigorousActive(excludeActor) {
    return ACTORS.some((a) => {
      if (a === excludeActor) return false;
      const act = actorState[a].active;
      return Boolean(act && ACTION_CATALOG[act.id]?.vigorous);
    });
  }

  function pickNonRepeating(pool, lastId) {
    const filtered = pool.filter((id) => id !== lastId);
    const list = filtered.length ? filtered : pool;
    return list[Math.floor(rand() * list.length)];
  }

  function startAction(actor, actionId, priorityOverride) {
    if (!Object.hasOwn(actorState, actor)) return { started: false, reason: 'UNKNOWN_ACTOR' };
    if (!Object.hasOwn(ACTION_CATALOG, actionId)) return { started: false, reason: 'UNKNOWN_ACTION' };
    if (!actionMatchesActor(actor, actionId)) return { started: false, reason: 'WRONG_ACTOR' };
    const check = canExecuteAction(actionId, capabilities[actor]);
    if (!check.allowed) {
      actorState[actor].blockedLog.push({ actionId, reason: check.reason, at: clock });
      if (actorState[actor].blockedLog.length > 24) actorState[actor].blockedLog.shift();
      return { started: false, reason: check.reason };
    }
    const spec = ACTION_CATALOG[actionId];
    if (spec.vigorous && hasVigorousActive(actor)) {
      return { started: false, reason: 'VIGOROUS_LIMIT' };
    }
    const priority = Number.isFinite(priorityOverride) ? priorityOverride : spec.priority;
    const current = actorState[actor].active;
    if (current && current.priority > priority) {
      return { started: false, reason: 'LOWER_PRIORITY' };
    }
    const seed = Math.floor(rand() * 1e9);
    actorState[actor].active = {
      actor,
      id: actionId,
      elapsed: 0,
      duration: spec.duration,
      intensity: lowPower && priority < 30 ? 0.72 : 1.0,
      priority,
      seed,
    };
    actorState[actor].lastActionId = actionId;
    return { started: true, reason: 'OK' };
  }

  function dispatch(event) {
    if (!event || !event.type) return { handled: false };
    switch (event.type) {
      case 'visibility':
        visible = Boolean(event.visible);
        if (!visible) cameraDragging = false;
        return { handled: true };
      case 'dialog-open':
        dialogOpen = true;
        cameraDragging = false;
        return { handled: true };
      case 'dialog-close':
        dialogOpen = false;
        return { handled: true };
      case 'pause':
        paused = Boolean(event.paused);
        if (paused) cameraDragging = false;
        return { handled: true };
      case 'camera-drag-start':
        cameraDragging = !isFrozen() && !reducedMotion;
        return { handled: true };
      case 'camera-drag-end':
        cameraDragging = false;
        return { handled: true };
      case 'reduced-motion':
        reducedMotion = Boolean(event.enabled);
        if (reducedMotion) {
          cameraDragging = false;
          for (const a of ACTORS) actorState[a].active = null;
        }
        return { handled: true };
      case 'request-action':
        if (isFrozen() || reducedMotion || cameraDragging) return { handled: false, reason: 'FROZEN_OR_REDUCED' };
        return startAction(event.actor, event.actionId, event.priority);
      case 'tap': {
        const actor = event.actor;
        if (!Object.hasOwn(actorState, actor)) return { handled: false, reason: 'UNKNOWN_ACTOR' };
        if (isFrozen() || reducedMotion || cameraDragging) {
          return { handled: false, reason: 'SUPPRESSED' };
        }
        const st = actorState[actor];
        if (clock - st.lastTapTime < tapCooldownSec) {
          return { handled: false, reason: 'COOLDOWN' };
        }
        if (actor === 'princess') {
          // Arm actions become available only when the loaded princess rig reports support.
          const armId = st.lastActionId === 'princess.pet_cat' ? 'princess.adjust_hold' : 'princess.pet_cat';
          const actionId = [armId, 'pair.cuddle_response', 'princess.blink']
            .find(id => canExecuteAction(id, capabilities.princess).allowed);
          const r1 = actionId ? startAction('princess', actionId, 45) : { started: false, reason: 'BLOCKED_BY_RIG' };
          // The kitten can still respond while the princess asset is loading or unavailable.
          const r2 = startAction('held-cat', actionId === 'princess.adjust_hold' ? 'held.adjust_posture' : 'held.nuzzle', 45);
          if (r1.started || r2.started) st.lastTapTime = clock;
          return { handled: r1.started || r2.started, results: [r1, r2] };
        }
        if (actor === 'held-cat') {
          const nextId = st.lastActionId === 'held.nuzzle' ? 'pair.cuddle_response' : 'held.nuzzle';
          const r1 = startAction('held-cat', nextId, 45);
          const r2 = r1.started ? startAction('princess', 'pair.cuddle_response', 38) : {started:false, reason:r1.reason};
          if (r1.started) st.lastTapTime = clock;
          return { handled: r1.started, results: [r1, r2] };
        }
        // Ground cat tap: pick non-repeating expressive tap reaction
        let chosen = pickNonRepeating(GROUND_TAP_POOL, st.lastActionId);
        if (ACTION_CATALOG[chosen].vigorous && hasVigorousActive(actor)) {
          chosen = pickNonRepeating(['cat.head_tilt', 'cat.look_at_camera'], st.lastActionId);
        }
        const res = startAction(actor, chosen, 45);
        if (res.started) st.lastTapTime = clock;
        return { handled: res.started, actionId: chosen, reason: res.reason };
      }
      default:
        return { handled: false };
    }
  }

  function advance(rawDelta) {
    if (isFrozen() || reducedMotion) {
      return;
    }
    const dt = Number.isFinite(rawDelta) ? Math.max(0, Math.min(maxDeltaSec, rawDelta)) : 0;
    clock += dt;

    const idleIntervalMin = lowPower ? 8.0 : 5.0;
    const idleIntervalSpan = lowPower ? 8.0 : 7.0;

    for (const actor of ACTORS) {
      const st = actorState[actor];
      // Preserve the idle stagger across a long orbit gesture; do not release
      // several overdue idle reactions together when the pointer lifts.
      if (cameraDragging) st.nextIdleAt += dt;
      if (st.active) {
        st.active.elapsed += dt;
        if (st.active.elapsed >= st.active.duration) {
          st.active = null;
          st.nextIdleAt = clock + idleIntervalMin + rand() * idleIntervalSpan;
        }
      } else if (!cameraDragging && actor !== 'princess' && clock >= st.nextIdleAt) {
        const pool = actor === 'held-cat' ? HELD_IDLE_POOL : GROUND_IDLE_POOL;
        const nextId = pickNonRepeating(pool, st.lastActionId);
        startAction(actor, nextId);
        st.nextIdleAt = clock + idleIntervalMin + rand() * idleIntervalSpan;
      } else if (!cameraDragging && actor === 'princess' && clock >= st.nextIdleAt) {
        // Rare, gentle adjustment. Eyelid blinks run on their own bone channel in the rig.
        if (canExecuteAction('princess.adjust_hold', capabilities.princess).allowed) {
          const started = startAction('princess', 'princess.adjust_hold');
          if (started.started) startAction('held-cat', 'held.adjust_posture', 35);
        }
        st.nextIdleAt = clock + 15 + rand() * (lowPower ? 18 : 10);
      }
    }
  }

  function step(rawDelta) { advance(rawDelta); return getSnapshot(); }

  // Mutable, allocation-free view for the renderer. Call getSnapshot for retained diagnostics.
  const frame = { clock: 0, frozen: false, reducedMotion, cameraDragging: false, actions: {} };
  function peek() {
    frame.clock = clock;
    frame.frozen = isFrozen();
    frame.reducedMotion = reducedMotion;
    frame.cameraDragging = cameraDragging;
    for (const actor of ACTORS) frame.actions[actor] = actorState[actor].active;
    return frame;
  }

  function setCapabilities(actor, capability) {
    if (!Object.hasOwn(actorState, actor)) return false;
    capabilities[actor] = capability ?? DEFAULT_CAPABILITIES[actor];
    const active = actorState[actor].active;
    if (active && !canExecuteAction(active.id, capabilities[actor]).allowed) actorState[actor].active = null;
    return true;
  }

  function getSnapshot() {
    const actions = {};
    for (const a of ACTORS) {
      actions[a] = actorState[a].active ? { ...actorState[a].active } : null;
    }
    return {
      clock,
      frozen: isFrozen(),
      reducedMotion,
      cameraDragging,
      actions,
    };
  }

  function getBlockedLog(actor) {
    return [...(actorState[actor]?.blockedLog ?? [])];
  }

  return { dispatch, step, advance, peek, setCapabilities, getSnapshot, getBlockedLog };
}
