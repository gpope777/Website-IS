import * as THREE from 'three';
import { buildCreature, type CreatureKind, type RigPose } from './creature-rig';
import { patchRig, patchRim, rigUniforms, type RigUniforms } from './patches';

const geos = new Map<CreatureKind, THREE.BufferGeometry>();
function geometry(kind: CreatureKind): THREE.BufferGeometry {
  let g = geos.get(kind);
  if (!g) {
    const r = buildCreature(kind);
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.position, 3));
    g.setAttribute('color', new THREE.BufferAttribute(r.color, 3));
    g.setAttribute('part', new THREE.BufferAttribute(r.part, 1));
    g.computeVertexNormals(); // for the shadow pass; the lit pass is flat-shaded
    // The rig moves vertices a little past the rest pose: a generous box keeps it from being culled early.
    g.computeBoundingSphere();
    g.boundingSphere!.radius *= 1.4;
    geos.set(kind, g);
  }
  return g;
}

export interface CreatureMesh {
  mesh: THREE.Mesh;
  rig: RigUniforms;
}

/** V2-E: one mesh / one draw call per creature; its own material (same program) so each has its own pose. */
export function creatureMesh(kind: CreatureKind, shadows: boolean): CreatureMesh {
  const r = buildCreature(kind);
  const rig = rigUniforms();
  r.pivots.forEach((p, i) => rig.rigPivot.value[i]!.set(...p));
  rig.rigWaveZ.value.set(...r.waveZ);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  patchRig(mat, rig);
  patchRim(mat);
  const mesh = new THREE.Mesh(geometry(kind), mat);
  mesh.name = `creature:${kind}`;
  mesh.castShadow = shadows;
  return { mesh, rig };
}

export function setRig(rig: RigUniforms, pose: RigPose): void {
  pose.rot.forEach((r, i) => rig.rigRot.value[i]!.set(...r));
  rig.rigWave.value.set(...pose.wave);
  rig.rigLift.value = pose.lift;
}
