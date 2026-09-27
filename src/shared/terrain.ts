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

/** El Pantano (Slice 3): a rectangle west of the forest and the coast (spec S3 §3.1). */
export const SWAMP = { x0: -HALF - 180, x1: -HALF, z0: 40, z1: HALF + 150, seam: 12, rim: 15, rimTop: WATER_LEVEL + 7 } as const;
/** La Boca del Río: a 16 m wide, 5 m deep channel from the coast's deep sea west into the Laguna Negra. */
export const RIVER = { z: HALF + 103, half: 8, bank: 2, x0: -HALF - 80, x1: -HALF + 30, bed: WATER_LEVEL - 5 } as const;
/** La Laguna Negra: an elliptic bowl 5–8 m deep at the swamp's south end. */
export const LAGUNA = { x: -HALF - 115, z: HALF + 100, rx: 50, rz: 35, bed: WATER_LEVEL - 5, deep: WATER_LEVEL - 8 } as const;

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

export interface Mound {
  x: number;
  z: number;
  r: number;
  top: number;
}

/** Inside the swamp rectangle (west of the forest's edge). */
export function inSwamp(x: number, z: number): boolean {
  return x < SWAMP.x1 && x > SWAMP.x0 && z > SWAMP.z0 && z < SWAMP.z1;
}

/** Inside the river channel (its 16 m wide deep bed). */
export function inRiver(x: number, z: number): boolean {
  return x > RIVER.x0 && x < RIVER.x1 && Math.abs(z - RIVER.z) < RIVER.half;
}

// The swamp rectangle has no pad on its east side: it overlaps the main one by 1 m so the seam is walkable.
const swampRect = (pad: number) => ({ x0: SWAMP.x0 + pad, x1: -HALF + pad + 1, z0: SWAMP.z0 + pad, z1: SWAMP.z1 - pad });
const mainRect = (pad: number) => ({ x0: -HALF + pad, x1: HALF - pad, z0: -HALF + pad, z1: SOUTH - pad });

/** Inside the playable map (forest ∪ coast ∪ swamp), `pad` metres from its edge. */
export function inMap(x: number, z: number, pad: number): boolean {
  if (Math.abs(x) < HALF - pad && z > -HALF + pad && z < SOUTH - pad) return true;
  const s = swampRect(pad);
  return x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1;
}

/** The nearest point of the map (union of the two rectangles). */
export function clampMap(x: number, z: number, pad: number): { x: number; z: number } {
  const clampTo = (r: ReturnType<typeof mainRect>) => ({ x: Math.max(r.x0, Math.min(r.x1, x)), z: Math.max(r.z0, Math.min(r.z1, z)) });
  const a = clampTo(mainRect(pad));
  if (x >= -HALF) return a;
  const b = clampTo(swampRect(pad));
  return Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b;
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

/** 12 seeded montículos (dry mounds) in the swamp's interior, away from the Laguna and the river. */
export function swampFeatures(seed: number): { mounds: Mound[] } {
  const rng = createRng(seed ^ 0x5a3b9);
  const mounds: Mound[] = [];
  for (let tries = 0; mounds.length < 12 && tries < 2000; tries++) {
    const r = 6 + rng() * 9;
    const m: Mound = { x: -HALF - 160 + r + rng() * (90 - 2 * r), z: SWAMP.z0 + 25 + rng() * (SWAMP.z1 - SWAMP.z0 - 50), r, top: WATER_LEVEL + 1 + rng() * 3 };
    if (Math.hypot((m.x - LAGUNA.x) / (LAGUNA.rx + r + 4), (m.z - LAGUNA.z) / (LAGUNA.rz + r + 4)) < 1) continue;
    if (Math.abs(m.z - RIVER.z) < RIVER.half + RIVER.bank + r + 4) continue;
    if (mounds.some((o) => Math.hypot(o.x - m.x, o.z - m.z) <= o.r + m.r + 6)) continue;
    mounds.push(m);
  }
  // ponytail: 2000 tries always fit 12 mounds in 90 × 300 m minus the Laguna; no fallback.
  return { mounds };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

// ponytail: no height cache. The old per-cell cache returned whichever exact point was queried first,
// so client and server could disagree. Recompute is cheap; add a cache keyed on exact coords if profiling says so.
export function createTerrain(seed: number): Terrain {
  const noise = new Noise2D(seed);
  const { islets, island } = coastFeatures(seed);
  const bumps = [...islets, island];
  const { mounds } = swampFeatures(seed);
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
  const main = (x: number, z: number) => {
    if (z < COAST_Z0) return forest(x, z);
    if (z < COAST_Z0 + COAST.blend) return lerp(forest(x, z), coast(x, z), smooth((z - COAST_Z0) / COAST.blend));
    return coast(x, z);
  };
  const swamp = (x: number, z: number) => {
    const n = noise.fbm(x * 0.03 + 700, z * 0.03 + 700, 3);
    let h = WATER_LEVEL - 0.3 - 1.2 * smooth(Math.max(0, Math.min(1, (n - 0.68) / 0.14))); // mostly ankle-deep, a few pools
    const k = Math.hypot((x - LAGUNA.x) / LAGUNA.rx, (z - LAGUNA.z) / LAGUNA.rz);
    if (k < 1) {
      const bowl = k < 0.8 ? lerp(LAGUNA.deep, LAGUNA.bed, (k / 0.8) ** 2) : lerp(LAGUNA.bed, h, smooth((k - 0.8) / 0.2));
      h = Math.min(h, bowl);
    }
    for (const m of mounds) {
      const q = Math.hypot(x - m.x, z - m.z) / m.r;
      if (q < 1) h = Math.max(h, m.top - (m.top - h) * q * q);
    }
    const rim = Math.max(SWAMP.x0 + SWAMP.rim - x, SWAMP.z0 + SWAMP.rim - z, z - (SWAMP.z1 - SWAMP.rim));
    if (rim > 0) h = lerp(h, SWAMP.rimTop, smooth(Math.min(1, rim / SWAMP.rim)));
    return h;
  };
  const river = (x: number, z: number, h: number) => {
    if (x <= RIVER.x0 || x >= RIVER.x1) return h;
    const d = Math.abs(z - RIVER.z);
    if (d >= RIVER.half + RIVER.bank) return h;
    return Math.min(h, d < RIVER.half ? RIVER.bed : lerp(RIVER.bed, h, (d - RIVER.half) / RIVER.bank));
  };
  return {
    heightAt(x, z) {
      let h: number;
      if (x >= -HALF) h = main(x, z);
      else {
        const edge = main(-HALF, z);
        const t = (-HALF - x) / SWAMP.seam;
        h = t >= 1 ? swamp(x, z) : lerp(edge, swamp(x, z), smooth(t));
      }
      return river(x, z, h);
    },
    density(x, z) {
      return noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    },
  };
}
