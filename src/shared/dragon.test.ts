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

  it('circles the Pico 14 m out, 8 m below the top, one lap every 10 s', () => {
    const t = createTerrain(42);
    const pico = picoOf(t, 42);
    expect(pico.top).toBeGreaterThan(60);
    const a = dragonPos(pico, 3);
    expect(Math.hypot(a.x - pico.x, a.z - pico.z)).toBeCloseTo(14, 5);
    expect(a.y).toBeCloseTo(pico.top - 8, 5);
    const b = dragonPos(pico, 13);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.z).toBeCloseTo(a.z, 4);
    const c = dragonPos(pico, 3.1);
    expect(Math.hypot(c.x - a.x, c.z - a.z) / 0.1).toBeCloseTo((2 * Math.PI * 14) / 10, 0);
  });

  it('ceiling, fog and the leap window', () => {
    expect(dragonCeil(10)).toBe(45);
    expect(dragonCeil(100)).toBe(120);
    expect(inFog(-HALF - 210)).toBe(true);
    expect(inFog(-HALF - 60)).toBe(false);
    const pico = { x: 0, z: -HALF - 170, top: 90 };
    const d = dragonPos(pico, 2);
    expect(leapOk(pico, 2, { x: d.x, y: 90, z: d.z })).toBe(true);
    expect(leapOk(pico, 4.5, { x: d.x, y: 90, z: d.z })).toBe(false);
    expect(leapOk(pico, 2, { x: d.x, y: d.y - 1, z: d.z })).toBe(false);
    expect(leapOk(pico, 2, { x: d.x, y: d.y + 30, z: d.z })).toBe(false);
  });

  it('5 rounds, reversing on 3 and 5; names', () => {
    expect(DRAGON.rounds.map((r) => Math.sign(r.speed))).toEqual([1, 1, -1, 1, -1]);
    expect(Math.abs(DRAGON.rounds[0]!.speed)).toBe(3.4);
    expect(Math.abs(DRAGON.rounds[4]!.speed)).toBe(5.4);
    expect(NAMES.dragon).toBe('el Dragón');
    expect(NAMES.dragonWild).toBe('el Dragón Marchito');
  });
});
