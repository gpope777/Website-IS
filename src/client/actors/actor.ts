import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ModelKit } from './models';
import { makeHat } from './hats';
import { COLORS } from '../../shared/progression';
import { poseFor } from './poses';
import type { EnemyLook } from './enemy-look';
import { patchRecolor, patchRim, patchSway } from '../scene/patches';

export interface ClipDef {
  clip: string;
  speed?: number;
  once?: boolean;
  /** V2-E: hold the clip still at this time (s) — the base under a procedural pose. */
  at?: number;
}

export const PLAYER_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Idle' },
  walk: { clip: 'Walking' },
  run: { clip: 'Running' },
  jump: { clip: 'Jump', once: true },
  swim: { clip: 'Walking', speed: 0.5 },
  attack: { clip: 'Punch', once: true },
  // V2-E: the robot kit has no roll/guard/bow/climb/glide/slide clips: the closest clip + bone poses (poses.ts).
  roll: { clip: 'Jump', at: 0.35 },
  block: { clip: 'Idle' },
  bow: { clip: 'Idle' },
  climb: { clip: 'Walking', speed: 0.5 },
  glide: { clip: 'Jump', at: 0.35 },
  slide: { clip: 'Jump', at: 0.35 },
  dead: { clip: 'Death', once: true },
};

export const WOLF_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Survey' },
  walk: { clip: 'Walk' },
  run: { clip: 'Run' },
  attack: { clip: 'Run', speed: 1.6 },
  dead: { clip: 'Survey', speed: 0 },
};

/** P4-C: the robot's head is ~0.8 m wide and its dome tops out ~1.33× past `Head_end` (robot.glb, checked in the browser). */
const HAT_SIZE = 2;
const HAT_LIFT = 1.3;

/** An animated, independently skinned copy of a model kit, with an optional floating name tag. */
export class Actor {
  /** V2-B: a dark disc under the feet when the tier has no shadow map (set by the game before making actors). */
  static shadowDiscs = false;
  /** V2-E: made from a dropped-in model (keeps its own colours: no enemy skin). */
  dropIn = false;
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentName = '';

  constructor(kit: ModelKit, private readonly clips: Record<string, ClipDef>, label?: string) {
    const model = SkeletonUtils.clone(kit.scene);
    model.scale.setScalar(kit.scale);
    model.rotation.y = kit.yawOffset;
    model.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = true;
      const mat = (o as THREE.Mesh).material;
      if (!Array.isArray(mat)) patchRim(mat); // V2-E: shared by every clone, patched once
    });
    this.root.add(model);
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of kit.clips) this.actions.set(c.name, this.mixer.clipAction(c));
    if (label) this.root.add(nameTag(label));
    if (Actor.shadowDiscs) this.root.add(shadowDisc());
    this.play('idle');
  }

  private readonly model: THREE.Object3D;
  private tint: THREE.MeshStandardMaterial | null = null;
  private hat: THREE.Mesh | null = null;
  private lookKey = '0:0';

  /** P4-C: colour (a per-actor copy of `Main`, made on the first non-default colour) and a hat on the `Head` bone. */
  setLook(color: number, hat: number): void {
    const key = `${color}:${hat}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const original = (m.userData.main as THREE.MeshStandardMaterial | undefined) ?? (mat.name === 'Main' ? mat : null);
      if (!original) return;
      m.userData.main = original;
      if (color === 0) {
        m.material = original;
        return;
      }
      if (!this.tint) {
        this.tint = original.clone();
        this.tint.userData = {};
        patchRim(this.tint);
      }
      this.tint.color.setHex(COLORS[color] ?? COLORS[0]!);
      m.material = this.tint;
    });
    if (this.hat) this.hat.removeFromParent();
    this.hat = makeHat(hat);
    if (this.hat) this.attachHat(this.hat);
  }

  private attachHat(hat: THREE.Mesh): void {
    let head: THREE.Object3D | undefined;
    this.model.traverse((o) => {
      if (!head && o.name === 'Head' && o.children.some((c) => c.name === 'Head_end')) head = o;
    });
    if (!head) {
      hat.position.y = 1.85;
      this.root.add(hat);
      return;
    }
    const tip = head.children.find((c) => c.name === 'Head_end');
    this.root.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    head.getWorldScale(s);
    const rs = new THREE.Vector3();
    this.root.getWorldScale(rs);
    hat.scale.setScalar((HAT_SIZE * rs.x) / s.x);
    if (tip) {
      hat.position.copy(tip.position).multiplyScalar(HAT_LIFT);
      hat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.position.clone().normalize());
    }
    head.add(hat);
  }

  private glider: THREE.Object3D | null = null;
  private cape: THREE.Mesh | null = null;
  private torch: THREE.Object3D | null = null;

  /** Capa de corteza: a bark cape on the back, longer per level (models share materials: no tint). */
  setCapa(lvl: number): void {
    if (lvl <= 0 && !this.cape) return;
    if (!this.cape) this.root.add((this.cape = makeCape()));
    this.cape.visible = lvl > 0;
    this.cape.scale.y = 0.6 + 0.2 * Math.min(3, lvl);
  }

  private glow: THREE.Mesh | null = null;
  private glowLeft = 0;

  /** P4-A: a short green glow round the robot (a Rango up), seen by everyone. Its own material: models share theirs. */
  flash(seconds: number): void {
    if (!this.glow) {
      this.glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7dff7a, transparent: true, opacity: 0.35, depthWrite: false }));
      this.glow.position.y = 1;
      this.root.add(this.glow);
    }
    this.glowLeft = seconds;
    this.glow.visible = true;
  }

  /** A torch from the Candiles post, held up by the right hand. */
  setTorch(on: boolean): void {
    if (!on && !this.torch) return;
    if (!this.torch) this.root.add((this.torch = makeTorch()));
    this.torch.visible = on;
  }

  play(anim: string): void {
    if (anim === this.currentName) return;
    if (anim === 'glide' && !this.glider) this.root.add((this.glider = makeGlider()));
    if (this.glider) this.glider.visible = anim === 'glide';
    const def = this.clips[anim] ?? this.clips.idle!;
    const next = this.actions.get(def.clip);
    if (!next) return;
    this.currentName = anim;
    next.reset();
    next.setEffectiveTimeScale(def.at !== undefined ? 0 : (def.speed ?? 1));
    if (def.at !== undefined) next.time = def.at;
    this.animT = 0;
    next.setLoop(def.once ? THREE.LoopOnce : THREE.LoopRepeat, def.once ? 1 : Infinity);
    next.clampWhenFinished = !!def.once;
    next.play();
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, 0.2, false);
    this.current = next;
  }

  private animT = 0;
  /** Harness only: freeze the procedural pose at this time (s). */
  holdPoseAt: number | null = null;
  private bones: Map<string, THREE.Object3D> | null = null;
  /** Bones offset last frame → their quaternion before the offset. */
  private readonly posed = new Map<THREE.Object3D, THREE.Quaternion>();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  /** V2-E: bone offsets on top of the clip (spec §6.4); the whole model tilts about its middle. */
  private applyPose(t: number): void {
    const p = poseFor(this.currentName, t);
    const m = this.model;
    if (!p) {
      if (m.rotation.x !== 0 || m.position.y !== 0 || m.position.z !== 0) {
        m.rotation.x = 0;
        m.position.set(0, 0, 0);
      }
      return;
    }
    if (!this.bones) {
      this.bones = new Map();
      m.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        // GLTFLoader renames clashing nodes (the robot's `Torso` bone is `Torso_1`): keep both spellings.
        for (const n of [o.name, o.name.replace(/_\d+$/, '')]) if (!this.bones!.has(n)) this.bones!.set(n, o);
      });
    }
    for (const [name, r] of Object.entries(p.bones)) {
      const b = this.bones.get(name);
      if (!b) continue;
      this.posed.set(b, b.quaternion.clone());
      b.quaternion.multiply(this.q.setFromEuler(this.e.set(r[0], r[1], r[2])));
    }
    const h = 0.9; // turn about the middle of a 1.8 m robot
    m.rotation.x = p.rootX;
    m.position.set(0, h - h * Math.cos(p.rootX) + p.rootY, -h * Math.sin(p.rootX));
  }

  private skinKey = '';
  private static readonly skins = new Map<string, THREE.Material>();
  /** V2-E: a colour per enemy type — one shared material per look (spec §6.2), made from the model's own. */
  setSkin(look: EnemyLook): void {
    if (look.key === this.skinKey) return;
    this.skinKey = look.key;
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const base = (m.userData.skinBase as THREE.MeshStandardMaterial | undefined) ?? (m.material as THREE.MeshStandardMaterial);
      m.userData.skinBase = base;
      const k = `${base.uuid}:${look.key}`;
      let mat = Actor.skins.get(k) as THREE.MeshStandardMaterial | undefined;
      if (!mat) {
        mat = base.clone();
        mat.userData = {};
        mat.color.setHex(look.color);
        if (mat.emissive) mat.emissive.setHex(look.emissive);
        patchRecolor(mat);
        patchRim(mat);
        Actor.skins.set(k, mat);
      }
      m.material = mat;
    });
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  update(dt: number): void {
    // Bones a clip does not animate (the robot's Torso; the arms in Idle) keep whatever we set: restore them first.
    for (const [b, q] of this.posed) b.quaternion.copy(q);
    this.posed.clear();
    this.mixer.update(dt);
    this.animT += dt;
    this.applyPose(this.holdPoseAt ?? this.animT);
    if (this.glow && this.glowLeft > 0) {
      this.glowLeft -= dt;
      if (this.glowLeft <= 0) this.glow.visible = false;
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.tint?.dispose();
    this.tint = null;
    this.root.removeFromParent();
  }
}

let gliderMat: THREE.MeshLambertMaterial | null = null;
/** A leaf-cloth canopy over the head, shown while the anim is 'glide' (so teammates see it too). V2-E: a 4×2 cloth that flutters in the wind. */
function makeGlider(): THREE.Object3D {
  const geo = new THREE.PlaneGeometry(2.8, 1.3, 4, 2);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position!;
  for (let i = 0; i < p.count; i++) p.setY(i, -0.12 * (p.getX(i) / 1.4) ** 2 + 0.08 * Math.cos((p.getZ(i) / 0.65) * 1.2)); // arched
  geo.computeVertexNormals();
  if (!gliderMat) {
    gliderMat = new THREE.MeshLambertMaterial({ color: 0x6fae4a, side: THREE.DoubleSide });
    patchSway(gliderMat, { base: -1, span: 1, amp: 0.18, flap: true, waves: 1 });
  }
  const cloth = new THREE.Mesh(geo, gliderMat);
  cloth.position.y = 2.45;
  return cloth;
}

const BARK = new THREE.MeshLambertMaterial({ color: 0x6b4a2b, flatShading: true });
function makeCape(): THREE.Mesh {
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.08), BARK);
  cape.position.set(0, 1.05, -0.32);
  return cape;
}

function makeTorch(): THREE.Object3D {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5), BARK);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, fog: false }));
  flame.position.y = 0.55;
  g.add(stick, flame);
  g.position.set(0.4, 1.3, 0.25);
  return g;
}

function nameTag(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 32);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.25;
  return sprite;
}

let discGeo: THREE.CircleGeometry | null = null;
let discMat: THREE.MeshBasicMaterial | null = null;
/** One shared geometry and material for every disc (spec §5.2: low has no shadow map). */
export function shadowDisc(r = 0.55): THREE.Mesh {
  discGeo ??= new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  discMat ??= new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const m = new THREE.Mesh(discGeo, discMat);
  m.name = 'shadow-disc';
  m.scale.setScalar(r);
  m.position.y = 0.05;
  m.renderOrder = 1;
  return m;
}
