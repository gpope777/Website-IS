import * as THREE from 'three';
import { ASH_RUN, pillarSites, THICKET, type PillarSites } from '../../shared/pillars';
import { corruptFeatures, waterLevel, type Terrain } from '../../shared/terrain';
import type { PillarView } from '../../shared/protocol';

const SPIKE = new THREE.MeshLambertMaterial({ color: 0x1a0f22, flatShading: true });
const CORE = new THREE.MeshBasicMaterial({ color: 0xb070ff });
const THORN = new THREE.MeshLambertMaterial({ color: 0x2a1a2e, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x5a3a2a, flatShading: true });
const BRIDGE = new THREE.MeshLambertMaterial({ color: 0x6a8a3a, flatShading: true });
const STONE = new THREE.MeshLambertMaterial({ color: 0x6c6670, flatShading: true });
const CHAIN = new THREE.MeshLambertMaterial({ color: 0x3a3040 });
const LAKE = new THREE.MeshLambertMaterial({ color: 0x1c1428, transparent: true, opacity: 0.88 });
const MIASMA = new THREE.MeshBasicMaterial({ color: 0x7a4a8a, transparent: true, opacity: 0.45, depthWrite: false });
const COCOON = new THREE.MeshLambertMaterial({ color: 0x3a2030, flatShading: true });
const ASH = new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.18, depthWrite: false });
const THORNS_N = 40;

/**
 * Los 4 Pilares-raíz (S5-C) and what surrounds them: the spikes and glowing cores, the thicket with its roots
 * and bridges, el Lago Negro's water, its anchor and chain, the miasma, the cocoon, the ash ring, the lid and
 * its plate. Lives inside the Tierras group (hidden from the south).
 */
export class PillarMeshes {
  readonly group = new THREE.Group();
  private readonly s: PillarSites;
  private readonly spikes: THREE.Mesh[] = [];
  private readonly cores: THREE.Mesh[] = [];
  private readonly thorns: THREE.InstancedMesh;
  private readonly thornAt: { x: number; z: number; y: number }[] = [];
  private readonly roots: THREE.Mesh[] = [];
  private readonly bridges: THREE.Mesh[] = [];
  private readonly chain: THREE.Mesh;
  private readonly anchor: THREE.Mesh;
  private readonly miasma: THREE.Mesh;
  private readonly cocoon: THREE.Mesh;
  private readonly ash: THREE.Mesh;
  private readonly lid: THREE.Mesh;
  private readonly lidY: number;
  private readonly bed: THREE.Vector3;
  private readonly shore: THREE.Vector3;
  private key = '';

  constructor(private readonly terrain: Terrain, seed: number) {
    const s = (this.s = pillarSites(seed));
    const y = (x: number, z: number) => terrain.heightAt(x, z);
    const lake = corruptFeatures(seed).lake;
    const surface = waterLevel(terrain, lake.x, lake.z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(lake.r, 40), LAKE);
    water.rotation.x = -Math.PI / 2;
    water.position.set(lake.x, surface, lake.z);
    this.group.add(water);
    this.bed = new THREE.Vector3(s.anchor.x, y(s.anchor.x, s.anchor.z), s.anchor.z);
    this.shore = new THREE.Vector3(s.cores[1]!.x, y(s.cores[1]!.x, s.cores[1]!.z), s.cores[1]!.z);
    for (const c of s.cores) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 7), SPIKE);
      spike.geometry.translate(0, 6, 0);
      spike.position.set(c.x, y(c.x, c.z), c.z);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), CORE);
      core.position.set(c.x, y(c.x, c.z) + 1.6, c.z);
      this.spikes.push(spike);
      this.cores.push(core);
      this.group.add(spike, core);
    }
    // The thicket: black thorns in the ring (seeded by index, no rng needed).
    const c0 = s.cores[0]!;
    for (let i = 0; i < THORNS_N; i++) {
      const a = i * 2.39996; // golden angle
      const r = THICKET.clear + 1 + ((i * 7) % THORNS_N) / THORNS_N * (THICKET.r - THICKET.clear - 1);
      const x = c0.x + Math.sin(a) * r;
      const z = c0.z + Math.cos(a) * r;
      this.thornAt.push({ x, z, y: y(x, z) });
    }
    this.thorns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 2.4, 5).translate(0, 1.2, 0), THORN, THORNS_N);
    this.group.add(this.thorns);
    for (const r of s.roots) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.4, 5), ROOT);
      root.position.set(r.x, y(r.x, r.z) + 0.5, r.z);
      const len = Math.hypot(c0.x - r.x, c0.z - r.z);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, len), BRIDGE);
      const mx = (c0.x + r.x) / 2;
      const mz = (c0.z + r.z) / 2;
      bridge.position.set(mx, y(mx, mz) + 0.3, mz);
      bridge.rotation.y = Math.atan2(c0.x - r.x, c0.z - r.z);
      this.roots.push(root);
      this.bridges.push(bridge);
      this.group.add(root, bridge);
    }
    this.chain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, Math.max(1, surface - this.bed.y), 5), CHAIN);
    this.chain.position.set(this.bed.x, (surface + this.bed.y) / 2, this.bed.z);
    this.anchor = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), STONE);
    this.anchor.position.set(this.bed.x + 1.5, this.bed.y + 0.6, this.bed.z);
    this.miasma = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), MIASMA);
    this.miasma.position.set(this.shore.x, this.shore.y + 1.6, this.shore.z);
    const f = s.cores[2]!;
    this.cocoon = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), COCOON);
    this.cocoon.position.set(f.x, y(f.x, f.z) + 1.6, f.z);
    this.ash = new THREE.Mesh(new THREE.RingGeometry(ASH_RUN.r - 0.8, ASH_RUN.r, 48), ASH);
    this.ash.rotation.x = -Math.PI / 2;
    this.ash.position.set(f.x, y(f.x, f.z) + 3, f.z); // a ring of heat haze at chest height
    const st = s.cores[3]!;
    this.lidY = y(st.x, st.z) + 2.6;
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), STONE);
    this.lid.position.set(st.x, this.lidY, st.z);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 12), STONE);
    plate.position.set(s.plate.x, y(s.plate.x, s.plate.z) + 0.08, s.plate.z);
    this.group.add(this.chain, this.anchor, this.miasma, this.cocoon, this.ash, this.lid, plate);
    this.sync({ broken: [false, false, false, false], roots: [false, false, false], anchor: true, miasma: 0, burns: 0, lid: false });
  }

  sync(v: PillarView): void {
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    v.broken.forEach((b, i) => {
      this.spikes[i]!.scale.set(1, b ? 0.12 : 1, 1); // broken: a stump
      this.cores[i]!.visible = !b;
    });
    // The Viento core waits on the lake bed until its anchor breaks, then lies on the shore.
    const at = v.anchor ? this.bed : this.shore;
    this.spikes[1]!.position.copy(at);
    this.cores[1]!.position.set(at.x, at.y + 1.6, at.z);
    this.chain.visible = this.anchor.visible = v.anchor && !v.broken[1];
    this.miasma.visible = !v.anchor && !v.broken[1] && v.miasma < 3;
    this.miasma.scale.setScalar(Math.max(0.2, (3 - v.miasma) / 3));
    this.cocoon.visible = !v.broken[2] && v.burns < 3;
    this.cocoon.scale.setScalar(1 - v.burns * 0.15);
    this.ash.visible = !v.broken[2];
    this.lid.visible = !v.broken[3];
    this.lid.position.y = this.lidY + (v.lid ? 1.6 : 0);
    const c0 = this.s.cores[0]!;
    const m = new THREE.Matrix4();
    this.thornAt.forEach((t, i) => {
      const onBridge = this.s.roots.some((r, k) => v.roots[k] && segDist(t, r, c0) <= THICKET.bridge + 0.6);
      m.makeScale(...((v.broken[0] || onBridge ? [0, 0, 0] : [1, 1, 1]) as [number, number, number])).setPosition(t.x, t.y, t.z);
      this.thorns.setMatrixAt(i, m);
    });
    this.thorns.instanceMatrix.needsUpdate = true;
    v.roots.forEach((r, k) => {
      this.bridges[k]!.visible = r && !v.broken[0];
      this.roots[k]!.visible = !r;
    });
  }
}

function segDist(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}
