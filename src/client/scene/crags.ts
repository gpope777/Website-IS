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
    if (c.bare) continue; // smooth shrine rock: no mark, no grip
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

const TRUNK = new THREE.MeshLambertMaterial({ color: 0x3d7a2c, flatShading: true });

/** Enredadera: a green pillar of its own, or (`wrap`) vine strips around an existing rock. */
export function buildVine(c: Crag, wrap: boolean): THREE.Group {
  const group = new THREE.Group();
  const h = c.top - c.base;
  if (!wrap) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.8, c.r, h, 7, 2), TRUNK);
    trunk.position.set(c.x, c.base + h / 2, c.z);
    group.add(trunk);
  }
  const strips = wrap ? 7 : 4;
  for (let i = 0; i < strips; i++) {
    const a = (i / strips) * Math.PI * 2;
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.35, h * 0.9, 0.14), VINE);
    vine.position.set(c.x + Math.sin(a) * (c.r + 0.04), c.base + h * 0.52, c.z + Math.cos(a) * (c.r + 0.04));
    vine.rotation.y = a;
    group.add(vine);
  }
  const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(0.8, c.r * 0.6), 0), LEAF);
  tuft.scale.y = 0.45;
  tuft.position.set(c.x, c.top + 0.1, c.z);
  group.add(tuft);
  return group;
}
