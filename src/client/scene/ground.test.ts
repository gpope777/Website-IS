import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, WATER_LEVEL } from '../../shared/terrain';
import { CHUNK, chunksNear, grassBiome, grassDensity, seedChunk, snowAmount, vertexNoise, wetSand } from './ground';

const t = createTerrain(42);

describe('grass placement', () => {
  it('names the biome of the harness stops', () => {
    expect(grassBiome(0, 60)).toBe('bosque');
    expect(grassBiome(0, 275)).toBe('costa');
    expect(grassBiome(-340, 160)).toBe('pantano');
    expect(grassBiome(20, -300)).toBe('montanas');
    expect(grassBiome(0, -560)).toBe('tierras');
  });

  it('grows in open forest, never under water, on the chute or in las Tierras until purified', () => {
    let forest = 0;
    for (let x = -100; x <= 100; x += 10) if (t.heightAt(x, 60) > WATER_LEVEL + 1) forest = Math.max(forest, grassDensity(t, x, 60));
    expect(forest).toBeGreaterThan(0.3);
    expect(grassDensity(t, 0, 400)).toBe(0); // far sea
    expect(grassDensity(t, 0, -HALF - 80)).toBe(0); // the snow chute
    expect(grassDensity(t, 0, -560)).toBe(0);
    let pure = 0;
    for (let x = -200; x <= 200; x += 20) pure = Math.max(pure, grassDensity(t, x, -560, true));
    expect(pure).toBeGreaterThan(0.5);
  });

  it('lists the chunks touching a circle and nothing far', () => {
    const cs = chunksNear(10, 10, 35);
    expect(cs.some((c) => c.cx === 0 && c.cz === 0)).toBe(true);
    for (const c of cs) {
      const dx = Math.max(c.cx * CHUNK - 10, 0, 10 - (c.cx + 1) * CHUNK);
      const dz = Math.max(c.cz * CHUNK - 10, 0, 10 - (c.cz + 1) * CHUNK);
      expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(35);
    }
    expect(chunksNear(10, 10, 35).length).toBeLessThan(chunksNear(10, 10, 90).length);
  });

  it('seeds a chunk deterministically, inside it, on the ground', () => {
    const a = seedChunk(t, 0, 1, 500, 42);
    expect(a).toEqual(seedChunk(t, 0, 1, 500, 42));
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(500);
    for (const b of a) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(CHUNK);
      expect(b.z).toBeGreaterThanOrEqual(CHUNK);
      expect(b.z).toBeLessThan(2 * CHUNK);
      expect(b.y).toBeCloseTo(t.heightAt(b.x, b.z) - 0.03, 5);
    }
    expect(seedChunk(t, 0, -18, 500, 42)).toEqual([]); // las Tierras (z ≈ −570)
  });
});

describe('ground colour rules', () => {
  it('snow by height and slope', () => {
    expect(snowAmount(40, 0)).toBe(0);
    expect(snowAmount(70, 0)).toBe(1);
    expect(snowAmount(70, 45)).toBe(0);
  });

  it('wet sand at the waterline only', () => {
    expect(wetSand(WATER_LEVEL)).toBe(1);
    expect(wetSand(WATER_LEVEL + 0.5)).toBe(0);
  });

  it('noise is bounded', () => {
    for (let i = 0; i < 200; i++) {
      const n = vertexNoise(i * 7.3 - 500, i * 3.1 - 300);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
    }
  });
});
