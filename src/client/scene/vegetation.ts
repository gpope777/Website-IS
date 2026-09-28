import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ResourceSpawn } from '../../shared/resources';
import { NearInstances } from './near-instances';
import { patchSway } from './patches';

/** Paints a whole geometry one colour (vertex colours, linear), so parts of one plant merge into one draw call. */
function painted(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position!.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Instanced trees, rocks and berry bushes; a depleted resource is hidden. V2-B: each kind is one merged
 * geometry (trunk + crowns, bush + berries) and only the instances near the camera are packed into the
 * mesh (`NearInstances`): before, all ~5 000 trees were drawn wherever you stood.
 */
export class ResourceMeshes {
  readonly group = new THREE.Group();
  private readonly slots: { near: NearInstances; index: number }[] = [];
  private readonly kinds: NearInstances[] = [];

  constructor(spawns: ResourceSpawn[], shadows: boolean, waves = 1) {
    const treeGeo = mergeGeometries([
      painted(new THREE.CylinderGeometry(0.22, 0.38, 4.5, 7).translate(0, 2.25, 0), 0x5b3f26),
      painted(new THREE.ConeGeometry(2.1, 6.5, 8).translate(0, 7, 0), 0x2e6b33),
      painted(new THREE.ConeGeometry(1.5, 4.5, 8).translate(0, 10.2, 0), 0x3a7d3d),
    ])!;
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const berryGeo = mergeGeometries(
      [[0.7, 0.3, 0.2], [-0.5, 0.5, 0.4], [0.1, 0.2, -0.75], [-0.3, -0.1, -0.6]].map(([x, y, z]) =>
        new THREE.SphereGeometry(0.12, 5, 5).translate(x!, y!, z!),
      ),
    )!;
    const bushGeo = mergeGeometries([painted(new THREE.IcosahedronGeometry(0.9, 1), 0x3f8a3a), painted(berryGeo, 0xd2342b)])!;

    const count = (k: ResourceSpawn['kind']) => spawns.filter((s) => s.kind === k).length;
    const make = (geo: THREE.BufferGeometry, n: number, mat: THREE.MeshLambertMaterial) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
      m.name = 'resources';
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      this.group.add(m);
      return m;
    };
    const tree = make(treeGeo, count('tree'), new THREE.MeshLambertMaterial({ vertexColors: true }));
    const rock = make(rockGeo, count('rock'), new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true }));
    const bush = make(bushGeo, count('bush'), new THREE.MeshLambertMaterial({ vertexColors: true }));
    // V2-C: crowns (above the trunk) and bushes sway; crowns go ash-violet inside corrupt zones.
    patchSway(tree.material as THREE.Material, { base: 4.5, span: 8, amp: 0.35, taint: true, waves });
    patchSway(bush.material as THREE.Material, { base: -0.3, span: 1.2, amp: 0.06, waves });

    const lists = { tree: [] as THREE.Matrix4[], rock: [] as THREE.Matrix4[], bush: [] as THREE.Matrix4[] };
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const at: { kind: ResourceSpawn['kind']; index: number }[] = [];
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
      at[s.id] = { kind: s.kind, index: lists[s.kind].push(m) - 1 };
    }
    const near = { tree: new NearInstances([tree], lists.tree), rock: new NearInstances([rock], lists.rock), bush: new NearInstances([bush], lists.bush) };
    this.kinds.push(near.tree, near.rock, near.bush);
    at.forEach((a, id) => {
      if (a) this.slots[id] = { near: near[a.kind], index: a.index };
    });
    this.update(0, 0, Infinity, null);
  }

  setGone(id: number, gone: boolean): void {
    const slot = this.slots[id];
    slot?.near.setHidden(slot.index, gone);
  }

  /** Every frame: re-packs (cheaply, only after a move or turn) what is within `radius` of the camera. */
  update(cx: number, cz: number, radius: number, fwd: { x: number; z: number } | null): void {
    for (const k of this.kinds) k.update(cx, cz, radius, fwd);
  }
}
