import * as THREE from 'three';
import { PaperActor } from '../actors/paper';
import { DRAGON, type PicoCircle } from '../../shared/dragon';
import { HALF, MOUNTAINS } from '../../shared/terrain';

const IMG = '/enemies/enemy4.png';
const ASPECT = 459 / 512;
/** The card's feet sit this far below the rider's body so the rider is drawn on its back. */
export const DRAGON_SINK = 3;

export interface DragonPose {
  key: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  wild: boolean;
}

/**
 * El Dragón: the nephew's enemy4 drawing as a paper cutout, 8 m wide. Purple while wild, its own colours once tamed.
 * One card per dragon in view (usually 0–2). Plus the golden leap marker on the Pico and the muro de niebla.
 */
export class DragonMeshes {
  readonly group = new THREE.Group();
  private readonly cards = new Map<string, PaperActor>();
  private readonly marker: THREE.Mesh;
  private readonly markerMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });

  constructor(private readonly camera: THREE.Camera, private readonly pico: PicoCircle) {
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 24), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    // The muro de niebla along the rim (Slice 5 opens it): one soft grey plane.
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2, 200),
      new THREE.MeshBasicMaterial({ color: 0xc9ccd6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    fog.position.set(0, 100, -HALF - MOUNTAINS.rimFrom);
    this.group.add(this.marker, fog);
  }

  /** `window`: the leap is on (show the marker on the Pico's edge toward the wild dragon). */
  sync(poses: readonly DragonPose[], dt: number, window: { x: number; z: number } | null): void {
    const seen = new Set<string>();
    for (const p of poses) {
      seen.add(p.key);
      let c = this.cards.get(p.key);
      if (!c) {
        c = new PaperActor(IMG, DRAGON.width / ASPECT, this.camera, ASPECT);
        this.cards.set(p.key, c);
        this.group.add(c.root);
      }
      c.setTint(p.wild ? 0xb58cff : 0xffffff);
      c.setPose(p.x, p.y, p.z, p.yaw); // p.y: the card's feet (the game sinks it below its rider)
      c.play(p.wild ? 'run' : 'idle');
      c.update(dt);
    }
    for (const [k, c] of this.cards) {
      if (seen.has(k)) continue;
      c.dispose();
      this.cards.delete(k);
    }
    this.marker.visible = !!window;
    if (window) {
      const a = Math.atan2(window.x - this.pico.x, window.z - this.pico.z);
      this.marker.position.set(this.pico.x + Math.sin(a) * (DRAGON.rim - 2), this.pico.top + 0.08, this.pico.z + Math.cos(a) * (DRAGON.rim - 2));
    }
  }
}
