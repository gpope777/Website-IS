import { NAMES } from '../names';
import { CIENAGA, deepStepOk, depthAt, inCienaga, SWIM_MAX_DEPTH } from '../coast';
import { BOG, inBog, ZARZAL, ZARZAL_KNOT, zarzalAt } from '../swamp';
import { weatherAt, wetAt } from '../weather';
import { altitudeCold, climbableAt, COLD, smoothAt, STEEP, STEEP_TEXT, steepBlocked, UMBRAL, withEscalera } from '../mountains';
import { gustDir, inGust, slide, VIENTO, type Dir } from '../viento';
import { FUEGO, HOGUERA, inFlame } from '../fuego';
import { PIEDRA, pillarSpot, pushDir, structureCrags, TOWER } from '../piedra';
import { createRng } from '../rng';
import { clampMap, coastFeatures, createTerrain, type Islet, HALF, inForest, inMap, inMountains, inSwamp, inCorrupt, CORRUPT_LANDS, MOUNTAINS, mountainDepth, corruptFeatures, WATER_LEVEL, waterLevel, type Terrain } from '../terrain';
import { ASH_RUN, ashHurts, LAKE_PILLAR, lidUp, PILLAR, pillarSites, THICKET, thicketHurts, type PillarSites } from '../pillars';
import { FLECHA, flechaLeads, GATA, gataLeads, hasteNear, rockTarget, stepFlecha, stepGata, stepTriangulo, TRIANGULO, triLeads } from './lieutenant';
import { generateResources, HARVEST, type ResourceSpawn } from '../resources';
import { cragsNear, generateCrags, type Crag } from '../crags';
import { ENREDADERA, planVine } from '../enredadera';
import { pillarZone, allZones, coastRaidBrutes, COAST_ZONES, CORRUPTION, isCoastZone, isCorruptLandZone, isMountainZone, isSwampZone, MOUNTAIN_ZONES, SWAMP_ZONES, nearestZone, raidDirFrom, zoneAt, type Zone } from '../corruption';
import { clampStep, DUNGEON, generateEntrance, inAnyDungeon, inBossRoom, inDungeon, inEliteRoom, inside, leverPos, withDungeon } from '../dungeon';
import { inMud, inMudPool, inPeatRoom, insideSwamp, inSwampBossRoom, inSwampDungeon, plankAt, plankCrags, SWAMP_DUNGEON, swampEntrance } from '../swamp-dungeon';
import { clampTowerDungeon, columnCrags, inArena, inCopa, inTowerDungeon, insideTower, towerEntrance, towerFloor, towerShelfCrag, TOWER_DUNGEON, TOWER_ROCKFALL } from '../tower-dungeon';
import { broteOpen, burnRoots, castOnBrote, createFinal, FINAL, finalMult, hitCore, hitFinal, plateSpot, staggerFinal, startPull, stepFinal, type BroteKind, type FinalBoss } from './marchito-final';
import { createTowerAlly, stepTowerAlly, TOWER_ALLY_KINDS, type TowerAlly } from './tower-allies';
import { boulders, dungeonBlockCell, inMountainBossRoom, inMountainDungeon, inRockfall, inRockRoom, insideMountain, mountainEntrance, MOUNTAIN_DUNGEON, rockfallLane, shelfCrag } from '../mountain-dungeon';
import { COAST_DUNGEON, coastEntrance, inChasm, inCoastBossRoom, inCoastDungeon, insideCoast, inShieldRoom } from '../coast-dungeon';
import { crash, createElite, createPeat, createRockBrute, createShielded, ELITE, rockFront, shieldBlocks, stepElite, type Elite } from './elite';
import { generateWild, inZone, MOUNT, ringAngle } from '../mount';
import { FISH, fishFloor, fishRings, fishStepOk, wildFish } from '../fish';
import { FROG, frogMoveOk, frogPads, wildFrog } from '../frog';
import { slideMoveOk, SNOWSLIDE } from '../snowslide';
import { FOG_EDGE_TEXT, fogText, missingRoot, rimCrossBlocked, withGrieta, towerHeight, TOWER as VILLAIN_TOWER, ASH, CALL_NONE, CALL_TEXT, callSpot, thornDrop } from '../corrupt-lands';
import { AIR, clawReach, DRAGON, dragonOut, guardTarget, dragonPos, FOG_TEXT, inFog, leapOk, picoOf, type PicoCircle } from '../dragon';
import { AMBER, generateAmberTrees, generateSwampShrines, lilyPadCrags, SWAMP_SHRINE, type AmberTree } from '../swamp-shrines';
import { canTame, seatOffset, WHALE, whaleStepOk, whaleWidth, wildWhale } from '../whale';
import { generateShrines, SHRINE, SHRINE_LABELS, type Shrine } from '../shrines';
import { blockCell, blocksCentre, blocksSolved, BLOCKS, pushBlock, corniceLedges, generateMountainShrines, generateQuartzVeins, MOUNTAIN_SHRINE, QUARTZ, type Cell, type QuartzVein } from '../mountain-shrines';
import { CHEST, COAST_SHRINE, generateChests, generateCoastShrines, type Chest } from '../coast-shrines';
import { addItem, ITEM_LABELS, BUILD_COST, type ItemId, count, STRUCTURE_HP, TEND_COST, TEND_HEAL, UPGRADE, upgradeCost, weaponMult, CAPA, capaCost, capaMult, hasAll, removeAll, type Inventory, type StructureKind } from '../items';
import { createVitals, damage, eatBerry, isNight, RESPAWN_VITALS, tickVitals, type Vitals } from '../survival';
import { r2, type Anim, type CallBeast, type ClientMsg, type DungeonView, type GraveView, type PillarView, type PlayerView, type SelfState, type ShrineView, type TowerDungeonView, type FinalView, type ServerMsg, type SteedView, type Structure, type WhaleView, type WolfView } from '../protocol';
import { ALLY, createAlly, stepAlly, type Ally } from './ally';
import { BOSS, createBoss, stepBoss, type Boss } from './boss';
import { createFarol, createZancudo, groundZancudo, overVent, stepFarol, stepZancudo, ZANCUDO, type Farol, type Zancudo } from './zancudo';
import { createAtalaya, createCucurucho, CUCURUCHO, hatFront, stepAtalaya, stepCucurucho, stickCucurucho, type Atalaya, type Cucurucho } from './cucurucho';
import { ANTENON, createAntenon, createGustAlly, pushAntenon, stepAntenon, stepGustAlly, type Antenon, type GustAlly } from './antenon';
import { RESCUE, rescueSite, type RescueSite } from '../rescue';
import { FOGATA, generateFogatas, type Fogata } from '../fogatas';
import { creditLines, ENDING, endingCards, endingWave, lateCards, LOOKOUT, lookoutTop, withLookout } from '../ending';
import { ESTRELLA, estrellaAt, estrellaOut, fullMoon } from '../estrella';
import { createMarchito, heartWill, joinNames, MARCHITO, marchitoWill, stepChanneler, pickDefenses, stepMarchito, stepThief, thiefWill, VISION, type Marchito } from './marchito';
import { BLOCK, BOW, inCone, newGuard, resolveHit, ROLL, type Guard } from './combat';
import { RAYO, rayoLow, stepRayo } from './rayo';
import { addKillXp, BOSS_KINDS, bossesOf, canLearn, FEAT_FAST, FEAT_HAT, FEAT_HEART, DEFAULT_LOOK, HAT_HINTS, HAT_IDS, hasSkill, hatUnlocked, isLook, killXp, PROGRESS, rankOf, SKILL_FX, SKILL_IDS, totalXp, unlockedHats, type Look, type SkillId } from '../progression';
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
/** The tower's floor as a terrain, for beasts stepped in the tower's frame. */
const TOWER_FLAT: Terrain = { heightAt: () => TOWER_DUNGEON.floor, density: () => 0 };
/**
 * Beast steps clamp to the map (clampMap), and the tower is off the map: step a tower beast with
 * everything shifted onto the map's centre line (x − TOWER_DUNGEON.x), then shift back.
 */
function towerFrame<R>(w: Wolf, targets: readonly WolfTarget[], step: (ts: WolfTarget[]) => R): R {
  const ox = TOWER_DUNGEON.x;
  w.x -= ox;
  if (w.aim) w.aim = { x: w.aim.x - ox, z: w.aim.z };
  if (w.clav) w.clav = { ...w.clav, x: w.clav.x - ox };
  const out = step(targets.map((t) => ({ ...t, x: t.x - ox })));
  w.x += ox;
  if (w.aim) w.aim = { x: w.aim.x + ox, z: w.aim.z };
  if (w.clav) w.clav = { ...w.clav, x: w.clav.x + ox };
  return out;
}
const BUILT_TEXT: Record<StructureKind, string> = { campfire: 'Fogata encendida', wall: 'Muro levantado', heart: `El ${NAMES.heart} echó raíces`, spikes: 'Estacas clavadas', roots: 'Red de raíces tendida', fire: 'Hoguera lista. Ya arderá', tower: 'Torre alzada. Desde arriba se ve lejos', pillar: 'Se alza un pilar' };

/** S5-D: Invasion 3's raid is half again as big, with a flock of rayos; a raid rayo's dive on a structure deals `rayoStruct`. */
export const INVASION3 = { raidMult: 1.5, rayos: 6, rayoStruct: 10 } as const;

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
  /** Tamed dragon and where it waits (S4-G). Optional: older saves have none. */
  dragon?: { x: number; z: number };
  /** Sunken chest ids opened. Optional: older saves have none. */
  chests?: number[];
  /** Weapon upgrade level 0–5. Optional: older saves have none. */
  weaponLvl?: number;
  /** Amber tree id → sim time you last harvested it. Optional: older saves have none. */
  amber?: Record<number, number>;
  /** Quartz vein id → sim time you last took it. Optional: older saves have none. */
  quartz?: Record<number, number>;
  /** Capa de corteza level 0–3. Optional: older saves have none. */
  capaLvl?: number;
  /** Has Viento (coast dungeon altar). Optional: older saves have none. */
  viento?: boolean;
  /** Has Fuego (swamp dungeon altar). Optional: older saves have none. */
  fuego?: boolean;
  /** Has Piedra (mountain dungeon altar). Optional: older saves have none. */
  piedra?: boolean;
  /** S5-G: has seen the ending's credits (live, or on the first login after). Optional. */
  credits?: boolean;
  /** S5-H: the steed is la Estrella (not the deer). Optional. */
  star?: boolean;
  /** P4-A: Savia the save can't reconstruct (kills, lieutenants, zones, pillars, raids, the whale). Optional. */
  xp?: number;
  /** P4-A: kill Savia today (daily cap). Optional. */
  killDay?: { day: number; xp: number };
  /** P4-B: oficios learned (ids from SKILL_IDS). Optional. */
  skills?: string[];
  /** P4-C: colour and hat. Optional: older saves wear the default. */
  look?: { color: number; hat: number };
  /** P4-D: boss kinds beaten (BOSS_KINDS). Optional: old saves infer the dungeon ones from the powers. */
  bosses?: string[];
  /** P4-D: kills by strike (wolf, brute, rayo). Optional. */
  kills?: Record<string, number>;
  /** P4-D: raids held (dawn with the Heart alive). Optional. */
  raidsHeld?: number;
  /** P4-D: Proezas done (ids 1–6). Optional. */
  feats?: number[];
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
  /** El Zancudo was beaten and its white copy hangs a farol by the Heart. Optional: older saves have none. */
  purified3?: boolean;
  /** The Zarzal knot burnt: a walking path into the swamp for everyone. Optional: older saves have the knot whole. */
  zarzalBurnt?: boolean;
  /** El Cucurucho was beaten and its white copy keeps an atalaya by the Heart. Optional: older saves have none. */
  purified4?: boolean;
  /** La Escalera del Umbral raised: a ramp up los Peldaños for everyone. Optional: older saves have none. */
  escalera?: boolean;
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
  /** Someone has entered the mountains (S4-D): El Triángulo can lead raids. */
  mountainsSeen?: boolean;
  /** Which swamp fogatas are lit (ids from the seed). Optional: older saves have them all dark. */
  fogatas?: boolean[];
  /** S5-A: a dragon rider with the 4 Raíces-madre purified opened the fog. Optional. */
  fogOpen?: boolean;
  /** S5-A: the day El Marchito's tower started growing (set on load when missing). */
  towerDay0?: number;
  /** S5-C: Pilares-raíz broken (ids 0–3). Optional: older saves have none. */
  pillars?: number[];
  /** S5-C: someone has walked las Tierras Corruptas (La Flecha can lead raids). */
  corruptSeen?: boolean;
  /** S5-D: Invasion 3 owed (the 4th Pilar-raíz broke) or over. Optional: older saves have none. */
  invasion3?: 'pending' | 'done';
  /** S5-D: the tower's door opened (the dawn after Invasion 3). Optional. */
  towerOpen?: boolean;
  /** S5-F: El Marchito fell in the Copa (the ending, S5-G). Optional. */
  ending?: boolean;
  /** S5-G: who was in the Copa at the kill (for the credits). Optional. */
  endingNames?: string[];
  /** S5-G: the post-ending raids were turned off at the Heart. Optional: on. */
  raidsOff?: boolean;
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
  /** P4-D Proezas (live-only): fish race start; Nenúfares run dry from pad 0; a cold night climb. */
  raceAt?: number;
  lily?: boolean;
  cold?: boolean;
  /** P4-A: the Rango last told (live-only; set on connect, so loading never flashes). */
  rank?: number;
  /** Carrying a torch from the Candiles post (spent on one brazier or fogata). */
  torch?: boolean;
  /** A fogata channel in progress: where to, when it lands, where it started and the health then. Live-only. */
  travel?: { x: number; z: number; at: number; fromX: number; fromZ: number; hp: number } | null;
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
  /** Sim time Fuego can be cast again. Live-only. */
  fireReadyAt?: number;
  /** Sim time Piedra can be cast again. Live-only. */
  stoneReadyAt?: number;
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
  /** On the dragon (live-only, S4-G). */
  dragon: boolean;
  /** S5-C: pulling a Pilar-raíz's core: which, and when it gives. Live-only. */
  pull?: { id: number; at: number } | null;
}

type Beast = 'deer' | 'fish' | 'frog' | 'dragon' | 'star';
const roundsOf = (beast: Beast): readonly { speed: number; width: number }[] => (beast === 'fish' ? FISH.rounds : beast === 'frog' ? FROG.rounds : beast === 'dragon' ? DRAGON.rounds : beast === 'star' ? ESTRELLA.rounds : MOUNT.rounds);

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
  /** Quartz veins up the paredes (seeded; per player). */
  readonly quartzVeins: readonly QuartzVein[];
  /** Cornisa's 2 bare resting ledges (seeded). */
  readonly ledges: readonly Crag[];
  /** Amber trees on the swamp's montículos (seeded; per player). */
  readonly amberTrees: readonly AmberTree[];
  /** The Raíz-madre's trunk in the world (the dungeon entrance). */
  readonly entrance: { x: number; y: number; z: number };
  /** The coast Raíz-madre's trunk, on the dungeon island. */
  readonly coastEntrance: { x: number; z: number };
  /** The swamp Raíz-madre's sunken trunk, in the Laguna Negra. */
  readonly swampEntrance: { x: number; z: number } = swampEntrance();
  /** The mountain cave's mouth, beside the Raíz-madre de la Montaña (zone 14). */
  readonly mountainEntrance: { x: number; z: number } = mountainEntrance();
  /** S5-E: the tower's door, on its south face. */
  readonly towerDoor: { x: number; z: number } = towerEntrance();
  /** Where the wild deer grazes (it never leaves: every player tames their own). */
  readonly wild: { x: number; y: number; z: number };
  /** Where the wild giant fish waits, and its race rings (seeded). */
  readonly fishHome: { x: number; z: number };
  readonly fishRings: readonly { x: number; z: number }[];
  /** Where the wild frog waits, and its lily pads (seeded). */
  readonly frogHome: { x: number; z: number };
  readonly frogPads: readonly { x: number; z: number }[];
  /** El Pico's centre and top: the wild dragon circles it (S4-G). */
  readonly pico: PicoCircle;
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
  /** The bruto de turba in the swamp interior. */
  private peat: Elite | null = null;
  /** The bruto de roca in the mountain interior. */
  private rock: Elite | null = null;
  /** The coast interior (live-only, like the forest one): levers, gates, the pumice block, the bruto escudado. */
  private readonly coastLive = {
    pulled: [null, null] as (number | null)[],
    gate: false,
    fan: false,
    plate: false,
    eliteDown: false,
    block: { ...insideCoast(COAST_DUNGEON.blockStart) },
  };
  /** The swamp interior (live-only): levers, gate 0, Llamaradas the thorns took, lamp light times and gate 2, the planks, the bruto de turba. */
  private readonly swampLive = {
    pulled: [null, null] as (number | null)[],
    gate: false,
    thorn: 0,
    lampAt: [null, null, null] as (number | null)[],
    lamps: false,
    planks: Array.from({ length: SWAMP_DUNGEON.planks }, () => ({ at: null as number | null, downUntil: 0 })),
    eliteDown: false,
  };
  /** The mountain interior (live-only): levers, gate 0, the high plate, the block room, the bruto de roca, rockfall hit graces. */
  private readonly mountainLive = {
    pulled: [null, null] as (number | null)[],
    gate: false,
    plate: false,
    cells: MOUNTAIN_DUNGEON.blocks.starts.map((c) => [c[0], c[1]] as const) as Cell[],
    blocksDone: false,
    eliteDown: false,
    hitAt: new Map<string, number>(),
  };
  /** La Torre (S5-E, live-only): root bridges, vent clear times, braziers, the plate (and its jam), La Flecha down, floors woken, rockfall hit graces. */
  private readonly towerLive = {
    bridges: [false, false],
    ventAt: [null, null, null] as (number | null)[],
    ventsDone: false,
    braziers: [false, false, false, false],
    plate: false,
    jammed: false,
    flechaDown: false,
    woke: [false, false, false, false],
    copaSeen: false,
    hitAt: new Map<string, number>(),
    allies: [null, null, null, null] as (TowerAlly | null)[],
  };
  /** Live-only puzzle state, one per shrine: lever pull times, open-until, plate pressed. */
  private readonly shrineLive: { pulled: (number | null)[]; openUntil: number; pressed: boolean; block: { x: number; z: number; held: string | null } | null; /** Candiles: lit-until per brazier. */ lit: number[]; /** Nenúfares: when someone first stood on each pad, and until when it is under. */ pads: { at: number | null; downUntil: number }[]; /** Turba: Llamaradas the peat wall took. */ burns: number; /** Bloques: each block's grid cell. */ cells: Cell[]; /** Losas gemelas: when the boulder reached plate 2 (null = home). */ boulderAt: number | null }[];
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
  /** El Zancudo (saved once beaten) and, live while someone is in its room, the fight. */
  purified3: boolean;
  private boss3: Zancudo | null = null;
  /** The white Zancudo's farol by the Heart; live-only, rebuilt from `purified3`. */
  private ally3: Farol | null = null;
  /** When each of El Zancudo's gas vents last flared (for the client's flash). */
  private readonly ventAt: number[] = [-99, -99, -99, -99];
  /** The Zarzal knot burnt (saved), and the Llamaradas it has taken so far (live-only). */
  zarzalBurnt: boolean;
  private knotBurns = 0;
  /** El Cucurucho beaten (saved); the boss itself is live-only. */
  purified4: boolean;
  private boss4: Cucurucho | null = null;
  /** S5-E: La Flecha as the tower's mini-boss (live-only; beaten stays beaten until a restart). */
  private towerFlecha: Wolf | null = null;
  /** S5-F: El Marchito's final fight in the Copa (live-only; a restart or an empty Copa resets it). */
  private towerFinal: FinalBoss | null = null;
  /** The puller's health when a pull started (a hurt cancels it), and when the next Copa rayo may come. */
  private readonly finalLive = { pullHp: 0, rayoAt: 0 };
  /** The white Cucurucho's atalaya by the Heart; live-only, rebuilt from `purified4`. */
  private ally4: Atalaya | null = null;
  /** La Escalera del Umbral raised (saved); the Umbral's cracks so far are live-only. */
  escalera: boolean;
  private umbralCasts = 0;
  /** Swamp fogatas (from the seed) and which are lit (saved). */
  readonly fogataSpots: readonly Fogata[];
  private fogatas: boolean[];
  /** The purified Tragón by the Heart; live-only, rebuilt from `purified`. */
  private ally: Ally | null = null;
  /** Invasion 1 (spec §2): none yet, owed since the Tragón fell, or over. */
  invasion: 'none' | 'pending' | 'done';
  /** Invasion 2 (Slice 2 §8): none yet, owed (a fish was tamed), the Tragón taken, or rescued. */
  invasion2: 'none' | 'pending' | 'taken' | 'rescued';
  /** Invasion 3 (S5 §8): none yet, owed since the 4th pillar broke, or over. */
  invasion3: 'none' | 'pending' | 'done';
  /** The tower's door is open (S5 §8.2). */
  towerOpen: boolean;
  /** El Marchito fell (S5-F): the ending (S5-G). */
  ending: boolean;
  /** S5-G: the killers' names and the post-ending raids toggle (saved). */
  private endingNames: string[] = [];
  /** S5-H: the last day the full moon was announced (live-only). */
  private moonToldDay = -1;
  raidsOff = false;
  /** Invasion 3 is under way tonight (from its dusk to dawn); `dark` once night fell. Live-only. */
  private inv3: { dark: boolean } | null = null;
  /** When each owner's parked dragon may bite a rayo again (S5 §8.3). Live-only. */
  private skyBiteAt = new Map<string, number>();
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
  /** Live-only: when each Piedra pillar (a structure id) crumbles. */
  private readonly pillarUntil = new Map<number, number>();
  /** Live-only: sim time each torre can shove again. */
  private readonly towerReady = new Map<number, number>();
  /** Live-only: sim time each hoguera can catch again. */
  private readonly fireReady = new Map<number, number>();
  /** Live-only: sim time each net can catch again. */
  private readonly netReady = new Map<number, number>();
  private wolves: Wolf[] = [];
  private nextWolfId = 1;
  private raid: { phase: 'warn' | 'active'; dir: number; gata?: boolean; tri?: boolean; flecha?: boolean; /** Invasion 3: ×1.5 and rayos. */ big?: boolean } | null = null;
  private raidN: number;
  private swampSeen: boolean;
  private mountainsSeen: boolean;
  /** S5-C: someone walked las Tierras. */
  corruptSeen: boolean;
  /** S5-C: where the Pilares-raíz and their parts are (seeded). */
  readonly pillarSpots: PillarSites;
  /** S5-C: which Pilares-raíz are broken (saved). */
  private pillarsBroken: boolean[];
  /** S5-C: progress on the standing pillars (live-only, like the Zarzal knot): roots bridged, gusts on the miasma, Llamaradas on the cocoon, rayo guards out. */
  private pillarLive = { roots: [false, false, false], miasma: 0, burns: 0, guards: false };
  /** S5-C: the Lago Negro's anchor (kind 'anchor', PV live-only) while it holds. */
  private lakeAnchor: Wolf | null = null;
  /** S5-A: the fog north of the rim is open (flying into las Tierras Corruptas). */
  fogOpen: boolean;
  /** Game day the Espinar last got its day beasts (live only: a restart may spawn them again). */
  private ashDay = -1;
  /** S5-A: the tower's first day. */
  readonly towerDay0: number;
  /** La Gata Araña's wolf id while she leads a raid. */
  private gataId: number | null = null;
  /** El Triángulo in tonight's raid (S4-D) and his rock timer. */
  private triId: number | null = null;
  /** La Flecha leading tonight's raid (S5-C). Live-only. */
  private flechaId: number | null = null;
  private rockIn = 0;
  /** Seconds left of a raid fleeing after she fell. */
  private raidFlee = 0;
  /** P4-D: the Heart's lowest share this raid; who got hurt in the Tragón's fight. */
  private raidLow = 1;
  private readonly bossHurt = new Set<string>();
  private wasNight = false; // false on load so a night-time load still spawns wolves
  private outbox: Outgoing[] = [];
  private readonly rng: () => number;

  constructor(saved: SavedWorld) {
    this.seed = saved.seed;
    this.salt = saved.salt;
    this.time = saved.time;
    this.terrain = withLookout(withGrieta(withEscalera(withDungeon(createTerrain(saved.seed)), () => this.escalera), () => this.ending), () => this.ending);
    this.resources = generateResources(this.terrain, saved.seed);
    this.crags = generateCrags(this.terrain, saved.seed);
    const forest = generateShrines(this.terrain, saved.seed, this.crags);
    this.shrines = [...forest, ...generateCoastShrines(this.terrain, saved.seed), ...generateSwampShrines(this.terrain, saved.seed), ...generateMountainShrines(this.terrain, saved.seed)];
    this.ledges = corniceLedges(this.terrain, saved.seed);
    this.chests = generateChests(this.terrain, saved.seed);
    this.amberTrees = generateAmberTrees(this.terrain, saved.seed);
    this.quartzVeins = generateQuartzVeins(this.terrain, saved.seed);
    this.entrance = generateEntrance(this.terrain, saved.seed, this.crags, forest);
    this.wild = generateWild(this.terrain, saved.seed, [...this.crags, ...forest, this.entrance]);
    this.island = coastFeatures(saved.seed).island;
    this.coastEntrance = coastEntrance(saved.seed);
    this.fishHome = wildFish(this.terrain, saved.seed);
    this.fishRings = fishRings(this.terrain, saved.seed, this.fishHome);
    this.frogHome = wildFrog(this.terrain, saved.seed);
    this.frogPads = frogPads(this.terrain, saved.seed, this.frogHome);
    this.pico = picoOf(this.terrain, saved.seed);
    this.whaleHome = wildWhale(this.terrain, saved.seed);
    this.whaleTamed = !!saved.whale;
    this.whale = saved.whale ? { ...saved.whale } : { ...this.whaleHome, yaw: 0 };
    this.zones = allZones(this.terrain, saved.seed, this.entrance);
    this.cleansed = new Set(saved.cleansed ?? (saved.purified ? [0] : []));
    this.shrineLive = this.shrines.map((s) => ({ pulled: s.parts.map(() => null), openUntil: -Infinity, pressed: false, block: s.kind === 'tide' ? { ...s.parts[1]!, held: null } : s.kind === 'twins' ? { ...s.parts[2]!, held: null } : null, burns: 0, cells: s.kind === 'blocks' ? BLOCKS.starts.map((c) => [c[0], c[1]] as const) : [], boulderAt: null, lit: s.kind === 'candles' ? [0, 0, 0] : [], pads: s.kind === 'lilies' ? s.parts.map(() => ({ at: null, downUntil: 0 })) : [] }));
    for (const p of saved.players) this.players.set(p.name, structuredClone(p));
    // Plan F moved Enredadera from the first shrine orb to the dungeon altar: players who already had it keep it.
    for (const p of this.players.values()) if (p.enredadera === undefined && (p.shrines ?? []).length > 0) p.enredadera = true;
    for (const [id, st] of Object.entries(saved.resources)) this.resState.set(Number(id), { ...st });
    this.structures = saved.structures.map((s) => ({ ...s, hp: s.hp ?? STRUCTURE_HP[s.kind] }));
    this.raidLevel = saved.raidLevel ?? 0;
    this.raidN = saved.raidN ?? 0;
    this.swampSeen = saved.swampSeen ?? false;
    this.mountainsSeen = saved.mountainsSeen ?? false;
    this.corruptSeen = saved.corruptSeen ?? false;
    this.pillarSpots = pillarSites(saved.seed);
    this.pillarsBroken = [0, 1, 2, 3].map((i) => saved.pillars?.includes(i) ?? false);
    if (!this.pillarsBroken[1]) this.lakeAnchor = this.makeLakeAnchor();
    this.fogOpen = saved.fogOpen ?? false;
    this.towerDay0 = saved.towerDay0 ?? Math.floor(saved.time / DAY_LENGTH);
    this.purified = saved.purified ?? false;
    this.purified2 = saved.purified2 ?? false;
    this.purified3 = saved.purified3 ?? false;
    this.zarzalBurnt = saved.zarzalBurnt ?? false;
    this.purified4 = saved.purified4 ?? false;
    this.escalera = saved.escalera ?? false;
    this.fogataSpots = generateFogatas(this.terrain, saved.seed);
    this.fogatas = this.fogataSpots.map((_, i) => saved.fogatas?.[i] ?? false);
    this.invasion = saved.invasion ?? 'none';
    this.invasionAt = this.time + MARCHITO.delay;
    this.invasion2 = saved.invasion2 ?? (saved.players.some((p) => p.fish) ? 'pending' : 'none');
    this.invasion3 = saved.invasion3 ?? (this.pillarsBroken.every(Boolean) ? 'pending' : 'none');
    this.towerOpen = saved.towerOpen ?? false;
    this.ending = saved.ending ?? false;
    this.endingNames = saved.endingNames ?? [];
    this.raidsOff = saved.raidsOff ?? false;
    if (this.ending) this.fogatas[FOGATA.lookout] = true; // S5-H: the top of el Árbol-torre
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
      l = { anim: 'idle', awayFor: null, anchorX: p.x, anchorZ: p.z, anchorAt: this.time, lastAcceptedAt: this.time, harvestReadyAt: 0, punchReadyAt: 0, fix: false, guard: newGuard(), deadAt: null, powerReadyAt: 0, windReadyAt: 0, boostCeil: -Infinity, boostUntil: 0, boosted: false, tame: null, tameReadyAt: 0, riding: false, rodeUntil: 0, graceCap: MAX_SPEED, hintAt: 0, seat: null, race: null, raceReadyAt: 0, fish: false, frog: false, dragon: false };
      this.live.set(name, l);
    }
    l.rank = rankOf(this.xpOf(p));
    const gone = [...this.resState].filter(([, s]) => s.uses === 0).map(([id]) => id);
    if (this.ending && !p.credits) {
      // S5-G: whoever missed the kill gets the credits on their first login after.
      p.credits = true;
      this.outbox.push({ to: name, msg: { t: 'ending', cards: lateCards(this.endingNames), credits: creditLines(this.endingNames.length ? joinNames(this.endingNames) : 'vosotros') } });
    }
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
        return msg.kind === 'viento' ? this.onGust(p, l, msg.x, msg.z) : msg.kind === 'fuego' ? this.onFlame(p, l, msg.x, msg.z) : msg.kind === 'piedra' ? this.onStone(p, l, msg.x, msg.z) : this.onPower(p, l, msg.x, msg.z);
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
      case 'quartz':
        return this.onQuartz(p, msg.id);
      case 'capa':
        return this.onCapa(p);
      case 'fogata':
        return this.onFogata(p, l, msg.id);
      case 'travel':
        return this.onTravel(p, l, msg.to);
      case 'call':
        return this.onCall(p, l, msg.beast);
      case 'pillar':
        return this.onPillar(p, l, msg.id);
      case 'raids':
        return this.onRaids(p, msg.on);
      case 'learn':
        return this.onLearn(p, msg.id);
      case 'forget':
        return this.onForget(p);
      case 'look':
        return this.onLook(p, msg.color, msg.hat);
      case 'hello':
        return; // the room handles hello
    }
  }

  step(dt: number): void {
    this.time += dt;
    this.checkRanks();
    const night = isNight(dayFraction(this.time));

    for (const [name, l] of this.live) {
      if (l.awayFor === null) continue;
      l.awayFor += dt;
      if (l.awayFor >= AWAY_TIMEOUT) this.live.delete(name);
    }

    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) continue; // away players are frozen: the world sleeps for them
      const warm = this.nearFire(p.x, p.z);
      p.vitals = tickVitals(p.vitals, { night, nearFire: warm, cold: altitudeCold(this.terrain, p.x, p.z) }, dt);
      this.coldFeat(p, l, night, warm);
      if (!l.riding && !l.seat && inCienaga(p.x, p.z) && p.y < this.terrain.heightAt(p.x, p.z) + 1.5) {
        p.vitals = damage(p.vitals, CIENAGA.dps * dt);
        this.hint(p.name, l, 'El barro marchito muerde. A lomos del ciervo no');
      }
      if (!l.fish && zarzalAt(this.terrain, p.x, p.z, this.zarzalBurnt) && p.y < this.terrain.heightAt(p.x, p.z) + 1.5) {
        p.vitals = damage(p.vitals, ZARZAL.dps * dt);
        this.hint(p.name, l, `${upFirst(NAMES.swampGate)} muerde. Las espinas no respetan al ciervo`);
      }
      this.pillarHazards(p, l, dt);
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
    this.stepTravel(night);
    this.stepPulls();
    this.stepVines(dt);
    this.stepPillars();
    this.stepRaid(night);
    if (night && !this.wasNight) this.spawnWolves();
    if (!night && this.wasNight) this.wolves = this.wolves.filter((w) => inTowerDungeon(w.x, w.z)); // the tower's beasts stay
    this.wasNight = night;
    if (!night) this.spawnAsh();

    const targets = this.targets();
    const goal = this.raidGoal();
    const gata = this.wolves.find((w) => w.id === this.gataId && w.hp > 0) ?? null;
    let marks: WolfTarget[] | undefined; // Invasion 3: raid rayos also dive at structures
    let inTower: WolfTarget[] | undefined; // S5-E: beasts in the tower hunt there (the interior is "warm", so not with `targets`)
    for (const w of this.wolves) {
      if (inTowerDungeon(w.x, w.z)) {
        w.flee = undefined; // nowhere to run up here
        const [px, pz] = [w.x, w.z];
        inTower ??= targets.filter((t) => inTowerDungeon(t.x, t.z)).map((t) => ({ ...t, fires: false }));
        const bit = towerFrame(w, inTower, (ts) => (w.kind === 'rayo' ? stepRayo(w, ts, TOWER_FLAT, dt, this.rng) : stepWolf(w, ts, TOWER_FLAT, dt, this.rng)));
        if (bit) this.bite(bit, ENEMY[w.kind].damage, w);
        const c = clampTowerDungeon(px, pz, w.x, w.z, this.towerGates());
        [w.x, w.z] = [c.x, c.z];
        continue;
      }
      if (w.flee && w.fleeFrom && w.hp > 0) {
        this.flee(w, w.fleeFrom, dt);
        continue;
      }
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
        if (w.kind === 'lieut3') {
          const ev = stepFlecha(w, targets, this.structures, goal, this.terrain, dt, this.rng);
          if (ev.bite) this.bite(ev.bite, ENEMY.lieut3.damage, w);
          for (const n of ev.hits) this.bite(n, FLECHA.dashDamage, w);
          continue;
        }
        if (w.kind === 'lieut2') {
          const bit = stepTriangulo(w, targets, goal, this.terrain, dt, this.rng);
          if (bit) this.bite(bit, ENEMY.lieut2.damage, w);
          this.rockIn -= dt;
          if (this.rockIn <= 0 && w.hp > 0) {
            const id = rockTarget(w, this.structures);
            if (id !== null) {
              this.rockIn = TRIANGULO.rockEvery;
              this.damageStructure(id, TRIANGULO.rockDamage);
            }
          }
          continue;
        }
        if (w.kind === 'rayo') {
          marks ??= [...targets, ...this.structures.filter((s) => s.kind !== 'heart').map((s) => ({ name: `#${s.id}`, x: s.x, z: s.z, dead: false, fires: false }))];
          const bit = stepRayo(w, marks, this.terrain, dt, this.rng);
          if (bit?.startsWith('#')) this.damageStructure(Number(bit.slice(1)), INVASION3.rayoStruct);
          else if (bit) this.bite(bit, ENEMY.rayo.damage, w);
          continue;
        }
        w.haste = hasteNear(gata, w.x, w.z);
        const hit = stepRaider(w, targets, goal, this.terrain, dt, this.rng);
        if (hit && 'player' in hit) this.bite(hit.player, raiderDamage(w), w);
        else if (hit) this.damageStructure(hit.structure, raiderDamage(w));
        continue;
      }
      const bit = w.kind === 'rayo' ? stepRayo(w, targets, this.terrain, dt, this.rng) : stepWolf(w, targets, this.terrain, dt, this.rng);
      if (bit) this.bite(bit, ENEMY[w.kind].damage, w);
    }
    this.stepBurning(dt);
    this.stepGataFall(dt);
    this.stepSpikes(dt);
    this.stepNets();
    this.stepFires();
    this.stepDungeon();
    this.stepCoastDungeon();
    this.stepSwampDungeon();
    this.stepMountainDungeon();
    this.stepTowerDungeon(dt);
    this.stepTowerFlecha(dt);
    this.stepTowerFinal(dt);
    this.stepEliteFight(dt);
    this.stepShieldFight(dt);
    this.stepPeatFight(dt);
    this.stepRockFight(dt);
    for (const e of [this.elite, this.shield, this.peat, this.rock]) if (e) this.pillarStun(e);
    this.stepTowers();
    this.stepBossFight(dt);
    this.stepAntenonFight(dt);
    this.stepZancudoFight(dt);
    this.stepCucuruchoFight(dt);
    this.stepAlly(dt);
    this.stepAlly2(dt);
    this.stepAlly3(dt);
    this.stepAlly4(dt);
    this.stepRace();
    this.stepTaming();
    this.stepWhaleTame();
    this.stepWhale(dt);
    this.stepSeats();
    this.stepInvasion(dt);
    this.stepInvasion2(dt);
    this.stepInvasion3(dt);
    this.stepSkyGuard(night);
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
      players.push({ name: n, x: r2(o.x), y: r2(o.y), z: r2(o.z), yaw: r2(o.yaw), anim: ol.anim, away: ol.awayFor !== null, dead: o.dead, ...(ol.riding && o.star ? { star: true } : {}), ride: ol.dragon ? 'dragon' : ol.riding ? 'deer' : ol.fish ? 'fish' : ol.frog ? 'frog' : this.seatOf(n) !== null ? 'whale' : null, seat: ol.seat, capa: o.capaLvl ?? 0, ...this.lookField(o) });
    }
    const wolves: WolfView[] = this.wolves
      .filter((w) => near(w.x, w.z))
      .map((w) => ({ id: w.id, kind: w.kind, x: r2(w.x), y: r2(w.y), z: r2(w.z), yaw: r2(w.yaw), anim: w.anim, raid: w.raid, ...(w.burn && w.hp > 0 ? { burning: true as const } : {}), ...(w.aim && w.hp > 0 ? { aim: { x: r2(w.aim.x), z: r2(w.aim.z) } } : {}), ...((w.stuck ?? 0) > 0 && w.hp > 0 ? { stuck: true as const } : {}) }));
    const b = this.boss;
    if (b && near(b.x, b.z)) wolves.push({ id: b.id, kind: b.kind, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.yaw), anim: b.anim, raid: false });
    const sh = this.shield;
    const b2 = this.boss2;
    if (b2 && near(b2.x, b2.z)) wolves.push({ id: b2.id, kind: b2.kind, x: r2(b2.x), y: r2(b2.y), z: r2(b2.z), yaw: r2(b2.yaw), anim: b2.anim, raid: false });
    const b3 = this.boss3;
    if (b3 && near(b3.x, b3.z)) wolves.push({ id: b3.id, kind: b3.kind, x: r2(b3.x), y: r2(b3.y), z: r2(b3.z), yaw: r2(b3.yaw), anim: b3.anim, raid: false });
    const b4 = this.boss4;
    if (b4 && near(b4.x, b4.z)) wolves.push({ id: b4.id, kind: b4.kind, x: r2(b4.x), y: r2(b4.y), z: r2(b4.z), yaw: r2(b4.yaw), anim: b4.anim, raid: false });
    if (sh && near(sh.x, sh.z)) wolves.push({ id: sh.id, kind: sh.kind, x: r2(sh.x), y: r2(sh.y), z: r2(sh.z), yaw: r2(sh.yaw), anim: sh.anim, raid: false });
    const tf = this.towerFlecha;
    if (tf && near(tf.x, tf.z)) wolves.push({ id: tf.id, kind: tf.kind, x: r2(tf.x), y: r2(tf.y), z: r2(tf.z), yaw: r2(tf.yaw), anim: tf.anim, raid: false, ...(tf.aim && tf.hp > 0 ? { aim: { x: r2(tf.aim.x), z: r2(tf.aim.z) } } : {}), ...((tf.stuck ?? 0) > 0 && tf.hp > 0 ? { stuck: true as const } : {}), ...(tf.burn && tf.hp > 0 ? { burning: true as const } : {}) });
    const fb = this.towerFinal;
    if (fb && near(fb.x, fb.z)) {
      wolves.push({ id: fb.id, kind: fb.kind, x: r2(fb.x), y: r2(fb.y), z: r2(fb.z), yaw: r2(fb.yaw), anim: fb.anim, raid: false });
      for (const br of fb.brotes) if (!br.broken) wolves.push({ id: br.id, kind: br.kind, x: r2(br.x), y: r2(br.y), z: r2(br.z), yaw: 0, anim: 'idle', raid: false });
      const c = fb.core;
      if (c) wolves.push({ id: c.id, kind: c.kind, x: r2(c.x), y: r2(c.y), z: r2(c.z), yaw: r2(c.yaw), anim: c.anim, raid: false });
    }
    const pe = this.peat;
    if (pe && near(pe.x, pe.z)) wolves.push({ id: pe.id, kind: pe.kind, x: r2(pe.x), y: r2(pe.y), z: r2(pe.z), yaw: r2(pe.yaw), anim: pe.anim, raid: false, ...(pe.burn && pe.hp > 0 ? { burning: true as const } : {}) });
    const rk = this.rock;
    if (rk && near(rk.x, rk.z)) wolves.push({ id: rk.id, kind: rk.kind, x: r2(rk.x), y: r2(rk.y), z: r2(rk.z), yaw: r2(rk.yaw), anim: rk.anim, raid: false, ...(rk.burn && rk.hp > 0 ? { burning: true as const } : {}) });
    const el = this.elite;
    if (el && near(el.x, el.z)) wolves.push({ id: el.id, kind: el.kind, x: r2(el.x), y: r2(el.y), z: r2(el.z), yaw: r2(el.yaw), anim: el.anim, raid: false });
    const la = this.lakeAnchor;
    if (la && near(la.x, la.z)) wolves.push({ id: la.id, kind: la.kind, x: r2(la.x), y: r2(la.y), z: r2(la.z), yaw: 0, anim: 'idle', raid: false });
    for (const a of this.anchorFoes) if (a.hp > 0 && near(a.x, a.z)) wolves.push({ id: a.id, kind: a.kind, x: r2(a.x), y: r2(a.y), z: r2(a.z), yaw: 0, anim: 'idle', raid: false });
    const mm = this.marchito;
    if (mm && near(mm.x, mm.z)) wolves.push({ id: mm.id, kind: mm.kind, x: r2(mm.x), y: r2(mm.y), z: r2(mm.z), yaw: r2(mm.yaw), anim: mm.anim, raid: false });
    const marchito = mm ? { will: Math.round(mm.hp), max: mm.max, laughing: mm.laugh > 0, ...(mm.grab !== null ? { grab: r2(Math.min(1, mm.grab / MARCHITO.grabFor)) } : {}), ...(mm.channel !== null ? { channel: r2(Math.min(1, mm.channel / MARCHITO.channelFor)) } : {}) } : null;
    const h = this.heart();
    const raid = this.raid ? { phase: this.raid.phase, dir: r2(this.raid.dir), level: this.raidLevel } : null;
    const heart = h ? { id: h.id, hp: Math.round(h.hp), max: STRUCTURE_HP.heart } : null;
    const graves = this.graves.map(({ id, owner, x, y, z }) => ({ id, owner, x, y, z }));
    return { t: 'snap', time: r2(this.time), players, wolves, self: this.selfState(p, l), raid, heart, graves, vines: this.vines.map(({ id, x, z, r, base, top }) => ({ id, x, z, r, base: r2(base), top: r2(top) })), shrines: this.shrineViews(), dungeon: this.dungeonView(), ally: this.ally ? { x: r2(this.ally.x), y: r2(this.ally.y), z: r2(this.ally.z), yaw: r2(this.ally.yaw), anim: this.ally.anim } : null, ally2: this.ally2 ? { x: r2(this.ally2.x), y: r2(this.ally2.y), z: r2(this.ally2.z), yaw: r2(this.ally2.yaw), anim: this.ally2.anim } : null, ally3: this.ally3 ? { x: r2(this.ally3.x), y: r2(this.ally3.y), z: r2(this.ally3.z), yaw: r2(this.ally3.yaw), anim: this.ally3.anim } : null, ally4: this.ally4 ? { x: r2(this.ally4.x), y: r2(this.ally4.y), z: r2(this.ally4.z), yaw: r2(this.ally4.yaw), anim: this.ally4.anim } : null, escalera: this.escalera, zarzalBurnt: this.zarzalBurnt, fogatas: [...this.fogatas], steeds: this.steedViews(near), fish: this.fishViews(near), frogs: this.frogViews(near), dragons: this.dragonViews(near), fog: this.fogOpen ? 'open' : missingRoot(this) ? 'closed' : 'ready', towerH: this.ending ? LOOKOUT.h : towerHeight(Math.floor(this.time / DAY_LENGTH), this.towerDay0), whale: this.whaleView(), marchito, corrupt: this.corrupt(), pillars: this.pillarView(), towerOpen: this.towerOpen, ending: this.ending, raidsOff: this.raidsOff, estrella: this.estrellaView(near), cage: this.invasion2 === 'taken' ? { anchors: this.anchors.map((b, i) => (b ? 0 : Math.max(1, Math.ceil(this.anchorFoes.find((a) => a.id === RESCUE.anchorIdBase + i)?.hp ?? RESCUE.anchorHp)))) } : null };
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
      structures: this.structures.filter((s) => s.kind !== 'pillar').map((s) => ({ ...s })), // pillars are temporary
      resources: Object.fromEntries([...this.resState].map(([id, s]) => [String(id), { ...s }])),
      players: [...this.players.values()].map((p) => structuredClone(p)),
      raidLevel: this.raidLevel,
      ...(this.raidN ? { raidN: this.raidN } : {}),
      ...(this.swampSeen ? { swampSeen: true } : {}),
      ...(this.mountainsSeen ? { mountainsSeen: true } : {}),
      ...(this.fogOpen ? { fogOpen: true } : {}),
      ...(this.corruptSeen ? { corruptSeen: true } : {}),
      ...(this.pillarsBroken.some(Boolean) ? { pillars: [0, 1, 2, 3].filter((i) => this.pillarsBroken[i]) } : {}),
      towerDay0: this.towerDay0,
      graves: this.graves.map((g) => ({ ...g, inv: { ...g.inv } })),
      purified: this.purified,
      ...(this.purified2 ? { purified2: true } : {}),
      ...(this.purified3 ? { purified3: true } : {}),
      ...(this.zarzalBurnt ? { zarzalBurnt: true } : {}),
      ...(this.purified4 ? { purified4: true } : {}),
      ...(this.escalera ? { escalera: true } : {}),
      ...(this.fogatas.some(Boolean) ? { fogatas: [...this.fogatas] } : {}),
      ...(this.invasion === 'none' ? {} : { invasion: this.invasion }),
      ...(this.invasion2 === 'none' ? {} : { invasion2: this.invasion2 }),
      ...(this.invasion3 === 'none' ? {} : { invasion3: this.invasion3 }),
      ...(this.towerOpen ? { towerOpen: true } : {}),
      ...(this.ending ? { ending: true } : {}),
      ...(this.endingNames.length ? { endingNames: [...this.endingNames] } : {}),
      ...(this.raidsOff ? { raidsOff: true } : {}),
      ...(this.invasion2 === 'taken' ? { anchors: [...this.anchors] } : {}),
      ...(this.cleansed.size ? { cleansed: [...this.cleansed].sort((a, b) => a - b) } : {}),
      ...(this.whaleTamed ? { whale: { x: r2(this.whale.x), z: r2(this.whale.z), yaw: r2(this.whale.yaw) } } : {}),
    };
  }

  /** Everything you can climb or stand on: crags, shrine rocks (bare unless wrapped) and live vines. */
  climbables(): Crag[] {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    return [...this.crags, ...bare, ...this.vines, ...this.padCrags(), ...plankCrags(this.swampLive.planks.map((pl) => this.time >= pl.downUntil)), ...this.amberTrees.flatMap((t) => (t.stump ? [t.stump] : [])), ...this.ledges, shelfCrag(), towerShelfCrag(), ...columnCrags(), ...structureCrags(this.structures)];
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
    if (l.tame?.beast === 'dragon') {
      p.yaw = m.yaw; // on the wild dragon's back: it flies its circle (stepTaming)
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
    if (!l.dragon && rimCrossBlocked(p.z, m.z, m.x, this.ending)) {
      // S5: el Borde only crosses flying (the dragon's gate is in onFly).
      this.hint(p.name, l, STEEP_TEXT.rim);
      l.fix = true;
      return;
    }
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
      const depthOk = m.y >= fishFloor(this.terrain, m.x, m.z) - 0.3 && m.y <= waterLevel(this.terrain, m.x, m.z) + 0.5;
      if (!wet || !depthOk || moved > FISH.maxSpeed * elapsed + 1) {
        l.fix = true;
        return;
      }
      this.accept(p, l, m);
      p.fish = { x: r2(p.x), z: r2(p.z) };
      return;
    }
    if (l.dragon) return this.onFly(p, l, m, moved, elapsed);
    const inBounds = inAnyDungeon(m.x, m.z) || inMap(m.x, m.z, 2);
    const through = clampStep(p.x, p.z, m.x, m.z, this.gates(), this.coastGates(), this.swampGates(), this.mountainGates(), this.towerGates());
    // Inside, walls are a clamp: a move the clamp would change went through a wall or the shut gate.
    const wallOk = !inAnyDungeon(p.x, p.z, 2) || Math.hypot(through.x - m.x, through.z - m.z) < 0.3;
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), waterLevel(this.terrain, m.x, m.z) - 0.9);
    const cragCeiling = cragsNear(this.climbables(), m.x, m.z, CLIMB_PAD).reduce((t, c) => Math.max(t, c.top + 3), -Infinity);
    // ponytail: above ground + 4 and away from crags you may only go down (falling or gliding).
    // Hovering at a constant height passes; fine for co-op, add a sink-rate check if it's abused.
    // Riders cannot climb (no crag allowance) nor swim.
    const lifted = this.time < l.boostUntil && m.y <= l.boostCeil; // a gust's lift while gliding
    // ponytail: the frog's high jump is only a ceiling (ground + FROG.ceil), no server jump physics.
    const yOk = m.y > ground - 1 && (m.y < ground + (l.frog ? FROG.ceil : 4) || (!l.riding && !l.frog && m.y < cragCeiling) || m.y <= p.y || lifted);
    const dryOk = l.frog ? frogMoveOk(this.terrain, p, m, m.y > Math.max(this.terrain.heightAt(m.x, m.z), waterLevel(this.terrain, m.x, m.z)) + 0.5, this.climbables()) : !l.riding || this.terrain.heightAt(m.x, m.z) >= waterLevel(this.terrain, m.x, m.z) - 0.6;
    // The sea past 4 m turns swimmers back (they may only head shallower); gliders fly over it.
    const swimming = m.y < waterLevel(this.terrain, m.x, m.z) - 0.5;
    const seaOk = !swimming || deepStepOk(this.terrain, p.x, p.z, m.x, m.z);
    if (!seaOk) this.hint(p.name, l, 'La corriente te devuelve');
    // Las Montañas: no walking or riding uphill onto a cell over 50° (the client stops at 45°). The frog's high jump is exempt.
    // S4-B: walkers may climb steep rock that is neither smooth nor wet (stamina is the client's, as on crags).
    const wet = this.mountainWet();
    const steep = !l.frog && m.y < ground + 0.6 && (l.riding || !climbableAt(m.x, m.z, wet && !hasSkill(p, 'trepador'))) && steepBlocked(this.terrain, p.x, p.z, m.x, m.z, STEEP.serverDeg);
    if (steep) this.hint(p.name, l, STEEP_TEXT[smoothAt(m.x, m.z) ? 'smooth' : l.riding ? 'deer' : wet ? 'wet' : 'steep']);
    // The server knows who rides: only riders (and just-dismounted ones, for lag) get the deer's speed.
    const mounted = l.riding || l.frog || this.time < l.rodeUntil;
    // Walkers wade through the Ciénaga's mud (only when the whole window was spent in it, so entering is never unfair).
    const wading = !mounted && inCienaga(l.anchorX, l.anchorZ) && inCienaga(m.x, m.z);
    // El Zarzal slows walkers and riders; the bog slows walkers (same whole-window rule).
    const thorny = zarzalAt(this.terrain, l.anchorX, l.anchorZ, this.zarzalBurnt) && zarzalAt(this.terrain, m.x, m.z, this.zarzalBurnt);
    const bogged = !mounted && inBog(this.terrain, l.anchorX, l.anchorZ) && inBog(this.terrain, m.x, m.z);
    const herd = hasSkill(p, 'pastor') ? SKILL_FX.mount : 1; // P4-B Pastor
    const base = thorny ? ZARZAL.speed : l.riding ? (p.star ? ESTRELLA.maxSpeed : MOUNT.maxSpeed) * herd : l.frog ? FROG.maxSpeed * herd : mounted ? l.graceCap : wading ? CIENAGA.speed : bogged ? MAX_SPEED * BOG.k : MAX_SPEED;
    // El tobogán (S4-H): a belly slide on snow, downhill over the whole window, may go up to 16.
    const sliding = m.anim === 'slide' && !l.riding && !l.frog && slideMoveOk(this.terrain, l.anchorX, l.anchorZ, m.x, m.z);
    const cap = sliding ? Math.max(base, SNOWSLIDE.maxSpeed) : base;
    // ponytail: speed + bounds sanity check only, no server physics. Fine for co-op; add server-side collision if cheating matters.
    if (!inBounds || !wallOk || !yOk || !dryOk || !seaOk || steep || moved > cap * elapsed + 1) {
      l.fix = true;
      return;
    }
    this.accept(p, l, m);
    if (sliding) {
      l.graceCap = this.time < l.rodeUntil ? Math.max(l.graceCap, SNOWSLIDE.maxSpeed) : SNOWSLIDE.maxSpeed;
      l.rodeUntil = Math.max(l.rodeUntil, this.time + SNOWSLIDE.grace);
    }
    if (l.riding) p.steed = { x: r2(p.x), z: r2(p.z) };
    if (l.frog) p.frog = { x: r2(p.x), z: r2(p.z) };
    if (m.y <= ground + 0.5) l.boosted = false; // landed (or swimming): the next flight may lift again
  }

  /**
   * On the dragon (S4-G): a height band over the ground, no slopes or water rules. Up to ground + 36 and y ≤ 121,
   * or any move that only goes down (flying off a cliff leaves you above the band until you sink back into it).
   * Never into the fog north of the rim nor into a dungeon; in a raid, never low near the Heart.
   */
  private onFly(p: SavedPlayer, l: Live, m: Extract<ClientMsg, { t: 'move' }>, moved: number, elapsed: number): void {
    const ground = Math.max(this.terrain.heightAt(m.x, m.z), waterLevel(this.terrain, m.x, m.z));
    if (!this.fogOpen && inFog(m.z)) {
      // S5-A: the fog gives way to a rider with the 4 Raíces-madre purified, once, for the world.
      if (!missingRoot(this)) {
        this.fogOpen = true;
        this.vision(VISION.fog(p.name));
      }
    }
    const fog = inFog(m.z, this.fogOpen);
    const missing = missingRoot(this);
    if (fog) this.hint(p.name, l, this.fogOpen ? FOG_EDGE_TEXT : missing ? fogText(missing) : FOG_TEXT);
    const band = m.y >= ground - 1 && m.y <= DRAGON.maxY + 1 && (m.y <= ground + DRAGON.serverCeil || m.y <= p.y);
    const low = this.noLanding(m.x, m.z) && m.y < ground + DRAGON.raidFloor && m.y < p.y;
    if (!inMap(m.x, m.z, 2) || fog || inAnyDungeon(m.x, m.z) || !band || low || moved > DRAGON.maxSpeed * elapsed + 1) {
      l.fix = true;
      return;
    }
    this.accept(p, l, m);
    p.dragon = { x: r2(p.x), z: r2(p.z) };
  }

  /** During a raid the dragon does not land near the Heart (keeps raids a ground fight). */
  private noLanding(x: number, z: number): boolean {
    const h = this.heart();
    return !!this.raid && !!h && Math.hypot(h.x - x, h.z - z) <= DRAGON.heartNoLand;
  }

  /** Today's mountain weather wets the rock (rain or storm). */
  private mountainWet(): boolean {
    return wetAt(weatherAt(this.seed, Math.floor(this.time / DAY_LENGTH)));
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
    p.inv = addItem(p.inv, def.item, def.amount + (hasSkill(p, 'mano') ? SKILL_FX.harvest : 0));
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
    if (kind === 'pillar') return; // raised by Piedra, never placed
    if (kind === 'fire' && !p.fuego) return toast(`Hace falta el ${NAMES.powerFire}`);
    if (kind === 'tower' && !p.piedra) return toast(`Hace falta la ${NAMES.powerStone}`);
    if (!hasAll(p.inv, BUILD_COST[kind])) return toast('Faltan materiales');
    if (kind === 'heart' && this.heart()) return toast('Ya hay un Corazón en este mundo');
    if (Math.hypot(x - p.x, z - p.z) > BUILD_REACH) return toast('Demasiado lejos');
    const y = this.terrain.heightAt(x, z);
    if (y < WATER_LEVEL || !inForest(x, z, 4)) return toast('No se puede construir aquí'); // the base stays in the forest
    if (this.structures.some((s) => Math.hypot(s.x - x, s.z - z) < 1.5)) return toast('Hay algo en el camino');
    if (this.structures.length >= MAX_STRUCTURES) return toast('El mundo ya tiene demasiadas construcciones');
    p.inv = removeAll(p.inv, BUILD_COST[kind]);
    const s: Structure = { id: this.nextStructureId++, kind, x: r2(x), y: r2(y), z: r2(z), rot: r2(rot), owner: p.name, hp: (kind === 'spikes' || kind === 'roots') && hasSkill(p, 'trampero') ? STRUCTURE_HP[kind] * SKILL_FX.trap : STRUCTURE_HP[kind] };
    this.structures.push(s);
    this.outbox.push({ to: null, msg: { t: 'built', s } });
    toast(BUILT_TEXT[kind]);
  }

  private onAttack(p: SavedPlayer, l: Live, id: number): void {
    const w = this.enemy(id);
    if (!w || w.hp <= 0 || p.dead || this.time + EPS < l.punchReadyAt) return;
    if (l.dragon) {
      // S5 §8.3: from the dragon, only a claw at a rayo in reach (3D).
      if (w.kind !== 'rayo') return this.hint(p.name, l, 'Desde el aire solo alcanzas a los rayos');
      if (!clawReach(p, w)) return;
      l.punchReadyAt = this.time + AIR.cooldown;
      l.anim = 'attack';
      return this.strike(p.name, w, AIR.claw);
    }
    if (Math.hypot(w.x - p.x, w.z - p.z) > PUNCH.reach) return;
    if (w.kind === 'rayo' && !rayoLow(w, this.terrain.heightAt(w.x, w.z))) return this.hint(p.name, l, 'Vuela alto. Flechas, o viento');
    if (w === this.lakeAnchor && !this.diving(p, w)) return this.hint(p.name, l, 'Está en el fondo. Bucea con el pez');
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

  /** P4-B Buen ojo: your amber and quartz come back sooner. */
  private regrowDays(p: SavedPlayer, days: number): number {
    return hasSkill(p, 'ojo') ? SKILL_FX.regrowDays : days;
  }

  /** P4-B: spend a point on an oficio (branch order, points from the Rango). */
  private onLearn(p: SavedPlayer, id: SkillId): void {
    const skills = p.skills ?? [];
    const ok = canLearn(skills, id, rankOf(this.xpOf(p)));
    if (ok === 'owned') return;
    if (ok === 'order') return this.tell(p.name, 'Antes, el de arriba');
    if (ok === 'points') return this.tell(p.name, 'Sin puntos. Sube de Rango');
    p.skills = [...skills, id];
    this.tell(p.name, `${NAMES.skillNames[id]}. Aprendido`);
  }

  /** P4-B: at the Heart, 5 bayas, every point back. */
  private onForget(p: SavedPlayer): void {
    const h = this.heart();
    if (!h || p.dead || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    if (!p.skills?.length) return this.tell(p.name, 'No hay nada que olvidar');
    if ((p.inv.berries ?? 0) < SKILL_FX.forgetCost) return this.tell(p.name, `Hacen falta ${SKILL_FX.forgetCost} bayas`);
    p.inv = removeAll(p.inv, { berries: SKILL_FX.forgetCost });
    p.skills = [];
    this.tell(p.name, `Olvidas tus ${NAMES.skills.toLowerCase()}. Los puntos vuelven`);
  }

  /** P4-C: wear a colour and a hat (the hat must be unlocked). */
  private onLook(p: SavedPlayer, color: number, hat: number): void {
    if (!hatUnlocked({ ...p, ending: this.ending }, hat)) return this.tell(p.name, HAT_HINTS[HAT_IDS[hat - 1]!]);
    p.look = { color, hat };
  }

  /** P4-C: others only hear about a look that isn't the default. */
  private lookField(p: SavedPlayer): { look?: Look } {
    const l = this.lookOf(p);
    return l.color || l.hat ? { look: l } : {};
  }

  /** P4-C: the saved look, or the default if the save holds something odd. */
  private lookOf(p: SavedPlayer): Look {
    const l = p.look;
    return l && isLook(l.color, l.hat) && hatUnlocked({ ...p, ending: this.ending }, l.hat) ? { color: l.color, hat: l.hat } : { ...DEFAULT_LOOK };
  }

  private onUpgrade(p: SavedPlayer): void {
    const h = this.heart();
    if (!h || p.dead || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    const lvl = p.weaponLvl ?? 0;
    if (lvl >= UPGRADE.max) return this.tell(p.name, 'El arma ya no da más de sí');
    const cost = upgradeCost(lvl);
    if (!hasAll(p.inv, cost)) return this.tell(p.name, 'Faltan materiales');
    p.inv = removeAll(p.inv, cost);
    p.weaponLvl = lvl + 1;
    this.tell(p.name, `El ${NAMES.heart} templa tu arma: +${Math.round(UPGRADE.step * 100 * p.weaponLvl)} % de daño`);
  }

  /** Amber (S3 §6.2): 2 per tree, per player, back after 2 days. The high ones need you on the stump. */
  private onAmber(p: SavedPlayer, id: number): void {
    const t = this.amberTrees[id];
    if (!t || p.dead || Math.hypot(t.x - p.x, t.z - p.z) > AMBER.reach || p.y < t.y - 1) return;
    const at = p.amber?.[id];
    if (at !== undefined && this.time - at < this.regrowDays(p, AMBER.regrowDays) * DAY_LENGTH) return this.tell(p.name, 'Aún no ha vuelto a brotar');
    p.amber = { ...p.amber, [id]: r2(this.time) };
    p.inv = addItem(p.inv, 'amber', AMBER.yield);
    this.tell(p.name, `${ITEM_LABELS.amber}: ${AMBER.yield}`);
  }

  /** Quartz (S4 §5.2): 2 per vein, per player, back after 2 days; you must be up beside it (climbing or on the frog). */
  private onQuartz(p: SavedPlayer, id: number): void {
    const v = this.quartzVeins[id];
    if (!v || p.dead || Math.hypot(v.x - p.x, v.z - p.z) > QUARTZ.reach || p.y < v.y - QUARTZ.below) return;
    const at = p.quartz?.[id];
    if (at !== undefined && this.time - at < this.regrowDays(p, QUARTZ.regrowDays) * DAY_LENGTH) return this.tell(p.name, 'Aún no ha vuelto a brillar');
    p.quartz = { ...p.quartz, [id]: r2(this.time) };
    p.inv = addItem(p.inv, 'quartz', QUARTZ.yield);
    this.tell(p.name, `${ITEM_LABELS.quartz}: ${QUARTZ.yield}`);
  }

  // ---------------------------------------------------------------- fogatas (S3 §9)

  private lightFogata(p: SavedPlayer, i: number): void {
    this.fogatas[i] = true;
    this.tell(p.name, `La ${NAMES.fogata} prende. Se verá desde lejos, y de día lleva al ${NAMES.heart}`);
  }

  /** A with the torch at a dark fogata. */
  private onFogata(p: SavedPlayer, l: Live, id: number): void {
    const f = this.fogataSpots[id];
    if (!f || p.dead || this.fogatas[id] || Math.hypot(f.x - p.x, f.z - p.z) > FOGATA.reach) return;
    if (!l.torch) return this.tell(p.name, 'Hace falta fuego');
    l.torch = false;
    this.lightFogata(p, id);
  }

  /** Start a fogata channel: from a lit fogata to the Heart, or from the Heart to lit fogata `to`. */
  private onTravel(p: SavedPlayer, l: Live, to: 'heart' | number): void {
    if (p.dead || l.travel || inAnyDungeon(p.x, p.z) || l.tame || l.race) return;
    const h = this.heart();
    let dest: { x: number; z: number };
    if (to === 'heart') {
      if (!h || h.hp <= 0) return this.tell(p.name, `No hay ${NAMES.heart} al que volver`);
      if (!this.fogataSpots.some((f, i) => this.fogatas[i] && Math.hypot(f.x - p.x, f.z - p.z) <= FOGATA.reach)) return;
      dest = { x: h.x + 2, z: h.z };
    } else {
      const f = this.fogataSpots[to];
      if (!f || !h || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
      if (!this.fogatas[to]) return this.tell(p.name, `Esa ${NAMES.fogata} sigue apagada`);
      dest = { x: f.x + FOGATA.arrive, z: f.z };
    }
    if (l.riding || l.seat || l.fish || l.frog || l.dragon || this.seatOf(p.name) !== null) return this.tell(p.name, 'Baja de la montura primero');
    if (isNight(dayFraction(this.time))) return this.tell(p.name, 'De noche el fuego no guía a nadie');
    const secs = hasSkill(p, 'fogatero') ? SKILL_FX.channel : FOGATA.channel;
    l.travel = { ...dest, at: this.time + secs, fromX: p.x, fromZ: p.z, hp: p.vitals.health };
    this.tell(p.name, `Miras el fuego… (${secs} s)`);
  }

  /** At the lit Ceniza fogata: your own parked deer, frog or fish comes (S5 §4). */
  private onCall(p: SavedPlayer, l: Live, beast: CallBeast): void {
    // P4-B Silbido: any lit fogata within reach will do.
    const lit = hasSkill(p, 'silbido') ? this.fogataSpots.find((g, i) => this.fogatas[i] && Math.hypot(g.x - p.x, g.z - p.z) <= FOGATA.reach) : undefined;
    const f = lit ?? this.fogataSpots[FOGATA.ceniza];
    if (!f || p.dead || inAnyDungeon(p.x, p.z) || Math.hypot(f.x - p.x, f.z - p.z) > FOGATA.reach) return;
    if (!lit && !this.fogatas[FOGATA.ceniza]) return this.tell(p.name, `Esa ${NAMES.fogata} sigue apagada`);
    const key = beast === 'deer' ? 'steed' : beast;
    if (!p[key]) return this.tell(p.name, CALL_NONE[beast]);
    if ((beast === 'deer' && l.riding) || (beast === 'frog' && l.frog) || (beast === 'fish' && l.fish)) return;
    p[key] = callSpot(beast, f, corruptFeatures(this.seed).lake);
    this.tell(p.name, CALL_TEXT[beast]);
  }

  /** Channels land after 5 s; damage, drifting, mounting, death or night stop them. */
  private stepTravel(night: boolean): void {
    for (const [name, l] of this.live) {
      const t = l.travel;
      if (!t) continue;
      const p = this.players.get(name)!;
      const broken = p.dead || night || p.vitals.health < t.hp - EPS || Math.hypot(p.x - t.fromX, p.z - t.fromZ) > FOGATA.drift || l.riding || !!l.seat || l.fish || l.frog || l.dragon || this.seatOf(name) !== null;
      if (broken) {
        l.travel = null;
        if (!p.dead) this.tell(name, 'El viaje se interrumpe');
        continue;
      }
      if (this.time + EPS < t.at) continue;
      l.travel = null;
      p.x = t.x;
      p.z = t.z;
      p.y = this.terrain.heightAt(t.x, t.z);
      l.fix = true;
      l.anchorX = p.x;
      l.anchorZ = p.z;
      l.anchorAt = this.time;
      l.lastAcceptedAt = this.time;
    }
  }

  /** Capa de corteza at the Heart: −10 % damage taken per level, up to 4 (the 4th costs black thorns). */
  private onCapa(p: SavedPlayer): void {
    const h = this.heart();
    if (!h || p.dead || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return;
    const lvl = p.capaLvl ?? 0;
    if (lvl >= CAPA.max) return this.tell(p.name, 'La capa ya no admite más corteza');
    if (!hasAll(p.inv, capaCost(lvl))) return this.tell(p.name, 'Faltan materiales');
    p.inv = removeAll(p.inv, capaCost(lvl));
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
    const b = this.boss3;
    if (b && b.latch === p.name) {
      b.latch = null;
      b.latchLeft = 0;
      this.tell(p.name, 'Ruedas y te lo quitas de encima');
    }
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
    if (Math.hypot(w.x - p.x, w.z - p.z) > BOW.range * (this.onTower(p) ? TOWER.rangeMult : 1) || !inCone(p.x, p.z, p.yaw, w.x, w.z, BOW.cone)) return;
    if (w === this.lakeAnchor && !this.diving(p, w)) return this.hint(p.name, l, 'Está en el fondo. Bucea con el pez');
    g.bowReadyAt = this.time + BOW.cooldown;
    l.anim = 'bow';
    this.strike(p.name, w, BOW.damage * weaponMult(p.weaponLvl ?? 0), true);
  }

  private onRevive(p: SavedPlayer, name: string): void {
    const t = this.players.get(name);
    const tl = this.live.get(name);
    if (p.dead || !t || !t.dead || !tl || name === p.name || tl.deadAt === null) return;
    if (Math.hypot(t.x - p.x, t.z - p.z) > REVIVE.reach * (hasSkill(p, 'amiga') ? SKILL_FX.reviveReach : 1)) return;
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
    if (s.kind === 'peat' && !this.shrineOpen(id)) return this.tell(p.name, 'Raíces de turba. Esto solo arde. Vuelve luego');
    if (!this.shrineOpen(id)) return this.tell(p.name, 'Una verja de luz lo protege');
    p.shrines = [...cleared, id];
    // The shrine's light cleanses the corrupt zone of its own biome nearest it, never a Raíz-madre's
    // (forest 0 takes the Tragón, coast 6 the Antenón, swamp 10 El Zancudo, mountain 14 El Cucurucho).
    const biome = (i: number) => (isCorruptLandZone(i) ? 'tierras' : isMountainZone(i) ? 'mountain' : isSwampZone(i) ? 'swamp' : isCoastZone(i) ? 'coast' : 'forest');
    const mine = s.id >= MOUNTAIN_SHRINE.firstId ? 'mountain' : s.id >= SWAMP_SHRINE.firstId ? 'swamp' : s.id >= COAST_SHRINE.firstId ? 'coast' : 'forest';
    // A Piedra pillar raised ≤2 m from a 15–17 root crushes it (onStone); zone 14 is cleansed by beating El Cucurucho (stepCucuruchoFight).
    const roots: number[] = [0, COAST_ZONES.root, SWAMP_ZONES.root, MOUNTAIN_ZONES.root];
    const ids = this.corrupt().filter((i) => !roots.includes(i) && biome(i) === mine);
    const zn = nearestZone(this.zones, s.x, s.z, ids);
    if (mine === 'mountain') {
      p.inv = addItem(p.inv, 'quartz', QUARTZ.orb);
      this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento y ${QUARTZ.orb} de ${NAMES.quartz}`);
    } else if (mine === 'swamp') {
      p.inv = addItem(p.inv, 'amber', AMBER.orb);
      this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento y ${AMBER.orb} de ${NAMES.amber}`);
    } else this.tell(p.name, `${SHRINE_LABELS[s.kind]}: orbe de mejora, +20 de aliento`);
    const where = { forest: 'bosque', coast: 'costa', swamp: 'pantano', mountain: 'montaña' }[mine];
    if (zn) this.cleanse(zn.id, `La luz del santuario limpia un trozo de ${where}`);
  }

  /** Levers, wheels and Marea's pumice block. */
  private onShrinePart(p: SavedPlayer, s: Shrine, st: (typeof this.shrineLive)[number], part: number): void {
    if (s.kind === 'candles') return this.onCandle(p, s, st, part);
    if (s.kind === 'blocks') return this.onBlocks(p, s, st, part);
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

  /** Bloques: parts 1–3 = push that block one cell away from you (Empujar, needs Piedra), part 7 = the reset lever. */
  private onBlocks(p: SavedPlayer, s: Shrine, st: (typeof this.shrineLive)[number], part: number): void {
    if (part === MOUNTAIN_SHRINE.lever) {
      const lever = s.parts[MOUNTAIN_SHRINE.lever - 1]!;
      if (Math.hypot(lever.x - p.x, lever.z - p.z) > SHRINE.partReach) return;
      st.cells = BLOCKS.starts.map((c) => [c[0], c[1]] as const);
      st.openUntil = -Infinity;
      return this.tell(p.name, 'Los bloques vuelven a su sitio');
    }
    const cell = st.cells[part - 1];
    if (!cell) return;
    const at = blockCell(blocksCentre(s), cell);
    if (Math.hypot(at.x - p.x, at.z - p.z) > SHRINE.partReach) return;
    if (!p.piedra) return this.tell(p.name, 'No se mueve');
    if (blocksSolved(st.cells)) return;
    const next = pushBlock(st.cells, part - 1, pushDir(p.x, p.z, at.x, at.z));
    if (!next) return this.tell(p.name, 'Algo lo frena');
    st.cells = next;
    this.tell(p.name, blocksSolved(next) ? 'Los bloques encajan. Algo se abre en el santuario' : 'La roca se arrastra');
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
    if (!l.torch) return this.tell(p.name, 'Hace falta fuego'); // or a Llamarada (onFlame)
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
    const offMap = inDungeon(p.x, p.z) ? !inDungeon(x, z, -1) : inCoastDungeon(p.x, p.z) ? !inCoastDungeon(x, z, -1) : inTowerDungeon(p.x, p.z) ? !inTowerDungeon(x, z, -1) : !inMap(x, z, 4);
    if (Math.hypot(x - p.x, z - p.z) > ENREDADERA.reach || offMap) return this.tell(p.name, 'Demasiado lejos');
    const others = this.vines.filter((v) => v.owner !== p.name);
    const wrapped = new Set(others.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    const tended = this.tendRoot(p, x, z);
    const plan = planVine(this.terrain, [...this.crags, ...others], bare, r2(x), r2(z), this.nextVineId);
    if (!plan) {
      if (tended) l.powerReadyAt = this.time + ENREDADERA.cooldown;
      return tended ? undefined : this.tell(p.name, 'No hay sitio para crecer');
    }
    if (plan.id === this.nextVineId) this.nextVineId++;
    this.vines = [...others, { ...plan, owner: p.name, until: this.time + ENREDADERA.life }];
    l.powerReadyAt = this.time + ENREDADERA.cooldown;
    if (!tended) this.tell(p.name, 'Crece una enredadera');
    // Coast roots wither to Viento, not Enredadera (see onGust).
    const zn = this.zones.find((z) => z.id !== 0 && !isCoastZone(z.id) && !isSwampZone(z.id) && !isMountainZone(z.id) && !isCorruptLandZone(z.id) && !this.cleansed.has(z.id) && Math.hypot(z.x - plan.x, z.z - plan.z) <= CORRUPTION.cleanseReach);
    if (zn) this.cleanse(zn.id, 'La raíz marchita se seca. El bosque respira');
    // Swamp roots (11–13) burn to Fuego (see flameThings); zone 10 is cleansed by beating El Zancudo (stepZancudoFight).
    if (inTowerDungeon(p.x, p.z)) this.growTowerBridge(plan);
    this.castFinal(p.name, 'vine', (x, z) => Math.hypot(x - plan.x, z - plan.z) <= FINAL.castReach + plan.r);
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
    const ground = Math.max(this.terrain.heightAt(p.x, p.z), waterLevel(this.terrain, p.x, p.z));
    if (!l.boosted && p.y > ground + 1.5 && !l.riding && !l.fish && this.seatOf(p.name) === null) {
      l.boosted = true;
      l.boostCeil = p.y + VIENTO.boost + 0.5;
      l.boostUntil = this.time + VIENTO.boostFor;
    }
    this.gustEnemies(p, dir, hits);
    this.gustThings(p, dir, hits);
    this.gustTowerVents(p, hits);
    this.castFinal(p.name, 'wind', (x, z) => hits(x, z));
  }

  private gustEnemies(p: SavedPlayer, dir: Dir, hits: (x: number, z: number) => boolean): void {
    const foes: Wolf[] = [...this.wolves, ...(this.elite ? [this.elite] : []), ...(this.shield ? [this.shield] : []), ...(this.peat ? [this.peat] : []), ...(this.rock ? [this.rock] : []), ...(this.boss ? [this.boss] : []), ...(this.boss2 ? [this.boss2] : []), ...(this.boss3 ? [this.boss3] : []), ...(this.boss4 ? [this.boss4] : []), ...(this.towerFlecha ? [this.towerFlecha] : []), ...(this.marchito ? [this.marchito] : []), ...this.anchorFoes, ...(this.lakeAnchor ? [this.lakeAnchor] : [])];
    let drowned = 0;
    for (const w of foes) {
      if (w.hp <= 0 || !hits(w.x, w.z)) continue;
      if (w.kind === 'anchor') {
        if (w === this.lakeAnchor && !this.diving(p, w)) continue;
        this.strike(p.name, w, VIENTO.damage * RESCUE.gustMult);
        continue;
      }
      if (w === this.boss2) {
        this.gustAntenon(p.name, this.boss2, dir);
        continue;
      }
      if (w === this.boss3) {
        this.strike(p.name, w, VIENTO.damage, true); // in the air: the gust only scratches it
        continue;
      }
      if (w.kind === 'rayo') {
        w.grounded = RAYO.grounded; // knocked out of the air
        w.dive = undefined;
      }
      const heavy = w.kind !== 'wolf' && w.kind !== 'brute' && w.kind !== 'rayo';
      const was = this.terrain.heightAt(w.x, w.z);
      let to = slide(w.x, w.z, dir, heavy ? VIENTO.heavyPush : VIENTO.push);
      if (!inAnyDungeon(w.x, w.z)) to = clampMap(to.x, to.z, 3);
      else if (inTowerDungeon(w.x, w.z)) to = clampTowerDungeon(w.x, w.z, to.x, to.z, this.towerGates());
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

  /** Fuego: the Llamarada, a short cone of flame. Scorches and sets beasts burning (wolves run), lights braziers and gas lamps, burns thorns, peat and swamp roots. */
  private onFlame(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!p.fuego) return this.tell(p.name, 'Aún no tienes ese poder');
    const ready = l.fireReadyAt ?? 0;
    if (this.time + EPS < ready) return this.tell(p.name, `El fuego aún no prende (${Math.ceil(ready - this.time - EPS)} s)`);
    l.fireReadyAt = this.time + FUEGO.cooldown;
    p.vitals = { ...p.vitals, warmth: Math.min(100, p.vitals.warmth + COLD.warmFlame) }; // the flame warms your hands (S4 §3.4)
    const dir = gustDir(p.x, p.z, x, z);
    const hits = (tx: number, tz: number, range: number = FUEGO.range) => inFlame(p.x, p.z, dir, tx, tz, range);
    this.flameEnemies(p, hits);
    this.flameThings(p, hits);
  }

  private flameEnemies(p: SavedPlayer, hits: (x: number, z: number) => boolean): void {
    const foes: Wolf[] = [...this.wolves, ...(this.elite ? [this.elite] : []), ...(this.shield ? [this.shield] : []), ...(this.peat ? [this.peat] : []), ...(this.rock ? [this.rock] : []), ...(this.boss ? [this.boss] : []), ...(this.boss2 ? [this.boss2] : []), ...(this.boss3 ? [this.boss3] : []), ...(this.boss4 ? [this.boss4] : []), ...(this.towerFlecha ? [this.towerFlecha] : []), ...(this.marchito ? [this.marchito] : []), ...this.anchorFoes];
    for (const w of foes) {
      if (w.hp <= 0 || !hits(w.x, w.z)) continue;
      this.strike(p.name, w, FUEGO.damage, w === this.boss3);
      // Bosses, El Marchito and the cage's anchors take the scorch but do not catch fire.
      if (w === this.boss || w === this.boss2 || w === this.boss3 || w === this.boss4 || w === this.towerFlecha || w === this.marchito || w.kind === 'anchor' || w.hp <= 0) continue;
      w.burn = FUEGO.burnFor;
      if (w.kind === 'wolf') this.scare(w, p.x, p.z);
    }
  }

  /** A wolf runs away from (x, z) for a while. */
  private scare(w: Wolf, x: number, z: number): void {
    w.flee = FUEGO.flee;
    w.fleeFrom = { x, z };
  }

  private flameThings(p: SavedPlayer, hits: (x: number, z: number, range?: number) => boolean): void {
    this.shrines.forEach((s, id) => {
      const st = this.shrineLive[id]!;
      if (s.kind === 'candles') {
        let lit = false;
        s.parts.slice(0, 3).forEach((b, i) => {
          if (!hits(b.x, b.z)) return;
          st.lit[i] = this.time + SWAMP_SHRINE.litFor;
          lit = true;
        });
        if (!lit) return;
        if (st.lit.every((t) => this.time < t)) {
          if (!this.shrineOpen(id)) this.tell(p.name, 'Los tres braseros arden. Algo se abre en el santuario');
          st.openUntil = Math.max(st.openUntil, this.time + SHRINE.openFor);
        } else this.tell(p.name, 'El brasero prende');
      }
      if (s.kind === 'peat' && !this.shrineOpen(id) && hits(s.x, s.z, FUEGO.range + 1.5)) {
        st.burns++;
        if (st.burns < FUEGO.burns) return this.tell(p.name, `La turba humea (${st.burns}/${FUEGO.burns})`);
        st.openUntil = Infinity;
        this.tell(p.name, 'La turba arde y se deshace. El santuario queda abierto');
      }
    });
    for (const zn of this.zones) {
      if (!isSwampZone(zn.id) || zn.id === SWAMP_ZONES.root || this.cleansed.has(zn.id)) continue;
      if (hits(zn.x, zn.z, FUEGO.rootReach)) this.cleanse(zn.id, 'El fuego seca la raíz marchita. El pantano respira');
    }
    const fire = this.pillarSpots.cores[2]!;
    if (!this.pillarsBroken[2] && this.pillarLive.burns < ASH_RUN.burns && hits(fire.x, fire.z, FUEGO.rootReach)) {
      this.pillarLive.burns++;
      this.tell(p.name, this.pillarLive.burns < ASH_RUN.burns ? `El capullo de espinas humea (${this.pillarLive.burns}/${ASH_RUN.burns})` : 'El capullo arde. El núcleo queda al aire');
    }
    if (!this.zarzalBurnt && hits(ZARZAL_KNOT.x, ZARZAL_KNOT.z, FUEGO.rootReach)) {
      this.knotBurns++;
      if (this.knotBurns < FUEGO.burns) this.tell(p.name, `El nudo del ${NAMES.swampGate.replace(/^el /, '')} humea (${this.knotBurns}/${FUEGO.burns})`);
      else {
        this.zarzalBurnt = true;
        this.say(`El nudo arde y ${NAMES.swampGate} se abre. Hay un paso a pie hacia ${NAMES.biomeSwamp}`);
        this.vision(VISION.knot(joinNames([p.name])));
      }
    }
    this.fogataSpots.forEach((f, i) => {
      if (!this.fogatas[i] && hits(f.x, f.z, FOGATA.light)) this.lightFogata(p, i);
    });
    this.flameTowerBraziers(p, hits);
    this.flameFinal(p, hits);
    if (!inSwampDungeon(p.x, p.z)) return;
    const S = SWAMP_DUNGEON;
    const g = this.swampLive;
    S.vents.forEach((v, i) => {
      const at = insideSwamp(v);
      if (!hits(at.x, at.z)) return;
      this.ventAt[i] = this.time;
      const b = this.boss3;
      if (b && b.hp > 0 && b.grounded <= 0 && overVent(b, i)) {
        groundZancudo(b, ZANCUDO.ventFall);
        this.say(`El gas prende bajo ${NAMES.bossSwamp}. ¡Cae! Ahora sí`);
      } else this.tell(p.name, 'El gas prende y se apaga');
    });
    const thorn = insideSwamp(S.thorn);
    if (g.thorn < FUEGO.burns && hits(thorn.x, thorn.z)) {
      g.thorn++;
      if (g.thorn < FUEGO.burns) this.tell(p.name, `Las espinas humean (${g.thorn}/${FUEGO.burns})`);
      else this.say('Las espinas arden y caen. La verja se abre');
    }
    if (g.lamps) return;
    let lit = false;
    S.lamps.forEach((lamp, i) => {
      const at = insideSwamp(lamp);
      if (!hits(at.x, at.z)) return;
      g.lampAt[i] = this.time;
      lit = true;
    });
    if (!lit) return;
    if (g.lampAt.every((t) => t != null && this.time - t <= S.lampWindow + EPS)) {
      g.lamps = true;
      this.say('Las tres lámparas de gas arden. La verja se abre');
    } else this.tell(p.name, 'La lámpara de gas prende. Rápido, las otras');
  }

  /** Every enemy that can be hit (beasts, elites, bosses, El Marchito, the cage's anchors). */
  private allFoes(): Wolf[] {
    return [...this.wolves, ...(this.elite ? [this.elite] : []), ...(this.shield ? [this.shield] : []), ...(this.peat ? [this.peat] : []), ...(this.rock ? [this.rock] : []), ...(this.boss ? [this.boss] : []), ...(this.boss2 ? [this.boss2] : []), ...(this.boss3 ? [this.boss3] : []), ...(this.boss4 ? [this.boss4] : []), ...(this.towerFlecha ? [this.towerFlecha] : []), ...(this.marchito ? [this.marchito] : []), ...this.anchorFoes, ...(this.lakeAnchor ? [this.lakeAnchor] : [])];
  }

  /** Piedra: Alzar a stone pillar 4 m toward the aim (2 m grid). Max 3 per player (the oldest crumbles), 120 s each. */
  private onStone(p: SavedPlayer, l: Live, x: number, z: number): void {
    if (p.dead) return;
    if (!p.piedra) return this.tell(p.name, 'Aún no tienes ese poder');
    const ready = l.stoneReadyAt ?? 0;
    if (this.time + EPS < ready) return this.tell(p.name, `La roca aún no responde (${Math.ceil(ready - this.time - EPS)} s)`);
    if (!this.escalera && Math.hypot(p.x - UMBRAL.x, p.z - UMBRAL.z) <= UMBRAL.reach) return this.crackUmbral(p, l);
    const at = pillarSpot(p.x, p.z, x, z);
    const inside = inAnyDungeon(p.x, p.z);
    const through = clampStep(p.x, p.z, at.x, at.z, this.gates(), this.coastGates(), this.swampGates(), this.mountainGates(), this.towerGates());
    if (inside ? !inAnyDungeon(at.x, at.z, -1) || Math.hypot(through.x - at.x, through.z - at.z) > 0.01 : !inMap(at.x, at.z, 2)) return this.tell(p.name, 'Aquí no sale roca');
    const y = this.terrain.heightAt(at.x, at.z);
    if (y < WATER_LEVEL - 0.5) return this.tell(p.name, 'Aquí no sale roca');
    if (this.structures.some((s) => Math.hypot(s.x - at.x, s.z - at.z) < 1.5)) return this.tell(p.name, 'Hay algo en el camino');
    if (this.structures.length >= MAX_STRUCTURES) return this.tell(p.name, 'El mundo ya tiene demasiadas construcciones');
    l.stoneReadyAt = this.time + PIEDRA.cooldown;
    const mine = this.structures.filter((s) => s.kind === 'pillar' && s.owner === p.name).sort((a, b) => a.id - b.id);
    for (const old of mine.slice(0, Math.max(0, mine.length - PIEDRA.max + 1))) this.crumble(old);
    const s: Structure = { id: this.nextStructureId++, kind: 'pillar', x: at.x, y: r2(y), z: at.z, rot: 0, owner: p.name, hp: PIEDRA.hp };
    this.structures.push(s);
    this.pillarUntil.set(s.id, this.time + PIEDRA.life);
    this.outbox.push({ to: null, msg: { t: 'built', s } });
    for (const w of this.allFoes()) {
      if (w.hp <= 0 || w.kind === 'anchor' || Math.hypot(w.x - at.x, w.z - at.z) > PIEDRA.liftR) continue;
      w.stun = Math.max(w.stun, PIEDRA.liftStun);
      this.strike(p.name, w, PIEDRA.liftDamage);
    }
    const root = this.zones.find((zn) => isMountainZone(zn.id) && zn.id !== MOUNTAIN_ZONES.root && !this.cleansed.has(zn.id) && Math.hypot(zn.x - at.x, zn.z - at.z) <= PIEDRA.rootReach);
    if (root) this.cleanse(root.id, 'La roca aplasta la raíz marchita. La montaña respira');
  }

  /** Piedra at the Umbral block: it cracks; the third crack raises la Escalera del Umbral for everyone, for good. */
  private crackUmbral(p: SavedPlayer, l: Live): void {
    l.stoneReadyAt = this.time + PIEDRA.cooldown;
    this.umbralCasts++;
    if (this.umbralCasts < UMBRAL.casts) return this.tell(p.name, `La roca cruje (${this.umbralCasts}/${UMBRAL.casts})`);
    this.escalera = true;
    this.say(`${upFirst(NAMES.stairs)} se alza en ${NAMES.mountainGate}. Ahora se sube a pie`);
    this.vision(VISION.escalera(joinNames(this.activeNames())));
  }

  /** A pillar goes back into the ground. */
  private crumble(s: Structure): void {
    this.pillarUntil.delete(s.id);
    if (this.structures.includes(s)) this.wreck(s);
  }

  /** Pillars crumble after 120 s (or when broken: then `wreck` already took them). */
  private stepPillars(): void {
    for (const [id, until] of this.pillarUntil) {
      const s = this.structures.find((x) => x.id === id);
      if (!s) this.pillarUntil.delete(id);
      else if (this.time >= until - EPS) this.crumble(s);
    }
  }

  /** Burning beasts lose 3 PV/s; fleeing timers run down. */
  private stepBurning(dt: number): void {
    const foes: Wolf[] = [...this.wolves, ...(this.elite ? [this.elite] : []), ...(this.shield ? [this.shield] : []), ...(this.peat ? [this.peat] : []), ...(this.rock ? [this.rock] : [])];
    for (const w of foes) {
      if (w.flee) w.flee = Math.max(0, w.flee - dt);
      if (!w.burn) continue;
      const t = Math.min(dt, w.burn);
      w.burn = Math.max(0, w.burn - dt);
      if (w.hp > 0 && hitWolf(w, FUEGO.burnDps * t) && w.kind !== 'wolf') this.say(`${upFirst(ENEMY_LABELS[w.kind])} arde hasta caer`);
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
    const wind = this.pillarSpots.cores[1]!;
    if (!this.pillarsBroken[1] && !this.lakeAnchor && this.pillarLive.miasma < LAKE_PILLAR.miasma && hits(wind.x, wind.z)) {
      this.pillarLive.miasma++;
      this.tell(p.name, this.pillarLive.miasma < LAKE_PILLAR.miasma ? `El miasma se aparta (${this.pillarLive.miasma}/${LAKE_PILLAR.miasma})` : 'El miasma se va. El núcleo queda al aire');
    }
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
      if (s.kind === 'twins' && st.boulderAt === null && hits(st.block!.x, st.block!.z)) {
        const plate = s.parts[1]!;
        Object.assign(st.block!, { x: plate.x, z: plate.z });
        st.boulderAt = this.time;
        this.tell(p.name, 'La roca rueda por el surco y cae en la losa');
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

  /** The white Zancudo lives by a living Heart; at night its farol sends wolves near the Heart running. */
  private stepAlly3(dt: number): void {
    const h = this.heart();
    if (!this.purified3 || !h || h.hp <= 0) {
      this.ally3 = null;
      return;
    }
    this.ally3 ??= createFarol(h, (x, z) => this.terrain.heightAt(x, z));
    if (stepFarol(this.ally3, h, this.wolves, isNight(dayFraction(this.time)), dt)) this.say(`El farol de ${NAMES.bossSwamp} brilla. Los lobos huyen del ${NAMES.heart}`);
  }

  /** The white Cucurucho keeps an atalaya by a living Heart; at night it stones the nearest raider every 6 s. */
  private stepAlly4(dt: number): void {
    const h = this.heart();
    if (!this.purified4 || !h || h.hp <= 0) {
      this.ally4 = null;
      return;
    }
    this.ally4 ??= createAtalaya(h, (x, z) => this.terrain.heightAt(x, z));
    stepAtalaya(this.ally4, this.wolves, isNight(dayFraction(this.time)), dt);
  }

  /** Wolves, raiders or the boss. */
  private enemy(id: number): Wolf | undefined {
    if (this.marchito && this.marchito.id === id) return this.marchito;
    const anchor = this.anchorFoes.find((a) => a.id === id) ?? (this.lakeAnchor?.id === id ? this.lakeAnchor : undefined);
    if (anchor) return anchor;
    if (this.elite && this.elite.id === id) return this.elite;
    if (this.shield && this.shield.id === id) return this.shield;
    if (this.peat && this.peat.id === id) return this.peat;
    if (this.rock && this.rock.id === id) return this.rock;
    if (this.boss2 && this.boss2.id === id) return this.boss2;
    if (this.boss3 && this.boss3.id === id) return this.boss3;
    if (this.boss4 && this.boss4.id === id) return this.boss4;
    if (this.towerFlecha && this.towerFlecha.id === id) return this.towerFlecha;
    const fb = this.towerFinal;
    if (fb && fb.id === id) return fb;
    if (fb?.core && fb.core.id === id) return fb.core;
    const br = fb?.brotes.find((x) => x.id === id && !x.broken);
    if (br) return br;
    return this.boss && this.boss.id === id ? this.boss : this.wolves.find((x) => x.id === id);
  }

  /** Hurt an enemy for a player; the folded boss shrugs it off. `ranged`: an arrow, a gust or a flame (they reach El Zancudo in the air, at half). */
  private strike(name: string, w: Wolf, dmg: number, ranged = false): void {
    if (w === this.marchito) return this.wearMarchito(name, dmg);
    if (w === this.towerFinal) return this.strikeFinal(name, dmg);
    if (w.kind === 'brote') return this.tell(name, 'Un brote no se pega: se arranca (A)');
    if (w.kind === 'core') return this.strikeCore(name, dmg, ranged);
    if (w.kind === 'anchor') {
      if (hitWolf(w, dmg)) {
        if (w === this.lakeAnchor) this.breakLakeAnchor();
        else this.breakAnchor(w);
      }
      return;
    }
    if (w === this.boss && this.boss.weak <= 0) return this.tell(name, 'El papel doblado aguanta. Párale o enrédalo');
    if (w === this.boss2 && this.boss2.exposed <= 0) return this.tell(name, 'La cáscara de marea aguanta. Empújalo contra el coral, o párale');
    if (w === this.boss3 && this.boss3.grounded <= 0) {
      if (!ranged) return this.tell(name, 'Vuela alto. Flechas, o fuego al gas bajo él');
      dmg *= ZANCUDO.airMult;
    }
    const by = this.players.get(name);
    if (w === this.shield && by && shieldBlocks(w as Elite, by.x, by.z)) return this.tell(name, 'El escudo para el golpe. Dale la vuelta con viento, o párale');
    if (w === this.rock && by && rockFront(this.rock, by.x, by.z)) {
      dmg *= ELITE.frontMult;
      const bl = this.live.get(name);
      if (bl) this.hint(name, bl, 'La losa para casi todo. Que se estrelle contra un pilar, o párale');
    }
    if (w === this.boss4 && by && hatFront(this.boss4, by.x, by.z)) {
      dmg *= CUCURUCHO.frontMult;
      const bl = this.live.get(name);
      if (bl) this.hint(name, bl, 'El gorro para casi todo. Un pilar en su embestida, o párale');
    }
    if (!hitWolf(w, dmg)) return;
    this.xpForKill(name, w);
    this.countKill(name, w);
    this.say(`${name} derrotó ${`a ${ENEMY_LABELS[w.kind]}`.replace(/^a el /, 'al ')}`);
    const thorns = w.raid ? 0 : thornDrop(w.kind, w.x, w.z, w.kind === 'rayo' ? this.rng() : 0);
    if (thorns > 0 && by) {
      by.inv = addItem(by.inv, 'thorn', thorns);
      this.tell(name, `+${thorns} ${NAMES.thorn}`);
    }
  }

  /** The boss lives while someone alive is in its room; an empty room resets it. Beaten once, it is purified for good. */
  private stepBossFight(dt: number): void {
    const fighters = this.targets().filter((t) => !t.dead && inBossRoom(t.x, t.z));
    if (this.boss && this.boss.hp <= 0 && !this.purified) {
      this.purified = true;
      for (const t of fighters) if (!this.bossHurt.has(t.name)) this.gainFeat(this.players.get(t.name)!, 1);
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
      this.bossHurt.clear();
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
    if (act >= 26) return this.onTowerDungeon(p, l, act, near);
    if (act >= 18) return this.onMountainDungeon(p, l, act, near);
    if (act >= 13) return this.onSwampDungeon(p, l, act, near);
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

  /** The swamp Raíz-madre: 13 enter, 14 leave, 15/16 levers, 17 the Fuego altar. */
  private onSwampDungeon(p: SavedPlayer, l: Live, act: number, near: (x: number, z: number, r: number) => boolean): void {
    const S = SWAMP_DUNGEON;
    const e = this.swampEntrance;
    if (act === 13) {
      if (!near(e.x, e.z, S.trunkR + S.enterReach)) return;
      this.teleport(p, l, S.x, S.entryZ + 1.5);
      return this.tell(p.name, `Dentro de la ${NAMES.swampRoot}. Huele a turba y a gas`);
    }
    if (!inSwampDungeon(p.x, p.z)) return;
    const g = this.swampLive;
    if (act === 14) {
      if (!near(S.x, S.entryZ, S.exitReach)) return;
      return this.teleport(p, l, e.x, e.z - (S.trunkR + 2));
    }
    if (act === 15 || act === 16) {
      const i = act - 15;
      const lever = insideSwamp(S.levers[i]!);
      if (!near(lever.x, lever.z, S.leverReach) || g.gate) return;
      g.pulled[i] = this.time;
      const other = g.pulled[1 - i];
      if (other != null && this.time - other <= S.leverWindow + EPS) {
        g.gate = true;
        return this.say('La verja de raíces se abre. Chapotea');
      }
      return this.tell(p.name, 'La raíz cede. Falta la otra');
    }
    if (act === 17) {
      if (!g.gate || !near(S.x, S.altarZ, S.altarReach) || p.fuego) return;
      p.fuego = true;
      this.tell(p.name, `Despierta el ${NAMES.powerFire}: J cambia de poder (o mantén pulsado el botón de poder), H lanza una llamarada`);
    }
  }

  /** Which of the four swamp gates are open: levers, thorns, gas lamps, the bruto de turba. */
  private swampGates(): boolean[] {
    const g = this.swampLive;
    return [g.gate, g.thorn >= FUEGO.burns, g.lamps, g.eliteDown];
  }

  /** The mountain cave: 18 enter, 19 leave, 20/21 levers, 22 the Piedra altar, 23/24 push block 0/1, 25 the reset lever. */
  private onMountainDungeon(p: SavedPlayer, l: Live, act: number, near: (x: number, z: number, r: number) => boolean): void {
    const M = MOUNTAIN_DUNGEON;
    const e = this.mountainEntrance;
    if (act === 18) {
      if (!near(e.x, e.z, M.mouthR + M.enterReach)) return;
      this.teleport(p, l, M.x, M.entryZ + 1.5);
      return this.tell(p.name, `Dentro de la cueva de la ${NAMES.mountainRoot}. Hace un frío de piedra`);
    }
    if (!inMountainDungeon(p.x, p.z)) return;
    const g = this.mountainLive;
    if (act === 19) {
      if (!near(M.x, M.entryZ, M.exitReach)) return;
      return this.teleport(p, l, e.x, e.z + M.mouthR + 2);
    }
    if (act === 20 || act === 21) {
      const i = act - 20;
      const lever = insideMountain(M.levers[i]!);
      if (!near(lever.x, lever.z, M.leverReach) || g.gate) return;
      g.pulled[i] = this.time;
      const other = g.pulled[1 - i];
      if (other != null && this.time - other <= M.leverWindow + EPS) {
        g.gate = true;
        return this.say('La verja de raíces se abre. Cruje de frío');
      }
      return this.tell(p.name, 'La raíz cede. Falta la otra');
    }
    if (act === 22) {
      if (!g.gate || !near(M.x, M.altarZ, M.altarReach) || p.piedra) return;
      p.piedra = true;
      return this.tell(p.name, `Despierta la ${NAMES.powerStone}: J cambia de poder (o mantén pulsado el botón de poder), H alza un pilar`);
    }
    if (act === 23 || act === 24) {
      const i = act - 23;
      const at = dungeonBlockCell(g.cells[i]!);
      if (!near(at.x, at.z, M.pushReach) || g.blocksDone) return;
      if (!p.piedra) return this.tell(p.name, 'No se mueve');
      const next = pushBlock(g.cells, i, pushDir(p.x, p.z, at.x, at.z), M.blocks.n);
      if (!next) return this.tell(p.name, 'Algo lo frena');
      g.cells = next;
      if (blocksSolved(g.cells, M.blocks.slots)) {
        g.blocksDone = true;
        return this.say('Los bloques encajan. La verja se abre');
      }
      return this.tell(p.name, 'La roca se arrastra');
    }
    if (act === 25) {
      const lever = insideMountain(M.resetLever);
      if (!near(lever.x, lever.z, M.leverReach) || g.blocksDone) return;
      g.cells = M.blocks.starts.map((c) => [c[0], c[1]] as const);
      return this.tell(p.name, 'Los bloques vuelven a su sitio');
    }
  }

  /** La Torre: 26 enter by the door (only once it is open), 27 leave. Every floor is solved with a power. */
  private onTowerDungeon(p: SavedPlayer, l: Live, act: number, near: (x: number, z: number, r: number) => boolean): void {
    if (act === 28) return this.pullBrote(p, near);
    const T = TOWER_DUNGEON;
    const d = this.towerDoor;
    if (act === 26) {
      if (!near(d.x, d.z, T.doorReach)) return;
      if (this.ending) {
        // S5-H: the Torre is done; its door takes you up to the lookout.
        if (l.dragon || l.riding || l.frog || l.fish || l.tame || l.seat) return this.tell(p.name, 'Bájate antes de subir');
        const top = lookoutTop(this.terrain);
        this.teleport(p, l, top.x + FOGATA.arrive, top.z);
        return this.tell(p.name, `Subes a la cima de ${NAMES.treeTower}. Desde aquí se ve todo el bosque. Y se planea lejos`.replace("de el ", "del "));
      }
      if (!this.towerOpen) return this.tell(p.name, this.pillarsBroken.every(Boolean) ? 'Una raíz cierra la puerta. Él vendrá antes' : 'Una raíz cierra la puerta. Rompan los Pilares');
      if (l.dragon || l.riding || l.frog || l.fish || l.tame) return this.tell(p.name, 'Bájate antes de entrar');
      this.teleport(p, l, T.x, T.entryZ + 1.5);
      return this.tell(p.name, `Dentro de ${NAMES.villainTower}. Huele a ceniza vieja. Hacia arriba`);
    }
    if (act === 27) {
      if (!inTowerDungeon(p.x, p.z) || !near(T.x, T.entryZ, T.exitReach)) return;
      return this.teleport(p, l, d.x, d.z + 4);
    }
  }

  /** The tower's gates: the pit (both bridges), the vents (all clear once), the braziers, the plate (weighted or jammed), La Flecha. */
  private towerGates(): boolean[] {
    const g = this.towerLive;
    return [g.bridges.every(Boolean), g.ventsDone, g.braziers.every(Boolean), g.plate || g.jammed, g.flechaDown];
  }

  /** Floor 1: an Enredadera grown by a bare root at the pit's edge makes a root bridge. */
  private growTowerBridge(plan: { x: number; z: number; r: number }): void {
    const T = TOWER_DUNGEON;
    const g = this.towerLive;
    T.roots.forEach((r, i) => {
      const at = insideTower(r);
      if (g.bridges[i] || Math.hypot(at.x - plan.x, at.z - plan.z) > T.rootReach + plan.r) return;
      g.bridges[i] = true;
      const n = g.bridges.filter(Boolean).length;
      this.sayTower(n < 2 ? `Una raíz cruza el foso (${n}/2)` : 'Dos puentes de raíz cruzan el foso. Se puede pasar');
    });
  }

  /** Floor 2: a gust clears a vent for a while; all three clear at once opens gate 1 for good. */
  private gustTowerVents(p: SavedPlayer, hits: (x: number, z: number) => boolean): void {
    const T = TOWER_DUNGEON;
    const g = this.towerLive;
    if (g.ventsDone || !inTowerDungeon(p.x, p.z)) return;
    let any = false;
    T.vents.forEach((v, i) => {
      const at = insideTower(v);
      if (!hits(at.x, at.z)) return;
      g.ventAt[i] = this.time;
      any = true;
    });
    if (!any) return;
    const clear = g.ventAt.filter((t) => t != null && this.time - t <= T.ventClear + EPS).length;
    if (clear === T.vents.length) {
      g.ventsDone = true;
      return this.sayTower('Las tres bocas se quedan limpias. La verja se abre');
    }
    this.tell(p.name, `La boca de miasma se despeja (${clear}/3). No dura`);
  }

  /** Floor 3: a Llamarada lights a brazier for good; all four open gate 2. */
  private flameTowerBraziers(p: SavedPlayer, hits: (x: number, z: number) => boolean): void {
    const T = TOWER_DUNGEON;
    const g = this.towerLive;
    if (!inTowerDungeon(p.x, p.z) || g.braziers.every(Boolean)) return;
    let lit = false;
    T.braziers.forEach((b, i) => {
      const at = insideTower(b);
      if (g.braziers[i] || !hits(at.x, at.z)) return;
      g.braziers[i] = true;
      lit = true;
    });
    if (!lit) return;
    const n = g.braziers.filter(Boolean).length;
    if (n === T.braziers.length) this.sayTower('Los cuatro braseros arden. La verja se abre');
    else this.tell(p.name, `El brasero prende (${n}/4)`);
  }

  /** A toast to everyone inside the tower. */
  private sayTower(text: string): void {
    for (const n of this.live.keys()) {
      const q = this.players.get(n)!;
      if (inTowerDungeon(q.x, q.z)) this.tell(n, text);
    }
  }

  /** Floor 4: the plate on the shelf (a pillar or someone on top; it jams once someone is through) and the rockfall. */
  private stepTowerDungeon(dt: number): void {
    const T = TOWER_DUNGEON;
    const M = MOUNTAIN_DUNGEON;
    const g = this.towerLive;
    const plate = insideTower(T.shelf);
    const top = T.floor + T.shelf.h;
    const inside = [...this.live].filter(([name, l]) => {
      const p = this.players.get(name)!;
      return !p.dead && l.awayFor === null && inTowerDungeon(p.x, p.z);
    });
    if (!inside.length) return;
    if (this.ending && !g.copaSeen && inside.some(([n]) => inCopa(this.players.get(n)!.x, this.players.get(n)!.z))) {
      g.copaSeen = true;
      this.sayTower('La Copa está en calma. Abajo se ve todo el bosque');
    }
    this.stepTowerFloors(inside.map(([n]) => this.players.get(n)!), dt);
    const onShelf = inside.some(([name]) => {
      const p = this.players.get(name)!;
      return Math.hypot(p.x - plate.x, p.z - plate.z) <= T.plateR && p.y >= top - 0.5;
    });
    const was = g.plate;
    g.plate = onShelf || this.pillarOn(plate.x, plate.z);
    if (g.plate && !was && !g.jammed) this.sayTower('La losa de arriba cede. La verja se abre mientras pese');
    if (g.plate && !g.jammed && inside.some(([name]) => this.players.get(name)!.z > T.gatesZ[3] + 0.5)) {
      g.jammed = true;
      this.sayTower('La verja se atasca abierta');
    }
    const blockers = this.structures.filter((s) => s.kind === 'pillar');
    const [z0, z1] = TOWER_ROCKFALL.span;
    for (const [name, l] of inside) {
      const p = this.players.get(name)!;
      if (p.z < z0 || p.z > z1 || p.y > T.floor + 1.5) continue;
      if (this.time < (g.hitAt.get(name) ?? -Infinity)) continue;
      const lane = rockfallLane(p.x, TOWER_ROCKFALL.x);
      if (lane < 0 || !boulders(this.time, lane, blockers, TOWER_ROCKFALL).some((bz) => Math.abs(bz - p.z) <= M.hitZ)) continue;
      const out = resolveHit(l.guard, this.time, M.damage);
      if (out.kind === 'dodged') continue;
      g.hitAt.set(name, this.time + M.grace);
      if (out.kind === 'parried') {
        this.tell(name, 'Paras la roca. Duele en los brazos');
        continue;
      }
      this.teleport(p, l, p.x, Math.max(z0 - 1, p.z - M.knock));
      this.hurt(p, out.dmg);
      this.tell(name, 'Una roca te arrolla. Un pilar la pararía');
    }
  }

  /** Each floor: its beasts wake the first time someone walks in (once per server life); its white ally (if purified) follows and helps. */
  private stepTowerFloors(inside: SavedPlayer[], dt: number): void {
    const T = TOWER_DUNGEON;
    const g = this.towerLive;
    const purified = [this.purified, this.purified2, this.purified3, this.purified4];
    const names = [NAMES.bossForestShort, NAMES.bossCoast, NAMES.bossSwamp, NAMES.bossMountain].map((n) => n.replace(/^El /, 'el '));
    for (let f = 0; f < 4; f++) {
      const here = inside.filter((p) => towerFloor(p.x, p.z) === f);
      const spot = T.beastsAt[f];
      if (!g.woke[f] && here.length) {
        g.woke[f] = true;
        if (spot) {
          const at = insideTower(spot);
          [-3, 3].forEach((dx, i) => this.wolves.push(createWolf(this.nextWolfId++, at.x + dx, at.z, this.terrain, this.rng, f === 3 && i === 1 ? 'brute' : 'wolf')));
          this.sayTower(f === 3 ? 'Algo grande gruñe detrás de las rocas' : 'Algo se despierta en este piso');
        }
      }
      if (!purified[f]) {
        g.allies[f] = null;
        continue;
      }
      const [z0, z1] = T.floors[f]!;
      const home = insideTower({ x: -4, z: (z0 + z1) / 2 });
      if (!g.allies[f]) g.allies[f] = createTowerAlly(TOWER_ALLY_KINDS[f]!, home, T.floor);
      const a = g.allies[f]!;
      const foes = this.wolves.filter((w) => w.hp > 0 && towerFloor(w.x, w.z) === f);
      const hit = stepTowerAlly(a, here, foes, dt);
      a.x = Math.min(Math.max(a.x, T.x - T.halfW + 0.5), T.x + T.halfW - 0.5); // stays on its floor
      a.z = Math.min(Math.max(a.z, z0), z1);
      if (!hit) continue;
      hitWolf(hit.foe, hit.damage);
      if (a.kind === 'antenon') this.sayTower(`${upFirst(names[f]!)} blanco sopla y una bestia cae por la cornisa`);
    }
  }

  /**
   * S5-F: El Marchito in the Copa. The first living player in wakes him (HP by those in the Copa); he stays while
   * someone alive is in the Copa and resets when it empties (a death sends you to the stair, outside it).
   */
  private stepTowerFinal(dt: number): void {
    const f = this.towerFinal;
    if (this.ending) {
      if (f && f.hp <= 0 && f.deadFor < FINAL.corpseTime) f.deadFor += dt;
      else this.towerFinal = null;
      return;
    }
    const fighters = this.targets().filter((t) => !t.dead && inCopa(t.x, t.z)).map((t) => ({ ...t, fires: false }));
    if (!fighters.length) {
      if (f) this.resetFinal();
      return;
    }
    if (!f) {
      this.towerFinal = createFinal(fighters.length);
      this.sayTower(`${NAMES.villain} baja a la Copa. Las raíces lo tapan: que arda el ${NAMES.powerFire}`);
    }
    const b = this.towerFinal!;
    const pillars = this.structures.filter((s) => s.kind === 'pillar' && inCopa(s.x, s.z)).map((s) => ({ id: s.id, x: s.x, z: s.z }));
    const { hits, events } = stepFinal(b, fighters, pillars, dt, this.rng);
    for (const e of events) {
      if (e === 'pulled') this.sayTower(`Sale un brote. ${NAMES.villain} se retuerce bajo la Copa (quedan ${b.brotes.filter((x) => !x.broken).length})`);
      else if (e === 'phase3') {
        this.clearCopaRayos();
        this.sayTower(`Sale el último brote. ${NAMES.villain} se queda tieso y ${NAMES.blackHeart} se le cae del pecho y corre. Un pilar en su camino lo para`);
      } else if (e === 'stunned') this.sayTower(`${upFirst(NAMES.blackHeart)} se da contra el pilar. ¡Ahora!`);
      else if (e === 'healing') this.sayTower(`${upFirst(NAMES.blackHeart)} vuelve a él y se cura. Dale`);
      else if (e === 'bare') this.sayTower('Las raíces arden y se caen. Ahora sí');
      else if (e === 'regrow') this.sayTower('Le vuelven a salir raíces. Verdes: tardarán en prender');
      else if (e === 'green') this.sayTower('Las raíces nuevas ya están secas');
    }
    for (const h of hits) this.finalHit(h.name, h.dmg, h.kind, b);
    if (b.pull) {
      const q = this.players.get(b.pull.name);
      if (q) this.finalLive.pullHp = Math.max(this.finalLive.pullHp, q.vitals.health);
      if (!q || q.dead || q.vitals.health < this.finalLive.pullHp - 1) {
        b.pull = null;
        if (q) this.tell(q.name, 'Se te escapa el brote');
      }
    }
    if (b.phase === 2) this.stepCopaRayos(fighters.length);
  }

  /** Phase 2's rayos: 1 alone, 2 with friends; one comes back 10 s after it falls. They live in the tower's wolves. */
  private stepCopaRayos(fighters: number): void {
    const want = FINAL.rayos[fighters >= 2 ? 1 : 0]!;
    const alive = this.wolves.filter((w) => w.kind === 'rayo' && w.hp > 0 && inCopa(w.x, w.z)).length;
    if (alive >= want) {
      this.finalLive.rayoAt = this.time + FINAL.rayoRespawn;
      return;
    }
    if (this.time + EPS < this.finalLive.rayoAt) return;
    this.finalLive.rayoAt = this.time + FINAL.rayoRespawn;
    const a = this.rng() * Math.PI * 2;
    const w = createWolf(this.nextWolfId++, FINAL.x + Math.sin(a) * 12, FINAL.z + Math.cos(a) * 12, TOWER_FLAT, this.rng, 'rayo');
    w.y += RAYO.fly;
    this.wolves.push(w);
    this.sayTower(`Baja un ${NAMES.flier}`);
  }

  private clearCopaRayos(): void {
    this.wolves = this.wolves.filter((w) => !(w.kind === 'rayo' && inCopa(w.x, w.z)));
    this.finalLive.rayoAt = 0;
  }

  /** A cast of `power` that reaches a brote (per `reaches`) counts toward opening it. */
  private castFinal(name: string, power: BroteKind, reaches: (x: number, z: number) => boolean): void {
    const b = this.towerFinal;
    if (!b || b.phase !== 2) return;
    for (const br of b.brotes) {
      if (br.power !== power || br.broken || !reaches(br.x, br.z)) continue;
      const n = castOnBrote(br, power);
      if (n === null) continue;
      const need = FINAL.need[power];
      this.sayTower(n >= need ? 'El brote queda al aire. Arráncalo (A)' : `El brote cede (${n}/${need})`);
    }
  }

  private plateWeighed(): boolean {
    const at = plateSpot();
    return this.pillarOn(at.x, at.z, FINAL.plateR);
  }

  /** Dungeon act 28: A within 3 m of an open brote starts a 1.5 s pull. */
  private pullBrote(p: SavedPlayer, near: (x: number, z: number, r: number) => boolean): void {
    const b = this.towerFinal;
    if (p.dead || !b || b.phase !== 2 || !inCopa(p.x, p.z)) return;
    const i = b.brotes.findIndex((br) => !br.broken && near(br.x, br.z, FINAL.pullReach));
    if (i < 0) return;
    const br = b.brotes[i]!;
    if (b.pull) return this.tell(p.name, b.pull.name === p.name ? 'Ya estás tirando' : `${b.pull.name} ya está tirando de uno`);
    if (!broteOpen(br, this.plateWeighed())) {
      const what = { vine: `Un anillo de espinas lo rodea. ${NAMES.powerVine} (${br.steps}/${FINAL.need.vine})`, wind: `Lo tapa un miasma. ${NAMES.powerWind} (${br.steps}/${FINAL.need.wind})`, fire: `Está en un capullo. ${NAMES.powerFire} (${br.steps}/${FINAL.need.fire})`, stone: `Su losa está suelta. Un pilar de ${NAMES.powerStone} encima` }[br.power];
      return this.tell(p.name, what);
    }
    startPull(b, i, p.name);
    this.finalLive.pullHp = p.vitals.health;
    this.tell(p.name, 'Tiras del brote…');
  }

  /** A blow on el Corazón Negro; at 0 El Marchito falls for good. */
  private strikeCore(name: string, dmg: number, ranged: boolean): void {
    const b = this.towerFinal;
    if (!b?.core) return;
    const stopped = b.core.stun > 0;
    const won = hitCore(b, dmg, ranged);
    const l = this.live.get(name);
    if (!stopped && !won && l) this.hint(name, l, 'Las patas lo apartan. Páralo con un pilar en su camino');
    if (won) this.winFinal();
  }

  /** El Marchito falls: the ending (S5-G, spec §10). */
  private winFinal(): void {
    if (this.ending) return;
    this.ending = true;
    this.clearCopaRayos();
    const names = this.targets().filter((t) => !t.dead && inCopa(t.x, t.z)).map((t) => t.name);
    this.endingNames = names.length ? names : this.activeNames();
    for (const n of this.endingNames) {
      const o = this.players.get(n);
      if (o && (o.weaponLvl ?? 0) <= 4) this.gainFeat(o, 6);
    }
    const who = joinNames(this.endingNames);
    this.say(`${upFirst(NAMES.blackHeart)} se parte. ${NAMES.villain} se encoge hasta ser una ramita`);
    // Every zone clean at once (0–21), with one toast.
    for (const z of this.zones) this.cleansed.add(z.id);
    this.say('Todas las raíces marchitas se secan a la vez');
    this.fogatas[FOGATA.lookout] = true; // S5-H: the top of el Árbol-torre
    // The long vision and the credits to everyone online; the rest get them on their next login (connect).
    const msg: ServerMsg = { t: 'ending', cards: endingCards(who), credits: creditLines(who) };
    for (const n of this.live.keys()) {
      this.players.get(n)!.credits = true;
      this.outbox.push({ to: n, msg });
    }
    // Everyone in the Torre is put back at the Heart.
    for (const n of this.live.keys()) {
      const p = this.players.get(n)!;
      if (!inTowerDungeon(p.x, p.z)) continue;
      const h = this.heart();
      const sp = h ? { x: h.x + ENDING.home, z: h.z } : this.spawnFor(n);
      this.teleport(p, this.live.get(n)!, sp.x, sp.z);
    }
  }

  /** A swipe (rolled or parried like a bite), a root line (rolled; a parry only blocks) or the trail (always). */
  private finalHit(name: string, dmg: number, kind: 'swipe' | 'line' | 'trail', b: FinalBoss): void {
    const p = this.players.get(name);
    const l = this.live.get(name);
    if (!p || !l || p.dead) return;
    if (kind === 'swipe') {
      this.bite(name, dmg, b);
      return;
    }
    if (kind === 'trail') return this.hurt(p, dmg);
    const out = resolveHit(l.guard, this.time, dmg);
    if (out.kind === 'dodged') return;
    if (out.kind === 'parried') return this.tell(name, 'Paras la raíz. Duele en los brazos');
    this.hurt(p, out.dmg);
    this.hint(name, l, 'Las rayas moradas del suelo son raíces. Rueda');
  }

  /** The Copa empties: the fight starts over next time. */
  private resetFinal(): void {
    this.towerFinal = null;
    this.clearCopaRayos();
  }

  /** A blow on his body: through the roots (×0.1) unless they burnt; sunk or frozen, nothing. */
  private strikeFinal(name: string, dmg: number): void {
    const b = this.towerFinal!;
    const m = finalMult(b);
    if (m <= 0) return;
    const l = this.live.get(name);
    if (m < 1 && l) this.hint(name, l, `Las raíces paran casi todo. El ${NAMES.powerFire} de cerca`);
    if (hitFinal(b, dmg * m) === 'phase2') this.sayTower(`${NAMES.villain} se hunde en la Copa. Salen cuatro brotes: uno por poder`);
  }

  /** A Llamarada near him sets the roots alight (and scratches him). */
  private flameFinal(p: SavedPlayer, hits: (x: number, z: number, range?: number) => boolean): void {
    const b = this.towerFinal;
    this.castFinal(p.name, 'fire', (x, z) => hits(x, z));
    // Phase 3: the flame on el Corazón Negro counts as a blow (scratches it, stops a heal).
    if (b?.core && b.phase === 3 && b.core.hp > 0 && hits(b.core.x, b.core.z, FUEGO.range + FINAL.coreBody)) return this.strikeCore(p.name, FUEGO.damage, false);
    if (!b || b.hp <= 0 || b.phase !== 1 || !hits(b.x, b.z, FUEGO.range + FINAL.body)) return;
    const r = burnRoots(b, p.x, p.z);
    if (r === 'catch') this.sayTower('Las raíces prenden…');
    else if (r === 'green') this.tell(p.name, 'Las raíces nuevas están verdes. Aún no prenden');
    else if (r === 'far') this.tell(p.name, 'Demasiado lejos para que prendan');
    this.strike(p.name, b, FUEGO.damage, true);
  }

  private finalView(): FinalView | null {
    const b = this.towerFinal;
    if (!b || this.ending) return null;
    const c = b.core;
    return {
      phase: b.phase, hp: Math.ceil(c ? c.hp : b.hp), max: c ? c.max : b.max, catching: b.catching > 0, bare: b.bare > 0, green: b.green > 0, stagger: b.stagger > 0, swipe: b.swipeTell > 0,
      lines: b.lines.map((l) => ({ x0: r2(l.x0), z0: r2(l.z0), x1: r2(l.x1), z1: r2(l.z1) })),
      brotes: b.brotes.map((br) => ({ power: br.power, x: r2(br.x), z: r2(br.z), open: broteOpen(br, this.plateWeighed()), broken: br.broken, steps: br.steps, need: FINAL.need[br.power] })),
      pull: b.pull ? r2(1 - b.pull.left / FINAL.pullFor) : null,
      core: c ? { hp: Math.ceil(c.hp), max: c.max, stopped: c.stun > 0, healing: c.mode === 'heal' } : null,
      trail: b.trail.map((t) => ({ x: r2(t.x), z: r2(t.z) })),
    };
  }

  /** La Flecha in the arena: wakes when someone alive walks in, resets if it empties; beaten = gate 4 and 2 espinas to each fighter. */
  private stepTowerFlecha(dt: number): void {
    const T = TOWER_DUNGEON;
    const g = this.towerLive;
    const f = this.towerFlecha;
    if (g.flechaDown) {
      if (f && f.hp <= 0 && f.deadFor < ELITE.corpseTime) f.deadFor += dt;
      else this.towerFlecha = null;
      return;
    }
    const fighters = this.targets().filter((t) => !t.dead && inArena(t.x, t.z)).map((t) => ({ ...t, fires: false }));
    if (f && f.hp <= 0) {
      g.flechaDown = true;
      for (const t of fighters) {
        const p = this.players.get(t.name)!;
        p.inv = addItem(p.inv, 'thorn', FLECHA.thorns);
        this.tell(t.name, `+${FLECHA.thorns} ${NAMES.thorn}`);
      }
      return this.sayTower(`${NAMES.lieutenant3} se parte contra el suelo. La escalera sube`);
    }
    if (!fighters.length) {
      this.towerFlecha = null;
      return;
    }
    if (!f) {
      const at = insideTower({ x: 0, z: T.arena.z + 8 });
      this.towerFlecha = { ...createWolf(T.flechaId, at.x, at.z, this.terrain, this.rng, 'lieut3'), hp: T.flechaHp };
      this.sayTower(`${NAMES.lieutenant3} baja del techo. Que se clave en una columna`);
    }
    const w = this.towerFlecha!;
    const cols = T.columns.map((c) => ({ kind: 'column', x: c.x, z: c.z })); // already in the tower's frame (x from the centre line)
    const goal = { heartId: -1, x: 0, z: T.arena.z, blockers: [] };
    const ev = towerFrame(w, fighters, (ts) => stepFlecha(w, ts, cols, goal, TOWER_FLAT, dt, this.rng));
    const box = (p: { x: number; z: number }) => ({ x: Math.min(Math.max(p.x, T.x - T.halfW + 1), T.x + T.halfW - 1), z: Math.min(Math.max(p.z, T.arena.z - T.arena.half + 1), T.arena.z + T.arena.half - 1) });
    Object.assign(w, box(w));
    if (w.aim) w.aim = box(w.aim);
    if (w.clav) w.clav = { ...w.clav, ...box(w.clav) };
    if (ev.bite) this.bite(ev.bite, ENEMY.lieut3.damage, w);
    for (const n of ev.hits) this.bite(n, FLECHA.dashDamage, w);
  }

  /** Which of the four mountain gates are open: levers, high plate (only while weighted), blocks, the bruto de roca. */
  private mountainGates(): boolean[] {
    const g = this.mountainLive;
    return [g.gate, g.plate, g.blocksDone, g.eliteDown];
  }

  /** Live Piedra pillars within r of (x, z). */
  private pillarOn(x: number, z: number, r: number = PIEDRA.plateR): boolean {
    return this.structures.some((s) => s.kind === 'pillar' && Math.hypot(s.x - x, s.z - z) <= r);
  }

  /** The high plate reads a pillar or a player on the shelf; the rockfall rolls over whoever is in a lane. */
  private stepMountainDungeon(): void {
    const M = MOUNTAIN_DUNGEON;
    const g = this.mountainLive;
    const plate = insideMountain(M.shelf);
    const top = M.floor + M.shelf.h;
    const onShelf = [...this.live].some(([name, l]) => {
      const p = this.players.get(name)!;
      return !p.dead && l.awayFor === null && Math.hypot(p.x - plate.x, p.z - plate.z) <= M.plateR && p.y >= top - 0.5;
    });
    const was = g.plate;
    g.plate = onShelf || this.pillarOn(plate.x, plate.z);
    if (g.plate && !was) for (const n of this.live.keys()) if (inMountainDungeon(this.players.get(n)!.x, this.players.get(n)!.z)) this.tell(n, 'La losa de arriba cede. La verja se abre mientras pese');
    const blockers = this.structures.filter((s) => s.kind === 'pillar');
    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null || !inRockfall(p.x, p.z) || p.y > M.floor + 1.5) continue;
      if (this.time < (g.hitAt.get(name) ?? -Infinity)) continue;
      const lane = rockfallLane(p.x);
      if (lane < 0 || !boulders(this.time, lane, blockers).some((bz) => Math.abs(bz - p.z) <= M.hitZ)) continue;
      const out = resolveHit(l.guard, this.time, M.damage);
      if (out.kind === 'dodged') continue;
      g.hitAt.set(name, this.time + M.grace);
      if (out.kind === 'parried') {
        this.tell(name, 'Paras la roca. Duele en los brazos');
        continue;
      }
      this.teleport(p, l, p.x, Math.max(M.rockfall[0] - 1, p.z - M.knock));
      this.hurt(p, out.dmg);
      this.tell(name, 'Una roca te arrolla. Un pilar la pararía');
    }
  }

  /** Boardwalk planks under ~1.2 s of weight sink for 4 s; the mud sends fallers back to the gas hall's gate. */
  private stepSwampDungeon(): void {
    const S = SWAMP_DUNGEON;
    const g = this.swampLive;
    const standing = new Set<number>();
    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null || !inMud(p.x, p.z)) continue;
      const i = plankAt(p.x, p.z);
      const up = i >= 0 && this.time >= g.planks[i]!.downUntil;
      if (up && p.y >= S.floor - 0.5 && p.y <= S.floor + 0.5) standing.add(i);
      if (p.y > S.floor - 1) continue; // on a plank, jumping, or still sinking
      this.teleport(p, l, S.x, S.fallBack);
      p.vitals = damage(p.vitals, S.fallDamage * capaMult(p.capaLvl ?? 0));
      this.tell(name, 'El barro te traga y te escupe atrás. Las tablas no aguantan mucho');
      if (p.vitals.health <= 0) this.kill(p);
    }
    g.planks.forEach((pl, i) => {
      if (this.time < pl.downUntil) return;
      if (!standing.has(i)) {
        pl.at = null;
        return;
      }
      pl.at ??= this.time;
      if (this.time - pl.at + EPS >= S.sinkAfter) {
        pl.downUntil = this.time + S.downFor;
        pl.at = null;
      }
    });
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
    if (act === 18) return this.tameEstrella(p, l);
    if (act >= 15) return this.onDragonAct(p, l, act);
    if (act >= 12) return this.onFrogAct(p, l, act);
    if (act >= 9) return this.onWhaleAct(p, l, act);
    if (act >= 6) return this.onFishAct(p, l, act);
    if (l.fish || l.frog || l.race || l.dragon) return; // on (or chasing) the fish or the frog: no deer
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
      if (t.beast === 'dragon') {
        p.dragon = { x: r2(p.x), z: r2(p.z) };
        l.dragon = true;
        l.fix = true; // the client picks up flying from where the dragon is
        this.vision(VISION.dragon(p.name));
        return this.tell(p.name, 'El dragón es tuyo. Mantén B para subir, suelta para bajar');
      }
      if (t.beast === 'frog') {
        p.frog = { x: r2(p.x), z: r2(p.z) };
        l.frog = true;
        return this.tell(p.name, 'La rana es tuya. B para el salto alto, A para bajar');
      }
      if (t.beast === 'star') {
        const had = !!p.steed && !p.star;
        p.steed = { x: r2(p.x), z: r2(p.z) };
        p.star = true;
        l.riding = true;
        return this.tell(p.name, `${upFirst(NAMES.legendary)} es tuya. Corre más que nada en el bosque${had ? '. Tu ciervo vuelve a su claro' : ''}. A para bajar`);
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
    if (l.riding || l.frog || l.dragon || l.tame || inAnyDungeon(p.x, p.z)) return;
    const taken = new Set([...this.live.values()].flatMap((o) => (o.seat ? [o.seat] : [])));
    let best: SavedPlayer | null = null;
    for (const [n, ol] of this.live) {
      const o = this.players.get(n)!;
      if (n === p.name || !(ol.riding || ol.dragon) || o.dead || ol.awayFor !== null || taken.has(n)) continue;
      if (ol.dragon && o.y > Math.max(this.terrain.heightAt(o.x, o.z), waterLevel(this.terrain, o.x, o.z)) + 1.5) continue; // landed dragons only
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
      if (!r || !rl || !(rl.riding || rl.dragon) || r.dead || rl.awayFor !== null || l.awayFor !== null || p.dead) {
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
    if (l.dragon) {
      for (const [n, ol] of this.live) if (ol.seat === p.name) this.dismount(this.players.get(n)!, ol);
      l.dragon = false;
      l.rodeUntil = this.time + DRAGON.grace;
      l.graceCap = DRAGON.maxSpeed;
      p.dragon = { x: r2(p.x), z: r2(p.z) };
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
    l.graceCap = p.star ? ESTRELLA.maxSpeed : MOUNT.maxSpeed;
    p.steed = { x: r2(p.x), z: r2(p.z) };
  }

  private nextRound(l: Live, round: number, beast: Beast, ax: number, az: number): void {
    l.tame = { round, start: r2(this.time), zone: r2(this.rng() * Math.PI * 2), beast, ax, az };
  }

  private throwOff(p: SavedPlayer, l: Live): void {
    if (l.tame?.beast === 'dragon') {
      // Thrown off in the air, where the dragon was: the client falls (and opens the glider).
      l.tame = null;
      l.tameReadyAt = this.time + MOUNT.retry;
      l.fix = true;
      l.lastAcceptedAt = this.time;
      return this.tell(p.name, 'Te tira. ¡Abre el planeador!');
    }
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
      if (!f || l.fish || l.frog || l.dragon || l.riding || l.tame || l.race || inAnyDungeon(p.x, p.z) || Math.hypot(f.x - p.x, f.z - p.z) > FISH.reach) return;
      l.fish = true;
      return;
    }
    if (l.race || l.tame || l.riding || l.fish || l.frog || l.dragon || Math.hypot(this.fishHome.x - p.x, this.fishHome.z - p.z) > FISH.reach) return;
    if (p.fish) return this.tell(p.name, 'Ya tienes pez');
    if (this.time + EPS < l.raceReadyAt) return this.tell(p.name, 'El pez aún recela');
    l.race = { i: 0, deadline: this.time + FISH.ringTime, beast: 'fish' };
    l.raceAt = this.time;
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
        if (!frog && l.raceAt !== undefined && this.time - l.raceAt <= FEAT_FAST * FISH.rings * FISH.ringTime + EPS) this.gainFeat(p, 2);
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
      out.push({ owner: o.name, x: f.x, y: waterLevel(this.terrain, f.x, f.z), z: f.z, yaw: 0 });
    }
    return out;
  }

  /** La Rana's acts: 12 start the lily-pad chase, 13 get on, 14 get off (anywhere: it waits there). */
  private onFrogAct(p: SavedPlayer, l: Live, act: number): void {
    if (act === 14) return l.frog ? this.dismount(p, l) : undefined;
    const busy = l.frog || l.fish || l.riding || l.dragon || l.tame || l.race || inAnyDungeon(p.x, p.z);
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

  // ---------------------------------------------------------------- dragon (S4-G)

  /** Is the wild dragon circling the Pico right now? */
  private dragonIsOut(): boolean {
    return dragonOut(this.seed, Math.floor(this.time / DAY_LENGTH), this.purified4);
  }

  /** 15 = leap onto the wild dragon from the Pico, 16 = get on your dragon, 17 = get off. */
  private onDragonAct(p: SavedPlayer, l: Live, act: number): void {
    if (act === 17) {
      if (!l.dragon) return;
      if (p.y > Math.max(this.terrain.heightAt(p.x, p.z), waterLevel(this.terrain, p.x, p.z)) + 1.5) return; // only once landed
      if (this.noLanding(p.x, p.z)) return this.tell(p.name, 'Aquí no se aterriza en pleno asedio');
      return this.dismount(p, l);
    }
    const busy = l.dragon || l.frog || l.fish || l.riding || l.tame || l.race || inAnyDungeon(p.x, p.z);
    if (busy) return;
    if (act === 16) {
      const d = p.dragon;
      if (!d || Math.hypot(d.x - p.x, d.z - p.z) > DRAGON.reach) return;
      l.dragon = true;
      return;
    }
    if (p.dragon || !this.dragonIsOut() || Math.hypot(this.pico.x - p.x, this.pico.z - p.z) > DRAGON.rim) return;
    if (this.time + EPS < l.tameReadyAt) return this.tell(p.name, 'El dragón aún ruge');
    if (!leapOk(this.pico, this.time, p)) return this.tell(p.name, 'Aún no. Espera a que pase por debajo');
    this.nextRound(l, 0, 'dragon', this.pico.x, this.pico.z);
    this.carryOnDragon(p, l);
    this.tell(p.name, 'Caes en su lomo. Pulsa cuando la aguja pase por la zona');
  }

  /** While taming, you ride the wild dragon's circle. */
  private carryOnDragon(p: SavedPlayer, l: Live): void {
    const d = dragonPos(this.pico, this.time);
    p.x = r2(d.x);
    p.z = r2(d.z);
    p.y = r2(d.y + DRAGON.height);
    l.anchorX = p.x;
    l.anchorZ = p.z;
    l.anchorAt = this.time;
    l.lastAcceptedAt = this.time;
  }

  /** The wild dragon (while it is out) plus every parked (not ridden) tamed one in view. */
  private dragonViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    if (this.dragonIsOut()) {
      const d = dragonPos(this.pico, this.time);
      if (near(d.x, d.z)) out.push({ owner: null, x: r2(d.x), y: r2(d.y), z: r2(d.z), yaw: r2(d.yaw) });
    }
    for (const o of this.players.values()) {
      const d = o.dragon;
      if (!d || this.live.get(o.name)?.dragon || !near(d.x, d.z)) continue;
      out.push({ owner: o.name, x: d.x, y: r2(Math.max(this.terrain.heightAt(d.x, d.z), waterLevel(this.terrain, d.x, d.z))), z: d.z, yaw: 0 });
    }
    return out;
  }

  /** The wild frog plus every parked (not ridden) tamed one in view. */
  private frogViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    const h = this.frogHome;
    if (near(h.x, h.z)) out.push({ owner: null, x: r2(h.x), y: r2(this.terrain.heightAt(h.x, h.z)), z: r2(h.z), yaw: 0 });
    for (const o of this.players.values()) {
      const f = o.frog;
      if (!f || this.live.get(o.name)?.frog || !near(f.x, f.z)) continue;
      out.push({ owner: o.name, x: f.x, y: r2(Math.max(this.terrain.heightAt(f.x, f.z), waterLevel(this.terrain, f.x, f.z))), z: f.z, yaw: 0 });
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
    for (const o of crew) this.gainXp(o, PROGRESS.whale);
    this.say('La ballena es del mundo. A junto a ella para subir');
  }

  /** First free seat (the first aboard pilots). From the fish: it waits where you were. */
  private boardWhale(p: SavedPlayer, l: Live): void {
    if (!this.whaleTamed || l.riding || l.frog || l.dragon || l.tame || l.race || inAnyDungeon(p.x, p.z) || Math.hypot(this.whale.x - p.x, this.whale.z - p.z) > WHALE.reach) return;
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
  /** S5-H: la Estrella is out (after the ending, on a full-moon night). */
  private estrellaIsOut(): boolean {
    return estrellaOut(Math.floor(this.time / DAY_LENGTH), isNight(dayFraction(this.time)), this.ending);
  }

  /** The wild Estrella, while she rolls in la Ceniza and is in view. */
  private estrellaView(near: (x: number, z: number) => boolean): SteedView | null {
    if (!this.estrellaIsOut()) return null;
    const e = estrellaAt(this.time);
    return near(e.x, e.z) ? { owner: null, x: r2(e.x), y: r2(this.terrain.heightAt(e.x, e.z)), z: r2(e.z), yaw: r2(e.yaw) } : null;
  }

  /** Act 18: start taming la Estrella (the ring, 4 rounds). She replaces your deer. */
  private tameEstrella(p: SavedPlayer, l: Live): void {
    if (!this.estrellaIsOut() || l.tame || l.riding || l.fish || l.frog || l.dragon || l.race || inAnyDungeon(p.x, p.z)) return;
    const e = estrellaAt(this.time);
    if (Math.hypot(e.x - p.x, e.z - p.z) > ESTRELLA.reach) return;
    if (p.star) return this.tell(p.name, `Ya tienes a ${NAMES.legendary}`);
    if (this.time + EPS < l.tameReadyAt) return this.tell(p.name, 'Aún gira demasiado rápido');
    this.nextRound(l, 0, 'star', e.x, e.z);
    this.tell(p.name, `${upFirst(NAMES.legendary)} gira. Pulsa cuando la aguja pase por la zona`);
  }

  private steedViews(near: (x: number, z: number) => boolean): SteedView[] {
    const out: SteedView[] = [];
    if (near(this.wild.x, this.wild.z)) out.push({ owner: null, x: r2(this.wild.x), y: r2(this.wild.y), z: r2(this.wild.z), yaw: 0 });
    for (const o of this.players.values()) {
      const st = o.steed;
      if (!st || this.live.get(o.name)?.riding || !near(st.x, st.z)) continue;
      out.push({ owner: o.name, x: st.x, y: r2(this.terrain.heightAt(st.x, st.z)), z: st.z, yaw: 0, ...(o.star ? { star: true } : {}) });
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
      else if (l.tame.beast === 'dragon') {
        if (this.time - l.tame.start > MOUNT.roundTimeout) this.throwOff(p, l);
        else this.carryOnDragon(p, l);
      } else if (Math.hypot(l.tame.ax - p.x, l.tame.az - p.z) > MOUNT.leash || this.time - l.tame.start > MOUNT.roundTimeout) this.throwOff(p, l);
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

  private towerView(): TowerDungeonView {
    const g = this.towerLive;
    const T = TOWER_DUNGEON;
    return { gates: this.towerGates(), bridges: [...g.bridges], vents: g.ventAt.map((t) => g.ventsDone || (t != null && this.time - t <= T.ventClear + EPS)), braziers: [...g.braziers], plate: g.plate || g.jammed, flecha: this.towerFlecha && this.towerFlecha.hp > 0 ? { hp: Math.round(this.towerFlecha.hp), max: T.flechaHp, aiming: !!this.towerFlecha.aim, stuck: (this.towerFlecha.stuck ?? 0) > 0 } : null, allies: g.allies.flatMap((a) => (a ? [{ kind: a.kind, x: r2(a.x), y: r2(a.y), z: r2(a.z), yaw: r2(a.yaw), anim: a.anim }] : [])), final: this.finalView() };
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
    const w = this.swampLive;
    const S = SWAMP_DUNGEON;
    const swamp = {
      gates: this.swampGates(),
      levers: w.pulled.map((t) => t != null && (w.gate || this.time - t <= S.leverWindow + EPS)),
      thorn: Math.min(w.thorn, FUEGO.burns),
      lamps: w.lampAt.map((t) => t != null && (w.lamps || this.time - t <= S.lampWindow + EPS)),
      planks: w.planks.map((pl) => this.time >= pl.downUntil),
      elite: this.peat && this.peat.hp > 0 ? { hp: Math.round(this.peat.hp), max: ENEMY.elite3.hp, charging: this.peat.windup > 0 || this.peat.charge > 0, burning: (this.peat.burn ?? 0) > 0 } : null,
      boss: this.boss3 && this.boss3.hp > 0 ? { hp: Math.round(this.boss3.hp), max: ENEMY.boss3.hp, grounded: this.boss3.grounded > 0, diving: this.boss3.windup > 0, shadow: this.boss3.shadow ? { x: r2(this.boss3.shadow.x), z: r2(this.boss3.shadow.z) } : null, latch: this.boss3.latch } : null,
      vents: this.ventAt.map((t) => this.time - t < 1),
    };
    const m = this.mountainLive;
    const mountain = {
      gates: this.mountainGates(),
      levers: m.pulled.map((t) => t != null && (m.gate || this.time - t <= MOUNTAIN_DUNGEON.leverWindow + EPS)),
      plate: m.plate,
      blocks: m.cells.map((c) => dungeonBlockCell(c)),
      elite: this.rock && this.rock.hp > 0 ? { hp: Math.round(this.rock.hp), max: ENEMY.elite4.hp, charging: this.rock.windup > 0 || this.rock.charge > 0, exposed: this.rock.exposed > 0 } : null,
      boss: this.boss4 && this.boss4.hp > 0 ? { hp: Math.round(this.boss4.hp), max: ENEMY.boss4.hp, windup: this.boss4.windup > 0, charging: this.boss4.charge > 0, stuck: this.boss4.exposed > 0, alud: this.boss4.alud.map((c) => ({ x: r2(c.x), z: r2(c.z) })) } : null,
    };
    return { gate: g.gate, gates: this.gates(), levers: pulled, purified: this.purified, boss, plate: g.pressed, block: carry(g.block), lantern: carry(g.lantern), lit: g.lit, elite, coast, swamp, mountain, tower: this.towerView() };
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
    g.pressed = (!g.block.held && on(g.block.x, g.block.z)) || this.targets().some((t) => !t.dead && on(t.x, t.z)) || this.pillarOn(plate.x, plate.z);
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

  /** El Zancudo lives while someone alive is in its room; an empty room resets it. Beaten once: purified, zone 10 clean, a vision. */
  private stepZancudoFight(dt: number): void {
    const z = this.boss3;
    if (z && z.hp <= 0 && !this.purified3) {
      this.purified3 = true;
      this.say(`${NAMES.bossSwamp} cae y se queda blanco como el papel. Ahora alumbra el ${NAMES.heart}`);
      this.cleanse(SWAMP_ZONES.root, `La ${NAMES.swampRoot} deja de supurar morado. ${NAMES.lieutenant1} se queda sin pantano`);
      this.vision(VISION.purified3(joinNames(this.activeNames())));
    }
    if (this.purified3) {
      if (z && z.hp <= 0) {
        stepZancudo(z, [], dt);
        if (z.deadFor >= ZANCUDO.corpseTime) this.boss3 = null;
      } else this.boss3 = null;
      return;
    }
    const fighters = this.targets().filter((t) => !t.dead && inSwampBossRoom(t.x, t.z));
    if (!fighters.length) {
      this.boss3 = null;
      return;
    }
    if (!this.boss3) {
      this.boss3 = createZancudo();
      this.say(`${NAMES.bossSwamp} despierta. Vuela alto: flechas, o fuego al gas que tenga debajo`);
    }
    const b = this.boss3;
    const { hits, drain } = stepZancudo(b, fighters, dt);
    for (const hit of hits) {
      const landed = this.bite(hit.name, hit.dmg, b);
      if (landed && !b.latch && b.grounded <= 0 && b.hp > 0) {
        b.latch = hit.name;
        b.latchLeft = ZANCUDO.latchMax;
        this.tell(hit.name, 'Se te engancha y chupa. ¡Rueda!');
      }
    }
    const p = drain && this.players.get(drain.name);
    if (p && drain && !p.dead) this.hurt(p, drain.dmg);
  }

  /** El Cucurucho lives while someone alive is in its room; an empty room resets it. Beaten once: purified, zone 14 clean (El Triángulo stops), a vision. */
  private stepCucuruchoFight(dt: number): void {
    const c = this.boss4;
    if (c && c.hp <= 0 && !this.purified4) {
      this.purified4 = true;
      this.say(`${NAMES.bossMountain} cae y se queda blanco como la nieve. Ahora vigila el ${NAMES.heart}`);
      this.cleanse(MOUNTAIN_ZONES.root, `La ${NAMES.mountainRoot} deja de supurar morado. ${NAMES.lieutenant2} se queda sin montaña`);
      this.vision(VISION.purified4(joinNames(this.activeNames())));
    }
    if (this.purified4) {
      if (c && c.hp <= 0) {
        stepCucurucho(c, [], [], dt);
        if (c.deadFor >= CUCURUCHO.corpseTime) this.boss4 = null;
      } else this.boss4 = null;
      return;
    }
    const fighters = this.targets().filter((t) => !t.dead && inMountainBossRoom(t.x, t.z));
    if (!fighters.length) {
      this.boss4 = null;
      return;
    }
    if (!this.boss4) {
      this.boss4 = createCucurucho();
      this.say(`${NAMES.bossMountain} despierta. El gorro para casi todo: que embista contra un pilar`);
    }
    const b = this.boss4;
    const pillars = this.structures.filter((s) => s.kind === 'pillar' && inMountainBossRoom(s.x, s.z));
    const { hits, stuck } = stepCucurucho(b, fighters, pillars, dt);
    if (stuck) this.say(`¡Contra el pilar! El gorro de ${NAMES.bossMountain.replace(/^El /, 'el ')} se clava. Ahora sí`);
    for (const hit of hits) this.bite(hit.name, hit.dmg, b);
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

  /** The bruto de turba, like the other elites; in a mud pool it regrows unless burning. Once down, gate 3 opens (El Zancudo's room). */
  private stepPeatFight(dt: number): void {
    const g = this.swampLive;
    const e = this.peat;
    if (e && e.hp <= 0) {
      if (!g.eliteDown) {
        g.eliteDown = true;
        this.say(`El ${NAMES.eliteSwamp} se deshace en barro seco. La última verja se abre`);
      }
      e.deadFor += dt;
      if (e.deadFor >= ELITE.corpseTime) this.peat = null;
      return;
    }
    if (g.eliteDown) return;
    const fighters = this.targets().filter((t) => !t.dead && inPeatRoom(t.x, t.z));
    if (!fighters.length) {
      this.peat = null;
      return;
    }
    if (!this.peat) {
      this.peat = createPeat();
      this.say(`Un ${NAMES.eliteSwamp} se levanta del barro. En los charcos se rehace; el fuego lo seca`);
    }
    const pe = this.peat;
    const hit = stepElite(pe, fighters, dt);
    if (hit) this.bite(hit.name, hit.dmg, pe);
    if (pe.hp > 0 && !pe.burn && inMudPool(pe.x, pe.z)) pe.hp = Math.min(ENEMY.elite3.hp, pe.hp + SWAMP_DUNGEON.regen * dt);
  }

  /** The bruto de roca, like the other elites (its slab and wall crash live in elite.ts). Once down, gate 3 opens (El Cucurucho's room). */
  private stepRockFight(dt: number): void {
    const g = this.mountainLive;
    const e = this.rock;
    if (e && e.hp <= 0) {
      if (!g.eliteDown) {
        g.eliteDown = true;
        this.say(`El ${NAMES.eliteMountain} se parte en grava. La última verja se abre`);
      }
      e.deadFor += dt;
      if (e.deadFor >= ELITE.corpseTime) this.rock = null;
      return;
    }
    if (g.eliteDown) return;
    const fighters = this.targets().filter((t) => !t.dead && inRockRoom(t.x, t.z));
    if (!fighters.length) {
      this.rock = null;
      return;
    }
    if (!this.rock) {
      this.rock = createRockBrute();
      this.say(`Un ${NAMES.eliteMountain} se despega de la pared. De frente es una losa; que se estrelle`);
    }
    const hit = stepElite(this.rock, fighters, dt);
    if (hit) this.bite(hit.name, hit.dmg, this.rock);
  }

  /** A charging elite that meets a Piedra pillar crashes: stunned and exposed 5 s. */
  private pillarStun(e: Elite): void {
    if (e.hp <= 0 || e.charge <= 0 || !this.pillarOn(e.x, e.z, PIEDRA.chargeR + PIEDRA.half)) return;
    crash(e, PIEDRA.chargeStun);
    this.say(`${upFirst(ENEMY_LABELS[e.kind])} se estrella contra el pilar`);
  }

  /** A torre shoves raiders at its foot back 3 m, every 4 s. */
  private stepTowers(): void {
    for (const s of this.structures) {
      if (s.kind !== 'tower' || this.time < (this.towerReady.get(s.id) ?? -Infinity)) continue;
      const near = this.wolves.filter((w) => w.raid && w.hp > 0 && Math.hypot(w.x - s.x, w.z - s.z) <= TOWER.knockR);
      if (!near.length) continue;
      this.towerReady.set(s.id, this.time + TOWER.every);
      for (const w of near) {
        const d = Math.max(Math.hypot(w.x - s.x, w.z - s.z), 0.1);
        const to = clampMap(w.x + ((w.x - s.x) / d) * TOWER.knock, w.z + ((w.z - s.z) / d) * TOWER.knock, 3);
        Object.assign(w, to, { y: this.terrain.heightAt(to.x, to.z) });
      }
    }
  }

  /** Standing on a torre's top. */
  private onTower(p: SavedPlayer): boolean {
    return this.structures.some((s) => s.kind === 'tower' && Math.hypot(s.x - p.x, s.z - p.z) <= TOWER.r + 0.2 && p.y >= s.y + TOWER.height - 0.6);
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
    const k = this.shrines[id]!.kind;
    return k === 'ledge' || k === 'cornice' || this.time < this.shrineLive[id]!.openUntil;
  }

  private shrineViews(): ShrineView[] {
    return this.shrines.map((s, id) => {
      const st = this.shrineLive[id]!;
      const open = this.shrineOpen(id);
      if (s.kind === 'plate') return { id, open, parts: [st.pressed] };
      if (s.kind === 'candles') return { id, open, parts: [...st.lit.map((t) => this.time < t), false] };
      if (s.kind === 'lilies') return { id, open, parts: st.pads.map((q) => this.time >= q.downUntil) };
      if (s.kind === 'peat') return { id, open, parts: [0, 1, 2].map((i) => st.burns > i) };
      if (s.kind === 'cornice') return { id, open, parts: [] };
      if (s.kind === 'twins') return { id, open, parts: [st.pulled[0] != null, st.pulled[1] != null], block: { x: r2(st.block!.x), z: r2(st.block!.z), held: null } };
      if (s.kind === 'blocks') {
        const c = blocksCentre(s);
        return { id, open, parts: [], blocks: st.cells.map((q) => { const w = blockCell(c, q); return { x: r2(w.x), z: r2(w.z) }; }) };
      }
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
      if (s.kind === 'twins') return this.stepTwins(id);
      if (s.kind === 'blocks') {
        const st = this.shrineLive[id]!;
        if (blocksSolved(st.cells)) st.openUntil = this.time + 1;
        return;
      }
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
      if (this.pillarOn(plate.x, plate.z)) st.pressed = true; // a Piedra pillar weighs it
      for (const [name, l] of this.live) {
        const p = this.players.get(name)!;
        if (p.dead || l.awayFor !== null || Math.hypot(plate.x - p.x, plate.z - p.z) > SHRINE.plateRadius) continue;
        if (Math.abs(p.y - this.terrain.heightAt(plate.x, plate.z)) > 1.5) continue;
        st.pressed = true;
      }
      if (st.pressed) st.openUntil = this.time + SHRINE.plateHold;
    });
  }

  /** Somebody (alive, here) standing on a plate. */
  private onPlate(plate: { x: number; z: number }): boolean {
    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null || Math.hypot(plate.x - p.x, plate.z - p.z) > SHRINE.plateRadius) continue;
      if (Math.abs(p.y - this.terrain.heightAt(plate.x, plate.z)) <= 1.5) return true;
    }
    return false;
  }

  /** Losas gemelas: both plates held at once (a player, or the boulder on plate 2) opens the gate 20 s; the boulder rolls home after 60 s. */
  private stepTwins(id: number): void {
    const s = this.shrines[id]!;
    const st = this.shrineLive[id]!;
    const [p1, p2, home] = s.parts as [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }];
    const b = st.block!;
    if (st.boulderAt !== null && this.time - st.boulderAt >= MOUNTAIN_SHRINE.boulderBack - EPS) {
      Object.assign(b, { x: home.x, z: home.z });
      st.boulderAt = null;
    }
    // A Piedra pillar on a plate holds it too.
    const a = this.onPlate(p1) || this.pillarOn(p1.x, p1.z);
    const c = this.onPlate(p2) || this.pillarOn(p2.x, p2.z) || Math.hypot(b.x - p2.x, b.z - p2.z) <= SHRINE.plateRadius;
    st.pulled = [a ? this.time : null, c ? this.time : null, null];
    if (a && c) {
      if (!this.shrineOpen(id)) for (const n of this.live.keys()) if (Math.hypot(this.players.get(n)!.x - s.x, this.players.get(n)!.z - s.z) < 30) this.tell(n, 'Las dos losas ceden a la vez. Algo se abre en el santuario');
      st.openUntil = this.time + MOUNTAIN_SHRINE.twinsOpen;
    }
  }

  /** Nenúfares: a pad sinks a while after someone stands on it, and comes back; standing on the last one opens the gate. */
  private stepLilies(id: number): void {
    const S = SWAMP_SHRINE;
    const s = this.shrines[id]!;
    const st = this.shrineLive[id]!;
    const top = WATER_LEVEL + S.padTop;
    this.lilyFeat(s, st.pads, top);
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
    // S5-E: the tower's stair is the game's only checkpoint (the body's spot says where you fell).
    const sp = inTowerDungeon(p.x, p.z) && p.z >= TOWER_DUNGEON.stairZ ? insideTower(TOWER_DUNGEON.stair) : this.spawnFor(p.name);
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
      fuego: !!p.fuego,
      fireLeft: Math.max(0, Math.ceil((l.fireReadyAt ?? 0) - this.time - EPS)),
      piedra: !!p.piedra,
      stoneLeft: Math.max(0, Math.ceil((l.stoneReadyAt ?? 0) - this.time - EPS)),
      tame: this.tameView(p, l),
      riding: l.riding,
      steed: !!p.steed,
      star: !!p.star,
      seat: l.seat,
      fish: !!p.fish,
      onFish: l.fish,
      race: l.race ? { i: l.race.i, deadline: r2(l.race.deadline), beast: l.race.beast } : null,
      frog: !!p.frog,
      onFrog: l.frog,
      dragon: !!p.dragon,
      onDragon: l.dragon,
      torch: !!l.torch,
      quartz: this.quartzVeins.filter((v) => p.quartz?.[v.id] !== undefined && this.time - p.quartz[v.id]! < this.regrowDays(p, QUARTZ.regrowDays) * DAY_LENGTH).map((v) => v.id),
      amber: this.amberTrees.filter((t) => p.amber?.[t.id] !== undefined && this.time - p.amber[t.id]! < this.regrowDays(p, AMBER.regrowDays) * DAY_LENGTH).map((t) => t.id),
      capa: p.capaLvl ?? 0,
      chests: [...(p.chests ?? [])],
      weapon: p.weaponLvl ?? 0,
      whaleSeat: this.seatOf(p.name),
      travel: l.travel ? Math.max(0, Math.ceil(l.travel.at - this.time - EPS)) : null,
      xp: this.xpOf(p),
      rank: rankOf(this.xpOf(p)),
      skills: (p.skills ?? []).filter((x): x is SkillId => (SKILL_IDS as readonly string[]).includes(x)),
      look: this.lookOf(p),
      hats: unlockedHats({ ...p, ending: this.ending }),
      book: {
        feats: [...(p.feats ?? [])],
        bosses: bossesOf(p).length,
        kills: { wolf: p.kills?.wolf ?? 0, brute: p.kills?.brute ?? 0, rayo: p.kills?.rayo ?? 0 },
        raids: p.raidsHeld ?? 0,
        zones: this.cleansed.size,
        zonesMax: this.zones.length,
        shrinesMax: this.shrines.length,
        chestsMax: this.chests.length,
        day: Math.floor(this.time / DAY_LENGTH) + 1,
      },
    };
  }

  private nearFire(x: number, z: number, r = FIRE_RADIUS): boolean {
    if (inAnyDungeon(x, z)) return true; // warm inside the Raíz-madre
    return this.structures.some((s) => {
      const d = Math.hypot(s.x - x, s.z - z);
      return (s.kind === 'campfire' && d < r) || (s.kind === 'heart' && s.hp > 0 && d < HEART.warmRadius);
    }) || this.fogataSpots.some((f, i) => this.fogatas[i] && Math.hypot(f.x - x, f.z - z) < r); // lit fogatas and refugios warm (S4 §9.2)
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

  /** Day beasts of the Espinar (S5 §7.2–7.3): once a game day, while the fog is open and someone alive is up here. */
  private spawnAsh(): void {
    const day = Math.floor(this.time / DAY_LENGTH);
    if (!this.fogOpen || day === this.ashDay) return;
    const up = this.activeNames().some((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && inCorrupt(p.x, p.z) && !inAnyDungeon(p.x, p.z);
    });
    if (!up) return;
    this.ashDay = day;
    const spot = (): { x: number; z: number } => {
      const x = -HALF + 20 + this.rng() * (2 * HALF - 40);
      const d = ASH.dMin + this.rng() * (ASH.dMax - ASH.dMin);
      return { x, z: CORRUPT_LANDS.z1 - d };
    };
    for (let i = 0; i < ASH.beasts; i++) {
      const s = spot();
      this.wolves.push(createWolf(this.nextWolfId++, s.x, s.z, this.terrain, this.rng, i < ASH.brutes ? 'brute' : 'wolf'));
    }
    const alive = this.wolves.filter((w) => w.kind === 'rayo' && w.hp > 0).length;
    const n = Math.min(ASH.rayosMin + Math.floor(this.rng() * (ASH.rayosMax - ASH.rayosMin + 1)), Math.max(0, ASH.rayoCap - alive));
    for (let i = 0; i < n; i++) {
      const s = spot();
      const w = createWolf(this.nextWolfId++, s.x, s.z, this.terrain, this.rng, 'rayo');
      w.y += RAYO.fly;
      this.wolves.push(w);
    }
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
          // Beasts don't path on cliffs: in the mountains they gather at the Peldaños' foot, on the forest side.
          const x = inMountains(a.x, a.z) ? Math.max(-HALF + 10, Math.min(HALF - 10, a.x + Math.sin(ang) * d)) : a.x + Math.sin(ang) * d;
          const z = inMountains(a.x, a.z) ? -HALF + 6 + this.rng() * 15 : a.z + Math.cos(ang) * d;
          if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
            this.wolves.push(createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, i === 0 ? 'brute' : 'wolf'));
            break;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- S5-C: los Pilares-raíz

  private makeLakeAnchor(): Wolf {
    const a = this.pillarSpots.anchor;
    return { id: PILLAR.idBase + 1, x: a.x, y: this.terrain.heightAt(a.x, a.z), z: a.z, yaw: 0, hp: LAKE_PILLAR.anchorHp, target: null, cooldown: 0, deadFor: 0, wander: 0, anim: 'idle', raid: false, kind: 'anchor', stun: 0 };
  }

  /** Close enough in height to the lake anchor: only diving (the fish) gets there. */
  private diving(p: SavedPlayer, w: Wolf): boolean {
    return Math.abs(p.y - w.y) <= LAKE_PILLAR.dive;
  }

  private breakLakeAnchor(): void {
    this.lakeAnchor = null;
    this.say(`Se parte la cadena del fondo. El núcleo sube y encalla en la orilla de ${NAMES.blackLake}`);
  }

  /** Enredadera at one of the thicket's bare roots: a root bridge over the thorns. */
  private tendRoot(p: SavedPlayer, x: number, z: number): boolean {
    if (this.pillarsBroken[0]) return false;
    const k = this.pillarSpots.roots.findIndex((r, i) => !this.pillarLive.roots[i] && Math.hypot(r.x - x, r.z - z) <= THICKET.rootReach);
    if (k < 0) return false;
    this.pillarLive.roots[k] = true;
    const n = this.pillarLive.roots.filter(Boolean).length;
    this.tell(p.name, `Una raíz cruza las espinas (${n}/3)`);
    return true;
  }

  private lidUp(): boolean {
    const stones = this.structures.filter((s) => s.kind === 'pillar');
    const on = this.activeNames().flatMap((n) => {
      const o = this.players.get(n);
      return o && !o.dead ? [o] : [];
    });
    return lidUp(this.pillarSpots, stones, on);
  }

  /** What still keeps pillar `id` whole (a toast), or null when it can be pulled. `by` doesn't count as standing on the plate. */
  private pillarBlock(id: number, by: string): string | null {
    const g = this.pillarLive;
    if (id === 0) {
      const n = g.roots.filter(Boolean).length;
      return n < 3 ? `Las espinas lo abrazan. Faltan raíces (${n}/3)` : null;
    }
    if (id === 1) {
      if (this.lakeAnchor) return 'Una cadena lo sujeta al fondo del lago';
      return g.miasma < LAKE_PILLAR.miasma ? `El miasma lo envuelve. Viento (${g.miasma}/${LAKE_PILLAR.miasma})` : null;
    }
    if (id === 2) return g.burns < ASH_RUN.burns ? `El capullo de espinas aguanta. Fuego (${g.burns}/${ASH_RUN.burns})` : null;
    const stones = this.structures.filter((s) => s.kind === 'pillar');
    const others = this.activeNames().flatMap((n) => {
      const o = this.players.get(n);
      return n !== by && o && !o.dead ? [o] : [];
    });
    return lidUp(this.pillarSpots, stones, others) ? null : 'La tapa no se mueve. Algo tiene que pisar la losa';
  }

  /** A on a core: start the 3 s pull (spec S5 §5). */
  /** S5-G: at the Heart after the ending, the post-ending raids go off or on (world setting, for everyone). */
  private onRaids(p: SavedPlayer, on: boolean): void {
    if (!this.ending || p.dead) return;
    const h = this.heart();
    if (!h || h.hp <= 0 || Math.hypot(h.x - p.x, h.z - p.z) > HEART.tendReach) return this.tell(p.name, 'Eso se decide junto al Corazón');
    if (this.raidsOff === !on) return;
    this.raidsOff = !on;
    this.say(`${NAMES.raidNights}: ${on ? 'encendidas' : 'apagadas'}`);
  }

  private onPillar(p: SavedPlayer, l: Live, id: number): void {
    const c = this.pillarSpots.cores[id];
    if (!c || p.dead || l.pull || this.pillarsBroken[id] || inAnyDungeon(p.x, p.z)) return;
    if (Math.hypot(c.x - p.x, c.z - p.z) > PILLAR.reach) return;
    const block = this.pillarBlock(id, p.name);
    if (block) return this.tell(p.name, block);
    l.pull = { id, at: this.time + PILLAR.hold };
    this.tell(p.name, `Tiras del núcleo… (${PILLAR.hold} s)`);
  }

  private stepPulls(): void {
    for (const [name, l] of this.live) {
      const t = l.pull;
      if (!t) continue;
      const p = this.players.get(name)!;
      const c = this.pillarSpots.cores[t.id]!;
      if (p.dead || l.awayFor !== null || this.pillarsBroken[t.id] || Math.hypot(c.x - p.x, c.z - p.z) > PILLAR.reach) {
        l.pull = null;
        if (!p.dead) this.tell(name, 'Sueltas el núcleo');
        continue;
      }
      if (this.time + EPS < t.at) continue;
      l.pull = null;
      this.breakPillar(t.id);
    }
  }

  private breakPillar(id: number): void {
    this.pillarsBroken[id] = true;
    const n = this.pillarsBroken.filter(Boolean).length;
    const power = [NAMES.powerVine, NAMES.powerWind, NAMES.powerFire, NAMES.powerStone][id]!;
    this.say(`El ${NAMES.rootPillar} de ${power} se parte (${n}/${PILLAR.count})`);
    const zn = pillarZone(id);
    if (zn !== null) this.cleanse(zn, 'La ceniza de alrededor se aclara');
    const c = this.pillarSpots.cores[id]!;
    this.xpNear(c.x, c.z, PROGRESS.near, PROGRESS.pillar);
    const near = this.activeNames().filter((nm) => {
      const o = this.players.get(nm);
      return !!o && !o.dead && Math.hypot(o.x - c.x, o.z - c.z) <= 40;
    });
    this.vision(VISION.pillar[id]!(joinNames(near.length ? near : this.activeNames())));
    if (n === PILLAR.count && this.invasion3 === 'none') {
      this.invasion3 = 'pending';
      this.vision(VISION.armed3);
    }
  }

  /** Thorns round the Enredadera pillar, hot ash round the Fuego one (only while they stand); also calls the Fuego pillar's rayo guards. */
  private pillarHazards(p: SavedPlayer, l: Live, dt: number): void {
    if (!inCorrupt(p.x, p.z) || l.dragon) return;
    const onGround = p.y < this.terrain.heightAt(p.x, p.z) + 1.5;
    if (!this.pillarsBroken[0] && onGround && !l.fish && thicketHurts(this.pillarSpots, this.pillarLive.roots, p.x, p.z)) {
      p.vitals = damage(p.vitals, THICKET.dps * dt);
      this.hint(p.name, l, 'Las espinas negras muerden. Busca sus raíces');
    }
    const fire = this.pillarSpots.cores[2]!;
    if (this.pillarsBroken[2]) return;
    if (!this.pillarLive.guards && Math.hypot(p.x - fire.x, p.z - fire.z) <= ASH_RUN.r) {
      this.pillarLive.guards = true;
      for (let i = 0; i < ASH_RUN.guards; i++) {
        const a = (i * 2 * Math.PI) / ASH_RUN.guards;
        const w = createWolf(this.nextWolfId++, fire.x + Math.sin(a) * 6, fire.z + Math.cos(a) * 6, this.terrain, this.rng, 'rayo');
        w.y += RAYO.fly;
        this.wolves.push(w);
      }
    }
    const mounted = l.riding || l.frog || l.fish || !!l.seat || this.seatOf(p.name) !== null;
    if (!mounted && onGround && ashHurts(this.pillarSpots, p.x, p.z)) {
      p.vitals = damage(p.vitals, ASH_RUN.dps * dt);
      this.hint(p.name, l, 'La ceniza quema. A pie no se cruza bien');
    }
  }

  private pillarView(): PillarView {
    const g = this.pillarLive;
    return { broken: [...this.pillarsBroken], roots: [...g.roots], anchor: !!this.lakeAnchor, miasma: g.miasma, burns: g.burns, lid: this.pillarsBroken[3] ? false : this.lidUp() };
  }

  private cleanse(id: number, text: string): void {
    if (this.cleansed.has(id) || !this.zones.some((z) => z.id === id)) return;
    this.cleansed.add(id);
    this.say(text);
    const zn = this.zones.find((z) => z.id === id)!;
    this.xpNear(zn.x, zn.z, zn.r + 10, PROGRESS.zone);
  }

  private stepRaid(night: boolean): void {
    const heart = this.heart();
    const f = dayFraction(this.time);
    const day = Math.floor(this.time / DAY_LENGTH);
    if (this.raid?.phase === 'active' && heart) this.raidLow = Math.min(this.raidLow, heart.hp / STRUCTURE_HP.heart);
    if (this.ending && fullMoon(day) && !night && f >= RAID.warnAt && this.moonToldDay !== day) {
      this.moonToldDay = day;
      this.say(`Luna llena esta noche. Algo rueda por ${NAMES.ash}`);
    }
    const scout = this.swampSeen ? undefined : this.activeNames().find((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && inSwamp(p.x, p.z);
    });
    if (scout) {
      this.swampSeen = true;
      this.vision(VISION.swamp(scout));
    }
    const climber = this.mountainsSeen ? undefined : this.activeNames().find((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && inMountains(p.x, p.z);
    });
    if (climber) {
      this.mountainsSeen = true;
      this.vision(VISION.mountains(climber));
    }
    const walker = this.corruptSeen ? undefined : this.activeNames().find((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && inCorrupt(p.x, p.z);
    });
    if (walker) {
      this.corruptSeen = true;
      this.vision(VISION.corrupt(walker));
    }
    if (!this.raid && !(this.ending && this.raidsOff) && heart && heart.hp > 0 && !night && f >= RAID.warnAt && this.activeCount() > 0) {
      // Raids come from the nearest corrupt zone (spec §3); with none left, from the Raíz-madre.
      const corrupt = this.corrupt();
      const src = nearestZone(this.zones, heart.x, heart.z, corrupt);
      this.raid = { phase: 'warn', dir: raidDirFrom(heart, this.zones, corrupt, this.rootDir(heart)) + (this.rng() - 0.5) * RAID.jitter };
      const where = !src || src.id === 0 ? `la ${NAMES.forestRoot}` : 'una zona marchita';
      this.raidN++;
      // S5-G: after the ending no lieutenant leads (their roots are clean).
      this.raid.gata = !this.ending && gataLeads(this.raidN, this.swampSeen, corrupt);
      this.raid.tri = !this.ending && triLeads(this.raidN, this.mountainsSeen, corrupt);
      this.raid.flecha = !this.ending && flechaLeads(this.raidN, this.corruptSeen, corrupt);
      const lead = this.raid.gata ? NAMES.lieutenant1 : this.raid.tri ? NAMES.lieutenant2 : this.raid.flecha ? NAMES.lieutenant3 : '';
      const coast = (coastRaidBrutes(corrupt) > 0 ? '. Algo sube de la costa' : '') + (lead ? `. ${lead} guía el asedio esta noche` : '');
      this.say(
        this.ending
          ? 'Quedan bestias sueltas por el norte. Vuelvan al Corazón'
          : this.purified
            ? `Restos de corrupción desde ${where}. Vienen menos: vuelvan al Corazón${coast}`
            : `El cielo se tiñe de morado hacia ${where}. ${NAMES.villain} envía a sus bestias: vuelvan al Corazón${coast}`,
      );
    }
    if (night && !this.wasNight && this.raid?.phase === 'warn' && heart) {
      this.raid.phase = 'active';
      this.raidLow = 1;
      this.spawnRaiders(heart, this.raid.dir);
    }
    if (!night && this.wasNight && this.raid) {
      this.raid = null;
      this.gataId = null;
      this.triId = null;
      this.flechaId = null;
      this.raidFlee = 0;
      if (heart && heart.hp > 0) {
        this.raidLevel++;
        this.say(`Sobrevivieron la noche. Nivel de asedio ${this.raidLevel}`);
        const held = this.raidLow >= FEAT_HEART;
        for (const nm of this.activeNames()) {
          const o = this.players.get(nm)!;
          this.gainXp(o, PROGRESS.raid);
          o.raidsHeld = (o.raidsHeld ?? 0) + 1;
          if (held) this.gainFeat(o, 5);
        }
      }
    }
  }

  private spawnRaiders(heart: Structure, dir: number): void {
    const extra = Math.max(0, this.activeCount() - 1);
    const full = Math.min(RAID.maxWave, RAID.base + RAID.perLevel * this.raidLevel + RAID.perPlayer * extra);
    const n0 = this.purified ? Math.max(1, Math.ceil(full * RAID.cleansed)) : full;
    const n = this.raid?.big ? Math.ceil(n0 * INVASION3.raidMult) : this.ending ? endingWave(n0) : n0;
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
    // Invasion 3: a flock of rayos in front of the pack.
    for (let i = 0; this.raid?.big && i < INVASION3.rayos; i++) {
      const ang = dir + (i / (INVASION3.rayos - 1) - 0.5) * 0.8;
      const { x, z } = clampMap(heart.x + Math.sin(ang) * (RAID.spawnMin - 10), heart.z + Math.cos(ang) * (RAID.spawnMin - 10), 5);
      const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, 'rayo');
      w.raid = true;
      this.wolves.push(w);
    }
    // La Gata Araña (or El Triángulo) walks in behind the pack.
    const lead: EnemyKind | null = this.raid?.gata ? 'lieut1' : this.raid?.tri ? 'lieut2' : this.raid?.flecha ? 'lieut3' : null;
    if (lead) {
      for (let tries = 0; tries < 20; tries++) {
        const ang = dir + (this.rng() - 0.5) * 0.8;
        const d = RAID.spawnMax + (lead === 'lieut1' ? GATA.behind : lead === 'lieut2' ? TRIANGULO.behind : FLECHA.behind);
        const x = heart.x + Math.sin(ang) * d;
        const z = heart.z + Math.cos(ang) * d;
        if (inMap(x, z, 5) && this.terrain.heightAt(x, z) > WATER_LEVEL) {
          const w = createWolf(this.nextWolfId++, x, z, this.terrain, this.rng, lead);
          w.raid = true;
          this.wolves.push(w);
          if (lead === 'lieut1') this.gataId = w.id;
          else if (lead === 'lieut3') this.flechaId = w.id;
          else [this.triId, this.rockIn] = [w.id, TRIANGULO.rockEvery];
          break;
        }
      }
    }
  }

  /** When a lieutenant falls: loot to everyone near, a vision, and the rest of the raid flees and is gone in 3 s. */
  private stepGataFall(dt: number): void {
    if (this.raidFlee > 0) {
      this.raidFlee = Math.max(0, this.raidFlee - dt);
      if (this.raidFlee === 0) this.wolves = this.wolves.filter((w) => !w.raid || w.kind === 'lieut1' || w.kind === 'lieut2' || w.kind === 'lieut3');
      return;
    }
    const gata = this.gataId !== null;
    const flecha = !gata && this.flechaId !== null;
    const id = gata ? this.gataId : flecha ? this.flechaId : this.triId;
    const g = id === null ? undefined : this.wolves.find((w) => w.id === id);
    if (id === null || (g && g.hp > 0)) return;
    this.gataId = this.triId = this.flechaId = null;
    if (!g) return;
    this.raidFlee = GATA.fleeFor;
    const present = this.activeNames().filter((n) => {
      const p = this.players.get(n);
      return !!p && !p.dead && Math.hypot(p.x - g.x, p.z - g.z) <= GATA.present;
    });
    const [who, item, n, label] = gata ? [NAMES.lieutenant1, 'amber', GATA.amber, NAMES.amber] as const : flecha ? [NAMES.lieutenant3, 'thorn', FLECHA.thorns, NAMES.thorn] as const : [NAMES.lieutenant2, 'quartz', TRIANGULO.quartz, NAMES.quartz] as const;
    for (const name of present) {
      const p = this.players.get(name)!;
      p.inv = addItem(p.inv, item, n);
      this.tell(name, `${who} deja ${n} de ${label}`);
    }
    this.say(`${who} cae. ${gata ? 'Su manada' : 'El asedio'} huye`);
    const names = joinNames(present.length ? present : this.activeNames());
    this.vision(gata ? VISION.gata(names) : flecha ? VISION.flecha(names) : VISION.triangulo(names));
  }

  /** A beast running away from a point (a raider from the Heart, a wolf from fire). */
  private flee(w: Wolf, goal: { x: number; z: number }, dt: number): void {
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
      .filter((s) => s.kind === 'wall' || s.kind === 'pillar')
      .flatMap((s) => (s.kind === 'pillar' ? [{ id: s.id, x: s.x, z: s.z }] : [-1, 0, 1].map((o) => ({ id: s.id, x: s.x + Math.cos(s.rot) * o, z: s.z - Math.sin(s.rot) * o }))));
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

  /** A hoguera sets the first beast in it burning and sends wolves near it running, then rearms. */
  private stepFires(): void {
    for (const s of this.structures.filter((x) => x.kind === 'fire')) {
      if (this.time + EPS < (this.fireReady.get(s.id) ?? 0)) continue;
      const w = this.wolves.find((x) => x.hp > 0 && !x.burn && Math.hypot(x.x - s.x, x.z - s.z) <= HOGUERA.radius);
      if (!w) continue;
      w.burn = FUEGO.burnFor;
      for (const o of this.wolves) if (o.hp > 0 && o.kind === 'wolf' && Math.hypot(o.x - s.x, o.z - s.z) <= HOGUERA.scare) this.scare(o, s.x, s.z);
      this.fireReady.set(s.id, this.time + HOGUERA.rearm);
      this.damageStructure(s.id, HOGUERA.wear);
    }
    for (const id of this.fireReady.keys()) if (!this.structures.some((s) => s.id === id)) this.fireReady.delete(id);
  }

  /** A beast's blow on a player (roll dodges, a timely guard parries). True when it landed. */
  private bite(name: string, dmg: number, w: Wolf): boolean {
    const p = this.players.get(name);
    if (!p) return false;
    const l = this.live.get(name);
    const out = l ? resolveHit(l.guard, this.time, dmg) : { kind: 'hit' as const, dmg };
    if (out.kind === 'dodged') return false;
    if (out.kind === 'parried') {
      w.stun = BLOCK.parryStun;
      if (w === this.boss) this.boss.weak = BOSS.weakFor;
      if (w === this.shield) this.shield.exposed = ELITE.exposedFor;
      if (w === this.rock) this.rock.exposed = ELITE.exposedFor;
      if (w === this.boss2) this.boss2.exposed = Math.max(this.boss2.exposed, ANTENON.parryFor);
      if (w === this.boss3) groundZancudo(this.boss3, ZANCUDO.parryFall);
      if (w === this.boss4) stickCucurucho(this.boss4, CUCURUCHO.parryFor);
      if (w === this.towerFinal) staggerFinal(this.towerFinal);
      this.strike(name, w, BLOCK.parryDamage);
      this.tell(name, w === this.boss ? 'Parada: el papel se desdobla' : w === this.boss2 ? 'Parada: la cáscara se abre' : w === this.boss3 ? 'Parada: cae al suelo' : w === this.boss4 ? 'Parada: el gorro se levanta' : w === this.towerFinal ? 'Parada: se tambalea y las raíces se abren' : 'Parada');
      return false;
    }
    this.hurt(p, out.dmg);
    return true;
  }

  /** Damage a player can't dodge any more (Capa still counts). */
  private hurt(p: SavedPlayer, dmg: number): void {
    if (this.boss && this.boss.hp > 0 && inBossRoom(p.x, p.z)) this.bossHurt.add(p.name);
    p.vitals = damage(p.vitals, dmg * capaMult(p.capaLvl ?? 0));
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
    for (const g of this.graves.filter((x) => x.owner === p.name && Math.hypot(x.x - p.x, x.z - p.z) <= (hasSkill(p, 'mochila') ? SKILL_FX.gravePickup : GRAVE.pickup))) {
      for (const [item, n] of Object.entries(g.inv) as [ItemId, number][]) p.inv = addItem(p.inv, item, n);
      this.graves.splice(this.graves.indexOf(g), 1);
      this.tell(p.name, 'Recuperaste tus cosas');
    }
  }

  // ---------------------------------------------------------------- El Marchito

  /** He comes once the Tragón fell, when there is a Heart and someone out in the world to see it. */
  private stepInvasion(dt: number): void {
    const h = this.heart();
    if (this.invasion === 'pending' && !this.ending && !this.marchito && h && this.time + EPS >= this.invasionAt) {
      const watcher = this.targets().some((t) => !t.dead && !inAnyDungeon(t.x, t.z));
      if (watcher) this.startInvasion(h);
    }
    const m = this.marchito;
    if (!m || m.grab !== null || m.channel !== null || this.activeCount() === 0) return; // the world sleeps (or it is Invasion 2/3)
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
    if (this.invasion2 === 'pending' && !this.ending && !this.marchito && this.invasion === 'done' && this.purified && h && h.hp > 0) {
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

  /**
   * Invasion 3 (S5 §8): at the dusk warning after the 4th pillar broke, he comes from the north for the Heart
   * itself, with a big raid. Driven off or not, the dawn after it opens the tower.
   */
  private stepInvasion3(dt: number): void {
    const h = this.heart();
    const f = dayFraction(this.time);
    const night = isNight(f);
    if (this.invasion3 === 'pending' && !this.ending && !this.inv3 && !this.marchito && h && h.hp > 0 && !night && f >= RAID.warnAt) {
      const watcher = this.targets().some((t) => !t.dead && !inAnyDungeon(t.x, t.z));
      if (watcher) this.startInvasion3(h);
    }
    if (!this.inv3) return;
    if (night) this.inv3.dark = true;
    else if (this.inv3.dark) {
      this.inv3 = null;
      if (this.marchito && this.marchito.channel !== null) this.marchito = null;
      this.invasion3 = 'done';
      this.towerOpen = true;
      this.say(`Amanece. La puerta de ${NAMES.villainTower} se abre`);
      return;
    }
    const m = this.marchito;
    if (!m || m.channel === null || this.activeCount() === 0 || !h) return;
    const ev = stepChanneler(m, h, this.targets(), (x, z) => this.terrain.heightAt(x, z), dt);
    if (!ev) return;
    if (ev.t === 'swipe') this.bite(ev.name, ENEMY.marchito.damage, m);
    else if (ev.t === 'drained') {
      if (h.hp > 1) {
        h.hp = 1;
        this.outbox.push({ to: null, msg: { t: 'hit', id: h.id, hp: 1 } });
      }
      this.vision(VISION.drained3(joinNames(this.activeNames())));
    } else this.marchito = null;
  }

  /** Tamed dragons parked near the Heart at night bite the nearest rayo (S5 §8.3). Never ground beasts nor El Marchito. */
  private stepSkyGuard(night: boolean): void {
    const h = this.heart();
    if (!night || !h || h.hp <= 0) return;
    for (const p of this.players.values()) {
      const d = p.dragon;
      if (!d || this.live.get(p.name)?.dragon || Math.hypot(d.x - h.x, d.z - h.z) > AIR.guardR) continue;
      if (this.time + EPS < (this.skyBiteAt.get(p.name) ?? 0)) continue;
      const foe = guardTarget(d, this.wolves);
      if (!foe) continue;
      this.skyBiteAt.set(p.name, this.time + AIR.every);
      hitWolf(foe, AIR.claw);
    }
  }

  private startInvasion3(h: Structure): void {
    const dir = Math.atan2(VILLAIN_TOWER.x - h.x, VILLAIN_TOWER.z - h.z);
    const { x, z } = clampMap(h.x + Math.sin(dir) * MARCHITO.spawnDist, h.z + Math.cos(dir) * MARCHITO.spawnDist, 6);
    this.marchito = createMarchito(x, this.terrain.heightAt(x, z), z, [], heartWill(this.activeCount()));
    this.marchito.channel = 0;
    this.inv3 = { dark: false };
    if (this.raid?.phase === 'warn') Object.assign(this.raid, { dir, big: true });
    this.vision(VISION.arrive3);
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
    if (m.channel !== null) {
      this.vision(VISION.driven3(joinNames(m.taunted)));
      this.marchito = null;
      return;
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

  /** P4-A: total Savia (milestones from the save + the stored rest). */
  private xpOf(p: SavedPlayer): number {
    return totalXp({ ...p, ending: this.ending });
  }

  private gainXp(p: SavedPlayer, n: number): void {
    if (n > 0) p.xp = (p.xp ?? 0) + n;
  }

  /** Savia to every connected, living player within `r` m. */
  private xpNear(x: number, z: number, r: number, n: number): void {
    for (const nm of this.activeNames()) {
      const o = this.players.get(nm);
      if (o && !o.dead && Math.hypot(o.x - x, o.z - z) <= r) this.gainXp(o, n);
    }
  }

  /** A kill through strike: small Savia under the daily cap; a lieutenant or the Torre's Flecha gives 50 to all near. */
  private xpForKill(name: string, w: Wolf): void {
    if (w.kind === 'lieut1' || w.kind === 'lieut2' || w.kind === 'lieut3') return this.xpNear(w.x, w.z, PROGRESS.near, PROGRESS.lieut);
    const p = this.players.get(name);
    if (!p || killXp(w.kind) === 0) return;
    const r = addKillXp(p.killDay, Math.floor(this.time / DAY_LENGTH), w.kind);
    p.killDay = r.killDay;
    this.gainXp(p, r.gain);
  }

  /** P4-A: whoever climbed a Rango: one rankUp to all (the client shows the card to them, the flash to everyone). */
  private checkRanks(): void {
    for (const [name, l] of this.live) {
      if (l.awayFor !== null) continue;
      const p = this.players.get(name);
      if (!p) continue;
      const r = rankOf(this.xpOf(p));
      if (l.rank === undefined) l.rank = r;
      if (r <= l.rank) continue;
      l.rank = r;
      this.outbox.push({ to: null, msg: { t: 'rankUp', name, rank: r } });
    }
  }

  /** P4-D: a Proeza, once; its hat if it has one. */
  private gainFeat(p: SavedPlayer, id: number): void {
    if (p.feats?.includes(id)) return;
    p.feats = [...(p.feats ?? []), id];
    const hat = FEAT_HAT[id];
    this.tell(p.name, `${NAMES.feat}: ${NAMES.featNames[id - 1]}.${hat ? ` Nuevo sombrero: ${NAMES.hatNames[HAT_IDS[hat - 1]!]}` : ''}`);
  }

  /** P4-D: the Libro's counters on a killing blow (kills to the striker; a boss to all near, like its Savia). */
  private countKill(name: string, w: Wolf): void {
    if (w.kind === 'wolf' || w.kind === 'brute' || w.kind === 'rayo') {
      const p = this.players.get(name);
      if (p) p.kills = { ...p.kills, [w.kind]: (p.kills?.[w.kind] ?? 0) + 1 };
      return;
    }
    if (!(BOSS_KINDS as readonly string[]).includes(w.kind)) return;
    for (const nm of this.activeNames()) {
      const o = this.players.get(nm);
      if (o && !o.dead && Math.hypot(o.x - w.x, o.z - w.z) <= PROGRESS.near && !o.bosses?.includes(w.kind)) o.bosses = [...(o.bosses ?? []), w.kind];
    }
  }

  /** P4-D Pies secos: pad 0 → the last pad, never in the water, never on the frog. */
  private lilyFeat(s: { parts: { x: number; z: number }[] }, pads: { downUntil: number }[], top: number): void {
    const S = SWAMP_SHRINE;
    for (const [name, l] of this.live) {
      const p = this.players.get(name)!;
      if (p.dead || l.awayFor !== null) continue;
      if (l.frog || p.y < WATER_LEVEL - 0.4) {
        l.lily = false;
        continue;
      }
      const on = (i: number) => this.time >= pads[i]!.downUntil && Math.hypot(s.parts[i]!.x - p.x, s.parts[i]!.z - p.z) <= S.padR + 0.3 && p.y > top - 0.5 && p.y < top + 1.5;
      if (on(0)) l.lily = true;
      if (l.lily && on(pads.length - 1)) {
        l.lily = false;
        this.gainFeat(p, 3);
      }
    }
  }

  /** P4-D Solo contra el frío: at nightfall below the Cumbre, never warm since, and up there before dawn. */
  private coldFeat(p: SavedPlayer, l: Live, night: boolean, warm: boolean): void {
    const high = inMountains(p.x, p.z) && mountainDepth(p.z) >= MOUNTAINS.cumbre;
    if (!night || warm) {
      l.cold = false;
      return;
    }
    if (!this.wasNight) l.cold = !high;
    if (l.cold && high) {
      l.cold = false;
      this.gainFeat(p, 4);
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
    if (l) {
      l.deadAt = this.time;
      this.dismount(p, l);
    }
    this.outbox.push({ to: null, msg: { t: 'toast', text: `${p.name} ha caído` } });
  }
}
