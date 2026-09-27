import { SWAMP_DUNGEON as S } from '../swamp-dungeon';
import type { WolfAnim } from '../protocol';
import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * El Zancudo, the swamp Raíz-madre's boss (spec S3 §10.3). It hovers out of reach and drifts from gas vent
 * to gas vent; a Llamarada on the vent under it drops it (exposed 5 s), and so does a parried dive (3 s).
 * It dives on a shadow (roll) and a dive that lands latches on and drains until you roll.
 */
export const ZANCUDO = {
  id: 900_005,
  hover: 4,
  body: 1.2,
  driftEvery: 6,
  speed: 3,
  /** Its body this close to a vent's centre counts as "over it". */
  overVent: 1.5,
  ventFall: 5,
  parryFall: 3,
  diveWindup: 1,
  diveRange: 16,
  diveHit: 1.8,
  diveDamage: 14,
  diveCooldown: 8,
  latchDps: 5,
  latchMax: 3,
  /** Arrows, gusts and flames do this much while it flies; punches do nothing. */
  airMult: 0.5,
  corpseTime: 4,
} as const;

export interface Zancudo extends Wolf {
  /** The vent it drifts to (index in SWAMP_DUNGEON.vents). */
  vent: number;
  /** Seconds until it drifts on. */
  drift: number;
  /** Seconds left on the floor (hurtable in full, harmless). */
  grounded: number;
  /** Seconds left in the dive's wind-up. */
  windup: number;
  /** Where the dive will land (fixed when the wind-up starts). */
  shadow: { x: number; z: number } | null;
  diveReady: number;
  /** Who it clings to, and for how long more. */
  latch: string | null;
  latchLeft: number;
}

function clampRoom(x: number, z: number): { x: number; z: number } {
  const b = ZANCUDO.body;
  return { x: Math.max(S.x - S.halfW + b, Math.min(S.x + S.halfW - b, x)), z: Math.max(S.bossRoomZ + b, Math.min(S.z1 - b, z)) };
}

export function createZancudo(): Zancudo {
  const v = S.vents[0];
  return {
    id: ZANCUDO.id, x: S.x + v.x, y: S.floor + ZANCUDO.hover, z: v.z, yaw: Math.PI, hp: ENEMY.boss3.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'boss3', stun: 0, vent: 0, drift: ZANCUDO.driftEvery, grounded: 0, windup: 0, shadow: null,
    diveReady: 3, latch: null, latchLeft: 0,
  };
}

/** Knock it to the floor for `secs` (a lit vent, a parried dive): the dive is off and it lets go. */
export function groundZancudo(b: Zancudo, secs: number): void {
  b.grounded = Math.max(b.grounded, secs);
  b.windup = 0;
  b.shadow = null;
  b.latch = null;
  b.latchLeft = 0;
  b.y = S.floor;
}

/** Its body over the vent at index i? */
export function overVent(b: Zancudo, i: number): boolean {
  const v = S.vents[i];
  return !!v && Math.hypot(b.x - (S.x + v.x), b.z - v.z) <= ZANCUDO.overVent;
}

/**
 * One tick. `hits`: everyone the dive landed on (the caller resolves dodges and parries, and latches
 * the first one that sticks). `drain`: the latch's bite this tick.
 */
export function stepZancudo(b: Zancudo, targets: readonly WolfTarget[], dt: number): { hits: { name: string; dmg: number }[]; drain: { name: string; dmg: number } | null } {
  const none = { hits: [], drain: null };
  if (b.hp <= 0) {
    b.deadFor += dt;
    b.anim = 'dead';
    b.y = S.floor;
    return none;
  }
  b.diveReady = Math.max(0, b.diveReady - dt);
  b.drift -= dt;
  const alive = targets.filter((t) => !t.dead);
  let drain: { name: string; dmg: number } | null = null;
  if (b.latch) {
    const t = alive.find((a) => a.name === b.latch);
    const secs = Math.min(dt, b.latchLeft);
    b.latchLeft = Math.max(0, b.latchLeft - dt);
    if (t && secs > 0) {
      drain = { name: t.name, dmg: ZANCUDO.latchDps * secs };
      b.x = t.x;
      b.z = t.z;
      b.y = S.floor + 1;
      b.anim = 'attack';
    }
    if (!t || b.latchLeft <= 0) b.latch = null;
    if (b.latch) return { hits: [], drain };
  }
  if (b.grounded > 0) {
    b.grounded = Math.max(0, b.grounded - dt);
    b.y = S.floor;
    b.anim = 'idle';
    if (b.grounded > 0) return { hits: [], drain };
  }
  if (b.windup > 0) {
    b.windup = Math.max(0, b.windup - dt);
    b.anim = 'attack';
    if (b.windup > 1e-9 || !b.shadow) return { hits: [], drain };
    const s = b.shadow;
    b.x = s.x;
    b.z = s.z;
    b.shadow = null;
    b.diveReady = ZANCUDO.diveCooldown;
    b.y = S.floor + 1;
    return { hits: alive.filter((t) => Math.hypot(t.x - s.x, t.z - s.z) <= ZANCUDO.diveHit).map((t) => ({ name: t.name, dmg: ZANCUDO.diveDamage })), drain };
  }
  b.y = Math.min(S.floor + ZANCUDO.hover, b.y + 6 * dt);
  if (b.drift <= 0) {
    b.vent = (b.vent + 1) % S.vents.length;
    b.drift = ZANCUDO.driftEvery;
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
  b.target = target?.name ?? null;
  if (target && best <= ZANCUDO.diveRange && b.diveReady === 0) {
    b.windup = ZANCUDO.diveWindup;
    b.shadow = clampRoom(target.x, target.z);
    b.yaw = Math.atan2(target.x - b.x, target.z - b.z);
    b.anim = 'attack';
    return { hits: [], drain };
  }
  const v = S.vents[b.vent]!;
  const dx = S.x + v.x - b.x;
  const dz = v.z - b.z;
  const d = Math.hypot(dx, dz);
  const step = Math.min(d, ZANCUDO.speed * dt);
  if (d > 1e-4) {
    b.x += (dx / d) * step;
    b.z += (dz / d) * step;
  }
  b.anim = d > 0.1 ? 'run' : 'idle';
  return { hits: [], drain };
}

/** The white Zancudo's farol by the Heart (spec S3 §10.3): at night, every 10 s, wolves near the Heart run 3 s. It cannot die. */
export const FAROL = { every: 10, guard: 12, flee: 3, home: 2.5, show: 0.8 } as const;

export interface Farol {
  x: number;
  y: number;
  z: number;
  yaw: number;
  cooldown: number;
  /** Seconds left showing the flare. */
  show: number;
  anim: WolfAnim;
}

export function createFarol(heart: { x: number; z: number }, heightAt: (x: number, z: number) => number): Farol {
  const z = heart.z + FAROL.home;
  return { x: heart.x, y: heightAt(heart.x, z), z, yaw: 0, cooldown: 0, show: 0, anim: 'idle' };
}

/** One tick. At night, sends every wolf within `guard` of the Heart running from it; returns how many. */
export function stepFarol(a: Farol, heart: { x: number; z: number }, foes: readonly Wolf[], night: boolean, dt: number): number {
  a.cooldown = Math.max(0, a.cooldown - dt);
  a.show = Math.max(0, a.show - dt);
  a.anim = a.show > 0 ? 'attack' : 'idle';
  if (!night || a.cooldown > 0) return 0;
  const near = foes.filter((w) => w.kind === 'wolf' && w.hp > 0 && Math.hypot(w.x - heart.x, w.z - heart.z) <= FAROL.guard);
  if (!near.length) return 0;
  for (const w of near) {
    w.flee = Math.max(w.flee ?? 0, FAROL.flee);
    w.fleeFrom = { x: heart.x, z: heart.z };
  }
  a.cooldown = FAROL.every;
  a.show = FAROL.show;
  a.anim = 'attack';
  return near.length;
}
