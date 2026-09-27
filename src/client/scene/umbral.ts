import * as THREE from 'three';
import { ESCALERA, UMBRAL } from '../../shared/mountains';
import { ATALAYA } from '../../shared/sim/cucurucho';
import { HALF, type Terrain } from '../../shared/terrain';

const CARVED = new THREE.MeshLambertMaterial({ color: 0x9a968c, flatShading: true });
const MARK = new THREE.MeshBasicMaterial({ color: 0xd8e4f0, fog: false });
const STEP = new THREE.MeshLambertMaterial({ color: 0xa4a29a, flatShading: true });
const TOWER = new THREE.MeshLambertMaterial({ color: 0x8c8a84, flatShading: true });

/** The carved Umbral block at the foot of los Peldaños, and la Escalera del Umbral once it is raised. */
export class UmbralMeshes {
  readonly group = new THREE.Group();
  private readonly block = new THREE.Group();
  private readonly steps: THREE.InstancedMesh;

  /** `terrain`: the plain terrain (no Escalera), so the steps reach down to the cliff's foot. */
  constructor(terrain: Terrain) {
    const y = terrain.heightAt(UMBRAL.x, UMBRAL.z);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(UMBRAL.size, UMBRAL.size, UMBRAL.size), CARVED);
    cube.position.set(UMBRAL.x, y + UMBRAL.size / 2 - 0.2, UMBRAL.z);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.05), MARK); // a pale carved line facing the forest
    mark.position.set(UMBRAL.x, y + UMBRAL.size / 2, UMBRAL.z + UMBRAL.size / 2 + 0.03);
    this.block.add(cube, mark);
    this.group.add(this.block);
    // The stairs: one stone step per metre up the ramp (rim + rise · d / len), down to the forest rim.
    const n = ESCALERA.len;
    this.steps = new THREE.InstancedMesh(new THREE.BoxGeometry(ESCALERA.half * 2, 1, 1), STEP, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const rim = terrain.heightAt(0, -HALF);
      const top = rim + (ESCALERA.rise * (i + 1)) / ESCALERA.len;
      const h = top - rim + 1;
      m.makeScale(1, h, 1).setPosition(0, top - h / 2, -HALF - i - 0.5);
      this.steps.setMatrixAt(i, m);
    }
    this.steps.instanceMatrix.needsUpdate = true;
    this.steps.visible = false;
    this.group.add(this.steps);
  }

  sync(escalera: boolean): void {
    this.block.visible = !escalera;
    this.steps.visible = escalera;
  }
}

/** The white Cucurucho's atalaya: a 5 m stone tower (the paper cutout stands on top). */
export function buildAtalaya(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, ATALAYA.height, 8), TOWER);
  m.geometry.translate(0, ATALAYA.height / 2, 0);
  return m;
}
