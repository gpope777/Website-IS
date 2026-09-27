import * as THREE from 'three';
import { TOWER } from '../../shared/corrupt-lands';
import type { Terrain } from '../../shared/terrain';

/** Within this many metres the real tower draws; beyond, only its sky copy (spec S5 §3.3). */
export const TOWER_NEAR = 300;
/** The sky copy sits at this fraction of the camera's far plane. */
export const SKY_AT = 0.8;

/** Where to draw the sky copy: on the ray camera → tower base, `dist` away, scaled so it covers the same angle. */
export function skyPlacement(cam: { x: number; y: number; z: number }, base: { x: number; y: number; z: number }, dist: number): { x: number; y: number; z: number; scale: number } {
  const dx = base.x - cam.x;
  const dy = base.y - cam.y;
  const dz = base.z - cam.z;
  const real = Math.max(1e-3, Math.hypot(dx, dy, dz));
  const k = dist / real;
  return { x: cam.x + dx * k, y: cam.y + dy * k, z: cam.z + dz * k, scale: k };
}

/** A twisted 12-sided cone of unit height, dark purple with a violet tip (vertex colours). */
function towerGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(TOWER.r, 1, 12, 8);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const body = new THREE.Color(0x2a1638);
  const tip = new THREE.Color(0x9b5cff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const a = y * 1.6; // the twist
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
    c.copy(body).lerp(tip, Math.max(0, (y - 0.8) / 0.2));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * El Marchito's tower (S5-A): the real mesh near it, and from anywhere else one unfogged "sky" copy drawn first
 * with no depth write (the mountains cover its base), placed inside the far plane. 1 draw call either way.
 */
export class VillainTower {
  readonly group = new THREE.Group();
  readonly real: THREE.Mesh;
  readonly sky: THREE.Mesh;
  private readonly base: THREE.Vector3;

  constructor(terrain: Terrain) {
    const geo = towerGeometry();
    this.base = new THREE.Vector3(TOWER.x, terrain.heightAt(TOWER.x, TOWER.z), TOWER.z);
    this.real = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.real.position.copy(this.base);
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.group.add(this.real, this.sky);
  }

  update(cam: THREE.Vector3, height: number, far: number): void {
    // Real within 300 m, but never past the far plane (low tier draws 120 m): beyond that the sky copy takes over.
    const near = Math.hypot(cam.x - this.base.x, cam.z - this.base.z) < Math.min(TOWER_NEAR, far * SKY_AT);
    this.real.visible = near;
    this.sky.visible = !near;
    this.real.scale.set(1, height, 1);
    if (near) return;
    const p = skyPlacement(cam, this.base, far * SKY_AT);
    this.sky.position.set(p.x, p.y, p.z);
    this.sky.scale.set(p.scale, height * p.scale, p.scale);
  }
}
