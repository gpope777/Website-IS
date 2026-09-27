import * as THREE from 'three';
import { DUNGEON, leverPos } from '../../shared/dungeon';
import type { DungeonView } from '../../shared/protocol';

const BARK = new THREE.MeshLambertMaterial({ color: 0x4a3322, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x3b2a1c, flatShading: true });
const FLOOR = new THREE.MeshLambertMaterial({ color: 0x5b4a39 });
const WALL = new THREE.MeshLambertMaterial({ color: 0x3f3025, flatShading: true });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xb58cff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const BEAM = new THREE.MeshBasicMaterial({ color: 0xc9a6ff, transparent: true, opacity: 0.16, depthWrite: false });

/** La Raíz-madre: a huge trunk in the world, and its interior (hall, root gate, altar, boss room). */
export class DungeonMeshes {
  readonly group = new THREE.Group();
  private readonly gate = new THREE.Group();
  private readonly handles: THREE.Object3D[] = [];
  private readonly altarOrb: THREE.Mesh;
  private readonly hollow: THREE.Mesh;
  private readonly exit: THREE.Mesh;

  constructor(entrance: { x: number; y: number; z: number }, shadows: boolean) {
    // --- the trunk in the world
    const r = DUNGEON.trunkR;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 1.15, 26, 10, 4), BARK);
    trunk.position.set(entrance.x, entrance.y + 12, entrance.z);
    trunk.castShadow = shadows;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 2.4, 1), new THREE.MeshLambertMaterial({ color: 0x3e5a2e, flatShading: true }));
    crown.position.set(entrance.x, entrance.y + 27, entrance.z);
    crown.scale.y = 0.6;
    this.group.add(trunk, crown);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 7, 6), ROOT);
      root.position.set(entrance.x + Math.sin(a) * (r + 2), entrance.y + 0.8, entrance.z + Math.cos(a) * (r + 2));
      root.rotation.set(Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2);
      this.group.add(root);
    }
    // The hollow faces spawn: where the server lets you in.
    const toSpawn = Math.atan2(-entrance.x, -entrance.z);
    this.hollow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), GLOW.clone());
    this.hollow.scale.y = 1.5;
    this.hollow.position.set(entrance.x + Math.sin(toSpawn) * (r * 1.05), entrance.y + 2.2, entrance.z + Math.cos(toSpawn) * (r * 1.05));
    this.hollow.rotation.y = toSpawn;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 8, 1, true), BEAM);
    beam.position.set(entrance.x, entrance.y + 45, entrance.z);
    this.group.add(this.hollow, beam);

    // --- the interior
    const X = DUNGEON.x;
    const len = DUNGEON.z1 - DUNGEON.z0;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(DUNGEON.halfW * 2 + 2, 1, len + 2), FLOOR);
    floor.position.set(X, DUNGEON.floor - 0.5, (DUNGEON.z0 + DUNGEON.z1) / 2);
    floor.receiveShadow = shadows;
    this.group.add(floor);
    const wall = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), WALL);
      m.position.set(x, DUNGEON.floor + 4.5, z);
      this.group.add(m);
    };
    // Outer walls are one-sided planes facing in: when the camera swings behind one, it sees through it.
    const side = (w: number, x: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), WALL);
      m.position.set(x, DUNGEON.floor + 4.5, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    const midZ = (DUNGEON.z0 + DUNGEON.z1) / 2;
    side(len, X - DUNGEON.halfW, midZ, Math.PI / 2);
    side(len, X + DUNGEON.halfW, midZ, -Math.PI / 2);
    side(DUNGEON.halfW * 2, X, DUNGEON.z0, 0);
    side(DUNGEON.halfW * 2, X, DUNGEON.z1, Math.PI);
    // Half walls marking the rooms (with a wide doorway).
    for (const z of [DUNGEON.gateZ, DUNGEON.bossRoomZ]) {
      wall(DUNGEON.halfW - 3, 1, X - (DUNGEON.halfW + 3) / 2, z);
      wall(DUNGEON.halfW - 3, 1, X + (DUNGEON.halfW + 3) / 2, z);
    }
    // Hanging roots along the walls.
    for (let z = DUNGEON.z0 + 4; z < DUNGEON.z1; z += 7) {
      for (const s of [-1, 1]) {
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 6, 5), ROOT);
        root.position.set(X + s * (DUNGEON.halfW - 0.3), DUNGEON.floor + 5, z + (s > 0 ? 3 : 0));
        this.group.add(root);
      }
    }
    // The root gate: bars across the doorway, gone when open.
    for (let i = -2.5; i <= 2.5; i += 1) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 8, 5), ROOT);
      bar.position.set(X + i, DUNGEON.floor + 4, DUNGEON.gateZ);
      this.gate.add(bar);
    }
    this.group.add(this.gate);
    // Root levers.
    for (const i of [0, 1]) {
      const p = leverPos(i);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), WALL);
      post.position.set(p.x, DUNGEON.floor + 0.5, p.z);
      const pivot = new THREE.Object3D();
      pivot.position.set(p.x, DUNGEON.floor + 1, p.z);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.3, 5), ROOT);
      handle.position.y = 0.6;
      pivot.add(handle);
      pivot.rotation.z = 0.6;
      this.handles.push(pivot);
      this.group.add(post, pivot);
    }
    // The altar of Enredadera.
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1, 8), WALL);
    altar.position.set(X, DUNGEON.floor + 0.5, DUNGEON.altarZ);
    this.altarOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0x7dffb5 }));
    this.altarOrb.position.set(X, DUNGEON.floor + 1.7, DUNGEON.altarZ);
    // The way out: a ring of light by the entry.
    this.exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), GLOW);
    this.exit.position.set(X, DUNGEON.floor + 1.6, DUNGEON.entryZ - 1.5);
    const lamp = new THREE.PointLight(0xd8b8ff, 30, 40);
    lamp.position.set(X, DUNGEON.floor + 7, DUNGEON.bossZ - 6);
    const lamp2 = new THREE.PointLight(0xb8ffd8, 20, 30);
    lamp2.position.set(X, DUNGEON.floor + 6, DUNGEON.altarZ);
    this.group.add(altar, this.altarOrb, this.exit, lamp, lamp2);
  }

  sync(view: DungeonView, power: boolean): void {
    this.gate.visible = !view.gate;
    view.levers.forEach((on, i) => {
      const h = this.handles[i];
      if (h) h.rotation.z = on ? -0.6 : 0.6;
    });
    this.altarOrb.visible = !power;
  }

  animate(t: number): void {
    this.altarOrb.rotation.y = t;
    this.altarOrb.position.y = DUNGEON.floor + 1.7 + Math.sin(t * 2) * 0.1;
    (this.hollow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2) * 0.15;
    this.exit.rotation.y = t * 0.5;
  }
}
