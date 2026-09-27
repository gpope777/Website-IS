import { clampMap, type Terrain } from '../terrain';
import { WOLF, type Wolf, type WolfTarget } from './wolves';

/**
 * El rayo marchito (spec S5 §7.2): a flying paper bolt. Hovers `fly` m over the ground; every `every` s it
 * flashes for `tell` s (anim 'attack'), dives at where its target stood and bites once on contact, then climbs.
 * A Viento gust grounds it for `grounded` s. Melee only reaches it while it is `low`; arrows always do.
 */
export const RAYO = { hp: 60, fly: 6, speed: 9, sight: 20, every: 3, tell: 0.8, dive: 18, drop: 11, diveMax: 1.4, climb: 6, damage: 10, reach: 1.6, grounded: 3, low: 2.5, keep: 4 } as const;

const EPS = 1e-6;

/** Close enough to the ground for a sword. */
export function rayoLow(w: Wolf, ground: number): boolean {
  return w.y - ground <= RAYO.low;
}

export function stepRayo(w: Wolf, targets: WolfTarget[], terrain: Terrain, dt: number, rng: () => number): string | null {
  const ground = terrain.heightAt(w.x, w.z);
  if (w.hp <= 0) {
    w.deadFor += dt;
    w.anim = 'dead';
    w.y = Math.max(ground, w.y - RAYO.drop * dt);
    return null;
  }
  if ((w.grounded ?? 0) > 0) {
    w.grounded = Math.max(0, w.grounded! - dt);
    w.y = ground;
    w.anim = 'idle';
    w.dive = undefined;
    if (w.grounded <= EPS) {
      w.grounded = 0;
      w.dive = 'climb';
    }
    return null;
  }
  w.cooldown = Math.max(0, w.cooldown - dt);
  const alive = targets.filter((t) => !t.dead);
  const byName = alive.find((t) => t.name === w.target);
  const move = (tx: number, tz: number, speed: number, stopAt = 0): number => {
    const dx = tx - w.x;
    const dz = tz - w.z;
    const d = Math.hypot(dx, dz);
    if (d > EPS) w.yaw = Math.atan2(dx, dz);
    const step = Math.min(speed * dt, Math.max(0, d - stopAt));
    if (d > EPS && step > 0) {
      const to = clampMap(w.x + (dx / d) * step, w.z + (dz / d) * step, 4);
      w.x = to.x;
      w.z = to.z;
    }
    return Math.hypot(tx - w.x, tz - w.z);
  };
  const g = () => terrain.heightAt(w.x, w.z);

  if (w.dive === 'tell') {
    w.anim = 'attack';
    w.diveT = (w.diveT ?? 0) - dt;
    if (byName) {
      w.diveX = byName.x;
      w.diveZ = byName.z;
    }
    if (w.diveT <= EPS) {
      w.dive = 'dive';
      w.diveT = RAYO.diveMax;
      w.anim = 'run';
    }
    return null;
  }
  if (w.dive === 'dive') {
    w.anim = 'run';
    w.diveT = (w.diveT ?? 0) - dt;
    const d = move(w.diveX ?? w.x, w.diveZ ?? w.z, RAYO.dive);
    w.y = Math.max(g() + 0.8, w.y - RAYO.drop * dt);
    const victim = alive.find((t) => Math.hypot(t.x - w.x, t.z - w.z) <= RAYO.reach);
    if (victim && rayoLow(w, g())) {
      w.dive = 'climb';
      w.cooldown = RAYO.every;
      return victim.name;
    }
    if (w.diveT <= EPS || (d < 0.2 && rayoLow(w, g()))) {
      w.dive = 'climb';
      w.cooldown = RAYO.every;
    }
    return null;
  }
  if (w.dive === 'climb') {
    w.anim = 'walk';
    w.y = Math.min(g() + RAYO.fly, w.y + RAYO.climb * dt);
    if (w.y >= g() + RAYO.fly - EPS) w.dive = undefined;
    return null;
  }

  let target = byName && Math.hypot(byName.x - w.x, byName.z - w.z) < WOLF.giveUp ? byName : undefined;
  if (!target) {
    let best: number = RAYO.sight;
    for (const t of alive) {
      const d = Math.hypot(t.x - w.x, t.z - w.z);
      if (d < best) {
        best = d;
        target = t;
      }
    }
  }
  w.target = target?.name ?? null;
  if (target) {
    const d = move(target.x, target.z, RAYO.speed, RAYO.keep);
    w.anim = 'run';
    if (w.cooldown <= EPS && d < RAYO.sight) {
      w.dive = 'tell';
      w.diveT = RAYO.tell;
      w.diveX = target.x;
      w.diveZ = target.z;
      w.anim = 'attack';
    }
  } else {
    w.wander += (rng() - 0.5) * dt * 1.5;
    move(w.x + Math.sin(w.wander) * 10, w.z + Math.cos(w.wander) * 10, WOLF.walk);
    w.anim = 'walk';
  }
  w.y = g() + RAYO.fly;
  return null;
}
