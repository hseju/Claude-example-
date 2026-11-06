import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { sandstone, carvedBand } from './textures.js';
import { triplanar } from './pbr.js';
import { relief, petalRing, beadRing, mergeGeos } from './ornament.js';

// Shared architectural pieces used by the campus and the prayer halls.

export const brass = new THREE.MeshStandardMaterial({ color: '#c9973e', metalness: 0.92, roughness: 0.28 });
export const gold = new THREE.MeshStandardMaterial({ color: '#e0b04f', metalness: 1.0, roughness: 0.22 });
export const copper = new THREE.MeshStandardMaterial({ color: '#b5653a', metalness: 0.9, roughness: 0.32 });
export const clay = new THREE.MeshStandardMaterial({ color: '#a4532c', roughness: 0.85 });
export const darkStone = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.45, metalness: 0.05 });

const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

export function pillarGeometry(h = 3.2, r = 0.28) {
  // a turned pillar with stepped base mouldings, a fluted shaft, a beaded collar, a pot-and-foliage capital
  // and a cross bracket (four arms with hanging lotus buds) carrying the beam
  const p = [[0, 0], [r * 1.55, 0], [r * 1.55, h * 0.03], [r * 1.42, h * 0.045], [r * 1.42, h * 0.06], [r * 1.28, h * 0.075], [r * 1.22, h * 0.11], [r * 1.3, h * 0.125], [r * 1.05, h * 0.15], [r, h * 0.16],
    [r * 0.94, h * 0.4], [r * 1.14, h * 0.415], [r * 1.14, h * 0.445], [r * 0.92, h * 0.46], [r * 0.86, h * 0.68], [r * 1.02, h * 0.7], [r * 1.08, h * 0.72],
    [r * 1.02, h * 0.74], [r * 0.84, h * 0.76], [r * 0.8, h * 0.8], [r * 1.0, h * 0.82], [r * 1.3, h * 0.86], [r * 1.38, h * 0.895], [r * 1.2, h * 0.915], [r * 0.92, h * 0.93],
    [r * 1.0, h * 0.945], [r * 1.0, h * 0.955], [r * 0.9, h * 0.96], [0, h * 0.96]];
  const shaft = lathe(p, 32), pos = shaft.attributes.position;
  for (let i = 0; i < pos.count; i++) {   // sixteen flutes on the two shaft sections
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), onShaft = (y > h * 0.165 && y < h * 0.395) || (y > h * 0.465 && y < h * 0.675);
    if (onShaft) { const k = 1 - 0.075 * (0.5 + 0.5 * Math.cos(a * 16)); pos.setXYZ(i, x * k, y, z * k); }
  }
  shaft.computeVertexNormals();
  const parts = [shaft, beadRing(r * 1.16, 18, r * 0.08, h * 0.43), beadRing(r * 1.1, 16, r * 0.07, h * 0.72)];
  // the bracket: two crossing arms with rounded ends and a lotus bud hanging under each end
  for (const rot of [0, Math.PI / 2]) {
    const arm = new THREE.BoxGeometry(r * 4.2, r * 0.42, r * 0.95); arm.translate(0, h * 0.98, 0); arm.rotateY(rot); parts.push(arm);
    const under = new THREE.BoxGeometry(r * 3.0, r * 0.3, r * 0.8); under.translate(0, h * 0.95, 0); under.rotateY(rot); parts.push(under);
    for (const sgn of [-1, 1]) { const bud = new THREE.SphereGeometry(r * 0.24, 10, 8); bud.scale(1, 1.4, 1); const at = new THREE.Vector3(sgn * r * 1.9, h * 0.935, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); bud.translate(at.x, at.y, at.z); parts.push(bud); }
  }
  const top = new THREE.BoxGeometry(r * 3.6, r * 0.25, r * 3.6); top.translate(0, h - r * 0.125 + 0.001, 0); parts.push(top);
  return mergeGeos(parts);
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
      const e = Math.abs(this.vel) + Math.abs(this.cVel);
      if (t - this._lastHit > 0.38 && e > 0.9) { this._lastHit = t; this.onStrike && this.onStrike(this, Math.min(1, e / 5)); }
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
  // the finial pot: on a ring of lotus petals, with a beaded shoulder, a collar and a pointed bud on top
  const pot = lathe([[0, 0], [0.18, 0], [0.22, 0.08], [0.3, 0.25], [0.28, 0.42], [0.14, 0.52], [0.12, 0.6], [0.2, 0.66], [0.06, 0.7], [0.08, 0.82], [0.04, 0.95], [0, 1.0]].map(([x, y]) => [x * s, y * s]), 20);
  const geo = mergeGeos([pot, petalRing(0.2 * s, 10, 0.14 * s, { y: 0.0, lean: 0.85, rows: 1 }), beadRing(0.3 * s, 20, 0.022 * s, 0.32 * s), beadRing(0.16 * s, 12, 0.018 * s, 0.63 * s)]);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
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
  // photographed stone projected in world space (see pbr.js): fine-grained for carved and smooth pieces, cut blocks for walls and plinths
  void repeat; void sandstone;
  const m = triplanar(opts.blocks === false ? 'sandstone' : 'ashlar', { tint: base, tile: opts.blocks === false ? 1.6 : 2.6, roughness: 0.95, ...opts.mat }); m.userData.tint = base; return m;
}
// a carved band: a lotus frieze in relief (see ornament.js); `kind` picks another motif
export function bandMat(base, kind = 'lotus', repeat = [6, 1]) { void carvedBand; return relief(kind, base, { repeat }); }
const tintOf = (m) => m.userData.tint || '#' + m.color.getHexString();

// Curvilinear nagara-style tower assembled from offset tiers, with corner sub-spires.
export function shikhara(baseSize, height, mat, accentMat, tiers = 12) {
  const g = new THREE.Group();
  const th = height / tiers;
  const widthAt = (k) => baseSize * (1 - Math.pow(k, 1.7) * 0.74);
  const carved = relief('gavaksha', tintOf(mat), { repeat: [1, 1] });   // the mesh of chaitya arches that covers the tower
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers, w = widthAt(k);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, th * 0.78, w), carved); slab.position.y = i * th + th * 0.39; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
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
    const sk = kalasha(sw * 0.28, accentMat); sk.position.y = sh + 0.05 + sw * 0.12; sub.add(sk);
    sub.position.set(sx * baseSize * 0.36, 0, sz * baseSize * 0.36); g.add(sub);
  }
  // a smaller spirelet half-set into the middle of each face (the shikhara's clustered profile)
  if (baseSize > 3) for (let f = 0; f < 4; f++) {
    const sub = new THREE.Group(), ts = 5, sh = height * 0.27, sw = baseSize * 0.24;
    for (let i = 0; i < ts; i++) { const k = i / ts, w = sw * (1 - Math.pow(k, 1.6) * 0.7); const sl = new THREE.Mesh(new THREE.BoxGeometry(w, sh / ts * 0.8, w), carved); sl.position.y = i * sh / ts + sh / ts * 0.4; sl.castShadow = true; sub.add(sl);
      const l = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, sh / ts * 0.2, w * 1.05), accentMat); l.position.y = i * sh / ts + sh / ts * 0.9; sub.add(l); }
    const am = amalaka(sw * 0.3, accentMat); am.position.y = sh + 0.04; sub.add(am);
    const sk = kalasha(sw * 0.26, accentMat); sk.position.y = sh + 0.04 + sw * 0.1; sub.add(sk);
    const ang = f * Math.PI / 2; sub.position.set(Math.sin(ang) * baseSize * 0.5, height * 0.06, Math.cos(ang) * baseSize * 0.5); g.add(sub);
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
  add(new THREE.BoxGeometry(3.12 * s, 0.06 * s, 3.12 * s), trim, 0, 0.33 * s, 0);
  add(new THREE.BoxGeometry(2.9 * s, 0.06 * s, 2.9 * s), stone, 0, 0.37 * s, 0);
  for (const r of [0.8, 0.45]) { const inlay = new THREE.Mesh(new THREE.RingGeometry(r * s, (r + 0.06) * s, 32), trim); inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.405 * s; g.add(inlay); }
  const pg = pillarGeometry(2.0 * s, 0.11 * s);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(pg, stone); p.position.set(x * 1.12 * s, 0.4 * s, z * 1.12 * s); p.castShadow = true; g.add(p); }
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.95 * s, 0.07 * s, 6, 18, Math.PI), trim);
    const ang = i * Math.PI / 2; a.position.set(Math.sin(ang) * 1.12 * s, 1.45 * s, Math.cos(ang) * 1.12 * s); a.rotation.y = ang; g.add(a);
  }
  add(new THREE.BoxGeometry(2.75 * s, 0.28 * s, 2.75 * s), relief('beads', tintOf(stone), { repeat: [3, 1] }), 0, 2.54 * s, 0);
  const eave = add(new THREE.CylinderGeometry(1.75 * s, 2.15 * s, 0.14 * s, 4, 1), stone, 0, 2.74 * s, 0); eave.rotation.y = Math.PI / 4;
  add(new THREE.CylinderGeometry(1.0 * s, 1.05 * s, 0.22 * s, 20), trim, 0, 2.9 * s, 0);
  const dome = new THREE.LatheGeometry([[0, 0], [1.0, 0], [1.08, 0.22], [1.02, 0.55], [0.8, 0.9], [0.45, 1.15], [0.14, 1.32], [0, 1.36]].map(([x, y]) => new THREE.Vector2(x * s, y * s)), 24);
  add(dome, stone, 0, 3.0 * s, 0);
  // gilded ribs following the dome, a ring of lotus petals at its foot and an inverted lotus at the crown
  const prof = [[1.0, 0], [1.08, 0.22], [1.02, 0.55], [0.8, 0.9], [0.45, 1.15], [0.14, 1.32]];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, pts = prof.map(([r, y]) => new THREE.Vector3(Math.cos(a) * r * 1.01 * s, (3.0 + y) * s, Math.sin(a) * r * 1.01 * s));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025 * s, 5), trim));
  }
  const petal = new THREE.SphereGeometry(0.16 * s, 10, 6); petal.scale(0.6, 1, 0.3); petal.translate(0, 0.12 * s, 0);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, pm = new THREE.Mesh(petal, stone); pm.position.set(Math.cos(a) * 1.03 * s, 3.0 * s, Math.sin(a) * 1.03 * s); pm.rotation.y = -a + Math.PI / 2; pm.rotateX(0.35); g.add(pm); }
  // carved brackets under the eave, a small brass bell and entry steps
  for (let i = 0; i < 4; i++) for (const o of [-1, 1]) {
    const ang = i * Math.PI / 2, base = new THREE.Vector3(o * 1.12 * s, 2.2 * s, 1.12 * s), tip = new THREE.Vector3(o * 1.12 * s, 2.62 * s, 1.55 * s), ctrl = new THREE.Vector3(o * 1.12 * s, 2.55 * s, 1.15 * s);
    const br = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, ctrl, tip), 8, 0.04 * s, 5), stone); br.rotation.y = ang; br.position.set(0, 0, 0); g.add(br);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.6 * s, 4), trim); chain.position.y = 2.1 * s; g.add(chain);
  const bell = new THREE.Mesh(bellGeometry(0.75 * s), brass); bell.position.y = 1.8 * s; g.add(bell);
  for (let k = 0; k < 2; k++) add(new THREE.BoxGeometry(1.2 * s, 0.12 * s, 0.3 * s), stone, 0, (0.06 + k * 0.12) * s, (1.65 - k * 0.12) * s);
  const crown = new THREE.LatheGeometry([[0.05, 0], [0.32, 0.05], [0.36, 0.1], [0.2, 0.16], [0.08, 0.2]].map(([r, y]) => new THREE.Vector2(r * s, y * s)), 16);
  add(crown, trim, 0, 4.3 * s, 0);
  const k = kalasha(0.55 * s); k.position.y = 4.48 * s; g.add(k);
  g.userData.top = 5.05 * s; g.userData.radius = 1.6 * s;
  return g;
}

export function balusterGeometry(h = 0.75) {
  return lathe([[0, 0], [0.09, 0], [0.09, 0.06], [0.05, 0.1], [0.085, h * 0.35], [0.1, h * 0.5], [0.05, h * 0.75], [0.04, h * 0.82], [0.08, h * 0.88], [0.08, h], [0, h]], 8);
}
export function lampPostGeometry(h = 1.25) {
  return lathe([[0, 0], [0.32, 0], [0.32, 0.12], [0.24, 0.18], [0.24, 0.3], [0.14, 0.38], [0.12, h * 0.7], [0.18, h * 0.76], [0.13, h * 0.82], [0.22, h * 0.92], [0.26, h], [0, h]], 8);
}
