import { describe, expect, it } from 'vitest';
import { NAMES } from '../shared/names';
import { DUNGEON, inside, leverPos } from '../shared/dungeon';
import type { DungeonView, FinalView } from '../shared/protocol';
import { antenonBarText, bossBarText, dungeonAction, eliteBarText, emptyDungeonView, mountainDungeonAction, rockBarText, cucuruchoBarText, flechaBarText, finalBarText, towerDungeonAction } from './dungeon-ui';
import { towerEntrance, TOWER_DUNGEON as TD } from '../shared/tower-dungeon';
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

import { clawPick, marchitoBarText } from './dungeon-ui';

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

describe('cucuruchoBarText (S4-F)', () => {
  const mv = emptyDungeonView().mountain;
  const boss = { hp: 420, max: 420, windup: false, charging: false, stuck: false, alud: [] as { x: number; z: number }[] };
  it('names the boss and its state', () => {
    expect(cucuruchoBarText(mv)).toBeNull();
    expect(cucuruchoBarText({ ...mv, boss })).toBe('El Cucurucho 420/420');
    expect(cucuruchoBarText({ ...mv, boss: { ...boss, charging: true } })).toBe('El Cucurucho 420/420 · ¡embiste!');
    expect(cucuruchoBarText({ ...mv, boss: { ...boss, stuck: true } })).toBe('El Cucurucho 420/420 · ¡gorro clavado!');
    expect(cucuruchoBarText({ ...mv, boss: { ...boss, alud: [{ x: 0, z: 0 }] } })).toBe('El Cucurucho 420/420 · ¡alud!');
  });
});

describe('Invasion 3 on the client (S5-D)', () => {
  it('the bar says he wraps the Heart', () => {
    expect(marchitoBarText({ will: 390, max: 390, laughing: false, channel: 0.4 })).toBe(`El Marchito envuelve el ${NAMES.heart} · 40 % · voluntad 390/390`);
  });
  it('the claw picks the nearest rayo within 5 m in 3D', () => {
    const r = { x: 0, y: 10, z: 0 };
    const f = (id: number, kind: string, x: number, y: number) => ({ id, kind, x, y, z: 0 });
    expect(clawPick(r, [f(1, 'wolf', 1, 10), f(2, 'rayo', 4, 10), f(3, 'rayo', 2, 11)])).toBe(3);
    expect(clawPick(r, [f(1, 'rayo', 3, 5)])).toBeNull();
  });
});

describe('towerDungeonAction and flechaBarText (S5-E)', () => {
  const door = towerEntrance();
  it('offers the door outside, the way out at the entry, nothing elsewhere', () => {
    expect(towerDungeonAction({ x: door.x, z: door.z + 2 }, door, true)).toEqual({ act: 26, label: `Entrar en ${NAMES.villainTower}` });
    expect(towerDungeonAction({ x: door.x, z: door.z + 2 }, door, false)).toEqual({ act: 26, label: 'La puerta' });
    expect(towerDungeonAction({ x: door.x, z: door.z + 20 }, door, true)).toBeNull();
    expect(towerDungeonAction({ x: TD.x, z: TD.entryZ }, door, true)).toEqual({ act: 27, label: `Salir de ${NAMES.villainTower}` });
    expect(towerDungeonAction({ x: TD.x, z: 100 }, door, true)).toBeNull();
  });

  it('shows La Flecha’s PV, her line and when she is stuck', () => {
    const v = emptyDungeonView().tower;
    expect(flechaBarText(v)).toBeNull();
    expect(flechaBarText({ ...v, flecha: { hp: 300, max: 470, aiming: true, stuck: false } })).toBe(`${NAMES.lieutenant3} 300/470 · ¡raya!`);
    expect(flechaBarText({ ...v, flecha: { hp: 300, max: 470, aiming: false, stuck: true } })).toBe(`${NAMES.lieutenant3} 300/470 · ¡clavada!`);
  });
});

describe('finalBarText and the brote action (S5-F)', () => {
  const base: FinalView = { phase: 1, hp: 900, max: 1200, catching: false, bare: false, green: false, stagger: false, swipe: false, lines: [], brotes: [], pull: null, core: null, trail: [] };
  const view = (f: Partial<FinalView> | null) => ({ ...emptyDungeonView().tower, final: f ? { ...base, ...f } : null });
  it('says the roots, the brotes left and el Corazón Negro', () => {
    expect(finalBarText(view(null))).toBeNull();
    expect(finalBarText(view({}))).toBe(`${NAMES.villain} 900/1200 · raíces`);
    expect(finalBarText(view({ catching: true }))).toBe(`${NAMES.villain} 900/1200 · ¡arde!`);
    expect(finalBarText(view({ bare: true }))).toBe(`${NAMES.villain} 900/1200 · sin raíces`);
    expect(finalBarText(view({ green: true }))).toBe(`${NAMES.villain} 900/1200 · raíces verdes`);
    expect(finalBarText(view({ stagger: true }))).toBe(`${NAMES.villain} 900/1200 · ¡se tambalea!`);
    const brotes = (['vine', 'wind', 'fire', 'stone'] as const).map((power, i) => ({ power, x: 0, z: 0, open: false, broken: i === 0, steps: 0, need: 2 }));
    expect(finalBarText(view({ phase: 2, brotes }))).toBe(`${NAMES.villain} se hunde · brotes 1/4`);
    expect(finalBarText(view({ phase: 3, core: { hp: 200, max: 300, stopped: true, healing: false } }))).toBe('El Corazón Negro 200/300 · ¡parado!');
    expect(finalBarText(view({ phase: 3, core: { hp: 200, max: 300, stopped: false, healing: true } }))).toBe('El Corazón Negro 200/300 · ¡se cura!');
  });
  it('offers A at a brote within 3 m in phase 2', () => {
    const at = { x: TD.x + 5, z: TD.copa.z };
    const f = { ...base, phase: 2 as const, brotes: [{ power: 'fire' as const, x: at.x + 2, z: at.z, open: true, broken: false, steps: 3, need: 3 }] };
    expect(towerDungeonAction(at, { x: 0, z: 0 }, true, f)).toEqual({ act: 28, label: 'Arrancar el brote' });
    expect(towerDungeonAction(at, { x: 0, z: 0 }, true, { ...f, brotes: [{ ...f.brotes[0]!, open: false }] })).toEqual({ act: 28, label: 'El brote' });
    expect(towerDungeonAction({ x: at.x + 10, z: at.z }, { x: 0, z: 0 }, true, f)).toBeNull();
    expect(towerDungeonAction(at, { x: 0, z: 0 }, true, { ...f, phase: 1 })).toBeNull();
  });
});
