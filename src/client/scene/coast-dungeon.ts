import * as THREE from 'three';
import { COAST_DUNGEON as C, insideCoast } from '../../shared/coast-dungeon';
import type { CoastDungeonView } from '../../shared/protocol';
import { VIENTO } from '../../shared/viento';
import { ANTENON } from '../../shared/sim/antenon';

const BARK = new THREE.MeshLambertMaterial({ color: 0x3d4a44, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x2f3b36, flatShading: true });
const FLOOR = new THREE.MeshLambertMaterial({ color: 0x6f7a70 });
const WALL = new THREE.MeshLambertMaterial({ color: 0x46524c, flatShading: true });
const SEA = new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.85 });
const PUMICE = new THREE.MeshLambertMaterial({ color: 0xd9d4c4, flatShading: true });
const GLOW = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const CORAL = new THREE.MeshLambertMaterial({ color: 0xe88a9a, flatShading: true });
const WARN = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const BEAM = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.14, depthWrite: false });

/** La Raíz-madre de la Costa: a grey-green trunk on the dungeon island, and its interior. */
export class CoastDungeonMeshes {
  readonly group = new THREE.Group();
  private readonly gates: THREE.Object3D[] = [];
  private readonly fan: THREE.Group;
  private readonly block: THREE.Mesh;
  private readonly plate: THREE.Mesh;
  private readonly handles: THREE.Object3D[] = [];
  private readonly altarOrb: THREE.Mesh;
  private readonly exit: THREE.Mesh;
  private fanOpen = false;
  /** El Antenón's telegraphs: a ring for the sweep, a strip for the charge. */
  private readonly sweepRing: THREE.Mesh;
  private readonly chargeStrip: THREE.Mesh;

  constructor(entrance: { x: number; y: number; z: number }, shadows: boolean) {
    const r = C.trunkR;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 1.1, 20, 10, 3), BARK);
    trunk.position.set(entrance.x, entrance.y + 9, entrance.z);
    trunk.castShadow = shadows;
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16), GLOW);
    hollow.scale.y = 1.5;
    hollow.position.set(entrance.x, entrance.y + 2.2, entrance.z - r * 1.02);
    hollow.rotation.y = Math.PI;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 8, 1, true), BEAM);
    beam.position.set(entrance.x, entrance.y + 45, entrance.z);
    this.group.add(trunk, hollow, beam);

    // --- the interior: floor with the chasm cut out, pit bottom, channel water
    const X = C.x;
    const W = C.halfW * 2 + 2;
    const slab = (z0: number, z1: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, 1, z1 - z0), FLOOR);
      m.position.set(X, y - 0.5, (z0 + z1) / 2);
      m.receiveShadow = shadows;
      this.group.add(m);
    };
    slab(C.z0 - 1, C.pit[0], C.floor);
    slab(C.pit[1], C.z1 + 1, C.floor);
    slab(C.pit[0], C.pit[1], C.floor - C.pitDepth);
    const [c0, c1] = C.channel;
    const seaW = C.halfW - C.bridgeX;
    const sea = new THREE.Mesh(new THREE.BoxGeometry(seaW, 0.2, c1 - c0), SEA);
    sea.position.set(X + C.bridgeX + seaW / 2, C.floor + 0.05, (c0 + c1) / 2);
    this.group.add(sea);
    const side = (w: number, h: number, x: number, y: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), WALL);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    const len = C.z1 - C.z0;
    const mid = (C.z0 + C.z1) / 2;
    const tall = 9 + C.pitDepth;
    side(len, tall, X - C.halfW, C.floor + 9 - tall / 2, mid, Math.PI / 2);
    side(len, tall, X + C.halfW, C.floor + 9 - tall / 2, mid, -Math.PI / 2);
    side(C.halfW * 2, 9, X, C.floor + 4.5, C.z0, 0);
    side(C.halfW * 2, 9, X, C.floor + 4.5, C.z1, Math.PI);
    for (const z of C.gatesZ) {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(C.halfW - 3, 9, 1), WALL);
        m.position.set(X + (s * (C.halfW + 3)) / 2, C.floor + 4.5, z);
        this.group.add(m);
      }
    }
    // Gates 0, 2, 3: root bars. Gate 1: the fan (it spins away when a gust opens it).
    C.gatesZ.forEach((z, gi) => {
      if (gi === 1) {
        this.gates.push(new THREE.Object3D());
        return;
      }
      const g = new THREE.Group();
      for (let i = -2.5; i <= 2.5; i += 1) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 8, 5), ROOT);
        bar.position.set(X + i, C.floor + 4, z);
        g.add(bar);
      }
      this.gates.push(g);
      this.group.add(g);
    });
    this.fan = new THREE.Group();
    this.fan.position.set(X, C.floor + 4, C.gatesZ[1]);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.6, 0.15), PUMICE);
      blade.position.y = 1.8;
      const arm = new THREE.Object3D();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(blade);
      this.fan.add(arm);
    }
    this.group.add(this.fan);
    // Pumice block and plate.
    const pl = insideCoast(C.plate);
    this.plate = new THREE.Mesh(new THREE.CylinderGeometry(C.plateRadius, C.plateRadius, 0.25, 12), new THREE.MeshLambertMaterial({ color: 0x8a9a9a }));
    this.plate.position.set(pl.x, C.floor + 0.12, pl.z);
    this.block = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), PUMICE);
    this.group.add(this.plate, this.block);
    // Levers.
    for (const l of C.levers) {
      const p = insideCoast(l);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), WALL);
      post.position.set(p.x, C.floor + 0.5, p.z);
      const pivot = new THREE.Object3D();
      pivot.position.set(p.x, C.floor + 1, p.z);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.3, 5), ROOT);
      handle.position.y = 0.6;
      pivot.add(handle);
      pivot.rotation.z = 0.6;
      this.handles.push(pivot);
      this.group.add(post, pivot);
    }
    // The Viento altar.
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1, 8), WALL);
    altar.position.set(X, C.floor + 0.5, C.altarZ);
    this.altarOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xe8fbff }));
    this.altarOrb.position.set(X, C.floor + 1.7, C.altarZ);
    this.exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), GLOW);
    this.exit.position.set(X, C.floor + 1.6, C.entryZ - 1.5);
    this.group.add(altar, this.altarOrb, this.exit);
    // El Antenón's four coral pillars.
    for (const p of C.pillars) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(C.pillarR * 0.8, C.pillarR, 7, 7), CORAL);
      m.position.set(X + p.x, C.floor + 3.5, p.z);
      m.castShadow = shadows;
      this.group.add(m);
    }
    this.sweepRing = new THREE.Mesh(new THREE.RingGeometry(ANTENON.sweepRadius - 0.3, ANTENON.sweepRadius, 32), WARN);
    this.sweepRing.rotation.x = -Math.PI / 2;
    const strip = new THREE.PlaneGeometry(ANTENON.chargeHit * 2, 12);
    strip.rotateX(-Math.PI / 2);
    strip.translate(0, 0, 6);
    this.chargeStrip = new THREE.Mesh(strip, WARN);
    this.sweepRing.visible = this.chargeStrip.visible = false;
    this.group.add(this.sweepRing, this.chargeStrip);
    for (const [z, color] of [[C.altarZ, 0xd8f4ff], [70, 0x9fd8e8], [106, 0xbfe8ff], [C.eliteZ, 0xff9a7a], [165, 0x9ab8ff]] as const) {
      const lamp = new THREE.PointLight(color, 24, 36);
      lamp.position.set(X, C.floor + 7, z);
      this.group.add(lamp);
    }
  }

  sync(view: CoastDungeonView, viento: boolean): void {
    this.gates.forEach((g, i) => (g.visible = !view.gates[i]));
    this.fanOpen = view.gates[1]!;
    this.block.position.set(view.block.x, C.floor + 0.55, view.block.z);
    this.plate.position.y = C.floor + (view.plate ? 0.02 : 0.12);
    view.levers.forEach((on, i) => {
      const h = this.handles[i];
      if (h) h.rotation.z = on ? -0.6 : 0.6;
    });
    this.altarOrb.visible = !viento;
  }

  /** Show El Antenón's wind-up where it stands (`at` null = no boss in sight). */
  telegraph(tell: 'sweep' | 'charge' | null, at: { x: number; z: number; yaw: number } | null): void {
    this.sweepRing.visible = tell === 'sweep' && !!at;
    this.chargeStrip.visible = tell === 'charge' && !!at;
    if (!at) return;
    this.sweepRing.position.set(at.x, C.floor + 0.05, at.z);
    this.chargeStrip.position.set(at.x, C.floor + 0.05, at.z);
    this.chargeStrip.rotation.y = at.yaw;
  }

  animate(t: number, dt: number): void {
    // Shut, the fan turns lazily; opened by a gust, it spins and lifts out of the doorway.
    this.fan.rotation.z += dt * (this.fanOpen ? 6 : 0.4);
    this.fan.position.y += ((this.fanOpen ? C.floor + 9 : C.floor + 4) - this.fan.position.y) * Math.min(1, dt * 2);
    this.altarOrb.rotation.y = t;
    this.altarOrb.position.y = C.floor + 1.7 + Math.sin(t * 2) * 0.1;
    this.exit.rotation.y = t * 0.5;
  }
}

/** A brief pale cone where a gust went. */
export class GustFx {
  readonly mesh: THREE.Mesh;
  private left = 0;
  constructor() {
    const r = Math.tan(VIENTO.cone / 2) * VIENTO.range;
    const geo = new THREE.ConeGeometry(r, VIENTO.range, 16, 1, true);
    geo.translate(0, -VIENTO.range / 2, 0);
    geo.rotateX(-Math.PI / 2); // apex at the origin, opening along +z
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.mesh.visible = false;
  }
  play(x: number, y: number, z: number, yaw: number): void {
    this.mesh.position.set(x, y + 1, z);
    this.mesh.rotation.y = yaw;
    this.left = 0.35;
    this.mesh.visible = true;
  }
  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.left -= dt;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.left) * 0.9;
    if (this.left <= 0) this.mesh.visible = false;
  }
}
