import { describe, expect, it } from 'vitest';
import { ECHO, echoLines, pushEcho, zoneWhere, type EchoEvent } from './echo';

describe('echo log', () => {
  it('keeps the last 20', () => {
    const log: EchoEvent[] = [];
    for (let i = 0; i < 30; i++) pushEcho(log, { t: i, who: ['Bea'], kind: 'raid' });
    expect(log).toHaveLength(ECHO.max);
    expect(log[0]!.t).toBe(10);
  });

  it('groups by who and kind, most important first, skips mine and old ones', () => {
    const log: EchoEvent[] = [
      { t: 5, who: ['Bea'], kind: 'zone', what: zoneWhere(10) },
      { t: 20, who: ['Bea'], kind: 'zone', what: zoneWhere(11) },
      { t: 21, who: ['Bea'], kind: 'zone', what: zoneWhere(12) },
      { t: 22, who: ['Leo'], kind: 'mount', what: 'la Rana' },
      { t: 23, who: ['Ana'], kind: 'boss', what: 'El Zancudo' },
      { t: 24, who: ['Bea', 'Leo'], kind: 'raid' },
      { t: 25, who: ['Leo'], kind: 'rank', what: 'Rango 3' },
    ];
    expect(echoLines(log, 'Ana', 10, 0)).toEqual(['Leo domó a la Rana.', 'Bea limpió 2 zonas del Pantano.', 'Bea y Leo aguantaron un asedio.']);
  });

  it('puts the Puesto last and keeps 3 lines', () => {
    const log: EchoEvent[] = [
      { t: 1, who: ['Bea'], kind: 'boss', what: 'El Antenón' },
      { t: 2, who: ['Bea'], kind: 'whale' },
      { t: 3, who: ['Bea'], kind: 'mount', what: 'el Ciervo' },
    ];
    const l = echoLines(log, 'Ana', 0, 4);
    expect(l).toHaveLength(3);
    expect(l[0]).toBe('Bea purificó a El Antenón.');
    expect(l[2]).toBe('Tu puesto vendió 4 veces.');
    expect(echoLines([], 'Ana', 0, 1)).toEqual(['Tu puesto vendió 1 vez.']);
  });

  it('empty when nothing happened, no exclamations', () => {
    expect(echoLines([{ t: 1, who: ['Ana'], kind: 'raid' }], 'Ana', 0, 0)).toEqual([]);
    const all: EchoEvent[] = (['ending', 'boss', 'invasion', 'pillar', 'whale', 'mount', 'zone', 'raid', 'rank'] as const).map((kind, i) => ({ t: i + 1, who: [`P${i}`], kind, what: 'x' }));
    for (let i = 0; i < 9; i++) for (const s of echoLines(all.slice(i, i + 1), 'Ana', 0, 0)) expect(s).not.toContain('!');
  });

  it('zone biomes', () => {
    expect(echoLines([{ t: 1, who: ['Bea'], kind: 'mount', what: 'el Ciervo' }], 'Ana', 0, 0)).toEqual(['Bea domó al Ciervo.']);
    expect(zoneWhere(1)).toBe('del Bosque');
    expect(zoneWhere(6)).toBe('de la Costa');
    expect(zoneWhere(14)).toBe('de las Montañas');
    expect(zoneWhere(18)).toBe('de las Tierras Corruptas');
  });
});
