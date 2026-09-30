import { describe, expect, it } from 'vitest';
import { trailAlpha } from './swing-fx';

describe('swing trail', () => {
  it('se desvanece linealmente y termina en life', () => {
    expect(trailAlpha(0, 0.2)).toBe(1);
    expect(trailAlpha(0.1, 0.2)).toBeCloseTo(0.5);
    expect(trailAlpha(0.2, 0.2)).toBe(0);
    expect(trailAlpha(1, 0.2)).toBe(0);
  });
});
