import { describe, expect, it } from 'vitest';
import { dawnCrossed, precipKind, PRECIP, stormDim } from './weather';

describe('mountain weather fx', () => {
  it('rain below, snow high up, nothing when clear or away', () => {
    expect(precipKind('clear', 10)).toBeNull();
    expect(precipKind(null, 10)).toBeNull();
    expect(precipKind('rain', 20)).toBe('rain');
    expect(precipKind('storm', PRECIP.snowAbove + 1)).toBe('snow');
  });

  it('dawn is crossed once', () => {
    expect(dawnCrossed(0.21, 0.23)).toBe(true);
    expect(dawnCrossed(0.3, 0.31)).toBe(false);
    expect(dawnCrossed(0.99, 0.01)).toBe(false);
    expect(dawnCrossed(0.1, 0.9)).toBe(false);
  });

  it('storm is darker than rain', () => {
    expect(stormDim('storm')).toBeGreaterThan(stormDim('rain'));
    expect(stormDim('clear')).toBe(0);
  });
});
