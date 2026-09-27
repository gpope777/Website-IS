import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Stall } from '../../shared/shop';
import type { Circle } from '../movement';

/** T6-A: a Puesto = counter + 2 posts + awning, one merged geometry, one material (1 draw call). Shared, never disposed. */
let GEO: THREE.BufferGeometry | null = null;
const MAT = new THREE.MeshLambertMaterial({ color: 0xb07a48, flatShading: true });
function geo(): THREE.BufferGeometry {
  if (GEO) return GEO;
  const parts = [
    new THREE.BoxGeometry(2.2, 0.9, 0.8).translate(0, 0.45, 0),
    new THREE.BoxGeometry(0.12, 2.2, 0.12).translate(-1.0, 1.1, -0.35),
    new THREE.BoxGeometry(0.12, 2.2, 0.12).translate(1.0, 1.1, -0.35),
    new THREE.BoxGeometry(2.5, 0.08, 1.3).rotateX(0.25).translate(0, 2.2, 0),
  ];
  GEO = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  return GEO;
}

export class StallMeshes {
  readonly group = new THREE.Group();
  private readonly byId = new Map<number, THREE.Mesh>();

  /** Adds (or moves) the Puesto's mesh; returns its collider. */
  set(s: Stall): Circle {
    let m = this.byId.get(s.id);
    if (!m) {
      m = new THREE.Mesh(geo(), MAT);
      m.castShadow = true;
      this.group.add(m);
      this.byId.set(s.id, m);
    }
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.rot;
    return { x: s.x, z: s.z, r: 1.1 };
  }

  remove(id: number): void {
    this.byId.get(id)?.removeFromParent();
    this.byId.delete(id);
  }
}
