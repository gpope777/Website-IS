import { describe, expect, it } from 'vitest';
import { lookAt } from '../scene/looks';
import { paperLight, rimStrength } from './actor-light';

describe('light on paper and actors', () => {
  it('paper is near white at noon and dim but never black at night', () => {
    const noon = paperLight(lookAt({ bosque: 1 }, 0.5), 1);
    expect(Math.min(noon.r, noon.g, noon.b)).toBeGreaterThan(0.7);
    const night = paperLight(lookAt({ bosque: 1 }, 0), 0);
    for (const v of [night.r, night.g, night.b]) {
      expect(v).toBeGreaterThanOrEqual(0.35);
      expect(v).toBeLessThan(0.75);
    }
    expect(night.r + night.g + night.b).toBeLessThan(noon.r + noon.g + noon.b);
    for (const v of [noon.r, noon.g, noon.b]) expect(v).toBeLessThanOrEqual(1.1);
  });

  it('the rim is off by day and strongest at night', () => {
    expect(rimStrength(1)).toBe(0);
    expect(rimStrength(0)).toBeCloseTo(0.55);
    expect(rimStrength(0.3)).toBeLessThan(rimStrength(0.1));
  });
});
