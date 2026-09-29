import { describe, expect, it } from 'vitest';
import { actOptions, type ActProbe } from './act-options';

const none: ActProbe = { fallen: null, shrinePart: null, dungeon: null, coast: null, swamp: null, quartz: null, fogata: null, rescue: false, pillar: null, guardian: false, mount: null, tend: false, upgrade: false, capa: false, stall: false };

describe('actOptions', () => {
  it('vacío da vacío', () => expect(actOptions(none)).toEqual([]));
  it('una coincidencia da una opción', () => expect(actOptions({ ...none, coast: { t: 'chest', id: 4 } })).toEqual([{ k: 'chest', id: 4 }]));
  it('conserva el orden de prioridad', () => {
    expect(actOptions({ ...none, mount: { act: 3 }, coast: { t: 'chest', id: 4 }, fogata: { t: 'fogata', id: 1 } }).map((x) => x.k)).toEqual(['chest', 'fogata', 'mount']);
  });
  it('una pista de fogata no es una opción', () => expect(actOptions({ ...none, fogata: { t: 'hint', label: 'x' } })).toEqual([]));
});
