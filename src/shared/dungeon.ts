import { createRng } from './rng';
import { HALF, WATER_LEVEL, type Terrain } from './terrain';
import type { Crag } from './crags';
import type { Shrine } from './shrines';

/**
 * La Raíz-madre (spec §7): an entrance in the world and a handmade interior far outside
 * the map ("instanced" = its own space in the same sim). The interior runs along +z:
 * hall with two root levers → root gate → Enredadera altar → boss room.
 */
export const DUNGEON = {
  /** Interior centre line, 150 m past the map edge. */
  x: HALF + 150,
  z0: 0,
  z1: 96,
  halfW: 12,
  floor: 30,
  /** Metres around the interior that still read as its floor (the camera can swing out). */
  pad: 10,
  entryZ: 5,
  exitReach: 2.5,
  gateZ: 32,
  levers: [
    { x: -9, z: 22 },
    { x: 9, z: 22 },
  ],
  leverReach: 2.5,
  leverWindow: 6,
  altarZ: 46,
  altarReach: 2.5,
  bossRoomZ: 60,
  bossZ: 80,
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

export function inBossRoom(x: number, z: number): boolean {
  return inDungeon(x, z) && z >= DUNGEON.bossRoomZ;
}

export function leverPos(i: number): { x: number; z: number } {
  const l = DUNGEON.levers[i]!;
  return { x: DUNGEON.x + l.x, z: l.z };
}

/** The world's terrain plus the interior's flat floor. Client and server both use it. */
export function withDungeon(base: Terrain): Terrain {
  return {
    heightAt: (x, z) => (inDungeon(x, z, DUNGEON.pad) ? DUNGEON.floor : base.heightAt(x, z)),
    density: (x, z) => base.density(x, z),
  };
}

/** Where a step from (px,pz) toward (nx,nz) ends: the interior walls and the shut gate inside, the map edge outside. */
export function clampStep(px: number, pz: number, nx: number, nz: number, gateOpen: boolean): { x: number; z: number } {
  if (!inDungeon(px, pz, 2)) return { x: clamp(nx, -HALF + 3, HALF - 3), z: clamp(nz, -HALF + 3, HALF - 3) };
  const x = clamp(nx, DUNGEON.x - DUNGEON.halfW + 0.5, DUNGEON.x + DUNGEON.halfW - 0.5);
  let z = clamp(nz, DUNGEON.z0 + 0.5, DUNGEON.z1 - 0.5);
  if (!gateOpen && pz < DUNGEON.gateZ && z > DUNGEON.gateZ - 0.5) z = DUNGEON.gateZ - 0.5;
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
  if (Math.abs(x) > HALF - 25 || Math.abs(z) > HALF - 25) return false;
  const r = DUNGEON.trunkR;
  for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const) if (terrain.heightAt(x + ox, z + oz) < WATER_LEVEL + 0.5) return false;
  return ![...crags, ...shrines].some((c) => Math.hypot(c.x - x, c.z - z) <= DUNGEON.clear);
}
