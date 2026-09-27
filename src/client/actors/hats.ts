import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** P4-C: hats as one merged mesh each (≤3 primitives, 1 material → 1 draw call). Metres; y = 0 sits on the head's tip. Shared, never disposed. */
type Part = THREE.BufferGeometry;
const at = (g: Part, x: number, y: number, z: number, rx = 0, rz = 0): Part => g.rotateX(rx).rotateZ(rz).translate(x, y, z);

const BUILD: Record<number, () => { parts: Part[]; color: number; glow?: boolean }> = {
  1: () => ({ parts: [at(new THREE.SphereGeometry(0.16, 8, 4).scale(1, 0.25, 0.55), 0.03, 0.05, 0), at(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 4), -0.12, 0.05, 0, 0, Math.PI / 3)], color: 0x5fae3c }),
  2: () => ({ parts: [at(new THREE.ConeGeometry(0.12, 0.26, 7), 0, 0.13, 0), at(new THREE.TorusGeometry(0.1, 0.03, 5, 10), 0, 0.04, 0, Math.PI / 2)], color: 0xf1d7c0 }),
  3: () => ({ parts: [at(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 10, 1, true), 0, 0.03, 0), at(new THREE.ConeGeometry(0.05, 0.12, 4), 0, 0.12, 0.14), at(new THREE.ConeGeometry(0.05, 0.12, 4), 0, 0.12, -0.14)], color: 0xe0a030 }),
  4: () => ({ parts: [at(new THREE.ConeGeometry(0.05, 0.22, 5), 0.12, 0.1, 0, 0, -0.5), at(new THREE.ConeGeometry(0.05, 0.22, 5), -0.12, 0.1, 0, 0, 0.5)], color: 0xc9b8ff }),
  5: () => ({ parts: [at(new THREE.TorusGeometry(0.16, 0.025, 5, 16), 0, 0.2, 0, Math.PI / 2)], color: 0xffffff, glow: true }),
  6: () => ({ parts: [at(new THREE.OctahedronGeometry(0.13, 0).scale(1, 1, 0.4), 0, 0.16, 0)], color: 0xffd94a, glow: true }),
  // P4-D, the Proeza hats: a folded paper boat, a snow cap with a pompom, a withered crown.
  7: () => ({ parts: [at(new THREE.BoxGeometry(0.3, 0.14, 0.01), 0, 0.06, 0.03, -0.35), at(new THREE.BoxGeometry(0.3, 0.14, 0.01), 0, 0.06, -0.03, 0.35)], color: 0xf2eee2 }),
  8: () => ({ parts: [at(new THREE.ConeGeometry(0.14, 0.24, 8), 0, 0.12, 0), at(new THREE.SphereGeometry(0.05, 6, 4), 0, 0.26, 0)], color: 0xeef4ff }),
  9: () => ({ parts: [at(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10, 1, true), 0, 0.03, 0), at(new THREE.ConeGeometry(0.04, 0.14, 4), 0.1, 0.12, 0, 0, -0.4), at(new THREE.ConeGeometry(0.04, 0.14, 4), -0.1, 0.12, 0, 0, 0.4)], color: 0x5a3a5a }),
};

const cache = new Map<number, { geo: THREE.BufferGeometry; mat: THREE.Material }>();

/** A fresh Mesh sharing its hat's cached geometry and material; null for 0 (no hat). */
export function makeHat(hat: number): THREE.Mesh | null {
  const build = BUILD[hat];
  if (!build) return null;
  let c = cache.get(hat);
  if (!c) {
    const b = build();
    const geo = mergeGeometries(b.parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
    c = { geo, mat: b.glow ? new THREE.MeshBasicMaterial({ color: b.color }) : new THREE.MeshLambertMaterial({ color: b.color, flatShading: true }) };
    cache.set(hat, c);
  }
  const m = new THREE.Mesh(c.geo, c.mat);
  m.castShadow = true;
  return m;
}
