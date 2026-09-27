import { describe, expect, it } from 'vitest';
import { NAMES } from '../shared/names';
import { DUNGEON, inside, leverPos } from '../shared/dungeon';
import type { DungeonView } from '../shared/protocol';
import { antenonBarText, bossBarText, dungeonAction, eliteBarText, emptyDungeonView, mountainDungeonAction, rockBarText } from './dungeon-ui';
import { dungeonBlockCell, insideMountain, mountainEntrance, MOUNTAIN_DUNGEON as M } from '../shared/mountain-dungeon';

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
    expect(marchitoBarText({ will: 432, max: 432, laughing: false, grab: 0.4 })).toBe('El Marchito envuelve al Tragón · 40 % · voluntad 432/432');
  });
});

describe('eliteBarText', () => {
  it('shows its HP and warns of the charge', () => {
    expect(eliteBarText(emptyDungeonView())).toBeNull();
    expect(eliteBarText({ ...emptyDungeonView(), elite: { hp: 300, max: 420, charging: false } })).toBe('Bruto reforzado 300/420');
    expect(eliteBarText({ ...emptyDungeonView(), elite: { hp: 300, max: 420, charging: true } })).toBe('Bruto reforzado 300/420 · ¡carga!');
  });
});

describe('coast dungeon prompts (S2-F)', () => {
  it('enter, leave, levers, altar; and the shield bar', async () => {
    const { coastDungeonAction, shieldBarText } = await import('./dungeon-ui');
    const { COAST_DUNGEON: C, insideCoast } = await import('../shared/coast-dungeon');
    const v = emptyDungeonView().coast;
    const e = { x: 10, z: 400 };
    expect(coastDungeonAction({ x: 12, z: 401 }, e, v, false)?.act).toBe(8);
    expect(coastDungeonAction({ x: 40, z: 401 }, e, v, false)).toBeNull();
    expect(coastDungeonAction({ x: C.x, z: C.entryZ }, e, v, false)?.act).toBe(9);
    const l = insideCoast(C.levers[1]);
    expect(coastDungeonAction(l, e, v, false)?.act).toBe(11);
    const altar = { x: C.x, z: C.altarZ };
    expect(coastDungeonAction(altar, e, v, false)).toBeNull();
    const open = { ...v, gates: [true, false, false, false] };
    expect(coastDungeonAction(altar, e, open, false)).toEqual({ act: 12, label: 'Tomar el Viento' });
    expect(coastDungeonAction(altar, e, open, true)).toBeNull();
    expect(shieldBarText(v)).toBeNull();
    expect(shieldBarText({ ...v, elite: { hp: 300, max: 420, exposed: true, charging: false } })).toBe('Bruto escudado 300/420 · ¡expuesto!');
  });
});

describe('antenonBarText', () => {
  it('shows the shell, the exposure and the wind-ups', () => {
    const v = emptyDungeonView().coast;
    expect(antenonBarText(v)).toBeNull();
    const b = (exposed: boolean, tell: 'sweep' | 'charge' | null) => antenonBarText({ ...v, boss: { hp: 360, max: 360, exposed, tell } });
    expect(b(false, null)).toBe(`${NAMES.bossCoast} 360/360 · cáscara`);
    expect(b(true, null)).toBe(`${NAMES.bossCoast} 360/360 · ¡expuesto!`);
    expect(b(false, 'sweep')).toBe(`${NAMES.bossCoast} 360/360 · ¡barrido!`);
    expect(b(false, 'charge')).toBe(`${NAMES.bossCoast} 360/360 · ¡carga!`);
  });
});

describe('swamp dungeon UI (S3-E)', () => {
  it('enters from the Laguna trunk, leaves, pulls levers, takes Fuego', async () => {
    const { swampDungeonAction, peatBarText } = await import('./dungeon-ui');
    const { SWAMP_DUNGEON: S, insideSwamp } = await import('../shared/swamp-dungeon');
    const e = { x: -500, z: 400 };
    const v = emptyDungeonView().swamp;
    expect(swampDungeonAction({ x: e.x + 5, z: e.z }, e, v, false)).toEqual({ act: 13, label: `Entrar en la ${NAMES.swampRoot}` });
    expect(swampDungeonAction({ x: e.x + 30, z: e.z }, e, v, false)).toBeNull();
    expect(swampDungeonAction({ x: S.x, z: S.entryZ }, e, v, false)?.act).toBe(14);
    const l = insideSwamp(S.levers[1]);
    expect(swampDungeonAction(l, e, v, false)?.act).toBe(16);
    const altar = { x: S.x, z: S.altarZ };
    expect(swampDungeonAction(altar, e, v, false)).toBeNull();
    const open = { ...v, gates: [true, false, false, false] };
    expect(swampDungeonAction(altar, e, open, false)).toEqual({ act: 17, label: `Tomar el ${NAMES.powerFire}` });
    expect(swampDungeonAction(altar, e, open, true)).toBeNull();
    expect(peatBarText(v)).toBeNull();
    expect(peatBarText({ ...v, elite: { hp: 200, max: 480, charging: false, burning: true } })).toBe('Bruto de turba 200/480 · ardiendo');
  });
});

describe('El Zancudo UI (S3-F)', () => {
  it('names its state: in the air, diving, on the floor, clinging', async () => {
    const { zancudoBarText } = await import('./dungeon-ui');
    const v = emptyDungeonView().swamp;
    expect(zancudoBarText(v)).toBeNull();
    const boss = { hp: 380, max: 380, grounded: false, diving: false, shadow: null, latch: null };
    expect(zancudoBarText({ ...v, boss })).toBe(`${NAMES.bossSwamp} 380/380 · en el aire`);
    expect(zancudoBarText({ ...v, boss: { ...boss, diving: true, shadow: { x: 0, z: 0 } } })).toBe(`${NAMES.bossSwamp} 380/380 · ¡picado!`);
    expect(zancudoBarText({ ...v, boss: { ...boss, hp: 200, grounded: true } })).toBe(`${NAMES.bossSwamp} 200/380 · ¡en el suelo!`);
    expect(zancudoBarText({ ...v, boss: { ...boss, latch: 'Ana' } })).toBe(`${NAMES.bossSwamp} 380/380 · chupando a Ana: ¡rueda!`);
  });
});


describe('mountainDungeonAction (S4-E)', () => {
  const door = mountainEntrance();
  const mv = emptyDungeonView().mountain;
  it('enters at the cave mouth, leaves at the door, pulls levers, takes Piedra', () => {
    expect(mountainDungeonAction({ x: door.x, z: door.z + 3 }, door, mv, false)).toEqual({ act: 18, label: 'Entrar en la cueva' });
    expect(mountainDungeonAction({ x: 0, z: 0 }, door, mv, false)).toBeNull();
    expect(mountainDungeonAction({ x: M.x, z: M.entryZ }, door, mv, false)?.act).toBe(19);
    const l = insideMountain(M.levers[1]!);
    expect(mountainDungeonAction(l, door, mv, false)?.act).toBe(21);
    const opened = { ...mv, gates: [true, false, false, false] };
    expect(mountainDungeonAction({ x: M.x, z: M.altarZ }, door, opened, false)).toEqual({ act: 22, label: `Tomar la ${NAMES.powerStone}` });
    expect(mountainDungeonAction({ x: M.x, z: M.altarZ }, door, opened, true)).toBeNull();
  });
  it('pushes blocks with Piedra; the reset lever', () => {
    const b1 = dungeonBlockCell(M.blocks.starts[1]);
    expect(mountainDungeonAction({ x: b1.x, z: b1.z - 1.5 }, door, mv, true)).toEqual({ act: 24, label: 'Empujar el bloque' });
    expect(mountainDungeonAction({ x: b1.x, z: b1.z - 1.5 }, door, mv, false)?.label).toBe('No se mueve');
    expect(mountainDungeonAction(insideMountain(M.resetLever), door, mv, true)?.act).toBe(25);
  });
  it('shows the bruto de roca bar', () => {
    expect(rockBarText(mv)).toBeNull();
    expect(rockBarText({ ...mv, elite: { hp: 300, max: 500, charging: false, exposed: true } })).toBe('Bruto de roca 300/500 · expuesto');
  });
});
