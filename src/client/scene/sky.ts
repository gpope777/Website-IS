import * as THREE from 'three';
import type { TierSettings } from '../quality';

const DAY = new THREE.Color(0xa8c8d8);
const NIGHT = new THREE.Color(0x0b1220);
const DUSK = new THREE.Color(0xd9865a);
const RAID_SKY = new THREE.Color(0x4a1f5c);

/** Sun, moon, hemisphere light and fog driven by the shared day clock (0 = midnight). */
export class DayLight {
  private readonly sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  private readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.25);
  private readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3b5a2a, 0.6);
  private readonly fog: THREE.Fog;
  private readonly bg = new THREE.Color();

  constructor(scene: THREE.Scene, private readonly tier: TierSettings) {
    this.fog = new THREE.Fog(DAY, 25, tier.drawDistance * 0.8);
    scene.fog = this.fog;
    scene.background = this.bg;
    if (tier.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -50;
      cam.right = cam.top = 50;
      cam.near = 1;
      cam.far = 300;
      this.sun.shadow.bias = -0.0015;
    }
    scene.add(this.sun, this.sun.target, this.moon, this.hemi);
  }

  /** `swamp` 0..1 closes the fog to the Pantano's (near 35, far 70). */
  update(f: number, focus: THREE.Vector3, raid = 0, swamp = 0): void {
    const angle = (f - 0.25) * Math.PI * 2; // sunrise at 0.25
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(focus.x + sunX * 120, focus.y + sunY * 120, focus.z + 40);
    this.sun.target.position.copy(focus);
    this.moon.position.set(focus.x - sunX * 120, focus.y - sunY * 120, focus.z - 40);

    const daylight = Math.max(0, Math.min(1, (sunY + 0.15) / 0.5));
    this.sun.intensity = 2.4 * daylight;
    this.moon.intensity = 0.3 * (1 - daylight);
    this.hemi.intensity = 0.15 + 0.6 * daylight;
    this.sun.color.set(daylight > 0.6 ? 0xfff2d8 : 0xffb070);

    const dusk = 1 - Math.abs(sunY) > 0.85 && sunY > -0.2 ? 1 - Math.abs(sunY) - 0.85 : 0;
    this.bg.copy(NIGHT).lerp(DAY, daylight).lerp(DUSK, Math.min(1, dusk * 4) * 0.6);
    if (raid > 0) this.bg.lerp(RAID_SKY, raid);
    this.fog.color.copy(this.bg);
    this.fog.near = 20 + 20 * daylight;
    this.fog.far = Math.min(this.tier.drawDistance * 0.8, 60 + 100 * daylight);
    if (swamp > 0) {
      this.fog.near += (Math.min(this.fog.near, 35) - this.fog.near) * swamp;
      this.fog.far += (Math.min(this.fog.far, 70) - this.fog.far) * swamp;
    }
  }
}
