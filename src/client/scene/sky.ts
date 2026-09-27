import * as THREE from 'three';
import type { TierSettings } from '../quality';
import type { Look } from './looks';
import { SkyDome } from './sky-dome';

const RAID_SKY = new THREE.Color(0x4a1f5c);
const STORM_SKY = new THREE.Color(0x5a6068);

/** Sun, moon, hemisphere light, fog and the sky dome, driven by the shared day clock (0 = midnight) and the biome's look (V2-B). */
export class DayLight {
  private readonly sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  private readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.25);
  private readonly hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3b5a2a, 0.6);
  private readonly fog: THREE.Fog;
  private readonly bg = new THREE.Color();
  private readonly zenith = new THREE.Color();
  /** V2-D: the dome's colours now (the water reflects them). */
  get zenithColor(): THREE.Color {
    return this.zenith;
  }
  get horizonColor(): THREE.Color {
    return this.bg;
  }
  private readonly sunDir = new THREE.Vector3();
  readonly dome: SkyDome;
  /** Unit vector toward the sun (for the fog's warm side). */
  readonly sunDirection = new THREE.Vector3(0, 1, 0);
  /** 0 at night … 1 by day (for other shaders: glow strength). */
  daylight = 1;

  constructor(scene: THREE.Scene, private readonly tier: TierSettings) {
    this.fog = new THREE.Fog(0xa8c8d8, 25, tier.drawDistance * 0.8);
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
    this.moon.color.set(0x8fa8ff);
    this.dome = new SkyDome(tier.clouds, tier.stars);
    scene.add(this.sun, this.sun.target, this.moon, this.hemi, this.dome.mesh);
  }

  /** `swamp` 0..1 closes the fog to the Pantano's (near 35, far 70). `look` = the biome's colours now (`lookAt`). */
  update(f: number, focus: THREE.Vector3, look: Look, raid = 0, swamp = 0, storm = 0, t = 0): void {
    const angle = (f - 0.25) * Math.PI * 2; // sunrise at 0.25
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(focus.x + sunX * 120, focus.y + sunY * 120, focus.z + 40);
    this.sun.target.position.copy(focus);
    this.moon.position.set(focus.x - sunX * 120, focus.y - sunY * 120, focus.z - 40);
    this.sunDir.set(sunX, sunY, 0.33);
    this.sunDirection.copy(this.sunDir).normalize();

    const daylight = Math.max(0, Math.min(1, (sunY + 0.15) / 0.5));
    this.daylight = daylight;
    this.sun.intensity = look.sunI * Math.min(1, daylight * 2);
    this.sun.color.copy(look.sun);
    this.moon.intensity = look.moonI;
    this.hemi.intensity = look.hemiI;
    this.hemi.color.copy(look.hemiSky);
    this.hemi.groundColor.copy(look.hemiGround);

    this.bg.copy(look.horizon);
    this.zenith.copy(look.zenith);
    this.fog.color.copy(look.fog);
    if (raid > 0) for (const c of [this.bg, this.zenith, this.fog.color]) c.lerp(RAID_SKY, raid);
    if (storm > 0) {
      // Mountain rain/storm (S4-B): a greyer, dimmer sky and closer fog.
      for (const c of [this.bg, this.zenith, this.fog.color]) c.lerp(STORM_SKY, 0.5 * storm);
      this.sun.intensity *= 1 - 0.5 * storm;
    }
    this.fog.near = 20 + 20 * daylight;
    this.fog.far = Math.min(this.tier.drawDistance * 0.8, 60 + 100 * daylight);
    if (storm > 0) this.fog.far = Math.max(40, this.fog.far * (1 - 0.35 * storm));
    if (swamp > 0) {
      this.fog.near += (Math.min(this.fog.near, 35) - this.fog.near) * swamp;
      this.fog.far += (Math.min(this.fog.far, 70) - this.fog.far) * swamp;
    }
    // The horizon melts into the fog: what the fog hides looks like sky.
    this.bg.lerp(this.fog.color, 0.5);
    this.dome.set(this.zenith, this.bg, this.sunDir, this.sun.color, daylight, t);
  }
}
