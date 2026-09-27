import { describe, expect, it } from 'vitest';
import { gustDir, inGust, slide, VIENTO } from './viento';

describe('viento', () => {
  const dir = gustDir(0, 0, 0, 2);
  it('the cone reaches 8 m ahead and 35° to each side', () => {
    expect(inGust(0, 0, dir, 0, 7)).toBe(true);
    expect(inGust(0, 0, dir, 0, 9)).toBe(false);
    expect(inGust(0, 0, dir, Math.sin(0.7) * 5, Math.cos(0.7) * 5)).toBe(false); // 40°
    expect(inGust(0, 0, dir, Math.sin(0.5) * 5, Math.cos(0.5) * 5)).toBe(true); // ~29°
    expect(inGust(0, 0, dir, 0, -3)).toBe(false);
  });
  it('slides along the direction', () => {
    const d = gustDir(1, 1, 4, 5);
    const p = slide(1, 1, d, VIENTO.slide);
    expect(Math.hypot(p.x - 1, p.z - 1)).toBeCloseTo(6);
    expect(p.x).toBeCloseTo(1 + 0.6 * 6);
    expect(gustDir(2, 2, 2, 2)).toEqual({ x: 0, z: 1 });
  });
});
