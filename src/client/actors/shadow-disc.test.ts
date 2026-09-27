import { describe, expect, it } from 'vitest';
import { shadowDisc } from './actor';

describe('shadow disc (V2-B, low tier)', () => {
  it('shares one geometry and material, lies flat, never writes depth', () => {
    const a = shadowDisc();
    const b = shadowDisc(1.2);
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).toBe(b.material);
    expect(b.scale.x).toBe(1.2);
    a.geometry.computeBoundingBox();
    expect(a.geometry.boundingBox!.max.y - a.geometry.boundingBox!.min.y).toBeCloseTo(0);
    expect((a.material as { depthWrite: boolean }).depthWrite).toBe(false);
  });
});
