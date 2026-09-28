import * as THREE from 'three';
import { patchPaper } from '../scene/patches';

/** What the game needs from anything it draws for a remote entity (Actor or PaperActor). */
export interface Puppet {
  readonly root: THREE.Object3D;
  play(anim: string): void;
  setPose(x: number, y: number, z: number, yaw: number): void;
  update(dt: number): void;
  dispose(): void;
}

const textures = new Map<string, THREE.Texture>();
function texture(url: string): THREE.Texture {
  let t = textures.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(url, t);
  }
  return t;
}

/**
 * "Papel espíritu": one of the nephew's drawings as a living paper cutout. A flat card that
 * turns to face the camera, bobs, sways and squashes; crouches when it attacks, falls flat
 * when it dies. The drawing faces left, so it mirrors when walking screen-right.
 */
export class PaperActor implements Puppet {
  /** V2-E: the white paper edge (medium/high; set by the game from the tier). */
  static paperBorder = false;
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly card: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly width: number;
  private anim = 'idle';
  private yaw = 0;
  private t = Math.random() * 10;
  private fall = 0;
  private flip = 1;

  constructor(url: string, private readonly height: number, private readonly camera: THREE.Camera, aspect = 409 / 450) {
    this.width = height * aspect;
    this.mat = new THREE.MeshBasicMaterial({ map: texture(url), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    patchPaper(this.mat, { border: PaperActor.paperBorder }); // lit by the look (V2-E)
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // pivot at the feet
    this.card = new THREE.Mesh(geo, this.mat);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(this.width * 0.4, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.pivot.add(this.card);
    this.root.add(this.pivot, shadow);
  }

  play(anim: string): void {
    this.anim = anim;
    if (anim !== 'dead') this.fall = 0;
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.yaw = yaw;
  }

  setTint(hex: number): void {
    this.mat.color.setHex(hex);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    const p = this.root.position;
    const cam = this.camera.position;
    this.pivot.rotation.y = Math.atan2(cam.x - p.x, cam.z - p.z); // cylindrical billboard
    // Mirror so the mouth (drawn on the left) leads: compare facing with the camera's right.
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const side = Math.sin(this.yaw) * right.x + Math.cos(this.yaw) * right.z;
    if (Math.abs(side) > 0.2) this.flip = side > 0 ? -1 : 1;

    let sy = 1 + Math.sin(t * 3.2) * 0.04;
    let sx = 1 / sy;
    let bob = Math.sin(t * 2) * 0.08 + 0.08;
    let sway = Math.sin(t * 1.4) * 0.05;
    if (this.anim === 'run' || this.anim === 'walk') {
      bob = Math.abs(Math.sin(t * 9)) * 0.22; // rattling on its wheels
      sway = -0.12 * this.flip + Math.sin(t * 9) * 0.04;
    } else if (this.anim === 'attack') {
      sy = 0.8 + Math.sin(t * 40) * 0.03; // crouched, trembling: the bite is coming
      sx = 1.2;
      bob = 0;
    }
    this.card.rotation.x = 0;
    this.mat.opacity = 1;
    if (this.anim === 'dead') {
      this.fall += dt;
      this.card.rotation.x = -Math.min(1, this.fall * 1.5) * (Math.PI / 2);
      this.mat.opacity = Math.max(0, 1 - Math.max(0, this.fall - 1.5));
      bob = 0;
      sway = 0;
      sy = 1;
      sx = 1;
    }
    this.card.scale.set(this.width * sx * this.flip, this.height * sy, 1);
    this.card.position.y = bob;
    this.card.rotation.z = sway;
  }

  dispose(): void {
    this.mat.dispose();
    this.root.removeFromParent();
  }
}
