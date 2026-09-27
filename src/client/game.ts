import { weatherAt, weatherLine, wetAt, type Weather } from '../shared/weather';
import { rankLine, rankUpText, RANK_FLASH } from './rank-ui';
import { dawnCrossed, precipKind, stormDim, WeatherFx } from './scene/weather';
import { AmbientLife } from './scene/ambient';
import { NAMES } from '../shared/names';
import * as THREE from 'three';
import { HARVEST, generateResources, type ResourceSpawn } from '../shared/resources';
import { coastFeatures, corruptFeatures, createTerrain, inMountains, inSwamp, type Islet, type Terrain, WATER_LEVEL, waterLevel } from '../shared/terrain';
import { FISH, fishRings, wildFish } from '../shared/fish';
import { depthAt } from '../shared/coast';
import { FishMeshes, RaceRings, type FishPose } from './scene/fish';
import { FrogMeshes, LilyPads, type FrogPose } from './scene/frog';
import { FROG, frogPads, wildFrog } from '../shared/frog';
import { DRAGON, dragonPos, leapOk, picoOf, type PicoCircle } from '../shared/dragon';
import { DragonMeshes, DRAGON_SINK, type DragonPose } from './scene/dragon';
import { WhaleMesh } from './scene/whale';
import { seatOffset, WHALE } from '../shared/whale';
import { cragsNear, generateCrags, type Crag } from '../shared/crags';
import { generateShrines, SHRINE, type Shrine } from '../shared/shrines';
import { clampStep, generateEntrance, withDungeon } from '../shared/dungeon';
import { antenonBarText, bossBarText, clawPick, cucuruchoBarText, zancudoBarText, coastDungeonAction, dungeonAction, eliteBarText, emptyDungeonView, marchitoBarText, mountainDungeonAction, peatBarText, rockBarText, shieldBarText, swampDungeonAction, flechaBarText, finalBarText, towerDungeonAction } from './dungeon-ui';
import { MountainDungeonMeshes } from './scene/mountain-dungeon';
import { TowerDungeonMeshes } from './scene/tower-dungeon';
import { columnCrags, towerEntrance, towerShelfCrag, TOWER_DUNGEON } from '../shared/tower-dungeon';
import { FINAL } from '../shared/sim/marchito-final';
import { mountainEntrance, shelfCrag } from '../shared/mountain-dungeon';
import { PIEDRA, structureCrags } from '../shared/piedra';
import { MARCHITO } from '../shared/sim/marchito';
import { mountAction, ringNeedle } from './mount-ui';
import { MOUNT } from '../shared/mount';
import { SteedMeshes, type SteedPose } from './scene/steeds';
import { PROTOCOL_VERSION, r2, type Anim, type DungeonView, type FogState, type HeartView, type PillarView, type RaidView, type ServerMsg, type ShrineView, type SteedView, type Structure, type TameView, type WhaleView } from '../shared/protocol';
import { DAY_LENGTH, dayFraction, HEART, PUNCH, REACH, REVIVE } from '../shared/sim/world-sim';
import { BOW } from '../shared/sim/combat';
import { keepLock, LOCK, pickTarget, yawTo, type AimTarget } from './aim';
import type { ItemId, StructureKind } from '../shared/items';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import { loadModels, type ModelKit } from './actors/models';
import type { Vitrina } from './vitrina';
import { PaperActor, type Puppet } from './actors/paper';
import { guardianAction, guardianLine, raidsMenu } from './ending-ui';
import { ENDING, guardianSpot, withLookout } from '../shared/ending';
import { ESTRELLA } from '../shared/estrella';
import { TOWER, withGrieta } from '../shared/corrupt-lands';
import { DungeonMeshes } from './scene/dungeon';
import { CoastDungeonMeshes, GustFx } from './scene/coast-dungeon';
import { FlameFx, SwampDungeonMeshes, ZarzalKnot } from './scene/swamp-dungeon';
import { plankCrags, swampEntrance } from '../shared/swamp-dungeon';
import { FUEGO } from '../shared/fuego';
import { coastEntrance } from '../shared/coast-dungeon';
import { VIENTO } from '../shared/viento';
import { boost } from './movement';
import { CameraRig } from './camera-rig';
import { ColliderGrid } from './colliders';
import { Hud } from './hud';
import { raidText } from './raid-ui';
import { clearHold, Keyboard, nextPower, POWER_ICON, readMove, type Action, type InputState, KEY_ACTIONS, type PowerChoice } from './input';
import { InterpBuffer, INTERP_DELAY } from './interp';
import type { JoinInfo } from './join';
import { STEEP_TEXT, withEscalera } from '../shared/mountains';
import { ATALAYA } from '../shared/sim/cucurucho';
import { buildAtalaya, UmbralMeshes } from './scene/umbral';
import { animFor, createBody, rollInput, staminaFor, stepBody, type Body } from './movement';
import { Connection, wsUrl, type NetStatus } from './net';
import { FpsGuard, hasSavedTier, loadTier, lowerTier, PROBE, probeVerdict, saveTier, TIERS, type Tier } from './quality';
import { FpsMeter } from './fps-meter';
import type { PerfStop } from './perf-hook';

/** Resources are drawn within drawDistance × this (the fog is opaque from drawDistance × 0.8) plus a crown's height. */
const NEAR_RADIUS = 0.9;
/** V2-A: `?perf=1` exposes window.__perf for `npm run perf`. Only in dev and `--mode perf` builds; production strips it. */
const PERF_BUILD = import.meta.env.DEV || import.meta.env.MODE === 'perf';
const OFFER_KEY = 'bosque.tierOffer';

import { DayLight } from './scene/sky';
import { LIFE_UNIFORMS, patchCaustics, patchTree, pickGlows, setGlows, WORLD_UNIFORMS } from './scene/patches';
import { biomeOf, biomeWeights, copyLook, easeLook, lookAt, newLook } from './scene/looks';
import { StructureMeshes } from './scene/structures';
import { GraveMeshes } from './scene/graves';
import { buildCrags, buildVine } from './scene/crags';
import { ShrineMeshes } from './scene/shrines';
import { ChestMeshes } from './scene/chests';
import { coastAction, rescueAction, shrinePartAt } from './coast-ui';
import { RescueMeshes } from './scene/rescue';
import { rescueSite, type RescueSite } from '../shared/rescue';
import type { CageView, FinalView, TradeView } from '../shared/protocol';
import { generateChests, generateCoastShrines, type Chest } from '../shared/coast-shrines';
import { FogataMeshes } from './scene/fogatas';
import { generateFogatas, type Fogata } from '../shared/fogatas';
import { generateAmberTrees, generateSwampShrines, lilyPadCrags, type AmberTree } from '../shared/swamp-shrines';
import { AmberMeshes } from './scene/amber';
import { COLORS, HAT_IDS, hasSkill, SKILL_FX, SKILL_IDS, type SkillId } from '../shared/progression';
import { skillsHtml } from './skills-ui';
import { lookHtml } from './look-ui';
import { bookHtml } from './book-ui';
import { merchantAction, merchantHtml } from './merchant-ui';
import { buyHtml, nextItem, stallAction, stallHtml, stallListHtml } from './stall-ui';
import { addLine, bumpLine, cycleLine, tradeHtml, tradeTarget } from './trade-ui';
import { StallMeshes } from './scene/stalls';
import { MERCHANT, STALL, type Stall, type TradeLine } from '../shared/shop';
import { CALL_LABEL, fogataAction, fogataCalls, fogataTargets, swampAction } from './swamp-ui';
import { quartzAction } from './mountain-ui';
import { QuartzMeshes } from './scene/quartz';
import { corniceLedges, generateMountainShrines, generateQuartzVeins, type QuartzVein } from '../shared/mountain-shrines';
import { VillainTower } from './scene/villain-tower';
import { PillarMeshes } from './scene/pillars';
import { buildSea, setLakePurify, WATER_UNIFORMS } from './scene/water';
import { underwater, WATER } from './scene/water-data';
import { pillarAction } from './corrupt-ui';
import { pillarSites, type PillarSites } from '../shared/pillars';
import { buildPines, buildTerrainMesh, buildThorns, chunkDetailed, corruptChunks, corruptVisible, mountainChunks, terrainPatches, type MountainChunk } from './scene/terrain-mesh';
import { swampFog } from '../shared/swamp';
import { CorruptionMeshes } from './scene/corruption';
import { allZones, type Zone } from '../shared/corruption';
import { ResourceMeshes } from './scene/vegetation';
import { GrassField } from './scene/grass';
import { FRONT_HEALED, HealWaves } from './scene/heal';
import { TouchControls, isTouchDevice } from './touch';
import { nextTrap, TRAP_LABEL, type TrapKind } from './trap';

/** Camera far plane deep in the swamp (fog far is 70 m there). */
const SWAMP_FAR = 100;

/** The nephew's drawing used for el Tragón de Papel (and, purified, the Heart's defender). */
const TRAGON_IMG = '/enemies/enemy1.png';
/** El Antenón (enemy3.png has real transparency: no keying needed). */
const ANTENON_IMG = '/enemies/enemy3.png';
const ANTENON_ASPECT = 512 / 353;
/** El Marchito in person: the tallest of the nephew's drawings, dyed dark. */
const MARCHITO_IMG = '/enemies/enemy12.png';
/** La Gata Araña, the swamp's lieutenant (enemy2.png has real transparency). */
const GATA_IMG = '/enemies/enemy2.png';
const GATA_ASPECT = 408 / 512;
/** El Triángulo, the mountains' lieutenant (enemy7.png has real transparency). */
const TRIANGULO_IMG = '/enemies/enemy7.png';
const TRIANGULO_ASPECT = 455 / 469;
/** El Zancudo (enemy9.png has real transparency); thin lines, so drawn 6 m wide (spec S3 §14.4). */
const ZANCUDO_IMG = '/enemies/enemy9.png';
/** El rayo marchito (enemy11.png, RGBA 460 × 485, 72 % transparent): a 2 m purple paper bolt (spec S5 §7.2). */
const RAYO_IMG = '/enemies/enemy11.png';
const RAYO_ASPECT = 460 / 485;
/** La Flecha (enemy10.png, RGBA 463 × 437, 75 % transparent): a 3 m black arrow (spec S5 §9). */
const FLECHA_IMG = '/enemies/enemy10.png';
const FLECHA_ASPECT = 463 / 437;
const ZANCUDO_ASPECT = 358 / 291;
const CUCURUCHO_IMG = '/enemies/enemy13.png';
const CUCURUCHO_ASPECT = 556 / 601;
/** El Corazón Negro (enemy8.png, RGBA 638 × 536, 61 % transparent): El Marchito's core in the Copa's phase 3, 2.5 m (spec S5 §11.3). */
const CORE_IMG = '/enemies/enemy8.png';
const CORE_ASPECT = 638 / 536;
const GUARDIAN_IMG = '/enemies/enemy6.png';
const GUARDIAN_ASPECT = 512 / 280;
/** S5-H: la Estrella (enemy14.png, 423 × 430). */
const STAR_IMG = '/enemies/enemy14.png';
const STAR_ASPECT = 423 / 430;
/** The four brotes' tints (Enredadera, Viento, Fuego, Piedra). */
const BROTE_TINT = [0x7ad07a, 0xbfe6ff, 0xff9a5a, 0xc8b89a];

interface Remote {
  actor: Puppet;
  buf: InterpBuffer;
  anim: string;
  seen: number;
  /** A player riding a deer. */
  ride: boolean;
  /** S5-H: that deer is la Estrella. */
  star?: boolean;
  /** A player on the giant fish. */
  fish: boolean;
  /** A player on a frog. */
  frog: boolean;
  /** A player on a dragon (S4-G). */
  dragon: boolean;
  /** Sitting behind this rider. */
  seat: string | null;
  /** Aboard the whale. */
  whale: boolean;
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

/** The flame over burning enemies (spec S3 §14.3: one shared material, no particles). */
const BURN_MAT = new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: false });

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
  private tier: Tier = loadTier();
  /** V2-A: first game (no saved tier) → frame times of the first seconds in the world. */
  private probe: number[] | null = hasSavedTier() ? null : [];
  private probeT = 0;
  private guard: FpsGuard | null = null;
  /** Pixel ratio the guard lowered us to, as a fraction of the tier's (1 = untouched). */
  private ratioScale = 1;
  private fpsMeter: FpsMeter | null = null;
  private readonly perfMode = PERF_BUILD && new URLSearchParams(location.search).has('perf');
  private perfStop: PerfStop | null = null;
  /** V2-E: the harness showcase (only built by `?perf=1`). */
  private vitrina: Vitrina | null = null;
  private vitrinaHooks(): Partial<import('./vitrina').VitrinaEnv> {
    return {};
  }
  private perfOff: (() => void) | null = null;
  /** Connection is up and the server welcomed us on it (perf harness waits on this after a re-import). */
  private netOnline = false;
  private welcomed = false;
  private readonly timer = new THREE.Timer();
  private readonly colliders = new ColliderGrid();
  private readonly structures = new StructureMeshes();
  /** T6-A: the Puestos, as the server last told us. */
  private readonly stallMeshes = new StallMeshes();
  private stalls = new Map<number, Stall>();
  /** T6-A: the owner's panel is open on this Puesto id. */
  private stallOpen: number | null = null;
  /** T6-D: where the Buhonero stands (from the snapshot). */
  private merchantSpot: { x: number; z: number } | null = null;
  private merchantOpen = false;
  /** T6-C: my open trade, as the server last told it. */
  private trade: TradeView | null = null;
  private readonly graves = new GraveMeshes();
  private readonly others = new Map<string, Remote>();
  private readonly wolves = new Map<number, Remote>();
  /** S5-D: ids of the rayos in the last snapshot (the dragon's claw only reaches those). */
  private rayoIds = new Set<number>();
  /** The purified Tragón by the Heart (at most one, key 0). */
  private readonly allies = new Map<number, Remote>();
  private dungeonMeshes: DungeonMeshes | null = null;
  private coastMeshes: CoastDungeonMeshes | null = null;
  private readonly gustFx = new GustFx();
  private swampMeshes: SwampDungeonMeshes | null = null;
  private zarzalKnot: ZarzalKnot | null = null;
  /** The white Zancudo's lantern (a small unfogged glow under it). */
  private farolGlow: THREE.Mesh | null = null;
  private atalaya: THREE.Mesh | null = null;
  private umbral: UmbralMeshes | null = null;
  /** La Escalera del Umbral is up (from the snapshot); the client terrain reads it. */
  private escaleraUp = false;
  /** S5-G: El Marchito fell (white tower, el Guardián, la Grieta) and the Heart's raids toggle. */
  private ending = false;
  private raidsOff = false;
  private guardian: PaperActor | null = null;
  private guardianSays = 0;
  private readonly flameFx = new FlameFx();
  private hasFire = false;
  private fireLeft = 0;
  private hasStone = false;
  private stoneLeft = 0;
  private readonly mountainDoor = mountainEntrance();
  private caveMeshes: MountainDungeonMeshes | null = null;
  /** S5-E: the tower's door and interior. */
  private readonly towerDoor = towerEntrance();
  private towerMeshes: TowerDungeonMeshes | null = null;
  private towerOpen = false;
  /** The white Zancudo's farol on floor 3. */
  private towerFarol: THREE.Mesh | null = null;
  /** Live Piedra pillars and torres: climbable (structureCrags), and pillars stop the rockfall. */
  private stoneStructs: Structure[] = [];
  private readonly swampDoor = swampEntrance();
  private plankKey = '';
  /** The power H casts (J / holding the pill switches); client-side, sent with each cast. */
  private powerKind: PowerChoice = 'enredadera';
  private hasWind = false;
  private windLeft = 0;
  private coastDoor = { x: 0, z: 0 };
  private readonly gone = new Set<number>();
  private steedMeshes: SteedMeshes | null = null;
  private steeds: SteedView[] = [];
  private tame: TameView | null = null;
  private riding = false;
  /** The rider we sit behind (the server moves us with them). */
  private seat: string | null = null;
  private hasSteed = false;
  /** S5-H: our steed is la Estrella; the wild one in view; her papers by key. */
  private hasStar = false;
  private estrella: SteedView | null = null;
  private readonly stars = new Map<string, PaperActor>();
  private fishMeshes: FishMeshes | null = null;
  private whaleMesh: WhaleMesh | null = null;
  /** La Ballena from the last snapshot, where we draw it (smoothed), and our seat on it. */
  private whaleView: WhaleView | null = null;
  private whaleDraw: { x: number; z: number; yaw: number } | null = null;
  private whaleSeat: number | null = null;
  private raceRings: RaceRings | null = null;
  /** The wild giant fish and parked ones in view. */
  private fishViews: SteedView[] = [];
  private hasFish = false;
  private onFish = false;
  private race: { i: number; deadline: number; beast: 'fish' | 'frog' } | null = null;
  private frogMeshes: FrogMeshes | null = null;
  private lilyPads: LilyPads | null = null;
  private dragonMeshes: DragonMeshes | null = null;
  /** The wild dragon (while out) and parked ones in view. */
  private dragonViews: SteedView[] = [];
  private hasDragon = false;
  private onDragon = false;
  private pico: PicoCircle | null = null;
  /** The wild frog and parked ones in view. */
  private frogViews: SteedView[] = [];
  private hasFrog = false;
  private onFrog = false;
  /** The dungeon island (the fish keeps out of its aguas bravas). */
  private island: Islet | null = null;
  private jumpWasHeld = false;
  private light: DayLight;
  private kits: { robot: ModelKit; fox: ModelKit } | null = null;
  private seed: number | null = null;
  private terrain: Terrain | null = null;
  private spawns: ResourceSpawn[] = [];
  private crags: Crag[] = [];
  private shrines: Shrine[] = [];
  private shrineMeshes: ShrineMeshes | null = null;
  private chests: Chest[] = [];
  private chestMeshes: ChestMeshes | null = null;
  /** Sunken chests this player opened, weapon level and pearls carried (from the server). */
  private opened: number[] = [];
  private weapon = 0;
  private pearls = 0;
  private amberTrees: AmberTree[] = [];
  private amberMeshes: AmberMeshes | null = null;
  /** Mountain quartz veins, the Cornisa's ledges, veins regrowing for us and quartz carried (S4-C). */
  private quartzVeins: QuartzVein[] = [];
  private ledges: Crag[] = [];
  private quartzMeshes: QuartzMeshes | null = null;
  private quartzRegrowing: number[] = [];
  private quartz = 0;
  private thorn = 0;
  /** Amber trees regrowing for us, amber carried, Capa level, torch in hand (from the server). */
  private regrowing: number[] = [];
  private amber = 0;
  private capa = 0;
  private torch = false;
  /** Swamp fogatas (from the seed), which are lit, and seconds left of our channel (from the server). */
  private fogataSpots: Fogata[] = [];
  private fogatasLit: boolean[] = [];
  /** S5-A: the muro de niebla and El Marchito's tower height (from the server). */
  private fog: FogState = 'closed';
  private towerH = 60;
  private fogataMeshes: FogataMeshes | null = null;
  private travelLeft: number | null = null;
  /** Las Montañas: when the next "too steep" toast may show (ms). */
  private steepToastAt = 0;
  /** The tobogán's one-time hint was shown this session (S4-H). */
  private slideTold = false;
  /** Mountain weather (S4-B): rain/snow cloud and the last day fraction (for the dawn line). */
  private weatherFx!: WeatherFx;
  private lastFrac: number | null = null;
  private padKey = '';
  private shrineViews: ShrineView[] = [];
  /** Shrines this player cleared (from the server). */
  private cleared: number[] = [];
  /** Has Enredadera (from the server). */
  private hasPower = false;
  private entrance = { x: 0, y: 0, z: 0 };
  private zones: Zone[] = [];
  private ground: THREE.Mesh | null = null;
  private farGround: THREE.Mesh | null = null;
  private swampGround: THREE.Mesh | null = null;
  /** Las Montañas: per chunk, a detail mesh near the player or its silhouette (only one of them visible). */
  private mountainMeshes: { chunk: MountainChunk; detail: THREE.Mesh; silhouette: THREE.Mesh }[] = [];
  /** S5-A: las Tierras Corruptas' chunks, in one group shown only north of CORRUPT_SHOW_Z or flying. */
  private corruptMeshes: { chunk: MountainChunk; detail: THREE.Mesh; silhouette: THREE.Mesh }[] = [];
  private readonly corruptGroup = new THREE.Group();
  /** S5-A: El Marchito's tower (real near it, a sky copy from everywhere else). */
  private villainTower: VillainTower | null = null;
  /** S5-C: los Pilares-raíz (seeded spots, their meshes and the last view). */
  private pillarSpots: PillarSites | null = null;
  private pillarMeshes: PillarMeshes | null = null;
  private pillarView: PillarView | null = null;
  /** La Flecha's red line on the ground while she aims (one shared mesh). */
  private readonly flechaLine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1), new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false }));
  /** S5-F: El Marchito's three root lines while told, and a pool of violet discs for el Corazón Negro's trail. */
  private readonly rootLines = [0, 1, 2].map(() => new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 1), new THREE.MeshBasicMaterial({ color: 0xb03cff, fog: false })));
  private readonly trailDiscs = Array.from({ length: 16 }, () => new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6a2a8a, transparent: true, opacity: 0.7, fog: false })));
  private corruptionMeshes: CorruptionMeshes | null = null;
  /** Invasion 2's cage and anchors (spots from the seed) and the last cage view (null = the Tragón is home). */
  private rescueMeshes: RescueMeshes | null = null;
  private rescueSpot: RescueSite | null = null;
  private cage: CageView | null = null;
  /** Standing anchors in view: targets for punches, arrows and the lock (no actor). */
  private anchorTargets: AimTarget[] = [];
  /** Last corrupt-ids key applied to the ground tint. */
  private corruptKey = '';
  private dungeon: DungeonView = emptyDungeonView();
  private vines: Crag[] = [];
  private vineKey = '';
  private readonly vineGroup = new THREE.Group();
  /** Crags + shrine rocks (bare unless wrapped) + vines: what stepBody climbs and stands on. */
  private climbList: Crag[] = [];
  /** Resource spawns inside a crag: hidden and uncollided on the client. */
  private readonly buried = new Set<number>();
  private resMeshes: ResourceMeshes | null = null;
  private grass: GrassField | null = null;
  /** V2-C: corrupt zones and their healing waves (shader uniforms), and the ending flag they last saw. */
  private heal = new HealWaves();
  private healEnding = false;
  private lastCorrupt: readonly number[] = [];
  /** V2-C: 0..1, las Tierras purified (El Marchito fell). */
  private purify = 0;
  /** V2-C: 0 calm, 0.5 rain, 1 storm (stronger wind). */
  private windStorm = 0;
  private readonly tmpFwd = new THREE.Vector3();
  private readonly skyLook = newLook();
  private readonly lookTarget = newLook();
  private lookFresh = false;
  private patchIn = 0;
  /** V2-D: birds, fireflies, crabs, fish and biome particles. */
  private life: AmbientLife | null = null;
  /** V2-D: the underwater tint over the canvas. */
  private readonly underDiv = document.createElement('div');
  private body: Body | null = null;
  private me: Actor | null = null;
  private myName = '';
  private serverTime = 0;
  private dead = false;
  private heart: HeartView | null = null;
  private raid: RaidView | null = null;
  /** Trap the touch pill places (Menú toggle). */
  private trap: TrapKind = 'spikes';
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
  /** P4-B: my oficios and Rango (from the snapshot). */
  private skills: SkillId[] = [];
  /** P4-C: worn colour/hat and the hats unlocked. */
  private look = { color: 0, hat: 0 };
  private hats: number[] = [];
  /** P4-D: the last own snapshot (the Libro reads it). */
  private lastSelf: Extract<ServerMsg, { t: 'snap' }>['self'] | null = null;
  private rank = 1;

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
    Actor.shadowDiscs = !t.shadows;
    this.weatherFx = new WeatherFx(this.scene);
    this.scene.add(this.structures.group, this.stallMeshes.group, this.graves.group, this.vineGroup);
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
    if (new URLSearchParams(location.search).has('fps')) this.fpsMeter = new FpsMeter(root);
    Object.assign(this.underDiv.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', background: '#0d3f6a', transition: 'opacity 0.2s' });
    root.appendChild(this.underDiv);
    if (PERF_BUILD && this.perfMode) {
      this.probe = null;
      void import('./perf-hook').then((m) => {
        if (this.disposed) return;
        this.perfOff = m.installPerfHook({
          renderer: this.renderer,
          scene: this.scene,
          ready: () => !!this.body && !!this.terrain && !!this.kits,
          tier: () => this.tier,
          stop: (p) => (this.perfStop = p),
          online: () => this.netOnline && this.welcomed,
          zones: () => this.zones.map((z) => ({ ...z })),
          cleanse: (id) => {
            this.lastCorrupt = this.lastCorrupt.filter((c) => c !== id);
            this.heal.sync(this.lastCorrupt, this.ending, performance.now() / 1000);
          },
          showcase: (what) => {
            if (!this.kits || !this.terrain || !this.perfStop) return;
            const terrain = this.terrain;
            const kits = this.kits;
            const stop = this.perfStop;
            void import('./vitrina').then((v) => {
              this.vitrina ??= new v.Vitrina({ scene: this.scene, camera: this.camera, kits, heightAt: (x, z) => terrain.heightAt(x, z), ...this.vitrinaHooks() });
              this.vitrina.show(what, stop.x, stop.z);
            });
          },
        });
      });
    } else this.guard = new FpsGuard(this.tier, this.renderer.getPixelRatio());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** V2-A: lower the tier now (pixel ratio, far plane, shadows); grass and terrain detail follow on the next entry. */
  private lowerTo(t: Tier): void {
    this.tier = t;
    saveTier(t);
    const s = TIERS[t];
    this.ratioScale = 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, s.pixelRatio));
    if (this.renderer.shadowMap.enabled && !s.shadows) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
      });
    }
    this.hud.toast('Bajé los gráficos.');
  }

  /** V2-A: the first-game probe, the in-game guard and the `?fps=1` counter. `raw` is the unclamped frame time (s). */
  private watchFps(raw: number): void {
    this.fpsMeter?.update(raw, this.tier, this.ratioScale);
    if (this.probe) {
      this.probe.push(raw * 1000);
      this.probeT += raw;
      if (this.probeT >= PROBE.secs) {
        const v = probeVerdict(this.probe, this.tier, !!this.touch);
        this.probe = null;
        const down = v === 'down' ? lowerTier(this.tier) : null;
        if (down) {
          this.lowerTo(down);
          this.guard = new FpsGuard(down, this.renderer.getPixelRatio());
        } else saveTier(this.tier); // the guess held: don't probe again
        if (v === 'offer') {
          try {
            if (!localStorage.getItem(OFFER_KEY)) {
              localStorage.setItem(OFFER_KEY, '1');
              this.hud.toast('Esto va sobrado: prueba gráficos Media en el Menú.');
            }
          } catch {
            // storage blocked: no offer
          }
        }
      }
      return;
    }
    const a = this.guard?.feed(raw, performance.now() / 1000);
    if (!a) return;
    if (a.kind === 'tier') return this.lowerTo(a.tier);
    this.ratioScale = a.ratio / Math.min(devicePixelRatio, TIERS[this.tier].pixelRatio);
    this.renderer.setPixelRatio(a.ratio);
  }

  dispose(): void {
    this.disposed = true;
    this.conn.close();
    this.renderer.setAnimationLoop(null);
    this.perfOff?.();
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
    this.netOnline = s.kind === 'online';
    this.welcomed = false;
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
      case 'stall':
        return this.setStall(m.s, !!m.gone);
      case 'trade':
        return this.setTrade(m.tr);
      case 'toast':
        return this.hud.toast(m.text);
      case 'vision':
        return this.hud.showVision(m.lines);
      case 'ending':
        return this.hud.showEnding(m.cards, m.credits);
      case 'rankUp': {
        const a = m.name === this.myName ? this.me : this.others.get(m.name)?.actor;
        if (a instanceof Actor) a.flash(RANK_FLASH);
        if (m.name === this.myName) this.hud.showVision([rankUpText(m.rank)], 3000, false);
        return;
      }
      case 'hit':
        if (this.heart?.id === m.id) this.heart = { ...this.heart, hp: m.hp };
        this.structures.setHp(m.id, m.hp);
        return;
      case 'wrecked':
        this.structures.remove(m.id);
        for (let i = 0; i < 3; i++) this.colliders.remove(`s${m.id}:${i}`);
        if (this.stoneStructs.some((s) => s.id === m.id)) {
          this.stoneStructs = this.stoneStructs.filter((s) => s.id !== m.id);
          this.rebuildClimbables();
        }
        return;
      case 'error':
        return; // handled by Connection → onStatus
    }
  }

  private onWelcome(m: Extract<ServerMsg, { t: 'welcome' }>): void {
    this.myName = m.you;
    this.welcomed = true;
    if (this.seed !== m.seed) this.buildWorld(m.seed);
    const gone = new Set(m.gone);
    for (const s of this.spawns) this.setGone(s.id, gone.has(s.id));
    for (const s of m.structures) this.addStructure(s);
    for (const s of m.stalls ?? []) this.setStall(s, false);
    this.body = createBody(m.self.x, m.self.z, this.terrain!);
    this.body.y = m.self.y;
    this.serverTime = m.time;
    this.applySelf(m.self);
  }

  private buildWorld(seed: number): void {
    const t = TIERS[this.tier];
    this.seed = seed;
    this.escaleraUp = false;
    this.ending = false;
    const plain = withDungeon(createTerrain(seed));
    this.terrain = withLookout(withGrieta(withEscalera(plain, () => this.escaleraUp), () => this.ending), () => this.ending);
    this.spawns = generateResources(this.terrain, seed);
    this.resMeshes = new ResourceMeshes(this.spawns, t.shadows, this.tier === 'low' ? 1 : 2);
    this.crags = generateCrags(this.terrain, seed);
    const forest = generateShrines(this.terrain, seed, this.crags);
    this.shrines = [...forest, ...generateCoastShrines(this.terrain, seed), ...generateSwampShrines(this.terrain, seed), ...generateMountainShrines(this.terrain, seed)];
    this.ledges = corniceLedges(this.terrain, seed);
    this.quartzVeins = generateQuartzVeins(this.terrain, seed);
    this.quartzMeshes = new QuartzMeshes(this.quartzVeins);
    this.scene.add(this.quartzMeshes.group);
    this.entrance = generateEntrance(this.terrain, seed, this.crags, forest);
    this.chests = generateChests(this.terrain, seed);
    this.chestMeshes = new ChestMeshes(this.chests);
    this.scene.add(this.chestMeshes.group);
    this.amberTrees = generateAmberTrees(this.terrain, seed);
    this.amberMeshes = new AmberMeshes(this.amberTrees, t.shadows);
    this.scene.add(this.amberMeshes.group);
    this.fogataSpots = generateFogatas(this.terrain, seed);
    this.fogataMeshes = new FogataMeshes(this.fogataSpots);
    this.scene.add(this.fogataMeshes.group);
    this.dungeonMeshes = new DungeonMeshes(this.entrance, t.shadows);
    this.steedMeshes = new SteedMeshes(t.shadows);
    this.scene.add(this.steedMeshes.group);
    this.island = coastFeatures(seed).island;
    this.fishMeshes = new FishMeshes(t.shadows);
    this.raceRings = new RaceRings(fishRings(this.terrain, seed, wildFish(this.terrain, seed)));
    this.scene.add(this.fishMeshes.group, this.raceRings.group);
    this.frogMeshes = new FrogMeshes(t.shadows);
    this.lilyPads = new LilyPads(frogPads(this.terrain, seed, wildFrog(this.terrain, seed)));
    this.scene.add(this.frogMeshes.group, this.lilyPads.group);
    this.pico = picoOf(this.terrain, seed);
    this.dragonMeshes = new DragonMeshes(this.camera, this.pico);
    this.scene.add(this.dragonMeshes.group);
    this.whaleMesh = new WhaleMesh(t.shadows);
    this.scene.add(this.whaleMesh.group);
    this.scene.add(this.dungeonMeshes.group);
    this.coastDoor = coastEntrance(seed);
    this.coastMeshes = new CoastDungeonMeshes({ ...this.coastDoor, y: this.terrain.heightAt(this.coastDoor.x, this.coastDoor.z) }, t.shadows);
    this.scene.add(this.coastMeshes.group, this.gustFx.mesh);
    this.swampMeshes = new SwampDungeonMeshes({ ...this.swampDoor, y: this.terrain.heightAt(this.swampDoor.x, this.swampDoor.z) }, t.shadows);
    this.scene.add(this.swampMeshes.group, this.flameFx.mesh);
    this.caveMeshes = new MountainDungeonMeshes({ ...this.mountainDoor, y: this.terrain.heightAt(this.mountainDoor.x, this.mountainDoor.z) }, t.shadows);
    this.scene.add(this.caveMeshes.group);
    this.towerMeshes = new TowerDungeonMeshes(t.shadows);
    this.scene.add(this.towerMeshes.group);
    this.shrineMeshes = new ShrineMeshes(this.shrines, this.terrain, t.shadows, this.ledges);
    this.zones = allZones(this.terrain, seed, this.entrance);
    const [nearPatch, farPatch, swampPatch] = terrainPatches(t.terrainSegments);
    this.ground = buildTerrainMesh(this.terrain, nearPatch!);
    this.farGround = buildTerrainMesh(this.terrain, farPatch!); // far sea: coarse; tinted for the island/islet zones
    this.scene.add(this.farGround);
    this.swampGround = buildTerrainMesh(this.terrain, swampPatch!); // el Pantano: coarse, fogged
    this.scene.add(this.swampGround, buildThorns(this.terrain, seed));
    if (this.tier === 'high') for (const m of [this.ground, this.farGround, this.swampGround]) patchCaustics(m.material as THREE.Material); // V2-D
    const ground = this.terrain;
    this.mountainMeshes = mountainChunks(t.terrainSegments).map((chunk) => {
      const detail = buildTerrainMesh(ground, chunk.detail);
      const silhouette = buildTerrainMesh(ground, chunk.silhouette);
      detail.visible = false;
      this.scene.add(detail, silhouette);
      return { chunk, detail, silhouette };
    });
    this.scene.add(buildPines(this.terrain, seed, this.tier === 'low' ? 1 : 2));
    // S5-A: las Tierras Corruptas, 4 chunks like the mountains, all hidden from the south.
    this.corruptMeshes = corruptChunks(t.terrainSegments, corruptFeatures(seed).steps).map((chunk) => {
      const detail = buildTerrainMesh(ground, chunk.detail);
      const silhouette = buildTerrainMesh(ground, chunk.silhouette);
      detail.visible = false;
      this.corruptGroup.add(detail, silhouette);
      return { chunk, detail, silhouette };
    });
    this.corruptGroup.visible = false;
    this.scene.add(this.corruptGroup);
    this.pillarSpots = pillarSites(seed);
    this.pillarMeshes = new PillarMeshes(this.terrain, seed);
    this.corruptGroup.add(this.pillarMeshes.group);
    this.flechaLine.visible = false;
    this.scene.add(this.flechaLine);
    for (const mesh of [...this.rootLines, ...this.trailDiscs]) {
      mesh.visible = false;
      this.scene.add(mesh);
    }
    this.villainTower = new VillainTower(this.terrain);
    this.scene.add(this.villainTower.group);
    this.zarzalKnot = new ZarzalKnot(this.terrain);
    this.umbral = new UmbralMeshes(plain);
    this.scene.add(this.umbral.group);
    this.scene.add(this.zarzalKnot.group);
    this.corruptionMeshes = new CorruptionMeshes(this.zones, this.terrain);
    this.rescueSpot = rescueSite(this.terrain, seed);
    this.rescueMeshes = new RescueMeshes(this.rescueSpot, this.terrain);
    this.scene.add(this.rescueMeshes.group);
    this.corruptKey = '';
    this.heal = new HealWaves();
    this.scene.add(this.corruptionMeshes.group);
    this.life?.group.removeFromParent();
    this.life = new AmbientLife(this.terrain, seed, this.tier);
    this.scene.add(this.life.group);
    this.scene.add(this.ground, buildSea(this.terrain, seed, t), (this.grass = new GrassField(this.terrain, seed, t, this.tier)).group, this.resMeshes.group, buildCrags(this.crags, t.shadows), this.shrineMeshes.group);
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

  /** T6-A: a Puesto appeared, changed or was picked up. */
  private setStall(s: Stall, gone: boolean): void {
    if (gone) {
      this.stalls.delete(s.id);
      this.stallMeshes.remove(s.id);
      this.colliders.remove(`st${s.id}`);
      if (this.stallOpen === s.id) {
        this.stallOpen = null;
        this.hud.hideOverlay();
      }
      return;
    }
    this.stalls.set(s.id, s);
    this.colliders.add(`st${s.id}`, this.stallMeshes.set(s));
    if (this.stallOpen === s.id && this.hud.menuOpen) this.showStall(s.id);
  }

  /** T6-A: the owner's panel; each tap sends one message and waits for the `stall` event to redraw. */
  private showStall(id: number): void {
    const s = this.stalls.get(id);
    if (!s) return;
    this.stallOpen = id;
    this.merchantOpen = false;
    const inv = this.lastSelf?.inv ?? {};
    const actions: Record<string, () => void> = {
      back: () => {
        this.stallOpen = null;
        this.hud.hideOverlay();
      },
      pick: () => this.conn.send({ t: 'stallPick' }),
      till: () => this.conn.send({ t: 'stallTill' }),
    };
    if (s.owner !== this.myName) {
      // T6-B: someone else's Puesto: the buy panel.
      s.shelves.forEach((_, i) => {
        actions[`buy-${i}`] = () => this.conn.send({ t: 'buy', stall: id, shelf: i });
        actions[`deliver-${i}`] = () => this.conn.send({ t: 'deliver', stall: id, shelf: i });
      });
      return this.hud.showSkills(buyHtml(s, inv), actions);
    }
    s.shelves.forEach((sh, i) => {
      const set = (o: Partial<{ give: ItemId; n: number; want: ItemId; m: number }>) => {
        const give = o.give ?? sh.give;
        let want = o.want ?? sh.want;
        if (want === give) want = nextItem(want); // skip the same material
        this.conn.send({ t: 'stallSet', shelf: i, give, n: o.n ?? sh.n, want, m: o.m ?? sh.m });
      };
      const clamp = (v: number) => Math.max(1, Math.min(STALL.nMax, v));
      actions[`give-${i}`] = () => set({ give: nextItem(sh.give) });
      actions[`want-${i}`] = () => set({ want: nextItem(sh.want) });
      actions[`n-${i}-dec`] = () => set({ n: clamp(sh.n - 1) });
      actions[`n-${i}-inc`] = () => set({ n: clamp(sh.n + 1) });
      actions[`m-${i}-dec`] = () => set({ m: clamp(sh.m - 1) });
      actions[`m-${i}-inc`] = () => set({ m: clamp(sh.m + 1) });
      actions[`mode-${i}`] = () => this.conn.send({ t: 'stallSet', shelf: i, give: sh.give, n: sh.n, want: sh.want, m: sh.m, mode: sh.mode === 'want' ? 'sell' : 'want' });
      actions[`stock-${i}`] = () => this.conn.send({ t: 'stallStock', shelf: i });
      actions[`take-${i}`] = () => this.conn.send({ t: 'stallTake', shelf: i });
    });
    this.hud.showSkills(stallHtml(s, inv), actions);
  }

  /** T6-D: the Buhonero's table; redrawn when the tratos left change. */
  private showMerchant(): void {
    this.merchantOpen = true;
    const actions: Record<string, () => void> = {
      back: () => {
        this.merchantOpen = false;
        this.hud.hideOverlay();
      },
    };
    MERCHANT.deals.forEach((_, i) => (actions[`deal-${i}`] = () => this.conn.send({ t: 'deal', id: i })));
    this.hud.showSkills(merchantHtml(this.lastSelf?.inv ?? {}, this.lastSelf?.deals ?? MERCHANT.perDay), actions);
  }

  private addStructure(s: Structure): void {
    if (this.structures.has(s.id)) return;
    this.structures.add(s).forEach((c, i) => this.colliders.add(`s${s.id}:${i}`, c));
    if (s.kind === 'pillar' || s.kind === 'tower') {
      this.stoneStructs = [...this.stoneStructs, s];
      this.rebuildClimbables();
    }
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
    const padKey = m.shrines.filter((v) => this.shrines[v.id]?.kind === 'lilies').map((v) => v.parts.join()).join('|');
    if (padKey !== this.padKey) {
      this.padKey = padKey;
      this.rebuildClimbables();
    }
    this.dungeon = m.dungeon;
    const plankKey = m.dungeon.swamp.planks.join();
    if (plankKey !== this.plankKey) {
      this.plankKey = plankKey;
      this.rebuildClimbables();
    }
    this.swampMeshes?.sync(m.dungeon.swamp, this.hasFire);
    this.caveMeshes?.sync(m.dungeon.mountain, this.hasStone);
    if (m.dungeon.tower) this.towerMeshes?.sync(m.dungeon.tower);
    this.towerOpen = m.towerOpen ?? false;
    this.zarzalKnot?.sync(m.zarzalBurnt);
    if (m.escalera !== this.escaleraUp) {
      this.escaleraUp = m.escalera;
      this.rebuildMountains();
    }
    if ((m.ending ?? false) !== this.ending) {
      this.ending = m.ending ?? false;
      this.rebuildMountains(); // la Grieta
      this.villainTower?.setWhite(this.ending);
    }
    this.raidsOff = m.raidsOff ?? false;
    if (this.body) Object.assign(this.body, { grieta: this.ending, lookout: this.ending, star: this.hasStar });
    this.syncGuardian();
    this.umbral?.sync(m.escalera);
    this.fogatasLit = m.fogatas;
    this.fog = m.fog;
    this.towerH = m.towerH;
    this.villainTower?.setOpen(m.towerOpen ?? false);
    this.rayoIds = new Set(m.wolves.filter((w) => w.kind === 'rayo').map((w) => w.id));
    this.pillarView = m.pillars ?? null;
    if (m.pillars) {
      this.pillarMeshes?.sync(m.pillars);
      this.villainTower?.setCracks(m.pillars.broken);
    }
    this.fogataMeshes?.sync(m.fogatas);
    if (this.body) this.body.thornsOpen = m.zarzalBurnt;
    this.dungeonMeshes?.sync(m.dungeon, this.hasPower);
    this.coastMeshes?.sync(m.dungeon.coast, this.hasWind);
    this.hud.setBoss(bossBarText(m.dungeon) ?? eliteBarText(m.dungeon) ?? shieldBarText(m.dungeon.coast) ?? antenonBarText(m.dungeon.coast) ?? peatBarText(m.dungeon.swamp) ?? zancudoBarText(m.dungeon.swamp) ?? rockBarText(m.dungeon.mountain) ?? cucuruchoBarText(m.dungeon.mountain) ?? (m.dungeon.tower ? (finalBarText(m.dungeon.tower) ?? flechaBarText(m.dungeon.tower)) : null) ?? marchitoBarText(m.marchito));
    this.shrineMeshes?.sync(m.shrines, this.cleared);
    this.steeds = m.steeds;
    this.estrella = m.estrella ?? null;
    this.fishViews = m.fish;
    this.frogViews = m.frogs;
    this.dragonViews = m.dragons ?? [];
    this.whaleView = m.whale;
    const key = m.corrupt.join(',');
    if ((key !== this.corruptKey || this.ending !== this.healEnding) && this.ground) {
      this.corruptKey = key;
      this.healEnding = this.ending;
      this.lastCorrupt = m.corrupt;
      this.heal.sync(m.corrupt, this.ending, performance.now() / 1000); // V2-C: the shader paints corrupt zones; a cleansed one heals as a wave
      this.corruptionMeshes?.sync(m.corrupt);
    }
    if (!this.kits) return;
    for (const p of m.players) {
      const r = this.remote(this.others, p.name, () => new Actor(this.kits!.robot, PLAYER_CLIPS, p.name));
      r.buf.push({ t: m.time, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      r.anim = p.dead ? 'dead' : p.away ? 'idle' : p.ride || p.seat ? 'idle' : p.anim;
      r.ride = p.ride === 'deer' && !p.dead;
      r.star = !!p.star;
      r.fish = p.ride === 'fish' && !p.dead;
      r.frog = p.ride === 'frog' && !p.dead;
      r.dragon = p.ride === 'dragon' && !p.dead;
      r.seat = p.dead ? null : p.seat;
      r.whale = p.ride === 'whale' && !p.dead;
      r.seen = m.time;
      if (r.actor instanceof Actor) {
        r.actor.setCapa(p.capa);
        r.actor.setLook(p.look?.color ?? 0, p.look?.hat ?? 0);
      }
    }
    this.cage = m.cage ?? null;
    this.rescueMeshes?.sync(this.cage);
    this.anchorTargets = m.wolves.filter((w) => w.kind === 'anchor').map((w) => ({ id: w.id, x: w.x, z: w.z }));
    this.syncFlechaLine(m.wolves.find((w) => w.kind === 'lieut3' && w.aim));
    this.syncFinal(m.dungeon.tower.final);
    for (const w of m.wolves) {
      if (w.kind === 'anchor') continue; // drawn by RescueMeshes; still a target (see enemies())
      const r = this.remote(this.wolves, w.id, () =>
        w.kind === 'boss' ? new PaperActor(TRAGON_IMG, 4.5, this.camera) : w.kind === 'boss2' ? new PaperActor(ANTENON_IMG, 4, this.camera, ANTENON_ASPECT) : w.kind === 'marchito' ? new PaperActor(MARCHITO_IMG, MARCHITO.height, this.camera, 589 / 662) : w.kind === 'lieut1' ? new PaperActor(GATA_IMG, 2.6, this.camera, GATA_ASPECT) : w.kind === 'lieut2' ? new PaperActor(TRIANGULO_IMG, 2.8, this.camera, TRIANGULO_ASPECT) : w.kind === 'boss3' ? new PaperActor(ZANCUDO_IMG, 6 / ZANCUDO_ASPECT, this.camera, ZANCUDO_ASPECT) : w.kind === 'boss4' ? new PaperActor(CUCURUCHO_IMG, 5, this.camera, CUCURUCHO_ASPECT) : w.kind === 'rayo' ? new PaperActor(RAYO_IMG, 2, this.camera, RAYO_ASPECT) : w.kind === 'lieut3' ? new PaperActor(FLECHA_IMG, 3, this.camera, FLECHA_ASPECT) : w.kind === 'boss5' ? new PaperActor(MARCHITO_IMG, 9, this.camera, 589 / 662) : w.kind === 'brote' ? new PaperActor(MARCHITO_IMG, 2, this.camera, 589 / 662) : w.kind === 'core' ? new PaperActor(CORE_IMG, 2.5, this.camera, CORE_ASPECT) : new Actor(this.kits!.fox, WOLF_CLIPS),
      );
      // The rayo flashes white during its 0.8 s tell and goes pale when a gust grounds it (anim idle).
      if (w.kind === 'rayo' && r.actor instanceof PaperActor) r.actor.setTint(w.anim === 'attack' ? 0xffffff : w.anim === 'idle' ? 0xe8dca0 : 0xb48ad8);
      else if (w.kind === 'boss5' && r.actor instanceof PaperActor) {
        const f = m.dungeon.tower.final;
        r.actor.setTint(!f || f.phase === 3 ? 0x8a7a90 : f.phase === 2 ? 0x4a3a5a : f.stagger || f.bare ? 0xe0c8f0 : f.catching ? 0xff9a5a : f.swipe ? 0xff7a8a : f.green ? 0x6a9a5a : 0x6a4a7c);
      } else if (w.kind === 'brote' && r.actor instanceof PaperActor) {
        const i = (FINAL.broteIds as readonly number[]).indexOf(w.id);
        const open = m.dungeon.tower.final?.brotes[i]?.open;
        r.actor.setTint(open ? 0xffffff : (BROTE_TINT[i] ?? 0xffffff));
      } else if (w.kind === 'core' && r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.tower.final?.core?.stopped ? 0xffe9a0 : m.dungeon.tower.final?.core?.healing ? 0xff6a6a : 0xffffff);
      else if (w.kind === 'marchito' && r.actor instanceof PaperActor) r.actor.setTint(m.marchito?.laughing ? 0xb89ac8 : 0x7a5a8c);
      else if ((w.kind === 'lieut1' || w.kind === 'lieut2') && r.actor instanceof PaperActor) r.actor.setTint(0xffffff);
      else if (w.kind === 'lieut3' && r.actor instanceof PaperActor) r.actor.setTint(w.stuck ? 0xffe9a0 : w.aim ? 0xffb0a0 : 0xffffff);
      else if (w.kind === 'boss3' && r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.swamp.boss?.grounded ? 0xffe9a0 : 0xffffff);
      else if (w.kind === 'boss4' && r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.mountain.boss?.stuck ? 0xffe9a0 : m.dungeon.mountain.boss?.windup ? 0xff9a8a : 0xffffff);
      else if (w.kind === 'boss2' && r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.coast.boss?.exposed ? 0xffe9a0 : 0xffffff);
      else if (r.actor instanceof PaperActor) r.actor.setTint(m.dungeon.boss?.weak ? 0x9fc4ff : 0xffffff);
      else if (w.kind === 'elite2' && !r.actor.root.getObjectByName('shield')) {
        // The bruto escudado: the elite's size plus a sea-blue board in front.
        r.actor.root.scale.setScalar(2.4);
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), new THREE.MeshLambertMaterial({ color: 0x3a6f9a }));
        board.name = 'shield';
        board.position.set(0, 0.45, 0.5);
        r.actor.root.add(board);
      } else if (w.kind === 'elite3' && !r.actor.root.getObjectByName('peat')) {
        // The bruto de turba: the elite's size under a mantle of wet peat.
        r.actor.root.scale.setScalar(2.4);
        const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.9), new THREE.MeshLambertMaterial({ color: 0x4a4a26 }));
        mantle.name = 'peat';
        mantle.position.set(0, 0.62, -0.05);
        r.actor.root.add(mantle);
      } else if (w.kind === 'elite4' && !r.actor.root.getObjectByName('slab')) {
        // The bruto de roca: the elite's size behind a grey stone slab.
        r.actor.root.scale.setScalar(2.4);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.12), new THREE.MeshLambertMaterial({ color: 0x8a8c86, flatShading: true }));
        slab.name = 'slab';
        slab.position.set(0, 0.45, 0.5);
        r.actor.root.add(slab);
      } else if (w.kind !== 'elite2' && w.kind !== 'elite3' && w.kind !== 'elite4') r.actor.root.scale.setScalar(w.kind === 'elite' ? 2.4 : w.kind === 'brute' ? 1.8 : w.raid ? 1.3 : 1);
      this.burnMark(r.actor.root, !!w.burning);
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
    if (m.ally2) {
      const a = m.ally2;
      const r = this.remote(this.allies, 1, () => {
        const paper = new PaperActor(ANTENON_IMG, 1.6, this.camera, ANTENON_ASPECT);
        paper.setTint(0xf2fff0); // purified: pale paper
        return paper;
      });
      if (r.actor instanceof PaperActor) r.actor.setTint(a.anim === 'attack' ? 0xffffff : 0xe6f4ff);
      if (a.anim === 'attack' && r.anim !== 'attack') this.gustFx.play(a.x, a.y, a.z, a.yaw);
      r.buf.push({ t: m.time, x: a.x, y: a.y, z: a.z, yaw: a.yaw });
      r.anim = a.anim;
      r.seen = m.time;
    }
    if (m.ally3) {
      const a = m.ally3;
      const r = this.remote(this.allies, 2, () => {
        const paper = new PaperActor(ZANCUDO_IMG, 1.6, this.camera, ZANCUDO_ASPECT);
        paper.setTint(0xf2fff0); // purified: pale paper
        return paper;
      });
      if (!this.farolGlow) {
        this.farolGlow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd070, fog: false }));
        this.scene.add(this.farolGlow);
      }
      this.farolGlow.visible = true;
      this.farolGlow.position.set(a.x, a.y + 2.1, a.z);
      this.farolGlow.scale.setScalar(a.anim === 'attack' ? 2.2 : 1);
      r.buf.push({ t: m.time, x: a.x, y: a.y, z: a.z, yaw: a.yaw });
      r.anim = a.anim;
      r.seen = m.time;
    } else if (this.farolGlow) this.farolGlow.visible = false;
    if (m.ally4) {
      const a = m.ally4;
      const r = this.remote(this.allies, 3, () => {
        const paper = new PaperActor(CUCURUCHO_IMG, 1.6, this.camera, CUCURUCHO_ASPECT);
        paper.setTint(0xf2fff0); // purified: pale paper
        return paper;
      });
      if (r.actor instanceof PaperActor) r.actor.setTint(a.anim === 'attack' ? 0xffffff : 0xf2fff0);
      if (!this.atalaya) {
        this.atalaya = buildAtalaya();
        this.scene.add(this.atalaya);
      }
      this.atalaya.visible = true;
      this.atalaya.position.set(a.x, a.y, a.z);
      r.buf.push({ t: m.time, x: a.x, y: a.y + ATALAYA.height, z: a.z, yaw: a.yaw });
      r.anim = a.anim;
      r.seen = m.time;
    } else if (this.atalaya) this.atalaya.visible = false;
    // T6-D: el Buhonero: the Tragón's paper, tinted like a traveller.
    this.merchantSpot = m.merchant ?? null;
    if (m.merchant) {
      const a = m.merchant;
      const r = this.remote(this.allies, 20, () => {
        const paper = new PaperActor(TRAGON_IMG, 1.5, this.camera);
        paper.setTint(0xffd9a8);
        return paper;
      });
      r.buf.push({ t: m.time, x: a.x, y: this.terrain?.heightAt(a.x, a.z) ?? 0, z: a.z, yaw: 0 });
      r.anim = 'idle';
      r.seen = m.time;
    }
    if (this.merchantOpen && this.hud.menuOpen && m.self.deals !== this.lastSelf?.deals) queueMicrotask(() => this.showMerchant());
    // S5-E: the white allies on their tower floors (pale paper; the Zancudo carries its farol).
    let farol = false;
    for (const a of m.dungeon.tower?.allies ?? []) {
      const [img, aspect] = a.kind === 'tragon' ? [TRAGON_IMG, undefined] : a.kind === 'antenon' ? [ANTENON_IMG, ANTENON_ASPECT] : a.kind === 'zancudo' ? [ZANCUDO_IMG, ZANCUDO_ASPECT] : [CUCURUCHO_IMG, CUCURUCHO_ASPECT];
      const r = this.remote(this.allies, 10 + ['tragon', 'antenon', 'zancudo', 'cucurucho'].indexOf(a.kind), () => {
        const paper = new PaperActor(img, 1.6, this.camera, aspect);
        paper.setTint(0xf2fff0);
        return paper;
      });
      if (a.kind === 'zancudo') {
        farol = true;
        if (!this.towerFarol) {
          this.towerFarol = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd070, fog: false }));
          this.scene.add(this.towerFarol);
        }
        this.towerFarol.position.set(a.x, a.y + 2.1, a.z);
      }
      r.buf.push({ t: m.time, x: a.x, y: a.y, z: a.z, yaw: a.yaw });
      r.anim = a.anim;
      r.seen = m.time;
    }
    if (this.towerFarol) this.towerFarol.visible = farol;
    const b2 = m.wolves.find((w) => w.kind === 'boss2');
    this.coastMeshes?.telegraph(m.dungeon.coast.boss?.tell ?? null, b2 ? { x: b2.x, z: b2.z, yaw: b2.yaw } : null);
    for (const map of [this.others, this.wolves, this.allies] as Map<unknown, Remote>[]) {
      for (const [k, r] of map) {
        if (r.seen === m.time) continue;
        r.actor.dispose();
        map.delete(k);
      }
    }
  }

  /** A small flame over a burning enemy (one shared material, created on first need). */
  private burnMark(root: THREE.Object3D, on: boolean): void {
    let f = root.getObjectByName('burn');
    if (!f && !on) return;
    if (!f) {
      f = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), BURN_MAT);
      f.name = 'burn';
      f.position.set(0, 1.1 / Math.max(root.scale.y, 0.5), 0);
      root.add(f);
    }
    f.visible = on;
  }

  /** La Escalera del Umbral changes the terrain: redraw the mountain chunks once (cheap, rare). */
  private rebuildMountains(): void {
    const t = this.terrain;
    if (!t) return;
    for (const m of [...this.mountainMeshes, ...this.corruptMeshes]) {
      for (const [mesh, patch] of [[m.detail, m.chunk.detail], [m.silhouette, m.chunk.silhouette]] as const) {
        const fresh = buildTerrainMesh(t, patch);
        mesh.geometry.dispose();
        mesh.geometry = fresh.geometry;
        (fresh.material as THREE.Material).dispose();
      }
    }
  }

  private rebuildClimbables(): void {
    const wrapped = new Set(this.vines.map((v) => v.id));
    const bare = this.shrines.flatMap((s) => (s.pillar && !wrapped.has(s.pillar.id) ? [s.pillar] : []));
    // Nenúfares' pads afloat and the amber stumps: stand on them, never climb them (bare).
    const pads = this.shrines.flatMap((s) => (s.kind === 'lilies' ? lilyPadCrags(s, this.shrineViews.find((v) => v.id === s.id)?.parts ?? s.parts.map(() => true)) : []));
    const stumps = this.amberTrees.flatMap((t) => (t.stump ? [t.stump] : []));
    const planks = plankCrags(this.dungeon.swamp.planks);
    this.climbList = [...this.crags, ...bare, ...this.vines, ...pads, ...stumps, ...planks, ...this.ledges, shelfCrag(), towerShelfCrag(), ...columnCrags(), ...structureCrags(this.stoneStructs)];
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
      r = { actor: make(), buf: new InterpBuffer(), anim: 'idle', seen: 0, ride: false, fish: false, frog: false, dragon: false, seat: null, whale: false, speed: 0 };
      this.scene.add(r.actor.root);
      map.set(key, r);
    }
    return r;
  }

  private applySelf(self: Extract<ServerMsg, { t: 'snap' }>['self']): void {
    this.hud.setVitals(self.vitals);
    this.hud.setInventory(self.inv, self.weapon, self.capa, rankLine(self.xp ?? 0, self.rank ?? 1));
    this.skills = self.skills ?? [];
    this.look = self.look ?? { color: 0, hat: 0 };
    this.hats = self.hats ?? [];
    this.lastSelf = self;
    this.rank = self.rank ?? 1;
    if (this.body) this.body.skills = this.skills;
    this.regrowing = self.amber;
    this.amber = self.inv.amber ?? 0;
    this.capa = self.capa;
    this.torch = self.torch;
    if (self.travel !== null && self.travel !== this.travelLeft) this.hud.toast(`Viajando… ${self.travel} s`);
    this.travelLeft = self.travel;
    this.amberMeshes?.sync(self.amber);
    this.quartzRegrowing = self.quartz;
    this.quartzMeshes?.sync(self.quartz);
    this.quartz = self.inv.quartz ?? 0;
    this.thorn = self.inv.thorn ?? 0;
    this.cleared = self.shrines;
    this.opened = self.chests;
    this.weapon = self.weapon;
    this.pearls = self.inv.pearl ?? 0;
    this.chestMeshes?.sync(self.chests);
    this.hasPower = self.power;
    this.hasWind = self.viento;
    this.windLeft = self.windLeft;
    this.hasFire = self.fuego;
    this.fireLeft = self.fireLeft;
    this.hasStone = self.piedra;
    this.stoneLeft = self.stoneLeft;
    const owns = { enredadera: self.power, viento: self.viento, fuego: self.fuego, piedra: self.piedra };
    if (!owns[this.powerKind] && owns[nextPower(this.powerKind, owns)]) {
      this.powerKind = nextPower(this.powerKind, owns); // e.g. Viento first: the pill follows what you own
      this.touch?.setPowerIcon(POWER_ICON[this.powerKind]);
    }
    this.tame = self.tame;
    this.riding = self.riding;
    this.seat = self.seat;
    this.hasSteed = self.steed;
    this.hasStar = self.star ?? false;
    this.hasFish = self.fish;
    this.onFish = self.onFish;
    this.race = self.race;
    this.hasFrog = self.frog;
    this.onFrog = self.onFrog;
    this.hasDragon = self.dragon;
    this.onDragon = self.onDragon;
    this.whaleSeat = self.whaleSeat;
    if (this.body) this.body.whale = self.whaleSeat === 0;
    if (this.body) this.body.riding = self.riding;
    if (this.body) this.body.fish = self.onFish ? this.island : null;
    if (this.body) this.body.frog = self.onFrog;
    if (this.body) this.body.dragon = self.onDragon;
    if (this.body) this.body.staminaMax = staminaFor(self.shrines.length);
    if (self.fix && this.body) {
      Object.assign(this.body, { x: self.x, y: self.y, z: self.z, vx: 0, vz: 0, vy: 0, climb: null, wall: false, gliding: false });
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
        trap: TRAP_LABEL[this.trap],
        fogatas: fogataTargets(this.fogatasLit, this.atHeart()),
        onFogata: (id: number) => this.conn.send({ t: 'travel', to: id }),
        calls: this.body ? fogataCalls(this.body, this.fogataSpots, this.fogatasLit, { deer: this.hasSteed, frog: this.hasFrog, fish: this.hasFish }, hasSkill(this.body, 'silbido')).map((beast) => ({ beast, label: CALL_LABEL[beast] })) : [],
        onCall: (beast: string) => {
          if (beast === 'deer' || beast === 'frog' || beast === 'fish') this.conn.send({ t: 'call', beast });
        },
        raids: raidsMenu(this.ending, this.atHeart(), this.raidsOff),
        onSkills: () => this.showSkills(null),
        onLook: () => this.showLook(),
        onBook: () => this.showBook(),
        stall: [...this.stalls.values()].some((s) => s.owner === this.myName) ? undefined : `Poner ${NAMES.stall.toLowerCase()} (8 madera, 4 piedra)`,
        onStall: () => this.placeStall(),
        onStalls: this.stalls.size ? () => this.hud.showSkills(stallListHtml([...this.stalls.values()], this.body ?? { x: 0, z: 0 }), { back: () => this.hud.hideOverlay() }) : undefined,
        tripSecs: hasSkill(this.body ?? undefined, 'fogatero') ? SKILL_FX.channel : undefined,
        onRaids: (on: boolean) => this.conn.send({ t: 'raids', on }),
        onTrap: () => {
          this.trap = nextTrap(this.trap, this.hasFire, this.hasStone);
          this.hud.toast(`Trampa: ${TRAP_LABEL[this.trap]}`);
        },
      });
    }
    if (this.dead || !this.body || this.hud.menuOpen) return;
    if (a === 'camera') return this.rig.toggle();
    if (a === 'eat') return this.conn.send({ t: 'eat' });
    if (a === 'campfire' || a === 'wall' || a === 'heart' || a === 'spikes') return this.place(a);
    if (a === 'net') return this.place('roots');
    if (a === 'fire') return this.place('fire');
    if (a === 'tower') return this.place('tower');
    if (a === 'trap') return this.place(this.trap);
    if (a === 'roll') return this.roll();
    if (a === 'lock') return this.toggleLock();
    if (a === 'bow') return this.shoot();
    if (a === 'power') return this.power();
    if (a === 'switch') return this.switchPower();
    if (a === 'mount') {
      const ma = this.mountAct();
      if (ma?.act === 1) return this.tapRing();
      if (ma) return this.conn.send({ t: 'mount', act: ma.act });
      return this.hud.toast(this.onFish ? 'Aquí es hondo. Acércate a la orilla' : this.hasSteed ? 'Tu ciervo no está cerca' : 'Aún no tienes montura');
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
    return [...out, ...this.anchorTargets];
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
    if (this.onDragon && !b.onGround) {
      // S5-D: in the air the attack is a claw at a rayo, and nothing else.
      const foes = [...this.rayoIds].flatMap((id) => {
        const p = this.wolves.get(id)?.actor.root.position;
        return p ? [{ id, kind: 'rayo', x: p.x, y: p.y, z: p.z }] : [];
      });
      const id = clawPick({ x: b.x, y: b.y, z: b.z }, foes);
      this.attackUntil = performance.now() + 450;
      if (id !== null) return this.conn.send({ t: 'attack', id });
      return this.hud.toast('Zarpazo al aire. Solo alcanzas a los rayos');
    }
    const fallen = this.fallenMate();
    if (fallen) return this.conn.send({ t: 'revive', name: fallen });
    const sp = this.shrinePart();
    if (sp) return this.conn.send({ t: 'shrine', id: sp.id, part: sp.part });
    const da = dungeonAction(b, this.entrance, this.dungeon, this.hasPower, this.myName) ?? coastDungeonAction(b, this.coastDoor, this.dungeon.coast, this.hasWind) ?? swampDungeonAction(b, this.swampDoor, this.dungeon.swamp, this.hasFire) ?? mountainDungeonAction(b, this.mountainDoor, this.dungeon.mountain, this.hasStone) ?? towerDungeonAction(b, this.towerDoor, this.towerOpen, this.dungeon.tower.final, this.ending);
    if (da) return this.conn.send({ t: 'dungeon', act: da.act });
    const ca = this.coastAct();
    if (ca?.t === 'chest') return this.conn.send({ t: 'chest', id: ca.id });
    const sa = this.swampAct();
    if (sa?.t === 'amber') return this.conn.send({ t: 'amber', id: sa.id });
    const qa = this.quartzAct();
    if (qa) return this.conn.send({ t: 'quartz', id: qa.id });
    const fa = this.fogataAct();
    if (fa?.t === 'fogata') return this.conn.send({ t: 'fogata', id: fa.id });
    if (fa?.t === 'travel') return this.conn.send({ t: 'travel', to: 'heart' });
    if (fa?.t === 'hint') return this.hud.toast(fa.label);
    if (this.rescueAct()) return this.conn.send({ t: 'rescue' });
    const pa = this.pillarAct();
    if (pa) return this.conn.send({ t: 'pillar', id: pa.id });
    if (this.guardianAct()) return this.hud.toast(guardianLine(this.guardianSays++));
    this.attackUntil = performance.now() + 450;
    const locked = this.lockId !== null ? this.enemies().find((e) => e.id === this.lockId) : undefined;
    if (locked && Math.hypot(locked.x - b.x, locked.z - b.z) <= PUNCH.reach) {
      this.face(locked);
      return this.conn.send({ t: 'attack', id: locked.id });
    }
    let best: { id: number; d: number } | null = null;
    for (const e of this.enemies()) {
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d <= PUNCH.reach && (!best || d < best.d)) best = { id: e.id, d };
    }
    if (best) return this.conn.send({ t: 'attack', id: best.id });
    if (ma) return this.conn.send({ t: 'mount', act: ma.act });
    if (this.canTend()) return this.conn.send({ t: 'tend', id: this.heart!.id });
    if (ca?.t === 'upgrade') return this.conn.send({ t: 'upgrade' });
    if (sa?.t === 'capa') return this.conn.send({ t: 'capa' });
    const st = stallAction(b, [...this.stalls.values()], this.myName);
    if (st) {
      this.releaseInputs();
      if (document.pointerLockElement) document.exitPointerLock();
      return this.showStall(st.s.id);
    }
    if (merchantAction(b, this.merchantSpot)) {
      this.releaseInputs();
      if (document.pointerLockElement) document.exitPointerLock();
      this.stallOpen = null;
      return this.showMerchant();
    }
    const res = this.nearestResource();
    if (res) return this.conn.send({ t: 'harvest', id: res.id });
    // T6-C: nothing else under A: Cambiar with the nearest player.
    const to = tradeTarget(b, [...this.others].map(([name, r]) => ({ name, x: r.actor.root.position.x, z: r.actor.root.position.z, down: r.anim === 'dead' })));
    if (to && !this.trade) this.conn.send({ t: 'tradeAsk', to });
  }

  /** T6-C: the trade window follows the server; null closes it. */
  private setTrade(tr: TradeView | null): void {
    const was = this.trade;
    this.trade = tr;
    if (!tr) {
      if (was && this.stallOpen === null && this.hud.menuOpen) this.hud.hideOverlay();
      return;
    }
    this.stallOpen = null;
    this.merchantOpen = false;
    this.releaseInputs();
    if (document.pointerLockElement) document.exitPointerLock();
    const inv = this.lastSelf?.inv ?? {};
    const offer = (lines: TradeLine[] | null) => lines && this.conn.send({ t: 'tradeOffer', lines });
    const actions: Record<string, () => void> = {
      yes: () => this.conn.send({ t: 'tradeAnswer', yes: true }),
      no: () => this.conn.send({ t: 'tradeAnswer', yes: false }),
      cancel: () => this.conn.send({ t: 'tradeCancel' }),
      ok: () => this.conn.send({ t: 'tradeOk' }),
      add: () => offer(addLine(tr.mine, inv)),
    };
    tr.mine.forEach((_, i) => {
      actions[`dec-${i}`] = () => offer(bumpLine(tr.mine, i, -1, inv));
      actions[`inc-${i}`] = () => offer(bumpLine(tr.mine, i, 1, inv));
      actions[`item-${i}`] = () => offer(cycleLine(tr.mine, i, inv));
      actions[`del-${i}`] = () => offer(tr.mine.filter((__, j) => j !== i));
    });
    this.hud.showSkills(tradeHtml(tr, inv), actions);
  }

  private mountAct(): { act: number; label: string } | null {
    const b = this.body;
    if (!b || this.dead) return null;
    const seated = new Set([...this.others.values()].flatMap((r) => (r.seat ? [r.seat] : [])));
    const landed = (r: Remote) => !!this.terrain && r.actor.root.position.y - DRAGON.height <= Math.max(this.terrain.heightAt(r.actor.root.position.x, r.actor.root.position.z), WATER_LEVEL) + 1.5;
    const riders = [...this.others].flatMap(([name, r]) => (r.ride || (r.dragon && landed(r)) ? [{ name, x: r.actor.root.position.x, z: r.actor.root.position.z, full: seated.has(name) }] : []));
    const pico = this.pico;
    const onPico = !!pico && Math.hypot(b.x - pico.x, b.z - pico.z) <= DRAGON.rim && b.y >= pico.top - 2;
    const shallow = !!this.terrain && depthAt(this.terrain, b.x, b.z) < FISH.shore;
    return mountAction({ pos: b, tame: this.tame, riding: this.riding, hasSteed: this.hasSteed, steeds: this.steeds, me: this.myName, seat: this.seat, riders, hasFish: this.hasFish, onFish: this.onFish, racing: !!this.race, shallow, fishes: this.fishViews, hasFrog: this.hasFrog, onFrog: this.onFrog, frogs: this.frogViews, whale: this.whaleView, whaleSeat: this.whaleSeat, hasDragon: this.hasDragon, onDragon: this.onDragon, landed: b.onGround, onPico, dragons: this.dragonViews, hasStar: this.hasStar, estrella: this.estrella });
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
      if (d <= REVIVE.reach * (hasSkill(b, 'amiga') ? SKILL_FX.reviveReach : 1) && (!best || d < best.d)) best = { name, d };
    }
    return best?.name ?? null;
  }

  /** Lever, wheel or pumice block within reach (part ≥ 1), or an orb you have not taken yet (part 0). The server re-checks. */
  private shrinePart(): { id: number; part: number; open: boolean; label: string } | null {
    return shrinePartAt(this.shrines, this.shrineViews, this.cleared, this.body!, this.myName, this.torch);
  }

  /** The root cage within reach while the Tragón is taken. */
  /** S5-F: El Marchito's root lines (violet strips while told) and el Corazón Negro's trail. */
  private syncFinal(f: FinalView | null): void {
    const y = TOWER_DUNGEON.floor + 0.12;
    this.rootLines.forEach((mesh, i) => {
      const l = f?.lines[i];
      mesh.visible = !!l;
      if (!l) return;
      const dx = l.x1 - l.x0;
      const dz = l.z1 - l.z0;
      mesh.scale.set(1, 1, Math.max(0.5, Math.hypot(dx, dz)));
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.position.set((l.x0 + l.x1) / 2, y, (l.z0 + l.z1) / 2);
    });
    const trail = f?.trail ?? [];
    this.trailDiscs.forEach((mesh, i) => {
      const t = trail[trail.length - 1 - i];
      mesh.visible = !!t;
      if (t) mesh.position.set(t.x, y - 0.02, t.z);
    });
  }

  /** La Flecha's clavada: a red strip on the ground from her to where the dash ends. */
  private syncFlechaLine(w: { x: number; z: number; aim?: { x: number; z: number } } | undefined): void {
    const line = this.flechaLine;
    if (!w?.aim || !this.terrain) {
      line.visible = false;
      return;
    }
    const dx = w.aim.x - w.x;
    const dz = w.aim.z - w.z;
    const mx = (w.x + w.aim.x) / 2;
    const mz = (w.z + w.aim.z) / 2;
    line.visible = true;
    line.scale.set(1, 1, Math.max(0.5, Math.hypot(dx, dz)));
    line.rotation.y = Math.atan2(dx, dz);
    line.position.set(mx, this.terrain.heightAt(mx, mz) + 0.25, mz);
  }

  /** A Pilar-raíz core within reach (S5-C). */
  private pillarAct(): { id: number; label: string } | null {
    const b = this.body;
    if (!b || this.dead || !this.pillarSpots) return null;
    return pillarAction(b, this.pillarSpots, this.pillarView);
  }

  private rescueAct(): { label: string } | null {
    const b = this.body;
    if (!b || this.dead || !this.rescueSpot) return null;
    return rescueAction(b, this.rescueSpot.cage, this.cage);
  }

  /** A sunken chest within reach, or the weapon upgrade at the Heart. */
  private coastAct(): ReturnType<typeof coastAction> {
    const b = this.body;
    if (!b || this.dead) return null;
    const h = this.heart && this.structures.position(this.heart.id);
    return coastAction({ pos: b, chests: this.chests, opened: this.opened, heart: h ? { x: h.x, z: h.z } : null, pearls: this.pearls, weapon: this.weapon, quartz: this.quartz, thorn: this.thorn });
  }

  /** A swamp fogata within reach (light it, or go back to the Heart). */
  private fogataAct(): ReturnType<typeof fogataAction> {
    const b = this.body;
    if (!b || this.dead) return null;
    return fogataAction(b, this.fogataSpots, this.fogatasLit, this.torch);
  }

  /** P4-D: the Libro; its buttons open Oficios and Aspecto. */
  private showBook(): void {
    const s = this.lastSelf;
    if (!s?.book) return;
    const html = bookHtml({
      xp: s.xp ?? 0,
      rank: s.rank ?? 1,
      weapon: s.weapon,
      capa: s.capa,
      shrines: s.shrines.length,
      chests: s.chests.length,
      powers: { enredadera: s.power, viento: s.viento, fuego: s.fuego, piedra: s.piedra },
      mounts: { steed: s.steed, star: s.star ?? false, fish: s.fish, frog: s.frog, dragon: s.dragon },
      book: s.book,
    });
    this.hud.showSkills(html, { back: () => this.hud.hideOverlay(), skills: () => this.showSkills(null), look: () => this.showLook() });
  }

  /** P4-C: the Aspecto panel. Taps apply at once (the server re-checks the hat) and the panel redraws. */
  private showLook(): void {
    const send = (color: number, hat: number) => {
      this.conn.send({ t: 'look', color, hat });
      if (hat === 0 || this.hats.includes(hat)) this.look = { color, hat };
      this.showLook();
    };
    const actions: Record<string, () => void> = { back: () => this.hud.hideOverlay() };
    for (let i = 0; i < COLORS.length; i++) actions[`color-${i}`] = () => send(i, this.look.hat);
    for (let h = 0; h <= HAT_IDS.length; h++) actions[`hat-${h}`] = () => send(this.look.color, h);
    this.hud.showSkills(lookHtml(this.look, this.hats), actions);
  }

  /** P4-B: the Oficios panel; tapping a oficio re-draws it with its line. The server re-checks everything. */
  private showSkills(chosen: SkillId | null): void {
    const actions: Record<string, () => void> = {
      back: () => this.hud.hideOverlay(),
      forget: () => {
        this.conn.send({ t: 'forget' });
        this.hud.hideOverlay();
      },
      ...(chosen ? { learn: () => { this.conn.send({ t: 'learn', id: chosen }); this.hud.hideOverlay(); } } : {}),
    };
    for (const id of SKILL_IDS) actions[`skill-${id}`] = () => this.showSkills(id);
    this.hud.showSkills(skillsHtml(this.rank, this.skills, this.atHeart(), chosen), actions);
  }

  /** Standing at the Heart (for the Menú's fogata list). */
  private atHeart(): boolean {
    const b = this.body;
    const h = this.heart && this.structures.position(this.heart.id);
    return !!b && !!h && Math.hypot(h.x - b.x, h.z - b.z) <= HEART.tendReach;
  }

  /** A ripe amber tree within reach, or a Capa level at the Heart. */
  private swampAct(): ReturnType<typeof swampAction> {
    const b = this.body;
    if (!b || this.dead) return null;
    const h = this.heart && this.structures.position(this.heart.id);
    return swampAction({ pos: b, trees: this.amberTrees, regrowing: this.regrowing, heart: h ? { x: h.x, z: h.z } : null, amber: this.amber, capa: this.capa, thorn: this.thorn });
  }

  /** A quartz vein we are up beside (S4-C). */
  private quartzAct(): ReturnType<typeof quartzAction> {
    const b = this.body;
    if (!b || this.dead) return null;
    return quartzAction(b, this.quartzVeins, this.quartzRegrowing);
  }

  /** A bare shrine rock beside us, if any (Enredadera wraps it instead of growing a new vine). */
  private bareRockNear(): Crag | undefined {
    const b = this.body!;
    return this.climbList.find((c) => c.bare && Math.hypot(c.x - b.x, c.z - b.z) < c.r + 3);
  }

  private switchPower(): void {
    const owns = { enredadera: this.hasPower, viento: this.hasWind, fuego: this.hasFire, piedra: this.hasStone };
    const next = nextPower(this.powerKind, owns);
    if (next === this.powerKind) return this.hud.toast(owns[next] ? 'Solo tienes un poder' : 'Aún no tienes ningún poder');
    this.powerKind = next;
    this.touch?.setPowerIcon(POWER_ICON[next]);
    this.hud.toast(`Poder: ${{ enredadera: NAMES.powerVine, viento: NAMES.powerWind, fuego: NAMES.powerFire, piedra: NAMES.powerStone }[next]} ${POWER_ICON[next]}`);
  }

  private power(): void {
    const b = this.body!;
    if (this.powerKind === 'piedra') {
      // Aim ahead; the server snaps the pillar 4 m out on its 2 m grid.
      const x = b.x + Math.sin(b.facing) * PIEDRA.ahead;
      const z = b.z + Math.cos(b.facing) * PIEDRA.ahead;
      if (this.hasStone && this.stoneLeft === 0) this.stoneLeft = PIEDRA.cooldown; // until the next snap says otherwise
      return this.conn.send({ t: 'power', x: r2(x), z: r2(z), kind: 'piedra' });
    }
    if (this.powerKind === 'fuego') {
      const x = b.x + Math.sin(b.facing) * 2.5;
      const z = b.z + Math.cos(b.facing) * 2.5;
      if (this.hasFire && this.fireLeft === 0) {
        this.flameFx.play(b.x, b.y, b.z, b.facing);
        this.fireLeft = FUEGO.cooldown; // until the next snap says otherwise
      }
      return this.conn.send({ t: 'power', x: r2(x), z: r2(z), kind: 'fuego' });
    }
    if (this.powerKind === 'viento') {
      const x = b.x + Math.sin(b.facing) * 2.5;
      const z = b.z + Math.cos(b.facing) * 2.5;
      if (this.hasWind && this.windLeft === 0) {
        boost(b); // gliding: the gust lifts you (the server allows it once per flight)
        this.gustFx.play(b.x, b.y, b.z, b.facing);
        this.windLeft = VIENTO.cooldown; // until the next snap says otherwise
      }
      return this.conn.send({ t: 'power', x: r2(x), z: r2(z), kind: 'viento' });
    }
    const rock = this.bareRockNear();
    const x = rock ? rock.x : b.x + Math.sin(b.facing) * 2.5;
    const z = rock ? rock.z : b.z + Math.cos(b.facing) * 2.5;
    this.conn.send({ t: 'power', x: r2(x), z: r2(z) });
  }

  /** Where the Heart stands (for el Guardián), if it does. */
  private heartSpot(): { x: number; z: number } | null {
    const h = this.heart && this.structures.position(this.heart.id);
    return h ? { x: h.x, z: h.z } : null;
  }

  private guardianAct(): { label: string } | null {
    return this.body && !this.dead ? guardianAction(this.body, this.heartSpot(), this.ending) : null;
  }

  /** S5-G: El Marchito purified, a 3 m paper 8 m east of the Heart (no server state: he just stands there). */
  private syncGuardian(): void {
    const h = this.heartSpot();
    if (!this.ending || !h || !this.terrain) {
      if (this.guardian) this.guardian.root.visible = false;
      return;
    }
    if (!this.guardian) {
      this.guardian = new PaperActor(GUARDIAN_IMG, ENDING.guardian.h, this.camera, GUARDIAN_ASPECT);
      this.scene.add(this.guardian.root);
    }
    const g = guardianSpot(h);
    this.guardian.root.visible = true;
    this.guardian.setPose(g.x, this.terrain.heightAt(g.x, g.z), g.z, -Math.PI / 2);
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

  /** T6-A: the Puesto goes 2,5 m in front, like a structure. */
  private placeStall(): void {
    const b = this.body;
    if (!b || this.dead) return;
    this.conn.send({ t: 'stallPlace', x: r2(b.x + Math.sin(b.facing) * 2.5), z: r2(b.z + Math.cos(b.facing) * 2.5), rot: r2(b.facing) });
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
    const raw = this.timer.getDelta();
    const dt = Math.min(raw, 0.1);
    const b = this.body;
    const terrain = this.terrain;
    if (!b || !terrain) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.watchFps(raw);
    this.serverTime += dt;
    const stop = this.perfStop;
    if (stop) this.serverTime = (Math.floor(this.serverTime / DAY_LENGTH) + stop.frac) * DAY_LENGTH;

    const now = performance.now();
    const rolling = now < this.rollUntil;
    const blocking = this.input.block && !rolling;
    const jumpEdge = this.input.jump && !this.jumpWasHeld;
    this.jumpWasHeld = this.input.jump;
    if (this.tame && jumpEdge && !this.hud.menuOpen) this.tapRing();
    let mv = this.dead || this.hud.menuOpen || this.tame ? IDLE_INPUT : readMove(this.input);
    if (!this.dead && rolling) mv = rollInput(b.facing, this.rig.yaw);
    else if (blocking) mv = { x: mv.x * 0.5, z: mv.z * 0.5, sprint: false, jump: false };
    const driver = this.seat ? this.others.get(this.seat) : undefined;
    const wd = this.whaleDraw;
    b.wet = this.seed !== null && wetAt(weatherAt(this.seed, Math.floor(this.serverTime / DAY_LENGTH))); // mountain rock (S4-B)
    const hs = this.heart && this.structures.position(this.heart.id);
    b.fogPass = this.fog !== 'closed';
    b.noLand = !!this.raid && !!hs && Math.hypot(hs.x - b.x, hs.z - b.z) <= DRAGON.heartNoLand;
    let res: ReturnType<typeof stepBody>;
    if (this.tame?.beast === 'dragon' && this.pico) {
      // On the wild dragon's back: it flies its circle (the server carries us the same way).
      const d = dragonPos(this.pico, this.serverTime);
      Object.assign(b, { x: d.x, y: d.y + DRAGON.height, z: d.z, vx: 0, vz: 0, vy: 0, onGround: false, climb: null, wall: false, gliding: false, facing: d.yaw });
      res = { moving: false, running: false, swimming: false, climbing: false, gliding: false };
    } else if (this.whaleSeat !== null && this.whaleSeat > 0 && wd) {
      // A whale passenger: the server seats us; follow the whale we draw.
      const off = seatOffset(this.whaleSeat, wd.yaw);
      Object.assign(b, { x: wd.x + off.x, y: WATER_LEVEL, z: wd.z + off.z, vx: 0, vz: 0, vy: 0, onGround: true, climb: null, wall: false, gliding: false });
      res = { moving: false, running: false, swimming: false, climbing: false, gliding: false };
    } else if (driver) {
      // Sitting behind a rider: follow their deer (the server does the same), no walking of our own.
      const d = driver.actor.root;
      const yaw = d.rotation.y;
      Object.assign(b, { x: d.position.x - Math.sin(yaw) * MOUNT.seatBack, y: d.position.y - MOUNT.height, z: d.position.z - Math.cos(yaw) * MOUNT.seatBack, vx: 0, vz: 0, vy: 0, onGround: true, climb: null, wall: false, gliding: false, facing: yaw });
      res = { moving: false, running: false, swimming: false, climbing: false, gliding: false };
    } else res = stepBody(b, mv, this.rig.yaw, dt, terrain, (x, z) => this.colliders.near(x, z), this.climbList, (px, pz, nx, nz) => clampStep(px, pz, nx, nz, this.dungeon.gates, this.dungeon.coast.gates, this.dungeon.swamp.gates, this.dungeon.mountain.gates, this.dungeon.tower?.gates ?? []));
    if (res.steep && now >= this.steepToastAt) {
      this.steepToastAt = now + 3000;
      this.hud.toast(STEEP_TEXT[res.steep]);
    }
    if (res.sliding && !this.slideTold) {
      this.slideTold = true;
      this.hud.toast('Tobogán. B para levantarte');
    }
    this.hud.setStamina(b.stamina / b.staminaMax, b.tired);
    let anim: Anim | 'dead' = animFor(res, b);
    if (blocking) anim = 'block';
    if (now < this.attackUntil) anim = 'attack';
    if (now < this.bowUntil - BOW.cooldown * 1000 + 500) anim = 'bow';
    if (rolling) anim = 'roll';
    if (this.riding || this.seat || this.tame || this.onFish || this.onFrog || this.onDragon || this.whaleSeat !== null) anim = 'idle';
    if (this.dead) anim = 'dead';
    this.stepCombat(dt);
    if (stop) {
      // perf harness: hold the player at the stop, camera fixed; nothing is sent
      Object.assign(b, { x: stop.x, y: stop.y ?? terrain.heightAt(stop.x, stop.z), z: stop.z, vx: 0, vy: 0, vz: 0, climb: null, wall: false, gliding: false });
      this.rig.yaw = stop.yaw;
      this.rig.pitch = stop.pitch;
      anim = 'idle';
    }

    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && !this.dead && !stop) {
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
      if (this.tame?.beast === 'deer' && wild) this.me.setPose(wild.x, wild.y + MOUNT.height, wild.z, wild.yaw);
      else this.me.setPose(b.x, b.y + (this.whaleSeat !== null ? WHALE.height : this.riding || this.seat ? MOUNT.height : this.onFish || this.tame?.beast === 'fish' ? FISH.height : this.onFrog || this.tame?.beast === 'frog' ? FROG.height : this.onDragon ? DRAGON.height : 0), b.z, b.facing);
      this.me.play(anim);
      this.me.setCapa(this.capa);
      this.me.setLook(this.look.color, this.look.hat);
      this.me.setTorch(this.torch);
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
    this.syncFish(dt);
    this.syncFrogs();
    this.syncDragons(dt);
    this.syncWhale(dt);
    this.vitrina?.update(dt);

    for (const m of this.mountainMeshes) {
      const near = chunkDetailed(m.chunk, b.x, b.z);
      if (m.detail.visible !== near) {
        m.detail.visible = near;
        m.silhouette.visible = !near;
      }
    }
    this.corruptGroup.visible = corruptVisible(b.z, !!b.dragon);
    if (this.corruptGroup.visible)
      for (const m of this.corruptMeshes) {
        const near = chunkDetailed(m.chunk, b.x, b.z);
        if (m.detail.visible !== near) {
          m.detail.visible = near;
          m.silhouette.visible = !near;
        }
      }
    const focus = new THREE.Vector3(b.x, b.y, b.z);
    const fog = swampFog(b.x, b.z);
    const frac = dayFraction(this.serverTime);
    const today: Weather | null = this.seed === null ? null : weatherAt(this.seed, Math.floor(this.serverTime / DAY_LENGTH));
    if (today && this.lastFrac !== null && dawnCrossed(this.lastFrac, frac)) this.hud.toast(weatherLine(today));
    this.lastFrac = frac;
    const here = today && inMountains(b.x, b.z) ? today : null; // weather only in las Montañas
    this.weatherFx.update(here, b.x, terrain.heightAt(b.x, b.z), b.z, dt);
    lookAt(biomeWeights(b.x, b.z), frac, this.lookTarget, this.purify);
    if (this.lookFresh) easeLook(this.skyLook, this.lookTarget, dt);
    else copyLook(this.skyLook, this.lookTarget);
    this.lookFresh = true;
    this.windStorm = stormDim(here);
    this.light.update(frac, focus, this.skyLook, this.raid ? (this.raid.phase === 'active' ? 0.55 : 0.3) : 0, fog, this.windStorm, performance.now() / 1000);
    // Deep in the swamp the fog hides everything past 70 m: a shorter far plane saves phones some work.
    const far = fog >= 1 ? Math.min(SWAMP_FAR, TIERS[this.tier].drawDistance) : TIERS[this.tier].drawDistance;
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.hud.setRaid(raidText(this.raid, this.rig.yaw));
    this.structures.animate(performance.now() / 1000);
    this.shrineMeshes?.animate(performance.now() / 1000);
    this.chestMeshes?.animate(performance.now() / 1000);
    this.amberMeshes?.animate(performance.now() / 1000);
    this.fogataMeshes?.animate(performance.now() / 1000);
    if (this.cage) this.rescueMeshes?.animate(performance.now() / 1000);
    this.dungeonMeshes?.animate(performance.now() / 1000);
    this.coastMeshes?.animate(performance.now() / 1000, dt);
    this.swampMeshes?.animate(performance.now() / 1000);
    this.caveMeshes?.animate(this.serverTime, dt, this.stoneStructs.filter((s) => s.kind === 'pillar'));
    this.towerMeshes?.animate(this.serverTime, this.stoneStructs.filter((s) => s.kind === 'pillar'));
    this.flameFx.update(dt);
    this.gustFx.update(dt);
    this.rig.far = this.onDragon || this.tame?.beast === 'dragon'; // flying: pull the camera back (no extra draw distance)
    this.rig.apply(this.camera, b, terrain);
    if (this.tame) {
      // The deer bucks: shake the camera a little.
      const k = 0.06 + this.tame.round * 0.03;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.hud.setRing(this.tame ? { needle: ringNeedle(this.tame, this.serverTime), zone: this.tame.zone, width: this.tame.width, round: this.tame.round, rounds: this.tame.rounds } : null);
    this.updatePrompt();
    this.villainTower?.update(this.camera.position, this.towerH, this.camera.far);
    this.light.dome.follow(this.camera, this.camera.far);
    this.worldShaders(b.x, b.z, dt);
    this.life?.update({ x: b.x, z: b.z, groundY: terrain.heightAt(b.x, b.z), biome: biomeOf(b.x, b.z), frac, purified: this.purify > 0.5, precip: precipKind(here, terrain.heightAt(b.x, b.z)) !== null, daylight: this.light.daylight, t: performance.now() / 1000, dt, px: this.renderer.domElement.height, cam: this.camera.position });
    this.packNear();
    if (this.guardian?.root.visible) this.guardian.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** V2-B: glow points each frame; height fog/glow patches on new Lambert materials every 2 s. */
  private worldShaders(x: number, z: number, dt: number): void {
    const t = TIERS[this.tier];
    this.patchIn -= dt;
    if (this.patchIn <= 0) {
      this.patchIn = 2;
      patchTree(this.scene, { heightFog: t.heightFog, glow: t.glowPoints });
    }
    const sources = [...this.structures.glowSources(), ...(this.fogataMeshes?.glowSources() ?? [])];
    setGlows(pickGlows(sources, x, z, t.glowPoints), 1.6 * (1 - 0.75 * this.light.daylight));
    const fogCol = (this.scene.fog as THREE.Fog | null)?.color;
    if (fogCol) WORLD_UNIFORMS.fogSunCol.value.copy(fogCol).lerp(this.skyLook.sun, 0.6 * this.light.daylight);
    WORLD_UNIFORMS.fogSunDir.value.copy(this.light.sunDirection);
    // V2-C: wind for grass, crowns, pines and awnings; on high the grass bends away from nearby players.
    const now = performance.now() / 1000;
    LIFE_UNIFORMS.windT.value = now;
    this.purify = this.perfStop?.purified ? 1 : this.heal.purify(now);
    LIFE_UNIFORMS.purify.value = this.purify;
    LIFE_UNIFORMS.purifyFrom.value.set(TOWER.x, TOWER.z);
    // V2-D: the water's sky, sun and clock; el Lago Negro clears with las Tierras.
    WATER_UNIFORMS.uTime.value = now;
    WATER_UNIFORMS.uSunDir.value.copy(this.light.sunDirection);
    WATER_UNIFORMS.uSunCol.value.copy(this.skyLook.sun);
    WATER_UNIFORMS.uZenith.value.copy(this.light.zenithColor);
    WATER_UNIFORMS.uHorizon.value.copy(this.light.horizonColor);
    WATER_UNIFORMS.uDay.value = this.light.daylight;
    if (this.pillarMeshes) setLakePurify(this.pillarMeshes.lake, this.purify);
    LIFE_UNIFORMS.lifeDay.value = this.light.daylight;
    // Under the surface: a tint over the screen and a short fog in the water's colour.
    const cam = this.camera.position;
    const under = !!this.terrain && underwater(cam.y, waterLevel(this.terrain, cam.x, cam.z)) && this.terrain.heightAt(cam.x, cam.z) < cam.y;
    this.underDiv.style.opacity = under ? '0.35' : '0';
    const fog = this.scene.fog as THREE.Fog | null;
    if (under && fog) {
      fog.color.setHex(inSwamp(cam.x, cam.z) ? WATER.pantano.deep : WATER.mar.deep).multiplyScalar(0.25 + 0.75 * this.light.daylight);
      fog.near = 2;
      fog.far = 28;
    }
    this.grass?.setPurified(this.purify > 0);
    LIFE_UNIFORMS.zones.value.forEach((v, i) => {
      const zn = this.zones[i];
      if (zn) v.set(zn.x, zn.z, zn.r, this.heal.front(zn, now));
      else v.set(0, 0, 1, FRONT_HEALED);
    });
    LIFE_UNIFORMS.windAmp.value = 1 + this.windStorm * 1.2;
    if (this.tier === 'high') {
      const press = LIFE_UNIFORMS.pressPos.value;
      const b = this.body;
      press[0]!.set(b?.x ?? 0, b?.y ?? -1e4, b?.z ?? 0, b ? 1 : 0);
      let i = 1;
      for (const r of this.others.values()) {
        if (i >= press.length) break;
        const p = r.actor.root.position;
        if (Math.hypot(p.x - x, p.z - z) > 30) continue;
        press[i++]!.set(p.x, p.y, p.z, 1);
      }
      for (; i < press.length; i++) press[i]!.set(0, -1e4, 0, 0);
    }
  }

  /** V2-B perf: only trees, rocks, bushes and grass near the camera go to the GPU (past the fog they are invisible anyway). */
  private packNear(): void {
    const c = this.camera.position;
    const fwd = this.camera.getWorldDirection(this.tmpFwd);
    const f = Math.hypot(fwd.x, fwd.z) > 0.2 ? { x: fwd.x, z: fwd.z } : null;
    const r = TIERS[this.tier].drawDistance * NEAR_RADIUS;
    this.resMeshes?.update(c.x, c.z, r, f);
    this.grass?.update(c.x, c.z);
  }

  /** Parked and wild deer from the snapshot, plus one under every rider (us included). */
  private syncSteeds(dt: number, wild: SteedView | undefined): void {
    const b = this.body!;
    const poses: SteedPose[] = [];
    const stars: { key: string; x: number; y: number; z: number; yaw: number; moving: boolean }[] = [];
    if (this.estrella) stars.push({ key: '~wild', ...this.estrella, moving: true });
    for (const s of this.steeds) if (s.star) stars.push({ key: s.owner ?? '?', x: s.x, y: s.y, z: s.z, yaw: s.yaw, moving: false });
    if (this.riding && this.hasStar) stars.push({ key: `ride:${this.myName}`, x: b.x, y: b.y, z: b.z, yaw: b.facing, moving: Math.hypot(b.vx, b.vz) > 0.3 });
    for (const [name, r] of this.others) {
      if (!r.ride || !r.star) continue;
      const p = r.actor.root.position;
      stars.push({ key: `ride:${name}`, x: p.x, y: p.y - MOUNT.height, z: p.z, yaw: r.actor.root.rotation.y, moving: r.speed > 0.3 });
    }
    this.syncStars(stars, dt);
    for (const s of this.steeds) if (!s.star) poses.push({ key: s.owner ?? '~wild', x: s.x, y: s.y, z: s.z, yaw: s.yaw, speed: 0, wild: s.owner === null, bucking: s.owner === null && this.tame?.beast === 'deer' && s === wild });
    if (this.riding && !this.hasStar) poses.push({ key: `ride:${this.myName}`, x: b.x, y: b.y, z: b.z, yaw: b.facing, speed: Math.hypot(b.vx, b.vz), wild: false, bucking: false });
    for (const [name, r] of this.others) {
      if (!r.ride || r.star) continue;
      const p = r.actor.root.position;
      poses.push({ key: `ride:${name}`, x: p.x, y: p.y - MOUNT.height, z: p.z, yaw: r.actor.root.rotation.y, speed: r.speed, wild: false, bucking: false });
    }
    this.steedMeshes?.sync(poses, dt, performance.now() / 1000);
  }

  /** S5-H: la Estrella as paper (wild, parked or ridden); she spins as she rolls. */
  private syncStars(list: readonly { key: string; x: number; y: number; z: number; yaw: number; moving: boolean }[], dt: number): void {
    const seen = new Set<string>();
    for (const s of list) {
      seen.add(s.key);
      let a = this.stars.get(s.key);
      if (!a) {
        a = new PaperActor(STAR_IMG, ESTRELLA.h, this.camera, STAR_ASPECT);
        this.scene.add(a.root);
        this.stars.set(s.key, a);
      }
      a.play(s.moving ? 'walk' : 'idle');
      a.setPose(s.x, s.y, s.z, s.yaw);
      a.update(dt);
    }
    for (const [k, a] of this.stars) {
      if (seen.has(k)) continue;
      a.root.removeFromParent();
      this.stars.delete(k);
    }
  }

  /** Wild and parked fish, one under every fish rider (us included), and the race rings. */
  private syncFish(dt: number): void {
    const b = this.body!;
    const now = performance.now() / 1000;
    const poses: FishPose[] = [];
    for (const f of this.fishViews) {
      // The wild one swims a small circle for show (the server keeps it at its home spot).
      const a = f.owner === null ? now * 0.5 : 0;
      const x = f.owner === null ? f.x + Math.sin(a) * 2 : f.x;
      const z = f.owner === null ? f.z + Math.cos(a) * 2 : f.z;
      poses.push({ key: f.owner ?? '~wild', x, y: f.y, z, yaw: f.owner === null ? a + Math.PI / 2 : f.yaw, speed: f.owner === null ? 1 : 0, wild: f.owner === null, bucking: false });
    }
    if (this.onFish || this.tame?.beast === 'fish') poses.push({ key: `ride:${this.myName}`, x: b.x, y: b.y, z: b.z, yaw: b.facing, speed: Math.hypot(b.vx, b.vz), wild: false, bucking: !this.onFish });
    for (const [name, r] of this.others) {
      if (!r.fish) continue;
      const p = r.actor.root.position;
      poses.push({ key: `ride:${name}`, x: p.x, y: p.y - FISH.height, z: p.z, yaw: r.actor.root.rotation.y, speed: r.speed, wild: false, bucking: false });
    }
    this.fishMeshes?.sync(poses, dt, now);
    const race = this.race;
    this.raceRings?.sync(race?.beast === 'fish' ? race.i : null, now);
    this.lilyPads?.sync(race?.beast === 'frog' ? race.i : null);
    const left = race ? Math.max(0, Math.ceil(race.deadline - this.serverTime)) : 0;
    this.hud.setRace(race ? (race.beast === 'frog' ? `Nenúfar ${race.i + 1}/${FROG.pads} · ${left} s` : `Anillo ${race.i + 1}/${FISH.rings} · ${left} s`) : null);
  }

  /** Wild and parked dragons, one under every dragon rider (us included), and the leap marker on the Pico. */
  private syncDragons(dt: number): void {
    const b = this.body!;
    const t = this.terrain;
    if (!t || !this.pico) return;
    const feet = (x: number, y: number, z: number) => Math.max(Math.max(t.heightAt(x, z), WATER_LEVEL), y - DRAGON_SINK);
    const poses: DragonPose[] = this.dragonViews.map((d) => ({ key: d.owner ?? '~wild', x: d.x, y: feet(d.x, d.y, d.z), z: d.z, yaw: d.yaw, wild: d.owner === null }));
    if (this.onDragon) poses.push({ key: `ride:${this.myName}`, x: b.x, y: feet(b.x, b.y, b.z), z: b.z, yaw: b.facing, wild: false });
    for (const [name, r] of this.others) {
      if (!r.dragon) continue;
      const p = r.actor.root.position;
      const y = p.y - DRAGON.height;
      poses.push({ key: `ride:${name}`, x: p.x, y: feet(p.x, y, p.z), z: p.z, yaw: r.actor.root.rotation.y, wild: false });
    }
    const wild = this.dragonViews.find((d) => d.owner === null);
    const open = wild && !this.hasDragon && !this.tame && leapOk(this.pico, this.serverTime, b) ? wild : null;
    this.dragonMeshes?.sync(poses, dt, open);
    this.dragonMeshes?.fadeGate(this.fog === 'open', dt);
  }

  /** Wild and parked frogs, and one under every frog rider (us included). */
  private syncFrogs(): void {
    const b = this.body!;
    const now = performance.now() / 1000;
    const poses: FrogPose[] = this.frogViews.map((f) => ({ key: f.owner ?? '~wild', x: f.x, y: f.y, z: f.z, yaw: f.yaw, wild: f.owner === null, bucking: false }));
    if (this.onFrog || this.tame?.beast === 'frog') poses.push({ key: `ride:${this.myName}`, x: b.x, y: b.y, z: b.z, yaw: b.facing, wild: false, bucking: !this.onFrog });
    for (const [name, r] of this.others) {
      if (!r.frog) continue;
      const p = r.actor.root.position;
      poses.push({ key: `ride:${name}`, x: p.x, y: p.y - FROG.height, z: p.z, yaw: r.actor.root.rotation.y, wild: false, bucking: false });
    }
    this.frogMeshes?.sync(poses, now);
  }

  /** The whale: under our body when we pilot, else eased toward the snapshot. */
  private syncWhale(dt: number): void {
    const w = this.whaleView;
    const b = this.body!;
    if (!w) {
      this.whaleDraw = null;
      return this.whaleMesh?.sync(null, false, false, 0);
    }
    if (this.whaleSeat === 0) {
      const off = seatOffset(0, b.facing);
      this.whaleDraw = { x: b.x - off.x, z: b.z - off.z, yaw: b.facing };
    } else if (!this.whaleDraw || Math.hypot(this.whaleDraw.x - w.x, this.whaleDraw.z - w.z) > 30) this.whaleDraw = { x: w.x, z: w.z, yaw: w.yaw };
    else {
      const k = Math.min(1, 6 * dt);
      const d = this.whaleDraw;
      d.x += (w.x - d.x) * k;
      d.z += (w.z - d.z) * k;
      d.yaw += Math.atan2(Math.sin(w.yaw - d.yaw), Math.cos(w.yaw - d.yaw)) * k;
    }
    this.whaleMesh?.sync(this.whaleDraw, !w.tamed, w.diving, performance.now() / 1000);
  }

  private animateRemote(r: Remote, rt: number, dt: number): void {
    const s = r.buf.at(rt);
    if (s) {
      const before = r.actor.root.position.clone();
      r.actor.setPose(s.x, s.y + (r.whale ? WHALE.height : r.ride || r.seat ? MOUNT.height : r.fish ? FISH.height : r.frog ? FROG.height : r.dragon ? DRAGON.height : 0), s.z, s.yaw);
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
    if (sp) return this.hud.setPrompt(sp.part === 0 && !sp.open ? sp.label : `E · ${sp.label}`);
    const ca = this.coastAct();
    if (ca) return this.hud.setPrompt(`E · ${ca.label}`);
    const sa = this.swampAct();
    if (sa) return this.hud.setPrompt(`E · ${sa.label}`);
    const qa = this.quartzAct();
    if (qa) return this.hud.setPrompt(`E · ${qa.label}`);
    const fa = this.fogataAct();
    if (fa) return this.hud.setPrompt(fa.t === 'hint' ? `${NAMES.fogata[0]!.toUpperCase()}${NAMES.fogata.slice(1)} apagada · ${fa.label}` : `E · ${fa.label}`);
    const ra = this.rescueAct();
    if (ra) return this.hud.setPrompt(`E · ${ra.label}`);
    const pa = this.pillarAct();
    if (pa) return this.hud.setPrompt(`E · ${pa.label}`);
    const ga = this.guardianAct();
    if (ga) return this.hud.setPrompt(`E · ${ga.label}`);
    const da = this.body && (dungeonAction(this.body, this.entrance, this.dungeon, this.hasPower, this.myName) ?? coastDungeonAction(this.body, this.coastDoor, this.dungeon.coast, this.hasWind) ?? swampDungeonAction(this.body, this.swampDoor, this.dungeon.swamp, this.hasFire) ?? mountainDungeonAction(this.body, this.mountainDoor, this.dungeon.mountain, this.hasStone) ?? towerDungeonAction(this.body, this.towerDoor, this.towerOpen, this.dungeon.tower.final, this.ending));
    if (da) return this.hud.setPrompt(`E · ${da.label}`);
    if (ma?.act === 17) return this.hud.setPrompt(`E / M · ${ma.label} · Espacio (mantener) · Subir`);
    if (ma?.act === 14) return this.hud.setPrompt(`E / M · ${ma.label} · Espacio · Salto alto`);
    if (ma) return this.hud.setPrompt(ma.act === 3 || ma.act === 5 || ma.act === 8 || ma.act === 11 || ma.act === 14 || ma.act === 17 ? `E / M · ${ma.label}` : `E · ${ma.label}`);
    const b = this.body;
    if (this.onFish) return this.hud.setPrompt('Espacio (mantener) · Bucear');
    if (this.onDragon) return this.hud.setPrompt('Espacio (mantener) · Subir · suelta para bajar');
    if (b?.climb || b?.wall) return this.hud.setPrompt('Espacio · Saltar');
    if (b?.gliding) return this.hud.setPrompt('Espacio · Cerrar planeador');
    const res = this.nearestResource();
    if (res) return this.hud.setPrompt(`E · ${HARVEST[res.kind].label}`);
    const wall = b && b.onGround ? cragsNear(this.climbList, b.x, b.z, 1).find((c) => b.y < c.top - 0.6) : undefined;
    if (wall?.bare) return this.hud.setPrompt(this.hasPower ? `H · ${NAMES.powerVine}: cubrir la roca` : 'Roca lisa: no hay agarre');
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
