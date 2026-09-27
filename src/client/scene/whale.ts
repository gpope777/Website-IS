import * as THREE from 'three';
import { WATER_LEVEL } from '../../shared/terrain';

const SKIN = new THREE.MeshLambertMaterial({ color: 0x3a4f6b, flatShading: true });
const BELLY = new THREE.MeshLambertMaterial({ color: 0xd9dfe6, flatShading: true });
const SPOUT = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.55, depthWrite: false });

/** La Ballena: a big boxy whale with a spout (a drawing can replace it later). Only one per world. */
export class WhaleMesh {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly spout: THREE.Mesh;

  constructor(shadows: boolean) {
    this.group.add(this.body);
    const box = (w: number, h: number, l: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.body) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      m.castShadow = shadows;
      parent.add(m);
      return m;
    };
    box(3.4, 2.2, 7, SKIN, 0, 0.6, 0);
    box(3, 0.8, 6.2, BELLY, 0, -0.7, 0.2);
    box(3, 1.8, 2, SKIN, 0, 0.5, 4.2); // head
    for (const s of [-1, 1]) box(1.6, 0.2, 1, SKIN, s * 2.3, -0.2, 1.8); // flippers
    this.tail.position.set(0, 0.6, -3.6);
    this.body.add(this.tail);
    box(1.2, 0.8, 2.2, SKIN, 0, 0, -1, this.tail);
    box(3.6, 0.2, 1, SKIN, 0, 0, -2.4, this.tail);
    this.spout = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 1, 8, 1, true), SPOUT);
    this.spout.position.set(0, 1.7, 3.4);
    this.group.add(this.spout);
    this.group.visible = false;
  }

  /** `wild` spouts high (a lure seen from the beach); `diving` sinks it. */
  sync(pose: { x: number; z: number; yaw: number } | null, wild: boolean, diving: boolean, now: number): void {
    this.group.visible = !!pose;
    if (!pose) return;
    const sink = diving ? -3 : 0;
    this.group.position.set(pose.x, WATER_LEVEL - 0.6 + sink + Math.sin(now * 0.8) * 0.15, pose.z);
    this.group.rotation.y = pose.yaw;
    this.tail.rotation.x = Math.sin(now * 1.3) * 0.15;
    const puff = (Math.sin(now * (wild ? 1.2 : 0.6)) + 1) / 2;
    const h = diving ? 0 : wild ? 2 + puff * 6 : puff * 2;
    this.spout.visible = h > 0.1;
    this.spout.scale.set(1, h, 1);
    this.spout.position.y = 1.7 + h / 2;
  }
}
