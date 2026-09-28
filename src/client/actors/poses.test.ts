import { describe, expect, it } from 'vitest';
import { POSE_ANIMS, poseFor } from './poses';

describe('procedural poses', () => {
  it('only the three missing anims get a pose (spec §1.1: roll/block/bow now have real clips)', () => {
    for (const a of ['climb', 'glide', 'slide']) expect(poseFor(a, 0.1)).not.toBeNull();
    for (const a of ['idle', 'walk', 'run', 'attack1', 'dead', 'jump', 'swim', 'roll', 'block', 'bow']) expect(poseFor(a, 0.1)).toBeNull();
  });

  it('climb alternates the arms with time and leans into the wall', () => {
    const a = poseFor('climb', 0.1)!.bones;
    const b = poseFor('climb', 0.7)!.bones;
    expect(a.upperarml![0]).not.toBeCloseTo(b.upperarml![0]);
    expect(Math.sign(a.upperarml![0] - a.upperarmr![0])).toBe(-Math.sign(b.upperarml![0] - b.upperarmr![0]));
    expect(a.chest![0]).toBeCloseTo((25 * Math.PI) / 180, 1);
  });

  it('slide lies the body down and glide spreads the arms', () => {
    expect(poseFor('slide', 0.5)!.rootX).toBeGreaterThan(1.2);
    const g = poseFor('glide', 0.5)!.bones;
    expect(g.upperlegl![0]).toBeGreaterThan(0); // legs trail behind
  });

  it('P7-E: slide lies on the ground', () => {
    const s = poseFor('slide', 0.5)!;
    expect(s.rootY).toBeLessThan(-0.4);
    expect(s.rootX).toBeGreaterThan(1.2);
  });

  it('POSE_ANIMS only lists climb/glide/slide', () => {
    expect(POSE_ANIMS).toEqual(['climb', 'glide', 'slide']);
  });
});
