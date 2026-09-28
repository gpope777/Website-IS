import * as THREE from 'three';
import { CORRUPT_LANDS, type Terrain } from '../../shared/terrain';
import type { TierSettings } from '../quality';
import { CHUNK, chunkKey, chunksNear, GRASS, seedChunk, type Blade } from './ground';
import { LIFE_UNIFORMS, patchGrass } from './patches';

/** Heights along a blade (fraction) for the 3 vertex pairs; the tip is the 7th vertex. */
const RINGS = [0, 0.4, 0.75];
const TRIS = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];
const WIDTH = 0.07;

/** One chunk's blades as a geometry: 7 vertices / 5 triangles each, heights baked (no vertex textures). */
export function bladeGeometry(blades: readonly Blade[]): THREE.BufferGeometry {
  const n = blades.length;
  const pos = new Float32Array(n * 21);
  const col = new Uint8Array(n * 21);
  const root = new Float32Array(n * 21);
  const blade = new Float32Array(n * 14);
  const idx = new Uint16Array(n * 15);
  const a = new THREE.Color();
  const b = new THREE.Color();
  const c = new THREE.Color();
  blades.forEach((bl, i) => {
    const g = GRASS[bl.biome];
    a.setHex(g.root).multiplyScalar(0.85 + bl.rnd * 0.3);
    b.setHex(g.tip).multiplyScalar(0.85 + bl.rnd * 0.3);
    const sx = Math.cos(bl.yaw);
    const sz = Math.sin(bl.yaw);
    const lean = 0.25 * bl.h;
    const kind = bl.biome === 'tierras' ? 1 : 0;
    const w = WIDTH * (0.8 + bl.rnd * 0.5);
    const put = (v: number, t: number, side: number) => {
      const o = i * 7 + v;
      const ww = w * (1 - t * 0.7) * side;
      pos.set([bl.x + sx * ww - sz * lean * t * t, bl.y + bl.h * t, bl.z + sz * ww + sx * lean * t * t], o * 3);
      c.copy(a).lerp(b, t);
      col.set([Math.min(255, c.r * 255), Math.min(255, c.g * 255), Math.min(255, c.b * 255)], o * 3);
      root.set([bl.x, bl.y, bl.z], o * 3);
      blade.set([t, kind + bl.rnd * 0.999], o * 2);
    };
    RINGS.forEach((t, k) => {
      put(k * 2, t, -1);
      put(k * 2 + 1, t, 1);
    });
    put(6, 1, 0);
    for (let k = 0; k < 15; k++) idx[i * 15 + k] = i * 7 + TRIS[k]!;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute('aRoot', new THREE.BufferAttribute(root, 3));
  geo.setAttribute('aBlade', new THREE.BufferAttribute(blade, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/**
 * V2-C (spec §5.3): wind-swayed grass in every biome with ground, in 32 m chunks shown within the tier's
 * radius. One mesh per chunk (frustum-culled by Three), one shared material, built lazily and cached.
 */
export class GrassField {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private readonly cache = new Map<string, { mesh: THREE.Mesh; used: number }>();
  private lastX = Infinity;
  private lastZ = Infinity;
  private purified = false;
  private frame = 0;
  private want: { cx: number; cz: number }[] = [];

  constructor(
    private readonly terrain: Terrain,
    private readonly seed: number,
    private readonly tier: TierSettings,
    tierName: string,
  ) {
    this.group.name = 'grass';
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    patchGrass(this.material, { waves: tierName === 'low' ? 1 : 2, press: tierName === 'high' });
    LIFE_UNIFORMS.grassFar.value = tier.grassRadius;
  }

  /** Las Tierras grow grass once purified: rebuild their chunks when that flips. */
  setPurified(p: boolean): void {
    if (p === this.purified) return;
    this.purified = p;
    for (const [k, e] of this.cache) {
      const cz = Number(k.split(',')[1]);
      if (cz * CHUNK >= CORRUPT_LANDS.z1) continue;
      e.mesh.geometry.dispose();
      e.mesh.removeFromParent();
      this.cache.delete(k);
    }
    this.lastX = Infinity;
  }

  /** Every frame: after a 4 m move, pick the chunks in range; builds at most 2 new chunks a frame. */
  update(x: number, z: number): void {
    this.frame++;
    if (Math.hypot(x - this.lastX, z - this.lastZ) > 4) {
      this.lastX = x;
      this.lastZ = z;
      this.want = chunksNear(x, z, this.tier.grassRadius);
      const keep = new Set(this.want.map((c) => chunkKey(c.cx, c.cz)));
      for (const [k, e] of this.cache) e.mesh.visible = keep.has(k) && !e.mesh.userData.empty;
    }
    let built = 0;
    for (const c of this.want) {
      const k = chunkKey(c.cx, c.cz);
      const e = this.cache.get(k);
      if (e) {
        e.used = this.frame;
        continue;
      }
      if (built++ >= 2) continue;
      const blades = seedChunk(this.terrain, c.cx, c.cz, this.tier.grassPerChunk, this.seed, this.purified);
      const mesh = new THREE.Mesh(bladeGeometry(blades), this.material);
      mesh.name = 'grass';
      mesh.receiveShadow = this.tier.shadows;
      mesh.userData.empty = blades.length === 0;
      mesh.visible = blades.length > 0;
      this.group.add(mesh);
      this.cache.set(k, { mesh, used: this.frame });
    }
    if (this.cache.size > this.want.length + 16) this.evict();
  }

  private evict(): void {
    const old = [...this.cache.entries()].filter(([, e]) => e.used < this.frame).sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of old.slice(0, this.cache.size - this.want.length - 8)) {
      e.mesh.geometry.dispose();
      e.mesh.removeFromParent();
      this.cache.delete(k);
    }
  }
}
