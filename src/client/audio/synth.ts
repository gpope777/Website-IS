/** P7-B (spec §4.1): a tiny zzfx-style effect synth, written here. Pure: params → samples. */
export type Wave = 'sine' | 'square' | 'saw' | 'tri' | 'noise';

export interface SfxDef {
  wave: Wave;
  /** Start frequency (Hz). */
  freq: number;
  /** Frequency change per second, as a ratio exponent: f(t) = freq · 2^(slide·t). */
  slide?: number;
  attack: number;
  sustain: number;
  decay: number;
  /** 0–1. */
  vol: number;
  /** One-pole low-pass cutoff (Hz). */
  lp?: number;
  /** One-pole high-pass cutoff (Hz). */
  hp?: number;
  /** Tremolo rate (Hz), depth 0.5. */
  trem?: number;
  /** Vibrato rate (Hz), ±3 %. */
  vib?: number;
  /** 0–1 of noise mixed into a tonal wave. */
  noise?: number;
  /** Extra oscillators at these frequency ratios (chords, dissonance). */
  chord?: number[];
  /** One repeat this many seconds later, at 0.35. */
  echo?: number;
}

export const MAX_SFX_SECONDS = 0.6;

export function sfxLength(d: SfxDef): number {
  return d.attack + d.sustain + d.decay + (d.echo ?? 0);
}

function osc(w: Wave, ph: number, rnd: () => number): number {
  const p = ph - Math.floor(ph);
  switch (w) {
    case 'sine':
      return Math.sin(p * 2 * Math.PI);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'saw':
      return 2 * p - 1;
    case 'tri':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'noise':
      return rnd() * 2 - 1;
  }
}

/** Deterministic LCG in [0, 1). */
export function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Renders one effect to mono samples at `rate`; the peak is normalised to `vol` (≤ 1). */
export function renderSfx(d: SfxDef, rate: number, seed = 1): Float32Array {
  const body = d.attack + d.sustain + d.decay;
  const n = Math.max(1, Math.ceil(sfxLength(d) * rate));
  const bodyN = Math.ceil(body * rate);
  const out = new Float32Array(n);
  const rnd = lcg(seed);
  const ratios = [1, ...(d.chord ?? [])];
  const phases = ratios.map(() => 0);
  const lpA = d.lp ? 1 - Math.exp((-2 * Math.PI * d.lp) / rate) : 1;
  const hpA = d.hp ? Math.exp((-2 * Math.PI * d.hp) / rate) : 0;
  let lpY = 0;
  let hpY = 0;
  let hpX = 0;
  // Noise held for a few samples at low "freq" makes rumble; at high freq it is hiss.
  let held = 0;
  let holdLeft = 0;
  for (let i = 0; i < bodyN && i < n; i++) {
    const t = i / rate;
    let f = d.freq * Math.pow(2, (d.slide ?? 0) * t);
    if (d.vib) f *= 1 + 0.03 * Math.sin(2 * Math.PI * d.vib * t);
    let s = 0;
    for (let k = 0; k < ratios.length; k++) {
      phases[k]! += (f * ratios[k]!) / rate;
      if (d.wave === 'noise') {
        if (k === 0) {
          if (holdLeft <= 0) {
            held = rnd() * 2 - 1;
            holdLeft = Math.max(1, rate / Math.max(1, f));
          }
          holdLeft--;
          s += held;
        }
      } else s += osc(d.wave, phases[k]!, rnd);
    }
    s /= d.wave === 'noise' ? 1 : ratios.length;
    if (d.noise) s = s * (1 - d.noise) + (rnd() * 2 - 1) * d.noise;
    let env: number;
    if (t < d.attack) env = t / d.attack;
    else if (t < d.attack + d.sustain) env = 1;
    else env = Math.max(0, 1 - (t - d.attack - d.sustain) / Math.max(1e-4, d.decay));
    if (d.trem) env *= 1 - 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * d.trem * t));
    s *= env;
    lpY += lpA * (s - lpY);
    s = lpY;
    if (d.hp) {
      const y = hpA * (hpY + s - hpX);
      hpX = s;
      hpY = y;
      s = y;
    }
    out[i] = s;
  }
  if (d.echo) {
    const off = Math.round(d.echo * rate);
    for (let i = n - 1; i >= off; i--) out[i]! += out[i - off]! * 0.35;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) if (Number.isFinite(out[i]!)) peak = Math.max(peak, Math.abs(out[i]!));
  const k = peak > 0 ? Math.min(1, d.vol) / peak : 0;
  for (let i = 0; i < n; i++) out[i] = Number.isFinite(out[i]!) ? out[i]! * k : 0;
  return out;
}
