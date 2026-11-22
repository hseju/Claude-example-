import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { triplanar } from './pbr.js';
import { relief, mergeGeos, petalRing } from './ornament.js';
import { brass, clay, diyaGeometry, bellGeometry } from './architecture.js';

// The prayer halls as an ancient rock-cut cave shrine, after the cave temples: a chamber hewn from living rock, its walls
// and ceiling rough with chisel and fracture, massive rough-hewn pillars (a square base rising to an octagonal shaft and a
// spreading capital) carrying beams of the same rock, and an opening in the rock through which a shaft of daylight falls
// on the sanctum. The sanctum is a niche shrine of dressed granite blocks on two broad steps: stout pilasters, a heavy
// lintel and cornice. Carved into the walls, in deep relief in sunk panels: Shiva dancing in his ring of fire, Shiva in
// meditation, Ganesha, elephants at a lotus tree, and two door guardians flanking the shrine; lotus medallions on the
// pillar bases. It is lit by oil lamps: diyas on the rock benches and the floor, two brass lamp towers, warm halos on the
// stone and long reflections in the wet floor.

const NAVE = 6.2, AISLE = 5.3, TOPY = 8.6;
// the stepped dome over the middle of the hall: six courses, each stepping in and up, from a ring 5.4 m across the
// flat rock ceiling up to the opening at the top
const DOME = { R: 5.4, N: 6, RISE: (TOPY - AISLE) / 6, IN: (5.4 - 0.9) / 5 };
export const HALL = { X: 11, BACK: -6.8, FRONT: 10.9, PIL_X: NAVE, PIL_Z: [-3.8, 0.4, 4.6, 8.6], NICHE_W: 2.45, NICHE_TOP: 3.5, BENCH: 0.45, CELL_W: 2.75, CELL_BACK: -12.0, RING_IN: 1.5, RING_OUT: 2.45, RING_R: 2.0,
  OCULUS: new THREE.Vector3(0, TOPY, -0.4), AIM: new THREE.Vector3(0, 1.4, -8.9) };
export const ROCK = '#615a54', SHRINE = '#5f5852', DEEP = '#3f3832', CARVE = '#a69c92';   // CARVE is given to relief(), which treats it as linear

export const cave = (tint = ROCK) => triplanar('cave', { tint, tile: 3.2, roughness: 0.95, normal: 1.5, side: THREE.DoubleSide, cacheKey: 'cave' });
export const granite = (tint = SHRINE) => triplanar('granite', { tint, tile: 2.2, roughness: 0.88, normal: 1.3, cacheKey: 'shrine' });
export const carvedStone = (tint = SHRINE) => triplanar('granite', { tint, tile: 1.6, roughness: 0.85, normal: 1.1, cacheKey: 'carve' });
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// a carved band material whose motif repeats every `unit` metres along a band `len` long
export function carved(kind, len, unit = 1.8, vertical = false) { return relief(kind, CARVE, { repeat: [Math.max(1, Math.round(len / unit)), 1], strength: 6, roughness: 0.86, vertical }); }

// ---------------------------------------------------------------- noise, for rock
function hash3(i, j, k) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t, c = (a, b, d) => hash3(xi + a, yi + b, zi + d);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z) => 0.55 * vnoise(x * 0.42, y * 0.42, z * 0.42) + 0.3 * vnoise(x * 1.05 + 7.1, y * 1.05 + 3.3, z * 1.05 + 1.7) + 0.15 * vnoise(x * 2.6 + 2.9, y * 2.6 + 8.1, z * 2.6 + 5.3);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 0 inside any of the rects [u0, u1, v0, v1] (where the rock is dressed flat), easing to 1 away from them
const flatness = (rects, u, v) => rects.reduce((m, [u0, u1, v0, v1]) => Math.min(m, smooth(0.06, 0.4, Math.hypot(Math.max(u0 - u, 0, u - u1), Math.max(v0 - v, 0, v - v1)))), 1);
function axis(a, b, step, breaks = []) { const s = new Set(), n = Math.max(1, Math.round((b - a) / step)); for (let i = 0; i <= n; i++) s.add(+(a + (b - a) * i / n).toFixed(4)); for (const v of breaks) if (v > a && v < b) s.add(+v.toFixed(4)); return [...s].sort((p, q) => p - q); }
// a rough surface over a (u, v) grid; place(u, v) gives the point; faces whose centre lies in hole(u, v) are left out
function roughGrid(us, vs, place, hole) {
  const pos = [], idx = [], nu = us.length;
  for (const v of vs) for (const u of us) { const p = place(u, v); pos.push(p[0], p[1], p[2]); }
  for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
    if (hole && hole((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue;
    const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// hewn: every vertex pushed by a smooth 3D noise field, so shared corners move together and the solid stays closed
function roughen(g, amp, freq = 2.4, seed = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = freq, F = freq * 3.1, n = (o) => (vnoise(x * f + seed + o, y * f + o * 0.7, z * f - o) - 0.5) * 2 + (vnoise(x * F + o, y * F + seed, z * F + o) - 0.5) * 0.7;
    p.setXYZ(i, x + n(0) * amp, y + n(17.3) * amp * 0.5, z + n(31.7) * amp);
  }
  g.computeVertexNormals(); return g;
}
export function roughBox(w, h, d, { amp = 0.04, freq = 2.4, seg = 0.22, seed = 0 } = {}) {
  return roughen(new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / seg)), Math.max(1, Math.ceil(h / seg)), Math.max(1, Math.ceil(d / seg))), amp, freq, seed);
}

// ---------------------------------------------------------------- carved relief panels
// Each figure is drawn as a height map (light = raised), rounded off into pillowy forms, then carved for real: the broad
// forms displace the panel's mesh, the finer modelling goes into a normal map, and the recesses darken with grime.
function pen(x, W, H) {
  const g = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
  const path = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a * W, b * H) : x.moveTo(a * W, b * H))); };
  return {
    W, H, A: W / H,
    e(fx, fy, rx, ry, v, rot = 0) { x.fillStyle = g(v); x.beginPath(); x.ellipse(fx * W, fy * H, Math.max(0.5, rx * W), Math.max(0.5, ry * H), rot, 0, Math.PI * 2); x.fill(); },
    l(pts, w, v) { x.strokeStyle = g(v); x.lineWidth = Math.max(1, w * W); x.lineCap = 'round'; x.lineJoin = 'round'; path(pts); x.stroke(); },
    p(pts, v) { x.fillStyle = g(v); path(pts); x.closePath(); x.fill(); },
    r(fx, fy, rr, w, v, a0 = 0, a1 = Math.PI * 2) { x.strokeStyle = g(v); x.lineWidth = Math.max(1, w * W); x.lineCap = 'round'; x.beginPath(); x.arc(fx * W, fy * H, rr * W, a0, a1); x.stroke(); },
  };
}
const seat = (d) => { d.e(0.5, 0.9, 0.34, 0.03, 0.4); for (let i = -6; i <= 6; i++) d.e(0.5 + i * 0.052, 0.866, 0.026, 0.03, 0.55); };
const FIG = {
  // Shiva as Nataraja, dancing in his ring of fire on the dwarf of ignorance
  nataraja(d) {
    seat(d);
    d.r(0.5, 0.5, 0.38, 0.03, 0.62, Math.PI * 0.6, Math.PI * 2.4);
    for (let k = 0; k <= 24; k++) { const a = Math.PI * (0.64 + k / 24 * 1.72); d.e(0.5 + Math.cos(a) * 0.425, 0.5 + Math.sin(a) * 0.425 * d.A, 0.018, 0.026, 0.56, a - Math.PI / 2); }
    d.e(0.47, 0.8, 0.13, 0.026, 0.62); d.e(0.33, 0.795, 0.035, 0.026, 0.68);
    d.l([[0.46, 0.56], [0.41, 0.66], [0.45, 0.77]], 0.06, 0.82); d.e(0.47, 0.775, 0.04, 0.012, 0.85);
    d.l([[0.53, 0.56], [0.64, 0.61], [0.75, 0.6]], 0.055, 0.86); d.e(0.77, 0.6, 0.03, 0.012, 0.88, -0.3);
    d.e(0.5, 0.55, 0.085, 0.035, 0.8); d.l([[0.42, 0.53], [0.3, 0.5], [0.22, 0.54]], 0.022, 0.62); d.l([[0.58, 0.54], [0.68, 0.5]], 0.018, 0.6);
    d.p([[0.4, 0.36], [0.6, 0.36], [0.56, 0.47], [0.535, 0.53], [0.465, 0.53], [0.44, 0.47]], 0.84); d.e(0.5, 0.41, 0.075, 0.04, 0.9);
    d.l([[0.59, 0.37], [0.7, 0.34], [0.73, 0.25]], 0.04, 0.82); d.e(0.735, 0.225, 0.028, 0.012, 0.9); d.e(0.735, 0.248, 0.022, 0.012, 0.86);
    d.l([[0.41, 0.37], [0.3, 0.34], [0.27, 0.25]], 0.04, 0.82); d.e(0.265, 0.21, 0.02, 0.032, 0.8);
    d.l([[0.58, 0.385], [0.65, 0.44], [0.6, 0.4]], 0.035, 0.88); d.e(0.6, 0.395, 0.022, 0.02, 0.92);
    d.l([[0.42, 0.385], [0.47, 0.44], [0.62, 0.47]], 0.035, 0.9);
    d.e(0.5, 0.3, 0.045, 0.04, 0.95); d.p([[0.45, 0.275], [0.5, 0.2], [0.55, 0.275]], 0.86);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) d.l([[0.5 + s * 0.04, 0.27 + k * 0.012], [0.5 + s * (0.14 + k * 0.03), 0.25 + k * 0.025], [0.5 + s * (0.24 + k * 0.02), 0.28 + k * 0.02]], 0.012, 0.58);
    d.r(0.5, 0.34, 0.05, 0.008, 1.0, 0.15 * Math.PI, 0.85 * Math.PI);
  },
  // Shiva the great yogi, seated in meditation under an arch, trident beside him and Nandi at his feet
  yogi(d) {
    seat(d);
    d.r(0.5, 0.3, 0.13, 0.016, 0.55);
    for (const s of [-1, 1]) d.l([[0.5 + s * 0.38, 0.84], [0.5 + s * 0.38, 0.3]], 0.03, 0.5);
    d.r(0.5, 0.3, 0.38, 0.03, 0.5, Math.PI, Math.PI * 2);
    d.e(0.5, 0.74, 0.3, 0.075, 0.74); for (const s of [-1, 1]) d.e(0.5 + s * 0.09, 0.715, 0.05, 0.022, 0.84);
    d.p([[0.37, 0.4], [0.63, 0.4], [0.58, 0.55], [0.56, 0.66], [0.44, 0.66], [0.42, 0.55]], 0.8);
    for (const s of [-1, 1]) d.l([[0.5 + s * 0.13, 0.41], [0.5 + s * 0.17, 0.56], [0.5 + s * 0.06, 0.66]], 0.045, 0.82);
    d.e(0.5, 0.665, 0.075, 0.022, 0.92);
    d.e(0.5, 0.31, 0.05, 0.045, 0.95);
    d.e(0.5, 0.235, 0.042, 0.05, 0.86); d.l([[0.46, 0.25], [0.54, 0.25]], 0.01, 0.95); d.l([[0.465, 0.22], [0.535, 0.22]], 0.01, 0.95);
    d.r(0.45, 0.2, 0.022, 0.008, 0.95, Math.PI * 0.6, Math.PI * 1.7);
    d.r(0.5, 0.37, 0.055, 0.012, 0.9, 0.1 * Math.PI, 0.9 * Math.PI);
    d.l([[0.78, 0.86], [0.78, 0.22]], 0.014, 0.72); d.l([[0.74, 0.22], [0.74, 0.26], [0.82, 0.26], [0.82, 0.22]], 0.012, 0.72); d.l([[0.78, 0.26], [0.78, 0.17]], 0.014, 0.75);
    d.e(0.24, 0.8, 0.075, 0.03, 0.62); d.e(0.17, 0.78, 0.025, 0.025, 0.68); d.e(0.27, 0.775, 0.025, 0.02, 0.66);
  },
  // Ganesha seated, four-armed, with his axe, noose, bowl of sweets and his mouse
  ganesha(d) {
    seat(d);
    d.r(0.5, 0.32, 0.16, 0.016, 0.55);
    d.e(0.44, 0.76, 0.24, 0.06, 0.74); d.e(0.63, 0.72, 0.075, 0.07, 0.8);
    d.e(0.5, 0.62, 0.15, 0.11, 0.9); d.e(0.5, 0.48, 0.13, 0.07, 0.8);
    for (const s of [-1, 1]) d.e(0.5 + s * 0.15, 0.34, 0.09, 0.075, 0.68);
    d.e(0.5, 0.34, 0.095, 0.07, 0.92); d.p([[0.43, 0.29], [0.5, 0.17], [0.57, 0.29]], 0.86);
    d.l([[0.5, 0.37], [0.51, 0.45], [0.47, 0.5], [0.41, 0.49]], 0.034, 0.96); d.l([[0.54, 0.4], [0.57, 0.43]], 0.012, 1.0);
    for (const s of [-1, 1]) d.l([[0.5 + s * 0.12, 0.45], [0.5 + s * 0.24, 0.4], [0.5 + s * 0.25, 0.31]], 0.035, 0.8);
    d.p([[0.22, 0.27], [0.28, 0.27], [0.25, 0.33]], 0.85); d.l([[0.25, 0.3], [0.25, 0.36]], 0.01, 0.85); d.r(0.75, 0.29, 0.03, 0.01, 0.85);
    d.l([[0.38, 0.5], [0.31, 0.58], [0.36, 0.63]], 0.035, 0.84); d.e(0.35, 0.635, 0.04, 0.02, 0.9);
    d.l([[0.62, 0.5], [0.68, 0.58], [0.65, 0.66]], 0.035, 0.84);
    d.e(0.76, 0.84, 0.05, 0.02, 0.62); d.e(0.72, 0.832, 0.015, 0.012, 0.7);
  },
  // a door guardian, broad-chested, leaning on his great club, one hand raised in warning
  dvarapala(d) {
    d.e(0.5, 0.94, 0.4, 0.02, 0.45);
    d.l([[0.8, 0.92], [0.78, 0.5]], 0.07, 0.72); d.e(0.78, 0.46, 0.1, 0.05, 0.84); for (let k = 0; k < 3; k++) d.l([[0.7, 0.44 + k * 0.02], [0.86, 0.44 + k * 0.02]], 0.01, 0.92);
    d.l([[0.42, 0.6], [0.4, 0.75], [0.42, 0.9]], 0.1, 0.8); d.l([[0.58, 0.6], [0.63, 0.73], [0.57, 0.9]], 0.1, 0.8);
    d.e(0.42, 0.915, 0.07, 0.012, 0.84); d.e(0.57, 0.915, 0.07, 0.012, 0.84);
    d.p([[0.3, 0.5], [0.7, 0.5], [0.74, 0.64], [0.26, 0.64]], 0.76); d.l([[0.32, 0.53], [0.5, 0.58], [0.68, 0.53]], 0.025, 0.88); d.l([[0.36, 0.6], [0.3, 0.72]], 0.02, 0.7);
    d.p([[0.26, 0.29], [0.74, 0.29], [0.66, 0.42], [0.62, 0.5], [0.38, 0.5], [0.34, 0.42]], 0.86); d.e(0.5, 0.35, 0.18, 0.04, 0.9);
    d.l([[0.7, 0.31], [0.82, 0.38], [0.8, 0.44]], 0.08, 0.84);
    d.l([[0.3, 0.31], [0.18, 0.26], [0.2, 0.16]], 0.075, 0.84); d.l([[0.2, 0.16], [0.2, 0.1]], 0.02, 0.88);
    d.e(0.5, 0.215, 0.1, 0.045, 0.95); d.p([[0.4, 0.19], [0.44, 0.08], [0.5, 0.04], [0.56, 0.08], [0.6, 0.19]], 0.88);
    for (let k = 0; k < 3; k++) d.l([[0.42 + k * 0.01, 0.17 - k * 0.04], [0.58 - k * 0.01, 0.17 - k * 0.04]], 0.012, 0.98);
    d.r(0.5, 0.29, 0.12, 0.012, 1.0, 0.15 * Math.PI, 0.85 * Math.PI); d.r(0.5, 0.31, 0.16, 0.01, 1.0, 0.2 * Math.PI, 0.8 * Math.PI);
  },
  // two caparisoned elephants raising their trunks to a lotus tree
  elephants(d) {
    d.e(0.5, 0.9, 0.42, 0.025, 0.42);
    d.l([[0.5, 0.88], [0.5, 0.3]], 0.025, 0.62);
    for (const [y, s] of [[0.7, -1], [0.6, 1], [0.5, -1], [0.42, 1]]) { d.l([[0.5, y], [0.5 + s * 0.08, y - 0.04]], 0.012, 0.6); d.e(0.5 + s * 0.1, y - 0.05, 0.035, 0.022, 0.7); }
    for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i / 8 * 0.9); d.e(0.5 + Math.cos(a) * 0.08, 0.27 + Math.sin(a) * 0.06, 0.045, 0.02, 0.82, a); }
    d.e(0.5, 0.27, 0.05, 0.025, 0.9);
    for (const s of [-1, 1]) {
      const X = (f) => 0.5 + s * f;
      d.e(X(0.29), 0.63, 0.17, 0.1, 0.8);
      for (const f of [0.18, 0.24, 0.34, 0.4]) d.l([[X(f), 0.68], [X(f), 0.84]], 0.055, 0.74);
      d.e(X(0.13), 0.55, 0.075, 0.07, 0.86); d.e(X(0.18), 0.56, 0.06, 0.08, 0.7);
      d.l([[X(0.08), 0.58], [X(0.06), 0.5], [X(0.08), 0.42], [X(0.06), 0.36]], 0.03, 0.9); d.l([[X(0.1), 0.6], [X(0.06), 0.62]], 0.012, 1.0);
      d.p([[X(0.2), 0.56], [X(0.38), 0.56], [X(0.4), 0.66], [X(0.18), 0.66]], 0.9); for (let k = 0; k < 6; k++) d.e(X(0.2 + k * 0.035), 0.665, 0.008, 0.008, 1.0);
      d.l([[X(0.46), 0.6], [X(0.48), 0.7]], 0.012, 0.7);
    }
  },
  // a lotus medallion
  rosette(d) {
    d.r(0.5, 0.5, 0.42, 0.05, 0.62);
    for (const [n, r0, len, v, off] of [[16, 0.12, 0.26, 0.78, 0], [8, 0.07, 0.2, 0.9, Math.PI / 8]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + off; d.e(0.5 + Math.cos(a) * (r0 + len / 2), 0.5 + Math.sin(a) * (r0 + len / 2), len / 2, 0.045, v, a); }
    d.e(0.5, 0.5, 0.08, 0.08, 1.0);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; d.e(0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36, 0.016, 0.016, 0.85); }
  },
};
function blur(a, W, H, r) {
  if (r < 1) return a.slice();
  const t = new Float32Array(W * H), o = new Float32Array(W * H), n = r * 2 + 1;
  for (let y = 0; y < H; y++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * W + Math.min(W - 1, Math.max(0, k))]; for (let x = 0; x < W; x++) { t[y * W + x] = s / n; s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(H - 1, Math.max(0, k)) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = s / n; s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
  return o;
}
const PX = 100;   // texels per metre
// carve a drawing: draw(pen) lays down heights (light = raised); they are rounded into pillowy forms with a little chisel
// texture, then turned into a normal map and a colour map darkened in the recesses. `split` keeps the broad forms out of the
// normal map (for when the mesh itself is displaced by `low`); otherwise the normal map carries the whole relief.
export function carveMaps(draw, W, H, { depth = 0.2, px = PX, seed = 1, tint = ROCK, split = false, frame = 0, mirror = false, wrap = false } = {}) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = 'rgb(14,14,14)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighten';
  if (frame) { const b = frame * W; x.strokeStyle = 'rgb(184,184,184)'; x.lineWidth = b; x.strokeRect(b / 2, b / 2, W - b, H - b); x.strokeStyle = 'rgb(120,120,120)'; x.lineWidth = Math.max(1, 0.014 * W); x.strokeRect(b * 1.6, b * 1.6, W - b * 3.2, H - b * 3.2); }
  x.save(); if (mirror) { x.translate(W, 0); x.scale(-1, 1); } draw(pen(x, W, H), x); x.restore();
  const src = x.getImageData(0, 0, W, H).data, h0 = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h0[i] = src[i * 4] / 255;
  const sc = px / 100, b1 = blur(h0, W, H, Math.round(2 * sc)), b3 = blur(h0, W, H, Math.round(6 * sc)), b8 = blur(h0, W, H, Math.round(14 * sc)), hp = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const qx = i % W, qy = (i / W) | 0; hp[i] = 0.3 * b1[i] + 0.38 * b3[i] + 0.32 * b8[i] + (vnoise(qx * 0.09 / sc, qy * 0.09 / sc, seed) - 0.5) * 0.05 + (vnoise(qx * 0.45 / sc, qy * 0.45 / sc, seed + 9) - 0.5) * 0.02; }
  const low = split ? blur(hp, W, H, Math.round(3 * sc)) : null, big = blur(hp, W, H, Math.round(12 * sc));
  const nc = document.createElement('canvas'); nc.width = W; nc.height = H; const nx = nc.getContext('2d'), nimg = nx.createImageData(W, H);
  const cc = document.createElement('canvas'); cc.width = W; cc.height = H; const cx = cc.getContext('2d'), cimg = cx.createImageData(W, H), base = new THREE.Color(tint);
  const k = depth * px * 0.5 * 1.4, br = [Math.pow(base.r, 1 / 2.2), Math.pow(base.g, 1 / 2.2), Math.pow(base.b, 1 / 2.2)];
  const hi = (j) => (low ? hp[j] - low[j] : hp[j]), X = (v) => (wrap ? (v + W) % W : Math.min(W - 1, Math.max(0, v)));
  for (let py = 0; py < H; py++) for (let qx = 0; qx < W; qx++) {
    const i = py * W + qx;
    const dx = (hi(py * W + X(qx + 1)) - hi(py * W + X(qx - 1))) * k, dy = (hi(Math.min(H - 1, py + 1) * W + qx) - hi(Math.max(0, py - 1) * W + qx)) * k;
    const l = Math.hypot(dx, dy, 1); nimg.data[i * 4] = (-dx / l * 0.5 + 0.5) * 255; nimg.data[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; nimg.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; nimg.data[i * 4 + 3] = 255;
    const shade = (0.8 + 0.22 * Math.pow(Math.max(0, hp[i]), 0.8)) * Math.min(1.04, Math.max(0.6, 1 - (big[i] - hp[i]) * 2.0)) * (0.9 + vnoise(qx * 0.3 / sc, py * 0.3 / sc, seed + 3) * 0.2);
    for (let ch = 0; ch < 3; ch++) cimg.data[i * 4 + ch] = Math.min(255, br[ch] * 255 * shade); cimg.data[i * 4 + 3] = 255;
  }
  nx.putImageData(nimg, 0, 0); cx.putImageData(cimg, 0, 0);
  const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const nmap = new THREE.CanvasTexture(nc); nmap.anisotropy = 4;
  if (wrap) { map.wrapS = nmap.wrapS = THREE.RepeatWrapping; nmap.repeat = map.repeat; }
  return { map, nmap, low, hp, W, H };
}
export function reliefPanel(kind, w, h, { mirror = false, depth = 0.2, density = 24, frame = true, seed = 1, tint = ROCK } = {}) {
  const W = Math.round(w * PX), H = Math.round(h * PX);
  const { map, nmap, low } = carveMaps((d) => FIG[kind](d), W, H, { depth, seed, tint, split: true, frame: frame ? 0.05 : 0, mirror });
  // the carving: broad forms in the mesh, the finer modelling in the normal map
  const su = Math.max(8, Math.round(w * density)), sv = Math.max(8, Math.round(h * density)), geo = new THREE.PlaneGeometry(w, h, su, sv), pos = geo.attributes.position, uv = geo.attributes.uv;
  const sample = (arr, u, v) => { const fx = u * (W - 1), fy = (1 - v) * (H - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return (arr[y0 * W + x0] * (1 - tx) + arr[y0 * W + x1] * tx) * (1 - ty) + (arr[y1 * W + x0] * (1 - tx) + arr[y1 * W + x1] * tx) * ty; };
  for (let i = 0; i < pos.count; i++) pos.setZ(i, sample(low, uv.getX(i), uv.getY(i)) * depth);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughness: 0.9 }));
  m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- the rock-cut pillar: square base, octagonal shaft, a middle block, spreading capital
export function pillarGeometry() {
  const parts = [];
  const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d, Math.ceil(w / 0.2), Math.ceil(h / 0.2), Math.ceil(d / 0.2)); g.translate(0, y + h / 2, 0); return g; };
  const oct = (r0, r1, h, y) => { const g = new THREE.CylinderGeometry(r1, r0, h, 8, Math.ceil(h / 0.2)); g.rotateY(Math.PI / 8); g.translate(0, y + h / 2, 0); return g; };
  parts.push(box(1.3, 1.5, 1.3, 0), oct(0.66, 0.62, 0.12, 1.5), oct(0.6, 0.58, 0.88, 1.62), box(1.15, 0.6, 1.15, 2.5), oct(0.58, 0.55, 0.7, 3.1), box(1.25, 0.25, 1.25, 3.8), box(1.55, 0.42, 1.55, 4.05));
  return roughen(mergeGeos(parts), 0.035, 2.8, 4);
}

// ---------------------------------------------------------------- a deepastambha: a tall brass lamp tower ringed with tiers of little lamps
export function lampTower(h = 3.3) {
  const parts = [lathe([[0, 0], [0.5, 0], [0.5, 0.1], [0.42, 0.16], [0.36, 0.3], [0.2, 0.42], [0.13, 0.5], [0.13, 0.56], [0.1, 0.6]], 24)];
  parts.push(lathe([[0.1, 0.58], [0.09, h * 0.5], [0.075, h * 0.92], [0, h * 0.94]], 12));
  const wicks = [], tiers = [[0.5, 14], [0.43, 12], [0.36, 10], [0.29, 8], [0.22, 6], [0.15, 4]];
  tiers.forEach(([r, n], i) => {
    const y = 0.85 + i * 0.4;
    parts.push(lathe([[0.08, y - 0.06], [r * 0.6, y - 0.03], [r, y], [r + 0.03, y + 0.03], [r - 0.02, y + 0.035], [0.08, y + 0.01]], 28));
    for (let k = 0; k < n; k++) { const a = (k + (i % 2) * 0.5) / n * Math.PI * 2, x = Math.cos(a) * (r - 0.03), z = Math.sin(a) * (r - 0.03);
      const cup = new THREE.SphereGeometry(0.035, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); cup.translate(x, y + 0.06, z); parts.push(cup); wicks.push(new THREE.Vector3(x, y + 0.11, z)); }
  });
  const top = lathe([[0, 0], [0.09, 0], [0.12, 0.08], [0.09, 0.16], [0.04, 0.2], [0.05, 0.26], [0, 0.34]], 14); top.translate(0, h * 0.93, 0); parts.push(top);
  const m = new THREE.Mesh(mergeGeos(parts), brass); m.castShadow = true;
  return { mesh: m, wicks };
}

// ---------------------------------------------------------------- textures
function fernTexture() {
  const W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.strokeStyle = '#3c5a26'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 0); x.quadraticCurveTo(W / 2 + 6, H * 0.5, W / 2 - 4, H); x.stroke();
  for (let i = 0; i < 26; i++) { const t = i / 26, y = 6 + t * (H - 20), len = (W * 0.46) * (1 - t * 0.6), cx = W / 2 + Math.sin(t * 3) * 4;
    for (const s of [-1, 1]) { x.fillStyle = ['#4f7a30', '#5f8a38', '#456e2a'][i % 3]; x.beginPath(); x.ellipse(cx + s * len * 0.5, y + 4, len * 0.5, 3.2, s * 0.35, 0, Math.PI * 2); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function leafTexture() {
  const W = 64, H = 80, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(W / 2, H - 2); x.bezierCurveTo(W * 0.02, H * 0.62, W * 0.12, H * 0.12, W / 2, 3); x.bezierCurveTo(W * 0.88, H * 0.12, W * 0.98, H * 0.62, W / 2, H - 2); x.fill();
  x.strokeStyle = 'rgba(70,90,40,0.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, H - 4); x.lineTo(W / 2, 8); x.stroke();
  x.lineWidth = 1; for (let k = 0; k < 4; k++) { const y = H * (0.3 + k * 0.14); x.beginPath(); x.moveTo(W / 2, y + 8); x.lineTo(W * 0.24, y); x.moveTo(W / 2, y + 8); x.lineTo(W * 0.76, y); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,200,120,1)'); g.addColorStop(0.2, 'rgba(255,160,70,0.55)'); g.addColorStop(0.55, 'rgba(255,120,40,0.16)'); g.addColorStop(1, 'rgba(255,100,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- the lamp light: halos, pools and wet reflections (all instanced, all additive)
// spots: [{ p: Vector3 (where the diya sits), wall: Vector3 normal into the room or null, pool: radius, refl: length or 0 }]
export function lampGlow(spots, { reflections = true } = {}) {
  const grp = new THREE.Group(), gt = glowTexture(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const add = (geo, mat, list, place) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((s, i) => { place(s, m4); im.setMatrixAt(i, m4); }); im.renderOrder = 4; im.frustumCulled = false; grp.add(im); return im; };
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pm = new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -4 });
  const pools = add(flat, pm, spots.filter((s) => s.pool), (s, m) => { const n = s.wall || new THREE.Vector3(); m.compose(new THREE.Vector3(s.p.x + n.x * s.pool * 0.35, (s.floorY ?? s.p.y) + 0.008, s.p.z + n.z * s.pool * 0.35), q.identity(), new THREE.Vector3(s.pool * 2, 1, s.pool * 2)); });
  const wm = new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.32, side: THREE.DoubleSide });
  const halos = add(new THREE.PlaneGeometry(1, 1), wm, spots.filter((s) => s.wall), (s, m) => { q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.wall); m.compose(s.p.clone().addScaledVector(s.wall, -(s.inset ?? 0.24)).add(new THREE.Vector3(0, 0.55, 0)), q, new THREE.Vector3(1.5, 2.0, 1)); });
  let streaks = null;
  if (reflections) {
    const sm = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(1.0, 0.62, 0.26) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; varying float vSeed;
        void main(){ vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float L = length(instanceMatrix[0].xyz);
          vec2 d = cameraPosition.xz - c.xz; float dl = length(d); d = dl > 0.001 ? d / dl : vec2(0.0, 1.0); vec2 pp = vec2(-d.y, d.x);
          vec2 off = pp * position.x * L * 0.16 + d * (position.y + 0.5) * L;
          vUv = uv; vSeed = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
          gl_Position = projectionMatrix * viewMatrix * vec4(c.x + off.x, c.y, c.z + off.y, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv; varying float vSeed;
        void main(){ float along = vUv.y, across = (vUv.x - 0.5) * 2.0;
          float a = exp(-across * across * 4.0) * (1.0 - smoothstep(0.0, 1.0, along)) * smoothstep(0.0, 0.08, along);
          a *= 0.7 + 0.3 * sin(along * 46.0 - uTime * 1.6 + vSeed * 6.0);
          a *= 0.88 + 0.12 * sin(uTime * 9.0 + vSeed * 17.0);
          gl_FragColor = vec4(uColor * a * uOpacity, 1.0); }`,
    });
    streaks = add(new THREE.PlaneGeometry(1, 1), sm, spots.filter((s) => s.refl), (s, m) => { const n = s.wall || new THREE.Vector3(); m.compose(new THREE.Vector3(s.p.x + n.x * 0.32, 0.014, s.p.z + n.z * 0.32), q.identity(), new THREE.Vector3(s.refl, 1, 1)); });
  }
  return { group: grp, pools, halos, streaks, poolMat: pm, haloMat: wm, streakMat: streaks && streaks.material };
}

// ---------------------------------------------------------------- the cave
export function buildRockHall(S, quality) {
  const low = quality.level === 'low', H = HALL, X = H.X, O = H.OCULUS, B = H.BACK, F = H.FRONT, LEN = F - B;
  const rock = cave(), deep = cave(DEEP), shrine = granite();
  const g = new THREE.Group(); S.add(g);
  const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
  const step = low ? 0.34 : 0.22, floorK = (y) => 0.22 + 0.78 * smooth(0.35, 1.4, y);
  // the carvings: where they go, so the rock there is dressed flat and sunk around them
  const SIDE_PANELS = { [-1]: [[-1.7, 'ganesha', false], [2.5, 'elephants', false], [6.6, 'yogi', false]], [1]: [[-1.7, 'nataraja', true], [2.5, 'elephants', true], [6.6, 'ganesha', true]] };
  const PW = 2.3, PH = 3.1, PY = 0.95;
  const BACK_PANELS = [[-4.45, 'dvarapala', false, 1.3, 3.3, 0.6], [4.45, 'dvarapala', true, 1.3, 3.3, 0.6], [-8.2, 'nataraja', false, 2.5, 3.3, 0.9], [8.2, 'yogi', true, 2.5, 3.3, 0.9]];
  // side walls
  const sideRects = { [-1]: SIDE_PANELS[-1].map(([zc]) => [zc - PW / 2 - 0.1, zc + PW / 2 + 0.1, PY - 0.1, PY + PH + 0.1]), [1]: SIDE_PANELS[1].map(([zc]) => [zc - PW / 2 - 0.1, zc + PW / 2 + 0.1, PY - 0.1, PY + PH + 0.1]) };
  const sideD = (s, z, y) => flatness(sideRects[s], z, y) * (0.04 + 0.52 * fbm(z + s * 40, y, 3.1)) * floorK(y);
  for (const s of [-1, 1]) {
    const us = axis(B - 0.4, F + 0.4, step), vs = axis(0, AISLE + 0.9, step);
    mesh(roughGrid(us, vs, (z, y) => [s * (X - sideD(s, z, y)), y, z]), rock);
  }
  // back wall, with the sanctum doorway cut in it and the rock dressed flat round the shrine and the guardians
  const backRects = [[-5.2, 5.2, -1, 5.7], ...BACK_PANELS.slice(2).map(([xc, , , w, h, y0]) => [xc - w / 2 - 0.1, xc + w / 2 + 0.1, y0 - 0.1, y0 + h + 0.1])];
  const backD = (x, y) => flatness(backRects, x, y) * (0.04 + 0.4 * fbm(x, y, 7.7)) * floorK(y);
  const frontRects = [[-2.0, 2.0, -1, 4.8]], frontD = (x, y) => flatness(frontRects, x, y) * (0.04 + 0.42 * fbm(x, y, 13.3)) * floorK(y);
  {
    const NW = H.NICHE_W, us = axis(-X - 0.6, X + 0.6, step, [-NW, NW]), vs = axis(0, TOPY + 0.8, step, [0.6, H.NICHE_TOP]);
    mesh(roughGrid(us, vs, (x, y) => [x, y, B + backD(x, y)], (x, y) => Math.abs(x) < NW && y > 0.6 && y < H.NICHE_TOP), rock);
  }
  // entrance wall, with its doorway
  {
    const us = axis(-X - 0.6, X + 0.6, step, [-1.2, 1.2]), vs = axis(0, TOPY + 0.8, step, [3.6]);
    mesh(roughGrid(us, vs, (x, y) => [x, y, F - frontD(x, y)], (x, y) => Math.abs(x) < 1.2 && y < 3.6), rock);
  }
  // the ceiling: flat and rough, and over the middle a stepped dome of carved courses narrowing up to the opening in the rock
  const rDome = (x, z) => Math.hypot(x - O.x, z - O.z);
  const dC = (x, z) => (0.05 + 0.6 * fbm(x, 21.7, z)) * (0.05 + 0.95 * smooth(DOME.R + 0.2, DOME.R + 1.6, rDome(x, z))) * (1 - 0.75 * Math.exp(-x * x / 3) * smooth(4.5, 7, z));
  const ceilAt = (x, z) => { const r = rDome(x, z); if (r < DOME.R) return r <= 0.9 ? TOPY : AISLE + DOME.RISE * Math.min(DOME.N - 1, Math.floor((DOME.R - r) / DOME.IN) + 1); return AISLE - dC(x, z); };
  {
    const us = axis(-X - 0.7, X + 0.7, step * 1.1), vs = axis(B - 0.5, F + 0.5, step * 1.1);
    mesh(roughGrid(us, vs, (x, z) => [x, AISLE - dC(x, z), z], (x, z) => rDome(x, z) < DOME.R + 0.25), rock);
    // the dome, course by course: each a different carving, stepping in and up to the opening
    const RS = DOME.R + 0.6, segs = (r) => Math.max(40, Math.round(r * 20));
    // the undersides of the courses, carved as one great rosette seen from below
    const sof = carveMaps((d, ctx) => {
      const P = (r, a) => [0.5 + Math.cos(a) * r / (2 * RS), 0.5 + Math.sin(a) * r / (2 * RS)], f = (m) => m / (2 * RS);
      const ringLine = (r, w, v) => d.r(0.5, 0.5, f(r), f(w), v);
      const around = (r, step, fn) => { const n = Math.max(6, Math.round(2 * Math.PI * r / step)); for (let i = 0; i < n; i++) fn(i / n * Math.PI * 2, i, n); };
      const R = [DOME.R + 0.55, ...Array.from({ length: DOME.N }, (_, k) => DOME.R - k * DOME.IN)];   // band edges, outermost first
      R.forEach((r) => ringLine(r - 0.03, 0.06, 0.72));
      around(5.68, 0.22, (a) => { const [x, y] = P(5.68, a); d.e(x, y, f(0.06), f(0.06), 0.82); });   // a row of beads round the rim
      around(4.95, 0.4, (a) => { const [x, y] = P(4.95, a); d.e(x, y, f(0.36), f(0.09), 0.86, a); const [x2, y2] = P(4.95, a + Math.PI / Math.round(2 * Math.PI * 4.95 / 0.4)); d.e(x2, y2, f(0.18), f(0.05), 0.6, a); });   // lotus petals
      around(4.05, 0.62, (a) => { const [x, y] = P(4.05, a); for (let k = 0; k < 8; k++) { const b = k / 8 * Math.PI * 2; d.e(x + Math.cos(b) * f(0.13), y + Math.sin(b) * f(0.13), f(0.09), f(0.045), 0.8, b); } d.e(x, y, f(0.07), f(0.07), 1.0); });   // rosettes
      around(3.15, 0.44, (a) => { const [x, y] = P(3.15, a); ctx.save(); ctx.translate(x * d.W, y * d.H); ctx.rotate(a + Math.PI / 4); const s2 = f(0.2) * d.W; ctx.fillStyle = 'rgb(210,210,210)'; ctx.fillRect(-s2 / 2, -s2 / 2, s2, s2); ctx.restore(); d.e(x, y, f(0.05), f(0.05), 1.0); });   // jewelled lozenges
      around(2.25, 0.3, (a) => { const [x, y] = P(2.25, a); d.e(x, y, f(0.34), f(0.08), 0.84, a); });   // a second, smaller ring of petals
      around(2.62, 0.16, (a) => { const [x, y] = P(2.62, a); d.e(x, y, f(0.04), f(0.04), 0.9); });
      around(1.35, 0.2, (a) => { const [x0, y0] = P(0.98, a), [x1, y1] = P(1.72, a); d.l([[x0, y0], [x1, y1]], f(0.05), 0.82); });   // a sunburst round the opening
    }, 1024, 1024, { px: 1024 / (2 * RS), depth: 0.09, seed: 19 });
    const sofM = new THREE.MeshStandardMaterial({ map: sof.map, normalMap: sof.nmap, roughness: 0.92, side: THREE.DoubleSide });
    // a frieze of elephants walking in procession round one course
    const ele = carveMaps((d) => {
      d.l([[0, 0.07], [1, 0.07]], 0.02, 0.72); d.l([[0, 0.93], [1, 0.93]], 0.02, 0.72);
      for (const cx of [1 / 6, 0.5, 5 / 6]) {
        d.e(cx, 0.52, 0.07, 0.22, 0.8); d.e(cx + 0.075, 0.44, 0.03, 0.19, 0.86); d.e(cx + 0.058, 0.45, 0.022, 0.2, 0.7);
        d.l([[cx + 0.1, 0.5], [cx + 0.108, 0.68], [cx + 0.096, 0.8]], 0.008, 0.9); d.l([[cx + 0.088, 0.56], [cx + 0.1, 0.6]], 0.004, 1.0);
        for (const lx of [-0.05, -0.032, 0.03, 0.048]) d.l([[cx + lx, 0.66], [cx + lx, 0.86]], 0.011, 0.76);
        d.p([[cx - 0.04, 0.33], [cx + 0.035, 0.33], [cx + 0.04, 0.6], [cx - 0.045, 0.6]], 0.9); for (let k = 0; k < 5; k++) d.e(cx - 0.035 + k * 0.018, 0.62, 0.004, 0.03, 1.0);
        d.l([[cx - 0.07, 0.5], [cx - 0.08, 0.72]], 0.004, 0.7);
        const lx = cx + 0.165; for (let k = 0; k < 8; k++) { const b = k / 8 * Math.PI * 2; d.e(lx + Math.cos(b) * 0.012, 0.5 + Math.sin(b) * 0.1, 0.009, 0.06, 0.78, b); } d.e(lx, 0.5, 0.007, 0.055, 1.0);
      }
    }, 1024, 128, { px: 1024 / 4.7, depth: 0.12, seed: 23, wrap: true });
    const kinds = ['gavaksha', 'elephants', 'lotus', 'vine', 'beads', 'diamond'];
    const stoneB = H.shrineMat || granite(), ornaments = [];
    for (let k = 0; k < DOME.N; k++) {
      const r = DOME.R - k * DOME.IN, y = AISLE + k * DOME.RISE, outer = k === 0 ? DOME.R + 0.55 : r + DOME.IN + 0.04;
      let face;
      if (kinds[k] === 'elephants') { face = new THREE.MeshStandardMaterial({ map: ele.map, normalMap: ele.nmap, roughness: 0.9, side: THREE.BackSide }); ele.map.repeat.set(Math.round(2 * Math.PI * r / 4.7), 1); }
      else { face = carved(kinds[k], 2 * Math.PI * r, 1.3 + k * 0.05); face.side = THREE.BackSide; }
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DOME.RISE, segs(r), 1, true), face); band.position.set(O.x, y + DOME.RISE / 2, O.z); band.receiveShadow = true; g.add(band);
      const rg = new THREE.RingGeometry(r, outer, segs(r), 2), ruv = rg.attributes.uv, rp = rg.attributes.position;
      for (let j = 0; j < rp.count; j++) ruv.setXY(j, 0.5 + rp.getX(j) / (2 * RS), 0.5 + rp.getY(j) / (2 * RS));
      const soffit = new THREE.Mesh(rg.rotateX(Math.PI / 2), sofM); soffit.position.set(O.x, y - (k === 0 ? 0.01 : 0), O.z); soffit.castShadow = soffit.receiveShadow = true; g.add(soffit);
      const roll = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.065, 6, segs(r)).rotateX(Math.PI / 2), stoneB); roll.position.set(O.x, y + 0.01, O.z); g.add(roll);
    }
    // ornament hung from the courses: lotus buds round the rim, little brackets under the third course, a fringe of
    // lotus petals at the fourth, small brass bells at the fifth and petals round the opening
    const at = (r, a, y) => new THREE.Vector3(O.x + Math.cos(a) * r, y, O.z + Math.sin(a) * r);
    const bud = mergeGeos([new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5).translate(0, -0.04, 0), petalRing(0.03, 6, 0.08, { down: true, lean: 0.3, y: -0.08, rows: 1 }), new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.6, 1).translate(0, -0.17, 0)]);
    { const n = 32, im = new THREE.InstancedMesh(bud, stoneB, n), m4 = new THREE.Matrix4(); for (let i = 0; i < n; i++) { m4.makeTranslation(...at(DOME.R + 0.28, i / n * Math.PI * 2, AISLE - 0.01).toArray()); im.setMatrixAt(i, m4); } g.add(im); }
    { const r2 = DOME.R - 2 * DOME.IN, n = 36, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.15, 0.11).translate(0.17, -0.075, 0), stoneB, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; m4.compose(at(r2, a, AISLE + 2 * DOME.RISE), q.setFromAxisAngle(up, -a), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); } g.add(im); }
    { const r3 = DOME.R - 3 * DOME.IN, fr = new THREE.Mesh(petalRing(r3 + 0.03, 34, 0.26, { down: true, lean: 0.15, rows: 1 }), stoneB); fr.position.set(O.x, AISLE + 3 * DOME.RISE, O.z); g.add(fr); }
    { const r4 = DOME.R - 4 * DOME.IN + 0.18, n = 12, bellG = mergeGeos([new THREE.CylinderGeometry(0.006, 0.006, 0.26, 4).translate(0, -0.13, 0), bellGeometry(0.45).translate(0, -0.26, 0)]), im = new THREE.InstancedMesh(bellG, brass, n), m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m4.makeTranslation(...at(r4, (i + 0.5) / n * Math.PI * 2, AISLE + 4 * DOME.RISE).toArray()); im.setMatrixAt(i, m4); } g.add(im); }
    { const fr = new THREE.Mesh(petalRing(0.93, 18, 0.24, { down: true, lean: 0.35, rows: 2 }), stoneB); fr.position.set(O.x, AISLE + 5 * DOME.RISE, O.z); g.add(fr); }
    // the dome's last course is solid rock round the opening, so the sunlight only comes through it
    const cap = new THREE.Mesh(new THREE.RingGeometry(0.9, DOME.R + 0.6, 64, 1).rotateX(-Math.PI / 2), rock); cap.position.set(O.x, TOPY + 0.02, O.z); cap.castShadow = true; g.add(cap);
  }
  // the shaft through the rock, slanting the way the sunlight comes in, with sky at the top and ferns over the lip
  const dirUp = H.OCULUS.clone().sub(H.AIM).normalize(), slope = dirUp.z / dirUp.y, rings = 6, rh = 0.32;
  const tp = [], ti = [], ns = 28;
  for (let k = 0; k <= rings; k++) for (let i = 0; i < ns; i++) { const a = i / ns * Math.PI * 2, r = 0.9 + (vnoise(Math.cos(a) * 2 + 5, k * 0.7, Math.sin(a) * 2) - 0.5) * 0.22 * Math.min(1, k), x = O.x + Math.cos(a) * r, y = TOPY + k * rh, cz = O.z + k * rh * slope; tp.push(x, y, cz + Math.sin(a) * r); }
  for (let k = 0; k < rings; k++) for (let i = 0; i < ns; i++) { const a = k * ns + i, b = k * ns + (i + 1) % ns, c = (k + 1) * ns + i, d = (k + 1) * ns + (i + 1) % ns; ti.push(a, c, b, b, c, d); }
  const throat = new THREE.BufferGeometry(); throat.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); throat.setIndex(ti); throat.computeVertexNormals(); mesh(throat, deep, 0, 0, 0, false);
  const top = new THREE.Vector3(O.x, O.y + rings * rh, O.z + rings * rh * slope);
  const skyM = new THREE.MeshBasicMaterial({ color: '#fff1d6', fog: false }), sky = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), skyM); sky.rotation.x = Math.PI / 2; sky.position.copy(top).add(new THREE.Vector3(0, 0.02, 0)); g.add(sky);
  const fern = new THREE.MeshBasicMaterial({ map: fernTexture(), color: '#b8c890', alphaTest: 0.4, side: THREE.DoubleSide, fog: false });
  for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2 + 0.3, f = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.9 + (j % 3) * 0.25), fern);
    f.geometry.translate(0, -0.45 - (j % 3) * 0.12, 0); f.position.set(O.x + Math.cos(a) * 0.92, O.y + 0.02, O.z + Math.sin(a) * 0.92); f.rotation.set(0, -a + Math.PI / 2, 0); f.rotateX(0.35 + (j % 2) * 0.2); g.add(f); }
  // pillars, the rock beams they carry, and a lotus medallion carved on each face of their bases
  const pg = pillarGeometry(), n = H.PIL_Z.length * 2, pil = new THREE.InstancedMesh(pg, rock, n), m4 = new THREE.Matrix4(), pillars = [];
  let i = 0; for (const s of [-1, 1]) for (const z of H.PIL_Z) { m4.makeTranslation(s * H.PIL_X, 0, z); pil.setMatrixAt(i++, m4); pillars.push(new THREE.Vector3(s * H.PIL_X, 0, z)); }
  pil.castShadow = pil.receiveShadow = true; g.add(pil);
  const ros = reliefPanel('rosette', 0.82, 0.82, { depth: 0.07, frame: false, density: low ? 16 : 26, seed: 5 }), rim = new THREE.InstancedMesh(ros.geometry, ros.material, n * 4), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  i = 0; for (const p of pillars) for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2; q.setFromAxisAngle(up, a); m4.compose(p.clone().add(new THREE.Vector3(Math.sin(a) * 0.69, 0.82, Math.cos(a) * 0.69)), q, new THREE.Vector3(1, 1, 1)); rim.setMatrixAt(i++, m4); }
  rim.receiveShadow = true; g.add(rim);
  for (const s of [-1, 1]) mesh(roughBox(1.5, 1.1, LEN + 0.8, { amp: 0.07, freq: 1.6, seed: s * 3 }), rock, s * H.PIL_X, 4.47 + 0.55, (F + B) / 2);
  // rock benches along the walls, for lamps
  for (const s of [-1, 1]) { mesh(roughBox(1.0, H.BENCH, LEN, { amp: 0.035, seed: 7 + s }), rock, s * (X - 0.5), H.BENCH / 2, (F + B) / 2); mesh(roughBox(X - 3.3, H.BENCH, 0.72, { amp: 0.035, seed: 11 + s }), rock, s * (X + 3.3) / 2, H.BENCH / 2, B + 0.36); }
  // the carved panels, sunk into the dressed rock
  const dens = low ? 14 : 24;
  for (const s of [-1, 1]) for (const [zc, kind, mir] of SIDE_PANELS[s]) { const p = reliefPanel(kind, PW, PH, { mirror: mir, depth: 0.2, density: dens, seed: zc * 7 + s }); p.position.set(s * (X - 0.004), PY + PH / 2, zc); p.rotation.y = -s * Math.PI / 2; g.add(p); }
  for (const [xc, kind, mir, w, h, y0] of BACK_PANELS) { const p = reliefPanel(kind, w, h, { mirror: mir, depth: kind === 'dvarapala' ? 0.24 : 0.2, density: dens, seed: xc * 5 }); p.position.set(xc, y0 + h / 2, B + 0.004); g.add(p); }
  // the shrine: a niche of dressed granite blocks, stout pilasters, a heavy lintel and cornice, and a parapet above
  const NW = H.NICHE_W, NT = H.NICHE_TOP;
  for (const s of [-1, 1]) {
    mesh(roughBox(0.75, NT - 0.6, 0.6, { amp: 0.025, seed: 21 + s }), shrine, s * (NW + 0.375), 0.6 + (NT - 0.6) / 2, B + 0.3);
    mesh(roughBox(0.95, 0.3, 0.74, { amp: 0.02, seed: 23 + s }), shrine, s * (NW + 0.375), NT + 0.15, B + 0.34);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, NT - 1.0, 0.04), carved('vine', NT - 1.0, 0.8, true)); band.position.set(s * (NW + 0.375), 0.6 + (NT - 0.6) / 2, B + 0.615); g.add(band);
  }
  mesh(roughBox(2 * NW + 1.7, 0.55, 0.55, { amp: 0.025, seed: 31 }), shrine, 0, NT + 0.3 + 0.275, B + 0.275);
  { const band = new THREE.Mesh(new THREE.BoxGeometry(2 * NW + 1.3, 0.4, 0.04), carved('gavaksha', 2 * NW + 1.3, 1.2)); band.position.set(0, NT + 0.575, B + 0.565); g.add(band); }
  mesh(roughBox(2 * NW + 2.6, 0.45, 0.9, { amp: 0.03, seed: 33 }), shrine, 0, NT + 0.85 + 0.225, B + 0.45);
  mesh(roughBox(2 * NW + 0.8, 0.6, 0.5, { amp: 0.03, seed: 35 }), shrine, 0, NT + 1.3 + 0.3, B + 0.25);
  { const band = new THREE.Mesh(new THREE.BoxGeometry(2 * NW + 0.5, 0.42, 0.04), carved('lotus', 2 * NW + 0.5, 1.3)); band.position.set(0, NT + 1.6, B + 0.515); g.add(band); }
  // green vines growing out of the rock: from cracks under the ceiling down the walls between the carvings, over the rim of
  // the dome, off the rock beams, and down into the shaft of light from the opening
  {
    let seed = 77; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const V = THREE.Vector3, stems = [], leaves = [];
    const strand = (pts, outAt) => {
      if (pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength();
      stems.push(new THREE.TubeGeometry(curve, Math.max(4, Math.round(len * 9)), 0.011, 4, false));
      const n = Math.round(len / (low ? 0.15 : 0.085));
      for (let i = 1; i <= n; i++) { const t = i / n, p = curve.getPointAt(Math.min(1, t)); for (let k = 0; k < (rnd() < 0.4 ? 2 : 1); k++) leaves.push({ p: p.clone().add(new V((rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.06)), out: outAt(p).clone(), s: 0.7 + rnd() * 0.65 + (1 - t) * 0.2 }); }
    };
    const down = (top, bottom, fn) => { const pts = []; for (let y = top; y >= bottom; y -= 0.18) pts.push(fn(y, top - y)); return pts; };
    for (const s of [-1, 1]) for (const z0 of [-5.3, -4.4, 0.4, 4.6, 8.7, 10.2]) for (const dz of [-0.22, 0.2]) {
      const z1 = z0 + dz, top = ceilAt(s * (X - 0.05), z1) - 0.04, bottom = top - 1.4 - rnd() * 2.3, ph = rnd() * 6, drift = (rnd() - 0.5) * 0.35;
      strand(down(top, bottom, (y, t) => { const z = z1 + Math.sin(y * 2.1 + ph) * 0.14 + t * drift; return new V(s * (X - sideD(s, z, y) - 0.05), y, z); }), () => new V(-s, 0, 0));
    }
    for (const x0 of [-10.2, -6.0, 6.0, 10.2]) for (const dx of [-0.2, 0.2]) {
      const x1 = x0 + dx, top = ceilAt(x1, B + 0.1) - 0.04, bottom = top - 1.2 - rnd() * 2.0, ph = rnd() * 6;
      strand(down(top, bottom, (y) => { const x = x1 + Math.sin(y * 2.3 + ph) * 0.14; return new V(x, y, B + backD(x, y) + 0.05); }), () => new V(0, 0, 1));
    }
    for (const x0 of [-10.0, -7.0, -3.2, 3.2, 7.0, 10.0]) {
      const top = ceilAt(x0, F - 0.1) - 0.04, bottom = top - 1.0 - rnd() * 2.0, ph = rnd() * 6;
      strand(down(top, bottom, (y) => { const x = x0 + Math.sin(y * 2.0 + ph) * 0.15; return new V(x, y, F - frontD(x, y) - 0.05); }), () => new V(0, 0, -1));
    }
    const hang = (base, length, sway) => { const ph = rnd() * 6; return down(base.y, base.y - length, (y, t) => new V(base.x + Math.sin(t * 2.6 + ph) * sway, y, base.z + Math.cos(t * 2.2 + ph) * sway)); };
    const radial = (p) => new V(p.x - O.x, 0, p.z - O.z).normalize().multiplyScalar(-1);
    for (const a of [0.3, 0.42, 0.58, 0.7, 1.3, 1.42, 1.58, 1.7]) { const b = new V(O.x + Math.cos(a * Math.PI) * 5.85, AISLE - 0.03, O.z + Math.sin(a * Math.PI) * 5.85); strand(hang(b, 0.6 + rnd() * 0.8, 0.06), radial); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.4, b = new V(O.x + Math.cos(a) * 0.95, TOPY + 0.02, O.z + Math.sin(a) * 0.95); strand(hang(b, 1.0 + rnd() * 1.3, 0.05), radial); }
    for (const s of [-1, 1]) for (const z of [-1.7, 2.5, 6.6]) { const b = new V(s * (H.PIL_X - 0.78), 4.47, z + (rnd() - 0.5) * 0.6); strand(hang(b, 0.5 + rnd() * 0.8, 0.04), () => new V(-s, 0, 0)); }
    const stemM = new THREE.MeshStandardMaterial({ color: '#4b5a2c', roughness: 0.9 });
    const sm = new THREE.Mesh(mergeGeos(stems), stemM); sm.castShadow = false; g.add(sm);
    const lg = new THREE.PlaneGeometry(0.1, 0.13).translate(0, 0.055, 0), lm = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 });
    const im = new THREE.InstancedMesh(lg, lm, leaves.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), col = new THREE.Color(), Z = new V(0, 0, 1);
    leaves.forEach((L, i) => { const o = L.out.lengthSq() ? L.out.normalize() : new V(0, 0, 1); q.setFromUnitVectors(Z, o); qr.setFromAxisAngle(Z, Math.PI * (0.55 + rnd() * 0.9)); q.multiply(qr); m4.compose(L.p, q, new V(L.s, L.s, L.s)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(['#5d8a36', '#4f7a2e', '#6e9a40', '#45702a', '#7aa648'][i % 5])); });
    im.frustumCulled = false; g.add(im);
  }
  // the sanctum chamber behind the doorway, wide enough for a path all round the deity: dark rock on three sides and a low roof
  const CW = H.CELL_W, CB = H.CELL_BACK, CD = B - CB, CZ = (B + CB) / 2;
  for (const s of [-1, 1]) mesh(roughBox(0.5, 4.5, CD + 0.2, { amp: 0.04, seed: 41 + s }), deep, s * (CW + 0.25), 0.6 + 2.25, CZ);
  mesh(roughBox(CW * 2 + 1.0, 4.9, 0.5, { amp: 0.04, seed: 45 }), deep, 0, 2.95, CB - 0.25); mesh(roughBox(CW * 2 + 1.0, 0.5, CD + 0.6, { amp: 0.04, seed: 47 }), deep, 0, 5.1, CZ - 0.2);
  // the pradakshina path: a ring of pale paving round the deity, edged with stone
  const ringM = triplanar('flagstone', { tint: '#a99a87', tile: 1.4, roughness: 0.7, normal: 0.9, cacheKey: 'ring', polygonOffset: true, polygonOffsetFactor: -2 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(H.RING_IN, H.RING_OUT, 72, 1).rotateX(-Math.PI / 2), ringM); ring.position.set(0, 0.632, H.AIM.z); ring.receiveShadow = true; g.add(ring);
  for (const r of [H.RING_IN, H.RING_OUT]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 96).rotateX(Math.PI / 2), shrine); t.position.set(0, 0.64, H.AIM.z); g.add(t); }
  return { group: g, pillars, sky: skyM, rock, shrine, deep, lightPos: top.clone().addScaledVector(dirUp, -0.15), ceilAt, bench: { sideX: X - 0.8, backZ: B + 0.5, y: H.BENCH } };
}

// ---------------------------------------------------------------- diyas on every ledge
export function diyaField(spots) {
  const im = new THREE.InstancedMesh(diyaGeometry(), clay, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => { m4.compose(s.p, q.setFromAxisAngle(up, Math.random() * 6.28), new THREE.Vector3(1, 1, 1).multiplyScalar(s.size || 1.4)); im.setMatrixAt(i, m4); });
  im.castShadow = false; return im;
}
