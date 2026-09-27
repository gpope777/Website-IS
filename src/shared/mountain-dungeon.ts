import { HALF } from './terrain';
import { MOUNTAIN_ZONES } from './corruption';
import type { Crag } from './crags';
import type { Cell } from './mountain-shrines';

/**
 * La cueva de la Montaña (spec S4 §11): a fourth interior off the map, along +z, cold blue light.
 * Hall with two levers → gate 0 → Piedra altar → the high plate on a 3 m shelf (weighted = gate 1 open)
 * → the block room (2 blocks onto 2 slots, gate 2) → the rockfall corridor (no gate: pillars shield
 * you) → the bruto de roca (gate 3) → El Cucurucho's room (sim/cucurucho.ts).
 */
export const MOUNTAIN_DUNGEON = {
  x: HALF + 600,
  z0: 0,
  z1: 190,
  halfW: 12,
  floor: 30,
  pad: 10,
  entryZ: 5,
  exitReach: 2.5,
  gatesZ: [32, 60, 88, 160],
  levers: [
    { x: -9, z: 22 },
    { x: 9, z: 22 },
  ],
  leverReach: 2.5,
  leverWindow: 6,
  altarZ: 44,
  altarReach: 2.5,
  /** Gate 1: open while the plate on top of this 3 m climbable shelf is weighted (a player up there, or a pillar). */
  shelf: { x: 8, z: 54, r: 2.5, h: 3 },
  plateR: 1.5,
  /** Gate 2: a 5 × 5 grid of 2 m cells centred at z; 2 blocks onto 2 slots. Handmade; 5 pushes solve it. */
  blocks: { z: 74, n: 5, cell: 2, starts: [[1, 1], [3, 1]], slots: [[1, 3], [4, 3]] },
  resetLever: { x: -10, z: 66 },
  pushReach: 2.5,
  /** The rockfall corridor's z span: boulders roll from its far end toward the entrance, in 3 lanes. */
  rockfall: [90, 130],
  lanes: [-8, 0, 8],
  laneHalf: 4,
  every: 2,
  roll: 8,
  hitZ: 1.2,
  damage: 15,
  knock: 3,
  grace: 1,
  eliteRoomZ: 132,
  eliteZ: 146,
  bossRoomZ: 160,
  mouthR: 4,
  enterReach: 5,
  shelfId: 1400,
} as const;

/** One solution of the block room (block index, direction [+col = +x, +row = +z]). */
export const DBLOCKS_SOLUTION: readonly { i: number; dir: Cell }[] = [
  { i: 0, dir: [0, 1] },
  { i: 0, dir: [0, 1] },
  { i: 1, dir: [1, 0] },
  { i: 1, dir: [0, 1] },
  { i: 1, dir: [0, 1] },
];

const M = MOUNTAIN_DUNGEON;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function inMountainDungeon(x: number, z: number, pad = 0): boolean {
  return Math.abs(x - M.x) <= M.halfW + pad && z >= M.z0 - pad && z <= M.z1 + pad;
}

/** Interior-relative point to world coordinates. */
export function insideMountain(p: { x: number; z: number }): { x: number; z: number } {
  return { x: M.x + p.x, z: p.z };
}

/** The shelf the high plate sits on: a climbable rock, 3 m over the floor. */
export function shelfCrag(): Crag {
  return { id: M.shelfId, ...insideMountain(M.shelf), r: M.shelf.r, base: M.floor - 1, top: M.floor + M.shelf.h };
}

export function inRockfall(x: number, z: number): boolean {
  return inMountainDungeon(x, z) && z >= M.rockfall[0] && z <= M.rockfall[1];
}

/** The lane (0–2) at x, or −1. */
export function rockfallLane(x: number): number {
  return M.lanes.findIndex((l) => Math.abs(x - (M.x + l)) <= M.laneHalf);
}

/**
 * The z of each boulder rolling in `lane` at time t. A pillar (any point within the lane) stops every
 * boulder that would be past it (downstream = lower z).
 */
export function boulders(t: number, lane: number, blockers: readonly { x: number; z: number }[]): number[] {
  const lx = M.x + M.lanes[lane]!;
  const stop = blockers.filter((b) => Math.abs(b.x - lx) <= M.laneHalf && b.z >= M.rockfall[0] && b.z <= M.rockfall[1]).reduce((m, b) => Math.max(m, b.z), -Infinity);
  const off = (lane * M.every) / M.lanes.length;
  const travel = (M.rockfall[1] - M.rockfall[0]) / M.roll;
  const out: number[] = [];
  const last = Math.floor((t - off) / M.every);
  for (let k = last; k >= 0 && t - (k * M.every + off) <= travel; k--) {
    const z = M.rockfall[1] - M.roll * (t - (k * M.every + off));
    if (z >= stop) out.push(z);
  }
  return out;
}

export function inRockRoom(x: number, z: number): boolean {
  return inMountainDungeon(x, z) && z >= M.eliteRoomZ && z < M.bossRoomZ;
}

export function inMountainBossRoom(x: number, z: number): boolean {
  return inMountainDungeon(x, z) && z >= M.bossRoomZ;
}

/** World centre of a block-room cell. */
export function dungeonBlockCell(c: Cell): { x: number; z: number } {
  const o = ((M.blocks.n - 1) * M.blocks.cell) / 2;
  return { x: M.x - o + c[0] * M.blocks.cell, z: M.blocks.z - o + c[1] * M.blocks.cell };
}

/** Walls and shut gates (either way). `gates[i]` = gate i open. */
export function clampMountainDungeon(px: number, pz: number, nx: number, nz: number, gates: readonly boolean[]): { x: number; z: number } {
  const x = clamp(nx, M.x - M.halfW + 0.5, M.x + M.halfW - 0.5);
  let z = clamp(nz, M.z0 + 0.5, M.z1 - 0.5);
  M.gatesZ.forEach((g, i) => {
    if (gates[i]) return;
    if (pz < g && z > g - 0.5) z = g - 0.5;
    else if (pz > g && z < g + 0.5) z = g + 0.5;
  });
  return { x, z };
}

/** The cave mouth: 5 m north of the Raíz-madre de la Montaña (zone 14 keeps the root's centre). */
export function mountainEntrance(): { x: number; z: number } {
  return { x: MOUNTAIN_ZONES.rootX, z: -HALF - MOUNTAIN_ZONES.rootD - 5 };
}
