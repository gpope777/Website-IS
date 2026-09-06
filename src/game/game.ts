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
import { HARVEST, World, type Landmark, type Resource } from './world';
import { Wolf } from './wolves';
import { Creature, CREATURE_COUNT, CREATURE_KINDS } from './creatures';
import { Audio } from './audio';
import { Hud, LANDMARK_ICONS, craftOverlay, deathOverlay, journalOverlay, pauseOverlay, type CompassMarker, type ScoreEntry } from '../ui/hud';
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
  private readonly audio = new Audio();
  private relicsFound = 0;
  private howlTimer = 20;
  private rainTimer = 120 + Math.random() * 120;
  private raining = false;
  private thunderTimer = 0;
  private boss: Creature | null = null;
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
  private wasSwimming = false;
  private focused: Resource | null = null;
  private readonly pauseEl: HTMLElement;
  private readonly craftUi: ReturnType<typeof craftOverlay>;
  private readonly deathUi: ReturnType<typeof deathOverlay>;
  private readonly journalUi: ReturnType<typeof journalOverlay>;
  private journal = false;
  private treeCooldown = 0;
  private fishCooldown = 0;
  private exitRevealed = false;
  private escaped = false;
  private touch: TouchControls | null = null;

  constructor(private readonly container: HTMLElement, private readonly seed: string, private readonly onRestart: () => void) {
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
    for (let i = 0; i < CREATURE_COUNT; i++) this.creatures.push(new Creature(this.world, hashSeed(seed + ':creature' + i), i % CREATURE_KINDS));

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
    this.journalUi = journalOverlay(container, () => this.toggleJournal(false));

    this.bindInput();
    const unlock = () => this.audio.unlock();
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    window.addEventListener('resize', this.onResize);
    this.requestPointerLock();
    this.hud.notify('Te despiertas en el bosque. Busca agua y comida antes de que anochezca.');
    setTimeout(() => this.hud.notify('Las columnas de luz marcan lugares que explorar. Pulsa J para abrir el diario.', 'discover'), 4000);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Build the on-screen controls. Idempotent: also called lazily on the first touch event. */
  private enableTouch(): void {
    if (this.touch) return;
    this.container.classList.add('touch');
    this.touch = new TouchControls(this.container, this.input, {
      onLook: (dx, dy) => {
        if (!this.paused && !this.crafting && !this.journal && !this.dead) this.player.look(dx, dy);
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
    if (this.dead || this.crafting || this.journal) return;
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
    else if (!this.crafting && !this.journal && !this.dead) this.pause();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.paused || this.crafting || this.journal) return;
    this.player.look(e.movementX, e.movementY);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.dead) return;
    if (this.journal) {
      if (e.code === 'KeyJ' || e.code === 'Escape') this.toggleJournal(false);
      return;
    }
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
    if (this.journal) {
      if (code === 'KeyJ' || code === 'Escape') this.toggleJournal(false);
      return;
    }
    if (this.crafting) {
      if (code === 'KeyC' || code === 'Escape') this.toggleCraft(false);
      return;
    }
    if (this.paused) return;
    switch (code) {
      case 'KeyE': this.interact(); break;
      case 'KeyX': this.attack(); break;
      case 'KeyC': this.toggleCraft(true); break;
      case 'KeyJ': this.toggleJournal(true); break;
      case 'KeyM': this.audio.setMuted(!this.audio.muted); this.hud.notify(this.audio.muted ? 'Sonido silenciado.' : 'Sonido activado.'); break;
      case 'Digit4': this.eat('fish'); break;
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

  private toggleJournal(open: boolean): void {
    this.journal = open;
    this.journalUi.el.hidden = !open;
    if (open) {
      this.journalUi.refresh({ landmarks: this.world.landmarks, relics: this.world.relics, player: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw } });
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
    this.audio.craft();
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
    this.audio.eat();
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
    this.audio.punch();
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
        this.audio.kill();
        if (c.boss) {
          this.hud.notify('🏆 El Guardián de la Puerta ha caído. El camino está libre.', 'discover');
          for (const l of this.world.landmarks) if (l.id === 'exit') l.discovered = false;
        }
        this.stats.energy = Math.min(100, this.stats.energy + 5);
        this.hud.notify('¡Has derrotado a la criatura!');
      } else {
        this.audio.hitCreature();
        if (c.boss) this.audio.roar();
        this.hud.notify(c.boss ? `Golpeas al Guardián (${Math.max(0, c.hp)} PV)` : `Golpeas a la criatura (${Math.max(0, c.hp)} PV)`);
      }
      return;
    }
    for (const w of this.wolves) {
      if (!inFront(w.position, 0.8)) continue;
      if (w.hit(damage)) {
        this.kills++;
        this.audio.kill();
        this.hud.notify('¡El lobo cae!');
      } else {
        this.audio.hitCreature();
        this.hud.notify('El lobo huye aullando.');
      }
      return;
    }
  }

  private interact(): void {
    if (this.harvestCooldown > 0) return;
    const relic = this.world.relicNear(this.player.position, 2.6);
    if (relic) {
      this.world.collectRelic(relic);
      this.relicsFound++;
      this.audio.discover();
      this.hud.notify(`✦ Reliquia: ${relic.name} (${this.relicsFound}/${this.world.relics.length})`, 'discover');
      setTimeout(() => this.hud.notify(relic.lore, 'discover'), 1200);
      this.stats.energy = Math.min(100, this.stats.energy + 5);
      this.harvestCooldown = 0.5;
      return;
    }
    const near = this.world.landmarkNear(this.player.position, 9);
    if (near?.id === 'tree' && near.discovered && this.treeCooldown <= 0) {
      this.treeCooldown = 45;
      this.inventory = add(this.inventory, 'berries', 3);
      this.hud.setInventory(this.inventory);
      this.audio.pickup();
      this.hud.notify('+3 frutos del Árbol Anciano. Volverán a crecer.');
      this.harvestCooldown = 0.6;
      return;
    }
    if (near?.id === 'pier' && near.discovered && this.focused?.kind === 'water') {
      if (this.fishCooldown > 0) {
        this.hud.notify('Los peces se han espantado. Espera un poco.');
        return;
      }
      this.fishCooldown = 15;
      this.inventory = add(this.inventory, 'fish', 1);
      this.hud.setInventory(this.inventory);
      this.audio.splash();
      this.hud.notify('+1 pescado. Pulsa 4 para comerlo.');
      this.harvestCooldown = 0.8;
      return;
    }
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
        this.audio.pickup();
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
      this.audio.pickup();
      this.hud.notify('+1 fibra de hierba alta');
      this.harvestCooldown = 0.5;
    }
  }

  // ---------------------------------------------------------------- loop

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    if (!this.paused && !this.crafting && !this.journal && !this.dead) this.step(dt);
    this.render();
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.time += dt;
    this.harvestCooldown = Math.max(0, this.harvestCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.treeCooldown = Math.max(0, this.treeCooldown - dt);
    this.fishCooldown = Math.max(0, this.fishCooldown - dt);
    if (this.torchTime > 0) this.torchTime = Math.max(0, this.torchTime - dt);

    const move = this.player.update(this.input, dt, this.stats.energy);
    if (move.moving) this.bob += dt;
    this.audio.footsteps(dt, move.moving || move.swimming, move.sprinting, move.swimming);

    const dayFraction = (this.time / DAY_LENGTH) % 1;
    const night = isNight(dayFraction);
    const pos = this.player.position;
    const nearFire = this.world.nearPlaced('campfire', pos, 5);
    const at = this.world.landmarkNear(pos, 7);
    const inCave = at?.id === 'cave' && at.discovered;
    const inCircle = at?.id === 'circle' && at.discovered && Math.hypot(at.position.x - pos.x, at.position.z - pos.z) < 4.5;
    const sheltered = inCave || this.world.nearPlaced('shelter', pos, 2.5);

    const before = this.stats;
    this.stats = tick(this.stats, { dayFraction, nearFire, sheltered, moving: move.moving, sprinting: move.sprinting }, dt);
    if (sheltered && !move.moving) this.stats.energy = Math.min(100, this.stats.energy + 3 * dt);
    if (inCave) this.stats.warmth = Math.min(100, this.stats.warmth + 2 * dt);
    if (inCircle) this.stats.health = Math.min(100, this.stats.health + 2.5 * dt);
    if (move.swimming) {
      this.stats.warmth = Math.max(0, this.stats.warmth - 1.5 * dt);
      this.stats.energy = Math.max(0, this.stats.energy - 1.5 * dt);
      if (!this.wasSwimming) {
        this.audio.splash();
        this.hud.notify('Nadas. El agua está fría y cansa; no te quedes mucho.');
      }
    }
    this.wasSwimming = move.swimming;

    this.world.update(dt);
    const hasLight = this.torchTime > 0;
    for (const w of this.wolves) {
      const dmg = w.update(dt, pos, night, hasLight, this.elapsed);
      if (dmg > 0) {
        this.stats.health = Math.max(0, this.stats.health - dmg);
        this.audio.hurt();
        this.lastCause = 'Un lobo te alcanzó en la oscuridad.';
        this.hud.notify('¡Un lobo te ha mordido! Busca fuego.');
      }
    }

    const circle = this.world.landmarks.find((l) => l.id === 'circle' && l.discovered);
    const safe = circle ? { pos: circle.position, r: 6 } : null;
    for (const c of this.creatures) {
      const dmg = c.update(dt, pos, night, this.elapsed, safe);
      if (dmg > 0) {
        this.stats.health = Math.max(0, this.stats.health - dmg);
        this.audio.hurt();
        this.lastCause = c.boss ? 'El Guardián de la Puerta te aplastó.' : 'Una criatura del bosque te devoró.';
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
    this.updateCompass();
    this.updateWeather(dt, pos, night);
    this.audio.ambient(night, move.sprinting, this.raining);
    this.howlTimer -= dt;
    if (this.howlTimer <= 0) {
      this.howlTimer = 25 + Math.random() * 30;
      if (night) this.audio.wolfHowl();
    }

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

  /** Showers roll in every few minutes: darker sky, closer fog, thunder, and you get cold faster unless sheltered. */
  private updateWeather(dt: number, pos: THREE.Vector3, night: boolean): void {
    this.rainTimer -= dt;
    if (this.rainTimer <= 0) {
      this.raining = !this.raining;
      this.rainTimer = this.raining ? 60 + Math.random() * 60 : 150 + Math.random() * 150;
      this.hud.notify(this.raining ? '🌧️ Empieza a llover. Busca refugio o una fogata.' : 'Deja de llover.');
      if (this.raining) this.audio.thunder();
    }
    this.world.setRain(this.raining, pos, dt);
    if (!this.raining) return;
    const at = this.world.landmarkNear(pos, 7);
    const covered = (at?.id === 'cave' && at.discovered) || this.world.nearPlaced('shelter', pos, 2.5) || this.world.nearPlaced('campfire', pos, 5);
    if (!covered) this.stats.warmth = Math.max(0, this.stats.warmth - (night ? 1.2 : 0.7) * dt);
    this.thunderTimer -= dt;
    if (this.thunderTimer <= 0) {
      this.thunderTimer = 15 + Math.random() * 25;
      this.audio.thunder();
    }
  }

  private checkLandmarks(): void {
    const pos = this.player.position;
    for (const l of this.world.landmarks) {
      if (l.discovered) continue;
      // Nearby places show on the compass before you reach them.
      const d = Math.hypot(l.position.x - pos.x, l.position.z - pos.z);
      if (d < 70) l.revealed = true;
      if (d < 14) this.discoverLandmark(l);
    }
  }

  private discoverLandmark(l: Landmark): void {
    this.world.discover(l);
    if (l.id === 'exit') {
      if (this.boss && this.boss.alive) {
        // Not yet: the guardian must fall first. Undo the discovery so the beacon stays.
        l.discovered = false;
        (l.beacon.material as THREE.MeshBasicMaterial).opacity = 0.35;
        return;
      }
      this.win();
      return;
    }
    const total = this.world.landmarks.filter((x) => x.id !== 'exit').length;
    const n = this.world.landmarks.filter((x) => x.discovered).length;
    this.audio.discover();
    this.hud.notify(`${LANDMARK_ICONS[l.id]} Has descubierto: ${l.name} (${n}/${total})`, 'discover');
    setTimeout(() => this.hud.notify(l.story, 'discover'), 1500);
    setTimeout(() => this.hud.notify(l.reward, 'discover'), 5000);
    this.stats.energy = Math.min(100, this.stats.energy + 15);

    switch (l.id) {
      case 'rock':
        for (const x of this.world.landmarks) x.revealed = true;
        break;
      case 'cabin':
        this.inventory = add(this.inventory, 'axe', 1);
        this.inventory = add(this.inventory, 'wood', 4);
        this.inventory = add(this.inventory, 'fiber', 3);
        this.inventory = add(this.inventory, 'torch', 1);
        this.hud.setInventory(this.inventory);
        break;
      case 'tree':
        this.treeCooldown = 0;
        break;
    }
    if (n >= total && !this.exitRevealed) {
      this.exitRevealed = true;
      setTimeout(() => {
        const exit = this.world.revealExit();
        this.audio.exitRevealed();
        const guardPos = exit.position.clone();
        guardPos.x -= Math.sin(exit.object.rotation.y) * 6;
        guardPos.z -= Math.cos(exit.object.rotation.y) * 6;
        this.boss = new Creature(this.world, hashSeed(this.seed + ':boss'), 0, true, guardPos);
        this.creatures.push(this.boss);
        setTimeout(() => this.hud.notify('Algo enorme custodia la Puerta. Tendrás que derrotarlo.', 'discover'), 2500);
        this.hud.notify('🚪 Una luz blanca se alza al borde del bosque. La Puerta del Bosque ha aparecido en tu brújula.', 'discover');
      }, 7000);
    }
  }

  private updateCompass(): void {
    const pos = this.player.position;
    const f = this.player.forwardDir();
    const right = new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw));
    const rel = (dx: number, dz: number) => Math.atan2(dx * right.x + dz * right.z, dx * f.x + dz * f.z);
    const marks: CompassMarker[] = [
      { rel: rel(0, -1), icon: 'N', dim: true, label: '' },
      { rel: rel(1, 0), icon: 'E', dim: true, label: '' },
      { rel: rel(0, 1), icon: 'S', dim: true, label: '' },
      { rel: rel(-1, 0), icon: 'O', dim: true, label: '' },
    ];
    for (const r of this.world.relics) {
      if (r.found) continue;
      const dx = r.position.x - pos.x;
      const dz = r.position.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 35) marks.push({ rel: rel(dx, dz), icon: '✦', dim: false, label: `${Math.round(d)} m` });
    }
    for (const l of this.world.landmarks) {
      if (!l.revealed) continue;
      const dx = l.position.x - pos.x;
      const dz = l.position.z - pos.z;
      const dist = Math.round(Math.hypot(dx, dz));
      marks.push({ rel: rel(dx, dz), icon: LANDMARK_ICONS[l.id], dim: l.discovered, label: `${dist} m` });
    }
    this.hud.setCompass(marks);
  }

  private win(): void {
    this.audio.win();
    this.escaped = true;
    this.dead = true;
    this.touch?.release();
    if (!this.touch) document.exitPointerLock();
    const days = this.time / DAY_LENGTH;
    const discovered = this.world.landmarks.filter((l) => l.discovered && l.id !== 'exit').length;
    this.deathUi.show('Cruzas la Puerta del Bosque. Detrás de ti, las columnas de luz se apagan una a una.', [
      ['Días en el bosque', days.toFixed(1)],
      ['Lugares descubiertos', `${discovered} / ${discovered}`],
      ['Objetos creados', String(this.craftedCount)],
      ['Enemigos derrotados', String(this.kills)],
      ['Reliquias', `${this.relicsFound} / ${this.world.relics.length}`],
      ['Puntuación', String(scoreFor(this.elapsed, discovered, this.craftedCount, true, this.relicsFound))],
    ], 'Has salido del bosque', this.scoreEntry(true, days));
  }

  private updateFocus(): void {
    const eye = this.player.position.clone();
    eye.y += 1.2;
    this.focused = this.world.findInteractable(eye, this.player.forwardDir());
    if (this.world.relicNear(this.player.position, 2.6)) {
      this.hud.setPrompt('<kbd>E</kbd>Recoger reliquia');
      return;
    }
    const near = this.world.landmarkNear(this.player.position, 9);
    if (near?.id === 'tree' && near.discovered) {
      this.hud.setPrompt(this.treeCooldown > 0 ? `Los frutos vuelven en ${Math.ceil(this.treeCooldown)} s` : '<kbd>E</kbd>Recoger frutos del Árbol Anciano');
      return;
    }
    if (near?.id === 'pier' && near.discovered && this.focused?.kind === 'water') {
      this.hud.setPrompt(this.fishCooldown > 0 ? `Pesca lista en ${Math.ceil(this.fishCooldown)} s` : '<kbd>E</kbd>Pescar');
      return;
    }
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
    this.audio.die();
    this.dead = true;
    this.touch?.release();
    if (!this.touch) document.exitPointerLock();
    const days = this.time / DAY_LENGTH;
    const discovered = this.world.landmarks.filter((l) => l.discovered && l.id !== 'exit').length;
    this.deathUi.show(this.lastCause || 'El bosque no perdona.', [
      ['Días sobrevividos', days.toFixed(1)],
      ['Lugares descubiertos', `${discovered} / ${this.world.landmarks.filter((l) => l.id !== 'exit').length}`],
      ['Objetos creados', String(this.craftedCount)],
      ['Enemigos derrotados', String(this.kills)],
      ['Reliquias', `${this.relicsFound} / ${this.world.relics.length}`],
      ['Puntuación', String(scoreFor(this.elapsed, discovered, this.craftedCount, this.escaped, this.relicsFound))],
    ], undefined, this.scoreEntry(false, days));
  }

  private scoreEntry(escaped: boolean, days: number): ScoreEntry {
    const discovered = this.world.landmarks.filter((l) => l.discovered && l.id !== 'exit').length;
    return { seed: this.seed, score: scoreFor(this.elapsed, discovered, this.craftedCount, escaped, this.relicsFound), days, escaped, date: new Date().toISOString().slice(0, 10) };
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
