import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TOWER } from '../../shared/corrupt-lands';
import type { Terrain } from '../../shared/terrain';
import { skyPlacement, TOWER_NEAR, VillainTower } from './villain-tower';

const flat: Terrain = { heightAt: () => 30, density: () => 0.5 };

describe('la Torre on the horizon (S5-A)', () => {
  it('the sky copy sits on the ray to the tower and covers the same angle', () => {
    const cam = { x: 10, y: 5, z: 200 };
    const base = { x: TOWER.x, y: 30, z: TOWER.z };
    const p = skyPlacement(cam, base, 100);
    expect(Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z)).toBeCloseTo(100, 6);
    const real = Math.hypot(base.x - cam.x, base.y - cam.y, base.z - cam.z);
    expect(p.scale).toBeCloseTo(100 / real, 9);
    const h = 90;
    const angle = (q: { x: number; y: number; z: number }, top: number) => Math.atan2(q.y + top - cam.y, Math.hypot(q.x - cam.x, q.z - cam.z));
    expect(Math.abs(angle(p, h * p.scale) - angle(base, h)) * (180 / Math.PI)).toBeLessThan(0.1);
  });

  it('near it the real tower shows, far away only the sky copy; both grow', () => {
    const t = new VillainTower(flat);
    t.update(new THREE.Vector3(0, 40, TOWER.z + TOWER_NEAR - 10), 80, 500);
    expect(t.real.visible).toBe(true);
    t.update(new THREE.Vector3(0, 40, TOWER.z + 200), 80, 120); // low tier: 200 m is past its far plane
    expect(t.sky.visible).toBe(true);
    t.update(new THREE.Vector3(0, 40, TOWER.z + 50), 80, 120);
    expect(t.real.visible).toBe(true);
    expect(t.sky.visible).toBe(false);
    expect(t.real.scale.y).toBe(80);
    t.update(new THREE.Vector3(0, 5, 0), 100, 180);
    expect(t.real.visible).toBe(false);
    expect(t.sky.visible).toBe(true);
    const cam = new THREE.Vector3(0, 5, 0);
    expect(t.sky.position.distanceTo(cam)).toBeCloseTo(144, 3);
    expect(t.sky.scale.y / t.sky.scale.x).toBeCloseTo(100, 6);
  });
});
