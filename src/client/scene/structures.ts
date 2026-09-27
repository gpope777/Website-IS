import * as THREE from 'three';
import type { Structure } from '../../shared/protocol';
import type { Circle } from '../movement';

const WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
const STONE = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });
const HEART_LEAF = new THREE.MeshLambertMaterial({ color: 0x3fbf6a, emissive: 0x1f7a3a, emissiveIntensity: 0.6 });
const WITHERED = new THREE.MeshLambertMaterial({ color: 0x5a5048 });
const SPIKE = new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040 });
// ponytail: one point light per fire, capped. Past the cap fires glow without lighting; a light pool comes with #2's night work.
const MAX_FIRE_LIGHTS = 8;

export class StructureMeshes {
  readonly group = new THREE.Group();
  private readonly byId = new Map<number, THREE.Object3D>();
  private readonly fires: { flame: THREE.Mesh; light: THREE.PointLight | null; seed: number }[] = [];

  has(id: number): boolean {
    return this.byId.has(id);
  }

  /** Adds the mesh and returns collision circles for it. */
  add(s: Structure): Circle[] {
    const obj = s.kind === 'campfire' ? this.campfire(s) : s.kind === 'heart' ? this.heart() : s.kind === 'spikes' ? this.spikes() : this.wall();
    obj.position.set(s.x, s.y, s.z);
    obj.rotation.y = s.rot;
    this.group.add(obj);
    this.byId.set(s.id, obj);
    if (s.kind === 'heart') this.setHp(s.id, s.hp);
    if (s.kind === 'campfire') return [{ x: s.x, z: s.z, r: 0.6 }];
    if (s.kind === 'heart') return [{ x: s.x, z: s.z, r: 1.2 }];
    if (s.kind === 'spikes') return []; // players walk over them
    // A 3 m wall along its local X axis, approximated by three circles.
    return [-1, 0, 1].map((o) => ({ x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o, r: 0.55 }));
  }

  remove(id: number): void {
    this.byId.get(id)?.removeFromParent();
    this.byId.delete(id);
  }

  /** Heart only: the crown turns grey when withered. */
  setHp(id: number, hp: number): void {
    const crown = this.byId.get(id)?.getObjectByName('crown') as THREE.Mesh | undefined;
    if (crown) crown.material = hp > 0 ? HEART_LEAF : WITHERED;
  }

  position(id: number): THREE.Vector3 | null {
    return this.byId.get(id)?.position ?? null;
  }

  animate(t: number): void {
    for (const f of this.fires) {
      const k = 0.9 + Math.sin(t * 13 + f.seed) * 0.12 + Math.sin(t * 7.3) * 0.08;
      f.flame.scale.set(k, 0.8 + Math.sin(t * 9.1 + f.seed) * 0.2, k);
      if (f.light) f.light.intensity = 28 + Math.sin(t * 17 + f.seed) * 3;
    }
  }

  private campfire(s: Structure): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), STONE);
      stone.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      g.add(stone);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), WOOD);
      log.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI * 2, 0);
      log.position.y = 0.2;
      g.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 7), FLAME);
    flame.position.y = 0.45;
    g.add(flame);
    let light: THREE.PointLight | null = null;
    if (this.fires.filter((f) => f.light).length < MAX_FIRE_LIGHTS) {
      light = new THREE.PointLight(0xff8a3c, 28, 14, 1.6);
      light.position.y = 1;
      g.add(light);
    }
    this.fires.push({ flame, light, seed: s.x });
    return g;
  }

  private heart(): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 8), WOOD);
    trunk.position.y = 1.2;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), HEART_LEAF);
    crown.name = 'crown';
    crown.position.y = 3;
    trunk.castShadow = crown.castShadow = true;
    const glow = new THREE.PointLight(0x7dffb0, 12, 12, 1.6);
    glow.position.y = 2.5;
    g.add(trunk, crown, glow);
    return g;
  }

  private spikes(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 5), SPIKE);
      c.position.set((i - 2) * 0.3, 0.3, (i % 2) * 0.25 - 0.12);
      c.rotation.x = -0.35;
      g.add(c);
    }
    return g;
  }

  private wall(): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.3), WOOD);
    m.geometry.translate(0, 1, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}
