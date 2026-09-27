import type { Crag } from './crags';
import type { Cell } from './mountain-shrines';

/**
 * Piedra, the fourth power (spec S4 §4): Alzar raises a stone pillar ahead of you, on a 2 m grid.
 * Pillars are steps (climbable), weights (plates), barricades (raiders hit them) and stop charges.
 * They live as structures of kind 'pillar' (never saved); up to 3 per player, 120 s each.
 */
export const PIEDRA = {
  ahead: 4,
  grid: 2,
  /** Half the pillar's side, and its height. */
  half: 1,
  height: 3,
  cooldown: 3,
  max: 3,
  life: 120,
  hp: 80,
  /** How far from you the aimed spot may be (anti-cheat slack over `ahead` + the grid snap). */
  reach: 6,
  /** A beast this close to a new pillar is thrown: stunned and scratched. */
  liftR: 1.5,
  liftStun: 1,
  liftDamage: 4,
  /** A charging elite this close to a pillar crashes into it. */
  chargeStun: 5,
  chargeR: 2,
  /** A pillar this close to a mountain root (15–17) crushes it; this close to a plate weighs it. */
  rootReach: 2,
  plateR: 2,
  /** Crag ids of pillars and towers: this + the structure id. */
  cragId: 920_000,
} as const;

/** La torre (spec S4 §4): a 4 m stone tower trap. From its top arrows fly further; raiders at its foot are shoved back. */
export const TOWER = { height: 4, r: 1.2, rangeMult: 1.5, knockR: 3, knock: 3, every: 4 } as const;

/** Where a pillar rises: `ahead` m from (px, pz) toward the aim point, snapped to the 2 m grid. */
export function pillarSpot(px: number, pz: number, ax: number, az: number): { x: number; z: number } {
  const dx = ax - px;
  const dz = az - pz;
  const d = Math.hypot(dx, dz);
  const ux = d > 1e-6 ? dx / d : 0;
  const uz = d > 1e-6 ? dz / d : 1;
  const snap = (v: number) => Math.round(v / PIEDRA.grid) * PIEDRA.grid;
  return { x: snap(px + ux * PIEDRA.ahead), z: snap(pz + uz * PIEDRA.ahead) };
}

/** Empujar: one grid cell away from you along the dominant axis ([+1, 0] = +x, [0, +1] = +z). */
export function pushDir(px: number, pz: number, bx: number, bz: number): Cell {
  const dx = bx - px;
  const dz = bz - pz;
  if (Math.abs(dx) >= Math.abs(dz)) return [dx >= 0 ? 1 : -1, 0];
  return [0, dz >= 0 ? 1 : -1];
}

/** Pillars and towers as climbable crags (client and server both use it). */
export function structureCrags(ss: readonly { id: number; kind: string; x: number; y: number; z: number }[]): Crag[] {
  const out: Crag[] = [];
  for (const s of ss) {
    if (s.kind === 'pillar') out.push({ id: PIEDRA.cragId + s.id, x: s.x, z: s.z, r: PIEDRA.half, base: s.y - 1, top: s.y + PIEDRA.height });
    else if (s.kind === 'tower') out.push({ id: PIEDRA.cragId + s.id, x: s.x, z: s.z, r: TOWER.r, base: s.y - 1, top: s.y + TOWER.height });
  }
  return out;
}
