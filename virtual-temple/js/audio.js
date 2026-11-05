// Temple soundscape, built with the Web Audio API.
//
// Recorded audio listed in audio/manifest.json carries the mood:
//   * Music: stations of whole tracks that stream, shuffle and crossfade. Uplifting (feel-good
//     grooves) by day and Meditation at night when set to Auto; Classical flute on request.
//   * Ambience: a quiet mountain stream with a songbird by day and crickets at night.
//   * Aarti: a recorded temple ceremony, only while an aarti is running.
// Synthesised in the browser: bells you ring, a rare far-off temple bell, the conch during aarti,
// footsteps on stone, offerings, wind, fountain and distant waterfalls, the hall chant, and a
// fallback for any slot without a recording (a Karplus-Strong tanpura drone, Indian birds,
// cicadas, crickets, frogs and an owl). See `loadLibrary()` and the README section
// "Using recorded audio".

const BELL_PARTIALS = [
  [0.5, 0.55, 5.5], [1.0, 1.0, 4.2], [1.183, 0.55, 3.4], [1.506, 0.38, 2.8],
  [2.0, 0.42, 2.4], [2.514, 0.22, 1.7], [2.662, 0.18, 1.5], [3.011, 0.16, 1.2],
  [4.166, 0.09, 0.8], [5.433, 0.06, 0.55],
];

const SA = 138.59;            // tonic (C#3) for the drone
const MEL = SA * 2;           // melody Sa (C#4)
const st = (n) => Math.pow(2, n / 12);

// Phrases: [semitones from Sa, beats, ornament]. 'a' = andolan (slow oscillation), 'm' = meend (glide in)
export const RAGAS = {
  morning: { name: 'Bhairav', time: 'dawn', phrases: [
    [[7, 1], [8, 2, 'a'], [7, 1], [5, 1], [4, 1], [1, 2, 'a'], [0, 3]],
    [[4, 1], [5, 1], [8, 2, 'a'], [7, 2], [5, 1], [4, 1], [5, 1], [1, 1, 'a'], [0, 3]],
    [[11, 1], [12, 2], [13, 1, 'a'], [12, 2], [11, 1], [8, 1, 'a'], [7, 3]],
    [[0, 1], [1, 1, 'a'], [4, 2], [5, 1], [7, 3, 'm'], [8, 1, 'a'], [7, 2]],
    [[-1, 1], [0, 2], [1, 1, 'a'], [4, 1], [5, 2], [4, 1], [1, 1, 'a'], [0, 4]],
  ] },
  afternoon: { name: 'Brindavani Sarang', time: 'afternoon', phrases: [
    [[10, 1], [12, 1], [14, 2], [12, 1], [10, 1], [7, 2, 'm'], [5, 1], [2, 1], [0, 3]],
    [[0, 1], [2, 1], [5, 2, 'm'], [7, 2], [10, 1], [7, 1], [5, 3]],
    [[2, 1], [5, 1], [7, 2], [10, 1], [12, 3, 'm'], [10, 1], [7, 2]],
    [[5, 1], [2, 2, 'm'], [-2, 1], [0, 4]],
  ] },
  evening: { name: 'Yaman', time: 'dusk', phrases: [
    [[-1, 1], [2, 1], [4, 2, 'm'], [2, 1], [0, 3]],
    [[4, 1], [6, 1], [9, 2], [11, 1], [12, 3, 'm']],
    [[12, 1], [11, 1], [9, 1], [7, 2], [6, 1], [4, 2, 'm'], [2, 1], [0, 3]],
    [[6, 1], [7, 2], [4, 1], [6, 1], [2, 2, 'm'], [0, 3]],
    [[11, 1], [14, 1], [16, 2], [14, 1], [12, 3]],
  ] },
  night: { name: 'Malkauns', time: 'night', phrases: [
    [[5, 2, 'm'], [3, 1], [0, 3]],
    [[8, 1], [10, 1], [12, 3, 'm'], [10, 1], [8, 2]],
    [[3, 1], [5, 1], [8, 2, 'm'], [5, 1], [3, 1], [5, 1], [3, 1], [0, 4]],
    [[-2, 1], [0, 2], [3, 2], [5, 3, 'm']],
    [[10, 1], [12, 1], [15, 2], [12, 1], [10, 1], [8, 3, 'm']],
  ] },
};

// How each time of day is mixed. Bird weights choose which species call.
const TOD_MIX = {
  morning: { birds: 1.0, birdRate: [0.25, 1.1], insects: 0, crickets: 0, wind: 0.6, bells: [45, 90], cow: 0, music: 1.0, instrument: 'bansuri', tabla: 0, chant: 0.7, owl: 0, frogs: 0,
    species: { koel: 0.2, bulbul: 0.18, sparrow: 0.2, myna: 0.12, barbet: 0.1, peacock: 0.06, dove: 0.08, crow: 0.04, parakeet: 0.02 } },
  afternoon: { birds: 0.45, birdRate: [0.9, 2.6], insects: 1, crickets: 0, wind: 1.0, bells: [70, 130], cow: 0, music: 0.75, instrument: 'bansuri', tabla: 0, chant: 0.4, owl: 0, frogs: 0,
    species: { crow: 0.28, myna: 0.18, sparrow: 0.14, bulbul: 0.16, koel: 0.08, dove: 0.12, parakeet: 0.04 } },
  evening: { birds: 0.85, birdRate: [0.3, 1.3], insects: 0.15, crickets: 0.25, wind: 0.5, bells: [40, 80], cow: 0, music: 1.0, instrument: 'sitar', tabla: 1, chant: 0.8, owl: 0, frogs: 0,
    species: { crow: 0.28, myna: 0.3, parakeet: 0.16, bulbul: 0.1, peacock: 0.08, sparrow: 0.08 } },
  night: { birds: 0.05, birdRate: [4, 9], insects: 0, crickets: 1, wind: 0.35, bells: null, cow: 0, music: 0.6, instrument: 'bansuri', tabla: 0, chant: 0.5, owl: 0.3, frogs: 0,
    species: { owl: 1 } },
};

export class TempleAudio {
  constructor() {
    this.ctx = null;
    this.levels = { master: 0.8, ambience: 0.7, effects: 0.85, ceremony: 0.8 };
    this.muted = false;
    this.zone = { entrance: 0, courtyard: 1, corridor: 0, dome: 0, garden: 0.3, ganesha: 0, shiva: 0, krishna: 0 };
    this.tod = 'morning';
    this.layers = {};
    this._timers = [];
    this.ceremony = null;
    this.library = {};       // decoded loops, loaded only when needed: { 'ambience.morning': AudioBuffer, aarti: AudioBuffer }
    this._loading = {};
    this.manifest = null;     // audio/manifest.json
    this.playlists = {};      // station id -> [{ file, title, artist }]
    this.musicStyle = 'auto'; // 'auto' | a station id | 'off'
    this.nowPlaying = null;   // { title, artist, station }
    this.onTrack = null;      // called when a new track starts
    this._queues = {};
    this.synthMelody = false; // raga phrases on synthesised bansuri/sitar; off now that recordings carry the music
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  get raga() { return RAGAS[this.tod]; }

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
    for (const b of ['ambience', 'effects', 'ceremony', 'music']) { const g = ctx.createGain(); g.connect(this.master); this.buses[b] = g; }
    // outdoor sounds pass through a filter that closes when you step inside a prayer hall
    this.outdoorLP = ctx.createBiquadFilter(); this.outdoorLP.type = 'lowpass'; this.outdoorLP.frequency.value = 18000; this.outdoorLP.Q.value = 0.5;
    this.outdoor = ctx.createGain(); this.outdoor.connect(this.outdoorLP).connect(this.buses.ambience);
    this.hall = ctx.createConvolver(); this.hall.buffer = this._impulse(4.2, 2.6);
    this.stone = ctx.createConvolver(); this.stone.buffer = this._impulse(1.6, 3.2);
    this.hallReturn = ctx.createGain(); this.hallReturn.gain.value = 0.0;
    this.stoneReturn = ctx.createGain(); this.stoneReturn.gain.value = 0.35;
    this.hall.connect(this.hallReturn).connect(this.master);
    this.stone.connect(this.stoneReturn).connect(this.master);
    this.noise = this._noiseBuffer(3);
    this._applyLevels();
    this._buildBeds();
    this._buildMusic();
    this._schedule();
    this.applyZone(this.zone, 0.1);
    this.loadLibrary();
    try { await ctx.resume(); } catch (e) {}
    return this.ready;
  }

  // ---------------------------------------------------------------- helpers
  _impulse(seconds, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) { const t = i / len; const early = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? 2.5 : 1; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early; }
    }
    return buf;
  }
  _noiseBuffer(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.12) * 0.9; }
    return buf;
  }
  _noiseSource() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random(); return s; }
  _panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.1; p.maxDistance = 140;
    if (pos) this._setPos(p, pos);
    return p;
  }
  _setPos(p, pos) { if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z); }
  _send(node, { hall = 0, stone = 0 } = {}) {
    if (hall > 0) { const g = this.ctx.createGain(); g.gain.value = hall; node.connect(g).connect(this.hall); }
    if (stone > 0) { const g = this.ctx.createGain(); g.gain.value = stone; node.connect(g).connect(this.stone); }
  }
  _ramp(param, v, tc = 0.6) { if (!this.ctx) return; param.cancelScheduledValues(this.ctx.currentTime); param.setTargetAtTime(v, this.ctx.currentTime, tc); }
  _env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  _osc(type, f, t, stop, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(stop); return o; }
  _around(r = 30, y = 6) { const a = Math.random() * Math.PI * 2, d = r * (0.4 + Math.random() * 0.6); return { x: Math.cos(a) * d, y, z: Math.sin(a) * d }; }
  _pick(weights) { let s = 0; for (const v of Object.values(weights)) s += v; let r = Math.random() * s; for (const [k, v] of Object.entries(weights)) { r -= v; if (r <= 0) return k; } return Object.keys(weights)[0]; }

  // ---------------------------------------------------------------- levels
  setLevel(bus, v) { this.levels[bus] = v; this._applyLevels(); }
  setMuted(m) { this.muted = m; this._applyLevels(); }
  _applyLevels() {
    if (!this.ctx) return;
    this._ramp(this.master.gain, this.muted ? 0 : this.levels.master, 0.08);
    this._ramp(this.buses.ambience.gain, this.levels.ambience, 0.08);
    this._ramp(this.buses.effects.gain, this.levels.effects, 0.08);
    this._ramp(this.buses.ceremony.gain, this.levels.ceremony, 0.08);
    this._ramp(this.buses.music.gain, this.levels.ceremony * 0.9, 0.08); // "Temple music" slider drives both
  }
  setListener(pos, forward) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) { l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z; l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0); }
  }

  // ---------------------------------------------------------------- continuous beds
  _buildBeds() {
    const ctx = this.ctx, L = this.layers, out = this.outdoor;
    const gainNode = (dest) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(dest); return g; };
    // wind
    { const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
      const g = gainNode(out); const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg).connect(f.frequency);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.04; lfo2.connect(lg2).connect(g.gain);
      s.connect(f).connect(g); s.start(); lfo.start(); lfo2.start(); L.wind = g; }
    // fountain in the courtyard
    { const s = this._noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 6; pk.Q.value = 0.8;
      const trem = ctx.createGain(); trem.gain.value = 0.8; const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 3.3; const lg = ctx.createGain(); lg.gain.value = 0.15; lfo.connect(lg).connect(trem.gain);
      const g = ctx.createGain(); g.gain.value = 0; const p = this._panner({ x: 0, y: 1, z: 0 }); p.refDistance = 2.5; p.rolloffFactor = 1.6;
      s.connect(hp).connect(pk).connect(trem).connect(g).connect(p).connect(out); s.start(); lfo.start(); L.fountain = g; }
    // distant waterfalls: a low roar from the mountains to the north
    { const s = this._noiseSource(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60;
      const g = gainNode(out); const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      s.connect(lp).connect(hp).connect(g); g.disconnect(); g.connect(p).connect(out); s.start(); L.falls = g; }
    // cicadas (afternoon heat)
    { const s = this._noiseSource(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5600; bp.Q.value = 5;
      const am = ctx.createGain(); am.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 62; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      const swell = ctx.createGain(); swell.gain.value = 0.6; const sl = ctx.createOscillator(); sl.frequency.value = 0.09; const sg = ctx.createGain(); sg.gain.value = 0.4; sl.connect(sg).connect(swell.gain);
      const g = gainNode(out); s.connect(bp).connect(am).connect(swell).connect(g); s.start(); lfo.start(); sl.start(); L.cicadas = g; }
    // crickets (night): three voices with their own chirp rhythm
    { const g = gainNode(out); L.crickets = g;
      [[4650, 2.3, -0.6], [4920, 1.7, 0.5], [5230, 2.9, 0.1]].forEach(([f, rate, pan]) => {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const pulse = ctx.createGain(); pulse.gain.value = 0; const p1 = ctx.createOscillator(); p1.type = 'square'; p1.frequency.value = 28; const p1g = ctx.createGain(); p1g.gain.value = 0.5; p1.connect(p1g).connect(pulse.gain);
        const chirp = ctx.createGain(); chirp.gain.value = 0; const c1 = ctx.createOscillator(); c1.type = 'square'; c1.frequency.value = rate; const c1g = ctx.createGain(); c1g.gain.value = 0.5; c1.connect(c1g).connect(chirp.gain);
        const pp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (pp.pan) pp.pan.value = pan;
        const lvl = ctx.createGain(); lvl.gain.value = 0.03;
        o.connect(pulse).connect(chirp).connect(lvl).connect(pp).connect(g); o.start(); p1.start(); c1.start();
      }); }
    // hall: a hummed "Om" choir and a low drone for the Shiva shrine
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.buses.music); this._send(g, { hall: 0.6 }); L.chant = g; this._buildChant(g); }
    { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.buses.music); this._send(g, { hall: 0.5 }); L.shivaDrone = g;
      for (const [f, a] of [[SA / 2, 0.5], [SA * 0.75, 0.3], [SA, 0.18]]) { const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a * 0.25;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.05; const lg = ctx.createGain(); lg.gain.value = a * 0.08; lfo.connect(lg).connect(og.gain); o.connect(og).connect(g); o.start(); lfo.start(); } }
    // one-shot destinations
    L.birds = gainNode(out); L.bells = gainNode(out); this._send(L.bells, { stone: 0.5, hall: 0.25 }); L.cows = gainNode(out); L.night = gainNode(out); L.recorded = gainNode(out);
  }

  _buildChant(dest) {
    const ctx = this.ctx;
    const voice = ctx.createGain(); voice.gain.value = 0;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 450; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 800; f2.Q.value = 8;
    const mix = ctx.createGain(); mix.gain.value = 1.4;
    for (const [freq, det] of [[SA * 0.8, -6], [SA * 0.8, 5], [SA * 1.2, 3], [SA * 0.4, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = freq < 80 ? 0.25 : 0.18; o.connect(og); og.connect(f1); og.connect(f2); o.start();
    }
    f1.connect(mix); f2.connect(mix); mix.connect(voice).connect(dest);
    const breathe = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime, dur = 7.5, v = voice.gain;
      v.cancelScheduledValues(t); v.setValueAtTime(v.value, t); v.linearRampToValueAtTime(0.45, t + 1.2); v.setValueAtTime(0.45, t + dur - 1.6); v.linearRampToValueAtTime(0.0, t + dur);
      f1.frequency.setValueAtTime(520, t); f1.frequency.linearRampToValueAtTime(430, t + dur * 0.45); f1.frequency.linearRampToValueAtTime(260, t + dur * 0.62);
      f2.frequency.setValueAtTime(880, t); f2.frequency.linearRampToValueAtTime(760, t + dur * 0.45); f2.frequency.linearRampToValueAtTime(320, t + dur * 0.62);
      this._timers.push(setTimeout(breathe, (dur + 1.2) * 1000));
    };
    breathe();
  }

  // ---------------------------------------------------------------- plucked strings (Karplus-Strong, rendered offline)
  _ks(freq, dur, { stretch = 0.3, t60 = 6, pick = 0.13, buzz = 0.6, sweep = [2600, 900] } = {}) {
    const sr = this.ctx.sampleRate, N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * dur);
    const loop = new Float32Array(N), P = Math.max(1, Math.floor(N * pick));
    for (let i = 0; i < N; i++) loop[i] = Math.random() * 2 - 1;
    for (let i = N - 1; i >= P; i--) loop[i] -= loop[i - P];          // pluck position comb
    const g = Math.pow(Math.pow(10, -3 / t60), 1 / freq);              // loop gain for the wanted T60
    const out = new Float32Array(len); let idx = 0;
    for (let i = 0; i < len; i++) { const a = loop[idx], b = loop[(idx + 1) % N]; loop[idx] = g * ((1 - stretch) * a + stretch * b); out[i] = a; idx = (idx + 1) % N; }
    // jawari: rectified buzz plus a resonance sweeping downward, the bridge "zing" of tanpura and sitar
    let hpPrev = 0, hpOut = 0, b1 = 0, b2 = 0, y1 = 0, y2 = 0, peak = 0;
    const res = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const x = out[i], r = Math.abs(x); hpOut = 0.995 * (hpOut + r - hpPrev); hpPrev = r;
      const k = buzz * (0.35 + 0.65 * Math.exp(-i / (sr * 1.4)));
      const v = x + k * hpOut;
      if ((i & 63) === 0) { const f = sweep[1] + (sweep[0] - sweep[1]) * Math.exp(-i / (sr * 0.9)); const w = 2 * Math.PI * f / sr, q = 4, al = Math.sin(w) / (2 * q); const a0 = 1 + al; this._bq = [al / a0, 0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; }
      const [c0, c1, c2, d1, d2] = this._bq; const y = c0 * v + c1 * b1 + c2 * b2 - d1 * y1 - d2 * y2; b2 = b1; b1 = v; y2 = y1; y1 = y;
      res[i] = v * 0.7 + y * 1.6; peak = Math.max(peak, Math.abs(res[i]));
    }
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) { res[i] /= peak || 1; if (i > len - fade) res[i] *= (len - i) / fade; }
    return res;
  }
  _buildMusic() {
    const ctx = this.ctx, sr = ctx.sampleRate, L = this.layers;
    L.tanpura = ctx.createGain(); L.tanpura.gain.value = 0; L.tanpura.connect(this.buses.music); this._send(L.tanpura, { hall: 0.35, stone: 0.15 });
    L.melody = ctx.createGain(); L.melody.gain.value = 0; L.melody.connect(this.buses.music); this._send(L.melody, { hall: 0.45, stone: 0.3 });
    L.tabla = ctx.createGain(); L.tabla.gain.value = 0; L.tabla.connect(this.buses.music); this._send(L.tabla, { hall: 0.3, stone: 0.2 });
    // tanpura cycle Pa - Sa' - Sa' - Sa, mixed into a seamless stereo loop
    const cycle = 6.4, len = Math.floor(sr * cycle);
    const buf = ctx.createBuffer(2, len, sr), Lc = buf.getChannelData(0), Rc = buf.getChannelData(1);
    const strings = [[SA * st(-5), 0.0, -0.3], [SA, 1.35, 0.15], [SA, 2.7, 0.3], [SA / 2, 4.05, -0.1]];
    for (const [f, at, pan] of strings) {
      const s = this._ks(f, cycle, { stretch: 0.12, t60: 7, pick: 0.11, buzz: 0.9, sweep: [3200, 1000] });
      const off = Math.floor(at * sr), gl = 0.22 * (1 - pan) , gr = 0.22 * (1 + pan);
      for (let i = 0; i < s.length; i++) { const j = (off + i) % len; Lc[j] += s[i] * gl; Rc[j] += s[i] * gr; }
    }
    this.tanpuraBuf = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(L.tanpura); src.start();
    // sitar pluck (one string, re-pitched per note)
    this.sitarBuf = (() => { const s = this._ks(MEL, 3.2, { stretch: 0.25, t60: 2.4, pick: 0.08, buzz: 1.2, sweep: [3800, 1300] }); const b = ctx.createBuffer(1, s.length, sr); b.copyToChannel(s, 0); return b; })();
  }

  // ---------------------------------------------------------------- melody voices
  _bansuri(phrase, t0, beat, dest, octave = 1) {
    const ctx = this.ctx;
    let t = t0; const notes = phrase.map(([s, b, o]) => { const n = { f: MEL * octave * st(s), t, d: b * beat, o }; t += b * beat; return n; });
    const end = t + 0.8;
    const o = ctx.createOscillator(); o.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'sine'; const g2 = ctx.createGain(); g2.gain.value = 0.14;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; const g3 = ctx.createGain(); g3.gain.value = 0.05;
    const amp = ctx.createGain(); amp.gain.setValueAtTime(0.0001, t0);
    const br = this._noiseSource(); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 2.5; const bg = ctx.createGain(); bg.gain.value = 0.11;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.1; const vg = ctx.createGain(); vg.gain.value = 0; vib.connect(vg);
    notes.forEach((n, i) => {
      const glide = n.o === 'm' ? 0.14 : 0.035;
      for (const [osc, mul] of [[o, 1], [o2, 2], [o3, 3]]) { if (i === 0) osc.frequency.setValueAtTime(n.f * mul * 0.985, n.t); osc.frequency.setTargetAtTime(n.f * mul, n.t, glide); }
      bf.frequency.setTargetAtTime(n.f * 2, n.t, 0.05);
      // tonguing: a small dip at each note start, a swell on long notes
      if (i === 0) amp.gain.linearRampToValueAtTime(0.13, n.t + 0.14);
      else { amp.gain.setTargetAtTime(0.09, n.t - 0.03, 0.015); amp.gain.setTargetAtTime(0.13, n.t + 0.02, 0.04); }
      if (n.d > 0.9) amp.gain.setTargetAtTime(0.15, n.t + n.d * 0.4, 0.3);
      vg.gain.setTargetAtTime(0, n.t, 0.05); vg.gain.setTargetAtTime(n.d > 0.8 ? n.f * 0.012 : 0, n.t + Math.min(0.5, n.d * 0.5), 0.2);
      if (n.o === 'a') { const a = ctx.createOscillator(); a.frequency.value = 1.6; const ag = ctx.createGain(); ag.gain.value = n.f * 0.012; a.connect(ag).connect(o.frequency); a.start(n.t); a.stop(n.t + n.d); }
    });
    amp.gain.setTargetAtTime(0.0001, t, 0.25);
    vg.connect(o.frequency);
    o.connect(amp); o2.connect(g2).connect(amp); o3.connect(g3).connect(amp); br.connect(bf).connect(bg).connect(amp); amp.connect(dest);
    for (const n of [o, o2, o3, br, vib]) { n.start(t0); n.stop(end); }
    return t;
  }
  _sitar(phrase, t0, beat, dest) {
    const ctx = this.ctx; let t = t0, src = null, prev = null;
    const bus = ctx.createGain(); bus.gain.value = 0.22; bus.connect(dest);
    for (const [s, b, o] of phrase) {
      const rate = st(s);
      if (o === 'm' && src) { src.playbackRate.setValueAtTime(prev, t); src.playbackRate.linearRampToValueAtTime(rate, t + Math.min(0.35, b * beat * 0.5)); }
      else {
        src = ctx.createBufferSource(); src.buffer = this.sitarBuf; src.playbackRate.value = rate;
        const g = ctx.createGain(); g.gain.value = 0.9 + Math.random() * 0.2; src.connect(g).connect(bus); src.start(t); src.stop(t + 3.3);
        if (Math.random() < 0.35) { const c = ctx.createBufferSource(); c.buffer = this.sitarBuf; c.playbackRate.value = 2; const cg = ctx.createGain(); cg.gain.value = 0.18; c.connect(cg).connect(bus); c.start(t + b * beat * 0.5); } // chikari
      }
      prev = rate; t += b * beat;
    }
    return t;
  }
  // tabla strokes: dayan (treble, tuned to Sa) and bayan (bass, with a pitch bend)
  _tabla(bol, t, dest, gain = 1) {
    const ctx = this.ctx;
    const dayan = (ring, bright) => {
      const g = ctx.createGain(); g.connect(dest);
      for (const [m, a, d] of [[1, 1, ring], [2, 0.5, ring * 0.7], [3, 0.35 * bright, ring * 0.5], [4, 0.22 * bright, ring * 0.35], [5.2, 0.12 * bright, 0.08]]) {
        const og = ctx.createGain(); this._env(og, t, 0.002, a * 0.14 * gain, d); this._osc('sine', MEL * m, t, t + d + 0.05, og).connect(og); og.connect(g);
      }
      const n = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; const ng = ctx.createGain(); this._env(ng, t, 0.001, 0.12 * gain, 0.03); n.connect(f).connect(ng).connect(g); n.start(t); n.stop(t + 0.06);
    };
    const bayan = (ring) => {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(102, t + 0.25);
      const g = ctx.createGain(); this._env(g, t, 0.004, 0.38 * gain, ring); o.connect(g).connect(dest); o.start(t); o.stop(t + ring + 0.1);
    };
    const slap = (f) => { const n = this._noiseSource(); const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = f; lp.Q.value = 1.2; const g = ctx.createGain(); this._env(g, t, 0.001, 0.2 * gain, 0.05); n.connect(lp).connect(g).connect(dest); n.start(t); n.stop(t + 0.08); };
    if (bol === 'na') dayan(0.55, 1); else if (bol === 'tin') dayan(0.3, 0.4); else if (bol === 'ti') slap(2600);
    else if (bol === 'ge') bayan(0.6); else if (bol === 'ke') slap(500);
    else if (bol === 'dha') { dayan(0.55, 1); bayan(0.6); } else if (bol === 'dhin') { dayan(0.3, 0.4); bayan(0.6); }
  }
  _theka(t0, cycles, matra, dest, gain = 0.7) {
    const keherwa = ['dha', 'ge', 'na', 'ti', 'na', 'ke', 'dhin', 'na'];
    for (let c = 0; c < cycles; c++) keherwa.forEach((b, i) => this._tabla(b, t0 + (c * 8 + i) * matra, dest, gain * (i === 0 ? 1.15 : 1)));
    return t0 + cycles * 8 * matra;
  }

  // ---------------------------------------------------------------- birds and other calls
  _call(kind, pos) {
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    const p = this._panner(pos || this._around(24, 7)); p.refDistance = 7; p.rolloffFactor = 0.8;
    const dest = kind === 'owl' || kind === 'frog' ? this.layers.night : kind === 'cow' ? this.layers.cows : this.layers.birds; p.connect(dest);
    const tone = (f0, f1, s, d, a = 0.1, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + d); const g = ctx.createGain(); this._env(g, s, Math.min(0.02, d * 0.2), a, d); o.connect(g).connect(p); o.start(s); o.stop(s + d + 0.05); return o; };
    const r = Math.random;
    switch (kind) {
      case 'koel': { // "ku-OO", rising with each repeat
        const n = 3 + Math.floor(r() * 4), base = 620 + r() * 80;
        for (let i = 0; i < n; i++) { const s = t + i * 0.95, k = 1 + i * 0.045; tone(base * k, base * k, s, 0.14, 0.09); tone(base * 1.3 * k, base * 1.55 * k, s + 0.2, 0.38, 0.12); }
        break; }
      case 'bulbul': { let s = t; const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) { const f = 1500 + r() * 1400, d = 0.08 + r() * 0.12; tone(f, f * (0.8 + r() * 0.5), s, d, 0.07); s += d + 0.03; } break; }
      case 'sparrow': { const n = 4 + Math.floor(r() * 8), f = 3800 + r() * 1200; for (let i = 0; i < n; i++) tone(f * (1 + r() * 0.1), f * 0.75, t + i * (0.09 + r() * 0.05), 0.035, 0.05); break; }
      case 'myna': { let s = t; for (let i = 0; i < 5 + Math.floor(r() * 6); i++) { const k = r(); if (k < 0.4) tone(900 + r() * 1800, 600 + r() * 2400, s, 0.07, 0.06, 'triangle'); else if (k < 0.7) { const n = this._noiseSource(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 3; const g = ctx.createGain(); this._env(g, s, 0.002, 0.08, 0.04); n.connect(bp).connect(g).connect(p); n.start(s); n.stop(s + 0.06); } else tone(2200, 3200, s, 0.12, 0.05); s += 0.08 + r() * 0.12; } break; }
      case 'crow': { for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { const s = t + i * 0.42; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, s); o.frequency.linearRampToValueAtTime(440, s + 0.28);
          const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1250; f1.Q.value = 2.2; const g = ctx.createGain(); this._env(g, s, 0.03, 0.12, 0.3); o.connect(f1).connect(g).connect(p); o.start(s); o.stop(s + 0.4); } break; }
      case 'barbet': { const n = 10 + Math.floor(r() * 14); for (let i = 0; i < n; i++) tone(690, 640, t + i * 0.38, 0.07, 0.07); break; }
      case 'parakeet': { for (let i = 0; i < 3 + Math.floor(r() * 4); i++) { const s = t + i * 0.16; const o = tone(2600 + r() * 600, 3400, s, 0.1, 0.04, 'sawtooth'); const fm = ctx.createOscillator(); fm.frequency.value = 70; const fg = ctx.createGain(); fg.gain.value = 400; fm.connect(fg).connect(o.frequency); fm.start(s); fm.stop(s + 0.12); } break; }
      case 'peacock': { for (let i = 0; i < 2 + Math.floor(r() * 2); i++) { const s = t + i * 1.1;
          for (const [f0, f1, off, d] of [[560, 600, 0, 0.18], [980, 720, 0.24, 0.55]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, s + off); o.frequency.linearRampToValueAtTime(f1, s + off + d);
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.5; const g = ctx.createGain(); this._env(g, s + off, 0.04, 0.16, d); o.connect(bp).connect(g).connect(p); o.start(s + off); o.stop(s + off + d + 0.1); } } break; }
      case 'dove': { [[0, 0.28], [0.45, 0.2], [0.75, 0.42]].forEach(([o, d]) => tone(420, 360, t + o, d, 0.07)); break; }
      case 'owl': { [[0, 0.5], [0.9, 0.3], [1.3, 0.7]].forEach(([o, d]) => tone(370, 330, t + o, d, 0.09)); break; }
      case 'frog': { for (let i = 0; i < 3 + Math.floor(r() * 5); i++) { const s = t + i * 0.32; const n = this._noiseSource(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650 + r() * 250; bp.Q.value = 8;
          const am = ctx.createGain(); am.gain.value = 0; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
          const g = ctx.createGain(); this._env(g, s, 0.02, 0.5, 0.16); n.connect(bp).connect(am).connect(g).connect(p); n.start(s); n.stop(s + 0.2); lfo.start(s); lfo.stop(s + 0.2); } break; }
      case 'cow': { const base = 620 + r() * 120; for (let i = 0; i < 2 + Math.floor(r() * 4); i++) { const s = t + i * (0.35 + r() * 0.4);
          for (const [m, a, d] of [[1, 1, 0.5], [2.32, 0.6, 0.35], [3.7, 0.4, 0.25], [5.1, 0.2, 0.15]]) tone(base * m, base * m * 0.995, s, d, a * 0.05, 'triangle'); } break; }
    }
  }

  _distantBell() {
    const a = Math.random() * Math.PI * 2;
    this.bell({ x: Math.cos(a) * 46, y: 4, z: Math.sin(a) * 46 }, { size: 1.1 + Math.random() * 0.4, gain: 0.12, dest: this.layers.bells, hall: 0, stone: 0 });
  }

  // ---------------------------------------------------------------- scheduling
  _schedule() {
    const every = (fn, delay) => { const tick = () => { if (!this.ctx) return; let next = 4; try { next = fn(); } catch (e) { console.warn(e); } this._timers.push(setTimeout(tick, Math.max(0.2, next) * 1000)); }; this._timers.push(setTimeout(tick, delay * 1000)); };
    const M = () => TOD_MIX[this.tod];
    const outside = () => 1 - this.zone.dome;
    every(() => { const m = M(); if (!this._hasRec('ambience.' + this.tod) && outside() > 0.2 && Math.random() < m.birds) { const k = this._pick(m.species); this._call(k); if (k === 'peacock') return 6; }
      return m.birdRate[0] + Math.random() * (m.birdRate[1] - m.birdRate[0]); }, 1);
    every(() => { const b = M().bells; if (!b || this.ceremony) return 30; if (outside() > 0.5) this._distantBell(); return b[0] + Math.random() * (b[1] - b[0]); }, 25);
    every(() => { const m = M(); if (m.cow && Math.random() < m.cow) this._call('cow', { x: -38 + Math.random() * 10, y: 1, z: -30 + Math.random() * 60 }); return 14 + Math.random() * 18; }, 9);
    every(() => { const m = M(); if (m.frogs && Math.random() < m.frogs) this._call('frog', { x: (Math.random() < 0.5 ? -8.5 : 8.5), y: 0.3, z: 25 + (Math.random() - 0.5) * 8 }); return 3 + Math.random() * 6; }, 5);
    every(() => { this._phrase(); return this._nextPhrase || 8; }, 3);
  }

  _phrase() {
    const m = TOD_MIX[this.tod], ctx = this.ctx; this._nextPhrase = 6 + Math.random() * 6;
    if (!this.synthMelody || this._musicOn() || this.ceremony || m.music === 0) return;
    const raga = RAGAS[this.tod];
    const t0 = ctx.currentTime + 0.1;
    const beat = (m.instrument === 'sitar' ? 0.42 : 0.55) * (0.85 + Math.random() * 0.3);
    // one to three phrases, ending on the tonic or fifth, then rest
    let t = t0; const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const ph = raga.phrases[Math.floor(Math.random() * raga.phrases.length)];
      t = m.instrument === 'sitar' ? this._sitar(ph, t, beat, this.layers.melody) : this._bansuri(ph, t, beat, this.layers.melody, this.tod === 'night' ? 0.5 : 1);
      t += beat * (0.5 + Math.random());
    }
    if (m.tabla && Math.random() < 0.8) this._theka(t0 + beat * 2, Math.max(1, Math.floor((t - t0) / (8 * 0.32))), 0.32, this.layers.tabla, 0.55);
    this._nextPhrase = (t - ctx.currentTime) + 3 + Math.random() * 6;
  }

  // ---------------------------------------------------------------- time of day and zones
  setTimeOfDay(tod) {
    if (!TOD_MIX[tod]) return;
    const changed = tod !== this.tod; this.tod = tod;
    if (!this.ctx) return;
    this.applyZone(this.zone, 2.5);
    if (changed) { this._applyAmbience(); this.playStation(); }
  }

  applyZone(z, tc = 0.9) {
    this.zone = z;
    if (!this.ctx || !this.layers.wind) return;
    const L = this.layers, m = TOD_MIX[this.tod], out = 1 - z.dome, rec = this._hasRec('ambience.' + this.tod);
    const set = (g, v) => this._ramp(g.gain, v, tc);
    set(this.outdoor, 0.4 + out * 0.6);
    this._ramp(this.outdoorLP.frequency, 700 + out * 17000, tc);
    set(L.wind, 0.035 * m.wind * (0.4 + z.entrance + z.garden * 0.6));
    set(L.fountain, 0.05 * z.courtyard * (this.tod === 'night' ? 0.6 : 1));   // a soft trickle, only close to the fountain
    set(L.falls, 0.012 + 0.015 * z.garden);
    set(L.birds, rec ? 0 : 1.6 * (0.45 + z.entrance * 0.5 + z.garden * 0.6));
    set(L.cicadas, rec ? 0 : 0.05 * m.insects);
    set(L.crickets, rec ? 0 : 0.7 * m.crickets);
    set(L.night, 0.4); set(L.cows, 0); set(L.bells, 0.35);
    set(L.recorded, 0.6);   // recorded stream and birds, or crickets: a soft bed under the music
    // music: a quiet bed in the courtyard, fuller by the shrines and inside the halls
    const recMusic = this._musicOn(), music = recMusic ? 0 : m.music;
    const near = Math.max(z.corridor, z.dome);
    // without a recording the music is just a soft tanpura drone, mostly heard by the shrines
    set(L.tanpura, music * (0.04 + near * 0.3) * (this.ceremony ? 0.3 : 1));
    if (this._musicIn) this._ramp(this._musicIn.gain, (0.6 + near * 0.2) * (this.ceremony ? 0.05 : 1), tc);   // the music leads, everywhere
    set(L.melody, music * (0.3 + near * 0.3 + z.krishna * 0.25) * (this.ceremony ? 0 : 1));
    set(L.tabla, music * m.tabla * (0.25 + near * 0.3));
    set(L.chant, recMusic ? 0 : m.chant * 0.3 * z.dome);
    set(L.shivaDrone, (recMusic ? 0.15 : 0.5) * z.shiva * (0.2 + z.dome));
    this._ramp(this.hallReturn.gain, 0.12 + z.dome * 0.7, tc);
    this._ramp(this.stoneReturn.gain, 0.15 + z.corridor * 0.55, tc);
  }

  // ---------------------------------------------------------------- recorded library and music
  // audio/manifest.json lists the recorded loops and the music stations:
  //   { "ambience.morning": "audio/x.mp3", ..., "aarti": "audio/aarti.mp3",
  //     "playlists": { "uplifting": [{ "file": "audio/music/a.mp3", "title": "A", "artist": "B" }], ... } }
  // Ambience and aarti are decoded only when needed (one time of day at a time) so memory stays low;
  // music streams through two <audio> elements that crossfade from one track to the next.
  async loadLibrary(url = 'audio/manifest.json') {
    let m;
    try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) return; m = await r.json(); } catch (e) { return; }
    this.manifest = m;
    this.playlists = {};
    for (const [id, list] of Object.entries(m.playlists || {})) if (Array.isArray(list) && list.length) this.playlists[id] = list.filter(t => t && t.file);
    this._applyAmbience();
    this.playStation(true);
    this.applyZone(this.zone, 1);
    setTimeout(() => this._loadBuffer('aarti'), 20000);   // ready well before the first aarti
  }
  _hasRec(key) { return !!(this.manifest && this.manifest[key]); }
  _loadBuffer(key) {
    if (this.library[key]) return Promise.resolve(this.library[key]);
    const file = this.manifest && this.manifest[key]; if (!file || !this.ctx) return Promise.resolve(null);
    if (!this._loading[key]) this._loading[key] = fetch(file).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(d => this.ctx.decodeAudioData(d)).then(buf => (this.library[key] = buf))
      .catch(() => { console.warn('Audio file could not be loaded:', file); delete this._loading[key]; return null; });
    return this._loading[key];
  }
  async _applyAmbience() {
    if (!this.ctx) return;
    const tod = this.tod, key = 'ambience.' + tod;
    const buf = await this._loadBuffer(key);
    if (tod !== this.tod || !buf || (this._amb && this._amb.key === key)) return;
    const now = this.ctx.currentTime;
    if (this._amb) { const old = this._amb; try { old.gain.gain.setTargetAtTime(0, now, 1.2); old.src.stop(now + 6); } catch (e) {} }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = Math.min(0.06, buf.duration / 4); src.loopEnd = Math.max(src.loopStart + 1, buf.duration - 0.06);   // step over encoder padding so the loop is seamless
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, now, 1.5);
    src.connect(g).connect(this.layers.recorded); src.start(0, Math.random() * buf.duration * 0.5);
    this._amb = { key, src, gain: g };
    // keep only the loop that is playing, so a phone does not hold every time of day in memory
    for (const k of Object.keys(this.library)) if (k.startsWith('ambience.') && k !== key) { delete this.library[k]; delete this._loading[k]; }
  }

  // music stations: 'auto' plays uplifting music by day and meditation music at night
  get stations() { return Object.keys(this.playlists); }
  _station() {
    const s = this.musicStyle;
    if (s === 'off') return null;
    if (s === 'auto' || !this.playlists[s]) return this.tod === 'night' && this.playlists.meditation ? 'meditation' : (this.playlists.uplifting ? 'uplifting' : this.stations[0] || null);
    return s;
  }
  _musicOn() { return !!this._station() && !this.muted; }
  setMusicStyle(style) { this.musicStyle = style; if (this.ctx) { this.playStation(); this.applyZone(this.zone, 1); } }
  skipTrack() { if (this._curStation) this._advance(); }
  _ensureDecks() {
    if (this._decks || !this.ctx) return !!this._decks;
    try {
      this._musicIn = this.ctx.createGain(); this._musicIn.gain.value = 0.6; this._musicIn.connect(this.buses.music); this._send(this._musicIn, { hall: 0.08 });
      this._decks = [0, 1].map(() => {
        const el = new Audio(); el.preload = 'auto'; el.loop = false;
        const g = this.ctx.createGain(); g.gain.value = 0; this.ctx.createMediaElementSource(el).connect(g).connect(this._musicIn);
        const d = { el, g, track: null };
        el.addEventListener('ended', () => { if (this._cur === d) this._advance(); });
        el.addEventListener('error', () => { if (this._cur === d && ++this._errors < 6) setTimeout(() => { if (this._cur === d) this._advance(); }, 800); });
        return d;
      });
      this._errors = 0;
      this._timers.push(setInterval(() => {   // start the next track a few seconds early so the two overlap
        const d = this._cur; if (!d || d.el.paused || !isFinite(d.el.duration)) return;
        if (d.el.duration - d.el.currentTime < 5) this._advance();
      }, 400));
    } catch (e) { console.warn('Music player unavailable', e); this._decks = null; }
    return !!this._decks;
  }
  playStation(force = false) {
    if (!this.ctx) return;
    const st = this._station();
    if (!st) { this._cur = null; this._curStation = null; this._fadeMusic(); this.nowPlaying = null; this.onTrack && this.onTrack(null); return; }
    if (!force && st === this._curStation && this._cur) return;
    if (!this._ensureDecks()) return;
    this._curStation = st; this._advance();
  }
  _nextTrack(st) {
    const list = this.playlists[st]; if (!list || !list.length) return null;
    let q = this._queues[st];
    if (!q || !q.length) {
      q = this._queues[st] = list.map((_, i) => i);
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (q.length > 1 && list[q[q.length - 1]] === this._lastTrack) [q[0], q[q.length - 1]] = [q[q.length - 1], q[0]];   // never the same track twice in a row
    }
    return list[q.pop()];
  }
  _fadeMusic(except) {
    const now = this.ctx.currentTime;
    for (const d of this._decks || []) if (d !== except) {
      d.g.gain.cancelScheduledValues(now); d.g.gain.setValueAtTime(d.g.gain.value, now); d.g.gain.linearRampToValueAtTime(0, now + 4);
      setTimeout(() => { if (this._cur !== d) d.el.pause(); }, 4500);
    }
  }
  _advance() {
    const st = this._curStation, tr = st && this._nextTrack(st); if (!tr || !this._decks) return;
    const now = this.ctx.currentTime, deck = this._decks.find(d => d !== this._cur) || this._decks[0];
    this._fadeMusic(deck);
    deck.track = tr; deck.el.src = tr.file;
    deck.g.gain.cancelScheduledValues(now); deck.g.gain.setValueAtTime(0, now); deck.g.gain.linearRampToValueAtTime(1, now + 3);
    const p = deck.el.play(); if (p && p.then) p.then(() => { this._errors = 0; }).catch(() => {});
    this._cur = deck; this._lastTrack = tr;
    this.nowPlaying = { title: tr.title, artist: tr.artist, station: st };
    this.onTrack && this.onTrack(this.nowPlaying);
  }

  // ---------------------------------------------------------------- one-shots
  bell(pos, { size = 1, gain = 0.6, dest = null, hall = 0.4, stone = 0.15, when = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when, fund = 560 / size;
    const p = pos ? this._panner(pos) : ctx.createGain();
    p.connect(dest || this.buses.effects); this._send(p, { hall, stone });
    const bus = ctx.createGain(); bus.gain.value = gain; bus.connect(p);
    for (const [r, a, dec] of BELL_PARTIALS) for (const det of [-1.2, 1.2]) {
      const o = ctx.createOscillator(); o.frequency.value = fund * r + det * r * 0.6;
      const g = ctx.createGain(); const dd = dec * (0.7 + size * 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.09, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dd);
      o.connect(g).connect(bus); o.start(t); o.stop(t + dd + 0.05);
    }
    const n = this._noiseSource(); const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = fund * 6; hf.Q.value = 1.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hf).connect(ng).connect(bus); n.start(t); n.stop(t + 0.08);
  }
  ghanti(when, gain = 0.25, dest) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const g0 = ctx.createGain(); g0.gain.value = gain; g0.connect(dest || this.buses.effects); this._send(g0, { hall: 0.35 });
    for (const [r, a, d] of [[1, 1, 0.9], [2.76, 0.5, 0.5], [5.4, 0.3, 0.25], [8.9, 0.15, 0.12]]) {
      const o = ctx.createOscillator(); o.frequency.value = 1850 * r * (1 + (Math.random() - 0.5) * 0.004); const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.1, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(g0); o.start(t); o.stop(t + d + 0.02);
    }
  }
  conch(when = 0, dest, level = 0.55) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when, dur = 3.2;
    const out = ctx.createGain(); out.gain.value = level; out.connect(dest || this.buses.ceremony); this._send(out, { hall: 0.7 });
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
    const s = this._noiseSource(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 160; f.Q.value = 0.7;   // bare feet on stone: a soft pad
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035 * intensity, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
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
    [0, 4, 7, 12, 16].forEach((s, i) => { const o = ctx.createOscillator(); o.frequency.value = 1046 * st(s); const g = ctx.createGain(); const tt = t + i * 0.07;
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.03, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.2); o.connect(g).connect(p); o.start(tt); o.stop(tt + 1.3); });
  }
  water(pos) {
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

  // ---------------------------------------------------------------- shared aarti ceremony
  // One instance per prayer hall. In a networked build the hall's server clock supplies `offset`
  // so every visitor hears the same point of one shared track.
  startAarti(duration = 60, offset = 0) {
    if (!this.ctx) return null;
    this.stopAarti();
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05 - offset, at = (s) => t0 + s;
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(this.buses.ceremony); this._send(bus, { hall: 0.55 });
    bus.gain.setValueAtTime(0, Math.max(ctx.currentTime, t0)); bus.gain.linearRampToValueAtTime(1, t0 + 2);
    bus.gain.setValueAtTime(1, t0 + duration - 9); bus.gain.linearRampToValueAtTime(0, t0 + duration - 5);
    this.ceremony = { bus, nodes: [], t0 };
    this.applyZone(this.zone, 1.5);
    if (!this.library.aarti) this._loadBuffer('aarti');
    if (this.library.aarti) {
      const src = ctx.createBufferSource(); src.buffer = this.library.aarti; src.connect(bus); src.start(Math.max(ctx.currentTime, t0), Math.max(0, offset)); this.ceremony.nodes.push(src);
    } else {
      for (const s of [3.5, 7.6]) if (at(s) > ctx.currentTime) this.conch(at(s) - ctx.currentTime, this.buses.ceremony);
      const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(bus); drone.gain.setValueAtTime(0, at(10)); drone.gain.linearRampToValueAtTime(0.5, at(13));
      const src = ctx.createBufferSource(); src.buffer = this.tanpuraBuf; src.loop = true; src.connect(drone); src.start(at(10)); src.stop(at(duration)); this.ceremony.nodes.push(src);
      const matra = 60 / 84 / 2;
      for (let s = 11, i = 0; s < duration - 10; s += matra * 2, i++) { if (at(s) < ctx.currentTime) continue; this.ghanti(at(s) - ctx.currentTime, 0.15, bus); this.ghanti(at(s + matra) - ctx.currentTime, 0.09, bus); }
      this._theka(at(11), Math.floor((duration - 22) / (8 * matra)), matra, bus, 0.8);
      // an original, simple devotional melody in Bilawal on a reedy harmonium voice
      const S = [0, 2, 4, 5, 7, 9, 11, 12, 14], beat = matra * 2;
      const phrase = [[4, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 2], [-1, 1], [2, 1], [3, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 3], [-1, 1],
        [0, 1], [2, 1], [4, 1], [5, 1], [6, 2], [5, 1], [4, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [2, 1], [0, 3], [-1, 1]];
      let s = 13;
      while (s < duration - 12) for (const [deg, len] of phrase) {
        const d = len * beat;
        if (deg >= 0 && at(s) > ctx.currentTime) { this._reed(MEL * st(S[deg]), at(s), d * 0.95, bus); if (len >= 2) this._choir(MEL * st(S[deg]) / 2, at(s), d, bus); }
        s += d; if (s >= duration - 12) break;
      }
      if (at(duration - 7) > ctx.currentTime) this.bell(null, { size: 1.35, gain: 0.8, dest: this.buses.ceremony, hall: 0.8, when: at(duration - 7) - ctx.currentTime });
    }
    return this.ceremony;
  }
  stopAarti() {
    if (!this.ceremony || !this.ctx) return;
    const { bus, nodes } = this.ceremony, t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 1.2);
    for (const n of nodes) { try { n.stop(t + 1.3); } catch (e) {} }
    setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 1500);
    this.ceremony = null; this.applyZone(this.zone, 2);
  }
  _reed(f, t, d, dest) {
    const ctx = this.ctx; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05); g.gain.setValueAtTime(0.05, t + d * 0.8); g.gain.linearRampToValueAtTime(0, t + d + 0.08);
    for (const [m, typ, a, det] of [[1, 'sawtooth', 0.6, -4], [1, 'square', 0.3, 4], [2, 'sawtooth', 0.2, 0]]) { const o = ctx.createOscillator(); o.type = typ; o.frequency.value = f * m; o.detune.value = det; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(lp); o.start(t); o.stop(t + d + 0.1); }
    lp.connect(g).connect(dest);
  }
  _choir(f, t, d, dest) {
    const ctx = this.ctx; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.3); g.gain.linearRampToValueAtTime(0, t + d + 0.4);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 5; const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 7;
    for (const det of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(f1); o.connect(f2); o.start(t); o.stop(t + d + 0.5); }
    f1.connect(g); f2.connect(g); g.connect(dest);
  }
}
