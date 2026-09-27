import { describe, expect, it } from 'vitest';
import { BOW_RELEASE_S, POSE_ANIMS, poseFor, ROLL_S } from './poses';

describe('procedural poses', () => {
  it('only the six missing anims get a pose', () => {
    for (const a of POSE_ANIMS) expect(poseFor(a, 0.1)).not.toBeNull();
    for (const a of ['idle', 'walk', 'run', 'attack', 'dead', 'jump', 'swim']) expect(poseFor(a, 0.1)).toBeNull();
  });

  it('roll spins the robot once in 0.45 s, tucked, then lets go', () => {
    expect(poseFor('roll', 0)!.rootX).toBe(0);
    expect(poseFor('roll', ROLL_S / 2)!.rootX).toBeCloseTo(Math.PI);
    expect(poseFor('roll', ROLL_S * 0.99)!.rootX).toBeGreaterThan(Math.PI * 1.9);
    expect(poseFor('roll', ROLL_S / 2)!.bones.LowerLegL![0]).toBeGreaterThan(1); // knees bent
    expect(poseFor('roll', ROLL_S + 0.1)!.rootX).toBe(0);
    expect(Object.keys(poseFor('roll', ROLL_S + 0.1)!.bones)).toHaveLength(0);
  });

  it('block crosses the arms in front and leans the torso 10°', () => {
    const b = poseFor('block', 1)!;
    expect(b.bones.Torso![0]).toBeCloseTo((10 * Math.PI) / 180, 1);
    for (const n of ['UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR']) expect(b.bones[n]).toBeDefined();
  });

  it('bow opens the right hand only right after the shot', () => {
    const early = poseFor('bow', BOW_RELEASE_S / 2)!.bones;
    const late = poseFor('bow', 1)!.bones;
    expect(early.UpperArmR![2]).not.toBe(late.UpperArmR![2]);
    expect(early.UpperArmL).toEqual(late.UpperArmL);
  });

  it('climb alternates the arms with time and leans into the wall', () => {
    const a = poseFor('climb', 0.1)!.bones;
    const b = poseFor('climb', 0.7)!.bones;
    expect(a.UpperArmL![0]).not.toBeCloseTo(b.UpperArmL![0]);
    expect(Math.sign(a.UpperArmL![0] - a.UpperArmR![0])).toBe(-Math.sign(b.UpperArmL![0] - b.UpperArmR![0]));
    expect(a.Torso![0]).toBeCloseTo((25 * Math.PI) / 180, 1);
  });

  it('slide lies the body down and glide spreads the arms', () => {
    expect(poseFor('slide', 0.5)!.rootX).toBeGreaterThan(1.2);
    const g = poseFor('glide', 0.5)!.bones;
    expect(g.UpperLegL![0]).toBeGreaterThan(0); // legs trail behind
  });
});
