import { depthAt } from './coast';
import { FISH } from './fish';
import { coastFeatures, WATER_LEVEL, type Terrain } from './terrain';

/** Invasion 2's rescue (spec §8): a root cage on the seabed held by one anchor per islet. */
export const RESCUE = {
  anchorHp: 150,
  /** A Viento gust hurts an anchor this many times its normal scratch. */
  gustMult: 3,
  /** Guard wolves per islet, spawned the first time someone comes within `r + guardReach`. */
  guards: 2,
  guardReach: 12,
  /** A this close (horizontal) to the cage frees it once every anchor is broken. */
  freeReach: 5,
  anchorIdBase: 910_000,
} as const;

export interface RescueSite {
  cage: { x: number; z: number };
  anchors: { x: number; z: number }[];
}

/** The cage: on the seabed just outside the aguas bravas, starting north (toward the beach). Pure seed: client and server agree. */
export function rescueSite(t: Terrain, seed: number): RescueSite {
  const { islets, island } = coastFeatures(seed);
  const d = island.r + FISH.bravas + 6;
  let cage = { x: island.x, z: island.z - d };
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i * Math.PI * 2) / 12;
    const c = { x: island.x + Math.sin(a) * d, z: island.z + Math.cos(a) * d };
    if (depthAt(t, c.x, c.z) >= 2 && islets.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= o.r + 6)) {
      cage = c;
      break;
    }
  }
  // ponytail: if no angle fits, the cage stays due north (never seen in tests).
  return { cage, anchors: islets.map((o) => ({ x: o.x, z: o.z - o.r * 0.3 })) };
}

/** Where the cage floats: lower with every broken anchor (a readable progress bar). */
export function cageY(t: Terrain, cage: { x: number; z: number }, broken: number): number {
  const bed = t.heightAt(cage.x, cage.z);
  return Math.min(WATER_LEVEL - 1, bed + 1 + (3 - broken) * 1.5);
}
