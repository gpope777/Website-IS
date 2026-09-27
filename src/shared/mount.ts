import { createRng } from './rng';
import { inForest, WATER_LEVEL, type Terrain } from './terrain';

/**
 * El Ciervo: the land mount. Taming is a timing ring judged by the server; riding is
 * faster than running and the server raises its speed cap only for riders.
 */
export const MOUNT = {
  /** Metres from the deer to tame it or get on. */
  reach: 3.5,
  walk: 6,
  run: 12,
  /** Server speed cap while riding (and `grace` seconds after getting off). */
  maxSpeed: 13,
  grace: 2,
  /** Rider seat height above the deer's feet. */
  height: 1.1,
  /** A passenger sits this far behind the rider. */
  seatBack: 0.6,
  /** Each round: needle speed (rad/s) and zone width (rad). */
  rounds: [
    { speed: 2.4, width: 1.3 },
    { speed: 3.4, width: 0.95 },
    { speed: 4.6, width: 0.65 },
  ],
  /** A friend near the deer calms it: zone width × this. */
  calmWidth: 1.5,
  calmReach: 6,
  /** A tap's sim time may be this far before / after the server's now (latency). */
  early: 0.6,
  late: 0.15,
  /** Seconds a round waits for a tap before the deer throws you. */
  roundTimeout: 8,
  /** Seconds before you can try again after being thrown. */
  retry: 2,
  /** Walk this far from the deer mid-taming and it is over. */
  leash: 6,
  minDist: 50,
  maxDist: 110,
  /** Metres kept clear of crags, shrines and the Raíz-madre. */
  clear: 12,
} as const;

const TAU = Math.PI * 2;

/** Needle angle `t` seconds into a round, in [0, 2π). */
export function ringAngle(speed: number, t: number): number {
  return (((speed * t) % TAU) + TAU) % TAU;
}

/** Is `angle` inside the zone centred on `zone`, `width` radians wide (wrapping round 0)? */
export function inZone(angle: number, zone: number, width: number): boolean {
  const d = Math.abs(((angle - zone) % TAU + TAU + Math.PI) % TAU - Math.PI);
  return d <= width / 2;
}

/** Where the wild deer grazes: seeded, on dry land, away from `avoid`. */
export function generateWild(terrain: Terrain, seed: number, avoid: readonly { x: number; z: number }[]): { x: number; y: number; z: number } {
  const rng = createRng(seed ^ 0x0dee7);
  let x = 0;
  let z = MOUNT.minDist;
  for (let tries = 0; tries < 200; tries++) {
    const ang = rng() * TAU;
    const d = MOUNT.minDist + rng() * (MOUNT.maxDist - MOUNT.minDist);
    x = Math.sin(ang) * d;
    z = Math.cos(ang) * d;
    if (!inForest(x, z, 25)) continue;
    if (terrain.heightAt(x, z) < WATER_LEVEL + 1) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) <= MOUNT.clear)) continue;
    break;
  }
  // ponytail: if no try fits, the last candidate is used (never seen in tests).
  return { x, y: terrain.heightAt(x, z), z };
}
