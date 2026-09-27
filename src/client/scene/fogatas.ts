import * as THREE from 'three';
import type { Fogata } from '../../shared/fogatas';

const STONE = new THREE.MeshLambertMaterial({ color: 0x5c5a55, flatShading: true });
/** Lit fogatas glow through the fog (no real lights: phones). */
const FLAME = new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: false });
const EMBER = new THREE.MeshBasicMaterial({ color: 0xffd36b, fog: false });

/** Swamp fogatas: a ring of stones, and a flame once someone lights it. */
export class FogataMeshes {
  readonly group = new THREE.Group();
  private readonly flames: THREE.Group[] = [];

  constructor(spots: readonly Fogata[]) {
    const stone = new THREE.DodecahedronGeometry(0.28, 0);
    const cone = new THREE.ConeGeometry(0.45, 1.3, 6);
    const core = new THREE.ConeGeometry(0.22, 0.8, 5);
    for (const f of spots) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const s = new THREE.Mesh(stone, STONE);
        s.position.set(f.x + Math.cos(a) * 0.9, f.y + 0.15, f.z + Math.sin(a) * 0.9);
        this.group.add(s);
      }
      const flame = new THREE.Group();
      const outer = new THREE.Mesh(cone, FLAME);
      outer.position.y = 0.65;
      const inner = new THREE.Mesh(core, EMBER);
      inner.position.y = 0.45;
      flame.add(outer, inner);
      flame.position.set(f.x, f.y, f.z);
      flame.visible = false;
      this.group.add(flame);
      this.flames.push(flame);
    }
  }

  sync(lit: readonly boolean[]): void {
    this.flames.forEach((f, i) => (f.visible = !!lit[i]));
  }

  animate(t: number): void {
    this.flames.forEach((f, i) => {
      f.rotation.y = t * 1.5 + i;
      f.scale.y = 1 + Math.sin(t * 7 + i * 2) * 0.12;
    });
  }
}
