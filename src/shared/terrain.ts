import { Noise2D } from './noise';
import { createRng } from './rng';

export const WORLD_SIZE = 480; // metres, square (the forest)
export const HALF = WORLD_SIZE / 2;
export const WATER_LEVEL = -3.2;
/** The forest's own heightmap ends here; the next 20 m blend into the coast. */
export const COAST_Z0 = HALF - 40;
/** The coast's far edge (south rim). The map is |x| < HALF, -HALF < z < SOUTH. */
export const SOUTH = HALF + 220;
/** Coast bands, as metres south of HALF (spec §3.1). */
export const COAST = { blend: 20, mudTo: 20, beachTo: 50, shallowsTo: 90, deepFrom: 110, rimFrom: 200, mud: WATER_LEVEL + 0.3, beachTop: WATER_LEVEL + 2, shallowsBed: WATER_LEVEL - 4, seabed: WATER_LEVEL - 15, rimTop: WATER_LEVEL + 8 } as const;

export interface Terrain {
  heightAt(x: number, z: number): number;
  /** Vegetation density 0..1: clearings vs dense groves. */
  density(x: number, z: number): number;
}

export interface Islet {
  x: number;
  z: number;
  r: number;
  top: number;
}

/** Inside the playable map, `pad` metres from its edge. */
export function inMap(x: number, z: number, pad: number): boolean {
  return Math.abs(x) < HALF - pad && z > -HALF + pad && z < SOUTH - pad;
}

export function clampMap(x: number, z: number, pad: number): { x: number; z: number } {
  return { x: Math.max(-HALF + pad, Math.min(HALF - pad, x)), z: Math.max(-HALF + pad, Math.min(SOUTH - pad, z)) };
}

/** Forest ground (north of the coast blend), `pad` metres from its edges. Seeded forest things spawn here. */
export function inForest(x: number, z: number, pad: number): boolean {
  return Math.abs(x) < HALF - pad && z > -HALF + pad && z < COAST_Z0 - pad;
}

/** Seeded islets (3) and the dungeon island, in the deep sea. Pure seed: client and server agree. */
export function coastFeatures(seed: number): { islets: Islet[]; island: Islet } {
  const rng = createRng(seed ^ 0xc0a57);
  const island: Islet = { x: (rng() - 0.5) * 240, z: HALF + 170, r: 15, top: WATER_LEVEL + 5 };
  const islets: Islet[] = [];
  for (let tries = 0; islets.length < 3 && tries < 500; tries++) {
    const r = 9 + rng() * 3.5;
    const c: Islet = { x: (rng() - 0.5) * (WORLD_SIZE - 100), z: HALF + 110 + rng() * 75, r, top: WATER_LEVEL + 4 + rng() * 4 };
    if (Math.hypot(c.x - island.x, c.z - island.z) <= c.r + island.r + 20) continue;
    if (islets.some((o) => Math.hypot(o.x - c.x, o.z - c.z) <= o.r + c.r + 20)) continue;
    islets.push(c);
  }
  // ponytail: 500 tries always fit 3 islets in a 380 × 75 m strip; no fallback.
  return { islets, island };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// ponytail: no height cache. The old per-cell cache returned whichever exact point was queried first,
// so client and server could disagree. Recompute is cheap; add a cache keyed on exact coords if profiling says so.
export function createTerrain(seed: number): Terrain {
  const noise = new Noise2D(seed);
  const { islets, island } = coastFeatures(seed);
  const bumps = [...islets, island];
  const xRim = (x: number) => {
    const e = Math.abs(x) / HALF;
    return e > 0.85 ? (e - 0.85) * 60 : 0; // hills at the border keep players in
  };
  const forest = (x: number, z: number) => {
    const n = noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
    const ridge = noise.fbm(x * 0.004, z * 0.004, 3);
    const edge = Math.max(Math.abs(x), z < 0 ? -z : 0) / HALF;
    const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0;
    let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
    const dSpawn = Math.hypot(x, z);
    if (dSpawn < 24) {
      const t = dSpawn / 24;
      h = Math.max(h, 0.8) * (1 - t) + h * t; // dry, gentle spawn for every seed
    }
    return h;
  };
  const coast = (x: number, z: number) => {
    const d = z - HALF;
    let h: number;
    if (d < COAST.mudTo) h = COAST.mud;
    else if (d < COAST.mudTo + 6) h = lerp(COAST.mud, COAST.beachTop, smooth((d - COAST.mudTo) / 6));
    else if (d < COAST.beachTo) h = lerp(COAST.beachTop, WATER_LEVEL + 0.05, (d - COAST.mudTo - 6) / (COAST.beachTo - COAST.mudTo - 6));
    else if (d < COAST.shallowsTo) h = lerp(WATER_LEVEL - 0.05, COAST.shallowsBed, (d - COAST.beachTo) / (COAST.shallowsTo - COAST.beachTo));
    else {
      const bed = COAST.seabed + (noise.fbm(x * 0.03 + 300, z * 0.03 + 300, 3) - 0.5) * 4;
      h = d < COAST.deepFrom ? lerp(COAST.shallowsBed, bed, smooth((d - COAST.shallowsTo) / (COAST.deepFrom - COAST.shallowsTo))) : bed;
      for (const b of bumps) {
        const k = Math.hypot(x - b.x, z - b.z) / b.r;
        if (k < 1) h = Math.max(h, b.top - (b.top - h) * k * k);
      }
      if (d > COAST.rimFrom) h = lerp(h, COAST.rimTop, smooth(Math.min(1, (d - COAST.rimFrom) / (SOUTH - HALF - COAST.rimFrom))));
    }
    return h + xRim(x);
  };
  return {
    heightAt(x, z) {
      if (z < COAST_Z0) return forest(x, z);
      if (z < COAST_Z0 + COAST.blend) return lerp(forest(x, z), coast(x, z), smooth((z - COAST_Z0) / COAST.blend));
      return coast(x, z);
    },
    density(x, z) {
      return noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    },
  };
}
