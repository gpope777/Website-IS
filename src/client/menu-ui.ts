/** P7-C: the tabbed Menú (spec §5.2) and Ayuda by topic (§5.3). HTML only; `hud.ts` wires it. */
import { BUILD_COST, TEND_COST } from '../shared/items';
import { costText, NAMES } from '../shared/names';
import { STALL } from '../shared/shop';
import type { Seen } from './hud-model';

export type MenuTab = 'jugar' | 'libro' | 'ajustes' | 'ayuda' | 'salir';
export const MENU_TABS: readonly { id: MenuTab; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'libro', label: NAMES.book },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'ayuda', label: 'Ayuda' },
  { id: 'salir', label: 'Salir' },
];
export const isMenuTab = (v: unknown): v is MenuTab => MENU_TABS.some((t) => t.id === v);

/** P7-D: `dots` marks tabs with something new (●). */
export function tabsHtml(active: MenuTab, dots: Partial<Record<MenuTab, boolean>> = {}): string {
  return `<nav class="tabs" role="tablist">${MENU_TABS.map((t) => `<button role="tab" class="tab${t.id === active ? ' on' : ''}${dots[t.id] ? ' new' : ''}" aria-selected="${t.id === active}" data-tab="${t.id}">${t.label}</button>`).join('')}</nav>`;
}

export interface HelpCard {
  title: string;
  lines: string[];
}

/** One card per topic, only once it was met (the Moverse card always); controls of the device in use. */
export function helpCards(seen: ReadonlySet<Seen>, touch: boolean): HelpCard[] {
  const k = (t: string, pc: string) => (touch ? t : pc);
  const cards: [boolean, HelpCard][] = [
    [true, { title: 'Moverse', lines: [
      k('Stick izquierdo para andar; al borde, corres. Arrastra a la derecha para mirar.', 'WASD para andar, Shift para correr. El ratón mira.'),
      k('B salta. En el aire, B abre el planeador.', 'Espacio salta. En el aire, Espacio abre el planeador.'),
      'Empuja contra una enredadera para trepar. Gasta aliento.',
      k('A coge, tala y pica.', 'E coge, tala y pica. C cambia la cámara.'),
    ] }],
    [seen.has('berries') || seen.has('wood'), { title: 'Comida y fuego', lines: [
      k('🫐 come bayas.', 'La tecla 1 come bayas.'),
      `${k('🔥', 'B')} pone una fogata (${costText(BUILD_COST.campfire)}). De noche, calienta.`,
    ] }],
    [seen.has('wolf'), { title: 'Pelear', lines: [
      k('A golpea. 🌀 rueda.', 'E golpea. Q rueda.'),
      `${k('🛡️', 'Z')} bloquea. Justo antes del mordisco: parada.`,
      k('🎯 fija un objetivo. 🏹 dispara.', 'X fija un objetivo. R dispara.'),
      `${k('A', 'E')} junto a un compañero caído lo levanta.`,
    ] }],
    [seen.has('power'), { title: 'Poderes', lines: [
      k('🌿 lanza el poder elegido. Mantén 🌿 medio segundo para cambiar.', 'H lanza el poder elegido. J cambia.'),
      'Cada poder abre caminos: mira qué crece, arde o se mueve.',
    ] }],
    [seen.has('mount'), { title: 'Monturas', lines: [
      'Para domar: pulsa cuando la aguja cruce la zona, tres veces.',
      k('A junto a tu montura: subir y bajar.', 'M sube y baja. Shift, galope.'),
    ] }],
    [seen.has('heart'), { title: `${NAMES.heart} y asedios`, lines: [
      'Es tu casa. De noche lo atacan desde las zonas moradas.',
      `${k('🧱', 'V')} pone un muro. ${k('🗡️', 'T, Y, U, I')} pone ${k('la trampa elegida en Jugar', 'una trampa')}.`,
      `${k('A', 'E')} junto a él con ${costText(TEND_COST)} lo cura.`,
    ] }],
    [seen.has('orb'), { title: 'Santuarios y zonas', lines: [
      'Los haces de luz son santuarios. Cada uno da un orbe: +20 de aliento.',
      'Las zonas moradas se limpian con un orbe, con un poder junto a su raíz o venciendo a su jefe.',
    ] }],
    [seen.has('dungeon'), { title: 'Mazmorras', lines: [
      `Palancas, losas y braseros. ${k('A', 'E')} coge y suelta.`,
      'Cuando un bruto se agache, apártate o rueda.',
    ] }],
    [seen.has('fogata'), { title: 'Fogatas', lines: [
      `De día, ${k('A', 'E')} junto a una encendida te lleva al ${NAMES.heart} en 5 s. Un golpe o moverte lo corta.`,
      `Desde el ${NAMES.heart}, Jugar te lleva a ellas.`,
    ] }],
    [seen.has('shop'), { title: 'Tiendas', lines: [
      `Tu ${NAMES.stall.toLowerCase()} se pone desde Jugar (${costText(STALL.cost)}). Vende aunque no estés.`,
      `${k('A', 'E')} junto a otro jugador: ${NAMES.trade.toLowerCase()}.`,
    ] }],
    [seen.has('marchito'), { title: NAMES.villain, lines: [
      'No se le puede matar. Golpes y paradas le quitan voluntad. A 0, se va.',
      k('✕ cierra una visión.', 'Enter o ✕ cierra una visión.'),
    ] }],
  ];
  return cards.filter(([on]) => on).map(([, c]) => c);
}

export function helpHtml(cards: readonly HelpCard[]): string {
  return cards.map((c) => `<section class="help-card"><h3>${c.title}</h3>${c.lines.map((l) => `<p>${l}</p>`).join('')}</section>`).join('');
}
