import * as THREE from 'three';
import type { World } from './world';
import { HALF } from './world';
import { createRng } from './rng';

/** Number of concept-art sprites in public/enemies (enemy1.png … enemyN.png). */
export const CREATURE_KINDS = 7;
/** How many creatures roam at once (kinds repeat). */
export const CREATURE_COUNT = 18;
const loader = new THREE.TextureLoader();
const textures: THREE.Texture[] = [];

function textureFor(kind: number): THREE.Texture {
  if (!textures[kind]) {
    const t = loader.load(`${import.meta.env.BASE_URL}enemies/enemy${kind + 1}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    textures[kind] = t;
  }
  return textures[kind];
}

/**
 * A billboard monster drawn from the hand-made concept art. Roams by day, hunts by night
 * (and by day when you get close). Dies after a few punches; respawns somewhere else later.
 */
export class Creature {
  readonly object: THREE.Sprite;
  readonly position: THREE.Vector3;
  hp = 30;
  private readonly maxHp = 30;
  private target = new THREE.Vector3();
  private retarget = 0;
  private attackCooldown = 0;
  private respawn = 0;
  private hurt = 0;
  private rng: () => number;
  private readonly size: number;

  constructor(private readonly world: World, seed: number, readonly kind: number) {
    this.rng = createRng(seed);
    this.size = 1.6 + this.rng() * 1.2;
    this.object = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureFor(kind), transparent: true, alphaTest: 0.2 }));
    this.object.scale.set(this.size, this.size, 1);
    this.position = this.object.position;
    this.spawn(new THREE.Vector3());
    world.scene.add(this.object);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  private spawn(awayFrom: THREE.Vector3): void {
    // Spawn in a ring around the player: close enough to be met within a minute, never on top of them.
    for (let i = 0; i < 10; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 25 + this.rng() * 45;
      this.position.set(
        Math.max(-HALF + 10, Math.min(HALF - 10, awayFrom.x + Math.cos(a) * r)),
        0,
        Math.max(-HALF + 10, Math.min(HALF - 10, awayFrom.z + Math.sin(a) * r)),
      );
      if (this.world.heightAt(this.position.x, this.position.z) > -2.5) break;
    }
    this.hp = this.maxHp;
    this.object.visible = true;
    this.pickTarget();
  }

  private pickTarget(): void {
    const a = this.rng() * Math.PI * 2;
    const r = 10 + this.rng() * 25;
    this.target.set(
      Math.max(-HALF + 10, Math.min(HALF - 10, this.position.x + Math.cos(a) * r)),
      0,
      Math.max(-HALF + 10, Math.min(HALF - 10, this.position.z + Math.sin(a) * r)),
    );
    this.retarget = 5 + this.rng() * 8;
  }

  /** Returns true if the creature died from this hit. */
  hit(damage: number, from: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.hurt = 0.25;
    // Knockback.
    const away = new THREE.Vector3().subVectors(this.position, from);
    away.y = 0;
    if (away.lengthSq() > 0.001) this.position.addScaledVector(away.normalize(), 1.2);
    if (this.hp <= 0) {
      this.object.visible = false;
      this.respawn = 20 + this.rng() * 20;
      return true;
    }
    return false;
  }

  /** Returns damage dealt to the player this frame. */
  update(dt: number, player: THREE.Vector3, night: boolean, t: number): number {
    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0) this.spawn(player);
      return 0;
    }
    this.retarget -= dt;
    this.attackCooldown -= dt;
    this.hurt = Math.max(0, this.hurt - dt);
    const mat = this.object.material as THREE.SpriteMaterial;
    mat.color.setScalar(this.hurt > 0 ? 3 : 1);

    const toPlayer = new THREE.Vector3().subVectors(player, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const hunting = dist < (night ? 40 : 12);

    let speed = 2;
    let dir: THREE.Vector3;
    if (hunting) {
      dir = toPlayer;
      speed = night ? 4.2 : 3.2;
    } else {
      if (this.retarget <= 0 || this.position.distanceTo(this.target) < 2) this.pickTarget();
      dir = new THREE.Vector3().subVectors(this.target, this.position);
      dir.y = 0;
    }
    if (dir.lengthSq() > 0.001 && dist > 1.2) {
      dir.normalize();
      this.position.x += dir.x * speed * dt;
      this.position.z += dir.z * speed * dt;
    }
    this.position.x = Math.max(-HALF + 5, Math.min(HALF - 5, this.position.x));
    this.position.z = Math.max(-HALF + 5, Math.min(HALF - 5, this.position.z));
    const ground = this.world.heightAt(this.position.x, this.position.z);
    this.position.y = Math.max(ground, -3.0) + this.size / 2 + Math.abs(Math.sin(t * 6 + this.kind)) * 0.15;

    if (hunting && dist < 2 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.6;
      return 8;
    }
    return 0;
  }
}
