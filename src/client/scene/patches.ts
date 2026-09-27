import * as THREE from 'three';

/**
 * V2-B: the only place with `onBeforeCompile` shader chunks (spec §13: one module to fix if three.js moves).
 * - Height fog (medium/high): the linear fog thinned higher up and warmed toward the sun; still fully opaque past `far`.
 * - Glow points: up to 8 lamps/fires brighten what is near them, no real lights (spec §5.5).
 */
export const GLOW_MAX = 8;

export interface GlowSource {
  x: number;
  y: number;
  z: number;
  /** Reach (m). */
  r: number;
  color: number;
}

/** The `n` sources nearest to (x, z). */
export function pickGlows(sources: readonly GlowSource[], x: number, z: number, n: number): GlowSource[] {
  if (n <= 0) return [];
  return [...sources].sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2)).slice(0, n);
}

/** Uniforms shared by every patched material: set once per frame. */
export const WORLD_UNIFORMS = {
  glowPos: { value: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4(0, -1e4, 0, 0)) },
  glowCol: { value: Array.from({ length: GLOW_MAX }, () => new THREE.Vector3()) },
  glowGain: { value: 1 },
  fogBaseY: { value: -3.2 },
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunCol: { value: new THREE.Color() },
};

const tmp = new THREE.Color();
/** Writes the chosen sources into the shared uniforms (unused slots off). `gain` = strength (higher at night). */
export function setGlows(chosen: readonly GlowSource[], gain: number): void {
  WORLD_UNIFORMS.glowGain.value = gain;
  WORLD_UNIFORMS.glowPos.value.forEach((p, i) => {
    const s = chosen[i];
    if (s) p.set(s.x, s.y + 1, s.z, s.r);
    else p.set(0, -1e4, 0, 0);
    const c = WORLD_UNIFORMS.glowCol.value[i]!;
    if (s) {
      tmp.setHex(s.color);
      c.set(tmp.r, tmp.g, tmp.b);
    } else c.set(0, 0, 0);
  });
}

const VERT_HEAD = /* glsl */ `#include <common>
varying vec3 vWorldP;`;
const VERT_BODY = /* glsl */ `#include <project_vertex>
{
  vec4 gwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  gwp = instanceMatrix * gwp;
  #endif
  vWorldP = (modelMatrix * gwp).xyz;
}`;

function fragHead(glow: number): string {
  return `#include <common>
varying vec3 vWorldP;
uniform float fogBaseY;
uniform vec3 fogSunDir;
uniform vec3 fogSunCol;
${glow > 0 ? `uniform vec4 glowPos[${glow}];\nuniform vec3 glowCol[${glow}];\nuniform float glowGain;` : ''}`;
}

function fragBody(glow: number, heightFog: boolean): string {
  const g = glow > 0
    ? `{
  vec3 glowSum = vec3(0.0);
  for (int i = 0; i < ${glow}; i++) {
    float k = clamp(1.0 - distance(vWorldP, glowPos[i].xyz) / max(glowPos[i].w, 0.001), 0.0, 1.0);
    glowSum += glowCol[i] * k * k;
  }
  gl_FragColor.rgb += glowSum * glowGain * diffuseColor.rgb;
}
`
    : '';
  const f = heightFog
    ? `#ifdef USE_FOG
{
  float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  float hgt = exp(-max(vWorldP.y - fogBaseY, 0.0) / 30.0);
  fogF = vFogDepth >= fogFar ? 1.0 : fogF * mix(0.6, 1.0, hgt);
  float toSun = pow(max(dot(normalize(vWorldP - cameraPosition), fogSunDir), 0.0), 8.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, fogSunCol, toSun * 0.45), fogF);
}
#endif`
    : '#include <fog_fragment>';
  return g + f;
}

export interface ShaderLike {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}

/**
 * Several patches can stack on one material (wind, corruption, then the world's fog/glow): each is kept in
 * `userData.patches` and one `onBeforeCompile` runs them in order; the program cache key joins their keys.
 */
export function addPatch(mat: THREE.Material, key: string, fn: (s: ShaderLike) => void): void {
  const list = ((mat.userData.patches as { key: string; fn: (s: ShaderLike) => void }[] | undefined) ??= []);
  list.push({ key, fn });
  mat.onBeforeCompile = (shader: ShaderLike) => {
    for (const p of list) p.fn(shader);
  };
  const k = list.map((p) => p.key).join('|');
  mat.customProgramCacheKey = () => k;
  mat.needsUpdate = true;
}

/** Patches one world material in place (Lambert/Phong/Standard). Idempotent. */
export function patchWorld(mat: THREE.Material, opts: { heightFog: boolean; glow: number }): void {
  if (mat.userData.world) return;
  const glow = Math.max(0, Math.min(GLOW_MAX, opts.glow | 0));
  if (!opts.heightFog && glow === 0) return;
  mat.userData.world = true;
  addPatch(mat, `world:${opts.heightFog ? 1 : 0}:${glow}`, (shader) => {
    Object.assign(shader.uniforms, WORLD_UNIFORMS);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragHead(glow)).replace('#include <fog_fragment>', fragBody(glow, opts.heightFog));
  });
}

// ------------------------------------------------------------------ V2-C: wind and corruption

/** The 22 corrupt zones (ids 0..21), one vec4 each: x, z, r, heal front (see heal.ts). */
export const ZONE_MAX = 22;

/** Shared by every wind/corruption patch: set once per frame. */
export const LIFE_UNIFORMS = {
  windT: { value: 0 },
  windDir: { value: new THREE.Vector2(0.8, 0.6) },
  windAmp: { value: 1 },
  zones: { value: Array.from({ length: ZONE_MAX }, () => new THREE.Vector4(0, 0, 1, 1e5)) },
  /** Up to 4 players (x, y, z, on) that press the grass down (high tier). */
  pressPos: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, -1e4, 0, 0)) },
  /** 0..1: las Tierras purified (Task 5) and la Torre they spread from. */
  purify: { value: 0 },
  purifyFrom: { value: new THREE.Vector2(0, 0) },
  grassFar: { value: 60 },
};

/** Taint at a world point (same falloff as shared `taintAt`) and the heal-front band (flowers). */
const LIFE_HEAD = /* glsl */ `
uniform float windT;
uniform vec2 windDir;
uniform float windAmp;
uniform vec4 zones[${ZONE_MAX}];
uniform float purify;
uniform vec2 purifyFrom;
float bzTaint(vec2 p) {
  float t = 0.0;
  for (int i = 0; i < ${ZONE_MAX}; i++) {
    vec4 zn = zones[i];
    if (zn.w > 1e4) continue;
    float d = distance(p, zn.xy);
    if (d <= zn.w) continue;
    t = max(t, clamp((1.0 - d / zn.z) * 2.2, 0.0, 1.0));
  }
  return t;
}
float bzBand(vec2 p) {
  float b = 0.0;
  for (int i = 0; i < ${ZONE_MAX}; i++) {
    vec4 zn = zones[i];
    if (zn.w < 0.0 || zn.w > 1e4) continue;
    b = max(b, clamp(1.0 - abs(distance(p, zn.xy) - zn.w) / ${'2.5'}, 0.0, 1.0));
  }
  return b;
}
float bzWind(vec2 p, float waves) {
  float ph = windT * 1.6 + dot(p, vec2(0.13, 0.09));
  float w = 0.35 + sin(ph) * 0.45;
  if (waves > 1.5) w += sin(ph * 2.7 + p.x * 0.05) * 0.2 + max(sin(windT * 0.23 + dot(p, vec2(0.011, 0.007))), 0.0) * 0.6;
  return w * windAmp;
}`;

export interface SwayOpts {
  /** Object-space height where swaying starts and the height span over which it reaches full amplitude. */
  base: number;
  span: number;
  /** Full displacement (m). */
  amp: number;
  /** Awning mode: flutter up/down, more at the front edge (+z) than at the back. */
  flap?: boolean;
  /** Tint the swaying part toward ash-violet inside corrupt zones (tree crowns). */
  taint?: boolean;
  /** Wind waves: 1 (low) or 2 (+ gusts). */
  waves: number;
}

/** Tree crowns, pines, bushes and awnings sway with the shared wind (spec §5.3, §5.6). */
export function patchSway(mat: THREE.Material, o: SwayOpts): void {
  if (mat.userData.sway) return;
  mat.userData.sway = true;
  const key = `sway:${o.base}:${o.span}:${o.amp}:${o.flap ? 1 : 0}:${o.taint ? 1 : 0}:${o.waves}`;
  addPatch(mat, key, (shader) => {
    Object.assign(shader.uniforms, LIFE_UNIFORMS);
    const move = o.flap
      ? `transformed.y += (bzWind(swayAt.xz, ${o.waves.toFixed(1)}) - 0.35) * ${o.amp.toFixed(3)} * swayK * clamp((position.z + 0.65) / 1.3, 0.0, 1.0);`
      : `transformed.xz += windDir * bzWind(swayAt.xz, ${o.waves.toFixed(1)}) * ${o.amp.toFixed(3)} * swayK * swayK;`;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${LIFE_HEAD}${o.taint ? '\nvarying float vTaint;' : ''}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
{
  vec3 swayAt = modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
  swayAt = (modelMatrix * instanceMatrix[3]).xyz;
  #endif
  float swayK = clamp((position.y - ${o.base.toFixed(3)}) / ${o.span.toFixed(3)}, 0.0, 1.0);
  ${move}
  ${o.taint ? 'vTaint = bzTaint(swayAt.xz) * step(0.001, swayK);' : ''}
}`,
    );
    if (o.taint)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTaint;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.11, 0.2), vTaint * 0.7);');
  });
}

/** The grass chunks' material: wind, distance fade, corruption (ash, short), heal flowers, purified growth. */
export function patchGrass(mat: THREE.Material, o: { waves: number; press: boolean }): void {
  if (mat.userData.grass) return;
  mat.userData.grass = true;
  addPatch(mat, `grass:${o.waves}:${o.press ? 1 : 0}`, (shader) => {
    Object.assign(shader.uniforms, LIFE_UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>${LIFE_HEAD}
uniform float grassFar;
${o.press ? 'uniform vec4 pressPos[4];' : ''}
attribute vec3 aRoot;
attribute vec2 aBlade;
varying float vGT;
varying float vTaint;
varying float vFlower;`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float gt = aBlade.x;
  float kind = floor(aBlade.y);
  float rnd = fract(aBlade.y);
  float tnt = bzTaint(aRoot.xz);
  float band = bzBand(aRoot.xz);
  float pure = kind > 0.5 ? clamp((purify * 320.0 - distance(aRoot.xz, purifyFrom)) / 24.0, 0.0, 1.0) : 1.0;
  float far = 1.0 - smoothstep(grassFar * 0.7, grassFar, distance(aRoot.xz, cameraPosition.xz));
  float sc = mix(1.0, 0.3, tnt) * pure * far;
  vec3 off = transformed - aRoot;
  float bend = gt * gt * off.y;
  off.xz += windDir * bzWind(aRoot.xz + rnd * 3.0, ${o.waves.toFixed(1)}) * bend * 0.6;
  ${o.press ? `for (int i = 0; i < 4; i++) {
    vec2 dp = aRoot.xz - pressPos[i].xz;
    float k = clamp(1.0 - length(dp) / 1.3, 0.0, 1.0) * pressPos[i].w * step(abs(aRoot.y - pressPos[i].y), 2.5);
    off.xz += normalize(dp + vec2(1e-4)) * k * bend * 0.9;
    off.y *= 1.0 - k * 0.6;
  }` : ''}
  transformed = aRoot + off * sc;
  vGT = gt;
  vTaint = tnt;
  vFlower = max(band, kind > 0.5 && rnd > ${(1 - 0.08).toFixed(2)} ? 1.0 : 0.0);
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGT;\nvarying float vTaint;\nvarying float vFlower;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); // both faces lit like the ground')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.18, 0.2), vTaint * 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.95, 0.9), vFlower * smoothstep(0.65, 0.95, vGT));`,
      );
  });
}

/** The ground: violet inside corrupt zones (per vertex), a bright band at a heal front. */
export function patchGround(mat: THREE.Material): void {
  if (mat.userData.ground) return;
  mat.userData.ground = true;
  addPatch(mat, 'ground', (shader) => {
    Object.assign(shader.uniforms, LIFE_UNIFORMS);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${LIFE_HEAD}\nvarying float vTaint;\nvarying float vBand;`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
{
  vec2 gp = (modelMatrix * vec4(position, 1.0)).xz;
  vTaint = bzTaint(gp);
  vBand = bzBand(gp);
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTaint;\nvarying float vBand;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.042, 0.157), vTaint * 0.75);
diffuseColor.rgb += vec3(0.25, 0.22, 0.1) * vBand;`,
    );
  });
}

/** Patches every Lambert material under `root` (skips ones that opted out with `userData.noWorld`). */
export function patchTree(root: THREE.Object3D, opts: { heightFog: boolean; glow: number }): void {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) if ((mat as THREE.MeshLambertMaterial).isMeshLambertMaterial && !mat.userData.noWorld) patchWorld(mat, opts);
  });
}
