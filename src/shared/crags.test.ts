import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { CRAG, cragsNear, cragTopAt, generateCrags } from './crags';

describe('crags', () => {
  const t = createTerrain(42);
  const crags = generateCrags(t, 42);

  it('is deterministic and places a handful per world', () => {
    expect(generateCrags(t, 42)).toEqual(crags);
    expect(crags.length).toBeGreaterThanOrEqual(8);
    expect(crags.length).toBeLessThanOrEqual(64);
  });

  it('stands on dry land, away from spawn and the rim, and is tall enough to matter', () => {
    for (const c of crags) {
      expect(Math.hypot(c.x, c.z)).toBeGreaterThan(CRAG.spawnClear);
      expect(Math.abs(c.x)).toBeLessThan(HALF - 20);
      expect(Math.abs(c.z)).toBeLessThan(HALF - 20);
      expect(t.heightAt(c.x, c.z)).toBeGreaterThan(WATER_LEVEL);
      expect(c.top - t.heightAt(c.x, c.z)).toBeGreaterThanOrEqual(CRAG.minH - 0.01);
    }
  });

  it('finds crags near a point and the top you can stand on', () => {
    const c = crags[0]!;
    expect(cragsNear(crags, c.x + c.r + 0.5, c.z, 1)).toContain(c);
    expect(cragsNear(crags, c.x + c.r + 5, c.z, 1)).not.toContain(c);
    expect(cragTopAt(crags, c.x, c.z, c.top)).toBe(c.top);
    expect(cragTopAt(crags, c.x, c.z, c.top - 3)).toBeNull();
    expect(cragTopAt(crags, c.x + c.r + 1, c.z, c.top)).toBeNull();
  });
});
