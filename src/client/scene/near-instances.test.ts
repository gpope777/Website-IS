import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NearInstances } from './near-instances';

const geo = new THREE.BoxGeometry(1, 1, 1);
function make(points: [number, number][]) {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), points.length);
  const near = new NearInstances([mesh], points.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 0, z)));
  return { mesh, near };
}
const xs = (m: THREE.InstancedMesh) => {
  const out: number[] = [];
  const t = new THREE.Matrix4();
  for (let i = 0; i < m.count; i++) out.push(new THREE.Vector3().setFromMatrixPosition((m.getMatrixAt(i, t), t)).x);
  return out.sort((a, b) => a - b);
};

describe('NearInstances (V2-B perf: only draw what is near the camera)', () => {
  it('keeps only instances within the radius', () => {
    const { mesh, near } = make([[0, 0], [50, 0], [150, 0], [-99, 0]]);
    near.update(0, 0, 100, null);
    expect(xs(mesh)).toEqual([-99, 0, 50]);
  });

  it('drops what is well behind the camera but keeps what is just behind', () => {
    const { mesh, near } = make([[0, 60], [0, -60], [0, 10]]);
    near.update(0, 0, 100, { x: 0, z: -1 }); // looking north (−Z)
    expect(mesh.count).toBe(2);
    expect(xs(mesh)).toEqual([0, 0]);
  });

  it('hidden instances are skipped and come back', () => {
    const { mesh, near } = make([[0, 0], [5, 0]]);
    near.setHidden(1, true);
    near.update(0, 0, 100, null);
    expect(xs(mesh)).toEqual([0]);
    near.setHidden(1, false);
    near.update(0, 0, 100, null);
    expect(xs(mesh)).toEqual([0, 5]);
  });

  it('does not rebuild for small moves; does after a real move', () => {
    const { mesh, near } = make([[0, 0], [110, 0]]);
    near.update(0, 0, 100, null);
    expect(mesh.count).toBe(1);
    expect(near.update(3, 0, 100, null)).toBe(false);
    expect(near.update(20, 0, 100, null)).toBe(true);
    expect(mesh.count).toBe(2);
  });

  it('writes every mesh of a kind with the same list', () => {
    const a = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 3);
    const b = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 3);
    const near = new NearInstances([a, b], [0, 200, 10].map((x) => new THREE.Matrix4().makeTranslation(x, 0, 0)));
    near.update(0, 0, 50, null);
    expect(a.count).toBe(2);
    expect(xs(b)).toEqual([0, 10]);
  });
});
