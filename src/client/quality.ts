export type Tier = 'low' | 'medium' | 'high';

export interface TierSettings {
  pixelRatio: number;
  shadows: boolean;
  shadowMap: number;
  grass: number;
  drawDistance: number;
  terrainSegments: number;
  // V2-A: declared now, read by the V2 plans that need them (spec §3, §7).
  /** Grass shown within this radius (m). */
  grassRadius: number;
  /** Blades pre-seeded in one 32×32 m grass chunk. */
  grassPerChunk: number;
  /** Water quad subdivisions (1 = flat, no vertex waves). */
  waterGrid: number;
  /** Cloud layers. */
  clouds: number;
  /** Twinkling stars. */
  stars: boolean;
  /** Exponential height fog instead of linear. */
  heightFog: boolean;
  /** Lamps/fires that brighten the terrain shader (uniform slots). */
  glowPoints: number;
  /** Ambient life: fireflies (flocks = 1/2/3 by tier). */
  ambient: number;
  /** Biome particles (leaves, ash, midges, snow). */
  particles: number;
  /** Triplanar rock on steep terrain. */
  triplanar: boolean;
  /** Shadow camera radius (m); 0 = no shadows. */
  shadowRadius: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  low: { pixelRatio: 1, shadows: false, shadowMap: 0, grass: 2500, drawDistance: 120, terrainSegments: 160,
    grassRadius: 35, grassPerChunk: 2100, waterGrid: 1, clouds: 0, stars: false, heightFog: false, glowPoints: 4, ambient: 40, particles: 200, triplanar: false, shadowRadius: 0 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMap: 1024, grass: 6000, drawDistance: 180, terrainSegments: 200,
    grassRadius: 60, grassPerChunk: 2700, waterGrid: 64, clouds: 1, stars: false, heightFog: true, glowPoints: 8, ambient: 120, particles: 400, triplanar: true, shadowRadius: 40 },
  high: { pixelRatio: 2, shadows: true, shadowMap: 2048, grass: 12000, drawDistance: 260, terrainSegments: 240,
    grassRadius: 90, grassPerChunk: 3600, waterGrid: 128, clouds: 2, stars: true, heightFog: true, glowPoints: 8, ambient: 250, particles: 600, triplanar: true, shadowRadius: 60 },
};

export const TIER_ORDER: readonly Tier[] = ['low', 'medium', 'high'];

export function lowerTier(t: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(t);
  return i > 0 ? TIER_ORDER[i - 1]! : null;
}

/** Spec §7 first-game probe: frame times (ms) of the first 4 s in the world. Only ever lowers by itself. */
export const PROBE = { secs: 4, skip: 20, slowMs: 33, fastMs: 12 } as const;

export function probeVerdict(frameMs: readonly number[], tier: Tier, touch: boolean): 'down' | 'offer' | 'keep' {
  const rest = frameMs.slice(PROBE.skip);
  if (rest.length === 0) return 'keep';
  const mean = rest.reduce((a, b) => a + b, 0) / rest.length;
  if (mean > PROBE.slowMs && tier !== 'low') return 'down';
  if (mean < PROBE.fastMs && tier === 'low' && touch) return 'offer';
  return 'keep';
}

export type GuardAction = { kind: 'ratio'; ratio: number } | { kind: 'tier'; tier: Tier };

/** Spec §7 in-game guard: under 24 fps over 10 s → pixel ratio ×0.85 (to 0.7 on low, once on medium/high), then one tier down. One change a minute. */
export const GUARD = { window: 10, minFps: 24, step: 0.85, lowFloor: 0.7, cooldown: 60, gap: 0.5 } as const;

export class FpsGuard {
  private floor: number;
  private since = 0;
  private frames = 0;
  private last = -Infinity;

  constructor(private tier: Tier, private ratio: number) {
    this.floor = this.floorFor(tier, ratio);
  }

  private floorFor(tier: Tier, ratio: number): number {
    return tier === 'low' ? GUARD.lowFloor : round2(ratio * GUARD.step);
  }

  feed(dt: number, now: number): GuardAction | null {
    if (dt > GUARD.gap) {
      // hidden tab or a hitch: start the window again
      this.since = 0;
      this.frames = 0;
      return null;
    }
    this.since += dt;
    this.frames++;
    if (this.since < GUARD.window) return null;
    const fps = this.frames / this.since;
    this.since = 0;
    this.frames = 0;
    if (fps >= GUARD.minFps || now - this.last < GUARD.cooldown) return null;
    if (this.ratio > this.floor + 1e-9) {
      this.ratio = Math.max(this.floor, round2(this.ratio * GUARD.step));
      this.last = now;
      return { kind: 'ratio', ratio: this.ratio };
    }
    const down = lowerTier(this.tier);
    if (!down) return null;
    this.tier = down;
    this.ratio = TIERS[down].pixelRatio;
    this.floor = this.floorFor(down, this.ratio);
    this.last = now;
    return { kind: 'tier', tier: down };
  }
}

function round2(x: number): number {
  return Math.round(x * 100 + 1e-6) / 100;
}

export const TIER_LABELS: Record<Tier, string> = { low: 'Baja (móvil)', medium: 'Media', high: 'Alta (PC)' };

// First guess from device hints; the player can override it in the menu, and the first-game FPS probe (probeVerdict) lowers it if it guessed high.
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
