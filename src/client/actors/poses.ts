/**
 * KayKit has no climb/glide/slide clips (spec §1.1: roll/block/bow now play real clips instead). Each of the
 * three remaining anims is the closest clip plus bone offsets (Euler X, Y, Z in the bone's own frame, multiplied
 * after the mixer) and a whole-model tilt. Numbers live in one table so they can be tuned from the harness PNGs
 * (`npm run perf -- --vitrina`).
 */
export type V3 = [number, number, number];
export type PoseAnim = 'climb' | 'glide' | 'slide';
export const POSE_ANIMS: readonly PoseAnim[] = ['climb', 'glide', 'slide'];

export interface BonePose {
  bones: Record<string, V3>;
  /** Whole model pitch (rad, + = nose down / forward) about its middle. */
  rootX: number;
  /** Whole model lift (m). */
  rootY: number;
}

// Offsets solved against robot.glb, bone names carried over to KayKit's runtime spellings — three.js's GLTFLoader
// runs every node name through PropertyBinding.sanitizeNodeName, which drops '.', so the source skeleton's
// `upperarm.l` etc. become `upperarml` at runtime (verified against public/models/heroe-caballero.glb in
// hero-clips.test.ts). Values solved for the robot; re-tune with the vitrina in Task 9 — Decidido por Claude —
// revisar. Legs: −X = thigh forward, +X on the shin = knee bent. Chest/head: +X = lean forward.
type Bones = Record<string, V3>;
const CLIMB_A: Bones = { upperarml: [-1.71, 0.92, -0.73], lowerarml: [0.68, 0.26, -1.01], upperarmr: [-0.99, -0.63, -0.12], lowerarmr: [1.7, 0.05, 0.24] };
const CLIMB_B: Bones = { upperarml: [-0.02, -0.03, -0.77], lowerarml: [1.37, 0.17, -0.22], upperarmr: [-0.62, -0.3, 1.67], lowerarmr: [0.67, -0.04, 0.13] };
const GLIDE: Bones = {
  upperarml: [0.97, -0.3, -0.28],
  lowerarml: [-1.89, -0.08, 0.28],
  upperarmr: [1.61, -0.75, -0.44],
  lowerarmr: [0.84, 0.04, 0],
  upperlegl: [0.35, 0, 0],
  upperlegr: [0.35, 0, 0],
  lowerlegl: [0.2, 0, 0],
  lowerlegr: [0.2, 0, 0],
};
// Slide: both hands past the head = climb's raised arm on each side (the direct solve on Jump could not reach).
const SLIDE: Bones = {
  upperarml: [-1.71, 0.92, -0.73],
  lowerarml: [0.68, 0.26, -1.01],
  upperarmr: [-0.62, -0.3, 1.67],
  lowerarmr: [0.67, -0.04, 0.13],
  upperlegl: [0.2, 0, 0],
  upperlegr: [0.2, 0, 0],
  head: [-0.9, 0, 0],
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
    case 'climb': {
      const bones = mix(CLIMB_A, CLIMB_B, (Math.sin(t * 5) + 1) / 2);
      bones.chest = [0.44, 0, 0];
      return { bones, rootX: 0, rootY: 0 };
    }
    case 'glide':
      return { bones: GLIDE, rootX: 0.35, rootY: 0 };
    case 'slide':
      // P7-E: the body's middle ~0.3 m off the ground (it floated at 1.25 m).
      return { bones: SLIDE, rootX: 1.4, rootY: -0.55 };
    default:
      return null;
  }
}
