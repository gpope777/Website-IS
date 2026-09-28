import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DROP_INS, isModelResponse, type DropIn } from './drop-ins';

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

export async function loadModels(): Promise<{ robot: ModelKit; fox: ModelKit }> {
  const [robot, fox] = await Promise.all([load('/models/robot.glb', 1.8, 0), load('/models/fox.glb', 0.75, 0)]);
  return { robot, fox };
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
