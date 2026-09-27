import * as THREE from 'three';

const HIDE = new THREE.MeshLambertMaterial({ color: 0x8a5a33, flatShading: true });
const BELLY = new THREE.MeshLambertMaterial({ color: 0xd9c3a0, flatShading: true });
const HORN = new THREE.MeshLambertMaterial({ color: 0xefe6d2, flatShading: true });
const WILD_GLOW = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.25, depthWrite: false });

export interface SteedPose {
  key: string;
  x: number;
  y: number;
  z: number;
  /** Protocol yaw: atan2(dirX, dirZ). */
  yaw: number;
  /** Metres per second, for the leg swing. */
  speed: number;
  /** The untamed deer gets a faint halo so it reads as "something to do". */
  wild: boolean;
  /** Being tamed: it bucks. */
  bucking: boolean;
}

interface Deer {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Group;
  phase: number;
}

/** El Ciervo: a giant deer made of boxes (a drawing can replace it later). One per pose key. */
export class SteedMeshes {
  readonly group = new THREE.Group();
  private readonly byKey = new Map<string, Deer>();

  constructor(private readonly shadows: boolean) {}

  sync(poses: readonly SteedPose[], dt: number, now: number): void {
    const seen = new Set<string>();
    for (const p of poses) {
      seen.add(p.key);
      let d = this.byKey.get(p.key);
      if (!d) {
        d = this.make(p.wild);
        this.group.add(d.root);
        this.byKey.set(p.key, d);
      }
      d.root.position.set(p.x, p.y, p.z);
      d.root.rotation.y = p.yaw;
      d.phase += dt * Math.min(p.speed, 14) * 1.6;
      const swing = p.speed > 0.3 ? Math.sin(d.phase) * 0.6 : 0;
      d.legs.forEach((l, i) => (l.rotation.x = i % 3 === 0 ? swing : -swing));
      d.head.rotation.x = p.speed > 0.3 ? 0 : 0.35 + Math.sin(now * 0.8 + p.x) * 0.25; // grazing when still
      d.body.rotation.x = p.bucking ? Math.sin(now * 9) * 0.35 : 0;
      d.body.position.y = p.bucking ? Math.abs(Math.sin(now * 9)) * 0.3 : 0;
    }
    for (const [k, d] of this.byKey) {
      if (seen.has(k)) continue;
      d.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Deer {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const box = (w: number, h: number, l: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      m.castShadow = this.shadows;
      parent.add(m);
      return m;
    };
    box(0.8, 0.7, 1.8, HIDE, 0, 1.25, 0);
    box(0.7, 0.2, 1.5, BELLY, 0, 0.92, 0);
    const legs: THREE.Object3D[] = [];
    for (const [x, z] of [[-0.28, 0.65], [0.28, 0.65], [-0.28, -0.65], [0.28, -0.65]] as const) {
      const hip = new THREE.Group();
      hip.position.set(x, 1.0, z);
      body.add(hip);
      box(0.16, 1.0, 0.16, HIDE, 0, -0.5, 0, hip);
      legs.push(hip);
    }
    const head = new THREE.Group();
    head.position.set(0, 1.5, 0.85);
    body.add(head);
    box(0.3, 0.8, 0.3, HIDE, 0, 0.35, 0.1, head).rotation.x = -0.4;
    box(0.36, 0.34, 0.6, HIDE, 0, 0.75, 0.35, head);
    for (const s of [-1, 1]) {
      box(0.06, 0.6, 0.06, HORN, s * 0.14, 1.15, 0.25, head).rotation.z = s * -0.4;
      box(0.06, 0.06, 0.4, HORN, s * 0.26, 1.3, 0.3, head);
      box(0.06, 0.35, 0.06, HORN, s * 0.35, 1.45, 0.15, head).rotation.z = s * -0.5;
    }
    box(0.2, 0.2, 0.2, BELLY, 0, 1.45, -0.95); // tail
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20), WILD_GLOW);
      halo.position.y = 0.05;
      root.add(halo);
    }
    return { root, body, legs, head, phase: 0 };
  }
}
