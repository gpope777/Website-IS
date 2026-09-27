import { TOWER_DUNGEON } from '../tower-dungeon';
import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../dungeon';
import { createElite, createRockBrute, ELITE, rockFront, stepElite } from './elite';
import { MOUNTAIN_DUNGEON } from '../mountain-dungeon';
import { ENEMY } from './wolves';
import { MARCHITO } from './marchito';
import { ANTENON } from './antenon';
import { ZANCUDO } from './zancudo';
import { CUCURUCHO } from './cucurucho';
import { BOSS } from './boss';
import { RESCUE } from '../rescue';

const t = (x: number, z: number, dead = false) => ({ name: 'Ana', x, z, dead, fires: false });

describe('stepElite (bruto reforzado)', () => {
  it('starts in its room with more HP than a brute', () => {
    const e = createElite();
    expect(e).toMatchObject({ id: ELITE.id, kind: 'elite', z: DUNGEON.eliteZ, hp: ENEMY.elite.hp });
    expect(ENEMY.elite.hp).toBeGreaterThan(ENEMY.brute.hp * 2);
  });

  it('telegraphs a charge from mid range, then runs straight and hits once', () => {
    const e = createElite();
    e.chargeReady = 0;
    const me = t(e.x, e.z - 9);
    expect(stepElite(e, [me], 0.1)).toBeNull();
    expect(e.windup).toBeGreaterThan(0);
    expect(e.anim).toBe('attack');
    const z0 = e.z;
    // the wind-up is long enough to read and react
    let ticks = 0;
    while (e.windup > 0) {
      expect(stepElite(e, [me], 0.1)).toBeNull();
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(10);
    expect(e.z).toBe(z0); // it does not creep during the telegraph
    const hits = [];
    for (let i = 0; i < 12; i++) {
      const h = stepElite(e, [me], 0.1);
      if (h) hits.push(h);
    }
    expect(hits).toEqual([{ name: 'Ana', dmg: ELITE.chargeDamage }]);
    expect(e.chargeReady).toBeGreaterThan(0);
  });

  it('a charge locked on where you were misses if you step aside', () => {
    const e = createElite();
    e.chargeReady = 0;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    const aside = t(e.x + 6, e.z - 9);
    const hits = [];
    for (let i = 0; i < 25; i++) {
      const h = stepElite(e, [aside], 0.1);
      if (h && e.windup === 0 && e.charge > 0) hits.push(h);
    }
    expect(hits).toEqual([]);
  });

  it('bites in reach like a brute, with a cooldown', () => {
    const e = createElite();
    const me = [t(e.x, e.z - 1)];
    expect(stepElite(e, me, 0.1)).toEqual({ name: 'Ana', dmg: ENEMY.elite.damage });
    expect(stepElite(e, me, 0.1)).toBeNull();
  });

  it('a stun cancels the wind-up', () => {
    const e = createElite();
    e.chargeReady = 0;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    e.stun = 1;
    stepElite(e, [t(e.x, e.z - 9)], 0.1);
    expect(e.windup).toBe(0);
    expect(e.charge).toBe(0);
  });
});

describe('the bruto escudado (S2-F)', () => {
  it('lives in the coast room and keeps to it', async () => {
    const { createShielded } = await import('./elite');
    const { COAST_DUNGEON: C } = await import('../coast-dungeon');
    const e = createShielded();
    expect(e).toMatchObject({ kind: 'elite2', x: C.x, z: C.eliteZ, hp: ENEMY.elite2.hp });
    for (let i = 0; i < 60; i++) stepElite(e, [t(C.x, C.eliteRoomZ - 20)], 0.1);
    expect(e.z).toBeGreaterThanOrEqual(C.eliteRoomZ + 1.5);
  });

  it('its shield blocks from the front until it is exposed', async () => {
    const { createShielded, shieldBlocks } = await import('./elite');
    const e = createShielded();
    e.yaw = 0; // facing +z
    expect(shieldBlocks(e, e.x, e.z + 2)).toBe(true);
    expect(shieldBlocks(e, e.x, e.z - 2)).toBe(false);
    e.exposed = ELITE.exposedFor;
    expect(shieldBlocks(e, e.x, e.z + 2)).toBe(false);
    stepElite(e, [], ELITE.exposedFor + 0.1);
    expect(e.exposed).toBe(0);
    expect(shieldBlocks(createElite(), 0, 0)).toBe(false);
  });
});

describe('special enemy ids', () => {
  it('are all distinct (and above any wolf id a world will reach)', () => {
    const ids = [BOSS.id, MARCHITO.id, ELITE.id, ELITE.shieldId, ELITE.peatId, ELITE.rockId, ANTENON.id, ZANCUDO.id, CUCURUCHO.id, RESCUE.anchorIdBase, RESCUE.anchorIdBase + 1, RESCUE.anchorIdBase + 2, TOWER_DUNGEON.flechaId];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids.slice(1)) expect(id).toBeGreaterThanOrEqual(900_000);
  });
});

describe('bruto de roca (S4-E)', () => {
  it('stands in its room with 500 PV; its slab covers the front until exposed', () => {
    const e = createRockBrute();
    expect(e).toMatchObject({ id: ELITE.rockId, kind: 'elite4', hp: ENEMY.elite4.hp, x: MOUNTAIN_DUNGEON.x });
    e.yaw = 0; // facing +z
    expect(rockFront(e, e.x, e.z + 2)).toBe(true);
    expect(rockFront(e, e.x, e.z - 2)).toBe(false);
    e.exposed = 1;
    expect(rockFront(e, e.x, e.z + 2)).toBe(false);
  });

  it('a charge into the wall stuns and exposes it', () => {
    const e = createRockBrute();
    e.z = MOUNTAIN_DUNGEON.bossRoomZ - 3;
    Object.assign(e, { charge: 0.9, dirX: 0, dirZ: 1, chargeReady: 0 });
    for (let i = 0; i < 5 && e.stun === 0; i++) stepElite(e, [t(e.x, e.z - 8)], 0.1);
    expect(e.stun).toBe(ELITE.wallStun);
    expect(e.exposed).toBe(ELITE.wallStun);
    expect(e.charge).toBe(0);
  });
});
