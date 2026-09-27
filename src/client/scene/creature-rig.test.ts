import { describe, expect, it } from 'vitest';
import { buildCreature, deerPose, fishPose, frogPose, PART, PARTS, rigPoint, TRI_CAP, whalePose, type CreatureKind, type V3 } from './creature-rig';

const KINDS: CreatureKind[] = ['deer', 'fish', 'frog', 'whale'];

function bounds(k: CreatureKind) {
  const p = buildCreature(k).position;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) (lo[a] = Math.min(lo[a]!, p[i + a]!)), (hi[a] = Math.max(hi[a]!, p[i + a]!));
  return { w: hi[0]! - lo[0]!, h: hi[1]! - lo[1]!, l: hi[2]! - lo[2]!, top: hi[1]! };
}

describe('the procedural creatures', () => {
  it('stay under their triangle caps, with a colour and a valid part per vertex', () => {
    for (const k of KINDS) {
      const g = buildCreature(k);
      const n = g.position.length / 3;
      expect(n % 3).toBe(0);
      expect(n / 3).toBeLessThanOrEqual(TRI_CAP[k]);
      expect(n / 3).toBeGreaterThan(80);
      expect(g.color.length).toBe(g.position.length);
      expect(g.part.length).toBe(n);
      expect(g.pivots.length).toBe(PARTS);
      for (const p of g.part) expect(p >= 0 && p < PARTS && Number.isInteger(p)).toBe(true);
      expect(Array.from(g.position).every(Number.isFinite)).toBe(true);
    }
  });

  it('keeps the size of the boxes they replace (riders sit at the same height)', () => {
    const d = bounds('deer');
    expect(d.top).toBeGreaterThan(2.6); // antlers
    expect(d.top).toBeLessThan(3.4);
    expect(d.l).toBeGreaterThan(2);
    expect(d.l).toBeLessThan(3.2);
    const f = bounds('fish');
    expect(f.l).toBeGreaterThan(3);
    expect(f.l).toBeLessThan(4.5);
    const r = bounds('frog');
    expect(r.w).toBeGreaterThan(1.5);
    expect(r.w).toBeLessThan(2.4);
    const w = bounds('whale');
    expect(w.l).toBeGreaterThan(8);
    expect(w.l).toBeLessThan(12);
  });

  it('every part the deer uses is there', () => {
    const parts = new Set(buildCreature('deer').part);
    for (const p of [PART.body, PART.legFL, PART.legFR, PART.legBL, PART.legBR, PART.head, PART.tail]) expect(parts.has(p)).toBe(true);
  });
});

describe('fake bones', () => {
  const g = buildCreature('deer');
  it('a leg tip moves along Z when its leg swings, the body stays put', () => {
    const still = deerPose(0, 0, false, 0);
    const walk = deerPose(Math.PI / 2, 8, false, 0);
    const foot: V3 = [-0.24, 0.05, 0.62];
    const a = rigPoint(foot, PART.legFL, g, still);
    const b = rigPoint(foot, PART.legFL, g, walk);
    expect(Math.abs(b[2] - a[2])).toBeGreaterThan(0.3);
    const back: V3 = [0, 1.6, 0];
    const c = rigPoint(back, PART.body, g, walk);
    expect(Math.abs(c[2] - back[2])).toBeLessThan(1e-6);
    expect(Math.abs(c[0] - back[0])).toBeLessThan(1e-6);
  });

  it('diagonal pairs swing together and opposite to the other pair', () => {
    const p = deerPose(1, 8, false, 0);
    expect(p.rot[PART.legFL]![0]).toBeCloseTo(p.rot[PART.legBR]![0]);
    expect(p.rot[PART.legFR]![0]).toBeCloseTo(-p.rot[PART.legFL]![0]);
    expect(p.rot[PART.legBL]![0]).toBeCloseTo(p.rot[PART.legFR]![0]);
  });

  it('grazes when still, bucks while tamed', () => {
    const s = deerPose(0, 0, false, 0);
    expect(s.rot[PART.legFL]![0]).toBe(0);
    expect(s.rot[PART.head]![0]).toBeGreaterThan(0.15);
    const b = deerPose(0, 0, true, 0.1);
    expect(b.rot[PART.body]![0]).not.toBe(0);
    expect(b.lift).toBeGreaterThan(0);
  });

  it('the fish S-wave moves the tail sideways and speeds up with speed', () => {
    const f = buildCreature('fish');
    const tail: V3 = [0, 0.1, -1.3];
    const p = fishPose(1, 5, false, 0);
    const side = Math.max(...[0, 1, 2, 3, 4, 5].map((ph) => Math.abs(rigPoint(tail, PART.body, f, fishPose(ph, 5, false, 0))[0])));
    expect(side).toBeGreaterThan(0.08);
    expect(fishPose(0, 10, false, 0).wave[0]).toBeGreaterThan(fishPose(0, 0, false, 0).wave[0]);
    const nose: V3 = [0, 0.1, 1.9];
    expect(Math.abs(rigPoint(nose, PART.body, f, p)[0])).toBeLessThan(1e-6);
  });

  it('the frog kicks only while moving, its throat pulses only while wild', () => {
    expect(frogPose(false, false, false, 0.3).rot[PART.legBL]![0]).toBe(0);
    expect(frogPose(true, false, false, 0.2).rot[PART.legBL]![0]).toBeGreaterThan(0);
    expect(frogPose(false, false, false, 0.5).throat).toBe(1);
    expect(frogPose(false, true, false, 0.5).throat).toBeGreaterThan(1);
  });

  it('the whale waves its fluke', () => {
    expect(whalePose(1).rot[PART.tail]![0]).not.toBe(whalePose(2).rot[PART.tail]![0]);
  });
});
