import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeOf, biomeWeights, easeLook, hourMix, HOURS, lookAt, LOOKS, newLook } from './looks';

const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const only = (b: (typeof BIOMES)[number]) => ({ [b]: 1 });

describe('BiomeLook (V2-B, spec §4)', () => {
  it('every biome has the four hours', () => {
    for (const b of BIOMES) expect(Object.keys(LOOKS[b]).sort()).toEqual(['alba', 'dia', 'noche', 'ocaso']);
  });

  it('nights are truly dark, days bright', () => {
    for (const b of BIOMES) {
      const n = lookAt(only(b), 0);
      const d = lookAt(only(b), 0.5);
      expect(lum(n.zenith)).toBeLessThan(0.02);
      expect(n.hemiI).toBeLessThanOrEqual(0.1);
      expect(n.moonI).toBeCloseTo(0.35);
      expect(n.sunI).toBe(0);
      expect(lum(d.horizon)).toBeGreaterThan(lum(n.horizon) * 5);
      expect(d.sunI).toBeGreaterThan(1);
    }
  });

  it('at a key hour the look is the key; midway it is between', () => {
    const d = lookAt(only('costa'), HOURS.dia);
    expect(d.horizon.getHex()).toBe(new THREE.Color(LOOKS.costa.dia.horizon).getHex());
    const mid = lookAt(only('bosque'), 0.375);
    expect(mid.sunI).toBeGreaterThan(LOOKS.bosque.alba.sunI);
    expect(mid.sunI).toBeLessThan(LOOKS.bosque.dia.sunI);
  });

  it('wraps from late night to midnight smoothly', () => {
    expect(hourMix(0.999).b).toBe('noche');
    const a = lookAt(only('bosque'), 0.999);
    const b = lookAt(only('bosque'), 0.001);
    expect(Math.abs(a.hemiI - b.hemiI)).toBeLessThan(0.01);
  });

  it('the pantano sun is weaker than the costa sun', () => {
    expect(lookAt(only('pantano'), 0.5).sunI).toBeLessThan(lookAt(only('costa'), 0.5).sunI);
  });

  it('biomes at the harness stops', () => {
    expect(biomeOf(0, 60)).toBe('bosque');
    expect(biomeOf(0, 275)).toBe('costa');
    expect(biomeOf(-340, 160)).toBe('pantano');
    expect(biomeOf(20, -300)).toBe('montanas');
    expect(biomeOf(0, -560)).toBe('tierras');
  });

  it('weights sum to 1 and blend at a border', () => {
    for (const [x, z] of [[0, 60], [0, 240], [0, -241]] as const) {
      const w = biomeWeights(x, z);
      expect(Object.values(w).reduce((a, b) => a + b!, 0)).toBeCloseTo(1);
    }
    expect(Object.keys(biomeWeights(0, 240)).length).toBe(2);
    expect(Object.keys(biomeWeights(0, 60))).toEqual(['bosque']);
  });

  it('easing moves toward the target without jumping', () => {
    const cur = lookAt(only('bosque'), 0.5);
    const target = lookAt(only('tierras'), 0.5);
    const before = cur.horizon.getHex();
    easeLook(cur, target, 0.1);
    expect(cur.horizon.getHex()).not.toBe(before);
    expect(cur.horizon.getHex()).not.toBe(target.horizon.getHex());
    for (let i = 0; i < 200; i++) easeLook(cur, target, 0.1);
    expect(cur.sunI).toBeCloseTo(target.sunI, 3);
    expect(newLook().sunI).toBe(0);
  });
});
