import { VIENTO, type Dir } from './viento';

/**
 * Fuego, the third power (spec S3 §4): the Llamarada, a short cone of flame. Enemies take a hit and
 * burn; burning wolves run. It lights braziers and gas lamps and burns withered things (thorns, peat,
 * swamp roots).
 */
export const FUEGO = {
  range: 6,
  /** Full cone angle (60°). */
  cone: (60 * Math.PI) / 180,
  cooldown: 5,
  damage: 6,
  burnDps: 3,
  burnFor: 4,
  /** Seconds a burning wolf runs away. */
  flee: 2,
  /** A Llamarada within this of a swamp zone's withered root cleanses it. */
  rootReach: 5,
  /** Casts that burn a wall of thorns or peat. */
  burns: 3,
} as const;

/** La hoguera, the fire trap (spec S3 §4): the first beast in it burns, wolves near it flee; it rearms. */
export const HOGUERA = { radius: 1.6, scare: 4, rearm: 8, wear: 10 } as const;

/** A point inside the flame: within range and within half the cone angle of the direction. */
export function inFlame(px: number, pz: number, dir: Dir, x: number, z: number, range: number = FUEGO.range): boolean {
  const dx = x - px;
  const dz = z - pz;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 0.5) return true;
  return (dx * dir.x + dz * dir.z) / d >= Math.cos(FUEGO.cone / 2);
}

// Same aim helper as the gust.
export { gustDir as flameDir } from './viento';
