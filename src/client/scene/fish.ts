import * as THREE from 'three';
import { creatureMesh, setRig } from './creature-mesh';
import { fishPose } from './creature-rig';
import type { RigUniforms } from './patches';
import { DropInPuppet } from '../actors/drop-in-puppet';
import type { ModelKit } from '../actors/models';
import { WATER_LEVEL } from '../../shared/terrain';

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
  rig: RigUniforms;
  puppet: DropInPuppet | null;
  phase: number;
}

/** El Pez Grande: a low-poly fish, one mesh, an S-wave down the body in the vertex shader (V2-E). One per pose key. */
export class FishMeshes {
  readonly group = new THREE.Group();
  private readonly byKey = new Map<string, Fish>();

  /** V2-E: `kit` = a dropped-in `fish.glb` (spec §9); null → the procedural one. */
  constructor(
    private readonly shadows: boolean,
    private kit: ModelKit | null = null,
  ) {}

  /** A drop-in model arrived after the world was built: redraw every one with it. */
  setKit(kit: ModelKit | null): void {
    this.kit = kit;
    for (const v of this.byKey.values()) v.root.removeFromParent();
    this.byKey.clear();
  }

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
      if (f.puppet) f.puppet.update(dt, p.speed);
      else setRig(f.rig, fishPose(f.phase, p.speed, p.bucking, now));
    }
    for (const [k, f] of this.byKey) {
      if (seen.has(k)) continue;
      f.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Fish {
    const root = new THREE.Group();
    const c = creatureMesh('fish', this.shadows);
    const puppet = this.kit ? new DropInPuppet(this.kit, 'fish', this.shadows) : null;
    root.add(puppet ? puppet.root : c.mesh);
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.05, 24), HALO);
      halo.position.y = 0.45;
      root.add(halo);
    }
    return { root, rig: c.rig, puppet, phase: Math.random() * 6 };
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
