import { describe, expect, it } from 'vitest';
import type { ServerMsg, Structure } from '../protocol';
import { MOUNTAIN_ZONES } from '../corruption';
import { MOUNTAIN_DUNGEON as M } from '../mountain-dungeon';
import { NAMES } from '../names';
import { HALF } from '../terrain';
import { UMBRAL } from '../mountains';
import { PIEDRA } from '../piedra';
import { CUCURUCHO, type Cucurucho } from './cucurucho';
import { triLeads } from './lieutenant';
import { DAY_LENGTH, newWorld, WorldSim } from './world-sim';
import { ENEMY, type Wolf } from './wolves';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const n of names) {
    sim.createPlayer(n, 'hash');
    sim.connect(n);
  }
  sim.time = DAY_LENGTH * 0.4;
  return sim;
}
function put(sim: WorldSim, name: string, x: number, z: number) {
  const p = sim.getPlayer(name)!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}
const msgs = (sim: WorldSim) => sim.drain().map((o) => o.msg);
const toasts = (sim: WorldSim) => msgs(sim).flatMap((m) => (m.t === 'toast' ? [m.text] : []));
const snap = (sim: WorldSim, name: string) => sim.snapshotFor(name) as Extract<ServerMsg, { t: 'snap' }>;
const priv = (sim: WorldSim) => sim as unknown as { boss4: Cucurucho | null; structures: Structure[]; cleansed: Set<number>; purified4: boolean };
const run = (sim: WorldSim, s: number) => {
  for (let i = 0; i < Math.round(s / 0.1); i++) sim.step(0.1);
};
function inRoom(...names: string[]) {
  const sim = setup(...names);
  for (const n of names) put(sim, n, M.x, M.bossRoomZ + 6);
  sim.step(0.1);
  return sim;
}

describe('El Cucurucho on the server (S4-F)', () => {
  it('wakes when someone enters its room and shows its bar', () => {
    const sim = inRoom('Ana');
    expect(toasts(sim).some((t) => t.startsWith(`${NAMES.bossMountain} despierta`))).toBe(true);
    expect(snap(sim, 'Ana').dungeon.mountain.boss).toMatchObject({ hp: 420, max: 420 });
    expect(snap(sim, 'Ana').wolves.some((w) => w.kind === 'boss4')).toBe(true);
  });

  it('the hat takes most of a front hit; a hit from behind lands in full', () => {
    const sim = inRoom('Ana');
    const b = priv(sim).boss4!;
    Object.assign(b, { x: M.x, z: M.bossRoomZ + 8, yaw: Math.PI, chargeReady: 99, aludIn: 99 }); // facing −z, toward Ana
    put(sim, 'Ana', M.x, M.bossRoomZ + 6.5);
    sim.handle('Ana', { t: 'attack', id: CUCURUCHO.id });
    const front = ENEMY.boss4.hp - b.hp;
    expect(front).toBeGreaterThan(0);
    run(sim, 1);
    b.hp = ENEMY.boss4.hp;
    Object.assign(b, { yaw: 0 });
    sim.handle('Ana', { t: 'attack', id: CUCURUCHO.id });
    expect(ENEMY.boss4.hp - b.hp).toBeCloseTo(front / CUCURUCHO.frontMult, 5);
  });

  it('a charge into a pillar sticks its hat: then a front hit lands in full', () => {
    const sim = inRoom('Ana');
    sim.getPlayer('Ana')!.piedra = true;
    const b = priv(sim).boss4!;
    Object.assign(b, { x: M.x, z: M.bossRoomZ + 22, chargeReady: 99, aludIn: 99 });
    put(sim, 'Ana', M.x, M.bossRoomZ + 6);
    sim.handle('Ana', { t: 'power', kind: 'piedra', x: M.x, z: M.bossRoomZ + 20 });
    expect(priv(sim).structures.some((s) => s.kind === 'pillar')).toBe(true);
    b.chargeReady = 0;
    run(sim, 3);
    expect(toasts(sim).some((t) => t.startsWith('¡Contra el pilar!'))).toBe(true);
    expect(snap(sim, 'Ana').dungeon.mountain.boss?.stuck).toBe(true);
  });

  it('the alud lands on a player standing on a circle', () => {
    const sim = inRoom('Ana');
    const b = priv(sim).boss4!;
    Object.assign(b, { chargeReady: 99, aludIn: 0 });
    sim.step(0.1);
    expect(snap(sim, 'Ana').dungeon.mountain.boss?.alud.length).toBe(4);
    const hp = sim.getPlayer('Ana')!.vitals.health;
    run(sim, CUCURUCHO.aludWarn + 0.1);
    expect(sim.getPlayer('Ana')!.vitals.health).toBeLessThan(hp - 14);
  });

  it('an empty room resets it', () => {
    const sim = inRoom('Ana');
    priv(sim).boss4!.hp = 100;
    put(sim, 'Ana', M.x, M.eliteZ);
    sim.step(0.1);
    expect(priv(sim).boss4).toBeNull();
    put(sim, 'Ana', M.x, M.bossRoomZ + 6);
    sim.step(0.1);
    expect(priv(sim).boss4!.hp).toBe(ENEMY.boss4.hp);
  });

  it('beaten: purified4 (saved), zone 14 clean so El Triángulo stops, a vision; it does not come back', () => {
    const sim = inRoom('Ana', 'Bo');
    priv(sim).boss4!.hp = 0;
    sim.step(0.1);
    const m = msgs(sim);
    expect(priv(sim).purified4).toBe(true);
    expect(priv(sim).cleansed.has(MOUNTAIN_ZONES.root)).toBe(true);
    expect(triLeads(4, true, snap(sim, 'Ana').corrupt)).toBe(false);
    const v = m.find((x) => x.t === 'vision') as Extract<ServerMsg, { t: 'vision' }> | undefined;
    expect(v?.lines.join(' ')).toMatch(/Ana y Bo|Bo y Ana/);
    expect(sim.save().purified4).toBe(true);
    run(sim, CUCURUCHO.corpseTime + 1);
    expect(priv(sim).boss4).toBeNull();
    const again = new WorldSim(sim.save());
    expect(again.purified4).toBe(true);
  });

  it('an old save loads without it', () => {
    const w = newWorld(42, 'salt');
    delete (w as { purified4?: boolean }).purified4;
    expect(new WorldSim(w).purified4).toBe(false);
  });
});

describe('la atalaya (S4-F)', () => {
  const night = (sim: WorldSim) => {
    sim.time = DAY_LENGTH * 0.9;
  };
  it('stands by the Heart once El Cucurucho is purified and stones a raider at night', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 10, 10);
    priv(sim).structures.push({ id: 9999, kind: 'heart', x: 10, y: sim.terrain.heightAt(10, 10), z: 10, rot: 0, owner: 'Ana', hp: 500 } as Structure);
    expect(sim.heart()).toBeTruthy();
    sim.step(0.1);
    expect(snap(sim, 'Ana').ally4).toBeNull();
    (sim as unknown as { purified4: boolean }).purified4 = true;
    night(sim);
    sim.step(0.1);
    const a = snap(sim, 'Ana').ally4!;
    expect(a).not.toBeNull();
    const w = { id: 7777, x: a.x + 8, y: 0, z: a.z, yaw: 0, hp: 60, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: true, kind: 'wolf', stun: 99 } as Wolf;
    (sim as unknown as { wolves: Wolf[] }).wolves.push(w);
    sim.step(0.1);
    expect(w.hp).toBe(60 - 8);
  });
});

describe('la Escalera del Umbral (S4-F)', () => {
  const cast = (sim: WorldSim) => {
    sim.handle('Ana', { t: 'power', kind: 'piedra', x: UMBRAL.x, z: UMBRAL.z - 4 });
    run(sim, PIEDRA.cooldown + 0.1);
  };
  const moveTo = (sim: WorldSim, x: number, z: number) => {
    for (let i = 0; i < 3; i++) sim.step(0.1);
    sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, z), z, yaw: 0, anim: 'walk' });
    const p = sim.getPlayer('Ana')!;
    return p.x === x && p.z === z;
  };

  it('needs Piedra; three cracks raise it for everyone (saved), without raising pillars', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', UMBRAL.x, UMBRAL.z + 2);
    sim.handle('Ana', { t: 'power', kind: 'piedra', x: UMBRAL.x, z: UMBRAL.z });
    expect(toasts(sim)).toContain('Aún no tienes ese poder');
    sim.getPlayer('Ana')!.piedra = true;
    cast(sim);
    cast(sim);
    expect(toasts(sim)).toContain('La roca cruje (2/3)');
    expect(priv(sim).structures.some((s) => s.kind === 'pillar')).toBe(false);
    expect(snap(sim, 'Ana').escalera).toBe(false);
    cast(sim);
    expect(snap(sim, 'Ana').escalera).toBe(true);
    expect(sim.save().escalera).toBe(true);
    expect(new WorldSim(sim.save()).escalera).toBe(true);
  });

  it('once up, a walker climbs the band from the forest to the Faldas; beside it the Peldaños still refuse', () => {
    const sim = setup('Ana');
    put(sim, 'Ana', 0, -HALF + 1);
    expect(moveTo(sim, 0, -HALF - 3)).toBe(false);
    (sim as unknown as { escalera: boolean }).escalera = true;
    put(sim, 'Ana', 0, -HALF + 1);
    for (let z = -HALF - 1; z >= -HALF - 42; z -= 1) expect(moveTo(sim, 0, z)).toBe(true);
    put(sim, 'Ana', 8, -HALF + 1);
    expect(moveTo(sim, 8, -HALF - 3)).toBe(false);
  });

  it('an old save loads without it', () => {
    const w = newWorld(42, 'salt');
    expect(new WorldSim(w).escalera).toBe(false);
  });
});
