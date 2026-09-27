import { describe, expect, it } from 'vitest';
import { createTerrain, HALF, mountainFeatures } from './terrain';
import { inChute, slideDir, slideMoveOk, snowAt, SNOWSLIDE } from './snowslide';

const t = createTerrain(42);
const pico = mountainFeatures(42).pico;

describe('tobogán de nieve (S4-H)', () => {
  it('the chute is the packed band down the middle of the mountains', () => {
    expect(inChute(0, -HALF - 50)).toBe(true);
    expect(inChute(20, -HALF - 50)).toBe(false);
    expect(inChute(0, -HALF + 10)).toBe(false);
  });
  it('snow: high ground and the chute, not the Faldas nor the forest', () => {
    expect(snowAt(t, pico.x, pico.z)).toBe(true);
    expect(snowAt(t, 0, -HALF - 60)).toBe(true);
    expect(snowAt(t, 40, -HALF - 60)).toBe(false);
    expect(snowAt(t, 0, 0)).toBe(false);
  });
  it('slides south in the chute and downhill elsewhere', () => {
    expect(slideDir(t, 0, -HALF - 60)).toEqual({ x: 0, z: 1 });
    const d = slideDir(t, pico.x - 15, pico.z); // west of the Pico (east of it is the chute)
    expect(d.x).toBeLessThan(-0.5);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 5);
  });
  it('server check: both ends on snow and not uphill', () => {
    expect(slideMoveOk(t, 0, -HALF - 70, 0, -HALF - 56)).toBe(true);
    expect(slideMoveOk(t, 0, -HALF - 140, 0, -HALF - 165)).toBe(false); // up the Pico's skirt
    expect(slideMoveOk(t, 40, -HALF - 70, 40, -HALF - 56)).toBe(false);
    expect(SNOWSLIDE.maxSpeed).toBe(16);
  });
});
