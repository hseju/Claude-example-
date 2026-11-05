import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Procedural miniature devotee. Proportions are slightly stylised (about 6 heads tall) so the
// figures read clearly from the elevated camera without looking like toys.

export const SKIN_TONES = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#a8714a', '#8a5636', '#5f3a24'];
export const HAIR_COLORS = ['#1b1512', '#3a271c', '#5b3a24', '#8a8580', '#d9d6d0'];
export const HAIR_STYLES = [
  { id: 'short', label: 'Short' }, { id: 'wavy', label: 'Wavy' }, { id: 'bun', label: 'Bun' },
  { id: 'braid', label: 'Long braid' }, { id: 'cropped', label: 'Close-cropped' },
];
export const OUTFITS = [
  { id: 'kurta', label: 'Kurta & pajama' }, { id: 'dhoti', label: 'Dhoti & angavastram' },
  { id: 'saree', label: 'Saree' }, { id: 'salwar', label: 'Salwar kameez' },
];
export const CLOTH_COLORS = [
  { id: 'ivory', base: '#efe6d2', accent: '#c9a24b' }, { id: 'saffron', base: '#e98a1f', accent: '#7d1f1a' },
  { id: 'marigold', base: '#f2b631', accent: '#a3311f' }, { id: 'kumkum', base: '#a3242a', accent: '#e2b555' },
  { id: 'peacock', base: '#1f6b73', accent: '#e2b555' }, { id: 'leaf', base: '#4f7a3a', accent: '#f0d27a' },
  { id: 'lotus', base: '#e7a1a8', accent: '#8e2338' }, { id: 'indigo', base: '#2f3d73', accent: '#d9b25c' },
];
export const PRESENTATIONS = [{ id: 'masc', label: 'Masculine' }, { id: 'fem', label: 'Feminine' }, { id: 'neutral', label: 'Neutral' }];

export function defaultConfig() {
  return { name: '', presentation: 'fem', skin: SKIN_TONES[2], hair: 'braid', hairColor: HAIR_COLORS[0], outfit: 'saree', color: 'kumkum' };
}

const NPC_NAMES = ['Asha', 'Ravi', 'Meera', 'Arjun', 'Lakshmi', 'Kiran', 'Devi', 'Suresh', 'Priya', 'Gopal', 'Anand', 'Kavya', 'Vikram', 'Sita', 'Hari', 'Uma', 'Nandini', 'Mohan', 'Radha', 'Shankar', 'Gauri', 'Vasu', 'Indira', 'Prakash'];
export function randomConfig(seed = Math.random()) {
  let s = Math.floor(seed * 1e9) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const presentation = r() < 0.48 ? 'fem' : (r() < 0.92 ? 'masc' : 'neutral');
  const outfit = presentation === 'fem' ? pick(['saree', 'saree', 'salwar']) : pick(['kurta', 'kurta', 'dhoti']);
  const hair = presentation === 'fem' ? pick(['braid', 'bun', 'wavy']) : pick(['short', 'cropped', 'short', 'wavy']);
  const hairColor = r() < 0.15 ? HAIR_COLORS[3 + Math.floor(r() * 2)] : pick(HAIR_COLORS.slice(0, 3));
  return { name: pick(NPC_NAMES), presentation, skin: pick(SKIN_TONES), hair, hairColor, outfit, color: pick(CLOTH_COLORS).id };
}

const matCache = new Map();
function mat(color, rough = 0.8, extra = {}) {
  const k = color + rough + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return matCache.get(k);
}
const G = {
  limb: new THREE.CapsuleGeometry(0.048, 0.3, 3, 8),
  fore: new THREE.CapsuleGeometry(0.042, 0.26, 3, 8),
  leg: new THREE.CapsuleGeometry(0.06, 0.66, 3, 8),
  hand: new THREE.SphereGeometry(0.045, 8, 6),
  head: new THREE.SphereGeometry(0.118, 18, 14),
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8),
  foot: new THREE.BoxGeometry(0.08, 0.05, 0.17),
  eye: new THREE.SphereGeometry(0.012, 6, 4),
  hairCap: new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  bun: new THREE.SphereGeometry(0.065, 10, 8),
  bindi: new THREE.SphereGeometry(0.008, 6, 4),
};

export class Avatar {
  constructor(config, { simulated = false, shadows = true } = {}) {
    this.root = new THREE.Group();
    this.config = { ...config };
    this.simulated = simulated;
    this.state = 'idle'; this.stateTime = 0; this.walkPhase = 0; this.speed = 0;
    this.pose = {}; this.shadows = shadows;
    this.build();
  }

  build() {
    const c = this.config;
    if (this.body) this.root.remove(this.body);
    const cloth = CLOTH_COLORS.find(x => x.id === c.color) || CLOTH_COLORS[0];
    const skin = mat(c.skin, 0.62), base = mat(cloth.base, c.outfit === 'saree' ? 0.5 : 0.78), accent = mat(cloth.accent, 0.45, { metalness: 0.25 });
    const lower = c.outfit === 'kurta' ? mat('#f1ebdf', 0.85) : c.outfit === 'salwar' ? mat(new THREE.Color(cloth.base).lerp(new THREE.Color('#ffffff'), 0.45).getStyle(), 0.8) : skin;
    const hairM = mat(c.hairColor, 0.55);
    const fem = c.presentation === 'fem', masc = c.presentation === 'masc';
    const sh = masc ? 0.2 : fem ? 0.17 : 0.185;

    const body = new THREE.Group(); body.position.y = 0.86; this.body = body; this.root.add(body);
    const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = this.shadows; parent.add(o); return o; };

    // legs
    this.legs = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(0.085 * s, 0, 0); body.add(p);
      add(p, G.leg, lower, 0, -0.4, 0);
      add(p, G.foot, mat('#5a3a26', 0.7), 0, -0.82, 0.03);
      return p;
    });
    // torso
    const torsoTop = c.outfit === 'dhoti' ? skin : base;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(sh * 0.82, fem ? 0.12 : 0.135, 0.54, 14), torsoTop);
    torso.position.y = 0.27; torso.castShadow = this.shadows; body.add(torso);
    if (fem) { const chest = add(body, new THREE.SphereGeometry(0.13, 12, 8), torsoTop, 0, 0.36, 0.035); chest.scale.set(1.05, 0.6, 0.72); }
    // garments
    if (c.outfit === 'kurta' || c.outfit === 'salwar') {
      const len = c.outfit === 'salwar' ? 0.6 : 0.5;
      const k = add(body, new THREE.CylinderGeometry(0.15, c.outfit === 'salwar' ? 0.24 : 0.2, len, 16, 1, true), base, 0, 0.02 - len / 2 + 0.06, 0);
      k.material = base.clone(); k.material.side = THREE.DoubleSide;
      add(body, new THREE.TorusGeometry(c.outfit === 'salwar' ? 0.24 : 0.2, 0.012, 6, 24), accent, 0, 0.08 - len + 0.0, 0).rotation.x = Math.PI / 2;
      add(body, new THREE.BoxGeometry(0.02, 0.2, 0.01), accent, 0, 0.42, sh * 0.82 - 0.005);
      if (c.outfit === 'salwar') { // dupatta over both shoulders
        const d = add(body, new THREE.TorusGeometry(0.19, 0.03, 6, 20, Math.PI), accent, 0, 0.5, 0.02); d.rotation.set(0.25, 0, Math.PI); d.scale.set(1, 1.2, 0.8);
      }
    }
    if (c.outfit === 'dhoti') {
      const d = add(body, new THREE.CylinderGeometry(0.15, 0.2, 0.62, 16, 1, true), base, 0, -0.22, 0); d.material = base.clone(); d.material.side = THREE.DoubleSide;
      add(body, new THREE.TorusGeometry(0.2, 0.012, 6, 24), accent, 0, -0.53, 0).rotation.x = Math.PI / 2;
      add(body, new THREE.TorusGeometry(0.152, 0.025, 6, 20), base, 0, 0.04, 0).rotation.x = Math.PI / 2;
      // angavastram across the chest
      const a = add(body, new THREE.TorusGeometry(0.2, 0.026, 6, 24), accent, 0, 0.3, 0); a.rotation.set(Math.PI / 2, 0.7, 0); a.scale.set(0.82, 0.62, 1);
    }
    if (c.outfit === 'saree') {
      const s = add(body, new THREE.CylinderGeometry(0.14, 0.27, 0.86, 18, 1, true), base, 0, -0.38, 0); s.material = base.clone(); s.material.side = THREE.DoubleSide;
      add(body, new THREE.TorusGeometry(0.27, 0.016, 6, 28), accent, 0, -0.8, 0).rotation.x = Math.PI / 2;
      add(body, new THREE.TorusGeometry(0.142, 0.03, 6, 20), base, 0, 0.06, 0).rotation.x = Math.PI / 2;
      // pallu: diagonal across the torso and over the left shoulder, falling behind
      const p = add(body, new THREE.TorusGeometry(0.19, 0.04, 6, 24), base, 0, 0.27, 0); p.rotation.set(Math.PI / 2, -0.75, 0); p.scale.set(0.82, 0.66, 1);
      const back = add(body, new THREE.BoxGeometry(0.17, 0.62, 0.025), base, 0.07, 0.2, -0.13); back.rotation.x = 0.12;
      add(body, new THREE.BoxGeometry(0.17, 0.03, 0.03), accent, 0.07, -0.1, -0.165);
    }
    // arms
    const sleeve = c.outfit === 'dhoti' ? skin : base;
    const sleeveLong = c.outfit === 'kurta' || c.outfit === 'salwar';
    this.arms = [-1, 1].map(s => {
      const sp = new THREE.Group(); sp.position.set((sh + 0.015) * s, 0.5, 0); body.add(sp);
      add(sp, G.limb, sleeve, 0, -0.17, 0);
      const el = new THREE.Group(); el.position.y = -0.34; sp.add(el);
      add(el, G.fore, sleeveLong ? base : skin, 0, -0.15, 0);
      add(el, G.hand, skin, 0, -0.32, 0);
      if (!masc) add(el, new THREE.TorusGeometry(0.044, 0.009, 5, 14), mat('#d9a93c', 0.3, { metalness: 0.8 }), 0, -0.25, 0).rotation.x = Math.PI / 2;
      return { shoulder: sp, elbow: el, side: s };
    });
    // head
    const headG = new THREE.Group(); headG.position.y = 0.62; body.add(headG); this.head = headG;
    add(headG, G.neck, skin, 0, -0.03, 0);
    const h = add(headG, G.head, skin, 0, 0.11, 0); h.scale.set(0.95, 1.05, 1);
    for (const s of [-1, 1]) add(headG, G.eye, mat('#1a1210', 0.4), 0.04 * s, 0.125, 0.104);
    add(headG, G.bindi, mat(fem ? '#b3121b' : '#c9241c', 0.5), 0, 0.17, 0.112);
    // hair
    if (c.hair !== 'cropped') { const cap = add(headG, G.hairCap, hairM, 0, 0.125, -0.006); cap.rotation.x = -0.25; cap.scale.set(1, 1.02, 1.04); }
    else { const cap = add(headG, G.hairCap, hairM, 0, 0.13, -0.004); cap.scale.set(0.98, 0.85, 1.0); cap.rotation.x = -0.15; }
    if (c.hair === 'bun') add(headG, G.bun, hairM, 0, 0.13, -0.12);
    if (c.hair === 'wavy') { const w = add(headG, new THREE.SphereGeometry(0.12, 12, 10), hairM, 0, 0.06, -0.05); w.scale.set(1.1, 1.0, 0.8); }
    if (c.hair === 'braid') { for (let i = 0; i < 6; i++) add(headG, new THREE.SphereGeometry(0.036 - i * 0.003, 8, 6), hairM, 0, 0.06 - i * 0.065, -0.13 - Math.min(i, 2) * 0.012);
      if (fem) add(headG, new THREE.SphereGeometry(0.03, 8, 6), mat('#ffffff', 0.7), 0, 0.12, -0.15); } // jasmine gajra
    if (fem && c.outfit !== 'dhoti') { /* subtle earrings */ for (const s of [-1, 1]) add(headG, new THREE.SphereGeometry(0.012, 6, 4), mat('#e2b555', 0.3, { metalness: 0.9 }), 0.112 * s, 0.07, 0); }
    // tilak for dhoti look
    if (c.outfit === 'dhoti') add(headG, new THREE.BoxGeometry(0.03, 0.006, 0.004), mat('#f3efe6', 0.8), 0, 0.185, 0.108);
    this.root.traverse(o => { if (o.isMesh) o.userData.avatar = this; });
  }

  setConfig(c) { this.config = { ...c }; this.build(); }
  setState(s) { if (this.state !== s) { this.state = s; this.stateTime = 0; } }

  // targets: shoulders [x,z], elbow x, body lean, head tilt
  _targets(t) {
    const s = this.state, T = { sx: [0, 0], sz: [-0.08, 0.08], ex: [-0.12, -0.12], ez: [0, 0], lean: 0, head: 0, legs: [0, 0], bob: 0 };
    if (s === 'walk') {
      const p = this.walkPhase, a = Math.min(1, this.speed / 2.2);
      T.legs = [Math.sin(p) * 0.55 * a, -Math.sin(p) * 0.55 * a];
      T.sx = [-Math.sin(p) * 0.45 * a, Math.sin(p) * 0.45 * a];
      T.ex = [-0.25 - Math.max(0, -Math.sin(p)) * 0.3, -0.25 - Math.max(0, Math.sin(p)) * 0.3];
      T.bob = Math.abs(Math.cos(p)) * 0.025 * a; T.lean = 0.05 * a;
    } else if (s === 'namaste' || s === 'bow' || s === 'aarti') {
      // joined palms at the chest (anjali mudra)
      T.sx = [-0.42, -0.42]; T.sz = [0.36, -0.36]; T.ex = [-1.9, -1.9]; T.ez = [0.6, -0.6];
      if (s === 'bow') { const k = Math.sin(Math.min(1, this.stateTime / 2.4) * Math.PI); T.lean = 0.42 * k; T.head = 0.3 * k; }
      if (s === 'aarti') { T.lean = 0.04 + Math.sin(t * 1.6 + this.root.position.x) * 0.03; T.head = 0.08; }
    } else if (s === 'offer') {
      const k = Math.sin(Math.min(1, this.stateTime / 1.6) * Math.PI);
      T.sx = [-1.15 * k - 0.1, -1.15 * k - 0.1]; T.sz = [0.2, -0.2]; T.ex = [-0.35, -0.35]; T.lean = 0.12 * k; T.head = 0.15 * k;
    } else if (s === 'ring') {
      const k = Math.min(1, this.stateTime / 0.35), pull = Math.sin(this.stateTime * 9) * 0.15;
      T.sx = [-2.7 * k + pull, -0.1]; T.sz = [-0.15, 0.08]; T.ex = [-0.25, -0.12]; T.head = -0.2 * k;
    } else if (s === 'aartiPriest') {
      // right hand circles a lamp; driven by external `lampAngle`
      const a = this.lampAngle || 0;
      T.sx = [-1.25 + Math.sin(a) * 0.35, -0.9]; T.sz = [0.1 + Math.cos(a) * 0.3, -0.3]; T.ex = [-0.6, -1.4]; T.ez = [0, -0.5]; // left hand holds a small bell
    } else {
      T.sx = [Math.sin(t * 0.8 + this.root.position.x) * 0.03, -Math.sin(t * 0.8) * 0.03];
      T.bob = Math.sin(t * 1.4 + this.root.position.z) * 0.004;
    }
    return T;
  }

  update(dt, t) {
    this.stateTime += dt;
    if (this.state === 'walk') this.walkPhase += dt * (4 + this.speed * 2.6);
    const T = this._targets(t), k = 1 - Math.exp(-dt * 12);
    const L = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    this.arms.forEach((a, i) => {
      L(a.shoulder.rotation, 'x', T.sx[i]); L(a.shoulder.rotation, 'z', T.sz[i]);
      L(a.elbow.rotation, 'x', T.ex[i]); L(a.elbow.rotation, 'z', T.ez[i]);
    });
    this.legs.forEach((l, i) => L(l.rotation, 'x', T.legs[i]));
    L(this.body.rotation, 'x', T.lean); L(this.head.rotation, 'x', T.head);
    this.body.position.y += (0.86 + T.bob - this.body.position.y) * k;
  }

  handWorld(side = 1) { // side: 1 right(-x), -1 left
    const arm = this.arms[side === 1 ? 0 : 1];
    const v = new THREE.Vector3(0, -0.32, 0); arm.elbow.localToWorld(v); return v;
  }
  chestWorld() { const v = new THREE.Vector3(0, 0.4, 0.15); this.body.localToWorld(v); return v; }
}
