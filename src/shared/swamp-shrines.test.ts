import { describe, expect, it } from 'vitest';
import { createTerrain, inSwamp, LAGUNA, swampFeatures, WATER_LEVEL } from './terrain';
import { AMBER, generateAmberTrees, generateSwampShrines, lilyPadCrags, SWAMP_SHRINE } from './swamp-shrines';
import { depthAt, SWIM_MAX_DEPTH } from './coast';
import { wildFrog } from './frog';

type T = ReturnType<typeof createTerrain>;
const dry = (t: T, p: { x: number; z: number }) => t.heightAt(p.x, p.z) >= WATER_LEVEL + 0.2;
const moundOf = (seed: number, p: { x: number; z: number }) => swampFeatures(seed).mounds.findIndex((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r);

describe('swamp shrines', () => {
  for (const seed of [1, 7, 42, 1234]) {
    it(`places Candiles, Nenúfares and Turba (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const s = generateSwampShrines(t, seed);
      expect(s).toEqual(generateSwampShrines(t, seed));
      expect(s.map((x) => [x.id, x.kind])).toEqual([[6, 'candles'], [7, 'lilies'], [8, 'peat']]);
      const [candles, lilies, peat] = s as [(typeof s)[0], (typeof s)[0], (typeof s)[0]];
      const frog = moundOf(seed, wildFrog(t, seed));

      expect(inSwamp(candles.x, candles.z)).toBe(true);
      const cm = moundOf(seed, candles);
      expect(cm).toBeGreaterThanOrEqual(0);
      expect(cm).not.toBe(frog);
      expect(candles.parts).toHaveLength(4);
      for (const p of [candles, ...candles.parts]) expect(dry(t, p)).toBe(true);
      const b = candles.parts.slice(0, 3);
      for (let i = 0; i < 3; i++) {
        const d = Math.hypot(b[i]!.x - b[(i + 1) % 3]!.x, b[i]!.z - b[(i + 1) % 3]!.z);
        expect(d).toBeGreaterThanOrEqual(10);
        expect(d).toBeLessThanOrEqual(14);
      }

      const pl = lilies.pillar!;
      expect(pl.bare).toBe(true);
      expect(pl.r).toBe(SWAMP_SHRINE.platformR);
      for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(depthAt(t, pl.x + ox * pl.r, pl.z + oz * pl.r)).toBeGreaterThan(SWIM_MAX_DEPTH + 0.5);
      expect(lilies.orb.y).toBeGreaterThan(pl.top);
      const pads = lilies.parts;
      expect(pads).toHaveLength(SWAMP_SHRINE.pads);
      for (const p of pads) {
        expect(depthAt(t, p.x, p.z)).toBeGreaterThan(0);
        expect(Math.hypot(p.x - LAGUNA.x, p.z - LAGUNA.z)).toBeGreaterThanOrEqual(12);
      }
      for (let i = 1; i < pads.length; i++) expect(Math.hypot(pads[i]!.x - pads[i - 1]!.x, pads[i]!.z - pads[i - 1]!.z)).toBeLessThanOrEqual(5);
      const first = pads[0]!;
      let shore = false;
      for (let a = 0; a < 16 && !shore; a++) for (let r = 0; r <= 4; r += 0.5) if (depthAt(t, first.x + Math.sin(a) * r, first.z + Math.cos(a) * r) < 1) shore = true;
      expect(shore).toBe(true);
      const last = pads[pads.length - 1]!;
      expect(Math.hypot(last.x - pl.x, last.z - pl.z) - pl.r).toBeLessThanOrEqual(5);

      const pm = moundOf(seed, peat);
      expect(pm).toBeGreaterThanOrEqual(0);
      expect([frog, cm]).not.toContain(pm);
      expect(dry(t, peat)).toBe(true);
      expect(peat.parts).toEqual([]);
    });

    it(`grows 6 amber trees, 2 of them on stumps (seed ${seed})`, () => {
      const t = createTerrain(seed);
      const trees = generateAmberTrees(t, seed);
      expect(trees).toEqual(generateAmberTrees(t, seed));
      expect(trees).toHaveLength(AMBER.trees);
      const shrines = generateSwampShrines(t, seed);
      const used = [moundOf(seed, wildFrog(t, seed)), moundOf(seed, shrines[0]!), moundOf(seed, shrines[2]!)];
      const mounds = trees.map((tr) => moundOf(seed, tr));
      expect(new Set(mounds).size).toBe(AMBER.trees);
      for (const m of mounds) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(used).not.toContain(m);
      }
      trees.forEach((tr, i) => {
        expect(tr.id).toBe(i);
        expect(dry(t, tr)).toBe(true);
      });
      const high = trees.filter((tr) => tr.stump);
      expect(high).toHaveLength(AMBER.high);
      for (const tr of high) {
        expect(tr.stump!.bare).toBe(true);
        expect(tr.stump!.top).toBeCloseTo(t.heightAt(tr.x, tr.z) + AMBER.stumpH, 5);
        expect(tr.y).toBe(tr.stump!.top);
      }
    });
  }

  it('turns the pads still up into bare discs', () => {
    const t = createTerrain(42);
    const lilies = generateSwampShrines(t, 42)[1]!;
    const up = lilies.parts.map((_, i) => i !== 2);
    const c = lilyPadCrags(lilies, up);
    expect(c).toHaveLength(SWAMP_SHRINE.pads - 1);
    expect(c.every((k) => k.bare && k.top === WATER_LEVEL + SWAMP_SHRINE.padTop && k.r === SWAMP_SHRINE.padR)).toBe(true);
    expect(c.map((k) => k.id)).not.toContain(SWAMP_SHRINE.padId + 2);
  });
});
