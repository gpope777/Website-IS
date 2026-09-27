import { STRUCTURE_KINDS, type Inventory, type StructureKind } from './items';
import type { Vitals } from './survival';
import type { Crag } from './crags';
import { FOGATA } from './fogatas';
import { QUARTZ } from './mountain-shrines';

export const PROTOCOL_VERSION = 48;

/** S5-A: the muro de niebla's state in the snapshot. */
export type FogState = 'closed' | 'ready' | 'open';

export const ANIMS = ['idle', 'walk', 'run', 'jump', 'swim', 'attack', 'roll', 'block', 'bow', 'climb', 'glide', 'slide'] as const;
export type Anim = (typeof ANIMS)[number];
export type WolfAnim = 'idle' | 'walk' | 'run' | 'attack' | 'dead';

export interface PlayerView { name: string; x: number; y: number; z: number; yaw: number; anim: Anim; away: boolean; dead: boolean; /** Riding a deer or the giant fish. */ ride: 'deer' | 'fish' | 'whale' | 'frog' | 'dragon' | null; /** Sitting behind this rider on their deer. */ seat: string | null; /** Capa de corteza level (0–3): bark tint on the torso. */ capa: number }
export type EnemyKind = 'wolf' | 'brute' | 'boss' | 'elite' | 'elite2' | 'boss2' | 'marchito' | 'anchor' | 'lieut1' | 'elite3' | 'boss3' | 'lieut2' | 'elite4' | 'boss4' | 'rayo' | 'lieut3';
export interface WolfView { id: number; kind: EnemyKind; x: number; y: number; z: number; yaw: number; anim: WolfAnim; raid: boolean; /** Burning from a Llamarada or a hoguera. */ burning?: true; /** La Flecha's red line: where her clavada ends. */ aim?: { x: number; z: number }; /** La Flecha stuck in a wall. */ stuck?: true }
export interface Structure { id: number; kind: StructureKind; x: number; y: number; z: number; rot: number; owner: string; hp: number }
export interface RaidView { phase: 'warn' | 'active'; /** angle the raid comes from, around the Heart: x = sin, z = cos */ dir: number; level: number }
export interface GraveView { id: number; owner: string; x: number; y: number; z: number }
/** `parts` follow `Shrine.parts`: lever or wheel pulled / plate pressed. `block` = Marea's pumice block. */
export interface ShrineView { id: number; open: boolean; parts: boolean[]; block?: CarryView; /** Bloques: where the 3 stone blocks sit now. */ blocks?: { x: number; z: number }[] }
/** Something you can carry in the Raíz-madre: where it is and who holds it. */
export interface CarryView { x: number; z: number; held: string | null }
/** Live dungeon state: gates (`gate` = gate 0, the levers'), levers pulled, the plate, the block and lantern, the brazier, whether the boss was purified, and the bars while they fight. */
export interface DungeonView {
  gate: boolean;
  gates: boolean[];
  levers: boolean[];
  purified: boolean;
  boss: { hp: number; max: number; weak: boolean } | null;
  plate: boolean;
  block: CarryView;
  lantern: CarryView;
  lit: boolean;
  elite: { hp: number; max: number; charging: boolean } | null;
  /** The coast Raíz-madre. */
  coast: CoastDungeonView;
  /** The swamp Raíz-madre. */
  swamp: SwampDungeonView;
  /** The mountain cave. */
  mountain: MountainDungeonView;
}
/** The mountain interior: gates (levers, high plate, blocks, bruto de roca), levers pulled, the plate weighted, where the two blocks sit, and the bruto de roca's bar. */
export interface MountainDungeonView { gates: boolean[]; levers: boolean[]; plate: boolean; blocks: { x: number; z: number }[]; elite: { hp: number; max: number; charging: boolean; exposed: boolean } | null; /** El Cucurucho while it fights: winding up, charging, hat stuck, the alud's marked circles. */ boss: { hp: number; max: number; windup: boolean; charging: boolean; stuck: boolean; alud: { x: number; z: number }[] } | null }
/** The swamp interior: gates (levers, thorns, gas lamps, bruto de turba), levers pulled, Llamaradas the thorns took (0–3), lamps lit, boardwalk planks still up, and the bruto de turba's bar. */
export interface SwampDungeonView { gates: boolean[]; levers: boolean[]; thorn: number; lamps: boolean[]; planks: boolean[]; elite: { hp: number; max: number; charging: boolean; burning: boolean } | null; /** El Zancudo while it fights: on the floor, winding a dive (its shadow), who it clings to. */ boss: { hp: number; max: number; grounded: boolean; diving: boolean; shadow: { x: number; z: number } | null; latch: string | null } | null; /** Gas vents flaring right now. */ vents: boolean[] }
/** The coast interior: gates (levers, fan, plate, bruto escudado), levers pulled, the pumice block, the plate, and the bruto escudado's bar. */
export interface CoastDungeonView { gates: boolean[]; levers: boolean[]; block: { x: number; z: number }; plate: boolean; elite: { hp: number; max: number; exposed: boolean; charging: boolean } | null; /** El Antenón while it fights; `tell` = the attack it is winding up. */ boss: { hp: number; max: number; exposed: boolean; tell: 'sweep' | 'charge' | null } | null }
/** The purified boss guarding the Heart. */
export interface AllyView { x: number; y: number; z: number; yaw: number; anim: WolfAnim }
/** A deer (or giant fish) standing in the world: the wild one (`owner` null) or a parked, tamed one. */
export interface SteedView { owner: string | null; x: number; y: number; z: number; yaw: number }
/** A taming round in progress: needle angle = ringAngle(speed, serverTime - start); tap inside `zone` ± width/2. */
export interface TameView { round: number; rounds: number; start: number; speed: number; zone: number; width: number; beast: 'deer' | 'fish' | 'whale' | 'frog' | 'dragon' }
/** El Marchito in the base: voluntad left (he leaves at 0) and whether he is laughing on his way out. */
/** La Ballena (one per world): wild or tamed, under water after a failed taming, and who sits where (0 = pilot). */
export interface WhaleView { x: number; z: number; yaw: number; tamed: boolean; diving: boolean; seats: (string | null)[] }
/** Invasion 2's root cage (spots come from the seed): each anchor's PV left, 0 = broken. */
export interface CageView { anchors: number[] }
export interface MarchitoView { will: number; max: number; laughing: boolean; /** Invasion 2: how far he has wrapped the Tragón (0–1). */ grab?: number }
/** S5-C: los 4 Pilares-raíz (0 Enredadera, 1 Viento, 2 Fuego, 3 Piedra): broken, the thicket's roots bridged, the lake anchor still holding, gusts on the miasma, Llamaradas on the cocoon, the Piedra lid up. */
export interface PillarView { broken: boolean[]; roots: boolean[]; anchor: boolean; miasma: number; burns: number; lid: boolean }
export interface HeartView { id: number; hp: number; max: number }
/** `fix` = the server rejected your last move; snap to x/y/z. `reviveLeft` = whole seconds a teammate can still revive you. */
export interface SelfState { x: number; y: number; z: number; vitals: Vitals; inv: Inventory; dead: boolean; fix: boolean; reviveLeft: number; /** Shrine ids this player cleared (one orb each). */ shrines: number[]; /** Whole seconds until Enredadera can be cast again. */ powerLeft: number; /** Has Enredadera (from the dungeon altar). */ power: boolean; /** Has Viento (from the coast dungeon altar). */ viento: boolean; /** Whole seconds until Viento can be cast again. */ windLeft: number; /** Has Fuego (from the swamp dungeon altar). */ fuego: boolean; /** Whole seconds until Fuego can be cast again. */ fireLeft: number; /** Has Piedra (from the mountain dungeon altar). */ piedra: boolean; /** Whole seconds until Piedra can be cast again. */ stoneLeft: number; tame: TameView | null; riding: boolean; /** Owns a tamed deer. */ steed: boolean; /** Sitting behind this rider on their deer. */ seat: string | null; /** Owns a tamed giant fish. */ fish: boolean; /** On the giant fish. */ onFish: boolean; /** The fish's ring race or the frog's lily-pad chase: next ring/pad index (they come from the seed) and its deadline in sim time. */ race: { i: number; deadline: number; beast: 'fish' | 'frog' } | null; /** Owns a tamed frog. */ frog: boolean; /** On the frog. */ onFrog: boolean; /** Owns a tamed dragon (S4-G). */ dragon: boolean; /** On the dragon. */ onDragon: boolean; /** Carrying a torch from the Candiles post. */ torch: boolean; /** Amber tree ids still regrowing for you (trees come from the seed). */ amber: number[]; /** Capa de corteza level (0–3). */ capa: number; /** Quartz vein ids still regrowing for you (veins come from the seed). */ quartz: number[]; /** Sunken chest ids this player opened (chests come from the seed). */ chests: number[]; /** Weapon upgrade level (0–5). */ weapon: number; /** Seat on the whale (0 = pilot), or null. */ whaleSeat: number | null; /** Whole seconds left of a fogata channel, or null. */ travel: number | null }

export const POWER_KINDS = ['enredadera', 'viento', 'fuego', 'piedra'] as const;
export type PowerKind = (typeof POWER_KINDS)[number];

export type ErrorCode = 'version' | 'pin' | 'rate' | 'noworld' | 'full' | 'bad' | 'replaced';

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; pin: string }
  | { t: 'move'; x: number; y: number; z: number; yaw: number; anim: Anim }
  | { t: 'harvest'; id: number }
  | { t: 'place'; kind: StructureKind; x: number; z: number; rot: number }
  | { t: 'attack'; id: number }
  | { t: 'eat' }
  | { t: 'respawn' }
  | { t: 'tend'; id: number }
  | { t: 'roll' }
  | { t: 'block'; on: boolean }
  | { t: 'shoot'; id: number }
  | { t: 'revive'; name: string }
  /** Cast the chosen power at (x, z): absent kind = Enredadera (older clients). */
  | { t: 'power'; x: number; z: number; kind?: PowerKind }
  /** part 0 = take the orb, 1/2 = pull lever 1/2 (Hundido: 2 = the seabed one), Islote: 1–3 = turn a wheel, Marea: 1 = pick up / drop the pumice block, Candiles: 1–3 = light a brazier, 4 = take a torch */
  | { t: 'shrine'; id: number; part: number }
  /** 0 = enter the Raíz-madre, 1 = leave it, 2/3 = pull root lever 1/2, 4 = take the power at the altar, 5 = pick up / drop the block, 6 = pick up / drop the lantern, 7 = light the brazier, 8 = enter the coast Raíz-madre, 9 = leave it, 10/11 = pull its levers, 12 = take Viento at its altar, 13 = enter the swamp Raíz-madre, 14 = leave it, 15/16 = pull its levers, 17 = take Fuego at its altar, 18 = enter the mountain cave, 19 = leave it, 20/21 = pull its levers, 22 = take Piedra at its altar, 23/24 = push its block 0/1, 25 = its reset lever */
  | { t: 'dungeon'; act: number }
  /** 0 = start taming the wild deer, 1 = tap the ring at sim time `at`, 2 = get on your deer, 3 = get off, 4 = sit behind the nearest rider, 5 = get off the seat, 6 = start the fish's ring race, 7 = get on your fish, 8 = get off the fish, 9 = start taming the whale (needs 2+), 10 = board the whale, 11 = leave the whale, 12 = start the frog's lily-pad chase, 13 = get on your frog, 14 = get off the frog */
  | { t: 'mount'; act: number; at?: number }
  /** Open a sunken chest (diving, beside it). */
  | { t: 'chest'; id: number }
  /** Buy a weapon upgrade at the Heart. */
  | { t: 'upgrade' }
  /** Free the Tragón from the root cage (beside it, every anchor broken). */
  | { t: 'rescue' }
  /** Harvest an amber tree (beside it; on top of its stump for the high ones). */
  | { t: 'amber'; id: number }
  /** Take quartz from a mountain vein (climbing beside it). */
  | { t: 'quartz'; id: number }
  /** Buy a Capa de corteza level at the Heart. */
  | { t: 'capa' }
  /** Light a swamp fogata with the torch you carry (beside it). */
  | { t: 'fogata'; id: number }
  /** Start the 5 s channel: from a lit fogata to the Heart, or from the Heart to lit fogata `to` (day only). */
  | { t: 'travel'; to: 'heart' | number }
  /** At the lit Ceniza fogata (S5-B): bring your own parked deer, frog or fish there. */
  | { t: 'call'; beast: CallBeast }
  /** S5-C: start pulling Pilar-raíz `id`'s core (A held 3 s, beside it). */
  | { t: 'pillar'; id: number };

export type CallBeast = 'deer' | 'frog' | 'fish';
export const CALL_BEASTS: readonly CallBeast[] = ['deer', 'frog', 'fish'];

export type ServerMsg =
  | { t: 'welcome'; you: string; seed: number; time: number; self: SelfState; structures: Structure[]; gone: number[] }
  | { t: 'error'; code: ErrorCode }
  | { t: 'snap'; time: number; players: PlayerView[]; wolves: WolfView[]; self: SelfState; raid: RaidView | null; heart: HeartView | null; graves: GraveView[]; vines: Crag[]; shrines: ShrineView[]; dungeon: DungeonView; ally: AllyView | null; /** The purified Antenón by the Heart (anim 'attack' while it gusts). */ ally2: AllyView | null; /** The white Zancudo's farol by the Heart (anim 'attack' while it flares). */ ally3: AllyView | null; /** The white Cucurucho's atalaya by the Heart (anim 'attack' while it throws). */ ally4: AllyView | null; /** La Escalera del Umbral is up: a ramp in los Peldaños (see withEscalera). */ escalera: boolean; /** The Zarzal knot burnt: its gap is open ground. */ zarzalBurnt: boolean; /** Which swamp fogatas are lit (ids from the seed). */ fogatas: boolean[]; steeds: SteedView[]; /** The wild giant fish (owner null) and parked tamed ones. */ fish: SteedView[]; /** The wild frog (owner null) and parked tamed ones. */ frogs: SteedView[]; /** The wild dragon while it circles the Pico (owner null) and parked tamed ones. */ dragons: SteedView[]; /** S5-A: the fog north of the rim: closed, ready (the 4 Raíces-madre purified: a dragon rider opens it) or open. */ fog: FogState; /** S5-A: El Marchito's tower height (m). */ towerH: number; whale: WhaleView; marchito: MarchitoView | null; /** Corruption zone ids still corrupt (zones come from the seed). */ corrupt: number[]; /** S5-C: los Pilares-raíz. */ pillars: PillarView; /** The root cage while the Tragón is taken. */ cage: CageView | null }
  | { t: 'hit'; id: number; hp: number }
  | { t: 'wrecked'; id: number }
  | { t: 'res'; id: number; gone: boolean }
  | { t: 'built'; s: Structure }
  | { t: 'toast'; text: string }
  /** El Marchito speaks: a few lines shown as a vision card. */
  | { t: 'vision'; lines: string[] };

export const NAME_RE = /^[\p{L}\p{N} _-]{1,16}$/u;
export const PIN_RE = /^\d{4}$/;
export const WORLD_RE = /^[a-z0-9-]{3,32}$/;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function parse(raw: string): Record<string, unknown> | null {
  try {
    const p: unknown = JSON.parse(raw);
    return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Trust boundary: everything a client sends passes through here. */
export function decodeClient(raw: string): ClientMsg | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.t) {
    case 'hello': {
      const { v, name, pin } = m;
      return num(v) && typeof name === 'string' && name.trim() === name && NAME_RE.test(name) && typeof pin === 'string' && PIN_RE.test(pin)
        ? { t: 'hello', v, name, pin }
        : null;
    }
    case 'move': {
      const { x, y, z, yaw, anim } = m;
      return num(x) && num(y) && num(z) && num(yaw) && (ANIMS as readonly unknown[]).includes(anim)
        ? { t: 'move', x, y, z, yaw, anim: anim as Anim }
        : null;
    }
    case 'harvest':
      return id(m.id) ? { t: 'harvest', id: m.id } : null;
    case 'attack':
      return id(m.id) ? { t: 'attack', id: m.id } : null;
    case 'tend':
      return id(m.id) ? { t: 'tend', id: m.id } : null;
    case 'place': {
      const { kind, x, z, rot } = m;
      return (STRUCTURE_KINDS as readonly unknown[]).includes(kind) && num(x) && num(z) && num(rot)
        ? { t: 'place', kind: kind as StructureKind, x, z, rot }
        : null;
    }
    case 'eat':
      return { t: 'eat' };
    case 'respawn':
      return { t: 'respawn' };
    case 'roll':
      return { t: 'roll' };
    case 'block':
      return typeof m.on === 'boolean' ? { t: 'block', on: m.on } : null;
    case 'shoot':
      return id(m.id) ? { t: 'shoot', id: m.id } : null;
    case 'revive':
      return typeof m.name === 'string' && NAME_RE.test(m.name) ? { t: 'revive', name: m.name } : null;
    case 'power':
      if (!num(m.x) || !num(m.z)) return null;
      if (m.kind === undefined) return { t: 'power', x: m.x, z: m.z };
      return (POWER_KINDS as readonly unknown[]).includes(m.kind) ? { t: 'power', x: m.x, z: m.z, kind: m.kind as PowerKind } : null;
    case 'shrine':
      return id(m.id) && id(m.part) && (m.part as number) <= 7 ? { t: 'shrine', id: m.id, part: m.part as number } : null;
    case 'dungeon':
      return id(m.act) && (m.act as number) <= 25 ? { t: 'dungeon', act: m.act as number } : null;
    case 'mount':
      if (!id(m.act) || (m.act as number) > 17) return null;
      if (m.act === 1) return num(m.at) ? { t: 'mount', act: 1, at: m.at } : null;
      return { t: 'mount', act: m.act as number };
    case 'chest':
      return id(m.id) ? { t: 'chest', id: m.id } : null;
    case 'upgrade':
      return { t: 'upgrade' };
    case 'rescue':
      return { t: 'rescue' };
    case 'amber':
      return id(m.id) ? { t: 'amber', id: m.id } : null;
    case 'quartz':
      return id(m.id) && m.id < QUARTZ.veins ? { t: 'quartz', id: m.id } : null;
    case 'capa':
      return { t: 'capa' };
    case 'fogata':
      return id(m.id) && m.id < FOGATA.count ? { t: 'fogata', id: m.id } : null;
    case 'travel':
      return m.to === 'heart' || (id(m.to) && m.to < FOGATA.count) ? { t: 'travel', to: m.to } : null;
    case 'call':
      return (CALL_BEASTS as readonly unknown[]).includes(m.beast) ? { t: 'call', beast: m.beast as CallBeast } : null;
    case 'pillar':
      return id(m.id) && m.id < 4 ? { t: 'pillar', id: m.id } : null;
    default:
      return null;
  }
}

export function encode(m: ClientMsg | ServerMsg): string {
  return JSON.stringify(m);
}

/** Round to cm to keep snapshots small. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
