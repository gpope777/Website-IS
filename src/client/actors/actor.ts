import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ModelKit } from './models';

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
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of kit.clips) this.actions.set(c.name, this.mixer.clipAction(c));
    if (label) this.root.add(nameTag(label));
    this.play('idle');
  }

  play(anim: string): void {
    if (anim === this.currentName) return;
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
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
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
