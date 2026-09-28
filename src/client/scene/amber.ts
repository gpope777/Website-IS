import * as THREE from 'three';
import type { AmberTree } from '../../shared/swamp-shrines';
import { buildCrags } from './crags';

const TRUNK = new THREE.MeshLambertMaterial({ color: 0x3b2c22, flatShading: true });
/** Ripe amber glows through the fog (no real lights: phones). */
const RIPE = new THREE.MeshBasicMaterial({ color: 0xffa332, fog: false });
const SPENT = new THREE.MeshLambertMaterial({ color: 0x6b4a22, flatShading: true });

/** Sunken amber trees: a dark crooked trunk and an orange blob of amber, dim while it regrows for you. */
export class AmberMeshes {
  readonly group = new THREE.Group();
  private readonly blobs: { mesh: THREE.Mesh; id: number }[] = [];

  constructor(trees: readonly AmberTree[], shadows: boolean) {
    this.group.add(buildCrags(trees.flatMap((t) => (t.stump ? [t.stump] : [])), shadows));
    for (const t of trees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 3.2, 6), TRUNK);
      trunk.position.set(t.x + 0.6, t.y + 1.6, t.z);
      trunk.rotation.z = 0.15;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), RIPE);
      blob.position.set(t.x + 0.2, t.y + 1.8, t.z + 0.3);
      this.group.add(trunk, blob);
      this.blobs.push({ mesh: blob, id: t.id });
    }
  }

  sync(regrowing: readonly number[]): void {
    for (const b of this.blobs) b.mesh.material = regrowing.includes(b.id) ? SPENT : RIPE;
  }

  animate(t: number): void {
    for (const b of this.blobs) b.mesh.rotation.y = t * 0.6 + b.id;
  }
}
