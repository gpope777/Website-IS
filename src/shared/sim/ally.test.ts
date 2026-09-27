import { describe, expect, it } from 'vitest';
import type { Terrain } from '../terrain';
import { ALLY, createAlly, stepAlly } from './ally';
import { createWolf } from './wolves';

const flat: Terrain = { heightAt: () => 1, density: () => 0 };
const heart = { x: 0, z: 0 };
const raider = (id: number, x: number, z: number) => {
  const w = createWolf(id, x, z, flat, () => 0.5);
  w.raid = true;
  return w;
};

describe('stepAlly', () => {
  it('waits beside the Heart', () => {
    const a = createAlly(heart, flat);
    expect(a).toMatchObject({ x: ALLY.home, z: 0, y: 1 });
    expect(stepAlly(a, heart, [], flat, 0.1)).toBeNull();
    expect(a.anim).toBe('idle');
  });

  it('runs to the nearest raider near the Heart and bites it on a cooldown', () => {
    const a = createAlly(heart, flat);
    const near = raider(1, 8, 0);
    const far = raider(2, -12, 0);
    let hit = null;
    for (let i = 0; i < 30 && !hit; i++) hit = stepAlly(a, heart, [far, near], flat, 0.1);
    expect(hit).toBe(near);
    expect(stepAlly(a, heart, [far, near], flat, 0.1)).toBeNull(); // cooling down
    expect(a.anim).toBe('attack');
  });

  it('ignores raiders far from the Heart, plain wolves and corpses; goes home when idle', () => {
    const a = createAlly(heart, flat);
    const wolf = createWolf(3, 4, 0, flat, () => 0.5);
    const dead = raider(4, 3, 0);
    dead.hp = 0;
    const out = raider(5, ALLY.guard + 5, 0);
    a.x = 6;
    for (let i = 0; i < 40; i++) expect(stepAlly(a, heart, [wolf, dead, out], flat, 0.1)).toBeNull();
    expect(a.x).toBeCloseTo(ALLY.home, 1);
    expect(a.anim).toBe('idle');
  });
});
