import * as THREE from 'three';
import type { GraveView } from '../../shared/protocol';

const STONE = new THREE.MeshLambertMaterial({ color: 0x6f716c, flatShading: true });
const STICK = new THREE.MeshLambertMaterial({ color: 0x5a3e26 });
const BEAM = new THREE.MeshBasicMaterial({ color: 0xb07cff, transparent: true, opacity: 0.35, depthWrite: false });

/** Headstones where players dropped their backpacks. Your own graves get a tall violet beam. */
export class GraveMeshes {
  readonly group = new THREE.Group();
  private readonly byId = new Map<number, THREE.Group>();

  sync(graves: readonly GraveView[], me: string): void {
    const seen = new Set<number>();
    for (const g of graves) {
      seen.add(g.id);
      if (this.byId.has(g.id)) continue;
      const obj = this.make(g.owner === me);
      obj.position.set(g.x, g.y, g.z);
      this.group.add(obj);
      this.byId.set(g.id, obj);
    }
    for (const [id, obj] of this.byId) {
      if (seen.has(id)) continue;
      obj.removeFromParent();
      this.byId.delete(id);
    }
  }

  private make(mine: boolean): THREE.Group {
    const g = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.2), STONE);
    stone.position.y = 0.35;
    stone.rotation.z = 0.08;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), STICK);
    post.position.set(0, 0.35, 0.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), STICK);
    arm.position.set(0, 0.5, 0.5);
    g.add(stone, post, arm);
    if (mine) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12, 8, 1, true), BEAM);
      beam.position.y = 6;
      g.add(beam);
    }
    return g;
  }
}
