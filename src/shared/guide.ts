/**
 * P7-D: "Qué sigue" (spec §7). A pure walk over the story: the first step not done wins.
 * World steps count when anyone did them (the world is shared); player steps only when you did.
 */
import { NAMES } from './names';
import type { FogState, StoryView } from './protocol';

export type Scope = 'world' | 'player';
export interface Pt { x: number; z: number }
export interface Step { id: string; scope: Scope; icon: string; text: string; target: Pt | null; /** Ayuda topic to open on tap. */ help?: string }

/** Seed places (and a few live positions) the client already knows. */
export interface Places {
  shrines: readonly { id: number; x: number; z: number }[];
  forestDoor: Pt;
  coastDoor: Pt;
  swampDoor: Pt;
  mountainDoor: Pt;
  deer: Pt;
  fish: Pt;
  frog: Pt;
  whale: Pt;
  pico: Pt;
  cage: Pt;
  knot: Pt;
  umbral: Pt;
  rim: Pt;
  ceniza: Pt;
  pillars: readonly Pt[];
  tower: Pt;
  estrella: Pt;
}

export interface GuideSelf {
  orbs: readonly number[];
  vine: boolean;
  wind: boolean;
  fire: boolean;
  stone: boolean;
  deer: boolean;
  fish: boolean;
  frog: boolean;
  dragon: boolean;
  star: boolean;
  skillPts: number;
}

export interface GuideWorld {
  heart: Pt | null;
  story: StoryView;
  whale: boolean;
  zarzal: boolean;
  escalera: boolean;
  fog: FogState;
  /** Pilares-raíz broken, ids 0–3. */
  pillars: readonly boolean[];
  /** La Ceniza's fogata is lit. */
  ceniza: boolean;
  towerOpen: boolean;
  ending: boolean;
  /** Corrupt zones still standing. */
  zones: readonly Pt[];
  fullMoon: boolean;
}

export interface GuideView {
  touch: boolean;
  me: Pt;
  self: GuideSelf;
  world: GuideWorld;
  friends: readonly { name: string; x: number; z: number }[];
  places: Places;
}

export const GUIDE = { here: 8, friend: 30, far: 300, zoneNear: 150 } as const;

const SHRINE_IDS = { forest: [0, 1, 2], coast: [3, 4, 5], swamp: [6, 7, 8], mountain: [9, 10, 11] } as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
const nearest = (me: Pt, pts: readonly Pt[]): Pt | null => pts.reduce<Pt | null>((best, p) => (!best || dist(me, p) < dist(me, best) ? p : best), null);
const k = (v: GuideView, touch: string, pc: string) => (v.touch ? touch : pc);
/** "el Pantano" → "del Pantano". */
const de = (b: string) => (b.startsWith('el ') ? `del ${b.slice(3)}` : `de ${b}`);
const al = (b: string) => (b.startsWith('el ') ? `al ${b.slice(3)}` : `a ${b}`);

function shrinesLeft(v: GuideView, ids: readonly number[]): Pt[] {
  return v.places.shrines.filter((s) => ids.includes(s.id) && !v.self.orbs.includes(s.id)).map(({ x, z }) => ({ x, z }));
}

interface StoryStep { id: string; scope: Scope; done(v: GuideView): boolean; show(v: GuideView): Omit<Step, 'id' | 'scope'> }

const shrineStep = (id: string, ids: readonly number[], biome: string): StoryStep => ({
  id,
  scope: 'player',
  done: (v) => shrinesLeft(v, ids).length === 0,
  show: (v) => ({ icon: '✨', text: `Santuario ${de(biome)}`, target: nearest(v.me, shrinesLeft(v, ids)), help: 'Santuarios y zonas' }),
});

/** The story, in order (HANDOFF "Orden de prueba de toda la historia"). */
export const STORY: readonly StoryStep[] = [
  { id: 'heart', scope: 'world', done: (v) => !!v.world.heart, show: (v) => ({ icon: '🌳', text: `Planta el ${NAMES.heart} (${k(v, '🌳', 'G')})`, target: null, help: `${NAMES.heart} y asedios` }) },
  shrineStep('shrines-forest', SHRINE_IDS.forest, NAMES.biomeForest),
  { id: 'boss-forest', scope: 'world', done: (v) => v.world.story.bosses[0], show: (v) => ({ icon: '🌀', text: `Entra en la ${NAMES.forestRoot}`, target: v.places.forestDoor, help: 'Mazmorras' }) },
  { id: 'vine', scope: 'player', done: (v) => v.self.vine, show: (v) => ({ icon: '🌿', text: `Coge la ${NAMES.powerVine} en la ${NAMES.forestRoot}`, target: v.places.forestDoor, help: 'Poderes' }) },
  { id: 'deer', scope: 'player', done: (v) => v.self.deer || v.self.star, show: (v) => ({ icon: '🦌', text: `Doma ${NAMES.deer} del halo dorado`, target: v.places.deer, help: 'Monturas' }) },
  { id: 'invasion1', scope: 'world', done: (v) => v.world.story.inv[0] === 2, show: (v) => ({ icon: '🌑', text: `Al atardecer viene ${NAMES.villain}. Defiende el ${NAMES.heart}`, target: v.world.heart, help: NAMES.villain }) },
  { id: 'fish', scope: 'player', done: (v) => v.self.fish, show: (v) => ({ icon: '🐟', text: `Doma ${NAMES.fish} en ${NAMES.biomeCoast}`, target: v.places.fish, help: 'Monturas' }) },
  shrineStep('shrines-coast', SHRINE_IDS.coast, NAMES.biomeCoast),
  {
    id: 'invasion2',
    scope: 'world',
    done: (v) => v.world.story.inv[1] === 3,
    show: (v) =>
      v.world.story.inv[1] === 2
        ? { icon: '⚓', text: `Rompe las anclas y abre la jaula ${de(`el ${NAMES.bossForestShort}`)}`, target: v.places.cage, help: NAMES.villain }
        : { icon: '🌑', text: `Al atardecer vuelve ${NAMES.villain}. Quédate junto al ${NAMES.heart}`, target: v.world.heart, help: NAMES.villain },
  },
  { id: 'whale', scope: 'world', done: (v) => v.world.whale, show: (v) => ({ icon: '🐋', text: `Doma ${NAMES.whale}. Hacen falta dos`, target: v.places.whale, help: 'Monturas' }) },
  { id: 'wind', scope: 'player', done: (v) => v.self.wind, show: (v) => ({ icon: '🌬️', text: `Mazmorra ${de(NAMES.biomeCoast)}: el ${NAMES.powerWind}`, target: v.places.coastDoor, help: 'Mazmorras' }) },
  { id: 'boss-coast', scope: 'world', done: (v) => v.world.story.bosses[1], show: (v) => ({ icon: '🦗', text: `Vence ${al(NAMES.bossCoast.replace(/^El /, 'el '))}`, target: v.places.coastDoor, help: 'Mazmorras' }) },
  { id: 'frog', scope: 'player', done: (v) => v.self.frog, show: (v) => ({ icon: '🐸', text: `Doma ${NAMES.frog} ${de(NAMES.biomeSwamp)}`, target: v.places.frog, help: 'Monturas' }) },
  shrineStep('shrines-swamp', SHRINE_IDS.swamp, NAMES.biomeSwamp),
  { id: 'fire', scope: 'player', done: (v) => v.self.fire, show: (v) => ({ icon: '🔥', text: `Mazmorra ${de(NAMES.biomeSwamp)}: el ${NAMES.powerFire}`, target: v.places.swampDoor, help: 'Mazmorras' }) },
  { id: 'boss-swamp', scope: 'world', done: (v) => v.world.story.bosses[2], show: (v) => ({ icon: '🦟', text: `Vence ${al(NAMES.bossSwamp.replace(/^El /, 'el '))}`, target: v.places.swampDoor, help: 'Mazmorras' }) },
  { id: 'knot', scope: 'world', done: (v) => v.world.zarzal, show: (v) => ({ icon: '🔥', text: `Quema el nudo ${de(NAMES.swampGate)}`, target: v.places.knot, help: 'Poderes' }) },
  shrineStep('shrines-mountain', SHRINE_IDS.mountain, NAMES.biomeMountains),
  { id: 'stone', scope: 'player', done: (v) => v.self.stone, show: (v) => ({ icon: '🪨', text: `Mazmorra ${de(NAMES.biomeMountains)}: la ${NAMES.powerStone}`, target: v.places.mountainDoor, help: 'Mazmorras' }) },
  { id: 'boss-mountain', scope: 'world', done: (v) => v.world.story.bosses[3], show: (v) => ({ icon: '🍦', text: `Vence ${al(NAMES.bossMountain.replace(/^El /, 'el '))}`, target: v.places.mountainDoor, help: 'Mazmorras' }) },
  { id: 'escalera', scope: 'world', done: (v) => v.world.escalera, show: (v) => ({ icon: '🪜', text: `Levanta ${NAMES.stairs}`, target: v.places.umbral, help: 'Poderes' }) },
  { id: 'dragon', scope: 'player', done: (v) => v.self.dragon, show: (v) => ({ icon: '🐉', text: `Salta desde ${NAMES.peak} y doma ${NAMES.dragon} en la tormenta`, target: v.places.pico, help: 'Monturas' }) },
  { id: 'fog', scope: 'world', done: (v) => v.world.fog === 'open', show: (v) => ({ icon: '🌫️', text: `Vuela con ${NAMES.dragon} a la niebla ${de(NAMES.rim)}`, target: v.places.rim, help: 'Monturas' }) },
  { id: 'ceniza', scope: 'world', done: (v) => v.world.ceniza, show: (v) => ({ icon: '🔥', text: `Enciende la ${NAMES.fogata} de ${NAMES.ash}`, target: v.places.ceniza, help: 'Fogatas' }) },
  {
    id: 'pillars',
    scope: 'world',
    done: (v) => v.world.pillars.length > 0 && v.world.pillars.every(Boolean),
    show: (v) => {
      const left = v.places.pillars.filter((_, i) => !v.world.pillars[i]);
      return { icon: '🌲', text: `Rompe los Pilares-raíz (${4 - left.length}/4)`, target: nearest(v.me, left), help: 'Poderes' };
    },
  },
  { id: 'invasion3', scope: 'world', done: (v) => v.world.story.inv[2] === 2 || v.world.towerOpen, show: (v) => ({ icon: '🌑', text: `${NAMES.villain} va a por el ${NAMES.heart}. Aguanta hasta el alba`, target: v.world.heart, help: NAMES.villain }) },
  { id: 'tower', scope: 'world', done: (v) => v.world.ending, show: (v) => ({ icon: '🗼', text: `Sube a ${NAMES.villainTower}. Arriba espera ${NAMES.villain}`, target: v.places.tower, help: NAMES.villain }) },
  { id: 'star', scope: 'player', done: (v) => v.self.star, show: (v) => ({ icon: '⭐', text: `En luna llena, doma ${NAMES.legendary} en ${NAMES.ash}`, target: v.places.estrella, help: 'Monturas' }) },
];

function toStep(s: StoryStep, v: GuideView): Step {
  return { id: s.id, scope: s.scope, ...s.show(v) };
}

/** One secondary (spec §7.2): oficio points, a full moon, a purple zone near you. */
function secondary(v: GuideView): Step | null {
  if (v.self.skillPts > 0) return { id: 'skills', scope: 'player', icon: '🌱', text: `${v.self.skillPts === 1 ? 'Tienes 1 punto' : `Tienes ${v.self.skillPts} puntos`} de oficio (Menú › ${NAMES.book})`, target: null };
  if (v.world.fullMoon && v.world.ending && !v.self.star) return { id: 'moon', scope: 'world', icon: '🌕', text: 'Luna llena esta noche', target: v.places.estrella };
  const z = nearest(v.me, v.world.zones);
  if (z && dist(v.me, z) <= GUIDE.zoneNear) return { id: 'zone', scope: 'world', icon: '🟣', text: 'Zona morada', target: z, help: 'Santuarios y zonas' };
  return null;
}

/** The first story step not done; a secondary only when the story is over or far and the secondary is close. */
export function nextStep(v: GuideView): Step | null {
  const s = STORY.find((st) => !st.done(v));
  if (!s) return secondary(v);
  const step = toStep(s, v);
  if (step.target && dist(v.me, step.target) > GUIDE.far) {
    const sec = secondary(v);
    if (sec?.target && dist(v.me, sec.target) <= GUIDE.zoneNear) return sec;
  }
  return step;
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

/** Distance and an arrow relative to the camera (yaw 0 looks toward −Z, like CameraRig). */
export function bearing(me: Pt, yaw: number, t: Pt): { m: number; arrow: string; angle: number } {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const fwd = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const angle = Math.atan2(right, fwd);
  const i = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return { m: Math.hypot(dx, dz), arrow: ARROWS[i]!, angle };
}

/** "✨ Santuario del Bosque · 120 m ↗ (Bea está allí)". */
export function lineText(s: Step, v: GuideView, yaw: number): string {
  let out = `${s.icon} ${s.text}`;
  if (s.target) {
    const b = bearing(v.me, yaw, s.target);
    out += b.m < GUIDE.here ? ' · aquí' : ` · ${Math.round(b.m / 10) * 10 || Math.round(b.m)} m ${b.arrow}`;
    const f = v.friends.find((o) => dist(o, s.target!) <= GUIDE.friend);
    if (f) out += ` (${f.name} está allí)`;
  }
  return out;
}

/**
 * The edge arrow (spec §7.1): null while the target is on screen; else a point `pad` px inside the screen edge
 * toward it and a rotation in degrees (0 = pointing up). `ndc` from Vector3.project; `behind` when w < 0.
 */
export function edgeArrow(ndcX: number, ndcY: number, behind: boolean, w: number, h: number, pad: number): { x: number; y: number; deg: number } | null {
  let x = ndcX;
  let y = ndcY;
  if (!behind && Math.abs(x) <= 1 && Math.abs(y) <= 1) return null;
  if (behind) {
    // Behind the camera the projection mirrors: flip and push to the bottom.
    x = -x;
    y = -Math.max(1, Math.abs(y));
    if (Math.abs(x) < 1e-6) x = 0;
  }
  const hw = w / 2 - pad;
  const hh = h / 2 - pad;
  // Direction in screen px (y down).
  let sx = x * (w / 2);
  let sy = -y * (h / 2);
  if (sx === 0 && sy === 0) sy = 1;
  const s = Math.min(hw / Math.max(Math.abs(sx), 1e-6), hh / Math.max(Math.abs(sy), 1e-6));
  sx *= s;
  sy *= s;
  const deg = (Math.atan2(sx, -sy) * 180) / Math.PI;
  return { x: w / 2 + sx, y: h / 2 + sy, deg };
}

