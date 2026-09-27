import { CHUTE, inMountains, mountainDepth, type Terrain } from './terrain';

/**
 * El tobogán de nieve (spec S4 §9.1, "Idea de Claude"): B while running on snow steeper than startDeg throws you on your
 * belly, downhill at up to `speed`. The packed chute down the middle carries you south to the Umbral. Server cap maxSpeed.
 */
export const SNOWSLIDE = { snowY: 55, startDeg: 15, stopDeg: 8, stopAfter: 1, speed: 14, accel: 6, steer: Math.PI / 6, maxSpeed: 16, grace: 1, bump: 3, chutePad: 1 } as const;

/** The packed snow chute: |x| < CHUTE.half + pad, anywhere inside the mountains (down the Peldaños too). */
export function inChute(x: number, z: number): boolean {
  return Math.abs(x) < CHUTE.half + SNOWSLIDE.chutePad && mountainDepth(z) > 0 && inMountains(x, z);
}

/** Snow: mountain ground above snowY, or the chute. */
export function snowAt(t: Terrain, x: number, z: number): boolean {
  return inChute(x, z) || (inMountains(x, z) && t.heightAt(x, z) > SNOWSLIDE.snowY);
}

/** Which way the slide goes: south in the chute, else down the gradient (unit vector; south on a flat). */
export function slideDir(t: Terrain, x: number, z: number): { x: number; z: number } {
  if (inChute(x, z)) return { x: 0, z: 1 };
  const gx = t.heightAt(x - 0.5, z) - t.heightAt(x + 0.5, z);
  const gz = t.heightAt(x, z - 0.5) - t.heightAt(x, z + 0.5);
  const m = Math.hypot(gx, gz);
  return m < 1e-6 ? { x: 0, z: 1 } : { x: gx / m, z: gz / m };
}

/** Server: a slider's window (a → end) starts and ends on snow and does not climb more than `bump`. */
export function slideMoveOk(t: Terrain, ax: number, az: number, x: number, z: number): boolean {
  return snowAt(t, ax, az) && snowAt(t, x, z) && t.heightAt(x, z) <= t.heightAt(ax, az) + SNOWSLIDE.bump;
}
