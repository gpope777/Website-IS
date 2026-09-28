import * as THREE from 'three';
import { fullMoon } from '../../shared/estrella';
import { createRng } from '../../shared/rng';

/** Tileable value-noise FBM (0..255), painted once at load for the clouds (spec §5.1). */
export function cloudNoise(size: number, seed = 7): Uint8Array {
  const rng = createRng(seed);
  const octaves = [4, 8, 16, 32].filter((g) => g <= size);
  const grids = octaves.map((g) => Float32Array.from({ length: g * g }, () => rng()));
  const out = new Uint8Array(size * size * 4);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      let norm = 0;
      octaves.forEach((g, o) => {
        const grid = grids[o]!;
        const fx = (x / size) * g;
        const fy = (y / size) * g;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (i: number, j: number) => grid[((j % g) * g + (i % g)) | 0]!;
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * amp;
        norm += amp;
        amp *= 0.5;
      });
      const k = (y * size + x) * 4;
      out[k] = out[k + 1] = out[k + 2] = Math.round((v / norm) * 255);
      out[k + 3] = 255;
    }
  return out;
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // on the far plane
}`;

const FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uDay;
uniform float uTime;
uniform float uClouds;
uniform float uStars;
uniform float uMoon;
uniform float uMoonGlow;
uniform sampler2D uCloudTex;
varying vec3 vDir;

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, uHorizon * 0.8, clamp(-h * 4.0, 0.0, 1.0));
  // Sun: disc + halo (a wider, warmer halo near the horizon).
  float s = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - clamp(uSunDir.y * 3.0, 0.0, 1.0);
  float up = smoothstep(-0.12, 0.02, uSunDir.y);
  col += uSunCol * (smoothstep(0.9990, 0.9995, s) * 2.0 + pow(s, 48.0) * 0.45 + pow(s, 6.0) * 0.25 * low) * up;
  // Moon: opposite the sun, pale.
  float m = max(dot(d, -uSunDir), 0.0);
  // P7-E: uMoon scales the disc's angular size (full moon: bigger), uMoonGlow its halo.
  float mr = uMoon * uMoon;
  col += vec3(0.75, 0.8, 0.95) * (smoothstep(1.0 - 0.0007 * mr, 1.0 - 0.0004 * mr, m) * 0.9 + pow(m, 200.0 / uMoon) * 0.12 * uMoonGlow) * (1.0 - uDay);
  // Stars (high): a hashed cell grid, twinkling, only at night and above the horizon.
  if (uStars > 0.5) {
    vec3 c = floor(d * 260.0);
    float st = step(0.9965, hash(c)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(c + 1.0) * 40.0));
    col += vec3(st) * (1.0 - uDay) * smoothstep(0.02, 0.25, h) * 0.8;
  }
  // Clouds (medium: 1 layer, high: 2): the noise texture projected on a flat sky, scrolled by the wind.
  if (uClouds > 0.5 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.18;
    float n = texture2D(uCloudTex, uv + vec2(uTime * 0.004, uTime * 0.0015)).r;
    if (uClouds > 1.5) n = n * 0.65 + texture2D(uCloudTex, uv * 2.3 + vec2(-uTime * 0.006, uTime * 0.003)).r * 0.35;
    float mask = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.18, h);
    vec3 cloud = mix(uHorizon, vec3(1.0), 0.55) * mix(0.18, 1.0, uDay) + uSunCol * 0.25 * low * up;
    col = mix(col, cloud, mask * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** P7-E: the moon's disc size and halo for game day `day`: full moon (día % 8, as la Estrella) is ~2.5× wider and glows. */
export function moonLook(day: number): { size: number; glow: number } {
  return fullMoon(day) ? { size: 2.5, glow: 3 } : { size: 1, glow: 1 };
}

/** V2-B sky dome (spec §5.1): one sphere around the camera, gradient + sun + moon (+ clouds, + stars). 1 draw call. */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor(clouds: number, stars: boolean) {
    let tex: THREE.Texture | null = null;
    if (clouds > 0) {
      const size = clouds > 1 ? 512 : 256;
      tex = new THREE.DataTexture(cloudNoise(size), size, size);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
    }
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color() },
        uDay: { value: 1 },
        uTime: { value: 0 },
        uClouds: { value: clouds },
        uStars: { value: stars ? 1 : 0 },
        uMoon: { value: 1 },
        uMoonGlow: { value: 1 },
        uCloudTex: { value: tex },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false, // matches the old flat background colours
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.mat);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  set(zenith: THREE.Color, horizon: THREE.Color, sunDir: THREE.Vector3, sunCol: THREE.Color, day: number, t: number): void {
    const u = this.mat.uniforms;
    (u.uZenith!.value as THREE.Color).copy(zenith);
    (u.uHorizon!.value as THREE.Color).copy(horizon);
    (u.uSunDir!.value as THREE.Vector3).copy(sunDir).normalize();
    (u.uSunCol!.value as THREE.Color).copy(sunCol);
    u.uDay!.value = day;
    u.uTime!.value = t;
  }

  /** P7-E: today's moon (see `moonLook`). */
  setMoon(m: { size: number; glow: number }): void {
    this.mat.uniforms.uMoon!.value = m.size;
    this.mat.uniforms.uMoonGlow!.value = m.glow;
  }

  /** Follows the camera; sits inside the far plane. */
  follow(cam: THREE.Camera, far: number): void {
    this.mesh.position.copy(cam.position);
    this.mesh.scale.setScalar(far * 0.5);
  }
}
