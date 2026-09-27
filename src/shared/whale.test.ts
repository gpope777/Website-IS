import { describe, expect, it } from 'vitest';
import { canTame, seatOffset, WHALE, whaleStepOk, whaleWidth, wildWhale } from './whale';
import { inBravas } from './fish';
import { coastFeatures, COAST, createTerrain, HALF } from './terrain';
import { depthAt } from './coast';

const SEEDS = [1, 42, 777, 123456];

describe('the whale', () => {
  it('spouts in the deep sea, away from the aguas bravas', () => {
    for (const s of SEEDS) {
      const t = createTerrain(s);
      const w = wildWhale(t, s);
      expect(w.z).toBeGreaterThan(HALF + COAST.deepFrom - 10);
      expect(depthAt(t, w.x, w.z)).toBeGreaterThanOrEqual(8);
      expect(whaleStepOk(t, w.x, w.z)).toBe(true);
      expect(inBravas(coastFeatures(s).island, w.x, w.z)).toBe(false);
      expect(wildWhale(t, s)).toEqual(w);
    }
  });

  it('needs 3 m of water, but crosses the aguas bravas', () => {
    const s = 42;
    const t = createTerrain(s);
    expect(whaleStepOk(t, 0, HALF + 30)).toBe(false); // beach
    const island = coastFeatures(s).island;
    const bravas = { x: island.x + island.r + 15, z: island.z };
    expect(inBravas(island, bravas.x, bravas.z)).toBe(true);
    expect(depthAt(t, bravas.x, bravas.z)).toBeGreaterThan(WHALE.minDepth);
    expect(whaleStepOk(t, bravas.x, bravas.z)).toBe(true);
    let z = HALF + 60;
    while (depthAt(t, 0, z) >= WHALE.minDepth) z -= 0.5;
    expect(whaleStepOk(t, 0, z)).toBe(false);
  });

  it('widens the zone per extra player, up to 3', () => {
    expect(whaleWidth(1, 1)).toBeCloseTo(1);
    expect(whaleWidth(1, 2)).toBeCloseTo(1.4);
    expect(whaleWidth(1, 4)).toBeCloseTo(2.2);
    expect(whaleWidth(1, 9)).toBeCloseTo(2.2);
  });

  it('is never tamed alone', () => {
    expect(canTame(1)).toBe(false);
    expect(canTame(2)).toBe(true);
  });

  it('has 4 distinct seats that turn with the whale', () => {
    const a = Array.from({ length: WHALE.seats }, (_, i) => seatOffset(i, 0));
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i]!.x - a[j]!.x, a[i]!.z - a[j]!.z)).toBeGreaterThan(0.5);
    expect(seatOffset(0, 0).z).toBeGreaterThan(0);
    const r = seatOffset(0, Math.PI / 2);
    expect(r.x).toBeCloseTo(seatOffset(0, 0).z);
  });
});
