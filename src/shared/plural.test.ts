import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });

/** P7-C: a number glued to a material word by hand ("${n} perlas") must go through qty(). */
const WORDS = '(madera|piedra|bayas?|perlas?|ámbar|cuarzos?|espinas?)';
const PATTERNS = [
  new RegExp(`\\$\\{[^}]+\\} (de )?${WORDS}\\b`),
  /\$\{[^}]+\} (de )?\$\{(NAMES\.(pearl|amber|quartz|thorn)|THORNS|ITEM_LABELS\[[^\]]+\][^}]*|low\([^)]*\))\}/,
];

export function handPlurals(src: string): string[] {
  return src.split('\n').filter((l) => PATTERNS.some((p) => p.test(l)));
}

describe('no hand-built plurals (P7-C)', () => {
  it('the check catches one', () => {
    expect(handPlurals('`Vendo ${sh.n} ${low(sh.give)}`')).toHaveLength(1);
    expect(handPlurals('`Hacen falta ${n} bayas`')).toHaveLength(1);
    expect(handPlurals('`Hacen falta ${qty(n, "berries")}`')).toHaveLength(0);
  });
  it('none left in src', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    const bad = Object.entries(SOURCES).flatMap(([f, src]) => handPlurals(src).map((l) => `${f}: ${l.trim()}`));
    expect(bad).toEqual([]);
  });
});
