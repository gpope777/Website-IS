import { describe, expect, it } from 'vitest';
import { DRAGON, dragonCeil, dragonOut, dragonPos, inFog, leapOk, picoOf } from './dragon';
import { NAMES } from './names';
import { createTerrain, HALF } from './terrain';
import { weatherAt } from './weather';

describe('el Dragón', () => {
  it('comes out only on storm days after El Cucurucho', () => {
    const storm = [...Array(20).keys()].find((d) => weatherAt(42, d) === 'storm')!;
    const clear = [...Array(20).keys()].find((d) => weatherAt(42, d) === 'clear')!;
    expect(dragonOut(42, storm, true)).toBe(true);
    expect(dragonOut(42, storm, false)).toBe(false);
    expect(dragonOut(42, clear, true)).toBe(false);
  });

  it('circles the Pico 22 m out, 8 m below the top (never through rock), one lap every 10 s', () => {
    const t = createTerrain(42);
    const pico = picoOf(t, 42);
    expect(pico.top).toBeGreaterThan(60);
    const a = dragonPos(pico, 3);
    expect(Math.hypot(a.x - pico.x, a.z - pico.z)).toBeCloseTo(22, 5);
    expect(a.y).toBeGreaterThanOrEqual(pico.top - 8);
    for (let s = 0; s < 10; s += 0.25) {
      const d = dragonPos(pico, s);
      expect(d.y).toBeGreaterThan(t.heightAt(d.x, d.z) + 2.9);
    }
    const b = dragonPos(pico, 13);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.z).toBeCloseTo(a.z, 4);
    const c = dragonPos(pico, 3.1);
    expect(Math.hypot(c.x - a.x, c.z - a.z) / 0.1).toBeCloseTo((2 * Math.PI * 22) / 10, 0);
  });

  it('ceiling, fog and the leap window', () => {
    expect(dragonCeil(10)).toBe(45);
    expect(dragonCeil(100)).toBe(120);
    expect(inFog(-HALF - 210)).toBe(true);
    expect(inFog(-HALF - 60)).toBe(false);
    const pico = { x: 0, z: -HALF - 170, top: 90, fly: 82 };
    const d = dragonPos(pico, 2);
    const edge = { x: (d.x - pico.x) * (7 / 22), y: 90, z: pico.z + (d.z - pico.z) * (7 / 22) };
    expect(leapOk(pico, 2, edge)).toBe(true);
    expect(leapOk(pico, 2.6, edge)).toBe(true); // ~1.5 s window per lap
    expect(leapOk(pico, 4.5, edge)).toBe(false);
    expect(leapOk(pico, 2, { ...edge, y: 80 })).toBe(false); // not on the top
    expect(leapOk(pico, 2, { x: d.x, y: 90, z: d.z })).toBe(false); // off the Pico
  });

  it('5 rounds, reversing on 3 and 5; names', () => {
    expect(DRAGON.rounds.map((r) => Math.sign(r.speed))).toEqual([1, 1, -1, 1, -1]);
    expect(Math.abs(DRAGON.rounds[0]!.speed)).toBe(3.4);
    expect(Math.abs(DRAGON.rounds[4]!.speed)).toBe(5.4);
    expect(NAMES.dragon).toBe('el Dragón');
    expect(NAMES.dragonWild).toBe('el Dragón Marchito');
  });
});
