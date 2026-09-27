import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '../../shared/rng';
import { COAST_Z0, HALF, WATER_LEVEL, type Terrain } from '../../shared/terrain';
import type { ResourceSpawn } from '../../shared/resources';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

interface Slot {
  meshes: THREE.InstancedMesh[];
  index: number;
  matrix: THREE.Matrix4;
}

/** Instanced trees, rocks and berry bushes; a depleted resource is hidden by zero-scaling its instance. */
export class ResourceMeshes {
  readonly group = new THREE.Group();
  private readonly slots: Slot[] = [];

  constructor(spawns: ResourceSpawn[], shadows: boolean) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.5, 7).translate(0, 2.25, 0);
    const crownGeo = new THREE.ConeGeometry(2.1, 6.5, 8).translate(0, 7, 0);
    const crown2Geo = new THREE.ConeGeometry(1.5, 4.5, 8).translate(0, 10.2, 0);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const bushGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const berryGeo = mergeGeometries(
      [[0.7, 0.3, 0.2], [-0.5, 0.5, 0.4], [0.1, 0.2, -0.75], [-0.3, -0.1, -0.6]].map(([x, y, z]) =>
        new THREE.SphereGeometry(0.12, 5, 5).translate(x!, y!, z!),
      ),
    )!;

    const count = (k: ResourceSpawn['kind']) => spawns.filter((s) => s.kind === k).length;
    const make = (geo: THREE.BufferGeometry, color: number, n: number, flat = false) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: flat }), n);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.frustumCulled = false; // ponytail: instances span the whole map; chunk per region if GPU-bound on phones
      this.group.add(m);
      return m;
    };
    const tree = [make(trunkGeo, 0x5b3f26, count('tree')), make(crownGeo, 0x2e6b33, count('tree')), make(crown2Geo, 0x3a7d3d, count('tree'))];
    const rock = [make(rockGeo, 0x8a8c86, count('rock'), true)];
    const bush = [make(bushGeo, 0x3f8a3a, count('bush')), make(berryGeo, 0xd2342b, count('bush'))];

    const next = { tree: 0, rock: 0, bush: 0 };
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of spawns) {
      const m = new THREE.Matrix4();
      const scale = new THREE.Vector3(s.scale, s.scale, s.scale);
      const p = new THREE.Vector3(s.x, s.y, s.z);
      q.setFromAxisAngle(up, s.rot);
      if (s.kind === 'tree') p.y -= 0.2;
      if (s.kind === 'rock') {
        p.y += 0.15 * s.scale;
        scale.set(s.scale * 1.2, s.scale * 0.8, s.scale);
      }
      if (s.kind === 'bush') {
        p.y += 0.5 * s.scale;
        scale.set(s.scale, s.scale * 0.85, s.scale);
      }
      m.compose(p, q, scale);
      const meshes = s.kind === 'tree' ? tree : s.kind === 'rock' ? rock : bush;
      const index = next[s.kind]++;
      for (const mesh of meshes) mesh.setMatrixAt(index, m);
      this.slots[s.id] = { meshes, index, matrix: m };
    }
    for (const mesh of this.group.children as THREE.InstancedMesh[]) mesh.instanceMatrix.needsUpdate = true;
  }

  setGone(id: number, gone: boolean): void {
    const slot = this.slots[id];
    if (!slot) return;
    for (const mesh of slot.meshes) {
      mesh.setMatrixAt(slot.index, gone ? ZERO : slot.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/** Decorative grass tufts (not harvestable). Wind sway and density shaders come in sub-project #2. */
export function buildGrass(terrain: Terrain, count: number, seed: number): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.25, 0.9, 3).translate(0, 0.45, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x7fae4a, side: THREE.DoubleSide }), count);
  const rng = createRng(seed ^ 0x6a55);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; tries < count * 4 && n < count; tries++) {
    const x = (rng() * 2 - 1) * (HALF - 6);
    const z = (rng() * 2 - 1) * (HALF - 6);
    const h = terrain.heightAt(x, z);
    if (z >= COAST_Z0 || h < WATER_LEVEL + 0.2 || terrain.density(x, z) > 0.55) continue; // grass is the forest's
    const s = 0.7 + rng() * 0.8;
    q.setFromAxisAngle(up, rng() * Math.PI);
    m.compose(new THREE.Vector3(x, h - 0.05, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.frustumCulled = false;
  return mesh;
}
