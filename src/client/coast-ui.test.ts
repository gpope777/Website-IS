import { describe, expect, it } from 'vitest';
import { coastAction, rescueAction, shrinePartAt } from './coast-ui';
import type { Shrine } from '../shared/shrines';
import type { Chest } from '../shared/coast-shrines';

const chest: Chest = { id: 2, x: 10, y: -15, z: 300, loot: { wood: 7, pearl: 1 } };
const base = { pos: { x: 10, y: -14.5, z: 300 }, chests: [chest], opened: [] as number[], heart: null, pearls: 0, weapon: 0 };

describe('coastAction', () => {
  it('opens a chest you reach diving', () => {
    expect(coastAction(base)).toEqual({ t: 'chest', id: 2, label: 'Abrir el cofre' });
    expect(coastAction({ ...base, opened: [2] })).toBeNull();
    expect(coastAction({ ...base, pos: { x: 10, y: -3.5, z: 300 } })).toBeNull();
    expect(coastAction({ ...base, pos: { x: 15, y: -14.5, z: 300 } })).toBeNull();
  });

  it('offers the upgrade at the Heart with 3 pearls', () => {
    const at = { ...base, pos: { x: 0, y: 1, z: 0 }, heart: { x: 1, z: 1 } };
    expect(coastAction({ ...at, pearls: 2 })).toBeNull();
    expect(coastAction({ ...at, pearls: 3 })).toEqual({ t: 'upgrade', label: 'Mejorar el arma (3 perlas, 10 piedra, 5 madera)' });
    expect(coastAction({ ...at, pearls: 3, weapon: 3 })).toBeNull();
    expect(coastAction({ ...at, pearls: 3, heart: { x: 20, z: 0 } })).toBeNull();
  });
});

const mk = (id: number, kind: Shrine['kind'], parts: { x: number; z: number }[]): Shrine => ({ id, kind, x: 0, z: 0, y: 0, orb: { x: 0, y: 1.2, z: 0 }, parts, pillar: null });

describe('shrinePartAt', () => {
  it('picks up and drops the pumice block', () => {
    const s = mk(3, 'tide', [{ x: 12, z: 0 }, { x: -4, z: 0 }]);
    const v = [{ id: 3, open: false, parts: [false], block: { x: -4, z: 0, held: null } }];
    expect(shrinePartAt([s], v, [], { x: -4, y: 0, z: 0.5 }, 'Ana')).toMatchObject({ id: 3, part: 1, label: 'Coger la piedra pómez' });
    const held = [{ ...v[0]!, block: { x: 30, z: 0, held: 'Ana' } }];
    expect(shrinePartAt([s], held, [3], { x: 30, y: 0, z: 0 }, 'Ana')).toMatchObject({ part: 1, label: 'Soltar la piedra pómez' });
    const other = [{ ...v[0]!, block: { x: -4, z: 0, held: 'Leo' } }];
    expect(shrinePartAt([s], other, [3], { x: -4, y: 0, z: 0 }, 'Ana')).toBeNull();
  });

  it('wheels, levers and the orb', () => {
    const fan = mk(5, 'fan', [{ x: 5, z: 0 }, { x: -5, z: 0 }, { x: 0, z: 5 }]);
    expect(shrinePartAt([fan], [], [], { x: 0, y: 0, z: 5 }, 'Ana')).toMatchObject({ part: 3, label: 'Girar la rueda' });
    const sunk = mk(4, 'sunken', [{ x: 8, z: 0 }, { x: 8, z: 40 }]);
    expect(shrinePartAt([sunk], [], [], { x: 8, y: -6, z: 40 }, 'Ana')).toMatchObject({ part: 2, label: 'Tirar de la palanca' });
    expect(shrinePartAt([sunk], [{ id: 4, open: true, parts: [] }], [], { x: 0, y: 0, z: 0 }, 'Ana')).toMatchObject({ part: 0, label: 'Tomar el orbe' });
    expect(shrinePartAt([sunk], [], [], { x: 0, y: 0, z: 0 }, 'Ana')).toMatchObject({ part: 0, label: 'La verja está cerrada' });
  });
});

describe('rescueAction (S2-H)', () => {
  const cage = { x: 50, z: 400 };
  it('frees the Tragón beside the cage once every anchor is broken', () => {
    expect(rescueAction({ x: 51, z: 400 }, cage, { anchors: [0, 0, 0] })).toEqual({ label: 'Liberar al Tragón' });
    expect(rescueAction({ x: 51, z: 400 }, cage, { anchors: [0, 90, 150] })).toEqual({ label: 'La jaula aguanta: quedan 2 anclas' });
    expect(rescueAction({ x: 51, z: 400 }, cage, { anchors: [0, 0, 150] })).toEqual({ label: 'La jaula aguanta: queda 1 ancla' });
    expect(rescueAction({ x: 70, z: 400 }, cage, { anchors: [0, 0, 0] })).toBeNull();
    expect(rescueAction({ x: 51, z: 400 }, cage, null)).toBeNull();
  });
});
