import * as THREE from 'three';
import type { Crag } from '../../shared/crags';

const ROCK = new THREE.MeshLambertMaterial({ color: 0x7d7b74, flatShading: true });
const VINE = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
const LEAF = new THREE.MeshLambertMaterial({ color: 0x4f9a3a, flatShading: true });

/** Rock pillars wrapped in vines: the marked surfaces you can climb. */
export function buildCrags(crags: readonly Crag[], shadows: boolean): THREE.Group {
  const group = new THREE.Group();
  for (const c of crags) {
    const h = c.top - c.base;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.92, c.r * 1.05, h, 9, 3), ROCK);
    pillar.position.set(c.x, c.base + h / 2, c.z);
    pillar.rotation.y = c.id * 1.7;
    pillar.castShadow = shadows;
    pillar.receiveShadow = shadows;
    group.add(pillar);
    // Vines down the sides: the "you can climb this" mark.
    const strips = 5;
    for (let i = 0; i < strips; i++) {
      const a = (i / strips) * Math.PI * 2 + c.id;
      const vine = new THREE.Mesh(new THREE.BoxGeometry(0.35, h * 0.85, 0.12), VINE);
      vine.position.set(c.x + Math.sin(a) * (c.r + 0.02), c.base + h * 0.55, c.z + Math.cos(a) * (c.r + 0.02));
      vine.rotation.y = a;
      group.add(vine);
    }
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r * 0.55, 0), LEAF);
    tuft.scale.y = 0.4;
    tuft.position.set(c.x, c.top + 0.1, c.z);
    group.add(tuft);
  }
  return group;
}
