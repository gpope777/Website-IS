import { describe, expect, it } from 'vitest';
import { swampAction } from './swamp-ui';
import { shrinePartAt } from './coast-ui';
import type { AmberTree } from '../shared/swamp-shrines';
import type { Shrine } from '../shared/shrines';

const low: AmberTree = { id: 0, x: 10, z: 10, y: 0, stump: null };
const high: AmberTree = { id: 1, x: 40, z: 10, y: 6, stump: { id: 1101, x: 40, z: 10, r: 1.6, base: -0.5, top: 6, bare: true } };
const base = { pos: { x: 11, y: 0, z: 10 }, trees: [low, high], regrowing: [] as number[], heart: null, amber: 0, capa: 0 };

describe('swampAction', () => {
  it('harvests a ripe amber tree within reach', () => {
    expect(swampAction(base)).toEqual({ t: 'amber', id: 0, label: 'Recoger ámbar' });
    expect(swampAction({ ...base, regrowing: [0] })).toBeNull();
    expect(swampAction({ ...base, pos: { x: 15, y: 0, z: 10 } })).toBeNull();
  });

  it('a stump tree only from its top', () => {
    expect(swampAction({ ...base, pos: { x: 41, y: 0, z: 10 } })).toBeNull();
    expect(swampAction({ ...base, pos: { x: 40.5, y: 6, z: 10 } })).toEqual({ t: 'amber', id: 1, label: 'Recoger ámbar' });
  });

  it('offers a Capa level at the Heart with 3 ámbar', () => {
    const at = { ...base, pos: { x: 0, y: 1, z: 0 }, heart: { x: 1, z: 1 } };
    expect(swampAction({ ...at, amber: 2 })).toBeNull();
    expect(swampAction({ ...at, amber: 3 })).toEqual({ t: 'capa', label: 'Capa de corteza (3 ámbar, 10 madera, 5 bayas)' });
    expect(swampAction({ ...at, amber: 3, capa: 3 })).toBeNull();
  });
});

const candles: Shrine = { id: 6, kind: 'candles', x: 0, z: 0, y: 0, orb: { x: 0, y: 1.2, z: 0 }, parts: [{ x: 7, z: 0 }, { x: -3.5, z: 6 }, { x: -3.5, z: -6 }, { x: 2.5, z: 0 }], pillar: null };
const peat: Shrine = { id: 8, kind: 'peat', x: 100, z: 0, y: 0, orb: { x: 100, y: 1.2, z: 0 }, parts: [], pillar: null };
const views = [{ id: 6, open: false, parts: [false, false, false, false] }, { id: 8, open: false, parts: [] }];

describe('shrinePartAt (swamp)', () => {
  it('torch post and braziers', () => {
    expect(shrinePartAt([candles], views, [], { x: 2.5, y: 0, z: 0.5 }, 'Ana')).toMatchObject({ id: 6, part: 4, label: 'Coger una antorcha' });
    expect(shrinePartAt([candles], views, [], { x: 7, y: 0, z: 0.5 }, 'Ana')).toMatchObject({ part: 1, label: 'Hace falta fuego' });
    expect(shrinePartAt([candles], views, [], { x: 7, y: 0, z: 0.5 }, 'Ana', true)).toMatchObject({ part: 1, label: 'Encender el brasero' });
  });

  it('the peat wall says it only burns', () => {
    expect(shrinePartAt([peat], views, [], { x: 100.5, y: 0, z: 0 }, 'Ana')).toMatchObject({ id: 8, part: 0, open: false, label: 'Raíces de turba. Solo arden' });
  });
});
