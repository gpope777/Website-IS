import { HALF, MOUNTAINS, mountainFeatures, type Terrain } from './terrain';
import { weatherAt } from './weather';

/** El Dragón Marchito: the flying mount (spec S4 §10). Circles the Pico on storm days once El Cucurucho is purified. */
export const DRAGON = {
  /** Its circle round the Pico: radius, metres below the top, seconds per lap. */
  radius: 14,
  below: 8,
  lap: 10,
  /** The leap: dragon within this horizontally, below you, at most `leapMaxDrop` below. */
  leapR: 4,
  leapMaxDrop: 14,
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

/** The Pico's centre and flat top (from the seed and the terrain). */
export function picoOf(t: Terrain, seed: number): { x: number; z: number; top: number } {
  const { pico } = mountainFeatures(seed);
  return { x: pico.x, z: pico.z, top: t.heightAt(pico.x, pico.z) };
}

/** The wild dragon at `time`: a pure function (client and server agree). Yaw = heading along its circle. */
export function dragonPos(pico: { x: number; z: number; top: number }, time: number): { x: number; y: number; z: number; yaw: number } {
  const a = ((time % DRAGON.lap) / DRAGON.lap) * Math.PI * 2;
  return { x: pico.x + Math.sin(a) * DRAGON.radius, y: pico.top - DRAGON.below, z: pico.z + Math.cos(a) * DRAGON.radius, yaw: a + Math.PI / 2 };
}

/** Highest a dragon may fly over ground of height `ground`. */
export function dragonCeil(ground: number): number {
  return Math.min(ground + DRAGON.ceil, DRAGON.maxY);
}

/** The muro de niebla: north of the mountains' rim (the Tierras Corruptas, Slice 5). */
export function inFog(z: number): boolean {
  return z < -HALF - MOUNTAINS.rimFrom;
}

/** Can a player at `p` leap onto the wild dragon at `time`? */
export function leapOk(pico: { x: number; z: number; top: number }, time: number, p: { x: number; y: number; z: number }): boolean {
  const d = dragonPos(pico, time);
  const drop = p.y - d.y;
  return Math.hypot(d.x - p.x, d.z - p.z) <= DRAGON.leapR && drop > 0 && drop <= DRAGON.leapMaxDrop;
}
