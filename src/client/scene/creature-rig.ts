import * as THREE from 'three';

/**
 * V2-E: the low-poly procedural creatures (spec §6.1). Each is one non-indexed triangle soup with a colour
 * and a `part` per vertex; the vertex shader (patches.ts `patchRig`) turns each part about its pivot by the
 * pose's rotations ("fake bones", no skeleton), then the whole body by part 0, plus a sideways S-wave.
 * Everything here is pure maths so the shapes and the motion can be tested without a GPU.
 */
export type CreatureKind = 'deer' | 'fish' | 'frog' | 'whale';
export const PART = { body: 0, legFL: 1, legFR: 2, legBL: 3, legBR: 4, tail: 5, head: 6, fin: 7 } as const;
export const PARTS = 8;

export type V3 = [number, number, number];

export interface RigGeometry {
  position: Float32Array;
  color: Float32Array;
  part: Float32Array;
  /** Pivot of each part (model space: +Z forward, +Y up). */
  pivots: V3[];
  /** The S-wave runs from `waveZ[0]` (head, still) back over `waveZ[1]` metres. */
  waveZ: [number, number];
}

export interface RigPose {
  /** Euler X, Y, Z (applied X·Y·Z) per part. Part 0 turns everything. */
  rot: V3[];
  /** Amplitude (m), spatial frequency (rad/m), phase (rad). */
  wave: V3;
  /** Whole-body lift (m). */
  lift: number;
}

export const TRI_CAP: Record<CreatureKind, number> = { deer: 900, fish: 500, frog: 700, whale: 1200 };

type ColorFn = (x: number, y: number, z: number) => number;

class Soup {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly prt: number[] = [];
  private readonly c = new THREE.Color();

  add(geo: THREE.BufferGeometry, part: number, color: number | ColorFn, m?: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      this.pos.push(x, y, z);
      this.c.setHex(typeof color === 'number' ? color : color(x, y, z));
      this.col.push(this.c.r, this.c.g, this.c.b);
      this.prt.push(part);
    }
    g.dispose();
    if (g !== geo) geo.dispose();
  }

  done(pivots: V3[], waveZ: [number, number]): RigGeometry {
    return { position: new Float32Array(this.pos), color: new Float32Array(this.col), part: new Float32Array(this.prt), pivots, waveZ };
  }
}

const M = () => new THREE.Matrix4();
/** Translate · rotate(x, y, z) · scale. */
function trs(t: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): THREE.Matrix4 {
  return M().compose(new THREE.Vector3(...t), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
}
/** A lathe along +Z: `profile` = [radius, z] from tail to nose. */
function latheZ(profile: [number, number][], seg: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.0001), z)), seg);
  g.rotateX(Math.PI / 2); // lathe axis Y → Z
  return g;
}
/** A tapered limb from (0,0,0) down to (0,-len,0). */
function limb(r0: number, r1: number, len: number, seg = 5): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1, false);
  g.translate(0, -len / 2, 0);
  return g;
}
/** A flat two-sided triangle fan (fins): points in the plane given. */
function flat(pts: V3[]): THREE.BufferGeometry {
  const a: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const t = [pts[0]!, pts[i]!, pts[i + 1]!];
    for (const p of t) a.push(...p);
    for (const p of [t[0]!, t[2]!, t[1]!]) a.push(...p);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  return g;
}
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function deer(): RigGeometry {
  const s = new Soup();
  const HIDE = 0x8a5a33;
  const BELLY = 0xd9c3a0;
  const HORN = 0xefe6d2;
  const DARK = 0x3a2616;
  // Body: a lathe, belly lighter underneath.
  s.add(latheZ([[0.02, -1.0], [0.3, -0.85], [0.42, -0.4], [0.44, 0.2], [0.4, 0.7], [0.3, 0.95], [0.02, 1.02]], 8), PART.body, (_x, y) => (y < 1.08 ? BELLY : HIDE), trs([0, 1.25, 0], [0, 0, 0], [0.95, 0.85, 1]));
  s.add(new THREE.ConeGeometry(0.12, 0.3, 4), PART.tail, BELLY, trs([0, 1.4, -1.0], [-2.2, 0, 0])); // tail
  // Legs: thigh + shin as one tapered limb, dark hoof.
  const legs: [number, V3][] = [[PART.legFL, [-0.24, 1.05, 0.62]], [PART.legFR, [0.24, 1.05, 0.62]], [PART.legBL, [-0.24, 1.1, -0.62]], [PART.legBR, [0.24, 1.1, -0.62]]];
  for (const [p, at] of legs) {
    s.add(limb(0.12, 0.06, at[1] - 0.1), p, HIDE, trs(at));
    s.add(limb(0.07, 0.08, 0.1, 4), p, DARK, trs([at[0], 0.1, at[2]]));
  }
  // Neck + head (part 6, pivot at the base of the neck).
  s.add(limb(0.16, 0.13, 0.8, 6), PART.head, HIDE, trs([0, 1.4, 0.8], [-2.6, 0, 0]));
  s.add(new THREE.ConeGeometry(0.2, 0.62, 6), PART.head, HIDE, trs([0, 2.12, 1.33], [1.9, 0, 0], [1, 1, 0.9])); // snout forward
  s.add(new THREE.SphereGeometry(0.05, 4, 3), PART.head, DARK, trs([0, 2.02, 1.62])); // nose
  for (const k of [-1, 1]) {
    s.add(new THREE.ConeGeometry(0.08, 0.28, 4), PART.head, HIDE, trs([k * 0.2, 2.35, 1.08], [0, 0, k * -1.1])); // ears
    // Antlers: a beam and three tines.
    const base: V3 = [k * 0.1, 2.3, 1.12];
    s.add(limb(0.035, 0.025, 0.55, 4), PART.head, HORN, trs(base, [0, 0, k * 2.6]));
    s.add(limb(0.03, 0.02, 0.4, 4), PART.head, HORN, trs([k * 0.33, 2.75, 1.12], [0.5, 0, k * 2.9]));
    s.add(limb(0.025, 0.015, 0.35, 4), PART.head, HORN, trs([k * 0.24, 2.62, 1.12], [-0.6, 0, k * 3.0]));
    s.add(limb(0.025, 0.015, 0.3, 4), PART.head, HORN, trs([k * 0.4, 2.9, 1.1], [0, 0, k * 2.4]));
  }
  const pivots: V3[] = [[0, 1.1, 0], ...legs.map(([, at]) => at), [0, 1.2, -0.95], [0, 1.45, 0.8], [0, 0, 0]];
  return s.done(pivots, [1, 2]);
}

function fish(): RigGeometry {
  const s = new Soup();
  const SCALES = 0x3f7fa6;
  const BELLY = 0xcfe3e8;
  const FIN = 0xe0a24a;
  s.add(latheZ([[0.02, -1.4], [0.25, -1.1], [0.5, -0.4], [0.6, 0.4], [0.55, 1.1], [0.38, 1.6], [0.12, 1.9], [0.02, 1.95]], 8), PART.body, (_x, y) => (y < -0.1 ? BELLY : SCALES), trs([0, 0.1, 0], [0, 0, 0], [0.9, 0.85, 1]));
  s.add(new THREE.SphereGeometry(0.08, 4, 3), PART.head, 0x1a1a1a, trs([0.36, 0.3, 1.45]));
  s.add(new THREE.SphereGeometry(0.08, 4, 3), PART.head, 0x1a1a1a, trs([-0.36, 0.3, 1.45]));
  s.add(flat([[0, 0.1, -1.3], [0, 0.75, -2.1], [0, 0.2, -1.85], [0, -0.45, -2.1]]), PART.tail, FIN); // tail fin
  s.add(flat([[0, 0.5, 0.6], [0, 1.05, -0.2], [0, 0.45, -0.8]]), PART.body, FIN); // back fin
  for (const k of [-1, 1]) s.add(flat([[k * 0.5, -0.05, 0.8], [k * 0.95, -0.25, 0.5], [k * 0.5, -0.1, 0.3]]), PART.fin, FIN);
  const pivots: V3[] = [[0, 0.1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0.1, -1.3], [0, 0.1, 1.2], [0, -0.05, 0.6]];
  return s.done(pivots, [1.2, 3.2]);
}

function frog(): RigGeometry {
  const s = new Soup();
  const SKIN = 0x5f8f3a;
  const DARK = 0x2f4a22;
  const EYE = 0xf2e6a0;
  s.add(new THREE.SphereGeometry(1, 8, 6), PART.body, (_x, y) => (y < 0.35 ? 0xb8c878 : hash(_x, y, 0) > 0.8 ? DARK : SKIN), trs([0, 0.55, 0], [0.25, 0, 0], [0.85, 0.45, 1.0]));
  s.add(new THREE.SphereGeometry(1, 8, 5), PART.head, SKIN, trs([0, 0.7, 0.95], [0, 0, 0], [0.7, 0.32, 0.5]));
  for (const k of [-1, 1]) {
    s.add(new THREE.SphereGeometry(0.2, 6, 4), PART.head, EYE, trs([k * 0.42, 1.0, 1.05]));
    s.add(new THREE.SphereGeometry(0.09, 4, 3), PART.head, 0x101010, trs([k * 0.5, 1.05, 1.18]));
    // Back legs: a thick thigh folded along the flank + foot.
    const bl = k < 0 ? PART.legBL : PART.legBR;
    s.add(new THREE.SphereGeometry(1, 6, 4), bl, DARK, trs([k * 0.85, 0.4, -0.45], [0.3, 0, 0], [0.26, 0.28, 0.65]));
    s.add(new THREE.BoxGeometry(0.35, 0.08, 0.6), bl, DARK, trs([k * 0.95, 0.05, -0.2]));
    const fl = k < 0 ? PART.legFL : PART.legFR;
    s.add(limb(0.1, 0.08, 0.4, 4), fl, DARK, trs([k * 0.55, 0.42, 0.75]));
    s.add(new THREE.BoxGeometry(0.25, 0.06, 0.3), fl, DARK, trs([k * 0.58, 0.03, 0.85]));
  }
  const pivots: V3[] = [[0, 0.3, 0], [-0.55, 0.42, 0.75], [0.55, 0.42, 0.75], [-0.75, 0.45, -0.1], [0.75, 0.45, -0.1], [0, 0, 0], [0, 0.6, 0.6], [0, 0, 0]];
  return s.done(pivots, [0, 1]);
}

function whale(): RigGeometry {
  const s = new Soup();
  const SKIN = 0x3a4f6b;
  const BELLY = 0xd9dfe6;
  const BARN = 0x9aa3a8;
  s.add(latheZ([[0.05, -4.6], [0.5, -4.0], [1.1, -2.6], [1.7, -0.8], [1.85, 1.2], [1.7, 3.0], [1.3, 4.3], [0.6, 5.0], [0.05, 5.15]], 10), PART.body, (x, y, z) => (y < -0.2 ? (Math.floor(z * 2.2) % 2 === 0 ? BELLY : 0xc2c9d2) : y > 1.3 && hash(x, y, z) > 0.72 ? BARN : SKIN), trs([0, 0.4, 0], [0, 0, 0], [1, 0.8, 1]));
  s.add(flat([[0, 0.4, -4.3], [-2.2, 0.55, -5.6], [-0.4, 0.4, -5.1], [0, 0.4, -4.9], [0.4, 0.4, -5.1], [2.2, 0.55, -5.6]]).rotateZ(0), PART.tail, SKIN);
  for (const k of [-1, 1]) s.add(flat([[k * 1.5, -0.2, 2.2], [k * 2.9, -0.6, 1.1], [k * 1.6, -0.4, 1.0]]), PART.fin, SKIN);
  s.add(flat([[0, 1.7, -1.4], [0, 2.3, -2.3], [0, 1.4, -2.6]]), PART.body, SKIN); // small dorsal hump
  for (const k of [-1, 1]) s.add(new THREE.SphereGeometry(0.12, 4, 3), PART.head, 0x101010, trs([k * 1.35, 0.3, 3.6]));
  const pivots: V3[] = [[0, 0.4, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0.4, -3.8], [0, 0.4, 3], [0, -0.3, 1.6]];
  return s.done(pivots, [2.5, 7]);
}

const BUILD: Record<CreatureKind, () => RigGeometry> = { deer, fish, frog, whale };
const cache = new Map<CreatureKind, RigGeometry>();
/** The creature's triangle soup (cached: every instance shares one geometry). */
export function buildCreature(kind: CreatureKind): RigGeometry {
  let g = cache.get(kind);
  if (!g) cache.set(kind, (g = BUILD[kind]()));
  return g;
}

const zero = (): V3[] => Array.from({ length: PARTS }, () => [0, 0, 0] as V3);

/** El Ciervo: diagonal leg pairs by the step phase, head bobbing at speed or grazing when still, bucking. */
export function deerPose(phase: number, speed: number, bucking: boolean, now: number, seed = 0): RigPose {
  const rot = zero();
  const moving = speed > 0.3;
  const amp = moving ? Math.min(0.75, 0.3 + speed * 0.04) : 0;
  const sw = Math.sin(phase) * amp;
  rot[PART.legFL]![0] = sw;
  rot[PART.legBR]![0] = sw;
  rot[PART.legFR]![0] = -sw;
  rot[PART.legBL]![0] = -sw;
  rot[PART.head]![0] = moving ? -0.05 + Math.sin(phase * 2) * 0.08 : 0.45 + Math.sin(now * 0.8 + seed) * 0.25; // + = down
  rot[PART.tail]![0] = Math.sin(now * 3 + seed) * 0.2;
  let lift = moving ? Math.abs(Math.sin(phase)) * Math.min(0.12, speed * 0.01) : 0;
  if (bucking) {
    rot[PART.body]![0] = Math.sin(now * 9) * 0.35;
    lift = Math.abs(Math.sin(now * 9)) * 0.3;
  }
  return { rot, wave: [0, 0, 0], lift };
}

/** El Pez Grande: an S-wave down the body, faster with speed; thrashing while calmed. */
export function fishPose(phase: number, speed: number, bucking: boolean, now: number): RigPose {
  const rot = zero();
  rot[PART.tail]![1] = Math.sin(phase - 1.2) * 0.45;
  rot[PART.fin]![2] = Math.sin(now * 4) * 0.15;
  if (bucking) rot[PART.body]![2] = Math.sin(now * 10) * 0.5;
  return { rot, wave: [0.14 + Math.min(speed, 14) * 0.006, 1.6, phase], lift: 0 };
}

/** La Rana: legs folded, kicked out while it hops; a throat that pulses while wild; bucking while calmed. */
export function frogPose(moving: boolean, wild: boolean, bucking: boolean, now: number): RigPose & { throat: number } {
  const rot = zero();
  const hop = moving ? Math.max(0, Math.sin(now * 6)) : 0;
  rot[PART.legBL]![0] = hop * 0.9;
  rot[PART.legBR]![0] = hop * 0.9;
  rot[PART.legFL]![0] = -hop * 0.4;
  rot[PART.legFR]![0] = -hop * 0.4;
  rot[PART.head]![0] = -Math.sin(now * 1.3) * 0.04;
  if (bucking) rot[PART.body]![2] = Math.sin(now * 11) * 0.45;
  else rot[PART.body]![0] = -hop * 0.2;
  return { rot, wave: [0, 0, 0], lift: hop * 0.5, throat: wild ? 1 + Math.max(0, Math.sin(now * 3)) * 0.6 : 1 };
}

/** La Ballena: a slow S-wave and the fluke going up and down. */
export function whalePose(now: number): RigPose {
  const rot = zero();
  rot[PART.tail]![0] = Math.sin(now * 1.3) * 0.25;
  rot[PART.fin]![2] = Math.sin(now * 0.9) * 0.12;
  return { rot, wave: [0.18, 0.5, now * 1.3], lift: 0 };
}

function rotate(p: V3, r: V3, piv: V3): V3 {
  let x = p[0] - piv[0];
  let y = p[1] - piv[1];
  let z = p[2] - piv[2];
  // X · Y · Z applied to the column vector: Z first, then Y, then X (same order as the shader).
  let c = Math.cos(r[2]);
  let s = Math.sin(r[2]);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(r[1]);
  s = Math.sin(r[1]);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(r[0]);
  s = Math.sin(r[0]);
  [y, z] = [y * c - z * s, y * s + z * c];
  return [x + piv[0], y + piv[1], z + piv[2]];
}

/** CPU mirror of the rig shader: part rotation, then the S-wave, then the whole body (part 0) and the lift. */
export function rigPoint(p: V3, part: number, g: Pick<RigGeometry, 'pivots' | 'waveZ'>, pose: RigPose): V3 {
  let q = part > 0 ? rotate(p, pose.rot[part]!, g.pivots[part]!) : p;
  const w = Math.min(1, Math.max(0, (g.waveZ[0] - q[2]) / g.waveZ[1]));
  q = [q[0] + pose.wave[0] * w * w * Math.sin(q[2] * pose.wave[1] - pose.wave[2]), q[1], q[2]];
  q = rotate(q, pose.rot[0]!, g.pivots[0]!);
  return [q[0], q[1] + pose.lift, q[2]];
}
