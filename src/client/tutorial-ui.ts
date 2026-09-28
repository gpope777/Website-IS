/** P7-F: what the HUD shows while someone learns (spec §8). Pure; `game.ts` wires it. */
import type { Inventory } from '../shared/items';
import { TUT, tutLine, tutPills } from '../shared/tutorial';
import type { TipId } from './guide-model';
import { PILLS } from './hud-model';

/** A control that glows: the A button, the stick, or a pill by its P7-C name. */
export type HintTarget = 'act' | 'stick' | (typeof PILLS)[number];

export interface TutHudView {
  tut: { step: number; wait?: boolean } | null;
  touch: boolean;
  heart: boolean;
  inv: Inventory;
  me: { x: number; z: number };
  players: readonly { name: string; x: number; z: number; tut?: number; away?: boolean; dead?: boolean }[];
}

export interface TutHud {
  /** The tutorial line in the tracker's place (null: not learning). */
  line: string | null;
  hint: HintTarget[];
  /** Pills while learning (null: the normal P7-C rule). */
  pills: boolean[] | null;
  /** Co-op: "(Bea puede ayudarte)" to a learner, "Leo está aprendiendo (4/8)" to the others. */
  note: string | null;
  /** The guide's edge arrow: hidden while learning, back for step 8 (the shrine). */
  arrow: boolean;
}

/** Tips the tutorial already taught: marked shown when it ends. */
export const TAUGHT_TIPS: readonly TipId[] = ['look', 'berries', 'wood', 'wolf', 'roll', 'bow'];

function hintFor(step: number, v: TutHudView): HintTarget[] {
  if (!v.touch || v.tut?.wait) return [];
  switch (step) {
    case 1:
      return ['stick'];
    case 2:
      return (v.inv.berries ?? 0) > 0 ? ['eat'] : ['act'];
    case 3:
      return ['act'];
    case 4:
      return ['campfire'];
    case 5:
      return v.heart ? [] : ['heart'];
    case 6:
      return ['roll', 'block'];
    case 7:
      return ['lock', 'bow'];
    default:
      return [];
  }
}

export function tutHud(v: TutHudView): TutHud {
  const close = v.players.filter((p) => !p.away && !p.dead && Math.hypot(p.x - v.me.x, p.z - v.me.z) <= TUT.near);
  if (!v.tut) {
    const l = close.find((p) => p.tut !== undefined);
    return { line: null, hint: [], pills: null, note: l ? `${l.name} está aprendiendo (${l.tut}/${TUT.steps})` : null, arrow: true };
  }
  const { step } = v.tut;
  const helper = close.find((p) => p.tut === undefined);
  return {
    line: tutLine(step, { touch: v.touch, heart: v.heart, inv: v.inv, wait: !!v.tut.wait }),
    hint: hintFor(step, v),
    pills: tutPills(step, v.heart),
    note: helper ? `(${helper.name} puede ayudarte)` : null,
    arrow: step === TUT.steps,
  };
}
