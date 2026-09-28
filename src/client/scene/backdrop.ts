import * as THREE from 'three';
import { createRng } from '../../shared/rng';

/**
 * P7-E (spec §10.1): la Copa's painted backdrop, and the Raíces-madre turning white after the ending.
 * The backdrop is one open cylinder around la Copa with a canvas painted once: a dusk gradient and the
 * world seen from the top of the Torre (far mountains, the forest's treeline, the Heart's tree). 1 draw call.
 */
export const BACKDROP = { r: 70, h: 44, below: 14, sides: 32, texW: 1024, texH: 256 } as const;

export interface Skyline {
  /** Heights 0..1 of each band's silhouette, `n` samples around the circle. */
  mountains: number[];
  forest: number[];
  /** The Heart's tree: centre (0..1 around, south = 0.5) and height 0..1. */
  spike: { at: number; h: number };
}

/** The silhouettes, deterministic per seed: mountains tall and slow, the treeline low and ragged. */
export function copaSkyline(seed: number, n = 128): Skyline {
  const rng = createRng(seed ^ 0x5c0fa);
  const wave = (amp: number, base: number, octaves: number, jag: number): number[] => {
    const ph = Array.from({ length: octaves }, () => rng() * Math.PI * 2);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      let v = base;
      for (let o = 0; o < octaves; o++) v += (amp / (o + 1)) * Math.sin(a * (o + 2) + ph[o]!);
      v += (rng() - 0.5) * jag;
      return Math.min(1, Math.max(0, v));
    });
  };
  return { mountains: wave(0.18, 0.55, 3, 0.03), forest: wave(0.05, 0.28, 4, 0.08), spike: { at: 0.5, h: 0.72 } };
}

/** Bark → bone white as the world purifies (k 0..1). */
export const STUMP_WHITE = 0xe8e2d4;
export function stumpTint(bark: number, k: number): number {
  const t = Math.min(1, Math.max(0, k));
  const ch = (c: number, s: number) => (c >> s) & 255;
  let out = 0;
  for (const s of [16, 8, 0]) out |= Math.round(ch(bark, s) + (ch(STUMP_WHITE, s) - ch(bark, s)) * t) << s;
  return out;
}

/** The sky beam over a Raíz-madre fades as it turns white. */
export function beamOpacity(base: number, k: number): number {
  return base * (1 - Math.min(1, Math.max(0, k)));
}

function paint(sky: Skyline): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = BACKDROP.texW;
  c.height = BACKDROP.texH;
  const g = c.getContext('2d');
  if (!g) return null;
  const W = c.width;
  const H = c.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3a2450');
  grad.addColorStop(0.55, '#8a5a78');
  grad.addColorStop(0.8, '#e0a878');
  grad.addColorStop(1, '#f0c890');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // The Copa's floor cuts the cylinder at `below` m: silhouettes stand on that line.
  const base = H * (1 - BACKDROP.below / BACKDROP.h);
  const band = (hs: number[], color: string, top: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    hs.forEach((h, i) => g.lineTo((i / hs.length) * W, base - h * top));
    g.lineTo(W, base - hs[0]! * top);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  band(sky.mountains, '#6a6a8a', H * 0.4);
  // The Heart's tree to the south: a trunk and a round crown above the treeline.
  const sx = sky.spike.at * W;
  const top = base - sky.spike.h * H * 0.4;
  g.fillStyle = '#243a26';
  g.fillRect(sx - 3, top + 18, 6, H - top);
  g.beginPath();
  g.arc(sx, top + 14, 16, 0, Math.PI * 2);
  g.fill();
  band(sky.forest, '#1e3020', H * 0.4);
  return c;
}

/** The backdrop mesh centred on (x, floorY, z); null without a DOM (tests). */
export function copaBackdrop(x: number, floorY: number, z: number, seed = 7): THREE.Mesh | null {
  const canvas = paint(copaSkyline(seed));
  if (!canvas) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(BACKDROP.r, BACKDROP.r, BACKDROP.h, BACKDROP.sides, 1, true), mat);
  m.position.set(x, floorY - BACKDROP.below + BACKDROP.h / 2, z);
  m.name = 'copa-telon';
  return m;
}
