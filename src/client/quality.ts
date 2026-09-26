export type Tier = 'low' | 'medium' | 'high';

export interface TierSettings {
  pixelRatio: number;
  shadows: boolean;
  shadowMap: number;
  grass: number;
  drawDistance: number;
  terrainSegments: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  low: { pixelRatio: 1, shadows: false, shadowMap: 0, grass: 2500, drawDistance: 120, terrainSegments: 160 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMap: 1024, grass: 6000, drawDistance: 180, terrainSegments: 200 },
  high: { pixelRatio: 2, shadows: true, shadowMap: 2048, grass: 12000, drawDistance: 260, terrainSegments: 240 },
};

export const TIER_LABELS: Record<Tier, string> = { low: 'Baja (móvil)', medium: 'Media', high: 'Alta (PC)' };

// ponytail: heuristic from device hints; the player can override in the menu. Replace with a quick FPS probe if it guesses wrong often.
export function pickTier(d: { touch: boolean; memoryGb?: number; cores?: number; gpu?: string }): Tier {
  if (d.touch) return (d.memoryGb ?? 4) >= 6 && (d.cores ?? 4) >= 8 ? 'medium' : 'low';
  if (/intel|mali|adreno|powervr|swiftshader/i.test(d.gpu ?? '')) return 'medium';
  return 'high';
}

const KEY = 'bosque.tier';

function detectGpu(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

export function loadTier(): Tier {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    // storage blocked: fall through to detection
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return pickTier({
    touch: matchMedia('(pointer: coarse)').matches,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    gpu: detectGpu(),
  });
}

export function saveTier(t: Tier): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
}
