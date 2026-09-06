/**
 * All sound is synthesised with WebAudio: no files, no loading, works offline.
 * ponytail: one oscillator + envelope per effect; swap for samples if it ever sounds too cheap.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private stepTimer = 0;
  muted = false;

  /** Browsers only allow audio after a user gesture; call from the first click/key. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startWind();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private startWind(): void {
    if (!this.ctx || !this.master) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.wind = { gain, filter };
  }

  /** Night is quieter and deeper; wind swells with sprinting. */
  ambient(night: boolean, sprinting: boolean, raining = false): void {
    if (!this.wind || !this.ctx) return;
    const t = this.ctx.currentTime;
    const base = night ? 0.035 : sprinting ? 0.12 : 0.06;
    this.wind.gain.gain.setTargetAtTime(raining ? base + 0.1 : base, t, 0.5);
    this.wind.filter.frequency.setTargetAtTime(raining ? 2200 : night ? 250 : sprinting ? 900 : 450, t, 0.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  /** Call every frame while moving; emits a footstep at walking cadence. */
  footsteps(dt: number, moving: boolean, sprinting: boolean, swimming: boolean): void {
    if (!moving) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer -= dt;
    if (this.stepTimer > 0) return;
    this.stepTimer = swimming ? 0.7 : sprinting ? 0.28 : 0.45;
    if (swimming) this.noise(0.25, 0.25, 900);
    else this.noise(0.08, 0.35, 500 + Math.random() * 300);
  }

  punch(): void {
    this.noise(0.09, 0.5, 1200);
    this.tone(160, 0.12, 'square', 0.15, 60);
  }

  hitCreature(): void {
    this.tone(320, 0.15, 'sawtooth', 0.2, 90);
    this.noise(0.12, 0.3, 2500);
  }

  kill(): void {
    this.tone(440, 0.35, 'triangle', 0.25, 110);
    setTimeout(() => this.tone(220, 0.4, 'triangle', 0.2, 55), 80);
  }

  hurt(): void {
    this.tone(110, 0.3, 'sawtooth', 0.35, 50);
    this.noise(0.2, 0.4, 700);
  }

  pickup(): void {
    this.tone(660, 0.08, 'sine', 0.2);
    setTimeout(() => this.tone(880, 0.12, 'sine', 0.2), 60);
  }

  craft(): void {
    this.noise(0.15, 0.3, 3000);
    this.tone(520, 0.2, 'triangle', 0.18, 780);
  }

  eat(): void {
    this.noise(0.12, 0.25, 1500);
  }

  discover(): void {
    for (const [i, f] of [523, 659, 784, 1046].entries()) setTimeout(() => this.tone(f, 0.5, 'sine', 0.22), i * 120);
  }

  exitRevealed(): void {
    for (const [i, f] of [392, 523, 659, 784, 1046, 1318].entries()) setTimeout(() => this.tone(f, 0.9, 'sine', 0.2), i * 150);
  }

  win(): void {
    for (const [i, f] of [523, 659, 784, 1046, 784, 1046, 1318].entries()) setTimeout(() => this.tone(f, 0.7, 'triangle', 0.22), i * 180);
  }

  die(): void {
    this.tone(220, 1.6, 'sawtooth', 0.3, 40);
  }

  wolfHowl(): void {
    this.tone(330, 1.4, 'sine', 0.12, 520);
  }

  thunder(): void {
    this.noise(1.4, 0.7, 180);
    this.tone(50, 1.2, 'sine', 0.3, 30);
  }

  roar(): void {
    this.tone(90, 1.1, 'sawtooth', 0.35, 45);
    this.noise(0.8, 0.4, 600);
  }

  splash(): void {
    this.noise(0.4, 0.5, 1200);
  }
}
