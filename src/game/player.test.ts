import { describe, expect, it } from 'vitest';
import { Player, WATER_LEVEL } from './player';
import type { World } from './world';

const fakeWorld = (h: number) => ({ heightAt: () => h, resources: [], placed: [] }) as unknown as World;
const idle = { forward: true, back: false, left: false, right: false, sprint: true, jump: true };

describe('swimming', () => {
  it('floats at the surface over deep water and cannot sprint or jump', () => {
    const p = new Player(fakeWorld(-8));
    const r = p.update(idle, 0.1, 100);
    expect(r.swimming).toBe(true);
    expect(r.sprinting).toBe(false);
    expect(p.position.y).toBeCloseTo(WATER_LEVEL - 0.9);
  });
  it('walks normally on land', () => {
    const p = new Player(fakeWorld(2));
    expect(p.update(idle, 0.1, 100).swimming).toBe(false);
  });
});
