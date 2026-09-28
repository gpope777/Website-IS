import { describe, expect, it } from 'vitest';
import { createTerrain, inMountains, mountainDepth, mountainFeatures } from './terrain';
import { slopeAt, smoothAt } from './mountains';
import { BLOCKS, BLOCKS_SOLUTION, blocksCentre, blocksSolved, corniceLedges, generateMountainShrines, generateQuartzVeins, generateRefugios, MOUNTAIN_SHRINE, pushBlock, QUARTZ, type Cell } from './mountain-shrines';

describe('santuarios de la Montaña (S4 §5.1)', () => {
  for (const seed of [42, 7, 1234, 99]) {
    it(`seed ${seed}: Cornisa, Losas gemelas and Bloques in the mountains`, () => {
      const t = createTerrain(seed);
      const s = generateMountainShrines(t, seed);
      expect(s.map((x) => x.id)).toEqual([9, 10, 11]);
      expect(s.map((x) => x.kind)).toEqual(['cornice', 'twins', 'blocks']);
      expect(generateMountainShrines(t, seed)).toEqual(s);
      for (const sh of s) for (const q of [sh, ...sh.parts]) {
        expect(inMountains(q.x, q.z)).toBe(true);
        expect(smoothAt(q.x, q.z)).toBe(false);
      }
      const [cornice, twins, blocks] = s as [typeof s[0], typeof s[0], typeof s[0]];
      // Cornisa: the orb on a pared's top edge, 2 bare ledges a third of the way up each, frog-sized rises.
      const ledges = corniceLedges(t, seed);
      expect(ledges).toHaveLength(2);
      const foot = ledges[0]!.top - (cornice.y - ledges[0]!.top) / 2;
      expect(cornice.y - foot).toBeGreaterThanOrEqual(12);
      for (const l of ledges) {
        expect(l.bare).toBe(true);
        expect(l.base).toBeLessThan(l.top);
        expect(t.heightAt(l.x, l.z)).toBeLessThan(l.top + 0.5);
      }
      expect(ledges[1]!.top - ledges[0]!.top).toBeLessThanOrEqual(MOUNTAIN_SHRINE.frogRise + 0.01);
      expect(Math.hypot(ledges[1]!.x - ledges[0]!.x, ledges[1]!.z - ledges[0]!.z)).toBeLessThan(6);
      expect(Math.hypot(ledges[1]!.x - cornice.x, ledges[1]!.z - cornice.z)).toBeLessThan(8);
      // Losas: two gentle plates 14 m apart, the boulder a few metres from plate 2.
      const [p1, p2, home] = twins.parts as [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }];
      expect(Math.hypot(p1.x - p2.x, p1.z - p2.z)).toBeCloseTo(14);
      for (const q of [p1, p2]) expect(slopeAt(t, q.x, q.z)).toBeLessThan(20);
      expect(Math.hypot(home.x - p2.x, home.z - p2.z)).toBeLessThan(6);
      // Bloques: 3 starts, 3 cells, the lever; the grid gentle.
      expect(blocks.parts).toHaveLength(7);
      for (const q of blocks.parts) expect(slopeAt(t, q.x, q.z)).toBeLessThan(25);
      const c = blocksCentre(blocks);
      expect(Math.hypot(c.x - blocks.x, c.z - blocks.z)).toBeGreaterThan(5);
    });
  }

  it('the Bloques rule: one cell per push, never off the grid or into a block; 8 pushes solve it', () => {
    let b: Cell[] = BLOCKS.starts.map((q) => [q[0], q[1]] as const);
    expect(blocksSolved(b)).toBe(false);
    expect(pushBlock(b, 0, [-1, 0])).toEqual([[0, 1], [3, 1], [1, 3]]);
    expect(pushBlock([[0, 0], [1, 0], [5, 5]], 0, [1, 0])).toBeNull();
    expect(pushBlock([[5, 0], [1, 0], [3, 3]], 0, [1, 0])).toBeNull();
    expect(BLOCKS_SOLUTION).toHaveLength(8);
    for (const m of BLOCKS_SOLUTION) {
      const n = pushBlock(b, m.i, m.dir);
      expect(n).not.toBeNull();
      b = n!;
    }
    expect(blocksSolved(b)).toBe(true);
  });
});

describe('vetas de cuarzo (S4 §5.2)', () => {
  for (const seed of [42, 7, 1234, 99]) {
    it(`seed ${seed}: 10 veins up the paredes' faces, 8–20 m over the foot`, () => {
      const t = createTerrain(seed);
      const v = generateQuartzVeins(t, seed);
      expect(v.map((q) => q.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(v).toHaveLength(QUARTZ.veins);
      const { paredes } = mountainFeatures(seed);
      for (const q of v) {
        expect(inMountains(q.x, q.z)).toBe(true);
        expect(q.y).toBeCloseTo(t.heightAt(q.x, q.z));
        expect(slopeAt(t, q.x, q.z)).toBeGreaterThan(45);
        const p = paredes.reduce((a, b) => (Math.hypot(b.x - q.x, b.z - q.z) < Math.hypot(a.x - q.x, a.z - q.z) ? b : a));
        const a = Math.atan2(q.x - p.x, q.z - p.z);
        const foot = t.heightAt(p.x + Math.sin(a) * (p.rt + p.w + 1), p.z + Math.cos(a) * (p.rt + p.w + 1));
        expect(q.y - foot).toBeGreaterThan(QUARTZ.minUp - 0.5);
        expect(q.y - foot).toBeLessThan(QUARTZ.maxUp + 0.5);
        for (const o of v) if (o !== q) expect(Math.hypot(o.x - q.x, o.z - q.z)).toBeGreaterThan(4);
      }
      expect(generateQuartzVeins(t, seed)).toEqual(v);
    });

    it(`seed ${seed}: 2 refugios, one in the Faldas and one high up`, () => {
      const t = createTerrain(seed);
      const r = generateRefugios(t, seed);
      expect(r).toHaveLength(2);
      for (const q of r) {
        expect(inMountains(q.x, q.z)).toBe(true);
        expect(slopeAt(t, q.x, q.z)).toBeLessThan(25);
      }
      expect(mountainDepth(r[0]!.z)).toBeGreaterThan(40);
      expect(mountainDepth(r[0]!.z)).toBeLessThan(120);
      expect(mountainDepth(r[1]!.z)).toBeGreaterThan(105);
    });
  }
});
