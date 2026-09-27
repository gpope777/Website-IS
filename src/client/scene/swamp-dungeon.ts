import * as THREE from 'three';
import { insideSwamp, plankPos, SWAMP_DUNGEON as S } from '../../shared/swamp-dungeon';
import type { SwampDungeonView } from '../../shared/protocol';
import { FUEGO } from '../../shared/fuego';
import { WATER_LEVEL } from '../../shared/terrain';

const BARK = new THREE.MeshLambertMaterial({ color: 0x3b3a26, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x2e2a1c, flatShading: true });
const THORN = new THREE.MeshLambertMaterial({ color: 0x4a3f4f, flatShading: true });
const FLOOR = new THREE.MeshLambertMaterial({ color: 0x5c5a44 });
const MUD = new THREE.MeshLambertMaterial({ color: 0x3a3020 });
const WALL = new THREE.MeshLambertMaterial({ color: 0x3f4234, flatShading: true });
const PLANK = new THREE.MeshLambertMaterial({ color: 0x7a5a36, flatShading: true });
const LAMP = new THREE.MeshLambertMaterial({ color: 0x6a6a5a, flatShading: true });
// Lights ignore fog (spec S3 §3.3): flames are basic materials without fog.
const FLAME = new THREE.MeshBasicMaterial({ color: 0xff9a3a, fog: false });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });

/** La Raíz-madre del Pantano: a sunken trunk in the Laguna Negra, and its interior. */
export class SwampDungeonMeshes {
  readonly group = new THREE.Group();
  private readonly gates: THREE.Object3D[] = [];
  private readonly thorn: THREE.Group;
  private readonly handles: THREE.Object3D[] = [];
  private readonly lampFlames: THREE.Mesh[] = [];
  private readonly lampLights: THREE.PointLight[] = [];
  private readonly planks: THREE.Mesh[] = [];
  private readonly altarOrb: THREE.Mesh;
  private readonly exit: THREE.Mesh;

  constructor(entrance: { x: number; y: number; z: number }, shadows: boolean) {
    const r = S.trunkR;
    // Sunken: its foot is in the Laguna's bed; a hollow glows just above the water.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 1.1, 22, 10, 3), BARK);
    trunk.position.set(entrance.x, entrance.y + 11, entrance.z);
    trunk.castShadow = shadows;
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16), GLOW);
    hollow.scale.y = 1.4;
    hollow.position.set(entrance.x, WATER_LEVEL + 1.4, entrance.z - r * 1.0);
    hollow.rotation.y = Math.PI;
    this.group.add(trunk, hollow);

    const X = S.x;
    const W = S.halfW * 2 + 2;
    const slab = (z0: number, z1: number, y: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, 1, z1 - z0), mat);
      m.position.set(X, y - 0.5, (z0 + z1) / 2);
      m.receiveShadow = shadows;
      this.group.add(m);
    };
    slab(S.z0 - 1, S.mud[0], S.floor, FLOOR);
    slab(S.mud[1], S.z1 + 1, S.floor, FLOOR);
    slab(S.mud[0], S.mud[1], S.floor - S.mudDepth, MUD);
    const side = (w: number, h: number, x: number, y: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), WALL);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    const len = S.z1 - S.z0;
    const mid = (S.z0 + S.z1) / 2;
    const tall = 9 + S.mudDepth;
    side(len, tall, X - S.halfW, S.floor + 9 - tall / 2, mid, Math.PI / 2);
    side(len, tall, X + S.halfW, S.floor + 9 - tall / 2, mid, -Math.PI / 2);
    side(S.halfW * 2, 9, X, S.floor + 4.5, S.z0, 0);
    side(S.halfW * 2, 9, X, S.floor + 4.5, S.z1, Math.PI);
    for (const z of S.gatesZ) {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(S.halfW - 3, 9, 1), WALL);
        m.position.set(X + (s * (S.halfW + 3)) / 2, S.floor + 4.5, z);
        this.group.add(m);
      }
    }
    // Gates 0, 2, 3: root bars. Gate 1: a knot of thorns that shrinks with each Llamarada.
    this.thorn = new THREE.Group();
    S.gatesZ.forEach((z, gi) => {
      const g = gi === 1 ? this.thorn : new THREE.Group();
      for (let i = -2.5; i <= 2.5; i += 1) {
        const bar = new THREE.Mesh(gi === 1 ? new THREE.ConeGeometry(0.5, 8, 5) : new THREE.CylinderGeometry(0.22, 0.3, 8, 5), gi === 1 ? THORN : ROOT);
        bar.position.set(X + i, S.floor + 4, z);
        if (gi === 1) bar.rotation.z = i * 0.08;
        g.add(bar);
      }
      this.gates.push(g);
      this.group.add(g);
    });
    // Planks over the mud.
    for (let i = 0; i < S.planks; i++) {
      const p = plankPos(i);
      const m = new THREE.Mesh(new THREE.BoxGeometry(S.plankHalfW * 2, 0.3, (S.mud[1] - S.mud[0]) / S.planks - 0.15), PLANK);
      m.position.set(p.x, S.floor - 0.15, p.z);
      this.planks.push(m);
      this.group.add(m);
    }
    // Mud pools in the bruto de turba's room.
    for (const p of S.pools) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(S.poolR, 20), MUD);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(X + p.x, S.floor + 0.03, p.z);
      this.group.add(pool);
    }
    // Gas lamps: dark until lit (the hall has no other light).
    for (const l of S.lamps) {
      const p = insideSwamp(l);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), LAMP);
      post.position.set(p.x, S.floor + 1.2, p.z);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 7), FLAME);
      flame.position.set(p.x, S.floor + 2.8, p.z);
      flame.visible = false;
      const light = new THREE.PointLight(0xffa050, 18, 16);
      light.position.set(p.x, S.floor + 3, p.z);
      light.visible = false;
      this.lampFlames.push(flame);
      this.lampLights.push(light);
      this.group.add(post, flame, light);
    }
    // Levers.
    for (const l of S.levers) {
      const p = insideSwamp(l);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), WALL);
      post.position.set(p.x, S.floor + 0.5, p.z);
      const pivot = new THREE.Object3D();
      pivot.position.set(p.x, S.floor + 1, p.z);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.3, 5), ROOT);
      handle.position.y = 0.6;
      pivot.add(handle);
      pivot.rotation.z = 0.6;
      this.handles.push(pivot);
      this.group.add(post, pivot);
    }
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1, 8), WALL);
    altar.position.set(X, S.floor + 0.5, S.altarZ);
    this.altarOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
    this.altarOrb.position.set(X, S.floor + 1.7, S.altarZ);
    this.exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), GLOW);
    this.exit.position.set(X, S.floor + 1.6, S.entryZ - 1.5);
    this.group.add(altar, this.altarOrb, this.exit);
    for (const [z, color] of [[S.altarZ, 0xffd8a0], [107, 0xc8c090], [S.eliteZ, 0xb0a070], [165, 0x9ab080]] as const) {
      const lamp = new THREE.PointLight(color, 22, 36);
      lamp.position.set(X, S.floor + 7, z);
      this.group.add(lamp);
    }
  }

  sync(view: SwampDungeonView, fuego: boolean): void {
    this.gates.forEach((g, i) => (g.visible = !view.gates[i]));
    this.thorn.scale.y = 1 - view.thorn * 0.25;
    view.lamps.forEach((on, i) => {
      this.lampFlames[i]!.visible = on;
      this.lampLights[i]!.visible = on;
    });
    view.planks.forEach((up, i) => (this.planks[i]!.position.y = up ? S.floor - 0.15 : S.floor - S.mudDepth + 0.1));
    view.levers.forEach((on, i) => {
      const h = this.handles[i];
      if (h) h.rotation.z = on ? -0.6 : 0.6;
    });
    this.altarOrb.visible = !fuego;
  }

  animate(t: number): void {
    this.altarOrb.rotation.y = t;
    this.altarOrb.position.y = S.floor + 1.7 + Math.sin(t * 2) * 0.1;
    this.exit.rotation.y = t * 0.5;
    for (const f of this.lampFlames) f.scale.y = 1 + Math.sin(t * 9 + f.position.z) * 0.15;
  }
}

/** A brief orange cone where a Llamarada went. */
export class FlameFx {
  readonly mesh: THREE.Mesh;
  private left = 0;
  constructor() {
    const r = Math.tan(FUEGO.cone / 2) * FUEGO.range;
    const geo = new THREE.ConeGeometry(r, FUEGO.range, 16, 1, true);
    geo.translate(0, -FUEGO.range / 2, 0);
    geo.rotateX(-Math.PI / 2); // apex at the origin, opening along +z
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.mesh.visible = false;
  }
  play(x: number, y: number, z: number, yaw: number): void {
    this.mesh.position.set(x, y + 1, z);
    this.mesh.rotation.y = yaw;
    this.left = 0.4;
    this.mesh.visible = true;
  }
  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.left -= dt;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.left) * 1.5;
    if (this.left <= 0) this.mesh.visible = false;
  }
}
