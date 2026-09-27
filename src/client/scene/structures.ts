import * as THREE from 'three';
import type { Structure } from '../../shared/protocol';
import type { Circle } from '../movement';

const WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
const STONE = new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true });
const HEART_LEAF = new THREE.MeshLambertMaterial({ color: 0x3fbf6a, emissive: 0x1f7a3a, emissiveIntensity: 0.6 });
const WITHERED = new THREE.MeshLambertMaterial({ color: 0x5a5048 });
const SPIKE = new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true });
const NET = new THREE.MeshLambertMaterial({ color: 0x5a3f22, flatShading: true });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const PILLAR = new THREE.MeshLambertMaterial({ color: 0x9a9c98, flatShading: true });
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
    const obj = s.kind === 'campfire' ? this.campfire(s) : s.kind === 'heart' ? this.heart() : s.kind === 'spikes' ? this.spikes() : s.kind === 'roots' ? this.net() : s.kind === 'fire' ? this.hoguera(s) : s.kind === 'pillar' ? this.pillar() : s.kind === 'tower' ? this.tower() : this.wall();
    obj.position.set(s.x, s.y, s.z);
    obj.rotation.y = s.rot;
    this.group.add(obj);
    this.byId.set(s.id, obj);
    if (s.kind === 'heart') this.setHp(s.id, s.hp);
    if (s.kind === 'campfire') return [{ x: s.x, z: s.z, r: 0.6 }];
    if (s.kind === 'heart') return [{ x: s.x, z: s.z, r: 1.2 }];
    if (s.kind === 'spikes' || s.kind === 'roots' || s.kind === 'fire') return []; // players walk over them
    if (s.kind === 'pillar' || s.kind === 'tower') return []; // climbable crags (structureCrags), not walls
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

  /** Piedra's pillar: a 2 × 3 × 2 m block of grey stone. */
  private pillar(): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), PILLAR);
    m.geometry.translate(0, 1.5, 0);
    return m;
  }

  /** La torre: a 4 m stone drum with a rim on top to stand on. */
  private tower(): THREE.Group {
    const g = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 4, 8), STONE);
    drum.position.y = 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.15, 5, 8), PILLAR);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 4;
    g.add(drum, rim);
    return g;
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

  /** Red de raíces: a flat mat of crossed roots. */
  /** Hoguera: a wide ring of stones around a low flame (no light of its own: it is a trap, not a fire to warm by). */
  private hoguera(s: Structure): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), STONE);
      stone.position.set(Math.cos(a) * 1.2, 0.12, Math.sin(a) * 1.2);
      g.add(stone);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8), FLAME);
    flame.position.y = 0.3;
    g.add(flame);
    this.fires.push({ flame, light: null, seed: s.x });
    return g;
  }

  private net(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 0.7;
      const alongZ = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 5), NET);
      alongZ.rotation.x = Math.PI / 2;
      alongZ.position.set(o, 0.08, 0);
      const alongX = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 5), NET);
      alongX.rotation.z = Math.PI / 2;
      alongX.position.set(0, 0.12, o);
      g.add(alongZ, alongX);
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
