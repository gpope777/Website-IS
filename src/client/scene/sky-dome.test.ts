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
