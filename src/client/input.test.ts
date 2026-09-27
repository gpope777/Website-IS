import { describe, expect, it } from 'vitest';
import { clearHold, KEY_ACTIONS, readMove, type InputState } from './input';

const base: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };

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
    const i: InputState = { forward: true, back: true, left: true, right: true, sprint: true, jump: true, block: true, axis: { x: 1, z: 1 } };
    clearHold(i);
    expect(i).toEqual({ forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false, axis: { x: 1, z: 1 } });
  });
});

describe('combat keys', () => {
  it('maps Q/R/X to roll, bow and lock', () => {
    expect(KEY_ACTIONS.KeyQ).toBe('roll');
    expect(KEY_ACTIONS.KeyR).toBe('bow');
    expect(KEY_ACTIONS.KeyX).toBe('lock');
  });
});

describe('power key', () => {
  it('H casts the power', () => {
    expect(KEY_ACTIONS.KeyH).toBe('power');
  });
});

describe('mount key', () => {
  it('M gets on or off the deer', () => {
    expect(KEY_ACTIONS.KeyM).toBe('mount');
  });
});

describe('vision key', () => {
  it('Enter dismisses a vision', () => {
    expect(KEY_ACTIONS.Enter).toBe('dismiss');
  });
});

describe('power switching (S2-F)', () => {
  it('J and the held pill switch; H casts', async () => {
    const { nextPower } = await import('./input');
    expect(KEY_ACTIONS.KeyJ).toBe('switch');
    expect(KEY_ACTIONS.TouchSwitch).toBe('switch');
    expect(KEY_ACTIONS.KeyH).toBe('power');
    expect(nextPower('enredadera', { enredadera: true, viento: true })).toBe('viento');
    expect(nextPower('viento', { enredadera: true, viento: true })).toBe('enredadera');
    expect(nextPower('enredadera', { enredadera: true, viento: false })).toBe('enredadera');
    expect(nextPower('enredadera', { enredadera: false, viento: true })).toBe('viento');
  });

  it('cycles through Fuego too, skipping powers you lack (S3-E)', async () => {
    const { nextPower, POWER_ICON } = await import('./input');
    const all = { enredadera: true, viento: true, fuego: true };
    expect(nextPower('viento', all)).toBe('fuego');
    expect(nextPower('fuego', all)).toBe('enredadera');
    expect(nextPower('enredadera', { enredadera: true, fuego: true })).toBe('fuego');
    expect(POWER_ICON.fuego).toBe('🔥');
  });
});
