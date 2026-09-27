import { createRng } from '../../shared/rng';
import { slopeAt } from '../../shared/mountains';
import { inCienaga } from '../../shared/coast';
import { zarzalAt } from '../../shared/swamp';
import { CHUTE, CORRUPT_LANDS, corruptDepth, MOUNTAINS, mountainDepth, PELDANOS, TOWER_FOOT, WATER_LEVEL, type Terrain } from '../../shared/terrain';
import { biomeOf, type Biome } from './looks';

/**
 * V2-C (spec §5.3, §5.7): where grass grows and in which colour, how a 32 m grass chunk is seeded, and the
 * ground-colour rules (snow, wet sand, noise). Pure: the meshes are built in grass.ts / terrain-mesh.ts.
 */
export type GrassBiome = Biome;

export interface GrassLook {
  /** Colour at the root and at the tip (linear-ish hex, baked into vertex colours). */
  root: number;
  tip: number;
  /** Typical blade height (m). */
  height: number;
  /** Share of seeded blades that grow here (0..1). */
  density: number;
}

/** 'tierras' is the purified meadow: the Tierras only grow grass once El Marchito falls. */
export const GRASS: Record<GrassBiome, GrassLook> = {
  bosque: { root: 0x2f5a22, tip: 0x9cc04a, height: 0.55, density: 1 },
  costa: { root: 0x8a8a5a, tip: 0xd8d09a, height: 0.6, density: 0.4 },
  pantano: { root: 0x1f2e18, tip: 0x5a6a30, height: 0.95, density: 0.5 },
  montanas: { root: 0x3a5a36, tip: 0x88a868, height: 0.35, density: 0.7 },
  tierras: { root: 0x6a8a4a, tip: 0xe8ecc0, height: 0.5, density: 0.8 },
};

/** Share of purified-meadow blades with a white flower tip (spec §4: 8 %). */
export const PURE_FLOWERS = 0.08;

export function grassBiome(x: number, z: number): GrassBiome {
  return biomeOf(x, z);
}

/** Mountains grow grass up to this height above the water (spec: "desaparece sobre 50 m"). */
export const ALPINE_TOP = 50;

/** 0..1 grass density at a point (0 = none). `purified`: the Tierras bloom (V2-C Task 5). */
export function grassDensity(t: Terrain, x: number, z: number, purified = false): number {
  const b = biomeOf(x, z);
  const h = t.heightAt(x, z);
  if (b === 'pantano') {
    if (zarzalAt(t, x, z)) return 0;
    return h > WATER_LEVEL - 0.5 ? GRASS.pantano.density : 0; // reeds stand in the shallow bog
  }
  if (h < WATER_LEVEL + 0.2) return 0;
  if (b === 'tierras') {
    if (!purified) return 0;
    const d = corruptDepth(z);
    if (d < CORRUPT_LANDS.rim + 0.5 || slopeAt(t, x, z) > 35) return 0;
    if (d > TOWER_FOOT.d && Math.abs(x) < TOWER_FOOT.half) return 0; // la Torre's plateau stays stone
    return GRASS.tierras.density;
  }
  if (b === 'montanas') {
    const d = mountainDepth(z);
    if (h - WATER_LEVEL > ALPINE_TOP || snowAmount(h, 0) > 0) return 0;
    if (d < PELDANOS.first + PELDANOS.pitch * (PELDANOS.steps - 1) + PELDANOS.run + 0.5) return 0;
    if (d >= MOUNTAINS.faldas && Math.abs(x) < CHUTE.half + 1) return 0;
    if (slopeAt(t, x, z) > 35) return 0;
    return GRASS.montanas.density;
  }
  if (b === 'costa') {
    if (inCienaga(x, z) || wetSand(h) > 0) return 0;
    return GRASS.costa.density;
  }
  if (h > 14) return Math.max(0, 1 - (h - 14) / 10) * 0.5; // rocky tops
  return t.density(x, z) > 0.55 ? 0.35 : 1; // thinner under dense canopy
}

export const CHUNK = 32;

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** Chunk indices whose square touches the circle (x, z, radius). */
export function chunksNear(x: number, z: number, radius: number): { cx: number; cz: number }[] {
  const out: { cx: number; cz: number }[] = [];
  const c0 = Math.floor((x - radius) / CHUNK);
  const c1 = Math.floor((x + radius) / CHUNK);
  const r0 = Math.floor((z - radius) / CHUNK);
  const r1 = Math.floor((z + radius) / CHUNK);
  for (let cx = c0; cx <= c1; cx++)
    for (let cz = r0; cz <= r1; cz++) {
      const dx = Math.max(cx * CHUNK - x, 0, x - (cx + 1) * CHUNK);
      const dz = Math.max(cz * CHUNK - z, 0, z - (cz + 1) * CHUNK);
      if (dx * dx + dz * dz <= radius * radius) out.push({ cx, cz });
    }
  return out;
}

export interface Blade {
  x: number;
  y: number;
  z: number;
  /** Height (m). */
  h: number;
  yaw: number;
  biome: GrassBiome;
  /** 0..1, per-blade randomness (colour, phase, flower). */
  rnd: number;
}

function chunkSeed(seed: number, cx: number, cz: number): number {
  return (seed ^ 0x9a55 ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0;
}

/** Up to `n` blades in chunk (cx, cz), deterministic per seed. */
export function seedChunk(t: Terrain, cx: number, cz: number, n: number, seed: number, purified = false): Blade[] {
  const rng = createRng(chunkSeed(seed, cx, cz));
  const out: Blade[] = [];
  for (let i = 0; i < n; i++) {
    const x = (cx + rng()) * CHUNK;
    const z = (cz + rng()) * CHUNK;
    const keep = rng();
    const yaw = rng() * Math.PI;
    const rnd = rng();
    const d = grassDensity(t, x, z, purified);
    if (keep >= d) continue;
    const biome = grassBiome(x, z);
    out.push({ x, y: t.heightAt(x, z) - 0.03, z, h: GRASS[biome].height * (0.6 + 0.8 * rnd), yaw, biome, rnd });
  }
  return out;
}

const smooth = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Snow cover 0..1 by height above the water (m) and slope (deg): > 55 m and < 35° (spec §4). */
export function snowAmount(h: number, slopeDeg: number): number {
  return smooth(48, 62, h - WATER_LEVEL) * (1 - smooth(30, 40, slopeDeg));
}

/** Wet sand 0..1: from the waterline up to +0.4 m. */
export function wetSand(h: number): number {
  const a = h - WATER_LEVEL;
  return a < -0.5 ? 0 : 1 - smooth(0.1, 0.4, a);
}

/** Cheap value noise in −1..1 (vertex colour break-up; mud patches). */
export function vertexNoise(x: number, z: number): number {
  const s = Math.sin(x * 0.173 + z * 0.091) + Math.sin(x * 0.047 - z * 0.131) * 0.7 + Math.sin((x + z) * 0.41) * 0.3;
  return s / 2;
}
