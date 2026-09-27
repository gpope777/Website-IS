import { coastFeatures, HALF } from './terrain';

/**
 * La Raíz-madre de la Costa (spec §7.2): a second instanced interior far off the map, along +z.
 * Hall with two levers → gate 0 → Viento altar → gate 1 (a fan: gust it) → the pumice block, a 10 m
 * channel (only a narrow bridge for feet; the block floats) and the plate → gate 2 → the updraft chasm
 * (glide + the gust's lift) → the bruto escudado → gate 3 → the boss room (S2-G).
 */
export const COAST_DUNGEON = {
  x: HALF + 300,
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
  /** Gate 1 is the fan itself. */
  fan: { x: 0, z: 56 },
  blockStart: { x: 4, z: 63 },
  /** The channel's z span; feet only over the bridge (x from the west wall to `bridgeX`). */
  channel: [66, 76],
  bridgeX: -9.5,
  plate: { x: 4, z: 81 },
  plateRadius: 1.6,
  /** The chasm's z span and depth; fall `fallBelow` under the lip and you are put back at `fallBack`. */
  pit: [96, 116],
  pitDepth: 20,
  fallBelow: 4,
  fallBack: 93,
  fallDamage: 10,
  eliteRoomZ: 120,
  eliteZ: 136,
  bossRoomZ: 150,
  trunkR: 4,
  enterReach: 5,
} as const;

const C = COAST_DUNGEON;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function inCoastDungeon(x: number, z: number, pad = 0): boolean {
  return Math.abs(x - C.x) <= C.halfW + pad && z >= C.z0 - pad && z <= C.z1 + pad;
}

export function inChasm(x: number, z: number): boolean {
  return inCoastDungeon(x, z) && z > C.pit[0] && z < C.pit[1];
}

export function inShieldRoom(x: number, z: number): boolean {
  return inCoastDungeon(x, z) && z >= C.eliteRoomZ && z < C.bossRoomZ;
}

export function inCoastBossRoom(x: number, z: number): boolean {
  return inCoastDungeon(x, z) && z >= C.bossRoomZ;
}

/** Interior-relative point to world coordinates. */
export function insideCoast(p: { x: number; z: number }): { x: number; z: number } {
  return { x: C.x + p.x, z: p.z };
}

/** The interior floor: flat, except the chasm. */
export function coastFloor(x: number, z: number): number {
  return inChasm(x, z) ? C.floor - C.pitDepth : C.floor;
}

/** Walls, shut gates (either way) and the channel (only the bridge carries feet). `gates[i]` = gate i open. */
export function clampCoast(px: number, pz: number, nx: number, nz: number, gates: readonly boolean[]): { x: number; z: number } {
  let x = clamp(nx, C.x - C.halfW + 0.5, C.x + C.halfW - 0.5);
  let z = clamp(nz, C.z0 + 0.5, C.z1 - 0.5);
  C.gatesZ.forEach((g, i) => {
    if (gates[i]) return;
    if (pz < g && z > g - 0.5) z = g - 0.5;
    else if (pz > g && z < g + 0.5) z = g + 0.5;
  });
  const [c0, c1] = C.channel;
  if (z > c0 && z < c1 && x > C.x + C.bridgeX) {
    if (pz <= c0) z = c0;
    else if (pz >= c1) z = c1;
    else x = C.x + C.bridgeX;
  }
  return { x, z };
}

/** The trunk stands on the dungeon island, 5 m north of its centre (the withered root keeps the centre). */
export function coastEntrance(seed: number): { x: number; z: number } {
  const { island } = coastFeatures(seed);
  return { x: island.x, z: island.z - 5 };
}
