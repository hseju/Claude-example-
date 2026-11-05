import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { sandstone, carvedBand } from './textures.js';

// Shared architectural pieces used by the campus and the prayer halls.

export const brass = new THREE.MeshStandardMaterial({ color: '#c9973e', metalness: 0.92, roughness: 0.28 });
export const gold = new THREE.MeshStandardMaterial({ color: '#e0b04f', metalness: 1.0, roughness: 0.22 });
export const copper = new THREE.MeshStandardMaterial({ color: '#b5653a', metalness: 0.9, roughness: 0.32 });
export const clay = new THREE.MeshStandardMaterial({ color: '#a4532c', roughness: 0.85 });
export const darkStone = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.45, metalness: 0.05 });

const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

export function pillarGeometry(h = 3.2, r = 0.28) {
  // square-feeling turned pillar: base, ringed shaft, pot-and-foliage capital, bracket
  const p = [[0, 0], [r * 1.5, 0], [r * 1.5, h * 0.06], [r * 1.25, h * 0.08], [r * 1.2, h * 0.14], [r, h * 0.16],
    [r * 0.92, h * 0.4], [r * 1.12, h * 0.42], [r * 1.12, h * 0.45], [r * 0.9, h * 0.47], [r * 0.85, h * 0.7], [r * 1.05, h * 0.72],
    [r * 1.05, h * 0.75], [r * 0.85, h * 0.77], [r * 0.8, h * 0.82], [r * 1.25, h * 0.88], [r * 1.35, h * 0.92], [r * 0.9, h * 0.94],
    [r * 1.6, h * 0.96], [r * 1.6, h], [0, h]];
  return lathe(p, 8);
}

export function bellGeometry(s = 1) {
  const p = [[0, 0.02], [0.03, 0.02], [0.05, 0], [0.06, -0.02], [0.075, -0.06], [0.1, -0.13], [0.135, -0.2], [0.165, -0.24], [0.17, -0.26], [0.15, -0.255], [0.0, -0.25]]
    .map(([x, y]) => [x * s, y * s]);
  return lathe(p, 28);
}

// Hanging brass bell with pendulum physics. `bell.strike(f)` adds angular impulse.
export class HangingBell {
  constructor(size = 1, rope = 0) {
    this.group = new THREE.Group();
    this.pivot = new THREE.Group(); this.group.add(this.pivot);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * size, 0.008 * size, 0.25 * size, 6), brass); chain.position.y = -0.125 * size; this.pivot.add(chain);
    const b = new THREE.Mesh(bellGeometry(size), brass); b.position.y = -0.25 * size; b.castShadow = true; this.pivot.add(b);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03 * size, 10, 8), brass); knob.position.y = -0.24 * size; this.pivot.add(knob);
    this.clapperPivot = new THREE.Group(); this.clapperPivot.position.y = -0.3 * size; this.pivot.add(this.clapperPivot);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.035 * size, 8, 6), brass); cl.position.y = -0.17 * size; this.clapperPivot.add(cl);
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * size, 0.008 * size, 0.17 * size, 5), brass); cr.position.y = -0.085 * size; this.clapperPivot.add(cr);
    if (rope > 0) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * size, 0.012 * size, rope, 6), new THREE.MeshStandardMaterial({ color: '#b3242a', roughness: 0.9 }));
      r.position.y = -0.47 * size - rope / 2; this.clapperPivot.add(r); this.rope = r;
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.04 * size, 0.12 * size, 8), new THREE.MeshStandardMaterial({ color: '#d9a23a', roughness: 0.8 })); tassel.position.y = -0.47 * size - rope; this.clapperPivot.add(tassel);
    }
    this.size = size; this.angle = 0; this.vel = 0; this.cAngle = 0; this.cVel = 0; this.axis = 'x';
    this.group.traverse(o => { if (o.isMesh) o.userData.bell = this; });
    this.onStrike = null; this._lastHit = 0;
  }
  strike(force = 1) { this.vel += 2.4 * force; this.cVel -= 4 * force; }
  update(dt, t) {
    const g = 9.8 / (0.4 * this.size);
    this.vel += (-g * Math.sin(this.angle) - this.vel * 0.9) * dt; this.angle += this.vel * dt;
    this.cVel += (-g * 1.7 * Math.sin(this.cAngle) - this.cVel * 1.4) * dt; this.cAngle += this.cVel * dt;
    // clapper meets the lip: that is when the bell sounds
    const rel = this.cAngle - this.angle;
    if (Math.abs(rel) > 0.36) {
      this.cAngle = this.angle + Math.sign(rel) * 0.36; this.cVel = this.vel - (this.cVel - this.vel) * 0.4;
      if (t - this._lastHit > 0.22 && Math.abs(this.vel) + Math.abs(this.cVel) > 0.6) { this._lastHit = t; this.onStrike && this.onStrike(this); }
    }
    this.pivot.rotation[this.axis] = this.angle; this.clapperPivot.rotation[this.axis] = this.cAngle - this.angle;
  }
}

export function diyaGeometry() {
  // shallow clay lamp with a pinched spout
  const g = lathe([[0, 0], [0.05, 0], [0.07, 0.015], [0.085, 0.04], [0.08, 0.045], [0.06, 0.03], [0, 0.028]], 14);
  const pos = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.z > 0 && v.y > 0.02) { const k = Math.max(0, v.z / 0.085 - 0.6) * Math.max(0, 1 - Math.abs(v.x) * 12); v.z += k * 0.05; pos.setXYZ(i, v.x, v.y, v.z); } }
  g.computeVertexNormals(); return g;
}

export function lampStand(h = 1.5) {
  // samai: tall brass oil lamp with a peacock-style finial and five wicks
  const grp = new THREE.Group();
  const prof = [[0, 0], [0.22, 0], [0.22, 0.04], [0.12, 0.08], [0.05, 0.12], [0.04, h * 0.5], [0.07, h * 0.52], [0.04, h * 0.55], [0.035, h * 0.8], [0.06, h * 0.82],
    [0.2, h * 0.84], [0.22, h * 0.87], [0.05, h * 0.86], [0.03, h * 0.9], [0.06, h * 0.95], [0.03, h * 1.02], [0, h * 1.04]];
  const m = new THREE.Mesh(lathe(prof, 20), brass); m.castShadow = true; grp.add(m);
  const wicks = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; wicks.push(new THREE.Vector3(Math.cos(a) * 0.19, h * 0.885, Math.sin(a) * 0.19)); }
  grp.userData.wicks = wicks; return grp;
}

export function kalasha(s = 1, mat = gold) {
  return new THREE.Mesh(lathe([[0, 0], [0.18, 0], [0.22, 0.08], [0.3, 0.25], [0.28, 0.42], [0.14, 0.52], [0.12, 0.6], [0.2, 0.66], [0.06, 0.7], [0.08, 0.82], [0.04, 0.95], [0, 1.0]].map(([x, y]) => [x * s, y * s]), 20), mat);
}

export function amalaka(r = 1.2, mat) {
  const g = new THREE.SphereGeometry(r, 28, 10); g.scale(1, 0.38, 1);
  const pos = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x); const k = 1 + Math.cos(a * 28) * 0.04; v.x *= k; v.z *= k; pos.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Marigold garland hanging in a catenary between two points.
export function garland(a, b, sag = 0.5, n = 28, colors = ['#f29a17', '#f6c025', '#e9651a']) {
  const geo = new THREE.SphereGeometry(0.06, 7, 5);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const im = new THREE.InstancedMesh(geo, m, n);
  const mat4 = new THREE.Matrix4(), col = new THREE.Color(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1); p.lerpVectors(a, b, k); p.y -= Math.sin(k * Math.PI) * sag;
    mat4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, mat4);
    col.set(colors[(i % 6 < 4) ? 0 : (i % 6 === 4 ? 1 : 2)]); im.setColorAt(i, col);
  }
  im.castShadow = false; return im;
}

export function stoneMat(base, repeat = [1, 1], opts = {}) {
  return new THREE.MeshStandardMaterial({ map: sandstone(base, base, { repeat, ...opts }), roughness: 0.88, ...opts.mat });
}
export function bandMat(base) { const t = carvedBand(base).clone(); t.needsUpdate = true; t.repeat.set(6, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); }

// Curvilinear nagara-style tower assembled from offset tiers, with corner sub-spires.
export function shikhara(baseSize, height, mat, accentMat, tiers = 12) {
  const g = new THREE.Group();
  const th = height / tiers;
  const widthAt = (k) => baseSize * (1 - Math.pow(k, 1.7) * 0.74);
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers, w = widthAt(k);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, th * 0.78, w), mat); slab.position.y = i * th + th * 0.39; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, th * 0.22, w * 1.04), accentMat); lip.position.y = i * th + th * 0.89; lip.castShadow = true; g.add(lip);
    // central offset band (raha) gives the tower its vertical ribs
    const raha = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, th * 0.98, w * 1.08), mat); raha.position.y = i * th + th * 0.5; g.add(raha);
    const raha2 = raha.clone(); raha2.rotation.y = Math.PI / 2; g.add(raha2);
  }
  // corner urushringas on lower half
  if (baseSize > 3) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const sub = new THREE.Group(); const ts = 6, sh = height * 0.38, sw = baseSize * 0.32;
    for (let i = 0; i < ts; i++) { const k = i / ts, w = sw * (1 - Math.pow(k, 1.6) * 0.7); const s = new THREE.Mesh(new THREE.BoxGeometry(w, sh / ts * 0.8, w), mat); s.position.y = i * sh / ts + sh / ts * 0.4; s.castShadow = true; sub.add(s);
      const l = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, sh / ts * 0.2, w * 1.05), accentMat); l.position.y = i * sh / ts + sh / ts * 0.9; sub.add(l); }
    const am = amalaka(sw * 0.32, accentMat); am.position.y = sh + 0.05; sub.add(am);
    sub.position.set(sx * baseSize * 0.36, 0, sz * baseSize * 0.36); g.add(sub);
  }
  const top = height;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(widthAt(1) * 0.32, widthAt(1) * 0.4, 0.3, 16), mat); neck.position.y = top + 0.15; g.add(neck);
  const am = amalaka(widthAt(1) * 0.62, accentMat); am.position.y = top + 0.5; am.castShadow = true; g.add(am);
  const k = kalasha(0.9); k.position.y = top + 0.75; g.add(k);
  g.userData.top = top + 1.6;
  return g;
}

// Ivory and gold palette used by the shrines (matches the courtyard reference).
export const ivory = new THREE.MeshStandardMaterial({ color: '#f3ead9', roughness: 0.55 });
export const paleGold = new THREE.MeshStandardMaterial({ color: '#d9a548', metalness: 0.75, roughness: 0.32 });

// Chhatri: an open domed pavilion on four pillars with cusped arches and a kalasha finial.
export function chhatri(s = 1, stone = ivory, trim = paleGold) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(3.0 * s, 0.35 * s, 3.0 * s), stone, 0, 0.175 * s, 0);
  add(new THREE.BoxGeometry(3.1 * s, 0.08 * s, 3.1 * s), trim, 0, 0.36 * s, 0);
  const pg = pillarGeometry(2.0 * s, 0.11 * s);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(pg, stone); p.position.set(x * 1.12 * s, 0.4 * s, z * 1.12 * s); p.castShadow = true; g.add(p); }
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.95 * s, 0.07 * s, 6, 18, Math.PI), trim);
    const ang = i * Math.PI / 2; a.position.set(Math.sin(ang) * 1.12 * s, 1.45 * s, Math.cos(ang) * 1.12 * s); a.rotation.y = ang; g.add(a);
  }
  add(new THREE.BoxGeometry(2.75 * s, 0.28 * s, 2.75 * s), stone, 0, 2.54 * s, 0);
  const eave = add(new THREE.CylinderGeometry(1.75 * s, 2.15 * s, 0.14 * s, 4, 1), stone, 0, 2.74 * s, 0); eave.rotation.y = Math.PI / 4;
  add(new THREE.CylinderGeometry(1.0 * s, 1.05 * s, 0.22 * s, 20), trim, 0, 2.9 * s, 0);
  const dome = new THREE.LatheGeometry([[0, 0], [1.0, 0], [1.08, 0.22], [1.02, 0.55], [0.8, 0.9], [0.45, 1.15], [0.14, 1.32], [0, 1.36]].map(([x, y]) => new THREE.Vector2(x * s, y * s)), 24);
  add(dome, stone, 0, 3.0 * s, 0);
  const k = kalasha(0.55 * s); k.position.y = 4.32 * s; g.add(k);
  g.userData.top = 4.9 * s; g.userData.radius = 1.6 * s;
  return g;
}

export function balusterGeometry(h = 0.75) {
  return lathe([[0, 0], [0.09, 0], [0.09, 0.06], [0.05, 0.1], [0.085, h * 0.35], [0.1, h * 0.5], [0.05, h * 0.75], [0.04, h * 0.82], [0.08, h * 0.88], [0.08, h], [0, h]], 8);
}
export function lampPostGeometry(h = 1.25) {
  return lathe([[0, 0], [0.32, 0], [0.32, 0.12], [0.24, 0.18], [0.24, 0.3], [0.14, 0.38], [0.12, h * 0.7], [0.18, h * 0.76], [0.13, h * 0.82], [0.22, h * 0.92], [0.26, h], [0, h]], 8);
}
