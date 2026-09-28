import { describe, expect, it } from 'vitest';
import type { Anim } from '../protocol';
import { HALF } from '../terrain';
import { UMBRAL } from '../mountains';
import { PIEDRA } from '../piedra';
import { newWorld, WorldSim } from './world-sim';

function setup() {
  const sim = new WorldSim(newWorld(42, 'salt'));
  sim.createPlayer('Ana', 'hash');
  sim.connect('Ana');
  sim.drain();
  return sim;
}
function put(sim: WorldSim, x: number, z: number) {
  const p = sim.getPlayer('Ana')!;
  p.x = x;
  p.z = z;
  p.y = sim.terrain.heightAt(x, z);
}
/** Anchor at (x, z), wait `dt`, then send one move `dz` metres south. Returns whether it stuck. */
function slideMove(sim: WorldSim, x: number, z: number, dz: number, anim: Anim, dt = 1): boolean {
  put(sim, x, z);
  sim.step(1.2); // re-anchor here
  sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, z), z, yaw: 0, anim: 'idle' });
  sim.step(dt);
  const nz = z + dz;
  sim.handle('Ana', { t: 'move', x, y: sim.terrain.heightAt(x, nz), z: nz, yaw: 0, anim });
  return sim.getPlayer('Ana')!.z === nz;
}

describe('tobogán de nieve on the server (S4-H)', () => {
  it('sliders get cap 16 down the chute, runners do not', () => {
    expect(slideMove(setup(), 0, -HALF - 80, 14, 'slide')).toBe(true);
    expect(slideMove(setup(), 0, -HALF - 80, 14, 'run')).toBe(false);
    expect(slideMove(setup(), 0, -HALF - 80, 25, 'slide')).toBe(false);
  });
  it('no slide cap off snow', () => {
    expect(slideMove(setup(), 30, 0, 14, 'slide')).toBe(false);
  });
  it('a short grace after the slide', () => {
    const sim = setup();
    expect(slideMove(sim, 0, -HALF - 80, 14, 'slide')).toBe(true);
    const p = sim.getPlayer('Ana')!;
    sim.step(0.2);
    const nz = p.z + 3;
    sim.handle('Ana', { t: 'move', x: 0, y: sim.terrain.heightAt(0, nz), z: nz, yaw: 0, anim: 'run' });
    expect(p.z).toBe(nz);
  });
});

const visions = (sim: WorldSim) => sim.drain().flatMap((o) => (o.msg.t === 'vision' ? [o.msg.lines.join(' ')] : []));

describe('the last mountain visions (S4-H)', () => {
  it('first time anyone enters the mountains, once per world', () => {
    const sim = setup();
    put(sim, 0, -HALF - 20);
    sim.step(0.1);
    const v = visions(sim);
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('Qué alto, Ana. Qué frío');
    sim.step(0.1);
    expect(visions(sim)).toHaveLength(0);
    const again = new WorldSim(sim.save());
    again.connect('Ana');
    again.drain();
    again.step(0.1);
    expect(visions(again)).toHaveLength(0);
  });
  it('raising the Escalera', () => {
    const sim = setup();
    put(sim, UMBRAL.x, UMBRAL.z + 2);
    sim.getPlayer('Ana')!.piedra = true;
    for (let i = 0; i < UMBRAL.casts; i++) {
      sim.handle('Ana', { t: 'power', kind: 'piedra', x: UMBRAL.x, z: UMBRAL.z });
      for (let k = 0; k < (PIEDRA.cooldown + 0.1) / 0.1; k++) sim.step(0.1);
    }
    expect(visions(sim).some((l) => l.includes('Ana') && l.includes('escalera'))).toBe(true);
  });
});
