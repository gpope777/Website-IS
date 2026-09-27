import * as THREE from 'three';
import { HARVEST, generateResources, type ResourceSpawn } from '../shared/resources';
import { createTerrain, type Terrain } from '../shared/terrain';
import { cragsNear, generateCrags, type Crag } from '../shared/crags';
import { generateShrines, SHRINE, type Shrine } from '../shared/shrines';
import { clampStep, generateEntrance, withDungeon } from '../shared/dungeon';
import { bossBarText, dungeonAction, marchitoBarText } from './dungeon-ui';
import { MARCHITO } from '../shared/sim/marchito';
import { mountAction, ringNeedle } from './mount-ui';
import { MOUNT } from '../shared/mount';
import { SteedMeshes, type SteedPose } from './scene/steeds';
import { PROTOCOL_VERSION, r2, type Anim, type DungeonView, type HeartView, type RaidView, type ServerMsg, type ShrineView, type SteedView, type Structure, type TameView } from '../shared/protocol';
import { dayFraction, HEART, PUNCH, REACH, REVIVE } from '../shared/sim/world-sim';
import { BOW } from '../shared/sim/combat';
import { keepLock, LOCK, pickTarget, yawTo, type AimTarget } from './aim';
import type { StructureKind } from '../shared/items';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import { loadModels, type ModelKit } from './actors/models';
import { PaperActor, type Puppet } from './actors/paper';
import { DungeonMeshes } from './scene/dungeon';
import { CameraRig } from './camera-rig';
import { ColliderGrid } from './colliders';
import { Hud } from './hud';
import { raidText } from './raid-ui';
import { clearHold, Keyboard, readMove, type Action, type InputState, KEY_ACTIONS } from './input';
import { InterpBuffer, INTERP_DELAY } from './interp';
import type { JoinInfo } from './join';
import { animFor, createBody, rollInput, staminaFor, stepBody, type Body } from './movement';
import { Connection, wsUrl, type NetStatus } from './net';
import { loadTier, saveTier, TIERS, type Tier } from './quality';
import { DayLight } from './scene/sky';
import { StructureMeshes } from './scene/structures';
import { GraveMeshes } from './scene/graves';
import { buildCrags, buildVine } from './scene/crags';
import { ShrineMeshes } from './scene/shrines';
import { buildTerrainMesh, buildWater } from './scene/terrain-mesh';
import { buildGrass, ResourceMeshes } from './scene/vegetation';
import { TouchControls, isTouchDevice } from './touch';

/** The nephew's drawing used for el Tragón de Papel (and, purified, the Heart's defender). */
const TRAGON_IMG = '/enemies/enemy1.png';
/** El Marchito in person: the tallest of the nephew's drawings, dyed dark. */
const MARCHITO_IMG = '/enemies/enemy12.png';

interface Remote {
  actor: Puppet;
  buf: InterpBuffer;
  anim: string;
  seen: number;
  /** A player riding a deer. */
  ride: boolean;
  /** Metres per second last frame (the deer's legs). */
  speed: number;
}

const IDLE_INPUT = { x: 0, z: 0, sprint: false, jump: false };
const ROLL_MS = { dash: 350, cooldown: 800 } as const;
const ARROW_TIME = 0.2;

interface Arrow {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
}

/** Suppresses a stray Escape keydown that some browsers echo right after the same
 * Escape already exited pointer lock (which we turn into opening the menu ourselves). */
const ESC_GUARD_MS = 300;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig = new CameraRig();
  private readonly input: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };
  private readonly hud: Hud;
  private readonly conn: Connection;
  private readonly keyboard: Keyboard;
  private readonly touch: TouchControls | null;
  private readonly tier: Tier = loadTier();
  private readonly timer = new THREE.Timer();
  private readonly colliders = new ColliderGrid();
  private readonly structures = new StructureMeshes();
  private readonly graves = new GraveMeshes();
  private readonly others = new Map<string, Remote>();
  private readonly wolves = new Map<number, Remote>();
  /** The purified Tragón by the Heart (at most one, key 0). */
  private readonly allies = new Map<number, Remote>();
  private dungeonMeshes: DungeonMeshes | null = null;
  private readonly gone = new Set<number>();
  private steedMeshes: SteedMeshes | null = null;
  private steeds: SteedView[] = [];
  private tame: TameView | null = null;
  private riding = false;
  private hasSteed = false;
  private jumpWasHeld = false;
  private light: DayLight;
  private kits: { robot: ModelKit; fox: ModelKit } | null = null;
  private seed: number | null = null;
  private terrain: Terrain | null = null;
  private spawns: ResourceSpawn[] = [];
  private crags: Crag[] = [];
  private shrines: Shrine[] = [];
  private shrineMeshes: ShrineMeshes | null = null;
  private shrineViews: ShrineView[] = [];
  /** Shrines this player cleared (from the server). */
  private cleared: number[] = [];
  /** Has Enredadera (from the server). */
  private hasPower = false;
  private entrance = { x: 0, y: 0, z: 0 };
  private dungeon: DungeonView = { gate: false, levers: [false, false], purified: false, boss: null };
  private vines: Crag[] = [];
  private vineKey = '';
  private readonly vineGroup = new THREE.Group();
  /** Crags + shrine rocks (bare unless wrapped) + vines: what stepBody climbs and stands on. */
  private climbList: Crag[] = [];
  /** Resource spawns inside a crag: hidden and uncollided on the client. */
  private readonly buried = new Set<number>();
  private resMeshes: ResourceMeshes | null = null;
  private body: Body | null = null;
  private me: Actor | null = null;
  private myName = '';
  private serverTime = 0;
  private dead = false;
  private heart: HeartView | null = null;
  private raid: RaidView | null = null;
  private attackUntil = 0;
  private lockId: number | null = null;
  private rollUntil = 0;
  private rollReadyAt = 0;
  private bowUntil = 0;
  private blockSent = false;
  private readonly marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xff5a4d }));
  private readonly arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
  private readonly arrowMat = new THREE.MeshBasicMaterial({ color: 0xe8d9b0 });
  private arrows: Arrow[] = [];
  private sendTimer = 0;
  private lastSent = '';
  private disposed = false;
  private lockMenuOpenedAt = 0;

  constructor(private readonly root: HTMLElement, join: JoinInfo, private readonly onLeave: () => void) {
    const t = TIERS[this.tier];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.tier !== 'low' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, t.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = t.shadows;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    root.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, t.drawDistance);
    this.light = new DayLight(this.scene, t);
    this.scene.add(this.structures.group, this.graves.group, this.vineGroup);
    this.marker.rotation.x = Math.PI; // point down at the target
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.hud = new Hud(root);
    this.hud.onRingTap = () => this.tapRing();
    this.keyboard = new Keyboard(this.input, (a) => this.onAction(a));
    this.touch = isTouchDevice()
      ? new TouchControls(root, this.input, {
          onLook: (dx, dy) => {
            if (!this.hud.overlayOpen) this.rig.look(dx, dy);
          },
          onAction: (code) => {
            const a = KEY_ACTIONS[code];
            if (a) this.onAction(a);
          },
          onPause: () => this.onAction('menu'),
        })
      : null;
    root.classList.toggle('touch', !!this.touch);
    if (!this.touch) {
      this.renderer.domElement.addEventListener('click', this.onClick);
      document.addEventListener('mousemove', this.onMouse);
    }
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    addEventListener('resize', this.onResize);

    this.conn = new Connection(
      wsUrl(location, join.world),
      { t: 'hello', v: PROTOCOL_VERSION, name: join.name, pin: join.pin },
      (m) => this.onMsg(m),
      (s) => this.onStatus(s),
    );
    loadModels()
      .then((k) => (this.kits = k))
      .catch(() => this.hud.toast('No se pudieron cargar los personajes'));
    this.renderer.setAnimationLoop(() => this.frame());
  }

  dispose(): void {
    this.disposed = true;
    this.conn.close();
    this.renderer.setAnimationLoop(null);
    this.keyboard.dispose();
    this.touch?.dispose();
    document.removeEventListener('mousemove', this.onMouse);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    removeEventListener('resize', this.onResize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    this.root.innerHTML = '';
  }

  // ---------------------------------------------------------------- network

  private onStatus(s: NetStatus): void {
    if (s.kind === 'fatal') this.releaseInputs();
    this.hud.setStatus(s, () => this.onLeave());
  }

  private onMsg(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome':
        return this.onWelcome(m);
      case 'snap':
        return this.onSnap(m);
      case 'res':
        return this.setGone(m.id, m.gone);
      case 'built':
        return this.addStructure(m.s);
      case 'toast':
        return this.hud.toast(m.text);
      case 'vision':
        return this.hud.showVision(m.lines);
      case 'hit':
        if (this.heart?.id === m.id) this.heart = { ...this.heart, hp: m.hp };
        this.structures.setHp(m.id, m.hp);
        return;
      case 'wrecked':
        this.structures.remove(m.id);
        for (let i = 0; i < 3; i++) this.colliders.remove(`s${m.id}:${i}`);
        return;
      case 'error':
        return; // handled by Connection → onStatus
    }
  }

  private onWelcome(m: Extract<ServerMsg, { t: 'welcome' }>): void {
    this.myName = m.you;
    if (this.seed !== m.seed) this.buildWorld(m.seed);
    const gone = new Set(m.gone);
    for (const s of this.spawns) this.setGone(s.id, gone.has(s.id));
    for (const s of m.structures) this.addStructure(s);
    this.body = createBody(m.self.x, m.self.z, this.terrain!);
    this.body.y = m.self.y;
    this.serverTime = m.time;
    this.applySelf(m.self);
  }

  private buildWorld(seed: number): void {
    const t = TIERS[this.tier];
    this.seed = seed;
    this.terrain = withDungeon(createTerrain(seed));
    this.spawns = generateResources(this.terrain, seed);
    this.resMeshes = new ResourceMeshes(this.spawns, t.shadows);
    this.crags = generateCrags(this.terrain, seed);
    this.shrines = generateShrines(this.terrain, seed, this.crags);
    this.entrance = generateEntrance(this.terrain, seed, this.crags, this.shrines);
    this.dungeonMeshes = new DungeonMeshes(this.entrance, t.shadows);
    this.steedMeshes = new SteedMeshes(t.shadows);
    this.scene.add(this.steedMeshes.group);
    this.scene.add(this.dungeonMeshes.group);
    this.shrineMeshes = new ShrineMeshes(this.shrines, this.terrain, t.shadows);
    this.scene.add(buildTerrainMesh(this.terrain, t.terrainSegments), buildWater(), buildGrass(this.terrain, t.grass, seed), this.resMeshes.group, buildCrags(this.crags, t.shadows), this.shrineMeshes.group);
    this.rebuildClimbables();
    const solid = this.climbList;
    for (const s of this.spawns) {
      if (cragsNear(solid, s.x, s.z, 0.3).length) {
        this.buried.add(s.id);
        this.resMeshes.setGone(s.id, true);
      } else if (s.kind !== 'bush') this.colliders.add(`r${s.id}`, { x: s.x, z: s.z, r: s.radius });
    }
  }

  private setGone(id: number, gone: boolean): void {
    const s = this.spawns[id];
    if (!s || this.buried.has(id) || this.gone.has(id) === gone) return;
    if (gone) this.gone.add(id);
    else this.gone.delete(id);
    this.resMeshes?.setGone(id, gone);
    if (s.kind === 'bush') return;
    if (gone) this.colliders.remove(`r${id}`);
    else this.colliders.add(`r${id}`, { x: s.x, z: s.z, r: s.radius });
  }

  private addStructure(s: Structure): void {
    if (this.structures.has(s.id)) return;
    this.structures.add(s).forEach((c, i) => this.colliders.add(`s${s.id}:${i}`, c));
  }

  private onSnap(m: Extract<ServerMsg, { t: 'snap' }>): void {
    this.serverTime = m.time;
    this.applySelf(m.self);
    this.raid = m.raid;
    this.heart = m.heart;
    this.hud.setHeart(m.heart);
    if (m.heart) this.structures.setHp(m.heart.id, m.heart.hp);
    this.graves.sync(m.graves, this.myName);
    this.syncVines(m.vines);
    this.shrineViews = m.shrines;
    this.dungeon = m.dungeon;
    this.dungeonMeshes?.sync(m.dungeon, this.hasPower);
    this.hud.setBoss(bossBarText(m.dungeon) ?? marchitoBarText(m.marchito));
    this.shrineMeshes?.sync(m.shrines, this.cleared);
    this.steeds = m.steeds;
    if (!this.kits) return;
    for (const p of m.players) {
      const r = this.remote(this.others, p.name, () => new Actor(this.kits!.robot, PLAYER_CLIPS, p.name));
      r.buf.push({ t: m.time, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      r.anim = p.dead ? 'dead' : p.away ? 'idle' : p.ride ? 'idle' : p.anim;
      r.ride = p.ride && !p.dead;
      r.seen = m.time;
    }
    for (const w of m.wolves) {
      const r = this.remote(this.wolves, w.id, () =>
        w.kind === 'boss' ? new PaperActor(TRAGON_IMG, 4.5, this.camera) : w.kind === 'marchito' ? new PaperActor(MARCHITO_IMG, MARCHITO.height, this.camera, 589 / 662) : new Actor(this.kits!.fox, WOLF_CLIPS),
      );
      if (w.kind === 'marchito' && r.actor instanceof PaperActor) r.actor.setTint(m.marchito?.laughing ? 0xb89ac8 : 0x7a5a8c);
      else if (r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.boss?.weak ? 0x9fc4ff : 0xffffff);
      else r.actor.root.scale.setScalar(w.kind === 'brute' ? 1.8 : w.raid ? 1.3 : 1);
      r.buf.push({ t: m.time, x: w.x, y: w.y, z: w.z, yaw: w.yaw });
      r.anim = w.anim;
      r.seen = m.time;
    }
    if (m.ally) {
      const a = m.ally;
      const r = this.remote(this.allies, 0, () => {
        const paper = new PaperActor(TRAGON_IMG, 1.6, this.camera);
        paper.setTint(0xf2fff0); // purified: pale paper
        return paper;
      });
      r.buf.push({ t: m.time, x: a.x, y: a.y, z: a.z, yaw: a.yaw });
      r.anim = a.anim;
      r.seen = m.time;
    }
    for (const map of [this.others, this.wolves, this.allies] as Map<unknown, Remote>[]) {
      for (const [k, r] of map) {
        if (r.seen === m.time) continue;
        r.actor.dispose();
        map.delete(k);
      }
    }
  }

  private rebuildClimbables(): void {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    this.climbList = [...this.crags, ...bare, ...this.vines];
  }

  private syncVines(vines: Crag[]): void {
    const key = JSON.stringify(vines);
    if (key === this.vineKey) return;
    this.vineKey = key;
    this.vines = vines;
    this.vineGroup.clear();
    const pillars = new Set(this.shrines.map((s) => s.pillar?.id));
    for (const v of vines) this.vineGroup.add(buildVine(v, pillars.has(v.id)));
    this.rebuildClimbables();
    // Our vine withered (or a wrapped rock went bare) while we hung on it: let go.
    const b = this.body;
    if (b?.climb && !this.climbList.some((c) => c.id === b.climb!.id && !c.bare)) {
      b.climb = null;
      b.onGround = false;
    }
  }

  private remote<K>(map: Map<K, Remote>, key: K, make: () => Puppet): Remote {
    let r = map.get(key);
    if (!r) {
      r = { actor: make(), buf: new InterpBuffer(), anim: 'idle', seen: 0, ride: false, speed: 0 };
      this.scene.add(r.actor.root);
      map.set(key, r);
    }
    return r;
  }

  private applySelf(self: Extract<ServerMsg, { t: 'snap' }>['self']): void {
    this.hud.setVitals(self.vitals);
    this.hud.setInventory(self.inv);
    this.cleared = self.shrines;
    this.hasPower = self.power;
    this.tame = self.tame;
    this.riding = self.riding;
    this.hasSteed = self.steed;
    if (this.body) this.body.riding = self.riding;
    if (this.body) this.body.staminaMax = staminaFor(self.shrines.length);
    if (self.fix && this.body) {
      Object.assign(this.body, { x: self.x, y: self.y, z: self.z, vx: 0, vz: 0, vy: 0, climb: null, gliding: false });
    }
    if (self.dead && !this.dead) this.showDeath();
    if (!self.dead && this.dead) this.hud.hideOverlay(); // revived by a teammate: close the death panel
    this.dead = self.dead;
    if (self.dead) this.hud.setReviveLeft(self.reviveLeft);
  }

  /** Also re-invoked whenever something (menu toggle, a stray pointer-lock Esc) tries to
   * replace the death panel while still dead: the respawn button must stay reachable. */
  private showDeath(): void {
    this.releaseInputs();
    this.hud.showDeath(() => {
      this.conn.send({ t: 'respawn' });
      this.hud.hideOverlay();
    });
  }

  private releaseInputs(): void {
    clearHold(this.input);
    this.touch?.release();
  }

  // ---------------------------------------------------------------- actions

  private onAction(a: Action): void {
    if (a === 'dismiss') return this.hud.hideVision();
    if (a === 'menu') {
      if (this.dead) return this.showDeath();
      if (this.hud.menuOpen) {
        // A pointer-lock exit and its Escape keydown can both reach us for the same press.
        if (performance.now() - this.lockMenuOpenedAt < ESC_GUARD_MS) return;
        return this.hud.hideOverlay();
      }
      this.releaseInputs();
      if (document.pointerLockElement) document.exitPointerLock();
      return this.hud.showMenu(this.tier, {
        onTier: (t) => {
          saveTier(t);
          location.reload();
        },
        onCamera: () => this.rig.toggle(),
        onLeave: () => this.onLeave(),
      });
    }
    if (this.dead || !this.body || this.hud.menuOpen) return;
    if (a === 'camera') return this.rig.toggle();
    if (a === 'eat') return this.conn.send({ t: 'eat' });
    if (a === 'campfire' || a === 'wall' || a === 'heart' || a === 'spikes') return this.place(a);
    if (a === 'roll') return this.roll();
    if (a === 'lock') return this.toggleLock();
    if (a === 'bow') return this.shoot();
    if (a === 'power') return this.power();
    if (a === 'mount') {
      const ma = this.mountAct();
      if (ma?.act === 1) return this.tapRing();
      if (ma) return this.conn.send({ t: 'mount', act: ma.act });
      return this.hud.toast(this.hasSteed ? 'Tu ciervo no está cerca' : 'Aún no tienes montura');
    }
    this.act();
  }

  // ---------------------------------------------------------------- combat

  /** Live enemies, where the client currently draws them. */
  private enemies(): AimTarget[] {
    const out: AimTarget[] = [];
    for (const [id, w] of this.wolves) {
      if (w.anim === 'dead') continue;
      const p = w.actor.root.position;
      out.push({ id, x: p.x, z: p.z });
    }
    return out;
  }

  /** Protocol yaw of where the camera looks (camera forward is (-sin yaw, -cos yaw)). */
  private aimYaw(): number {
    return this.rig.yaw + Math.PI;
  }

  private roll(): void {
    const now = performance.now();
    if (now < this.rollReadyAt) return;
    this.rollUntil = now + ROLL_MS.dash;
    this.rollReadyAt = now + ROLL_MS.cooldown;
    this.conn.send({ t: 'roll' });
  }

  private toggleLock(): void {
    if (this.lockId !== null) {
      this.lockId = null;
      return;
    }
    const b = this.body!;
    this.lockId = pickTarget(b.x, b.z, this.aimYaw(), this.enemies(), LOCK.range, LOCK.cone) ?? pickTarget(b.x, b.z, b.facing, this.enemies(), LOCK.range, LOCK.cone);
    if (this.lockId === null) this.hud.toast('Nada que fijar');
  }

  private shoot(): void {
    const b = this.body!;
    const now = performance.now();
    if (now < this.bowUntil) return;
    const enemies = this.enemies();
    const locked = this.lockId !== null ? enemies.find((e) => e.id === this.lockId) : undefined;
    const lockOk = locked && Math.hypot(locked.x - b.x, locked.z - b.z) <= BOW.range;
    const id = lockOk ? locked.id : pickTarget(b.x, b.z, this.aimYaw(), enemies, BOW.range, BOW.cone);
    const t = enemies.find((e) => e.id === id);
    if (!t) return this.hud.toast('Nada a tiro');
    this.face(t);
    this.bowUntil = now + BOW.cooldown * 1000;
    this.conn.send({ t: 'shoot', id: t.id });
    const from = new THREE.Vector3(b.x, b.y + 1.3, b.z);
    const to = this.wolves.get(t.id)!.actor.root.position.clone().setY(this.wolves.get(t.id)!.actor.root.position.y + 0.5);
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.position.copy(from);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.arrows.push({ mesh, from, to, t: 0 });
  }

  /** Turn toward a target and tell the server right away: it checks the bow cone against our last yaw. */
  private face(t: AimTarget): void {
    const b = this.body!;
    b.facing = yawTo(b.x, b.z, t.x, t.z);
    this.conn.send({ t: 'move', x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.facing), anim: 'idle' });
  }

  private stepCombat(dt: number): void {
    const b = this.body!;
    if (this.input.block !== this.blockSent && !this.dead) {
      this.blockSent = this.input.block;
      this.conn.send({ t: 'block', on: this.blockSent });
    }
    const enemies = this.enemies();
    if (this.lockId !== null && !keepLock(this.lockId, b.x, b.z, enemies)) this.lockId = null;
    const locked = this.lockId !== null ? enemies.find((e) => e.id === this.lockId) : undefined;
    this.marker.visible = !!locked;
    if (locked) {
      const p = this.wolves.get(locked.id)!.actor.root.position;
      const tall = locked.id === MARCHITO.id ? MARCHITO.height + 0.4 : this.wolves.get(locked.id)!.actor instanceof PaperActor ? 4.9 : 1.6;
      this.marker.position.set(p.x, p.y + tall + Math.sin(performance.now() / 200) * 0.08, p.z);
      // Soft lock: ease the camera so it sits behind us looking at the target.
      const want = yawTo(b.x, b.z, locked.x, locked.z) + Math.PI;
      const diff = Math.atan2(Math.sin(want - this.rig.yaw), Math.cos(want - this.rig.yaw));
      this.rig.yaw += diff * Math.min(1, dt * 4);
    }
    for (const a of this.arrows) {
      a.t += dt;
      a.mesh.position.lerpVectors(a.from, a.to, Math.min(1, a.t / ARROW_TIME));
    }
    this.arrows = this.arrows.filter((a) => {
      if (a.t < ARROW_TIME) return true;
      a.mesh.removeFromParent();
      return false;
    });
  }

  /** The browser eats the Escape keydown that exits pointer lock, so open the menu ourselves
   * when lock is lost mid-game instead of waiting for a keydown that will never arrive. */
  private onPointerLockChange = (): void => {
    if (this.disposed || this.dead || this.hud.menuOpen) return;
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.lockMenuOpenedAt = performance.now();
      this.onAction('menu');
    }
  };

  /** One button does everything: punch the nearest wolf, else gather the nearest resource. */
  private act(): void {
    const b = this.body!;
    const ma = this.mountAct();
    if (ma?.act === 1) return this.tapRing();
    const fallen = this.fallenMate();
    if (fallen) return this.conn.send({ t: 'revive', name: fallen });
    const sp = this.shrinePart();
    if (sp) return this.conn.send({ t: 'shrine', id: sp.id, part: sp.part });
    const da = dungeonAction(b, this.entrance, this.dungeon, this.hasPower);
    if (da) return this.conn.send({ t: 'dungeon', act: da.act });
    this.attackUntil = performance.now() + 450;
    const locked = this.lockId !== null ? this.enemies().find((e) => e.id === this.lockId) : undefined;
    if (locked && Math.hypot(locked.x - b.x, locked.z - b.z) <= PUNCH.reach) {
      this.face(locked);
      return this.conn.send({ t: 'attack', id: locked.id });
    }
    let best: { id: number; d: number } | null = null;
    for (const [id, w] of this.wolves) {
      if (w.anim === 'dead') continue;
      const p = w.actor.root.position;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d <= PUNCH.reach && (!best || d < best.d)) best = { id, d };
    }
    if (best) return this.conn.send({ t: 'attack', id: best.id });
    if (ma) return this.conn.send({ t: 'mount', act: ma.act });
    if (this.canTend()) return this.conn.send({ t: 'tend', id: this.heart!.id });
    const res = this.nearestResource();
    if (res) this.conn.send({ t: 'harvest', id: res.id });
  }

  private mountAct(): { act: number; label: string } | null {
    const b = this.body;
    if (!b || this.dead) return null;
    return mountAction({ pos: b, tame: this.tame, riding: this.riding, hasSteed: this.hasSteed, steeds: this.steeds, me: this.myName });
  }

  /** One tap on the taming ring: the server judges the needle at our estimate of its clock. */
  private tapRing(): void {
    if (!this.tame || this.dead) return;
    this.conn.send({ t: 'mount', act: 1, at: r2(this.serverTime) });
    this.tame = null; // one tap per round: the next snap brings the next round (or nothing)
  }

  /** Nearest teammate lying dead within revive reach (the server re-checks everything). */
  private fallenMate(): string | null {
    const b = this.body!;
    let best: { name: string; d: number } | null = null;
    for (const [name, r] of this.others) {
      if (r.anim !== 'dead') continue;
      const p = r.actor.root.position;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d <= REVIVE.reach && (!best || d < best.d)) best = { name, d };
    }
    return best?.name ?? null;
  }

  /** Lever within reach (part 1/2), or an orb you have not taken yet (part 0). The server re-checks. */
  private shrinePart(): { id: number; part: number; open: boolean } | null {
    const b = this.body!;
    for (const s of this.shrines) {
      const open = this.shrineViews.find((v) => v.id === s.id)?.open ?? false;
      if (s.kind === 'levers') {
        const i = s.parts.findIndex((p) => Math.hypot(p.x - b.x, p.z - b.z) <= SHRINE.partReach);
        if (i >= 0) return { id: s.id, part: i + 1, open };
      }
      if (this.cleared.includes(s.id)) continue;
      const reach = s.pillar ? s.pillar.r : SHRINE.orbReach;
      if (Math.hypot(s.orb.x - b.x, s.orb.z - b.z) <= reach && b.y >= s.orb.y - 2.5) return { id: s.id, part: 0, open };
    }
    return null;
  }

  /** A bare shrine rock beside us, if any (Enredadera wraps it instead of growing a new vine). */
  private bareRockNear(): Crag | undefined {
    const b = this.body!;
    return this.climbList.find((c) => c.bare && Math.hypot(c.x - b.x, c.z - b.z) < c.r + 3);
  }

  private power(): void {
    const b = this.body!;
    const rock = this.bareRockNear();
    const x = rock ? rock.x : b.x + Math.sin(b.facing) * 2.5;
    const z = rock ? rock.z : b.z + Math.cos(b.facing) * 2.5;
    this.conn.send({ t: 'power', x: r2(x), z: r2(z) });
  }

  private canTend(): boolean {
    const h = this.heart;
    const s = h && this.structures.position(h.id);
    return !!h && !!s && h.hp < h.max && Math.hypot(s.x - this.body!.x, s.z - this.body!.z) <= HEART.tendReach;
  }

  private nearestResource(): ResourceSpawn | null {
    const b = this.body!;
    let best: ResourceSpawn | null = null;
    let bestD = Infinity;
    for (const s of this.spawns) {
      if (this.gone.has(s.id) || Math.abs(s.x - b.x) > 6 || Math.abs(s.z - b.z) > 6) continue;
      const d = Math.hypot(s.x - b.x, s.z - b.z) - s.radius;
      if (d <= REACH && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private place(kind: StructureKind): void {
    const b = this.body!;
    const x = b.x + Math.sin(b.facing) * 2.5;
    const z = b.z + Math.cos(b.facing) * 2.5;
    this.conn.send({ t: 'place', kind, x: r2(x), z: r2(z), rot: r2(b.facing) });
  }

  // ---------------------------------------------------------------- frame

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const b = this.body;
    const terrain = this.terrain;
    if (!b || !terrain) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.serverTime += dt;

    const now = performance.now();
    const rolling = now < this.rollUntil;
    const blocking = this.input.block && !rolling;
    const jumpEdge = this.input.jump && !this.jumpWasHeld;
    this.jumpWasHeld = this.input.jump;
    if (this.tame && jumpEdge && !this.hud.menuOpen) this.tapRing();
    let mv = this.dead || this.hud.menuOpen || this.tame ? IDLE_INPUT : readMove(this.input);
    if (!this.dead && rolling) mv = rollInput(b.facing, this.rig.yaw);
    else if (blocking) mv = { x: mv.x * 0.5, z: mv.z * 0.5, sprint: false, jump: false };
    const res = stepBody(b, mv, this.rig.yaw, dt, terrain, (x, z) => this.colliders.near(x, z), this.climbList, (px, pz, nx, nz) => clampStep(px, pz, nx, nz, this.dungeon.gate));
    this.hud.setStamina(b.stamina / b.staminaMax, b.tired);
    let anim: Anim | 'dead' = animFor(res, b);
    if (blocking) anim = 'block';
    if (now < this.attackUntil) anim = 'attack';
    if (now < this.bowUntil - BOW.cooldown * 1000 + 500) anim = 'bow';
    if (rolling) anim = 'roll';
    if (this.riding || this.tame) anim = 'idle';
    if (this.dead) anim = 'dead';
    this.stepCombat(dt);

    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && !this.dead) {
      this.sendTimer = 0.1;
      const msg = { t: 'move' as const, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.facing), anim: anim as Anim };
      const key = JSON.stringify(msg);
      // ponytail: skip unchanged moves to save free-tier requests. The 1 Hz resend keeps the server's speed check window fresh.
      if (key !== this.lastSent || Math.random() < 0.1) {
        this.conn.send(msg);
        this.lastSent = key;
      }
    }

    if (!this.me && this.kits) {
      this.me = new Actor(this.kits.robot, PLAYER_CLIPS);
      this.scene.add(this.me.root);
    }
    const wild = this.steeds.find((s) => s.owner === null);
    if (this.me) {
      if (this.tame && wild) this.me.setPose(wild.x, wild.y + MOUNT.height, wild.z, wild.yaw);
      else this.me.setPose(b.x, b.y + (this.riding ? MOUNT.height : 0), b.z, b.facing);
      this.me.play(anim);
      this.me.update(dt);
      this.me.root.visible = this.rig.mode === 'third';
    }

    const rt = this.serverTime - INTERP_DELAY;
    for (const r of this.others.values()) this.animateRemote(r, rt, dt);
    for (const r of this.wolves.values()) {
      this.animateRemote(r, rt, dt);
      if (!(r.actor instanceof PaperActor)) r.actor.root.rotation.z = r.anim === 'dead' ? Math.PI / 2 : 0; // fox has no death clip: tip it over
    }
    for (const r of this.allies.values()) this.animateRemote(r, rt, dt);
    this.syncSteeds(dt, wild);

    const focus = new THREE.Vector3(b.x, b.y, b.z);
    this.light.update(dayFraction(this.serverTime), focus, this.raid ? (this.raid.phase === 'active' ? 0.55 : 0.3) : 0);
    this.hud.setRaid(raidText(this.raid, this.rig.yaw));
    this.structures.animate(performance.now() / 1000);
    this.shrineMeshes?.animate(performance.now() / 1000);
    this.dungeonMeshes?.animate(performance.now() / 1000);
    this.rig.apply(this.camera, b, terrain);
    if (this.tame) {
      // The deer bucks: shake the camera a little.
      const k = 0.06 + this.tame.round * 0.03;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.hud.setRing(this.tame ? { needle: ringNeedle(this.tame, this.serverTime), zone: this.tame.zone, width: this.tame.width, round: this.tame.round, rounds: this.tame.rounds } : null);
    this.updatePrompt();
    this.renderer.render(this.scene, this.camera);
  }

  /** Parked and wild deer from the snapshot, plus one under every rider (us included). */
  private syncSteeds(dt: number, wild: SteedView | undefined): void {
    const b = this.body!;
    const poses: SteedPose[] = [];
    for (const s of this.steeds) poses.push({ key: s.owner ?? '~wild', x: s.x, y: s.y, z: s.z, yaw: s.yaw, speed: 0, wild: s.owner === null, bucking: s.owner === null && !!this.tame && s === wild });
    if (this.riding) poses.push({ key: `ride:${this.myName}`, x: b.x, y: b.y, z: b.z, yaw: b.facing, speed: Math.hypot(b.vx, b.vz), wild: false, bucking: false });
    for (const [name, r] of this.others) {
      if (!r.ride) continue;
      const p = r.actor.root.position;
      poses.push({ key: `ride:${name}`, x: p.x, y: p.y - MOUNT.height, z: p.z, yaw: r.actor.root.rotation.y, speed: r.speed, wild: false, bucking: false });
    }
    this.steedMeshes?.sync(poses, dt, performance.now() / 1000);
  }

  private animateRemote(r: Remote, rt: number, dt: number): void {
    const s = r.buf.at(rt);
    if (s) {
      const before = r.actor.root.position.clone();
      r.actor.setPose(s.x, s.y + (r.ride ? MOUNT.height : 0), s.z, s.yaw);
      r.speed = dt > 0 ? Math.hypot(r.actor.root.position.x - before.x, r.actor.root.position.z - before.z) / dt : 0;
    }
    r.actor.play(r.anim);
    r.actor.update(dt);
  }

  private updatePrompt(): void {
    if (this.touch || this.dead) return this.hud.setPrompt(null);
    const fallen = this.body && this.fallenMate();
    if (fallen) return this.hud.setPrompt(`E · Levantar a ${fallen}`);
    const ma = this.mountAct();
    if (ma?.act === 1) return this.hud.setPrompt('E · ¡Ahora! (cuando la aguja cruce la zona)');
    if (this.lockId !== null) return this.hud.setPrompt('X · Soltar objetivo');
    if (this.body && this.canTend()) return this.hud.setPrompt('E · Cuidar el Corazón (5 bayas)');
    const sp = this.body && this.shrinePart();
    if (sp) return this.hud.setPrompt(sp.part > 0 ? 'E · Tirar de la palanca' : sp.open ? 'E · Tomar el orbe' : 'La verja está cerrada');
    const da = this.body && dungeonAction(this.body, this.entrance, this.dungeon, this.hasPower);
    if (da) return this.hud.setPrompt(`E · ${da.label}`);
    if (ma) return this.hud.setPrompt(ma.act === 3 ? 'E / M · Bajar del ciervo' : `E · ${ma.label}`);
    const b = this.body;
    if (b?.climb) return this.hud.setPrompt('Espacio · Saltar');
    if (b?.gliding) return this.hud.setPrompt('Espacio · Cerrar planeador');
    const res = this.nearestResource();
    if (res) return this.hud.setPrompt(`E · ${HARVEST[res.kind].label}`);
    const wall = b && b.onGround ? cragsNear(this.climbList, b.x, b.z, 1).find((c) => b.y < c.top - 0.6) : undefined;
    if (wall?.bare) return this.hud.setPrompt(this.hasPower ? 'H · Enredadera: cubrir la roca' : 'Roca lisa: no hay agarre');
    this.hud.setPrompt(wall ? (b!.tired ? 'Sin aliento' : 'Empuja contra la roca para trepar') : null);
  }

  // ---------------------------------------------------------------- desktop mouse

  private onClick = (): void => {
    if (this.hud.menuOpen) return;
    if (document.pointerLockElement !== this.renderer.domElement) {
      void this.renderer.domElement.requestPointerLock();
      return;
    }
    this.onAction('act');
  };

  private onMouse = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.renderer.domElement) this.rig.look(e.movementX, e.movementY);
  };

  private onResize = (): void => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };
}
