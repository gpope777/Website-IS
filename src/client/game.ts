import * as THREE from 'three';
import { HARVEST, generateResources, type ResourceSpawn } from '../shared/resources';
import { createTerrain, type Terrain } from '../shared/terrain';
import { PROTOCOL_VERSION, r2, type Anim, type HeartView, type RaidView, type ServerMsg, type Structure } from '../shared/protocol';
import { dayFraction, HEART, PUNCH, REACH } from '../shared/sim/world-sim';
import type { StructureKind } from '../shared/items';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import { loadModels, type ModelKit } from './actors/models';
import { CameraRig } from './camera-rig';
import { ColliderGrid } from './colliders';
import { Hud } from './hud';
import { raidText } from './raid-ui';
import { clearHold, Keyboard, readMove, type Action, type InputState, KEY_ACTIONS } from './input';
import { InterpBuffer, INTERP_DELAY } from './interp';
import type { JoinInfo } from './join';
import { animFor, createBody, stepBody, type Body } from './movement';
import { Connection, wsUrl, type NetStatus } from './net';
import { loadTier, saveTier, TIERS, type Tier } from './quality';
import { DayLight } from './scene/sky';
import { StructureMeshes } from './scene/structures';
import { buildTerrainMesh, buildWater } from './scene/terrain-mesh';
import { buildGrass, ResourceMeshes } from './scene/vegetation';
import { TouchControls, isTouchDevice } from './touch';

interface Remote {
  actor: Actor;
  buf: InterpBuffer;
  anim: string;
  seen: number;
}

const IDLE_INPUT = { x: 0, z: 0, sprint: false, jump: false };

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
  private readonly others = new Map<string, Remote>();
  private readonly wolves = new Map<number, Remote>();
  private readonly gone = new Set<number>();
  private light: DayLight;
  private kits: { robot: ModelKit; fox: ModelKit } | null = null;
  private seed: number | null = null;
  private terrain: Terrain | null = null;
  private spawns: ResourceSpawn[] = [];
  private resMeshes: ResourceMeshes | null = null;
  private body: Body | null = null;
  private me: Actor | null = null;
  private myName = '';
  private serverTime = 0;
  private dead = false;
  private heart: HeartView | null = null;
  private raid: RaidView | null = null;
  private attackUntil = 0;
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
    this.scene.add(this.structures.group);

    this.hud = new Hud(root);
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
    this.terrain = createTerrain(seed);
    this.spawns = generateResources(this.terrain, seed);
    this.resMeshes = new ResourceMeshes(this.spawns, t.shadows);
    this.scene.add(buildTerrainMesh(this.terrain, t.terrainSegments), buildWater(), buildGrass(this.terrain, t.grass, seed), this.resMeshes.group);
    for (const s of this.spawns) if (s.kind !== 'bush') this.colliders.add(`r${s.id}`, { x: s.x, z: s.z, r: s.radius });
  }

  private setGone(id: number, gone: boolean): void {
    const s = this.spawns[id];
    if (!s || this.gone.has(id) === gone) return;
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
    if (!this.kits) return;
    for (const p of m.players) {
      const r = this.remote(this.others, p.name, () => new Actor(this.kits!.robot, PLAYER_CLIPS, p.name));
      r.buf.push({ t: m.time, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      r.anim = p.dead ? 'dead' : p.away ? 'idle' : p.anim;
      r.seen = m.time;
    }
    for (const w of m.wolves) {
      const r = this.remote(this.wolves, w.id, () => new Actor(this.kits!.fox, WOLF_CLIPS));
      r.actor.root.scale.setScalar(w.raid ? 1.3 : 1);
      r.buf.push({ t: m.time, x: w.x, y: w.y, z: w.z, yaw: w.yaw });
      r.anim = w.anim;
      r.seen = m.time;
    }
    for (const map of [this.others, this.wolves] as Map<unknown, Remote>[]) {
      for (const [k, r] of map) {
        if (r.seen === m.time) continue;
        r.actor.dispose();
        map.delete(k);
      }
    }
  }

  private remote<K>(map: Map<K, Remote>, key: K, make: () => Actor): Remote {
    let r = map.get(key);
    if (!r) {
      r = { actor: make(), buf: new InterpBuffer(), anim: 'idle', seen: 0 };
      this.scene.add(r.actor.root);
      map.set(key, r);
    }
    return r;
  }

  private applySelf(self: Extract<ServerMsg, { t: 'snap' }>['self']): void {
    this.hud.setVitals(self.vitals);
    this.hud.setInventory(self.inv);
    if (self.fix && this.body) {
      Object.assign(this.body, { x: self.x, y: self.y, z: self.z, vx: 0, vz: 0, vy: 0 });
    }
    if (self.dead && !this.dead) this.showDeath();
    this.dead = self.dead;
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
    this.act();
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
    this.attackUntil = performance.now() + 450;
    let best: { id: number; d: number } | null = null;
    for (const [id, w] of this.wolves) {
      if (w.anim === 'dead') continue;
      const p = w.actor.root.position;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d <= PUNCH.reach && (!best || d < best.d)) best = { id, d };
    }
    if (best) return this.conn.send({ t: 'attack', id: best.id });
    if (this.canTend()) return this.conn.send({ t: 'tend', id: this.heart!.id });
    const res = this.nearestResource();
    if (res) this.conn.send({ t: 'harvest', id: res.id });
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

    const mv = this.dead || this.hud.menuOpen ? IDLE_INPUT : readMove(this.input);
    const res = stepBody(b, mv, this.rig.yaw, dt, terrain, (x, z) => this.colliders.near(x, z));
    let anim: Anim | 'dead' = animFor(res, b);
    if (performance.now() < this.attackUntil) anim = 'attack';
    if (this.dead) anim = 'dead';

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
    if (this.me) {
      this.me.setPose(b.x, b.y, b.z, b.facing);
      this.me.play(anim);
      this.me.update(dt);
      this.me.root.visible = this.rig.mode === 'third';
    }

    const rt = this.serverTime - INTERP_DELAY;
    for (const r of this.others.values()) this.animateRemote(r, rt, dt);
    for (const r of this.wolves.values()) {
      this.animateRemote(r, rt, dt);
      r.actor.root.rotation.z = r.anim === 'dead' ? Math.PI / 2 : 0; // fox has no death clip: tip it over
    }

    const focus = new THREE.Vector3(b.x, b.y, b.z);
    this.light.update(dayFraction(this.serverTime), focus, this.raid ? (this.raid.phase === 'active' ? 0.55 : 0.3) : 0);
    this.hud.setRaid(raidText(this.raid, this.rig.yaw));
    this.structures.animate(performance.now() / 1000);
    this.rig.apply(this.camera, b, terrain);
    this.updatePrompt();
    this.renderer.render(this.scene, this.camera);
  }

  private animateRemote(r: Remote, rt: number, dt: number): void {
    const s = r.buf.at(rt);
    if (s) r.actor.setPose(s.x, s.y, s.z, s.yaw);
    r.actor.play(r.anim);
    r.actor.update(dt);
  }

  private updatePrompt(): void {
    if (this.touch || this.dead) return this.hud.setPrompt(null);
    if (this.body && this.canTend()) return this.hud.setPrompt('E · Cuidar el Corazón (5 bayas)');
    const res = this.nearestResource();
    this.hud.setPrompt(res ? `E · ${HARVEST[res.kind].label}` : null);
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
