import type * as THREE from 'three';

/** Instances further behind the camera than this (m) are dropped; closer ones stay (shadows, turning). */
export const BEHIND_KEEP = 20;
/** Rebuild after the camera moves this far (m) or turns this much (rad). */
export const REBUILD_MOVE = 6;
export const REBUILD_TURN = 0.3;

/**
 * V2-B perf: a set of instances spread over the whole map, drawn by one or more InstancedMesh that share
 * the list (tree = one mesh, bush = one mesh…). Every few metres the meshes are re-packed with only the
 * instances within `radius` of the camera and not far behind it: triangles follow the view, draw calls
 * stay the same. Pure CPU work over a few thousand matrices, only when the camera moved or turned.
 */
export class NearInstances {
  private readonly x: Float32Array;
  private readonly z: Float32Array;
  private readonly hidden: Uint8Array;
  private dirty = true;
  private cx = NaN;
  private cz = NaN;
  private yaw = NaN;
  private radius = NaN;

  constructor(
    private readonly meshes: THREE.InstancedMesh[],
    private readonly matrices: THREE.Matrix4[],
  ) {
    this.x = new Float32Array(matrices.length);
    this.z = new Float32Array(matrices.length);
    this.hidden = new Uint8Array(matrices.length);
    matrices.forEach((m, i) => {
      this.x[i] = m.elements[12]!;
      this.z[i] = m.elements[14]!;
    });
    for (const mesh of meshes) mesh.frustumCulled = false; // the packed list is already the view
  }

  setHidden(i: number, hidden: boolean): void {
    if (!!this.hidden[i] === hidden) return;
    this.hidden[i] = hidden ? 1 : 0;
    this.dirty = true;
  }

  /** `fwd` = camera forward on the ground (need not be unit), or null to keep every direction. Returns whether it re-packed. */
  update(cx: number, cz: number, radius: number, fwd: { x: number; z: number } | null): boolean {
    const yaw = fwd ? Math.atan2(fwd.x, fwd.z) : NaN;
    const turned = fwd ? Number.isNaN(this.yaw) || Math.abs(angleDiff(yaw, this.yaw)) > REBUILD_TURN : !Number.isNaN(this.yaw);
    const moved = !(Math.hypot(cx - this.cx, cz - this.cz) <= REBUILD_MOVE);
    if (!this.dirty && !moved && !turned && radius === this.radius) return false;
    this.dirty = false;
    this.cx = cx;
    this.cz = cz;
    this.yaw = yaw;
    this.radius = radius;
    const len = fwd ? Math.hypot(fwd.x, fwd.z) || 1 : 1;
    const fx = fwd ? fwd.x / len : 0;
    const fz = fwd ? fwd.z / len : 0;
    const r2 = radius * radius;
    let n = 0;
    for (let i = 0; i < this.matrices.length; i++) {
      if (this.hidden[i]) continue;
      const dx = this.x[i]! - cx;
      const dz = this.z[i]! - cz;
      if (dx * dx + dz * dz > r2) continue;
      if (fwd && dx * fx + dz * fz < -BEHIND_KEEP) continue;
      for (const mesh of this.meshes) mesh.setMatrixAt(n, this.matrices[i]!);
      n++;
    }
    for (const mesh of this.meshes) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    return true;
  }
}

function angleDiff(a: number, b: number): number {
  const d = (a - b) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}
