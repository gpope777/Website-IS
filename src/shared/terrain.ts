import { Noise2D } from './noise';

export const WORLD_SIZE = 480; // metres, square
export const HALF = WORLD_SIZE / 2;
export const WATER_LEVEL = -3.2;

export interface Terrain {
  heightAt(x: number, z: number): number;
  /** Vegetation density 0..1: clearings vs dense groves. */
  density(x: number, z: number): number;
}

// ponytail: no height cache. The old per-cell cache returned whichever exact point was queried first,
// so client and server could disagree. Recompute is cheap; add a cache keyed on exact coords if profiling says so.
export function createTerrain(seed: number): Terrain {
  const noise = new Noise2D(seed);
  return {
    heightAt(x, z) {
      const n = noise.fbm(x * 0.012 + 100, z * 0.012 + 100, 5);
      const ridge = noise.fbm(x * 0.004, z * 0.004, 3);
      const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
      const rim = edge > 0.85 ? (edge - 0.85) * 60 : 0; // hills at the border keep players in
      let h = (n - 0.5) * 14 + (ridge - 0.5) * 18 + rim;
      const dSpawn = Math.hypot(x, z);
      if (dSpawn < 24) {
        const t = dSpawn / 24;
        h = Math.max(h, 0.8) * (1 - t) + h * t; // dry, gentle spawn for every seed
      }
      return h;
    },
    density(x, z) {
      return noise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    },
  };
}
