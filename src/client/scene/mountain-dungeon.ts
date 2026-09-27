import * as THREE from 'three';
import { boulders, dungeonBlockCell, insideMountain, MOUNTAIN_DUNGEON as M } from '../../shared/mountain-dungeon';
import type { MountainDungeonView } from '../../shared/protocol';
import { CUCURUCHO } from '../../shared/sim/cucurucho';

const ROCK = new THREE.MeshLambertMaterial({ color: 0x6e7680, flatShading: true });
const DARK = new THREE.MeshBasicMaterial({ color: 0x0c1016 });
const FLOOR = new THREE.MeshLambertMaterial({ color: 0x7c8894 });
const WALL = new THREE.MeshLambertMaterial({ color: 0x55606c, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x2e2a1c, flatShading: true });
const BLOCK = new THREE.MeshLambertMaterial({ color: 0xa8a49a, flatShading: true });
const SLOT = new THREE.MeshBasicMaterial({ color: 0xd8e4f0, transparent: true, opacity: 0.6, depthWrite: false });
const PLATE_UP = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
const PLATE_DOWN = new THREE.MeshLambertMaterial({ color: 0xbcd6ee, emissive: 0x3a5a7a });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
/** Boulders drawn per lane (at 8 m/s over 40 m, every 2 s: at most 3 in a lane). */
const PER_LANE = 3;

/** The mountain cave: a dark mouth by the Raíz-madre de la Montaña, and its cold interior. */
export class MountainDungeonMeshes {
  readonly group = new THREE.Group();
  private readonly gates: THREE.Object3D[] = [];
  private readonly handles: THREE.Object3D[] = [];
  private readonly blocks: THREE.Mesh[] = [];
  private readonly plate: THREE.Mesh;
  private readonly altarOrb: THREE.Mesh;
  private readonly exit: THREE.Mesh;
  private readonly rocks: THREE.Mesh[] = [];
  /** El Cucurucho's alud: 4 dark discs on the floor while the boulders fall. */
  private readonly shadows: THREE.Mesh[] = [];

  constructor(mouth: { x: number; y: number; z: number }, shadows: boolean) {
    // The mouth: a rock arch around a dark doorway, facing the forest (+z).
    const arch = new THREE.Mesh(new THREE.TorusGeometry(M.mouthR, 1.2, 6, 12, Math.PI), ROCK);
    arch.position.set(mouth.x, mouth.y, mouth.z);
    arch.castShadow = shadows;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(M.mouthR - 0.6, 16, 0, Math.PI), DARK);
    hole.position.set(mouth.x, mouth.y, mouth.z - 0.3);
    this.group.add(arch, hole);

    const X = M.x;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(M.halfW * 2 + 2, 1, M.z1 - M.z0 + 2), FLOOR);
    floor.position.set(X, M.floor - 0.5, (M.z0 + M.z1) / 2);
    floor.receiveShadow = shadows;
    this.group.add(floor);
    const side = (w: number, x: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 10), WALL);
      m.position.set(x, M.floor + 5, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    const len = M.z1 - M.z0;
    const mid = (M.z0 + M.z1) / 2;
    side(len, X - M.halfW, mid, Math.PI / 2);
    side(len, X + M.halfW, mid, -Math.PI / 2);
    side(M.halfW * 2, X, M.z0, 0);
    side(M.halfW * 2, X, M.z1, Math.PI);
    M.gatesZ.forEach((z) => {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(M.halfW - 3, 10, 1), WALL);
        m.position.set(X + (s * (M.halfW + 3)) / 2, M.floor + 5, z);
        this.group.add(m);
      }
      const g = new THREE.Group();
      for (let i = -2.5; i <= 2.5; i += 1) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 5), ROOT);
        bar.position.set(X + i, M.floor + 4.5, z);
        g.add(bar);
      }
      this.gates.push(g);
      this.group.add(g);
    });
    for (const l of [...M.levers, M.resetLever]) {
      const p = insideMountain(l);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), WALL);
      post.position.set(p.x, M.floor + 0.5, p.z);
      const pivot = new THREE.Object3D();
      pivot.position.set(p.x, M.floor + 1, p.z);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.3, 5), ROOT);
      handle.position.y = 0.6;
      pivot.add(handle);
      pivot.rotation.z = 0.6;
      this.handles.push(pivot);
      this.group.add(post, pivot);
    }
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1, 8), WALL);
    altar.position.set(X, M.floor + 0.5, M.altarZ);
    this.altarOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xc8ccd4 }));
    this.altarOrb.position.set(X, M.floor + 1.7, M.altarZ);
    // The shelf and its plate on top.
    const sp = insideMountain(M.shelf);
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(M.shelf.r, M.shelf.r + 0.3, M.shelf.h, 10), ROCK);
    shelf.position.set(sp.x, M.floor + M.shelf.h / 2, sp.z);
    shelf.castShadow = shadows;
    this.plate = new THREE.Mesh(new THREE.CylinderGeometry(M.plateR, M.plateR, 0.15, 16), PLATE_UP);
    this.plate.position.set(sp.x, M.floor + M.shelf.h + 0.08, sp.z);
    this.group.add(altar, this.altarOrb, shelf, this.plate);
    // Block room: two pale slots and two stone blocks.
    for (const c of M.blocks.slots) {
      const p = dungeonBlockCell(c);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(M.blocks.cell - 0.2, M.blocks.cell - 0.2), SLOT);
      s.rotation.x = -Math.PI / 2;
      s.position.set(p.x, M.floor + 0.03, p.z);
      this.group.add(s);
    }
    for (const c of M.blocks.starts) {
      const p = dungeonBlockCell(c);
      const b = new THREE.Mesh(new THREE.BoxGeometry(M.blocks.cell - 0.1, 1.6, M.blocks.cell - 0.1), BLOCK);
      b.position.set(p.x, M.floor + 0.8, p.z);
      b.castShadow = shadows;
      this.blocks.push(b);
      this.group.add(b);
    }
    // Rockfall: lane marks and a small pool of boulders.
    for (const l of M.lanes) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.3, M.rockfall[1] - M.rockfall[0]), SLOT);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(X + l + M.laneHalf, M.floor + 0.02, (M.rockfall[0] + M.rockfall[1]) / 2);
      this.group.add(mark);
      for (let k = 0; k < PER_LANE; k++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), ROCK);
        r.visible = false;
        r.castShadow = shadows;
        this.rocks.push(r);
        this.group.add(r);
      }
    }
    this.exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), GLOW);
    this.exit.position.set(X, M.floor + 1.6, M.entryZ - 1.5);
    this.group.add(this.exit);
    for (const [z, color] of [[M.altarZ, 0xcfe0ff], [74, 0xb8ccea], [110, 0xa8c0e0], [M.eliteZ, 0x9ab0d8], [175, 0x8aa0c8]] as const) {
      const lamp = new THREE.PointLight(color, 22, 36);
      lamp.position.set(X, M.floor + 8, z);
      this.group.add(lamp);
    }
    const shadow = new THREE.MeshBasicMaterial({ color: 0x1a1020, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(CUCURUCHO.aludR, 20), shadow);
      d.rotation.x = -Math.PI / 2;
      d.visible = false;
      this.shadows.push(d);
      this.group.add(d);
    }
  }

  sync(view: MountainDungeonView, piedra: boolean): void {
    this.gates.forEach((g, i) => (g.visible = !view.gates[i]));
    view.levers.forEach((on, i) => {
      const h = this.handles[i];
      if (h) h.rotation.z = on ? -0.6 : 0.6;
    });
    this.plate.material = view.plate ? PLATE_DOWN : PLATE_UP;
    this.plate.position.y = M.floor + M.shelf.h + (view.plate ? 0.02 : 0.08);
    view.blocks.forEach((b, i) => {
      const m = this.blocks[i];
      if (m) m.userData.to = b; // slides there in animate (0.5 s)
    });
    this.altarOrb.visible = !piedra;
    const alud = view.boss?.alud ?? [];
    this.shadows.forEach((d, i) => {
      const c = alud[i];
      d.visible = !!c;
      if (c) d.position.set(c.x, M.floor + 0.05, c.z);
    });
  }

  /** `t` = server time (boulders are a pure function of it); `pillars` stop their lane. */
  animate(t: number, dt: number, pillars: readonly { x: number; z: number }[]): void {
    this.altarOrb.rotation.y = t;
    this.exit.rotation.y = t * 0.5;
    for (const m of this.blocks) {
      const to = m.userData.to as { x: number; z: number } | undefined;
      if (!to) continue;
      const k = Math.min(1, dt * 4);
      m.position.x += (to.x - m.position.x) * k;
      m.position.z += (to.z - m.position.z) * k;
    }
    M.lanes.forEach((l, lane) => {
      const zs = boulders(t, lane, pillars);
      for (let k = 0; k < PER_LANE; k++) {
        const r = this.rocks[lane * PER_LANE + k]!;
        const z = zs[k];
        r.visible = z !== undefined;
        if (z === undefined) continue;
        r.position.set(M.x + l, M.floor + 0.9, z);
        r.rotation.x = -z * 0.9;
      }
    });
  }
}
