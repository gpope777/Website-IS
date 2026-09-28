import { describe, expect, it } from 'vitest';
import { cloudNoise } from './sky-dome';

describe('cloud noise (V2-B)', () => {
  it('is deterministic, varied and tiles at the edges', () => {
    const a = cloudNoise(64);
    expect(cloudNoise(64)).toEqual(a);
    const vals = new Set<number>();
    for (let i = 0; i < a.length; i += 4) vals.add(a[i]!);
    expect(vals.size).toBeGreaterThan(50);
    // Column 63 flows into column 0: neighbours differ little.
    let jump = 0;
    for (let y = 0; y < 64; y++) jump = Math.max(jump, Math.abs(a[(y * 64 + 63) * 4]! - a[(y * 64) * 4]!));
    expect(jump).toBeLessThan(40);
  });
});

describe('the moon (P7-E)', () => {
  it('is bigger and brighter on full-moon nights (día % 8 === 0)', async () => {
    const { moonLook } = await import('./sky-dome');
    const full = moonLook(8);
    const plain = moonLook(9);
    expect(plain).toEqual({ size: 1, glow: 1 });
    expect(full.size).toBeGreaterThan(2);
    expect(full.glow).toBeGreaterThan(plain.glow);
    expect(moonLook(0)).toEqual(full);
    expect(moonLook(16)).toEqual(full);
  });
});
