import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DROP_INS, isModelResponse, type DropIn } from './drop-ins';
import { BODIES, type Body } from './hero-clips';

export interface ModelKit {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** Uniform scale that makes the model `height` metres tall. */
  scale: number;
  /** Extra rotation so the model faces +Z (protocol yaw convention). Verify in the browser, Task 14 Step 5. */
  yawOffset: number;
}

async function load(url: string, height: number, yawOffset: number): Promise<ModelKit> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  return { scene: gltf.scene, clips: gltf.animations, scale: height / (box.max.y - box.min.y), yawOffset };
}

const FILE: Record<Body, string> = { caballero: 'heroe-caballero', barbaro: 'heroe-barbaro', maga: 'heroe-maga', picaro: 'heroe-picaro' };

/** KayKit characters face +Z like the robot (verify in the browser, Task 9; set `yawOffset` there if not). Height 1.8 m keeps seats and colliders as they are. */
export async function loadModels(): Promise<{ heroes: Record<Body, ModelKit>; fox: ModelKit }> {
  const [anims, fox, ...bodies] = await Promise.all([
    new GLTFLoader().loadAsync('/models/heroe-anims.glb'),
    load('/models/fox.glb', 0.75, 0),
    ...BODIES.map((b) => load(`/models/${FILE[b]}.glb`, 1.8, 0)),
  ]);
  const heroes = {} as Record<Body, ModelKit>;
  BODIES.forEach((b, i) => (heroes[b] = { ...bodies[i]!, clips: anims.animations }));
  return { heroes, fox };
}

/** V2-E: `public/models/<name>.glb` if Gabriel dropped it there (spec §9), else null → procedural / fox. Never throws. */
export async function loadOptional(name: DropIn): Promise<ModelKit | null> {
  const url = `/models/${name}.glb`;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!isModelResponse(head.ok, head.headers.get('content-type'))) return null;
    return await load(url, DROP_INS[name].height, 0);
  } catch {
    return null;
  }
}

export type DropInKits = Partial<Record<DropIn, ModelKit>>;
export async function loadDropIns(): Promise<DropInKits> {
  const names = Object.keys(DROP_INS) as DropIn[];
  const kits = await Promise.all(names.map(loadOptional));
  const out: DropInKits = {};
  names.forEach((n, i) => {
    if (kits[i]) out[n] = kits[i]!;
  });
  return out;
}
