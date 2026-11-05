// Layered, zone-based temple audio. Everything here is synthesised in real time with the
// Web Audio API: there are no recorded devotional tracks in this prototype. Bells use
// additive inharmonic partials, the conch is a filtered breathy sawtooth, chanting is a
// formant-filtered vocal drone. Recorded, licensed assets can replace any voice by
// implementing the same method on top of an AudioBuffer (see README "Audio").

const BELL_PARTIALS = [
  // ratio, relative gain, decay seconds (scaled by size)
  [0.5, 0.55, 5.5], [1.0, 1.0, 4.2], [1.183, 0.55, 3.4], [1.506, 0.38, 2.8],
  [2.0, 0.42, 2.4], [2.514, 0.22, 1.7], [2.662, 0.18, 1.5], [3.011, 0.16, 1.2],
  [4.166, 0.09, 0.8], [5.433, 0.06, 0.55],
];

const BHUPALI = [0, 2, 4, 7, 9, 12, 14, 16]; // pentatonic, semitones above Sa

export class TempleAudio {
  constructor() {
    this.ctx = null;
    this.levels = { master: 0.8, ambience: 0.7, effects: 0.85, ceremony: 0.8 };
    this.muted = false;
    this.zone = { entrance: 0, courtyard: 1, corridor: 0, dome: 0, garden: 0.3, ganesha: 0, shiva: 0, krishna: 0 };
    this.layers = {};
    this._timers = [];
    this.ceremony = null;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  async start() {
    if (this.ctx) { try { await this.ctx.resume(); } catch (e) {} return this.ready; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    const ctx = this.ctx;
    this.out = ctx.createDynamicsCompressor();
    this.out.threshold.value = -14; this.out.ratio.value = 3; this.out.attack.value = 0.01; this.out.release.value = 0.25;
    this.out.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(this.out);
    this.buses = {};
    for (const b of ['ambience', 'effects', 'ceremony']) { const g = ctx.createGain(); g.connect(this.master); this.buses[b] = g; }
    // Two reverbs: long stone hall (dome) and shorter stone corridor/court.
    this.hall = ctx.createConvolver(); this.hall.buffer = this._impulse(4.2, 2.6);
    this.stone = ctx.createConvolver(); this.stone.buffer = this._impulse(1.6, 3.2);
    this.hallReturn = ctx.createGain(); this.hallReturn.gain.value = 0.0;
    this.stoneReturn = ctx.createGain(); this.stoneReturn.gain.value = 0.35;
    this.hall.connect(this.hallReturn).connect(this.master);
    this.stone.connect(this.stoneReturn).connect(this.master);
    this.noise = this._noiseBuffer(3);
    this._applyLevels();
    this._buildAmbience();
    this._scheduleRandom();
    try { await ctx.resume(); } catch (e) {}
    return this.ready;
  }

  // ---------- helpers ----------
  _impulse(seconds, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections then a smooth tail
        const early = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? 2.5 : 1;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
      }
    }
    return buf;
  }
  _noiseBuffer(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; // light pinking for a softer texture
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.12) * 0.9;
    }
    return buf;
  }
  _noiseSource() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random(); return s; }
  _panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.1; p.maxDistance = 120;
    if (pos) this._setPos(p, pos);
    return p;
  }
  _setPos(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
  }
  _send(node, { hall = 0, stone = 0 } = {}) {
    if (hall > 0) { const g = this.ctx.createGain(); g.gain.value = hall; node.connect(g).connect(this.hall); }
    if (stone > 0) { const g = this.ctx.createGain(); g.gain.value = stone; node.connect(g).connect(this.stone); }
  }
  _ramp(param, v, tc = 0.6) { if (!this.ctx) return; param.cancelScheduledValues(this.ctx.currentTime); param.setTargetAtTime(v, this.ctx.currentTime, tc); }

  // ---------- levels ----------
  setLevel(bus, v) { this.levels[bus] = v; this._applyLevels(); }
  setMuted(m) { this.muted = m; this._applyLevels(); }
  _applyLevels() {
    if (!this.ctx) return;
    this._ramp(this.master.gain, this.muted ? 0 : this.levels.master, 0.08);
    for (const b of ['ambience', 'effects', 'ceremony']) this._ramp(this.buses[b].gain, this.levels[b], 0.08);
  }

  setListener(pos, forward) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0); }
  }

  // ---------- ambience beds ----------
  _buildAmbience() {
    const ctx = this.ctx, amb = this.buses.ambience;
    const L = this.layers;
    // Wind: low-passed noise with a slow, wandering filter
    { const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg).connect(f.frequency);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.04; lfo2.connect(lg2).connect(g.gain);
      s.connect(f).connect(g).connect(amb); s.start(); lfo.start(); lfo2.start(); L.wind = g; }
    // Fountain: band-passed noise, spatialised at the courtyard centre
    { const s = this._noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 2600; bp.gain.value = 6; bp.Q.value = 0.8;
      const trem = ctx.createGain(); trem.gain.value = 0.8;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 3.3; const lg = ctx.createGain(); lg.gain.value = 0.15; lfo.connect(lg).connect(trem.gain);
      const g = ctx.createGain(); g.gain.value = 0; const p = this._panner({ x: 0, y: 1, z: 0 }); p.refDistance = 2.5; p.rolloffFactor = 1.6;
      s.connect(hp).connect(bp).connect(trem).connect(g).connect(p).connect(amb); s.start(); lfo.start(); L.fountain = g; }
    // Interior hum / chant drone (prayer dome)
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(amb); this._send(g, { hall: 0.6 }); L.chant = g; this._buildChant(g); }
    // Shiva: a deeper drone; Krishna: bansuri-like flute phrases (scheduled); Ganesha: soft bells
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(amb); this._send(g, { hall: 0.5 }); L.shivaDrone = g;
      for (const [f, a] of [[65.4, 0.5], [98.0, 0.3], [130.8, 0.18]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a * 0.25;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.05; const lg = ctx.createGain(); lg.gain.value = a * 0.08; lfo.connect(lg).connect(og.gain);
        o.connect(og).connect(g); o.start(); lfo.start(); } }
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(amb); this._send(g, { hall: 0.45, stone: 0.2 }); L.flute = g; }
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(amb); L.birds = g; }
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(amb); this._send(g, { stone: 0.6, hall: 0.3 }); L.distantBells = g; }
    this.applyZone(this.zone, 0.1);
  }

  _buildChant(dest) {
    // A sustained "Om"-like vocal drone: two sawtooth voices through vowel formants, with the
    // formants slowly closing from "o" to "m" in long breaths. A soft tanpura-style Sa-Pa drone sits under it.
    const ctx = this.ctx;
    const voice = ctx.createGain(); voice.gain.value = 0;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 450; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 800; f2.Q.value = 8;
    const mix = ctx.createGain(); mix.gain.value = 1.6;
    for (const [freq, det] of [[110, -6], [110, 5], [165, 3], [55, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = freq === 55 ? 0.25 : 0.18;
      o.connect(og); og.connect(f1); og.connect(f2); o.start();
    }
    f1.connect(mix); f2.connect(mix); mix.connect(voice).connect(dest);
    this._chantNodes = { voice, f1, f2 };
    // tanpura-ish drone
    const dr = ctx.createGain(); dr.gain.value = 0.05; dr.connect(dest);
    for (const f of [110, 164.8, 220, 220.6]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og).connect(dr); o.start(); }
    const breathe = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime, dur = 7.5;
      const v = voice.gain; v.cancelScheduledValues(t); v.setValueAtTime(v.value, t);
      v.linearRampToValueAtTime(0.5, t + 1.2); v.setValueAtTime(0.5, t + dur - 1.6); v.linearRampToValueAtTime(0.0, t + dur);
      f1.frequency.setValueAtTime(520, t); f1.frequency.linearRampToValueAtTime(430, t + dur * 0.45); f1.frequency.linearRampToValueAtTime(260, t + dur * 0.62);
      f2.frequency.setValueAtTime(880, t); f2.frequency.linearRampToValueAtTime(760, t + dur * 0.45); f2.frequency.linearRampToValueAtTime(320, t + dur * 0.62);
      this._timers.push(setTimeout(breathe, (dur + 1.2) * 1000));
    };
    breathe();
  }

  _scheduleRandom() {
    const loop = (fn, min, max) => { const tick = () => { if (!this.ctx) return; fn(); this._timers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000)); }; this._timers.push(setTimeout(tick, Math.random() * max * 1000)); };
    loop(() => this._bird(), 0.8, 3.4);
    loop(() => this._distantBell(), 7, 16);
    loop(() => this._flutePhrase(), 6, 11);
  }

  applyZone(z, tc = 0.9) {
    this.zone = z;
    if (!this.ctx || !this.layers.wind) return;
    const L = this.layers, out = 1 - z.dome;
    const set = (g, v) => this._ramp(g.gain, v, tc);
    set(L.wind, 0.10 * out * (0.4 + z.entrance + z.garden * 0.6));
    set(L.fountain, 0.32 * out * (0.2 + z.courtyard));
    set(L.birds, 0.55 * out * (0.35 + z.entrance * 0.8 + z.garden * 0.8));
    set(L.distantBells, 0.35 * (out * 0.9 + z.dome * 0.15));
    set(L.chant, 0.55 * z.dome + 0.05 * z.corridor);
    set(L.shivaDrone, 0.5 * z.shiva * (0.2 + z.dome));
    set(L.flute, 0.32 * z.krishna * (0.4 + z.dome * 0.6) + 0.04 * out);
    this._ramp(this.hallReturn.gain, 0.12 + z.dome * 0.7, tc);
    this._ramp(this.stoneReturn.gain, 0.15 + z.corridor * 0.55, tc);
  }

  // ---------- one-shot voices ----------
  _bird() {
    const ctx = this.ctx, t = ctx.currentTime, g0 = this.layers.birds;
    if (!g0 || g0.gain.value < 0.01) return;
    const p = this._panner({ x: (Math.random() - 0.5) * 70, y: 8, z: (Math.random() - 0.5) * 70 }); p.connect(g0);
    const notes = 2 + Math.floor(Math.random() * 4), base = 2200 + Math.random() * 1800;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(); o.type = 'sine'; const g = ctx.createGain();
      const s = t + i * (0.09 + Math.random() * 0.08), d = 0.06 + Math.random() * 0.08;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), s);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), s + d);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.08, s + 0.01); g.gain.exponentialRampToValueAtTime(0.001, s + d);
      o.connect(g).connect(p); o.start(s); o.stop(s + d + 0.05);
    }
  }
  _distantBell() {
    const g = this.layers.distantBells; if (!g || g.gain.value < 0.01) return;
    const a = Math.random() * Math.PI * 2;
    this.bell({ x: Math.cos(a) * 40, y: 4, z: Math.sin(a) * 40 }, { size: 0.8 + Math.random() * 0.5, gain: 0.35, dest: g, hall: 0, stone: 0.4 });
  }
  _flutePhrase() {
    const dest = this.layers.flute; if (!dest || dest.gain.value < 0.01) return;
    const ctx = this.ctx; let t = ctx.currentTime + 0.05; const sa = 392; // G4 as Sa
    let idx = 3 + Math.floor(Math.random() * 3);
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      idx = Math.max(0, Math.min(BHUPALI.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const f = sa * Math.pow(2, BHUPALI[idx] / 12), d = i === n - 1 ? 1.6 : 0.3 + Math.random() * 0.45;
      this._fluteNote(dest, f, t, d); t += d * 0.92;
    }
  }
  _fluteNote(dest, f, t, d) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.06);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + d); vib.connect(vg).connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.08;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.07); g.gain.setValueAtTime(0.14, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d + 0.12);
    const br = this._noiseSource(); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 3; const bg = ctx.createGain(); bg.gain.value = 0.18;
    o.connect(g); o2.connect(g2).connect(g); br.connect(bf).connect(bg).connect(g); g.connect(dest);
    o.start(t); o2.start(t); vib.start(t); br.start(t); const end = t + d + 0.2; o.stop(end); o2.stop(end); vib.stop(end); br.stop(end);
  }

  bell(pos, { size = 1, gain = 0.6, dest = null, hall = 0.4, stone = 0.15, when = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const fund = 560 / size;
    const p = pos ? this._panner(pos) : ctx.createGain();
    p.connect(dest || this.buses.effects); this._send(p, { hall, stone });
    const bus = ctx.createGain(); bus.gain.value = gain; bus.connect(p);
    for (const [r, a, dec] of BELL_PARTIALS) {
      for (const det of [-1.2, 1.2]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fund * r + det * r * 0.6;
        const g = ctx.createGain(); const dd = dec * (0.7 + size * 0.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.09, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dd);
        o.connect(g).connect(bus); o.start(t); o.stop(t + dd + 0.05);
      }
    }
    // strike transient
    const n = this._noiseSource(); const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = fund * 6; hf.Q.value = 1.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hf).connect(ng).connect(bus); n.start(t); n.stop(t + 0.08);
  }

  // small hand bell (ghanti) used during aarti: short bright strikes
  ghanti(when, gain = 0.25, dest) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const g0 = ctx.createGain(); g0.gain.value = gain; g0.connect(dest || this.buses.effects); this._send(g0, { hall: 0.35 });
    for (const [r, a, d] of [[1, 1, 0.9], [2.76, 0.5, 0.5], [5.4, 0.3, 0.25], [8.9, 0.15, 0.12]]) {
      const o = ctx.createOscillator(); o.frequency.value = 1850 * r * (1 + (Math.random() - 0.5) * 0.004); const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.1, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(g0); o.start(t); o.stop(t + d + 0.02);
    }
  }

  conch(when = 0, dest) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when, dur = 3.2;
    const out = ctx.createGain(); out.gain.value = 0.55; out.connect(dest || this.buses.ceremony); this._send(out, { hall: 0.7 });
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.5;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1700, t + 0.6); lp.frequency.setValueAtTime(1500, t + dur - 0.8); lp.frequency.linearRampToValueAtTime(400, t + dur);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + 0.45); env.gain.setValueAtTime(0.45, t + dur - 0.9); env.gain.linearRampToValueAtTime(0, t + dur);
    for (const [m, a] of [[1, 0.5], [2, 0.25], [3.01, 0.08]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; const f = 233 * m;
      o.frequency.setValueAtTime(f * 0.88, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.5); o.frequency.setValueAtTime(f, t + dur - 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + dur);
      const vib = ctx.createOscillator(); vib.frequency.value = 4.6; const vg = ctx.createGain(); vg.gain.value = f * 0.006; vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = a; o.connect(g).connect(lp); o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
    }
    const br = this._noiseSource(); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 0.8; const bg = ctx.createGain(); bg.gain.value = 0.12;
    br.connect(bf).connect(bg).connect(lp); br.start(t); br.stop(t + dur + 0.1);
    lp.connect(env).connect(out);
  }

  footstep(intensity = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 + Math.random() * 400; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * intensity, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f).connect(g).connect(this.buses.effects); s.start(t); s.stop(t + 0.15);
    const z = this.zone; this._send(g, { stone: 0.3 + z.corridor * 1.2, hall: z.dome * 0.8 });
  }

  ignite(pos) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime; const p = this._panner(pos); p.connect(this.buses.effects); this._send(p, { hall: 0.3 });
    const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    const s2 = this._noiseSource(); const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 500;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t + 0.05); g2.gain.linearRampToValueAtTime(0.25, t + 0.2); g2.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    s.connect(f).connect(g).connect(p); s2.connect(f2).connect(g2).connect(p); s.start(t); s.stop(t + 0.3); s2.start(t); s2.stop(t + 1.1);
  }

  shimmer(pos) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime; const p = this._panner(pos); p.connect(this.buses.effects); this._send(p, { hall: 0.5 });
    [0, 4, 7, 12, 16].forEach((st, i) => {
      const o = ctx.createOscillator(); o.frequency.value = 1046 * Math.pow(2, st / 12); const g = ctx.createGain(); const s = t + i * 0.07;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.03, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.2);
      o.connect(g).connect(p); o.start(s); o.stop(s + 1.3);
    });
  }

  water(pos) { // abhishek pour
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime; const p = this._panner(pos); p.connect(this.buses.effects); this._send(p, { hall: 0.5 });
    const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.3); g.gain.setValueAtTime(0.18, t + 3.2); g.gain.linearRampToValueAtTime(0, t + 4);
    s.connect(f).connect(g).connect(p); s.start(t); s.stop(t + 4.1);
  }

  uiTap() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime; const o = ctx.createOscillator(); o.frequency.value = 1320; const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.buses.effects); o.start(t); o.stop(t + 0.4);
  }

  // ---------- shared aarti ceremony track ----------
  // One instance per prayer hall. In a networked build the hall's server clock would supply
  // `offset` so every visitor hears the same position in the same single track.
  startAarti(duration = 60, offset = 0) {
    if (!this.ctx) return null;
    this.stopAarti();
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05 - offset;
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.buses.ceremony); this._send(bus, { hall: 0.55 });
    bus.gain.setValueAtTime(0, Math.max(ctx.currentTime, t0)); bus.gain.linearRampToValueAtTime(1, t0 + 2);
    bus.gain.setValueAtTime(1, t0 + duration - 9); bus.gain.linearRampToValueAtTime(0, t0 + duration - 5);
    const nodes = [];
    const at = (s) => t0 + s;
    // conch calls
    const conchAt = (s) => { if (at(s) > ctx.currentTime) this.conch(at(s) - ctx.currentTime, this.buses.ceremony); };
    conchAt(3.5); conchAt(7.6);
    // drone
    const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(bus);
    drone.gain.setValueAtTime(0, at(10)); drone.gain.linearRampToValueAtTime(0.09, at(13));
    for (const f of [130.8, 196, 261.6, 262.2]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(drone); o.start(at(10)); o.stop(at(duration)); nodes.push(o); }
    // rhythm: soft low drum + hand bells, 84 bpm
    const beat = 60 / 84;
    for (let s = 11; s < duration - 10; s += beat) {
      const t = at(s); if (t < ctx.currentTime) continue;
      const b = Math.round((s - 11) / beat) % 8;
      if (b === 0 || b === 3 || b === 5) this._drum(t, bus, b === 0 ? 0.5 : 0.32, b === 0 ? 70 : 95);
      if (b === 2 || b === 6) this._drum(t, bus, 0.18, 210, 0.08);
      this.ghanti(t - ctx.currentTime, 0.16, bus);
      this.ghanti(t + beat / 2 - ctx.currentTime, 0.1, bus);
    }
    // an original, simple devotional melody in a major (Bilawal) mode on a reedy harmonium voice
    const sa = 261.6, S = [0, 2, 4, 5, 7, 9, 11, 12, 14];
    const phrase = [[4, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 2], [-1, 1], [2, 1], [3, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 3], [-1, 1],
      [0, 1], [2, 1], [4, 1], [5, 1], [6, 2], [5, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [2, 1], [0, 3], [-1, 1]];
    let s = 13;
    while (s < duration - 12) {
      for (const [deg, len] of phrase) {
        const d = len * beat;
        if (deg >= 0 && at(s) > ctx.currentTime) this._reed(sa * Math.pow(2, S[deg] / 12), at(s), d * 0.95, bus);
        if (deg >= 0 && at(s) > ctx.currentTime && (len >= 2)) this._choir(sa * Math.pow(2, S[deg] / 12) / 2, at(s), d, bus);
        s += d; if (s >= duration - 12) break;
      }
    }
    // closing bell
    if (at(duration - 7) > ctx.currentTime) this.bell(null, { size: 1.35, gain: 0.8, dest: this.buses.ceremony, hall: 0.8, when: at(duration - 7) - ctx.currentTime });
    this.ceremony = { bus, nodes, t0 };
    return this.ceremony;
  }
  stopAarti() {
    if (!this.ceremony || !this.ctx) return;
    const { bus, nodes } = this.ceremony; const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 1.2);
    for (const n of nodes) { try { n.stop(t + 1.3); } catch (e) {} }
    setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 1500);
    this.ceremony = null;
  }
  _drum(t, dest, a, f, d = 0.35) {
    const ctx = this.ctx; const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.05);
  }
  _reed(f, t, d, dest) {
    const ctx = this.ctx; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.setValueAtTime(0.06, t + d * 0.8); g.gain.linearRampToValueAtTime(0, t + d + 0.08);
    for (const [m, typ, a, det] of [[1, 'sawtooth', 0.6, -4], [1, 'square', 0.3, 4], [2, 'sawtooth', 0.2, 0]]) {
      const o = ctx.createOscillator(); o.type = typ; o.frequency.value = f * m; o.detune.value = det; const og = ctx.createGain(); og.gain.value = a;
      o.connect(og).connect(lp); o.start(t); o.stop(t + d + 0.1);
    }
    lp.connect(g).connect(dest);
  }
  _choir(f, t, d, dest) {
    const ctx = this.ctx; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.3); g.gain.linearRampToValueAtTime(0, t + d + 0.4);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 7;
    for (const det of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(f1); o.connect(f2); o.start(t); o.stop(t + d + 0.5); }
    f1.connect(g); f2.connect(g); g.connect(dest);
  }
}
