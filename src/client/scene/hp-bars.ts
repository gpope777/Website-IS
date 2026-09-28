import * as THREE from 'three';
import { IMPACT } from '../impact';

const W = 1.1;
const H = 0.12;

/** P7-A: the floating bars over common enemies (pool of 4; two quads each, two shared materials; hidden = no draw calls). */
export class HpBarMeshes {
  readonly root = new THREE.Group();
  private readonly bars: { g: THREE.Group; fg: THREE.Mesh }[] = [];

  constructor() {
    const back = new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.7, depthTest: false });
    const front = new THREE.MeshBasicMaterial({ vertexColors: false, color: 0xffffff, depthTest: false });
    const bgGeo = new THREE.PlaneGeometry(W + 0.06, H + 0.06);
    const fgGeo = new THREE.PlaneGeometry(W, H);
    fgGeo.translate(W / 2, 0, 0); // grows from the left edge
    for (let i = 0; i < IMPACT.bars; i++) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(bgGeo, back);
      const fg = new THREE.Mesh(fgGeo, front.clone());
      fg.position.x = -W / 2;
      bg.renderOrder = 998;
      fg.renderOrder = 999;
      g.add(bg, fg);
      g.visible = false;
      this.bars.push({ g, fg });
      this.root.add(g);
    }
  }

  /** `at(id)` = the enemy's head position, or null when it is gone. */
  sync(list: { id: number; hp: number }[], at: (id: number) => THREE.Vector3 | null, camera: THREE.Camera): void {
    let i = 0;
    for (const b of list) {
      const p = at(b.id);
      if (!p || i >= this.bars.length) continue;
      const bar = this.bars[i++]!;
      bar.g.visible = true;
      bar.g.position.copy(p);
      bar.g.quaternion.copy(camera.quaternion);
      bar.fg.scale.x = Math.max(0.001, b.hp);
      (bar.fg.material as THREE.MeshBasicMaterial).color.setHSL(0.33 * b.hp, 0.7, 0.45); // green → red
    }
    for (; i < this.bars.length; i++) this.bars[i]!.g.visible = false;
  }
}
