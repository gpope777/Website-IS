import { describe, expect, it } from 'vitest';
import { clampMap, CORRUPT_LANDS, corruptFeatures, createTerrain, HALF, inCorrupt, inMap, MOUNTAINS } from './terrain';
import { slopeAt, smoothAt, steepBlocked } from './mountains';
import { missingRoot, RIM_LINE, rimCrossBlocked, towerHeight } from './corrupt-lands';
import { NAMES } from './names';

const SEEDS = [7, 12345];
const zAt = (d: number) => CORRUPT_LANDS.z1 - d;

describe('las Tierras Corruptas: terrain', () => {
  it('leaves everything south of the Tierras unchanged', () => {
    const want = [3.535, -0.228, 1.763, 12.101, 49.767, 95.628, 73.959, 96.101, -3.25, -3.5, 7.634, 4.209, 4.41, 17.605, 51.457, 99.407, 81.812, 101.605, -3.25, -3.5];
    const got: number[] = [];
    for (const seed of SEEDS) {
      const t = createTerrain(seed);
      for (const [x, z] of [[0, 0], [100, -200], [-200, -239], [0, -HALF - 10], [50, -HALF - 100], [-150, -HALF - 219.9], [200, -HALF - 205], [0, -HALF - 219.99], [30, HALF + 50], [-HALF - 60, 100]] as const) got.push(Math.round(t.heightAt(x, z) * 1000) / 1000);
    }
    expect(got).toEqual(want);
  });

  it('meets the mountains at the seam, and el Borde falls from +90 to +20', () => {
    for (const seed of SEEDS) {
      const t = createTerrain(seed);
      for (let i = 0; i < 20; i++) {
        const x = -HALF + 5 + i * 24;
        expect(Math.abs(t.heightAt(x, MOUNTAINS.z0 - 0.01) - t.heightAt(x, MOUNTAINS.z0 + 0.01))).toBeLessThan(0.2);
      }
      for (const x of [-150, -50, 0, 60, 170]) {
        const E = t.heightAt(x, -HALF + 0.001);
        expect(t.heightAt(x, zAt(0.5))).toBeGreaterThan(E + 85);
        expect(t.heightAt(x, zAt(22))).toBeLessThan(E + 30);
        const drop = t.heightAt(x, zAt(3)) - t.heightAt(x, zAt(17));
        expect((Math.atan(drop / 14) * 180) / Math.PI).toBeGreaterThan(60);
      }
    }
  });

  it('la Ceniza is a gentle ash plain', () => {
    for (const seed of SEEDS) {
      const t = createTerrain(seed);
      for (let x = -200; x <= 200; x += 20)
        for (let d = 25; d <= 75; d += 10) {
          const E = t.heightAt(x, -HALF + 0.001);
          const h = t.heightAt(x, zAt(d));
          expect(h).toBeGreaterThan(E + 10);
          expect(h).toBeLessThan(E + 30);
        }
    }
  });

  it('el Lago Negro is a basin in the west, los Escalones rotos 4 smooth steps in the east', () => {
    for (const seed of SEEDS) {
      const t = createTerrain(seed);
      const { lake, steps: s } = corruptFeatures(seed);
      expect(lake.x).toBeLessThan(-60);
      const ld = CORRUPT_LANDS.z1 - lake.z;
      expect(ld).toBeGreaterThanOrEqual(100);
      expect(ld).toBeLessThanOrEqual(150);
      const rimAvg = [0, 1, 2, 3].reduce((a, k) => a + t.heightAt(lake.x + Math.sin(k * 1.57) * lake.r, lake.z + Math.cos(k * 1.57) * lake.r), 0) / 4;
      expect(rimAvg - t.heightAt(lake.x, lake.z)).toBeGreaterThan(9);
      expect(s.x).toBeGreaterThan(60);
      expect(s.d0).toBeGreaterThanOrEqual(110);
      expect(s.d0).toBeLessThanOrEqual(120);
      const floor = t.heightAt(s.x, zAt(s.d0 - 2));
      for (let k = 0; k < 4; k++) {
        const lo = t.heightAt(s.x, zAt(s.d0 + s.pitch * k - 0.2));
        const hi = t.heightAt(s.x, zAt(s.d0 + s.pitch * k + s.run + 0.2));
        expect(Math.abs(hi - lo - 6)).toBeLessThan(0.3);
        expect(Math.abs(t.heightAt(s.x + 5, zAt(s.d0 + s.pitch * k + 4)) - hi)).toBeLessThan(0.3); // flat top
      }
      expect(Math.abs(t.heightAt(s.x, zAt(s.d0 + 35)) - floor - 24)).toBeLessThan(0.5);
    }
  });

  it('la Torre stands on a flat plateau; the sides rise into rims', () => {
    for (const seed of SEEDS) {
      const t = createTerrain(seed);
      const hs: number[] = [];
      for (let x = -24; x <= 24; x += 4) for (let d = 176; d <= 198; d += 2) hs.push(t.heightAt(x, zAt(d)));
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.5);
      expect(Math.abs(hs[0]! - t.heightAt(0, -HALF + 0.001) - 30)).toBeLessThan(0.5);
      for (const sx of [-1, 1]) expect(t.heightAt(sx * (HALF - 2), zAt(100)) - t.heightAt(sx * (HALF - 40), zAt(100))).toBeGreaterThan(40);
      expect(slopeAt(t, 0, zAt(10))).toBeGreaterThan(60);
    }
  });

  it('bounds: the map is the union of four rectangles', () => {
    expect(inCorrupt(0, -HALF - 300)).toBe(true);
    expect(inCorrupt(0, -HALF - 200)).toBe(false);
    expect(inMap(0, -HALF - 300, 2)).toBe(true);
    expect(inMap(0, -HALF - 219.5, 2)).toBe(true);
    expect(inMap(-HALF - 10, -HALF - 300, 2)).toBe(false);
    expect(clampMap(0, -HALF - 900, 3)).toEqual({ x: 0, z: CORRUPT_LANDS.z0 + 3 });
  });
});

describe('las Tierras Corruptas: rules', () => {
  it('el Borde: only flying crosses the rim line northward', () => {
    expect(rimCrossBlocked(RIM_LINE + 1, RIM_LINE - 0.5)).toBe(true);
    expect(rimCrossBlocked(RIM_LINE - 0.5, RIM_LINE + 1)).toBe(false);
    expect(rimCrossBlocked(RIM_LINE - 1, RIM_LINE - 3)).toBe(false);
  });

  it('el Borde is smooth, la Ceniza is not; los Escalones are too steep to walk up', () => {
    const t = createTerrain(42);
    expect(smoothAt(0, zAt(10))).toBe(true);
    expect(smoothAt(0, zAt(50))).toBe(false);
    const s = corruptFeatures(42).steps;
    expect(steepBlocked(t, s.x, zAt(s.d0 - 1), s.x, zAt(s.d0 + 2))).toBe(true);
    expect(steepBlocked(t, s.x, zAt(s.d0 + 2), s.x, zAt(s.d0 - 1))).toBe(false);
  });
});

describe('la Torre and the fog gate (S5-A)', () => {
  it('the tower grows a metre a day, 60 → 140', () => {
    expect(towerHeight(5, 5)).toBe(60);
    expect(towerHeight(45, 5)).toBe(100);
    expect(towerHeight(500, 5)).toBe(140);
    expect(towerHeight(2, 5)).toBe(60);
  });

  it('names the first missing Raíz-madre, Bosque → Costa → Pantano → Montaña', () => {
    const w = (n: number) => ({ purified: n > 0, purified2: n > 1, purified3: n > 2, purified4: n > 3 });
    expect(missingRoot(w(0))).toContain(NAMES.forestRoot);
    expect(missingRoot(w(1))).toBe(NAMES.coastRoot);
    expect(missingRoot(w(2))).toBe(NAMES.swampRoot);
    expect(missingRoot(w(3))).toBe(NAMES.mountainRoot);
    expect(missingRoot(w(4))).toBeNull();
    expect(missingRoot({ ...w(4), purified2: false })).toBe(NAMES.coastRoot);
  });
});

describe('espinas negras from the Tierras (S5 §7.2–7.3)', () => {
  it('ash beasts always drop one, rayos half the time, nothing elsewhere', async () => {
    const { thornDrop, ASH } = await import('./corrupt-lands');
    const { HALF: H } = await import('./terrain');
    const z = -H - 220 - 120;
    expect(thornDrop('wolf', 0, z, 0.9)).toBe(1);
    expect(thornDrop('brute', 0, z, 0.9)).toBe(1);
    expect(thornDrop('wolf', 0, 0, 0.1)).toBe(0);
    expect(thornDrop('rayo', 0, z, 0.3)).toBe(1);
    expect(thornDrop('rayo', 0, z, 0.7)).toBe(0);
    expect(thornDrop('lieut1', 0, z, 0.1)).toBe(0);
    expect(ASH.rayoCap).toBe(8);
  });
});
