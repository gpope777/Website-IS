import { describe, expect, it } from 'vitest';
import { BLOCK, inCone, newGuard, resolveHit } from './combat';

describe('resolveHit', () => {
  it('rolling dodges, a fresh guard parries, an old guard blocks', () => {
    const g = newGuard();
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'hit', dmg: 10 });
    g.rollUntil = 5.2;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'dodged' });
    g.rollUntil = 0;
    g.blockSince = 5 - BLOCK.parryWindow / 2;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'parried' });
    g.blockSince = 4;
    expect(resolveHit(g, 5, 10)).toEqual({ kind: 'blocked', dmg: expect.closeTo(2) });
  });
});

describe('inCone', () => {
  it('uses protocol yaw (0 = +z)', () => {
    expect(inCone(0, 0, 0, 0, 5, 0.5)).toBe(true);
    expect(inCone(0, 0, 0, 0, -5, 0.5)).toBe(false);
    expect(inCone(0, 0, Math.PI / 2, 5, 0, 0.5)).toBe(true);
    expect(inCone(0, 0, Math.PI - 0.1, 0, -5, 0.5)).toBe(true); // wraps around ±π
  });
});
