import * as THREE from 'three';
import { COAST, COAST_Z0, HALF, SOUTH, SWAMP, WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';
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
  const geo = new THREE.PlaneGeometry(patch.x1 - patch.x0, patch.z1 - patch.z0, patch.segX, patch.segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((patch.x0 + patch.x1) / 2, 0, (patch.z0 + patch.z1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
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
    if (!zarzalAt(terrain, x, z)) continue;
    const s = 0.7 + a * 0.9;
    q.setFromEuler(e.set((b - 0.5) * 0.8, a * 6.28, (a - 0.5) * 0.8));
    m.compose(v.set(x, Math.max(terrain.heightAt(x, z), WATER_LEVEL) + 0.5 * s, z), q, sc.set(s, s, s));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
