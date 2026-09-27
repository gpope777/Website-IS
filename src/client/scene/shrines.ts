import * as THREE from 'three';
import type { ShrineView } from '../../shared/protocol';
import type { Shrine } from '../../shared/shrines';
import { WATER_LEVEL, type Terrain } from '../../shared/terrain';
import { SWAMP_SHRINE } from '../../shared/swamp-shrines';
import { buildCrags } from './crags';
import type { Crag } from '../../shared/crags';

const STONE = new THREE.MeshLambertMaterial({ color: 0x8f8a7e, flatShading: true });
const WOOD = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
const PUMICE = new THREE.MeshLambertMaterial({ color: 0xd9d4c7, flatShading: true });
const PEAT = new THREE.MeshLambertMaterial({ color: 0x4a3322, flatShading: true });
const LILY = new THREE.MeshLambertMaterial({ color: 0x4f8a3a });
/** Flames ignore the swamp fog: they are the lures. */
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040, fog: false });
const BEAM = new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0.18, depthWrite: false });

interface Parts {
  beam: THREE.Mesh;
  orb: THREE.Mesh;
  orbMat: THREE.MeshBasicMaterial;
  gate: THREE.Mesh;
  gateMat: THREE.MeshBasicMaterial;
  handles: THREE.Object3D[];
  plateMat: THREE.MeshLambertMaterial | null;
  /** Marea's pumice block. */
  block: THREE.Mesh | null;
  /** Candiles: one flame per brazier. */
  flames: THREE.Mesh[];
  /** Nenúfares: the pads (lowered while sunk). */
  pads: THREE.Mesh[];
  /** Losas gemelas: the second plate's glow. Bloques: the 3 stone blocks. */
  plate2Mat: THREE.MeshLambertMaterial | null;
  stones: THREE.Mesh[];
}

/** Shrines: a beam of light on the horizon, an orb behind a ring of light, levers or a plate. */
export class ShrineMeshes {
  readonly group = new THREE.Group();
  private readonly parts: Parts[] = [];

  constructor(shrines: readonly Shrine[], private readonly terrain: Terrain, shadows: boolean, ledges: readonly Crag[] = []) {
    const pillars = [...shrines.flatMap((s) => (s.pillar ? [s.pillar] : [])), ...ledges];
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
      if (s.kind === 'levers' || s.kind === 'sunken') {
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
      if (s.kind === 'fan') {
        for (const p of s.parts) {
          const y = terrain.heightAt(p.x, p.z);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), STONE);
          post.position.set(p.x, y + 0.6, p.z);
          const pivot = new THREE.Object3D();
          pivot.position.set(p.x, y + 1.3, p.z);
          pivot.rotation.y = Math.atan2(p.x - s.x, p.z - s.z);
          const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 6, 12), WOOD);
          wheel.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), WOOD));
          pivot.add(wheel);
          handles.push(pivot);
          this.group.add(post, pivot);
        }
      }
      const flames: THREE.Mesh[] = [];
      const pads: THREE.Mesh[] = [];
      if (s.kind === 'candles') {
        s.parts.forEach((p, i) => {
          const y = terrain.heightAt(p.x, p.z);
          if (i === 3) {
            // The torch post: a pole with a small flame that never goes out.
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 0.25), WOOD);
            pole.position.set(p.x, y + 0.9, p.z);
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), FLAME);
            tip.position.set(p.x, y + 2, p.z);
            this.group.add(pole, tip);
            return;
          }
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.9, 8), STONE);
          bowl.position.set(p.x, y + 0.45, p.z);
          const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 7), FLAME);
          flame.position.set(p.x, y + 1.5, p.z);
          flame.visible = false;
          flames.push(flame);
          this.group.add(bowl, flame);
        });
      }
      if (s.kind === 'lilies') {
        for (const p of s.parts) {
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(SWAMP_SHRINE.padR, SWAMP_SHRINE.padR, 0.12, 12), LILY);
          pad.position.set(p.x, WATER_LEVEL + SWAMP_SHRINE.padTop - 0.06, p.z);
          pads.push(pad);
          this.group.add(pad);
        }
      }
      if (s.kind === 'peat') {
        // The peat wall replaces the light gate: dark roots that only burn (three Llamaradas; it hides once open).
        (gate as THREE.Mesh).material = PEAT;
        gate.geometry = new THREE.CylinderGeometry(1.6, 1.8, 2.6, 10, 1, false);
      }
      let block: THREE.Mesh | null = null;
      if (s.kind === 'tide') {
        block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), PUMICE);
        const b = s.parts[1]!;
        block.position.set(b.x, terrain.heightAt(b.x, b.z) + 0.4, b.z);
        this.group.add(block);
      }
      let plate2Mat: THREE.MeshLambertMaterial | null = null;
      const stones: THREE.Mesh[] = [];
      if (s.kind === 'twins') {
        // Two plates and the loose boulder uphill of the second one.
        block = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), STONE);
        const b = s.parts[2]!;
        block.position.set(b.x, terrain.heightAt(b.x, b.z) + 0.8, b.z);
        this.group.add(block);
        plate2Mat = new THREE.MeshLambertMaterial({ color: 0x8f8a7e, emissive: 0x000000 });
        const p2 = s.parts[1]!;
        const plate2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.25, 12), plate2Mat);
        plate2.position.set(p2.x, terrain.heightAt(p2.x, p2.z) + 0.05, p2.z);
        this.group.add(plate2);
      }
      if (s.kind === 'blocks') {
        // The marked cells (pale slabs), the 3 blocks (moved by the snap) and the reset lever.
        for (const c of s.parts.slice(3, 6)) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), PUMICE);
          slab.position.set(c.x, terrain.heightAt(c.x, c.z) + 0.05, c.z);
          this.group.add(slab);
        }
        for (const c of s.parts.slice(0, 3)) {
          const cube = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), STONE);
          cube.position.set(c.x, terrain.heightAt(c.x, c.z) + 0.9, c.z);
          stones.push(cube);
          this.group.add(cube);
        }
        const l = s.parts[6]!;
        const y = terrain.heightAt(l.x, l.z);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), STONE);
        post.position.set(l.x, y + 0.5, l.z);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), WOOD);
        handle.position.set(l.x, y + 1.5, l.z);
        handle.rotation.z = 0.6;
        this.group.add(post, handle);
      }
      if (s.kind === 'plate' || s.kind === 'tide' || s.kind === 'twins') {
        plateMat = new THREE.MeshLambertMaterial({ color: 0x8f8a7e, emissive: 0x000000 });
        const p = s.parts[0]!;
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.25, 12), plateMat);
        plate.position.set(p.x, terrain.heightAt(p.x, p.z) + 0.05, p.z);
        this.group.add(plate);
      }
      this.parts.push({ beam, orb, orbMat, gate, gateMat, handles, plateMat, block, flames, pads, plate2Mat, stones });
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
      if (p.block && v.block) p.block.position.set(v.block.x, this.terrain.heightAt(v.block.x, v.block.z) + (v.block.held ? 1.4 : p.plate2Mat ? 0.8 : 0.4), v.block.z);
      p.plate2Mat?.emissive.setHex(v.parts[1] ? 0x2f8a55 : 0x000000);
      v.blocks?.forEach((k, i) => p.stones[i]?.position.set(k.x, this.terrain.heightAt(k.x, k.z) + 0.9, k.z));
      p.plateMat?.emissive.setHex(v.parts[0] ? 0x2f8a55 : 0x000000);
      p.flames.forEach((f, i) => (f.visible = !!v.parts[i]));
      p.pads.forEach((m, i) => (m.position.y = WATER_LEVEL + SWAMP_SHRINE.padTop - (v.parts[i] ? 0.06 : 0.7)));
    }
  }

  animate(t: number): void {
    for (const p of this.parts) {
      p.orb.rotation.y = t;
      p.gateMat.opacity = 0.35 + Math.sin(t * 3) * 0.1;
      for (const f of p.flames) f.scale.y = 1 + Math.sin(t * 9 + f.position.x) * 0.15;
    }
  }
}
