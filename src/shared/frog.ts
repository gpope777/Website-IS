import { createRng } from './rng';
import { inBog } from './swamp';
import { inMap, LAGUNA, swampFeatures, WATER_LEVEL, type Terrain } from './terrain';

/** La Rana: the swamp mount. Tamed with a lily-pad chase and then the timing ring (spec S3 §5). */
export const FROG = {
  /** Metres from the frog to tame it or get on. */
  reach: 4,
  pads: 3,
  padGap: [8, 12],
  /** A pad counts when you stand within this of its centre. */
  padR: 2.5,
  /** Seconds to reach each pad after the previous one. */
  padTime: 6,
  /** Seconds before it lets you chase it again. */
  retry: 3,
  rounds: [
    { speed: 3.0, width: 1.1 },
    { speed: 3.8, width: 0.9 },
    { speed: 4.6, width: 0.7 },
  ],
  walk: 8,
  run: 11,
  /** Server speed cap on the frog (and `grace` seconds after getting off). */
  maxSpeed: 12,
  grace: 2,
  /** Deepest water the frog goes into, metres. */
  deep: 2,
  /** Rider seat above the frog. */
  height: 0.7,
  /** B: the high jump (metres up, metres forward, cooldown s). */
  hop: { up: 7, fwd: 9, cd: 1.2 },
  /** Server: a frog rider may be up to this far above the ground (the jump plus a mound's drop). */
  ceil: 13,
} as const;

const TAU = Math.PI * 2;

/** Where the wild frog waits: the montículo closest to the Laguna Negra's north shore. */
export function wildFrog(_t: Terrain, seed: number): { x: number; z: number } {
  const north = { x: LAGUNA.x, z: LAGUNA.z - LAGUNA.rz };
  const d = (m: { x: number; z: number }) => Math.hypot(m.x - north.x, m.z - north.z);
  const best = swampFeatures(seed).mounds.reduce((a, m) => (d(m) < d(a) ? m : a));
  return { x: best.x, z: best.z };
}

/** The chase: pads in order, each 8–12 m from the last, all in wadeable bog. Same seed, same pads. */
export function frogPads(t: Terrain, seed: number, home: { x: number; z: number }): { x: number; z: number }[] {
  const rng = createRng(seed ^ 0xf209);
  const out: { x: number; z: number }[] = [];
  let prev = home;
  let heading = rng() * TAU;
  while (out.length < FROG.pads) {
    let next: { x: number; z: number } | null = null;
    for (let tries = 0; tries < 80 && !next; tries++) {
      const a = heading + (rng() - 0.5) * (tries < 30 ? 1.6 : TAU);
      const d = FROG.padGap[0] + rng() * (FROG.padGap[1] - FROG.padGap[0]);
      const c = { x: prev.x + Math.sin(a) * d, z: prev.z + Math.cos(a) * d };
      if (inBog(t, c.x, c.z)) {
        next = c;
        heading = a;
      }
    }
    // ponytail: never seen in tests; fall back to the frog's home so the chase stays finishable.
    next ??= { ...home };
    out.push(next);
    prev = next;
  }
  return out;
}

/** Can the frog be here? In the map, on land or in water no deeper than FROG.deep. */
export function frogStepOk(t: Terrain, x: number, z: number): boolean {
  return inMap(x, z, 2) && t.heightAt(x, z) >= WATER_LEVEL - FROG.deep;
}

/** Launch speeds for the high jump under `gravity`: straight up `vy`, forward `fwd` (m/s). */
export function frogHop(gravity: number): { vy: number; fwd: number } {
  const vy = Math.sqrt(2 * gravity * FROG.hop.up);
  return { vy, fwd: FROG.hop.fwd / ((2 * vy) / gravity) };
}
