import { nextComboStep } from '../shared/sim/combat';

export type Swing = { kind: 'swing'; step: 1 | 2 | 3 } | { kind: 'spin' };

/** Tap chains three swings; one early tap is buffered; a long hold releases a spin. Times are seconds. */
export class Combo {
  step = 0;
  private lastAt = -99;
  private readyAt = 0;
  private spinReadyAt = 0;
  private buffered = false;
  private downAt: number | null = null;

  constructor(private readonly cooldown: number, private readonly spinHold: number, private readonly spinCooldown: number) {}

  press(now: number): void {
    if (this.downAt === null) this.downAt = now;
  }

  release(now: number): Swing | null {
    if (this.downAt === null) return null;
    const held = now - this.downAt;
    this.downAt = null;
    if (held >= this.spinHold && now >= this.spinReadyAt) {
      this.spinReadyAt = now + this.spinCooldown;
      this.readyAt = now + this.cooldown;
      this.step = 0;
      this.buffered = false;
      return { kind: 'spin' };
    }
    if (now < this.readyAt) {
      this.buffered = true;
      return null;
    }
    return this.swing(now);
  }

  tick(now: number): Swing | null {
    if (!this.buffered || now < this.readyAt) return null;
    this.buffered = false;
    return this.swing(now);
  }

  charge(now: number): number {
    if (this.downAt === null || now < this.spinReadyAt) return 0;
    return Math.min(1, (now - this.downAt) / this.spinHold);
  }

  private swing(now: number): Swing {
    const step = nextComboStep(this.step, this.lastAt, now, this.cooldown);
    this.step = step;
    this.lastAt = now;
    this.readyAt = now + this.cooldown;
    return { kind: 'swing', step };
  }
}
