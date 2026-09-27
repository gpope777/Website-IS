import { HALF, inSwamp, SWAMP, WATER_LEVEL, type Terrain } from './terrain';

/**
 * El Zarzal: withered thorns on the forest/coast west rim and the swamp's first 60 m (spec S3 §3.2).
 * They bite and slow walkers and deer riders alike; only water (≥ 1 m) is free of them.
 */
export const ZARZAL = { speed: 3, dps: 10, x0: -HALF - 60, x1: -HALF + 4, dry: 1 } as const;
/** Walkers wade through the swamp's bog at 60 % speed. */
export const BOG = { k: 0.6, deep: 0.6 } as const;
/** The swamp fog blends in over this many metres. */
export const FOG_BLEND = 20;

export function zarzalAt(t: Terrain, x: number, z: number): boolean {
  return x > ZARZAL.x0 && x < ZARZAL.x1 && z > SWAMP.z0 && z < SWAMP.z1 && WATER_LEVEL - t.heightAt(x, z) < ZARZAL.dry;
}

/** Ankle-deep swamp water outside the thorns. */
export function inBog(t: Terrain, x: number, z: number): boolean {
  if (!inSwamp(x, z) || zarzalAt(t, x, z)) return false;
  const d = WATER_LEVEL - t.heightAt(x, z);
  return d > 0 && d < BOG.deep;
}

/** How much swamp fog at (x, z): 0 outside, 1 once FOG_BLEND metres inside. */
export function swampFog(x: number, z: number): number {
  const k = (v: number) => Math.max(0, Math.min(1, v / FOG_BLEND));
  return k(-HALF - x) * k(z - SWAMP.z0 + FOG_BLEND / 2) * k(SWAMP.z1 - z + FOG_BLEND / 2);
}
