import { describe, expect, it } from 'vitest';
import { weatherAt, weatherLine, wetAt, WEATHER } from './weather';

describe('weather', () => {
  it('is deterministic per seed and day', () => {
    for (let d = 0; d < 50; d++) expect(weatherAt(42, d)).toBe(weatherAt(42, d));
    const a = Array.from({ length: 40 }, (_, d) => weatherAt(1, d)).join();
    const b = Array.from({ length: 40 }, (_, d) => weatherAt(2, d)).join();
    expect(a).not.toBe(b);
  });

  it('never goes 4 days without a storm, and mixes the three', () => {
    for (const seed of [1, 42, 9001]) {
      const n = { clear: 0, rain: 0, storm: 0 };
      let gap = 0;
      for (let d = 0; d < 4000; d++) {
        const w = weatherAt(seed, d);
        n[w]++;
        gap = w === 'storm' ? 0 : gap + 1;
        expect(gap).toBeLessThan(WEATHER.stormEvery);
      }
      expect(n.storm / 4000).toBeGreaterThan(0.25);
      expect(n.storm / 4000).toBeLessThan(0.4);
      expect(n.rain / 4000).toBeGreaterThan(0.15);
      expect(n.clear / 4000).toBeGreaterThan(0.35);
    }
  });

  it('wet rock and the dawn line', () => {
    expect(wetAt('clear')).toBe(false);
    expect(wetAt('rain')).toBe(true);
    expect(wetAt('storm')).toBe(true);
    expect(weatherLine('rain')).toBe('Hoy en la montaña: lluvia');
  });
});
