import * as THREE from 'three';
import type { Weather } from '../../shared/weather';

/** Rain or snow around the player in las Montañas on wet days (S4 §8): one Points cloud, one draw call. */
export const PRECIP = { count: 600, box: 40, height: 24, snowAbove: 55, rainFall: 18, snowFall: 2.2 } as const;

/** What falls: nothing on clear days; snow high up (terrain height over `snowAbove`), rain below. */
export function precipKind(w: Weather | null, groundY: number): 'rain' | 'snow' | null {
  if (!w || w === 'clear') return null;
  return groundY > PRECIP.snowAbove ? 'snow' : 'rain';
}

/** The day clock crossed dawn (0.22, the end of night) between two frames. */
export function dawnCrossed(prev: number, now: number): boolean {
  return prev < 0.22 && now >= 0.22 && now - prev < 0.5;
}

/** How much the mountain sky darkens: 0 clear or away, 0.5 rain, 1 storm. */
export function stormDim(w: Weather | null): number {
  return w === 'storm' ? 1 : w === 'rain' ? 0.5 : 0;
}

export class WeatherFx {
  private readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly mat: THREE.PointsMaterial;
  private kind: 'rain' | 'snow' | null = null;

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(PRECIP.count * 3);
    for (let i = 0; i < PRECIP.count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * PRECIP.box;
      this.pos[i * 3 + 1] = Math.random() * PRECIP.height;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * PRECIP.box;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xaab8c8, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  /** `w` null outside the mountains. The cloud is drawn relative to the player (x, groundY, z). */
  update(w: Weather | null, x: number, groundY: number, z: number, dt: number): void {
    const kind = precipKind(w, groundY);
    this.points.visible = kind !== null;
    if (!kind) return;
    if (kind !== this.kind) {
      this.kind = kind;
      this.mat.color.set(kind === 'snow' ? 0xffffff : 0xaab8c8);
      this.mat.size = kind === 'snow' ? 0.25 : 0.12;
    }
    const fall = (kind === 'snow' ? PRECIP.snowFall : PRECIP.rainFall) * dt;
    for (let i = 0; i < PRECIP.count; i++) {
      let y = this.pos[i * 3 + 1]! - fall;
      if (y < 0) y += PRECIP.height;
      this.pos[i * 3 + 1] = y;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.position.set(x, groundY - 4, z);
  }
}
