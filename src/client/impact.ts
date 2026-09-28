import type { EnemyKind, FxView } from '../shared/protocol';
import type { ShakeSetting } from './settings';

/** P7-A (spec §3.2): what a blow does on screen. Seconds, metres, milliseconds. */
export const IMPACT = {
  flash: 0.08,
  freezeHit: 0.06,
  freezeBig: 0.11,
  knock: 0.6,
  knockTime: 0.2,
  barFor: 3,
  bars: 4,
  shake: { hit: 0.05, kill: 0.12, parry: 0.15, block: 0.05, hurtMax: 0.2 },
  vibrate: { hit: 15, kill: 30, parry: 40, block: 10, hurt: 25 },
  edgeFor: 0.25,
  low: 0.25,
} as const;

export const SHAKE_SCALE: Record<ShakeSetting, number> = { normal: 1, suave: 0.4, nada: 0 };

/** Common enemies get the floating bar; bosses, elites and the rest already have one at the top. */
export const BAR_KINDS: readonly EnemyKind[] = ['wolf', 'brute', 'rayo'];

export interface Reaction { flash: boolean; freeze: number; shake: number; vibrate: number; knock: boolean; bar: boolean }

/** A blow seen in the snapshot: yours freezes, shakes and buzzes; a friend's only flashes. */
export function reactTo(fx: FxView, me: string, kind: EnemyKind | undefined): Reaction {
  const mine = fx.by === me;
  const bar = !!kind && BAR_KINDS.includes(kind) && fx.kind !== 'parry' && fx.kind !== 'block';
  const r: Reaction = { flash: fx.kind === 'hit' || fx.kind === 'kill', freeze: 0, shake: 0, vibrate: 0, knock: fx.kind === 'kill', bar };
  if (!mine) return r;
  r.freeze = fx.kind === 'parry' || fx.kind === 'kill' ? IMPACT.freezeBig : fx.kind === 'hit' ? IMPACT.freezeHit : 0;
  r.shake = IMPACT.shake[fx.kind];
  r.vibrate = IMPACT.vibrate[fx.kind];
  return r;
}

/** Damage you took this snapshot: the red edge (0–0.8), a shake and a buzz. */
export function hurtReaction(hurt: number): { edge: number; shake: number; vibrate: number } {
  if (!(hurt > 0)) return { edge: 0, shake: 0, vibrate: 0 };
  return { edge: Math.min(0.8, 0.25 + hurt / 40), shake: Math.min(IMPACT.shake.hurtMax, hurt / 100), vibrate: IMPACT.vibrate.hurt };
}

/** Slow red pulse under 25 % health. */
export function lowHealth(health: number, max = 100): boolean {
  return health > 0 && health / max < IMPACT.low;
}

/** Camera shake: two out-of-phase sines under an exponential fall (τ 0.18 s). Multiply by the setting outside. */
export class Shake {
  private amp = 0;
  private t = 0;

  add(a: number): void {
    if (a > this.amp) this.amp = a;
  }

  step(dt: number): { x: number; y: number } {
    this.t += dt;
    this.amp *= Math.exp(-dt / 0.18);
    if (this.amp < 1e-4) {
      this.amp = 0;
      return { x: 0, y: 0 };
    }
    return { x: this.amp * Math.sin(this.t * 47), y: this.amp * Math.sin(this.t * 31 + 1.3) };
  }

  get level(): number {
    return this.amp;
  }
}

/** Floating bars: at most `IMPACT.bars` at once, each 3 s after its last hit; the oldest makes room. */
export class HpBars {
  private readonly bars = new Map<number, { hp: number; until: number }>();

  hit(id: number, hp: number, now: number): void {
    this.bars.delete(id);
    if (hp <= 0) return;
    this.bars.set(id, { hp, until: now + IMPACT.barFor });
    while (this.bars.size > IMPACT.bars) this.bars.delete(this.bars.keys().next().value!);
  }

  visible(now: number): { id: number; hp: number }[] {
    const out: { id: number; hp: number }[] = [];
    for (const [id, b] of this.bars) {
      if (b.until <= now) this.bars.delete(id);
      else out.push({ id, hp: b.hp });
    }
    return out;
  }
}
