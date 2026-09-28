import * as THREE from 'three';
import type { Look } from '../scene/looks';

/** V2-E: how bright/what colour the drawings are lit (spec §6.3): half the look's light, never darker than `floor`. */
export function paperLight(look: Look, daylight: number, out = new THREE.Color()): THREE.Color {
  const sunK = Math.min(1, look.sunI / 2.4) * daylight;
  const r = look.sun.r * sunK + look.hemiSky.r * look.hemiI;
  const g = look.sun.g * sunK + look.hemiSky.g * look.hemiI;
  const b = look.sun.b * sunK + look.hemiSky.b * look.hemiI;
  const floor = 0.35 + 0.2 * daylight;
  const f = (v: number) => Math.min(1.1, Math.max(floor, 0.5 + 0.5 * v));
  return out.setRGB(f(r), f(g), f(b));
}

/** The moonlit rim on actors: 0 by day, up to 0.55 at full night. */
export function rimStrength(daylight: number): number {
  return 0.55 * Math.pow(Math.max(0, 1 - daylight), 1.5);
}
