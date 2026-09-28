import { describe, expect, it } from 'vitest';
import { createTerrain, HALF } from '../terrain';
import { createRng } from '../rng';
import { RAYO, rayoLow, stepRayo } from './rayo';
import { createWolf, ENEMY, type WolfTarget } from './wolves';

const t = createTerrain(42);
const Z = -HALF - 220 - 120;
const make = () => {
  const w = createWolf(1, 0, Z, t, () => 0.5, 'rayo');
  w.y += RAYO.fly;
  return w;
};
const ground = (x: number, z: number) => t.heightAt(x, z);

describe('rayo marchito (S5 §7.2)', () => {
  it('has its own stats', () => {
    expect(ENEMY.rayo.hp).toBe(60);
    expect(ENEMY.rayo.damage).toBe(10);
  });

  it('hovers at ground + 6 with nobody around', () => {
    const w = make();
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) stepRayo(w, [], t, 0.1, rng);
    expect(Math.abs(w.y - ground(w.x, w.z) - RAYO.fly)).toBeLessThan(0.6);
    expect(rayoLow(w, ground(w.x, w.z))).toBe(false);
  });

  it('closes in, flashes 0.8 s, dives, bites once and climbs back', () => {
    const w = make();
    const rng = createRng(2);
    const target: WolfTarget = { name: 'Ana', x: 10, z: Z, dead: false, fires: false };
    const bites: number[] = [];
    let tellFrom = -1;
    let tellTo = -1;
    let i = 0;
    for (; i < 80; i++) {
      const bit = stepRayo(w, [target], t, 0.05, rng);
      if (w.anim === 'attack' && tellFrom < 0) tellFrom = i;
      if (w.anim !== 'attack' && tellFrom >= 0 && tellTo < 0) tellTo = i;
      if (bit) {
        bites.push(i);
        expect(bit).toBe('Ana');
      }
    }
    expect(tellFrom).toBeGreaterThanOrEqual(0);
    expect((tellTo - tellFrom) * 0.05).toBeCloseTo(RAYO.tell, 1);
    expect(bites).toHaveLength(1);
    for (let k = 0; k < 20; k++) stepRayo(w, [target], t, 0.05, rng);
    expect(w.y - ground(w.x, w.z)).toBeGreaterThan(RAYO.fly - 1);
  });

  it('grounded after a gust: sits still on the ground, low enough for a sword', () => {
    const w = make();
    w.grounded = RAYO.grounded;
    w.y = ground(w.x, w.z);
    const rng = createRng(3);
    const x0 = w.x;
    const target: WolfTarget = { name: 'Ana', x: 5, z: Z, dead: false, fires: false };
    for (let i = 0; i < 25; i++) expect(stepRayo(w, [target], t, 0.1, rng)).toBeNull();
    expect(w.x).toBe(x0);
    expect(rayoLow(w, ground(w.x, w.z))).toBe(true);
    for (let i = 0; i < 20; i++) stepRayo(w, [target], t, 0.1, rng);
    expect(w.grounded ?? 0).toBe(0);
  });
});
