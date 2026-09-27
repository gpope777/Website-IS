import { HALF, inMountains, mountainDepth, PELDANOS, type Terrain } from './terrain';

/**
 * The mountains' slope rule (spec S4 §3.3): uphill onto a cell steeper than `deg` is refused on foot and on mounts
 * (S4-B lets walkers grab non-smooth rock). The server allows a little more so near-threshold cells never rubber-band.
 */
export const STEEP = { deg: 45, serverDeg: 50, probe: 1 } as const;

/** What a refused uphill step says (client toast and server hint). */
export const STEEP_TEXT = { smooth: 'Roca lisa. Sin agarre', deer: 'El ciervo no trepa', steep: 'Demasiado empinado', wet: 'Roca mojada. Resbala' } as const;

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

/** Altitude cold (spec S4 §3.4): above COLD.y of terrain height in the mountains; a Llamarada warms its caster by warmFlame. */
export const COLD = { y: 30, warmFlame: 20 } as const;

export function altitudeCold(t: Terrain, x: number, z: number): boolean {
  return inMountains(x, z) && t.heightAt(x, z) > COLD.y;
}

/** Free climbing (S4-B): steep mountain rock you can grab on foot — not the smooth Peldaños, not wet from rain. */
export function climbableAt(x: number, z: number, wet: boolean): boolean {
  return inMountains(x, z) && !smoothAt(x, z) && !wet;
}

/**
 * La Escalera del Umbral (spec S4 §3.2): the carved Umbral block at the Peldaños' foot takes 3 Piedra casts
 * within `reach`; then a 4 m band of the Peldaños (|x| < half) is a ramp for everyone, forever.
 */
export const UMBRAL = { x: 0, z: -HALF + 3, size: 2, reach: 5, casts: 3 } as const;
export const ESCALERA = { half: 2, len: 40, rise: PELDANOS.rise * PELDANOS.steps } as const;

/** Inside the ramp's band (depth 0–len into the mountains, |x| < half)? */
export function inEscalera(x: number, z: number): boolean {
  const d = mountainDepth(z);
  return Math.abs(x) < ESCALERA.half && d > 0 && d < ESCALERA.len;
}

/** The terrain with the Escalera raised while `on()`: in the band, the forest rim + rise · d / len (≈31°). */
export function withEscalera(base: Terrain, on: () => boolean): Terrain {
  return {
    heightAt: (x, z) => (on() && inEscalera(x, z) ? base.heightAt(x, -HALF) + (ESCALERA.rise * mountainDepth(z)) / ESCALERA.len : base.heightAt(x, z)),
    density: (x, z) => base.density(x, z),
  };
}
