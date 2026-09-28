import * as THREE from 'three';
import type { Terrain } from '../../shared/terrain';
import { SWAMP, WATER_LEVEL } from '../../shared/terrain';
import type { TierSettings } from '../quality';
import { bakeWaterMap, WATER, WATER_MAP, WAVES, type WaterKind } from './water-data';

/**
 * V2-D water (spec §5.4): one ShaderMaterial. Depth from a baked map (sea/swamp) or a per-vertex attribute
 * (el Lago Negro), shore foam, aguas bravas foam, fresnel toward the sky's colours and a sun glint; waves in
 * the vertex shader on medium/high only (visual: the physics water level never moves).
 */
export const WATER_UNIFORMS = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uZenith: { value: new THREE.Color(0.3, 0.5, 0.8) },
  uHorizon: { value: new THREE.Color(0.7, 0.8, 0.9) },
  uDay: { value: 1 },
};

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
varying vec3 vWorld;
#ifdef LAKE
attribute float aDepth;
varying float vDepth;
#endif
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  #ifdef WAVES
  float k = wp.x < ${SWAMP.x1.toFixed(1)} ? ${WAVES.swampK.toFixed(2)} : 1.0;
  float a = sin(dot(wp.xz, vec2(0.8, 0.6)) * ${((2 * Math.PI) / WAVES.len[0]).toFixed(5)} + uTime * ${WAVES.speed[0].toFixed(2)});
  float b = sin(dot(wp.xz, vec2(-0.3, 0.95)) * ${((2 * Math.PI) / WAVES.len[1]).toFixed(5)} + uTime * ${WAVES.speed[1].toFixed(2)});
  wp.y += ${WAVES.amp.toFixed(3)} * k * (a * 0.6 + b * 0.4);
  #endif
  #ifdef LAKE
  vDepth = aDepth;
  #endif
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uDay;
uniform vec3 uShallowA;
uniform vec3 uDeepA;
uniform vec3 uFoamA;
uniform vec2 uAlphaA;
uniform vec3 uShallowB;
uniform vec3 uDeepB;
uniform vec3 uFoamB;
uniform vec2 uAlphaB;
/** A = first kind, B = second: sea/swamp by the map's G, lake/clean lake by purify. */
uniform float uMixB;
/** How much the A foam glows on its own (el Lago Negro's purple rim). */
uniform float uGlowA;
varying vec3 vWorld;
#ifdef MAP
uniform sampler2D uMap;
uniform vec4 uMapBox;
#endif
#ifdef LAKE
varying float vDepth;
#endif
void main() {
  #ifdef MAP
  vec4 m = texture2D(uMap, (vWorld.xz - uMapBox.xy) / uMapBox.zw);
  float depth = m.r * ${WATER_MAP.maxDepth.toFixed(1)};
  float kb = m.g;
  float brav = m.b;
  #else
  float depth = vDepth;
  float kb = uMixB;
  float brav = 0.0;
  #endif
  float dk = 1.0 - exp(-depth / 3.0);
  vec3 shallow = mix(uShallowA, uShallowB, kb);
  vec3 deep = mix(uDeepA, uDeepB, kb);
  vec3 foam = mix(uFoamA, uFoamB, kb);
  vec2 alpha = mix(uAlphaA, uAlphaB, kb);
  float calm = 1.0 - 0.8 * kb * (1.0 - uMixB); // the swamp barely ripples (MAP: kb = swamp)
  #ifdef LAKE
  calm = 0.6;
  #endif
  // Ripples in the normal (every tier): a few cheap sines.
  vec2 p = vWorld.xz;
  float t = uTime;
  vec2 g = vec2(cos(p.x * 0.9 + t * 1.7) + cos(p.x * 0.37 - p.y * 0.52 + t * 1.1) * 0.8,
                cos(p.y * 1.1 - t * 1.3) + cos(p.y * 0.41 + p.x * 0.47 + t * 0.9) * 0.8);
  vec3 n = normalize(vec3(g.x * 0.06 * calm, 1.0, g.y * 0.06 * calm));
  vec3 v = normalize(cameraPosition - vWorld);
  float light = mix(0.12, 1.0, uDay);
  vec3 col;
  float a;
  if (gl_FrontFacing) {
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(r.y, 0.0, 1.0), 0.55));
    col = mix(shallow, deep, dk) * light;
    col = mix(col, sky, fres * mix(0.85, 0.3, kb));
    vec3 h = normalize(v + uSunDir);
    col += uSunCol * pow(max(dot(n, h), 0.0), 140.0) * 1.6 * uDay * calm * step(0.0, uSunDir.y);
    a = mix(alpha.x, alpha.y, dk);
  } else {
    // From below: the bright, flat underside of the surface.
    col = mix(shallow, uHorizon, 0.5) * light * 1.2;
    a = 0.7;
  }
  // Foam: a noisy band where it is shallow (not in the swamp), and in the aguas bravas.
  float wob = 0.5 + 0.5 * sin(p.x * 1.3 + t * 1.5) * sin(p.y * 1.1 - t * 1.2);
  float shore = 1.0 - smoothstep(0.0, 0.45, depth);
  float fk = shore * smoothstep(0.25, 0.75, wob * 0.7 + shore * 0.55);
  float wob2 = 0.5 + 0.5 * sin(p.x * 0.7 - t * 3.1) * sin(p.y * 0.9 + t * 2.3);
  fk = max(fk, brav * smoothstep(0.45, 0.8, wob2));
  #ifdef MAP
  fk *= 1.0 - kb;
  #endif
  col = mix(col, foam * mix(light, 1.0, uGlowA * (1.0 - kb)), fk * 0.9);
  a = max(a, fk * 0.9);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function setKind(u: Record<string, THREE.IUniform>, slot: 'A' | 'B', kind: WaterKind): void {
  const w = WATER[kind];
  u[`uShallow${slot}`] = { value: new THREE.Color(w.shallow) };
  u[`uDeep${slot}`] = { value: new THREE.Color(w.deep) };
  u[`uFoam${slot}`] = { value: new THREE.Color(w.foam) };
  u[`uAlpha${slot}`] = { value: new THREE.Vector2(w.aShallow, w.aDeep) };
}

export function makeWaterMaterial(a: WaterKind, b: WaterKind, opts: { waves: boolean; map?: THREE.Texture; lake?: boolean; glowA?: number }): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...WATER_UNIFORMS, uMixB: { value: 0 }, uGlowA: { value: opts.glowA ?? 0 } };
  setKind(uniforms, 'A', a);
  setKind(uniforms, 'B', b);
  const defines: Record<string, string> = {};
  if (opts.waves) defines.WAVES = '';
  if (opts.map) {
    defines.MAP = '';
    uniforms.uMap = { value: opts.map };
    uniforms.uMapBox = { value: new THREE.Vector4(WATER_MAP.x0, WATER_MAP.z0, WATER_MAP.x1 - WATER_MAP.x0, WATER_MAP.z1 - WATER_MAP.z0) };
  }
  if (opts.lake) defines.LAKE = '';
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines, fog: true, transparent: true, side: THREE.DoubleSide });
  mat.userData.noWorld = true;
  return mat;
}

/** The sea and the swamp: one quad (waterGrid² on medium/high for the waves) over the old water's extent. */
export function buildSea(terrain: Terrain, seed: number, tier: TierSettings): THREE.Mesh {
  const size = tier.waterGrid > 1 ? WATER_MAP.size : 256;
  const tex = new THREE.DataTexture(bakeWaterMap(terrain, seed, size), size, size);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const seg = Math.max(1, tier.waterGrid);
  const geo = new THREE.PlaneGeometry(WATER_MAP.x1 - WATER_MAP.x0, WATER_MAP.z1 - WATER_MAP.z0, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate((WATER_MAP.x1 + WATER_MAP.x0) / 2, 0, (WATER_MAP.z1 + WATER_MAP.z0) / 2);
  const mesh = new THREE.Mesh(geo, makeWaterMaterial('mar', 'pantano', { waves: seg > 1, map: tex }));
  mesh.position.y = WATER_LEVEL;
  mesh.name = 'water';
  return mesh;
}

/** el Lago Negro: a polar disc with the bowl's depth per vertex; turns clean as `setPurify` goes to 1. */
export function buildLake(terrain: Terrain, x: number, z: number, r: number, surface: number): THREE.Mesh {
  const rings = 8;
  const segs = 40;
  const pos: number[] = [0, 0, 0];
  const depth: number[] = [Math.max(0, surface - terrain.heightAt(x, z))];
  for (let i = 1; i <= rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const q = (i / rings) * r;
      const px = Math.cos(a) * q;
      const pz = Math.sin(a) * q;
      pos.push(px, 0, pz);
      depth.push(Math.max(0, surface - terrain.heightAt(x + px, z + pz)));
    }
  const idx: number[] = [];
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a0 = 1 + (i - 1) * segs + j;
      const a1 = 1 + (i - 1) * segs + ((j + 1) % segs);
      const b0 = a0 + segs;
      const b1 = a1 + segs;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, makeWaterMaterial('lago', 'lagoLimpio', { waves: false, lake: true, glowA: 1 }));
  mesh.position.set(x, surface, z);
  mesh.name = 'lago';
  return mesh;
}

/** 0 = el Lago Negro, 1 = clean. */
export function setLakePurify(lake: THREE.Mesh, k: number): void {
  (lake.material as THREE.ShaderMaterial).uniforms.uMixB!.value = k;
}
