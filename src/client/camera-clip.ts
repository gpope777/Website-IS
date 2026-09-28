import type { Circle } from './movement';

/** Keep the camera this far in front of whatever it would pass through, and never closer than MIN. */
export const CLIP = { pad: 0.3, min: 0.8, ground: 0.4, samples: 6 } as const;

/**
 * P7-A: how far the orbit camera can sit along `dir` (unit) from `eye` before it would go through
 * a collider circle (rocks, walls, pillars, structures — widened by `pad`) or dip under the terrain.
 */
export function clipDistance(eye: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, want: number, circles: readonly Circle[], heightAt: (x: number, z: number) => number): number {
  let d = want;
  const hl = Math.hypot(dir.x, dir.z);
  if (hl > 1e-6) {
    for (const c of circles) {
      const r = c.r + CLIP.pad;
      // Ray (xz) vs circle: eye + t·dir, t in [0, d].
      const fx = eye.x - c.x;
      const fz = eye.z - c.z;
      if (fx * fx + fz * fz <= r * r) continue; // the player stands inside it (a door gap, a bush): ignore
      const a = dir.x * dir.x + dir.z * dir.z;
      const b = 2 * (fx * dir.x + fz * dir.z);
      const cc = fx * fx + fz * fz - r * r;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < d) d = t - CLIP.pad;
    }
  }
  for (let i = 1; i <= CLIP.samples; i++) {
    const t = (want * i) / CLIP.samples;
    if (t >= d) break;
    const x = eye.x + dir.x * t;
    const z = eye.z + dir.z * t;
    if (eye.y + dir.y * t < heightAt(x, z) + CLIP.ground) {
      d = Math.max(0, (want * (i - 1)) / CLIP.samples);
      break;
    }
  }
  return Math.max(CLIP.min, Math.min(want, d));
}
