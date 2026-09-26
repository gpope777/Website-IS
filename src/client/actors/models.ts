import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
