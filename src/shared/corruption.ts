import { createRng } from './rng';
import { HALF, WATER_LEVEL, type Terrain } from './terrain';

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
    if (Math.abs(x) > HALF - 15 || Math.abs(z) > HALF - 15) continue;
    if (terrain.heightAt(x, z) < WATER_LEVEL + 0.5) continue;
    if (zones.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.9)) continue;
    zones.push({ id: zones.length, x, z, r });
  }
  return zones;
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
