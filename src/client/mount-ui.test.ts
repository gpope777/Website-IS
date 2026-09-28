import { describe, expect, it } from 'vitest';
import { mountAction, ringNeedle, type MountCtx } from './mount-ui';

const base: MountCtx = { pos: { x: 0, z: 0 }, tame: null, riding: false, hasSteed: false, steeds: [], me: 'Ana', seat: null, riders: [] };
const wild = { owner: null, x: 1, y: 0, z: 0, yaw: 0 };
const mine = { owner: 'Ana', x: 2, y: 0, z: 0, yaw: 0 };
const tame = { round: 0, rounds: 3, start: 10, speed: 2, zone: 1, width: 1, beast: 'deer' as const };

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

describe('the giant fish', () => {
  const wildFish = { owner: null, x: 2, y: 0, z: 0, yaw: 0 };
  const myFish = { owner: 'Ana', x: 3, y: 0, z: 0, yaw: 0 };
  it('tames the wild fish only without one', () => {
    expect(mountAction({ ...base, fishes: [wildFish] })).toEqual({ act: 6, label: 'Domar al pez' });
    expect(mountAction({ ...base, hasFish: true, fishes: [wildFish] })).toBeNull();
    expect(mountAction({ ...base, racing: true, fishes: [wildFish] })).toBeNull();
  });
  it('gets on your fish, and off only in shallow water', () => {
    expect(mountAction({ ...base, hasFish: true, fishes: [myFish] })).toEqual({ act: 7, label: 'Montar el pez' });
    expect(mountAction({ ...base, hasFish: true, onFish: true, shallow: true })).toEqual({ act: 8, label: 'Bajar del pez' });
    expect(mountAction({ ...base, hasFish: true, onFish: true, shallow: false })).toBeNull();
  });
});

describe('the whale', () => {
  const w = { x: 6, z: 0, yaw: 0, tamed: false, diving: false, seats: [null, null, null, null] };
  it('tames the wild whale from 10 m, not while it is under', () => {
    expect(mountAction({ ...base, whale: w })).toEqual({ act: 9, label: 'Domar la ballena' });
    expect(mountAction({ ...base, whale: { ...w, x: 12 } })).toBeNull();
    expect(mountAction({ ...base, whale: { ...w, diving: true } })).toBeNull();
  });
  it('boards the tamed whale from 5 m if a seat is free, and gets off', () => {
    const t = { ...w, x: 4, tamed: true };
    expect(mountAction({ ...base, whale: t })).toEqual({ act: 10, label: 'Subir a la ballena' });
    expect(mountAction({ ...base, whale: { ...t, x: 6 } })).toBeNull();
    expect(mountAction({ ...base, whale: { ...t, seats: ['a', 'b', 'c', 'd'] } })).toBeNull();
    expect(mountAction({ ...base, whale: t, whaleSeat: 2 })).toEqual({ act: 11, label: 'Bajar de la ballena' });
    expect(mountAction({ ...base, onFish: true, whale: t })).toEqual({ act: 10, label: 'Subir a la ballena' });
  });
});

describe('la Rana', () => {
  const wildFrog = { owner: null, x: 2, y: 0, z: 0, yaw: 0 };
  const myFrog = { owner: 'Ana', x: 3, y: 0, z: 0, yaw: 0 };
  it('tames the wild frog only without one, not while chasing', () => {
    expect(mountAction({ ...base, frogs: [wildFrog] })).toEqual({ act: 12, label: 'Domar a la rana' });
    expect(mountAction({ ...base, hasFrog: true, frogs: [wildFrog] })).toBeNull();
    expect(mountAction({ ...base, racing: true, frogs: [wildFrog] })).toBeNull();
  });
  it('gets on your frog and off anywhere', () => {
    expect(mountAction({ ...base, hasFrog: true, frogs: [myFrog] })).toEqual({ act: 13, label: 'Montar la rana' });
    expect(mountAction({ ...base, hasFrog: true, frogs: [{ ...myFrog, x: 9 }] })).toBeNull();
    expect(mountAction({ ...base, hasFrog: true, onFrog: true })).toEqual({ act: 14, label: 'Bajar de la rana' });
  });
});

describe('el Dragón', () => {
  const wildDragon = { owner: null, x: 20, y: 80, z: 0, yaw: 0 };
  const myDragon = { owner: 'Ana', x: 3, y: 0, z: 0, yaw: 0 };
  it('leaps from the Pico when the wild dragon is out and you have none', () => {
    expect(mountAction({ ...base, onPico: true, dragons: [wildDragon] })).toEqual({ act: 15, label: 'Saltar al dragón' });
    expect(mountAction({ ...base, onPico: true, dragons: [] })).toBeNull();
    expect(mountAction({ ...base, onPico: true, hasDragon: true, dragons: [wildDragon] })).toBeNull();
  });
  it('gets on your dragon; gets off only once landed', () => {
    expect(mountAction({ ...base, hasDragon: true, dragons: [myDragon] })).toEqual({ act: 16, label: 'Montar el dragón' });
    expect(mountAction({ ...base, hasDragon: true, dragons: [{ ...myDragon, x: 9 }] })).toBeNull();
    expect(mountAction({ ...base, hasDragon: true, onDragon: true, landed: true })).toEqual({ act: 17, label: 'Bajar del dragón' });
    expect(mountAction({ ...base, hasDragon: true, onDragon: true, landed: false })).toBeNull();
    expect(mountAction({ ...base, tame: { ...tame, beast: 'dragon' } })).toEqual({ act: 1, label: '¡Ahora!' });
  });
});

describe('la Estrella (S5-H)', () => {
  const star = { owner: null, x: 2, y: 0, z: 0, yaw: 0 };
  it('tames her when she is near and you have none; even with a deer', () => {
    expect(mountAction({ ...base, estrella: star })).toEqual({ act: 18, label: 'Domar la Estrella' });
    expect(mountAction({ ...base, hasSteed: true, estrella: star })).toEqual({ act: 18, label: 'Domar la Estrella' });
    expect(mountAction({ ...base, hasStar: true, hasSteed: true, estrella: star })).toBeNull();
    expect(mountAction({ ...base, estrella: { ...star, x: 9 } })).toBeNull();
  });
  it('gets off her by name', () => {
    expect(mountAction({ ...base, riding: true, hasSteed: true, hasStar: true })).toEqual({ act: 3, label: 'Bajar de la Estrella' });
  });
});
