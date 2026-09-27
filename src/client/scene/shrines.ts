import * as THREE from 'three';
import type { ShrineView } from '../../shared/protocol';
import type { Shrine } from '../../shared/shrines';
import type { Terrain } from '../../shared/terrain';
import { buildCrags } from './crags';

const STONE = new THREE.MeshLambertMaterial({ color: 0x8f8a7e, flatShading: true });
const WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
const BEAM = new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0.18, depthWrite: false });

interface Parts {
  beam: THREE.Mesh;
  orb: THREE.Mesh;
  orbMat: THREE.MeshBasicMaterial;
  gate: THREE.Mesh;
  gateMat: THREE.MeshBasicMaterial;
  handles: THREE.Object3D[];
  plateMat: THREE.MeshLambertMaterial | null;
}

/** Shrines: a beam of light on the horizon, an orb behind a ring of light, levers or a plate. */
export class ShrineMeshes {
  readonly group = new THREE.Group();
  private readonly parts: Parts[] = [];

  constructor(shrines: readonly Shrine[], terrain: Terrain, shadows: boolean) {
    const pillars = shrines.flatMap((s) => (s.pillar ? [s.pillar] : []));
    this.group.add(buildCrags(pillars, shadows));
    for (const s of shrines) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.5, 8), STONE);
      base.position.set(s.x, s.y + 0.1, s.z);
      if (!s.pillar) this.group.add(base);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 80, 8, 1, true), BEAM);
      beam.position.set(s.orb.x, s.orb.y + 40, s.orb.z);
      const orbMat = new THREE.MeshBasicMaterial({ color: 0x7dffb5 });
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), orbMat);
      orb.position.set(s.orb.x, s.orb.y, s.orb.z);
      const gateMat = new THREE.MeshBasicMaterial({ color: 0xc9a6ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
      const gate = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 16, 1, true), gateMat);
      gate.position.set(s.orb.x, s.orb.y - 0.2, s.orb.z);
      this.group.add(beam, orb, gate);
      const handles: THREE.Object3D[] = [];
      let plateMat: THREE.MeshLambertMaterial | null = null;
      if (s.kind === 'levers') {
        for (const p of s.parts) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), STONE);
          const y = terrain.heightAt(p.x, p.z);
          post.position.set(p.x, y + 0.5, p.z);
          const pivot = new THREE.Object3D();
          pivot.position.set(p.x, y + 1, p.z);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), WOOD);
          handle.position.y = 0.55;
          pivot.add(handle);
          pivot.rotation.z = 0.6;
          handles.push(pivot);
          this.group.add(post, pivot);
        }
      }
      if (s.kind === 'plate') {
        plateMat = new THREE.MeshLambertMaterial({ color: 0x8f8a7e, emissive: 0x000000 });
        const p = s.parts[0]!;
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.25, 12), plateMat);
        plate.position.set(p.x, terrain.heightAt(p.x, p.z) + 0.05, p.z);
        this.group.add(plate);
      }
      this.parts.push({ beam, orb, orbMat, gate, gateMat, handles, plateMat });
    }
  }

  sync(views: readonly ShrineView[], cleared: readonly number[]): void {
    for (const v of views) {
      const p = this.parts[v.id];
      if (!p) continue;
      const done = cleared.includes(v.id);
      p.beam.visible = !done;
      p.orb.visible = !done;
      p.gate.visible = !done && !v.open;
      p.orbMat.color.setHex(v.open ? 0x7dffb5 : 0x3c6b55);
      v.parts.forEach((on, i) => {
        const h = p.handles[i];
        if (h) h.rotation.z = on ? -0.6 : 0.6;
      });
      p.plateMat?.emissive.setHex(v.parts[0] ? 0x2f8a55 : 0x000000);
    }
  }

  animate(t: number): void {
    for (const p of this.parts) {
      p.orb.rotation.y = t;
      p.gateMat.opacity = 0.35 + Math.sin(t * 3) * 0.1;
    }
  }
}
