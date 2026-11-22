import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Carved ornament for the temples, drawn once as height maps and turned into colour and normal maps, so a flat band
// reads as deep relief without extra geometry (cheap on phones). Motifs from Nagara temple carving:
//   lotus    padma frieze: rows of rounded lotus petals between raised fillets
//   beads    bead-and-reel moulding
//   vine     patra-lata: a scrolling creeper with curled tendrils and leaves
//   diamond  ratna band: lozenges with rosettes, between fillets
//   gavaksha chaitya-window arches (the horseshoe motif that covers a shikhara), each with a medallion
// Plus a few small solid pieces: rings of lotus petals and beads, and a full ceremonial pot (purna kalasha).

const W = 512, H = 128;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const g2 = (v) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// a raised, rounded blob: bright at its crown, falling to `edge` at its rim
function dome(x, cx, cy, rx, ry, top = 1, edge = 0.5, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(1, ry / rx);
  const gr = x.createRadialGradient(-rx * 0.15, -rx * 0.2, 0, 0, 0, rx); gr.addColorStop(0, g2(top)); gr.addColorStop(0.75, g2(edge + (top - edge) * 0.35)); gr.addColorStop(1, g2(edge));
  x.fillStyle = gr; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore();
}
function fillet(x, y, h, v = 0.9) { const gr = x.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, g2(v * 0.8)); gr.addColorStop(0.35, g2(v)); gr.addColorStop(1, g2(v * 0.72)); x.fillStyle = gr; x.fillRect(0, y, W, h); }
function groove(x, y, v = 0.12) { x.fillStyle = g2(v); x.fillRect(0, y, W, 2); }

const DRAW = {
  lotus(x) {
    x.fillStyle = g2(0.28); x.fillRect(0, 0, W, H);
    fillet(x, 0, 16); groove(x, 16); fillet(x, H - 16, 16); groove(x, H - 18);
    const n = 8, w = W / n;
    for (let i = 0; i < n; i++) {   // small petals behind, then the main petals
      const cx = (i + 0.5) * w;
      for (const off of [-0.5, 0.5]) { x.save(); x.translate(cx + off * w, H - 20); x.fillStyle = g2(0.45); x.beginPath(); x.moveTo(-w * 0.22, 0); x.quadraticCurveTo(-w * 0.22, -60, 0, -74); x.quadraticCurveTo(w * 0.22, -60, w * 0.22, 0); x.fill(); x.restore(); }
    }
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * w; x.save(); x.translate(cx, H - 18);
      const gr = x.createLinearGradient(-w * 0.4, 0, w * 0.4, 0); gr.addColorStop(0, g2(0.55)); gr.addColorStop(0.45, g2(0.98)); gr.addColorStop(1, g2(0.6));
      x.fillStyle = gr; x.beginPath(); x.moveTo(-w * 0.4, 0); x.bezierCurveTo(-w * 0.44, -50, -w * 0.12, -82, 0, -90); x.bezierCurveTo(w * 0.12, -82, w * 0.44, -50, w * 0.4, 0); x.closePath(); x.fill();
      x.strokeStyle = g2(0.3); x.lineWidth = 3; x.beginPath(); x.moveTo(-w * 0.26, -4); x.bezierCurveTo(-w * 0.28, -40, -w * 0.08, -62, 0, -68); x.bezierCurveTo(w * 0.08, -62, w * 0.28, -40, w * 0.26, -4); x.stroke();
      x.restore();
    }
  },
  beads(x) {
    x.fillStyle = g2(0.25); x.fillRect(0, 0, W, H);
    fillet(x, 0, 22); groove(x, 22); fillet(x, H - 22, 22); groove(x, H - 24);
    const n = 16, w = W / n;
    for (let i = 0; i < n; i++) { const cx = (i + 0.5) * w; dome(x, cx, H / 2, w * 0.34, w * 0.34, 1, 0.45); dome(x, cx + w * 0.5, H / 2, w * 0.1, w * 0.24, 0.8, 0.4); }
  },
  vine(x) {
    x.fillStyle = g2(0.22); x.fillRect(0, 0, W, H);
    fillet(x, 0, 12); groove(x, 12); fillet(x, H - 12, 12); groove(x, H - 14);
    const n = 4, w = W / n, r = rnd(5);
    x.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {   // a darker undercut, then the raised stem
      x.strokeStyle = g2(pass ? 0.92 : 0.1); x.lineWidth = pass ? 7 : 11;
      x.beginPath(); for (let px = 0; px <= W; px += 4) { const py = H / 2 + Math.sin(px / w * Math.PI * 2) * 22; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    }
    for (let i = 0; i < n * 2; i++) {
      const px = (i + 0.25) * w / 2, up = i % 2 ? 1 : -1, py = H / 2 + Math.sin(px / w * Math.PI * 2) * 22;
      // a curling tendril ending in a rosette, and two leaves
      x.strokeStyle = g2(0.85); x.lineWidth = 4; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 1.6, rr = 26 * (1 - k / 26); x.lineTo(px + 18 + Math.cos(a + Math.PI) * rr * 0.6 + 14, py + up * (Math.sin(a) * rr * 0.7 + 6)); } x.stroke();
      dome(x, px + 26, py + up * 18, 8, 8, 1, 0.5);
      for (const s of [-1, 1]) dome(x, px - 8 * s, py + up * 12, 13, 5, 0.9, 0.45, up * s * 0.7 + (r() - 0.5) * 0.2);
    }
  },
  diamond(x) {
    x.fillStyle = g2(0.3); x.fillRect(0, 0, W, H);
    fillet(x, 0, 14); groove(x, 14); fillet(x, H - 14, 14); groove(x, H - 16);
    const n = 6, w = W / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * w, cy = H / 2;
      x.fillStyle = g2(0.85); x.beginPath(); x.moveTo(cx, cy - 46); x.lineTo(cx + w * 0.42, cy); x.lineTo(cx, cy + 46); x.lineTo(cx - w * 0.42, cy); x.closePath(); x.fill();
      x.fillStyle = g2(0.4); x.beginPath(); x.moveTo(cx, cy - 34); x.lineTo(cx + w * 0.3, cy); x.lineTo(cx, cy + 34); x.lineTo(cx - w * 0.3, cy); x.closePath(); x.fill();
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; dome(x, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 7, 4, 0.95, 0.5, a); }
      dome(x, cx, cy, 7, 7, 1, 0.6);
      dome(x, cx + w * 0.5, cy, 9, 9, 0.9, 0.45);
    }
  },
  gavaksha(x) {
    x.fillStyle = g2(0.35); x.fillRect(0, 0, W, H);
    fillet(x, H - 10, 10, 0.8);
    const n = 4, w = W / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * w, base = H - 10, R = w * 0.42;
      // horseshoe arch: a thick raised ring with a finial, framing a recessed window and a medallion
      x.save(); x.beginPath(); x.moveTo(cx - R, base); x.lineTo(cx - R, base - 30); x.arc(cx, base - 30, R, Math.PI, 0); x.lineTo(cx + R, base); x.closePath();
      const gr = x.createRadialGradient(cx, base - 34, R * 0.5, cx, base - 34, R); gr.addColorStop(0, g2(0.5)); gr.addColorStop(0.75, g2(0.97)); gr.addColorStop(1, g2(0.55)); x.fillStyle = gr; x.fill(); x.restore();
      x.fillStyle = g2(0.12); x.beginPath(); x.moveTo(cx - R * 0.66, base); x.lineTo(cx - R * 0.66, base - 30); x.arc(cx, base - 30, R * 0.66, Math.PI, 0); x.lineTo(cx + R * 0.66, base); x.closePath(); x.fill();
      dome(x, cx, base - 34, R * 0.32, R * 0.32, 0.95, 0.4);
      dome(x, cx, base - 30 - R - 4, 7, 10, 1, 0.5);
      // the half-arches that link each motif to the next, as on a shikhara's mesh
      dome(x, cx + w * 0.5, base - 4, 10, 14, 0.75, 0.35);
    }
  },
};

function heightMap(kind) { const c = cv(W, H), x = c.getContext('2d', { willReadFrequently: true }); DRAW[kind](x); return c; }
function normalMap(src, strength) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data, out = cv(w, h), o = out.getContext('2d'), img = o.createImageData(w, h);
  const L = (x, y) => { x = (x + w) % w; y = Math.min(h - 1, Math.max(0, y)); return d[(y * w + x) * 4] / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (L(x + 1, y) - L(x - 1, y)) * strength, dy = (L(x, y + 1) - L(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  o.putImageData(img, 0, 0); return out;
}
// colour: the stone tint, darker in the recesses and lit on the raised carving, with a little grain
function colourMap(src, tint) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data, out = cv(w, h), o = out.getContext('2d'), img = o.createImageData(w, h);
  const t = new THREE.Color(tint), r = rnd(9);
  for (let i = 0; i < w * h; i++) {
    const v = d[i * 4] / 255, k = (0.5 + 0.62 * Math.pow(v, 0.8)) * (0.95 + r() * 0.1);
    img.data[i * 4] = Math.min(255, t.r * 255 * k); img.data[i * 4 + 1] = Math.min(255, t.g * 255 * k); img.data[i * 4 + 2] = Math.min(255, t.b * 255 * k); img.data[i * 4 + 3] = 255;
  }
  o.putImageData(img, 0, 0); return out;
}

const heights = new Map(), normals = new Map(), colours = new Map();
let aniso = 4;
export function setOrnamentAnisotropy(a) { aniso = a; }
function texFrom(canvas, srgb) { const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }

// A carved band material. Each call returns its own textures (sharing the drawn images) so callers can set their own
// tiling; the normal map follows the colour map's tiling, so `mat.map.repeat.set(...)` still sets both.
export function relief(kind, tint = '#e2cba6', { repeat = [6, 1], strength = 5, roughness = 0.82, metal = 0, vertical = false } = {}) {
  if (!heights.has(kind)) heights.set(kind, heightMap(kind));
  const hm = heights.get(kind), ck = kind + tint;
  if (!normals.has(kind)) normals.set(kind, texFrom(normalMap(hm, strength), false));
  if (!colours.has(ck)) colours.set(ck, texFrom(colourMap(hm, tint), true));
  const map = colours.get(ck).clone(), nrm = normals.get(kind).clone();
  map.repeat.set(repeat[0], repeat[1]); nrm.repeat = map.repeat; nrm.offset = map.offset;
  if (vertical) { map.center.set(0.5, 0.5); map.rotation = Math.PI / 2; nrm.center = map.center; nrm.rotation = map.rotation; }   // runs up a pilaster
  map.needsUpdate = nrm.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1.1, 1.1), roughness, metalness: metal });
}

// ---------------------------------------------------------------- small solid ornament (merged into one geometry each)
export function mergeGeos(geos) {
  const parts = geos.map((g) => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.normal) g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
  const out = new THREE.BufferGeometry();
  for (const n of ['position', 'normal', 'uv']) {
    const size = parts[0].attributes[n].itemSize, arr = new Float32Array(parts.reduce((s, p) => s + p.attributes[n].array.length, 0)); let off = 0;
    for (const p of parts) { arr.set(p.attributes[n].array, off); off += p.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); return out;
}
// one cupped, pointed lotus petal, base at the origin, rising along +y and leaning out along +z
function petalGeo(len, wid, lean = 0.5, cup = 0.35) {
  const g = new THREE.PlaneGeometry(wid, len, 4, 6); g.translate(0, len / 2, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / len, half = wid / 2 * Math.sin(Math.min(1, t * 1.05 + 0.08) * Math.PI) ** 0.8;
    const nx = (x / (wid / 2)) * half;
    p.setXYZ(i, nx, y, Math.sin(t * Math.PI * 0.5) * lean * len - (1 - (nx / (wid / 2 + 1e-6)) ** 2) * cup * wid * 0.5 * (1 - t * 0.6));
  }
  g.computeVertexNormals(); return g;
}
// a ring of n petals around radius r at height y; `down` turns them to hang (an inverted lotus under a finial)
export function petalRing(r, n, len, { wid = (2 * Math.PI * r / n) * 1.25, lean = 0.55, y = 0, down = false, rows = 2 } = {}) {
  const geos = [];
  for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
    const a = (i + row * 0.5) / n * Math.PI * 2, g = petalGeo(len * (1 - row * 0.22), wid * (1 - row * 0.15), lean + row * 0.2);
    if (down) g.rotateX(Math.PI);
    g.rotateY(Math.PI / 2 - a); g.translate(Math.cos(a) * r * (1 - row * 0.06), y + (down ? -row * len * 0.08 : row * len * 0.08), Math.sin(a) * r * (1 - row * 0.06)); geos.push(g);
  }
  return mergeGeos(geos);
}
export function beadRing(r, n, br, y = 0) {
  const geos = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, s = new THREE.SphereGeometry(br, 7, 5); s.translate(Math.cos(a) * r, y, Math.sin(a) * r); geos.push(s); }
  return mergeGeos(geos);
}

// purna kalasha: a full pot with a coconut nested in a ring of mango leaves, on a lotus base
const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: 0.7, side: THREE.DoubleSide });
const coconutMat = new THREE.MeshStandardMaterial({ color: '#8a5a2c', roughness: 0.9 });
export function purnaKalasha(s = 1, potMat) {
  const g = new THREE.Group();
  const pot = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.2, 0.04], [0.3, 0.18], [0.31, 0.3], [0.24, 0.42], [0.13, 0.48], [0.12, 0.53], [0.18, 0.57], [0.18, 0.6], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x * s, y * s)), 20);
  g.add(new THREE.Mesh(pot, potMat));
  g.add(new THREE.Mesh(beadRing(0.305 * s, 22, 0.018 * s, 0.24 * s), potMat));
  g.add(new THREE.Mesh(petalRing(0.18 * s, 10, 0.12 * s, { y: -0.01 * s, lean: 0.9, rows: 1 }), potMat));
  const leaves = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, l = petalGeo(0.28 * s, 0.09 * s, 1.0, 0.2); l.rotateY(Math.PI / 2 - a); l.translate(Math.cos(a) * 0.12 * s, 0.56 * s, Math.sin(a) * 0.12 * s); leaves.push(l); }
  g.add(new THREE.Mesh(mergeGeos(leaves), leafMat));
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 14, 10), coconutMat); nut.scale.y = 1.2; nut.position.y = 0.7 * s; g.add(nut);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
