import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeHat } from './hats';

describe('hats (P4-C)', () => {
  it('one mesh per hat (1 draw call), none for 0, shared geometry', () => {
    expect(makeHat(0)).toBeNull();
    for (let h = 1; h <= 9; h++) { // P4-D: +3 Proeza hats
      const m = makeHat(h)!;
      expect(m).toBeInstanceOf(THREE.Mesh);
      expect(m.children).toHaveLength(0);
      expect(Array.isArray(m.material)).toBe(false);
    }
    expect(makeHat(3)!.geometry).toBe(makeHat(3)!.geometry);
  });
});
