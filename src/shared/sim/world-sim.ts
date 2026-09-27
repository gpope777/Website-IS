import { createRng } from '../rng';
import { createTerrain, HALF, WATER_LEVEL, type Terrain } from '../terrain';
import { generateResources, HARVEST, type ResourceSpawn } from '../resources';
import { cragsNear, generateCrags, type Crag } from '../crags';
import { ENREDADERA, planVine } from '../enredadera';
import { generateShrines, SHRINE, SHRINE_LABELS, type Shrine } from '../shrines';
import { addItem, BUILD_COST, type ItemId, count, STRUCTURE_HP, TEND_COST, TEND_HEAL, hasAll, removeAll, type Inventory, type StructureKind } from '../items';
import { createVitals, damage, eatBerry, isNight, RESPAWN_VITALS, tickVitals, type Vitals } from '../survival';
import { r2, type Anim, type ClientMsg, type GraveView, type PlayerView, type SelfState, type ShrineView, type ServerMsg, type Structure, type WolfView } from '../protocol';
import { BLOCK, BOW, inCone, newGuard, resolveHit, ROLL, type Guard } from './combat';
import { createWolf, ENEMY, ENEMY_LABELS, hitWolf, RAID, raiderDamage, stepRaider, stepWolf, WOLF, type EnemyKind, type RaidGoal, type Wolf, type WolfTarget } from './wolves';

export const DAY_LENGTH = 6 * 60;
export const TICK_DT = 0.1;
export const VIEW_RADIUS = 100;
export const MAX_SPEED = 9;
/** Within this many metres of a crag's side, moves may be as high as its top + 3 m (climbing, jumping off the top). */
export const CLIMB_PAD = 4;
/** Cap on the re-anchor allowance window, so idling still bounds the accepted jump distance. */
const MAX_ANCHOR_WINDOW = 2;
export const REACH = 3.5;
export const BUILD_REACH = 6;
export const FIRE_RADIUS = 4;
export const AWAY_TIMEOUT = 30;
export const MAX_STRUCTURES = 500;
export const MAX_ONLINE = 8;
export const PUNCH = { damage: 20, cooldown: 0.6, reach: 3 } as const;
export const HARVEST_COOLDOWN = 0.4;
export const HEART = { warmRadius: 8, tendReach: 4 } as const;
export const SPIKES = { radius: 1.3, dps: 25, wear: 4 } as const;
/** Graves: owner-only pickup by standing on one; the world keeps at most `max`. */
export const GRAVE = { pickup: 2, max: 50 } as const;
/** Co-op revive: seconds a teammate has, reach, health on getting up, minimum hunger/warmth. */
export const REVIVE = { window: 30, reach: 2.5, health: 40, floor: 30 } as const;
// Tolerance for float drift in this.time, which accumulates 0.1s ticks in floating point.
const EPS = 1e-6;

const BUILT_TEXT: Record<StructureKind, string> = { campfire: 'Fogata encendida', wall: 'Muro levantado', heart: 'El Corazón del Bosque echó raíces', spikes: 'Estacas clavadas' };

export interface SavedPlayer {
  name: string;
  pinHash: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vitals: Vitals;
  inv: Inventory;
  dead: boolean;
  /** Shrine ids cleared (one orb each). Optional: older saves have none. */
  shrines?: number[];
}

export interface SavedWorld {
  version: 1;
  seed: number;
  salt: string;
  time: number;
  nextStructureId: number;
  structures: Structure[];
  /** Only resources that are partly or fully harvested. */
  resources: Record<string, { uses: number; regrow: number }>;
  players: SavedPlayer[];
  raidLevel?: number;
  graves?: Grave[];
}

export interface Grave extends GraveView {
  inv: Inventory;
}

export interface Outgoing {
  /** null = everyone connected */
  to: string | null;
  msg: ServerMsg;
}

interface Live {
  anim: Anim;
  awayFor: number | null;
  anchorX: number;
  anchorZ: number;
  anchorAt: number;
  /** Sim time of the last move accepted for this player (used to re-anchor after a stall). */
  lastAcceptedAt: number;
  harvestReadyAt: number;
  punchReadyAt: number;
  fix: boolean;
  /** Live-only combat state (roll i-frames, guard, bow cooldown). Never saved. */
  guard: Guard;
  /** Sim time Enredadera can be cast again. Live-only. */
  powerReadyAt: number;
  /** Sim time of death; null when alive or after a reconnect (no revive then). Never saved. */
  deadAt: number | null;
}

export function newWorld(seed: number, salt: string): SavedWorld {
  return { version: 1, seed, salt, time: DAY_LENGTH * 0.33, nextStructureId: 1, structures: [], resources: {}, players: [], raidLevel: 0 };
}

export function dayFraction(time: number): number {
  return (time % DAY_LENGTH) / DAY_LENGTH;
}

export class WorldSim {
  readonly seed: number;
  readonly salt: string;
  readonly terrain: Terrain;
  readonly crags: readonly Crag[];
  readonly resources: ResourceSpawn[];
  readonly shrines: readonly Shrine[];
  time: number;
  /** Live-only puzzle state, one per shrine: lever pull times, open-until, plate pressed. */
  private readonly shrineLive: { pulled: (number | null)[]; openUntil: number; pressed: boolean }[];
  private readonly players = new Map<string, SavedPlayer>();
  private readonly live = new Map<string, Live>();
  private readonly resState = new Map<number, { uses: number; regrow: number }>();
  private readonly structures: Structure[];
  private nextStructureId: number;
  private readonly graves: Grave[];
  private nextGraveId: number;
  raidLevel: number;
  private vines: (Crag & { owner: string; until: number })[] = [];
  private nextVineId: number = ENREDADERA.idBase;
  private regenClock = 0;
  private wolves: Wolf[] = [];
  private nextWolfId = 1;
  private raid: { phase: 'warn' | 'active'; dir: number } | null = null;
  private wasNight = false; // false on load so a night-time load still spawns wolves
  private outbox: Outgoing[] = [];
  private readonly rng: () => number;

  constructor(saved: SavedWorld) {
    this.seed = saved.seed;
    this.salt = saved.salt;
    this.time = saved.time;
    this.terrain = createTerrain(saved.seed);
    this.resources = generateResources(this.terrain, saved.seed);
    this.crags = generateCrags(this.terrain, saved.seed);
    this.shrines = generateShrines(this.terrain, saved.seed, this.crags);
    this.shrineLive = this.shrines.map(() => ({ pulled: [null, null], openUntil: -Infinity, pressed: false }));
    for (const p of saved.players) this.players.set(p.name, structuredClone(p));
    for (const [id, st] of Object.entries(saved.resources)) this.resState.set(Number(id), { ...st });
    this.structures = saved.structures.map((s) => ({ ...s, hp: s.hp ?? STRUCTURE_HP[s.kind] }));
    this.raidLevel = saved.raidLevel ?? 0;
    this.nextStructureId = saved.nextStructureId;
    this.graves = (saved.graves ?? []).map((g) => ({ ...g, inv: { ...g.inv } }));
    this.nextGraveId = 1 + Math.max(0, ...this.graves.map((g) => g.id));
    this.rng = createRng(saved.seed ^ 0x51f15e);
  }

  raidState(): { phase: 'warn' | 'active'; dir: number } | null {
    return this.raid;
  }

  get wolfList(): readonly Wolf[] {
    return this.wolves;
  }

  getPlayer(name: string): SavedPlayer | undefined {
    return this.players.get(name);
  }

  /** Connected or still in the away grace period. */
  onlineNames(): string[] {
    return [...this.live.keys()];
  }

  activeCount(): number {
    let n = 0;
    for (const l of this.live.values()) if (l.awayFor === null) n++;
    return n;
  }

  /** New record at world spawn. The room has already checked the PIN. */
  createPlayer(name: string, pinHash: string): SavedPlayer {
    if (this.players.has(name)) throw new Error(`player exists: ${name}`);
    const p: SavedPlayer = { name, pinHash, x: 0, y: this.terrain.heightAt(0, 0), z: 0, yaw: 0, vitals: createVitals(), inv: {}, dead: false };
    this.players.set(name, p);
    return p;
  }

  connect(name: string): ServerMsg {
    const p = this.players.get(name);
    if (!p) throw new Error(`unknown player ${name}`);
    let l = this.live.get(name);
    if (l) {
      l.awayFor = null;
      l.anchorX = p.x;
      l.anchorZ = p.z;
      l.anchorAt = this.time;
      l.lastAcceptedAt = this.time;
    } else {
      l = { anim: 'idle', awayFor: null, anchorX: p.x, anchorZ: p.z, anchorAt: this.time, lastAcceptedAt: this.time, harvestReadyAt: 0, punchReadyAt: 0, fix: false, guard: newGuard(), deadAt: null, powerReadyAt: 0 };
      this.live.set(name, l);
    }
    const gone = [...this.resState].filter(([, s]) => s.uses === 0).map(([id]) => id);
    return { t: 'welcome', you: name, seed: this.seed, time: this.time, self: this.selfState(p, l), structures: this.structures.map((s) => ({ ...s })), gone };
  }

  markAway(name: string): void {
    const l = this.live.get(name);
    if (!l) return;
    l.awayFor = 0;
    l.anim = 'idle';
    l.guard = newGuard();
  }

  handle(name: string, msg: ClientMsg): void {
    const p = this.players.get(name);
    const l = this.live.get(name);
    if (!p || !l || l.awayFor !== null) return;
    switch (msg.t) {
      case 'move':
        return this.onMove(p, l, msg);
      case 'harvest':
        return this.onHarvest(p, l, msg.id);
      case 'place':
        return this.onPlace(p, msg.kind, msg.x, msg.z, msg.rot);
      case 'attack':
        return this.onAttack(p, l, msg.id);
      case 'eat':
        return this.onEat(p);
      case 'respawn':
        return this.onRespawn(p, l);
      case 'tend':
        return this.onTend(p, msg.id);
      case 'roll':
        return this.onRoll(p, l);
      case 'block':
        return this.onBlock(p, l, msg.on);
      case 'shoot':
        return this.onShoot(p, l, msg.id);
      case 'revive':
        return this.onRevive(p, msg.name);
      case 'shrine':
        return this.onShrine(p, msg.id, msg.part);
      case 'power':
        return this.onPower(p, l, msg.x, msg.z);
      case 'dungeon':
        return; // Plan F Task 2
      case 'hello':
        return; // the room handles hello
    }
  }

  step(dt: number): void {
    this.time += dt;
    const night = isNight(dayFraction(this.time));

    for (const [name, l] of this.live) {
      if (l.awayFor === null) continue;
      l.awayFor += dt;
      if (l.awayFor >= AWAY_TIMEOUT) this.live.delete(name);
    }

    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) continue; // away players are frozen: the world sleeps for them
      p.vitals = tickVitals(p.vitals, { night, nearFire: this.nearFire(p.x, p.z) }, dt);
      if (p.vitals.health <= 0) this.kill(p);
      else this.pickUpGraves(p);
    }

    for (const [id, st] of this.resState) {
      if (st.uses !== 0) continue;
      st.regrow -= dt;
      if (st.regrow <= 0) {
        this.resState.delete(id);
        this.outbox.push({ to: null, msg: { t: 'res', id, gone: false } });
      }
    }

    this.stepShrines();
    this.stepVines(dt);
    this.stepRaid(night);
    if (night && !this.wasNight) this.spawnWolves();
    if (!night && this.wasNight) this.wolves = [];
    this.wasNight = night;

    const targets = this.targets();
    const goal = this.raidGoal();
    for (const w of this.wolves) {
      if (w.raid) {
        if (!goal) continue;
        const hit = stepRaider(w, targets, goal, this.terrain, dt, this.rng);
        if (hit && 'player' in hit) this.bite(hit.player, raiderDamage(w), w);
        else if (hit) this.damageStructure(hit.structure, raiderDamage(w));
        continue;
      }
      const bit = stepWolf(w, targets, this.terrain, dt, this.rng);
      if (bit) this.bite(bit, ENEMY[w.kind].damage, w);
    }
    this.stepSpikes(dt);
    this.wolves = this.wolves.filter((w) => w.deadFor < WOLF.corpseTime);
  }

  snapshotFor(name: string): ServerMsg | null {
    const p = this.players.get(name);
    const l = this.live.get(name);
    if (!p || !l) return null;
    const near = (x: number, z: number) => Math.hypot(x - p.x, z - p.z) <= VIEW_RADIUS;
    const players: PlayerView[] = [];
    for (const [n, ol] of this.live) {
      if (n === name) continue;
      const o = this.players.get(n)!;
      if (!near(o.x, o.z)) continue;
      players.push({ name: n, x: r2(o.x), y: r2(o.y), z: r2(o.z), yaw: r2(o.yaw), anim: ol.anim, away: ol.awayFor !== null, dead: o.dead });
    }
    const wolves: WolfView[] = this.wolves
      .filter((w) => near(w.x, w.z))
      .map((w) => ({ id: w.id, kind: w.kind, x: r2(w.x), y: r2(w.y), z: r2(w.z), yaw: r2(w.yaw), anim: w.anim, raid: w.raid }));
    const h = this.heart();
    const raid = this.raid ? { phase: this.raid.phase, dir: r2(this.raid.dir), level: this.raidLevel } : null;
    const heart = h ? { id: h.id, hp: Math.round(h.hp), max: STRUCTURE_HP.heart } : null;
    const graves = this.graves.map(({ id, owner, x, y, z }) => ({ id, owner, x, y, z }));
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l), raid, heart, graves, vines: this.vines.map(({ id, x, z, r, base, top }) => ({ id, x, z, r, base: r2(base), top: r2(top) })), shrines: this.shrineViews(), dungeon: { gate: false, levers: [false, false], purified: false, boss: null }, ally: null };
  }

  drain(): Outgoing[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  save(): SavedWorld {
    return {
      version: 1,
      seed: this.seed,
      salt: this.salt,
      time: this.time,
      nextStructureId: this.nextStructureId,
      structures: this.structures.map((s) => ({ ...s })),
      resources: Object.fromEntries([...this.resState].map(([id, s]) => [String(id), { ...s }])),
      players: [...this.players.values()].map((p) => structuredClone(p)),
      raidLevel: this.raidLevel,
      graves: this.graves.map((g) => ({ ...g, inv: { ...g.inv } })),
    };
  }

  /** Everything you can climb or stand on: crags, shrine rocks (bare unless wrapped) and live vines. */
  climbables(): Crag[] {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    return [...this.crags, ...bare, ...this.vines];
  }

  heart(): Structure | undefined {
    return this.structures.find((s) => s.kind === 'heart');
  }

  /** Newest campfire the player built, else the Heart, else the world spawn. */
  spawnFor(name: string): { x: number; z: number } {
    const fire = [...this.structures].reverse().find((s) => s.kind === 'campfire' && s.owner === name);
    if (fire) return { x: fire.x + 1.5, z: fire.z };
    const h = this.heart();
    return h ? { x: h.x + 2, z: h.z } : { x: 0, z: 0 };
  }

  // ---------------------------------------------------------------- actions

  private onMove(p: SavedPlayer, l: Live, m: Extract<ClientMsg, { t: 'move' }>): void {
    if (p.dead) return;
    // Re-anchor at most once per second to the last accepted position, so flooding many moves
    // within one tick can't inflate the allowed travel distance. The anchor time goes back to
    // the last ACCEPTED move (not "now"), so the allowance covers the elapsed stall — capped at
    // MAX_ANCHOR_WINDOW so idling still bounds the jump (a naive "now" anchor would otherwise
    // shrink the allowance to one tick and snap the player back after any stall or lag spike).
    if (this.time - l.anchorAt > 1) {
      l.anchorX = p.x;
      l.anchorZ = p.z;
      l.anchorAt = Math.max(l.lastAcceptedAt, this.time - MAX_ANCHOR_WINDOW);
    }
    const elapsed = Math.max(this.time - l.anchorAt, TICK_DT);
    const moved = Math.hypot(m.x - l.anchorX, m.z - l.anchorZ);
    const inBounds = Math.abs(m.x) < HALF - 2 && Math.abs(m.z) < HALF - 2;
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL - 0.9);
    const cragCeiling = cragsNear(this.climbables(), m.x, m.z, CLIMB_PAD).reduce((t, c) => Math.max(t, c.top + 3), -Infinity);
    // ponytail: above ground + 4 and away from crags you may only go down (falling or gliding).
    // Hovering at a constant height passes; fine for co-op, add a sink-rate check if it's abused.
    const yOk = m.y > ground - 1 && (m.y < ground + 4 || m.y < cragCeiling || m.y <= p.y);
    // ponytail: speed + bounds sanity check only, no server physics. Fine for co-op; add server-side collision if cheating matters.
    if (!inBounds || !yOk || moved > MAX_SPEED * elapsed + 1) {
      l.fix = true;
      return;
    }
    p.x = m.x;
    p.y = m.y;
    p.z = m.z;
    p.yaw = m.yaw;
    l.anim = m.anim;
    l.lastAcceptedAt = this.time;
  }

  private onHarvest(p: SavedPlayer, l: Live, id: number): void {
    const r = this.resources[id];
    if (!r || p.dead || this.time + EPS < l.harvestReadyAt) return;
    if (Math.hypot(r.x - p.x, r.z - p.z) > REACH + r.radius) return;
    const def = HARVEST[r.kind];
    const st = this.resState.get(id) ?? { uses: def.uses, regrow: 0 };
    if (st.uses <= 0) return;
    st.uses -= 1;
    l.harvestReadyAt = this.time + HARVEST_COOLDOWN;
    p.inv = addItem(p.inv, def.item, def.amount);
    if (st.uses === 0) {
      st.regrow = def.regrow;
      this.outbox.push({ to: null, msg: { t: 'res', id, gone: true } });
    }
    this.resState.set(id, st);
  }

  private onPlace(p: SavedPlayer, kind: StructureKind, x: number, z: number, rot: number): void {
    const toast = (text: string): void => {
      this.outbox.push({ to: p.name, msg: { t: 'toast', text } });
    };
    if (p.dead) return;
    if (!hasAll(p.inv, BUILD_COST[kind])) return toast('Faltan materiales');
    if (kind === 'heart' && this.heart()) return toast('Ya hay un Corazón en este mundo');
    if (Math.hypot(x - p.x, z - p.z) > BUILD_REACH) return toast('Demasiado lejos');
    const y = this.terrain.heightAt(x, z);
    if (y < WATER_LEVEL || Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4) return toast('No se puede construir aquí');
    if (this.structures.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) return toast('Hay algo en el camino');
    if (this.structures.length >= MAX_STRUCTURES) return toast('El mundo ya tiene demasiadas construcciones');
    p.inv = removeAll(p.inv, BUILD_COST[kind]);
    const s: Structure = { id: this.nextStructureId++, kind, x: r2(x), y: r2(y), z: r2(z), rot: r2(rot), owner: p.name, hp: STRUCTURE_HP[kind] };
    this.structures.push(s);
    this.outbox.push({ to: null, msg: { t: 'built', s } });
    toast(BUILT_TEXT[kind]);
  }

  private onAttack(p: SavedPlayer, l: Live, id: number): void {
    const w = this.wolves.find((x) => x.id === id);
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < l.punchReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > PUNCH.reach) return;
    l.punchReadyAt = this.time + PUNCH.cooldown;
    l.anim = 'attack';
    if (hitWolf(w, PUNCH.damage)) this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} derrotó a ${ENEMY_LABELS[w.kind]}` } });
  }

  private onEat(p: SavedPlayer): void {
    if (p.dead || count(p.inv, 'berries') < 1) return;
    p.inv = removeAll(p.inv, { berries: 1 });
    p.vitals = eatBerry(p.vitals);
  }

  private onTend(p: SavedPlayer, id: number): void {
    const h = this.heart();
    if (!h || h.id !== id || p.dead) return;
    if (Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    if (h.hp >= STRUCTURE_HP.heart) return this.tell(p.name, 'El Corazón está sano');
    if (!hasAll(p.inv, TEND_COST)) return this.tell(p.name, 'Necesitas 5 bayas');
    p.inv = removeAll(p.inv, TEND_COST);
    h.hp = Math.min(STRUCTURE_HP.heart, h.hp + TEND_HEAL);
    this.outbox.push({ to: null, msg: { t: 'hit', id: h.id, hp: h.hp } });
    this.tell(p.name, 'El Corazón late con más fuerza');
  }

  private onRoll(p: SavedPlayer, l: Live): void {
    const g = l.guard;
    if (p.dead || this.time + EPS < g.rollReadyAt) return;
    g.rollUntil = this.time + ROLL.iframes;
    g.rollReadyAt = this.time + ROLL.cooldown;
    g.blockSince = null;
    l.anim = 'roll';
  }

  private onBlock(p: SavedPlayer, l: Live, on: boolean): void {
    const g = l.guard;
    if (!on || p.dead) {
      g.blockSince = null;
      return;
    }
    if (g.blockSince !== null) return;
    // A guard raised too soon after the last one blocks but cannot parry: no free parry by spamming.
    g.blockSince = this.time + EPS >= g.blockReadyAt ? this.time : this.time - BLOCK.parryWindow - 1;
    g.blockReadyAt = this.time + BLOCK.rearm;
  }

  private onShoot(p: SavedPlayer, l: Live, id: number): void {
    const w = this.wolves.find((x) => x.id === id);
    const g = l.guard;
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < g.bowReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > BOW.range || !inCone(p.x, p.z, p.yaw, w.x, w.z, BOW.cone)) return;
    g.bowReadyAt = this.time + BOW.cooldown;
    l.anim = 'bow';
    if (hitWolf(w, BOW.damage)) this.say(`${p.name} derrotó a ${ENEMY_LABELS[w.kind]}`);
  }

  private onRevive(p: SavedPlayer, name: string): void {
    const t = this.players.get(name);
    const tl = this.live.get(name);
    if (p.dead || !t || !t.dead || !tl || name === p.name || tl.deadAt === null) return;
    if (Math.hypot(t.x - p.x, t.z - p.z) > REVIVE.reach) return;
    if (this.time - tl.deadAt > REVIVE.window + EPS) return this.tell(p.name, 'Ya es tarde');
    t.dead = false;
    t.vitals = { health: REVIVE.health, hunger: Math.max(t.vitals.hunger, REVIVE.floor), warmth: Math.max(t.vitals.warmth, REVIVE.floor) };
    tl.deadAt = null;
    tl.guard = newGuard();
    tl.anchorX = t.x;
    tl.anchorZ = t.z;
    tl.anchorAt = this.time;
    tl.lastAcceptedAt = this.time;
    this.say(`${p.name} levantó a ${t.name}`);
  }

  private onShrine(p: SavedPlayer, id: number, part: number): void {
    const s = this.shrines[id];
    const st = this.shrineLive[id];
    if (!s || !st || p.dead) return;
    if (part > 0) {
      const lever = s.kind === 'levers' ? s.parts[part - 1] : undefined;
      if (!lever || Math.hypot(lever.x - p.x, lever.z - p.z) > SHRINE.partReach) return;
      st.pulled[part - 1] = this.time;
      const other = st.pulled[2 - part];
      if (other != null && this.time - other <= SHRINE.leverWindow + EPS) {
        st.openUntil = this.time + SHRINE.openFor;
        return this.tell(p.name, 'Algo se abre en el santuario');
      }
      return this.tell(p.name, 'La palanca cede. Falta la otra');
    }
    const cleared = p.shrines ?? [];
    if (cleared.includes(id)) return;
    const reach = s.pillar ? s.pillar.r : SHRINE.orbReach;
    if (Math.hypot(s.orb.x - p.x, s.orb.z - p.z) > reach || p.y < s.orb.y - 2.5) return;
    if (!this.shrineOpen(id)) return this.tell(p.name, 'Una verja de luz lo protege');
    p.shrines = [...cleared, id];
    this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento`);
    if (cleared.length === 0) this.tell(p.name, 'Despierta la Enredadera: H o 🌿 hace crecer una enredadera trepable');
  }

  private onPower(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!(p.shrines ?? []).length) return this.tell(p.name, 'Aún no tienes ese poder');
    if (this.time + EPS < l.powerReadyAt) return this.tell(p.name, `La enredadera aún no brota (${Math.ceil(l.powerReadyAt - this.time - EPS)} s)`);
    if (Math.hypot(x - p.x, z - p.z) > ENREDADERA.reach || Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4) return this.tell(p.name, 'Demasiado lejos');
    const others = this.vines.filter((v) => v.owner !== p.name);
    const wrapped = new Set(others.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    const plan = planVine(this.terrain, [...this.crags, ...others], bare, r2(x), r2(z), this.nextVineId);
    if (!plan) return this.tell(p.name, 'No hay sitio para crecer');
    if (plan.id === this.nextVineId) this.nextVineId++;
    this.vines = [...others, { ...plan, owner: p.name, until: this.time + ENREDADERA.life }];
    l.powerReadyAt = this.time + ENREDADERA.cooldown;
    this.tell(p.name, 'Crece una enredadera');
  }

  /** Vines wither on time; walls near one regrow ("living walls"), reported once a second. */
  private stepVines(dt: number): void {
    this.vines = this.vines.filter((v) => v.until > this.time);
    this.regenClock += dt;
    const report = this.regenClock >= 1 - EPS;
    if (report) this.regenClock = 0;
    if (!this.vines.length) return;
    for (const s of this.structures) {
      if (s.kind !== 'wall' || s.hp >= STRUCTURE_HP.wall) continue;
      if (!this.vines.some((v) => Math.hypot(v.x - s.x, v.z - s.z) <= ENREDADERA.regenRadius)) continue;
      s.hp = Math.min(STRUCTURE_HP.wall, s.hp + ENREDADERA.regen * dt);
      if (report || s.hp === STRUCTURE_HP.wall) this.outbox.push({ to: null, msg: { t: 'hit', id: s.id, hp: Math.round(s.hp) } });
    }
  }

  private shrineOpen(id: number): boolean {
    return this.shrines[id]!.kind === 'ledge' || this.time < this.shrineLive[id]!.openUntil;
  }

  private shrineViews(): ShrineView[] {
    return this.shrines.map((s, id) => {
      const st = this.shrineLive[id]!;
      const open = this.shrineOpen(id);
      const parts = s.kind === 'plate' ? [st.pressed] : s.parts.map((_, i) => st.pulled[i] != null && (open || this.time - st.pulled[i]! <= SHRINE.leverWindow + EPS));
      return { id, open, parts };
    });
  }

  private stepShrines(): void {
    this.shrines.forEach((s, id) => {
      if (s.kind !== 'plate') return;
      const st = this.shrineLive[id]!;
      const plate = s.parts[0]!;
      st.pressed = false;
      for (const [name, l] of this.live) {
        const p = this.players.get(name)!;
        if (p.dead || l.awayFor !== null || Math.hypot(plate.x - p.x, plate.z - p.z) > SHRINE.plateRadius) continue;
        if (Math.abs(p.y - this.terrain.heightAt(plate.x, plate.z)) > 1.5) continue;
        st.pressed = true;
      }
      if (st.pressed) st.openUntil = this.time + SHRINE.plateHold;
    });
  }

  private onRespawn(p: SavedPlayer, l: Live): void {
    if (!p.dead) return;
    this.dropGrave(p);
    l.deadAt = null;
    const sp = this.spawnFor(p.name);
    p.x = sp.x;
    p.z = sp.z;
    p.y = this.terrain.heightAt(sp.x, sp.z);
    p.vitals = { ...RESPAWN_VITALS };
    p.dead = false;
    l.guard = newGuard();
    l.fix = true;
    l.anchorX = p.x;
    l.anchorZ = p.z;
    l.anchorAt = this.time;
    l.lastAcceptedAt = this.time;
  }

  // ---------------------------------------------------------------- helpers

  private selfState(p: SavedPlayer, l: Live): SelfState {
    const fix = l.fix;
    l.fix = false;
    const v = p.vitals;
    return {
      x: r2(p.x),
      y: r2(p.y),
      z: r2(p.z),
      vitals: { health: Math.round(v.health), hunger: Math.round(v.hunger), warmth: Math.round(v.warmth) },
      inv: { ...p.inv },
      dead: p.dead,
      fix,
      reviveLeft: p.dead && l.deadAt !== null ? Math.max(0, Math.ceil(REVIVE.window - (this.time - l.deadAt) - EPS)) : 0,
      shrines: [...(p.shrines ?? [])],
      powerLeft: Math.max(0, Math.ceil(l.powerReadyAt - this.time - EPS)),
      power: (p.shrines ?? []).length > 0,
    };
  }

  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    return this.structures.some((s) => {
      const d = Math.hypot(s.x - x, s.z - z);
      return (s.kind === 'campfire' && d < r) || (s.kind === 'heart' && s.hp > 0 && d < HEART.warmRadius);
    });
  }

  private targets(): WolfTarget[] {
    const out: WolfTarget[] = [];
    for (const [name, l] of this.live) {
      if (l.awayFor !== null) continue;
      const p = this.players.get(name)!;
      out.push({ name, x: p.x, z: p.z, dead: p.dead, fires: this.nearFire(p.x, p.z, WOLF.fearRadius) });
    }
    return out;
  }

  private spawnWolves(): void {
    const anchors = this.targets();
    if (!anchors.length) return;
    for (let i = 0; i < WOLF.count; i++) {
      const a = anchors[i % anchors.length]!;
      for (let tries = 0; tries < 10; tries++) {
        const ang = this.rng() * Math.PI * 2;
        const d = WOLF.spawnMin + this.rng() * (WOLF.spawnMax - WOLF.spawnMin);
        const x = a.x + Math.sin(ang) * d;
        const z = a.z + Math.cos(ang) * d;
        if (Math.abs(x) < HALF - 5 && Math.abs(z) < HALF - 5 && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng));
          break;
        }
      }
    }
  }

  private stepRaid(night: boolean): void {
    const heart = this.heart();
    const f = dayFraction(this.time);
    if (!this.raid && heart && heart.hp > 0 && !night && f >= RAID.warnAt && this.activeCount() > 0) {
      this.raid = { phase: 'warn', dir: this.rng() * Math.PI * 2 };
      this.say('El cielo se tiñe de morado. El Marchito envía a sus bestias: vuelvan al Corazón');
    }
    if (night && !this.wasNight && this.raid?.phase === 'warn' && heart) {
      this.raid.phase = 'active';
      this.spawnRaiders(heart, this.raid.dir);
    }
    if (!night && this.wasNight && this.raid) {
      this.raid = null;
      if (heart && heart.hp > 0) {
        this.raidLevel++;
        this.say(`Sobrevivieron la noche. Nivel de asedio ${this.raidLevel}`);
      }
    }
  }

  private spawnRaiders(heart: Structure, dir: number): void {
    const extra = Math.max(0, this.activeCount() - 1);
    const n = Math.min(RAID.maxWave, RAID.base + RAID.perLevel * this.raidLevel + RAID.perPlayer * extra);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const ang = dir + (this.rng() - 0.5) * 0.8;
        const d = RAID.spawnMin + this.rng() * (RAID.spawnMax - RAID.spawnMin);
        const x = heart.x + Math.sin(ang) * d;
        const z = heart.z + Math.cos(ang) * d;
        if (Math.abs(x) < HALF - 5 && Math.abs(z) < HALF - 5 && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          const kind: EnemyKind = this.raidLevel >= 1 && i % 3 === 2 ? 'brute' : 'wolf';
          const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, kind);
          w.raid = true;
          this.wolves.push(w);
          break;
        }
      }
    }
  }

  private raidGoal(): RaidGoal | null {
    const h = this.heart();
    if (!h || this.raid?.phase !== 'active') return null;
    const blockers = this.structures
      .filter((s) => s.kind === 'wall')
      .flatMap((s) => [-1, 0, 1].map((o) => ({ id: s.id, x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o })));
    return { heartId: h.id, x: h.x, z: h.z, blockers };
  }

  private damageStructure(id: number, dmg: number): void {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return;
    s.hp = Math.max(0, s.hp - dmg);
    if (s.kind !== 'heart' && s.hp === 0) return this.wreck(s);
    this.outbox.push({ to: null, msg: { t: 'hit', id, hp: Math.round(s.hp) } });
    if (s.kind === 'heart' && s.hp === 0) {
      this.say('El Corazón del Bosque se marchitó. Cuídenlo con bayas');
      this.raid = null;
      this.wolves = this.wolves.filter((w) => !w.raid);
    }
  }

  private wreck(s: Structure): void {
    this.structures.splice(this.structures.indexOf(s), 1);
    this.outbox.push({ to: null, msg: { t: 'wrecked', id: s.id } });
  }

  private stepSpikes(dt: number): void {
    for (const s of this.structures.filter((x) => x.kind === 'spikes')) {
      for (const w of this.wolves) {
        if (w.hp <= 0 || Math.hypot(w.x - s.x, w.z - s.z) > SPIKES.radius) continue;
        hitWolf(w, SPIKES.dps * dt);
        s.hp -= SPIKES.wear * dt;
      }
      if (s.hp <= 0) this.wreck(s);
    }
  }

  private bite(name: string, dmg: number, w: Wolf): void {
    const p = this.players.get(name);
    if (!p) return;
    const l = this.live.get(name);
    const out = l ? resolveHit(l.guard, this.time, dmg) : { kind: 'hit' as const, dmg };
    if (out.kind === 'dodged') return;
    if (out.kind === 'parried') {
      w.stun = BLOCK.parryStun;
      if (hitWolf(w, BLOCK.parryDamage)) this.say(`${name} derrotó a ${ENEMY_LABELS[w.kind]}`);
      return this.tell(name, 'Parada');
    }
    p.vitals = damage(p.vitals, out.dmg);
    if (p.vitals.health <= 0) this.kill(p);
  }

  private dropGrave(p: SavedPlayer): void {
    if (!Object.values(p.inv).some((n) => (n ?? 0) > 0)) return;
    this.graves.push({ id: this.nextGraveId++, owner: p.name, x: r2(p.x), y: r2(p.y), z: r2(p.z), inv: p.inv });
    if (this.graves.length > GRAVE.max) this.graves.shift();
    p.inv = {};
    this.tell(p.name, 'Tus cosas quedaron en una tumba donde caíste');
  }

  private pickUpGraves(p: SavedPlayer): void {
    for (const g of this.graves.filter((x) => x.owner === p.name && Math.hypot(x.x - p.x, x.z - p.z) <= GRAVE.pickup)) {
      for (const [item, n] of Object.entries(g.inv) as [ItemId, number][]) p.inv = addItem(p.inv, item, n);
      this.graves.splice(this.graves.indexOf(g), 1);
      this.tell(p.name, 'Recuperaste tus cosas');
    }
  }

  private say(text: string): void {
    this.outbox.push({ to: null, msg: { t: 'toast', text } });
  }

  private tell(name: string, text: string): void {
    this.outbox.push({ to: name, msg: { t: 'toast', text } });
  }

  private kill(p: SavedPlayer): void {
    if (p.dead) return;
    p.dead = true;
    p.vitals = { ...p.vitals, health: 0 };
    const l = this.live.get(p.name);
    if (l) l.deadAt = this.time;
    this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} ha caído` } });
  }
}
