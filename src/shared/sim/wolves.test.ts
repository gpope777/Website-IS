import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { createWolf, hitWolf, stepWolf, WOLF, type WolfTarget } from './wolves';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const rng = () => 0.5;
const target = (x: number, z = 0, extra: Partial<WolfTarget> = {}): WolfTarget => ({ name: 'Ana', x, z, dead: false, fires: false, ...extra });

describe('wolves', () => {
  it('chases the nearest player in sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(10)], flat, 0.1, rng);
    expect(w.target).toBe('Ana');
    expect(w.x).toBeGreaterThan(0);
    expect(w.anim).toBe('run');
  });

  it('ignores players out of sight', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(WOLF.sight + 5)], flat, 0.1, rng);
    expect(w.target).toBeNull();
    expect(w.anim).toBe('walk');
  });

  it('bites in reach, then waits for the cooldown', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    const t = [target(1)];
    expect(stepWolf(w, t, flat, 0.1, rng)).toBe('Ana');
    expect(stepWolf(w, t, flat, 0.1, rng)).toBeNull();
    let bit: string | null = null;
    for (let i = 0; i < 20 && !bit; i++) bit = stepWolf(w, t, flat, 0.1, rng);
    expect(bit).toBe('Ana');
  });

  it('ignores dead players', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(stepWolf(w, [target(1, 0, { dead: true })], flat, 0.1, rng)).toBeNull();
    expect(w.target).toBeNull();
  });

  it('runs away from players at a fire', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    stepWolf(w, [target(5, 0, { fires: true })], flat, 0.1, rng);
    expect(w.x).toBeLessThan(0);
    expect(w.target).toBeNull();
  });

  it('does not walk into deep water', () => {
    const lake: Terrain = { heightAt: (x) => (x > 1 ? -10 : 0), density: () => 0.5 };
    const w = createWolf(1, 0.9, 0, lake, rng);
    for (let i = 0; i < 10; i++) stepWolf(w, [target(10)], lake, 0.1, rng);
    expect(w.x).toBeLessThanOrEqual(1);
  });

  it('dies once', () => {
    const w = createWolf(1, 0, 0, flat, rng);
    expect(hitWolf(w, WOLF.hp - 1)).toBe(false);
    expect(hitWolf(w, 5)).toBe(true);
    expect(hitWolf(w, 5)).toBe(false);
    expect(w.anim).toBe('dead');
    expect(stepWolf(w, [target(1)], flat, 0.1, rng)).toBeNull();
  });
});
