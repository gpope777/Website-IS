import { inBravas } from '../../shared/fish';
import { coastFeatures, HALF, inSwamp, SOUTH, SWAMP, WATER_LEVEL, type Terrain } from '../../shared/terrain';

/**
 * V2-D (spec §5.4): pure data for the water shader. The depth under the sea/swamp quad is baked once into a
 * map the fragment shader reads (no depth buffer, no vertex texture fetch).
 */
export type WaterKind = 'mar' | 'pantano' | 'lago' | 'lagoLimpio';

export interface WaterLook {
  shallow: number;
  deep: number;
  foam: number;
  /** Opacity over the shallows and over deep water. */
  aShallow: number;
  aDeep: number;
}

export const WATER: Record<WaterKind, WaterLook> = {
  mar: { shallow: 0x3fc6c0, deep: 0x0d3f6a, foam: 0xf2fbff, aShallow: 0.45, aDeep: 0.9 },
  pantano: { shallow: 0x4a5a2a, deep: 0x232d14, foam: 0x6e7a4a, aShallow: 0.7, aDeep: 0.95 },
  lago: { shallow: 0x2a1838, deep: 0x0a0610, foam: 0x9a5ad0, aShallow: 0.8, aDeep: 0.97 },
  lagoLimpio: { shallow: 0x4ab8d8, deep: 0x1a5a90, foam: 0xf2fbff, aShallow: 0.5, aDeep: 0.9 },
};

/** The sea/swamp quad's extent (same as the old buildWater) and the baked map's size. */
export const WATER_MAP = { size: 512, maxDepth: 16, x0: SWAMP.x0, x1: HALF, z0: -HALF, z1: SOUTH } as const;

/** RGBA per texel: R depth under WATER_LEVEL (0..maxDepth → 0..255), G swamp, B aguas bravas, A 255. Row = z. */
export function bakeWaterMap(t: Terrain, seed: number, size: number = WATER_MAP.size): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const { island } = coastFeatures(seed);
  const { x0, x1, z0, z1, maxDepth } = WATER_MAP;
  for (let j = 0; j < size; j++) {
    const z = z0 + ((j + 0.5) / size) * (z1 - z0);
    for (let i = 0; i < size; i++) {
      const x = x0 + ((i + 0.5) / size) * (x1 - x0);
      const d = WATER_LEVEL - t.heightAt(x, z);
      const k = (j * size + i) * 4;
      out[k] = Math.round(Math.max(0, Math.min(1, d / maxDepth)) * 255);
      out[k + 1] = inSwamp(x, z) ? 255 : 0;
      out[k + 2] = z > HALF && inBravas(island, x, z) ? 255 : 0;
      out[k + 3] = 255;
    }
  }
  return out;
}

/** Visual waves (medium/high): two small sines; the physics water level never moves. */
export const WAVES = { amp: 0.15, len: [18, 31] as const, speed: [1.1, 0.8] as const, swampK: 0.2 } as const;

/** CPU mirror of the vertex shader's wave height. */
export function waveHeight(x: number, z: number, t: number): number {
  const k = x < SWAMP.x1 ? WAVES.swampK : 1;
  const a = Math.sin((x * 0.8 + z * 0.6) * ((2 * Math.PI) / WAVES.len[0]) + t * WAVES.speed[0]);
  const b = Math.sin((x * -0.3 + z * 0.95) * ((2 * Math.PI) / WAVES.len[1]) + t * WAVES.speed[1]);
  return WAVES.amp * k * (a * 0.6 + b * 0.4);
}

/** The camera is under the surface it is over (a hair of margin so the surface itself does not flicker). */
export function underwater(camY: number, surface: number): boolean {
  return camY < surface - 0.05;
}
