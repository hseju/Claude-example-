import { daylight } from '../sim/environment';
import { clamp } from '../sim/math';
import type { World } from '../sim/world';

interface Loop {
  gain: GainNode;
  filter?: BiquadFilterNode;
}

type NoiseKind = 'white' | 'pink' | 'brown';

/**
 * Procedural soundscape built with the Web Audio API: no audio files.
 * Loops follow the simulation (fire intensity, wind, rain, distance to water),
 * one-shots come from the world's sound queue.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambience!: GainNode;
  private sfx!: GainNode;
  private buffers = new Map<NoiseKind, AudioBuffer>();
  private loops: Record<string, Loop> = {};
  private nextCrackle = 0;
  private nextCricket = 0;
  private nextBird = 0;
  private volume = 0.7;
  private muted = false;
  private ambienceOn = true;

  get started() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.ambience = ctx.createGain();
    this.ambience.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    for (const k of ['white', 'pink', 'brown'] as NoiseKind[]) this.buffers.set(k, this.makeNoise(k));

    this.loops.wind = this.loop('brown', 'bandpass', 380, 0.6, this.ambience);
    this.loops.rain = this.loop('pink', 'highpass', 700, 0.4, this.ambience);
    this.loops.fire = this.loop('brown', 'lowpass', 520, 0.8, this.ambience);
    this.loops.stream = this.loop('white', 'bandpass', 1500, 0.9, this.ambience);
    this.loops.lake = this.loop('brown', 'lowpass', 330, 0.7, this.ambience);
    this.loops.sizzle = this.loop('white', 'bandpass', 5200, 1.2, this.sfx);
    this.applyVolume();
  }

  setVolume(volume: number, muted: boolean, ambience: boolean): void {
    this.volume = volume;
    this.muted = muted;
    this.ambienceOn = ambience;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.1);
    this.ambience.gain.setTargetAtTime(this.ambienceOn ? 1 : 0, t, 0.2);
  }

  private makeNoise(kind: NoiseKind): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  private loop(noise: NoiseKind, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): Loop {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.get(noise)!;
    src.loop = true;
    src.loopStart = Math.random();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(dest);
    src.start(0, Math.random() * 2);
    return { gain, filter };
  }

  private set(loop: Loop, value: number, tc = 0.25) {
    loop.gain.gain.setTargetAtTime(value, this.ctx!.currentTime, tc);
  }

  /** Called a few times per second with the camera focus point. */
  update(w: World, listener: { x: number; z: number }, cameraDistance: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      w.sounds.length = 0;
      return;
    }
    const now = ctx.currentTime;
    const env = w.env;
    const zoom = clamp(1.25 - cameraDistance / 50, 0.45, 1);
    const fire = w.fire;
    const fd = Math.hypot(listener.x - w.campfire.x, listener.z - w.campfire.z);
    const fireNear = clamp(1 - fd / 22) * zoom;
    const paused = w.paused ? 0.3 : 1;

    this.set(this.loops.wind, (0.04 + env.windStrength ** 1.5 * 0.32) * paused);
    this.loops.wind.filter!.frequency.setTargetAtTime(260 + env.windStrength * 520 + Math.sin(now * 0.3) * 80, now, 0.5);
    this.set(this.loops.rain, env.mix.rain * 0.42 * paused);
    this.set(this.loops.fire, (fire.intensity * 0.32 + fire.ember * 0.05) * fireNear * paused);
    const sd = w.terrain.streamDist(listener.x, listener.z);
    this.set(this.loops.stream, clamp(1 - sd / 16) * 0.07 * zoom * paused);
    const le = w.terrain.lakeRadius(listener.x, listener.z);
    this.set(this.loops.lake, clamp(1.6 - le) * (0.06 + 0.04 * Math.sin(now * 1.3)) * zoom * paused);
    this.set(this.loops.sizzle, fire.pan && fire.intensity > 0.1 ? 0.035 * fireNear * paused : 0, 0.1);

    if (!w.paused) {
      // Fire crackles.
      if (now > this.nextCrackle && fire.intensity > 0.05) {
        this.crackle(fire.intensity * fireNear);
        this.nextCrackle = now + (0.04 + Math.random() * 0.35) / (0.3 + fire.intensity);
      }
      const night = 1 - daylight(env);
      const warm = env.season === 'summer' ? 1 : env.season === 'spring' ? 0.6 : env.season === 'autumn' ? 0.3 : 0;
      if (now > this.nextCricket && night > 0.5 && warm > 0 && env.mix.rain < 0.3) {
        this.cricket(warm * night * zoom);
        this.nextCricket = now + 0.25 + Math.random() * 0.7;
      }
      if (now > this.nextBird && night < 0.4 && env.mix.rain < 0.3 && env.season !== 'winter') {
        this.bird(zoom * (1 - night));
        this.nextBird = now + 2 + Math.random() * 6;
      }
    }

    // One-shots from the simulation.
    const queue = w.sounds.splice(0, w.sounds.length);
    for (const s of queue.slice(-8)) {
      const d = Math.hypot(s.x - listener.x, s.z - listener.z);
      const g = clamp(1 - d / 28) * zoom;
      if (g <= 0.01 && s.name !== 'thunder') continue;
      this.play(s.name, g, clamp((s.x - listener.x) / 15, -1, 1));
    }
  }

  private out(gainValue: number, pan = 0): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gainValue;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.sfx);
    } else g.connect(this.sfx);
    return g;
  }

  private noiseBurst(kind: NoiseKind, type: BiquadFilterType, freq: number, dur: number, peak: number, pan = 0, attack = 0.005, q = 0.8, sweepTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.get(kind)!;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.out(0, pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 2, dur + 0.1);
  }

  private tone(freq: number, dur: number, peak: number, pan = 0, type: OscillatorType = 'sine', slideTo?: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.out(0, pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private crackle(level: number) {
    if (level < 0.02) return;
    this.noiseBurst('white', 'highpass', 1800 + Math.random() * 3000, 0.012 + Math.random() * 0.03, level * (0.08 + Math.random() * 0.16), Math.random() * 0.6 - 0.3, 0.001, 0.5);
  }

  private cricket(level: number) {
    const pan = Math.random() * 1.6 - 0.8;
    const f = 4300 + Math.random() * 600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(f, 0.03, 0.012 * level, pan, 'sine', undefined, i * 0.055);
  }

  private bird(level: number) {
    const pan = Math.random() * 1.6 - 0.8;
    const base = 2400 + Math.random() * 1400;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(base, 0.09, 0.02 * level, pan, 'sine', base * (1.25 + Math.random() * 0.3), i * 0.14);
  }

  play(name: string, g = 1, pan = 0): void {
    if (!this.ctx) return;
    switch (name) {
      case 'splash':
      case 'fishjump':
        this.noiseBurst('white', 'bandpass', 900, 0.45, 0.22 * g, pan, 0.01, 0.7, 300);
        break;
      case 'plop':
        this.tone(520, 0.12, 0.12 * g, pan, 'sine', 180);
        this.noiseBurst('white', 'bandpass', 1200, 0.15, 0.06 * g, pan);
        break;
      case 'cast':
        this.noiseBurst('pink', 'bandpass', 600, 0.35, 0.12 * g, pan, 0.05, 1.2, 2400);
        break;
      case 'wood':
      case 'box':
        this.tone(140, 0.12, 0.18 * g, pan, 'triangle', 90);
        this.noiseBurst('brown', 'lowpass', 600, 0.12, 0.12 * g, pan);
        break;
      case 'log':
        this.tone(110, 0.18, 0.2 * g, pan, 'triangle', 70);
        for (let i = 0; i < 5; i++) setTimeout(() => this.crackle(g), i * 60);
        break;
      case 'match':
        this.noiseBurst('white', 'highpass', 3000, 0.18, 0.12 * g, pan, 0.01);
        this.noiseBurst('pink', 'lowpass', 900, 0.8, 0.16 * g, pan, 0.08);
        break;
      case 'chop':
        this.tone(900, 0.04, 0.06 * g, pan, 'triangle', 600);
        break;
      case 'hammer':
        this.tone(320, 0.08, 0.14 * g, pan, 'square', 200);
        break;
      case 'zip':
        this.noiseBurst('white', 'bandpass', 1500, 0.45, 0.08 * g, pan, 0.02, 2, 4200);
        break;
      case 'click':
        this.tone(1200, 0.03, 0.06 * g, pan, 'square');
        break;
      case 'pour':
        this.noiseBurst('pink', 'bandpass', 700, 0.9, 0.08 * g, pan, 0.05, 3, 1100);
        break;
      case 'sizzle':
        this.noiseBurst('white', 'bandpass', 5000, 0.6, 0.06 * g, pan, 0.02, 1);
        break;
      case 'owl':
        this.tone(370, 0.32, 0.06 * Math.max(g, 0.4), pan, 'sine', 340);
        this.tone(360, 0.5, 0.06 * Math.max(g, 0.4), pan, 'sine', 320, 0.5);
        break;
      case 'thunder':
        this.noiseBurst('white', 'highpass', 1500, 0.25, 0.1, 0, 0.005);
        this.noiseBurst('brown', 'lowpass', 220, 3.5, 0.55, 0, 0.15, 0.7, 60);
        break;
      case 'cheer':
        [660, 830, 990].forEach((f, i) => this.tone(f, 0.18, 0.05 * g, pan, 'triangle', undefined, i * 0.08));
        break;
      case 'ui':
        this.tone(880, 0.06, 0.04, 0, 'sine', 1100);
        break;
    }
  }
}

export const audio = new AudioEngine();
