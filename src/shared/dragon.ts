import { HALF, MOUNTAINS, mountainFeatures, PICO, type Terrain } from './terrain';
import { weatherAt } from './weather';

/** El Dragón Marchito: the flying mount (spec S4 §10). Circles the Pico on storm days once El Cucurucho is purified. */
export const DRAGON = {
  /**
   * Its circle round the Pico: radius, metres below the top, seconds per lap, and the least clearance over the
   * ground under the circle. (The spec's 14 m ran inside the Pico's skirt; 22 m clears it.)
   */
  radius: 22,
  below: 8,
  lap: 10,
  clearance: 3,
  /** The leap: from the Pico's top (within `rim` of its centre), when the dragon's bearing is within `window` rad of yours (~1.5 s a lap). */
  rim: PICO.r + 3,
  window: 0.47,
  /** 5 rounds; a negative speed runs the needle backwards (rounds 3 and 5 reverse). */
  rounds: [
    { speed: 3.4, width: 0.9 },
    { speed: 3.9, width: 0.8 },
    { speed: -4.4, width: 0.7 },
    { speed: 4.9, width: 0.6 },
    { speed: -5.4, width: 0.5 },
  ],
  /** Flight: m/s along the stick, B held climbs, released sinks. */
  fly: 15,
  climb: 4,
  sink: 2,
  /** Ceiling above the ground and absolute. */
  ceil: 35,
  maxY: 120,
  /** Server: speed cap for riders (and `grace` s after getting off) and its height allowance above the ground. */
  maxSpeed: 17,
  serverCeil: 36,
  grace: 2,
  /** Metres from your parked dragon to get back on. */
  reach: 5,
  /** In a raid, no landing this close to the Heart; the server's floor there (above ground). */
  heartNoLand: 30,
  raidFloor: 5,
  /** Rider seat above the dragon, and the cutout's width. */
  height: 1.2,
  width: 8,
} as const;

export const FOG_TEXT = 'La niebla te devuelve. Aún no';

/** Is the wild dragon out on in-game day `day`? Only on a storm day, and only once El Cucurucho is purified. */
export function dragonOut(seed: number, day: number, purified4: boolean): boolean {
  return purified4 && weatherAt(seed, day) === 'storm';
}

export interface PicoCircle {
  x: number;
  z: number;
  /** The flat top's height. */
  top: number;
  /** The height the dragon circles at. */
  fly: number;
}

/** The Pico's centre, its flat top, and the dragon's flying height (never through the mountain). */
export function picoOf(t: Terrain, seed: number): PicoCircle {
  const { pico } = mountainFeatures(seed);
  const top = t.heightAt(pico.x, pico.z);
  let ground = -Infinity;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ground = Math.max(ground, t.heightAt(pico.x + Math.sin(a) * DRAGON.radius, pico.z + Math.cos(a) * DRAGON.radius));
  }
  return { x: pico.x, z: pico.z, top, fly: Math.max(top - DRAGON.below, ground + DRAGON.clearance) };
}

/** The wild dragon at `time`: a pure function (client and server agree). Yaw = heading along its circle. */
export function dragonPos(pico: PicoCircle, time: number): { x: number; y: number; z: number; yaw: number } {
  const a = ((time % DRAGON.lap) / DRAGON.lap) * Math.PI * 2;
  return { x: pico.x + Math.sin(a) * DRAGON.radius, y: pico.fly, z: pico.z + Math.cos(a) * DRAGON.radius, yaw: a + Math.PI / 2 };
}

/** Highest a dragon may fly over ground of height `ground`. */
export function dragonCeil(ground: number): number {
  return Math.min(ground + DRAGON.ceil, DRAGON.maxY);
}

/** The muro de niebla: north of the mountains' rim (the Tierras Corruptas, Slice 5). */
export function inFog(z: number): boolean {
  return z < -HALF - MOUNTAINS.rimFrom;
}

/** Can a player at `p` leap onto the wild dragon at `time`? On the Pico's top, with the dragon passing below on your side. */
export function leapOk(pico: PicoCircle, time: number, p: { x: number; y: number; z: number }): boolean {
  const r = Math.hypot(p.x - pico.x, p.z - pico.z);
  if (r > DRAGON.rim || p.y < pico.top - 2) return false;
  if (r < 1) return true; // dead centre: every side is your side
  const d = dragonPos(pico, time);
  const mine = Math.atan2(p.x - pico.x, p.z - pico.z);
  const its = Math.atan2(d.x - pico.x, d.z - pico.z);
  const diff = Math.abs(((its - mine + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return diff <= DRAGON.window;
}
