import * as THREE from 'three';
import type { Chest } from '../../shared/coast-shrines';
import { WATER_LEVEL } from '../../shared/terrain';

const WOOD = new THREE.MeshLambertMaterial({ color: 0x5a3b22, flatShading: true });
const LID = new THREE.MeshLambertMaterial({ color: 0xc9a13b, emissive: 0x3a2a05, flatShading: true });
const DARK = new THREE.MeshLambertMaterial({ color: 0x3a2e24, flatShading: true });

/** Sunken chests: a small box on the seabed and a soft column of bubbling light up to the surface. */
export class ChestMeshes {
  readonly group = new THREE.Group();
  private readonly items: { lid: THREE.Mesh; glow: THREE.Mesh; mat: THREE.MeshBasicMaterial; id: number }[] = [];

  constructor(chests: readonly Chest[]) {
    for (const c of chests) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.7), WOOD);
      box.position.set(c.x, c.y + 0.3, c.z);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.2, 0.75), LID);
      lid.position.set(c.x, c.y + 0.7, c.z);
      const h = WATER_LEVEL - c.y;
      const mat = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.18, depthWrite: false });
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h, 8, 1, true), mat);
      glow.position.set(c.x, c.y + h / 2, c.z);
      this.group.add(box, lid, glow);
      this.items.push({ lid, glow, mat, id: c.id });
    }
  }

  sync(opened: readonly number[]): void {
    for (const it of this.items) {
      const done = opened.includes(it.id);
      it.glow.visible = !done;
      it.lid.material = done ? DARK : LID;
    }
  }

  animate(t: number): void {
    for (const it of this.items) it.mat.opacity = 0.14 + Math.sin(t * 2 + it.id) * 0.06;
  }
}
