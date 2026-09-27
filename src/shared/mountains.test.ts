import { describe, expect, it } from 'vitest';
import { clampMap, createTerrain, HALF, inMap, inMountains, MOUNTAINS, mountainFeatures, PELDANOS, PICO, SWAMP } from './terrain';
import { generateCrags } from './crags';
import snapshot from './terrain-s3.snapshot.json';

const SEEDS = [42, 7, 1234];

describe('las Montañas: terrain', () => {
  it('leaves everything south of the forest rim as it was (Slice 3 snapshot)', () => {
    SEEDS.forEach((seed, i) => {
      const t = createTerrain(seed);
      for (const [x, z, h] of (snapshot as number[][][])[i]!) expect(t.heightAt(x!, z!)).toBeCloseTo(h!, 3);
    });
  });

  for (const seed of SEEDS) {
    const t = createTerrain(seed);
    const E = (x: number) => t.heightAt(x, -HALF + 0.001);
    const at = (x: number, d: number) => t.heightAt(x, -HALF - d);
    const { paredes, pico } = mountainFeatures(seed);

    it(`seed ${seed}: the seam is continuous`, () => {
      for (let x = -HALF + 5; x < HALF; x += 23) expect(Math.abs(t.heightAt(x, -HALF - 0.01) - t.heightAt(x, -HALF + 0.01))).toBeLessThan(0.1);
    });

    it(`seed ${seed}: los Peldaños are 4 flat terraces of +6 m`, () => {
      for (const x of [-150, -40, 0, 60, 170]) {
        for (let k = 0; k < PELDANOS.steps; k++) {
          const d0 = PELDANOS.first + PELDANOS.pitch * k;
          expect(at(x, d0 + PELDANOS.run + 0.2) - at(x, d0 - 0.2)).toBeCloseTo(PELDANOS.rise, 0);
          expect(Math.abs(at(x, d0 + PELDANOS.run + 1) - at(x, d0 + PELDANOS.run + 6))).toBeLessThan(0.3);
        }
        expect(at(x, 38) - E(x)).toBeCloseTo(24, 0);
      }
    });

    it(`seed ${seed}: Faldas, paredes and the Pico`, () => {
      let sum = 0;
      let n = 0;
      for (let x = -HALF + 50; x < HALF - 50; x += 20) for (let d = 50; d < 115; d += 10) (sum += at(x, d) - E(x)), n++;
      expect(sum / n).toBeGreaterThan(28);
      expect(sum / n).toBeLessThan(50);
      expect(paredes.length).toBe(9);
      paredes.forEach((p, i) => {
        const R = p.rt + p.w;
        expect(-HALF - p.z - R).toBeGreaterThanOrEqual(50);
        expect(-HALF - p.z + R).toBeLessThanOrEqual(115);
        expect(Math.abs(p.x) + R).toBeLessThan(HALF - 40);
        expect(Math.abs(p.x) - R).toBeGreaterThan(12);
        for (const o of paredes.slice(i + 1)) expect(Math.hypot(o.x - p.x, o.z - p.z)).toBeGreaterThan(R + o.rt + o.w);
        const face = Math.atan((1.5 * p.h) / p.w) * (180 / Math.PI);
        expect(face).toBeGreaterThan(45);
        expect(face).toBeLessThan(80);
        expect(t.heightAt(p.x, p.z) - t.heightAt(p.x + R + 2, p.z)).toBeGreaterThan(p.h / 2);
      });
      let lo = Infinity;
      let hi = -Infinity;
      for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 3, PICO.r - 0.2]) {
        const h = t.heightAt(pico.x + Math.cos(a) * r, pico.z + Math.sin(a) * r);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      expect(hi - lo).toBeLessThan(0.5);
      expect(lo - E(pico.x)).toBeGreaterThan(75);
      expect(lo - E(pico.x)).toBeLessThan(85);
    });

    it(`seed ${seed}: rims keep players in`, () => {
      for (const x of [-100, 0, 100]) expect(at(x, 217) - E(x)).toBeGreaterThanOrEqual(80);
      for (const s of [-1, 1]) expect(t.heightAt(s * (HALF - 3), -HALF - 100) - t.heightAt(s * (HALF - 40), -HALF - 100)).toBeGreaterThan(30);
    });

    it(`seed ${seed}: no crag within 60 m of los Peldaños`, () => {
      for (const c of generateCrags(t, seed)) expect(c.z).toBeGreaterThan(-HALF + 60);
    });
  }

  it('bounds: the union of forest+coast, swamp and mountains', () => {
    expect(inMountains(0, -HALF - 100)).toBe(true);
    expect(inMountains(0, -HALF + 1)).toBe(false);
    expect(inMap(0, -HALF - 100, 2)).toBe(true);
    expect(inMap(-HALF - 10, -HALF - 10, 2)).toBe(false);
    expect(inMap(0, -HALF - 0.5, 2)).toBe(true);
    expect(inMap(0, -HALF + 0.5, 2)).toBe(true);
    expect(clampMap(0, -HALF - 400, 3)).toEqual({ x: 0, z: MOUNTAINS.z0 + 3 });
    expect(clampMap(-HALF - 300, 100, 3)).toEqual({ x: SWAMP.x0 + 3, z: 100 });
    expect(clampMap(HALF + 10, -HALF - 50, 3)).toEqual({ x: HALF - 3, z: -HALF - 50 });
  });
});
