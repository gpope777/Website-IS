import { DUNGEON } from '../dungeon';
import { COAST_DUNGEON } from '../coast-dungeon';
import { SWAMP_DUNGEON } from '../swamp-dungeon';
import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * The mini-boss before the Tragón (spec §7): a reinforced bruto marchito. It chases and bites like a
 * brute, and from mid range it crouches (a long, readable wind-up) and charges in a straight line.
 * Roll through the charge, or step aside.
 */
export const ELITE = { id: 900_001, shieldId: 900_002, peatId: 900_004, exposedFor: 3, windup: 1.1, chargeSpeed: 13, chargeFor: 0.9, chargeDamage: 30, chargeHit: 1.8, chargeMin: 5, chargeMax: 14, chargeCooldown: 5, corpseTime: 4 } as const;

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
  /** Its room: centre line x, half width, z span. */
  box: { x: number; halfW: number; z0: number; z1: number };
  /** Seconds its back is turned (the bruto escudado only: its shield covers the front otherwise). */
  exposed: number;
}

export type EliteHit = { name: string; dmg: number } | null;

export function createElite(): Elite {
  return {
    id: ELITE.id, x: DUNGEON.x, y: DUNGEON.floor, z: DUNGEON.eliteZ, yaw: Math.PI, hp: ENEMY.elite.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'elite', stun: 0, windup: 0, charge: 0, dirX: 0, dirZ: -1, chargeReady: 2, landed: false,
    box: { x: DUNGEON.x, halfW: DUNGEON.halfW, z0: DUNGEON.eliteRoomZ, z1: DUNGEON.bossRoomZ }, exposed: 0,
  };
}

/** The coast dungeon's mini-boss: the same brute with a front shield (spec §7.2). */
export function createShielded(): Elite {
  const C = COAST_DUNGEON;
  return { ...createElite(), id: ELITE.shieldId, kind: 'elite2', x: C.x, y: C.floor, z: C.eliteZ, box: { x: C.x, halfW: C.halfW, z0: C.eliteRoomZ, z1: C.bossRoomZ } };
}

/** The swamp dungeon's mini-boss: the same brute, peat-soaked; it regrows in its room's mud pools (spec S3 §10.2). */
export function createPeat(): Elite {
  const S = SWAMP_DUNGEON;
  return { ...createElite(), id: ELITE.peatId, kind: 'elite3', hp: ENEMY.elite3.hp, x: S.x, y: S.floor, z: S.eliteZ, box: { x: S.x, halfW: S.halfW, z0: S.eliteRoomZ, z1: S.bossRoomZ } };
}

/** Whether a hit from (x, z) lands on its shield: from its front half, while not exposed. */
export function shieldBlocks(e: Elite, x: number, z: number): boolean {
  if (e.kind !== 'elite2' || e.exposed > 0) return false;
  return (x - e.x) * Math.sin(e.yaw) + (z - e.z) * Math.cos(e.yaw) > 0;
}

const clampRoom = (e: Elite) => {
  const b = e.box;
  e.x = Math.max(b.x - b.halfW + 1.5, Math.min(b.x + b.halfW - 1.5, e.x));
  e.z = Math.max(b.z0 + 1.5, Math.min(b.z1 - 1.5, e.z));
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
  e.exposed = Math.max(0, e.exposed - dt);
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
