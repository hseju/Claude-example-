import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Devotees: cute, rigged characters built in code.
//
// Each devotee is about two and a half heads tall: a big round head with shiny eyes, rosy cheeks and a small smile,
// a rounded body, short limbs, mitten hands and bare feet. A person reads from skin tone, hair, attire, marks and
// jewellery rather than from a detailed face. Each is one SkinnedMesh on a 27-bone skeleton (hips, spine, chest, neck,
// head, arms with elbows and wrists, legs with knees and ankles, eyes, lids, brows, jaw and mouth corners), drawn in
// 2-4 draw calls. Clothing: saree with pleats, zari border and a pallu over the shoulder; kurta with collar, placket and
// churidar; dhoti with gold border, front pleats and angavastram; salwar kameez with dupatta. Jewellery, forehead
// marks, facial hair, glasses, puja thalis and walking sticks add individuality.

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


// ------------------------------------------------------------------ proportions
// A cute devotee: about two and a half heads tall, a big round head with shiny eyes and rosy cheeks, a small
// rounded body, short limbs and mitten hands. Identity comes from skin tone, hair, attire, marks and jewellery.
const HC = 1.02, HR = [0.285, 0.262, 0.255];   // head centre and radii
// hair and beard caps share the head's grid, so where they meet the skin the line is smooth
const HSEG = [56, 40];
const surfZ = (x, y) => HR[2] * Math.sqrt(Math.max(0, 1 - (x / HR[0]) ** 2 - ((y - HC) / HR[1]) ** 2));
const THIGH = 0.165;

// ------------------------------------------------------------------ poses solved against this skeleton (see README)
export const SEAT = 0.19;   // the hips come down onto a cushion
const SIT = {
  thL: [-2.341, 1.174, 1.417], knL: [1.559, 0, 0], anL: [0.832, -0.036, -0.009],
  thR: [-1.917, -1.069, -1.071], knR: [1.87, 0, 0], anR: [0.687, 0.128, 0.035],
  shL: [-0.327, 1.049, 0.067], elL: [0, 0.12, 0], wrL: [-0.096, 0.542, -0.911],
  shR: [-0.315, -0.806, -0.058], elR: [0, -0.671, 0], wrR: [-0.046, -0.235, 0.94],
};
const SIT_NADI = { ...SIT, shR: [-1.473, 0.649, 0.02], elR: [-1.069, 0.735, 0], wrR: [0.163, 0.369, -0.577] };
const NAMASTE = { shL: [-1.047, -0.92, -0.418], elL: [-0.792, -0.056, 0], wrL: [-0.903, -0.534, 0.774], shR: [-1.049, 0.924, 0.42], elR: [-0.79, 0.159, 0], wrR: [-0.838, 0.48, -0.882] };
const OFFER = { shL: [-0.241, 1.188, -0.875], elL: [0, 0.187, 0], wrL: [-0.128, -0.013, -0.379], shR: [-0.894, 0.579, 0.213], elR: [-0.547, -1.12, 0], wrR: [-0.367, -0.685, -0.08] };
const RING = { shR: [-2.301, 0.003, 0.191], elR: [-0.294, 0.03, 0], wrR: [-0.208, 0.058, -0.159] };
const PRIEST = { shL: [-1.154, -0.681, -0.226], elL: [-0.915, 1.295, 0], wrL: [-0.661, 0.354, 0.624], shR: [-1.148, 0.676, 0.225], elR: [-0.917, -1.259, 0], wrR: [-0.658, -0.38, -0.639] };
const blendPose = (a, b, k) => { const o = {}; for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) { const p = a[n] || [0, 0, 0], q = b[n] || [0, 0, 0]; o[n] = p.map((v, i) => v + (q[i] - v) * k); } return o; };

// where the folded legs and the cushion are once seated (root space, floor at 0): capsules [a, b, radius a, radius b]
const LAP = [
  [[0.075, 0.21, 0], [0.146, 0.12, 0.119], 0.066, 0.056], [[0.146, 0.12, 0.119], [-0.006, 0.081, 0.155], 0.05, 0.045], [[-0.006, 0.081, 0.155], [-0.075, 0.04, 0.208], 0.04, 0.03],
  [[-0.075, 0.21, 0], [-0.152, 0.12, 0.115], 0.066, 0.056], [[-0.152, 0.12, 0.115], [0.003, 0.085, 0.097], 0.05, 0.045], [[0.003, 0.085, 0.097], [0.08, 0.04, 0.136], 0.04, 0.03],
];
const CUSHION = { x: 0, z: -0.02, r: 0.27, y: 0.15 };
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
const smax = (a, b, k = 0.02) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (a - b) / k)); return b + (a - b) * h + k * h * (1 - h); };
// cloth below `top` falls outward over the lap: a morph delta in bind space
function lapDrape(top, hem, reach, lift = 0.016, minY = 0.01, legExtra = 0) {
  return (x, y, z) => {
    if (y >= top) return null;
    const t = Math.min(1, (top - y) / (top - hem)), th = Math.atan2(x, z), r0 = Math.hypot(x, z);
    const R = Math.max(r0, reach(th)), r = r0 + (R - r0) * Math.pow(t, 0.75);
    const nx = r0 > 1e-4 ? x / r0 : Math.sin(th), nz = r0 > 1e-4 ? z / r0 : Math.cos(th);
    const px = nx * r, pz = nz * r, yTop = top - SEAT, fall = yTop - (yTop - minY) * Math.pow(t, 1.6);
    const under = lapHeight(px, pz, legExtra), py = under > -1 ? smax(fall, under + lift) : Math.max(minY, fall);
    return [px - x, py + SEAT - y, pz - z];
  };
}
const lobes = (th, base, k) => base + k * Math.max(Math.pow(Math.max(0, Math.cos(th - 0.75)), 1.5), Math.pow(Math.max(0, Math.cos(th + 0.75)), 1.5));

// ------------------------------------------------------------------ the figure
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'thL', 'knL', 'anL', 'thR', 'knR', 'anR', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR', 'jaw', 'mouthL', 'mouthR'];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
// the mouth corners hang from the head, so opening the mouth (the jaw's scale) leaves the smile alone
const PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', elL: 'shL', wrL: 'elL', shR: 'chest', elR: 'shR', wrR: 'elR', thL: 'hips', knL: 'thL', anL: 'knL', thR: 'hips', knR: 'thR', anR: 'knR', eyeL: 'head', eyeR: 'head', lidL: 'head', lidR: 'head', browL: 'head', browR: 'head', jaw: 'head', mouthL: 'head', mouthR: 'head' };
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

function buildFigure(cfg) {
  const fem = cfg.presentation === 'fem', masc = !fem, elder = cfg.age === 'elder';
  const bw = { slim: 0.92, average: 1, broad: 1.1 }[cfg.build] || 1, lb = (k) => k * bw;
  const sw = 0.148 * (0.96 + (bw - 1) * 0.5);
  const ey = 0.995, ex = 0.098, eyeZ = surfZ(ex, ey) - 0.004, mouthZ = surfZ(0, 0.92) - 0.002;
  const J = {
    root: [0, 0, 0], hips: [0, 0.42, 0], spine: [0, 0.5, 0], chest: [0, 0.6, 0], neck: [0, 0.73, 0], head: [0, 0.77, 0],
    shL: [sw, 0.69, 0], elL: [sw + 0.005, 0.565, 0], wrL: [sw + 0.01, 0.44, 0.005], shR: [-sw, 0.69, 0], elR: [-sw - 0.005, 0.565, 0], wrR: [-sw - 0.01, 0.44, 0.005],
    thL: [0.075, 0.4, 0], knL: [0.077, 0.235, 0.008], anL: [0.077, 0.075, -0.004], thR: [-0.075, 0.4, 0], knR: [-0.077, 0.235, 0.008], anR: [-0.077, 0.075, -0.004],
    eyeL: [ex, ey, eyeZ], eyeR: [-ex, ey, eyeZ], lidL: [ex, ey, eyeZ], lidR: [-ex, ey, eyeZ],
    browL: [ex, 1.072, surfZ(ex, 1.072)], browR: [-ex, 1.072, surfZ(ex, 1.072)], jaw: [0, 0.92, mouthZ], mouthL: [0.034, 0.936, surfZ(0.034, 0.936)], mouthR: [-0.034, 0.936, surfZ(0.034, 0.936)],
  };
  const W = {
    torso: (x, y) => { const a = sstep(J.hips[1] - 0.03, J.spine[1] + 0.03, y), b = sstep(J.spine[1] + 0.02, J.chest[1] + 0.05, y); return [[BI.hips, 1 - a], [BI.spine, a * (1 - b)], [BI.chest, a * b]]; },
    neck: (x, y) => { const k = sstep(J.neck[1] - 0.01, J.head[1] + 0.02, y); return [[BI.chest, 1 - k], [BI.neck, k]]; },
    arm: (side) => { const sh = BI['sh' + side], el = BI['el' + side], wr = BI['wr' + side], yS = J['sh' + side][1], yE = J['el' + side][1], yW = J['wr' + side][1];
      return (x, y) => { if (y > yE + 0.035) { const c = sstep(yS - 0.02, yS + 0.04, y) * 0.5; return [[sh, 1 - c], [BI.chest, c]]; }
        if (y > yE - 0.035) { const t = sstep(yE - 0.035, yE + 0.035, y); return [[el, 1 - t], [sh, t]]; }
        if (y > yW + 0.02) return [[el, 1]]; const t = sstep(yW - 0.01, yW + 0.02, y); return [[wr, 1 - t], [el, t]]; }; },
    leg: (side) => { const th = BI['th' + side], kn = BI['kn' + side], an = BI['an' + side], yT = J['th' + side][1], yK = J['kn' + side][1], yA = J['an' + side][1];
      return (x, y) => { if (y > yK + 0.035) { const c = sstep(yT - 0.04, yT + 0.03, y) * 0.6; return [[th, 1 - c], [BI.hips, c]]; }
        if (y > yK - 0.035) { const t = sstep(yK - 0.035, yK + 0.035, y); return [[kn, 1 - t], [th, t]]; }
        if (y > yA + 0.025) return [[kn, 1]]; const t = sstep(yA - 0.008, yA + 0.025, y); return [[an, 1 - t], [kn, t]]; }; },
  };
  const P = new Parts(), skin = cfg.skin, hairC = cfg.hairColor;
  const cloth = CLOTH_COLORS.find(c => c.id === cfg.color) || CLOTH_COLORS[0], base = cloth.base, accent = cloth.accent;
  const gold = '#e2b555', silver = '#d9dade', ink = '#2a1a14';
  const at = (g, j) => g.translate(J[j][0], J[j][1], J[j][2]);
  // bind space -> a pose, for a point carried rigidly by `bone`
  const posedFrame = (pose, bone) => {
    const o = {}; for (const n of BONES) { o[n] = new THREE.Object3D(); if (n !== 'root') { const p = J[PARENT[n]], j = J[n]; o[n].position.set(j[0] - p[0], j[1] - p[1], j[2] - p[2]); o[PARENT[n]].add(o[n]); } if (pose[n]) o[n].rotation.set(...pose[n]); }
    o.root.updateMatrixWorld(true); return o[bone].matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(-J[bone][0], -J[bone][1], -J[bone][2]));
  };
  const radAt = (prof, y) => { for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) return r0 + (r1 - r0) * (y - y0) / ((y1 - y0) || 1); } return prof[prof.length - 1][0]; };
  const over = (prof, from, to, extra, steps = 9, flare = 0) => { const out = []; for (let i = 0; i <= steps; i++) { const y = from + (to - from) * i / steps; out.push([radAt(prof, y) + extra + flare * Math.pow(1 - i / steps, 2), y]); } return out; };
  // a small piece laid on the head's surface, turned to face out along the surface normal
  const onHead = (geo, x, y, lift = 0) => { const z = surfZ(x, y), n = new V(x / HR[0] ** 2, (y - HC) / HR[1] ** 2, z / HR[2] ** 2).normalize(); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), n)); geo.translate(x + n.x * lift, y + n.y * lift, z + n.z * lift); return geo; };
  const disc = (rx, ry, rz) => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(rx, ry, rz); return g; };
  const tubeOnFace = (pts, r, lift = 0.003) => tubeOf(pts.map(([x, y]) => { const z = surfZ(x, y), n = new V(x / HR[0] ** 2, (y - HC) / HR[1] ** 2, z / HR[2] ** 2).normalize(); return new V(x + n.x * lift, y + n.y * lift, z + n.z * lift); }), r, 14, 5);

  // ---- the head: round, with small ears and a button nose
  const head = new THREE.SphereGeometry(1, ...HSEG); head.scale(HR[0], HR[1], HR[2]); head.translate(0, HC, 0);
  P.add(head, BI.head, skin, MAT.body, (c, x, y) => c.multiplyScalar(0.97 + 0.05 * (y - HC) / HR[1]));
  for (const s of [1, -1]) P.add(ell(1, 0.04, 0.054, 0.03, s * 0.28, 0.995, -0.01), BI.head, darken(skin, 0.95));
  P.add(onHead(disc(0.017, 0.013, 0.012), 0, 0.962, -0.002), BI.head, darken(skin, 0.9));
  // eyes: big and dark with catchlights; closed, they become gentle curves (the lid bones)
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    const x = s * ex;
    P.add(ell(1, 0.036, 0.045, 0.018, x, ey, eyeZ), BI['eye' + side], ink);
    P.add(ell(1, 0.012, 0.012, 0.008, x + 0.012, ey + 0.017, eyeZ + 0.013), BI['eye' + side], '#ffffff');
    P.add(ell(1, 0.006, 0.006, 0.005, x - 0.012, ey - 0.015, eyeZ + 0.012), BI['eye' + side], '#ffffff');
    P.add(tubeOf([new V(x - 0.034, ey + 0.004, eyeZ + 0.012), new V(x, ey - 0.012, eyeZ + 0.019), new V(x + 0.034, ey + 0.004, eyeZ + 0.012)], 0.0062, 12, 5), BI['lid' + side], ink);
    const browC = hairC === HAIR_COLORS[4] || hairC === HAIR_COLORS[3] ? darken(hairC, 0.7) : darken(hairC, 0.95);
    P.add(tubeOnFace([[x - 0.03, 1.07], [x, 1.079], [x + 0.03, 1.07]], 0.0058), BI['brow' + side], browC);
    P.add(onHead(disc(0.042, 0.025, 0.005), s * 0.163, 0.94, -0.001), BI.head, mix(skin, '#ff8a80', 0.5));
  }
  // a small smile (the corners lift with the mouth bones) and an open mouth that appears when chanting
  const smile = tubeOnFace([[-0.034, 0.936], [-0.017, 0.926], [0, 0.923], [0.017, 0.926], [0.034, 0.936]], 0.0054, 0.0025);
  P.add(smile, BI.head, '#7a2c22', MAT.body, null, (x) => x > 0.01 ? [[BI.mouthL, sstep(0.01, 0.034, x)], [BI.head, 1 - sstep(0.01, 0.034, x)]] : x < -0.01 ? [[BI.mouthR, sstep(0.01, 0.034, -x)], [BI.head, 1 - sstep(0.01, 0.034, -x)]] : [[BI.head, 1]]);
  P.add(ell(1, 0.022, 0.027, 0.008, 0, 0.92, mouthZ), BI.jaw, '#5a1e16');
  P.add(ell(1, 0.012, 0.008, 0.005, 0, 0.911, mouthZ + 0.004), BI.jaw, '#e8796b');
  // forehead marks
  if (cfg.mark === 'bindi') P.add(onHead(disc(0.016, 0.016, 0.004), 0, 1.103, 0.001), BI.head, '#c8102e');
  if (cfg.mark === 'tilak') { P.add(tubeOnFace([[-0.018, 1.13], [-0.009, 1.096], [0, 1.089], [0.009, 1.096], [0.018, 1.13]], 0.0045), BI.head, '#f3efe6'); P.add(tubeOnFace([[0, 1.125], [0, 1.097]], 0.004, 0.006), BI.head, '#e8481e'); }
  if (cfg.mark === 'tripundra') { for (const y of [1.145, 1.128, 1.111]) P.add(tubeOnFace([[-0.065, y + 0.004], [-0.03, y], [0, y - 0.001], [0.03, y], [0.065, y + 0.004]], 0.0038), BI.head, '#f3efe6'); P.add(onHead(disc(0.011, 0.011, 0.003), 0, 1.128, 0.005), BI.head, '#c8102e'); }
  // glasses
  if (cfg.glasses) {
    for (const s of [1, -1]) { P.add(torus(0.05, 0.0055, s * ex, ey, eyeZ + 0.034, 0, 26), BI.head, '#4a3020'); P.add(tubeOf([new V(s * (ex + 0.05), ey + 0.01, eyeZ + 0.03), new V(s * 0.24, ey + 0.02, 0.12), new V(s * 0.28, ey + 0.01, 0.0)], 0.0045, 8, 4), BI.head, '#4a3020'); }
    P.add(tubeOf([new V(-0.048, ey + 0.008, eyeZ + 0.036), new V(0, ey + 0.016, eyeZ + 0.042), new V(0.048, ey + 0.008, eyeZ + 0.036)], 0.005, 8, 4), BI.head, '#4a3020');
  }
  // earrings
  if (fem) for (const s of [1, -1]) {
    P.add(ell(1, 0.014, 0.014, 0.014, s * 0.288, 0.935, 0.0), BI.head, gold, MAT.metal);
    if (cfg.jewellery === 'festive') { const c = new THREE.ConeGeometry(0.022, 0.034, 10); c.translate(s * 0.288, 0.905, 0); P.add(c, BI.head, gold, MAT.metal); }
  }

  // ---- hair: a cap that follows a hairline; extra pieces for each style
  const hairShade = (c, x, y, z) => c.multiplyScalar(0.86 + 0.14 * Math.sin(x * 70 + z * 40 + y * 9));
  const covered = cfg.headwear === 'turban' || cfg.headwear === 'topi';
  // region(nx, ny, nz) > 0 inside the hair. Outside, the cap sinks just under the skin, and the thickness tapers across the
  // edge, so the hairline is where two smooth surfaces cross: a clean curve rather than the steps of the mesh grid
  const cap = (scale, region0, bump = 0) => {
    const region = covered ? (x, y, z) => Math.min(region0(x, y, z), 0.3 - y) : region0;
    // the region's value divided by its slope: roughly the distance to the hairline, so the taper is even all round
    const dist = (x, y, z) => { const e = 0.01, v = region(x, y, z), gx = (region(x + e, y, z) - region(x - e, y, z)) / (2 * e), gy = (region(x, y + e, z) - region(x, y - e, z)) / (2 * e), gz = (region(x, y, z + e) - region(x, y, z - e)) / (2 * e), dot = gx * x + gy * y + gz * z;
      return v / Math.max(0.3, Math.hypot(gx - dot * x, gy - dot * y, gz - dot * z)); };
    const g = new THREE.SphereGeometry(1, ...HSEG), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i), m = sstep(-0.1, 0.16, dist(nx, ny, nz));
      let k = 0.975 + (scale - 0.975) * m; if (bump) k += m * bump * Math.max(0, Math.sin(nx * 17) * Math.sin(ny * 15) * Math.sin(nz * 16));
      p.setXYZ(i, nx * HR[0] * k, HC + ny * HR[1] * k, nz * HR[2] * k);
    }
    g.computeVertexNormals(); P.add(g, BI.head, hairC, MAT.body, hairShade);
  };
  const hairline = (front) => (nx, ny, nz) => { const f = sstep(-0.15, 0.35, nz), s = sstep(0.55, 0.88, Math.abs(nx)); return ny - (f * (front(nx) * (1 - s) - 0.12 * s) + (1 - f) * -0.6); };
  const st = cfg.hair;
  if (st === 'bald') cap(1.03, (nx, ny, nz) => Math.min(ny + 0.42, 0.1 - ny - 0.25 * Math.max(0, nz + 0.6), -0.04 - nz));   // a fringe round the back, ear to ear
  else if (st === 'cropped') cap(1.035, hairline((nx) => 0.5 - 0.2 * nx * nx));
  else if (st === 'curly') cap(1.09, hairline((nx) => 0.45 - 0.25 * nx * nx + 0.05 * Math.sin(nx * 20)), 0.05);
  else if (st === 'short' || st === 'topknot') cap(1.06, hairline((nx) => 0.42 - 0.18 * nx * nx + (nx > 0.08 && nx < 0.55 ? 0.06 : 0)));
  else if (st === 'wavy') cap(1.07, hairline((nx) => 0.38 - 0.2 * nx * nx + 0.04 * Math.sin(nx * 14)), 0.015);
  else cap(1.065, hairline((nx) => 0.34 - 0.1 * Math.abs(nx) + (Math.abs(nx) < 0.03 ? 0.25 : 0)));   // a centre parting for long hair
  if (!covered) {
    if (st === 'bun') {
      P.add(ell(1, 0.1, 0.092, 0.09, 0, HC + 0.2, -0.15), BI.head, hairC, MAT.body, hairShade);
      const u = new V(1, 0, 0), v = new V(0, 0.8, 0.6), c0 = new V(0, HC + 0.2, -0.15);
      for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2, p = c0.clone().addScaledVector(u, Math.cos(a) * 0.1).addScaledVector(v, Math.sin(a) * 0.1); P.add(ell(1, 0.017, 0.017, 0.017, p.x, p.y, p.z), BI.head, '#fffaf0'); }
    }
    if (st === 'topknot') { P.add(ell(1, 0.065, 0.06, 0.065, 0, HC + 0.272, -0.03), BI.head, hairC, MAT.body, hairShade); P.add(torus(0.042, 0.009, 0, HC + 0.235, -0.03, Math.PI / 2, 16), BI.head, darken(hairC, 0.7)); }
    if (st === 'cropped') { const c = new THREE.ConeGeometry(0.022, 0.07, 8); c.rotateX(-0.6); c.translate(0, HC + 0.27, -0.11); P.add(c, BI.head, hairC, MAT.body); }
    if (st === 'braid') {
      const pts = [[-0.2, 0.92, -0.06], [-0.205, 0.84, 0.0], [-0.2, 0.76, 0.06], [-0.192, 0.69, 0.11], [-0.185, 0.62, 0.135], [-0.18, 0.55, 0.15], [-0.176, 0.49, 0.155]];
      pts.forEach(([x, y, z], i) => P.add(ell(1, 0.045 - i * 0.003, 0.046, 0.04 - i * 0.002, x, y, z), y > 0.8 ? BI.head : BI.chest, hairC, MAT.body, hairShade));
      const t = new THREE.ConeGeometry(0.03, 0.05, 8); t.rotateX(Math.PI); t.translate(-0.175, 0.44, 0.156); P.add(t, BI.chest, '#c8102e');
    }
    if (st === 'ponytail') {
      P.add(ell(1, 0.045, 0.045, 0.045, 0, HC + 0.1, -0.262), BI.head, hairC, MAT.body, hairShade);
      [[0, HC + 0.04, -0.3, 0.05], [0, 0.95, -0.31, 0.047], [0, 0.86, -0.29, 0.042], [0, 0.78, -0.26, 0.035]].forEach(([x, y, z, r]) => P.add(ell(1, r, 0.055, r, x, y, z), y > 0.85 ? BI.head : BI.chest, hairC, MAT.body, hairShade));
    }
    if (st === 'open') P.add(ell(1, 0.25, 0.27, 0.09, 0, 0.86, -0.17), BI.chest, hairC, MAT.body, hairShade);
  }
  // headwear: a wrapped safa turban, or a white Gandhi topi
  if (cfg.headwear === 'turban') {
    const tc = cloth.id === 'ivory' ? '#e8731c' : base, tc2 = darken(tc, 0.82);
    for (let i = 0; i < 4; i++) { const g = new THREE.TorusGeometry(0.262 - i * 0.022, 0.05, 10, 36); g.rotateX(Math.PI / 2 + (i % 2 ? 0.12 : -0.1)); g.scale(1, 1, 0.92); g.translate(0, HC + 0.085 + i * 0.045, -0.005); P.add(g, BI.head, i % 2 ? tc : tc2); }
    P.add(ell(1, 0.22, 0.11, 0.21, 0, HC + 0.21, -0.005), BI.head, tc);
    const tail = ell(1, 0.08, 0.12, 0.03, 0, 0, 0); tail.rotateZ(-0.6); tail.translate(-0.22, HC + 0.2, -0.13); P.add(tail, BI.head, tc2);
    P.add(ell(1, 0.022, 0.022, 0.012, 0, HC + 0.16, 0.262), BI.head, gold, MAT.metal);
  } else if (cfg.headwear === 'topi') {
    const g = new THREE.SphereGeometry(1, 24, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setXYZ(i, p.getX(i) * 0.27, Math.max(0, y) * 0.11, p.getZ(i) * 0.2 * (1 - 0.55 * Math.max(0, y))); }
    g.computeVertexNormals(); g.rotateX(-0.12); g.translate(0, HC + 0.19, -0.01); P.add(g, BI.head, '#f6f3ea');
  }
  // facial hair
  if (masc && cfg.facial === 'moustache') for (const s of [1, -1]) { const m = onHead(disc(0.032, 0.012, 0.012), s * 0.022, 0.948, 0.002); P.add(m, BI.head, hairC); }
  if (masc && cfg.facial === 'beard') {
    const g = new THREE.SphereGeometry(1, ...HSEG), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i), y = HC + ny * HR[1], x = nx * HR[0];
      // along the jaw and chin, below the mouth in the middle and up to the cheeks at the sides
      const yb = 0.905 + 0.045 * sstep(0.05, 0.19, Math.abs(x)), m = sstep(-0.01, 0.03, yb - y) * sstep(-0.25, 0.05, nz);
      const k = 0.975 + (1.04 + 0.03 * Math.max(0, -ny - 0.7) - 0.975) * m; p.setXYZ(i, nx * HR[0] * k, HC + ny * HR[1] * k, nz * HR[2] * k); }
    g.computeVertexNormals(); P.add(g, BI.head, hairC, MAT.body, hairShade);
    for (const s of [1, -1]) P.add(onHead(disc(0.03, 0.011, 0.011), s * 0.021, 0.947, 0.004), BI.head, hairC);
  }

  // ---- the body: a rounded torso, short arms with mitten hands, short legs with bare feet
  const tp = [[0.001, 0.38], [0.11, 0.385], [0.145, 0.42], [0.152, 0.5], [0.15, 0.58], [0.155, 0.65], [0.13, 0.715], [0.07, 0.745], [0.001, 0.75]].map(([r, y]) => [lb(r), y]);
  P.add(lathe(tp, 28).scale(1, 1, 0.82), BI.chest, skin, MAT.body, null, W.torso);
  P.add(new THREE.CylinderGeometry(0.05, 0.056, 0.1, 14).translate(0, 0.77, 0), BI.neck, darken(skin, 0.94), MAT.body, null, W.neck);
  const ARM = [[0.001, 0.045], [0.036, 0.036], [0.05, 0.0], [0.049, -0.06], [0.046, -0.125], [0.044, -0.19], [0.04, -0.245], [0.001, -0.258]];
  const LEGP = [[0.001, 0.04], [0.05, 0.026], [0.062, 0.0], [0.06, -0.08], [0.054, -0.165], [0.05, -0.25], [0.046, -0.315], [0.001, -0.33]];
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    P.add(at(lathe(ARM, 16), 'sh' + side), BI['sh' + side], skin, MAT.body, null, W.arm(side));
    P.add(at(ell(1, 0.043, 0.058, 0.05, 0, -0.045, 0.004), 'wr' + side), BI['wr' + side], skin);
    P.add(at(ell(1, 0.017, 0.027, 0.018, 0, -0.026, 0.042), 'wr' + side), BI['wr' + side], darken(skin, 0.97));
    P.add(at(lathe(LEGP, 16), 'th' + side), BI['th' + side], skin, MAT.body, null, W.leg(side));
    const alta = fem && cfg.jewellery === 'festive';
    P.add(at(ell(1, 0.05, 0.035, 0.085, 0, -0.035, 0.035), 'an' + side), BI['an' + side], darken(skin, 0.93), MAT.body, (c, x, y) => { if (alta && y < J['an' + side][1] - 0.058) c.set('#b3121b'); });
    if (fem) P.add(at(torus(0.05, 0.005, 0, -0.012, 0, Math.PI / 2, 18), 'an' + side), BI['an' + side], silver, MAT.metal);
    // bangles near the wrist, or a kada / sacred thread
    if (fem) { const n = cfg.jewellery === 'festive' ? 4 : 2; for (let i = 0; i < n; i++) P.add(at(torus(0.05, 0.0058, 0, -0.103 + i * 0.011, 0, Math.PI / 2, 18), 'el' + side), BI['el' + side], i % 2 ? ['#c8102e', '#1f7a3a', '#2a4fb0'][i % 3] : gold, i % 2 ? MAT.body : MAT.metal); }
    else if (s < 0) P.add(at(torus(0.05, 0.007, 0, -0.105, 0, Math.PI / 2, 18), 'elR'), BI.elR, silver, MAT.metal);
    else P.add(at(torus(0.048, 0.004, 0, -0.108, 0, Math.PI / 2, 18), 'elL'), BI.elL, '#c4161c');
  }
  // sleeves over the arms; trousers over the legs
  const sleeve = (len, color) => { for (const side of ['L', 'R']) { const prof = over(ARM, -len, 0.03, 0.008, 10, 0.004).concat([[0.044, 0.04], [0.02, 0.05], [0.001, 0.053]]); P.add(at(lathe(prof, 16), 'sh' + side), BI['sh' + side], color, MAT.body, null, W.arm(side)); P.add(at(torus(radAt(ARM, -len) + 0.01, 0.006, 0, -len, 0, Math.PI / 2, 18), 'sh' + side), BI['sh' + side], accent, MAT.body, null, W.arm(side)); } };
  const trousers = (color, puff) => { for (const side of ['L', 'R']) { const prof = over(LEGP, -0.31, 0.05, 0.008, 14).map(([r, y]) => [puff ? r + puff * Math.sin(Math.min(1, (y + 0.31) / 0.2) * Math.PI / 2) : r, y]); P.add(at(lathe(prof, 16), 'th' + side), BI['th' + side], color, MAT.body, (c, x, y) => c.multiplyScalar(0.93 + 0.07 * Math.sin(y * 120)), W.leg(side));
    for (let i = 0; i < 3; i++) P.add(at(torus(radAt(LEGP, -0.3 + i * 0.016) + 0.01 + (puff ? 0.004 : 0), 0.006, 0, -0.3 + i * 0.016, 0, Math.PI / 2, 16), 'th' + side), BI['th' + side], darken(color, 0.9 + (i % 2) * 0.1), MAT.body, null, W.leg(side)); } };

  // ---- clothes
  const tunic = (hem, sal) => {
    const prof = [[lb(sal ? 0.225 : 0.215), hem], [lb(0.2), 0.3], [lb(0.186), 0.4], [lb(0.176), 0.5], [lb(0.176), 0.6], [lb(0.178), 0.66], [lb(0.152), 0.72], [0.076, 0.762]];
    P.add(shell(dense(prof, 0.02), { sz: 0.86, seg: 40, hemWave: 0.003 }), BI.chest, '#ffffff', MAT.skirt, null, W.torso, lapDrape(0.45, hem, (th) => lobes(th, 0.18, sal ? 0.15 : 0.12), 0.018, 0.17, sal ? 0.025 : 0.006));
    P.add(new THREE.CylinderGeometry(0.06, 0.064, 0.032, 18, 1, true).translate(0, 0.772, 0.002), BI.chest, accent);
  };
  if (cfg.outfit === 'kurta') {
    tunic(0.2, false); sleeve(0.235, base); trousers('#f4eee2', 0);
    const fz = (y) => radAt([[0.176, 0.6], [0.178, 0.66], [0.152, 0.72], [0.076, 0.762]].map(([r, yy]) => [lb(r), yy]), y) * 0.86 + 0.003;
    P.add(tubeOf([0.755, 0.72, 0.68, 0.64, 0.61].map(y => new V(0, y, fz(y))), 0.005, 10, 4), BI.chest, gold, MAT.metal);
    for (const y of [0.735, 0.7, 0.665]) P.add(ell(1, 0.007, 0.007, 0.004, 0, y, fz(y) + 0.004), BI.chest, accent, MAT.metal);
  }
  if (cfg.outfit === 'salwar') {
    tunic(0.22, true); sleeve(0.17, base); trousers(mix(base, '#ffffff', 0.55), 0.028);
    P.add(ribbon([new V(0.13, 0.42, -0.17), new V(0.15, 0.62, -0.13), new V(0.158, 0.755, 0.0), new V(0.09, 0.66, 0.168), new V(0, 0.62, 0.188), new V(-0.09, 0.66, 0.168), new V(-0.158, 0.755, 0.0), new V(-0.15, 0.62, -0.13), new V(-0.13, 0.42, -0.17)],
      () => 0.085, { segs: 60, fold: 0.005, folds: 3, lift: 0.01 }), BI.chest, accent, MAT.body);
  }
  if (cfg.outfit === 'saree') {
    P.add(shell(dense([[lb(0.158), 0.5], [lb(0.16), 0.58], [lb(0.168), 0.65], [lb(0.142), 0.715], [0.075, 0.752]], 0.02), { sz: 0.86, seg: 36 }), BI.chest, accent, MAT.body, null, W.torso);
    sleeve(0.07, accent);
    const skirt = shell(dense([[lb(0.25), 0.02], [lb(0.235), 0.12], [lb(0.21), 0.28], [lb(0.185), 0.42], [lb(0.165), 0.5], [lb(0.158), 0.53]], 0.025), { sz: 0.86, pleats: 30, pleatFront: 0.55, hemWave: 0.004, seg: 48 });
    P.add(skirt, BI.hips, '#ffffff', MAT.skirt, null, null, lapDrape(0.5, 0.02, (th) => lobes(th, 0.2, 0.16)));
    P.add(torus(lb(0.166), 0.012, 0, 0.515, 0), BI.hips, base);
    P.add(ribbon([new V(-0.12, 0.47, 0.15), new V(-0.04, 0.58, 0.168), new V(0.07, 0.68, 0.152), new V(0.155, 0.752, 0.0), new V(0.155, 0.68, -0.13), new V(0.135, 0.5, -0.16), new V(0.12, 0.34, -0.17)],
      (u) => (u < 0.42 ? 0.13 - u * 0.08 : u < 0.55 ? 0.095 : 0.095 + (u - 0.55) * 0.2), { segs: 48, fold: 0.006, folds: 4 }), BI.chest, '#ffffff', MAT.ribbon);
    const ms = []; for (let i = 0; i <= 18; i++) { const a = -0.95 + i / 18 * 1.9; ms.push(new V(Math.sin(a) * 0.07, 0.72 + Math.cos(a) * 0.05 - 0.05, Math.cos(a) * 0.075 + 0.07)); }
    ms.forEach((p, i) => P.add(ell(0.0045, 1, 1, 1, p.x, p.y, p.z), BI.chest, i % 4 ? '#141414' : gold, i % 4 ? MAT.body : MAT.metal));
    P.add(ell(1, 0.012, 0.016, 0.006, 0, 0.665, 0.152), BI.chest, gold, MAT.metal);
  }
  if (cfg.outfit === 'dhoti') {
    // seated, the dhoti wraps over the folded legs rather than falling to the floor between them
    const dhotiLap = lapDrape(0.47, 0.1, (th) => lobes(th, 0.2, 0.15), 0.016, 0.1, 0.012);
    P.add(shell(dense([[lb(0.165), 0.38], [lb(0.168), 0.5], [lb(0.17), 0.6], [lb(0.172), 0.66], [lb(0.148), 0.72], [0.075, 0.758]], 0.02), { sz: 0.86, seg: 36 }), BI.chest, '#f6efe0', MAT.body, null, W.torso);
    sleeve(0.07, '#f6efe0');
    P.add(shell(dense([[lb(0.19), 0.1], [lb(0.186), 0.25], [lb(0.18), 0.38], [lb(0.17), 0.47], [lb(0.163), 0.5]], 0.025), { sz: 0.86, seg: 40, hemWave: 0.003 }), BI.hips, '#fbf7ee', MAT.body, null, null, dhotiLap);
    P.add(shell(dense([[lb(0.19) + 0.002, 0.1], [lb(0.188) + 0.002, 0.135]], 0.01), { sz: 0.86, seg: 40, hemWave: 0.003 }), BI.hips, gold, MAT.body, null, null, dhotiLap);   // gold border
    P.add(ribbon([new V(0, 0.49, lb(0.163) * 0.86), new V(0.003, 0.3, lb(0.18) * 0.86), new V(0, 0.12, lb(0.188) * 0.86)], () => 0.05, { segs: 14, fold: 0.004, folds: 3, lift: 0.004 }), BI.hips, '#f1e8d6', MAT.body, null, null, dhotiLap);   // front pleats, lying on the dhoti
    P.add(ribbon([new V(-0.13, 0.42, 0.165), new V(-0.04, 0.56, 0.17), new V(0.08, 0.68, 0.15), new V(0.155, 0.755, 0.0), new V(0.15, 0.66, -0.13), new V(0.13, 0.45, -0.165)], () => 0.08, { segs: 40, fold: 0.005, folds: 3, lift: 0.01 }), BI.chest, '#ffffff', MAT.ribbon);
    if (cfg.jewellery === 'festive') { for (let i = 0; i <= 20; i++) { const a = -1.0 + i / 20 * 2.0; P.add(ell(0.0065, 1, 1, 1, Math.sin(a) * 0.075, 0.72 + Math.cos(a) * 0.06 - 0.07, Math.cos(a) * 0.08 + 0.065), BI.chest, i === 10 ? '#7a3a1a' : '#5a2f1a'); } }
  }
  if (cfg.jewellery === 'festive' && cfg.outfit !== 'dhoti') for (let i = 0; i <= 16; i++) { const a = -0.9 + i / 16 * 1.8; P.add(ell(0.005, 1, 1, 1, Math.sin(a) * 0.068, 0.72 + Math.cos(a) * 0.055 - 0.055, Math.cos(a) * 0.075 + 0.072), BI.chest, gold, MAT.metal); }

  // ---- things carried: a puja thali with a lit diya, or a walking stick
  if (cfg.carry === 'thali') {
    // built level in the carrying pose, then taken back to the bind pose so it stays level in the hand
    const M = posedFrame({ ...OFFER, shR: [0, 0, -0.3], elR: [-0.12, 0, 0], wrR: [0, 0, 0] }, 'wrL'), back = M.clone().invert();
    const c = new V(J.wrL[0], J.wrL[1] - 0.045, J.wrL[2] + 0.004).applyMatrix4(M).add(new V(0, 0.05, 0));
    const put = (g) => g.applyMatrix4(back);
    P.add(put(new THREE.CylinderGeometry(0.075, 0.066, 0.01, 22).translate(c.x, c.y, c.z)), BI.wrL, gold, MAT.metal);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; P.add(put(ell(0.012, 1, 0.7, 1, c.x + Math.cos(a) * 0.047, c.y + 0.01, c.z + Math.sin(a) * 0.047)), BI.wrL, i % 2 ? '#f2900f' : '#d21f26'); }
    P.add(put(ell(0.015, 1, 0.5, 1, c.x, c.y + 0.01, c.z)), BI.wrL, '#a4532c');
    P.add(put(new THREE.ConeGeometry(0.007, 0.024, 8).translate(c.x, c.y + 0.027, c.z)), BI.wrL, '#ffffff', MAT.glow);
  }
  if (cfg.carry === 'cane') { const w = J.wrR; P.add(new THREE.CylinderGeometry(0.008, 0.01, 0.44, 6).translate(w[0], w[1] - 0.25, w[2] + 0.03), BI.wrR, '#5a3a22'); P.add(torus(0.022, 0.008, w[0], w[1] - 0.03, w[2] + 0.012, 0, 10), BI.wrR, '#5a3a22'); }

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
    const height = (c.presentation === 'fem' ? 0.97 : 1.02) * (c.age === 'elder' ? 0.96 : 1) * (c.age === 'child' ? 0.78 : 1);
    mesh.scale.setScalar(height);
    if (c.age === 'child') F.bones.head.scale.setScalar(1.08);
    this.mesh = mesh; this.b = F.bones; this.root.add(mesh);
    this.rest = {}; for (const [n, b] of Object.entries(F.bones)) this.rest[n] = b.position.clone();
    for (const n of ['lidL', 'lidR', 'jaw']) F.bones[n].scale.setScalar(0.001);
  }
  setConfig(c) { this.config = normalise({ ...DEFAULTS, ...c }); this.build(); }
  setState(s) { if (this.state !== s) { this.state = s; this.stateTime = 0; } }

  _targets(t) {
    const s = this.state, c = this.config, elder = c.age === 'elder';
    // arms hang a little away from the round body
    const T = { sx: [0, 0], sz: [-0.3, 0.3], ex: [-0.12, -0.12], ez: [0, 0], wx: [0, 0], th: [0, 0], kn: [0.04, 0.04], an: [0, 0], spine: elder ? 0.08 : 0.0, chest: 0, neck: elder ? 0.06 : 0, headX: 0, headY: 0, headZ: 0, hipY: 0, hipZ: 0, bob: 0 };
    if (s === 'walk') {
      const p = this.walkPhase, a = Math.min(1, this.speed / 2.2), stride = (c.outfit === 'saree' ? 0.42 : 0.55) * (elder ? 0.75 : 1);
      T.th = [Math.sin(p) * stride * a, -Math.sin(p) * stride * a];
      T.kn = [0.08 + Math.max(0, -Math.cos(p)) * 0.8 * a, 0.08 + Math.max(0, Math.cos(p)) * 0.8 * a];
      T.an = [-T.kn[0] * 0.25, -T.kn[1] * 0.25];
      T.sx = [-Math.sin(p) * 0.5 * a, Math.sin(p) * 0.5 * a];
      T.ex = [-0.2 - Math.max(0, -Math.sin(p)) * 0.3, -0.2 - Math.max(0, Math.sin(p)) * 0.3];
      T.bob = Math.abs(Math.cos(p)) * 0.018 * a; T.spine += 0.03 * a; T.hipY = Math.sin(p) * 0.08 * a; T.hipZ = Math.cos(p) * 0.03 * a;
      T.headY = -T.hipY * 0.6; T.headZ = Math.cos(p) * 0.04 * a;   // a little waddle
    } else if (s === 'namaste' || s === 'bow' || s === 'aarti') {
      T.pose = NAMASTE;
      if (s === 'bow') { const k = Math.sin(Math.min(1, this.stateTime / 2.4) * Math.PI); T.spine += 0.26 * k; T.chest = 0.16 * k; T.neck = 0.18 * k; T.headX = 0.14 * k; T.kn = [0.1 * k, 0.1 * k]; }
      if (s === 'aarti') { T.spine += 0.03 + Math.sin(t * 1.6 + this.seed) * 0.025; T.headX = 0.06; T.hipZ = Math.sin(t * 0.8 + this.seed) * 0.02; T.headZ = Math.sin(t * 0.8 + this.seed) * 0.05; }
    } else if (s === 'offer') {
      const k = Math.sin(Math.min(1, this.stateTime / 1.6) * Math.PI);
      T.pose = blendPose({ shL: [0, 0, 0.3], shR: [0, 0, -0.3], elL: [-0.12, 0, 0], elR: [-0.12, 0, 0] }, OFFER, k); T.spine += 0.12 * k; T.headX = 0.12 * k;
    } else if (s === 'ring') {
      const k = Math.min(1, this.stateTime / 0.35), pull = Math.sin(this.stateTime * 9) * 0.12;
      T.pose = blendPose({ shR: [0, 0, -0.3], elR: [-0.12, 0, 0] }, RING, k); T.pose.shR = T.pose.shR.map((v, i) => i === 0 ? v + pull : v); T.headX = -0.22 * k;
    } else if (s === 'aartiPriest') {
      const a = this.lampAngle || 0;
      const dx = Math.sin(a) * 0.3, dz = Math.cos(a) * 0.22;   // the joined hands draw circles with the lamp
      T.pose = { ...PRIEST, shL: [PRIEST.shL[0] + dx, PRIEST.shL[1], PRIEST.shL[2] + dz], shR: [PRIEST.shR[0] + dx, PRIEST.shR[1], PRIEST.shR[2] + dz] }; T.headX = 0.08;
    } else if (s === 'meditate') {
      // sukhasana, palms up on the thighs; the chest rises and falls with the breath
      const br = this.breath ?? (0.5 + 0.5 * Math.sin(t * 0.6 + this.seed));
      T.pose = this.mudra === 'nadi' ? SIT_NADI : SIT; T.seat = SEAT; T.spine = -0.01 * br; T.chest = -0.03 * br; T.neck = 0.04 + 0.02 * br; T.headX = 0.05;
    } else {
      // idle: breathing, a gentle sway, looking around now and then
      T.sx = [Math.sin(t * 0.8 + this.seed) * 0.04, -Math.sin(t * 0.8 + this.seed) * 0.04];
      T.chest = Math.sin(t * 1.3 + this.seed) * 0.012; T.hipZ = Math.sin(t * 0.35 + this.seed) * 0.02; T.kn = [0.04 + Math.max(0, Math.sin(t * 0.35 + this.seed)) * 0.06, 0.04 + Math.max(0, -Math.sin(t * 0.35 + this.seed)) * 0.06];
      T.headY = Math.sin(t * 0.23 + this.seed * 3) * 0.35 * Math.max(0, Math.sin(t * 0.11 + this.seed)); T.headZ = Math.sin(t * 0.17 + this.seed) * 0.05; T.bob = Math.sin(t * 1.3 + this.seed) * 0.002;
    }
    // things carried change the arm pose while walking or standing
    if (c.carry === 'thali' && (s === 'walk' || s === 'idle')) T.pose = { ...(T.pose || {}), shL: OFFER.shL, elL: OFFER.elL, wrL: OFFER.wrL };
    if (c.carry === 'cane' && (s === 'walk' || s === 'idle')) { T.sx[0] = -0.25 + (s === 'walk' ? -Math.sin(this.walkPhase) * 0.12 : 0); T.ex[0] = -0.3; T.wx[0] = 0.5; T.sz[0] = -0.3; }
    return T;
  }

  update(dt, t) {
    this.stateTime += dt;
    if (this.state === 'walk') this.walkPhase += dt * (5 + this.speed * 3) * (this.config.age === 'elder' ? 0.85 : 1);
    const T = this._targets(t), b = this.b;
    // sitting down and standing up are slower than everyday movement
    const seated = this.state === 'meditate' || b.hips.position.y < this.rest.hips.y - 0.05;
    const k = 1 - Math.exp(-dt * (seated ? 3.2 : 12));
    const L = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    const R = (bone, x, y = 0, z = 0) => { const r = b[bone].rotation, p = T.pose && T.pose[bone]; if (p) { x = p[0]; y = p[1]; z = p[2]; } L(r, 'x', x); L(r, 'y', y); L(r, 'z', z); };
    const arm = [['shR', 'elR', 'wrR'], ['shL', 'elL', 'wrL']];
    arm.forEach(([sh, el, wr], i) => { R(sh, T.sx[i], 0, T.sz[i]); R(el, T.ex[i], T.ez[i] * 0.6, T.ez[i] * 0.5); R(wr, T.wx[i]); });
    [['thR', 'knR', 'anR'], ['thL', 'knL', 'anL']].forEach(([th, kn, an], i) => { R(th, T.th[i] - T.kn[i] * 0.35); R(kn, T.kn[i]); R(an, T.an[i] + T.kn[i] * 0.25 - T.th[i] * 0.3); });
    L(b.spine.rotation, 'x', T.spine); L(b.chest.rotation, 'x', T.chest); L(b.chest.rotation, 'y', -T.hipY * 0.8);
    L(b.neck.rotation, 'x', T.neck); L(b.head.rotation, 'x', T.headX); L(b.head.rotation, 'y', T.headY); L(b.head.rotation, 'z', T.headZ);
    L(b.hips.rotation, 'y', T.hipY); L(b.hips.rotation, 'z', T.hipZ);
    if (this.mesh.morphTargetInfluences) { const m = this.mesh.morphTargetInfluences; m[0] += ((T.seat ? 1 : 0) - m[0]) * Math.min(1, k * 2.2); }   // the cloth settles a little ahead of the legs
    // the face: blinking, a wandering gaze, happy closed eyes in prayer, a smile, chanting during aarti
    const st = this.state, prayer = (st === 'namaste' && this.stateTime > 1.2) || st === 'bow' || st === 'aarti' || (st === 'meditate' && this.stateTime > 1.5);
    this.blinkT = (this.blinkT ?? 1 + Math.random() * 3) - dt;
    if (this.blinkT <= 0) { this.blinkT = 2.2 + Math.random() * 4; this.blinkLeft = 0.14; }
    if (this.blinkLeft > 0) this.blinkLeft -= dt;
    const open = prayer ? 0.04 : this.blinkLeft > 0 ? 0.1 : 1, lk = this.blinkLeft > 0 ? 0.7 : k * 0.6;
    for (const e of [b.eyeL, b.eyeR]) { e.scale.y += (open - e.scale.y) * lk; e.scale.x = e.scale.z = 1; }
    for (const l of [b.lidL, b.lidR]) l.scale.setScalar(Math.max(0.001, l.scale.x + ((prayer ? 1 : 0.001) - l.scale.x) * k * 0.6));
    if (!this.gazeT || t > this.gazeT) { this.gazeT = t + 1.2 + Math.random() * 3.5; this.gaze = [(Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.014]; }
    for (const [n, sx] of [['eyeL', 1], ['eyeR', -1]]) { const r = this.rest[n]; b[n].position.x += (r.x + (prayer ? 0 : this.gaze[1]) - b[n].position.x) * k * 0.5; b[n].position.y += (r.y + (prayer ? 0 : this.gaze[0]) - b[n].position.y) * k * 0.5; void sx; }
    const smile = st === 'offer' ? 1 : st === 'meditate' ? 0.4 : prayer ? 0.7 : st === 'walk' ? 0.5 : 0.6;
    const chant = st === 'aarti' ? Math.max(0, Math.sin(t * 6.2 + this.seed)) * (0.6 + 0.4 * Math.sin(t * 1.3 + this.seed)) : 0;
    b.jaw.scale.setScalar(Math.max(0.001, b.jaw.scale.x + (chant - b.jaw.scale.x) * k));
    const ms = (bone, sx) => { const r = this.rest[bone]; b[bone].position.x += (r.x + sx * smile * 0.003 - b[bone].position.x) * k; b[bone].position.y += (r.y + smile * 0.006 - b[bone].position.y) * k; };
    ms('mouthL', 1); ms('mouthR', -1);
    for (const n of ['browL', 'browR']) b[n].position.y += (this.rest[n].y + smile * 0.002 + (st === 'ring' ? 0.004 : 0) - (prayer ? 0.002 : 0) - b[n].position.y) * k;
    // keep the feet on the ground as the knees bend
    const drop = T.seat ?? (1 - Math.cos(Math.min(b.knL.rotation.x, b.knR.rotation.x))) * THIGH * 0.6;
    b.hips.position.y += (this.rest.hips.y + T.bob - drop - b.hips.position.y) * k;
  }

  handWorld(side = 1) { const v = new THREE.Vector3(0, -0.055, 0.01); return (side === 1 ? this.b.wrR : this.b.wrL).localToWorld(v); }
  chestWorld() { const v = new THREE.Vector3(0, 0.04, 0.16); return this.b.chest.localToWorld(v); }
}
