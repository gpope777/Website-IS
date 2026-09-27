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

const TUCK: Record<string, V3> = {
  'UpperLeg.L': [-1.3, 0, 0],
  'UpperLeg.R': [-1.3, 0, 0],
  'LowerLeg.L': [1.8, 0, 0],
  'LowerLeg.R': [1.8, 0, 0],
  'UpperArm.L': [-0.9, 0, 0],
  'UpperArm.R': [-0.9, 0, 0],
};

/** The bone offsets for `anim` at `t` s since it started, or null when the clip plays as is. */
export function poseFor(anim: string, t: number): BonePose | null {
  switch (anim) {
    case 'roll': {
      const k = Math.min(1, Math.max(0, t / ROLL_S));
      return { bones: k < 1 ? TUCK : {}, rootX: k < 1 ? k * Math.PI * 2 : 0, rootY: k < 1 ? Math.sin(k * Math.PI) * 0.25 : 0 };
    }
    case 'block':
      return {
        bones: { Torso: [0.17, 0, 0], 'UpperArm.L': [-1.2, 0, -0.9], 'UpperArm.R': [-1.2, 0, 0.9], 'LowerArm.L': [0, 0, -1.3], 'LowerArm.R': [0, 0, 1.3] },
        rootX: 0,
        rootY: 0,
      };
    case 'bow': {
      const open = t < BOW_RELEASE_S ? 0.6 : 0;
      return {
        bones: { Torso: [0, 0.5, 0], 'UpperArm.L': [-1.5, 0, 0], 'LowerArm.L': [0, 0, 0], 'UpperArm.R': [-1.4, 0, 0.6 + open], 'LowerArm.R': [0, 0, 1.9 - open * 2] },
        rootX: 0,
        rootY: 0,
      };
    }
    case 'climb': {
      const a = Math.sin(t * 5);
      return {
        bones: { Torso: [0.44, 0, 0], 'UpperArm.L': [-2.4 + a * 0.5, 0, 0], 'UpperArm.R': [-2.4 - a * 0.5, 0, 0], 'UpperLeg.L': [-0.4 - a * 0.3, 0, 0], 'UpperLeg.R': [-0.4 + a * 0.3, 0, 0] },
        rootX: 0,
        rootY: 0,
      };
    }
    case 'glide':
      return {
        bones: { 'UpperArm.L': [0, 0, -1.3], 'UpperArm.R': [0, 0, 1.3], 'UpperLeg.L': [0.35, 0, 0.05], 'UpperLeg.R': [0.35, 0, -0.05], 'LowerLeg.L': [0.2, 0, 0], 'LowerLeg.R': [0.2, 0, 0] },
        rootX: 0.35,
        rootY: 0,
      };
    case 'slide':
      return {
        bones: { 'UpperArm.L': [-2.6, 0, 0], 'UpperArm.R': [-2.6, 0, 0], 'UpperLeg.L': [0.2, 0, 0], 'UpperLeg.R': [0.2, 0, 0], Head: [-0.9, 0, 0] },
        rootX: 1.4,
        rootY: 0.35,
      };
    default:
      return null;
  }
}
