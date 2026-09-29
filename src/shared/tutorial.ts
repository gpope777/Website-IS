/** P7-F: the tutorial (spec §8). Pure: the server feeds it events, the client reads its lines and pills. */
import { BUILD_COST, type Inventory, type StructureKind } from './items';
import { costText } from './names';

export const TUT = {
  steps: 8,
  /** Step 1: metres walked and radians turned. */
  walk: 10,
  turn: Math.PI / 2,
  /** Step 5: close enough to a Heart someone else planted. */
  heartNear: 15,
  /** The practice wolf: PV, bite, spawn distance, the still one's distance, health it never takes you under. */
  wolfHp: 40,
  wolfDmg: 4,
  wolfAt: 15,
  stillAt: 12,
  floor: 10,
  /** Step 6 ends on a parry, this many dodges or this many bites taken. */
  dodges: 2,
  fails: 3,
  /** Step 8: metres walked. */
  explore: 30,
  /** The practice wolf goes if its owner is further than this. */
  leash: 60,
  /** Co-op notes within this many metres. */
  near: 30,
} as const;

/** Saved per player: the current step (1–8), finished, or never shown. */
export type TutState = number | 'done' | 'skip';
export const isTutState = (v: unknown): v is TutState => v === 'done' || v === 'skip' || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= TUT.steps);

export interface TutProgress { step: number; walk: number; turn: number; dodges: number; fails: number }
export type TutEvent =
  | { k: 'move'; m: number; turn: number }
  | { k: 'eat' }
  | { k: 'inv'; inv: Inventory }
  | { k: 'build'; kind: StructureKind }
  | { k: 'heartNear' }
  | { k: 'parry' }
  | { k: 'dodge' }
  | { k: 'bitten' }
  | { k: 'kill' }
  | { k: 'bow' };

export function tutStart(step = 1): TutProgress {
  return { step, walk: 0, turn: 0, dodges: 0, fails: 0 };
}

const has = (inv: Inventory, cost: Inventory): boolean => Object.entries(cost).every(([k, n]) => (inv[k as keyof Inventory] ?? 0) >= (n ?? 0));

/** One event → the progress after it. `step` 9 = done. Events of another step change nothing. */
export function tutAdvance(p: TutProgress, e: TutEvent): TutProgress {
  const next = (): TutProgress => tutStart(p.step + 1);
  switch (p.step) {
    case 1:
      if (e.k !== 'move') return p;
      {
        const q = { ...p, walk: p.walk + e.m, turn: p.turn + Math.abs(e.turn) };
        return q.walk >= TUT.walk && q.turn >= TUT.turn ? next() : q;
      }
    case 2:
      return e.k === 'eat' ? next() : p;
    case 3:
      return e.k === 'inv' && has(e.inv, BUILD_COST.campfire) ? next() : p;
    case 4:
      return e.k === 'build' && e.kind === 'campfire' ? next() : p;
    case 5:
      return (e.k === 'build' && e.kind === 'heart') || e.k === 'heartNear' ? next() : p;
    case 6:
      if (e.k === 'parry' || e.k === 'kill') return next();
      if (e.k === 'dodge') return p.dodges + 1 >= TUT.dodges ? next() : { ...p, dodges: p.dodges + 1 };
      if (e.k === 'bitten') return p.fails + 1 >= TUT.fails ? next() : { ...p, fails: p.fails + 1 };
      return p;
    case 7:
      return e.k === 'bow' ? next() : p;
    case 8:
      if (e.k !== 'move') return p;
      return p.walk + e.m >= TUT.explore ? next() : { ...p, walk: p.walk + e.m };
    default:
      return p;
  }
}

/** What counts as "already played" (spec §8.1, a bit stricter: anything in the mochila or built counts). */
export interface ProgressLike {
  shrines?: number[];
  enredadera?: boolean;
  viento?: boolean;
  fuego?: boolean;
  piedra?: boolean;
  steed?: unknown;
  fish?: unknown;
  frog?: unknown;
  dragon?: unknown;
  skills?: string[];
  kills?: Record<string, number>;
  chests?: number[];
  weaponLvl?: number;
  capaLvl?: number;
  inv: Inventory;
}

export function hasProgress(p: ProgressLike, o: { ownsStructure: boolean; xp: number }): boolean {
  return (
    o.ownsStructure ||
    o.xp > 0 ||
    (p.shrines?.length ?? 0) > 0 ||
    !!(p.enredadera || p.viento || p.fuego || p.piedra) ||
    !!(p.steed || p.fish || p.frog || p.dragon) ||
    (p.skills?.length ?? 0) > 0 ||
    Object.values(p.kills ?? {}).some((n) => n > 0) ||
    (p.chests?.length ?? 0) > 0 ||
    (p.weaponLvl ?? 0) > 0 ||
    (p.capaLvl ?? 0) > 0 ||
    Object.values(p.inv).some((n) => (n ?? 0) > 0)
  );
}

/** Pills while learning, in the P7-C order (eat, campfire, wall, heart, trap, roll, block, bow, lock, power). Wall, trap and power wait for the end. */
export function tutPills(step: number, heart: boolean): boolean[] {
  return [step >= 2, step >= 4, false, step >= 5 && !heart, false, step >= 6, step >= 6, step >= 7, step >= 7, false];
}

export const TUT_DONE = 'Tutorial hecho.';
export const TUT_WAIT = 'Primero, aguanta.';

/** The line in the tracker's place: "3/8 · …". Touch names the pill, PC the key. */
export function tutLine(step: number, o: { touch: boolean; heart: boolean; ownHeart?: boolean; inv: Inventory; wait: boolean }): string {
  const k = (t: string, pc: string) => (o.touch ? t : pc);
  const n = `${step}/${TUT.steps} · `;
  if (o.wait) return n + TUT_WAIT;
  const have = (cost: Inventory) => `Tienes ${(Object.keys(cost) as (keyof Inventory)[]).map((m) => o.inv[m] ?? 0).join(' y ')}.`;
  switch (step) {
    case 1:
      return n + k('Arrastra a la derecha para mirar. El stick anda.', 'El ratón mira. WASD anda.');
    case 2:
      return n + k('A junto a un arbusto: bayas. Luego 🫐 para comer.', 'E junto a un arbusto: bayas. Luego 1 para comer.');
    case 3:
      return n + `${k('A', 'E')} en árboles y rocas: ${costText(BUILD_COST.campfire)}. ${have(BUILD_COST.campfire)}`;
    case 4:
      return n + `La noche enfría. ${k('🔥', 'B')} pone una fogata.`;
    case 5:
      return n + (o.heart
        ? 'Este mundo ya tiene Corazón. Ve a verlo: es la casa de todos.'
        : `Planta el Corazón con ${k('🌳', 'G')}, cerca de aquí: ${costText(BUILD_COST.heart)}. ${have(BUILD_COST.heart)}`);
    case 6:
      return n + (o.touch
        ? 'Lobo de práctica: ⚔ golpea. Toca Rodar para esquivar; mantenlo antes del mordisco para parar.'
        : 'Un lobo de práctica. E golpea, Q esquiva, Z justo antes del mordisco para.');
    case 7:
      return n + (o.touch
        ? 'Toca al lobo para fijarlo. Mantén Poder, elige 🏹 y dale con una flecha.'
        : 'X fija. R dispara. Dale con una flecha.');
    case 8:
      return n + '¿Ves un haz de luz? Es un santuario. Anda hacia él.';
    default:
      return '';
  }
}
