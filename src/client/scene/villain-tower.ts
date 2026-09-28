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

const CRACKS = 4;
const CRACK_LIT = new THREE.Color(0xc07aff);
const CRACK_DARK = new THREE.Color(0x140a1c);
const UP = new THREE.Vector3(0, 1, 0);

/** A twisted 12-sided cone of unit height (vertex colours: see `paintTower`). */
function towerGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(TOWER.r, 1, 12, 8);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const a = y * 1.6; // the twist
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  paintTower(geo, false);
  geo.computeVertexNormals();
  return geo;
}

/** Dark purple with a violet tip; after the ending (S5-G) white bark with a green, leafy tip. */
function paintTower(geo: THREE.BufferGeometry, white: boolean): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const body = new THREE.Color(white ? 0xeeeae0 : 0x2a1638);
  const tip = new THREE.Color(white ? 0x5fae4a : 0x9b5cff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(body).lerp(tip, Math.max(0, (pos.getY(i) - (white ? 0.7 : 0.8)) / (white ? 0.3 : 0.2)));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
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
  /** S5-C: one violet crack per Pilar-raíz, dark once it breaks (one instanced mesh, near only). */
  readonly cracks: THREE.InstancedMesh;
  private crackKey = '';
  /** S5-D: a violet doorway at the tower's foot once Invasión 3 is over (near only). */
  readonly door: THREE.Mesh;
  private open = false;

  constructor(terrain: Terrain) {
    const geo = towerGeometry();
    this.base = new THREE.Vector3(TOWER.x, terrain.heightAt(TOWER.x, TOWER.z), TOWER.z);
    this.real = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.real.position.copy(this.base);
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.cracks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1, 0.5), new THREE.MeshBasicMaterial({ fog: false }), CRACKS);
    for (let i = 0; i < CRACKS; i++) this.cracks.setColorAt(i, CRACK_LIT);
    this.door = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), new THREE.MeshBasicMaterial({ color: 0xc89aff, side: THREE.DoubleSide }));
    this.door.position.set(this.base.x, this.base.y + 3.5, this.base.z + TOWER.r - 0.2); // south face, toward the world
    this.door.visible = false;
    this.group.add(this.real, this.sky, this.cracks, this.door);
  }

  setOpen(open: boolean): void {
    this.open = open;
  }

  /** S5-G: the tower turns white (one geometry, shared by the real and sky copies). */
  setWhite(white: boolean): void {
    paintTower(this.real.geometry, white);
  }

  /** Dark cracks for the broken Pilares-raíz. */
  setCracks(broken: readonly boolean[]): void {
    const key = broken.join();
    if (key === this.crackKey) return;
    this.crackKey = key;
    for (let i = 0; i < CRACKS; i++) this.cracks.setColorAt(i, broken[i] ? CRACK_DARK : CRACK_LIT);
    this.cracks.instanceColor!.needsUpdate = true;
  }

  private placeCracks(height: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < CRACKS; i++) {
      const f = 0.15 + 0.12 * i;
      const a = (i * Math.PI) / 2 + f * 1.6; // follows the twist
      const r = TOWER.r * (1 - f) + 0.1;
      q.setFromAxisAngle(UP, a);
      m.compose(new THREE.Vector3(this.base.x + Math.sin(a) * r, this.base.y + f * height, this.base.z + Math.cos(a) * r), q, new THREE.Vector3(1, height * 0.06, 1));
      this.cracks.setMatrixAt(i, m);
    }
    this.cracks.instanceMatrix.needsUpdate = true;
  }

  update(cam: THREE.Vector3, height: number, far: number): void {
    // Real within 300 m, but never past the far plane (low tier draws 120 m): beyond that the sky copy takes over.
    const near = Math.hypot(cam.x - this.base.x, cam.z - this.base.z) < Math.min(TOWER_NEAR, far * SKY_AT);
    this.real.visible = near;
    this.cracks.visible = near;
    this.door.visible = near && this.open;
    this.sky.visible = !near;
    if (this.real.scale.y !== height) this.placeCracks(height);
    this.real.scale.set(1, height, 1);
    if (near) return;
    const p = skyPlacement(cam, this.base, far * SKY_AT);
    this.sky.position.set(p.x, p.y, p.z);
    this.sky.scale.set(p.scale, height * p.scale, p.scale);
  }
}
