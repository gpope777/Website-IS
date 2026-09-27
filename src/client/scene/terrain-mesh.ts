import * as THREE from 'three';
import { CHUTE, COAST, COAST_Z0, HALF, MOUNTAINS, mountainDepth, mountainFeatures, PELDANOS, SOUTH, SWAMP, WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';
import { slopeAt, STEEP } from '../../shared/mountains';
import { inCienaga } from '../../shared/coast';
import { ZARZAL, zarzalAt } from '../../shared/swamp';
import { createRng } from '../../shared/rng';
import { taintAt, type Zone } from '../../shared/corruption';

const TAINT = new THREE.Color(0x5a3a6e);

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
  const alpine = new THREE.Color(0x5d7a45);
  const cliff = new THREE.Color(0x85847c);
  const slab = new THREE.Color(0x9c9c98);
  const snow = new THREE.Color(0xeef2f6);
  const packed = new THREE.Color(0xdde6ea);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    tmp.copy(grass).lerp(dark, terrain.density(x, z));
    if (h < -3) tmp.lerp(dirt, Math.min(1, (-3 - h) / 4));
    if (h > 14) tmp.lerp(rock, Math.min(1, (h - 14) / 10));
    if (z > COAST_Z0) {
      const k = Math.min(1, (z - COAST_Z0) / COAST.blend);
      const coast = inCienaga(x, z) ? mud : h > WATER_LEVEL ? sand : seabed;
      tmp.lerp(coast, k);
    }
    if (x < -HALF) tmp.copy(h > WATER_LEVEL + 0.5 ? mound : h < WATER_LEVEL - 2 ? laguna : bog);
    if (x < ZARZAL.x1 && zarzalAt(terrain, x, z)) tmp.lerp(thorn, 0.8);
    if (z < -HALF && Math.abs(x) <= HALF) {
      const d = mountainDepth(z);
      tmp.copy(alpine).lerp(dark, terrain.density(x, z) * 0.5);
      if (d >= MOUNTAINS.faldas && Math.abs(x) < CHUTE.half + 1) tmp.copy(packed);
      else if (d > 130) tmp.lerp(snow, Math.min(1, (d - 130) / 20));
      if (d < PELDANOS.first + PELDANOS.pitch * (PELDANOS.steps - 1) + PELDANOS.run + 0.5) tmp.copy(slab); // los Peldaños (smoothAt)
      else if (slopeAt(terrain, x, z) > STEEP.deg) tmp.lerp(cliff, 0.85);
    }
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.userData.base = colors.slice();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

/** Recolour the ground toward purple inside corrupt zones (only colours change: cheap). */
export function tintTerrain(mesh: THREE.Mesh, zones: readonly Zone[], corrupt: readonly number[]): void {
  const geo = mesh.geometry;
  const base = geo.userData.base as Float32Array;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    tmp.setRGB(base[i * 3]!, base[i * 3 + 1]!, base[i * 3 + 2]!);
    const k = taintAt(zones, corrupt, pos.getX(i), pos.getZ(i));
    if (k > 0) tmp.lerp(TAINT, k * 0.75);
    col.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  col.needsUpdate = true;
}

/** One quad over the whole map, swamp included (the sea is just terrain below WATER_LEVEL). */
export function buildWater(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(HALF - SWAMP.x0, SOUTH + HALF);
  geo.rotateX(-Math.PI / 2);
  geo.translate((HALF + SWAMP.x0) / 2, 0, (SOUTH - HALF) / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 }));
  water.position.y = WATER_LEVEL;
  return water;
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
export function buildPines(terrain: Terrain, seed: number, count = 150): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 4.5, 6), new THREE.MeshLambertMaterial({ color: 0x2c4a32 }), count);
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
