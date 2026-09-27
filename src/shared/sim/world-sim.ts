import { NAMES } from '../names';
import { CIENAGA, deepStepOk, depthAt, inCienaga } from '../coast';
import { createRng } from '../rng';
import { clampMap, coastFeatures, createTerrain, type Islet, inForest, inMap, WATER_LEVEL, type Terrain } from '../terrain';
import { generateResources, HARVEST, type ResourceSpawn } from '../resources';
import { cragsNear, generateCrags, type Crag } from '../crags';
import { ENREDADERA, planVine } from '../enredadera';
import { allZones, coastRaidBrutes, COAST_ZONES, CORRUPTION, isCoastZone, nearestZone, raidDirFrom, zoneAt, type Zone } from '../corruption';
import { clampStep, DUNGEON, generateEntrance, inBossRoom, inDungeon, inEliteRoom, inside, leverPos, withDungeon } from '../dungeon';
import { createElite, ELITE, stepElite, type Elite } from './elite';
import { generateWild, inZone, MOUNT, ringAngle } from '../mount';
import { FISH, fishFloor, fishRings, fishStepOk, wildFish } from '../fish';
import { canTame, WHALE, whaleWidth, wildWhale } from '../whale';
import { generateShrines, SHRINE, SHRINE_LABELS, type Shrine } from '../shrines';
import { CHEST, COAST_SHRINE, generateChests, generateCoastShrines, type Chest } from '../coast-shrines';
import { addItem, ITEM_LABELS, BUILD_COST, type ItemId, count, STRUCTURE_HP, TEND_COST, TEND_HEAL, UPGRADE, weaponMult, hasAll, removeAll, type Inventory, type StructureKind } from '../items';
import { createVitals, damage, eatBerry, isNight, RESPAWN_VITALS, tickVitals, type Vitals } from '../survival';
import { r2, type Anim, type ClientMsg, type DungeonView, type GraveView, type PlayerView, type SelfState, type ShrineView, type ServerMsg, type SteedView, type Structure, type WhaleView, type WolfView } from '../protocol';
import { ALLY, createAlly, stepAlly, type Ally } from './ally';
import { BOSS, createBoss, stepBoss, type Boss } from './boss';
import { createMarchito, joinNames, MARCHITO, marchitoWill, pickDefenses, stepMarchito, VISION, type Marchito } from './marchito';
import { BLOCK, BOW, inCone, newGuard, resolveHit, ROLL, type Guard } from './combat';
import { createWolf, ENEMY, ENEMY_LABELS, hitWolf, RAID, raiderDamage, stepRaider, stepWolf, WOLF, type EnemyKind, type RaidGoal, type Wolf, type WolfTarget } from './wolves';

export const DAY_LENGTH = 6 * 60;
export const TICK_DT = 0.1;
export const VIEW_RADIUS = 100;
export const MAX_SPEED = 9;
/** Seconds between repeated rule toasts (mud, current). */
const HINT_EVERY = 4;
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
/** Spikes hurt and slow what stands on them (`slowFor` s after each touch, SLOWED × speed). */
export const SPIKES = { radius: 1.8, dps: 40, wear: 4, slowFor: 0.5 } as const;
/** Red de raíces: catches a raider within `radius`, holds it `hold` s, then needs `rearm` s; each catch costs `wear` HP. */
export const NET = { radius: 1.6, hold: 3, rearm: 5, wear: 15 } as const;
/** Graves: owner-only pickup by standing on one; the world keeps at most `max`. */
export const GRAVE = { pickup: 2, max: 50 } as const;
/** Co-op revive: seconds a teammate has, reach, health on getting up, minimum hunger/warmth. */
export const REVIVE = { window: 30, reach: 2.5, health: 40, floor: 30 } as const;
// Tolerance for float drift in this.time, which accumulates 0.1s ticks in floating point.
const EPS = 1e-6;

const BUILT_TEXT: Record<StructureKind, string> = { campfire: 'Fogata encendida', wall: 'Muro levantado', heart: `El ${NAMES.heart} echó raíces`, spikes: 'Estacas clavadas', roots: 'Red de raíces tendida' };

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
  /** Has Enredadera (dungeon altar). Optional: older saves have none (see the constructor migration). */
  enredadera?: boolean;
  /** Tamed deer and where it is parked. Optional: older saves have none. */
  steed?: { x: number; z: number };
  /** Tamed giant fish and where it waits. Optional: older saves have none. */
  fish?: { x: number; z: number };
  /** Sunken chest ids opened. Optional: older saves have none. */
  chests?: number[];
  /** Weapon upgrade level 0–3. Optional: older saves have none. */
  weaponLvl?: number;
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
  /** The dungeon boss was beaten and now guards the Heart. Optional: older saves have none. */
  purified?: boolean;
  /** El Marchito's first invasion: owed (the Tragón fell) or already happened. Optional: older saves have none. */
  invasion?: 'pending' | 'done';
  /** Corruption zones cleansed so far (ids from generateZones). Optional: older saves have none. */
  cleansed?: number[];
  /** La Ballena, once tamed (it belongs to the world): where it floats. Optional: older saves have a wild one. */
  whale?: { x: number; z: number; yaw: number };
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
  /** Taming round in progress (live-only). `start` and `zone` are rounded as the client sees them. */
  tame: { round: number; start: number; zone: number; beast: 'deer' | 'fish'; ax: number; az: number } | null;
  /** Sim time the deer lets you try again. */
  tameReadyAt: number;
  /** On the deer. Live-only: a reconnect starts on foot beside it. */
  riding: boolean;
  /** Sim time the rider speed cap still applies after getting off (lag grace). */
  rodeUntil: number;
  /** The speed cap during that grace (the deer's or the fish's). */
  graceCap: number;
  /** Next time a repeated rule toast may show. */
  hintAt: number;
  /** Sitting behind this rider (live only: the deer carries two). */
  seat: string | null;
  /** The fish's ring race in progress (live-only). */
  race: { i: number; deadline: number } | null;
  /** Sim time the wild fish lets you race again. */
  raceReadyAt: number;
  /** On the giant fish (live-only, like `riding`). */
  fish: boolean;
}

const roundsOf = (beast: 'deer' | 'fish') => (beast === 'fish' ? FISH.rounds : MOUNT.rounds);

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
  /** Sunken chests on the deep seabed (seeded; one each per player). */
  readonly chests: readonly Chest[];
  /** The Raíz-madre's trunk in the world (the dungeon entrance). */
  readonly entrance: { x: number; y: number; z: number };
  /** Where the wild deer grazes (it never leaves: every player tames their own). */
  readonly wild: { x: number; y: number; z: number };
  /** Where the wild giant fish waits, and its race rings (seeded). */
  readonly fishHome: { x: number; z: number };
  readonly fishRings: readonly { x: number; z: number }[];
  /** Where the wild whale spouts, and where the tamed one swims back to (seeded). */
  readonly whaleHome: { x: number; z: number };
  private readonly whale: { x: number; z: number; yaw: number };
  private whaleTamed: boolean;
  /** The co-op taming round in progress (world state: everyone in range sees it). */
  private whaleTame: { round: number; start: number; zone: number } | null = null;
  /** Sim time it surfaces again after a failed taming. */
  private whaleReadyAt = -Infinity;
  /** Who sits where (0 = pilot). Live-only. */
  private readonly whaleSeats: (string | null)[] = Array.from({ length: WHALE.seats }, () => null);
  /** Online seconds with nobody aboard (it swims home at WHALE.idle). */
  private whaleIdle = 0;
  /** The dungeon island (its aguas bravas are whale-only). */
  readonly island: Islet;
  /** Corruption zones (spec §3), seeded; zone 0 is on the Raíz-madre. */
  readonly zones: readonly Zone[];
  /** Zone ids cleansed (saved). */
  private readonly cleansed: Set<number>;
  time: number;
  /**
   * Live-only dungeon state (it all resets when the room restarts): root lever pull times and gate 0,
   * the knot (gate 1), the plate (gate 2: held open until `plateUntil`, jammed once someone is through),
   * the brazier (gate 3), the mini-boss (gate 4), and the two things you can carry.
   */
  private readonly dungeonLive = {
    pulled: [null, null] as (number | null)[],
    gate: false,
    knot: false,
    plateUntil: -Infinity,
    pressed: false,
    jammed: false,
    lit: false,
    eliteDown: false,
    block: { ...inside(DUNGEON.blockStart), held: null as string | null },
    lantern: { ...inside(DUNGEON.lantern), held: null as string | null },
  };
  /** The bruto reforzado while someone is in its room. Live-only. */
  private elite: Elite | null = null;
  /** Live-only puzzle state, one per shrine: lever pull times, open-until, plate pressed. */
  private readonly shrineLive: { pulled: (number | null)[]; openUntil: number; pressed: boolean; block: { x: number; z: number; held: string | null } | null }[];
  private readonly players = new Map<string, SavedPlayer>();
  private readonly live = new Map<string, Live>();
  private readonly resState = new Map<number, { uses: number; regrow: number }>();
  private readonly structures: Structure[];
  private nextStructureId: number;
  private readonly graves: Grave[];
  private nextGraveId: number;
  raidLevel: number;
  /** El Tragón de Papel was beaten (saved). */
  purified: boolean;
  /** Live while someone is in its room; null otherwise (it resets). */
  private boss: Boss | null = null;
  /** The purified Tragón by the Heart; live-only, rebuilt from `purified`. */
  private ally: Ally | null = null;
  /** Invasion 1 (spec §2): none yet, owed since the Tragón fell, or over. */
  invasion: 'none' | 'pending' | 'done';
  /** Sim time a pending invasion may start. Live-only. */
  private invasionAt: number;
  /** El Marchito in person, while he is here. Live-only. */
  private marchito: Marchito | null = null;
  private vines: (Crag & { owner: string; until: number })[] = [];
  private nextVineId: number = ENREDADERA.idBase;
  private regenClock = 0;
  /** Live-only: sim time each net can catch again. */
  private readonly netReady = new Map<number, number>();
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
    this.terrain = withDungeon(createTerrain(saved.seed));
    this.resources = generateResources(this.terrain, saved.seed);
    this.crags = generateCrags(this.terrain, saved.seed);
    const forest = generateShrines(this.terrain, saved.seed, this.crags);
    this.shrines = [...forest, ...generateCoastShrines(this.terrain, saved.seed)];
    this.chests = generateChests(this.terrain, saved.seed);
    this.entrance = generateEntrance(this.terrain, saved.seed, this.crags, forest);
    this.wild = generateWild(this.terrain, saved.seed, [...this.crags, ...forest, this.entrance]);
    this.island = coastFeatures(saved.seed).island;
    this.fishHome = wildFish(this.terrain, saved.seed);
    this.fishRings = fishRings(this.terrain, saved.seed, this.fishHome);
    this.whaleHome = wildWhale(this.terrain, saved.seed);
    this.whaleTamed = !!saved.whale;
    this.whale = saved.whale ? { ...saved.whale } : { ...this.whaleHome, yaw: 0 };
    this.zones = allZones(this.terrain, saved.seed, this.entrance);
    this.cleansed = new Set(saved.cleansed ?? (saved.purified ? [0] : []));
    this.shrineLive = this.shrines.map((s) => ({ pulled: s.parts.map(() => null), openUntil: -Infinity, pressed: false, block: s.kind === 'tide' ? { ...s.parts[1]!, held: null } : null }));
    for (const p of saved.players) this.players.set(p.name, structuredClone(p));
    // Plan F moved Enredadera from the first shrine orb to the dungeon altar: players who already had it keep it.
    for (const p of this.players.values()) if (p.enredadera === undefined && (p.shrines ?? []).length > 0) p.enredadera = true;
    for (const [id, st] of Object.entries(saved.resources)) this.resState.set(Number(id), { ...st });
    this.structures = saved.structures.map((s) => ({ ...s, hp: s.hp ?? STRUCTURE_HP[s.kind] }));
    this.raidLevel = saved.raidLevel ?? 0;
    this.purified = saved.purified ?? false;
    this.invasion = saved.invasion ?? 'none';
    this.invasionAt = this.time + MARCHITO.delay;
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
      l = { anim: 'idle', awayFor: null, anchorX: p.x, anchorZ: p.z, anchorAt: this.time, lastAcceptedAt: this.time, harvestReadyAt: 0, punchReadyAt: 0, fix: false, guard: newGuard(), deadAt: null, powerReadyAt: 0, tame: null, tameReadyAt: 0, riding: false, rodeUntil: 0, graceCap: MAX_SPEED, hintAt: 0, seat: null, race: null, raceReadyAt: 0, fish: false };
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
      case 'mount':
        return this.onMount(p, l, msg.act, msg.at);
      case 'dungeon':
        return this.onDungeon(p, l, msg.act);
      case 'chest':
        return this.onChest(p, msg.id);
      case 'upgrade':
        return this.onUpgrade(p);
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
      if (!l.riding && !l.seat && inCienaga(p.x, p.z) && p.y < this.terrain.heightAt(p.x, p.z) + 1.5) {
        p.vitals = damage(p.vitals, CIENAGA.dps * dt);
        this.hint(p.name, l, 'El barro marchito muerde. A lomos del ciervo no');
      }
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
    this.stepNets();
    this.stepDungeon();
    this.stepEliteFight(dt);
    this.stepBossFight(dt);
    this.stepAlly(dt);
    this.stepRace();
    this.stepTaming();
    this.stepWhaleTame();
    this.stepSeats();
    this.stepInvasion(dt);
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
      players.push({ name: n, x: r2(o.x), y: r2(o.y), z: r2(o.z), yaw: r2(o.yaw), anim: ol.anim, away: ol.awayFor !== null, dead: o.dead, ride: ol.riding ? 'deer' : ol.fish ? 'fish' : null, seat: ol.seat });
    }
    const wolves: WolfView[] = this.wolves
      .filter((w) => near(w.x, w.z))
      .map((w) => ({ id: w.id, kind: w.kind, x: r2(w.x), y: r2(w.y), z: r2(w.z), yaw: r2(w.yaw), anim: w.anim, raid: w.raid }));
    const b = this.boss;
    if (b && near(b.x, b.z)) wolves.push({ id: b.id, kind: b.kind, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.yaw), anim: b.anim, raid: false });
    const el = this.elite;
    if (el && near(el.x, el.z)) wolves.push({ id: el.id, kind: el.kind, x: r2(el.x), y: r2(el.y), z: r2(el.z), yaw: r2(el.yaw), anim: el.anim, raid: false });
    const mm = this.marchito;
    if (mm && near(mm.x, mm.z)) wolves.push({ id: mm.id, kind: mm.kind, x: r2(mm.x), y: r2(mm.y), z: r2(mm.z), yaw: r2(mm.yaw), anim: mm.anim, raid: false });
    const marchito = mm ? { will: Math.round(mm.hp), max: mm.max, laughing: mm.laugh > 0 } : null;
    const h = this.heart();
    const raid = this.raid ? { phase: this.raid.phase, dir: r2(this.raid.dir), level: this.raidLevel } : null;
    const heart = h ? { id: h.id, hp: Math.round(h.hp), max: STRUCTURE_HP.heart } : null;
    const graves = this.graves.map(({ id, owner, x, y, z }) => ({ id, owner, x, y, z }));
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l), raid, heart, graves, vines: this.vines.map(({ id, x, z, r, base, top }) => ({ id, x, z, r, base: r2(base), top: r2(top) })), shrines: this.shrineViews(), dungeon: this.dungeonView(), ally: this.ally ? { x: r2(this.ally.x), y: r2(this.ally.y), z: r2(this.ally.z), yaw: r2(this.ally.yaw), anim: this.ally.anim } : null, steeds: this.steedViews(near), fish: this.fishViews(near), whale: this.whaleView(), marchito, corrupt: this.corrupt() };
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
      purified: this.purified,
      ...(this.invasion === 'none' ? {} : { invasion: this.invasion }),
      ...(this.cleansed.size ? { cleansed: [...this.cleansed].sort((a, b) => a - b) } : {}),
      ...(this.whaleTamed ? { whale: { x: r2(this.whale.x), z: r2(this.whale.z), yaw: r2(this.whale.yaw) } } : {}),
    };
  }

  /** Everything you can climb or stand on: crags, shrine rocks (bare unless wrapped) and live vines. */
  climbables(): Crag[] {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    return [...this.crags, ...bare, ...this.vines];
  }

  /** Ids of the zones still corrupt. */
  corrupt(): number[] {
    return this.zones.filter((z) => !this.cleansed.has(z.id)).map((z) => z.id);
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
    if (l.seat) {
      p.yaw = m.yaw; // a passenger only looks around: the rider drives (stepSeats)
      return;
    }
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
    if (l.fish) {
      // The fish: water only (no Ciénaga, no aguas bravas), from the seabed + 0.5 up to the surface, cap 15.
      const wet = fishStepOk(this.terrain, this.island, m.x, m.z);
      const depthOk = m.y >= fishFloor(this.terrain, m.x, m.z) - 0.3 && m.y <= WATER_LEVEL + 0.5;
      if (!wet || !depthOk || moved > FISH.maxSpeed * elapsed + 1) {
        l.fix = true;
        return;
      }
      this.accept(p, l, m);
      p.fish = { x: r2(p.x), z: r2(p.z) };
      return;
    }
    const inBounds = inDungeon(m.x, m.z) || inMap(m.x, m.z, 2);
    const through = clampStep(p.x, p.z, m.x, m.z, this.gates());
    // Inside, walls are a clamp: a move the clamp would change went through a wall or the shut gate.
    const wallOk = !inDungeon(p.x, p.z, 2) || Math.hypot(through.x - m.x, through.z - m.z) < 0.3;
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL - 0.9);
    const cragCeiling = cragsNear(this.climbables(), m.x, m.z, CLIMB_PAD).reduce((t, c) => Math.max(t, c.top + 3), -Infinity);
    // ponytail: above ground + 4 and away from crags you may only go down (falling or gliding).
    // Hovering at a constant height passes; fine for co-op, add a sink-rate check if it's abused.
    // Riders cannot climb (no crag allowance) nor swim.
    const yOk = m.y > ground - 1 && (m.y < ground + 4 || (!l.riding && m.y < cragCeiling) || m.y <= p.y);
    const dryOk = !l.riding || this.terrain.heightAt(m.x, m.z) >= WATER_LEVEL - 0.6;
    // The sea past 4 m turns swimmers back (they may only head shallower); gliders fly over it.
    const swimming = m.y < WATER_LEVEL - 0.5;
    const seaOk = !swimming || deepStepOk(this.terrain, p.x, p.z, m.x, m.z);
    if (!seaOk) this.hint(p.name, l, 'La corriente te devuelve');
    // The server knows who rides: only riders (and just-dismounted ones, for lag) get the deer's speed.
    const mounted = l.riding || this.time < l.rodeUntil;
    // Walkers wade through the Ciénaga's mud (only when the whole window was spent in it, so entering is never unfair).
    const wading = !mounted && inCienaga(l.anchorX, l.anchorZ) && inCienaga(m.x, m.z);
    const cap = l.riding ? MOUNT.maxSpeed : mounted ? l.graceCap : wading ? CIENAGA.speed : MAX_SPEED;
    // ponytail: speed + bounds sanity check only, no server physics. Fine for co-op; add server-side collision if cheating matters.
    if (!inBounds || !wallOk || !yOk || !dryOk || !seaOk || moved > cap * elapsed + 1) {
      l.fix = true;
      return;
    }
    this.accept(p, l, m);
    if (l.riding) p.steed = { x: r2(p.x), z: r2(p.z) };
  }

  private accept(p: SavedPlayer, l: Live, m: Extract<ClientMsg, { t: 'move' }>): void {
    p.x = m.x;
    p.y = m.y;
    p.z = m.z;
    p.yaw = m.yaw;
    l.anim = m.anim;
    l.lastAcceptedAt = this.time;
  }

  /** A toast at most every few seconds per player (for rules that fire every tick). */
  private hint(name: string, l: Live, text: string): void {
    if (this.time < l.hintAt) return;
    l.hintAt = this.time + HINT_EVERY;
    this.tell(name, text);
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
    if (y < WATER_LEVEL || !inForest(x, z, 4)) return toast('No se puede construir aquí'); // the base stays in the forest
    if (this.structures.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) return toast('Hay algo en el camino');
    if (this.structures.length >= MAX_STRUCTURES) return toast('El mundo ya tiene demasiadas construcciones');
    p.inv = removeAll(p.inv, BUILD_COST[kind]);
    const s: Structure = { id: this.nextStructureId++, kind, x: r2(x), y: r2(y), z: r2(z), rot: r2(rot), owner: p.name, hp: STRUCTURE_HP[kind] };
    this.structures.push(s);
    this.outbox.push({ to: null, msg: { t: 'built', s } });
    toast(BUILT_TEXT[kind]);
  }

  private onAttack(p: SavedPlayer, l: Live, id: number): void {
    const w = this.enemy(id);
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < l.punchReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > PUNCH.reach) return;
    l.punchReadyAt = this.time + PUNCH.cooldown;
    l.anim = 'attack';
    this.strike(p.name, w, PUNCH.damage * weaponMult(p.weaponLvl ?? 0));
  }

  private onChest(p: SavedPlayer, id: number): void {
    const c = this.chests[id];
    const opened = p.chests ?? [];
    if (!c || p.dead || opened.includes(id)) return;
    if (Math.hypot(c.x - p.x, c.z - p.z) > CHEST.reach || p.y > c.y + CHEST.above) return;
    p.chests = [...opened, id];
    for (const [item, n] of Object.entries(c.loot) as [ItemId, number][]) p.inv = addItem(p.inv, item, n);
    const mat = (Object.entries(c.loot) as [ItemId, number][]).find(([k]) => k !== 'pearl')!;
    this.tell(p.name, `Cofre hundido: ${mat[1]} de ${ITEM_LABELS[mat[0]].toLowerCase()} y una ${NAMES.pearl}`);
  }

  private onUpgrade(p: SavedPlayer): void {
    const h = this.heart();
    if (!h || p.dead || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    const lvl = p.weaponLvl ?? 0;
    if (lvl >= UPGRADE.max) return this.tell(p.name, 'El arma ya no da más de sí');
    if (!hasAll(p.inv, UPGRADE.cost)) return this.tell(p.name, 'Faltan materiales');
    p.inv = removeAll(p.inv, UPGRADE.cost);
    p.weaponLvl = lvl + 1;
    this.tell(p.name, `El ${NAMES.heart} templa tu arma: +${Math.round(UPGRADE.step * 100 * p.weaponLvl)} % de daño`);
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
    const w = this.enemy(id);
    const g = l.guard;
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < g.bowReadyAt) return;
    if (Math.hypot(w.x - p.x, w.z - p.z) > BOW.range || !inCone(p.x, p.z, p.yaw, w.x, w.z, BOW.cone)) return;
    g.bowReadyAt = this.time + BOW.cooldown;
    l.anim = 'bow';
    this.strike(p.name, w, BOW.damage * weaponMult(p.weaponLvl ?? 0));
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
    if (part > 0) return this.onShrinePart(p, s, st, part);
    const cleared = p.shrines ?? [];
    if (cleared.includes(id)) return;
    const reach = s.pillar ? s.pillar.r : SHRINE.orbReach;
    if (Math.hypot(s.orb.x - p.x, s.orb.z - p.z) > reach || p.y < s.orb.y - 2.5) return;
    if (!this.shrineOpen(id)) return this.tell(p.name, 'Una verja de luz lo protege');
    p.shrines = [...cleared, id];
    this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento`);
    // The shrine's light cleanses the corrupt zone nearest it (never the Raíz-madre's: that takes the Tragón).
    // Coast orbs cleanse coast zones only (never the coast Raíz-madre's: that takes its boss, S2-G); forest orbs forest ones.
    const coast = s.id >= COAST_SHRINE.firstId;
    const ids = this.corrupt().filter((i) => i !== 0 && i !== COAST_ZONES.root && isCoastZone(i) === coast);
    const zn = nearestZone(this.zones, s.x, s.z, ids);
    if (zn) this.cleanse(zn.id, coast ? 'La luz del santuario limpia un trozo de costa' : 'La luz del santuario limpia un trozo de bosque');
  }

  /** Levers, wheels and Marea's pumice block. */
  private onShrinePart(p: SavedPlayer, s: Shrine, st: (typeof this.shrineLive)[number], part: number): void {
    if (s.kind === 'tide') {
      const b = st.block!;
      if (part !== 1) return;
      if (b.held === p.name) {
        Object.assign(b, { x: r2(p.x), z: r2(p.z), held: null });
        return;
      }
      if (b.held || Math.hypot(b.x - p.x, b.z - p.z) > SHRINE.partReach) return;
      b.held = p.name;
      // S2-F: a Viento gust will also slide the block.
      return this.tell(p.name, 'Piedra pómez. Flota, pero pesa. A para soltarla');
    }
    if (s.kind !== 'levers' && s.kind !== 'sunken' && s.kind !== 'fan') return;
    const lever = s.parts[part - 1];
    if (!lever || Math.hypot(lever.x - p.x, lever.z - p.z) > SHRINE.partReach) return;
    if (s.kind === 'sunken' && part === 2 && p.y > this.terrain.heightAt(lever.x, lever.z) + COAST_SHRINE.above) return this.tell(p.name, 'Está en el fondo');
    st.pulled[part - 1] = this.time;
    const window = s.kind === 'fan' ? COAST_SHRINE.wheelWindow : s.kind === 'sunken' ? COAST_SHRINE.sunkenWindow : SHRINE.leverWindow;
    const all = st.pulled.every((t) => t != null && this.time - t <= window + EPS);
    if (all) {
      st.openUntil = this.time + SHRINE.openFor;
      return this.tell(p.name, 'Algo se abre en el santuario');
    }
    // S2-F: a Viento gust will turn the fan-gate on its own.
    if (s.kind === 'fan') return this.tell(p.name, `La verja-molino no se mueve. Quizá con ${NAMES.powerWind.toLowerCase()}… o con tres manos`);
    return this.tell(p.name, s.kind === 'sunken' ? 'La palanca cede. Falta la otra, y hay prisa' : 'La palanca cede. Falta la otra');
  }

  private onPower(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!p.enredadera) return this.tell(p.name, 'Aún no tienes ese poder');
    if (this.time + EPS < l.powerReadyAt) return this.tell(p.name, `La enredadera aún no brota (${Math.ceil(l.powerReadyAt - this.time - EPS)} s)`);
    const offMap = inDungeon(p.x, p.z) ? !inDungeon(x, z, -1) : !inMap(x, z, 4);
    if (Math.hypot(x - p.x, z - p.z) > ENREDADERA.reach || offMap) return this.tell(p.name, 'Demasiado lejos');
    const others = this.vines.filter((v) => v.owner !== p.name);
    const wrapped = new Set(others.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    const plan = planVine(this.terrain, [...this.crags, ...others], bare, r2(x), r2(z), this.nextVineId);
    if (!plan) return this.tell(p.name, 'No hay sitio para crecer');
    if (plan.id === this.nextVineId) this.nextVineId++;
    this.vines = [...others, { ...plan, owner: p.name, until: this.time + ENREDADERA.life }];
    l.powerReadyAt = this.time + ENREDADERA.cooldown;
    this.tell(p.name, 'Crece una enredadera');
    // Coast roots wither to Viento, not Enredadera (S2-F).
    const zn = this.zones.find((z) => z.id !== 0 && !isCoastZone(z.id) && !this.cleansed.has(z.id) && Math.hypot(z.x - plan.x, z.z - plan.z) <= CORRUPTION.cleanseReach);
    if (zn) this.cleanse(zn.id, 'La raíz marchita se seca. El bosque respira');
    const knot = inside(DUNGEON.knot);
    if (!this.dungeonLive.knot && inDungeon(p.x, p.z) && Math.hypot(knot.x - plan.x, knot.z - plan.z) <= DUNGEON.knotReach + plan.r) {
      this.dungeonLive.knot = true;
      this.say('La enredadera se mete en el nudo y lo abre');
    }
    const b = this.boss;
    if (b && b.hp > 0 && Math.hypot(b.x - plan.x, b.z - plan.z) <= BOSS.rootRadius + plan.r) {
      b.rooted = BOSS.rootFor;
      b.weak = Math.max(b.weak, BOSS.rootFor);
      this.say(`La enredadera atrapa al ${NAMES.bossForestShort}. El papel se desdobla`);
    }
  }

  /** The purified Tragón lives by a living Heart and bites raiders that come near it. */
  private stepAlly(dt: number): void {
    const h = this.heart();
    if (!this.purified || !h || h.hp <= 0) {
      this.ally = null;
      return;
    }
    this.ally ??= createAlly(h, this.terrain);
    const foe = stepAlly(this.ally, h, this.wolves, this.terrain, dt);
    if (foe) hitWolf(foe, ALLY.damage);
  }

  /** Wolves, raiders or the boss. */
  private enemy(id: number): Wolf | undefined {
    if (this.marchito && this.marchito.id === id) return this.marchito;
    if (this.elite && this.elite.id === id) return this.elite;
    return this.boss && this.boss.id === id ? this.boss : this.wolves.find((x) => x.id === id);
  }

  /** Hurt an enemy for a player; the folded boss shrugs it off. */
  private strike(name: string, w: Wolf, dmg: number): void {
    if (w === this.marchito) return this.wearMarchito(name, dmg);
    if (w === this.boss && this.boss.weak <= 0) return this.tell(name, 'El papel doblado aguanta. Párale o enrédalo');
    if (hitWolf(w, dmg)) this.say(`${name} derrotó ${`a ${ENEMY_LABELS[w.kind]}`.replace(/^a el /, 'al ')}`);
  }

  /** The boss lives while someone alive is in its room; an empty room resets it. Beaten once, it is purified for good. */
  private stepBossFight(dt: number): void {
    const fighters = this.targets().filter((t) => !t.dead && inBossRoom(t.x, t.z));
    if (this.boss && this.boss.hp <= 0 && !this.purified) {
      this.purified = true;
      this.say(`El ${NAMES.bossForestShort} se deshace en papel limpio. Ahora cuida el Corazón`);
      this.cleanse(0, `La ${NAMES.forestRoot} deja de supurar morado`);
      this.vision(VISION.purified(joinNames(this.activeNames())));
      if (this.invasion === 'none') {
        this.invasion = 'pending';
        this.invasionAt = this.time + MARCHITO.delay;
      }
    }
    if (this.purified) {
      if (this.boss && this.boss.hp <= 0) {
        this.boss.deadFor += dt;
        if (this.boss.deadFor >= BOSS.corpseTime) this.boss = null;
      } else this.boss = null;
      return;
    }
    if (!fighters.length) {
      this.boss = null;
      return;
    }
    if (!this.boss) {
      this.boss = createBoss();
      this.say(`El ${NAMES.bossForest} despierta. El papel doblado no se rompe: párale o enrédalo`);
    }
    const b = this.boss;
    const bit = stepBoss(b, fighters, dt);
    if (bit) this.bite(bit, ENEMY.boss.damage, b);
  }

  private onDungeon(p: SavedPlayer, l: Live, act: number): void {
    if (p.dead) return;
    const near = (x: number, z: number, r: number) => Math.hypot(x - p.x, z - p.z) <= r;
    if (act === 0) {
      if (!near(this.entrance.x, this.entrance.z, DUNGEON.trunkR + DUNGEON.enterReach)) return;
      this.teleport(p, l, DUNGEON.x, DUNGEON.entryZ + 1.5);
      return this.tell(p.name, `Dentro de la ${NAMES.forestRoot}. Huele a papel viejo`);
    }
    if (!inDungeon(p.x, p.z)) return;
    if (act === 1) {
      if (!near(DUNGEON.x, DUNGEON.entryZ, DUNGEON.exitReach)) return;
      const e = this.entrance;
      const d = Math.max(Math.hypot(e.x, e.z), 1e-4);
      const out = DUNGEON.trunkR + 2;
      return this.teleport(p, l, e.x - (e.x / d) * out, e.z - (e.z / d) * out);
    }
    const g = this.dungeonLive;
    if (act === 2 || act === 3) {
      const i = act - 2;
      const lever = leverPos(i);
      if (!near(lever.x, lever.z, DUNGEON.leverReach) || g.gate) return;
      g.pulled[i] = this.time;
      const other = g.pulled[1 - i];
      if (other != null && this.time - other <= DUNGEON.leverWindow + EPS) {
        g.gate = true;
        return this.say('La verja de raíces se abre');
      }
      return this.tell(p.name, 'La raíz cede. Falta la otra');
    }
    if (act === 4) {
      if (!g.gate || !near(DUNGEON.x, DUNGEON.altarZ, DUNGEON.altarReach) || p.enredadera) return;
      p.enredadera = true;
      this.tell(p.name, `Despierta la ${NAMES.powerVine}: H o 🌿 hace crecer una enredadera trepable`);
      return;
    }
    if (act === 5 || act === 6) {
      const it = act === 5 ? g.block : g.lantern;
      const other = act === 5 ? g.lantern : g.block;
      if (it.held === p.name) {
        it.held = null;
        it.x = r2(p.x);
        it.z = r2(p.z);
        return;
      }
      if (it.held || other.held === p.name || !near(it.x, it.z, DUNGEON.carryReach)) return;
      if (act === 6 && g.lit) return;
      it.held = p.name;
      return this.tell(p.name, act === 5 ? 'Pesa. A para soltarlo' : 'La linterna ilumina poco. Llévala al brasero');
    }
    if (act === 7) {
      const br = inside(DUNGEON.brazier);
      if (g.lit || g.lantern.held !== p.name || !near(br.x, br.z, DUNGEON.carryReach)) return;
      g.lit = true;
      Object.assign(g.lantern, { x: br.x, z: br.z, held: null });
      this.say('El brasero prende. La verja de raíces se retira');
    }
  }

  private onMount(p: SavedPlayer, l: Live, act: number, at: number | undefined): void {
    if (p.dead) return;
    if (act === 5) return this.dismount(p, l);
    if (l.seat) return; // sitting behind someone: only getting off
    if (act === 1 && !l.tame && this.whaleTame) return this.whaleTap(p, at);
    if (act >= 9) return this.onWhaleAct(p, l, act);
    if (act >= 6) return this.onFishAct(p, l, act);
    if (l.fish || l.race) return; // on (or chasing) the fish: no deer
    if (act === 4) return this.board(p, l);
    if (act === 0) {
      if (l.tame || Math.hypot(this.wild.x - p.x, this.wild.z - p.z) > MOUNT.reach) return;
      if (p.steed) return this.tell(p.name, 'Ya tienes montura');
      if (this.time + EPS < l.tameReadyAt) return this.tell(p.name, 'El ciervo aún resopla');
      this.nextRound(l, 0, 'deer', this.wild.x, this.wild.z);
      return this.tell(p.name, 'El ciervo se encabrita. Pulsa cuando la aguja pase por la zona');
    }
    if (act === 1) {
      const t = l.tame;
      if (!t || at === undefined) return;
      const rounds = roundsOf(t.beast);
      const round = rounds[t.round]!;
      const timely = at >= t.start - EPS && at >= this.time - MOUNT.early && at <= this.time + MOUNT.late;
      if (!timely || !inZone(ringAngle(round.speed, at - t.start), t.zone, this.tameWidth(p, t))) return this.throwOff(p, l);
      if (t.round + 1 < rounds.length) {
        this.nextRound(l, t.round + 1, t.beast, t.ax, t.az);
        return this.tell(p.name, 'Aguanta');
      }
      l.tame = null;
      if (t.beast === 'fish') {
        p.fish = { x: r2(p.x), z: r2(p.z) };
        l.fish = true;
        return this.tell(p.name, 'El pez es tuyo. B para bucear, A en la orilla para bajar');
      }
      p.steed = { x: r2(p.x), z: r2(p.z) };
      l.riding = true;
      return this.tell(p.name, 'El ciervo es tuyo. A para bajar, A junto a él para montar');
    }
    if (act === 2) {
      const st = p.steed;
      if (!st || l.riding || l.tame || inDungeon(p.x, p.z) || Math.hypot(st.x - p.x, st.z - p.z) > MOUNT.reach) return;
      l.riding = true;
      return;
    }
    if (act === 3) this.dismount(p, l);
  }

  /** Sit behind the nearest rider in reach whose seat is free. */
  private board(p: SavedPlayer, l: Live): void {
    if (l.riding || l.tame || inDungeon(p.x, p.z)) return;
    const taken = new Set([...this.live.values()].flatMap((o) => (o.seat ? [o.seat] : [])));
    let best: SavedPlayer | null = null;
    for (const [n, ol] of this.live) {
      const o = this.players.get(n)!;
      if (n === p.name || !ol.riding || o.dead || ol.awayFor !== null || taken.has(n)) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d <= MOUNT.reach && (!best || d < Math.hypot(best.x - p.x, best.z - p.z))) best = o;
    }
    if (!best) return;
    l.seat = best.name;
    this.tell(p.name, `Subes detrás de ${best.name}. A para bajar`);
    this.tell(best.name, `${p.name} sube detrás`);
  }

  /** Passengers ride along: placed behind their rider every tick. A rider gone, off or asleep drops them. */
  private stepSeats(): void {
    for (const [name, l] of this.live) {
      if (!l.seat) continue;
      const p = this.players.get(name)!;
      const rl = this.live.get(l.seat);
      const r = this.players.get(l.seat);
      if (!r || !rl || !rl.riding || r.dead || rl.awayFor !== null || l.awayFor !== null || p.dead) {
        this.dismount(p, l);
        continue;
      }
      p.x = r2(r.x - Math.sin(r.yaw) * MOUNT.seatBack);
      p.z = r2(r.z - Math.cos(r.yaw) * MOUNT.seatBack);
      p.y = r.y;
      l.anchorX = p.x;
      l.anchorZ = p.z;
      l.anchorAt = this.time;
      l.lastAcceptedAt = this.time;
    }
  }

  /** Get off (or fall off): the deer stays where you stood. Passengers just step down. */
  private dismount(p: SavedPlayer, l: Live): void {
    if (l.seat) {
      l.seat = null;
      l.rodeUntil = this.time + MOUNT.grace;
      l.graceCap = MOUNT.maxSpeed;
      return;
    }
    if (l.fish) {
      l.fish = false;
      l.rodeUntil = this.time + FISH.grace;
      l.graceCap = FISH.maxSpeed;
      p.fish = { x: r2(p.x), z: r2(p.z) };
      return;
    }
    if (!l.riding) return;
    for (const [n, ol] of this.live) if (ol.seat === p.name) this.dismount(this.players.get(n)!, ol);
    l.riding = false;
    l.rodeUntil = this.time + MOUNT.grace;
    l.graceCap = MOUNT.maxSpeed;
    p.steed = { x: r2(p.x), z: r2(p.z) };
  }

  private nextRound(l: Live, round: number, beast: 'deer' | 'fish', ax: number, az: number): void {
    l.tame = { round, start: r2(this.time), zone: r2(this.rng() * Math.PI * 2), beast, ax, az };
  }

  private throwOff(p: SavedPlayer, l: Live): void {
    const fish = l.tame?.beast === 'fish';
    l.tame = null;
    if (fish) {
      l.raceReadyAt = this.time + FISH.retry;
      return this.tell(p.name, 'Se sacude y se va. Otra vez');
    }
    l.tameReadyAt = this.time + MOUNT.retry;
    this.tell(p.name, 'Te tira al suelo. Otra vez');
  }

  /** Zone width for this round; a friend near the beast calms it. */
  private tameWidth(p: SavedPlayer, t: NonNullable<Live['tame']>): number {
    const w = roundsOf(t.beast)[t.round]!.width;
    for (const [n, ol] of this.live) {
      const o = this.players.get(n)!;
      if (n !== p.name && !o.dead && ol.awayFor === null && Math.hypot(o.x - t.ax, o.z - t.az) <= MOUNT.calmReach) return w * MOUNT.calmWidth;
    }
    return w;
  }

  /** The giant fish's acts: 6 start the ring race, 7 get on, 8 get off. */
  private onFishAct(p: SavedPlayer, l: Live, act: number): void {
    if (act === 8) {
      if (!l.fish) return;
      if (depthAt(this.terrain, p.x, p.z) >= FISH.shore) return this.tell(p.name, 'Aquí es hondo. Acércate a la orilla');
      return this.dismount(p, l);
    }
    if (act === 7) {
      const f = p.fish;
      if (!f || l.fish || l.riding || l.tame || l.race || inDungeon(p.x, p.z) || Math.hypot(f.x - p.x, f.z - p.z) > FISH.reach) return;
      l.fish = true;
      return;
    }
    if (l.race || l.tame || l.riding || l.fish || Math.hypot(this.fishHome.x - p.x, this.fishHome.z - p.z) > FISH.reach) return;
    if (p.fish) return this.tell(p.name, 'Ya tienes pez');
    if (this.time + EPS < l.raceReadyAt) return this.tell(p.name, 'El pez aún recela');
    l.race = { i: 0, deadline: this.time + FISH.ringTime };
    this.tell(p.name, `Sale disparado. Pasa por los ${FISH.rings} anillos, ${FISH.ringTime} s cada uno`);
  }

  /** Ring race: the next ring counts when a validated position is inside it, before the deadline. */
  private stepRace(): void {
    for (const [name, l] of this.live) {
      const r = l.race;
      if (!r) continue;
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) {
        l.race = null;
        continue;
      }
      const ring = this.fishRings[r.i]!;
      if (Math.hypot(ring.x - p.x, ring.z - p.z) <= FISH.ringR) {
        r.i++;
        r.deadline = this.time + FISH.ringTime;
        if (r.i < this.fishRings.length) continue;
        l.race = null;
        this.nextRound(l, 0, 'fish', ring.x, ring.z);
        this.tell(p.name, 'Lo alcanzas. Ahora, cálmalo');
      } else if (this.time > r.deadline + EPS) {
        l.race = null;
        l.raceReadyAt = this.time + FISH.retry;
        this.tell(p.name, 'Se escapa');
      }
    }
  }

  /** The wild fish plus every parked (not ridden) tamed one in view. */
  private fishViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    const h = this.fishHome;
    if (near(h.x, h.z)) out.push({ owner: null, x: r2(h.x), y: WATER_LEVEL, z: r2(h.z), yaw: 0 });
    for (const o of this.players.values()) {
      const f = o.fish;
      if (!f || this.live.get(o.name)?.fish || !near(f.x, f.z)) continue;
      out.push({ owner: o.name, x: f.x, y: WATER_LEVEL, z: f.z, yaw: 0 });
    }
    return out;
  }

  // ---------------------------------------------------------------- whale

  /** Alive, connected players within taming range of the whale. */
  private nearWhale(): SavedPlayer[] {
    const out: SavedPlayer[] = [];
    for (const [n, ol] of this.live) {
      const o = this.players.get(n)!;
      if (!o.dead && ol.awayFor === null && Math.hypot(o.x - this.whale.x, o.z - this.whale.z) <= WHALE.tameReach) out.push(o);
    }
    return out;
  }

  private seatOf(name: string): number | null {
    const i = this.whaleSeats.indexOf(name);
    return i < 0 ? null : i;
  }

  /** The whale's acts: 9 start taming (two or more in range), 10 board, 11 leave. */
  private onWhaleAct(p: SavedPlayer, l: Live, act: number): void {
    if (act !== 9) return;
    if (this.whaleTamed || this.whaleTame || l.tame || Math.hypot(this.whale.x - p.x, this.whale.z - p.z) > WHALE.tameReach) return;
    if (this.time + EPS < this.whaleReadyAt) return this.tell(p.name, 'La ballena está abajo. Espera');
    const crew = this.nearWhale();
    if (!canTame(crew.length)) return this.tell(p.name, 'Con uno solo no se deja. Hacen falta dos');
    this.whaleTame = { round: 0, start: r2(this.time), zone: r2(this.rng() * Math.PI * 2) };
    for (const o of crew) this.tell(o.name, 'La ballena se revuelve. Pulsad cuando la aguja pase por la zona');
  }

  /** One tap on the shared ring: the first good tap of the round counts; a bad one sends it under. */
  private whaleTap(p: SavedPlayer, at: number | undefined): void {
    const t = this.whaleTame;
    if (!t || at === undefined) return;
    const crew = this.nearWhale();
    if (!crew.includes(p)) return;
    if (at < t.start - EPS) return; // a second tap for a round a friend already won: ignored, not a fail
    const round = WHALE.rounds[t.round]!;
    const timely = at >= this.time - MOUNT.early && at <= this.time + MOUNT.late;
    if (!timely || !inZone(ringAngle(round.speed, at - t.start), t.zone, whaleWidth(round.width, crew.length))) return this.whaleDive();
    if (t.round + 1 < WHALE.rounds.length) {
      this.whaleTame = { round: t.round + 1, start: r2(this.time), zone: r2(this.rng() * Math.PI * 2) };
      for (const o of crew) this.tell(o.name, 'Aguantad');
      return;
    }
    this.whaleTame = null;
    this.whaleTamed = true;
    this.whaleIdle = 0;
    this.say('La ballena es del mundo. A junto a ella para subir');
  }

  private whaleDive(): void {
    this.whaleTame = null;
    this.whaleReadyAt = this.time + WHALE.dive;
    for (const o of this.nearWhale()) this.tell(o.name, 'La ballena se sumerge. Otra vez en 10 s');
  }

  /** Fewer than two in range, or nobody tapping: it dives. */
  private stepWhaleTame(): void {
    const t = this.whaleTame;
    if (t && (!canTame(this.nearWhale().length) || this.time - t.start > MOUNT.roundTimeout)) this.whaleDive();
  }

  private whaleTameView(p: SavedPlayer): SelfState['tame'] {
    const t = this.whaleTame;
    if (!t || Math.hypot(p.x - this.whale.x, p.z - this.whale.z) > WHALE.tameReach || p.dead) return null;
    const round = WHALE.rounds[t.round]!;
    return { round: t.round, rounds: WHALE.rounds.length, start: t.start, speed: round.speed, zone: t.zone, width: r2(whaleWidth(round.width, this.nearWhale().length)), beast: 'whale' };
  }

  private whaleView(): WhaleView {
    return { x: r2(this.whale.x), z: r2(this.whale.z), yaw: r2(this.whale.yaw), tamed: this.whaleTamed, diving: this.time + EPS < this.whaleReadyAt, seats: [...this.whaleSeats] };
  }

  /** The wild deer plus every parked (not ridden) tamed one in view. */
  private steedViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    if (near(this.wild.x, this.wild.z)) out.push({ owner: null, x: r2(this.wild.x), y: r2(this.wild.y), z: r2(this.wild.z), yaw: 0 });
    for (const o of this.players.values()) {
      const st = o.steed;
      if (!st || this.live.get(o.name)?.riding || !near(st.x, st.z)) continue;
      out.push({ owner: o.name, x: st.x, y: r2(this.terrain.heightAt(st.x, st.z)), z: st.z, yaw: 0 });
    }
    return out;
  }

  private tameView(p: SavedPlayer, l: Live): SelfState['tame'] {
    const t = l.tame;
    if (!t) return this.whaleTameView(p);
    const rounds = roundsOf(t.beast);
    return { round: t.round, rounds: rounds.length, start: t.start, speed: rounds[t.round]!.speed, zone: t.zone, width: r2(this.tameWidth(p, t)), beast: t.beast };
  }

  /** Dying, wandering off or waiting too long ends a taming. */
  private stepTaming(): void {
    for (const [name, l] of this.live) {
      if (!l.tame) continue;
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) l.tame = null;
      else if (Math.hypot(l.tame.ax - p.x, l.tame.az - p.z) > MOUNT.leash || this.time - l.tame.start > MOUNT.roundTimeout) this.throwOff(p, l);
    }
  }

  /** Server-side move (dungeon door): the client snaps to it through `fix`. */
  private teleport(p: SavedPlayer, l: Live, x: number, z: number): void {
    this.dismount(p, l); // no deer in the Raíz-madre: it waits at the door
    p.x = r2(x);
    p.z = r2(z);
    p.y = this.terrain.heightAt(p.x, p.z);
    l.fix = true;
    l.anchorX = p.x;
    l.anchorZ = p.z;
    l.anchorAt = this.time;
    l.lastAcceptedAt = this.time;
  }

  private dungeonView(): DungeonView {
    const g = this.dungeonLive;
    const pulled = g.pulled.map((t) => t != null && (g.gate || this.time - t <= DUNGEON.leverWindow + EPS));
    const b = this.boss;
    const boss = b && b.hp > 0 ? { hp: Math.round(b.hp), max: ENEMY.boss.hp, weak: b.weak > 0 } : null;
    const e = this.elite;
    const elite = e && e.hp > 0 ? { hp: Math.round(e.hp), max: ENEMY.elite.hp, charging: e.windup > 0 || e.charge > 0 } : null;
    const carry = (c: { x: number; z: number; held: string | null }) => ({ x: r2(c.x), z: r2(c.z), held: c.held });
    return { gate: g.gate, gates: this.gates(), levers: pulled, purified: this.purified, boss, plate: g.pressed, block: carry(g.block), lantern: carry(g.lantern), lit: g.lit, elite };
  }

  /** Which of the five dungeon gates are open. */
  private gates(): boolean[] {
    const g = this.dungeonLive;
    return [g.gate, g.knot, g.jammed || this.time < g.plateUntil, g.lit, g.eliteDown];
  }

  /** Carried things follow their carrier (or drop); the plate reads who and what stands on it. */
  private stepDungeon(): void {
    const g = this.dungeonLive;
    for (const [it, start] of [[g.block, DUNGEON.blockStart], [g.lantern, DUNGEON.lantern]] as const) {
      if (!it.held) continue;
      const p = this.players.get(it.held);
      const l = this.live.get(it.held);
      if (p && l && !p.dead && l.awayFor === null && inDungeon(p.x, p.z)) {
        it.x = p.x;
        it.z = p.z;
        continue;
      }
      it.held = null;
      if (!p || !inDungeon(p.x, p.z)) Object.assign(it, inside(start)); // taken out of the Raíz-madre: it goes back
    }
    const plate = inside(DUNGEON.plate);
    const on = (x: number, z: number) => Math.hypot(x - plate.x, z - plate.z) <= DUNGEON.plateRadius;
    g.pressed = (!g.block.held && on(g.block.x, g.block.z)) || this.targets().some((t) => !t.dead && on(t.x, t.z));
    if (g.pressed) g.plateUntil = this.time + DUNGEON.plateHold;
    const gz = DUNGEON.gatesZ[2];
    if (!g.jammed && this.time < g.plateUntil && this.targets().some((t) => !t.dead && inDungeon(t.x, t.z) && t.z > gz)) {
      g.jammed = true;
      this.say('Alguien cruzó: la verja de la losa se atasca abierta');
    }
  }

  /** The bruto reforzado lives while someone alive is in its room; an empty room resets it. Once down, gate 4 opens. */
  private stepEliteFight(dt: number): void {
    const g = this.dungeonLive;
    const e = this.elite;
    if (e && e.hp <= 0) {
      if (!g.eliteDown) {
        g.eliteDown = true;
        this.say(`El ${NAMES.eliteForest} se deshace en hojas secas. La última verja se abre`);
      }
      e.deadFor += dt;
      if (e.deadFor >= ELITE.corpseTime) this.elite = null;
      return;
    }
    if (g.eliteDown) return;
    const fighters = this.targets().filter((t) => !t.dead && inEliteRoom(t.x, t.z));
    if (!fighters.length) {
      this.elite = null;
      return;
    }
    if (!this.elite) {
      this.elite = createElite();
      this.say(`Un ${NAMES.eliteForest} se levanta. Cuando se agache, apártate o rueda`);
    }
    const hit = stepElite(this.elite, fighters, dt);
    if (hit) this.bite(hit.name, hit.dmg, this.elite);
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
      if (s.kind === 'plate') return { id, open, parts: [st.pressed] };
      if (s.kind === 'tide') return { id, open, parts: [st.pressed], block: { x: r2(st.block!.x), z: r2(st.block!.z), held: st.block!.held } };
      const window = s.kind === 'fan' ? COAST_SHRINE.wheelWindow : s.kind === 'sunken' ? COAST_SHRINE.sunkenWindow : SHRINE.leverWindow;
      const parts = s.parts.map((_, i) => st.pulled[i] != null && (open || this.time - st.pulled[i]! <= window + EPS));
      return { id, open, parts };
    });
  }

  private stepShrines(): void {
    this.shrines.forEach((s, id) => {
      if (s.kind !== 'plate' && s.kind !== 'tide') return;
      const st = this.shrineLive[id]!;
      const plate = s.parts[0]!;
      st.pressed = false;
      const b = st.block;
      if (b?.held) {
        const p = this.players.get(b.held);
        const l = this.live.get(b.held);
        if (p && l && !p.dead && l.awayFor === null) Object.assign(b, { x: p.x, z: p.z });
        else b.held = null; // dropped where its holder fell (or left)
      }
      if (b && !b.held && Math.hypot(plate.x - b.x, plate.z - b.z) <= SHRINE.plateRadius) st.pressed = true;
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
      power: !!p.enredadera,
      tame: this.tameView(p, l),
      riding: l.riding,
      steed: !!p.steed,
      seat: l.seat,
      fish: !!p.fish,
      onFish: l.fish,
      race: l.race ? { i: l.race.i, deadline: r2(l.race.deadline) } : null,
      chests: [...(p.chests ?? [])],
      weapon: p.weaponLvl ?? 0,
      whaleSeat: this.seatOf(p.name),
    };
  }

  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    if (inDungeon(x, z)) return true; // warm inside the Raíz-madre
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
        if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng));
          break;
        }
      }
    }
    // Corrupt zones breed more and tougher beasts: extra wolves around each player standing in one, the first a brute.
    const corrupt = this.corrupt();
    for (const a of anchors) {
      const zn = zoneAt(this.zones, a.x, a.z);
      if (!zn || !corrupt.includes(zn.id) || inDungeon(a.x, a.z)) continue;
      for (let i = 0; i < CORRUPTION.extraWolves; i++) {
        for (let tries = 0; tries < 10; tries++) {
          const ang = this.rng() * Math.PI * 2;
          const d = 20 + this.rng() * 15;
          const x = a.x + Math.sin(ang) * d;
          const z = a.z + Math.cos(ang) * d;
          if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
            this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, i === 0 ? 'brute' : 'wolf'));
            break;
          }
        }
      }
    }
  }

  private cleanse(id: number, text: string): void {
    if (this.cleansed.has(id) || !this.zones.some((z) => z.id === id)) return;
    this.cleansed.add(id);
    this.say(text);
  }

  private stepRaid(night: boolean): void {
    const heart = this.heart();
    const f = dayFraction(this.time);
    if (!this.raid && heart && heart.hp > 0 && !night && f >= RAID.warnAt && this.activeCount() > 0) {
      // Raids come from the nearest corrupt zone (spec §3); with none left, from the Raíz-madre.
      const corrupt = this.corrupt();
      const src = nearestZone(this.zones, heart.x, heart.z, corrupt);
      this.raid = { phase: 'warn', dir: raidDirFrom(heart, this.zones, corrupt, this.rootDir(heart)) + (this.rng() - 0.5) * RAID.jitter };
      const where = !src || src.id === 0 ? `la ${NAMES.forestRoot}` : 'una zona marchita';
      const coast = coastRaidBrutes(corrupt) > 0 ? '. Algo sube de la costa' : '';
      this.say(
        this.purified
          ? `Restos de corrupción desde ${where}. Vienen menos: vuelvan al Corazón${coast}`
          : `El cielo se tiñe de morado hacia ${where}. ${NAMES.villain} envía a sus bestias: vuelvan al Corazón${coast}`,
      );
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
    const full = Math.min(RAID.maxWave, RAID.base + RAID.perLevel * this.raidLevel + RAID.perPlayer * extra);
    const n = this.purified ? Math.max(1, Math.ceil(full * RAID.cleansed)) : full;
    // Coast pressure (Slice 2 §6.4): extra brutes on top, until the coast Raíz-madre is purified (S2-G).
    const extraBrutes = coastRaidBrutes(this.corrupt());
    for (let i = 0; i < n + extraBrutes; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const ang = dir + (this.rng() - 0.5) * 0.8;
        const d = RAID.spawnMin + this.rng() * (RAID.spawnMax - RAID.spawnMin);
        const x = heart.x + Math.sin(ang) * d;
        const z = heart.z + Math.cos(ang) * d;
        if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          const kind: EnemyKind = i >= n || (!this.purified && this.raidLevel >= 1 && i % 3 === 2) ? 'brute' : 'wolf';
          const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, kind);
          w.raid = true;
          this.wolves.push(w);
          break;
        }
      }
    }
  }

  /** The corruption's source: the angle from the Heart to the Raíz-madre (x = sin, z = cos). */
  private rootDir(h: { x: number; z: number }): number {
    return Math.atan2(this.entrance.x - h.x, this.entrance.z - h.z);
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
      this.say(`El ${NAMES.heart} se marchitó. Cuídenlo con bayas`);
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
        w.slow = SPIKES.slowFor;
        s.hp -= SPIKES.wear * dt;
      }
      if (s.hp <= 0) this.wreck(s);
    }
  }

  /** A net holds the first beast that steps in (stunned: no moving, no biting), then rearms. */
  private stepNets(): void {
    for (const s of this.structures.filter((x) => x.kind === 'roots')) {
      if (this.time + EPS < (this.netReady.get(s.id) ?? 0)) continue;
      const w = this.wolves.find((x) => x.hp > 0 && x.stun <= 0 && Math.hypot(x.x - s.x, x.z - s.z) <= NET.radius);
      if (!w) continue;
      w.stun = NET.hold;
      w.anim = 'idle';
      this.netReady.set(s.id, this.time + NET.rearm);
      this.damageStructure(s.id, NET.wear);
    }
    for (const id of this.netReady.keys()) if (!this.structures.some((s) => s.id === id)) this.netReady.delete(id);
  }

  private bite(name: string, dmg: number, w: Wolf): void {
    const p = this.players.get(name);
    if (!p) return;
    const l = this.live.get(name);
    const out = l ? resolveHit(l.guard, this.time, dmg) : { kind: 'hit' as const, dmg };
    if (out.kind === 'dodged') return;
    if (out.kind === 'parried') {
      w.stun = BLOCK.parryStun;
      if (w === this.boss) this.boss.weak = BOSS.weakFor;
      this.strike(name, w, BLOCK.parryDamage);
      return this.tell(name, w === this.boss ? 'Parada: el papel se desdobla' : 'Parada');
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

  // ---------------------------------------------------------------- El Marchito

  /** He comes once the Tragón fell, when there is a Heart and someone out in the world to see it. */
  private stepInvasion(dt: number): void {
    const h = this.heart();
    if (this.invasion === 'pending' && !this.marchito && h && this.time + EPS >= this.invasionAt) {
      const watcher = this.targets().some((t) => !t.dead && !inDungeon(t.x, t.z));
      if (watcher) this.startInvasion(h);
    }
    const m = this.marchito;
    if (!m || this.activeCount() === 0) return; // the world sleeps
    const structs = this.structures.filter((s) => m.prey.includes(s.id));
    const ev = stepMarchito(m, structs, this.targets(), (x, z) => this.terrain.heightAt(x, z), dt);
    if (!ev) return;
    if (ev.t === 'smash') {
      const s = this.structures.find((x) => x.id === ev.id);
      if (s) this.wreck(s);
    } else if (ev.t === 'swipe') this.bite(ev.name, ENEMY.marchito.damage, m);
    else if (ev.t === 'laugh') this.vision(VISION.laugh);
    else this.endInvasion();
  }

  private startInvasion(h: Structure): void {
    const dir = this.rootDir(h);
    const { x, z } = clampMap(h.x + Math.sin(dir) * MARCHITO.spawnDist, h.z + Math.cos(dir) * MARCHITO.spawnDist, 6);
    this.marchito = createMarchito(x, this.terrain.heightAt(x, z), z, pickDefenses(this.structures, h), marchitoWill(this.activeCount()));
    this.vision(VISION.arrive);
  }

  private endInvasion(): void {
    this.marchito = null;
    this.invasion = 'done';
  }

  /** Blows wear his voluntad; at 0 he is driven off. He never dies. */
  private wearMarchito(name: string, dmg: number): void {
    const m = this.marchito!;
    if (m.laugh > 0) return;
    m.hp = Math.max(0, m.hp - dmg);
    if (!m.taunted.includes(name)) {
      m.taunted.push(name);
      this.tell(name, VISION.taunt(name));
    }
    if (m.hp > 0) return;
    this.vision(VISION.driven(joinNames(m.taunted)));
    this.endInvasion();
  }

  private activeNames(): string[] {
    return [...this.live].filter(([, l]) => l.awayFor === null).map(([n]) => n);
  }

  private vision(lines: string[]): void {
    this.outbox.push({ to: null, msg: { t: 'vision', lines } });
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
    if (l) {
      l.deadAt = this.time;
      this.dismount(p, l);
    }
    this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} ha caído` } });
  }
}
