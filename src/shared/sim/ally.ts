import type { Terrain } from '../terrain';
import type { WolfAnim } from '../protocol';
import type { Wolf } from './wolves';

/** The purified Tragón (spec §2): it guards the Heart and bites raiders that come close. It cannot die. */
export const ALLY = { guard: 16, run: 5.5, reach: 2.2, damage: 25, cooldown: 1.2, home: 2.5 } as const;

export interface Ally {
  x: number;
  y: number;
  z: number;
  yaw: number;
  cooldown: number;
  anim: WolfAnim;
}

export function createAlly(heart: { x: number; z: number }, terrain: Terrain): Ally {
  const x = heart.x + ALLY.home;
  return { x, y: terrain.heightAt(x, heart.z), z: heart.z, yaw: 0, cooldown: 0, anim: 'idle' };
}

/** One tick. Returns the raider it bites (the caller deals the damage). */
export function stepAlly(a: Ally, heart: { x: number; z: number }, foes: readonly Wolf[], terrain: Terrain, dt: number): Wolf | null {
  a.cooldown = Math.max(0, a.cooldown - dt);
  let foe: Wolf | null = null;
  let best = Infinity;
  for (const w of foes) {
    if (!w.raid || w.hp <= 0 || Math.hypot(w.x - heart.x, w.z - heart.z) > ALLY.guard) continue;
    const d = Math.hypot(w.x - a.x, w.z - a.z);
    if (d < best) {
      best = d;
      foe = w;
    }
  }
  const goal = foe ?? { x: heart.x + ALLY.home, z: heart.z };
  const dx = goal.x - a.x;
  const dz = goal.z - a.z;
  const d = Math.hypot(dx, dz);
  const stop = foe ? ALLY.reach : 0.05;
  if (d > stop) {
    const step = Math.min(foe ? d - ALLY.reach * 0.8 : d, ALLY.run * dt);
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    a.y = terrain.heightAt(a.x, a.z);
    a.yaw = Math.atan2(dx, dz);
    a.anim = 'run';
    return null;
  }
  if (!foe) {
    a.anim = 'idle';
    return null;
  }
  a.yaw = Math.atan2(dx, dz);
  a.anim = 'attack';
  if (a.cooldown > 0) return null;
  a.cooldown = ALLY.cooldown;
  return foe;
}
