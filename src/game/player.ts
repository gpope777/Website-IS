import * as THREE from 'three';
import type { World } from './world';
import { HALF } from './world';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  /** Optional analog movement (touch stick): x = strafe, z = forward(-)/back(+), magnitude ≤ 1. */
  axis?: { x: number; z: number };
}

export const EYE_HEIGHT = 1.7;
/** Lake surface height (see World.buildWater). */
export const WATER_LEVEL = -3.2;

export class Player {
  readonly position = new THREE.Vector3(0, 0, 0);
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  private verticalVel = 0;

  constructor(private readonly world: World) {
    this.position.y = world.heightAt(0, 0);
  }

  forwardDir(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0022));
  }

  update(input: InputState, dt: number, energy: number): { moving: boolean; sprinting: boolean; swimming: boolean } {
    const tired = energy < 12;
    const swimming = this.world.heightAt(this.position.x, this.position.z) < WATER_LEVEL - 0.6;
    const canSprint = input.sprint && !tired && !swimming;
    const speed = (swimming ? 2.2 : canSprint ? 7.5 : 3.8) * (tired ? 0.65 : 1);
    const dir = new THREE.Vector3();
    if (input.axis) {
      dir.set(input.axis.x, 0, input.axis.z);
      if (dir.lengthSq() > 1) dir.normalize();
    } else {
      if (input.forward) dir.z -= 1;
      if (input.back) dir.z += 1;
      if (input.left) dir.x -= 1;
      if (input.right) dir.x += 1;
      if (dir.lengthSq() > 0) dir.normalize();
    }
    const moving = dir.lengthSq() > 0;
    if (moving) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const target = dir.multiplyScalar(speed);
    const accel = this.onGround ? 12 : 3;
    this.velocity.x += (target.x - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (target.z - this.velocity.z) * Math.min(1, accel * dt);

    const next = this.position.clone();
    next.x += this.velocity.x * dt;
    next.z += this.velocity.z * dt;
    this.resolveTreeCollisions(next);
    next.x = Math.max(-HALF + 3, Math.min(HALF - 3, next.x));
    next.z = Math.max(-HALF + 3, Math.min(HALF - 3, next.z));

    const terrain = this.world.heightAt(next.x, next.z);
    if (terrain < WATER_LEVEL - 0.6) {
      // Deep water: float at the surface, no jumping.
      next.y = WATER_LEVEL - 0.9;
      this.verticalVel = 0;
      this.onGround = true;
      this.position.copy(next);
      return { moving, sprinting: false, swimming: true };
    }
    const ground = Math.max(terrain, WATER_LEVEL - 0.6);
    if (input.jump && this.onGround) {
      this.verticalVel = 5.2;
      this.onGround = false;
    }
    this.verticalVel -= 14 * dt;
    next.y = this.position.y + this.verticalVel * dt;
    if (next.y <= ground) {
      next.y = ground;
      this.verticalVel = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    // Slope handling: walking up steep slopes snaps you to ground smoothly.
    if (this.onGround) next.y = ground;

    this.position.copy(next);
    return { moving: moving && this.onGround, sprinting: canSprint && moving, swimming: false };
  }

  private resolveTreeCollisions(next: THREE.Vector3): void {
    const pr = 0.45;
    for (const res of this.world.resources) {
      if (res.uses <= 0 || (res.kind !== 'tree' && res.kind !== 'rock')) continue;
      const dx = next.x - res.position.x;
      const dz = next.z - res.position.z;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
      const d = Math.hypot(dx, dz);
      const min = pr + res.radius;
      if (d < min && d > 0.0001) {
        const push = (min - d) / d;
        next.x += dx * push;
        next.z += dz * push;
      }
    }
    for (const p of this.world.placed) {
      if (p.kind !== 'campfire') continue;
      const dx = next.x - p.position.x;
      const dz = next.z - p.position.z;
      const d = Math.hypot(dx, dz);
      const min = 1.1;
      if (d < min && d > 0.0001) {
        const push = (min - d) / d;
        next.x += dx * push;
        next.z += dz * push;
      }
    }
  }

  applyToCamera(camera: THREE.PerspectiveCamera, bobTime: number, moving: boolean): void {
    camera.position.copy(this.position);
    camera.position.y += EYE_HEIGHT + (moving ? Math.sin(bobTime * 9) * 0.05 : 0);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
  }
}
