import { DUNGEON } from '../dungeon';
import { ENEMY, type Wolf, type WolfTarget } from './wolves';

/**
 * El Tragón de Papel, the Raíz-madre's boss (spec §5: bosses are puzzles). Its folded paper
 * shrugs off blows: it can only be hurt while `weak` (after a parry or tangled by Enredadera).
 */
export const BOSS = { id: 0, windup: 0.7, weakFor: 4, rootFor: 5, rootRadius: 4, corpseTime: 4 } as const;

export interface Boss extends Wolf {
  /** Seconds left it can be hurt. */
  weak: number;
  /** Seconds left tangled by Enredadera: no moving, no biting. */
  rooted: number;
  /** Seconds left in the telegraphed bite. */
  windup: number;
}

export function createBoss(): Boss {
  return {
    id: BOSS.id, x: DUNGEON.x, y: DUNGEON.floor, z: DUNGEON.bossZ, yaw: Math.PI, hp: ENEMY.boss.hp, target: null, cooldown: 0, deadFor: 0,
    wander: 0, anim: 'idle', raid: false, kind: 'boss', stun: 0, weak: 0, rooted: 0, windup: 0,
  };
}

/** One tick. Returns the name it bit, if any. */
export function stepBoss(b: Boss, targets: readonly WolfTarget[], dt: number): string | null {
  if (b.hp <= 0) {
    b.deadFor += dt;
    b.anim = 'dead';
    return null;
  }
  const def = ENEMY.boss;
  b.weak = Math.max(0, b.weak - dt);
  b.cooldown = Math.max(0, b.cooldown - dt);
  if (b.rooted > 0 || b.stun > 0) {
    b.rooted = Math.max(0, b.rooted - dt);
    b.stun = Math.max(0, b.stun - dt);
    b.windup = 0;
    b.anim = 'idle';
    return null;
  }
  let target: WolfTarget | null = null;
  let best = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - b.x, t.z - b.z);
    if (!t.dead && d < best) {
      best = d;
      target = t;
    }
  }
  b.target = target?.name ?? null;
  if (!target) {
    b.windup = 0;
    b.anim = 'idle';
    return null;
  }
  const dx = (target.x - b.x) / Math.max(best, 1e-4);
  const dz = (target.z - b.z) / Math.max(best, 1e-4);
  b.yaw = Math.atan2(dx, dz);
  if (b.windup > 0) {
    b.windup = Math.max(0, b.windup - dt);
    b.anim = 'attack';
    if (b.windup > 1e-9) return null;
    b.windup = 0;
    b.cooldown = def.biteCooldown;
    return best <= def.reach + 1 ? target.name : null;
  }
  if (best > def.reach) {
    b.x = Math.max(DUNGEON.x - DUNGEON.halfW + 2, Math.min(DUNGEON.x + DUNGEON.halfW - 2, b.x + dx * def.run * dt));
    b.z = Math.max(DUNGEON.bossRoomZ + 1, Math.min(DUNGEON.z1 - 2, b.z + dz * def.run * dt));
    b.anim = 'run';
    return null;
  }
  if (b.cooldown === 0) {
    b.windup = BOSS.windup;
    b.anim = 'attack';
  } else b.anim = 'idle';
  return null;
}
