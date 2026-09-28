import { describe, expect, it } from 'vitest';
import { RATES, createVitals, damage, eatBerry, isNight, tickVitals, type VitalsEnv } from './survival';

const day = { night: false, nearFire: false };
const night = { night: true, nearFire: false };

function run(env: VitalsEnv, seconds: number, v = createVitals()) {
  for (let t = 0; t < seconds; t += 0.1) v = tickVitals(v, env, 0.1);
  return v;
}

describe('vitals', () => {
  it('hunger empties in about 10 minutes', () => {
    expect(run(day, 9 * 60).hunger).toBeGreaterThan(0);
    expect(run(day, 10 * 60 + 1).hunger).toBe(0);
  });

  it('night cools, fire warms', () => {
    const cold = run(night, 60);
    expect(cold.warmth).toBeLessThan(100);
    expect(run({ night: true, nearFire: true }, 20, cold).warmth).toBe(100);
  });

  it('altitude cold drains like night by day, twice at night; fire still warms', () => {
    const d = run({ night: false, nearFire: false, cold: true }, 30);
    expect(d.warmth).toBeCloseTo(100 - 30 * RATES.warmthNight, 0);
    const n = run({ night: true, nearFire: false, cold: true }, 30);
    expect(n.warmth).toBeCloseTo(100 - 60 * RATES.warmthNight, 0);
    expect(run({ night: true, nearFire: true, cold: true }, 30, n).warmth).toBe(100);
  });

  it('starving and freezing hurt', () => {
    const v = run(day, 1, { health: 100, hunger: 0, warmth: 100 });
    expect(v.health).toBeLessThan(100);
    const f = run(night, 1, { health: 100, hunger: 100, warmth: 0 });
    expect(f.health).toBeLessThan(100);
  });

  it('regenerates when fed and warm', () => {
    expect(run(day, 10, { health: 50, hunger: 100, warmth: 100 }).health).toBeGreaterThan(50);
  });

  it('berries feed and clamp', () => {
    expect(eatBerry({ health: 99, hunger: 95, warmth: 50 })).toEqual({ health: 100, hunger: 100, warmth: 50 });
  });

  it('damage floors at 0', () => {
    expect(damage(createVitals(), 150).health).toBe(0);
  });

  it('night window', () => {
    expect(isNight(0.1)).toBe(true);
    expect(isNight(0.5)).toBe(false);
    expect(isNight(0.9)).toBe(true);
  });
});
