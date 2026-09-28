import { HALF, LAGUNA } from './terrain';
import type { Crag } from './crags';

/**
 * La Raíz-madre del Pantano (spec S3 §10): a third interior off the map, along +z.
 * Hall with two levers → gate 0 → Fuego altar → gate 1 (thorns: burn them) → the dark gas hall
 * (light its 3 lamps within 10 s) → gate 2 → the sinking boardwalk over the mud (no gate: the mud is
 * the obstacle) → the bruto de turba (it regrows in its mud pools unless burning) → gate 3 → El Zancudo's room (4 gas vents).
 */
export const SWAMP_DUNGEON = {
  x: HALF + 450,
  z0: 0,
  z1: 180,
  halfW: 12,
  floor: 30,
  pad: 10,
  entryZ: 5,
  exitReach: 2.5,
  gatesZ: [32, 56, 86, 150],
  levers: [
    { x: -9, z: 22 },
    { x: 9, z: 22 },
  ],
  leverReach: 2.5,
  leverWindow: 6,
  altarZ: 44,
  altarReach: 2.5,
  /** Gate 1 is the thorn wall itself. */
  thorn: { x: 0, z: 56 },
  /** Gate 2: the gas hall's three lamps, all lit within `lampWindow` s (the first two share one Llamarada). Unlit, you see `darkSight` m. */
  lamps: [
    { x: -2, z: 67 },
    { x: 2, z: 67 },
    { x: -9, z: 80 },
  ],
  lampWindow: 10,
  darkSight: 6,
  /** The mud strip's z span and depth; planks along the centre line. */
  mud: [92, 122],
  mudDepth: 3,
  planks: 10,
  plankHalfW: 1.5,
  sinkAfter: 1.2,
  downFor: 4,
  /** Sinking 1 m under the floor in the mud puts you back here. */
  fallBack: 89,
  fallDamage: 10,
  eliteRoomZ: 126,
  eliteZ: 140,
  /** The bruto de turba regrows `regen` PV/s standing in one of these (unless burning). */
  pools: [
    { x: -6, z: 134 },
    { x: 6, z: 144 },
  ],
  poolR: 3,
  regen: 10,
  bossRoomZ: 150,
  /** El Zancudo's gas vents, in drift order (a Llamarada on the one under it drops it). */
  vents: [
    { x: -5, z: 158 },
    { x: 5, z: 158 },
    { x: 5, z: 172 },
    { x: -5, z: 172 },
  ],
  ventR: 1.2,
  trunkR: 4,
  enterReach: 5,
  plankId: 1300,
} as const;

const S = SWAMP_DUNGEON;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const plankLen = (S.mud[1] - S.mud[0]) / S.planks;

export function inSwampDungeon(x: number, z: number, pad = 0): boolean {
  return Math.abs(x - S.x) <= S.halfW + pad && z >= S.z0 - pad && z <= S.z1 + pad;
}

/** The boardwalk's mud strip. */
export function inMud(x: number, z: number): boolean {
  return inSwampDungeon(x, z) && z > S.mud[0] && z < S.mud[1];
}

export function inPeatRoom(x: number, z: number): boolean {
  return inSwampDungeon(x, z) && z >= S.eliteRoomZ && z < S.bossRoomZ;
}

export function inSwampBossRoom(x: number, z: number): boolean {
  return inSwampDungeon(x, z) && z >= S.bossRoomZ;
}

export function inMudPool(x: number, z: number): boolean {
  return S.pools.some((p) => Math.hypot(S.x + p.x - x, p.z - z) <= S.poolR);
}

/** Interior-relative point to world coordinates. */
export function insideSwamp(p: { x: number; z: number }): { x: number; z: number } {
  return { x: S.x + p.x, z: p.z };
}

/** The interior floor: flat, except the mud strip under the boardwalk. */
export function swampFloor(x: number, z: number): number {
  return inMud(x, z) ? S.floor - S.mudDepth : S.floor;
}

/** Centre of plank i. */
export function plankPos(i: number): { x: number; z: number } {
  return { x: S.x, z: S.mud[0] + plankLen * (i + 0.5) };
}

/** The plank under (x, z), or −1. */
export function plankAt(x: number, z: number): number {
  if (!inMud(x, z) || Math.abs(x - S.x) > S.plankHalfW) return -1;
  return clamp(Math.floor((z - S.mud[0]) / plankLen), 0, S.planks - 1);
}

/** Planks still up, as bare discs you can stand on (not climb). */
export function plankCrags(up: readonly boolean[]): Crag[] {
  return up.flatMap((u, i) => (u ? [{ id: S.plankId + i, ...plankPos(i), r: S.plankHalfW, base: S.floor - S.mudDepth - 1, top: S.floor, bare: true }] : []));
}

/** Walls and shut gates (either way). `gates[i]` = gate i open. */
export function clampSwampDungeon(px: number, pz: number, nx: number, nz: number, gates: readonly boolean[]): { x: number; z: number } {
  const x = clamp(nx, S.x - S.halfW + 0.5, S.x + S.halfW - 0.5);
  let z = clamp(nz, S.z0 + 0.5, S.z1 - 0.5);
  S.gatesZ.forEach((g, i) => {
    if (gates[i]) return;
    if (pz < g && z > g - 0.5) z = g - 0.5;
    else if (pz > g && z < g + 0.5) z = g + 0.5;
  });
  return { x, z };
}

/** The sunken trunk stands in the Laguna Negra, 5 m north of its centre (zone 10's root keeps the centre). */
export function swampEntrance(): { x: number; z: number } {
  return { x: LAGUNA.x, z: LAGUNA.z - 5 };
}
