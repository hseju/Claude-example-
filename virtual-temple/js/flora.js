import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { brass } from './architecture.js';

// Courtyard plant life and garden furniture, built from leaf cards and sculpted parts and drawn
// with instancing: branching shade trees (neem), flowering trees (bougainvillea, gulmohar,
// jacaranda), columnar ashoka, coconut palms, raised flower beds with shrubs and marigold,
// hibiscus and jasmine, hedges, grass tufts, lotus ponds with pads, flowers and buds, and brass
// urli bowls with floating flowers.

const V = THREE.Vector3;
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ------------------------------------------------------------------ geometry helpers
export function merge(geos) {
  const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const names = ['position', 'normal', 'uv', 'color'].filter(n => parts.every(p => p.attributes[n]));
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = parts[0].attributes[n].itemSize, total = parts.reduce((s, p) => s + p.attributes[n].array.length, 0);
    const arr = new Float32Array(total); let off = 0;
    for (const p of parts) { arr.set(p.attributes[n].array, off); off += p.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); return out;
}
function paint(g, color) { const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function seg(a, b, r0, r1, radial = 6) {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), b.clone().sub(a).normalize())); g.translate(a.x, a.y, a.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len * 0.6);
  return g;
}
function sweep(curve, radius, radial = 8, steps = 24) {
  const pos = [], uv = [], idx = [], frames = curve.computeFrenetFrames(steps, false);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, p = curve.getPointAt(u), r = radius(u), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z)); uv.push(j / radial, u * 8); }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function randomQuat() { const u = rnd(), v = rnd(), w = rnd(); return new THREE.Quaternion(Math.sqrt(1 - u) * Math.sin(2 * Math.PI * v), Math.sqrt(1 - u) * Math.cos(2 * Math.PI * v), Math.sqrt(u) * Math.sin(2 * Math.PI * w), Math.sqrt(u) * Math.cos(2 * Math.PI * w)); }
// a leaf card whose normals point away from the crown centre, so the canopy shades as one soft mass
function card(size, pos, centre, quat = randomQuat(), stretch = 1) {
  const g = new THREE.PlaneGeometry(size, size * stretch); g.applyQuaternion(quat); g.translate(pos.x, pos.y, pos.z);
  const p = g.attributes.position, n = g.attributes.normal, v = new V();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(centre).normalize(); v.y = v.y * 0.8 + 0.25; v.normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

// ------------------------------------------------------------------ textures
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function leafShape(x, len, wid) { x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len); x.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0); }
const LEAF_KINDS = {
  neem: { greens: ['#3c6a2c', '#4b7a33', '#5b8a3a', '#2e5624', '#6b9a44'], leaves: 120, len: [22, 34], wid: [6, 9] },
  shrub: { greens: ['#356326', '#45742f', '#548437', '#2b5121'], leaves: 150, len: [14, 22], wid: [6, 9] },
  ashoka: { greens: ['#244d1f', '#2f5d27', '#3a6a2e'], leaves: 90, len: [40, 60], wid: [5, 7], droop: true },
  bougainvillea: { greens: ['#3f6d2d', '#4e7d35'], leaves: 70, len: [18, 26], wid: [8, 11], bloom: ['#d21f7a', '#e0438f', '#b8186a', '#f05a9e'], blooms: 70 },
  gulmohar: { greens: ['#5b8c3c', '#6d9c45', '#4b7a33'], leaves: 120, len: [10, 16], wid: [3, 5], bloom: ['#e2391c', '#f2541f', '#c92a14', '#ff7a2e'], blooms: 60 },
  jacaranda: { greens: ['#4b7a33', '#5b8a3a'], leaves: 60, len: [10, 16], wid: [3, 5], bloom: ['#8f6ad6', '#a07fe0', '#7a58c4', '#b394ec'], blooms: 80 },
};
function leafTexture(kind) {
  const K = LEAF_KINDS[kind], S = 256, c = cv(S), x = c.getContext('2d');
  for (let i = 0; i < K.leaves; i++) {
    const r = Math.sqrt(rnd()) * 112, a = rnd() * Math.PI * 2; x.save(); x.translate(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
    x.rotate(K.droop ? Math.PI + (rnd() - 0.5) * 0.6 : rnd() * Math.PI * 2);
    const len = K.len[0] + rnd() * (K.len[1] - K.len[0]), wid = K.wid[0] + rnd() * (K.wid[1] - K.wid[0]);
    const col = new THREE.Color(pick(K.greens)).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
    const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, '#' + col.clone().offsetHSL(0, 0, -0.06).getHexString()); g.addColorStop(1, '#' + col.clone().offsetHSL(0, 0.05, 0.06).getHexString());
    x.fillStyle = g; leafShape(x, len, wid); x.fill();
    x.strokeStyle = 'rgba(220,240,180,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -len * 0.9); x.stroke();
    x.restore();
  }
  if (K.bloom) for (let i = 0; i < K.blooms; i++) {
    const r = Math.sqrt(rnd()) * 105, a = rnd() * Math.PI * 2, cx = S / 2 + Math.cos(a) * r, cy = S / 2 + Math.sin(a) * r, col = pick(K.bloom);
    for (let k = 0; k < 4 + Math.floor(rnd() * 4); k++) { const pa = rnd() * Math.PI * 2, d = 3 + rnd() * 6; x.fillStyle = col; x.beginPath(); x.ellipse(cx + Math.cos(pa) * d, cy + Math.sin(pa) * d, 4 + rnd() * 3, 3 + rnd() * 2, pa, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = 'rgba(255,240,200,0.8)'; x.beginPath(); x.arc(cx, cy, 1.2, 0, Math.PI * 2); x.fill();
  }
  return tex(c);
}
function barkTexture() {
  const c = cv(64, 256), x = c.getContext('2d'); x.fillStyle = '#5a4434'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '30,22,16' : '120,100,80'},${0.2 + rnd() * 0.3})`; x.fillRect(rnd() * 64, rnd() * 256, 1 + rnd() * 3, 20 + rnd() * 80); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function palmBarkTexture() {
  const c = cv(64, 128), x = c.getContext('2d'); x.fillStyle = '#7a6650'; x.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 16) { x.fillStyle = 'rgba(40,30,22,0.55)'; x.fillRect(0, y, 64, 3); x.fillStyle = 'rgba(160,140,110,0.4)'; x.fillRect(0, y + 3, 64, 2); }
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(60,48,36,0.3)'; x.fillRect(rnd() * 64, rnd() * 128, 2, 6); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function frondTexture() {
  const W = 128, H = 512, c = cv(W, H), x = c.getContext('2d');
  for (let y = H - 10; y > 10; y -= 7) {
    const k = 1 - y / H, len = 54 * Math.sin(Math.min(1, (1 - k) * 1.2) * Math.PI * 0.9) + 6;
    for (const s of [-1, 1]) { x.save(); x.translate(W / 2, y); x.rotate(s * (0.95 + rnd() * 0.15)); const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, '#3f6b2b'); g.addColorStop(1, '#6f9a44'); x.fillStyle = g; leafShape(x, len, 3.2); x.fill(); x.restore(); }
  }
  x.strokeStyle = '#8a7a45'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, 4); x.stroke();
  return tex(c);
}
function grassTexture() {
  const S = 128, c = cv(S), x = c.getContext('2d');
  for (let i = 0; i < 34; i++) {
    const bx = 10 + rnd() * 108, h = 50 + rnd() * 74, lean = (rnd() - 0.5) * 30, w = 2 + rnd() * 3;
    const g = x.createLinearGradient(0, S, 0, S - h); g.addColorStop(0, '#3a5a24'); g.addColorStop(1, pick(['#7aa04a', '#8cb055', '#6b9440', '#a0b860']));
    x.fillStyle = g; x.beginPath(); x.moveTo(bx - w, S); x.quadraticCurveTo(bx + lean * 0.4, S - h * 0.6, bx + lean, S - h); x.quadraticCurveTo(bx + lean * 0.4 + 1, S - h * 0.6, bx + w, S); x.fill();
  }
  return tex(c);
}
function padTexture() {
  const S = 128, c = cv(S), x = c.getContext('2d'); x.translate(S / 2, S / 2);
  const g = x.createRadialGradient(0, 0, 4, 0, 0, 62); g.addColorStop(0, '#5f8f3c'); g.addColorStop(1, '#3f6e2c'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 62, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(190,220,140,0.45)'; x.lineWidth = 1.2; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(Math.cos(a + 0.1) * 30, Math.sin(a + 0.1) * 30, Math.cos(a) * 60, Math.sin(a) * 60); x.stroke(); }
  x.strokeStyle = 'rgba(120,60,40,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 60, 0, Math.PI * 2); x.stroke();
  return tex(c);
}

// ------------------------------------------------------------------ materials
function foliageMaterial(map, windTime, { amp = 0.08, freq = 1.4, vertexColors = false, alphaTest = 0.45 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness: 0.85, vertexColors });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWindTime = windTime;
    sh.vertexShader = 'uniform float uWindTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float wph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.27;
      #else
        float wph = 0.0;
      #endif
      float wk = clamp(position.y * 0.18, 0.0, 1.0);
      transformed.x += sin(uWindTime * ${freq.toFixed(2)} + wph + position.y * 0.7) * ${amp.toFixed(3)} * wk;
      transformed.z += cos(uWindTime * ${(freq * 0.8).toFixed(2)} + wph * 1.3 + position.x) * ${(amp * 0.7).toFixed(3)} * wk;`);
    // keep the outward canopy normals on both faces so leaves never go black from behind
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );');
  };
  m.customProgramCacheKey = () => `foliage${amp}${freq}${vertexColors}`;
  return m;
}

// ------------------------------------------------------------------ the Flora collection
export class Flora {
  constructor(scene, quality, windTime) {
    this.scene = scene; this.quality = quality; this.windTime = windTime;
    this.trees = {}; this.beds = []; this.hedges = []; this.ponds = []; this.urlis = []; this.grass = [];
    this.updaters = [];
    seed = 4242;
  }
  addTree(kind, x, z, s = 1, collider) { (this.trees[kind] = this.trees[kind] || []).push({ x, z, s, r: rnd() * Math.PI * 2 }); }
  addBed(x, z, r, palette) { this.beds.push({ x, z, r, palette }); }
  addHedge(x, z, r, bloom) { this.hedges.push({ x, z, r, bloom }); }
  addLotusPond(x, z, r, y, flowers, rect) { this.ponds.push({ x, z, r, y, flowers, rect }); }
  addUrli(x, z) { this.urlis.push({ x, z }); }
  addGrass(points) { this.grass.push(...points); }

  // -------- trees
  _broadleaf(o) {
    const wood = [], leaves = [];
    let p = new V(0, 0, 0); const pts = [p];
    for (let i = 1; i <= 3; i++) { p = p.clone().add(new V((rnd() - 0.5) * o.lean, o.h * o.forkAt / 3, (rnd() - 0.5) * o.lean)); pts.push(p); }
    for (let i = 0; i < 3; i++) wood.push(seg(pts[i], pts[i + 1], o.trunk * (1.15 - i * 0.18), o.trunk * (1 - (i + 1) * 0.18), 8));
    const fork = pts[3], centre = new V(fork.x, o.h * o.crown, fork.z), clusters = [];
    for (let c = 0; c < o.clusters; c++) {
      const a = c / o.clusters * Math.PI * 2 + rnd() * 0.5, r = o.spread * (0.5 + rnd() * 0.45), y = centre.y + (rnd() - 0.4) * o.h * 0.2;
      const cc = new V(centre.x + Math.cos(a) * r, y, centre.z + Math.sin(a) * r);
      const mid = fork.clone().lerp(cc, 0.5).add(new V(0, o.h * 0.06, 0));
      wood.push(seg(fork, mid, o.trunk * 0.5, o.trunk * 0.32), seg(mid, cc, o.trunk * 0.32, o.trunk * 0.1));
      clusters.push(cc);
    }
    clusters.push(centre.clone().add(new V(0, o.h * 0.14, 0)));
    for (const cc of clusters) for (let k = 0; k < o.cards; k++) {
      const d = new V(rnd() - 0.5, (rnd() - 0.5) * 0.7, rnd() - 0.5).normalize().multiplyScalar(o.spread * 0.42 * Math.cbrt(rnd()));
      leaves.push(card(o.card * (0.8 + rnd() * 0.4), cc.clone().add(d), centre));
    }
    return { wood: merge(wood), leaves: merge(leaves) };
  }
  _ashoka(o) {
    const wood = [seg(new V(0, 0, 0), new V(0, o.h * 0.95, 0), o.trunk, o.trunk * 0.2, 7)], leaves = [], centre = new V(0, o.h * 0.5, 0);
    for (let k = 0; k < o.cards; k++) {
      const y = o.h * (0.2 + rnd() * 0.8), r = o.spread * (1 - (y / o.h - 0.2) / 0.85) * (0.55 + rnd() * 0.5), a = rnd() * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.6, a, (rnd() - 0.5) * 0.4));
      leaves.push(card(o.card, new V(Math.cos(a) * r, y, Math.sin(a) * r), centre.clone().setY(y * 0.9), q, 1.3));
    }
    return { wood: merge(wood), leaves: merge(leaves) };
  }
  _palm(o) {
    const lean = new V(rnd() - 0.5, 0, rnd() - 0.5).normalize().multiplyScalar(o.h * 0.18);
    const curve = new THREE.CatmullRomCurve3([new V(0, 0, 0), new V(lean.x * 0.15, o.h * 0.3, lean.z * 0.15), new V(lean.x * 0.55, o.h * 0.65, lean.z * 0.55), new V(lean.x, o.h, lean.z)]);
    const wood = [sweep(curve, (u) => o.trunk * (1.25 - u * 0.45 + (u < 0.06 ? (0.06 - u) * 5 : 0)), 8, 20)];
    const top = curve.getPointAt(1), fronds = [];
    for (let i = 0; i < o.fronds; i++) {
      const g = new THREE.PlaneGeometry(1.1, o.frond, 1, 12); g.translate(0, o.frond / 2, 0);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k), t = y / o.frond; const droop = t * t * 1.6; p.setXYZ(k, p.getX(k) * (0.35 + Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.65), y * Math.cos(droop * 0.9), -Math.sin(droop) * y * 0.55 + Math.abs(p.getX(k)) * 0.25); }
      const a = i / o.fronds * Math.PI * 2 + rnd() * 0.3, up = 0.35 + rnd() * 0.5 - (i % 3 === 0 ? 0.4 : 0);
      g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(up - Math.PI / 2, 0, 0))); g.rotateY(a); g.translate(top.x, top.y, top.z);
      const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
      fronds.push(g);
    }
    const nuts = []; for (let i = 0; i < 5; i++) { const s = new THREE.SphereGeometry(0.13, 8, 6); const a = i / 5 * Math.PI * 2; s.translate(top.x + Math.cos(a) * 0.18, top.y - 0.2, top.z + Math.sin(a) * 0.18); nuts.push(paint(s, '#5f5a2a')); }
    return { wood: merge(wood), leaves: merge(fronds), nuts: merge(nuts) };
  }

  _buildTrees() {
    const S = this.scene, bark = barkTexture(), barkM = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    const palmBarkM = new THREE.MeshStandardMaterial({ map: palmBarkTexture(), roughness: 0.95 });
    const specs = {
      neem: { type: 'broad', h: 6.5, forkAt: 0.45, crown: 0.72, spread: 3.4, clusters: 8, cards: 9, card: 2.0, trunk: 0.28, lean: 0.5 },
      bougainvillea: { type: 'broad', h: 4.6, forkAt: 0.35, crown: 0.7, spread: 2.6, clusters: 7, cards: 9, card: 1.6, trunk: 0.18, lean: 0.6 },
      gulmohar: { type: 'broad', h: 6.0, forkAt: 0.45, crown: 0.78, spread: 4.0, clusters: 9, cards: 8, card: 2.1, trunk: 0.24, lean: 0.4 },
      jacaranda: { type: 'broad', h: 6.2, forkAt: 0.45, crown: 0.75, spread: 3.2, clusters: 8, cards: 8, card: 1.9, trunk: 0.22, lean: 0.5 },
      ashoka: { type: 'ashoka', h: 7.5, spread: 1.3, cards: 46, card: 1.2, trunk: 0.18 },
      palm: { type: 'palm', h: 8.5, trunk: 0.2, fronds: 14, frond: 3.6 },
    };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (const [kind, list] of Object.entries(this.trees)) {
      const o = specs[kind]; if (!list.length) continue;
      const leafM = foliageMaterial(kind === 'palm' ? frondTexture() : leafTexture(kind), this.windTime, { amp: kind === 'palm' ? 0.18 : 0.07, freq: kind === 'palm' ? 1.1 : 1.5 });
      const variants = [0, 1].map(() => (o.type === 'palm' ? this._palm(o) : o.type === 'ashoka' ? this._ashoka(o) : this._broadleaf(o)));
      variants.forEach((v, vi) => {
        const mine = list.filter((_, i) => i % 2 === vi); if (!mine.length) return;
        const wood = new THREE.InstancedMesh(v.wood, o.type === 'palm' ? palmBarkM : barkM, mine.length);
        const leaves = new THREE.InstancedMesh(v.leaves, leafM, mine.length);
        const nuts = v.nuts ? new THREE.InstancedMesh(v.nuts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), mine.length) : null;
        mine.forEach((t, i) => {
          m.compose(new V(t.x, 0, t.z), q.setFromAxisAngle(new V(0, 1, 0), t.r), new V(t.s, t.s * (0.9 + rnd() * 0.2), t.s));
          wood.setMatrixAt(i, m); leaves.setMatrixAt(i, m); if (nuts) nuts.setMatrixAt(i, m);
          leaves.setColorAt(i, c.setHSL(0, 0, 0.88 + rnd() * 0.14));
        });
        wood.castShadow = leaves.castShadow = true; leaves.receiveShadow = this.quality.level === 'high'; wood.receiveShadow = true;
        S.add(wood, leaves); if (nuts) S.add(nuts);
      });
    }
  }

  // -------- shrubs, beds and flowers
  _shrubGeo(bloomKind) {
    const cards = [], centre = new V(0, 0.25, 0);
    for (let k = 0; k < 24; k++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.75, y = 0.15 + rnd() * 0.55 * (1 - r * 0.5); cards.push(card(0.78, new V(Math.cos(a) * r, y, Math.sin(a) * r), centre)); }
    return merge(cards);
  }
  _flowerGeos() {
    // marigold: ruffled pompom
    const mg = new THREE.IcosahedronGeometry(0.075, 2), mp = mg.attributes.position, v = new V();
    for (let i = 0; i < mp.count; i++) { v.fromBufferAttribute(mp, i); const k = 1 + Math.sin(v.x * 140) * Math.sin(v.y * 130) * Math.sin(v.z * 150) * 0.22; v.multiplyScalar(k); v.y *= 0.72; mp.setXYZ(i, v.x, v.y, v.z); }
    mg.computeVertexNormals(); paint(mg, '#ffffff');
    // hibiscus: five flared petals and a stamen
    const hib = [];
    for (let i = 0; i < 5; i++) { const p = new THREE.CircleGeometry(0.075, 10); p.scale(1, 0.85, 1); p.translate(0, 0.07, 0); p.rotateX(-1.05); p.rotateY(i / 5 * Math.PI * 2); hib.push(paint(p, '#d81f26')); }
    const st = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4); st.translate(0, 0.06, 0); st.rotateX(-0.4); hib.push(paint(st, '#ffd23f'));
    // jasmine: small white star
    const js = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.018 : 0.05; i ? js.lineTo(Math.cos(a) * r, Math.sin(a) * r) : js.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const jg = new THREE.ShapeGeometry(js); jg.rotateX(-Math.PI / 2); paint(jg, '#ffffff');
    return { marigold: mg, hibiscus: merge(hib), jasmine: jg };
  }
  _buildBeds() {
    if (!this.beds.length && !this.hedges.length) return;
    const S = this.scene, m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    // curbs and soil
    const curbGeo = merge([new THREE.CylinderGeometry(1, 1.04, 0.3, 28, 1, true).translate(0, 0.15, 0), new THREE.RingGeometry(0.93, 1.07, 28).rotateX(-Math.PI / 2).translate(0, 0.3, 0)]);
    const curbs = new THREE.InstancedMesh(curbGeo, new THREE.MeshStandardMaterial({ color: '#e8dcc6', roughness: 0.7 }), this.beds.length);
    const soil = new THREE.InstancedMesh(new THREE.CircleGeometry(0.95, 24).rotateX(-Math.PI / 2).translate(0, 0.24, 0), new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 }), this.beds.length);
    this.beds.forEach((b, i) => { m.compose(new V(b.x, 0, b.z), q.identity(), new V(b.r, 1, b.r)); curbs.setMatrixAt(i, m); soil.setMatrixAt(i, m); });
    curbs.receiveShadow = soil.receiveShadow = true; curbs.castShadow = true; S.add(curbs, soil);
    // shrubs
    const shrubs = [...this.beds.map(b => ({ x: b.x, z: b.z, s: b.r * 0.9, y: 0.22, kind: 'shrub' })), ...this.hedges.map(h => ({ x: h.x, z: h.z, s: h.r, y: 0, kind: h.bloom ? 'bougainvillea' : 'shrub' }))];
    for (const kind of ['shrub', 'bougainvillea']) {
      const list = shrubs.filter(s => s.kind === kind); if (!list.length) continue;
      const im = new THREE.InstancedMesh(this._shrubGeo(), foliageMaterial(leafTexture(kind), this.windTime, { amp: 0.03, freq: 2 }), list.length);
      list.forEach((s, i) => { m.compose(new V(s.x, s.y, s.z), q.setFromAxisAngle(new V(0, 1, 0), rnd() * 6), new V(s.s, s.s * (0.8 + rnd() * 0.4), s.s)); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL(0, 0, 0.85 + rnd() * 0.15)); });
      im.castShadow = this.quality.level === 'high'; im.receiveShadow = true; S.add(im);
    }
    // flowers sit on the shrub tops
    const G = this._flowerGeos(), fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    const lists = { marigold: [], hibiscus: [], jasmine: [] }, cols = { marigold: [] };
    for (const b of this.beds) {
      const n = Math.round(26 * b.r * b.r + 8);
      for (let k = 0; k < n; k++) {
        const kind = pick(b.palette), a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * b.r * 0.78, y = 0.22 + (0.18 + 0.5 * (1 - (r / b.r) * 0.6)) * b.r * 0.9 + 0.04;
        lists[kind].push({ p: new V(b.x + Math.cos(a) * r, y, b.z + Math.sin(a) * r), tilt: (r / b.r) * 0.8, a, s: 0.85 + rnd() * 0.4 });
        if (kind === 'marigold') cols.marigold.push(pick(['#f29a17', '#f6b21c', '#ffcc33', '#ea7a12']));
      }
    }
    const e = new THREE.Euler();
    for (const [kind, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(G[kind], fm, list.length);
      list.forEach((f, i) => { e.set(Math.cos(f.a) * f.tilt * 0.6, rnd() * 6, -Math.sin(f.a) * f.tilt * 0.6); m.compose(f.p, q.setFromEuler(e), new V(f.s, f.s, f.s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(kind === 'marigold' ? cols.marigold[i] : '#ffffff')); });
      S.add(im);
    }
    // bougainvillea hedges carry magenta blooms of their own (in the leaf texture)
  }

  // -------- lotus ponds
  _lotusGeo() {
    const parts = [];
    const rings = [[7, 0.17, 0.95, 0], [9, 0.2, 0.65, 0.2], [11, 0.21, 0.35, 0.05]];
    for (const [n, len, tilt, off] of rings) for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(0.09, len, 2, 5), p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k) / len + 0.5; p.setX(k, p.getX(k) * Math.sin(Math.max(0.15, y) * Math.PI) * (y > 0.85 ? 0.6 : 1)); p.setZ(k, -Math.abs(p.getX(k)) * 0.9 + y * y * 0.03); p.setY(k, y * len); }
      g.rotateX(-(Math.PI / 2 - tilt) * 0.95); g.rotateY((i + off) / n * Math.PI * 2);
      const col = new Float32Array(p.count * 3), base = new THREE.Color('#fff4f4'), tip = new THREE.Color('#e46a8e');
      for (let k = 0; k < p.count; k++) { const c = base.clone().lerp(tip, Math.pow(p.getY(k) > 0 ? Math.min(1, Math.hypot(p.getX(k), p.getZ(k), p.getY(k)) / len) : 0, 1.6)); col.set([c.r, c.g, c.b], k * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); parts.push(g);
    }
    const pod = new THREE.CylinderGeometry(0.045, 0.035, 0.05, 10); pod.translate(0, 0.04, 0); parts.push(paint(pod, '#e9d24a'));
    return merge(parts);
  }
  _budGeo() {
    const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.4, 5); stem.translate(0, 0.2, 0); paint(stem, '#4f7a33');
    const bud = new THREE.SphereGeometry(0.06, 10, 8); bud.scale(1, 1.8, 1); bud.translate(0, 0.46, 0);
    const p = bud.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#f4d6dc'), b = new THREE.Color('#d9507a');
    for (let k = 0; k < p.count; k++) { const c = a.clone().lerp(b, Math.min(1, Math.max(0, (p.getY(k) - 0.4) / 0.16))); col.set([c.r, c.g, c.b], k * 3); }
    bud.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return merge([stem, bud]);
  }
  _buildPonds() {
    if (!this.ponds.length) return;
    const S = this.scene, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const padGeo = new THREE.CircleGeometry(0.3, 18, 0.25, Math.PI * 2 - 0.5); padGeo.rotateX(-Math.PI / 2);
    const pp = padGeo.attributes.position; for (let i = 0; i < pp.count; i++) { const r = Math.hypot(pp.getX(i), pp.getZ(i)); pp.setY(i, Math.pow(r / 0.3, 4) * 0.02); } padGeo.computeVertexNormals();
    const pads = [], flowers = [], buds = [];
    for (const P of this.ponds) {
      const spot = () => { if (P.rect) return new V(P.x + (rnd() - 0.5) * P.rect[0], 0, P.z + (rnd() - 0.5) * P.rect[1]); const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * P.r; return new V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r); };
      for (let i = 0; i < P.flowers * 3; i++) pads.push({ p: spot().setY(P.y + 0.005 + rnd() * 0.004), s: 0.6 + rnd() * 0.8 });
      for (let i = 0; i < P.flowers; i++) flowers.push({ p: spot().setY(P.y + 0.01), s: 0.8 + rnd() * 0.5 });
      for (let i = 0; i < Math.ceil(P.flowers / 2); i++) buds.push({ p: spot().setY(P.y - 0.02), s: 0.8 + rnd() * 0.5 });
    }
    const padIM = new THREE.InstancedMesh(padGeo, new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.5, side: THREE.DoubleSide }), pads.length);
    pads.forEach((d, i) => { m.compose(d.p, q.setFromAxisAngle(new V(0, 1, 0), rnd() * 6), new V(d.s, 1, d.s)); padIM.setMatrixAt(i, m); padIM.setColorAt(i, c.setHSL(0.27, 0.2, 0.75 + rnd() * 0.25)); });
    const flIM = new THREE.InstancedMesh(this._lotusGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, emissive: '#2a0d14', emissiveIntensity: 0.4 }), flowers.length);
    flowers.forEach((d, i) => { m.compose(d.p, q.setFromAxisAngle(new V(0, 1, 0), rnd() * 6), new V(d.s, d.s, d.s)); flIM.setMatrixAt(i, m); });
    const budIM = new THREE.InstancedMesh(this._budGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), buds.length);
    buds.forEach((d, i) => { e.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.2); m.compose(d.p, q.setFromEuler(e), new V(d.s, d.s, d.s)); budIM.setMatrixAt(i, m); });
    padIM.receiveShadow = true; S.add(padIM, flIM, budIM);
  }

  // -------- brass urli bowls with floating flowers
  _buildUrlis(addFlame) {
    const S = this.scene;
    const bowl = new THREE.LatheGeometry([[0, 0.02], [0.45, 0.02], [0.7, 0.08], [0.82, 0.18], [0.86, 0.26], [0.9, 0.27], [0.84, 0.28], [0.78, 0.2], [0.6, 0.12], [0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    const ped = new THREE.LatheGeometry([[0, 0], [0.5, 0], [0.5, 0.08], [0.32, 0.14], [0.26, 0.38], [0.36, 0.44], [0.4, 0.5], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    const stone = new THREE.MeshStandardMaterial({ color: '#efe4d0', roughness: 0.6 });
    const water = new THREE.MeshStandardMaterial({ color: '#2f6f72', roughness: 0.1, metalness: 0.3 });
    const petalGeo = new THREE.CircleGeometry(0.035, 6); petalGeo.rotateX(-Math.PI / 2);
    const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), this.urlis.length * 60);
    const m = new THREE.Matrix4(), c = new THREE.Color(); let k = 0;
    for (const u of this.urlis) {
      const p = new THREE.Mesh(ped, stone); p.position.set(u.x, 0, u.z); p.castShadow = true; S.add(p);
      const b = new THREE.Mesh(bowl, brass); b.position.set(u.x, 0.5, u.z); b.castShadow = true; S.add(b);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28), water); w.rotation.x = -Math.PI / 2; w.position.set(u.x, 0.73, u.z); S.add(w);
      for (let i = 0; i < 60; i++) {
        const ring = i < 36, a = ring ? i / 36 * Math.PI * 2 : rnd() * Math.PI * 2, r = ring ? 0.66 : Math.sqrt(rnd()) * 0.45;
        m.makeTranslation(u.x + Math.cos(a) * r, 0.735 + rnd() * 0.004, u.z + Math.sin(a) * r); petals.setMatrixAt(k, m);
        petals.setColorAt(k++, c.set(ring ? (i % 2 ? '#f29a17' : '#ffd23f') : pick(['#e8442e', '#f06a8c', '#ffffff', '#d21f7a'])));
      }
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; addFlame(new V(u.x + Math.cos(a) * 0.32, 0.74, u.z + Math.sin(a) * 0.32)); }
    }
    S.add(petals);
  }

  // -------- grass tufts across the lawns
  _buildGrass() {
    if (!this.grass.length) return;
    const blades = []; for (let i = 0; i < 3; i++) { const g = new THREE.PlaneGeometry(0.6, 0.36); g.translate(0, 0.18, 0); g.rotateY(i / 3 * Math.PI); const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0); blades.push(g); }
    const im = new THREE.InstancedMesh(merge(blades), foliageMaterial(grassTexture(), this.windTime, { amp: 0.6, freq: 2.2, alphaTest: 0.5 }), this.grass.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    this.grass.forEach(([x, z], i) => { const s = 0.7 + rnd() * 0.8; m.compose(new V(x, 0, z), q.setFromAxisAngle(new V(0, 1, 0), rnd() * 6), new V(s, s * (0.7 + rnd() * 0.6), s)); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL(0.24 + rnd() * 0.05, 0.35, 0.55 + rnd() * 0.2)); });
    im.receiveShadow = true; this.scene.add(im);
  }

  build(addFlame) { this._buildTrees(); this._buildBeds(); this._buildPonds(); this._buildUrlis(addFlame); this._buildGrass(); }
}
