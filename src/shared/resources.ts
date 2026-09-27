import { createRng } from './rng';
import { COAST_Z0, HALF, WATER_LEVEL, type Terrain } from './terrain';
import type { ItemId } from './items';

export type ResourceKind = 'tree' | 'rock' | 'bush';

export interface ResourceSpawn {
  id: number;
  kind: ResourceKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  radius: number;
}

export const HARVEST: Record<ResourceKind, { item: ItemId; amount: number; uses: number; regrow: number; label: string }> = {
  tree: { item: 'wood', amount: 1, uses: 3, regrow: 240, label: 'Talar árbol' },
  rock: { item: 'stone', amount: 1, uses: 2, regrow: 300, label: 'Picar piedra' },
  bush: { item: 'berries', amount: 2, uses: 2, regrow: 150, label: 'Recoger bayas' },
};

export const SPAWN_CLEAR = 9;
const STEP = 4.2;

/** Deterministic placement. Every cell consumes exactly 4 rng values so one rule change can't reshuffle the map. */
export function generateResources(terrain: Terrain, seed: number): ResourceSpawn[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const out: ResourceSpawn[] = [];
  for (let x = -HALF + 6; x < HALF - 6; x += STEP) {
    for (let z = -HALF + 6; z < HALF - 6; z += STEP) {
      const jx = x + (rng() - 0.5) * STEP;
      const jz = z + (rng() - 0.5) * STEP;
      const roll = rng();
      const extra = rng();
      if (Math.hypot(jx, jz) < SPAWN_CLEAR || jz >= COAST_Z0) continue; // forest only
      const h = terrain.heightAt(jx, jz);
      if (h < WATER_LEVEL) continue;
      const d = terrain.density(jx, jz);
      const rot = extra * Math.PI * 2;
      const push = (kind: ResourceKind, scale: number, radius: number) =>
        out.push({ id: out.length, kind, x: jx, y: h, z: jz, scale, rot, radius });
      if (roll < d * 0.95 && h < 16) {
        const s = 0.8 + extra * 0.7;
        push('tree', s, 0.5 * s);
      } else if (roll < d * 0.95 + 0.04 && h > -2) {
        const s = 0.5 + extra * 0.9;
        push('rock', s, s * 1.1);
      } else if (roll < d * 0.95 + 0.09 && d < 0.6) {
        const s = 0.7 + extra * 0.6;
        push('bush', s, s);
      }
    }
  }
  return out;
}
