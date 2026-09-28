import { describe, expect, it } from 'vitest';
import { CRAB, crabStep, FLOCK, flockAnchor, flockPoint, lifeAt, lifeFor, wrap } from './life';

describe('amounts per tier', () => {
  it('grows low ≤ medium ≤ high and stays within the spec §3 numbers', () => {
    const [l, m, h] = (['low', 'medium', 'high'] as const).map(lifeFor);
    for (const k of ['flocks', 'fireflies', 'particles', 'crabs', 'fish'] as const) {
      expect(l![k]).toBeLessThanOrEqual(m![k]);
      expect(m![k]).toBeLessThanOrEqual(h![k]);
    }
    expect([l!.flocks, m!.flocks, h!.flocks]).toEqual([1, 2, 3]);
    expect([l!.fireflies, m!.fireflies, h!.fireflies]).toEqual([40, 120, 250]);
    expect(l!.birds * l!.flocks).toBe(12);
    expect(l!.fish).toBe(0);
    expect(m!.fish).toBe(0);
    expect(h!.fish).toBeGreaterThan(0);
  });
});

describe('where and when', () => {
  it('birds and crabs by day only, fireflies at night in the forest and always in the swamp', () => {
    expect(lifeAt('bosque', 0.5, false).birds).toBe('dark');
    expect(lifeAt('bosque', 0.05, false).birds).toBeNull();
    expect(lifeAt('bosque', 0.05, false).fireflies).toBe(1);
    expect(lifeAt('bosque', 0.5, false).fireflies).toBe(0);
    expect(lifeAt('costa', 0.5, false).crabs).toBe(true);
    expect(lifeAt('costa', 0.9, false).crabs).toBe(false);
    expect(lifeAt('costa', 0.5, false).birds).toBe('gull');
    expect(lifeAt('pantano', 0.5, false).fireflies).toBeGreaterThan(0);
    expect(lifeAt('montanas', 0.5, false).birds).toBe('eagle');
  });

  it('las Tierras: ash until purified, then golden fireflies and birds', () => {
    expect(lifeAt('tierras', 0.5, false).particles).toBe('ash');
    expect(lifeAt('tierras', 0.5, false).birds).toBeNull();
    expect(lifeAt('tierras', 0.5, true).particles).toBeNull();
    expect(lifeAt('tierras', 0.5, true).birds).toBe('dark');
    expect(lifeAt('tierras', 0.0, true).golden).toBe(true);
    expect(lifeAt('bosque', 0.0, false).golden).toBe(false);
  });
});

describe('motion', () => {
  it('wraps values around the centre', () => {
    for (const v of [-1000, -3, 0, 7.5, 999]) {
      const w = wrap(v, 12, 40);
      expect(w).toBeGreaterThanOrEqual(12 - 20);
      expect(w).toBeLessThan(12 + 20);
      expect(Math.abs(((w - v) % 40) + 40) % 40).toBeCloseTo(0, 6);
    }
  });

  it('keeps flocks near their anchor', () => {
    const a = flockAnchor(170, -90);
    expect(a).toEqual({ x: 160, z: -160 });
    for (let t = 0; t < 500; t += 7) {
      const p = flockPoint(2, t, a);
      expect(Math.abs(p.x - a.x)).toBeLessThan(FLOCK.rx + 30);
      expect(Math.abs(p.z - a.z)).toBeLessThanOrEqual(FLOCK.rz);
      expect(p.y).toBeGreaterThan(10);
    }
  });

  it('a crab near the player runs away sideways, a far one stays', () => {
    const c = { x: 1, z: 0, yaw: 0 };
    const n = crabStep(c, 0, 0, 0.1);
    expect(Math.hypot(n.x, n.z)).toBeGreaterThan(1);
    expect(n.z).toBe(0); // sideways of yaw 0 is ±x
    const far = { x: CRAB.flee + 1, z: 0, yaw: 0 };
    expect(crabStep(far, 0, 0, 0.1)).toBe(far);
  });
});
