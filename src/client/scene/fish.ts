import * as THREE from 'three';
import { WATER_LEVEL } from '../../shared/terrain';

const SCALES = new THREE.MeshLambertMaterial({ color: 0x3f7fa6, flatShading: true });
const BELLY = new THREE.MeshLambertMaterial({ color: 0xcfe3e8, flatShading: true });
const FIN = new THREE.MeshLambertMaterial({ color: 0xe0a24a, flatShading: true });
const HALO = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.3, depthWrite: false });
const RING_NEXT = new THREE.MeshBasicMaterial({ color: 0xffe07a });
const RING_LATER = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });

export interface FishPose {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  /** The untamed one: golden halo on the water. */
  wild: boolean;
  /** Being calmed: it thrashes. */
  bucking: boolean;
}

interface Fish {
  root: THREE.Group;
  body: THREE.Group;
  tail: THREE.Object3D;
  phase: number;
}

/** El Pez Grande: a boxy fish (a drawing can replace it later). One per pose key. */
export class FishMeshes {
  readonly group = new THREE.Group();
  private readonly byKey = new Map<string, Fish>();

  constructor(private readonly shadows: boolean) {}

  sync(poses: readonly FishPose[], dt: number, now: number): void {
    const seen = new Set<string>();
    for (const p of poses) {
      seen.add(p.key);
      let f = this.byKey.get(p.key);
      if (!f) {
        f = this.make(p.wild);
        this.group.add(f.root);
        this.byKey.set(p.key, f);
      }
      f.root.position.set(p.x, p.y, p.z);
      f.root.rotation.y = p.yaw;
      f.phase += dt * (2 + Math.min(p.speed, 14) * 0.8);
      f.tail.rotation.y = Math.sin(f.phase) * 0.5;
      f.body.rotation.z = p.bucking ? Math.sin(now * 10) * 0.5 : 0;
    }
    for (const [k, f] of this.byKey) {
      if (seen.has(k)) continue;
      f.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Fish {
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
    box(1.1, 0.9, 2.6, SCALES, 0, 0.1, 0);
    box(0.9, 0.3, 2.2, BELLY, 0, -0.35, 0);
    box(0.9, 0.7, 0.7, SCALES, 0, 0.1, 1.5); // head
    box(0.08, 0.6, 0.9, FIN, 0, 0.8, -0.2); // back fin
    for (const s of [-1, 1]) box(0.5, 0.06, 0.4, FIN, s * 0.75, -0.1, 0.6);
    const tail = new THREE.Group();
    tail.position.set(0, 0.1, -1.3);
    body.add(tail);
    box(0.08, 1.0, 0.8, FIN, 0, 0, -0.4, tail);
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.05, 24), HALO);
      halo.position.y = 0.45;
      root.add(halo);
    }
    return { root, body, tail, phase: Math.random() * 6 };
  }
}

/** The race's water rings: the next one bright, the later ones faint, the passed ones gone. */
export class RaceRings {
  readonly group = new THREE.Group();
  private readonly rings: THREE.Mesh[];

  constructor(points: readonly { x: number; z: number }[]) {
    const geo = new THREE.TorusGeometry(2.2, 0.18, 8, 28);
    this.rings = points.map((p) => {
      const m = new THREE.Mesh(geo, RING_LATER);
      m.position.set(p.x, WATER_LEVEL + 0.6, p.z);
      m.visible = false;
      this.group.add(m);
      return m;
    });
  }

  /** `next` = index of the ring to reach, or null when no race. */
  sync(next: number | null, now: number): void {
    this.rings.forEach((m, i) => {
      m.visible = next !== null && i >= next;
      m.material = i === next ? RING_NEXT : RING_LATER;
      m.rotation.y = now * 0.8 + i;
    });
  }
}
