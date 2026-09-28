import { describe, expect, it } from 'vitest';
import { FROG, frogHop, frogPads, frogStepOk, wildFrog } from './frog';
import { createTerrain, inSwamp, LAGUNA, swampFeatures, WATER_LEVEL } from './terrain';
import { inBog, zarzalAt } from './swamp';

const SEEDS = [1, 42, 777, 123456];

describe('la Rana', () => {
  it('waits on the montículo closest to the Laguna, dry and past the thorns', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const f = wildFrog(t, s);
      expect(inSwamp(f.x, f.z)).toBe(true);
      expect(t.heightAt(f.x, f.z)).toBeGreaterThan(WATER_LEVEL);
      expect(zarzalAt(t, f.x, f.z)).toBe(false);
      const d = (m: { x: number; z: number }) => Math.hypot(m.x - LAGUNA.x, m.z - (LAGUNA.z - LAGUNA.rz));
      for (const m of swampFeatures(s).mounds) expect(d(f)).toBeLessThanOrEqual(d(m) + 1e-9);
      expect(wildFrog(t, s)).toEqual(f);
    }
  });

  it('lays 3 lily pads 8–12 m apart in wadeable bog', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const home = wildFrog(t, s);
      const pads = frogPads(t, s, home);
      expect(pads).toHaveLength(FROG.pads);
      let prev = home;
      for (const p of pads) {
        const gap = Math.hypot(p.x - prev.x, p.z - prev.z);
        expect(gap).toBeGreaterThanOrEqual(FROG.padGap[0] - 1e-9);
        expect(gap).toBeLessThanOrEqual(FROG.padGap[1] + 1e-9);
        expect(inBog(t, p.x, p.z)).toBe(true);
        prev = p;
      }
      expect(frogPads(t, s, home)).toEqual(pads);
    }
  });

  it('goes on land and shallow water, not the deep Laguna nor off the map', () => {
    const t = createTerrain(42);
    const home = wildFrog(t, 42);
    expect(frogStepOk(t, home.x, home.z)).toBe(true);
    const pad = frogPads(t, 42, home)[0]!;
    expect(frogStepOk(t, pad.x, pad.z)).toBe(true);
    expect(frogStepOk(t, LAGUNA.x, LAGUNA.z)).toBe(false);
    expect(frogStepOk(t, -2000, 100)).toBe(false);
  });

  it('jumps 7 m up and 9 m forward', () => {
    const g = 14;
    const { vy, fwd } = frogHop(g);
    expect((vy * vy) / (2 * g)).toBeCloseTo(FROG.hop.up, 1);
    expect(fwd * ((2 * vy) / g)).toBeCloseTo(FROG.hop.fwd, 1);
  });
});

describe('the frog over deep water (S3-C)', () => {
  it('flies over it, stands on pads, and only floats back toward shallower water', async () => {
    const { frogMoveOk } = await import('./frog');
    const { createTerrain: ct, LAGUNA: L, WATER_LEVEL: W } = await import('./terrain');
    const t = ct(42);
    const deep = { x: L.x, z: L.z };
    const lessDeep = { x: L.x - 30, z: L.z };
    expect(frogMoveOk(t, lessDeep, deep, false, [])).toBe(false);
    expect(frogMoveOk(t, lessDeep, deep, true, [])).toBe(true);
    expect(frogMoveOk(t, deep, lessDeep, false, [])).toBe(true);
    const pad = { id: 1, x: deep.x, z: deep.z, r: 1.1, base: W - 1, top: W + 0.15, bare: true };
    expect(frogMoveOk(t, lessDeep, deep, false, [pad])).toBe(true);
  });
});
