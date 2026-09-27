/**
 * Mountain weather (spec S4 §8): one per in-game day, from the seed, so client and server agree without the network.
 * Only the mountains feel it. Rain and storm make the rock wet (no free climbing); storms will bring the dragon (S4-G).
 */
export type Weather = 'clear' | 'rain' | 'storm';

/** Natural odds per day (the rest is clear), and the guarantee: a storm at least every `stormEvery` days. */
export const WEATHER = { storm: 0.15, rain: 0.25, stormEvery: 4 } as const;

export const WEATHER_TEXT: Record<Weather, string> = { clear: 'despejado', rain: 'lluvia', storm: 'tormenta' };

function roll(seed: number, day: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(day | 0, 0x85ebca77) ^ 0x5eed) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function natural(seed: number, day: number): Weather {
  const r = roll(seed, day);
  return r < WEATHER.storm ? 'storm' : r < WEATHER.storm + WEATHER.rain ? 'rain' : 'clear';
}

/**
 * The weather of in-game day `day` (floor(time / DAY_LENGTH)). A day is forced to storm when the previous
 * `stormEvery − 1` days had none: counted from the latest natural storm (or day −1), every 4th day storms.
 */
export function weatherAt(seed: number, day: number): Weather {
  const d = Math.max(0, Math.floor(day));
  const w = natural(seed, d);
  if (w === 'storm') return w;
  let s = d - 1;
  while (s >= 0 && natural(seed, s) !== 'storm') s--;
  return (d - s) % WEATHER.stormEvery === 0 ? 'storm' : w;
}

/** Rain or storm: the mountain rock is wet. */
export function wetAt(w: Weather): boolean {
  return w !== 'clear';
}

/** The dawn line at the Heart. */
export function weatherLine(w: Weather): string {
  return `Hoy en la montaña: ${WEATHER_TEXT[w]}`;
}
