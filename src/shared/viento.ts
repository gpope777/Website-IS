/**
 * Viento, the second power (spec §4): a gust in a cone in front of you. Enemies are pushed, stunned
 * and scratched; pumice blocks slide; fan-gates turn; while gliding, it lifts you once per flight.
 */
export const VIENTO = {
  range: 8,
  /** Full cone angle (70°). */
  cone: (70 * Math.PI) / 180,
  cooldown: 6,
  push: 6,
  /** How far bosses, elites and El Marchito move. */
  heavyPush: 2,
  stun: 1,
  damage: 5,
  /** A push that ends this much lower is a fall. */
  ledge: 3,
  ledgeDamage: 20,
  /** At most this many beasts drown per gust. */
  waterKills: 3,
  /** Glider lift (m) once per flight, and how long the server allows the climb. */
  boost: 6,
  boostFor: 2,
  slide: 6,
  /** A gust within this of a coast zone's withered root cleanses it. */
  rootReach: 5,
} as const;

export type Dir = { x: number; z: number };

/** Unit vector from the caster toward the aimed point (straight +z when they coincide). */
export function gustDir(px: number, pz: number, tx: number, tz: number): Dir {
  const d = Math.hypot(tx - px, tz - pz);
  return d < 1e-4 ? { x: 0, z: 1 } : { x: (tx - px) / d, z: (tz - pz) / d };
}

/** A point inside the gust: within range and within half the cone angle of the direction. */
export function inGust(px: number, pz: number, dir: Dir, x: number, z: number, range: number = VIENTO.range): boolean {
  const dx = x - px;
  const dz = z - pz;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 0.5) return true;
  return (dx * dir.x + dz * dir.z) / d >= Math.cos(VIENTO.cone / 2);
}

export function slide(x: number, z: number, dir: Dir, dist: number): { x: number; z: number } {
  return { x: x + dir.x * dist, z: z + dir.z * dist };
}
