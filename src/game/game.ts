import * as THREE from 'three';
import { Player, type InputState } from './player';
import { hashSeed } from './rng';
import {
  RECIPES,
  add,
  consume,
  craft,
  createStats,
  isDead,
  isNight,
  remove,
  scoreFor,
  tick,
  type Inventory,
  type ItemId,
  type Recipe,
  type Stats,
} from './survival';
import { HARVEST, World, type Resource } from './world';
import { Wolf } from './wolves';
import { Creature, CREATURE_KINDS } from './creatures';
import { Hud, craftOverlay, deathOverlay, pauseOverlay } from '../ui/hud';
import { TouchControls, isTouchDevice } from '../ui/touch';

/** Real seconds per in-game day. */
export const DAY_LENGTH = 6 * 60;
const TORCH_DURATION = 90;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: World;
  private readonly player: Player;
  private readonly hud: Hud;
  private readonly wolves: Wolf[] = [];
  private readonly creatures: Creature[] = [];
  private attackCooldown = 0;
  private kills = 0;
  private readonly torchLight: THREE.PointLight;
  private readonly timer = new THREE.Timer();
  private readonly input: InputState = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

  private stats: Stats = createStats();
  private inventory: Inventory = {};
  private time = DAY_LENGTH * 0.33; // start mid-morning
  private torchTime = 0;
  private paused = true;
  private dead = false;
  private crafting = false;
  private harvestCooldown = 0;
  private craftedCount = 0;
  private elapsed = 0;
  private bob = 0;
  private lastCause = '';
  private focused: Resource | null = null;
  private readonly pauseEl: HTMLElement;
  private readonly craftUi: ReturnType<typeof craftOverlay>;
  private readonly deathUi: ReturnType<typeof deathOverlay>;
  private touch: TouchControls | null = null;

  constructor(private readonly container: HTMLElement, seed: string, private readonly onRestart: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
    this.world = new World(hashSeed(seed));
    this.player = new Player(this.world);
    this.player.yaw = Math.PI * 0.15;

    this.torchLight = new THREE.PointLight(0xffb060, 0, 16, 1.8);
    this.world.scene.add(this.torchLight);

    for (let i = 0; i < 3; i++) this.wolves.push(new Wolf(this.world, hashSeed(seed + ':wolf' + i)));
    for (let i = 0; i < CREATURE_KINDS; i++) this.creatures.push(new Creature(this.world, hashSeed(seed + ':creature' + i), i));

    this.hud = new Hud(container);
    this.hud.setInventory(this.inventory);
    this.hud.setStats(this.stats);

    if (isTouchDevice()) this.enableTouch();

    this.pauseEl = pauseOverlay(container, () => this.requestPointerLock());
    this.craftUi = craftOverlay(
      container,
      (r) => this.doCraft(r),
      () => this.toggleCraft(false),
    );
    this.deathUi = deathOverlay(container, onRestart);

    this.bindInput();
    window.addEventListener('resize', this.onResize);
    this.requestPointerLock();
    this.hud.notify('Te despiertas en el bosque. Busca agua y comida antes de que anochezca.');
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Build the on-screen controls. Idempotent: also called lazily on the first touch event. */
  private enableTouch(): void {
    if (this.touch) return;
    this.container.classList.add('touch');
    this.touch = new TouchControls(this.container, this.input, {
      onLook: (dx, dy) => {
        if (!this.paused && !this.crafting && !this.dead) this.player.look(dx, dy);
      },
      onAction: (code) => this.handleAction(code),
      onPause: () => this.pause(),
    });
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    // When switched on mid-game (first touch), keep playing; during construction the pause overlay does not exist yet.
    if (this.pauseEl) this.resume();
  }

  private onFirstTouch = (): void => {
    if (this.dead) return;
    this.enableTouch();
  };

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('touchstart', this.onFirstTouch);
    this.touch?.dispose();
    this.container.classList.remove('touch');
    this.renderer.dispose();
    this.container.innerHTML = '';
  }

  // ---------------------------------------------------------------- input

  /** Resume play. On desktop this goes through pointer lock; on touch there is no lock, so resume directly. */
  private requestPointerLock(): void {
    if (this.dead) return;
    if (this.touch) {
      this.resume();
      return;
    }
    this.renderer.domElement.requestPointerLock?.();
  }

  private resume(): void {
    this.paused = false;
    this.pauseEl.hidden = true;
    this.timer.update();
  }

  private pause(): void {
    if (this.dead || this.crafting) return;
    this.paused = true;
    this.pauseEl.hidden = false;
    this.touch?.release();
  }

  private bindInput(): void {
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.paused && !this.crafting && !this.touch) this.requestPointerLock();
    });
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement === this.renderer.domElement) this.handleAction('KeyX');
    });
    // Losing the tab (or the phone locking) should pause rather than run blind.
    document.addEventListener('visibilitychange', this.onVisibility);
    // Fallback for devices the media query misses: the first real touch turns the controls on.
    document.addEventListener('touchstart', this.onFirstTouch, { passive: true });
  }

  private onVisibility = (): void => {
    if (document.hidden && this.touch) this.pause();
  };

  private onLockChange = (): void => {
    if (this.touch) return;
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) this.resume();
    else if (!this.crafting && !this.dead) this.pause();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.paused || this.crafting) return;
    this.player.look(e.movementX, e.movementY);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.dead) return;
    if (this.crafting) {
      if (e.code === 'KeyC' || e.code === 'Escape') this.toggleCraft(false);
      const idx = Number(e.key) - 1;
      const recipe = RECIPES[idx];
      if (recipe) this.doCraft(recipe);
      return;
    }
    if (this.paused) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.input.forward = true; break;
      case 'KeyS': case 'ArrowDown': this.input.back = true; break;
      case 'KeyA': case 'ArrowLeft': this.input.left = true; break;
      case 'KeyD': case 'ArrowRight': this.input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.sprint = true; break;
      case 'Space': this.input.jump = true; e.preventDefault(); break;
      default: this.handleAction(e.code);
    }
  };

  /** Momentary actions shared by the keyboard and the touch buttons. */
  private handleAction(code: string): void {
    if (this.dead) return;
    if (this.crafting) {
      if (code === 'KeyC' || code === 'Escape') this.toggleCraft(false);
      return;
    }
    if (this.paused) return;
    switch (code) {
      case 'KeyE': this.interact(); break;
      case 'KeyX': this.attack(); break;
      case 'KeyC': this.toggleCraft(true); break;
      case 'Digit1': this.eat('berries'); break;
      case 'Digit2': this.eat('mushroom'); break;
      case 'Digit3': this.eat('water'); break;
      case 'KeyT': this.lightTorch(); break;
      case 'KeyF': this.placeItem('campfire'); break;
      case 'KeyR': this.placeItem('shelter'); break;
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.input.forward = false; break;
      case 'KeyS': case 'ArrowDown': this.input.back = false; break;
      case 'KeyA': case 'ArrowLeft': this.input.left = false; break;
      case 'KeyD': case 'ArrowRight': this.input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.sprint = false; break;
      case 'Space': this.input.jump = false; break;
    }
  };

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ---------------------------------------------------------------- actions

  private toggleCraft(open: boolean): void {
    this.crafting = open;
    this.craftUi.el.hidden = !open;
    if (open) {
      this.craftUi.refresh(this.inventory);
      this.touch?.release();
      if (!this.touch) document.exitPointerLock();
    } else {
      this.requestPointerLock();
    }
  }

  private doCraft(recipe: Recipe): void {
    const next = craft(this.inventory, recipe);
    if (!next) {
      this.hud.notify('Te faltan materiales.');
      return;
    }
    this.inventory = next;
    this.craftedCount++;
    this.hud.setInventory(this.inventory);
    this.craftUi.refresh(this.inventory);
    const hint = recipe.id === 'campfire' ? ' Pulsa F para colocarla.' : recipe.id === 'shelter' ? ' Pulsa R para colocarlo.' : recipe.id === 'torch' ? ' Pulsa T para encenderla.' : '';
    this.hud.notify(`Has creado: ${recipe.label.split(' (')[0]}.${hint}`);
  }

  private eat(id: ItemId): void {
    const r = consume(this.stats, this.inventory, id);
    if (!r) {
      this.hud.notify('No tienes eso.');
      return;
    }
    this.stats = r.stats;
    this.inventory = r.inv;
    this.hud.setInventory(this.inventory);
    if (id === 'mushroom') this.hud.notify('La seta alimenta, pero te sienta mal.');
  }

  private lightTorch(): void {
    if (this.torchTime > 0) {
      this.hud.notify('La antorcha ya está encendida.');
      return;
    }
    const next = remove(this.inventory, 'torch', 1);
    if (!next) {
      this.hud.notify('No tienes antorcha. Créala con madera y fibra.');
      return;
    }
    this.inventory = next;
    this.torchTime = TORCH_DURATION;
    this.hud.setInventory(this.inventory);
    this.hud.notify('Antorcha encendida. Los lobos la temen.');
  }

  private placeItem(kind: 'campfire' | 'shelter'): void {
    const next = remove(this.inventory, kind, 1);
    if (!next) {
      this.hud.notify(kind === 'campfire' ? 'No tienes fogata. Créala con C.' : 'No tienes refugio. Créalo con C.');
      return;
    }
    const dir = this.player.forwardDir();
    const at = this.player.position.clone().addScaledVector(dir, kind === 'campfire' ? 2 : 3);
    if (this.world.heightAt(at.x, at.z) < -3) {
      this.hud.notify('No puedes colocar eso en el agua.');
      return;
    }
    this.inventory = next;
    this.world.place(kind, at, this.player.yaw);
    this.hud.setInventory(this.inventory);
    this.hud.notify(kind === 'campfire' ? 'Fogata encendida. Quédate cerca para entrar en calor.' : 'Refugio montado. Duerme aquí para no pasar frío.');
  }

  /** Punch (or swing the axe) at whatever is in front of you. */
  private attack(): void {
    if (this.attackCooldown > 0) return;
    const hasAxe = (this.inventory.axe ?? 0) > 0;
    this.attackCooldown = hasAxe ? 0.7 : 0.45;
    this.hud.swing(hasAxe ? '🪓' : '👊');
    const damage = hasAxe ? 20 : 10;
    const from = this.player.position;
    const fwd = this.player.forwardDir();
    const reach = 2.8;
    const inFront = (p: THREE.Vector3, radius: number): boolean => {
      const d = new THREE.Vector3().subVectors(p, from);
      d.y = 0;
      const dist = d.length();
      if (dist > reach + radius) return false;
      return dist < radius || d.normalize().dot(fwd) > 0.6;
    };
    for (const c of this.creatures) {
      if (!c.alive || !inFront(c.position, 1)) continue;
      if (c.hit(damage, from)) {
        this.kills++;
        this.stats.energy = Math.min(100, this.stats.energy + 5);
        this.hud.notify('¡Has derrotado a la criatura!');
      } else this.hud.notify(`Golpeas a la criatura (${Math.max(0, c.hp)} PV)`);
      return;
    }
    for (const w of this.wolves) {
      if (!inFront(w.position, 0.8)) continue;
      if (w.hit(damage)) {
        this.kills++;
        this.hud.notify('¡El lobo cae!');
      } else this.hud.notify('El lobo huye aullando.');
      return;
    }
  }

  private interact(): void {
    if (this.harvestCooldown > 0) return;
    const res = this.focused;
    if (res) {
      const info = HARVEST[res.kind];
      let amount = info.amount;
      if (res.kind === 'tree' && (this.inventory.axe ?? 0) > 0) amount += 1;
      if (res.kind === 'water') {
        this.stats.thirst = Math.min(100, this.stats.thirst + 25);
        if ((this.inventory.water ?? 0) < 3) {
          this.inventory = add(this.inventory, 'water', 1);
          this.hud.notify('Bebes y llenas un poco de agua.');
        } else this.hud.notify('Bebes agua fresca.');
      } else if (this.world.harvest(res)) {
        this.inventory = add(this.inventory, info.item, amount);
        this.stats.energy = Math.max(0, this.stats.energy - (res.kind === 'tree' ? 3 : 1));
        this.hud.notify(`+${amount} ${info.item === 'wood' ? 'madera' : info.item === 'stone' ? 'piedra' : info.item === 'berries' ? 'bayas' : 'seta'}`);
      }
      this.harvestCooldown = res.kind === 'tree' ? 0.7 : 0.4;
      this.hud.setInventory(this.inventory);
      return;
    }
    const fiber = this.world.nearestFiber(this.player.position);
    if (fiber) {
      this.inventory = add(this.inventory, 'fiber', 1);
      this.hud.setInventory(this.inventory);
      this.hud.notify('+1 fibra de hierba alta');
      this.harvestCooldown = 0.5;
    }
  }

  // ---------------------------------------------------------------- loop

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    if (!this.paused && !this.crafting && !this.dead) this.step(dt);
    this.render();
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.time += dt;
    this.harvestCooldown = Math.max(0, this.harvestCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.torchTime > 0) this.torchTime = Math.max(0, this.torchTime - dt);

    const move = this.player.update(this.input, dt, this.stats.energy);
    if (move.moving) this.bob += dt;

    const dayFraction = (this.time / DAY_LENGTH) % 1;
    const night = isNight(dayFraction);
    const pos = this.player.position;
    const nearFire = this.world.nearPlaced('campfire', pos, 5);
    const sheltered = this.world.nearPlaced('shelter', pos, 2.5);

    const before = this.stats;
    this.stats = tick(this.stats, { dayFraction, nearFire, sheltered, moving: move.moving, sprinting: move.sprinting }, dt);
    if (sheltered && !move.moving) this.stats.energy = Math.min(100, this.stats.energy + 3 * dt);

    this.world.update(dt);
    const hasLight = this.torchTime > 0;
    for (const w of this.wolves) {
      const dmg = w.update(dt, pos, night, hasLight, this.elapsed);
      if (dmg > 0) {
        this.stats.health = Math.max(0, this.stats.health - dmg);
        this.lastCause = 'Un lobo te alcanzó en la oscuridad.';
        this.hud.notify('¡Un lobo te ha mordido! Busca fuego.');
      }
    }

    for (const c of this.creatures) {
      const dmg = c.update(dt, pos, night, this.elapsed);
      if (dmg > 0) {
        this.stats.health = Math.max(0, this.stats.health - dmg);
        this.lastCause = 'Una criatura del bosque te devoró.';
        this.hud.notify('¡Una criatura te ataca! Golpéala (X o clic).');
      }
    }

    if (this.stats.health < before.health && this.lastCause === '') {
      if (before.hunger <= 0) this.lastCause = 'Moriste de hambre.';
      else if (before.thirst <= 0) this.lastCause = 'Moriste de sed.';
      else if (before.warmth <= 0) this.lastCause = 'El frío de la noche pudo contigo.';
      else if (before.energy <= 0) this.lastCause = 'Caíste de agotamiento.';
    }
    if (this.stats.health > before.health) this.lastCause = '';

    this.checkLandmarks();
    this.updateFocus();

    // Warnings only on threshold crossings so they don't spam.
    for (const [key, msg] of [
      ['hunger', 'Tienes hambre. Busca bayas o setas.'],
      ['thirst', 'Tienes sed. Busca el lago.'],
      ['warmth', 'Estás pasando frío. Enciende una fogata.'],
      ['energy', 'Estás agotado. Descansa.'],
    ] as const) {
      if (before[key] >= 20 && this.stats[key] < 20) this.hud.notify(msg);
    }

    this.hud.setStats(this.stats);
    const phase = dayFraction < 0.22 ? 'Noche cerrada' : dayFraction < 0.3 ? 'Amanecer' : dayFraction < 0.7 ? 'Día' : dayFraction < 0.8 ? 'Atardecer' : 'Noche';
    this.hud.setClock(Math.floor(this.time / DAY_LENGTH) + 1, dayFraction, night, phase);

    if (isDead(this.stats)) this.die();
  }

  private checkLandmarks(): void {
    for (const l of this.world.landmarks) {
      if (l.discovered) continue;
      if (l.position.distanceTo(this.player.position) < 14) {
        l.discovered = true;
        const n = this.world.landmarks.filter((x) => x.discovered).length;
        this.hud.notify(`Has descubierto: ${l.name} (${n}/${this.world.landmarks.length})`, 'discover');
        setTimeout(() => this.hud.notify(l.description, 'discover'), 1200);
        this.stats.energy = Math.min(100, this.stats.energy + 10);
      }
    }
  }

  private updateFocus(): void {
    const eye = this.player.position.clone();
    eye.y += 1.2;
    this.focused = this.world.findInteractable(eye, this.player.forwardDir());
    if (this.focused) {
      const info = HARVEST[this.focused.kind];
      const extra = this.focused.kind === 'tree' && (this.inventory.axe ?? 0) > 0 ? ' (con hacha)' : '';
      this.hud.setPrompt(`<kbd>E</kbd>${info.label}${extra}`);
    } else if (this.world.nearestFiber(this.player.position)) {
      this.hud.setPrompt('<kbd>E</kbd>Recoger fibra');
    } else {
      this.hud.setPrompt(null);
    }
  }

  private die(): void {
    this.dead = true;
    this.touch?.release();
    if (!this.touch) document.exitPointerLock();
    const days = this.time / DAY_LENGTH;
    const discovered = this.world.landmarks.filter((l) => l.discovered).length;
    this.deathUi.show(this.lastCause || 'El bosque no perdona.', [
      ['Días sobrevividos', days.toFixed(1)],
      ['Lugares descubiertos', `${discovered} / ${this.world.landmarks.length}`],
      ['Objetos creados', String(this.craftedCount)],
      ['Enemigos derrotados', String(this.kills)],
      ['Puntuación', String(scoreFor(this.elapsed, discovered, this.craftedCount))],
    ]);
  }

  private render(): void {
    const dayFraction = (this.time / DAY_LENGTH) % 1;
    this.world.setTimeOfDay(dayFraction, this.player.position);
    this.world.animate(this.elapsed);
    this.player.applyToCamera(this.camera, this.bob, this.input.forward || this.input.back || this.input.left || this.input.right);
    if (this.torchTime > 0) {
      this.torchLight.intensity = 22 + Math.sin(this.elapsed * 21) * 3;
      this.torchLight.position.copy(this.camera.position).addScaledVector(this.player.forwardDir(), 0.6);
      this.torchLight.position.y -= 0.3;
    } else {
      this.torchLight.intensity = 0;
    }
    this.renderer.render(this.world.scene, this.camera);
  }
}
