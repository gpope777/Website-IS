import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { settleRestartedAction } from './actor';

/** A minimal two-clip mixer (no GLTF/Actor needed — AnimationMixer works on a bare Object3D). */
function twoClipMixer(): { mixer: THREE.AnimationMixer; a: THREE.AnimationAction; b: THREE.AnimationAction } {
  const root = new THREE.Object3D();
  const bone = new THREE.Object3D();
  bone.name = 'bone';
  root.add(bone);
  const track = () => new THREE.QuaternionKeyframeTrack('bone.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(new THREE.AnimationClip('A', 1, [track()]));
  const b = mixer.clipAction(new THREE.AnimationClip('B', 1, [track()]));
  return { mixer, a, b };
}

// Review fix (Task 2 fix round 1): `AnimationAction.reset()` cancels a crossfade's schedule but does not
// restore weight = 1 or touch the action it was fading from — a same-clip restart mid-crossfade (the rapid
// repeated attack taps Task 4 builds on) could otherwise leave the previous pose blended in for the rest of
// its already-scheduled ~0.2 s fade-out. `settleRestartedAction` is the fix, extracted so it's testable
// against real `THREE.AnimationAction`s without a full `Actor`/GLTF model.
describe('settleRestartedAction', () => {
  it('a same-clip restart mid-crossfade snaps B to full weight and fully stops the action it was fading from', () => {
    const { mixer, a, b } = twoClipMixer();
    a.play();
    mixer.update(0); // A at rest, full weight
    b.reset();
    b.play();
    b.crossFadeFrom(a, 0.2, false); // B fades in, A fades out, over 0.2 s

    mixer.update(0.05); // 0.05 s into the 0.2 s fade: genuinely mid-blend
    expect(b.getEffectiveWeight()).toBeGreaterThan(0);
    expect(b.getEffectiveWeight()).toBeLessThan(1);
    expect(a.getEffectiveWeight()).toBeGreaterThan(0);

    // Actor.play('b-anim', { restart: true }) mid-fade: reset() + the fix.
    b.reset();
    settleRestartedAction(b, a);

    // Immediately — no further mixer.update() needed — the blend is fully resolved.
    expect(b.time).toBeCloseTo(0, 5);
    expect(b.getEffectiveWeight()).toBe(1);
    expect(a.getEffectiveWeight()).toBe(0);
    expect(a.isRunning()).toBe(false);

    // And it stays resolved: A's original 0.2 s fade-out schedule (which had not elapsed yet) never
    // reappears once the mixer keeps advancing.
    mixer.update(0.01);
    expect(b.time).toBeCloseTo(0.01, 5);
    expect(b.getEffectiveWeight()).toBe(1);
    expect(a.getEffectiveWeight()).toBe(0);
    mixer.update(0.5);
    expect(b.getEffectiveWeight()).toBe(1);
    expect(a.getEffectiveWeight()).toBe(0);
  });

  it('is a no-op when there is nothing to fade from (a bare restart, no prior transition)', () => {
    const { a } = twoClipMixer();
    a.play();
    expect(() => settleRestartedAction(a, null)).not.toThrow();
    expect(a.getEffectiveWeight()).toBe(1);
  });

  it('does not stop itself if fadingFrom happens to be the same action', () => {
    const { a } = twoClipMixer();
    a.play();
    settleRestartedAction(a, a);
    expect(a.getEffectiveWeight()).toBe(1);
    expect(a.isRunning()).toBe(true);
  });
});
