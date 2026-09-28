/**
 * Every player-facing proper name, in one place so the nephews can rename things.
 * Articles and gender live inside each sentence that uses a name: a rename may need its sentence fixed.
 */
export const NAMES = {
  villain: 'El Marchito',
  heart: 'Corazón del Bosque',
  forestRoot: 'Raíz-madre',
  coastRoot: 'Raíz-madre de la Costa',
  bossForest: 'Tragón de Papel',
  /** Short form used mid-sentence ("al Tragón"). */
  bossForestShort: 'Tragón',
  bossCoast: 'El Antenón',
  eliteForest: 'bruto reforzado',
  eliteCoast: 'bruto escudado',
  powerVine: 'Enredadera',
  powerWind: 'Viento',
  biomeForest: 'el Bosque',
  biomeCoast: 'la Costa',
  gate: 'la Ciénaga',
  deer: 'el Ciervo',
  fish: 'el Pez Grande',
  whale: 'la Ballena',
  pearl: 'perla',
  biomeSwamp: 'el Pantano',
  swampRoot: 'Raíz-madre del Pantano',
  swampGate: 'el Zarzal',
  river: 'la Boca del Río',
  bossSwamp: 'El Zancudo',
  eliteSwamp: 'bruto de turba',
  lieutenant1: 'La Gata Araña',
  powerFire: 'Fuego',
  frog: 'la Rana',
  amber: 'ámbar',
  capa: 'Capa de corteza',
  fogata: 'fogata',
  biomeMountains: 'las Montañas',
  mountainRoot: 'Raíz-madre de la Montaña',
  mountainGate: 'los Peldaños',
  stairs: 'la Escalera del Umbral',
  peak: 'el Pico',
  bossMountain: 'El Cucurucho',
  eliteMountain: 'bruto de roca',
  lieutenant2: 'El Triángulo',
  powerStone: 'Piedra',
  dragon: 'el Dragón',
  dragonWild: 'el Dragón Marchito',
  quartz: 'cuarzo',
  refugio: 'refugio',
  tower: 'torre',
  biomeCorrupt: 'las Tierras Corruptas',
  rim: 'el Borde',
  ash: 'la Ceniza',
  thornland: 'el Espinar',
  blackLake: 'el Lago Negro',
  brokenSteps: 'los Escalones rotos',
  /** El Marchito's tower (NAMES.tower is the Piedra trap). */
  villainTower: 'la Torre',
  treeTower: 'el Árbol-torre',
  rootPillar: 'Pilar-raíz',
  lieutenant3: 'La Flecha',
  flier: 'rayo marchito',
  blackHeart: 'el Corazón Negro',
  guardian: 'el Guardián',
  legendary: 'la Estrella',
  thorn: 'espina negra',
  crack: 'la Grieta',
  challengeNights: 'Noches de desafío',
  /** S5-G: the post-ending raids toggle at the Heart (the spec's challengeNights meant "off by default"). */
  raidNights: 'Noches de asedio',
  maker: 'Gabriel',
  game: 'Bosque',
  credits: 'el sobrino',
  /** P4-A: progression. */
  xp: 'Savia',
  rank: 'Rango',
  /** P4-B: the passive skills and their three branches. */
  skills: 'Oficios',
  branches: ['Andar', 'Oficio', 'Compañía'],
  skillNames: {
    pies: 'Pies ligeros',
    planeo: 'Planeo largo',
    pulmon: 'Pulmón',
    trepador: 'Trepador',
    mano: 'Mano buena',
    fogatero: 'Fogatero',
    trampero: 'Trampero',
    ojo: 'Buen ojo',
    amiga: 'Mano amiga',
    silbido: 'Silbido',
    mochila: 'Mochila honda',
    pastor: 'Pastor',
  },
  /** P4-C: colour and hat. */
  look: 'Aspecto',
  colorNames: ['Naranja', 'Azul', 'Verde', 'Rojo', 'Morado', 'Hueso', 'Carbón', 'Rosa'],
  hatNames: {
    hoja: 'Hoja',
    caracola: 'Caracola',
    ambar: 'Corona de ámbar',
    cuarzo: 'Cuernos de cuarzo',
    aureola: 'Aureola blanca',
    estrella: 'Estrella',
    papel: 'Papel doblado',
    nieve: 'Gorro de nieve',
    marchita: 'Corona marchita',
  },
  /** P4-D: the Libro and the Proezas. */
  book: 'Libro',
  feat: 'Proeza',
  feats: 'Proezas',
  featNames: ['Sin un rasguño', 'Pez veloz', 'Pies secos', 'Solo contra el frío', 'Noche entera', 'Corazón quieto'],
  /** T6-A: the player shop and its till. */
  stall: 'Puesto',
  till: 'Caja',
  /** T6-C: trueque directo. */
  trade: 'Cambiar',
  /** T6-D: the merchant NPC and a Busco shelf. */
  merchant: 'Buhonero',
  order: 'Encargo',
} as const;

/** P7-C: singular and plural of each material (spec §5.4). Uncountable ones repeat; ámbar takes "de". */
type Mat = 'wood' | 'stone' | 'berries' | 'pearl' | 'amber' | 'quartz' | 'thorn';
const plural = (w: string) => w.split(' ').map((p) => (/[aeiouáéó]$/.test(p) ? `${p}s` : `${p}es`)).join(' ');
export const ITEM_FORMS: Record<Mat, readonly [string, string]> = {
  wood: ['madera', 'madera'],
  stone: ['piedra', 'piedra'],
  berries: ['baya', 'bayas'],
  pearl: [NAMES.pearl, plural(NAMES.pearl)],
  amber: [NAMES.amber, `de ${NAMES.amber}`],
  quartz: [NAMES.quartz, plural(NAMES.quartz)],
  thorn: [NAMES.thorn, plural(NAMES.thorn)],
};
const MAT_ORDER: readonly Mat[] = ['wood', 'stone', 'berries', 'pearl', 'amber', 'quartz', 'thorn'];

/** The material word for `n` of it ("perla", "perlas", "de ámbar"). */
export function itemWord(n: number, item: Mat): string {
  return ITEM_FORMS[item][n === 1 ? 0 : 1];
}

/** "1 perla", "3 perlas", "2 de ámbar". Every text with a number and a material goes through here. */
export function qty(n: number, item: Mat): string {
  return `${n} ${itemWord(n, item)}`;
}

/** A cost or a bundle: "8 madera, 4 piedra" (in the game's item order, zeros skipped). */
export function costText(cost: Partial<Record<Mat, number>>): string {
  return MAT_ORDER.filter((k) => (cost[k] ?? 0) > 0).map((k) => qty(cost[k]!, k)).join(', ');
}
