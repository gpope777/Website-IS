import * as THREE from 'three';
import { creatureMesh, setRig } from './creature-mesh';
import { whalePose } from './creature-rig';
import type { RigUniforms } from './patches';
import { WATER_LEVEL } from '../../shared/terrain';

const SPOUT = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.55, depthWrite: false });

/** La Ballena: a big low-poly whale (one mesh, slow S-wave and fluke in the vertex shader, V2-E) with a spout. Only one per world. */
export class WhaleMesh {
  readonly group = new THREE.Group();
  private readonly rig: RigUniforms;
  private readonly spout: THREE.Mesh;

  constructor(shadows: boolean) {
    const c = creatureMesh('whale', shadows);
    this.rig = c.rig;
    this.group.add(c.mesh);
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
    setRig(this.rig, whalePose(now));
    const puff = (Math.sin(now * (wild ? 1.2 : 0.6)) + 1) / 2;
    const h = diving ? 0 : wild ? 2 + puff * 6 : puff * 2;
    this.spout.visible = h > 0.1;
    this.spout.scale.set(1, h, 1);
    this.spout.position.y = 1.7 + h / 2;
  }
}
