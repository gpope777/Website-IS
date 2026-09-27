import { HALF } from './terrain';
import { TOWER } from './corrupt-lands';
import type { Crag } from './crags';

/**
 * La Torre (spec S5 §11): the fifth interior off the map, along +z, violet light. Four floors, one
 * power and one white ally each: the thorn pit (Enredadera bridges, gate 0) → three miasma vents
 * (Viento, gate 1) → the dark room's four braziers (Fuego, gate 2) → the rockfall and the shelf's plate
 * (Piedra, gate 3) → La Flecha's arena (gate 4) → the stair (the checkpoint) → la Copa (S5-F).
 */
export const TOWER_DUNGEON = {
  x: HALF + 750,
  z0: 0,
  z1: 244,
  halfW: 12,
  floor: 30,
  pad: 10,
  entryZ: 5,
  exitReach: 2.5,
  doorReach: 5,
  gatesZ: [18, 84, 124, 164, 198],
  /** Floor 1: the thorn pit's z span (gate 0 at its near edge) and the two bare roots on the near side. */
  pit: [18, 28],
  roots: [
    { x: -6, z: 15 },
    { x: 6, z: 15 },
  ],
  rootReach: 4,
  /** Floor 2: a gust clears a vent for `ventClear` s; all three clear at once = gate 1. */
  vents: [
    { x: -8, z: 70 },
    { x: 0, z: 74 },
    { x: 8, z: 70 },
  ],
  ventClear: 15,
  /** Floor 3: four braziers, lit for good by a Llamarada. */
  braziers: [
    { x: -9, z: 96 },
    { x: 9, z: 96 },
    { x: -9, z: 114 },
    { x: 9, z: 114 },
  ],
  /** Floor 4: the plate on a climbable 3 m shelf (gate 3 open while weighted; jams once someone is through). */
  shelf: { x: 8, z: 156, r: 2.5, h: 3 },
  plateR: 1.5,
  arena: { z: 181, half: 12 },
  columns: [
    { x: -6, z: 175 },
    { x: 6, z: 175 },
    { x: -6, z: 187 },
    { x: 6, z: 187 },
  ],
  columnR: 1.2,
  stairZ: 198,
  stair: { x: 0, z: 201 },
  copa: { z: 222, r: 22 },
  copaZ: 204,
  floors: [
    [8, 44],
    [48, 84],
    [86, 124],
    [126, 164],
  ],
  /** Where each floor's beasts wake (interior-relative). */
  beastsAt: [
    { x: 0, z: 38 },
    { x: 0, z: 60 },
    null,
    { x: 0, z: 158 },
  ],
  shelfId: 1500,
  columnId: 1510,
  flechaHp: 470,
  flechaId: 900_008,
} as const;

/** The tower's rockfall corridor (floor 4), for `boulders` / `rockfallLane`. */
export const TOWER_ROCKFALL = { x: TOWER_DUNGEON.x, span: [128, 148] } as const;

const T = TOWER_DUNGEON;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The corridor up to the Copa, or the Copa's disc. */
export function inTowerDungeon(x: number, z: number, pad = 0): boolean {
  if (Math.abs(x - T.x) <= T.halfW + pad && z >= T.z0 - pad && z <= T.copaZ) return true;
  return Math.hypot(x - T.x, z - T.copa.z) <= T.copa.r + pad;
}

export function insideTower(p: { x: number; z: number }): { x: number; z: number } {
  return { x: T.x + p.x, z: p.z };
}

export function inArena(x: number, z: number): boolean {
  return inTowerDungeon(x, z) && Math.abs(z - T.arena.z) <= T.arena.half;
}

export function inCopa(x: number, z: number): boolean {
  return inTowerDungeon(x, z) && z > T.copaZ;
}

/** 0–3 the four floors, 4 the arena, 5 the stair and the Copa, −1 elsewhere (entry, steps between floors, outside). */
export function towerFloor(x: number, z: number): number {
  if (!inTowerDungeon(x, z)) return -1;
  if (z >= T.stairZ) return 5;
  if (inArena(x, z)) return 4;
  return T.floors.findIndex(([a, b]) => z >= a && z <= b);
}

/** Walls, shut gates (either way) and the Copa's round wall. `gates[i]` = gate i open. */
export function clampTowerDungeon(px: number, pz: number, nx: number, nz: number, gates: readonly boolean[]): { x: number; z: number } {
  if (nz > T.copaZ) {
    const dx = nx - T.x;
    const dz = nz - T.copa.z;
    const d = Math.hypot(dx, dz);
    const r = T.copa.r - 0.5;
    const out = d > r ? { x: T.x + (dx / d) * r, z: T.copa.z + (dz / d) * r } : { x: nx, z: nz };
    if (out.z > T.copaZ) return out;
    nx = out.x;
    nz = out.z;
  }
  const x = clamp(nx, T.x - T.halfW + 0.5, T.x + T.halfW - 0.5);
  let z = Math.max(nz, T.z0 + 0.5);
  T.gatesZ.forEach((g, i) => {
    if (gates[i]) return;
    if (pz < g && z > g - 0.5) z = g - 0.5;
    else if (pz > g && z < g + 0.5) z = g + 0.5;
  });
  return { x, z };
}

/** The door: the tower's south face, toward the world. */
export function towerEntrance(): { x: number; z: number } {
  return { x: TOWER.x, z: TOWER.z + TOWER.r };
}

/** Floor 4's shelf: a climbable rock, 3 m over the floor. */
export function towerShelfCrag(): Crag {
  return { id: T.shelfId, ...insideTower(T.shelf), r: T.shelf.r, base: T.floor - 1, top: T.floor + T.shelf.h };
}

/** The arena's four stone columns (climbable; La Flecha sticks in them). */
export function columnCrags(): Crag[] {
  return T.columns.map((c, i) => ({ id: T.columnId + i, ...insideTower(c), r: T.columnR, base: T.floor - 1, top: T.floor + 5 }));
}
