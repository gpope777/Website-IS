import { createRng } from './rng';
import { COAST_Z0, HALF, inForest, WATER_LEVEL, type Terrain } from './terrain';

/**
 * A marked climbable rock pillar (peñasco con enredadera). Climbing only works on these:
 * the heightfield terrain has no walls (see plan D for the measurement), so "climbable"
 * is a list of objects both client and server derive from the seed.
 */
export interface Crag {
  id: number;
  x: number;
  z: number;
  r: number;
  /** Buried bottom of the pillar (a bit under the lowest ground around it). */
  base: number;
  /** Flat top you can stand on. */
  top: number;
  /** Shrine rock: you can stand on it but not grab it until Enredadera wraps it. */
  bare?: boolean;
}

export const CRAG = { cell: 60, chance: 0.7, minH: 7, maxH: 14, minR: 2.4, maxR: 3.8, spawnClear: 30, maxDensity: 0.55 } as const;

/** One cell every 60 m; every cell consumes exactly 4 rng values so one rule change can't reshuffle the map. */
export function generateCrags(terrain: Terrain, seed: number): Crag[] {
  const rng = createRng(seed ^ 0x5eedc2a6);
  const out: Crag[] = [];
  for (let cx = -HALF + CRAG.cell / 2; cx < HALF; cx += CRAG.cell) {
    for (let cz = -HALF + CRAG.cell / 2; cz < HALF; cz += CRAG.cell) {
      const a = rng();
      const b = rng();
      const c = rng();
      const d = rng();
      if (a > CRAG.chance) continue;
      const x = cx + (b - 0.5) * CRAG.cell * 0.6;
      const z = cz + (c - 0.5) * CRAG.cell * 0.6;
      // No crag within 60 m of the Ciénaga: a glide from one must not skip the mud.
      // Nor within 64 m of the west edge: el Zarzal starts 4 m inside it (S3).
      if (!inForest(x, z, 20) || z > COAST_Z0 - 60 || x < -HALF + 64 || Math.hypot(x, z) < CRAG.spawnClear) continue;
      if (terrain.density(x, z) > CRAG.maxDensity) continue; // clearings, so few trees poke through
      const r = CRAG.minR + d * (CRAG.maxR - CRAG.minR);
      let lo = Infinity;
      let hi = -Infinity;
      for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const) {
        const h = terrain.heightAt(x + ox, z + oz);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      if (lo < WATER_LEVEL + 0.5) continue;
      out.push({ id: out.length, x, z, r, base: lo - 0.5, top: hi + CRAG.minH + (a / CRAG.chance) * (CRAG.maxH - CRAG.minH) });
    }
  }
  return out;
}

/** Crags whose side is within `pad` metres of (x, z). */
export function cragsNear(crags: readonly Crag[], x: number, z: number, pad: number): Crag[] {
  return crags.filter((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);
}

/** The top of the crag under (x, z) when y is on (or just under) it; null otherwise. */
export function cragTopAt(crags: readonly Crag[], x: number, z: number, y: number): number | null {
  for (const c of crags) if (Math.hypot(x - c.x, z - c.z) < c.r && y >= c.top - 0.6) return c.top;
  return null;
}
