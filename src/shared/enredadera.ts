import { WATER_LEVEL, type Terrain } from './terrain';
import type { Crag } from './crags';

/** Enredadera, the first active power (spec §5–6). */
export const ENREDADERA = { reach: 6, cooldown: 12, life: 90, r: 1.2, height: 8, wrapPad: 2, regenRadius: 6, regen: 5, idBase: 2000 } as const;

/**
 * Where a cast lands: it wraps a bare pillar whose side is within `wrapPad` of the target,
 * else grows a new pillar on dry, free ground. Null when there is no room.
 */
export function planVine(terrain: Terrain, blockers: readonly Crag[], bare: readonly Crag[], x: number, z: number, id: number): Crag | null {
  const wrap = bare.find((c) => Math.hypot(x - c.x, z - c.z) < c.r + ENREDADERA.wrapPad);
  if (wrap) {
    const { bare: _bare, ...c } = wrap;
    return c;
  }
  const g = terrain.heightAt(x, z);
  if (g < WATER_LEVEL + 0.2) return null;
  if ([...blockers, ...bare].some((c) => Math.hypot(x - c.x, z - c.z) < c.r + ENREDADERA.r + 0.5)) return null;
  return { id, x, z, r: ENREDADERA.r, base: g - 0.5, top: g + ENREDADERA.height };
}
