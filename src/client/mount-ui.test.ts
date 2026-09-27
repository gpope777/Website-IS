import { describe, expect, it } from 'vitest';
import { mountAction, ringNeedle, type MountCtx } from './mount-ui';

const base: MountCtx = { pos: { x: 0, z: 0 }, tame: null, riding: false, hasSteed: false, steeds: [], me: 'Ana', seat: null, riders: [] };
const wild = { owner: null, x: 1, y: 0, z: 0, yaw: 0 };
const mine = { owner: 'Ana', x: 2, y: 0, z: 0, yaw: 0 };
const tame = { round: 0, rounds: 3, start: 10, speed: 2, zone: 1, width: 1 };

describe('mountAction', () => {
  it('tames the wild deer only without one of your own', () => {
    expect(mountAction({ ...base, steeds: [wild] })).toEqual({ act: 0, label: 'Domar al ciervo' });
    expect(mountAction({ ...base, steeds: [{ ...wild, x: 9 }] })).toBeNull();
    expect(mountAction({ ...base, hasSteed: true, steeds: [wild] })).toBeNull();
  });
  it('gets on your own deer, not somebody else’s', () => {
    expect(mountAction({ ...base, hasSteed: true, steeds: [mine] })).toEqual({ act: 2, label: 'Montar' });
    expect(mountAction({ ...base, hasSteed: true, steeds: [{ ...mine, owner: 'Leo' }] })).toBeNull();
  });
  it('taps while taming and gets off while riding', () => {
    expect(mountAction({ ...base, tame, steeds: [wild] })!.act).toBe(1);
    expect(mountAction({ ...base, riding: true, hasSteed: true })).toEqual({ act: 3, label: 'Bajar del ciervo' });
  });
});

describe('passenger seat', () => {
  const leo = { name: 'Leo', x: 2, z: 0, full: false };
  it('sits behind a nearby rider with a free seat, and gets off', () => {
    expect(mountAction({ ...base, riders: [leo] })).toEqual({ act: 4, label: 'Subir detrás de Leo' });
    expect(mountAction({ ...base, hasSteed: true, riders: [leo] })).toEqual({ act: 4, label: 'Subir detrás de Leo' });
    expect(mountAction({ ...base, riders: [{ ...leo, full: true }] })).toBeNull();
    expect(mountAction({ ...base, riders: [{ ...leo, x: 9 }] })).toBeNull();
    expect(mountAction({ ...base, riding: true, riders: [leo] })!.act).toBe(3);
    expect(mountAction({ ...base, seat: 'Leo' })).toEqual({ act: 5, label: 'Bajar' });
  });
});

describe('ringNeedle', () => {
  it('turns at the round speed from its start', () => {
    expect(ringNeedle(tame, 10)).toBeCloseTo(0);
    expect(ringNeedle(tame, 10.5)).toBeCloseTo(1);
  });
});
