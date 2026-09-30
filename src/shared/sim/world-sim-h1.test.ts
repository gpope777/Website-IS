import { describe, expect, it } from 'vitest';
import { COMBO, SPIN, nextComboStep } from './combat';
import { DAY_LENGTH, PUNCH, WorldSim, newWorld } from './world-sim';
import type { Wolf } from './wolves';

function setup(...names: string[]) {
  const sim = new WorldSim(newWorld(42, 'salt'));
  for (const name of names) {
    sim.createPlayer(name, 'hash');
    sim.connect(name);
  }
  return sim;
}

function wolfAt(sim: WorldSim, distance: number): Wolf {
  sim.time = DAY_LENGTH * 0.85;
  sim.step(0.1);
  const wolf = sim.wolfList[0]!;
  const player = sim.getPlayer('Ana')!;
  wolf.x = player.x + distance;
  wolf.z = player.z;
  wolf.y = sim.terrain.heightAt(wolf.x, wolf.z);
  wolf.cooldown = 99;
  wolf.hp = 999;
  return wolf;
}

describe('combo autoritativo', () => {
  it('avanza 1-2-3-1 y vuelve a 1 fuera de la ventana', () => {
    expect(nextComboStep(0, 0, 10, PUNCH.cooldown)).toBe(1);
    expect(nextComboStep(1, 10, 10.7, PUNCH.cooldown)).toBe(2);
    expect(nextComboStep(2, 10.7, 11.4, PUNCH.cooldown)).toBe(3);
    expect(nextComboStep(3, 11.4, 12.1, PUNCH.cooldown)).toBe(1);
    expect(nextComboStep(1, 10, 10 + PUNCH.cooldown + COMBO.window + 0.01, PUNCH.cooldown)).toBe(1);
  });

  it('el tercer golpe conserva el daño, aturde y empuja; ignora n del cliente', () => {
    const sim = setup('Ana');
    const wolf = wolfAt(sim, 1);
    const player = sim.getPlayer('Ana')!;
    const damage: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = wolf.hp;
      sim.handle('Ana', { t: 'attack', id: wolf.id, n: i === 0 ? 3 : undefined });
      damage.push(before - wolf.hp);
      if (i < 2) expect(wolf.stun).toBe(0);
      if (i < 2) sim.time += PUNCH.cooldown + 0.1;
    }
    expect(new Set(damage).size).toBe(1);
    expect(wolf.stun).toBe(COMBO.stun);
    expect(Math.hypot(wolf.x - player.x, wolf.z - player.z)).toBeGreaterThanOrEqual(1 + COMBO.knock - 0.01);
  });
});

describe('giratorio autoritativo', () => {
  it('golpea en radio, respeta 4 s y reinicia el combo', () => {
    const sim = setup('Ana');
    const wolf = wolfAt(sim, 1);
    sim.handle('Ana', { t: 'attack', id: wolf.id });
    sim.time += PUNCH.cooldown + 0.1;
    sim.handle('Ana', { t: 'attack', id: wolf.id });
    sim.time += PUNCH.cooldown + 0.1;
    const before = wolf.hp;
    sim.handle('Ana', { t: 'spin' });
    const once = before - wolf.hp;
    expect(once).toBeGreaterThan(0);
    sim.time += 1;
    sim.handle('Ana', { t: 'spin' });
    expect(before - wolf.hp).toBe(once);
    sim.time += SPIN.cooldown;
    sim.handle('Ana', { t: 'spin' });
    expect(before - wolf.hp).toBe(once * 2);
    sim.time += PUNCH.cooldown + 0.1;
    sim.handle('Ana', { t: 'attack', id: wolf.id });
    expect(wolf.stun).toBeLessThanOrEqual(COMBO.stun);
  });

  it('se niega muerto', () => {
    const sim = setup('Ana');
    const wolf = wolfAt(sim, 1);
    sim.getPlayer('Ana')!.dead = true;
    sim.handle('Ana', { t: 'spin' });
    expect(wolf.hp).toBe(999);
  });
});

describe('aspecto extendido', () => {
  it('guarda cuerpo/piel y mantiene válidos los looks antiguos', () => {
    const sim = setup('Ana', 'Bea');
    sim.handle('Ana', { t: 'look', color: 2, hat: 0, body: 3, skin: 4 });
    expect(sim.getPlayer('Ana')!.look).toEqual({ color: 2, hat: 0, body: 3, skin: 4 });
    const view = sim.snapshotFor('Bea');
    if (!view || view.t !== 'snap') throw new Error('snap');
    expect(view.players.find((p) => p.name === 'Ana')?.look).toEqual({ color: 2, hat: 0, body: 3, skin: 4 });
    sim.handle('Ana', { t: 'look', color: 1, hat: 0 });
    expect(sim.getPlayer('Ana')!.look).toEqual({ color: 1, hat: 0 });
  });
});
