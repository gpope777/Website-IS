import * as THREE from 'three';
import type { World } from './world';
import { HALF } from './world';
import { createRng } from './rng';

/** A simple night predator. It roams, stalks the player in the dark, and fears fire and torches. */
export class Wolf {
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  private target = new THREE.Vector3();
  private retarget = 0;
  private attackCooldown = 0;
  private rng: () => number;
  state: 'roam' | 'stalk' | 'flee' = 'roam';

  constructor(private readonly world: World, seed: number) {
    this.rng = createRng(seed);
    this.object = Wolf.buildMesh();
    this.position = this.object.position;
    this.position.set((this.rng() - 0.5) * 200, 0, (this.rng() - 0.5) * 200);
    this.position.y = world.heightAt(this.position.x, this.position.z);
    this.pickTarget();
    world.scene.add(this.object);
  }

  private static buildMesh(): THREE.Group {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: 0x4a4a4f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.5), fur);
    body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.4), fur);
    head.position.set(0.8, 0.8, 0);
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.32), new THREE.MeshBasicMaterial({ color: 0xffdd44 }));
    eyes.position.set(1.02, 0.86, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), fur);
    tail.position.set(-0.85, 0.75, 0);
    tail.rotation.z = 0.5;
    g.add(body, head, eyes, tail);
    for (const [x, z] of [[0.45, 0.18], [0.45, -0.18], [-0.45, 0.18], [-0.45, -0.18]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), fur);
      leg.position.set(x, 0.28, z);
      g.add(leg);
    }
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }

  private pickTarget(): void {
    const a = this.rng() * Math.PI * 2;
    const r = 15 + this.rng() * 30;
    this.target.set(
      Math.max(-HALF + 10, Math.min(HALF - 10, this.position.x + Math.cos(a) * r)),
      0,
      Math.max(-HALF + 10, Math.min(HALF - 10, this.position.z + Math.sin(a) * r)),
    );
    this.retarget = 6 + this.rng() * 8;
  }

  /** Returns damage dealt to the player this frame. */
  update(dt: number, player: THREE.Vector3, night: boolean, playerHasLight: boolean, t: number): number {
    this.retarget -= dt;
    this.attackCooldown -= dt;
    const toPlayer = new THREE.Vector3().subVectors(player, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const nearFire = this.world.placed.some((p) => p.kind === 'campfire' && p.position.distanceTo(player) < 9);
    const scared = nearFire || playerHasLight;

    if (scared && dist < 14) this.state = 'flee';
    else if (night && dist < 45) this.state = 'stalk';
    else this.state = 'roam';

    let speed = 2.5;
    let dir: THREE.Vector3;
    if (this.state === 'flee') {
      dir = toPlayer.clone().multiplyScalar(-1);
      speed = 6;
    } else if (this.state === 'stalk') {
      dir = toPlayer.clone();
      speed = dist > 20 ? 3.6 : 5.2;
    } else {
      if (this.retarget <= 0 || this.position.distanceTo(this.target) < 2) this.pickTarget();
      dir = new THREE.Vector3().subVectors(this.target, this.position);
      dir.y = 0;
    }
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      this.position.x += dir.x * speed * dt;
      this.position.z += dir.z * speed * dt;
      this.object.rotation.y = Math.atan2(-dir.z, dir.x);
    }
    this.position.x = Math.max(-HALF + 5, Math.min(HALF - 5, this.position.x));
    this.position.z = Math.max(-HALF + 5, Math.min(HALF - 5, this.position.z));
    const ground = this.world.heightAt(this.position.x, this.position.z);
    this.position.y = Math.max(ground, -3.0) + Math.abs(Math.sin(t * 10)) * (speed > 3 ? 0.08 : 0);

    if (this.state === 'stalk' && dist < 1.8 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.4;
      return 12;
    }
    return 0;
  }
}
