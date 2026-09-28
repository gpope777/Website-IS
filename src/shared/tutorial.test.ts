import { describe, expect, it } from 'vitest';
import { hasProgress, isTutState, TUT, tutAdvance, tutLine, tutPills, tutStart, type TutEvent, type TutProgress } from './tutorial';

const run = (p: TutProgress, ...es: TutEvent[]) => es.reduce(tutAdvance, p);
const walk = (m: number, turn = 0): TutEvent => ({ k: 'move', m, turn });

describe('tutAdvance', () => {
  it('step 1 needs both the walk and the turn', () => {
    expect(run(tutStart(), walk(12)).step).toBe(1);
    expect(run(tutStart(), walk(0, 2)).step).toBe(1);
    expect(run(tutStart(), walk(6, 0.8), walk(5, -0.8)).step).toBe(2);
  });
  it('step 2 on eating', () => {
    expect(run(tutStart(2), { k: 'inv', inv: { berries: 2 } }).step).toBe(2);
    expect(run(tutStart(2), { k: 'eat' }).step).toBe(3);
  });
  it('step 3 on having the fogata cost, however it arrived', () => {
    expect(run(tutStart(3), { k: 'inv', inv: { wood: 5, stone: 2 } }).step).toBe(3);
    expect(run(tutStart(3), { k: 'inv', inv: { wood: 9, stone: 3 } }).step).toBe(4);
  });
  it('step 4 on a fogata only', () => {
    expect(run(tutStart(4), { k: 'build', kind: 'wall' }).step).toBe(4);
    expect(run(tutStart(4), { k: 'build', kind: 'campfire' }).step).toBe(5);
  });
  it('step 5 on the Heart built or reached', () => {
    expect(run(tutStart(5), { k: 'build', kind: 'campfire' }).step).toBe(5);
    expect(run(tutStart(5), { k: 'build', kind: 'heart' }).step).toBe(6);
    expect(run(tutStart(5), { k: 'heartNear' }).step).toBe(6);
  });
  it('step 6 on a parry, 2 dodges, 3 bites or the kill', () => {
    expect(run(tutStart(6), { k: 'parry' }).step).toBe(7);
    expect(run(tutStart(6), { k: 'dodge' }).step).toBe(6);
    expect(run(tutStart(6), { k: 'dodge' }, { k: 'dodge' }).step).toBe(7);
    expect(run(tutStart(6), { k: 'bitten' }, { k: 'bitten' }).step).toBe(6);
    expect(run(tutStart(6), { k: 'bitten' }, { k: 'bitten' }, { k: 'bitten' }).step).toBe(7);
    expect(run(tutStart(6), { k: 'kill' }).step).toBe(7);
  });
  it('step 7 on an arrow, step 8 on 30 m', () => {
    expect(run(tutStart(7), { k: 'kill' }).step).toBe(7);
    expect(run(tutStart(7), { k: 'bow' }).step).toBe(8);
    expect(run(tutStart(8), walk(20)).step).toBe(8);
    expect(run(tutStart(8), walk(20), walk(11)).step).toBe(9);
  });
  it('ignores other steps\' events and resets counters on a new step', () => {
    expect(run(tutStart(1), { k: 'eat' }, { k: 'bow' }, { k: 'parry' }).step).toBe(1);
    const p = run(tutStart(6), { k: 'dodge' }, { k: 'parry' });
    expect(p).toEqual(tutStart(7));
    expect(run(tutStart(9), { k: 'bow' }).step).toBe(9);
  });
});

describe('hasProgress', () => {
  const empty = { inv: {} };
  it('an empty save has none', () => expect(hasProgress(empty, { ownsStructure: false, xp: 0 })).toBe(false));
  it('any progress counts', () => {
    const cases = [{ shrines: [1] }, { enredadera: true }, { piedra: true }, { steed: { x: 0, z: 0 } }, { dragon: { x: 0, z: 0 } }, { skills: ['mano'] }, { kills: { wolf: 1 } }, { chests: [0] }, { weaponLvl: 1 }, { capaLvl: 1 }, { inv: { wood: 1 } }];
    for (const c of cases) expect(hasProgress({ ...empty, ...c }, { ownsStructure: false, xp: 0 })).toBe(true);
    expect(hasProgress(empty, { ownsStructure: true, xp: 0 })).toBe(true);
    expect(hasProgress(empty, { ownsStructure: false, xp: 5 })).toBe(true);
  });
});

describe('tutPills', () => {
  it('grow with the steps; wall, trap and power never', () => {
    expect(tutPills(1, false).filter(Boolean).length).toBe(0);
    expect(tutPills(2, false)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    expect(tutPills(5, false)[3]).toBe(true);
    expect(tutPills(5, true)[3]).toBe(false);
    expect(tutPills(6, true).slice(5, 7)).toEqual([true, true]);
    const all = tutPills(8, false);
    expect(all.length).toBe(10);
    expect([all[2], all[4], all[9]]).toEqual([false, false, false]);
    expect(all.slice(7, 9)).toEqual([true, true]);
  });
});

describe('tutLine', () => {
  const o = { touch: true, heart: false, inv: {}, wait: false };
  it('one line per step, touch vs PC, dry', () => {
    for (let s = 1; s <= TUT.steps; s++) {
      for (const touch of [true, false]) {
        const t = tutLine(s, { ...o, touch });
        expect(t.startsWith(`${s}/8 · `)).toBe(true);
        expect(t).not.toContain('!');
        expect(t.length).toBeLessThanOrEqual(100);
      }
    }
    expect(tutLine(4, o)).toContain('🔥');
    expect(tutLine(4, { ...o, touch: false })).toContain('B pone');
    expect(tutLine(9, o)).toBe('');
  });
  it('step 3 and 5 say what you have', () => {
    expect(tutLine(3, { ...o, inv: { wood: 2, stone: 1 } })).toContain('Tienes 2 y 1.');
    expect(tutLine(5, { ...o, inv: { wood: 7 } })).toContain('Tienes 7 y 0.');
    expect(tutLine(5, { ...o, heart: true })).toContain('ya tiene Corazón');
  });
  it('waits', () => expect(tutLine(3, { ...o, wait: true })).toBe('3/8 · Primero, aguanta.'));
});

describe('isTutState', () => {
  it('accepts steps and the two ends', () => {
    expect([1, 8, 'done', 'skip'].every(isTutState)).toBe(true);
    expect([0, 9, 1.5, 'x', null].some(isTutState)).toBe(false);
  });
});
