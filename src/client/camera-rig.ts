import type * as THREE from 'three';
import type { Terrain } from '../shared/terrain';

export type CamMode = 'third' | 'first';

const FAR_K = 2.4;

/** Over-the-shoulder orbit camera with a first-person toggle. yaw 0 looks toward -Z, matching movement. */
export class CameraRig {
  mode: CamMode = 'third';
  yaw = 0;
  pitch = -0.25;
  private readonly dist = 4.5;
  /** Flying the dragon: the camera eases out to FAR_K × dist and a little higher. */
  far = false;
  private k = 1;

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0022;
    const maxUp = this.mode === 'first' ? 1.45 : 0.6;
    this.pitch = Math.max(-1.2, Math.min(maxUp, this.pitch - dy * 0.0022));
  }

  toggle(): void {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.pitch = Math.min(this.pitch, 0.6);
  }

  apply(cam: THREE.PerspectiveCamera, target: { x: number; y: number; z: number }, terrain: Terrain): void {
    if (this.mode === 'first') {
      cam.position.set(target.x, target.y + 1.7, target.z);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    this.k += ((this.far ? FAR_K : 1) - this.k) * 0.05;
    const dist = this.dist * this.k;
    const eyeY = target.y + 1.6 + (this.k - 1) * 1.5;
    const cp = Math.cos(this.pitch);
    const x = target.x + Math.sin(this.yaw) * cp * dist;
    const z = target.z + Math.cos(this.yaw) * cp * dist;
    const y = Math.max(eyeY - Math.sin(this.pitch) * dist, terrain.heightAt(x, z) + 0.4);
    cam.position.set(x, y, z);
    cam.lookAt(target.x, eyeY, target.z);
  }
}
