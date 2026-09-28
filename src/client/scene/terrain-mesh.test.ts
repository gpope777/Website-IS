import { describe, expect, it } from 'vitest';
import { CORRUPT_LANDS, corruptFeatures, HALF, MOUNTAINS, PELDANOS, SOUTH, SWAMP, WORLD_SIZE } from '../../shared/terrain';
import { chunkDetailed, corruptChunks, CORRUPT_SHOW_Z, corruptVisible, MOUNTAIN_LOD, mountainChunks, NEAR_SOUTH, type Patch, terrainPatches } from './terrain-mesh';

describe('terrainPatches', () => {
  it('covers the whole map: fine to NEAR_SOUTH, half as dense beyond', () => {
    const [near, far, swamp] = terrainPatches(200);
    expect(near!.z0).toBe(-HALF);
    expect(near!.z1).toBe(NEAR_SOUTH);
    expect(far!.z0).toBe(NEAR_SOUTH);
    expect(far!.z1).toBe(SOUTH);
    const cellNear = WORLD_SIZE / near!.segX;
    expect((near!.z1 - near!.z0) / near!.segZ).toBeCloseTo(cellNear, 0);
    expect(WORLD_SIZE / far!.segX).toBeCloseTo(cellNear * 2, 5);
    expect((far!.z1 - far!.z0) / far!.segZ).toBeCloseTo(cellNear * 2, 0);
    expect(swamp).toMatchObject({ x0: SWAMP.x0, x1: -HALF, z0: SWAMP.z0, z1: SWAMP.z1 });
    expect((swamp!.x1 - swamp!.x0) / swamp!.segX).toBeCloseTo(cellNear * 2, 0);
    expect((swamp!.z1 - swamp!.z0) / swamp!.segZ).toBeCloseTo(cellNear * 2, 0);
  });
});

describe('mountainChunks', () => {
  const vertices = (p: Patch) => (p.segX + 1) * (p.rows ? p.rows.length : p.segZ + 1);

  it('tiles the mountains in 4 chunks with riser rows and a 16 × 16 silhouette', () => {
    for (const segments of [160, 200, 240]) {
      const cell = WORLD_SIZE / segments;
      const chunks = mountainChunks(segments);
      expect(chunks.length).toBe(4);
      expect(chunks[0]!.detail.x0).toBe(MOUNTAINS.x0);
      expect(chunks[3]!.detail.x1).toBe(MOUNTAINS.x1);
      chunks.slice(1).forEach((c, i) => expect(c.detail.x0).toBe(chunks[i]!.detail.x1));
      for (const c of chunks) {
        expect((c.detail.x1 - c.detail.x0) / c.detail.segX).toBeCloseTo(cell, 5);
        const rows = c.detail.rows!;
        expect(rows[0]).toBe(MOUNTAINS.z0);
        expect(rows[rows.length - 1]).toBe(MOUNTAINS.z1);
        for (let i = 1; i < rows.length; i++) {
          expect(rows[i]!).toBeGreaterThan(rows[i - 1]!);
          const d = -HALF - rows[i - 1]!;
          expect(rows[i]! - rows[i - 1]!).toBeLessThanOrEqual((d <= MOUNTAINS.faldas ? cell : cell * 2) + 1e-6);
        }
        for (let k = 0; k < PELDANOS.steps; k++)
          for (const d of [PELDANOS.first + PELDANOS.pitch * k, PELDANOS.first + PELDANOS.pitch * k + PELDANOS.run]) expect(rows.some((z) => Math.abs(z - (-HALF - d)) < 1e-9)).toBe(true);
        expect(c.silhouette).toMatchObject({ segX: 16, segZ: 16, x0: c.detail.x0, x1: c.detail.x1 });
      }
      const detail = chunks.reduce((n, c) => n + vertices(c.detail), 0);
      const sil = chunks.reduce((n, c) => n + vertices(c.silhouette), 0);
      console.info(`mountains @${segments}: detail ${detail} vertices (${vertices(chunks[0]!.detail)} per chunk), silhouette ${sil}`);
      expect(detail).toBeLessThan(segments === 160 ? 9000 : 20000); // low tier: ≤ +28 % of the ~32 600 base, only near the mountains
    }
  });

  it('shows detail within MOUNTAIN_LOD of the player', () => {
    const c = mountainChunks(160)[1]!; // x from −120 to 0
    expect(chunkDetailed(c, -60, -HALF - 100)).toBe(true);
    expect(chunkDetailed(c, -60, -HALF + MOUNTAIN_LOD - 10)).toBe(true);
    expect(chunkDetailed(c, -60, -HALF + MOUNTAIN_LOD + 10)).toBe(false);
    expect(chunkDetailed(c, 170, -HALF - 100)).toBe(false);
  });
});

describe('corruptChunks (S5-A)', () => {
  const vertices = (p: Patch) => (p.segX + 1) * (p.rows ? p.rows.length : p.segZ + 1);

  it('tiles las Tierras in 4 chunks, fine on el Borde and los Escalones, silhouettes 16 × 16', () => {
    const steps = corruptFeatures(42).steps;
    for (const segments of [160, 200, 240]) {
      const cell = WORLD_SIZE / segments;
      const chunks = corruptChunks(segments, steps);
      const mountains = mountainChunks(segments);
      expect(chunks.length).toBe(4);
      expect(chunks[0]!.detail.x0).toBe(CORRUPT_LANDS.x0);
      expect(chunks[3]!.detail.x1).toBe(CORRUPT_LANDS.x1);
      chunks.forEach((c, i) => {
        expect(c.detail.segX).toBe(mountains[i]!.detail.segX); // the seam matches
        const rows = c.detail.rows!;
        expect(rows[0]).toBe(CORRUPT_LANDS.z0);
        expect(rows[rows.length - 1]).toBe(CORRUPT_LANDS.z1);
        for (let j = 1; j < rows.length; j++) {
          expect(rows[j]!).toBeGreaterThan(rows[j - 1]!);
          const d = CORRUPT_LANDS.z1 - rows[j]!;
          expect(rows[j]! - rows[j - 1]!).toBeLessThanOrEqual((d < CORRUPT_LANDS.rim ? cell : cell * 2) + 1e-6);
        }
        for (let k = 0; k < steps.steps; k++)
          for (const d of [steps.d0 + steps.pitch * k, steps.d0 + steps.pitch * k + steps.run]) expect(rows.some((z) => Math.abs(z - (CORRUPT_LANDS.z1 - d)) < 1e-9)).toBe(true);
        expect(c.silhouette).toMatchObject({ segX: 16, segZ: 16, x0: c.detail.x0, x1: c.detail.x1 });
      });
      const detail = chunks.reduce((n, c) => n + vertices(c.detail), 0);
      console.info(`tierras @${segments}: detail ${detail} vertices (${vertices(chunks[0]!.detail)} per chunk), silhouette ${chunks.reduce((n, c) => n + vertices(c.silhouette), 0)}`);
      expect(detail).toBeLessThan(segments === 160 ? 10000 : 22000);
    }
  });

  it('are hidden from the south unless flying', () => {
    expect(corruptVisible(0, false)).toBe(false);
    expect(corruptVisible(-HALF - 50, false)).toBe(false);
    expect(corruptVisible(0, true)).toBe(true);
    expect(corruptVisible(CORRUPT_SHOW_Z - 1, false)).toBe(true);
  });
});
