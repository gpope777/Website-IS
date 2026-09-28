import { MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { PIEDRA } from '../piedra';
import type { WolfAnim } from '../protocol';
import { ENEMY, hitWolf, type Wolf, type WolfTarget } from './wolves';

/**
 * El Cucurucho, the mountain Raíz-madre's boss (spec S4 §11.3). Its cone hat is armour from the front.
 * It lowers the cone and charges in a straight line; a Piedra pillar in its path sticks the hat (5 s, full
 * damage). Every 15 s it stamps and boulders fall on marked circles; a pillar under a circle blocks it.
 */
export const CUCURUCHO = {
  id: 900_007,
  z: M.bossRoomZ + 22,
  body: 1.5,
  /** Hits from its front half do this share while the hat is up. */
  frontMult: 0.25,
  windup: 1,
  chargeSpeed: 14,
  chargeFor: 1.3,
  chargeDamage: 25,
  chargeHit: 1.8,
  chargeMin: 5,
  chargeMax: 18,
  chargeCooldown: 4,
  /** A live pillar this close to its body while charging sticks the hat. */
  pillarR: PIEDRA.chargeR + PIEDRA.half,
  stuckFor: 5,
  parryFor: 3,
  aludFirst: 8,
  aludEvery: 15,
  aludWarn: 1,
  aludR: 1.5,
  aludDamage: 15,
  /** A pillar's centre this close to a circle blocks that boulder. */
  aludBlock: 2.5,
  aludSpots: [
    { x: -6, z: M.bossRoomZ + 8 },
    { x: 6, z: M.bossRoomZ + 8 },
    { x: -6, z: M.bossRoomZ + 22 },
    { x: 6, z: M.bossRoomZ + 22 },
  ],
  corpseTime: 4,
} as const;

export interface Cucurucho extends Wolf {
  windup: number;
  charge: number;
  dirX: number;
  dirZ: number;
  chargeReady: number;
  landed: boolean;
  /** Seconds the hat stays stuck/raised: full damage from any side, harmless. */
  exposed: number;
  /** Seconds until the next stamp. */
  aludIn: number;
  /** Circles marked for falling boulders, and seconds until they land. */
  alud: { x: number; z: number }[];
  aludLeft: number;
}

type P = { x: number; z: number };

export function createCucurucho(): Cucurucho {
  return {
    id: CUCURUCHO.id, x: M.x, y: M.floor, z: CUCURUCHO.z, yaw: Math.PI, hp: ENEMY.boss4.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'boss4', stun: 0, windup: 0, charge: 0, dirX: 0, dirZ: -1, chargeReady: 2, landed: false,
    exposed: 0, aludIn: CUCURUCHO.aludFirst, alud: [], aludLeft: 0,
  };
}

/** A hit from (x, z) meets the hat: from its front half while the hat is up. */
export function hatFront(b: Cucurucho, x: number, z: number): boolean {
  if (b.exposed > 0) return false;
  return (x - b.x) * Math.sin(b.yaw) + (z - b.z) * Math.cos(b.yaw) > 0;
}

/** The hat sticks (a pillar) or lifts (a parry): stopped, harmless and open for `secs`. */
export function stickCucurucho(b: Cucurucho, secs: number): void {
  b.stun = Math.max(b.stun, secs);
  b.exposed = Math.max(b.exposed, secs);
  b.charge = 0;
  b.windup = 0;
}

/** Keeps it in the room; true when it had to be pushed back (it met a wall). */
function clampRoom(b: Cucurucho): boolean {
  const r = CUCURUCHO.body;
  const x = Math.max(M.x - M.halfW + r, Math.min(M.x + M.halfW - r, b.x));
  const z = Math.max(M.bossRoomZ + r, Math.min(M.z1 - r, b.z));
  const hit = x !== b.x || z !== b.z;
  b.x = x;
  b.z = z;
  return hit;
}

/**
 * One tick. `pillars`: centres of live Piedra pillars. Returns everyone it hit (the caller resolves dodges
 * and parries) and whether a pillar stuck its hat this tick.
 */
export function stepCucurucho(b: Cucurucho, targets: readonly WolfTarget[], pillars: readonly P[], dt: number): { hits: { name: string; dmg: number; charge: boolean }[]; stuck: boolean } {
  const out = { hits: [] as { name: string; dmg: number; charge: boolean }[], stuck: false };
  if (b.hp <= 0) {
    b.deadFor += dt;
    b.anim = 'dead';
    return out;
  }
  const C = CUCURUCHO;
  b.cooldown = Math.max(0, b.cooldown - dt);
  b.chargeReady = Math.max(0, b.chargeReady - dt);
  b.exposed = Math.max(0, b.exposed - dt);
  const alive = targets.filter((t) => !t.dead);
  // Falling boulders land on their own time, whatever it is doing.
  if (b.alud.length) {
    b.aludLeft = Math.max(0, b.aludLeft - dt);
    if (b.aludLeft <= 1e-9) {
      for (const c of b.alud) {
        if (pillars.some((p) => Math.hypot(p.x - c.x, p.z - c.z) <= C.aludBlock)) continue;
        for (const t of alive) if (Math.hypot(t.x - c.x, t.z - c.z) <= C.aludR) out.hits.push({ name: t.name, dmg: C.aludDamage, charge: false });
      }
      b.alud = [];
    }
  }
  if (b.stun > 0) {
    b.stun = Math.max(0, b.stun - dt);
    b.windup = 0;
    b.charge = 0;
    b.anim = 'idle';
    return out;
  }
  if (b.charge > 0) {
    b.charge = Math.max(0, b.charge - dt);
    b.x += b.dirX * C.chargeSpeed * dt;
    b.z += b.dirZ * C.chargeSpeed * dt;
    if (pillars.some((p) => Math.hypot(p.x - b.x, p.z - b.z) <= C.pillarR)) {
      stickCucurucho(b, C.stuckFor);
      b.chargeReady = C.chargeCooldown;
      b.anim = 'idle';
      out.stuck = true;
      return out;
    }
    if (clampRoom(b)) b.charge = 0; // the wall just stops it
    b.anim = 'run';
    if (b.charge === 0) b.chargeReady = C.chargeCooldown;
    if (!b.landed) {
      const hit = alive.find((t) => Math.hypot(t.x - b.x, t.z - b.z) <= C.chargeHit);
      if (hit) {
        b.landed = true;
        out.hits.push({ name: hit.name, dmg: C.chargeDamage, charge: true });
      }
    }
    return out;
  }
  if (b.windup > 0) {
    b.windup = Math.max(0, b.windup - dt);
    b.anim = 'attack';
    if (b.windup <= 1e-9) {
      b.windup = 0;
      b.charge = C.chargeFor;
      b.landed = false;
    }
    return out;
  }
  if (!alive.length) {
    b.anim = 'idle';
    return out;
  }
  b.aludIn = Math.max(0, b.aludIn - dt);
  if (b.aludIn <= 1e-9 && !b.alud.length) {
    const marks: P[] = alive.slice(0, 4).map((t) => ({ x: t.x, z: t.z }));
    for (const s of C.aludSpots) if (marks.length < 4) marks.push({ x: M.x + s.x, z: s.z });
    b.alud = marks;
    b.aludLeft = C.aludWarn;
    b.aludIn = C.aludEvery;
    b.anim = 'attack';
    return out;
  }
  let target: WolfTarget | null = null;
  let best = Infinity;
  for (const t of alive) {
    const d = Math.hypot(t.x - b.x, t.z - b.z);
    if (d < best) {
      best = d;
      target = t;
    }
  }
  b.target = target!.name;
  const dx = (target!.x - b.x) / Math.max(best, 1e-4);
  const dz = (target!.z - b.z) / Math.max(best, 1e-4);
  b.yaw = Math.atan2(dx, dz);
  if (b.alud.length) {
    b.anim = 'idle'; // stamping: it stands while the boulders fall
    return out;
  }
  if (best >= C.chargeMin && best <= C.chargeMax && b.chargeReady === 0) {
    b.windup = C.windup;
    b.dirX = dx;
    b.dirZ = dz;
    b.anim = 'attack';
    return out;
  }
  const def = ENEMY.boss4;
  if (best > def.reach) {
    b.x += dx * def.run * dt;
    b.z += dz * def.run * dt;
    clampRoom(b);
    b.anim = 'run';
    return out;
  }
  b.anim = 'attack';
  if (b.cooldown > 0) return out;
  b.cooldown = def.biteCooldown;
  out.hits.push({ name: target!.name, dmg: def.damage, charge: false });
  return out;
}

/** The white Cucurucho's atalaya by the Heart (spec S4 §11.3): at night, every 6 s, a stone at the nearest raider within 20 m. It cannot die. */
export const ATALAYA = { every: 6, range: 20, damage: 8, home: 6, height: 5, show: 0.8 } as const;

export interface Atalaya {
  x: number;
  y: number;
  z: number;
  yaw: number;
  cooldown: number;
  show: number;
  anim: WolfAnim;
}

/** 6 m on the Heart's −x side (the farol hangs on +z, the Antenón keeps its own spot). */
export function createAtalaya(heart: P, heightAt: (x: number, z: number) => number): Atalaya {
  const x = heart.x - ATALAYA.home;
  return { x, y: heightAt(x, heart.z), z: heart.z, yaw: 0, cooldown: 0, show: 0, anim: 'idle' };
}

/** One tick. At night, throws at the nearest living raider in range; returns it (already hurt), or null. */
export function stepAtalaya(a: Atalaya, foes: readonly Wolf[], night: boolean, dt: number): Wolf | null {
  a.cooldown = Math.max(0, a.cooldown - dt);
  a.show = Math.max(0, a.show - dt);
  a.anim = a.show > 0 ? 'attack' : 'idle';
  if (!night || a.cooldown > 0) return null;
  let target: Wolf | null = null;
  let best: number = ATALAYA.range;
  for (const w of foes) {
    if (!w.raid || w.hp <= 0) continue;
    const d = Math.hypot(w.x - a.x, w.z - a.z);
    if (d <= best) {
      best = d;
      target = w;
    }
  }
  if (!target) return null;
  a.yaw = Math.atan2(target.x - a.x, target.z - a.z);
  hitWolf(target, ATALAYA.damage);
  a.cooldown = ATALAYA.every;
  a.show = ATALAYA.show;
  a.anim = 'attack';
  return target;
}
