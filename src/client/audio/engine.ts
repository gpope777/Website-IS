/** P7-B (spec §4.1–4.4): the only file that touches WebAudio. Everything it decides comes from mix.ts / cues.ts. */
import { renderSfx, lcg, type SfxDef } from './synth';
import { SFX, SFX_IDS, type Bus, type SfxEntry, type SfxId } from './sfx';
import { AMB_LAYERS, AUDIO, jitter, MUSIC_NAMES, musicUrl, spatial, Voices, type AmbLayer } from './mix';

type Ctx = AudioContext;

/** Each ambience layer: a looping noise bed through one filter. */
const BED: Record<AmbLayer, { type: BiquadFilterType; f: number; q: number; brown: boolean; lfo?: number }> = {
  hojas: { type: 'bandpass', f: 2400, q: 0.6, brown: false, lfo: 0.15 },
  grillos: { type: 'bandpass', f: 4800, q: 12, brown: false, lfo: 7 },
  olas: { type: 'lowpass', f: 700, q: 0.7, brown: true, lfo: 0.12 },
  pantano: { type: 'lowpass', f: 400, q: 1, brown: true },
  viento: { type: 'bandpass', f: 600, q: 0.8, brown: true, lfo: 0.2 },
  grave: { type: 'lowpass', f: 120, q: 2, brown: true, lfo: 0.9 },
  lluvia: { type: 'highpass', f: 1500, q: 0.5, brown: false },
};

/** Little random events on top of the beds. */
const EVENTS: Record<'pajaro' | 'rana' | 'burbuja', SfxDef> = {
  pajaro: { wave: 'sine', freq: 2600, slide: 1.5, attack: 0.01, sustain: 0.04, decay: 0.06, vol: 0.25, vib: 18, echo: 0.12 },
  rana: { wave: 'square', freq: 180, attack: 0.01, sustain: 0.08, decay: 0.08, vol: 0.25, lp: 600, trem: 30 },
  burbuja: { wave: 'sine', freq: 300, slide: 3, attack: 0.005, sustain: 0.02, decay: 0.05, vol: 0.2 },
};

export class AudioEngine {
  ctx: Ctx | null = null;
  private buses = {} as Record<'master' | Bus, GainNode>;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Voices();
  private live = new Map<number, AudioBufferSourceNode>();
  private nextId = 1;
  private lx = 0;
  private lz = 0;
  private yaw = 0;
  private beds: Partial<Record<AmbLayer, GainNode>> = {};
  private wet: GainNode | null = null;
  private dry: GainNode | null = null;
  private eventIn = 4;
  private thunderIn = 12;
  private rnd = Math.random;
  /** Music drop-ins found by HEAD (names from MUSIC_NAMES). */
  have = new Set<string>();
  private musicName: string | null = null;
  private musicNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicBufs = new Map<string, Promise<AudioBuffer | null>>();

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Call from a user gesture: creates the context the first time (iOS rule), resumes it after. */
  unlock(): boolean {
    if (this.running) return true;
    try {
      if (!this.ctx) {
        const C: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return false;
        this.ctx = new C();
        this.build(this.ctx);
      }
      const ctx = this.ctx;
      // iOS: a sound started inside the gesture unlocks output.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start();
      if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    } catch {
      return false;
    }
    return this.running;
  }

  private build(ctx: Ctx): void {
    const master = ctx.createGain();
    master.connect(ctx.destination);
    this.buses.master = master;
    for (const b of ['sfx', 'ui', 'ambient', 'music'] as Bus[]) {
      const g = ctx.createGain();
      g.connect(master);
      this.buses[b] = g;
    }
    // Dungeon reverb on the sfx bus: dry always, wet only indoors.
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(ctx, 1.6);
    this.dry.connect(this.buses.sfx);
    this.wet.connect(conv).connect(this.buses.sfx);
    // Render the effects in small slices so the first touch does not stall a frame.
    const ids = [...SFX_IDS];
    const slice = () => {
      for (let k = 0; k < 6 && ids.length; k++) {
        const id = ids.shift()!;
        this.buffers.set(id, this.toBuffer(ctx, renderSfx(SFX[id], ctx.sampleRate, id.length * 97 + 1)));
      }
      if (ids.length) setTimeout(slice, 0);
      else for (const [k, d] of Object.entries(EVENTS)) this.buffers.set(k, this.toBuffer(ctx, renderSfx(d, ctx.sampleRate, 5)));
    };
    slice();
    for (const l of AMB_LAYERS) this.beds[l] = this.bed(ctx, l);
  }

  private toBuffer(ctx: Ctx, a: Float32Array): AudioBuffer {
    const b = ctx.createBuffer(1, a.length, ctx.sampleRate);
    b.getChannelData(0).set(a);
    return b;
  }

  private impulse(ctx: Ctx, secs: number): AudioBuffer {
    const n = Math.floor(secs * ctx.sampleRate);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    const r = lcg(3);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    return b;
  }

  private bed(ctx: Ctx, l: AmbLayer): GainNode {
    const spec = BED[l];
    const n = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const r = lcg(l.length * 131);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      last = spec.brown ? (last + 0.02 * w) / 1.02 : w;
      d[i] = spec.brown ? last * 3.5 : w * 0.5;
    }
    // Crossfade the loop seam.
    const fade = Math.floor(ctx.sampleRate * 0.1);
    for (let i = 0; i < fade; i++) d[n - fade + i] = d[n - fade + i]! * (1 - i / fade) + d[i]! * (i / fade);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopEnd = (n - fade) / ctx.sampleRate;
    const f = ctx.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.f;
    f.Q.value = spec.q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.buses.ambient);
    if (spec.lfo) {
      const o = ctx.createOscillator();
      o.frequency.value = spec.lfo;
      const depth = ctx.createGain();
      depth.gain.value = spec.f * 0.3;
      o.connect(depth).connect(f.frequency);
      o.start();
    }
    src.start();
    return g;
  }

  setGains(g: Record<'master' | Bus, number>): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(g) as ('master' | Bus)[]) this.buses[k]?.gain.setTargetAtTime(g[k], t, 0.05);
  }

  /** Hidden tab: silence and stop the clock; back: resume. */
  pause(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined);
  }

  listener(x: number, z: number, yaw: number): void {
    this.lx = x;
    this.lz = z;
    this.yaw = yaw;
  }

  play(id: SfxId | 'pajaro' | 'rana' | 'burbuja', pos?: { x: number; z: number }, gainK = 1): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const def = (SFX as Record<string, SfxEntry>)[id];
    const tell = !!def?.tell;
    let gain = gainK;
    let pan = 0;
    if (pos) {
      const s = spatial(this.lx, this.lz, this.yaw, pos.x, pos.z, tell);
      gain *= s.gain;
      pan = s.pan;
    }
    if (gain < 0.01) return;
    const vid = this.nextId++;
    const cut = this.voices.start(vid, def?.cls ?? 'world', tell, ctx.currentTime);
    if (cut !== null) {
      try {
        this.live.get(cut)?.stop();
      } catch {
        /* already ended */
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = jitter(this.rnd());
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = src.connect(g);
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    const bus = def?.bus ?? 'ambient';
    node.connect(bus === 'sfx' ? this.dry! : this.buses[bus]);
    if (bus === 'sfx' && this.wet!.gain.value > 0) node.connect(this.wet!);
    src.onended = () => {
      this.voices.end(vid);
      this.live.delete(vid);
    };
    this.live.set(vid, src);
    src.start();
  }

  /** ≤ 4 Hz: the bed gains, the dungeon reverb, and the random events. */
  ambience(gains: Record<AmbLayer, number>, o: { indoors: boolean; storm: boolean; dt: number }): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    for (const l of AMB_LAYERS) this.beds[l]?.gain.setTargetAtTime(o.indoors ? 0 : gains[l], t, 0.8);
    this.wet?.gain.setTargetAtTime(o.indoors ? 0.35 : 0, t, 0.3);
    if (o.indoors) return;
    this.eventIn -= o.dt;
    if (this.eventIn <= 0) {
      this.eventIn = 3 + this.rnd() * 6;
      const pick = gains.pantano > 0.2 ? (this.rnd() < 0.6 ? 'rana' : 'burbuja') : gains.hojas > 0.2 ? 'pajaro' : null;
      if (pick) this.play(pick, { x: this.lx + (this.rnd() - 0.5) * 30, z: this.lz + (this.rnd() - 0.5) * 30 }, 0.6);
    }
    if (o.storm) {
      this.thunderIn -= o.dt;
      if (this.thunderIn <= 0) {
        this.thunderIn = 8 + this.rnd() * 17;
        this.play('trueno');
      }
    }
  }

  /** HEAD each drop-in once; absent files are simply not in `have`. */
  async probeMusic(): Promise<void> {
    await Promise.all(
      MUSIC_NAMES.map(async (n) => {
        try {
          const r = await fetch(musicUrl(n), { method: 'HEAD' });
          const type = r.headers.get('content-type') ?? '';
          if (r.ok && !type.includes('text/html')) this.have.add(n);
        } catch {
          /* no file, no music */
        }
      }),
    );
  }

  private loadMusic(name: string): Promise<AudioBuffer | null> {
    let p = this.musicBufs.get(name);
    if (!p) {
      p = fetch(musicUrl(name))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
        .then((a) => this.ctx!.decodeAudioData(a))
        .catch(() => null);
      this.musicBufs.set(name, p);
    }
    return p;
  }

  /** Crossfades (3 s) to this drop-in track, or to silence. */
  music(name: string | null): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || name === this.musicName) return;
    this.musicName = name;
    const old = this.musicNodes;
    this.musicNodes = null;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, AUDIO.fade / 3);
      setTimeout(() => {
        try {
          old.src.stop();
        } catch {
          /* ended */
        }
      }, AUDIO.fade * 1000 + 200);
    }
    if (!name) return;
    void this.loadMusic(name).then((buf) => {
      if (!buf || this.musicName !== name || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.buses.music);
      gain.gain.setTargetAtTime(1, this.ctx.currentTime, AUDIO.fade / 3);
      src.start();
      this.musicNodes = { src, gain };
    });
  }
}
