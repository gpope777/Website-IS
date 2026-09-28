/** P7-D: wires the guide (line, edge arrow), the first-time tips and the "new" dots to the HUD. */
import * as THREE from 'three';
import { fullMoon } from '../shared/estrella';
import { edgeArrow, lineText, nextStep, type GuideView, type Places, type Step } from '../shared/guide';
import type { ServerMsg } from '../shared/protocol';
import { skillPoints } from '../shared/progression';
import { DAY_LENGTH } from '../shared/sim/world-sim';
import { FOGATA } from '../shared/fogatas';
import { ACK_KEY, ackAll, dots, lineAlpha, parseAck, parseTips, TIPS_KEY, TIP_IDS, TipQueue, tipsDue, tipText, type Ack, type Dots, type TipId, type TipView } from './guide-model';
import type { Hud } from './hud';
import type { MenuTab } from './menu-ui';
import type { TouchControls } from './touch';

type Snap = Extract<ServerMsg, { t: 'snap' }>;
const EDGE_PAD = 28;
const NO_STORY = { inv: [0, 0, 0] as [number, number, number], bosses: [false, false, false, false] as [boolean, boolean, boolean, boolean] };

const load = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private window */
  }
};

export class GuideUi {
  places: Places | null = null;
  private view: GuideView | null = null;
  private step: Step | null = null;
  private text = '';
  private changedAt = 0;
  private readonly shown: Set<TipId> = parseTips(load(TIPS_KEY));
  private readonly queue = new TipQueue();
  private ack: Ack | null = parseAck(load(ACK_KEY));
  private cur: Dots = { menu: false, libro: false, ayuda: false, pills: [] };
  private last = { skillPts: 0, cards: [] as string[], pills: [] as boolean[] };
  private readonly v3 = new THREE.Vector3();

  constructor(
    private readonly hud: Hud,
    private readonly touch: TouchControls | null,
    private readonly isTouch: boolean,
    private readonly opts: () => { guide: boolean; tips: boolean },
  ) {}

  /** Each snapshot: the step, tips due and dots. `cards` are the Ayuda titles on show; `pills` the pills shown. */
  update(m: Snap, o: { yaw: number; cards: string[]; pills: boolean[]; tip: Omit<TipView, 'powers'>; veteran: boolean }): void {
    const s = m.self;
    const p = this.places;
    if (p) {
      const wildDeer = m.steeds.find((d) => d.owner === null);
      const places: Places = { ...p, deer: wildDeer ?? p.deer, whale: { x: m.whale.x, z: m.whale.z } };
      this.view = {
        touch: this.isTouch,
        me: { x: s.x, z: s.z },
        self: { orbs: s.shrines, vine: s.power, wind: s.viento, fire: s.fuego, stone: s.piedra, deer: s.steed, fish: s.fish, frog: s.frog, dragon: s.dragon, star: s.star, skillPts: skillPoints(s.rank, s.skills) },
        world: {
          heart: m.heart ? this.heartAt ?? null : null,
          story: m.story ?? NO_STORY,
          whale: m.whale.tamed,
          zarzal: m.zarzalBurnt,
          escalera: m.escalera,
          fog: m.fog,
          pillars: m.pillars.broken,
          ceniza: !!m.fogatas[FOGATA.ceniza],
          towerOpen: m.towerOpen,
          ending: m.ending,
          zones: this.zonesAt(m.corrupt),
          fullMoon: fullMoon(Math.floor(m.time / DAY_LENGTH)),
        },
        friends: m.players.filter((f) => !f.away && !f.dead).map((f) => ({ name: f.name, x: f.x, z: f.z })),
        places,
      };
      this.step = this.opts().guide ? nextStep(this.view) : null;
    }
    // Tips: a veteran's first load marks them all seen.
    const powers = (['vine', 'wind', 'fire', 'stone'] as const).filter((k, i) => [s.power, s.viento, s.fuego, s.piedra][i]);
    if (o.veteran && load(TIPS_KEY) === null) {
      for (const id of TIP_IDS) this.shown.add(id);
      store(TIPS_KEY, [...this.shown]);
    }
    const due = tipsDue({ ...o.tip, powers }, this.shown);
    if (due.length) {
      for (const id of due) this.shown.add(id);
      store(TIPS_KEY, [...this.shown]);
      if (this.opts().tips) this.queue.push(due);
    }
    // Dots.
    this.last = { skillPts: skillPoints(s.rank, s.skills), cards: o.cards, pills: o.pills };
    if (!this.ack) {
      this.ack = ackAll(this.last);
      store(ACK_KEY, this.ack);
    }
    this.cur = dots(this.last, this.ack);
    this.touch?.setDots(this.cur.menu, this.cur.pills);
  }

  /** Set by the game when the Heart's structure is known. */
  heartAt: { x: number; z: number } | null = null;
  /** Set by the game: every zone's centre by id. */
  zoneCentres: Map<number, { x: number; z: number }> = new Map();

  private zonesAt(ids: readonly number[]): { x: number; z: number }[] {
    return ids.flatMap((id) => {
      const z = this.zoneCentres.get(id);
      return z ? [z] : [];
    });
  }

  /** Each frame: the line's text (bearing follows the camera), its dimming, the tip and the edge arrow. */
  frame(camera: THREE.Camera, yaw: number, w: number, h: number, now: number): void {
    const v = this.view;
    const step = this.step;
    const text = v && step ? lineText(step, v, yaw) : '';
    const key = step ? `${step.id}|${step.text}` : '';
    if (key !== this.text) {
      this.text = key;
      this.changedAt = now;
    }
    this.hud.setGoal(text || null, lineAlpha(now - this.changedAt));
    const tip = this.opts().tips ? this.queue.current(now) : null;
    this.hud.setTip(tip ? tipText(tip, this.isTouch) : null);
    if (!v || !step?.target || Math.hypot(step.target.x - v.me.x, step.target.z - v.me.z) < 8) return this.hud.setArrow(null);
    this.v3.set(step.target.x, (camera.position.y ?? 0), step.target.z).project(camera);
    // Behind the camera: the projected z is past 1.
    const behind = this.v3.z > 1;
    // On touch the bottom ~180 px are thumbs and buttons: keep the arrow above them.
    this.hud.setArrow(edgeArrow(this.v3.x, this.v3.y, behind, w, this.isTouch ? Math.max(200, h - 180) : h, EDGE_PAD));
  }

  /** Line tapped: back to full; the caller opens Ayuda. */
  touchLine(now: number): void {
    this.changedAt = now;
  }

  get dots(): Partial<Record<MenuTab, boolean>> {
    return { libro: this.cur.libro, ayuda: this.cur.ayuda };
  }

  /** A tab was opened: its dot goes. */
  ackTab(tab: MenuTab): void {
    if (!this.ack) return;
    if (tab === 'libro') this.ack = { ...this.ack, pts: this.last.skillPts };
    else if (tab === 'ayuda') this.ack = { ...this.ack, cards: [...this.last.cards] };
    else return;
    store(ACK_KEY, this.ack);
    this.cur = dots(this.last, this.ack);
    this.touch?.setDots(this.cur.menu, this.cur.pills);
  }

  ackPill(i: number): void {
    if (!this.ack) return;
    const pills = [...this.ack.pills];
    pills[i] = true;
    this.ack = { ...this.ack, pills };
    store(ACK_KEY, this.ack);
    this.cur = dots(this.last, this.ack);
    this.touch?.setDots(this.cur.menu, this.cur.pills);
  }

  /** "Repetir consejos" could clear this later; for now Ajustes › Consejos just hides them. */
  clearQueue(): void {
    this.queue.clear();
  }
}
