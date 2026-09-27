import { describe, expect, it } from 'vitest';
import { NAMES } from './names';

const FORBIDDEN = /Marchito|Tragón|Raíz-madre|Corazón del Bosque|Enredadera|bruto reforzado|Ciénaga|Pantano|Zarzal|Montañas|Peldaños|Cucurucho/;

const SOURCES = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts', '!./names.ts'], { query: '?raw', import: 'default', eager: true });

/** Only string literals and templates, comments stripped. */
function literals(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  return code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];
}

describe('names', () => {
  it('has the placeholder names', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    expect(NAMES.villain).toBe('El Marchito');
    expect(NAMES.gate).toBe('la Ciénaga');
  });

  it('no proper name is hard-coded outside names.ts', () => {
    const hits = Object.entries(SOURCES).flatMap(([f, src]) => literals(src).filter((s) => FORBIDDEN.test(s)).map((s) => `${f}: ${s}`));
    expect(hits).toEqual([]);
  });
});
