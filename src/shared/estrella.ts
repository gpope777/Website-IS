import { CORRUPT_LANDS } from './terrain';

/**
 * La Estrella (spec S5 §13, S5-H): the legendary beast. After the ending, on full-moon nights, she rolls in a
 * circle in la Ceniza. Tamed with the timing ring (4 rounds), she becomes your land mount in place of the deer.
 */
export const ESTRELLA = {
  /** A full moon every `moonEvery` days (day 0 included). */
  moonEvery: 8,
  /** Metres from her to tame her. */
  reach: 4,
  /** Paper height (m). */
  h: 2.2,
  walk: 7,
  run: 13,
  /** Server speed cap while riding her. */
  maxSpeed: 14,
  /** Her circle: centre `dx` m east and `dn` m north of the rim's foot, radius `r`, angular speed `w` rad/s. */
  path: { dx: -30, dn: 50, r: 20, w: 0.12 },
  rounds: [
    { speed: 2.8, width: 1.1 },
    { speed: 3.8, width: 0.85 },
    { speed: 4.8, width: 0.65 },
    { speed: 5.6, width: 0.55 },
  ],
} as const;

const FOOT = CORRUPT_LANDS.z1 - CORRUPT_LANDS.rim;

/** [D] Full moon: every 8th day. */
export function fullMoon(day: number): boolean {
  return day % ESTRELLA.moonEvery === 0;
}

/** She is out: after the ending, on a full-moon night. */
export function estrellaOut(day: number, night: boolean, ending: boolean): boolean {
  return ending && night && fullMoon(day);
}

/** Where she rolls at sim time `time` (yaw along the path, protocol atan2(dirX, dirZ)). */
export function estrellaAt(time: number): { x: number; z: number; yaw: number } {
  const P = ESTRELLA.path;
  const a = time * P.w;
  const cx = P.dx;
  const cz = FOOT - P.dn;
  return { x: cx + Math.cos(a) * P.r, z: cz + Math.sin(a) * P.r, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) };
}
