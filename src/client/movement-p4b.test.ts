import { describe, expect, it } from 'vitest';
import type { Terrain } from '../shared/terrain';
import { createTerrain, mountainFeatures } from '../shared/terrain';
import { MOUNT } from '../shared/mount';
import { SKILL_FX } from '../shared/progression';
import { createBody, GLIDE, STAMINA, stepBody, type Body, type MoveInput } from './movement';

const flat: Terrain = { heightAt: () => 0, density: () => 0.5 };
const none = () => [];
const fwd: MoveInput = { x: 0, z: -1, sprint: false, jump: false };
const idle: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
function run(b: Body, input: MoveInput, seconds: number, terrain = flat, yaw = 0) {
  stepBody(b, input, yaw, 0, terrain, none);
  for (let t = 0; t < seconds; t += 1 / 60) stepBody(b, input, yaw, 1 / 60, terrain, none);
}

describe('Oficios de Andar on the body (P4-B)', () => {
  it('Planeo largo: the glide sinks 20 % slower', () => {
    const b = createBody(0, 0, flat);
    Object.assign(b, { y: 20, onGround: false, skills: ['pies', 'planeo'] });
    run(b, { ...fwd, jump: true }, 0);
    run(b, fwd, 0.5);
    expect(b.vy).toBeCloseTo(-GLIDE.sink * SKILL_FX.sink);
  });

  it('Pies ligeros: stamina comes back 25 % faster', () => {
    const plain = createBody(0, 0, flat);
    const fast = createBody(0, 0, flat);
    fast.skills = ['pies'];
    for (const b of [plain, fast]) {
      b.stamina = 10;
      run(b, idle, 1);
    }
    expect(fast.stamina - 10).toBeCloseTo((plain.stamina - 10) * SKILL_FX.regen, 0);
  });

  it('Trepador: a wet pared can be grabbed, climbing costs less and goes at half speed', () => {
    const t = createTerrain(42);
    const p = mountainFeatures(42).paredes[0]!;
    const west = Math.PI / 2;
    const foot = () => createBody(p.x + p.rt + p.w + 2, p.z, t);
    const dry = foot();
    run(dry, fwd, 1.5, t, west);
    expect(dry.wall).toBe(true);
    const good = foot();
    good.skills = ['trepador'];
    run(good, fwd, 1.5, t, west);
    expect(good.wall).toBe(true);
    expect(STAMINA.max - good.stamina).toBeLessThan(STAMINA.max - dry.stamina);
    const wet = foot();
    Object.assign(wet, { wet: true, skills: ['trepador'] });
    run(wet, fwd, 1.5, t, west);
    expect(wet.wall).toBe(true);
    expect(wet.y).toBeLessThan(good.y);
  });

  it('Pulmón: fast swimming spends half', () => {
    const sea: Terrain = { heightAt: () => -10, density: () => 0 };
    const plain = createBody(0, 0, sea);
    const lung = createBody(0, 0, sea);
    lung.skills = ['pulmon'];
    for (const b of [plain, lung]) run(b, { ...fwd, sprint: true }, 1, sea);
    expect(STAMINA.max - lung.stamina).toBeCloseTo((STAMINA.max - plain.stamina) * SKILL_FX.swimFast, 0);
    expect(plain.stamina).toBeLessThan(STAMINA.max);
  });

  it('Pastor: the deer runs 10 % faster', () => {
    const b = createBody(0, 0, flat);
    Object.assign(b, { riding: true, skills: ['pastor'] });
    run(b, { ...fwd, sprint: true }, 1);
    expect(Math.hypot(b.vx, b.vz)).toBeCloseTo(MOUNT.run * SKILL_FX.mount, 0);
  });
});
