import { describe, expect, it } from 'vitest';
import { clearHold, readMove, type InputState } from './input';

const base: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

describe('readMove', () => {
  it('maps WASD to camera-relative input', () => {
    expect(readMove({ ...base, forward: true })).toEqual({ x: 0, z: -1, sprint: false, jump: false });
    expect(readMove({ ...base, right: true, back: true, sprint: true })).toEqual({ x: 1, z: 1, sprint: true, jump: false });
  });

  it('prefers the analog stick', () => {
    expect(readMove({ ...base, forward: true, axis: { x: 0.3, z: -0.5 } })).toEqual({ x: 0.3, z: -0.5, sprint: false, jump: false });
  });
});

describe('clearHold', () => {
  it('zeroes every held movement/action flag but leaves the analog stick alone', () => {
    const i: InputState = { forward: true, back: true, left: true, right: true, sprint: true, jump: true, axis: { x: 1, z: 1 } };
    clearHold(i);
    expect(i).toEqual({ forward: false, back: false, left: false, right: false, sprint: false, jump: false, axis: { x: 1, z: 1 } });
  });
});
