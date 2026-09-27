import { describe, expect, it } from 'vitest';
import { FpsGuard, lowerTier, pickTier, probeVerdict, TIERS } from './quality';

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

describe('TierSettings (V2-A)', () => {
  it('never gives low more than medium, or medium more than high', () => {
    const [l, m, h] = [TIERS.low, TIERS.medium, TIERS.high];
    for (const k of Object.keys(l) as (keyof typeof l)[]) {
      const [a, b, c] = [Number(l[k]), Number(m[k]), Number(h[k])];
      expect(a, k).toBeLessThanOrEqual(b);
      expect(b, k).toBeLessThanOrEqual(c);
    }
  });

  it('has a shadow radius exactly when it has shadows', () => {
    for (const t of Object.values(TIERS)) expect(t.shadowRadius > 0).toBe(t.shadows);
  });

  it('steps down one tier at a time', () => {
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('medium')).toBe('low');
    expect(lowerTier('low')).toBeNull();
  });
});

const frames = (n: number, ms: number, first = 100) => Array.from({ length: n }, (_, i) => (i < 20 ? first : ms));

describe('probeVerdict', () => {
  it('ignores the first 20 frames', () => {
    expect(probeVerdict(frames(80, 16, 500), 'medium', false)).toBe('keep');
  });
  it('steps a slow medium or high down', () => {
    expect(probeVerdict(frames(80, 40), 'medium', false)).toBe('down');
    expect(probeVerdict(frames(80, 40), 'high', true)).toBe('down');
  });
  it('has nothing below low', () => {
    expect(probeVerdict(frames(80, 40), 'low', true)).toBe('keep');
  });
  it('only offers medium to a fast phone, never raises by itself', () => {
    expect(probeVerdict(frames(80, 10), 'low', true)).toBe('offer');
    expect(probeVerdict(frames(80, 10), 'low', false)).toBe('keep');
  });
  it('keeps with too few frames', () => {
    expect(probeVerdict(frames(20, 40), 'high', false)).toBe('keep');
  });
});

/** Feeds `secs` of frames at `fps`, from `t0`; returns the actions and the end time. */
function run(g: FpsGuard, fps: number, secs: number, t0: number) {
  const out = [];
  let t = t0;
  for (let i = 0; i < secs * fps; i++) {
    t += 1 / fps;
    const a = g.feed(1 / fps, t);
    if (a) out.push({ ...a, t });
  }
  return { out, t };
}

describe('FpsGuard', () => {
  it('does nothing at 60 fps', () => {
    expect(run(new FpsGuard('low', 1), 60, 120, 0).out).toEqual([]);
  });

  it('on low lowers the pixel ratio in 0.85 steps to 0.7, one change a minute', () => {
    const { out } = run(new FpsGuard('low', 1), 15, 300, 0);
    expect(out.map((a) => a.kind)).toEqual(['ratio', 'ratio', 'ratio']);
    expect(out.map((a) => (a.kind === 'ratio' ? a.ratio : 0))).toEqual([0.85, 0.72, 0.7]);
    expect(out[0]!.t).toBeGreaterThanOrEqual(10);
    expect(out[1]!.t - out[0]!.t).toBeGreaterThanOrEqual(60);
    expect(out[2]!.t - out[1]!.t).toBeGreaterThanOrEqual(60);
  });

  it('on medium lowers the ratio once, then the tier', () => {
    const { out } = run(new FpsGuard('medium', 1.5), 15, 200, 0);
    expect(out[0]).toMatchObject({ kind: 'ratio', ratio: 1.28 });
    expect(out[1]).toMatchObject({ kind: 'tier', tier: 'low' });
    expect(out[1]!.t - out[0]!.t).toBeGreaterThanOrEqual(60);
  });

  it('ignores hidden-tab gaps', () => {
    const g = new FpsGuard('medium', 1.5);
    let t = 0;
    for (let i = 0; i < 30; i++) expect(g.feed(2, (t += 2))).toBeNull();
  });
});
