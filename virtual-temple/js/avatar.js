import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Devotees: rigged, detailed characters built in code.
//
// Each devotee is one SkinnedMesh on an 18-bone skeleton (hips, spine, chest, neck, head, arms
// with elbows and wrists, legs with knees and ankles), drawn in 2-4 draw calls. The body has
// sculpted proportions per presentation, build and age; the face has eyes with irises and
// catchlights, lids, brows, nose, lips and ears; hands have fingers; feet are bare as in a temple.
// Clothing is draped from real garment parts: saree with front pleats, zari border and a pallu
// over the shoulder; kurta with collar, placket and churidar; dhoti with pleats, angavastram and
// sacred thread; salwar kameez with dupatta. Jewellery, forehead marks, facial hair, glasses,
// puja thalis and walking sticks add individuality.

export const SKIN_TONES = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#a8714a', '#8a5636', '#5f3a24'];
export const HAIR_COLORS = ['#1b1512', '#3a271c', '#5b3a24', '#8a8580', '#e2ded6'];
export const HAIR_STYLES = [
  { id: 'short', label: 'Short' }, { id: 'wavy', label: 'Wavy' }, { id: 'bun', label: 'Bun' },
  { id: 'braid', label: 'Long braid' }, { id: 'ponytail', label: 'Ponytail' }, { id: 'open', label: 'Long, open' },
  { id: 'curly', label: 'Curly' }, { id: 'topknot', label: 'Top knot' }, { id: 'cropped', label: 'Shikha' }, { id: 'bald', label: 'Receding' },
];
export const HEADWEAR = [{ id: 'none', label: 'Bare head' }, { id: 'turban', label: 'Safa turban' }, { id: 'topi', label: 'Gandhi topi' }];
export const OUTFITS = [
  { id: 'kurta', label: 'Kurta & churidar' }, { id: 'dhoti', label: 'Dhoti & angavastram' },
  { id: 'saree', label: 'Saree' }, { id: 'salwar', label: 'Salwar kameez' },
];
export const CLOTH_COLORS = [
  { id: 'ivory', base: '#efe6d2', accent: '#c9a24b' }, { id: 'saffron', base: '#e98a1f', accent: '#7d1f1a' },
  { id: 'marigold', base: '#f2b631', accent: '#a3311f' }, { id: 'kumkum', base: '#a3242a', accent: '#e2b555' },
  { id: 'peacock', base: '#1f6b73', accent: '#e2b555' }, { id: 'leaf', base: '#4f7a3a', accent: '#f0d27a' },
  { id: 'lotus', base: '#e7a1a8', accent: '#8e2338' }, { id: 'indigo', base: '#2f3d73', accent: '#d9b25c' },
];
export const PRESENTATIONS = [{ id: 'masc', label: 'Male' }, { id: 'fem', label: 'Female' }];
// older saved profiles may say 'neutral'; read them by their attire
const normalise = (c) => (c.presentation === 'fem' || c.presentation === 'masc' ? c : { ...c, presentation: c.outfit === 'saree' || c.outfit === 'salwar' ? 'fem' : 'masc' });
export const BUILDS = [{ id: 'slim', label: 'Slim' }, { id: 'average', label: 'Average' }, { id: 'broad', label: 'Broad' }];
export const AGES = [{ id: 'adult', label: 'Adult' }, { id: 'elder', label: 'Elder' }];
export const FACIAL = [{ id: 'none', label: 'Clean-shaven' }, { id: 'moustache', label: 'Moustache' }, { id: 'beard', label: 'Beard' }];
export const MARKS = [{ id: 'bindi', label: 'Bindi' }, { id: 'tilak', label: 'Tilak' }, { id: 'tripundra', label: 'Tripundra' }, { id: 'none', label: 'None' }];
export const JEWELLERY = [{ id: 'simple', label: 'Simple' }, { id: 'festive', label: 'Festive' }];

const DEFAULTS = { name: '', presentation: 'fem', build: 'average', age: 'adult', skin: SKIN_TONES[2], hair: 'braid', hairColor: HAIR_COLORS[0], outfit: 'saree', color: 'kumkum', facial: 'none', mark: 'bindi', jewellery: 'simple', glasses: false, carry: 'none', headwear: 'none' };
export function defaultConfig() { return { ...DEFAULTS }; }

const NPC_NAMES = ['Asha', 'Ravi', 'Meera', 'Arjun', 'Lakshmi', 'Kiran', 'Devi', 'Suresh', 'Priya', 'Gopal', 'Anand', 'Kavya', 'Vikram', 'Sita', 'Hari', 'Uma', 'Nandini', 'Mohan', 'Radha', 'Shankar', 'Gauri', 'Vasu', 'Indira', 'Prakash'];
export function randomConfig(seed = Math.random(), opts = {}) {
  let s = Math.floor(seed * 1e9) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const presentation = opts.presentation || (r() < 0.48 ? 'fem' : 'masc');
  const age = opts.age || (r() < 0.2 ? 'elder' : 'adult');
  const fem = presentation === 'fem';
  const outfit = fem ? pick(['saree', 'saree', 'salwar']) : pick(['kurta', 'kurta', 'dhoti']);
  const hair = age === 'elder' && !fem ? pick(['bald', 'cropped', 'short']) : fem ? pick(['braid', 'bun', 'bun', 'wavy', 'ponytail', 'open']) : pick(['short', 'cropped', 'short', 'wavy', 'curly', 'topknot']);
  const hairColor = age === 'elder' ? pick(HAIR_COLORS.slice(3)) : pick(HAIR_COLORS.slice(0, 3));
  return {
    ...DEFAULTS, name: pick(NPC_NAMES), presentation, age, outfit, hair, hairColor, skin: pick(SKIN_TONES), color: pick(CLOTH_COLORS).id,
    build: pick(['slim', 'average', 'average', 'broad']),
    facial: fem ? 'none' : pick(['none', 'none', 'moustache', 'beard']),
    mark: fem ? pick(['bindi', 'bindi', 'none']) : pick(['tilak', 'tripundra', 'none', 'none']),
    jewellery: r() < 0.35 ? 'festive' : 'simple', glasses: age === 'elder' ? r() < 0.6 : r() < 0.08,
    carry: age === 'elder' && r() < 0.35 ? 'cane' : r() < 0.22 ? 'thali' : 'none',
    headwear: fem ? 'none' : r() < 0.14 ? 'turban' : r() < 0.1 ? 'topi' : 'none',
  };
}

// ------------------------------------------------------------------ materials and textures
const M = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.92, roughness: 0.26 }),
  glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.45), toneMapped: true }),
};
const clothCache = new Map();
function clothTexture(colorId, kind) {
  const C = CLOTH_COLORS.find(c => c.id === colorId) || CLOTH_COLORS[0], S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = C.base; x.fillRect(0, 0, S, S);
  // woven texture and small buttis (motifs)
  for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; x.fillRect(Math.random() * S, Math.random() * S, 2, 1); }
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const cx = col * 32 + (row % 2) * 16 + 8, cy = row * 32 + 8; x.fillStyle = C.accent; x.globalAlpha = 0.55;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * 2.5, cy + Math.sin(a) * 2.5, 2.2, 1.2, a, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }
  const zari = (x0, y0, w, h, vertical) => {
    x.fillStyle = C.accent; x.fillRect(x0, y0, w, h);
    x.fillStyle = '#d9a93c';
    if (vertical) { x.fillRect(x0 + 3, y0, 2, h); x.fillRect(x0 + w - 5, y0, 2, h); for (let y = y0 + 6; y < y0 + h; y += 14) { x.beginPath(); x.ellipse(x0 + w / 2, y, w * 0.22, 4, 0, 0, Math.PI * 2); x.fill(); } }
    else { x.fillRect(x0, y0 + 3, w, 2); x.fillRect(x0, y0 + h - 5, w, 2); for (let xx = x0 + 6; xx < x0 + w; xx += 14) { x.beginPath(); x.moveTo(xx, y0 + h * 0.75); x.quadraticCurveTo(xx + 7, y0 + h * 0.1, xx + 3, y0 + h * 0.5); x.closePath(); x.fill(); } }
  };
  if (kind === 'skirt') zari(0, S - 30, S, 30, false);
  else { zari(0, 0, 26, S, true); zari(S - 26, 0, 26, S, true); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function clothMat(colorId, kind) {
  const k = colorId + kind;
  if (!clothCache.has(k)) clothCache.set(k, new THREE.MeshStandardMaterial({ map: clothTexture(colorId, kind), vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }));
  return clothCache.get(k);
}

// ------------------------------------------------------------------ geometry helpers
const V = THREE.Vector3;
const MAT = { body: 0, skirt: 1, ribbon: 2, metal: 3, glow: 4 };
class Parts {
  constructor() { this.list = []; }
  add(geo, bone, color, mat = MAT.body, shade, weights, seat) {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    let g = geo.index ? geo.toNonIndexed() : geo;
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (g.attributes.color && color) { const c = new THREE.Color(color), a = g.attributes.color; for (let i = 0; i < n; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b); }
    if (!g.attributes.color) {
      const c = new THREE.Color(color || '#ffffff'), a = new Float32Array(n * 3), p = g.attributes.position, tmp = new THREE.Color();
      for (let i = 0; i < n; i++) { tmp.copy(c); if (shade) shade(tmp, p.getX(i), p.getY(i), p.getZ(i), i); a.set([tmp.r, tmp.g, tmp.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    this.list.push({ g, bone, mat, weights, seat }); return g;
  }
  build() {
    this.list.sort((a, b) => a.mat - b.mat);
    const total = this.list.reduce((s, p) => s + p.g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3), si = new Uint16Array(total * 4), sw = new Float32Array(total * 4);
    const seat = new Float32Array(total * 3); let hasSeat = false;
    const geo = new THREE.BufferGeometry(); let o = 0, groupStart = 0, groupMat = this.list.length ? this.list[0].mat : 0;
    for (const p of this.list) {
      if (p.mat !== groupMat) { geo.addGroup(groupStart, o - groupStart, groupMat); groupStart = o; groupMat = p.mat; }
      const n = p.g.attributes.position.count;
      pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3); uv.set(p.g.attributes.uv.array, o * 2); col.set(p.g.attributes.color.array, o * 3);
      const P = p.g.attributes.position;
      if (p.seat) { hasSeat = true; for (let i = 0; i < n; i++) { const d = p.seat(P.getX(i), P.getY(i), P.getZ(i)); if (d) seat.set(d, (o + i) * 3); } }
      for (let i = 0; i < n; i++) {
        const k = (o + i) * 4;
        if (!p.weights) { si[k] = p.bone; sw[k] = 1; continue; }
        const w = p.weights(P.getX(i), P.getY(i), P.getZ(i)).filter(e => e[1] > 0.001).slice(0, 4), tot = w.reduce((a, e) => a + e[1], 0) || 1;
        w.forEach(([b, v], j) => { si[k + j] = b; sw[k + j] = v / tot; });
      }
      o += n;
    }
    geo.addGroup(groupStart, o - groupStart, groupMat);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    // morph target 0: garments draped over crossed legs for the seated meditation pose
    geo.morphAttributes.position = [new THREE.BufferAttribute(hasSeat ? seat : new Float32Array(total * 3), 3)]; geo.morphTargetsRelative = true;
    geo.computeBoundingSphere(); return geo;
  }
}
const lathe = (prof, seg = 20) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
const ell = (r, sx, sy, sz, x, y, z) => { const size = r * Math.max(sx, sy, sz); const g = size < 0.012 ? new THREE.SphereGeometry(r, 6, 4) : size < 0.035 ? new THREE.SphereGeometry(r, 10, 7) : new THREE.SphereGeometry(r, 16, 11); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const tubeOf = (pts, r, seg = 16, rad = 5, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, r, rad, closed);
const torus = (R, r, x, y, z, rx = Math.PI / 2, seg = 20) => { const g = new THREE.TorusGeometry(R, r, 5, seg); g.rotateX(rx); g.translate(x, y, z); return g; };
const darken = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// resample a (radius, y) profile into rows no more than `step` apart, keeping its shape
const dense = (prof, step = 0.012) => { const out = []; for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1], n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / step)); for (let k = 0; k < n; k++) out.push([r0 + (r1 - r0) * k / n, y0 + (y1 - y0) * k / n]); } out.push(prof[prof.length - 1]); return out; };

// a drape that follows a path over the body, with folds
function ribbon(points, widthFn, { segs = 40, across = 6, fold = 0.006, folds = 3, lift = 0.006 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points), pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, p = curve.getPointAt(u), t = curve.getTangentAt(u);
    let out = new V(p.x, 0, p.z); if (out.lengthSq() < 1e-6) out.set(0, 0, 1); out.normalize();
    const side = new V().crossVectors(t, out).normalize(), n = new V().crossVectors(side, t).normalize(), w = widthFn(u);
    for (let j = 0; j <= across; j++) {
      const k = j / across - 0.5, wave = Math.sin((k + 0.5) * Math.PI * folds * 2);
      const q = p.clone().addScaledVector(side, k * w).addScaledVector(n, lift + fold * wave);
      pos.push(q.x, q.y, q.z); uv.push(j / across, u); const sh = 0.8 + 0.2 * (wave * 0.5 + 0.5); col.push(sh, sh, sh);
    }
    if (i < segs) for (let j = 0; j < across; j++) { const a = i * (across + 1) + j, b = a + across + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a garment shell of revolution with an elliptical cross-section, pleats and fold shading
function shell(prof, { seg = 40, sz = 0.72, sx = 1, pleats = 0, pleatFront = 0.55, hemWave = 0, vMin, vMax } = {}) {
  const pos = [], uv = [], col = [], idx = [], rows = prof.length, y0 = prof[0][1], y1 = prof[rows - 1][1];
  for (let j = 0; j < rows; j++) {
    const [r, y] = prof[j], yn = (y - y0) / (y1 - y0);
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2, front = Math.atan2(Math.sin(th), Math.cos(th));
      let rr = r; let sh = 1;
      if (pleats && Math.abs(front) < pleatFront) { const w = Math.sin(front * pleats); rr += 0.011 * (0.5 + 0.5 * w) * (1 - yn * 0.7); sh = 0.78 + 0.22 * (0.5 + 0.5 * w); }
      if (hemWave && j === 0) rr += Math.sin(th * 9) * hemWave;
      if (Math.abs(Math.abs(front) - Math.PI / 2) < 0.06) sh *= 0.85;                // side seams
      pos.push(Math.sin(th) * rr * sx, y, Math.cos(th) * rr * sz); uv.push(i / seg * 2, vMin !== undefined ? vMin + (vMax - vMin) * yn : yn); col.push(sh, sh, sh);
    }
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ seated meditation (sukhasana)
// The hips drop by SEAT onto a cushion; legs cross with each foot under the opposite knee; hands rest
// palms-up on the thighs. Angles were solved numerically against this skeleton (see README).
export const SEAT = 0.65;
const SIT = {
  thL: [-2.45, 0.965, 1.286], knL: [2.19, 0, 0], anL: [0.757, -0.078, -0.023],
  thR: [-2.248, -0.866, -1.167], knR: [2.399, 0, 0], anR: [0.663, 0.169, 0.05],
  shL: [-0.048, -0.327, 0.223], elL: [-0.52, 1.237, 0], wrL: [-0.297, 0.796, -0.511],
  shR: [-0.046, 0.316, -0.222], elR: [-0.525, -1.183, 0], wrR: [-0.313, -0.83, 0.486],
};
// nadi shodhana: the right hand comes up to the nose (thumb and ring finger at the nostrils)
const SIT_NADI = { ...SIT, shR: [-0.912, 0.762, 0.082], elR: [-2.311, -1.405, 0], wrR: [-0.316, -0.982, 0.038] };
// where the folded legs and the cushion are once seated (root space, floor at 0): capsules [a, b, radius a, radius b]
const LAP = [
  [[0.088, 0.25, 0], [0.326, 0.131, 0.325], 0.085, 0.058], [[0.326, 0.131, 0.325], [-0.073, 0.088, 0.267], 0.052, 0.04], [[-0.073, 0.088, 0.267], [-0.22, 0.05, 0.32], 0.035, 0.025],
  [[-0.088, 0.25, 0], [-0.346, 0.127, 0.308], 0.085, 0.058], [[-0.346, 0.127, 0.308], [0.037, 0.09, 0.181], 0.052, 0.04], [[0.037, 0.09, 0.181], [0.187, 0.05, 0.223], 0.035, 0.025],
];
const CUSHION = { x: 0, z: -0.03, r: 0.27, y: 0.15 };
function lapHeight(x, z, extra = 0) {
  let h = Math.hypot(x - CUSHION.x, z - CUSHION.z) < CUSHION.r ? CUSHION.y : -1;
  for (const [a, b, ra, rb] of LAP) {
    const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (L2 || 1)));
    const px = a[0] + dx * t, pz = a[2] + dz * t, d = Math.hypot(x - px, z - pz), r = ra + (rb - ra) * t + extra;
    if (d < r) h = Math.max(h, a[1] + (b[1] - a[1]) * t + Math.sqrt(r * r - d * d));
  }
  return h;
}
const smax = (a, b, k = 0.03) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (a - b) / k)); return b + (a - b) * h + k * h * (1 - h); };
// cloth below `top` (bind-space y) falls outward over the lap: `hem` is its lowest bind y, `reach(theta)` the
// radius it spreads to, `lift` how far it rides above the legs. Returns a morph delta in bind space.
function lapDrape(top, hem, reach, lift = 0.022, minY = 0.012, legExtra = 0) {
  return (x, y, z) => {
    if (y >= top) return null;
    const t = Math.min(1, (top - y) / (top - hem)), th = Math.atan2(x, z), r0 = Math.hypot(x, z);
    const R = Math.max(r0, reach(th)), r = r0 + (R - r0) * Math.pow(t, 0.75);
    const nx = r0 > 1e-4 ? x / r0 : Math.sin(th), nz = r0 > 1e-4 ? z / r0 : Math.cos(th);
    const px = nx * r, pz = nz * r;
    const yTop = top - SEAT, fall = yTop - (yTop - minY) * Math.pow(t, 1.7);
    const under = lapHeight(px, pz, legExtra), py = under > -1 ? smax(fall, under + lift) : Math.max(minY, fall);
    return [px - x, py + SEAT - y, pz - z];
  };
}
const lobes = (th, base, k) => base + k * Math.max(Math.pow(Math.max(0, Math.cos(th - 0.8)), 1.5), Math.pow(Math.max(0, Math.cos(th + 0.8)), 1.5));

// ------------------------------------------------------------------ the figure
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'thL', 'knL', 'anL', 'thR', 'knR', 'anR', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR', 'jaw', 'mouthL', 'mouthR'];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', elL: 'shL', wrL: 'elL', shR: 'chest', elR: 'shR', wrR: 'elR', thL: 'hips', knL: 'thL', anL: 'knL', thR: 'hips', knR: 'thR', anR: 'knR', eyeL: 'head', eyeR: 'head', lidL: 'head', lidR: 'head', browL: 'head', browR: 'head', jaw: 'head', mouthL: 'jaw', mouthR: 'jaw' };

function buildFigure(cfg) {
  const fem = cfg.presentation === 'fem', masc = cfg.presentation === 'masc', elder = cfg.age === 'elder';
  const bw = { slim: 0.9, average: 1, broad: 1.14 }[cfg.build] || 1;
  const sw = (fem ? 0.172 : 0.195) * (0.94 + (bw - 1) * 0.6);
  const J = {
    root: [0, 0, 0], hips: [0, 0.94, 0], spine: [0, 1.06, 0], chest: [0, 1.24, 0], neck: [0, 1.42, 0], head: [0, 1.5, 0],
    shL: [sw, 1.395, -0.01], elL: [sw + 0.01, 1.105, -0.01], wrL: [sw + 0.012, 0.855, 0], shR: [-sw, 1.395, -0.01], elR: [-sw - 0.01, 1.105, -0.01], wrR: [-sw - 0.012, 0.855, 0],
    thL: [0.088, 0.9, 0], knL: [0.09, 0.48, 0.01], anL: [0.09, 0.075, -0.01], thR: [-0.088, 0.9, 0], knR: [-0.09, 0.48, 0.01], anR: [-0.09, 0.075, -0.01],
  };
  { const h = [0, 1.6, 0.006], f = (x, y, z) => [h[0] + x, h[1] + y, h[2] + z];
    Object.assign(J, { eyeL: f(0.034, 0.012, 0.087), eyeR: f(-0.034, 0.012, 0.087), lidL: f(0.034, 0.012, 0.087), lidR: f(-0.034, 0.012, 0.087),
      browL: f(0.034, 0.036, 0.094), browR: f(-0.034, 0.036, 0.094), jaw: f(0, -0.022, 0.01), mouthL: f(0.021, -0.054, 0.092), mouthR: f(-0.021, -0.054, 0.092) }); }
  // smooth skin weights across the joints
  const W = {
    torso: (x, y) => y < 1.0 ? [[BI.hips, 1]] : y < 1.1 ? [[BI.hips, 1 - sstep(1.0, 1.1, y)], [BI.spine, sstep(1.0, 1.1, y)]] : y < 1.2 ? [[BI.spine, 1 - sstep(1.1, 1.2, y)], [BI.chest, sstep(1.1, 1.2, y)]] : [[BI.chest, 1]],
    neck: (x, y) => [[BI.chest, 1 - sstep(1.43, 1.5, y)], [BI.neck, sstep(1.43, 1.5, y) * (1 - sstep(1.5, 1.53, y))], [BI.head, sstep(1.5, 1.53, y)]],
    arm: (side) => { const sh = BI['sh' + side], el = BI['el' + side], wr = BI['wr' + side], yS = J['sh' + side][1], yE = J['el' + side][1], yW = J['wr' + side][1];
      return (x, y) => { if (y > yE + 0.05) { const c = sstep(yS - 0.03, yS + 0.05, y) * 0.55; return [[sh, 1 - c], [BI.chest, c]]; }
        if (y > yE - 0.05) { const t = sstep(yE - 0.05, yE + 0.05, y); return [[el, 1 - t], [sh, t]]; }
        if (y > yW + 0.025) return [[el, 1]]; const t = sstep(yW - 0.015, yW + 0.025, y); return [[wr, 1 - t], [el, t]]; }; },
    leg: (side) => { const th = BI['th' + side], kn = BI['kn' + side], an = BI['an' + side], yT = J['th' + side][1], yK = J['kn' + side][1], yA = J['an' + side][1];
      return (x, y) => { if (y > yK + 0.06) { const c = sstep(yT - 0.06, yT + 0.04, y) * 0.6; return [[th, 1 - c], [BI.hips, c]]; }
        if (y > yK - 0.06) { const t = sstep(yK - 0.06, yK + 0.06, y); return [[kn, 1 - t], [th, t]]; }
        if (y > yA + 0.04) return [[kn, 1]]; const t = sstep(yA - 0.01, yA + 0.04, y); return [[an, 1 - t], [kn, t]]; }; },
  };
  const P = new Parts(), skin = cfg.skin, hairC = cfg.hairColor;
  const hairShade = (c, x, y, z) => c.multiplyScalar(0.85 + 0.25 * Math.abs(Math.sin(x * 260 + z * 120)));

  const cloth = CLOTH_COLORS.find(c => c.id === cfg.color) || CLOTH_COLORS[0];
  const at = (g, j) => g.translate(J[j][0], J[j][1], J[j][2]);
  const skinShade = (c, x, y, z) => c.multiplyScalar(0.96 + Math.sin(x * 40 + y * 30) * 0.02);
  const gold = '#e0b04f', silver = '#d9dade', glassCols = ['#b3121b', '#1f7a3a', '#2a4fb0', '#e2a72c'];

  // ---- torso (pelvis rides the hips, chest rides the chest bone)
  const tProf = fem ? [[0.155, 0.86], [0.172, 0.94], [0.165, 1.0], [0.132, 1.08], [0.128, 1.12], [0.148, 1.2], [0.156, 1.28], [0.162, 1.35], [0.145, 1.41], [0.07, 1.455]]
    : [[0.148, 0.86], [0.156, 0.94], [0.15, 1.0], [0.142, 1.08], [0.15, 1.16], [0.172, 1.24], [0.182, 1.32], [0.18, 1.38], [0.15, 1.425], [0.072, 1.462]];
  const tp = tProf.map(([r, y]) => [r * bw, y]);
  const torsoShade = (c, x, y, z) => { if (!fem && z > 0.06 && y > 1.2 && y < 1.26) c.multiplyScalar(0.9); if (z > 0.08 && Math.abs(x) < 0.006 && y > 1.0 && y < 1.2) c.multiplyScalar(0.92); };
  const bust = (g, amp = 0.03) => {
    if (!fem) return g;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (z <= 0) continue;
      const dy = y - 1.238, wy = dy < 0 ? 0.056 : 0.042;
      const k = Math.exp(-(((Math.abs(x) - 0.066 * bw) / 0.048) ** 2) - (dy / wy) ** 2) * Math.min(1, z / 0.05);
      p.setZ(i, z + amp * bw * k);
    }
    g.computeVertexNormals(); return g;
  };
  P.add(bust(lathe(dense(tp, 0.014), 32).scale(1, 1, 0.68)), BI.chest, skin, MAT.body, torsoShade, W.torso);
  if (!fem && cfg.outfit === 'dhoti') for (const s of [-1, 1]) P.add(ell(0.07, 1.0 * bw, 0.5, 0.24, s * 0.06 * bw, 1.255, 0.09), BI.chest, skin, MAT.body, null, W.torso); // pectorals, shown on a bare chest
  P.add(new THREE.CylinderGeometry(masc ? 0.05 : 0.045, masc ? 0.058 : 0.052, 0.13, 14, 4).translate(0, 1.475, 0.0), BI.neck, skin, MAT.body, null, W.neck);
  // ---- head
  const H = new V(0, 1.6, 0.006), head = [];
  const skull = new THREE.SphereGeometry(1, 30, 22), sp = skull.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    let x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    if (y < -0.2) x *= 1 - (-y - 0.2) * 0.38;                               // jaw tapers to the chin
    if (z > 0.55 && y < -0.55) z += 0.06;                                    // chin
    if (z > 0.6 && y > -0.1 && y < 0.25 && Math.abs(x) > 0.28) z -= 0.05;    // eye sockets
    if (z > 0.7 && Math.abs(x) > 0.42 && y > -0.45 && y < -0.05) { x *= 1.02; z += 0.02; } // cheekbones
    sp.setXYZ(i, x * 0.092, y * 0.112, z * 0.102);
  }
  skull.computeVertexNormals();
  const jawW = (x, y, z) => { const yr = y - H.y, zr = z - H.z, t = zr > -0.04 ? sstep(-0.042, -0.078, yr) : 0; return [[BI.head, 1 - t], [BI.jaw, t]]; };
  const lipW = (lower) => (x, y, z) => { const xr = x - H.x, c = sstep(0.006, 0.02, Math.abs(xr)), base = lower ? BI.jaw : BI.head; return [[base, 1 - c], [xr > 0 ? BI.mouthL : BI.mouthR, c]]; };
  head.push([skull, skin, MAT.body, (c, x, y, z) => { if (z > 0.06 && Math.abs(x) > 0.035 && y < -0.005 && y > -0.05) c.lerp(new THREE.Color('#d8746a'), 0.12); }, jawW]);
  head.push([new THREE.CircleGeometry(0.012, 14).scale(1.5, 0.55, 1).translate(0, -0.0548, 0.0885), '#3a1414', MAT.body, null, jawW]);   // inside of the mouth
  for (const s of [-1, 1]) {
    const eB = s > 0 ? BI.eyeL : BI.eyeR, lB = s > 0 ? BI.lidL : BI.lidR, bB = s > 0 ? BI.browL : BI.browR;
    head.push([ell(0.0135, 1, 0.62, 0.55, s * 0.034, 0.012, 0.087), '#f6f2ea', MAT.body, null, null, eB]);                // eye white
    // upper eyelid: a thin cap over the eye that closes to blink and to pray
    const lid = new THREE.SphereGeometry(0.0142, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.36); lid.scale(1.08, 0.7, 0.66); lid.translate(s * 0.034, 0.012, 0.087);
    head.push([lid, darken(skin, 0.9), MAT.body, null, null, lB]);
    const iris = new THREE.CircleGeometry(0.0074, 16).translate(s * 0.034, 0.012, 0.0948); head.push([iris, '#3a2416', MAT.body, (c, x, y) => { if (Math.hypot(x - s * 0.034, y - 0.012) < 0.0034) c.set('#0e0805'); }, null, eB]);
    head.push([new THREE.CircleGeometry(0.0017, 6).translate(s * 0.034 + 0.002, 0.0145, 0.0952), '#ffffff', MAT.body, null, null, eB]);       // catchlight
    head.push([tubeOf([new V(s * 0.034 - 0.0145, 0.014, 0.0905), new V(s * 0.034, 0.0205, 0.0955), new V(s * 0.034 + 0.0145, 0.014, 0.0905)], fem ? 0.0021 : 0.0014, 10, 4), '#1a1210', MAT.body, null, null, lB]); // lash line (kajal)
    head.push([tubeOf([new V(s * 0.034 - 0.017, 0.031, 0.093), new V(s * 0.036, 0.038, 0.0975), new V(s * 0.034 + 0.018, 0.033, 0.091)], masc ? 0.0036 : 0.0026, 10, 4), elder && cfg.hairColor === HAIR_COLORS[4] ? '#bdb8ad' : hairC, MAT.body, null, null, bB]); // brow
    head.push([ell(0.024, 0.32, 1, 0.62, s * 0.091, 0.0, -0.006), skin]);                                       // ear
    head.push([ell(0.0056, 1.1, 0.9, 1, s * 0.0092, -0.028, 0.0985), darken(skin, 0.94)]);                      // nose wing
  }
  head.push([ell(0.0085, 0.7, 2.1, 0.85, 0, -0.006, 0.0975), skin], [ell(0.0088, 1, 0.92, 1, 0, -0.0255, 0.1035), skin]);  // nose bridge and tip
  const lip = new THREE.Color(skin).lerp(new THREE.Color(fem ? '#a8323f' : '#8a4038'), fem ? 0.55 : 0.4);
  head.push([ell(0.0105, 2.1, 0.42, 0.62, 0, -0.05, 0.093), lip, MAT.body, null, lipW(false)], [ell(0.0105, 1.9, 0.55, 0.7, 0, -0.0595, 0.0905), lip.clone().multiplyScalar(1.06), MAT.body, null, lipW(true)]);
  head.push([tubeOf([new V(-0.02, -0.0545, 0.093), new V(0, -0.0545, 0.0985), new V(0.02, -0.0545, 0.093)], 0.0011, 8, 3), darken(lip, 0.55), MAT.body, null, lipW(false)]);  // mouth line
  // forehead marks
  const fz = (y) => 0.102 * Math.sqrt(Math.max(0, 1 - (y / 0.112) ** 2)) + 0.0012;
  if (cfg.mark === 'bindi') head.push([new THREE.CircleGeometry(fem ? 0.0058 : 0.004, 14).translate(0, 0.036, fz(0.036)), '#b3121b']);
  if (cfg.mark === 'tilak') { for (const s of [-1, 1]) head.push([new THREE.BoxGeometry(0.0032, 0.04, 0.002).translate(s * 0.0075, 0.052, fz(0.05)), '#f4efe4']); head.push([new THREE.BoxGeometry(0.0028, 0.034, 0.002).translate(0, 0.05, fz(0.05) + 0.0005), '#d01f1f']); }
  if (cfg.mark === 'tripundra') { for (const y of [0.043, 0.053, 0.063]) head.push([new THREE.BoxGeometry(0.052, 0.0034, 0.002).translate(0, y, fz(y)), '#f1ede2']); head.push([new THREE.CircleGeometry(0.0042, 10).translate(0, 0.053, fz(0.053) + 0.001), '#c4161c']); }
  // facial hair
  const fh = cfg.hairColor;
  if (!fem && cfg.facial !== 'none') head.push([tubeOf([new V(-0.026, -0.044, 0.094), new V(-0.012, -0.04, 0.103), new V(0, -0.0405, 0.105), new V(0.012, -0.04, 0.103), new V(0.026, -0.044, 0.094)], 0.0042, 14, 5), fh, MAT.body, null, lipW(false)]);
  if (!fem && cfg.facial === 'beard') { const b = new THREE.SphereGeometry(1, 28, 16, -Math.PI * 0.62, Math.PI * 1.24, Math.PI * 0.56, Math.PI * 0.38), bp = b.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i); const k = (Math.abs(x) < 0.3 && y > -0.62 && z > 0.6) ? 0.9 : 1; bp.setXYZ(i, x * 0.097 * k, y * 0.118 * k, z * 0.108 * k); } b.computeVertexNormals(); b.translate(0, -0.004, 0.003); head.push([b, fh, MAT.body, hairShade, jawW]); }
  if (cfg.glasses) { for (const s of [-1, 1]) { head.push([torus(0.017, 0.0016, s * 0.034, 0.012, 0.1, 0, 20), '#2a2622', MAT.metal]); head.push([new THREE.BoxGeometry(0.003, 0.003, 0.09).translate(s * 0.052, 0.016, 0.055), '#2a2622', MAT.metal]); } head.push([new THREE.BoxGeometry(0.016, 0.0025, 0.003).translate(0, 0.016, 0.1), '#2a2622', MAT.metal]); }
  // hair
  const cap = (k = 1.06) => {
    const g = new THREE.SphereGeometry(1, 34, 22, 0, Math.PI * 2, 0, Math.PI * 0.8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i); const y = p.getY(i), z = p.getZ(i); let s = k;
      if ((z > 0.12 && y < 0.62 - z * 0.14) || (Math.abs(x) > 0.55 && y < 0.05 && z > -0.45) || y < -0.62) s = 0.72;   // tucked inside the head
      if (y < -0.2) x *= 1 - (-y - 0.2) * 0.38;                                                                   // follow the jaw taper
      p.setXYZ(i, x * 0.092 * s, y * 0.112 * s, z * 0.102 * s);
    }
    g.computeVertexNormals(); return g;
  };
  if (cfg.hair !== 'bald') head.push([cap(cfg.hair === 'cropped' ? 1.025 : 1.06), cfg.hair === 'cropped' ? new THREE.Color(hairC).lerp(new THREE.Color(skin), 0.25) : hairC, MAT.body, hairShade]);
  if (cfg.hair === 'short') head.push([ell(0.09, 1.04, 0.6, 1.08, 0, 0.068, 0.0), hairC, MAT.body, hairShade], [ell(0.03, 1.4, 0.7, 1, 0.015, 0.088, 0.06), hairC]);
  if (cfg.hair === 'wavy') { head.push([ell(0.1, 1.08, 0.95, 0.72, 0, -0.03, -0.05), hairC, MAT.body, hairShade]); for (const s of [-1, 1]) head.push([ell(0.03, 1, 2.4, 1.5, s * 0.084, -0.05, -0.01), hairC, MAT.body, hairShade]); for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8 - 0.5) * 2.4; head.push([ell(0.018, 1, 1, 1, Math.sin(a) * 0.082, -0.115, Math.cos(a) * 0.065), hairC]); } }
  if (cfg.hair === 'bun') { head.push([torus(0.033, 0.021, 0, -0.04, -0.103, 0, 18), hairC, MAT.body, hairShade], [ell(0.03, 1, 1, 0.8, 0, -0.04, -0.11), hairC]); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; head.push([ell(0.0075, 1, 1, 1, Math.cos(a) * 0.055, -0.04 + Math.sin(a) * 0.055, -0.112), '#fbf8ef']); } }
  if (cfg.hair === 'cropped') head.push([tubeOf([new V(0, 0.1, -0.06), new V(0, 0.115, -0.09), new V(0, 0.095, -0.115)], 0.009, 8, 5), hairC], [ell(0.012, 1, 1, 1, 0, 0.094, -0.118), hairC]);
  if (cfg.hair === 'bald') head.push([(() => { const g = new THREE.TorusGeometry(0.094, 0.02, 6, 24, Math.PI * 1.25); g.rotateX(Math.PI / 2); g.rotateY(Math.PI * 0.375 + Math.PI); g.scale(1, 1, 1.1); g.translate(0, -0.012, 0); return g; })(), hairC, MAT.body, hairShade]);
  if (cfg.hair === 'ponytail') {
    head.push([torus(0.017, 0.0065, 0, -0.005, -0.104, 0, 12), cfg.jewellery === 'festive' ? '#c4161c' : darken(hairC, 0.7)]);
    [[0, -0.01, -0.113, 0.024], [0, -0.05, -0.128, 0.022], [0, -0.09, -0.135, 0.019], [0, -0.13, -0.136, 0.016], [0, -0.17, -0.132, 0.012], [0, -0.2, -0.127, 0.008]]
      .forEach(([x, y, z, r]) => head.push([ell(r, 1, 1.5, 0.9, x, y, z), hairC, MAT.body, hairShade]));
  }
  if (cfg.hair === 'open') {
    const sheet = ribbon([new V(0, 0.075, -0.07), new V(0, 0.02, -0.113), new V(0, -0.08, -0.122), new V(0, -0.2, -0.128), new V(0, -0.34, -0.136)], (u) => 0.17 + u * 0.08, { segs: 24, across: 8, fold: 0.006, folds: 5, lift: 0.004 });
    head.push([sheet, hairC, MAT.body, hairShade, (x, y) => [[BI.head, sstep(H.y - 0.24, H.y - 0.1, y)], [BI.chest, 1 - sstep(H.y - 0.24, H.y - 0.1, y)]]]);
    for (const s2 of [-1, 1]) head.push([ell(0.03, 0.9, 2.6, 1.3, s2 * 0.08, -0.07, -0.035), hairC, MAT.body, hairShade]);
  }
  if (cfg.hair === 'curly') for (let i = 0; i < 90; i++) {
    const y = 1 - (i / 89) * 1.3, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if ((z > 0.12 && y < 0.62 - z * 0.14) || (Math.abs(x) > 0.55 && y < 0.05 && z > -0.45) || y < -0.5) continue;
    head.push([ell(0.0155, 1, 1, 1, x * 0.1, y * 0.12, z * 0.11), hairC, MAT.body, hairShade]);
  }
  if (cfg.hair === 'topknot') head.push([ell(0.028, 1, 0.9, 1, 0, 0.118, -0.03), hairC, MAT.body, hairShade], [torus(0.02, 0.005, 0, 0.1, -0.03, Math.PI / 2, 12), darken(hairC, 0.6)]);
  // head coverings: a wrapped safa, or a white Gandhi topi
  if (cfg.headwear === 'turban') {
    const tc = ['#e8731c', '#c4161c', '#f2b631', '#d6336c', '#2f8f5b'][Math.abs((cfg.name || 'x').charCodeAt(0) + cfg.color.length) % 5];
    for (let i = 0; i < 6; i++) { const g = new THREE.TorusGeometry(0.098 - i * 0.004, 0.02, 8, 30); g.rotateX(Math.PI / 2 + (i % 2 ? 0.16 : -0.12)); g.rotateZ(i % 2 ? 0.08 : -0.08); g.scale(1, 1, 1.1); g.translate(0, 0.035 + i * 0.016, -0.005); head.push([g, darken(tc, 0.85 + (i % 3) * 0.08)]); }
    head.push([new THREE.SphereGeometry(0.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.1).translate(0, 0.11, -0.005), tc]);
    head.push([ribbon([new V(0, 0.06, -0.11), new V(0, -0.05, -0.125), new V(0, -0.2, -0.132)], () => 0.07, { segs: 10, across: 4, fold: 0.004, folds: 2, lift: 0.004 }), tc]);
  }
  if (cfg.headwear === 'topi') {
    head.push([new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.1, 0.055, 0.118).translate(0, 0.07, -0.004), '#f6f3ea']);
    head.push([new THREE.BoxGeometry(0.004, 0.012, 0.21).translate(0, 0.126, -0.004), '#e8e3d6'], [torus(0.101, 0.006, 0, 0.072, -0.004, Math.PI / 2, 28).scale(1, 1, 1.15), '#efebe0']);
  }
  if (fem && (cfg.hair === 'bun' || cfg.hair === 'braid')) head.push([new THREE.BoxGeometry(0.003, 0.002, 0.07).translate(0, 0.113, 0.02).rotateX(-0.25), cfg.jewellery === 'festive' ? '#c4161c' : darken(hairC, 0.6)]); // parting / sindoor
  // earrings and nose stud
  if (fem) for (const s of [-1, 1]) { head.push([ell(0.0085, 1, 0.8, 1, s * 0.094, -0.03, 0.0), gold, MAT.metal]); head.push([new THREE.SphereGeometry(0.009, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(s * 0.094, -0.042, 0), gold, MAT.metal]); head.push([ell(0.003, 1, 1, 1, s * 0.094, -0.054, 0), '#c4161c', MAT.metal]); }
  if (fem && cfg.jewellery === 'festive') head.push([ell(0.0028, 1, 1, 1, 0.0125, -0.026, 0.106), gold, MAT.metal]);
  for (const [g, c, m = MAT.body, sh, w, bone = BI.head] of head) P.add(g, bone, c, m, sh || undefined, w || undefined).translate(H.x, H.y, H.z);
  // braid hangs down the back, following the chest
  if (cfg.hair === 'braid') { for (let i = 0; i < 11; i++) { const y = 1.53 - i * 0.05, r = 0.026 - i * 0.0012; for (const s of [-1, 1]) P.add(ell(r, 1, 1.25, 0.8, s * 0.007 * (i % 2 ? 1 : -1), y + s * 0.012, -0.112 - Math.min(i, 3) * 0.008), BI.chest, hairC, MAT.body, hairShade); }
    P.add(new THREE.ConeGeometry(0.014, 0.07, 8).rotateX(Math.PI).translate(0, 0.94, -0.135), BI.chest, '#c4161c'); P.add(ell(0.01, 1, 1, 1, 0, 0.98, -0.135), BI.chest, gold, MAT.metal); }

  // ---- limb profiles (radius, offset below the shoulder / hip joint)
  const ARM = [[0.021, -0.545], [0.025, -0.5], [0.031, -0.4], [0.034, -0.32], [0.034, -0.27], [0.041, -0.19], [0.047, -0.09], [0.05, -0.02], [0.047, 0.012], [0.032, 0.036], [0.008, 0.046]].map(([r, y]) => [r > 0.02 ? r * bw : r, y]);
  const LEG = [[0.03, -0.83], [0.033, -0.78], [0.044, -0.64], [0.05, -0.55], [0.049, -0.47], [0.052, -0.42], [0.058, -0.36], [0.074, -0.16], [0.084, -0.05], [0.078, 0.03], [0.03, 0.065]].map(([r, y]) => [r > 0.035 ? r * bw : r, y]);
  const radAt = (prof, y) => { for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return prof[prof.length - 1][0]; };
  // a garment tube over a limb, from `from` to `to` below the joint, `extra` looser than the skin
  const over = (prof, from, to, extra, steps = 9, flare = 0) => { const out = []; for (let i = 0; i <= steps; i++) { const y = from + (to - from) * i / steps; out.push([radAt(prof, y) + extra + flare * Math.pow(1 - i / steps, 2), y]); } return out; };
  // ---- arms and hands
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, sh = 'sh' + side, el = 'el' + side, wr = 'wr' + side;
    // one continuous arm, weighted across shoulder, elbow and wrist so it bends smoothly
    P.add(at(lathe(ARM, 16), sh), BI[sh], skin, MAT.body, skinShade, W.arm(side));
    // hand: palm faces the body in the rest pose; fingers, thumb, henna on the palm for festive dress
    const hand = [];
    const henna = fem && cfg.jewellery === 'festive';
    hand.push([ell(1, 0.017, 0.046, 0.035, 0, -0.046, 0), (c, x, y, z) => { if (henna && (x - J[wr][0]) * s < -0.004 && Math.sin(y * 420) * Math.sin(z * 380) > 0.1) c.lerp(new THREE.Color('#8a3a1c'), 0.6); }]);
    [-0.024, -0.008, 0.008, 0.024].forEach((fz2, k) => { const len = [0.044, 0.052, 0.055, 0.05][k]; const f = new THREE.CapsuleGeometry(0.0072, len, 3, 6); f.rotateX(0.12); f.translate(0, -0.088 - len / 2, fz2 * 0.95); hand.push([f]); });
    const th = new THREE.CapsuleGeometry(0.008, 0.035, 3, 6); th.rotateX(-0.6); th.rotateZ(s * 0.3); th.translate(-s * 0.006, -0.055, 0.035); hand.push([th]);
    for (const [g, shade] of hand) P.add(at(g, wr), BI[wr], skin, MAT.body, shade);
    // bangles, kada or a sacred kalava thread
    if (fem) { const n = cfg.jewellery === 'festive' ? 8 : 4; for (let i = 0; i < n; i++) { const isGold = i % 2 === 0; P.add(at(torus(0.03, 0.0035, 0, -0.205 + i * 0.006, 0), el), BI[el], isGold ? gold : glassCols[(i >> 1) % 4], isGold ? MAT.metal : MAT.body); } }
    else if (s < 0) P.add(at(torus(0.029, 0.004, 0, -0.21, 0), el), BI[el], silver, MAT.metal);
    else P.add(at(torus(0.028, 0.0025, 0, -0.215, 0), el), BI[el], '#c4161c');
  }
  // ---- legs and bare feet
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, th = 'th' + side, kn = 'kn' + side, an = 'an' + side;
    P.add(at(lathe(LEG, 16), th), BI[th], skin, MAT.body, skinShade, W.leg(side));
    const alta = fem && cfg.jewellery === 'festive';
    const footShade = (c, x, y, z) => { if (alta && y < J[an][1] - 0.058) c.set('#b3121b'); };
    P.add(at(ell(1, 0.04, 0.028, 0.1, 0, -0.04, 0.045), an), BI[an], skin, MAT.body, footShade);
    P.add(at(ell(0.03, 1, 0.9, 1.1, 0, -0.04, -0.03), an), BI[an], skin, MAT.body, footShade);
    [0.022, 0.011, 0, -0.011, -0.021].forEach((tx, k) => P.add(at(ell(k === 0 ? 0.0105 : 0.008, 1, 0.85, 1.2, tx * s, -0.058, 0.142 - k * 0.006), an), BI[an], skin, MAT.body, footShade));
    if (fem) { P.add(at(torus(0.036, 0.0035, 0, -0.005, 0), an), BI[an], silver, MAT.metal); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; P.add(at(ell(0.004, 1, 1, 1, Math.cos(a) * 0.038, -0.013, Math.sin(a) * 0.038), an), BI[an], silver, MAT.metal); }
      P.add(at(torus(0.0085, 0.0018, s * 0.011, -0.058, 0.142, Math.PI / 2 - 0.3, 10), an), BI[an], silver, MAT.metal); }
  }

  // ---- garments
  const base = cloth.base, accent = cloth.accent, lb = (k) => k * bw;
  const neckline = (g, depth) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (z <= 0.02) continue;
    const yb = 1.455 - depth + 4 * x * x, w = sstep(yb - 0.005, yb + 0.005, y) * Math.min(1, (z - 0.02) / 0.03); if (w > 0) p.setXYZ(i, x * (1 - 0.06 * w), y, z * (1 - 0.22 * w)); } g.computeVertexNormals(); return g; };
  const sleeve = (side, len, color, mat = MAT.body) => {
    const sh = 'sh' + side, el = 'el' + side;
    const prof = over(ARM, -len, 0.03, 0.009, 12, len > 0.3 ? 0.006 : 0.003).concat([[radAt(ARM, 0.04) + 0.008, 0.042], [0.012 + 0.006, 0.052], [0.002, 0.056]]);
    P.add(at(lathe(prof, 16), sh), BI[sh], color, mat, null, W.arm(side));
    const hemR = prof[0][0] + 0.002, hem = at(torus(hemR, 0.005, 0, -len, 0, Math.PI / 2, 18), sh);
    P.add(hem, BI[sh], accent, MAT.body, null, W.arm(side));
  };
  if (cfg.outfit === 'saree') {
    // blouse with a scooped neck and short sleeves
    const blouse = shell(dense([[lb(0.135), 1.1], [lb(0.155), 1.2], [lb(0.165), 1.28], [lb(0.17), 1.35], [lb(0.152), 1.41], [0.076, 1.455]], 0.007), { sz: 0.7, seg: 48 });
    neckline(blouse, 0.085); P.add(bust(blouse, 0.032), BI.chest, accent, MAT.body, null, W.torso);
    sleeve('L', 0.13, accent); sleeve('R', 0.13, accent);
    // skirt with front pleats, tucked at the waist, zari border at the hem
    const skirt = shell(dense([[lb(0.255), 0.06], [lb(0.225), 0.3], [lb(0.205), 0.6], [lb(0.195), 0.85], [lb(0.18), 0.95], [lb(0.15), 1.04], [lb(0.14), 1.08]], 0.04), { sz: 0.82, pleats: 46, pleatFront: 0.5, hemWave: 0.006, seg: 56 });
    P.add(skirt, BI.hips, '#ffffff', MAT.skirt, null, null, lapDrape(1.0, 0.06, (th) => lobes(th, 0.3, 0.3)));
    P.add(torus(lb(0.148), 0.012, 0, 1.06, 0), BI.hips, base);
    // the pallu: from the waist across the chest, over the left shoulder, falling down the back
    const pallu = ribbon([new V(-0.1, 1.0, 0.13), new V(-0.03, 1.14, 0.168), new V(0.07, 1.29, 0.168), new V(0.16, 1.43, 0.03), new V(0.17, 1.37, -0.1), new V(0.14, 1.12, -0.16), new V(0.12, 0.7, -0.18)],
      (u) => (u < 0.42 ? 0.2 - u * 0.15 : u < 0.55 ? 0.13 : 0.13 + (u - 0.55) * 0.42), { segs: 48, fold: 0.008, folds: 4 });
    P.add(pallu, BI.chest, '#ffffff', MAT.ribbon);
    // mangalsutra: black beads with a gold pendant
    const ms = []; for (let i = 0; i <= 26; i++) { const a = -0.95 + i / 26 * 1.9; ms.push(new V(Math.sin(a) * 0.075, 1.3 + Math.cos(a) * 0.1 - 0.02, Math.cos(a) * 0.06 + 0.035)); }
    ms.forEach((p, i) => P.add(ell(0.0038, 1, 1, 1, p.x, p.y, p.z), BI.chest, i % 5 ? '#141414' : gold, i % 5 ? MAT.body : MAT.metal));
    P.add(ell(0.009, 1, 1.3, 0.5, 0, 1.19, 0.1), BI.chest, gold, MAT.metal);
  }
  if (cfg.outfit === 'kurta' || cfg.outfit === 'salwar') {
    const sal = cfg.outfit === 'salwar', hem = sal ? 0.4 : 0.5;
    const chestR = fem ? 0.165 : 0.188;
    const prof = [[lb(sal ? 0.24 : 0.21), hem], [lb(0.2), 0.7], [lb(fem ? 0.185 : 0.175), 0.92], [lb(fem ? 0.15 : 0.165), 1.06], [lb(fem ? 0.16 : 0.172), 1.16], [lb(chestR), 1.27], [lb(chestR + 0.01), 1.35], [lb(fem ? 0.158 : 0.164), 1.42], [lb(fem ? 0.122 : 0.13), 1.446], [0.076, 1.463]];   // clear of the shoulder slope
    P.add(bust(shell(dense(prof, 0.014), { sz: 0.73, seg: 48, hemWave: 0.004 }), 0.033), BI.chest, '#ffffff', MAT.skirt, null, W.torso, lapDrape(1.0, hem, (th) => lobes(th, 0.24, sal ? 0.24 : 0.15), sal ? 0.03 : 0.02, 0.1, sal ? 0.045 : 0.008));
    // mandarin collar, embroidered placket and buttons
    P.add(new THREE.CylinderGeometry(masc ? 0.064 : 0.058, masc ? 0.068 : 0.062, 0.038, 18, 1, true).translate(0, 1.475, 0.002), BI.chest, base);
    const frontZ = (y) => { for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y >= y0 && y <= y1) return (r0 + (r1 - r0) * (y - y0) / (y1 - y0)) * 0.72 + 0.004; } return 0.1; };
    P.add(tubeOf([1.45, 1.4, 1.34, 1.29, 1.25].map(y => new V(0, y, frontZ(y))), 0.0055, 12, 4), BI.chest, gold, MAT.metal);
    for (let i = 0; i < 4; i++) { const y = 1.425 - i * 0.045; P.add(ell(0.0045, 1, 1, 0.6, 0, y, frontZ(y) + 0.004), BI.chest, accent, MAT.metal); }
    sleeve('L', sal ? 0.43 : 0.52, base); sleeve('R', sal ? 0.43 : 0.52, base);
    // churidar or salwar: gathered folds at the ankles
    const leg = sal ? new THREE.Color(base).lerp(new THREE.Color('#ffffff'), 0.4) : new THREE.Color('#f1ebdf');
    for (const side of ['L', 'R']) {
      const th = 'th' + side, kn = 'kn' + side;
      // one continuous trouser leg; salwar is cut wide and gathered at the ankle
      const tr = over(LEG, -0.81, 0.07, sal ? 0.03 : 0.008, 16).map(([r, y]) => [sal ? r + 0.025 * Math.sin(Math.min(1, (y + 0.81) / 0.5) * Math.PI / 2) : r, y]);
      P.add(at(lathe(tr, 16), th), BI[th], leg, MAT.body, (c, x, y) => c.multiplyScalar(0.92 + 0.08 * Math.sin(y * 90)), W.leg(side));
      for (let i = 0; i < 6; i++) P.add(at(torus(radAt(LEG, -0.8 + i * 0.022) + 0.008 + (i % 2) * 0.004, 0.006, 0, -0.8 + i * 0.022, 0), th), BI[th], darken('#' + leg.getHexString(), 0.92 + (i % 2) * 0.08), MAT.body, null, W.leg(side));
    }
    if (sal) { // dupatta over both shoulders, falling behind
      const d = ribbon([new V(0.15, 0.82, -0.17), new V(0.17, 1.22, -0.11), new V(0.165, 1.43, 0.0), new V(0.08, 1.33, 0.152), new V(0, 1.25, 0.175), new V(-0.08, 1.33, 0.152), new V(-0.165, 1.43, 0.0), new V(-0.17, 1.22, -0.11), new V(-0.15, 0.82, -0.17)],
        (u) => 0.17 + Math.abs(u - 0.5) * 0.08, { segs: 60, fold: 0.007, folds: 3 });
      P.add(d, BI.chest, '#ffffff', MAT.ribbon);
    }
  }
  if (cfg.outfit === 'dhoti') {
    // waist wrap with a rolled fold, loose drape around each leg, front pleats with a border
    P.add(shell(dense([[lb(0.17), 0.8], [lb(0.172), 0.9], [lb(0.162), 1.0], [lb(0.15), 1.05]], 0.03), { sz: 0.78 }), BI.hips, '#ffffff', MAT.skirt, null, null, lapDrape(1.0, 0.8, (th) => lobes(th, 0.2, 0.08), 0.018, 0.12));
    P.add(torus(lb(0.152), 0.016, 0, 1.045, 0), BI.hips, base);
    for (const side of ['L', 'R']) {
      const th = 'th' + side, kn = 'kn' + side;
      // loose drape from the waist to mid-calf, bending with the knee
      P.add(at(shell(over(LEG, -0.68, 0.06, 0.042, 14), { sz: 1, seg: 22, hemWave: 0.005 }), th), BI[th], '#ffffff', MAT.skirt, null, W.leg(side));
    }
    P.add(ribbon([new V(0, 1.02, 0.135), new V(0.005, 0.8, 0.16), new V(0, 0.5, 0.17)], (u) => 0.13 - u * 0.03, { segs: 20, fold: 0.012, folds: 5 }), BI.hips, '#ffffff', MAT.ribbon, null, null, lapDrape(1.0, 0.5, () => 0.42, 0.03, 0.06));
    // angavastram around the neck, falling in front; the sacred thread and a rudraksha mala
    P.add(ribbon([new V(0.11, 0.92, 0.15), new V(0.13, 1.22, 0.135), new V(0.16, 1.43, 0.02), new V(0, 1.45, -0.085), new V(-0.16, 1.43, 0.02), new V(-0.13, 1.22, 0.135), new V(-0.11, 0.92, 0.15)],
      () => 0.13, { segs: 56, fold: 0.006, folds: 3, lift: 0.012 }), BI.chest, '#ffffff', MAT.ribbon);
    P.add(tubeOf([new V(0.12, 1.41, 0.05), new V(0.03, 1.24, lb(0.125)), new V(-0.11, 1.05, lb(0.105)), new V(-lb(0.15), 1.03, -0.02), new V(-0.06, 1.12, -lb(0.115)), new V(0.1, 1.32, -0.09)], 0.0022, 40, 4, true), BI.chest, '#f6f2e6');
    const mala = []; for (let i = 0; i <= 30; i++) { const a = -1.0 + i / 30 * 2.0; mala.push(new V(Math.sin(a) * 0.07, 1.31 + Math.cos(a) * 0.11 - 0.03, Math.cos(a) * 0.055 + 0.05)); }
    mala.forEach((p, i) => P.add(ell(i === 15 ? 0.009 : 0.0058, 1, 1, 1, p.x, p.y, p.z), BI.chest, i === 15 ? '#7a3a1a' : '#5a2f1a'));
  }
  if (masc && cfg.jewellery === 'festive' && cfg.outfit !== 'dhoti') { for (let i = 0; i <= 20; i++) { const a = -0.9 + i / 20 * 1.8; P.add(ell(0.003, 1, 1, 1, Math.sin(a) * 0.062, 1.36 + Math.cos(a) * 0.08 - 0.02, Math.cos(a) * 0.05 + 0.06), BI.chest, gold, MAT.metal); } }
  // ---- things carried: a puja thali with a lit diya, or a walking stick
  if (cfg.carry === 'thali') {
    const w = J.wrL; const plate = new THREE.CylinderGeometry(0.1, 0.09, 0.012, 24); plate.translate(w[0], w[1] - 0.11, w[2] + 0.02); P.add(plate, BI.wrL, gold, MAT.metal);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.add(ell(0.014, 1, 0.7, 1, w[0] + Math.cos(a) * 0.065, w[1] - 0.098, w[2] + 0.02 + Math.sin(a) * 0.065), BI.wrL, i % 2 ? '#f2900f' : '#d21f26'); }
    P.add(ell(0.018, 1, 0.5, 1, w[0], w[1] - 0.098, w[2] + 0.02), BI.wrL, '#a4532c');
    P.add(new THREE.ConeGeometry(0.008, 0.03, 8).translate(w[0], w[1] - 0.078, w[2] + 0.02), BI.wrL, '#ffffff', MAT.glow);
  }
  if (cfg.carry === 'cane') { const w = J.wrR; P.add(new THREE.CylinderGeometry(0.009, 0.011, 0.86, 6).translate(w[0], w[1] - 0.48, w[2] + 0.04), BI.wrR, '#5a3a22'); P.add(torus(0.03, 0.009, w[0], w[1] - 0.05, w[2] + 0.015, 0, 10), BI.wrR, '#5a3a22'); }

  // ---- skeleton
  const bones = {}, list = [];
  for (const n of BONES) {
    const b = new THREE.Bone(); b.name = n; bones[n] = b; list.push(b);
    if (n !== 'root') { const p = J[PARENT[n]], j = J[n]; b.position.set(j[0] - p[0], j[1] - p[1], j[2] - p[2]); bones[PARENT[n]].add(b); }
  }
  const geo = P.build();
  return { geo, bones, list, cloth: cfg.color };
}

// ------------------------------------------------------------------ the Avatar
export class Avatar {
  constructor(config, { simulated = false, shadows = true } = {}) {
    this.root = new THREE.Group();
    this.config = normalise({ ...DEFAULTS, ...config });
    this.simulated = simulated; this.shadows = shadows;
    this.state = 'idle'; this.stateTime = 0; this.walkPhase = 0; this.speed = 0; this.seed = Math.random() * 10;
    this.breath = null;   // 0..1 set by a breathing session; otherwise a slow natural breath while meditating
    this.build();
  }
  build() {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); }
    const c = this.config, F = buildFigure(c);
    const mats = [M.body, clothMat(c.color, 'skirt'), clothMat(c.color, 'ribbon'), M.metal, M.glow];
    const mesh = new THREE.SkinnedMesh(F.geo, mats);
    mesh.add(F.bones.root); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(F.list));
    mesh.castShadow = this.shadows; mesh.receiveShadow = false; mesh.frustumCulled = false;
    const height = (c.presentation === 'fem' ? 0.97 : c.presentation === 'masc' ? 1.04 : 1.0) * (c.age === 'elder' ? 0.97 : 1) * (c.age === 'child' ? 0.62 : 1);
    mesh.scale.setScalar(height);
    if (c.age === 'child') F.bones.head.scale.setScalar(1.3);
    this.mesh = mesh; this.b = F.bones; this.root.add(mesh);
    this.rest = {}; for (const [n, b] of Object.entries(F.bones)) this.rest[n] = b.position.clone();
  }
  setConfig(c) { this.config = normalise({ ...DEFAULTS, ...c }); this.build(); }
  setState(s) { if (this.state !== s) { this.state = s; this.stateTime = 0; } }

  _targets(t) {
    const s = this.state, c = this.config, elder = c.age === 'elder';
    const T = { sx: [0, 0], sz: [-0.07, 0.07], ex: [-0.14, -0.14], ez: [0, 0], wx: [0, 0], th: [0, 0], kn: [0.04, 0.04], an: [0, 0], spine: elder ? 0.1 : 0.0, chest: 0, neck: elder ? 0.08 : 0, headX: 0, headY: 0, hipY: 0, hipZ: 0, bob: 0 };
    if (s === 'walk') {
      const p = this.walkPhase, a = Math.min(1, this.speed / 2.2), stride = (c.outfit === 'saree' ? 0.4 : 0.55) * (elder ? 0.75 : 1);
      T.th = [Math.sin(p) * stride * a, -Math.sin(p) * stride * a];
      T.kn = [0.08 + Math.max(0, -Math.cos(p)) * 0.85 * a, 0.08 + Math.max(0, Math.cos(p)) * 0.85 * a];
      T.an = [-T.kn[0] * 0.25, -T.kn[1] * 0.25];
      T.sx = [-Math.sin(p) * 0.42 * a, Math.sin(p) * 0.42 * a];
      T.ex = [-0.2 - Math.max(0, -Math.sin(p)) * 0.3, -0.2 - Math.max(0, Math.sin(p)) * 0.3];
      T.bob = Math.abs(Math.cos(p)) * 0.022 * a; T.spine += 0.04 * a; T.hipY = Math.sin(p) * 0.07 * a; T.hipZ = Math.cos(p) * 0.025 * a;
      T.headY = -T.hipY * 0.6;
    } else if (s === 'namaste' || s === 'bow' || s === 'aarti') {
      // anjali mudra: palms pressed together before the heart
      T.sx = [-0.5, -0.5]; T.sz = [0.38, -0.38]; T.ex = [-1.85, -1.85]; T.ez = [0.55, -0.55]; T.wx = [0.25, 0.25];
      if (s === 'bow') { const k = Math.sin(Math.min(1, this.stateTime / 2.4) * Math.PI); T.spine += 0.28 * k; T.chest = 0.18 * k; T.neck = 0.2 * k; T.headX = 0.15 * k; T.kn = [0.1 * k, 0.1 * k]; }
      if (s === 'aarti') { T.spine += 0.03 + Math.sin(t * 1.6 + this.seed) * 0.025; T.headX = 0.08; T.hipZ = Math.sin(t * 0.8 + this.seed) * 0.02; }
    } else if (s === 'offer') {
      const k = Math.sin(Math.min(1, this.stateTime / 1.6) * Math.PI);
      T.sx = [-1.1 * k - 0.1, -1.1 * k - 0.1]; T.sz = [0.18, -0.18]; T.ex = [-0.4, -0.4]; T.wx = [-0.5 * k, -0.5 * k]; T.spine += 0.14 * k; T.headX = 0.15 * k;
    } else if (s === 'ring') {
      const k = Math.min(1, this.stateTime / 0.35), pull = Math.sin(this.stateTime * 9) * 0.15;
      T.sx = [-2.7 * k + pull, -0.1]; T.sz = [-0.15, 0.08]; T.ex = [-0.25, -0.12]; T.headX = -0.25 * k;
    } else if (s === 'meditate') {
      // sukhasana, palms up on the thighs; the chest rises and falls with the breath
      const br = this.breath ?? (0.5 + 0.5 * Math.sin(t * 0.6 + this.seed));
      T.pose = this.mudra === 'nadi' ? SIT_NADI : SIT; T.seat = SEAT; T.spine = -0.01 * br; T.chest = -0.035 * br; T.neck = 0.05 + 0.03 * br; T.headX = 0.06;
    } else if (s === 'aartiPriest') {
      const a = this.lampAngle || 0;
      T.sx = [-1.25 + Math.sin(a) * 0.35, -0.9]; T.sz = [0.1 + Math.cos(a) * 0.3, -0.3]; T.ex = [-0.6, -1.4]; T.ez = [0, -0.5]; T.headX = 0.1;
    } else {
      // idle: breathing, a gentle weight shift, looking around now and then
      T.sx = [Math.sin(t * 0.8 + this.seed) * 0.03, -Math.sin(t * 0.8 + this.seed) * 0.03];
      T.chest = Math.sin(t * 1.3 + this.seed) * 0.012; T.hipZ = Math.sin(t * 0.35 + this.seed) * 0.02; T.kn = [0.04 + Math.max(0, Math.sin(t * 0.35 + this.seed)) * 0.06, 0.04 + Math.max(0, -Math.sin(t * 0.35 + this.seed)) * 0.06];
      T.headY = Math.sin(t * 0.23 + this.seed * 3) * 0.35 * Math.max(0, Math.sin(t * 0.11 + this.seed)); T.bob = Math.sin(t * 1.3 + this.seed) * 0.003;
    }
    // things carried change the arm pose while walking or standing
    if (c.carry === 'thali' && (s === 'walk' || s === 'idle')) { T.sx[1] = -0.75; T.sz[1] = -0.05; T.ex[1] = -1.05; T.wx[1] = 1.1; }
    if (c.carry === 'cane' && (s === 'walk' || s === 'idle')) { T.sx[0] = -0.25 + (s === 'walk' ? -Math.sin(this.walkPhase) * 0.15 : 0); T.ex[0] = -0.3; T.sz[0] = -0.12; }
    return T;
  }

  update(dt, t) {
    this.stateTime += dt;
    if (this.state === 'walk') this.walkPhase += dt * (4 + this.speed * 2.6) * (this.config.age === 'elder' ? 0.85 : 1);
    const T = this._targets(t), b = this.b;
    // sitting down and standing up are slower than everyday movement
    const seated = this.state === 'meditate' || b.hips.position.y < this.rest.hips.y - 0.1;
    const k = 1 - Math.exp(-dt * (seated ? 3.2 : 12));
    const L = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    const R = (bone, x, y = 0, z = 0) => { const r = b[bone].rotation, p = T.pose && T.pose[bone]; if (p) { x = p[0]; y = p[1]; z = p[2]; } L(r, 'x', x); L(r, 'y', y); L(r, 'z', z); };
    const arm = [['shR', 'elR', 'wrR'], ['shL', 'elL', 'wrL']];
    arm.forEach(([sh, el, wr], i) => { R(sh, T.sx[i], 0, T.sz[i]); R(el, T.ex[i], T.ez[i] * 0.6, T.ez[i] * 0.5); R(wr, T.wx[i]); });
    [['thR', 'knR', 'anR'], ['thL', 'knL', 'anL']].forEach(([th, kn, an], i) => { R(th, T.th[i] - T.kn[i] * 0.35); R(kn, T.kn[i]); R(an, T.an[i] + T.kn[i] * 0.25 - T.th[i] * 0.3); });
    if (T.pose) { const sh = T.chest; b.shL.rotation.z += -sh * 0.4 * k; b.shR.rotation.z += sh * 0.4 * k; }   // shoulders lift a touch on the in-breath
    L(b.spine.rotation, 'x', T.spine); L(b.chest.rotation, 'x', T.chest); L(b.chest.rotation, 'y', -T.hipY * 0.8);
    L(b.neck.rotation, 'x', T.neck); L(b.head.rotation, 'x', T.headX); L(b.head.rotation, 'y', T.headY);
    L(b.hips.rotation, 'y', T.hipY); L(b.hips.rotation, 'z', T.hipZ);
    // garments drape over the lap as the hips come down
    if (this.mesh.morphTargetInfluences) { const m = this.mesh.morphTargetInfluences; m[0] += ((T.seat ? 1 : 0) - m[0]) * Math.min(1, k * 2.2); }   // the cloth settles a little ahead of the legs
    // the face: blinking, a wandering gaze, eyes closed in prayer, a gentle smile, chanting during aarti
    const st = this.state, prayer = (st === 'namaste' && this.stateTime > 1.2) || st === 'bow' || st === 'aarti' || (st === 'meditate' && this.stateTime > 1.5);
    this.blinkT = (this.blinkT ?? 1 + Math.random() * 3) - dt;
    if (this.blinkT <= 0) { this.blinkT = 2.2 + Math.random() * 4; this.blinkLeft = 0.15; }
    if (this.blinkLeft > 0) this.blinkLeft -= dt;
    const lidT = this.blinkLeft > 0 ? 1.0 : prayer ? 0.86 : st === 'walk' ? 0.12 : 0.06, lk = this.blinkLeft > 0 ? 0.65 : k * 0.6;
    for (const l of [b.lidL, b.lidR]) l.rotation.x += (lidT - l.rotation.x) * lk;
    if (!this.gazeT || t > this.gazeT) { this.gazeT = t + 1.2 + Math.random() * 3.5; this.gaze = [(Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.6]; }
    for (const e of [b.eyeL, b.eyeR]) { L(e.rotation, 'x', prayer ? 0.3 : this.gaze[0]); L(e.rotation, 'y', prayer ? 0 : this.gaze[1] + T.headY * -0.4); }
    const smile = st === 'offer' ? 1 : st === 'meditate' ? 0.4 : prayer ? 0.65 : st === 'walk' ? 0.3 : 0.45;
    const chant = st === 'aarti' ? Math.max(0, Math.sin(t * 6.2 + this.seed)) * (0.6 + 0.4 * Math.sin(t * 1.3 + this.seed)) : 0;
    L(b.jaw.rotation, 'x', chant * 0.1);
    const ms = (bone, sx) => { const r = this.rest[bone]; b[bone].position.x += (r.x + sx * smile * 0.0022 - b[bone].position.x) * k; b[bone].position.y += (r.y + smile * 0.0036 - b[bone].position.y) * k; };
    ms('mouthL', 1); ms('mouthR', -1);
    for (const n of ['browL', 'browR']) b[n].position.y += (this.rest[n].y + smile * 0.0012 + (st === 'ring' ? 0.003 : 0) - (prayer ? 0.0008 : 0) - b[n].position.y) * k;
    // keep the feet on the ground as the knees bend
    const drop = T.seat ?? (1 - Math.cos(Math.min(b.knL.rotation.x, b.knR.rotation.x))) * 0.42 * 0.6;
    b.hips.position.y += (this.rest.hips.y + T.bob - drop - b.hips.position.y) * k;
  }

  handWorld(side = 1) { const v = new THREE.Vector3(0, -0.09, 0); return (side === 1 ? this.b.wrR : this.b.wrL).localToWorld(v); }
  chestWorld() { const v = new THREE.Vector3(0, 0.12, 0.14); return this.b.chest.localToWorld(v); }
}
