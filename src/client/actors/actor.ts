import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ModelKit } from './models';
import { makeHat } from './hats';
import { COLORS } from '../../shared/progression';

export interface ClipDef {
  clip: string;
  speed?: number;
  once?: boolean;
}

export const PLAYER_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Idle' },
  walk: { clip: 'Walking' },
  run: { clip: 'Running' },
  jump: { clip: 'Jump', once: true },
  swim: { clip: 'Walking', speed: 0.5 },
  attack: { clip: 'Punch', once: true },
  // The robot kit has no roll/guard/bow clips: placeholders until real animations exist.
  roll: { clip: 'WalkJump', speed: 1.6, once: true },
  block: { clip: 'Idle', speed: 0.3 },
  bow: { clip: 'Punch', speed: 0.7, once: true },
  climb: { clip: 'Punch', speed: 0.6 },
  glide: { clip: 'Jump', speed: 0.4, once: true },
  // ponytail: no belly-slide clip in the robot kit; a held jump pose until real animations exist.
  slide: { clip: 'Jump', speed: 0.6, once: true },
  dead: { clip: 'Death', once: true },
};

export const WOLF_CLIPS: Record<string, ClipDef> = {
  idle: { clip: 'Survey' },
  walk: { clip: 'Walk' },
  run: { clip: 'Run' },
  attack: { clip: 'Run', speed: 1.6 },
  dead: { clip: 'Survey', speed: 0 },
};

/** An animated, independently skinned copy of a model kit, with an optional floating name tag. */
export class Actor {
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
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.root.add(model);
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of kit.clips) this.actions.set(c.name, this.mixer.clipAction(c));
    if (label) this.root.add(nameTag(label));
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
      if (!this.tint) this.tint = original.clone();
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
    hat.scale.setScalar(rs.x / s.x);
    if (tip) {
      hat.position.copy(tip.position);
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
    next.setEffectiveTimeScale(def.speed ?? 1);
    next.setLoop(def.once ? THREE.LoopOnce : THREE.LoopRepeat, def.once ? 1 : Infinity);
    next.clampWhenFinished = !!def.once;
    next.play();
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, 0.2, false);
    this.current = next;
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  update(dt: number): void {
    this.mixer.update(dt);
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

/** A leaf-cloth canopy over the head, shown while the anim is 'glide' (so teammates see it too). */
function makeGlider(): THREE.Object3D {
  const cloth = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 0.45, 4, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x6fae4a, side: THREE.DoubleSide }),
  );
  cloth.scale.set(1.4, 1, 0.8);
  cloth.rotation.y = Math.PI / 4;
  cloth.position.y = 2.5;
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
