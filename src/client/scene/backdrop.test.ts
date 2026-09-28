import { describe, expect, it } from 'vitest';
import { beamOpacity, copaBackdrop, copaSkyline, STUMP_WHITE, stumpTint } from './backdrop';

describe('la Copa backdrop (P7-E)', () => {
  it('skyline: deterministic, in 0..1, mountains above the treeline, the Heart to the south', () => {
    const a = copaSkyline(7);
    expect(copaSkyline(7)).toEqual(a);
    expect(copaSkyline(8)).not.toEqual(a);
    for (const band of [a.mountains, a.forest]) {
      expect(band).toHaveLength(128);
      for (const h of band) expect(h >= 0 && h <= 1).toBe(true);
    }
    const avg = (b: number[]) => b.reduce((s, v) => s + v, 0) / b.length;
    expect(avg(a.mountains)).toBeGreaterThan(avg(a.forest) + 0.15);
    expect(a.spike.at).toBe(0.5);
    expect(a.spike.h).toBeGreaterThan(Math.max(...a.forest));
  });

  it('no DOM, no mesh (tests / workers)', () => {
    expect(copaBackdrop(0, 0, 0)).toBeNull();
  });
});

describe('Raíces-madre after the ending (P7-E)', () => {
  it('bark lerps to bone white; the beam fades', () => {
    expect(stumpTint(0x4a3322, 0)).toBe(0x4a3322);
    expect(stumpTint(0x4a3322, 1)).toBe(STUMP_WHITE);
    expect(stumpTint(0x4a3322, 2)).toBe(STUMP_WHITE);
    const mid = stumpTint(0x000000, 0.5);
    expect((mid >> 16) & 255).toBe(Math.round(0xe8 / 2));
    expect(beamOpacity(0.16, 0)).toBe(0.16);
    expect(beamOpacity(0.16, 1)).toBe(0);
  });
});
