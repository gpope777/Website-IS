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

/** Patches one world material in place (Lambert/Phong/Standard). Idempotent. */
export function patchWorld(mat: THREE.Material, opts: { heightFog: boolean; glow: number }): void {
  if (mat.userData.world) return;
  const glow = Math.max(0, Math.min(GLOW_MAX, opts.glow | 0));
  if (!opts.heightFog && glow === 0) return;
  mat.userData.world = true;
  mat.onBeforeCompile = (shader: ShaderLike) => {
    Object.assign(shader.uniforms, WORLD_UNIFORMS);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', fragHead(glow)).replace('#include <fog_fragment>', fragBody(glow, opts.heightFog));
  };
  mat.customProgramCacheKey = () => `world:${opts.heightFog ? 1 : 0}:${glow}`;
  mat.needsUpdate = true;
}

/** Patches every Lambert material under `root` (skips ones that opted out with `userData.noWorld`). */
export function patchTree(root: THREE.Object3D, opts: { heightFog: boolean; glow: number }): void {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) if ((mat as THREE.MeshLambertMaterial).isMeshLambertMaterial && !mat.userData.noWorld) patchWorld(mat, opts);
  });
}
