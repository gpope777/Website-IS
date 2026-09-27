/** V2-E: a client-only showcase for the perf harness (`npm run perf -- --vitrina`): nothing here is sent or saved. */
import * as THREE from 'three';
import { Actor, PLAYER_CLIPS, WOLF_CLIPS } from './actors/actor';
import type { ModelKit } from './actors/models';
import { PaperActor } from './actors/paper';
import { FishMeshes } from './scene/fish';
import { FrogMeshes } from './scene/frog';
import { SteedMeshes } from './scene/steeds';
import { WhaleMesh } from './scene/whale';

export interface VitrinaEnv {
  scene: THREE.Scene;
  camera: THREE.Camera;
  kits: { robot: ModelKit; fox: ModelKit };
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

  show(what: string | null, x: number, z: number): void {
    this.clear();
    if (!what) return;
    const g = (dx: number, dz: number) => this.env.heightAt(x + dx, z + dz);
    if (what === 'mounts') {
      const steeds = new SteedMeshes(false);
      const fish = new FishMeshes(false);
      const frogs = new FrogMeshes(false);
      const whale = new WhaleMesh(false);
      this.group.add(steeds.group, fish.group, frogs.group, whale.group);
      this.tick = (dt, now) => {
        steeds.sync(
          [
            { key: 'a', x: x - 4, y: g(-4, -9), z: z - 9, yaw: Math.PI / 2, speed: 8, wild: false, bucking: false },
            { key: 'b', x: x + 3.5, y: g(3.5, -10), z: z - 10, yaw: -Math.PI / 2.5, speed: 0, wild: true, bucking: false },
          ],
          dt,
          now,
        );
        fish.sync([{ key: 'f', x: x - 3, y: g(-3, -4) + 0.7, z: z - 4, yaw: Math.PI / 2, speed: 4, wild: false, bucking: false }], dt, now);
        frogs.sync([{ key: 'r', x: x + 3, y: g(3, -4), z: z - 4, yaw: -Math.PI / 3, wild: true, bucking: false }], now);
        whale.sync({ x: x, z: z - 22, yaw: Math.PI / 2 }, false, false, now);
        whale.group.position.y = g(0, -22) + 0.8;
      };
    } else if (what === 'enemies') {
      const kinds = ['wolf', 'ash', 'brute', 'elite', 'elite2', 'elite3', 'elite4'];
      kinds.forEach((k, i) => {
        const a = new Actor(this.env.kits.fox, WOLF_CLIPS);
        const ax = x - 9 + i * 3;
        const az = z - 10 - (i % 2) * 2;
        a.setPose(ax, g(ax - x, az - z), az, Math.PI / 2 + 0.4);
        this.env.dressEnemy?.(a, k, ax, az);
        this.group.add(a.root);
        if (k === 'elite' && this.env.chargeMark) this.group.add(this.env.chargeMark(ax, g(ax - x, az - z), az, Math.PI / 2 + 0.4));
        this.tickAlso((dt) => a.update(dt));
      });
    } else if (what === 'paper') {
      const imgs = ['/enemies/enemy1.png', '/enemies/enemy2.png', '/enemies/enemy3.png'];
      imgs.forEach((url, i) => {
        const p = new PaperActor(url, 3, this.env.camera);
        const px = x - 4 + i * 4;
        p.setPose(px, g(px - x, -8), z - 8, 0);
        this.group.add(p.root);
        this.tickAlso((dt) => p.update(dt));
      });
    } else if (what.startsWith('pose:')) {
      const anim = what.slice(5);
      const a = new Actor(this.env.kits.robot, PLAYER_CLIPS);
      a.setPose(x, g(0, -3) + (anim === 'glide' ? 1.5 : 0), z - 3, Math.PI / 2);
      a.play(anim);
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
