import { COAST, COAST_Z0, HALF, WATER_LEVEL, type Terrain } from './terrain';

/** La Ciénaga: withered mud across the whole map between the forest and the beach. Only the deer crosses it unhurt. */
export const CIENAGA = { speed: 3, dps: 8, z0: COAST_Z0, z1: HALF + COAST.mudTo } as const;
/** On foot you can swim where the sea is at most this deep (the current turns you back past it). */
export const SWIM_MAX_DEPTH = 4;

export function inCienaga(x: number, z: number): boolean {
  return z >= CIENAGA.z0 && z <= CIENAGA.z1 && Math.abs(x) < HALF;
}

export function depthAt(t: Terrain, x: number, z: number): number {
  return WATER_LEVEL - t.heightAt(x, z);
}

/**
 * A swimmer's step in the sea: fine while the water is at most SWIM_MAX_DEPTH deep, and past that only
 * if it gets shallower. Forest lakes are left alone (the rule is the sea's, spec §3.3).
 */
export function deepStepOk(t: Terrain, px: number, pz: number, nx: number, nz: number): boolean {
  if (nz < COAST_Z0) return true;
  const d = depthAt(t, nx, nz);
  return d <= SWIM_MAX_DEPTH || d < depthAt(t, px, pz);
}
