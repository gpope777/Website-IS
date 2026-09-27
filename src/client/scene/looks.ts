import * as THREE from 'three';
import { HALF, inCorrupt, inMountains, inSwamp } from '../../shared/terrain';

/** V2-B (spec §4): each biome's light and sky by time of day, as data. Retouch colours here, not in shaders. */
export type Biome = 'bosque' | 'costa' | 'pantano' | 'montanas' | 'tierras';
export const BIOMES: readonly Biome[] = ['bosque', 'costa', 'pantano', 'montanas', 'tierras'];

export interface LookKey {
  zenith: number;
  horizon: number;
  fog: number;
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  moonI: number;
}
export type Hour = 'noche' | 'alba' | 'dia' | 'ocaso';
/** Day fraction of each key (0 = midnight; the sun rises at 0.25). */
export const HOURS: Record<Hour, number> = { noche: 0, alba: 0.25, dia: 0.5, ocaso: 0.75 };

/** Truly dark nights (spec §4): the same night everywhere but a hint of each biome. */
const night = (horizon: number, ground: number): LookKey => ({ zenith: 0x05080f, horizon, fog: horizon, sun: 0xffb070, sunI: 0, hemiSky: 0x33415e, hemiGround: ground, hemiI: 0.08, moonI: 0.35 });

export const LOOKS: Record<Biome, Record<Hour, LookKey>> = {
  bosque: {
    noche: night(0x0c1422, 0x10180e),
    alba: { zenith: 0x5a7fb0, horizon: 0xf0b890, fog: 0xc8b8a0, sun: 0xffc890, sunI: 1.4, hemiSky: 0xbfd0ff, hemiGround: 0x3b5a2a, hemiI: 0.45, moonI: 0.05 },
    dia: { zenith: 0x4f8fd0, horizon: 0xb8d8e4, fog: 0xa8c8d8, sun: 0xfff2d8, sunI: 2.4, hemiSky: 0xbfd8ff, hemiGround: 0x3b5a2a, hemiI: 0.75, moonI: 0 },
    ocaso: { zenith: 0x4a5a98, horizon: 0xf0a070, fog: 0xd9a080, sun: 0xffa060, sunI: 1.3, hemiSky: 0xffc8b0, hemiGround: 0x3b4a2a, hemiI: 0.45, moonI: 0.05 },
  },
  costa: {
    noche: night(0x0b1626, 0x141820),
    alba: { zenith: 0x5a88c0, horizon: 0xf4c8a0, fog: 0xe0d0c0, sun: 0xffd0a0, sunI: 1.6, hemiSky: 0xc8e0ff, hemiGround: 0x8a7a5a, hemiI: 0.5, moonI: 0.05 },
    dia: { zenith: 0x2f9ad8, horizon: 0xc8eef4, fog: 0xc0e4ee, sun: 0xffffff, sunI: 2.7, hemiSky: 0xd0ecff, hemiGround: 0x9a8a60, hemiI: 0.8, moonI: 0 },
    ocaso: { zenith: 0x3a5a9a, horizon: 0xff9a50, fog: 0xe8a070, sun: 0xff9040, sunI: 1.5, hemiSky: 0xffc0a0, hemiGround: 0x6a5a40, hemiI: 0.45, moonI: 0.05 },
  },
  pantano: {
    noche: night(0x0c140e, 0x0c120a),
    alba: { zenith: 0x5a6a60, horizon: 0xa0a078, fog: 0x8a9068, sun: 0xd8c890, sunI: 0.9, hemiSky: 0xa0b098, hemiGround: 0x3a4a20, hemiI: 0.4, moonI: 0.05 },
    dia: { zenith: 0x6a8278, horizon: 0xa8b490, fog: 0x98a478, sun: 0xe8e0b0, sunI: 1.4, hemiSky: 0xb0c0a0, hemiGround: 0x3a4a20, hemiI: 0.6, moonI: 0 },
    ocaso: { zenith: 0x4a5048, horizon: 0xb0904a, fog: 0x908048, sun: 0xd89850, sunI: 0.9, hemiSky: 0xb0a080, hemiGround: 0x2a3418, hemiI: 0.4, moonI: 0.05 },
  },
  montanas: {
    noche: night(0x0c1428, 0x141a24),
    alba: { zenith: 0x3a5a98, horizon: 0xf0b8c0, fog: 0xc8c8d8, sun: 0xffd0c0, sunI: 1.6, hemiSky: 0xc0d0ff, hemiGround: 0x5a6070, hemiI: 0.45, moonI: 0.05 },
    dia: { zenith: 0x2a64b8, horizon: 0xb0d0ec, fog: 0xb0c8e0, sun: 0xf0f4ff, sunI: 2.6, hemiSky: 0xc8dcff, hemiGround: 0x5a6070, hemiI: 0.7, moonI: 0 },
    ocaso: { zenith: 0x34407a, horizon: 0xf0a0b0, fog: 0xc8a0b0, sun: 0xffa8a0, sunI: 1.4, hemiSky: 0xffc8d0, hemiGround: 0x4a4a60, hemiI: 0.45, moonI: 0.05 },
  },
  tierras: {
    noche: night(0x140a1a, 0x120a14),
    alba: { zenith: 0x4a2a5a, horizon: 0xb06a70, fog: 0x7a4a6a, sun: 0xff9070, sunI: 1.0, hemiSky: 0x9a7aa8, hemiGround: 0x3a2a38, hemiI: 0.4, moonI: 0.05 },
    dia: { zenith: 0x5a3a78, horizon: 0xa87a98, fog: 0x8a6a88, sun: 0xffb090, sunI: 1.6, hemiSky: 0xb898c8, hemiGround: 0x3a2a38, hemiI: 0.6, moonI: 0 },
    ocaso: { zenith: 0x40203a, horizon: 0xc04a3a, fog: 0x8a3a40, sun: 0xff6040, sunI: 1.1, hemiSky: 0xc07a80, hemiGround: 0x3a2028, hemiI: 0.4, moonI: 0.05 },
  },
};

/** V2-C (spec §4): las Tierras after El Marchito falls — like the forest, more golden, clean fog. */
export const PURIFIED: Record<Hour, LookKey> = {
  noche: night(0x0e1624, 0x10180e),
  alba: { zenith: 0x6a88b8, horizon: 0xf8c890, fog: 0xd8c8a0, sun: 0xffd090, sunI: 1.5, hemiSky: 0xc8d8ff, hemiGround: 0x5a6a3a, hemiI: 0.5, moonI: 0.05 },
  dia: { zenith: 0x5a98d8, horizon: 0xd8e4d0, fog: 0xc8d8c8, sun: 0xfff0c8, sunI: 2.4, hemiSky: 0xd0e0ff, hemiGround: 0x6a7a3a, hemiI: 0.8, moonI: 0 },
  ocaso: { zenith: 0x5a5a98, horizon: 0xffb070, fog: 0xe0b080, sun: 0xffb060, sunI: 1.4, hemiSky: 0xffd0b0, hemiGround: 0x5a5a2a, hemiI: 0.5, moonI: 0.05 },
};

/** The biome at a point (same regions as the shop's biomeItem; the coast is south of the forest's rim). */
export function biomeOf(x: number, z: number): Biome {
  if (inCorrupt(x, z)) return 'tierras';
  if (inMountains(x, z)) return 'montanas';
  if (inSwamp(x, z)) return 'pantano';
  if (z > HALF) return 'costa';
  return 'bosque';
}

/** Blend radius (m): the look is the average of the point and 4 points this far away (≈ a 30 m crossfade). */
export const BLEND_R = 15;

export function biomeWeights(x: number, z: number): Partial<Record<Biome, number>> {
  const w: Partial<Record<Biome, number>> = {};
  const pts: [number, number][] = [[x, z], [x + BLEND_R, z], [x - BLEND_R, z], [x, z + BLEND_R], [x, z - BLEND_R]];
  for (const [px, pz] of pts) {
    const b = biomeOf(px, pz);
    w[b] = (w[b] ?? 0) + 1 / pts.length;
  }
  return w;
}

export interface Look {
  zenith: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  sun: THREE.Color;
  sunI: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  moonI: number;
}

export function newLook(): Look {
  return { zenith: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), sunI: 0, hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiI: 0, moonI: 0 };
}

const ORDER: Hour[] = ['noche', 'alba', 'dia', 'ocaso'];
const COLORS = ['zenith', 'horizon', 'fog', 'sun', 'hemiSky', 'hemiGround'] as const;
const NUMS = ['sunI', 'hemiI', 'moonI'] as const;
const tmp = new THREE.Color();
const tmpB = new THREE.Color();

/** The two keys around `frac` and the mix between them (cyclic, smoothstep). */
export function hourMix(frac: number): { a: Hour; b: Hour; t: number } {
  const f = ((frac % 1) + 1) % 1;
  const i = Math.min(3, Math.floor(f * 4));
  const t = f * 4 - i;
  return { a: ORDER[i]!, b: ORDER[(i + 1) % 4]!, t: t * t * (3 - 2 * t) };
}

/** The look for biome weights at day fraction `frac`, into `out`. `purify` (0..1, V2-C) turns las Tierras into the Purified look. */
export function lookAt(w: Partial<Record<Biome, number>>, frac: number, out: Look = newLook(), purify = 0): Look {
  const { a, b, t } = hourMix(frac);
  for (const k of COLORS) out[k].setRGB(0, 0, 0);
  for (const k of NUMS) out[k] = 0;
  const p = Math.min(1, Math.max(0, purify));
  for (const biome of [...BIOMES, 'purificado' as const]) {
    const wt = biome === 'purificado' ? (w.tierras ?? 0) * p : biome === 'tierras' ? (w.tierras ?? 0) * (1 - p) : (w[biome] ?? 0);
    if (wt <= 0) continue;
    const keys = biome === 'purificado' ? PURIFIED : LOOKS[biome];
    const ka = keys[a];
    const kb = keys[b];
    for (const k of COLORS) {
      tmp.setHex(ka[k]).lerp(tmpB.setHex(kb[k]), t).multiplyScalar(wt);
      out[k].add(tmp);
    }
    for (const k of NUMS) out[k] += (ka[k] + (kb[k] - ka[k]) * t) * wt;
  }
  return out;
}

/** Eases `cur` toward `target` (1 s time constant): no jumps when the biome changes or you teleport. */
export function easeLook(cur: Look, target: Look, dt: number): void {
  const k = 1 - Math.exp(-dt);
  for (const c of COLORS) cur[c].lerp(target[c], k);
  for (const n of NUMS) cur[n] += (target[n] - cur[n]) * k;
}

export function copyLook(to: Look, from: Look): void {
  for (const c of COLORS) to[c].copy(from[c]);
  for (const n of NUMS) to[n] = from[n];
}
