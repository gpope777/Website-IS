import { describe, expect, it } from 'vitest';
import { coastFeatures, createTerrain, HALF } from '../../shared/terrain';
import { FISH } from '../../shared/fish';
import { bakeWaterMap, underwater, WATER_MAP, WAVES, waveHeight } from './water-data';

const t = createTerrain(42);
const SIZE = 128;
const map = bakeWaterMap(t, 42, SIZE);
function texel(x: number, z: number): [number, number, number] {
  const i = Math.floor(((x - WATER_MAP.x0) / (WATER_MAP.x1 - WATER_MAP.x0)) * SIZE);
  const j = Math.floor(((z - WATER_MAP.z0) / (WATER_MAP.z1 - WATER_MAP.z0)) * SIZE);
  const k = (j * SIZE + i) * 4;
  return [map[k]!, map[k + 1]!, map[k + 2]!];
}

describe('water map', () => {
  it('is deterministic and sized', () => {
    expect(map.length).toBe(SIZE * SIZE * 4);
    expect(bakeWaterMap(t, 42, SIZE)).toEqual(map);
  });

  it('has no depth on the forest floor and grows from the beach to the open sea', () => {
    expect(texel(0, 0)[0]).toBe(0);
    const beach = texel(0, HALF + 40)[0];
    const shallows = texel(0, HALF + 70)[0];
    const sea = texel(0, HALF + 150)[0];
    expect(shallows).toBeGreaterThanOrEqual(beach);
    expect(sea).toBeGreaterThan(shallows);
  });

  it('flags the swamp and the aguas bravas', () => {
    expect(texel(-340, 160)[1]).toBe(255);
    expect(texel(0, 330)[1]).toBe(0);
    const { island } = coastFeatures(42);
    expect(texel(island.x + island.r + FISH.bravas / 2, island.z)[2]).toBe(255);
    expect(texel(0, 60)[2]).toBe(0);
  });
});

describe('waves and underwater', () => {
  it('stays within the amplitude and is calmer in the swamp', () => {
    let sea = 0;
    let swamp = 0;
    for (let i = 0; i < 200; i++) {
      sea = Math.max(sea, Math.abs(waveHeight(i * 3.7, 300 + i, i * 0.31)));
      swamp = Math.max(swamp, Math.abs(waveHeight(-340 + i * 0.4, 160 + i * 2.1, i * 0.31)));
    }
    expect(sea).toBeLessThanOrEqual(WAVES.amp + 1e-9);
    expect(sea).toBeGreaterThan(WAVES.amp * 0.5);
    expect(swamp).toBeLessThanOrEqual(WAVES.amp * WAVES.swampK + 1e-9);
  });

  it('knows when the camera is below the surface', () => {
    expect(underwater(-9, -3.2)).toBe(true);
    expect(underwater(-3.2, -3.2)).toBe(false);
    expect(underwater(2, -3.2)).toBe(false);
  });
});
