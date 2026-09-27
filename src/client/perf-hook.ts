/** V2-A: `window.__perf` for `npm run perf` (scripts/perf/run.mjs). Loaded only by dev and `--mode perf` builds. */
import type * as THREE from 'three';

export interface PerfStop {
  x: number;
  z: number;
  /** Feet height; default the ground. */
  y?: number;
  yaw: number;
  pitch: number;
  /** Day fraction, 0 = midnight, 0.5 = noon. */
  frac: number;
}

export interface PerfTarget {
  renderer: THREE.WebGLRenderer;
  ready(): boolean;
  tier(): string;
  stop(p: PerfStop | null): void;
}

/** Installs the hook; returns its remover. */
export function installPerfHook(t: PerfTarget): () => void {
  const w = window as unknown as { __perf?: unknown };
  w.__perf = {
    ready: () => t.ready(),
    tier: () => t.tier(),
    stop: (p: PerfStop) => t.stop(p),
    release: () => t.stop(null),
    info: () => {
      const i = t.renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, lines: i.render.lines, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 };
    },
  };
  return () => delete w.__perf;
}
