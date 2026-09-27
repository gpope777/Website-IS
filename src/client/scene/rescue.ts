import * as THREE from 'three';
import type { CageView } from '../../shared/protocol';
import { cageY, type RescueSite } from '../../shared/rescue';
import { WATER_LEVEL, type Terrain } from '../../shared/terrain';

const BAR = new THREE.MeshLambertMaterial({ color: 0x2e2233, flatShading: true });
const ROOT = new THREE.MeshLambertMaterial({ color: 0x3a2640, flatShading: true });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xa070ff, transparent: true, opacity: 0.35, depthWrite: false });
const CHAIN = new THREE.MeshBasicMaterial({ color: 0x9a4dff, transparent: true, opacity: 0.5, depthWrite: false });
const PAPER = new THREE.MeshLambertMaterial({ color: 0xf2fff0, side: THREE.DoubleSide });

/**
 * Invasion 2's rescue: the root cage on the seabed (the pale Tragón folded inside), sinking with each
 * broken anchor, and one withered anchor per islet with a purple chain rising from it. Hidden unless taken.
 */
export class RescueMeshes {
  readonly group = new THREE.Group();
  private readonly cage = new THREE.Group();
  private readonly anchors: THREE.Group[] = [];

  constructor(private readonly site: RescueSite, private readonly terrain: Terrain) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3, 5), BAR);
      bar.position.set(Math.sin(a) * 1.3, 0, Math.cos(a) * 1.3);
      this.cage.add(bar);
    }
    for (const y of [-1.5, 1.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 5, 12), BAR);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.cage.add(ring);
    }
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), PAPER);
    this.cage.add(paper);
    this.cage.position.set(site.cage.x, cageY(terrain, site.cage, 0), site.cage.z);
    this.group.add(this.cage);
    for (const a of site.anchors) {
      const g = new THREE.Group();
      const y = terrain.heightAt(a.x, a.z);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 2.6, 5), ROOT);
        r.position.set(Math.sin(ang) * 0.5, 1.1, Math.cos(ang) * 0.5);
        r.rotation.set(Math.cos(ang) * 0.4, 0, -Math.sin(ang) * 0.4);
        g.add(r);
      }
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), GLOW);
      glow.position.y = 2.3;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 5, 1, true), CHAIN);
      chain.position.y = 17;
      g.add(glow, chain);
      g.position.set(a.x, y, a.z);
      this.anchors.push(g);
      this.group.add(g);
    }
    this.group.visible = false;
  }

  sync(view: CageView | null): void {
    this.group.visible = !!view;
    if (!view) return;
    const broken = view.anchors.filter((hp) => hp <= 0).length;
    this.anchors.forEach((g, i) => (g.visible = (view.anchors[i] ?? 0) > 0));
    this.cage.position.y = Math.min(WATER_LEVEL - 1, cageY(this.terrain, this.site.cage, broken));
  }

  animate(t: number): void {
    GLOW.opacity = 0.3 + Math.sin(t * 3) * 0.08;
    this.cage.rotation.y = Math.sin(t * 0.4) * 0.15;
  }
}
