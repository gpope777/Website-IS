import { createRng } from './rng';
import { depthAt, inCienaga } from './coast';
import { HALF, inMap, inSwamp, WATER_LEVEL, waterLevel, type Islet, type Terrain } from './terrain';

/** El Pez Grande: the sea mount. Tamed with a ring race and then the deer's timing ring (spec §5.1). */
export const FISH = {
  /** Metres from the fish to tame it or get on. */
  reach: 4,
  rings: 6,
  ringGap: [10, 14],
  /** A ring counts when you pass within this of its centre. */
  ringR: 2.2,
  /** Seconds to reach each ring after the previous one (P7-E: 7 → 8; the worst gap is ~5.4 s of plain swimming). */
  ringTime: 8,
  /** Seconds before you can race again after it gets away. */
  retry: 3,
  rounds: [
    { speed: 3.0, width: 1.1 },
    { speed: 4.2, width: 0.75 },
  ],
  walk: 9,
  run: 14,
  /** Server speed cap on the fish (and `grace` seconds after getting off). */
  maxSpeed: 15,
  grace: 2,
  /** Dive (B held) and float-up speeds, m/s. */
  sink: 3,
  rise: 4,
  /** You can get off where the water is shallower than this. */
  shore: 1,
  /** Rough water this far around the dungeon island: whale only. */
  bravas: 30,
  /** Rider seat above the fish. */
  height: 0.6,
} as const;

const TAU = Math.PI * 2;
const SWIMMABLE = [1, 3.5] as const;
const BAND = [HALF + 52, HALF + 88] as const;

function swimmable(t: Terrain, x: number, z: number, min: number): boolean {
  const d = depthAt(t, x, z);
  return z > BAND[0] && z < BAND[1] && Math.abs(x) < HALF - 20 && d >= min && d <= SWIMMABLE[1];
}

/** Where the wild fish waits: seeded, in the shallows, reachable swimming. */
export function wildFish(t: Terrain, seed: number): { x: number; z: number } {
  const rng = createRng(seed ^ 0xf154);
  let best = { x: 0, z: HALF + 70 };
  for (let tries = 0; tries < 400; tries++) {
    const c = { x: (rng() - 0.5) * (2 * HALF - 80), z: HALF + 60 + rng() * 20 };
    if (swimmable(t, c.x, c.z, 1.5)) return c;
    if (tries === 0) best = c;
  }
  // ponytail: the shallows band is 40 m deep across the whole map; 400 tries always found a spot in tests.
  return best;
}

/** The race: rings in order, each 10–14 m from the last, all swimmable. Same seed, same rings. */
export function fishRings(t: Terrain, seed: number, home: { x: number; z: number }): { x: number; z: number }[] {
  const rng = createRng(seed ^ 0x41a95);
  const out: { x: number; z: number }[] = [];
  let prev = home;
  let heading = rng() * TAU;
  while (out.length < FISH.rings) {
    let next: { x: number; z: number } | null = null;
    for (let tries = 0; tries < 60 && !next; tries++) {
      const a = heading + (rng() - 0.5) * (tries < 30 ? 1.6 : TAU);
      const d = FISH.ringGap[0] + rng() * (FISH.ringGap[1] - FISH.ringGap[0]);
      const c = { x: prev.x + Math.sin(a) * d, z: prev.z + Math.cos(a) * d };
      if (swimmable(t, c.x, c.z, SWIMMABLE[0])) {
        next = c;
        heading = a;
      }
    }
    // ponytail: never seen in tests; fall back to the fish's home so the race stays finishable.
    next ??= { ...home };
    out.push(next);
    prev = next;
  }
  return out;
}

export function inBravas(island: Islet, x: number, z: number): boolean {
  return Math.hypot(x - island.x, z - island.z) < island.r + FISH.bravas;
}

/** How deep a fish may dive here: half a metre above the seabed. */
export function fishFloor(t: Terrain, x: number, z: number): number {
  return t.heightAt(x, z) + 0.5;
}

/** Can the fish be here? Wet, in the map, not in the Ciénaga nor the aguas bravas. */
export function fishStepOk(t: Terrain, island: Islet, x: number, z: number): boolean {
  return inMap(x, z, 2) && t.heightAt(x, z) < (inSwamp(x, z) ? WATER_LEVEL - 1 : waterLevel(t, x, z) - 0.3) && !inCienaga(x, z) && !inBravas(island, x, z);
}
