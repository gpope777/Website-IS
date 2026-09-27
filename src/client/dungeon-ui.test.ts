import { describe, expect, it } from 'vitest';
import { DUNGEON, inside, leverPos } from '../shared/dungeon';
import type { DungeonView } from '../shared/protocol';
import { bossBarText, dungeonAction, eliteBarText, emptyDungeonView } from './dungeon-ui';

const entrance = { x: 100, y: 2, z: 0 };
const shut: DungeonView = emptyDungeonView();
const open: DungeonView = { ...shut, gate: true, gates: [true, false, false, false, false], levers: [true, true] };
const at = (x: number, z: number, y: number = DUNGEON.floor) => ({ x, y, z });

describe('dungeonAction', () => {
  it('enters at the root and leaves at the door', () => {
    expect(dungeonAction(at(entrance.x + DUNGEON.trunkR + 1, 0, 2), entrance, shut, false)).toEqual({ act: 0, label: 'Entrar en la Raíz-madre' });
    expect(dungeonAction(at(DUNGEON.x, DUNGEON.entryZ + 1), entrance, shut, false)).toEqual({ act: 1, label: 'Salir de la Raíz-madre' });
  });
  it('pulls levers while the gate is shut', () => {
    const l = leverPos(1);
    expect(dungeonAction(at(l.x, l.z), entrance, shut, false)).toEqual({ act: 3, label: 'Tirar de la raíz' });
    expect(dungeonAction(at(l.x, l.z), entrance, open, false)).toBeNull();
  });
  it('offers the altar only behind an open gate and without the power', () => {
    const p = at(DUNGEON.x, DUNGEON.altarZ);
    expect(dungeonAction(p, entrance, open, false)).toEqual({ act: 4, label: 'Tomar la Enredadera' });
    expect(dungeonAction(p, entrance, open, true)).toBeNull();
    expect(dungeonAction(p, entrance, shut, false)).toBeNull();
  });
  it('block, lantern and brazier: pick up, drop, light', () => {
    const b = inside(DUNGEON.blockStart);
    expect(dungeonAction(at(b.x, b.z), entrance, shut, true, 'Ana')).toEqual({ act: 5, label: 'Coger el bloque' });
    const carried: DungeonView = { ...shut, block: { x: 0, z: 0, held: 'Ana' } };
    expect(dungeonAction(at(DUNGEON.x, 70), entrance, carried, true, 'Ana')).toEqual({ act: 5, label: 'Soltar el bloque' });
    expect(dungeonAction(at(b.x, b.z), entrance, { ...shut, block: { ...b, held: 'Leo' } }, true, 'Ana')).toBeNull();
    const l = inside(DUNGEON.lantern);
    expect(dungeonAction(at(l.x, l.z), entrance, shut, true, 'Ana')).toEqual({ act: 6, label: 'Coger la linterna' });
    const lit: DungeonView = { ...shut, lantern: { x: 0, z: 0, held: 'Ana' } };
    expect(dungeonAction(at(DUNGEON.x, 95), entrance, lit, true, 'Ana')).toEqual({ act: 6, label: 'Soltar la linterna' });
    const br = inside(DUNGEON.brazier);
    expect(dungeonAction(at(br.x + 1, br.z), entrance, lit, true, 'Ana')).toEqual({ act: 7, label: 'Encender el brasero' });
  });
  it('nothing in the open', () => {
    expect(dungeonAction(at(0, 0, 1), entrance, shut, false)).toBeNull();
  });
});

describe('bossBarText', () => {
  it('shows HP and whether the paper is folded', () => {
    expect(bossBarText(shut)).toBeNull();
    expect(bossBarText({ ...shut, boss: { hp: 200, max: 300, weak: false } })).toBe('Tragón de Papel 200/300 · doblado');
    expect(bossBarText({ ...shut, boss: { hp: 200, max: 300, weak: true } })).toBe('Tragón de Papel 200/300 · ¡expuesto!');
  });
});

import { marchitoBarText } from './dungeon-ui';

describe('marchitoBarText', () => {
  it('shows his voluntad, his laugh, or nothing', () => {
    expect(marchitoBarText(null)).toBeNull();
    expect(marchitoBarText({ will: 320, max: 400, laughing: false })).toBe('El Marchito · voluntad 320/400');
    expect(marchitoBarText({ will: 320, max: 400, laughing: true })).toBe('El Marchito se ríe');
  });
});

describe('eliteBarText', () => {
  it('shows its HP and warns of the charge', () => {
    expect(eliteBarText(emptyDungeonView())).toBeNull();
    expect(eliteBarText({ ...emptyDungeonView(), elite: { hp: 300, max: 420, charging: false } })).toBe('Bruto reforzado 300/420');
    expect(eliteBarText({ ...emptyDungeonView(), elite: { hp: 300, max: 420, charging: true } })).toBe('Bruto reforzado 300/420 · ¡carga!');
  });
});
