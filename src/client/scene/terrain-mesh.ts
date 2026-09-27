import * as THREE from 'three';
import { CHUTE, COAST, COAST_Z0, CORRUPT_LANDS, corruptDepth, type Steps, TOWER_FOOT, HALF, MOUNTAINS, mountainDepth, mountainFeatures, PELDANOS, SOUTH, SWAMP, WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';
import { slopeAt, STEEP } from '../../shared/mountains';
import { inCienaga } from '../../shared/coast';
import { ZARZAL, zarzalAt } from '../../shared/swamp';
import { createRng } from '../../shared/rng';
import { patchGround, patchSway } from './patches';
import { snowAmount, vertexNoise, wetSand } from './ground';

/** The fine grid ends here; the far sea (mostly underwater) uses cells twice as big. */
export const NEAR_SOUTH = HALF + 90;

export interface Patch {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  segX: number;
  segZ: number;
  /** Explicit row positions (z, ascending, from z0 to z1): overrides the even `segZ` spacing. */
  rows?: number[];
}

/** A mountain chunk: its detail mesh (within MOUNTAIN_LOD of the player) or its low-poly silhouette. */
export interface MountainChunk {
  detail: Patch;
  silhouette: Patch;
}

/** The mountains draw in detail within this many metres of the player; beyond, a 16 × 16 silhouette per chunk. */
export const MOUNTAIN_LOD = 160;
const CHUNK = 120;

/**
 * 4 chunks of 120 m across the mountains. Detail columns match the forest's cell (the seam has no cracks);
 * rows are fine in los Peldaños, with one exactly on each riser edge, and ×2 beyond.
 */
export function mountainChunks(segments: number): MountainChunk[] {
  const cell = WORLD_SIZE / segments;
  const ds: number[] = [];
  for (let d = 0; d < MOUNTAINS.faldas; d += cell) ds.push(d);
  for (let k = 0; k < PELDANOS.steps; k++) ds.push(PELDANOS.first + PELDANOS.pitch * k, PELDANOS.first + PELDANOS.pitch * k + PELDANOS.run);
  const depth = MOUNTAINS.z1 - MOUNTAINS.z0;
  for (let d = MOUNTAINS.faldas; d < depth; d += cell * 2) ds.push(d);
  ds.push(depth);
  ds.sort((a, b) => a - b);
  const rows = ds.filter((d, i) => i === 0 || d - ds[i - 1]! > 0.05).map((d) => -HALF - d).reverse();
  rows[0] = MOUNTAINS.z0;
  rows[rows.length - 1] = MOUNTAINS.z1;
  const out: MountainChunk[] = [];
  for (let x0 = MOUNTAINS.x0; x0 < MOUNTAINS.x1 - 1; x0 += CHUNK) {
    const box = { x0, x1: x0 + CHUNK, z0: MOUNTAINS.z0, z1: MOUNTAINS.z1 };
    out.push({ detail: { ...box, segX: Math.round(CHUNK / cell), segZ: rows.length - 1, rows }, silhouette: { ...box, segX: 16, segZ: 16 } });
  }
  return out;
}

/** Las Tierras Corruptas draw only north of this z (or while flying): from the forest they are behind the mountains. */
export const CORRUPT_SHOW_Z = -HALF - 110;

export function corruptVisible(z: number, flying: boolean): boolean {
  return flying || z < CORRUPT_SHOW_Z;
}

/**
 * 4 chunks of 120 m across las Tierras Corruptas (S5-A). Columns match the mountains' (the rim seam has no cracks);
 * rows are fine in el Borde and over los Escalones rotos (one on each riser edge), ×2 elsewhere.
 */
export function corruptChunks(segments: number, steps: Pick<Steps, 'd0' | 'steps' | 'pitch' | 'run'>): MountainChunk[] {
  const cell = WORLD_SIZE / segments;
  const depth = CORRUPT_LANDS.z1 - CORRUPT_LANDS.z0;
  const fine = (d: number) => d < CORRUPT_LANDS.rim + 4 || (d > steps.d0 - 8 && d < steps.d0 + 44);
  const ds: number[] = [];
  for (let d = 0; d < depth; d += fine(d) ? cell : cell * 2) ds.push(d);
  for (let k = 0; k < steps.steps; k++) ds.push(steps.d0 + steps.pitch * k, steps.d0 + steps.pitch * k + steps.run);
  ds.push(depth);
  ds.sort((a, b) => a - b);
  const rows = ds.filter((d, i) => i === 0 || d - ds[i - 1]! > 0.05).map((d) => CORRUPT_LANDS.z1 - d).reverse();
  rows[0] = CORRUPT_LANDS.z0;
  rows[rows.length - 1] = CORRUPT_LANDS.z1;
  const out: MountainChunk[] = [];
  for (let x0 = CORRUPT_LANDS.x0; x0 < CORRUPT_LANDS.x1 - 1; x0 += CHUNK) {
    const box = { x0, x1: x0 + CHUNK, z0: CORRUPT_LANDS.z0, z1: CORRUPT_LANDS.z1 };
    out.push({ detail: { ...box, segX: Math.round(CHUNK / cell), segZ: rows.length - 1, rows }, silhouette: { ...box, segX: 16, segZ: 16 } });
  }
  return out;
}

/** Should this chunk draw in detail for a player at (x, z)? */
export function chunkDetailed(c: MountainChunk, x: number, z: number): boolean {
  const { x0, x1, z0, z1 } = c.detail;
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)) < MOUNTAIN_LOD;
}

/**
 * Forest + Ciénaga + beach + shallows at the tier's cell size; the far sea and the swamp (flat bog, fogged) at ×2
 * (phones: ~+25 % vertices for the coast, ~+5 % for the swamp).
 */
export function terrainPatches(segments: number): Patch[] {
  const cell = WORLD_SIZE / segments;
  const far = segments / 2;
  const w = SWAMP.x1 - SWAMP.x0;
  const d = SWAMP.z1 - SWAMP.z0;
  return [
    { x0: -HALF, x1: HALF, z0: -HALF, z1: NEAR_SOUTH, segX: segments, segZ: Math.round((NEAR_SOUTH + HALF) / cell) },
    { x0: -HALF, x1: HALF, z0: NEAR_SOUTH, z1: SOUTH, segX: far, segZ: Math.max(1, Math.round((SOUTH - NEAR_SOUTH) / (cell * 2))) },
    { x0: SWAMP.x0, x1: SWAMP.x1, z0: SWAMP.z0, z1: SWAMP.z1, segX: Math.round(w / (cell * 2)), segZ: Math.round(d / (cell * 2)) },
  ];
}

export function buildTerrainMesh(terrain: Terrain, patch: Patch): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(patch.x1 - patch.x0, patch.z1 - patch.z0, patch.segX, patch.rows ? patch.rows.length - 1 : patch.segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((patch.x0 + patch.x1) / 2, 0, (patch.z0 + patch.z1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  if (patch.rows) for (let i = 0; i < pos.count; i++) pos.setZ(i, patch.rows[Math.floor(i / (patch.segX + 1))]!); // row 0 is the smallest z
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x4f7a3a);
  const dark = new THREE.Color(0x2f5a2a);
  const dirt = new THREE.Color(0x6b5a3e);
  const rock = new THREE.Color(0x7d7f7a);
  const mud = new THREE.Color(0x4a3a44);
  const sand = new THREE.Color(0xc9b98c);
  const seabed = new THREE.Color(0x35505a);
  const bog = new THREE.Color(0x3d4a2e);
  const thorn = new THREE.Color(0x5b4a55);
  const mound = new THREE.Color(0x2f4a28);
  const laguna = new THREE.Color(0x1f2a24);
  const blackMud = new THREE.Color(0x2a2418);
  const wet = new THREE.Color(0x9a8a62);
  const alpine = new THREE.Color(0x5d7a45);
  const cliff = new THREE.Color(0x85847c);
  const slab = new THREE.Color(0x9c9c98);
  const snow = new THREE.Color(0xeef2f6);
  const packed = new THREE.Color(0xdde6ea);
  const ash = new THREE.Color(0x8a8580);
  const ashDark = new THREE.Color(0x6e6a66);
  const slate = new THREE.Color(0x4a4650);
  const plateau = new THREE.Color(0x3a2a44);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    const dens = terrain.density(x, z);
    const n = vertexNoise(x, z);
    tmp.copy(grass).lerp(dark, dens);
    if (dens > 0.55) tmp.lerp(dirt, Math.min(0.45, (dens - 0.55) * 1.5)); // trodden dirt under the densest canopy (V2-C)
    if (h < -3) tmp.lerp(dirt, Math.min(1, (-3 - h) / 4));
    if (h > 14) tmp.lerp(rock, Math.min(1, (h - 14) / 10));
    if (z > COAST_Z0) {
      const k = Math.min(1, (z - COAST_Z0) / COAST.blend);
      const coast = inCienaga(x, z) ? mud : h > WATER_LEVEL ? sand : seabed;
      tmp.lerp(coast, k);
      if (coast === sand) tmp.lerp(wet, wetSand(h) * 0.7 * k); // V2-C: darker wet sand at the waterline
    }
    if (x < -HALF) {
      tmp.copy(h > WATER_LEVEL + 0.5 ? mound : h < WATER_LEVEL - 2 ? laguna : bog);
      if (h <= WATER_LEVEL + 0.5 && h >= WATER_LEVEL - 2 && n > 0.25) tmp.lerp(blackMud, Math.min(1, (n - 0.25) * 2.5)); // V2-C: mud patches
    }
    if (x < ZARZAL.x1 && zarzalAt(terrain, x, z)) tmp.lerp(thorn, 0.8);
    if (z < -HALF && Math.abs(x) <= HALF) {
      const d = mountainDepth(z);
      tmp.copy(alpine).lerp(dark, terrain.density(x, z) * 0.5);
      if (d >= MOUNTAINS.faldas && Math.abs(x) < CHUTE.half + 1) tmp.copy(packed);
      else {
        const sl = slopeAt(terrain, x, z);
        const sn = Math.max(d > 130 ? Math.min(1, (d - 130) / 20) : 0, snowAmount(h, sl)); // V2-C: snow by height and slope too
        if (sn > 0) tmp.lerp(snow, sn);
      }
      if (d < PELDANOS.first + PELDANOS.pitch * (PELDANOS.steps - 1) + PELDANOS.run + 0.5) tmp.copy(slab); // los Peldaños (smoothAt)
      else if (slopeAt(terrain, x, z) > STEEP.deg) tmp.lerp(cliff, 0.85);
    }
    if (z < CORRUPT_LANDS.z1 && Math.abs(x) <= HALF) {
      // las Tierras Corruptas: grey ash, dark slate on el Borde and steep rock, a violet-black plateau under la Torre.
      const d = corruptDepth(z);
      tmp.copy(ash).lerp(ashDark, terrain.density(x, z));
      if (d < CORRUPT_LANDS.rim + 0.5 || slopeAt(terrain, x, z) > STEEP.deg) tmp.copy(slate);
      else if (d > TOWER_FOOT.d && Math.abs(x) < TOWER_FOOT.half) tmp.copy(plateau);
    }
    tmp.multiplyScalar(1 + n * 0.06); // V2-C: ± 6 % break-up, no texture
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patchGround(mat); // V2-C: corrupt zones, the healing wave and the purified Tierras in the shader
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** El Zarzal's thorns: seeded dark spikes on thorn cells, one draw call. */
export function buildThorns(terrain: Terrain, seed: number, count = 220): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 1.3, 4), new THREE.MeshLambertMaterial({ color: 0x3a2c38 }), count);
  const rng = createRng(seed ^ 0x2a42a1);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 10; tries++) {
    const x = ZARZAL.x0 + rng() * (ZARZAL.x1 - ZARZAL.x0);
    const z = SWAMP.z0 + rng() * (SWAMP.z1 - SWAMP.z0);
    const a = rng();
    const b = rng();
    if (!zarzalAt(terrain, x, z, true)) continue; // the knot's gap has its own hedge (ZarzalKnot)
    const s = 0.7 + a * 0.9;
    q.setFromEuler(e.set((b - 0.5) * 0.8, a * 6.28, (a - 0.5) * 0.8));
    m.compose(v.set(x, Math.max(terrain.heightAt(x, z), WATER_LEVEL) + 0.5 * s, z), q, sc.set(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Decorative pines on the Faldas' gentle slopes, away from the chute and the paredes: one draw call, no collision. */
export function buildPines(terrain: Terrain, seed: number, waves = 1, count = 150): THREE.InstancedMesh {
  const mat = new THREE.MeshLambertMaterial({ color: 0x2c4a32 });
  patchSway(mat, { base: -1, span: 3.25, amp: 0.25, waves }); // V2-C: the top sways
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 4.5, 6), mat, count);
  const { paredes } = mountainFeatures(seed);
  const rng = createRng(seed ^ 0x9171e5);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 10; tries++) {
    const x = (rng() - 0.5) * 2 * (HALF - MOUNTAINS.sideRim - 5);
    const z = -HALF - (MOUNTAINS.faldas + 2 + rng() * (MOUNTAINS.cumbre - MOUNTAINS.faldas));
    const s = 0.7 + rng() * 0.7;
    if (Math.abs(x) < CHUTE.half + CHUTE.blend + 2 || slopeAt(terrain, x, z) > 30) continue;
    if (paredes.some((p) => Math.hypot(x - p.x, z - p.z) < p.rt + p.w + 1)) continue;
    m.compose(v.set(x, terrain.heightAt(x, z) + 2.1 * s, z), q, sc.set(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
