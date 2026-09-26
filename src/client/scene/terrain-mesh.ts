import * as THREE from 'three';
import { WATER_LEVEL, WORLD_SIZE, type Terrain } from '../../shared/terrain';

export function buildTerrainMesh(terrain: Terrain, segments: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x4f7a3a);
  const dark = new THREE.Color(0x2f5a2a);
  const dirt = new THREE.Color(0x6b5a3e);
  const rock = new THREE.Color(0x7d7f7a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    tmp.copy(grass).lerp(dark, terrain.density(x, z));
    if (h < -3) tmp.lerp(dirt, Math.min(1, (-3 - h) / 4));
    if (h > 14) tmp.lerp(rock, Math.min(1, (h - 14) / 10));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 }));
  water.position.y = WATER_LEVEL;
  return water;
}
