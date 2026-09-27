import { createRng } from './rng';
import { inBog } from './swamp';
import { generateSwampShrines } from './swamp-shrines';
import { slopeAt } from './mountains';
import { coastFeatures, HALF, inForest, inSwamp, LAGUNA, MOUNTAINS, mountainFeatures, SWAMP, swampFeatures, WATER_LEVEL, type Terrain } from './terrain';

/**
 * Corruption by zones (spec §3): purple patches of the forest, seeded like everything else.
 * Zone 0 sits on the Raíz-madre (the source); the others lean toward it. The sim keeps which
 * are cleansed; client and server compute the same zones from the seed.
 */
export interface Zone {
  id: number;
  x: number;
  z: number;
  r: number;
}

export const CORRUPTION = {
  count: 6,
  rootR: 30,
  rMin: 22,
  rMax: 32,
  minDist: 60,
  maxDist: 190,
  /** Angle spread around the Raíz-madre's direction for the other zones (radians, total). */
  spread: 2.6,
  /** Enredadera within this of a zone's centre (its withered root) cleanses it. */
  cleanseReach: 5,
  /** Extra night wolves around each player standing in a corrupt zone (one of them a brute). */
  extraWolves: 2,
} as const;

export function generateZones(terrain: Terrain, seed: number, entrance: { x: number; z: number }): Zone[] {
  const rng = createRng(seed ^ 0x0c0220e9);
  const zones: Zone[] = [{ id: 0, x: entrance.x, z: entrance.z, r: CORRUPTION.rootR }];
  const base = Math.atan2(entrance.x, entrance.z);
  for (let tries = 0; zones.length < CORRUPTION.count && tries < 400; tries++) {
    const ang = base + (rng() - 0.5) * CORRUPTION.spread;
    const d = CORRUPTION.minDist + rng() * (CORRUPTION.maxDist - CORRUPTION.minDist);
    const r = CORRUPTION.rMin + rng() * (CORRUPTION.rMax - CORRUPTION.rMin);
    const x = Math.sin(ang) * d;
    const z = Math.cos(ang) * d;
    if (!inForest(x, z, 15)) continue;
    if (terrain.heightAt(x, z) < WATER_LEVEL + 0.5) continue;
    if (zones.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.9)) continue;
    zones.push({ id: zones.length, x, z, r });
  }
  return zones;
}

/**
 * Coast zones (Slice 2 §6.4): fixed ids 6–9 so saved `cleansed` ids never shift. Zone 6 is the coast
 * Raíz-madre on the dungeon island; 7 on the beach, 8 in the shallows, 9 on an islet.
 */
export const COAST_ZONES = { firstId: 6, root: 6, r: 16, rootR: 18 } as const;

export function isCoastZone(id: number): boolean {
  return id >= COAST_ZONES.firstId && id < SWAMP_ZONES.firstId;
}

/**
 * Swamp zones (Slice 3 §7): fixed ids 10–13. Zone 10 is the Raíz-madre del Pantano in the Laguna Negra;
 * 11 on a montículo, 12 in open bog, 13 on the Nenúfares shore.
 */
export const SWAMP_ZONES = { firstId: 10, root: 10, r: 16, rootR: 18 } as const;

export function isSwampZone(id: number): boolean {
  return id >= SWAMP_ZONES.firstId && id < MOUNTAIN_ZONES.firstId;
}

/**
 * Mountain zones (Slice 4 §6): fixed ids 14–17. Zone 14 is the Raíz-madre de la Montaña at a fixed
 * point (x −70, 140 m north of the rim) where S4-E opens the cave mouth; 15 on a gentle Faldas
 * meadow, 16 at the foot of pared 0 (forest side), 17 on the high snowfield.
 */
export const MOUNTAIN_ZONES = { firstId: 14, root: 14, r: 16, rootR: 18, rootX: -70, rootD: 140, gentle: 20 } as const;

export function isMountainZone(id: number): boolean {
  return id >= MOUNTAIN_ZONES.firstId;
}

export function generateMountainZones(terrain: Terrain, seed: number): Zone[] {
  const { r, rootR, rootX, rootD, gentle } = MOUNTAIN_ZONES;
  const root: Zone = { id: 14, x: rootX, z: -HALF - rootD, r: rootR };
  const p = mountainFeatures(seed).paredes[0]!;
  const foot = p.rt + p.w;
  // 16: pared 0's foot, the side facing the forest (+z).
  const z16: Zone = { id: 16, x: p.x, z: Math.min(p.z + foot, -HALF - r - 2), r };
  const clear = (x: number, z: number, others: Zone[]) => others.every((o) => Math.hypot(o.x - x, o.z - z) >= o.r + r);
  const rng = createRng(seed ^ 0x40e7a);
  const gentleSpot = (id: number, d0: number, d1: number, others: Zone[]): Zone => {
    for (let tries = 0; tries < 1500; tries++) {
      const x = MOUNTAINS.x0 + 30 + rng() * (MOUNTAINS.x1 - MOUNTAINS.x0 - 60);
      const z = -HALF - (d0 + rng() * (d1 - d0));
      if (slopeAt(terrain, x, z) < gentle && clear(x, z, others)) return { id, x, z, r };
    }
    return { id, x: -rootX, z: -HALF - (d0 + d1) / 2, r };
  };
  const z15 = gentleSpot(15, 45, 100, [root, z16]);
  const z17 = gentleSpot(17, 150, 195, [root, z15, z16]);
  return [root, z15, z16, z17];
}

export function generateSwampZones(terrain: Terrain, seed: number): Zone[] {
  const { r, rootR } = SWAMP_ZONES;
  const root: Zone = { id: 10, x: LAGUNA.x, z: LAGUNA.z, r: rootR };
  const shore = generateSwampShrines(terrain, seed)[1]!.parts[0]!;
  const z13: Zone = { id: 13, x: shore.x, z: shore.z, r };
  const clear = (x: number, z: number, others: Zone[]) => others.every((o) => Math.hypot(o.x - x, o.z - z) >= o.r + r);
  // 11: the dry montículo farthest from the Laguna that keeps clear of the others.
  let z11: Zone = { id: 11, x: SWAMP.x0 + 60, z: SWAMP.z0 + 40, r };
  let far = -1;
  for (const m of swampFeatures(seed).mounds) {
    const d = Math.hypot(m.x - LAGUNA.x, m.z - LAGUNA.z);
    if (d > far && terrain.heightAt(m.x, m.z) > WATER_LEVEL && clear(m.x, m.z, [root, z13])) [far, z11] = [d, { id: 11, x: m.x, z: m.z, r }];
  }
  // 12: a seeded point of open bog.
  const rng = createRng(seed ^ 0x5a2e0);
  let z12: Zone = { id: 12, x: (SWAMP.x0 + SWAMP.x1) / 2, z: (SWAMP.z0 + LAGUNA.z) / 2, r };
  for (let tries = 0; tries < 800; tries++) {
    const x = SWAMP.x0 + 25 + rng() * 110;
    const z = SWAMP.z0 + 25 + rng() * (SWAMP.z1 - SWAMP.z0 - 50);
    if (inSwamp(x, z) && inBog(terrain, x, z) && clear(x, z, [root, z11, z13])) {
      z12 = { id: 12, x, z, r };
      break;
    }
  }
  return [root, z11, z12, z13];
}

export function generateCoastZones(terrain: Terrain, seed: number): Zone[] {
  const rng = createRng(seed ^ 0xc0a2e);
  const { island, islets } = coastFeatures(seed);
  const pick = (z: number, ok: (h: number) => boolean): number => {
    for (let tries = 0; tries < 60; tries++) {
      const x = (rng() - 0.5) * (HALF * 1.6);
      if (ok(terrain.heightAt(x, z))) return x;
    }
    return 0;
  };
  const bz = HALF + 35;
  const sz = HALF + 70;
  const islet = islets[islets.length - 1] ?? island;
  return [
    { id: 6, x: island.x, z: island.z, r: COAST_ZONES.rootR },
    { id: 7, x: pick(bz, (h) => h > WATER_LEVEL + 0.2), z: bz, r: COAST_ZONES.r },
    { id: 8, x: pick(sz, (h) => WATER_LEVEL - h >= 0.5 && WATER_LEVEL - h <= 4), z: sz, r: COAST_ZONES.r },
    { id: 9, x: islet.x, z: islet.z, r: COAST_ZONES.r },
  ];
}

/** Forest, coast, swamp and mountain zones: the one list client and server share. */
export function allZones(terrain: Terrain, seed: number, entrance: { x: number; z: number }): Zone[] {
  return [...generateZones(terrain, seed, entrance), ...generateCoastZones(terrain, seed), ...generateSwampZones(terrain, seed), ...generateMountainZones(terrain, seed)];
}

/** Extra raid brutes: +1 per 2 corrupt coast zones while the coast Raíz-madre (zone 6) is corrupt. */
export function coastRaidBrutes(corrupt: readonly number[]): number {
  if (!corrupt.includes(COAST_ZONES.root)) return 0;
  return Math.floor(corrupt.filter(isCoastZone).length / 2);
}

/** The zone (corrupt or not) this point is in, if any. */
export function zoneAt(zones: readonly Zone[], x: number, z: number): Zone | undefined {
  return zones.find((zn) => Math.hypot(zn.x - x, zn.z - z) <= zn.r);
}

/** 0..1 corruption at a point: 1 in the middle of a corrupt zone, fading to 0 at its edge. */
export function taintAt(zones: readonly Zone[], corrupt: readonly number[], x: number, z: number): number {
  let t = 0;
  for (const zn of zones) {
    if (!corrupt.includes(zn.id)) continue;
    const k = 1 - Math.hypot(zn.x - x, zn.z - z) / zn.r;
    if (k > t) t = Math.min(1, k * 2.2);
  }
  return t;
}

/** Raids come from the nearest still-corrupt zone; with none left, from `fallback` (the Raíz-madre). */
export function raidDirFrom(heart: { x: number; z: number }, zones: readonly Zone[], corrupt: readonly number[], fallback: number): number {
  let best: Zone | undefined;
  let bestD = Infinity;
  for (const zn of zones) {
    if (!corrupt.includes(zn.id)) continue;
    const d = Math.hypot(zn.x - heart.x, zn.z - heart.z);
    if (d < bestD) {
      bestD = d;
      best = zn;
    }
  }
  return best ? Math.atan2(best.x - heart.x, best.z - heart.z) : fallback;
}

/** The zone nearest a point (for "this shrine cleanses the zone closest to it"). */
export function nearestZone(zones: readonly Zone[], x: number, z: number, ids?: readonly number[]): Zone | undefined {
  let best: Zone | undefined;
  let bestD = Infinity;
  for (const zn of zones) {
    if (ids && !ids.includes(zn.id)) continue;
    const d = Math.hypot(zn.x - x, zn.z - z);
    if (d < bestD) {
      bestD = d;
      best = zn;
    }
  }
  return best;
}
