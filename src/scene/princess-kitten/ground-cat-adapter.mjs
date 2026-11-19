/**
 * Ground-cat secondary skeletal action adapter for the 3 ground cats (black, cream, calico).
 * Layers subtle, non-repeating additive ear/tail/head motions from interaction-scheduler.mjs
 * AFTER syncChonkyTrio runs, preserving ground foot IK and separation bounds.
 * Reuse createGroundCatPose() output for allocation-free useFrame integration.
 */

import { smoothEnvelope } from './held-kitten-rig.mjs';

export const GROUND_CAT_IDS = Object.freeze(['black', 'cream', 'calico']);

export function actorIdForGroundCat(catId) {
  return `ground-${catId}`;
}

/**
 * Compute additive bone Euler deltas (radians) for a single ground cat.
 * Never overrides leg/paw IK targets; only adds expressive head/ear/tail motion
 * or signals `behavior.focus` / `paw` / `pounce` intent cleanly.
 */
export function createGroundCatPose() {
  return {
    head: [0, 0, 0],
    ear_L: [0, 0, 0],
    ear_R: [0, 0, 0],
    tail_0: [0, 0, 0],
    tail_1: [0, 0, 0],
    tail_2: [0, 0, 0],
    tail_3: [0, 0, 0],
    tail_4: [0, 0, 0],
  };
}

const GROUND_POSE_BONES = Object.freeze(Object.keys(createGroundCatPose()));

export function evaluateGroundCatAdditivePose(catId, clock, activeAction, glanceYaw = 0, reducedMotion = false, out = createGroundCatPose()) {
  for (const key of GROUND_POSE_BONES) out[key].fill(0);
  if (reducedMotion) return out;

  // Subtle glance when a sibling ground cat was tapped (non-synchronized)
  if (Math.abs(glanceYaw) > 1e-4) {
    out.head[1] += Math.max(-0.28, Math.min(0.28, glanceYaw));
  }

  if (!activeAction) return out;
  const p = activeAction.duration > 0 ? activeAction.elapsed / activeAction.duration : 0;
  const env = smoothEnvelope(p) * (activeAction.intensity ?? 1);

  switch (activeAction.id) {
    case 'cat.ear_twitch': {
      const flick = Math.sin(p * Math.PI * 3) * env * 0.24;
      if ((activeAction.seed ?? 0) % 2 === 0) out.ear_L[2] += flick;
      else out.ear_R[2] -= flick;
      break;
    }
    case 'cat.tail_swish': {
      for (let i = 0; i < 5; i++) {
        out[`tail_${i}`][1] += Math.sin(p * Math.PI * 2 - i * 0.45) * env * (0.12 + i * 0.025);
        out[`tail_${i}`][0] += Math.sin(p * Math.PI) * env * 0.05;
      }
      break;
    }
    case 'cat.head_tilt': {
      const dir = (activeAction.seed ?? 0) % 2 === 0 ? 1 : -1;
      out.head[2] += dir * env * 0.25;
      out.head[0] -= env * 0.08;
      out.ear_L[2] += dir * env * 0.08;
      out.ear_R[2] += dir * env * 0.08;
      break;
    }
    case 'cat.look_at_camera': {
      out.head[0] -= env * 0.14;
      out.ear_L[2] += env * 0.06;
      out.ear_R[2] -= env * 0.06;
      break;
    }
    case 'cat.one_paw_reach': {
      // Complements chonky-rig's native paw reach with attentive ear perk & tail balance
      out.head[0] -= env * 0.12;
      out.ear_L[2] += env * 0.10;
      out.ear_R[2] -= env * 0.10;
      for (let i = 0; i < 5; i++) out[`tail_${i}`][0] += env * (0.06 + i * 0.015);
      break;
    }
    case 'cat.crouch_pounce': {
      // Complements chonky-rig's native pounce with ears flattened slightly back & tail flick
      out.ear_L[2] -= env * 0.14;
      out.ear_R[2] += env * 0.14;
      for (let i = 0; i < 5; i++) out[`tail_${i}`][1] += Math.sin(p * Math.PI * 3 - i * 0.35) * env * 0.14;
      break;
    }
    default:
      break;
  }
  return out;
}
