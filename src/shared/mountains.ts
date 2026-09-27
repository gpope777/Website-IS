import { inMountains, mountainDepth, PELDANOS, type Terrain } from './terrain';

/**
 * The mountains' slope rule (spec S4 §3.3): uphill onto a cell steeper than `deg` is refused on foot and on mounts
 * (S4-B lets walkers grab non-smooth rock). The server allows a little more so near-threshold cells never rubber-band.
 */
export const STEEP = { deg: 45, serverDeg: 50, probe: 1 } as const;

/** Terrain slope at (x, z) in degrees (central difference over 1 m). */
export function slopeAt(t: Terrain, x: number, z: number): number {
  const gx = t.heightAt(x + 0.5, z) - t.heightAt(x - 0.5, z);
  const gz = t.heightAt(x, z + 0.5) - t.heightAt(x, z - 0.5);
  return (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
}

/** Smooth rock with no grip: los Peldaños (S4-B adds shrine gates). */
export function smoothAt(x: number, z: number): boolean {
  const d = mountainDepth(z);
  return inMountains(x, z) && d < PELDANOS.first + PELDANOS.pitch * (PELDANOS.steps - 1) + PELDANOS.run + 0.5;
}

/** Does the move (p → n) climb onto a cell steeper than `deg` inside the mountains? Downhill always passes. */
export function steepBlocked(t: Terrain, px: number, pz: number, nx: number, nz: number, deg: number = STEEP.deg): boolean {
  if (!inMountains(nx, nz)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(nx - px, nz - pz) / STEEP.probe));
  let prev = t.heightAt(px, pz);
  for (let i = 1; i <= n; i++) {
    const x = px + ((nx - px) * i) / n;
    const z = pz + ((nz - pz) * i) / n;
    const h = t.heightAt(x, z);
    if (h > prev + 1e-3 && inMountains(x, z) && slopeAt(t, x, z) > deg) return true;
    prev = h;
  }
  return false;
}
