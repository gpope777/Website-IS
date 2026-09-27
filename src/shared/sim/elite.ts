import { DUNGEON } from '../dungeon';
import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * The mini-boss before the Tragón (spec §7): a reinforced bruto marchito. It chases and bites like a
 * brute, and from mid range it crouches (a long, readable wind-up) and charges in a straight line.
 * Roll through the charge, or step aside.
 */
export const ELITE = { id: 900_001, windup: 1.1, chargeSpeed: 13, chargeFor: 0.9, chargeDamage: 30, chargeHit: 1.8, chargeMin: 5, chargeMax: 14, chargeCooldown: 5, corpseTime: 4 } as const;

export interface Elite extends Wolf {
  /** Seconds left crouching before the charge (the telegraph). */
  windup: number;
  /** Seconds left charging. */
  charge: number;
  /** Locked charge direction. */
  dirX: number;
  dirZ: number;
  /** Seconds until it may charge again. */
  chargeReady: number;
  /** This charge already hit someone. */
  landed: boolean;
}

export type EliteHit = { name: string; dmg: number } | null;

export function createElite(): Elite {
  return {
    id: ELITE.id, x: DUNGEON.x, y: DUNGEON.floor, z: DUNGEON.eliteZ, yaw: Math.PI, hp: ENEMY.elite.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'elite', stun: 0, windup: 0, charge: 0, dirX: 0, dirZ: -1, chargeReady: 2, landed: false,
  };
}

const clampRoom = (e: Elite) => {
  e.x = Math.max(DUNGEON.x - DUNGEON.halfW + 1.5, Math.min(DUNGEON.x + DUNGEON.halfW - 1.5, e.x));
  e.z = Math.max(DUNGEON.eliteRoomZ + 1.5, Math.min(DUNGEON.bossRoomZ - 1.5, e.z));
};

/** One tick. Returns who it hit (bite or charge) and how hard. */
export function stepElite(e: Elite, targets: readonly WolfTarget[], dt: number): EliteHit {
  if (e.hp <= 0) {
    e.deadFor += dt;
    e.anim = 'dead';
    return null;
  }
  const def = ENEMY.elite;
  e.cooldown = Math.max(0, e.cooldown - dt);
  e.chargeReady = Math.max(0, e.chargeReady - dt);
  if (e.stun > 0) {
    e.stun = Math.max(0, e.stun - dt);
    e.windup = 0;
    e.charge = 0;
    e.anim = 'idle';
    return null;
  }
  const alive = targets.filter((t) => !t.dead);
  if (e.charge > 0) {
    e.charge = Math.max(0, e.charge - dt);
    e.x += e.dirX * ELITE.chargeSpeed * dt;
    e.z += e.dirZ * ELITE.chargeSpeed * dt;
    clampRoom(e);
    e.anim = 'run';
    if (e.charge === 0) e.chargeReady = ELITE.chargeCooldown;
    if (e.landed) return null;
    const hit = alive.find((t) => Math.hypot(t.x - e.x, t.z - e.z) <= ELITE.chargeHit);
    if (!hit) return null;
    e.landed = true;
    return { name: hit.name, dmg: ELITE.chargeDamage };
  }
  let target: WolfTarget | null = null;
  let best = Infinity;
  for (const t of alive) {
    const d = Math.hypot(t.x - e.x, t.z - e.z);
    if (d < best) {
      best = d;
      target = t;
    }
  }
  e.target = target?.name ?? null;
  if (e.windup > 0) {
    e.windup = Math.max(0, e.windup - dt);
    e.anim = 'attack';
    if (e.windup > 1e-9) return null;
    e.windup = 0;
    e.charge = ELITE.chargeFor;
    e.landed = false;
    return null;
  }
  if (!target) {
    e.anim = 'idle';
    return null;
  }
  const dx = (target.x - e.x) / Math.max(best, 1e-4);
  const dz = (target.z - e.z) / Math.max(best, 1e-4);
  e.yaw = Math.atan2(dx, dz);
  if (best >= ELITE.chargeMin && best <= ELITE.chargeMax && e.chargeReady === 0) {
    e.windup = ELITE.windup;
    e.dirX = dx;
    e.dirZ = dz;
    e.anim = 'attack';
    return null;
  }
  if (best > def.reach) {
    e.x += dx * def.run * dt;
    e.z += dz * def.run * dt;
    clampRoom(e);
    e.anim = 'run';
    return null;
  }
  e.anim = 'attack';
  if (e.cooldown > 0) return null;
  e.cooldown = def.biteCooldown;
  return { name: target.name, dmg: def.damage };
}
