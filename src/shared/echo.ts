/** P7-D: "El eco del bosque" (spec §9). A short in-memory log of world milestones and the 3-line card you get on returning. */
import { isCoastZone, isCorruptLandZone, isMountainZone, isSwampZone } from './corruption';
import { NAMES } from './names';

export type EchoKind = 'ending' | 'boss' | 'invasion' | 'pillar' | 'whale' | 'mount' | 'zone' | 'raid' | 'rank';
/** `who`: everyone credited (empty = the world itself). `what`: a boss name, a beast, a biome, a Rango. */
export interface EchoEvent { t: number; who: string[]; kind: EchoKind; what?: string }

export const ECHO = { max: 20, awayMs: 30 * 60 * 1000, lines: 3 } as const;

const ORDER: readonly EchoKind[] = ['ending', 'boss', 'invasion', 'pillar', 'whale', 'mount', 'zone', 'raid', 'rank'];

/** Keeps the last 20. */
export function pushEcho(log: EchoEvent[], e: EchoEvent): void {
  log.push(e);
  if (log.length > ECHO.max) log.splice(0, log.length - ECHO.max);
}

/** Where a corruption zone is, for "limpió 2 zonas del Pantano". */
/** "el Pantano" → "del Pantano", "la Costa" → "de la Costa". */
const de = (b: string): string => (b.startsWith('el ') ? `del ${b.slice(3)}` : `de ${b}`);

/** Where a corruption zone is, for "limpió 2 zonas del Pantano". */
export function zoneWhere(id: number): string {
  if (isCoastZone(id)) return de(NAMES.biomeCoast);
  if (isSwampZone(id)) return de(NAMES.biomeSwamp);
  if (isMountainZone(id)) return de(NAMES.biomeMountains);
  if (isCorruptLandZone(id)) return de(NAMES.biomeCorrupt);
  return de(NAMES.biomeForest);
}

export function joinWho(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

const VERB: Record<EchoKind, [string, string]> = {
  ending: ['venció', 'vencieron'],
  boss: ['purificó', 'purificaron'],
  invasion: ['aguantó', 'aguantaron'],
  pillar: ['rompió', 'rompieron'],
  whale: ['domó', 'domaron'],
  mount: ['domó', 'domaron'],
  zone: ['limpió', 'limpiaron'],
  raid: ['aguantó', 'aguantaron'],
  rank: ['llegó', 'llegaron'],
};

/** "a el Ciervo" → "al Ciervo". */
export const toA = (what: string): string => (what.startsWith('el ') ? `al ${what.slice(3)}` : `a ${what}`);

function line(kind: EchoKind, who: string, many: boolean, n: number, what: string): string {
  const w = who || 'El bosque';
  const v = VERB[kind][many ? 1 : 0];
  switch (kind) {
    case 'ending':
      return `${w} ${v} a ${NAMES.villain}.`;
    case 'boss':
      return `${w} ${v} ${toA(what)}.`;
    case 'invasion':
      return `${w} ${v} a ${NAMES.villain}${what ? ` (${what})` : ''}.`;
    case 'pillar':
      return `${w} ${v} ${n === 1 ? 'un Pilar-raíz' : `${n} Pilares-raíz`}.`;
    case 'whale':
      return `${w} ${v} a ${NAMES.whale}.`;
    case 'mount':
      return `${w} ${v} ${toA(what)}.`;
    case 'zone':
      return `${w} ${v} ${n === 1 ? 'una zona' : `${n} zonas`} ${what}.`;
    case 'raid':
      return `${w} ${v} ${n === 1 ? 'un asedio' : `${n} asedios`}.`;
    case 'rank':
      return `${w} ${v} a ${what}.`;
  }
}

/** ≤ 3 lines of what others did since `since` (grouped, most important first), plus your Puesto's sales last. */
export function echoLines(log: readonly EchoEvent[], me: string, since: number, sold: number): string[] {
  const groups = new Map<string, { kind: EchoKind; who: string; many: boolean; what: string; n: number; t: number }>();
  for (const e of log) {
    if (e.t <= since || e.who.includes(me)) continue;
    const who = joinWho(e.who);
    const what = e.what ?? '';
    // Ranks: only the highest per person; zones group per biome; the rest per thing.
    const key = e.kind === 'rank' ? `rank|${who}` : `${e.kind}|${who}|${e.kind === 'pillar' || e.kind === 'raid' ? '' : what}`;
    const g = groups.get(key);
    if (g) {
      g.n++;
      g.what = what;
      g.t = e.t;
    } else groups.set(key, { kind: e.kind, who, many: e.who.length > 1, what, n: 1, t: e.t });
  }
  const sorted = [...groups.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.t - a.t);
  const out = sorted.map((g) => line(g.kind, g.who, g.many, g.n, g.what));
  const room = sold > 0 ? ECHO.lines - 1 : ECHO.lines;
  const lines = out.slice(0, room);
  if (sold > 0) lines.push(`Tu ${NAMES.stall.toLowerCase()} vendió ${sold} ${sold === 1 ? 'vez' : 'veces'}.`);
  return lines;
}
