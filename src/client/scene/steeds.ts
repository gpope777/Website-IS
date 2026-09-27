import * as THREE from 'three';
import { creatureMesh, setRig } from './creature-mesh';
import { deerPose } from './creature-rig';
import type { RigUniforms } from './patches';

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
  rig: RigUniforms;
  phase: number;
  seed: number;
}

/** El Ciervo: a low-poly deer, one mesh, legs/head/tail turned in the vertex shader (V2-E). One per pose key. */
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
      setRig(d.rig, deerPose(d.phase, p.speed, p.bucking, now, d.seed));
    }
    for (const [k, d] of this.byKey) {
      if (seen.has(k)) continue;
      d.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Deer {
    const root = new THREE.Group();
    const c = creatureMesh('deer', this.shadows);
    root.add(c.mesh);
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20), WILD_GLOW);
      halo.position.y = 0.05;
      root.add(halo);
    }
    return { root, rig: c.rig, phase: 0, seed: Math.random() * 6 };
  }
}
