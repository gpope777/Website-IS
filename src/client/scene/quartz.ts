import * as THREE from 'three';
import type { QuartzVein } from '../../shared/mountain-shrines';

/** Quartz glints white from far away (no real lights, no fog: they are the lures). */
const RIPE = new THREE.MeshBasicMaterial({ color: 0xf4fbff, fog: false });
const SPENT = new THREE.MeshLambertMaterial({ color: 0x8c8f94, flatShading: true });

/** Quartz veins: a small cluster of crystals on the face, grey while it regrows for you. One instanced mesh per state. */
export class QuartzMeshes {
  readonly group = new THREE.Group();
  private readonly ripe: THREE.InstancedMesh;
  private readonly spent: THREE.InstancedMesh;
  private key = '';

  constructor(private readonly veins: readonly QuartzVein[]) {
    const geo = new THREE.OctahedronGeometry(0.45, 0);
    geo.scale(0.7, 1.6, 0.7);
    this.ripe = new THREE.InstancedMesh(geo, RIPE, veins.length * 3);
    this.spent = new THREE.InstancedMesh(geo, SPENT, veins.length * 3);
    this.group.add(this.ripe, this.spent);
    this.sync([]);
  }

  sync(regrowing: readonly number[]): void {
    const key = regrowing.join();
    if (key === this.key && this.ripe.count + this.spent.count > 0) return;
    this.key = key;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    let r = 0;
    let d = 0;
    for (const v of this.veins) {
      const mesh = regrowing.includes(v.id) ? this.spent : this.ripe;
      for (let k = 0; k < 3; k++) {
        q.setFromEuler(new THREE.Euler(0.3 * (k - 1), k, 0.25 * (k - 1)));
        m.compose(new THREE.Vector3(v.x + (k - 1) * 0.35, v.y + 0.4 + k * 0.1, v.z + ((k * 7) % 3) * 0.15), q, s);
        mesh.setMatrixAt(mesh === this.ripe ? r++ : d++, m);
      }
    }
    this.ripe.count = r;
    this.spent.count = d;
    this.ripe.instanceMatrix.needsUpdate = true;
    this.spent.instanceMatrix.needsUpdate = true;
  }
}
