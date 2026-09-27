import { describe, expect, it } from 'vitest';
import { FpsCounter, fpsText } from './fps-meter';

describe('fpsText', () => {
  it('says fps and tier', () => {
    expect(fpsText(58.4, 'medium', 1)).toBe('58 fps · Media');
  });
  it('shows a lowered pixel ratio', () => {
    expect(fpsText(22, 'low', 0.85)).toBe('22 fps · Baja · ×0,85');
  });
});

describe('FpsCounter', () => {
  it('reports the mean every half second', () => {
    const c = new FpsCounter();
    const seen: number[] = [];
    for (let i = 0; i < 60; i++) {
      const f = c.feed(1 / 30);
      if (f !== null) seen.push(Math.round(f));
    }
    expect(seen).toEqual([30, 30, 30, 30]);
  });
});
