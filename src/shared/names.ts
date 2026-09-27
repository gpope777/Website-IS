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
} as const;
