/** V2-E: a client-only showcase for the perf harness (`npm run perf -- --vitrina`): nothing here is sent or saved. */
import * as THREE from 'three';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import type { Body as HeroBody } from './actors/hero-clips';
import type { ModelKit } from './actors/models';
import { PaperActor } from './actors/paper';
import { FishMeshes } from './scene/fish';
import { FrogMeshes } from './scene/frog';
import { SteedMeshes } from './scene/steeds';
import { WhaleMesh } from './scene/whale';

export interface VitrinaEnv {
  scene: THREE.Scene;
  camera: THREE.Camera;
  kits: { heroes: Record<HeroBody, ModelKit>; fox: ModelKit };
  heightAt(x: number, z: number): number;
  /** Extra per-kind setup for fox enemies (colour, scale, boards), from the game. */
  dressEnemy?(a: Actor, kind: string, x: number, z: number): void;
  chargeMark?(x: number, y: number, z: number, yaw: number): THREE.Object3D;
}

/** What to show `d` m ahead of (x, z) looking toward −Z: 'mounts', 'enemies', 'paper' or 'pose:<anim>'. */
export class Vitrina {
  readonly group = new THREE.Group();
  private tick: ((dt: number, now: number) => void) | null = null;

  constructor(private readonly env: VitrinaEnv) {
    env.scene.add(this.group);
  }

  /** Content is laid out in camera space: local −Z = away from the camera, +X = screen right; placed in world coordinates. */
  show(what: string | null): void {
    this.clear();
    if (!what) return;
    const cam = this.env.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
    const th = Math.atan2(fwd.x, fwd.z) + Math.PI;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const cx = cam.position.x;
    const cz = cam.position.z;
    /** World x/z of a camera-space offset. */
    const W = (dx: number, dz: number) => ({ x: cx + dx * c + dz * sn, z: cz - dx * sn + dz * c });
    const Y = (localYaw: number) => localYaw + th;
    const g = (dx: number, dz: number) => {
      const w = W(dx, dz);
      return this.env.heightAt(w.x, w.z);
    };
    const P = (dx: number, dz: number) => ({ ...W(dx, dz), y: g(dx, dz) });
    if (what === 'mounts') {
      const steeds = new SteedMeshes(false);
      const fish = new FishMeshes(false);
      const frogs = new FrogMeshes(false);
      const whale = new WhaleMesh(false);
      this.group.add(steeds.group, fish.group, frogs.group, whale.group);
      const d1 = P(-3.2, -9);
      const d2 = P(3.4, -10);
      const f = P(-2.6, -5.5);
      const r = P(2.6, -5.5);
      const w = P(0, -22);
      this.tick = (dt, now) => {
        steeds.sync(
          [
            { key: 'a', ...d1, yaw: Y(Math.PI / 2), speed: 8, wild: false, bucking: false },
            { key: 'b', ...d2, yaw: Y(-Math.PI / 2.5), speed: 0, wild: true, bucking: false },
          ],
          dt,
          now,
        );
        fish.sync([{ key: 'f', ...f, y: f.y + 0.7, yaw: Y(Math.PI / 2), speed: 4, wild: false, bucking: false }], dt, now);
        frogs.sync([{ key: 'r', ...r, yaw: Y(-Math.PI / 3), wild: true, bucking: false }], now);
        whale.sync({ x: w.x, z: w.z, yaw: Y(Math.PI / 2) }, false, false, now);
        whale.group.position.y = w.y + 0.8;
      };
    } else if (what === 'enemies') {
      const kinds = ['wolf', 'ash', 'brute', 'elite', 'elite2', 'elite3', 'elite4'];
      kinds.forEach((k, i) => {
        const a = new Actor(this.env.kits.fox, WOLF_CLIPS);
        const at = P(-7.5 + i * 2.5, -9 - (i % 2) * 2.5);
        a.setPose(at.x, at.y, at.z, Y(Math.PI / 2 + 0.5));
        this.env.dressEnemy?.(a, k, at.x, at.z);
        this.group.add(a.root);
        if (k === 'elite' && this.env.chargeMark) this.group.add(this.env.chargeMark(at.x, at.y, at.z, Y(Math.PI / 2 + 0.5)));
        this.tickAlso((dt) => a.update(dt));
      });
    } else if (what === 'paper') {
      ['/enemies/enemy1.png', '/enemies/enemy2.png', '/enemies/enemy3.png'].forEach((url, i) => {
        const p = new PaperActor(url, 3, this.env.camera);
        const at = P(-4 + i * 4, -8);
        p.setPose(at.x, at.y, at.z, 0);
        this.group.add(p.root);
        this.tickAlso((dt) => p.update(dt));
      });
    } else if (what.startsWith('pose:')) {
      const anim = what.slice(5);
      const a = new Actor(this.env.kits.heroes.caballero, PLAYER_CLIPS);
      const at = P(0, -3.2);
      a.setPose(at.x, at.y + (anim === 'glide' ? 0.5 : 0), at.z, Y(Math.PI / 2));
      a.play(anim);
      if (anim === 'roll') a.holdPoseAt = 0.16; // mid-turn: SwiftShader draws ~2 fps
      this.group.add(a.root);
      this.tickAlso((dt) => a.update(dt));
    }
  }

  private tickAlso(f: (dt: number, now: number) => void): void {
    const prev = this.tick;
    this.tick = (dt, now) => {
      prev?.(dt, now);
      f(dt, now);
    };
  }

  update(dt: number): void {
    this.tick?.(dt, performance.now() / 1000);
  }

  private clear(): void {
    this.tick = null;
    for (const c of [...this.group.children]) c.removeFromParent();
  }
}
