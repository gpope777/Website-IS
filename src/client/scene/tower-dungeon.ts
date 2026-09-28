import * as THREE from 'three';
import { boulders, MOUNTAIN_DUNGEON as M } from '../../shared/mountain-dungeon';
import { insideTower, TOWER_DUNGEON as T, TOWER_ROCKFALL } from '../../shared/tower-dungeon';
import type { TowerDungeonView } from '../../shared/protocol';
import { copaBackdrop } from './backdrop';

const FLOOR = new THREE.MeshLambertMaterial({ color: 0x3a2e44 });
const WALL = new THREE.MeshLambertMaterial({ color: 0x2a2034, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x3a1e40, flatShading: true });
const BRIDGE = new THREE.MeshLambertMaterial({ color: 0x5a7a3a, flatShading: true });
const THORN = new THREE.MeshLambertMaterial({ color: 0x140c18, flatShading: true });
const ROCK = new THREE.MeshLambertMaterial({ color: 0x5a5460, flatShading: true });
const MIASMA = new THREE.MeshBasicMaterial({ color: 0x9a5ac8, transparent: true, opacity: 0.55, depthWrite: false });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const COLD = new THREE.MeshLambertMaterial({ color: 0x2a2430 });
const PLATE_UP = new THREE.MeshLambertMaterial({ color: 0x6a6070 });
const PLATE_DOWN = new THREE.MeshLambertMaterial({ color: 0xd0b8ff, emissive: 0x4a3070 });
const MARK = new THREE.MeshBasicMaterial({ color: 0xc8a8e8, transparent: true, opacity: 0.5, depthWrite: false });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xd8b8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
const PER_LANE = 3;

/** La Torre's interior (S5-E): violet, four floors, La Flecha's columns, the stair and the empty Copa. The door lives in villain-tower.ts. */
export class TowerDungeonMeshes {
  readonly group = new THREE.Group();
  private readonly gates: THREE.Object3D[] = [];
  private readonly bridges: THREE.Mesh[] = [];
  private readonly vents: THREE.Mesh[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly plate: THREE.Mesh;
  private readonly exit: THREE.Mesh;
  private readonly rocks: THREE.Mesh[] = [];

  constructor(shadows: boolean) {
    const X = T.x;
    const F = T.floor;
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    box(T.halfW * 2 + 2, 1, T.copaZ + 2, FLOOR, X, F - 0.5, T.copaZ / 2).receiveShadow = shadows;
    box(1, 12, T.copaZ, WALL, X - T.halfW - 0.5, F + 6, T.copaZ / 2);
    box(1, 12, T.copaZ, WALL, X + T.halfW + 0.5, F + 6, T.copaZ / 2);
    box(T.halfW * 2, 12, 1, WALL, X, F + 6, T.z0 - 0.5);
    // La Copa: a round floor with a low rim, open to the sky.
    const copa = new THREE.Mesh(new THREE.CylinderGeometry(T.copa.r, T.copa.r, 1, 32), FLOOR);
    copa.position.set(X, F - 0.5, T.copa.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(T.copa.r, 0.6, 6, 40), WALL);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(X, F + 0.4, T.copa.z);
    this.group.add(copa, rim);
    // P7-E: the painted backdrop (the world from the top of the Torre), 1 draw call.
    const telon = copaBackdrop(X, F, T.copa.z);
    if (telon) this.group.add(telon);
    // Gates: root bars across the corridor.
    // Gates: one wall of knotted root each (a single mesh; phones).
    T.gatesZ.forEach((z) => this.gates.push(box(T.halfW * 2, 9, 0.8, ROOT, X, F + 4.5, z)));
    // Drawn steps between the floors (the floor itself stays flat): the view says "up".
    for (const z of [46, 85, 125, 166, 201]) for (let k = 0; k < 2; k++) box(T.halfW * 2 - 2, 0.25 + k * 0.25, 1.2, ROCK, X, F + 0.12 + k * 0.12, z - 0.6 + k * 1.2);
    // Floor 1: the thorn pit and its two root bridges.
    const pit = box(T.halfW * 2, 0.4, T.pit[1] - T.pit[0], THORN, X, F + 0.2, (T.pit[0] + T.pit[1]) / 2);
    pit.receiveShadow = shadows;
    T.roots.forEach((r) => {
      const at = insideTower(r);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 1.4, 6), ROOT);
      stub.position.set(at.x, F + 0.7, at.z);
      const b = box(2.2, 0.4, T.pit[1] - T.pit[0] + 2, BRIDGE, at.x, F + 0.6, (T.pit[0] + T.pit[1]) / 2);
      b.visible = false;
      this.bridges.push(b);
      this.group.add(stub);
    });
    // Floor 2: three miasma vents.
    for (const v of T.vents) {
      const at = insideTower(v);
      box(2, 0.5, 2, ROCK, at.x, F + 0.25, at.z);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), MIASMA);
      puff.position.set(at.x, F + 2, at.z);
      this.vents.push(puff);
      this.group.add(puff);
    }
    // Floor 3: four braziers in the dark.
    for (const b of T.braziers) {
      const at = insideTower(b);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.4, 1.2, 8), ROCK);
      bowl.position.set(at.x, F + 0.6, at.z);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), COLD);
      fl.position.set(at.x, F + 1.8, at.z);
      this.flames.push(fl);
      this.group.add(bowl, fl);
    }
    // Floor 4: the rockfall lanes and the shelf with its plate.
    const [z0, z1] = TOWER_ROCKFALL.span;
    for (const l of M.lanes) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.3, z1 - z0), MARK);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(X + l + M.laneHalf, F + 0.02, (z0 + z1) / 2);
      this.group.add(mark);
      for (let k = 0; k < PER_LANE; k++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), ROCK);
        r.visible = false;
        r.castShadow = shadows;
        this.rocks.push(r);
        this.group.add(r);
      }
    }
    const sp = insideTower(T.shelf);
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(T.shelf.r, T.shelf.r + 0.3, T.shelf.h, 10), ROCK);
    shelf.position.set(sp.x, F + T.shelf.h / 2, sp.z);
    shelf.castShadow = shadows;
    this.plate = new THREE.Mesh(new THREE.CylinderGeometry(T.plateR, T.plateR, 0.15, 16), PLATE_UP);
    this.plate.position.set(sp.x, F + T.shelf.h + 0.08, sp.z);
    this.group.add(shelf, this.plate);
    // La Flecha's arena: four stone columns.
    for (const c of T.columns) {
      const at = insideTower(c);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(T.columnR, T.columnR + 0.2, 5, 8), ROCK);
      col.position.set(at.x, F + 2.5, at.z);
      col.castShadow = shadows;
      this.group.add(col);
    }
    this.exit = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), GLOW);
    this.exit.position.set(X, F + 1.6, T.entryZ - 1.5);
    this.group.add(this.exit);
    // Violet light: floors 1–2, floor 4 and the arena. Floor 3 stays dark (the braziers and the farol light it).
    for (const [z, color] of [[45, 0xc8a0ff], [150, 0xb090e8], [190, 0xa080e0]] as const) {
      const lamp = new THREE.PointLight(color, 26, 48);
      lamp.position.set(X, F + 9, z);
      this.group.add(lamp);
    }
  }

  sync(view: TowerDungeonView): void {
    this.gates.forEach((g, i) => (g.visible = !view.gates[i]));
    this.bridges.forEach((b, i) => (b.visible = !!view.bridges[i]));
    this.vents.forEach((v, i) => (v.visible = !view.vents[i]));
    this.flames.forEach((f, i) => (f.material = view.braziers[i] ? FLAME : COLD));
    this.plate.material = view.plate ? PLATE_DOWN : PLATE_UP;
    this.plate.position.y = T.floor + T.shelf.h + (view.plate ? 0.02 : 0.08);
  }

  /** `t` = server time (boulders are a pure function of it); `pillars` stop their lane. */
  animate(t: number, pillars: readonly { x: number; z: number }[]): void {
    this.exit.rotation.y = t * 0.5;
    for (const [i, v] of this.vents.entries()) v.scale.setScalar(1 + 0.12 * Math.sin(t * 2 + i));
    for (const [i, f] of this.flames.entries()) f.scale.y = f.material === FLAME ? 1 + 0.2 * Math.sin(t * 9 + i) : 0.6;
    M.lanes.forEach((l, lane) => {
      const zs = boulders(t, lane, pillars, TOWER_ROCKFALL);
      for (let k = 0; k < PER_LANE; k++) {
        const r = this.rocks[lane * PER_LANE + k]!;
        const z = zs[k];
        r.visible = z !== undefined;
        if (z === undefined) continue;
        r.position.set(T.x + l, T.floor + 0.9, z);
        r.rotation.x = -z * 0.9;
      }
    });
  }
}
