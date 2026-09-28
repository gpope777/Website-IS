/** P7-D: first-time tips, "new" dots and the tracker's dimming (spec §7.1, §7.3). Pure; `game.ts` and `hud.ts` wire it. */
import { NAMES } from '../shared/names';
import type { Seen } from './hud-model';

export const TIPS_KEY = 'bosque.tips';
export const ACK_KEY = 'bosque.ack';
export const TIP_MS = 6000;
export const DIM = { after: 8000, alpha: 0.4 } as const;

export type TipId =
  | 'look' | 'berries' | 'wood' | 'glide' | 'night' | 'cold' | 'wolf' | 'roll' | 'bow' | 'lowHp' | 'heart' | 'raid' | 'orb' | 'power' | 'vine' | 'wind' | 'fire' | 'stone' | 'mount' | 'dungeon' | 'fogata' | 'shop' | 'marchito' | 'bog' | 'zarzal';

/** [touch, PC] one line each. */
export const TIPS: Record<TipId, readonly [string, string]> = {
  look: ['Arrastra a la derecha para mirar. El stick anda.', 'El ratón mira. WASD anda, Shift corre.'],
  berries: ['🫐 come bayas. El hambre baja despacio.', 'La tecla 1 come bayas.'],
  wood: ['🔥 pone una fogata. De noche, calienta.', 'B pone una fogata. De noche, calienta.'],
  glide: ['En el aire, B abre el planeador.', 'En el aire, Espacio abre el planeador.'],
  night: ['De noche enfría. Quédate cerca del fuego.', 'De noche enfría. Quédate cerca del fuego.'],
  cold: ['Hace frío. Una fogata o un refugio calientan.', 'Hace frío. Una fogata o un refugio calientan.'],
  wolf: ['🛡️ justo antes del mordisco: parada.', 'Z justo antes del mordisco: parada.'],
  roll: ['🌀 rueda. Esquiva cualquier golpe.', 'Q rueda. Esquiva cualquier golpe.'],
  bow: ['🎯 fija un objetivo. 🏹 dispara.', 'X fija un objetivo. R dispara.'],
  lowHp: ['Poca vida. Come o apártate un rato.', 'Poca vida. Come o apártate un rato.'],
  heart: ['De noche atacan el Corazón. 🧱 pone muros.', 'De noche atacan el Corazón. V pone muros.'],
  raid: ['Asedio. Aguanta hasta el alba.', 'Asedio. Aguanta hasta el alba.'],
  orb: ['Cada orbe da +20 de aliento.', 'Cada orbe da +20 de aliento.'],
  power: ['Mantén 🌿 medio segundo para cambiar de poder.', 'H lanza el poder. J cambia.'],
  vine: [`La ${NAMES.powerVine} crece hacia arriba. Sirve de escalera.`, `La ${NAMES.powerVine} crece hacia arriba. Sirve de escalera.`],
  wind: [`El ${NAMES.powerWind} empuja, apaga y hace volar.`, `El ${NAMES.powerWind} empuja, apaga y hace volar.`],
  fire: [`El ${NAMES.powerFire} quema zarzas, nudos y braseros.`, `El ${NAMES.powerFire} quema zarzas, nudos y braseros.`],
  stone: [`La ${NAMES.powerStone} cae y pesa. Aplasta y hace de losa.`, `La ${NAMES.powerStone} cae y pesa. Aplasta y hace de losa.`],
  mount: ['A junto a tu montura: subir y bajar.', 'M sube y baja. Shift, galope.'],
  dungeon: ['Si un bruto se agacha, apártate o rueda.', 'Si un bruto se agacha, apártate o rueda.'],
  fogata: ['De día, A en una fogata encendida te lleva a casa.', 'De día, E en una fogata encendida te lleva a casa.'],
  shop: ['Tu puesto vende aunque no estés.', 'Tu puesto vende aunque no estés.'],
  marchito: ['No se le mata. Sin voluntad, se va.', 'No se le mata. Sin voluntad, se va.'],
  bog: ['El barro frena y muerde. Mejor montado.', 'El barro frena y muerde. Mejor montado.'],
  zarzal: [`${NAMES.swampGate.charAt(0).toUpperCase()}${NAMES.swampGate.slice(1)} muerde. Hay otro camino.`, `${NAMES.swampGate.charAt(0).toUpperCase()}${NAMES.swampGate.slice(1)} muerde. Hay otro camino.`],
};
export const TIP_IDS = Object.keys(TIPS) as TipId[];

export const tipText = (id: TipId, touch: boolean): string => TIPS[id][touch ? 0 : 1];

export interface TipView {
  seen: ReadonlySet<Seen>;
  /** In the air (jumping or falling). */
  air: boolean;
  night: boolean;
  cold: boolean;
  raid: boolean;
  bog: boolean;
  zarzal: boolean;
  lowHp: boolean;
  powers: readonly ('vine' | 'wind' | 'fire' | 'stone')[];
}

/** Tips whose moment has come and that this device has not shown, in a fixed order. */
export function tipsDue(v: TipView, shown: ReadonlySet<TipId>): TipId[] {
  const on: Record<TipId, boolean> = {
    look: true,
    berries: v.seen.has('berries'),
    wood: v.seen.has('wood'),
    glide: v.air,
    night: v.night,
    cold: v.cold,
    wolf: v.seen.has('wolf'),
    roll: v.seen.has('wolf'),
    bow: v.seen.has('wolf'),
    lowHp: v.lowHp,
    heart: v.seen.has('heart'),
    raid: v.raid,
    orb: v.seen.has('orb'),
    power: v.powers.length > 1,
    vine: v.powers.includes('vine'),
    wind: v.powers.includes('wind'),
    fire: v.powers.includes('fire'),
    stone: v.powers.includes('stone'),
    mount: v.seen.has('mount'),
    dungeon: v.seen.has('dungeon'),
    fogata: v.seen.has('fogata'),
    shop: v.seen.has('shop'),
    marchito: v.seen.has('marchito'),
    bog: v.bog,
    zarzal: v.zarzal,
  };
  return TIP_IDS.filter((id) => on[id] && !shown.has(id));
}

export function parseTips(raw: string | null): Set<TipId> {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? (v.filter((k) => TIP_IDS.includes(k as TipId)) as TipId[]) : []);
  } catch {
    return new Set();
  }
}

/** One tip at a time, 6 s each, first in first out; a tip already queued is not queued twice. */
export class TipQueue {
  private q: TipId[] = [];
  private cur: { id: TipId; at: number } | null = null;

  push(ids: readonly TipId[]): void {
    for (const id of ids) if (!this.q.includes(id) && this.cur?.id !== id) this.q.push(id);
  }

  /** The tip on screen now (null: none); a new one starts when the old one has had its 6 s. */
  current(now: number): TipId | null {
    if (this.cur && now - this.cur.at >= TIP_MS) this.cur = null;
    if (!this.cur && this.q.length) this.cur = { id: this.q.shift()!, at: now };
    return this.cur?.id ?? null;
  }

  clear(): void {
    this.q = [];
    this.cur = null;
  }
}

/** What the player has acknowledged, per device: oficio points seen, Ayuda cards seen, pills tapped. */
export interface Ack { pts: number; cards: string[]; pills: boolean[] }
export interface DotsIn { skillPts: number; cards: readonly string[]; pills: readonly boolean[] }
export interface Dots { menu: boolean; libro: boolean; ayuda: boolean; pills: boolean[] }

/** The first load acknowledges everything current: no flood of dots for a veteran. */
export const ackAll = (d: DotsIn): Ack => ({ pts: d.skillPts, cards: [...d.cards], pills: [...d.pills] });

export function dots(d: DotsIn, ack: Ack): Dots {
  const libro = d.skillPts > 0 && d.skillPts !== ack.pts;
  const ayuda = d.cards.some((c) => !ack.cards.includes(c));
  const pills = d.pills.map((on, i) => on && !ack.pills[i]);
  return { menu: libro || ayuda, libro, ayuda, pills };
}

export function parseAck(raw: string | null): Ack | null {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Ack>) : null;
    if (!v || typeof v !== 'object') return null;
    return { pts: typeof v.pts === 'number' ? v.pts : 0, cards: Array.isArray(v.cards) ? v.cards.filter((c) => typeof c === 'string') : [], pills: Array.isArray(v.pills) ? v.pills.map(Boolean) : [] };
  } catch {
    return null;
  }
}

/** Full for 8 s after the line changes (or a tap), then 40 %. */
export const lineAlpha = (sinceChange: number): number => (sinceChange < DIM.after ? 1 : DIM.alpha);
