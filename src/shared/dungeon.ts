import { createRng } from './rng';
import { clampMap, HALF, inForest, WATER_LEVEL, type Terrain } from './terrain';
import type { Crag } from './crags';
import type { Shrine } from './shrines';
import { clampCoast, coastFloor, COAST_DUNGEON, inCoastDungeon } from './coast-dungeon';
import { clampSwampDungeon, inSwampDungeon, SWAMP_DUNGEON, swampFloor } from './swamp-dungeon';
import { clampMountainDungeon, inMountainDungeon, MOUNTAIN_DUNGEON } from './mountain-dungeon';
import { clampTowerDungeon, inTowerDungeon, TOWER_DUNGEON } from './tower-dungeon';

/**
 * La Raíz-madre (spec §7): an entrance in the world and a handmade interior far outside
 * the map ("instanced" = its own space in the same sim). The interior runs along +z, five gates:
 * hall with two root levers → gate 0 → Enredadera altar → gate 1 (a knot: Enredadera opens it) →
 * plate room (a friend or the root block holds it) → gate 2 → dark room (carry the lantern to the
 * brazier) → gate 3 → mini-boss (bruto reforzado) → gate 4 → the Tragón's room.
 */
export const DUNGEON = {
  /** Interior centre line, 150 m past the map edge. */
  x: HALF + 150,
  z0: 0,
  z1: 170,
  halfW: 12,
  floor: 30,
  /** Metres around the interior that still read as its floor (the camera can swing out). */
  pad: 10,
  entryZ: 5,
  exitReach: 2.5,
  /** Gate 0 (the levers'); kept as its own name for the old code paths. */
  gateZ: 32,
  gatesZ: [32, 56, 84, 110, 138],
  /** Gate 1: a knot of roots; an Enredadera grown within `knotReach` of it opens it. */
  knot: { x: 0, z: 56 },
  knotReach: 4,
  /** Gate 2: open while the plate is pressed (a player or the block on it) and `plateHold` s after; it jams open once someone is through. */
  plate: { x: -7, z: 66 },
  plateRadius: 1.4,
  plateHold: 1.5,
  blockStart: { x: 7, z: 62 },
  carryReach: 2.5,
  /** Gate 3: carry the lantern to the brazier. */
  lantern: { x: 0, z: 90 },
  brazier: { x: -8, z: 106 },
  /** Gate 4: opens when the bruto reforzado falls. */
  eliteRoomZ: 110,
  eliteZ: 126,
  levers: [
    { x: -9, z: 22 },
    { x: 9, z: 22 },
  ],
  leverReach: 2.5,
  leverWindow: 6,
  altarZ: 46,
  altarReach: 2.5,
  bossRoomZ: 138,
  bossZ: 158,
  /** Entrance: reach from the trunk's side, distance from spawn, clearance from crags and shrines. */
  enterReach: 5,
  minDist: 90,
  maxDist: 150,
  clear: 16,
  trunkR: 4,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function inDungeon(x: number, z: number, pad = 0): boolean {
  return Math.abs(x - DUNGEON.x) <= DUNGEON.halfW + pad && z >= DUNGEON.z0 - pad && z <= DUNGEON.z1 + pad;
}

/** Inside any interior (the forest's, the coast's, the swamp's, the mountain's or the tower): warm, no mounts, walls instead of the map edge. */
export function inAnyDungeon(x: number, z: number, pad = 0): boolean {
  return inDungeon(x, z, pad) || inCoastDungeon(x, z, pad) || inSwampDungeon(x, z, pad) || inMountainDungeon(x, z, pad) || inTowerDungeon(x, z, pad);
}

export function inBossRoom(x: number, z: number): boolean {
  return inDungeon(x, z) && z >= DUNGEON.bossRoomZ;
}

export function inEliteRoom(x: number, z: number): boolean {
  return inDungeon(x, z) && z >= DUNGEON.eliteRoomZ && z < DUNGEON.bossRoomZ;
}

/** A point in interior-relative coordinates (x from the centre line) to world coordinates. */
export function inside(p: { x: number; z: number }): { x: number; z: number } {
  return { x: DUNGEON.x + p.x, z: p.z };
}

export function leverPos(i: number): { x: number; z: number } {
  const l = DUNGEON.levers[i]!;
  return { x: DUNGEON.x + l.x, z: l.z };
}

/** The world's terrain plus the interior's flat floor. Client and server both use it. */
export function withDungeon(base: Terrain): Terrain {
  return {
    heightAt: (x, z) => (inDungeon(x, z, DUNGEON.pad) ? DUNGEON.floor : inCoastDungeon(x, z, COAST_DUNGEON.pad) ? coastFloor(x, z) : inSwampDungeon(x, z, SWAMP_DUNGEON.pad) ? swampFloor(x, z) : inMountainDungeon(x, z, MOUNTAIN_DUNGEON.pad) ? MOUNTAIN_DUNGEON.floor : inTowerDungeon(x, z, TOWER_DUNGEON.pad) ? TOWER_DUNGEON.floor : base.heightAt(x, z)),
    density: (x, z) => base.density(x, z),
    ...(base.waterAt ? { waterAt: (x: number, z: number) => base.waterAt!(x, z) } : {}),
  };
}

/** Where a step from (px,pz) toward (nx,nz) ends: the interior walls and shut gates (either way) inside, the map edge outside. `gates[i]` = gate i open; `coastGates` / `swampGates` / `mountainGates` the same for the other interiors. */
export function clampStep(px: number, pz: number, nx: number, nz: number, gates: readonly boolean[], coastGates: readonly boolean[] = [], swampGates: readonly boolean[] = [], mountainGates: readonly boolean[] = [], towerGates: readonly boolean[] = []): { x: number; z: number } {
  if (inTowerDungeon(px, pz, 2)) return clampTowerDungeon(px, pz, nx, nz, towerGates);
  if (inCoastDungeon(px, pz, 2)) return clampCoast(px, pz, nx, nz, coastGates);
  if (inSwampDungeon(px, pz, 2)) return clampSwampDungeon(px, pz, nx, nz, swampGates);
  if (inMountainDungeon(px, pz, 2)) return clampMountainDungeon(px, pz, nx, nz, mountainGates);
  if (!inDungeon(px, pz, 2)) return clampMap(nx, nz, 3);
  const x = clamp(nx, DUNGEON.x - DUNGEON.halfW + 0.5, DUNGEON.x + DUNGEON.halfW - 0.5);
  let z = clamp(nz, DUNGEON.z0 + 0.5, DUNGEON.z1 - 0.5);
  DUNGEON.gatesZ.forEach((g, i) => {
    if (gates[i]) return;
    if (pz < g && z > g - 0.5) z = g - 0.5;
    else if (pz > g && z < g + 0.5) z = g + 0.5;
  });
  return { x, z };
}

/** The Raíz-madre's trunk: seed-derived, dry, clear of crags and shrines. */
export function generateEntrance(terrain: Terrain, seed: number, crags: readonly Crag[], shrines: readonly Shrine[]): { x: number; y: number; z: number } {
  const rng = createRng(seed ^ 0x2007d00d);
  let x = 0;
  let z = DUNGEON.minDist;
  for (let tries = 0; tries < 120; tries++) {
    const ang = rng() * Math.PI * 2;
    const d = DUNGEON.minDist + rng() * (DUNGEON.maxDist - DUNGEON.minDist);
    x = Math.sin(ang) * d;
    z = Math.cos(ang) * d;
    if (fits(terrain, crags, shrines, x, z)) break;
  }
  // ponytail: if no try fits, the last candidate is used (never seen in tests).
  return { x, y: terrain.heightAt(x, z), z };
}

function fits(terrain: Terrain, crags: readonly Crag[], shrines: readonly Shrine[], x: number, z: number): boolean {
  if (!inForest(x, z, 25)) return false;
  const r = DUNGEON.trunkR;
  for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const) if (terrain.heightAt(x + ox, z + oz) < WATER_LEVEL + 0.5) return false;
  return ![...crags, ...shrines].some((c) => Math.hypot(c.x - x, c.z - z) <= DUNGEON.clear);
}
