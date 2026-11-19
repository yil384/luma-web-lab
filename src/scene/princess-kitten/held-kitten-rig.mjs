/**
 * Independent HeldKittenRig pose evaluator (no ground IK or walking).
 * Pass a reusable output from createHeldKittenPose() for the allocation-free runtime path.
 * Operates exclusively on verified 24 bones of chonky_cream from chonky-cat-trio-BEKpO2QH.glb.
 * Always resets to cached rest transforms before applying base cradle pose + additive action channels
 * so continuous 60s+ execution produces ZERO cumulative drift.
 */

export const HELD_KITTEN_BASE_POSE = Object.freeze({
  "body": [
    0.05,
    0.0,
    0.0
  ],
  "chest": [
    -0.03,
    -0.06,
    0.0
  ],
  "neck": [
    0.0,
    -0.22,
    0.02
  ],
  "head": [
    0.05,
    -0.42,
    0.04
  ],
  "ear_L": [
    0.0,
    0.0,
    0.05
  ],
  "ear_R": [
    0.0,
    0.0,
    -0.05
  ],
  "LF_upper": [
    0.72,
    0.1,
    0.08
  ],
  "LF_lower": [
    -0.88,
    0.0,
    0.0
  ],
  "RF_upper": [
    0.75,
    -0.1,
    -0.08
  ],
  "RF_lower": [
    -0.9,
    0.0,
    0.0
  ],
  "LH_upper": [
    0.76,
    0.08,
    0.06
  ],
  "LH_lower": [
    -0.86,
    0.0,
    0.0
  ],
  "RH_upper": [
    0.78,
    -0.08,
    -0.06
  ],
  "RH_lower": [
    -0.88,
    0.0,
    0.0
  ],
  "tail_0": [
    -0.12,
    0.34,
    0.06
  ],
  "tail_1": [
    -0.08,
    0.38,
    0.04
  ],
  "tail_2": [
    -0.04,
    0.4,
    0.02
  ],
  "tail_3": [
    0.0,
    0.36,
    0.0
  ],
  "tail_4": [
    0.04,
    0.3,
    0.0
  ]
});

export function smoothEnvelope(t) {
  const u = Math.max(0, Math.min(1, t));
  return Math.sin(Math.PI * u) ** 2;
}

/**
 * Compute additive bone Euler offsets (radians) for the held kitten at time `clock`
 * given an optional `activeAction` from `interaction-scheduler.mjs`.
 * Returns a plain map of boneShortName -> [rx, ry, rz] additive deltas on top of heldKittenBaseBonePose.
 */
export function createHeldKittenPose() {
  return {
    body: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    ear_L: [0, 0, 0],
    ear_R: [0, 0, 0],
    tail_0: [0, 0, 0],
    tail_1: [0, 0, 0],
    tail_2: [0, 0, 0],
    tail_3: [0, 0, 0],
    tail_4: [0, 0, 0],
    bodyLiftY: 0,
  };
}

const HELD_POSE_BONES = Object.freeze(Object.keys(createHeldKittenPose()).filter(key => key !== 'bodyLiftY'));

export function evaluateHeldKittenAdditivePose(clock, activeAction, reducedMotion = false, out = createHeldKittenPose()) {
  for (const key of HELD_POSE_BONES) out[key].fill(0);
  out.bodyLiftY = 0;
  if (reducedMotion) return out;

  // Gentle breathing & tail sway baseline (tiny amplitude so belly stays locked to hands)
  out.bodyLiftY = Math.sin(clock * 1.9) * 0.008;
  out.head[0] += Math.sin(clock * 0.85) * 0.025;
  out.head[1] += Math.sin(clock * 0.52) * 0.045;
  for (let i = 0; i < 5; i++) {
    const wave = Math.sin(clock * 1.35 - i * 0.55) * (0.04 + i * 0.012);
    out[`tail_${i}`][1] += wave;
  }

  if (!activeAction) return out;
  const p = activeAction.duration > 0 ? activeAction.elapsed / activeAction.duration : 0;
  const env = smoothEnvelope(p) * (activeAction.intensity ?? 1);

  switch (activeAction.id) {
    case 'cat.ear_twitch': {
      const flick = Math.sin(p * Math.PI * 3) * env * 0.22;
      if ((activeAction.seed ?? 0) % 2 === 0) out.ear_L[2] += flick;
      else out.ear_R[2] -= flick;
      break;
    }
    case 'cat.tail_swish': {
      for (let i = 0; i < 5; i++) {
        out[`tail_${i}`][1] += Math.sin(p * Math.PI * 2 - i * 0.4) * env * (0.11 + i * 0.025);
        out[`tail_${i}`][0] += Math.sin(p * Math.PI) * env * 0.04;
      }
      break;
    }
    case 'cat.head_tilt': {
      const dir = (activeAction.seed ?? 0) % 2 === 0 ? 1 : -1;
      out.head[2] += dir * env * 0.24;
      out.head[1] += dir * env * 0.10;
      out.ear_L[2] += dir * env * 0.08;
      out.ear_R[2] += dir * env * 0.08;
      break;
    }
    case 'cat.look_at_camera': {
      out.head[0] -= env * 0.10;
      out.head[1] += env * 0.16;
      break;
    }
    case 'held.adjust_posture': {
      // Micro cozy settle without breaking hand support
      out.chest[2] += Math.sin(p * Math.PI * 2) * env * 0.06;
      out.neck[0] -= env * 0.05;
      out.bodyLiftY += Math.sin(p * Math.PI) * env * 0.012;
      break;
    }
    case 'held.nuzzle': {
      // Kitten turns slightly toward princess's chest & gently nuzzles
      out.neck[1] += env * 0.22;
      out.head[1] += env * 0.28;
      out.head[0] -= env * 0.14;
      out.head[2] += Math.sin(p * Math.PI * 2) * env * 0.14;
      out.ear_L[2] += env * 0.12;
      out.ear_R[2] -= env * 0.12;
      for (let i = 0; i < 5; i++) out[`tail_${i}`][1] += Math.sin(p * Math.PI * 3 - i * 0.45) * env * 0.09;
      break;
    }
    case 'pair.mutual_gaze': {
      // Kitten looks up toward princess's face while princess gives a gentle nod
      out.neck[0] -= env * 0.16;
      out.head[0] -= env * 0.22;
      out.head[1] += env * 0.16;
      out.ear_L[2] += env * 0.07;
      out.ear_R[2] -= env * 0.07;
      break;
    }
    case 'pair.cuddle_response': {
      // Coordinated happy head tilt + nuzzle + soft tail curl
      out.neck[0] -= env * 0.12;
      out.head[0] -= env * 0.14;
      out.head[2] += Math.sin(p * Math.PI * 2) * env * 0.18;
      for (let i = 0; i < 5; i++) out[`tail_${i}`][1] += Math.sin(p * Math.PI * 2.5 - i * 0.35) * env * 0.12;
      break;
    }
    default:
      break;
  }
  return out;
}

/**
 * Evaluate conservative PrincessPivot transform (no fake arm rotation!).
 * PrincessPivot holds BOTH PrincessMesh and HoldAnchor, so relative hand-to-kitten lock is 100% rigid.
 */
export function evaluatePrincessPivotPose(clock, activeAction, reducedMotion = false) {
  const baseYaw = -0.24;
  if (reducedMotion) {
    return { posY: 0, rotX: 0, rotY: baseYaw, rotZ: 0 };
  }
  let rotX = 0;
  let rotY = baseYaw + Math.sin(clock * 0.26) * 0.030;
  let rotZ = Math.sin(clock * 0.30) * 0.005;
  let posY = Math.sin(clock * 0.78) * 0.008;

  if (activeAction) {
    const p = activeAction.duration > 0 ? activeAction.elapsed / activeAction.duration : 0;
    const env = smoothEnvelope(p) * (activeAction.intensity ?? 1);
    if (activeAction.id === 'pair.mutual_gaze') {
      // Gentle conservative nod (never pretending to bend non-existent arm/neck bones)
      rotX += env * 0.048;
      rotY += env * 0.025;
    } else if (activeAction.id === 'pair.cuddle_response') {
      rotX += env * 0.036;
      rotZ += Math.sin(p * Math.PI * 2) * env * 0.018;
    }
  }
  return { posY, rotX, rotY, rotZ };
}
