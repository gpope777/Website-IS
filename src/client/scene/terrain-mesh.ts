import * as THREE from 'three';
import { COAST, COAST_Z0, HALF, SOUTH, WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';
import { inCienaga } from '../../shared/coast';
import { taintAt, type Zone } from '../../shared/corruption';

const TAINT = new THREE.Color(0x5a3a6e);

/** The fine grid ends here; the far sea (mostly underwater) uses cells twice as big. */
export const NEAR_SOUTH = HALF + 90;

export interface Patch {
  z0: number;
  z1: number;
  segX: number;
  segZ: number;
}

/** Forest + Ciénaga + beach + shallows at the tier's cell size, the far sea at ×2 (phones: ~+25 % vertices, not +46 %). */
export function terrainPatches(segments: number): Patch[] {
  const cell = WORLD_SIZE / segments;
  const far = segments / 2;
  return [
    { z0: -HALF, z1: NEAR_SOUTH, segX: segments, segZ: Math.round((NEAR_SOUTH + HALF) / cell) },
    { z0: NEAR_SOUTH, z1: SOUTH, segX: far, segZ: Math.max(1, Math.round((SOUTH - NEAR_SOUTH) / (cell * 2))) },
  ];
}

export function buildTerrainMesh(terrain: Terrain, patch: Patch): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, patch.z1 - patch.z0, patch.segX, patch.segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (patch.z0 + patch.z1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x4f7a3a);
  const dark = new THREE.Color(0x2f5a2a);
  const dirt = new THREE.Color(0x6b5a3e);
  const rock = new THREE.Color(0x7d7f7a);
  const mud = new THREE.Color(0x4a3a44);
  const sand = new THREE.Color(0xc9b98c);
  const seabed = new THREE.Color(0x35505a);
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

/** One quad over the whole map (the sea is just terrain below WATER_LEVEL). */
export function buildWater(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, SOUTH + HALF);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (SOUTH - HALF) / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 }));
  water.position.y = WATER_LEVEL;
  return water;
}
