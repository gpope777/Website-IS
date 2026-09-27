import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { patchTree, patchWorld, pickGlows, setGlows, WORLD_UNIFORMS, type ShaderLike } from './patches';

const fake = (): ShaderLike => ({
  vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main(){\n#include <fog_fragment>\n}',
  uniforms: {},
});

describe('world shader patches (V2-B)', () => {
  const src = [0, 10, 20, 30].map((x) => ({ x, y: 0, z: 0, r: 8, color: 0xff8a2a }));

  it('picks the nearest glows', () => {
    expect(pickGlows(src, 21, 0, 2).map((s) => s.x)).toEqual([20, 30]);
    expect(pickGlows(src, 0, 0, 8)).toHaveLength(4);
    expect(pickGlows(src, 0, 0, 0)).toEqual([]);
  });

  it('unused glow slots are switched off', () => {
    setGlows(src.slice(0, 1), 1.5);
    expect(WORLD_UNIFORMS.glowPos.value[0]!.w).toBe(8);
    expect(WORLD_UNIFORMS.glowPos.value[1]!.w).toBe(0);
    expect(WORLD_UNIFORMS.glowGain.value).toBe(1.5);
  });

  it('injects height fog and glow, with a cache key per option set', () => {
    const a = new THREE.MeshLambertMaterial();
    patchWorld(a, { heightFog: true, glow: 4 });
    const s = fake();
    a.onBeforeCompile(s as never, null as never);
    expect(s.fragmentShader).toContain('glowPos[4]');
    expect(s.fragmentShader).toContain('fogSunCol');
    expect(s.fragmentShader).not.toContain('#include <fog_fragment>');
    expect(s.vertexShader).toContain('vWorldP =');
    expect(s.uniforms.glowGain).toBe(WORLD_UNIFORMS.glowGain);
    const b = new THREE.MeshLambertMaterial();
    patchWorld(b, { heightFog: false, glow: 4 });
    const t = fake();
    b.onBeforeCompile(t as never, null as never);
    expect(t.fragmentShader).toContain('#include <fog_fragment>');
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it('nothing to do → untouched; patching twice is harmless', () => {
    const m = new THREE.MeshLambertMaterial();
    patchWorld(m, { heightFog: false, glow: 0 });
    expect(m.userData.world).toBeUndefined();
    patchWorld(m, { heightFog: true, glow: 8 });
    const f = m.onBeforeCompile;
    patchWorld(m, { heightFog: true, glow: 8 });
    expect(m.onBeforeCompile).toBe(f);
  });

  it('patchTree touches Lambert only and respects noWorld', () => {
    const g = new THREE.Group();
    const lam = new THREE.MeshLambertMaterial();
    const basic = new THREE.MeshBasicMaterial();
    const skip = new THREE.MeshLambertMaterial();
    skip.userData.noWorld = true;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(), lam), new THREE.Mesh(new THREE.BoxGeometry(), basic), new THREE.Mesh(new THREE.BoxGeometry(), skip));
    patchTree(g, { heightFog: true, glow: 4 });
    expect(lam.userData.world).toBe(true);
    expect(basic.userData.world).toBeUndefined();
    expect(skip.userData.world).toBeUndefined();
  });
});
