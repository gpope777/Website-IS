import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ClipDef } from './actor';
import { DROP_INS, dropInClip, type DropIn } from './drop-ins';
import type { ModelKit } from './models';

/** Clip table for an `Actor` made from a dropped-in model (wolf.glb, brute.glb). */
export function dropInClips(kit: ModelKit, name: DropIn): Record<string, ClipDef> {
  const names = kit.clips.map((c) => c.name);
  const c = DROP_INS[name].clips;
  const pick = (w: string) => dropInClip(names, w) ?? '';
  return { idle: { clip: pick(c.idle) }, walk: { clip: pick(c.walk) }, run: { clip: pick(c.run) }, attack: { clip: pick('Attack') || pick(c.run), once: true }, dead: { clip: pick('Death') || pick(c.idle), once: true } };
}

/** A dropped-in creature model (deer.glb, fish.glb…) in place of the procedural one: idle / walk / run by speed. */
export class DropInPuppet {
  readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Record<'idle' | 'walk' | 'run', THREE.AnimationAction | null>;
  private current: THREE.AnimationAction | null = null;

  constructor(kit: ModelKit, name: DropIn, shadows: boolean) {
    const m = SkeletonUtils.clone(kit.scene);
    m.scale.setScalar(kit.scale);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = shadows;
    });
    this.root = m;
    this.mixer = new THREE.AnimationMixer(m);
    const names = kit.clips.map((c) => c.name);
    const act = (w: string) => {
      const n = dropInClip(names, w);
      const c = kit.clips.find((k) => k.name === n);
      return c ? this.mixer.clipAction(c) : null;
    };
    const c = DROP_INS[name].clips;
    this.clips = { idle: act(c.idle), walk: act(c.walk), run: act(c.run) };
  }

  update(dt: number, speed: number): void {
    const next = speed > 6 ? this.clips.run : speed > 0.3 ? this.clips.walk : this.clips.idle;
    if (next && next !== this.current) {
      next.reset().play();
      if (this.current) next.crossFadeFrom(this.current, 0.25, false);
      this.current = next;
    }
    this.mixer.update(dt);
  }
}
