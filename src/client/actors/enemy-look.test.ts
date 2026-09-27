import { describe, expect, it } from 'vitest';
import { chargingKinds, enemyLook } from './enemy-look';
import type { EnemyKind } from '../../shared/protocol';

const FOX: EnemyKind[] = ['wolf', 'brute', 'elite', 'elite2', 'elite3', 'elite4'];

describe('enemy looks', () => {
  it('every fox-drawn kind has its own colour, paper kinds none', () => {
    const cols = new Set(FOX.map((k) => enemyLook(k, 'bosque', false)!.color));
    expect(cols.size).toBe(FOX.length);
    for (const k of ['boss', 'boss2', 'marchito', 'anchor', 'rayo', 'lieut1', 'core', 'brote'] as EnemyKind[]) expect(enemyLook(k, 'bosque', false)).toBeNull();
  });

  it("keeps today's sizes", () => {
    expect(enemyLook('wolf', 'bosque', false)!.scale).toBe(1);
    expect(enemyLook('wolf', 'bosque', true)!.scale).toBe(1.3);
    expect(enemyLook('brute', 'bosque', false)!.scale).toBe(1.8);
    for (const k of ['elite', 'elite2', 'elite3', 'elite4'] as EnemyKind[]) expect(enemyLook(k, 'bosque', false)!.scale).toBe(2.4);
  });

  it('a wolf in las Tierras is an ash beast with embers', () => {
    const a = enemyLook('wolf', 'tierras', false)!;
    expect(a.key).toBe('ash');
    expect(a.emissive).not.toBe(0);
    expect(enemyLook('wolf', 'costa', false)!.key).toBe('wolf');
  });

  it('maps each dungeon charge to its brute', () => {
    const none = { elite: null, coast: { elite: null }, swamp: { elite: null }, mountain: { elite: null } } as never;
    expect(chargingKinds(none)).toEqual([]);
    const d = { elite: { charging: true }, coast: { elite: { charging: false } }, swamp: { elite: { charging: true } }, mountain: { elite: { charging: true } } } as never;
    expect(chargingKinds(d)).toEqual(['elite', 'elite3', 'elite4']);
  });
});
