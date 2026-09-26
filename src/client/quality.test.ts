import { describe, expect, it } from 'vitest';
import { pickTier } from './quality';

describe('pickTier', () => {
  it('keeps most phones on low', () => {
    expect(pickTier({ touch: true })).toBe('low');
    expect(pickTier({ touch: true, memoryGb: 4, cores: 8 })).toBe('low');
  });

  it('lets strong phones/tablets use medium', () => {
    expect(pickTier({ touch: true, memoryGb: 8, cores: 8 })).toBe('medium');
  });

  it('gives integrated GPUs medium and real GPUs high', () => {
    expect(pickTier({ touch: false, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620)' })).toBe('medium');
    expect(pickTier({ touch: false, gpu: 'ANGLE (NVIDIA, GeForce RTX 3060)' })).toBe('high');
    expect(pickTier({ touch: false })).toBe('high');
  });
});
