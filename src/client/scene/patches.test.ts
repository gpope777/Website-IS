import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LIFE_UNIFORMS, patchCaustics, patchGrass, patchGround, patchSway, patchTree, patchWorld, pickGlows, setGlows, WORLD_UNIFORMS, type ShaderLike } from './patches';

const fake = (): ShaderLike => ({
  vertexShader: '#include <common>\nvoid main(){\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n#include <fog_fragment>\n}',
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

describe('wind and corruption patches (V2-C)', () => {
  it('sway moves by height above the pivot and stacks with the world patch', () => {
    const m = new THREE.MeshLambertMaterial();
    patchSway(m, { base: 4.5, span: 8, amp: 0.35, taint: true, waves: 2 });
    patchWorld(m, { heightFog: true, glow: 8 });
    const s = fake();
    m.onBeforeCompile(s as never, null as never);
    expect(s.vertexShader).toContain('swayK');
    expect(s.vertexShader).toContain('vWorldP =');
    expect(s.fragmentShader).toContain('vTaint');
    expect(s.fragmentShader).toContain('glowPos[8]');
    expect(s.uniforms.windT).toBe(LIFE_UNIFORMS.windT);
    expect(m.customProgramCacheKey()).toContain('sway:');
    expect(m.customProgramCacheKey()).toContain('world:');
  });

  it('awnings flap instead of leaning; keys differ', () => {
    const a = new THREE.MeshLambertMaterial();
    const b = new THREE.MeshLambertMaterial();
    patchSway(a, { base: 2.1, span: 1, amp: 0.12, flap: true, waves: 2 });
    patchSway(b, { base: 2.1, span: 1, amp: 0.12, waves: 2 });
    const s = fake();
    a.onBeforeCompile(s as never, null as never);
    expect(s.vertexShader).toContain('transformed.y +=');
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it('grass: wind, corruption, flowers; press only when asked', () => {
    const lo = new THREE.MeshLambertMaterial();
    const hi = new THREE.MeshLambertMaterial();
    patchGrass(lo, { waves: 1, press: false });
    patchGrass(hi, { waves: 2, press: true });
    const a = fake();
    const b = fake();
    lo.onBeforeCompile(a as never, null as never);
    hi.onBeforeCompile(b as never, null as never);
    expect(a.vertexShader).toContain('attribute vec3 aRoot');
    expect(a.vertexShader).toContain('bzTaint(aRoot.xz)');
    expect(a.vertexShader).not.toContain('pressPos');
    expect(b.vertexShader).toContain('pressPos[4]');
    expect(a.fragmentShader).toContain('vFlower');
    expect(lo.customProgramCacheKey()).not.toBe(hi.customProgramCacheKey());
  });

  it('ground: taint and heal band per vertex', () => {
    const m = new THREE.MeshLambertMaterial();
    patchGround(m);
    patchGround(m);
    const s = fake();
    m.onBeforeCompile(s as never, null as never);
    expect(s.vertexShader.match(/uniform vec4 zones/g)).toHaveLength(1);
    expect(s.fragmentShader).toContain('vBand');
  });

  it('caustics (V2-D, high): a pattern under the water level, its own cache key, once', () => {
    const m = new THREE.MeshLambertMaterial();
    patchGround(m);
    patchCaustics(m);
    patchCaustics(m);
    const s = fake();
    m.onBeforeCompile(s as never, null as never);
    expect(s.vertexShader).toContain('vCausP =');
    expect(s.fragmentShader).toContain('vCausP');
    expect(s.fragmentShader.match(/float caus/g)).toHaveLength(1);
    expect(s.uniforms.lifeDay).toBe(LIFE_UNIFORMS.lifeDay);
    expect(m.customProgramCacheKey()).toBe('ground|caustics');
  });
});
