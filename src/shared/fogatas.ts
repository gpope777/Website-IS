import { claimedMounds } from './swamp-shrines';
import { WATER_LEVEL, type Terrain } from './terrain';

/**
 * Fogatas del Pantano (spec S3 §9, idea de Claude): stone rings on swamp montículos, dark until lit
 * (Llamarada within `light` m, or A with a torch). Lit ones are per world. A at a lit one (within `reach`)
 * channels `channel` s back to the Heart; the Heart's Menú channels to a lit one. Day only; damage,
 * drifting more than `drift` m, night, death or mounting cancel. You arrive `arrive` m east of the ring.
 */
export const FOGATA = { count: 4, light: 4, reach: 3, channel: 5, drift: 1.5, arrive: 2 } as const;

export interface Fogata {
  id: number;
  x: number;
  z: number;
  y: number;
}

/** 4 of the montículos no shrine or the frog uses, spread along z; each ring sits 60 % out toward the forest, turning until dry. */
export function generateFogatas(t: Terrain, seed: number): Fogata[] {
  const { frog, candles, peat, mounds } = claimedMounds(t, seed);
  const free = mounds.filter((_, i) => i !== frog && i !== candles && i !== peat).sort((a, b) => a.z - b.z);
  const picks = [0, 1, 2, 3].map((k) => free[Math.round((k * (free.length - 1)) / 3)]!);
  return picks.map((m, id) => {
    let spot = { x: m.x + m.r * 0.6, z: m.z };
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const s = { x: m.x + Math.cos(a) * m.r * 0.6, z: m.z + Math.sin(a) * m.r * 0.6 };
      if (t.heightAt(s.x, s.z) > WATER_LEVEL + 0.2) {
        spot = s;
        break;
      }
    }
    // ponytail: every montículo tops out ≥ 1 m above water, so 60 % of its radius is dry somewhere.
    return { id, x: spot.x, z: spot.z, y: t.heightAt(spot.x, spot.z) };
  });
}
