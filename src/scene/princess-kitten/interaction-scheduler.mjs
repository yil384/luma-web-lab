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
  // P1.5 Coupled Princess + Held Kitten actions (conservative PrincessPivot nod + HeldKittenRig)
  'pair.mutual_gaze':     { duration: 2.0,  priority: 35, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  'pair.cuddle_response': { duration: 1.9,  priority: 40, vigorous: false, channel: 'head',  requiresArmRig: false, requiresMorph: false },
  // P2 Explicitly BLOCKED_BY_RIG until real arm/morph assets exist
  'princess.pet_cat':     { duration: 2.4,  priority: 45, vigorous: false, channel: 'arms',  requiresArmRig: true,  requiresMorph: false },
  'princess.adjust_hold': { duration: 2.2,  priority: 45, vigorous: false, channel: 'arms',  requiresArmRig: true,  requiresMorph: false },
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
  const spec = ACTION_CATALOG[actionId];
  if (!spec) return { allowed: false, reason: 'UNKNOWN_ACTION' };
  if (spec.requiresArmRig && !capability?.canUseArmPose) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  if (spec.requiresMorph && (!capability?.morphTargets || capability.morphTargets.length === 0)) {
    return { allowed: false, reason: 'BLOCKED_BY_RIG' };
  }
  return { allowed: true, reason: 'OK' };
}

/**
 * Create a pure interaction scheduler.
 * @param {object} [options]
 */
export function createInteractionScheduler(options = {}) {
  const rand = createPrng(options.seed ?? 20261118);
  const capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;
  const lowPower = Boolean(options.lowPower);
  const tapCooldownSec = options.tapCooldownSec ?? 2.0;
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
    const check = canExecuteAction(actionId, capabilities[actor]);
    if (!check.allowed) {
      actorState[actor].blockedLog.push({ actionId, reason: check.reason, at: clock });
      return { started: false, reason: check.reason };
    }
    const spec = ACTION_CATALOG[actionId];
    if (spec.vigorous && hasVigorousActive(actor)) {
      return { started: false, reason: 'VIGOROUS_LIMIT' };
    }
    const priority = priorityOverride ?? spec.priority;
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
        return { handled: true };
      case 'dialog-open':
        dialogOpen = true;
        return { handled: true };
      case 'dialog-close':
        dialogOpen = false;
        return { handled: true };
      case 'pause':
        paused = Boolean(event.paused);
        return { handled: true };
      case 'camera-drag-start':
        cameraDragging = true;
        return { handled: true };
      case 'camera-drag-end':
        cameraDragging = false;
        return { handled: true };
      case 'reduced-motion':
        reducedMotion = Boolean(event.enabled);
        if (reducedMotion) {
          for (const a of ACTORS) actorState[a].active = null;
        }
        return { handled: true };
      case 'request-action':
        if (isFrozen() || reducedMotion) return { handled: false, reason: 'FROZEN_OR_REDUCED' };
        return startAction(event.actor, event.actionId, event.priority);
      case 'tap': {
        const actor = event.actor;
        if (!actorState[actor]) return { handled: false, reason: 'UNKNOWN_ACTOR' };
        if (isFrozen() || reducedMotion || cameraDragging) {
          return { handled: false, reason: 'SUPPRESSED' };
        }
        const st = actorState[actor];
        if (clock - st.lastTapTime < tapCooldownSec) {
          return { handled: false, reason: 'COOLDOWN' };
        }
        st.lastTapTime = clock;
        if (actor === 'princess') {
          // Coupled mutual gaze: princess conservative nod + held-cat gazes/nuzzles
          const r1 = startAction('princess', 'pair.mutual_gaze', 40);
          const r2 = startAction('held-cat', 'pair.mutual_gaze', 40);
          return { handled: r1.started || r2.started, results: [r1, r2] };
        }
        if (actor === 'held-cat') {
          const nextId = st.lastActionId === 'held.nuzzle' ? 'pair.cuddle_response' : 'held.nuzzle';
          const r1 = startAction('held-cat', nextId, 45);
          const r2 = startAction('princess', 'pair.cuddle_response', 38);
          return { handled: r1.started, results: [r1, r2] };
        }
        // Ground cat tap: pick non-repeating expressive tap reaction
        let chosen = pickNonRepeating(GROUND_TAP_POOL, st.lastActionId);
        if (ACTION_CATALOG[chosen].vigorous && hasVigorousActive(actor)) {
          chosen = pickNonRepeating(['cat.head_tilt', 'cat.look_at_camera'], st.lastActionId);
        }
        const res = startAction(actor, chosen, 45);
        return { handled: res.started, actionId: chosen, reason: res.reason };
      }
      default:
        return { handled: false };
    }
  }

  function step(rawDelta) {
    if (isFrozen() || reducedMotion) {
      return getSnapshot();
    }
    const dt = Number.isFinite(rawDelta) ? Math.max(0, Math.min(maxDeltaSec, rawDelta)) : 0;
    clock += dt;

    const idleIntervalMin = lowPower ? 8.0 : 5.0;
    const idleIntervalSpan = lowPower ? 8.0 : 7.0;

    for (const actor of ACTORS) {
      const st = actorState[actor];
      if (st.active) {
        st.active.elapsed += dt;
        if (st.active.elapsed >= st.active.duration) {
          st.active = null;
          st.nextIdleAt = clock + idleIntervalMin + rand() * idleIntervalSpan;
        }
      } else if (actor !== 'princess' && clock >= st.nextIdleAt) {
        const pool = actor === 'held-cat' ? HELD_IDLE_POOL : GROUND_IDLE_POOL;
        const nextId = pickNonRepeating(pool, st.lastActionId);
        startAction(actor, nextId);
        st.nextIdleAt = clock + idleIntervalMin + rand() * idleIntervalSpan;
      }
    }
    return getSnapshot();
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

  return { dispatch, step, getSnapshot, getBlockedLog };
}
