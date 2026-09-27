import * as THREE from 'three';
import type { Zone } from '../../shared/corruption';
import type { Terrain } from '../../shared/terrain';

const ROOT = new THREE.MeshLambertMaterial({ color: 0x2e2233, flatShading: true });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xa070ff, transparent: true, opacity: 0.35, depthWrite: false });

/** A withered, twisted root with a violet glow at each corrupt zone's centre (Enredadera there cleanses it). */
export class CorruptionMeshes {
  readonly group = new THREE.Group();
  private readonly roots = new Map<number, THREE.Group>();

  constructor(zones: readonly Zone[], terrain: Terrain) {
    for (const z of zones) {
      if (z.id === 0) continue; // the Raíz-madre is its own landmark
      const g = new THREE.Group();
      const y = terrain.heightAt(z.x, z.z);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.45, 3.2, 5), ROOT);
        r.position.set(Math.sin(a) * 0.6, 1.3, Math.cos(a) * 0.6);
        r.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        g.add(r);
      }
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), GLOW);
      glow.position.y = 2.6;
      g.add(glow);
      g.position.set(z.x, y, z.z);
      this.roots.set(z.id, g);
      this.group.add(g);
    }
  }

  sync(corrupt: readonly number[]): void {
    for (const [id, g] of this.roots) g.visible = corrupt.includes(id);
  }
}
