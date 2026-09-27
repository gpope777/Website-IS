import * as THREE from 'three';
import { WATER_LEVEL } from '../../shared/terrain';

const SKIN = new THREE.MeshLambertMaterial({ color: 0x5f8f3a, flatShading: true });
const DARK = new THREE.MeshLambertMaterial({ color: 0x2f4a22, flatShading: true });
const EYE = new THREE.MeshLambertMaterial({ color: 0xf2e6a0, flatShading: true });
// Lights ignore the swamp fog: the throat and the halo are the frog's lure (spec S3 §3.3).
const THROAT = new THREE.MeshBasicMaterial({ color: 0xf5c46a, fog: false });
const HALO = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
const PAD_NEXT = new THREE.MeshBasicMaterial({ color: 0xb8f070, fog: false });
const PAD_LATER = new THREE.MeshLambertMaterial({ color: 0x3f7a35 });

export interface FrogPose {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** The untamed one: golden halo, and it croaks (the throat pulses). */
  wild: boolean;
  /** Being calmed: it bucks. */
  bucking: boolean;
}

interface Frog {
  root: THREE.Group;
  body: THREE.Group;
  throat: THREE.Object3D;
}

/** La Rana: a boxy frog (a drawing can replace it later). One per pose key. */
export class FrogMeshes {
  readonly group = new THREE.Group();
  private readonly byKey = new Map<string, Frog>();

  constructor(private readonly shadows: boolean) {}

  sync(poses: readonly FrogPose[], now: number): void {
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
      f.body.rotation.z = p.bucking ? Math.sin(now * 11) * 0.45 : 0;
      f.throat.scale.setScalar(p.wild ? 1 + Math.max(0, Math.sin(now * 3)) * 0.6 : 1);
    }
    for (const [k, f] of this.byKey) {
      if (seen.has(k)) continue;
      f.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Frog {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const box = (w: number, h: number, l: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      m.castShadow = this.shadows;
      body.add(m);
      return m;
    };
    box(1.6, 0.7, 1.8, SKIN, 0, 0.45, 0);
    box(1.3, 0.5, 0.8, SKIN, 0, 0.65, 1.0); // head
    for (const s of [-1, 1]) {
      box(0.3, 0.3, 0.3, EYE, s * 0.45, 1.0, 1.1);
      box(0.4, 0.5, 1.2, DARK, s * 0.95, 0.3, -0.5); // back legs
      box(0.25, 0.4, 0.3, DARK, s * 0.6, 0.2, 0.8); // front legs
    }
    const throat = box(0.8, 0.3, 0.4, THROAT, 0, 0.3, 1.25);
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.05, 24), HALO);
      halo.position.y = 0.05;
      root.add(halo);
    }
    return { root, body, throat };
  }
}

/** The chase's lily pads: the next one glows through the fog, the later ones plain, the passed ones gone. */
export class LilyPads {
  readonly group = new THREE.Group();
  private readonly pads: THREE.Mesh[];

  constructor(points: readonly { x: number; z: number }[]) {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 0.08, 16);
    this.pads = points.map((p) => {
      const m = new THREE.Mesh(geo, PAD_LATER);
      m.position.set(p.x, WATER_LEVEL + 0.05, p.z);
      m.visible = false;
      this.group.add(m);
      return m;
    });
  }

  /** `next` = index of the pad to reach, or null when no chase. */
  sync(next: number | null): void {
    this.pads.forEach((m, i) => {
      m.visible = next !== null && i >= next;
      m.material = i === next ? PAD_NEXT : PAD_LATER;
    });
  }
}
