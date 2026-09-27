/**
 * V2-E: the robot has no roll/block/bow/climb/glide/slide clips (spec §6.4). Each is the closest clip plus
 * bone offsets (Euler X, Y, Z in the bone's own frame, multiplied after the mixer) and a whole-model tilt.
 * Numbers live in one table so they can be tuned from the harness PNGs (`npm run perf -- --vitrina`).
 */
export type V3 = [number, number, number];
export type PoseAnim = 'roll' | 'block' | 'bow' | 'climb' | 'glide' | 'slide';
export const POSE_ANIMS: readonly PoseAnim[] = ['roll', 'block', 'bow', 'climb', 'glide', 'slide'];

export interface BonePose {
  bones: Record<string, V3>;
  /** Whole model pitch (rad, + = nose down / forward) about its middle. */
  rootX: number;
  /** Whole model lift (m). */
  rootY: number;
}

/** How long a roll takes (s): one full turn. */
export const ROLL_S = 0.45;
/** The bow's right hand opens this long when the shot goes (the anim restarting). */
export const BOW_RELEASE_S = 0.15;

// Offsets solved against robot.glb (three.js bone names: dots dropped) so the hands land where each pose wants them
// (block: crossed before the chest; bow: left arm straight ahead, right hand by the face; climb: one hand high, the
// other at the shoulder; glide: arms out; slide: arms past the head; roll: hands at the knees). Legs: −X = thigh forward,
// +X on the shin = knee bent. Torso/Head: +X = lean forward.
type Bones = Record<string, V3>;
const ROLL: Bones = {
  UpperArmL: [0.01, -0.22, 1.17],
  LowerArmL: [-0.5, -0.71, 0.59],
  UpperArmR: [0.82, -0.19, -0.91],
  LowerArmR: [-0.68, -0.61, -0.42],
  UpperLegL: [-1.3, 0, 0],
  UpperLegR: [-1.3, 0, 0],
  LowerLegL: [1.8, 0, 0],
  LowerLegR: [1.8, 0, 0],
  Head: [0.5, 0, 0],
};
const BLOCK: Bones = {
  Torso: [0.17, 0, 0],
  UpperArmL: [-0.11, 1.2, -0.13],
  LowerArmL: [1.27, 0.48, -0.02],
  UpperArmR: [-0.35, -0.83, -0.41],
  LowerArmR: [1.59, 0.05, 0.2],
};
const BOW: Bones = {
  UpperArmL: [-0.06, -0.37, -1.16],
  LowerArmL: [-0.27, -0.1, -0.68],
  UpperArmR: [0.34, -0.07, -0.56],
  LowerArmR: [2.91, -0.91, 0.43],
};
const CLIMB_A: Bones = { UpperArmL: [-1.71, 0.92, -0.73], LowerArmL: [0.68, 0.26, -1.01], UpperArmR: [-0.99, -0.63, -0.12], LowerArmR: [1.7, 0.05, 0.24] };
const CLIMB_B: Bones = { UpperArmL: [-0.02, -0.03, -0.77], LowerArmL: [1.37, 0.17, -0.22], UpperArmR: [-0.62, -0.3, 1.67], LowerArmR: [0.67, -0.04, 0.13] };
const GLIDE: Bones = {
  UpperArmL: [0.97, -0.3, -0.28],
  LowerArmL: [-1.89, -0.08, 0.28],
  UpperArmR: [1.61, -0.75, -0.44],
  LowerArmR: [0.84, 0.04, 0],
  UpperLegL: [0.35, 0, 0],
  UpperLegR: [0.35, 0, 0],
  LowerLegL: [0.2, 0, 0],
  LowerLegR: [0.2, 0, 0],
};
// Slide: both hands past the head = climb's raised arm on each side (the direct solve on Jump could not reach).
const SLIDE: Bones = {
  UpperArmL: [-1.71, 0.92, -0.73],
  LowerArmL: [0.68, 0.26, -1.01],
  UpperArmR: [-0.62, -0.3, 1.67],
  LowerArmR: [0.67, -0.04, 0.13],
  UpperLegL: [0.2, 0, 0],
  UpperLegR: [0.2, 0, 0],
  Head: [-0.9, 0, 0],
};

function mix(a: Bones, b: Bones, k: number): Bones {
  const out: Bones = {};
  for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[n] ?? [0, 0, 0];
    const q = b[n] ?? [0, 0, 0];
    out[n] = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  }
  return out;
}

/** The bone offsets for `anim` at `t` s since it started, or null when the clip plays as is. */
export function poseFor(anim: string, t: number): BonePose | null {
  switch (anim) {
    case 'roll': {
      const k = Math.min(1, Math.max(0, t / ROLL_S));
      return { bones: k < 1 ? ROLL : {}, rootX: k < 1 ? k * Math.PI * 2 : 0, rootY: k < 1 ? Math.sin(k * Math.PI) * 0.25 : 0 };
    }
    case 'block':
      return { bones: BLOCK, rootX: 0, rootY: 0 };
    case 'bow':
      // The right hand opens (half-way back to the clip) for a moment when the shot goes.
      return { bones: t < BOW_RELEASE_S ? mix(BOW, { UpperArmL: BOW.UpperArmL!, LowerArmL: BOW.LowerArmL! }, 0.5) : BOW, rootX: 0, rootY: 0 };
    case 'climb': {
      const bones = mix(CLIMB_A, CLIMB_B, (Math.sin(t * 5) + 1) / 2);
      bones.Torso = [0.44, 0, 0];
      return { bones, rootX: 0, rootY: 0 };
    }
    case 'glide':
      return { bones: GLIDE, rootX: 0.35, rootY: 0 };
    case 'slide':
      return { bones: SLIDE, rootX: 1.4, rootY: 0.35 };
    default:
      return null;
  }
}
