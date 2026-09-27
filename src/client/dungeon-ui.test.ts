import { describe, expect, it } from 'vitest';
import { DUNGEON, leverPos } from '../shared/dungeon';
import type { DungeonView } from '../shared/protocol';
import { bossBarText, dungeonAction, emptyDungeonView } from './dungeon-ui';

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
