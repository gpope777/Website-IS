export const ROLL = { iframes: 0.35, cooldown: 0.8 } as const;
export const BLOCK = { reduce: 0.8, parryWindow: 0.25, rearm: 0.6, parryStun: 1.5, parryDamage: 15 } as const;
export const BOW = { damage: 15, range: 24, cooldown: 0.9, cone: Math.PI / 3 } as const;

export interface Guard { rollUntil: number; rollReadyAt: number; blockSince: number | null; blockReadyAt: number; bowReadyAt: number }
export const newGuard = (): Guard => ({ rollUntil: 0, rollReadyAt: 0, blockSince: null, blockReadyAt: 0, bowReadyAt: 0 });

export type HitOutcome = { kind: 'dodged' } | { kind: 'parried' } | { kind: 'blocked'; dmg: number } | { kind: 'hit'; dmg: number };

export function resolveHit(g: Guard, now: number, dmg: number): HitOutcome {
  if (now < g.rollUntil) return { kind: 'dodged' };
  if (g.blockSince === null) return { kind: 'hit', dmg };
  if (now - g.blockSince <= BLOCK.parryWindow) return { kind: 'parried' };
  return { kind: 'blocked', dmg: dmg * (1 - BLOCK.reduce) };
}

export function inCone(x: number, z: number, yaw: number, tx: number, tz: number, cone: number): boolean {
  const a = Math.atan2(tx - x, tz - z);
  const diff = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
  return diff <= cone;
}
