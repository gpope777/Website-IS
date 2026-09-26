import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from './terrain';
import { generateResources, SPAWN_CLEAR } from './resources';

describe('terrain', () => {
  it('is deterministic per seed', () => {
    const a = createTerrain(42);
    const b = createTerrain(42);
    for (const [x, z] of [[0, 0], [10.3, -55.1], [200, -200]] as const) {
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
    }
  });

  it('differs between seeds', () => {
    expect(createTerrain(1).heightAt(50, 50)).not.toBe(createTerrain(2).heightAt(50, 50));
  });

  it('does not depend on query order (client and server query differently)', () => {
    const a = createTerrain(7);
    const h = a.heightAt(12.01, 3);
    const b = createTerrain(7);
    b.heightAt(12.2, 3.1);
    expect(b.heightAt(12.01, 3)).toBe(h);
  });

  it('has dry ground at spawn', () => {
    for (const s of [1, 2, 3, 99, 12345]) expect(createTerrain(s).heightAt(0, 0)).toBeGreaterThanOrEqual(0.8);
  });
});

describe('resources', () => {
  const r = generateResources(createTerrain(42), 42);

  it('is deterministic', () => {
    expect(generateResources(createTerrain(42), 42)).toEqual(r);
  });

  it('uses array index as id', () => {
    r.forEach((s, i) => expect(s.id).toBe(i));
  });

  it('has trees, rocks and bushes', () => {
    for (const k of ['tree', 'rock', 'bush'] as const) expect(r.some((s) => s.kind === k)).toBe(true);
  });

  it('keeps spawn clear, stays inside the world and out of water', () => {
    for (const s of r) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(SPAWN_CLEAR);
      expect(Math.abs(s.x)).toBeLessThan(HALF);
      expect(Math.abs(s.z)).toBeLessThan(HALF);
      expect(s.y).toBeGreaterThanOrEqual(WATER_LEVEL);
    }
  });
});
