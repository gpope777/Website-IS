export const ROLL = { iframes: 0.35, cooldown: 0.8 } as const;
export const BLOCK = { reduce: 0.8, parryWindow: 0.25, rearm: 0.6, parryStun: 1.5, parryDamage: 15 } as const;
export const BOW = { damage: 15, range: 24, cooldown: 0.9, cone: Math.PI / 3 } as const;
export const COMBO = { window: 0.5, knock: 1.5, stun: 0.4 } as const;
export const SPIN = { reach: 3, cooldown: 4 } as const;

/** The next authoritative combo step; the window opens when the punch cooldown ends. */
export function nextComboStep(step: number, lastAt: number, now: number, cooldown: number): 1 | 2 | 3 {
  if (step <= 0 || step >= 3 || now - lastAt > cooldown + COMBO.window) return 1;
  return (step + 1) as 2 | 3;
}

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
