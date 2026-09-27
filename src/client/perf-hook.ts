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
  /** V2-C: show las Tierras purified (the end-state look). */
  purified?: boolean;
  /** V2-E: hide the local robot (showcase shots). */
  hideMe?: boolean;
  /** V2-E: a fixed close-up camera instead of the rig. */
  cam?: { back: number; up: number; ahead: number; lookY: number };
}

export interface PerfTarget {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  ready(): boolean;
  tier(): string;
  stop(p: PerfStop | null): void;
  /** Connected and welcomed (after the harness re-imports a safe world the page reconnects by itself). */
  online(): boolean;
  /** V2-C: the corrupt zones, and a client-only cleanse to watch the healing wave (`--ola`). */
  zones(): { id: number; x: number; z: number; r: number }[];
  cleanse(id: number): void;
  /** V2-E: a client-only showcase ahead of the stop ('mounts', 'enemies', 'paper', 'pose:<anim>'; null clears). */
  showcase(what: string | null): void;
}

/** Installs the hook; returns its remover. */
export function installPerfHook(t: PerfTarget): () => void {
  const w = window as unknown as { __perf?: unknown };
  w.__perf = {
    ready: () => t.ready(),
    tier: () => t.tier(),
    stop: (p: PerfStop) => t.stop(p),
    release: () => t.stop(null),
    online: () => t.online(),
    zones: () => t.zones(),
    cleanse: (id: number) => t.cleanse(id),
    showcase: (what: string | null) => t.showcase(what),
    info: () => {
      const i = t.renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, lines: i.render.lines, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 };
    },
  };
  (w.__perf as Record<string, unknown>).top = (n = 15) => triangleHogs(t.scene, n);
  return () => delete w.__perf;
}

/** Rough upper bound of triangles each visible mesh submits (ignores frustum culling), biggest first. */
export function triangleHogs(scene: THREE.Object3D, n: number): { name: string; tris: number; culled: boolean }[] {
  const out: { name: string; tris: number; culled: boolean }[] = [];
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh & { count?: number; isInstancedMesh?: boolean };
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    const per = (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
    const inst = m.isInstancedMesh ? (m.count ?? 1) : 1;
    let name = m.name || m.parent?.name || '';
    if (!name) name = `${m.type}:${g.type}:${per}`;
    out.push({ name, tris: Math.round(per * inst), culled: m.frustumCulled });
  });
  return out.sort((a, b) => b.tris - a.tris).slice(0, n);
}
