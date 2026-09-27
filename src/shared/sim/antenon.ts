import { COAST_DUNGEON, outOfPillars } from '../coast-dungeon';
import type { Dir } from '../viento';
import { clampMap } from '../terrain';
import type { WolfAnim } from '../protocol';
import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * El Antenón, the coast Raíz-madre's boss (spec §7.3). Its "cáscara de marea" shrugs off blows until
 * it is exposed: pushed by a gust into a coral pillar (5 s) or parried (3 s). It sweeps its antennae
 * around it (roll) and charges in a straight line from mid range (step aside).
 */
export const ANTENON = {
  id: 900_003,
  /** Body radius against pillars and walls. */
  body: 1.3,
  slamFor: 5,
  parryFor: 3,
  slamStun: 1,
  sweepWindup: 0.8,
  sweepRadius: 4,
  sweepDamage: 10,
  sweepCooldown: 3.5,
  chargeWindup: 1,
  chargeSpeed: 12,
  chargeFor: 0.8,
  chargeDamage: 14,
  chargeHit: 1.8,
  chargeMin: 5,
  chargeMax: 14,
  chargeCooldown: 5,
  corpseTime: 4,
  /** Push step when a gust moves it (checks pillars on the way). */
  pushStep: 0.25,
} as const;

export type AntenonMove = 'sweep' | 'charge' | null;

export interface Antenon extends Wolf {
  /** Seconds left it can be hurt. */
  exposed: number;
  /** Seconds left in the current wind-up (the telegraph). */
  windup: number;
  /** The attack being wound up or under way. */
  move: AntenonMove;
  /** Seconds left dashing. */
  dash: number;
  dirX: number;
  dirZ: number;
  sweepReady: number;
  chargeReady: number;
  /** Who this charge already hit. */
  hit: string[];
}

export function createAntenon(): Antenon {
  const C = COAST_DUNGEON;
  return {
    id: ANTENON.id, x: C.x, y: C.floor, z: C.bossRoomZ + 22, yaw: Math.PI, hp: ENEMY.boss2.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'boss2', stun: 0, exposed: 0, windup: 0, move: null, dash: 0, dirX: 0, dirZ: -1,
    sweepReady: 1, chargeReady: 2, hit: [],
  };
}

function hitsPillar(x: number, z: number): boolean {
  const C = COAST_DUNGEON;
  return C.pillars.some((p) => Math.hypot(x - (C.x + p.x), z - p.z) < C.pillarR + ANTENON.body);
}

function clampRoom(a: Antenon): void {
  const C = COAST_DUNGEON;
  const b = ANTENON.body;
  a.x = Math.max(C.x - C.halfW + b, Math.min(C.x + C.halfW - b, a.x));
  a.z = Math.max(C.bossRoomZ + b, Math.min(C.z1 - b, a.z));
  const o = outOfPillars(a.x, a.z, ANTENON.body);
  a.x = o.x;
  a.z = o.z;
}

/** Move it up to `dist` along `dir` (a gust). Stops against a pillar: returns true when it slams into one. */
export function pushAntenon(a: Antenon, dir: Dir, dist: number): boolean {
  for (let moved = 0; moved < dist - 1e-9; moved += ANTENON.pushStep) {
    const s = Math.min(ANTENON.pushStep, dist - moved);
    const nx = a.x + dir.x * s;
    const nz = a.z + dir.z * s;
    if (hitsPillar(nx, nz)) return true;
    a.x = nx;
    a.z = nz;
    clampRoom(a);
  }
  return false;
}

/** One tick. Returns everyone it hit and how hard (the caller resolves dodges and parries). */
export function stepAntenon(a: Antenon, targets: readonly WolfTarget[], dt: number): { name: string; dmg: number }[] {
  if (a.hp <= 0) {
    a.deadFor += dt;
    a.anim = 'dead';
    return [];
  }
  a.exposed = Math.max(0, a.exposed - dt);
  a.sweepReady = Math.max(0, a.sweepReady - dt);
  a.chargeReady = Math.max(0, a.chargeReady - dt);
  if (a.stun > 0) {
    a.stun = Math.max(0, a.stun - dt);
    a.windup = 0;
    a.dash = 0;
    a.move = null;
    a.anim = 'idle';
    return [];
  }
  const alive = targets.filter((t) => !t.dead);
  if (a.dash > 0) {
    a.dash = Math.max(0, a.dash - dt);
    const nx = a.x + a.dirX * ANTENON.chargeSpeed * dt;
    const nz = a.z + a.dirZ * ANTENON.chargeSpeed * dt;
    if (hitsPillar(nx, nz)) a.dash = 0;
    else {
      a.x = nx;
      a.z = nz;
      clampRoom(a);
    }
    a.anim = 'run';
    const out: { name: string; dmg: number }[] = [];
    for (const t of alive) {
      if (a.hit.includes(t.name) || Math.hypot(t.x - a.x, t.z - a.z) > ANTENON.chargeHit) continue;
      a.hit.push(t.name);
      out.push({ name: t.name, dmg: ANTENON.chargeDamage });
    }
    if (a.dash === 0) a.move = null;
    return out;
  }
  if (a.windup > 0) {
    a.windup = Math.max(0, a.windup - dt);
    a.anim = 'attack';
    if (a.windup > 1e-9) return [];
    if (a.move === 'charge') {
      a.dash = ANTENON.chargeFor;
      a.hit = [];
      return [];
    }
    a.move = null;
    return alive.filter((t) => Math.hypot(t.x - a.x, t.z - a.z) <= ANTENON.sweepRadius).map((t) => ({ name: t.name, dmg: ANTENON.sweepDamage }));
  }
  let target: WolfTarget | null = null;
  let best = Infinity;
  for (const t of alive) {
    const d = Math.hypot(t.x - a.x, t.z - a.z);
    if (d < best) {
      best = d;
      target = t;
    }
  }
  a.target = target?.name ?? null;
  if (!target) {
    a.anim = 'idle';
    return [];
  }
  const dx = (target.x - a.x) / Math.max(best, 1e-4);
  const dz = (target.z - a.z) / Math.max(best, 1e-4);
  a.yaw = Math.atan2(dx, dz);
  if (best <= ANTENON.sweepRadius - 0.5) {
    if (a.sweepReady === 0) {
      a.move = 'sweep';
      a.windup = ANTENON.sweepWindup;
      a.sweepReady = ANTENON.sweepCooldown + ANTENON.sweepWindup;
      a.anim = 'attack';
    } else a.anim = 'idle';
    return [];
  }
  if (best >= ANTENON.chargeMin && best <= ANTENON.chargeMax && a.chargeReady === 0) {
    a.move = 'charge';
    a.windup = ANTENON.chargeWindup;
    a.dirX = dx;
    a.dirZ = dz;
    a.chargeReady = ANTENON.chargeCooldown + ANTENON.chargeWindup;
    a.anim = 'attack';
    return [];
  }
  a.x += dx * ENEMY.boss2.run * dt;
  a.z += dz * ENEMY.boss2.run * dt;
  clampRoom(a);
  a.anim = 'run';
  return [];
}

/** The purified Antenón by the Heart (spec §7.3): every 8 s it gusts the raiders near the Heart away. It cannot die. */
export const ANTENON_ALLY = { every: 8, guard: 12, push: 6, stun: 1, home: 2.5, show: 0.6 } as const;

export interface GustAlly {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Seconds until it can gust again. */
  cooldown: number;
  /** Seconds left showing the gust. */
  show: number;
  anim: WolfAnim;
}

export function createGustAlly(heart: { x: number; z: number }, heightAt: (x: number, z: number) => number): GustAlly {
  const x = heart.x - ANTENON_ALLY.home;
  return { x, y: heightAt(x, heart.z), z: heart.z, yaw: 0, cooldown: 0, show: 0, anim: 'idle' };
}

/** One tick. Pushes every raider within `guard` of the Heart `push` metres straight away from it; returns how many. */
export function stepGustAlly(a: GustAlly, heart: { x: number; z: number }, foes: readonly Wolf[], heightAt: (x: number, z: number) => number, dt: number): number {
  a.cooldown = Math.max(0, a.cooldown - dt);
  a.show = Math.max(0, a.show - dt);
  a.anim = a.show > 0 ? 'attack' : 'idle';
  if (a.cooldown > 0) return 0;
  const near = foes.filter((w) => w.raid && w.hp > 0 && Math.hypot(w.x - heart.x, w.z - heart.z) <= ANTENON_ALLY.guard);
  if (!near.length) return 0;
  for (const w of near) {
    const d = Math.hypot(w.x - heart.x, w.z - heart.z);
    const ux = d < 1e-4 ? 1 : (w.x - heart.x) / d;
    const uz = d < 1e-4 ? 0 : (w.z - heart.z) / d;
    const to = clampMap(w.x + ux * ANTENON_ALLY.push, w.z + uz * ANTENON_ALLY.push, 3);
    w.x = to.x;
    w.z = to.z;
    w.y = heightAt(w.x, w.z);
    w.stun = Math.max(w.stun, ANTENON_ALLY.stun);
  }
  a.yaw = Math.atan2(near[0]!.x - a.x, near[0]!.z - a.z);
  a.cooldown = ANTENON_ALLY.every;
  a.show = ANTENON_ALLY.show;
  a.anim = 'attack';
  return near.length;
}
