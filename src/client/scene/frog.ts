import * as THREE from 'three';
import { creatureMesh, setRig } from './creature-mesh';
import { frogPose } from './creature-rig';
import type { RigUniforms } from './patches';
import { DropInPuppet } from '../actors/drop-in-puppet';
import type { ModelKit } from '../actors/models';
import { WATER_LEVEL } from '../../shared/terrain';

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
  rig: RigUniforms;
  puppet: DropInPuppet | null;
  t: number;
  throat: THREE.Object3D;
  last: { x: number; z: number };
  moving: number;
}

/** La Rana: a low-poly frog, one mesh (+ its glowing throat), legs kicked in the vertex shader (V2-E). One per pose key. */
export class FrogMeshes {
  readonly group = new THREE.Group();
  private readonly byKey = new Map<string, Frog>();

  /** V2-E: `kit` = a dropped-in `frog.glb` (spec §9); null → the procedural one. */
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

  sync(poses: readonly FrogPose[], now: number): void {
    const seen = new Set<string>();
    for (const p of poses) {
      seen.add(p.key);
      let f = this.byKey.get(p.key);
      if (!f) {
        f = this.make(p.wild);
        this.group.add(f.root);
        this.byKey.set(p.key, f);
        f.last = { x: p.x, z: p.z };
      }
      // No speed in the pose: it hops while its position changes (held 0.3 s so network steps don't flicker).
      if (Math.hypot(p.x - f.last.x, p.z - f.last.z) > 0.02) f.moving = now;
      f.last = { x: p.x, z: p.z };
      f.root.position.set(p.x, p.y, p.z);
      f.root.rotation.y = p.yaw;
      const pose = frogPose(now - f.moving < 0.3, p.wild, p.bucking, now);
      if (f.puppet) f.puppet.update(f.t ? Math.min(0.1, Math.max(0, now - f.t)) : 0, now - f.moving < 0.3 ? 3 : 0);
      else setRig(f.rig, pose);
      f.t = now;
      f.throat.scale.setScalar(pose.throat);
      f.throat.position.y = 0.3 + pose.lift;
    }
    for (const [k, f] of this.byKey) {
      if (seen.has(k)) continue;
      f.root.removeFromParent();
      this.byKey.delete(k);
    }
  }

  private make(wild: boolean): Frog {
    const root = new THREE.Group();
    const c = creatureMesh('frog', this.shadows);
    const puppet = this.kit ? new DropInPuppet(this.kit, 'frog', this.shadows) : null;
    root.add(puppet ? puppet.root : c.mesh);
    // The throat stays its own unlit mesh: the frog's lure glows through the swamp fog.
    const throat = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5).scale(0.38, 0.16, 0.24), THROAT);
    throat.position.set(0, 0.3, 1.15);
    root.add(throat);
    if (wild) {
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.05, 24), HALO);
      halo.position.y = 0.05;
      root.add(halo);
    }
    return { root, rig: c.rig, puppet, t: 0, throat, last: { x: 0, z: 0 }, moving: -1 };
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
