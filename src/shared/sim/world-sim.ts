import { NAMES } from '../names';
import { CIENAGA, deepStepOk, depthAt, inCienaga, SWIM_MAX_DEPTH } from '../coast';
import { BOG, inBog, ZARZAL, zarzalAt } from '../swamp';
import { gustDir, inGust, slide, VIENTO, type Dir } from '../viento';
import { createRng } from '../rng';
import { clampMap, coastFeatures, createTerrain, type Islet, inForest, inMap, inSwamp, WATER_LEVEL, type Terrain } from '../terrain';
import { GATA, gataLeads, hasteNear, stepGata } from './lieutenant';
import { generateResources, HARVEST, type ResourceSpawn } from '../resources';
import { cragsNear, generateCrags, type Crag } from '../crags';
import { ENREDADERA, planVine } from '../enredadera';
import { allZones, coastRaidBrutes, COAST_ZONES, CORRUPTION, isCoastZone, isSwampZone, SWAMP_ZONES, nearestZone, raidDirFrom, zoneAt, type Zone } from '../corruption';
import { clampStep, DUNGEON, generateEntrance, inAnyDungeon, inBossRoom, inDungeon, inEliteRoom, inside, leverPos, withDungeon } from '../dungeon';
import { COAST_DUNGEON, coastEntrance, inChasm, inCoastBossRoom, inCoastDungeon, insideCoast, inShieldRoom } from '../coast-dungeon';
import { createElite, createShielded, ELITE, shieldBlocks, stepElite, type Elite } from './elite';
import { generateWild, inZone, MOUNT, ringAngle } from '../mount';
import { FISH, fishFloor, fishRings, fishStepOk, wildFish } from '../fish';
import { FROG, frogMoveOk, frogPads, wildFrog } from '../frog';
import { AMBER, generateAmberTrees, generateSwampShrines, lilyPadCrags, SWAMP_SHRINE, type AmberTree } from '../swamp-shrines';
import { canTame, seatOffset, WHALE, whaleStepOk, whaleWidth, wildWhale } from '../whale';
import { generateShrines, SHRINE, SHRINE_LABELS, type Shrine } from '../shrines';
import { CHEST, COAST_SHRINE, generateChests, generateCoastShrines, type Chest } from '../coast-shrines';
import { addItem, ITEM_LABELS, BUILD_COST, type ItemId, count, STRUCTURE_HP, TEND_COST, TEND_HEAL, UPGRADE, weaponMult, CAPA, capaMult, hasAll, removeAll, type Inventory, type StructureKind } from '../items';
import { createVitals, damage, eatBerry, isNight, RESPAWN_VITALS, tickVitals, type Vitals } from '../survival';
import { r2, type Anim, type ClientMsg, type DungeonView, type GraveView, type PlayerView, type SelfState, type ShrineView, type ServerMsg, type SteedView, type Structure, type WhaleView, type WolfView } from '../protocol';
import { ALLY, createAlly, stepAlly, type Ally } from './ally';
import { BOSS, createBoss, stepBoss, type Boss } from './boss';
import { ANTENON, createAntenon, createGustAlly, pushAntenon, stepAntenon, stepGustAlly, type Antenon, type GustAlly } from './antenon';
import { RESCUE, rescueSite, type RescueSite } from '../rescue';
import { createMarchito, joinNames, MARCHITO, marchitoWill, pickDefenses, stepMarchito, stepThief, thiefWill, VISION, type Marchito } from './marchito';
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

const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
  /** Tamed frog and where it waits. Optional: older saves have none. */
  frog?: { x: number; z: number };
  /** Sunken chest ids opened. Optional: older saves have none. */
  chests?: number[];
  /** Weapon upgrade level 0–3. Optional: older saves have none. */
  weaponLvl?: number;
  /** Amber tree id → sim time you last harvested it. Optional: older saves have none. */
  amber?: Record<number, number>;
  /** Capa de corteza level 0–3. Optional: older saves have none. */
  capaLvl?: number;
  /** Has Viento (coast dungeon altar). Optional: older saves have none. */
  viento?: boolean;
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
  /** El Antenón was beaten and now guards the Heart too. Optional: older saves have none. */
  purified2?: boolean;
  /** El Marchito's first invasion: owed (the Tragón fell) or already happened. Optional: older saves have none. */
  invasion?: 'pending' | 'done';
  /** Invasion 2 (Slice 2 §8): owed since someone tamed a fish, the Tragón taken, or rescued. Optional: older saves have none. */
  invasion2?: 'pending' | 'taken' | 'rescued';
  /** While the Tragón is taken: which of the cage's 3 anchors are broken. Optional. */
  anchors?: boolean[];
  /** Corruption zones cleansed so far (ids from generateZones). Optional: older saves have none. */
  cleansed?: number[];
  /** La Ballena, once tamed (it belongs to the world): where it floats. Optional: older saves have a wild one. */
  whale?: { x: number; z: number; yaw: number };
  /** Raids warned so far (1-based count; every 3rd may bring La Gata Araña). Optional: older saves start at 0. */
  raidN?: number;
  /** Someone has entered the swamp in this world. Optional. */
  swampSeen?: boolean;
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
  /** Carrying a torch from the Candiles post (spent on one brazier). */
  torch?: boolean;
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
  /** Sim time Viento can be cast again. Live-only. */
  windReadyAt: number;
  /** Glider lift from a gust: the highest accepted y until `boostUntil`; `boosted` = used this flight. */
  boostCeil: number;
  boostUntil: number;
  boosted: boolean;
  /** Sim time of death; null when alive or after a reconnect (no revive then). Never saved. */
  deadAt: number | null;
  /** Taming round in progress (live-only). `start` and `zone` are rounded as the client sees them. */
  tame: { round: number; start: number; zone: number; beast: Beast; ax: number; az: number } | null;
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
  race: { i: number; deadline: number; beast: 'fish' | 'frog' } | null;
  /** Sim time the wild fish lets you race again. */
  raceReadyAt: number;
  /** On the giant fish (live-only, like `riding`). */
  fish: boolean;
  /** On the frog (live-only). */
  frog: boolean;
}

type Beast = 'deer' | 'fish' | 'frog';
const roundsOf = (beast: Beast): readonly { speed: number; width: number }[] => (beast === 'fish' ? FISH.rounds : beast === 'frog' ? FROG.rounds : MOUNT.rounds);

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
  /** Amber trees on the swamp's montículos (seeded; per player). */
  readonly amberTrees: readonly AmberTree[];
  /** The Raíz-madre's trunk in the world (the dungeon entrance). */
  readonly entrance: { x: number; y: number; z: number };
  /** The coast Raíz-madre's trunk, on the dungeon island. */
  readonly coastEntrance: { x: number; z: number };
  /** Where the wild deer grazes (it never leaves: every player tames their own). */
  readonly wild: { x: number; y: number; z: number };
  /** Where the wild giant fish waits, and its race rings (seeded). */
  readonly fishHome: { x: number; z: number };
  readonly fishRings: readonly { x: number; z: number }[];
  /** Where the wild frog waits, and its lily pads (seeded). */
  readonly frogHome: { x: number; z: number };
  readonly frogPads: readonly { x: number; z: number }[];
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
  /** The bruto escudado in the coast interior. */
  private shield: Elite | null = null;
  /** The coast interior (live-only, like the forest one): levers, gates, the pumice block, the bruto escudado. */
  private readonly coastLive = {
    pulled: [null, null] as (number | null)[],
    gate: false,
    fan: false,
    plate: false,
    eliteDown: false,
    block: { ...insideCoast(COAST_DUNGEON.blockStart) },
  };
  /** Live-only puzzle state, one per shrine: lever pull times, open-until, plate pressed. */
  private readonly shrineLive: { pulled: (number | null)[]; openUntil: number; pressed: boolean; block: { x: number; z: number; held: string | null } | null; /** Candiles: lit-until per brazier. */ lit: number[]; /** Nenúfares: when someone first stood on each pad, and until when it is under. */ pads: { at: number | null; downUntil: number }[] }[];
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
  /** El Antenón (saved once beaten) and, live while someone is in its room, the fight. */
  purified2: boolean;
  private boss2: Antenon | null = null;
  /** The purified Antenón by the Heart; live-only, rebuilt from `purified2`. */
  private ally2: GustAlly | null = null;
  /** The purified Tragón by the Heart; live-only, rebuilt from `purified`. */
  private ally: Ally | null = null;
  /** Invasion 1 (spec §2): none yet, owed since the Tragón fell, or over. */
  invasion: 'none' | 'pending' | 'done';
  /** Invasion 2 (Slice 2 §8): none yet, owed (a fish was tamed), the Tragón taken, or rescued. */
  invasion2: 'none' | 'pending' | 'taken' | 'rescued';
  /** The cage's anchors broken so far (saved while taken). */
  private anchors: boolean[];
  /** Live anchor records (kind 'anchor') for the ones still standing; their PV is live-only. */
  private anchorFoes: Wolf[] = [];
  /** Islets whose guards already came out this load. Live-only. */
  private guarded = [false, false, false];
  /** Where the cage and its anchors are (seeded). */
  readonly rescue: RescueSite;
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
  private raid: { phase: 'warn' | 'active'; dir: number; gata?: boolean } | null = null;
  private raidN: number;
  private swampSeen: boolean;
  /** La Gata Araña's wolf id while she leads a raid. */
  private gataId: number | null = null;
  /** Seconds left of a raid fleeing after she fell. */
  private raidFlee = 0;
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
    this.shrines = [...forest, ...generateCoastShrines(this.terrain, saved.seed), ...generateSwampShrines(this.terrain, saved.seed)];
    this.chests = generateChests(this.terrain, saved.seed);
    this.amberTrees = generateAmberTrees(this.terrain, saved.seed);
    this.entrance = generateEntrance(this.terrain, saved.seed, this.crags, forest);
    this.wild = generateWild(this.terrain, saved.seed, [...this.crags, ...forest, this.entrance]);
    this.island = coastFeatures(saved.seed).island;
    this.coastEntrance = coastEntrance(saved.seed);
    this.fishHome = wildFish(this.terrain, saved.seed);
    this.fishRings = fishRings(this.terrain, saved.seed, this.fishHome);
    this.frogHome = wildFrog(this.terrain, saved.seed);
    this.frogPads = frogPads(this.terrain, saved.seed, this.frogHome);
    this.whaleHome = wildWhale(this.terrain, saved.seed);
    this.whaleTamed = !!saved.whale;
    this.whale = saved.whale ? { ...saved.whale } : { ...this.whaleHome, yaw: 0 };
    this.zones = allZones(this.terrain, saved.seed, this.entrance);
    this.cleansed = new Set(saved.cleansed ?? (saved.purified ? [0] : []));
    this.shrineLive = this.shrines.map((s) => ({ pulled: s.parts.map(() => null), openUntil: -Infinity, pressed: false, block: s.kind === 'tide' ? { ...s.parts[1]!, held: null } : null, lit: s.kind === 'candles' ? [0, 0, 0] : [], pads: s.kind === 'lilies' ? s.parts.map(() => ({ at: null, downUntil: 0 })) : [] }));
    for (const p of saved.players) this.players.set(p.name, structuredClone(p));
    // Plan F moved Enredadera from the first shrine orb to the dungeon altar: players who already had it keep it.
    for (const p of this.players.values()) if (p.enredadera === undefined && (p.shrines ?? []).length > 0) p.enredadera = true;
    for (const [id, st] of Object.entries(saved.resources)) this.resState.set(Number(id), { ...st });
    this.structures = saved.structures.map((s) => ({ ...s, hp: s.hp ?? STRUCTURE_HP[s.kind] }));
    this.raidLevel = saved.raidLevel ?? 0;
    this.raidN = saved.raidN ?? 0;
    this.swampSeen = saved.swampSeen ?? false;
    this.purified = saved.purified ?? false;
    this.purified2 = saved.purified2 ?? false;
    this.invasion = saved.invasion ?? 'none';
    this.invasionAt = this.time + MARCHITO.delay;
    this.invasion2 = saved.invasion2 ?? (saved.players.some((p) => p.fish) ? 'pending' : 'none');
    this.rescue = rescueSite(this.terrain, saved.seed);
    this.anchors = [0, 1, 2].map((i) => saved.anchors?.[i] ?? false);
    this.buildAnchors();
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
      l = { anim: 'idle', awayFor: null, anchorX: p.x, anchorZ: p.z, anchorAt: this.time, lastAcceptedAt: this.time, harvestReadyAt: 0, punchReadyAt: 0, fix: false, guard: newGuard(), deadAt: null, powerReadyAt: 0, windReadyAt: 0, boostCeil: -Infinity, boostUntil: 0, boosted: false, tame: null, tameReadyAt: 0, riding: false, rodeUntil: 0, graceCap: MAX_SPEED, hintAt: 0, seat: null, race: null, raceReadyAt: 0, fish: false, frog: false };
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
        return msg.kind === 'viento' ? this.onGust(p, l, msg.x, msg.z) : this.onPower(p, l, msg.x, msg.z);
      case 'mount':
        return this.onMount(p, l, msg.act, msg.at);
      case 'dungeon':
        return this.onDungeon(p, l, msg.act);
      case 'chest':
        return this.onChest(p, msg.id);
      case 'upgrade':
        return this.onUpgrade(p);
      case 'rescue':
        return this.onRescue(p);
      case 'amber':
        return this.onAmber(p, msg.id);
      case 'capa':
        return this.onCapa(p);
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
      if (!l.fish && zarzalAt(this.terrain, p.x, p.z) && p.y < this.terrain.heightAt(p.x, p.z) + 1.5) {
        p.vitals = damage(p.vitals, ZARZAL.dps * dt);
        this.hint(p.name, l, `${upFirst(NAMES.swampGate)} muerde. Las espinas no respetan al ciervo`);
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
    const gata = this.wolves.find((w) => w.id === this.gataId && w.hp > 0) ?? null;
    for (const w of this.wolves) {
      if (w.raid) {
        if (!goal) continue;
        if (this.raidFlee > 0) {
          this.flee(w, goal, dt);
          continue;
        }
        if (w.kind === 'lieut1') {
          const bit = stepGata(w, targets, goal, this.terrain, dt, this.rng);
          if (bit) this.bite(bit, ENEMY.lieut1.damage, w);
          continue;
        }
        w.haste = hasteNear(gata, w.x, w.z);
        const hit = stepRaider(w, targets, goal, this.terrain, dt, this.rng);
        if (hit && 'player' in hit) this.bite(hit.player, raiderDamage(w), w);
        else if (hit) this.damageStructure(hit.structure, raiderDamage(w));
        continue;
      }
      const bit = stepWolf(w, targets, this.terrain, dt, this.rng);
      if (bit) this.bite(bit, ENEMY[w.kind].damage, w);
    }
    this.stepGataFall(dt);
    this.stepSpikes(dt);
    this.stepNets();
    this.stepDungeon();
    this.stepCoastDungeon();
    this.stepEliteFight(dt);
    this.stepShieldFight(dt);
    this.stepBossFight(dt);
    this.stepAntenonFight(dt);
    this.stepAlly(dt);
    this.stepAlly2(dt);
    this.stepRace();
    this.stepTaming();
    this.stepWhaleTame();
    this.stepWhale(dt);
    this.stepSeats();
    this.stepInvasion(dt);
    this.stepInvasion2(dt);
    this.stepGuards();
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
      players.push({ name: n, x: r2(o.x), y: r2(o.y), z: r2(o.z), yaw: r2(o.yaw), anim: ol.anim, away: ol.awayFor !== null, dead: o.dead, ride: ol.riding ? 'deer' : ol.fish ? 'fish' : ol.frog ? 'frog' : this.seatOf(n) !== null ? 'whale' : null, seat: ol.seat, capa: o.capaLvl ?? 0 });
    }
    const wolves: WolfView[] = this.wolves
      .filter((w) => near(w.x, w.z))
      .map((w) => ({ id: w.id, kind: w.kind, x: r2(w.x), y: r2(w.y), z: r2(w.z), yaw: r2(w.yaw), anim: w.anim, raid: w.raid }));
    const b = this.boss;
    if (b && near(b.x, b.z)) wolves.push({ id: b.id, kind: b.kind, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.yaw), anim: b.anim, raid: false });
    const sh = this.shield;
    const b2 = this.boss2;
    if (b2 && near(b2.x, b2.z)) wolves.push({ id: b2.id, kind: b2.kind, x: r2(b2.x), y: r2(b2.y), z: r2(b2.z), yaw: r2(b2.yaw), anim: b2.anim, raid: false });
    if (sh && near(sh.x, sh.z)) wolves.push({ id: sh.id, kind: sh.kind, x: r2(sh.x), y: r2(sh.y), z: r2(sh.z), yaw: r2(sh.yaw), anim: sh.anim, raid: false });
    const el = this.elite;
    if (el && near(el.x, el.z)) wolves.push({ id: el.id, kind: el.kind, x: r2(el.x), y: r2(el.y), z: r2(el.z), yaw: r2(el.yaw), anim: el.anim, raid: false });
    for (const a of this.anchorFoes) if (a.hp > 0 && near(a.x, a.z)) wolves.push({ id: a.id, kind: a.kind, x: r2(a.x), y: r2(a.y), z: r2(a.z), yaw: 0, anim: 'idle', raid: false });
    const mm = this.marchito;
    if (mm && near(mm.x, mm.z)) wolves.push({ id: mm.id, kind: mm.kind, x: r2(mm.x), y: r2(mm.y), z: r2(mm.z), yaw: r2(mm.yaw), anim: mm.anim, raid: false });
    const marchito = mm ? { will: Math.round(mm.hp), max: mm.max, laughing: mm.laugh > 0, ...(mm.grab !== null ? { grab: r2(Math.min(1, mm.grab / MARCHITO.grabFor)) } : {}) } : null;
    const h = this.heart();
    const raid = this.raid ? { phase: this.raid.phase, dir: r2(this.raid.dir), level: this.raidLevel } : null;
    const heart = h ? { id: h.id, hp: Math.round(h.hp), max: STRUCTURE_HP.heart } : null;
    const graves = this.graves.map(({ id, owner, x, y, z }) => ({ id, owner, x, y, z }));
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l), raid, heart, graves, vines: this.vines.map(({ id, x, z, r, base, top }) => ({ id, x, z, r, base: r2(base), top: r2(top) })), shrines: this.shrineViews(), dungeon: this.dungeonView(), ally: this.ally ? { x: r2(this.ally.x), y: r2(this.ally.y), z: r2(this.ally.z), yaw: r2(this.ally.yaw), anim: this.ally.anim } : null, ally2: this.ally2 ? { x: r2(this.ally2.x), y: r2(this.ally2.y), z: r2(this.ally2.z), yaw: r2(this.ally2.yaw), anim: this.ally2.anim } : null, steeds: this.steedViews(near), fish: this.fishViews(near), frogs: this.frogViews(near), whale: this.whaleView(), marchito, corrupt: this.corrupt(), cage: this.invasion2 === 'taken' ? { anchors: this.anchors.map((b, i) => (b ? 0 : Math.max(1, Math.ceil(this.anchorFoes.find((a) => a.id === RESCUE.anchorIdBase + i)?.hp ?? RESCUE.anchorHp)))) } : null };
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
      ...(this.raidN ? { raidN: this.raidN } : {}),
      ...(this.swampSeen ? { swampSeen: true } : {}),
      graves: this.graves.map((g) => ({ ...g, inv: { ...g.inv } })),
      purified: this.purified,
      ...(this.purified2 ? { purified2: true } : {}),
      ...(this.invasion === 'none' ? {} : { invasion: this.invasion }),
      ...(this.invasion2 === 'none' ? {} : { invasion2: this.invasion2 }),
      ...(this.invasion2 === 'taken' ? { anchors: [...this.anchors] } : {}),
      ...(this.cleansed.size ? { cleansed: [...this.cleansed].sort((a, b) => a - b) } : {}),
      ...(this.whaleTamed ? { whale: { x: r2(this.whale.x), z: r2(this.whale.z), yaw: r2(this.whale.yaw) } } : {}),
    };
  }

  /** Everything you can climb or stand on: crags, shrine rocks (bare unless wrapped) and live vines. */
  climbables(): Crag[] {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    return [...this.crags, ...bare, ...this.vines, ...this.padCrags(), ...this.amberTrees.flatMap((t) => (t.stump ? [t.stump] : []))];
  }

  /** Nenúfares' pads still afloat. */
  private padCrags(): Crag[] {
    return this.shrines.flatMap((s, id) => (s.kind === 'lilies' ? lilyPadCrags(s, this.shrineLive[id]!.pads.map((p) => this.time >= p.downUntil)) : []));
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
    const seat = this.seatOf(p.name);
    if (seat !== null) {
      // On the whale: only the pilot steers; its body is the whale's plus the pilot seat. Surface only, 3 m of water.
      if (seat > 0) {
        p.yaw = m.yaw;
        return;
      }
      const off = seatOffset(0, m.yaw);
      const wx = m.x - off.x;
      const wz = m.z - off.z;
      const deepOk = whaleStepOk(this.terrain, wx, wz);
      if (!deepOk) this.hint(p.name, l, 'La ballena no cabe');
      if (!deepOk || Math.abs(m.y - WATER_LEVEL) > 1.5 || moved > WHALE.maxSpeed * elapsed + 1) {
        l.fix = true;
        return;
      }
      this.accept(p, l, m);
      p.y = WATER_LEVEL;
      Object.assign(this.whale, { x: wx, z: wz, yaw: m.yaw });
      return;
    }
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
    const inBounds = inAnyDungeon(m.x, m.z) || inMap(m.x, m.z, 2);
    const through = clampStep(p.x, p.z, m.x, m.z, this.gates(), this.coastGates());
    // Inside, walls are a clamp: a move the clamp would change went through a wall or the shut gate.
    const wallOk = !inAnyDungeon(p.x, p.z, 2) || Math.hypot(through.x - m.x, through.z - m.z) < 0.3;
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL - 0.9);
    const cragCeiling = cragsNear(this.climbables(), m.x, m.z, CLIMB_PAD).reduce((t, c) => Math.max(t, c.top + 3), -Infinity);
    // ponytail: above ground + 4 and away from crags you may only go down (falling or gliding).
    // Hovering at a constant height passes; fine for co-op, add a sink-rate check if it's abused.
    // Riders cannot climb (no crag allowance) nor swim.
    const lifted = this.time < l.boostUntil && m.y <= l.boostCeil; // a gust's lift while gliding
    // ponytail: the frog's high jump is only a ceiling (ground + FROG.ceil), no server jump physics.
    const yOk = m.y > ground - 1 && (m.y < ground + (l.frog ? FROG.ceil : 4) || (!l.riding && !l.frog && m.y < cragCeiling) || m.y <= p.y || lifted);
    const dryOk = l.frog ? frogMoveOk(this.terrain, p, m, m.y > Math.max(this.terrain.heightAt(m.x, m.z), WATER_LEVEL) + 0.5, this.climbables()) : !l.riding || this.terrain.heightAt(m.x, m.z) >= WATER_LEVEL - 0.6;
    // The sea past 4 m turns swimmers back (they may only head shallower); gliders fly over it.
    const swimming = m.y < WATER_LEVEL - 0.5;
    const seaOk = !swimming || deepStepOk(this.terrain, p.x, p.z, m.x, m.z);
    if (!seaOk) this.hint(p.name, l, 'La corriente te devuelve');
    // The server knows who rides: only riders (and just-dismounted ones, for lag) get the deer's speed.
    const mounted = l.riding || l.frog || this.time < l.rodeUntil;
    // Walkers wade through the Ciénaga's mud (only when the whole window was spent in it, so entering is never unfair).
    const wading = !mounted && inCienaga(l.anchorX, l.anchorZ) && inCienaga(m.x, m.z);
    // El Zarzal slows walkers and riders; the bog slows walkers (same whole-window rule).
    const thorny = zarzalAt(this.terrain, l.anchorX, l.anchorZ) && zarzalAt(this.terrain, m.x, m.z);
    const bogged = !mounted && inBog(this.terrain, l.anchorX, l.anchorZ) && inBog(this.terrain, m.x, m.z);
    const cap = thorny ? ZARZAL.speed : l.riding ? MOUNT.maxSpeed : l.frog ? FROG.maxSpeed : mounted ? l.graceCap : wading ? CIENAGA.speed : bogged ? MAX_SPEED * BOG.k : MAX_SPEED;
    // ponytail: speed + bounds sanity check only, no server physics. Fine for co-op; add server-side collision if cheating matters.
    if (!inBounds || !wallOk || !yOk || !dryOk || !seaOk || moved > cap * elapsed + 1) {
      l.fix = true;
      return;
    }
    this.accept(p, l, m);
    if (l.riding) p.steed = { x: r2(p.x), z: r2(p.z) };
    if (l.frog) p.frog = { x: r2(p.x), z: r2(p.z) };
    if (m.y <= ground + 0.5) l.boosted = false; // landed (or swimming): the next flight may lift again
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

  /** Amber (S3 §6.2): 2 per tree, per player, back after 2 days. The high ones need you on the stump. */
  private onAmber(p: SavedPlayer, id: number): void {
    const t = this.amberTrees[id];
    if (!t || p.dead || Math.hypot(t.x - p.x, t.z - p.z) > AMBER.reach || p.y < t.y - 1) return;
    const at = p.amber?.[id];
    if (at !== undefined && this.time - at < AMBER.regrowDays * DAY_LENGTH) return this.tell(p.name, 'Aún no ha vuelto a brotar');
    p.amber = { ...p.amber, [id]: r2(this.time) };
    p.inv = addItem(p.inv, 'amber', AMBER.yield);
    this.tell(p.name, `${ITEM_LABELS.amber}: ${AMBER.yield}`);
  }

  /** Capa de corteza at the Heart: −10 % damage taken per level, up to 3. */
  private onCapa(p: SavedPlayer): void {
    const h = this.heart();
    if (!h || p.dead || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    const lvl = p.capaLvl ?? 0;
    if (lvl >= CAPA.max) return this.tell(p.name, 'La capa ya no admite más corteza');
    if (!hasAll(p.inv, CAPA.cost)) return this.tell(p.name, 'Faltan materiales');
    p.inv = removeAll(p.inv, CAPA.cost);
    p.capaLvl = lvl + 1;
    this.tell(p.name, `${NAMES.capa} ${p.capaLvl}: −${Math.round(CAPA.step * 100 * p.capaLvl)} % de daño`);
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
    // S3-E: three Llamaradas burn the peat wall.
    if (s.kind === 'peat') return this.tell(p.name, 'Raíces de turba. Esto solo arde. Vuelve luego');
    if (!this.shrineOpen(id)) return this.tell(p.name, 'Una verja de luz lo protege');
    p.shrines = [...cleared, id];
    // The shrine's light cleanses the corrupt zone of its own biome nearest it, never a Raíz-madre's
    // (forest 0 takes the Tragón, coast 6 the Antenón, swamp 10 El Zancudo).
    const biome = (i: number) => (isSwampZone(i) ? 'swamp' : isCoastZone(i) ? 'coast' : 'forest');
    const mine = s.id >= SWAMP_SHRINE.firstId ? 'swamp' : s.id >= COAST_SHRINE.firstId ? 'coast' : 'forest';
    const ids = this.corrupt().filter((i) => i !== 0 && i !== COAST_ZONES.root && i !== SWAMP_ZONES.root && biome(i) === mine);
    const zn = nearestZone(this.zones, s.x, s.z, ids);
    if (mine === 'swamp') {
      p.inv = addItem(p.inv, 'amber', AMBER.orb);
      this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento y ${AMBER.orb} de ${NAMES.amber}`);
    } else this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento`);
    const where = { forest: 'bosque', coast: 'costa', swamp: 'pantano' }[mine];
    if (zn) this.cleanse(zn.id, `La luz del santuario limpia un trozo de ${where}`);
  }

  /** Levers, wheels and Marea's pumice block. */
  private onShrinePart(p: SavedPlayer, s: Shrine, st: (typeof this.shrineLive)[number], part: number): void {
    if (s.kind === 'candles') return this.onCandle(p, s, st, part);
    if (s.kind === 'tide') {
      const b = st.block!;
      if (part !== 1) return;
      if (b.held === p.name) {
        Object.assign(b, { x: r2(p.x), z: r2(p.z), held: null });
        return;
      }
      if (b.held || Math.hypot(b.x - p.x, b.z - p.z) > SHRINE.partReach) return;
      b.held = p.name;
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
    if (s.kind === 'fan') return this.tell(p.name, `La verja-molino no se mueve. Quizá con ${NAMES.powerWind.toLowerCase()}… o con tres manos`);
    return this.tell(p.name, s.kind === 'sunken' ? 'La palanca cede. Falta la otra, y hay prisa' : 'La palanca cede. Falta la otra');
  }

  /** Candiles: part 4 = take a torch at the post; 1–3 = light that brazier with it (the torch is spent). */
  private onCandle(p: SavedPlayer, s: Shrine, st: (typeof this.shrineLive)[number], part: number): void {
    const l = this.live.get(p.name);
    const spot = s.parts[part - 1];
    if (!l || !spot || Math.hypot(spot.x - p.x, spot.z - p.z) > SHRINE.partReach) return;
    if (part === 4) {
      if (l.torch) return this.tell(p.name, 'Ya llevas una antorcha');
      l.torch = true;
      return this.tell(p.name, 'Una antorcha. A junto a un brasero');
    }
    // S3-E: a Llamarada lights a brazier without a torch.
    if (!l.torch) return this.tell(p.name, 'Hace falta fuego');
    l.torch = false;
    st.lit[part - 1] = this.time + SWAMP_SHRINE.litFor;
    if (st.lit.every((t) => this.time < t)) {
      st.openUntil = this.time + SHRINE.openFor;
      return this.tell(p.name, 'Los tres braseros arden. Algo se abre en el santuario');
    }
    this.tell(p.name, 'El brasero prende. La antorcha se consume');
  }

  private onPower(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!p.enredadera) return this.tell(p.name, 'Aún no tienes ese poder');
    if (this.time + EPS < l.powerReadyAt) return this.tell(p.name, `La enredadera aún no brota (${Math.ceil(l.powerReadyAt - this.time - EPS)} s)`);
    const offMap = inDungeon(p.x, p.z) ? !inDungeon(x, z, -1) : inCoastDungeon(p.x, p.z) ? !inCoastDungeon(x, z, -1) : !inMap(x, z, 4);
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
    // Coast roots wither to Viento, not Enredadera (see onGust).
    const zn = this.zones.find((z) => z.id !== 0 && !isCoastZone(z.id) && !isSwampZone(z.id) && !this.cleansed.has(z.id) && Math.hypot(z.x - plan.x, z.z - plan.z) <= CORRUPTION.cleanseReach);
    if (zn) this.cleanse(zn.id, 'La raíz marchita se seca. El bosque respira');
    // S3-E: a Llamarada within CORRUPTION.cleanseReach of a swamp root (11–13) cleanses it: "El fuego seca la raíz marchita. El pantano respira".
    // S3-F: beating El Zancudo cleanses zone 10 (SWAMP_ZONES.root).
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

  /** Viento: a gust in a cone. Pushes, stuns and scratches enemies (the sea takes beasts), slides pumice, turns fans, cleanses coast roots, lifts a glider once per flight. */
  private onGust(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!p.viento) return this.tell(p.name, 'Aún no tienes ese poder');
    if (this.time + EPS < l.windReadyAt) return this.tell(p.name, `El viento aún no vuelve (${Math.ceil(l.windReadyAt - this.time - EPS)} s)`);
    l.windReadyAt = this.time + VIENTO.cooldown;
    const dir = gustDir(p.x, p.z, x, z);
    const hits = (tx: number, tz: number, range: number = VIENTO.range) => inGust(p.x, p.z, dir, tx, tz, range);
    const ground = Math.max(this.terrain.heightAt(p.x, p.z), WATER_LEVEL);
    if (!l.boosted && p.y > ground + 1.5 && !l.riding && !l.fish && this.seatOf(p.name) === null) {
      l.boosted = true;
      l.boostCeil = p.y + VIENTO.boost + 0.5;
      l.boostUntil = this.time + VIENTO.boostFor;
    }
    this.gustEnemies(p, dir, hits);
    this.gustThings(p, dir, hits);
  }

  private gustEnemies(p: SavedPlayer, dir: Dir, hits: (x: number, z: number) => boolean): void {
    const foes: Wolf[] = [...this.wolves, ...(this.elite ? [this.elite] : []), ...(this.shield ? [this.shield] : []), ...(this.boss ? [this.boss] : []), ...(this.boss2 ? [this.boss2] : []), ...(this.marchito ? [this.marchito] : []), ...this.anchorFoes];
    let drowned = 0;
    for (const w of foes) {
      if (w.hp <= 0 || !hits(w.x, w.z)) continue;
      if (w.kind === 'anchor') {
        this.strike(p.name, w, VIENTO.damage * RESCUE.gustMult);
        continue;
      }
      if (w === this.boss2) {
        this.gustAntenon(p.name, this.boss2, dir);
        continue;
      }
      const heavy = w.kind !== 'wolf' && w.kind !== 'brute';
      const was = this.terrain.heightAt(w.x, w.z);
      let to = slide(w.x, w.z, dir, heavy ? VIENTO.heavyPush : VIENTO.push);
      if (!inAnyDungeon(w.x, w.z)) to = clampMap(to.x, to.z, 3);
      w.x = to.x;
      w.z = to.z;
      w.y = this.terrain.heightAt(w.x, w.z);
      w.stun = Math.max(w.stun, VIENTO.stun);
      if (w === this.marchito) {
        this.wearMarchito(p.name, VIENTO.damage);
        continue;
      }
      this.onGusted(w);
      if (w === this.boss && this.boss.weak <= 0) continue; // folded paper shrugs off the scratch
      if (!heavy && drowned < VIENTO.waterKills && depthAt(this.terrain, w.x, w.z) > SWIM_MAX_DEPTH) {
        drowned++;
        hitWolf(w, w.hp);
        this.say('Se los lleva el mar');
        continue;
      }
      const fall = !heavy && w.y < was - VIENTO.ledge ? VIENTO.ledgeDamage : 0;
      this.strike(p.name, w, VIENTO.damage + fall);
    }
  }

  /** El Antenón moves 2 m; into a coral pillar, its shell cracks open (spec §7.3). */
  private gustAntenon(name: string, a: Antenon, dir: Dir): void {
    a.stun = Math.max(a.stun, VIENTO.stun);
    if (pushAntenon(a, dir, VIENTO.heavyPush)) {
      a.exposed = Math.max(a.exposed, ANTENON.slamFor);
      a.stun = Math.max(a.stun, ANTENON.slamStun);
      this.say('¡Contra el coral! La cáscara se abre');
    }
    if (a.exposed > 0) this.strike(name, a, VIENTO.damage);
  }

  /** Hook for enemies that react to wind (the bruto escudado turns around). */
  private onGusted(w: Wolf): void {
    if (w !== this.shield) return;
    this.shield.yaw += Math.PI;
    this.shield.exposed = ELITE.exposedFor;
    this.say(`El ${NAMES.eliteCoast} gira con la ráfaga. ¡Espalda al aire!`);
  }

  private gustThings(p: SavedPlayer, dir: Dir, hits: (x: number, z: number, range?: number) => boolean): void {
    const C = COAST_DUNGEON;
    const g = this.coastLive;
    if (inCoastDungeon(p.x, p.z)) {
      const fan = insideCoast(C.fan);
      if (!g.fan && hits(fan.x, fan.z)) {
        g.fan = true;
        this.say('El molino gira con la ráfaga. La verja se abre');
      }
      if (hits(g.block.x, g.block.z)) {
        const to = slide(g.block.x, g.block.z, dir, VIENTO.slide);
        g.block.x = Math.max(C.x - C.halfW + 1, Math.min(C.x + C.halfW - 1, to.x));
        g.block.z = Math.max(C.gatesZ[1] + 1, Math.min(C.gatesZ[2] - 1, to.z));
      }
    }
    this.shrines.forEach((s, id) => {
      const st = this.shrineLive[id]!;
      if (s.kind === 'tide' && st.block && !st.block.held && hits(st.block.x, st.block.z)) {
        const to = slide(st.block.x, st.block.z, dir, VIENTO.slide);
        Object.assign(st.block, { x: r2(to.x), z: r2(to.z) });
      }
      if (s.kind === 'fan' && !this.shrineOpen(id) && s.parts.some((w) => hits(w.x, w.z))) {
        st.pulled = st.pulled.map(() => this.time);
        st.openUntil = this.time + SHRINE.openFor;
        this.tell(p.name, 'El viento gira las tres ruedas a la vez. Algo se abre en el santuario');
      }
    });
    for (const zn of this.zones) {
      if (!isCoastZone(zn.id) || zn.id === COAST_ZONES.root || this.cleansed.has(zn.id)) continue;
      if (hits(zn.x, zn.z, VIENTO.rootReach)) this.cleanse(zn.id, 'El viento arranca la raíz marchita. La costa respira');
    }
  }

  /** The purified Tragón lives by a living Heart and bites raiders that come near it. */
  private stepAlly(dt: number): void {
    const h = this.heart();
    if (!this.purified || this.invasion2 === 'taken' || !h || h.hp <= 0) {
      this.ally = null;
      return;
    }
    this.ally ??= createAlly(h, this.terrain);
    if (this.marchito && this.marchito.grab) {
      this.ally.anim = 'idle'; // wrapped in roots
      return;
    }
    const foe = stepAlly(this.ally, h, this.wolves, this.terrain, dt);
    if (foe) hitWolf(foe, ALLY.damage + (this.invasion2 === 'rescued' ? ALLY.rage : 0));
  }

  /** The purified Antenón lives by a living Heart and gusts raiders away from it every 8 s. */
  private stepAlly2(dt: number): void {
    const h = this.heart();
    if (!this.purified2 || !h || h.hp <= 0) {
      this.ally2 = null;
      return;
    }
    const at = (x: number, z: number) => this.terrain.heightAt(x, z);
    this.ally2 ??= createGustAlly(h, at);
    if (stepGustAlly(this.ally2, h, this.wolves, at, dt)) this.say(`${NAMES.bossCoast} sopla. Los asaltantes vuelan lejos del ${NAMES.heart}`);
  }

  /** Wolves, raiders or the boss. */
  private enemy(id: number): Wolf | undefined {
    if (this.marchito && this.marchito.id === id) return this.marchito;
    const anchor = this.anchorFoes.find((a) => a.id === id);
    if (anchor) return anchor;
    if (this.elite && this.elite.id === id) return this.elite;
    if (this.shield && this.shield.id === id) return this.shield;
    if (this.boss2 && this.boss2.id === id) return this.boss2;
    return this.boss && this.boss.id === id ? this.boss : this.wolves.find((x) => x.id === id);
  }

  /** Hurt an enemy for a player; the folded boss shrugs it off. */
  private strike(name: string, w: Wolf, dmg: number): void {
    if (w === this.marchito) return this.wearMarchito(name, dmg);
    if (w.kind === 'anchor') {
      if (hitWolf(w, dmg)) this.breakAnchor(w);
      return;
    }
    if (w === this.boss && this.boss.weak <= 0) return this.tell(name, 'El papel doblado aguanta. Párale o enrédalo');
    if (w === this.boss2 && this.boss2.exposed <= 0) return this.tell(name, 'La cáscara de marea aguanta. Empújalo contra el coral, o párale');
    const by = this.players.get(name);
    if (w === this.shield && by && shieldBlocks(w as Elite, by.x, by.z)) return this.tell(name, 'El escudo para el golpe. Dale la vuelta con viento, o párale');
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
    if (act >= 8) return this.onCoastDungeon(p, l, act, near);
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

  /** The coast Raíz-madre: 8 enter, 9 leave, 10/11 levers, 12 the Viento altar. */
  private onCoastDungeon(p: SavedPlayer, l: Live, act: number, near: (x: number, z: number, r: number) => boolean): void {
    const C = COAST_DUNGEON;
    const e = this.coastEntrance;
    if (act === 8) {
      if (!near(e.x, e.z, C.trunkR + C.enterReach)) return;
      this.teleport(p, l, C.x, C.entryZ + 1.5);
      return this.tell(p.name, `Dentro de la ${NAMES.coastRoot}. Huele a sal y a raíz mojada`);
    }
    if (!inCoastDungeon(p.x, p.z)) return;
    const g = this.coastLive;
    if (act === 9) {
      if (!near(C.x, C.entryZ, C.exitReach)) return;
      return this.teleport(p, l, e.x, e.z - (C.trunkR + 2));
    }
    if (act === 10 || act === 11) {
      const i = act - 10;
      const lever = insideCoast(C.levers[i]!);
      if (!near(lever.x, lever.z, C.leverReach) || g.gate) return;
      g.pulled[i] = this.time;
      const other = g.pulled[1 - i];
      if (other != null && this.time - other <= C.leverWindow + EPS) {
        g.gate = true;
        return this.say('La verja de raíces se abre. Gotea');
      }
      return this.tell(p.name, 'La raíz cede. Falta la otra');
    }
    if (act === 12) {
      if (!g.gate || !near(C.x, C.altarZ, C.altarReach) || p.viento) return;
      p.viento = true;
      this.tell(p.name, `Despierta el ${NAMES.powerWind}: J cambia de poder (o mantén pulsado el botón de poder), H lanza una ráfaga`);
    }
  }

  /** Which of the four coast gates are open: levers, fan, plate, the bruto escudado. */
  private coastGates(): boolean[] {
    const g = this.coastLive;
    return [g.gate, g.fan, g.plate, g.eliteDown];
  }

  /** The chasm spits fallers back to its near edge; the plate reads the block. */
  private stepCoastDungeon(): void {
    const C = COAST_DUNGEON;
    const g = this.coastLive;
    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null || !inChasm(p.x, p.z) || p.y > C.floor - C.fallBelow) continue;
      this.teleport(p, l, p.x, C.fallBack);
      p.vitals = damage(p.vitals, C.fallDamage * capaMult(p.capaLvl ?? 0));
      this.tell(name, 'El hueco te escupe arriba. Sin viento no se cruza');
      if (p.vitals.health <= 0) this.kill(p);
    }
    const plate = insideCoast(C.plate);
    if (!g.plate && Math.hypot(g.block.x - plate.x, g.block.z - plate.z) <= C.plateRadius) {
      g.plate = true;
      this.say('La piedra pómez pisa la losa. La verja se abre');
    }
  }

  private onMount(p: SavedPlayer, l: Live, act: number, at: number | undefined): void {
    if (p.dead) return;
    if (act === 5) return this.dismount(p, l);
    if (l.seat) return; // sitting behind someone: only getting off
    if (this.seatOf(p.name) !== null) return act === 11 ? this.leaveWhale(p, l) : undefined; // aboard: only getting off
    if (act === 1 && !l.tame && this.whaleTame) return this.whaleTap(p, at);
    if (act >= 12) return this.onFrogAct(p, l, act);
    if (act >= 9) return this.onWhaleAct(p, l, act);
    if (act >= 6) return this.onFishAct(p, l, act);
    if (l.fish || l.frog || l.race) return; // on (or chasing) the fish or the frog: no deer
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
        if (this.invasion2 === 'none') this.invasion2 = 'pending';
        return this.tell(p.name, 'El pez es tuyo. B para bucear, A en la orilla para bajar');
      }
      if (t.beast === 'frog') {
        p.frog = { x: r2(p.x), z: r2(p.z) };
        l.frog = true;
        return this.tell(p.name, 'La rana es tuya. B para el salto alto, A para bajar');
      }
      p.steed = { x: r2(p.x), z: r2(p.z) };
      l.riding = true;
      return this.tell(p.name, 'El ciervo es tuyo. A para bajar, A junto a él para montar');
    }
    if (act === 2) {
      const st = p.steed;
      if (!st || l.riding || l.tame || inAnyDungeon(p.x, p.z) || Math.hypot(st.x - p.x, st.z - p.z) > MOUNT.reach) return;
      l.riding = true;
      return;
    }
    if (act === 3) this.dismount(p, l);
  }

  /** Sit behind the nearest rider in reach whose seat is free. */
  private board(p: SavedPlayer, l: Live): void {
    if (l.riding || l.frog || l.tame || inAnyDungeon(p.x, p.z)) return;
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
    if (this.seatOf(p.name) !== null) return this.leaveWhale(p, l);
    if (l.seat) {
      l.seat = null;
      l.rodeUntil = this.time + MOUNT.grace;
      l.graceCap = MOUNT.maxSpeed;
      return;
    }
    if (l.frog) {
      l.frog = false;
      l.rodeUntil = this.time + FROG.grace;
      l.graceCap = FROG.maxSpeed;
      p.frog = { x: r2(p.x), z: r2(p.z) };
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

  private nextRound(l: Live, round: number, beast: Beast, ax: number, az: number): void {
    l.tame = { round, start: r2(this.time), zone: r2(this.rng() * Math.PI * 2), beast, ax, az };
  }

  private throwOff(p: SavedPlayer, l: Live): void {
    const chased = l.tame?.beast === 'fish' || l.tame?.beast === 'frog';
    l.tame = null;
    if (chased) {
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
      if (!f || l.fish || l.frog || l.riding || l.tame || l.race || inAnyDungeon(p.x, p.z) || Math.hypot(f.x - p.x, f.z - p.z) > FISH.reach) return;
      l.fish = true;
      return;
    }
    if (l.race || l.tame || l.riding || l.fish || l.frog || Math.hypot(this.fishHome.x - p.x, this.fishHome.z - p.z) > FISH.reach) return;
    if (p.fish) return this.tell(p.name, 'Ya tienes pez');
    if (this.time + EPS < l.raceReadyAt) return this.tell(p.name, 'El pez aún recela');
    l.race = { i: 0, deadline: this.time + FISH.ringTime, beast: 'fish' };
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
      const frog = r.beast === 'frog';
      const list = frog ? this.frogPads : this.fishRings;
      const ring = list[r.i]!;
      if (Math.hypot(ring.x - p.x, ring.z - p.z) <= (frog ? FROG.padR : FISH.ringR)) {
        r.i++;
        r.deadline = this.time + (frog ? FROG.padTime : FISH.ringTime);
        if (r.i < list.length) continue;
        l.race = null;
        this.nextRound(l, 0, r.beast, ring.x, ring.z);
        this.tell(p.name, frog ? 'La alcanzas. Ahora, cálmala' : 'Lo alcanzas. Ahora, cálmalo');
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

  /** La Rana's acts: 12 start the lily-pad chase, 13 get on, 14 get off (anywhere: it waits there). */
  private onFrogAct(p: SavedPlayer, l: Live, act: number): void {
    if (act === 14) return l.frog ? this.dismount(p, l) : undefined;
    const busy = l.frog || l.fish || l.riding || l.tame || l.race || inAnyDungeon(p.x, p.z);
    if (act === 13) {
      const f = p.frog;
      if (!f || busy || Math.hypot(f.x - p.x, f.z - p.z) > FROG.reach) return;
      l.frog = true;
      return;
    }
    if (busy || Math.hypot(this.frogHome.x - p.x, this.frogHome.z - p.z) > FROG.reach) return;
    if (p.frog) return this.tell(p.name, 'Ya tienes rana');
    if (this.time + EPS < l.raceReadyAt) return this.tell(p.name, 'La rana aún recela');
    l.race = { i: 0, deadline: this.time + FROG.padTime, beast: 'frog' };
    this.tell(p.name, `Salta al agua. Sigue los ${FROG.pads} nenúfares, ${FROG.padTime} s cada uno`);
  }

  /** The wild frog plus every parked (not ridden) tamed one in view. */
  private frogViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    const h = this.frogHome;
    if (near(h.x, h.z)) out.push({ owner: null, x: r2(h.x), y: r2(this.terrain.heightAt(h.x, h.z)), z: r2(h.z), yaw: 0 });
    for (const o of this.players.values()) {
      const f = o.frog;
      if (!f || this.live.get(o.name)?.frog || !near(f.x, f.z)) continue;
      out.push({ owner: o.name, x: f.x, y: r2(Math.max(this.terrain.heightAt(f.x, f.z), WATER_LEVEL)), z: f.z, yaw: 0 });
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
    if (act === 10) return this.boardWhale(p, l);
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

  /** First free seat (the first aboard pilots). From the fish: it waits where you were. */
  private boardWhale(p: SavedPlayer, l: Live): void {
    if (!this.whaleTamed || l.riding || l.frog || l.tame || l.race || inAnyDungeon(p.x, p.z) || Math.hypot(this.whale.x - p.x, this.whale.z - p.z) > WHALE.reach) return;
    const free = this.whaleSeats.indexOf(null);
    if (free < 0) return this.tell(p.name, 'No queda sitio');
    if (l.fish) {
      l.fish = false;
      p.fish = { x: r2(p.x), z: r2(p.z) };
    }
    this.whaleSeats[free] = p.name;
    this.whaleIdle = 0;
    this.placeOnWhale(p, l, free, true);
    l.fix = true;
    this.tell(p.name, free === 0 ? 'Llevas la ballena. A para bajar' : 'Subes a la ballena. A para bajar');
  }

  private placeOnWhale(p: SavedPlayer, l: Live, seat: number, fresh = false): void {
    const off = seatOffset(seat, this.whale.yaw);
    p.x = r2(this.whale.x + off.x);
    p.z = r2(this.whale.z + off.z);
    p.y = WATER_LEVEL;
    if (seat === 0 && !fresh) return; // the pilot's own validated moves keep their speed window
    l.anchorX = p.x;
    l.anchorZ = p.z;
    l.anchorAt = this.time;
    l.lastAcceptedAt = this.time;
  }

  /** Off the whale, into the water beside it (or onto your fish if it waits close). The next seat moves up. */
  private leaveWhale(p: SavedPlayer, l: Live): void {
    const i = this.whaleSeats.indexOf(p.name);
    if (i < 0) return;
    const rest = this.whaleSeats.filter((n, j) => n !== null && j !== i);
    for (let j = 0; j < WHALE.seats; j++) this.whaleSeats[j] = rest[j] ?? null;
    const c = Math.cos(this.whale.yaw);
    const n = Math.sin(this.whale.yaw);
    p.x = r2(this.whale.x + c * 3);
    p.z = r2(this.whale.z - n * 3);
    p.y = WATER_LEVEL - 0.9;
    const f = p.fish;
    if (f && !p.dead && Math.hypot(f.x - p.x, f.z - p.z) <= WHALE.fishBack) {
      p.x = f.x;
      p.z = f.z;
      l.fish = true;
    }
    l.rodeUntil = this.time + MOUNT.grace;
    l.graceCap = Math.max(WHALE.maxSpeed, FISH.maxSpeed);
    l.fix = true;
    l.anchorX = p.x;
    l.anchorZ = p.z;
    l.anchorAt = this.time;
    l.lastAcceptedAt = this.time;
  }

  /** Riders gone, dead or asleep get off; everyone aboard is placed on their seat; alone 10 min, it swims home. */
  private stepWhale(dt: number): void {
    for (const n of [...this.whaleSeats]) {
      if (n === null) continue;
      const p = this.players.get(n);
      const l = this.live.get(n);
      if (!l) {
        this.whaleSeats[this.whaleSeats.indexOf(n)] = null;
        continue;
      }
      if (p!.dead || l.awayFor !== null) this.leaveWhale(p!, l);
    }
    const rest = this.whaleSeats.filter((n) => n !== null);
    for (let j = 0; j < WHALE.seats; j++) this.whaleSeats[j] = rest[j] ?? null;
    this.whaleSeats.forEach((n, i) => {
      if (n !== null) this.placeOnWhale(this.players.get(n)!, this.live.get(n)!, i);
    });
    if (!this.whaleTamed || rest.length > 0 || this.activeCount() === 0) {
      this.whaleIdle = 0;
      return;
    }
    this.whaleIdle += dt;
    if (this.whaleIdle >= WHALE.idle) {
      Object.assign(this.whale, { ...this.whaleHome, yaw: 0 });
      this.whaleIdle = 0;
    }
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
    const c = this.coastLive;
    const coast = {
      gates: this.coastGates(),
      levers: c.pulled.map((t) => t != null && (c.gate || this.time - t <= COAST_DUNGEON.leverWindow + EPS)),
      block: { x: r2(c.block.x), z: r2(c.block.z) },
      plate: c.plate,
      boss: this.boss2 && this.boss2.hp > 0 ? { hp: Math.round(this.boss2.hp), max: ENEMY.boss2.hp, exposed: this.boss2.exposed > 0, tell: this.boss2.windup > 0 ? this.boss2.move : null } : null,
      elite: this.shield && this.shield.hp > 0 ? { hp: Math.round(this.shield.hp), max: ENEMY.elite2.hp, exposed: this.shield.exposed > 0, charging: this.shield.windup > 0 || this.shield.charge > 0 } : null,
    };
    return { gate: g.gate, gates: this.gates(), levers: pulled, purified: this.purified, boss, plate: g.pressed, block: carry(g.block), lantern: carry(g.lantern), lit: g.lit, elite, coast };
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

  /** El Antenón lives while someone alive is in its room; an empty room resets it. Beaten once: purified, zone 6 clean, a vision. */
  private stepAntenonFight(dt: number): void {
    const a = this.boss2;
    if (a && a.hp <= 0 && !this.purified2) {
      this.purified2 = true;
      this.say(`${NAMES.bossCoast} se deshace en espuma limpia. Ahora sopla por el ${NAMES.heart}`);
      this.cleanse(COAST_ZONES.root, `La ${NAMES.coastRoot} deja de supurar morado. Nada más sube de la costa`);
      this.vision(VISION.purified2(joinNames(this.activeNames())));
    }
    if (this.purified2) {
      if (a && a.hp <= 0) {
        a.deadFor += dt;
        if (a.deadFor >= ANTENON.corpseTime) this.boss2 = null;
      } else this.boss2 = null;
      return;
    }
    const fighters = this.targets().filter((t) => !t.dead && inCoastBossRoom(t.x, t.z));
    if (!fighters.length) {
      this.boss2 = null;
      return;
    }
    if (!this.boss2) {
      this.boss2 = createAntenon();
      this.say(`${NAMES.bossCoast} despierta. Su cáscara de marea no se rompe: empújalo contra el coral, o párale`);
    }
    const b = this.boss2;
    for (const hit of stepAntenon(b, fighters, dt)) this.bite(hit.name, hit.dmg, b);
  }

  /** The bruto escudado, like the forest elite: lives while someone is in its room; once down, gate 3 opens. */
  private stepShieldFight(dt: number): void {
    const g = this.coastLive;
    const e = this.shield;
    if (e && e.hp <= 0) {
      if (!g.eliteDown) {
        g.eliteDown = true;
        this.say(`El ${NAMES.eliteCoast} suelta el escudo y se deshace en espuma. La última verja se abre`);
      }
      e.deadFor += dt;
      if (e.deadFor >= ELITE.corpseTime) this.shield = null;
      return;
    }
    if (g.eliteDown) return;
    const fighters = this.targets().filter((t) => !t.dead && inShieldRoom(t.x, t.z));
    if (!fighters.length) {
      this.shield = null;
      return;
    }
    if (!this.shield) {
      this.shield = createShielded();
      this.say(`Un ${NAMES.eliteCoast} se levanta. De frente no le entra nada`);
    }
    const hit = stepElite(this.shield, fighters, dt);
    if (hit) this.bite(hit.name, hit.dmg, this.shield);
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
      if (s.kind === 'candles') return { id, open, parts: [...st.lit.map((t) => this.time < t), false] };
      if (s.kind === 'lilies') return { id, open, parts: st.pads.map((q) => this.time >= q.downUntil) };
      if (s.kind === 'peat') return { id, open: false, parts: [] };
      if (s.kind === 'tide') return { id, open, parts: [st.pressed], block: { x: r2(st.block!.x), z: r2(st.block!.z), held: st.block!.held } };
      const window = s.kind === 'fan' ? COAST_SHRINE.wheelWindow : s.kind === 'sunken' ? COAST_SHRINE.sunkenWindow : SHRINE.leverWindow;
      const parts = s.parts.map((_, i) => st.pulled[i] != null && (open || this.time - st.pulled[i]! <= window + EPS));
      return { id, open, parts };
    });
  }

  private stepShrines(): void {
    for (const [name, l] of this.live) if (l.torch && this.players.get(name)!.dead) l.torch = false; // dropped in the mud
    this.shrines.forEach((s, id) => {
      if (s.kind === 'lilies') return this.stepLilies(id);
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

  /** Nenúfares: a pad sinks a while after someone stands on it, and comes back; standing on the last one opens the gate. */
  private stepLilies(id: number): void {
    const S = SWAMP_SHRINE;
    const s = this.shrines[id]!;
    const st = this.shrineLive[id]!;
    const top = WATER_LEVEL + S.padTop;
    st.pads.forEach((q, i) => {
      if (this.time < q.downUntil) return;
      const pad = s.parts[i]!;
      const on = [...this.live].some(([name, l]) => {
        const p = this.players.get(name)!;
        return !p.dead && l.awayFor === null && Math.hypot(pad.x - p.x, pad.z - p.z) <= S.padR + 0.3 && p.y > top - 0.5 && p.y < top + 1.5;
      });
      if (on) {
        q.at ??= this.time;
        if (i === st.pads.length - 1) st.openUntil = this.time + SHRINE.openFor;
      }
      if (q.at !== null && this.time - q.at >= S.sinkAfter - EPS) {
        q.at = null;
        q.downUntil = this.time + S.downFor;
      }
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
      viento: !!p.viento,
      windLeft: Math.max(0, Math.ceil(l.windReadyAt - this.time - EPS)),
      tame: this.tameView(p, l),
      riding: l.riding,
      steed: !!p.steed,
      seat: l.seat,
      fish: !!p.fish,
      onFish: l.fish,
      race: l.race ? { i: l.race.i, deadline: r2(l.race.deadline), beast: l.race.beast } : null,
      frog: !!p.frog,
      onFrog: l.frog,
      torch: !!l.torch,
      amber: this.amberTrees.filter((t) => p.amber?.[t.id] !== undefined && this.time - p.amber[t.id]! < AMBER.regrowDays * DAY_LENGTH).map((t) => t.id),
      capa: p.capaLvl ?? 0,
      chests: [...(p.chests ?? [])],
      weapon: p.weaponLvl ?? 0,
      whaleSeat: this.seatOf(p.name),
    };
  }

  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    if (inAnyDungeon(x, z)) return true; // warm inside the Raíz-madre
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
      if (!zn || !corrupt.includes(zn.id) || inAnyDungeon(a.x, a.z)) continue;
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
    if (!this.swampSeen && this.activeNames().some((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && inSwamp(p.x, p.z);
    })) this.swampSeen = true;
    if (!this.raid && heart && heart.hp > 0 && !night && f >= RAID.warnAt && this.activeCount() > 0) {
      // Raids come from the nearest corrupt zone (spec §3); with none left, from the Raíz-madre.
      const corrupt = this.corrupt();
      const src = nearestZone(this.zones, heart.x, heart.z, corrupt);
      this.raid = { phase: 'warn', dir: raidDirFrom(heart, this.zones, corrupt, this.rootDir(heart)) + (this.rng() - 0.5) * RAID.jitter };
      const where = !src || src.id === 0 ? `la ${NAMES.forestRoot}` : 'una zona marchita';
      this.raidN++;
      this.raid.gata = gataLeads(this.raidN, this.swampSeen, corrupt);
      const coast = (coastRaidBrutes(corrupt) > 0 ? '. Algo sube de la costa' : '') + (this.raid.gata ? `. ${NAMES.lieutenant1} guía el asedio esta noche` : '');
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
      this.gataId = null;
      this.raidFlee = 0;
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
    // La Gata Araña walks in behind her pack.
    if (this.raid?.gata) {
      for (let tries = 0; tries < 20; tries++) {
        const ang = dir + (this.rng() - 0.5) * 0.8;
        const d = RAID.spawnMax + GATA.behind;
        const x = heart.x + Math.sin(ang) * d;
        const z = heart.z + Math.cos(ang) * d;
        if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, 'lieut1');
          w.raid = true;
          this.wolves.push(w);
          this.gataId = w.id;
          break;
        }
      }
    }
  }

  /** When La Gata Araña falls: amber to everyone near, a vision, and the rest of her raid flees and is gone in 3 s. */
  private stepGataFall(dt: number): void {
    if (this.raidFlee > 0) {
      this.raidFlee = Math.max(0, this.raidFlee - dt);
      if (this.raidFlee === 0) this.wolves = this.wolves.filter((w) => !w.raid || w.kind === 'lieut1');
      return;
    }
    const g = this.gataId === null ? undefined : this.wolves.find((w) => w.id === this.gataId);
    if (this.gataId === null || (g && g.hp > 0)) return;
    this.gataId = null;
    if (!g) return;
    this.raidFlee = GATA.fleeFor;
    const present = this.activeNames().filter((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && Math.hypot(p.x - g.x, p.z - g.z) <= GATA.present;
    });
    for (const n of present) {
      const p = this.players.get(n)!;
      p.inv = addItem(p.inv, 'amber', GATA.amber);
      this.tell(n, `${NAMES.lieutenant1} deja ${GATA.amber} de ${NAMES.amber}`);
    }
    this.say(`${NAMES.lieutenant1} cae. Su manada huye`);
    this.vision(VISION.gata(joinNames(present.length ? present : this.activeNames())));
  }

  /** A raider running away from the Heart. */
  private flee(w: Wolf, goal: RaidGoal, dt: number): void {
    if (w.hp <= 0) return;
    const d = Math.max(Math.hypot(w.x - goal.x, w.z - goal.z), 1e-4);
    const { x, z } = clampMap(w.x + ((w.x - goal.x) / d) * ENEMY[w.kind].run * dt, w.z + ((w.z - goal.z) / d) * ENEMY[w.kind].run * dt, 4);
    [w.x, w.z] = [x, z];
    w.y = this.terrain.heightAt(x, z);
    w.yaw = Math.atan2(w.x - goal.x, w.z - goal.z);
    w.anim = 'run';
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
      if (w === this.shield) this.shield.exposed = ELITE.exposedFor;
      if (w === this.boss2) this.boss2.exposed = Math.max(this.boss2.exposed, ANTENON.parryFor);
      this.strike(name, w, BLOCK.parryDamage);
      return this.tell(name, w === this.boss ? 'Parada: el papel se desdobla' : w === this.boss2 ? 'Parada: la cáscara se abre' : 'Parada');
    }
    p.vitals = damage(p.vitals, out.dmg * capaMult(p.capaLvl ?? 0));
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
      const watcher = this.targets().some((t) => !t.dead && !inAnyDungeon(t.x, t.z));
      if (watcher) this.startInvasion(h);
    }
    const m = this.marchito;
    if (!m || m.grab !== null || this.activeCount() === 0) return; // the world sleeps (or it is Invasion 2)
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

  /** Invasion 2 (Slice 2 §8): at dusk, once someone tamed a fish, he comes up from the coast for the purified Tragón. */
  private stepInvasion2(dt: number): void {
    const h = this.heart();
    if (this.invasion2 === 'pending' && !this.marchito && this.invasion === 'done' && this.purified && h && h.hp > 0) {
      const f = dayFraction(this.time);
      const watcher = this.targets().some((t) => !t.dead && !inAnyDungeon(t.x, t.z));
      if (!isNight(f) && f >= RAID.warnAt && watcher) this.startTheft(h);
    }
    const m = this.marchito;
    if (!m || m.grab === null || this.activeCount() === 0) return;
    const goal = this.ally ?? (h ? { x: h.x + ALLY.home, z: h.z } : m);
    const ev = stepThief(m, goal, this.targets(), (x, z) => this.terrain.heightAt(x, z), dt);
    if (ev?.t === 'swipe') this.bite(ev.name, ENEMY.marchito.damage, m);
    else if (ev) this.endTheft(true);
  }

  /** Live records for the anchors still standing (only while the Tragón is taken). */
  private buildAnchors(): void {
    if (this.invasion2 !== 'taken') {
      this.anchorFoes = [];
      return;
    }
    this.anchorFoes = this.rescue.anchors.flatMap((a, i) =>
      this.anchors[i] ? [] : [{ id: RESCUE.anchorIdBase + i, x: a.x, y: this.terrain.heightAt(a.x, a.z), z: a.z, yaw: 0, hp: RESCUE.anchorHp, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle' as const, raid: false, kind: 'anchor' as const, stun: 0 }],
    );
  }

  private breakAnchor(w: Wolf): void {
    this.anchors[w.id - RESCUE.anchorIdBase] = true;
    this.anchorFoes = this.anchorFoes.filter((a) => a !== w);
    const left = this.anchors.filter((b) => !b).length;
    this.say(left ? `Se parte una cadena. La jaula baja. Quedan ${left}` : `Se parte la última cadena. La jaula del ${NAMES.bossForestShort} se suelta en el fondo`);
  }

  /** The first time someone reaches an islet whose anchor stands, two corrupt wolves come out to guard it. */
  private stepGuards(): void {
    if (this.invasion2 !== 'taken') return;
    const islets = coastFeatures(this.seed).islets;
    const targets = this.targets().filter((t) => !t.dead);
    islets.forEach((o, i) => {
      if (this.anchors[i] || this.guarded[i] || !targets.some((t) => Math.hypot(t.x - o.x, t.z - o.z) <= o.r + RESCUE.guardReach)) return;
      this.guarded[i] = true;
      const a = this.rescue.anchors[i]!;
      for (let n = 0, k = 0; n < RESCUE.guards && k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const x = a.x + Math.sin(ang) * 3;
        const z = a.z + Math.cos(ang) * 3;
        if (this.terrain.heightAt(x, z) <= WATER_LEVEL + 0.2) continue;
        this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng));
        n++;
        k += 7; // spread them apart
      }
      this.say('Unos lobos marchitos guardan el ancla');
    });
  }

  private onRescue(p: SavedPlayer): void {
    const c = this.rescue.cage;
    if (this.invasion2 !== 'taken' || p.dead || Math.hypot(c.x - p.x, c.z - p.z) > RESCUE.freeReach) return;
    const left = this.anchors.filter((b) => !b).length;
    if (left) return this.tell(p.name, `La jaula aguanta: ${left === 1 ? 'queda 1 ancla' : `quedan ${left} anclas`} en los islotes`);
    this.invasion2 = 'rescued';
    this.anchorFoes = [];
    this.say(`${p.name} abre la jaula. El ${NAMES.bossForestShort} vuelve al ${NAMES.heart}, con rabia`);
    this.vision(VISION.rescued(joinNames(this.activeNames())));
  }

  private startTheft(h: Structure): void {
    const { x, z } = clampMap(h.x, h.z + MARCHITO.spawnDist, 6);
    this.marchito = createMarchito(x, this.terrain.heightAt(x, z), z, [], thiefWill(this.activeCount()));
    this.marchito.grab = 0;
    this.vision(VISION.steal);
  }

  /** The Tragón is gone either way; left alone, he wrecks the nearest quarter of the defenses on his way out. */
  private endTheft(wreck: boolean): void {
    const h = this.heart();
    this.marchito = null;
    this.invasion2 = 'taken';
    this.ally = null;
    this.anchors = [false, false, false];
    this.guarded = [false, false, false];
    this.buildAnchors();
    if (wreck && h) {
      for (const id of pickDefenses(this.structures, h, 0.25)) {
        const s = this.structures.find((x) => x.id === id);
        if (s) this.wreck(s);
      }
    }
    if (wreck) this.vision(VISION.stolen(joinNames(this.activeNames())));
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
    if (m.grab !== null) {
      this.vision(VISION.driven2(joinNames(m.taunted)));
      return this.endTheft(false);
    }
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
