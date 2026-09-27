import * as THREE from 'three';
import { createRng } from '../../shared/rng';
import { HALF, WATER_LEVEL, type Terrain } from '../../shared/terrain';
import type { Tier } from '../quality';
import { CRAB, crabStep, FLOCK, flockAnchor, flockPoint, lifeAt, lifeFor, type BirdKind, type Crab, type LifeAmounts, type ParticleKind } from './life';
import type { Biome } from './looks';

/**
 * V2-D ambient life (spec §5.6): birds, fireflies, crabs, fish and biome particles. Decorative only (no network,
 * no collision). Each system is one draw call and is hidden when it has nothing to show. Amounts per tier (life.ts).
 */

const FOG_V = /* glsl */ `#include <fog_pars_vertex>`;
const FOG_F = /* glsl */ `#include <fog_pars_fragment>`;

// ------------------------------------------------------------------ birds: a V of 2 triangles, wings flap in the vertex shader
const BIRD_V = /* glsl */ `
#include <common>
${FOG_V}
uniform float uTime;
void main() {
  vec3 p = position;
  float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
  p.y += abs(p.x) * sin(uTime * 9.0 + ph) * 0.9;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const BIRD_F = /* glsl */ `
#include <common>
${FOG_F}
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ------------------------------------------------------------------ points that wrap around the player (fireflies, particles)
const POINTS_V = /* glsl */ `
uniform vec3 uCentre;
uniform float uBox;
uniform float uHeight;
uniform float uTime;
uniform float uFall;
uniform float uSway;
uniform float uSize;
uniform float uPx;
attribute vec4 aSeed;
varying float vBlink;
void main() {
  vec3 s = aSeed.xyz;
  vec3 p;
  p.xz = uCentre.xz + mod(s.xz * uBox - uCentre.xz + uBox * 0.5, uBox) - uBox * 0.5;
  float ph = aSeed.w * 6.2832;
  p.y = uCentre.y + mod(s.y * uHeight - uTime * uFall, uHeight);
  p.x += sin(uTime * 0.7 + ph) * uSway;
  p.z += cos(uTime * 0.53 + ph * 1.3) * uSway;
  p.y += sin(uTime * 1.1 + ph) * uSway * 0.4;
  vBlink = 0.55 + 0.45 * sin(uTime * 2.3 + ph * 3.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * uPx / max(-mv.z, 0.5), 1.5, 14.0);
}`;
const POINTS_F = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uBlink;
varying float vBlink;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float a = uAlpha * mix(1.0, vBlink, uBlink) * (1.0 - smoothstep(0.25, 0.5, r));
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const BIRD_COLOR: Record<BirdKind, number> = { dark: 0x2a2a30, gull: 0xf0f2f4, eagle: 0x4a3626 };
/** Per particle kind: colour, size (m-ish), fall speed (m/s), sway (m), opacity, box height (m). */
const PARTICLE: Record<ParticleKind, { color: number; size: number; fall: number; sway: number; alpha: number; height: number }> = {
  leaves: { color: 0x8a9a3a, size: 0.12, fall: 0.6, sway: 1.2, alpha: 0.9, height: 14 },
  midges: { color: 0x1a1a14, size: 0.05, fall: 0, sway: 0.6, alpha: 0.8, height: 3 },
  snow: { color: 0xffffff, size: 0.09, fall: 1.2, sway: 0.8, alpha: 0.85, height: 18 },
  ash: { color: 0x8a8490, size: 0.08, fall: 0.4, sway: 1, alpha: 0.8, height: 16 },
};

function pointsMaterial(additive: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: POINTS_V,
    fragmentShader: POINTS_F,
    uniforms: {
      uCentre: { value: new THREE.Vector3() },
      uBox: { value: 40 },
      uHeight: { value: 10 },
      uTime: { value: 0 },
      uFall: { value: 0 },
      uSway: { value: 1 },
      uSize: { value: 0.1 },
      uPx: { value: 500 },
      uColor: { value: new THREE.Color() },
      uAlpha: { value: 1 },
      uBlink: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: false,
  });
}

function seededPoints(n: number, seed: number, mat: THREE.ShaderMaterial): THREE.Points {
  const rng = createRng(seed);
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seeds[i] = rng();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return pts;
}

export interface LifeInput {
  x: number;
  z: number;
  /** Ground height under the player. */
  groundY: number;
  biome: Biome;
  frac: number;
  purified: boolean;
  /** Rain/snow of las Montañas is falling (the loose snow steps aside). */
  precip: boolean;
  /** 0 night … 1 day. */
  daylight: number;
  /** Seconds (shader clock). */
  t: number;
  dt: number;
  /** Drawing-buffer height in pixels (point sizes). */
  px: number;
  /** Camera position (fish show when it is in the Costa). */
  cam: THREE.Vector3;
}

export class AmbientLife {
  readonly group = new THREE.Group();
  private readonly n: LifeAmounts;
  private readonly birds: THREE.InstancedMesh;
  private readonly birdMat: THREE.ShaderMaterial;
  private readonly birdOff: THREE.Vector3[] = [];
  private readonly flies: THREE.Points | null;
  private readonly dust: THREE.Points | null;
  private readonly crabs: THREE.InstancedMesh | null;
  private crabList: Crab[] = [];
  private crabAt: { x: number; z: number } | null = null;
  private readonly fish: THREE.InstancedMesh | null;
  private fishAt: { x: number; z: number; y: number; ok: boolean } | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly e = new THREE.Euler();

  constructor(private readonly terrain: Terrain, private readonly seed: number, tier: Tier) {
    const n = (this.n = lifeFor(tier));
    // Birds.
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.75, 0, -0.1, 0, 0, -0.2, 0, 0, 0.25, 0, 0, -0.2, 0.75, 0, -0.1], 3));
    this.birdMat = new THREE.ShaderMaterial({
      vertexShader: BIRD_V,
      fragmentShader: BIRD_F,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uColor: { value: new THREE.Color() } },
      side: THREE.DoubleSide,
      fog: true,
    });
    this.birds = new THREE.InstancedMesh(bg, this.birdMat, n.flocks * n.birds);
    this.birds.frustumCulled = false;
    this.birds.visible = false;
    this.birds.name = 'aves';
    const rng = createRng(seed ^ 0xb17d5);
    for (let i = 0; i < n.flocks * n.birds; i++) this.birdOff.push(new THREE.Vector3((rng() - 0.5) * 12, (rng() - 0.5) * 3, (rng() - 0.5) * 12));
    this.group.add(this.birds);
    // Fireflies and particles.
    this.flies = n.fireflies > 0 ? seededPoints(n.fireflies, seed ^ 0xf1ef1, pointsMaterial(true)) : null;
    this.dust = n.particles > 0 ? seededPoints(n.particles, seed ^ 0xd057, pointsMaterial(false)) : null;
    if (this.flies) {
      this.flies.name = 'luciernagas';
      const u = (this.flies.material as THREE.ShaderMaterial).uniforms;
      u.uBox!.value = 50;
      u.uHeight!.value = 3;
      u.uSway!.value = 0.8;
      u.uSize!.value = 0.09;
      u.uBlink!.value = 1;
      this.group.add(this.flies);
    }
    if (this.dust) {
      this.dust.name = 'particulas';
      (this.dust.material as THREE.ShaderMaterial).uniforms.uBox!.value = 40;
      this.group.add(this.dust);
    }
    // Crabs (CPU: 10 positions) and fish (CPU: 20 on circles).
    this.crabs = n.crabs > 0 ? new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.12, 0.22), new THREE.MeshLambertMaterial({ color: 0xc8502a }), n.crabs) : null;
    if (this.crabs) {
      this.crabs.name = 'cangrejos';
      this.crabs.frustumCulled = false;
      this.crabs.visible = false;
      this.group.add(this.crabs);
    }
    if (n.fish > 0) {
      const g = new THREE.ConeGeometry(0.14, 0.6, 4);
      g.rotateX(Math.PI / 2);
      g.scale(0.6, 1, 1);
      this.fish = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }), n.fish);
      this.fish.name = 'peces';
      this.fish.frustumCulled = false;
      this.fish.visible = false;
      this.group.add(this.fish);
    } else this.fish = null;
  }

  update(i: LifeInput): void {
    const here = lifeAt(i.biome, i.frac, i.purified);
    this.updateBirds(i, here.birds);
    this.updateFlies(i, here.fireflies, here.golden);
    this.updateDust(i, i.precip && here.particles === 'snow' ? null : here.particles);
    this.updateCrabs(i, here.crabs);
    this.updateFish(i, here.fish);
  }

  private updateBirds(i: LifeInput, kind: BirdKind | null): void {
    this.birds.visible = kind !== null;
    if (!kind) return;
    this.birdMat.uniforms.uTime!.value = i.t;
    (this.birdMat.uniforms.uColor!.value as THREE.Color).setHex(BIRD_COLOR[kind]);
    const anchor = flockAnchor(i.x, i.z);
    const ay = Math.max(this.terrain.heightAt(anchor.x, anchor.z), WATER_LEVEL) + (kind === 'eagle' ? FLOCK.eagleHeight - FLOCK.height : 0);
    const flocks = kind === 'eagle' ? 1 : this.n.flocks;
    const per = kind === 'eagle' ? 3 : this.n.birds;
    const s = kind === 'eagle' ? 3 : kind === 'gull' ? 1.3 : 1;
    let k = 0;
    for (let f = 0; f < flocks; f++) {
      const p = flockPoint(f, i.t, anchor);
      const ahead = flockPoint(f, i.t + 1, anchor);
      const yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z);
      this.q.setFromEuler(this.e.set(0, yaw, 0));
      for (let b = 0; b < per; b++) {
        const o = this.birdOff[f * this.n.birds + b]!;
        this.m.compose(this.v.set(p.x + o.x * (kind === 'eagle' ? 3 : 1), ay + p.y + o.y, p.z + o.z), this.q, this.sc.set(s, s, s));
        this.birds.setMatrixAt(k++, this.m);
      }
    }
    this.birds.count = k;
    this.birds.instanceMatrix.needsUpdate = true;
  }

  private pointsCommon(p: THREE.Points, i: LifeInput, baseY: number): Record<string, THREE.IUniform> {
    const u = (p.material as THREE.ShaderMaterial).uniforms;
    (u.uCentre!.value as THREE.Vector3).set(i.x, baseY, i.z);
    u.uTime!.value = i.t;
    u.uPx!.value = i.px;
    return u;
  }

  private updateFlies(i: LifeInput, k: number, golden: boolean): void {
    if (!this.flies) return;
    this.flies.visible = k > 0;
    if (k <= 0) return;
    const u = this.pointsCommon(this.flies, i, i.groundY + 0.3);
    (u.uColor!.value as THREE.Color).setHex(golden ? 0xffc040 : 0xc8ff60);
    u.uAlpha!.value = k * (1 - 0.6 * i.daylight);
  }

  private updateDust(i: LifeInput, kind: ParticleKind | null): void {
    if (!this.dust) return;
    this.dust.visible = kind !== null;
    if (!kind) return;
    const p = PARTICLE[kind];
    const u = this.pointsCommon(this.dust, i, i.groundY + (kind === 'midges' ? 0.2 : -2));
    (u.uColor!.value as THREE.Color).setHex(p.color).multiplyScalar(0.25 + 0.75 * i.daylight);
    u.uHeight!.value = p.height;
    u.uFall!.value = p.fall;
    u.uSway!.value = p.sway;
    u.uSize!.value = p.size;
    u.uAlpha!.value = p.alpha;
  }

  private updateCrabs(i: LifeInput, on: boolean): void {
    if (!this.crabs) return;
    this.crabs.visible = on && i.z > HALF;
    if (!this.crabs.visible) return;
    if (!this.crabAt || Math.hypot(i.x - this.crabAt.x, i.z - this.crabAt.z) > 40) {
      // Re-seed on the wet/dry sand within 30 m (same spots for the same 20 m cell).
      const cx = Math.round(i.x / 20);
      const cz = Math.round(i.z / 20);
      const rng = createRng((this.seed ^ 0xc4ab) + cx * 7919 + cz * 104729);
      this.crabAt = { x: i.x, z: i.z };
      this.crabList = [];
      for (let tries = 0; this.crabList.length < this.n.crabs && tries < 400; tries++) {
        const x = cx * 20 + (rng() - 0.5) * 60;
        const z = cz * 20 + (rng() - 0.5) * 60;
        const yaw = rng() * 6.28;
        const h = this.terrain.heightAt(x, z);
        if (z > HALF && h > WATER_LEVEL + 0.05 && h < WATER_LEVEL + 1.5) this.crabList.push({ x, z, yaw });
      }
    }
    this.crabList = this.crabList.map((c) => crabStep(c, i.x, i.z, i.dt));
    this.crabs.count = this.crabList.length;
    this.crabList.forEach((c, k) => {
      const run = Math.hypot(c.x - i.x, c.z - i.z) < CRAB.flee ? Math.abs(Math.sin(i.t * 30 + k)) * 0.04 : 0;
      this.q.setFromEuler(this.e.set(0, c.yaw, 0));
      this.m.compose(this.v.set(c.x, this.terrain.heightAt(c.x, c.z) + 0.06 + run, c.z), this.q, this.sc.set(1, 1, 1));
      this.crabs!.setMatrixAt(k, this.m);
    });
    this.crabs.instanceMatrix.needsUpdate = true;
  }

  private updateFish(i: LifeInput, on: boolean): void {
    if (!this.fish) return;
    const vis = on && i.cam.z > HALF;
    if (vis && (!this.fishAt || Math.hypot(i.cam.x - this.fishAt.x, i.cam.z - this.fishAt.z) > 30)) {
      const x = Math.round(i.cam.x / 30) * 30;
      const z = Math.round(i.cam.z / 30) * 30;
      const floor = this.terrain.heightAt(x, z);
      this.fishAt = { x, z, y: Math.min(WATER_LEVEL - 1.2, (floor + WATER_LEVEL) / 2), ok: WATER_LEVEL - floor > 2.5 };
    }
    this.fish.visible = vis && !!this.fishAt?.ok;
    if (!this.fish.visible || !this.fishAt) return;
    const a = this.fishAt;
    for (let k = 0; k < this.n.fish; k++) {
      const r = 3 + (k % 5) * 1.2;
      const dir = k % 2 ? 1 : -1;
      const ang = i.t * (0.6 / r) * 3 * dir + k * 1.7;
      const x = a.x + Math.cos(ang) * r;
      const z = a.z + Math.sin(ang) * r;
      const yaw = Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir);
      this.q.setFromEuler(this.e.set(0, yaw, Math.sin(i.t * 6 + k) * 0.2));
      this.m.compose(this.v.set(x, a.y + Math.sin(i.t * 0.8 + k) * 0.4 + (k % 3) * 0.3, z), this.q, this.sc.set(1, 1, 1));
      this.fish.setMatrixAt(k, this.m);
    }
    this.fish.instanceMatrix.needsUpdate = true;
  }
}
