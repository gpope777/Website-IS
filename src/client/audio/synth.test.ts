import { describe, expect, it } from 'vitest';
import { MAX_SFX_SECONDS, renderSfx, sfxLength, type SfxDef } from './synth';
import { SFX, SFX_IDS } from './sfx';

const RATE = 22050;
const crossings = (a: Float32Array) => {
  let c = 0;
  for (let i = 1; i < a.length; i++) if ((a[i - 1]! < 0) !== (a[i]! < 0)) c++;
  return c;
};

describe('renderSfx', () => {
  const tone: SfxDef = { wave: 'sine', freq: 440, attack: 0.01, sustain: 0.1, decay: 0.1, vol: 0.5 };
  it('renders the right length, peak = vol', () => {
    const a = renderSfx(tone, RATE);
    expect(a.length).toBe(Math.ceil(0.21 * RATE));
    const peak = Math.max(...Array.from(a, Math.abs));
    expect(peak).toBeCloseTo(0.5, 3);
  });
  it('is deterministic per seed; noise differs from sine', () => {
    const n: SfxDef = { ...tone, wave: 'noise', freq: 4000 };
    expect(renderSfx(n, RATE, 7)).toEqual(renderSfx(n, RATE, 7));
    expect(renderSfx(n, RATE, 7)).not.toEqual(renderSfx(n, RATE, 8));
    expect(crossings(renderSfx(n, RATE))).toBeGreaterThan(crossings(renderSfx(tone, RATE)));
  });
  it('low-pass removes high-frequency content', () => {
    const n: SfxDef = { ...tone, wave: 'noise', freq: 20000 };
    expect(crossings(renderSfx({ ...n, lp: 300 }, RATE))).toBeLessThan(crossings(renderSfx(n, RATE)) / 2);
  });
  it('echo lengthens the sound', () => {
    expect(sfxLength({ ...tone, echo: 0.1 })).toBeCloseTo(0.31);
  });
});

describe('SFX table', () => {
  it('has ~40 effects covering every group of §4.2', () => {
    expect(SFX_IDS.length).toBeGreaterThanOrEqual(38);
    for (const id of ['paso-hierba', 'paso-arena', 'paso-roca', 'paso-nieve', 'paso-agua', 'parada', 'enredadera', 'viento', 'fuego', 'piedra', 'lobo-aviso', 'doma-tic', 'galope', 'boton', 'no', 'cuerno', 'marchito', 'latido', 'orbe', 'zona-limpia']) expect(SFX_IDS).toContain(id);
  });
  it.each(SFX_IDS)('%s renders: non-silent, ≤ 0.6 s, peak ≤ 1, finite', (id) => {
    const d = SFX[id];
    expect(sfxLength(d)).toBeLessThanOrEqual(MAX_SFX_SECONDS + 1e-9);
    const a = renderSfx(d, RATE);
    let peak = 0;
    for (const v of a) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });
  it('tells are class tell', () => {
    for (const id of SFX_IDS) {
      const d = SFX[id] as { tell?: true; cls: string };
      if (d.tell) expect(d.cls).toBe('tell');
    }
  });
});
