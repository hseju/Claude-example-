import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Avatar } from './avatar.js';
import { pillarGeometry, garland, kalasha, lampStand, brass, copper, stoneMat, bandMat, chhatri, ivory, paleGold } from './architecture.js';
import { pbr } from './pbr.js';
import { mergeGeos } from './ornament.js';
import * as TX from './textures.js';
import { greetStep } from './greet.js';

// The prasad centre: a small pavilion in the south-east garden where a sevak shares prasad, the blessed food offered at
// the shrines, with everyone who comes: a besan laddoo and a spoon of sweet pongal in a cup of leaves. Devotees come to it
// along a path of stepping stones, wait their turn in a short line, take the cup in both hands with a namaste and walk on,
// eating. You can join the line too.

const P = new THREE.Vector3(23, 0, 24), FACE = new THREE.Vector3(17.5, 0, 13.5);
const ROT = Math.atan2(FACE.x - P.x, FACE.z - P.z);   // the pavilion's front looks back towards the garden walk
const toWorld = (x, z, y = 0) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ROT).add(P);
export const PRASAD = { pos: P, rot: ROT, name: 'Prasad centre', front: toWorld(0, 3.05), path: toWorld(0, 6.6), slot: (i) => toWorld(i % 2 ? 0.18 : -0.12, 3.05 + i * 0.95), entrance: toWorld(0, 3.05) };

export function buildPrasad(world) {
  const S = world.scene, g = new THREE.Group(); g.position.copy(P); g.rotation.y = ROT; S.add(g);
  const add = (geo, mat, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const stone = stoneMat('#ead9bd', [2, 0.5], { rows: 2 }), fine = stoneMat('#efe2cb', [1, 1], { blocks: false }), band = bandMat('#e3cfa9', 'beads', [6, 1]);
  // plinth and steps, six carved pillars, a flat roof with a beaded cornice and a small domed pavilion on top
  add(new THREE.BoxGeometry(6.4, 0.36, 4.6), stone, 0, 0.18, 0);
  add(new THREE.BoxGeometry(6.6, 0.12, 4.8), band, 0, 0.38, 0);
  for (let i = 0; i < 2; i++) add(new THREE.BoxGeometry(2.6 - i * 0.3, 0.12, 0.42), fine, 0, 0.06 + i * 0.12, 2.5 - i * 0.2);
  const pg = pillarGeometry(2.7, 0.17);
  for (const x of [-2.9, 0, 2.9]) for (const z of [-2.0, 2.0]) { if (x === 0 && z > 0) continue; add(pg, fine, x, 0.44, z); }
  add(new THREE.BoxGeometry(6.8, 0.32, 5.0), stone, 0, 3.3, 0);
  add(new THREE.BoxGeometry(6.9, 0.16, 5.1), band, 0, 3.12, 0);
  const ch = chhatri(0.62, ivory, paleGold); ch.position.set(0, 3.46, 0); g.add(ch);
  const k = 0.55; for (const [x, z] of [[-3.1, -2.2], [3.1, -2.2], [-3.1, 2.2], [3.1, 2.2]]) { const kk = kalashaSmall(k); kk.position.set(x, 3.46, z); g.add(kk); }
  // marigold garlands across the front, and a carved board: प्रसाद · Prasad
  g.add(garland(new THREE.Vector3(-2.9, 2.95, 2.1), new THREE.Vector3(2.9, 2.95, 2.1), 0.45, 44));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshStandardMaterial({ map: TX.inscription('प्रसाद · Prasad', { bg: '#7a2318', color: '#f3d38a' }), roughness: 0.6, emissive: '#3a1408', emissiveIntensity: 0.3 }));
  board.position.set(0, 3.3, 2.52); g.add(board);
  // the counter: a long teak table under a cloth, set with what is shared
  const teak = pbr('teak', { repeat: [2, 1], roughness: 0.6 });
  add(new THREE.BoxGeometry(4.2, 0.82, 0.78), teak, 0, 0.44 + 0.41, 1.25);
  add(new THREE.BoxGeometry(4.24, 0.03, 0.82), new THREE.MeshStandardMaterial({ color: '#b8341d', roughness: 0.85 }), 0, 1.275, 1.25);
  add(new THREE.BoxGeometry(4.24, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: '#d9a23a', roughness: 0.6, metalness: 0.3 }), 0, 1.2, 1.665);
  const top = 1.29;
  // a great brass urli of laddoos, heaped
  const urli = (r) => new THREE.LatheGeometry([[0, 0], [r * 0.55, 0], [r * 0.85, 0.05], [r, 0.14], [r * 1.04, 0.17], [r * 0.98, 0.17]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  add(urli(0.42), brass, -1.25, top, 1.2);
  const lad = new THREE.SphereGeometry(0.055, 10, 8), ladM = new THREE.MeshStandardMaterial({ color: '#e8a33a', roughness: 0.85 }), laddoos = [];
  for (let ring = 0; ring < 4; ring++) { const n = [9, 7, 5, 1][ring], r = [0.26, 0.18, 0.1, 0][ring]; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + ring; laddoos.push(lad.clone().translate(-1.25 + Math.cos(a) * r, top + 0.12 + ring * 0.085, 1.2 + Math.sin(a) * r)); } }
  add(mergeGeos(laddoos), ladM, 0, 0, 0);
  // sweet pongal in a copper pot, and a brass bowl of halwa
  add(urli(0.3), copper, -0.35, top, 1.18); const pong = add(new THREE.SphereGeometry(0.27, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9a64a', roughness: 0.9 }), -0.35, top + 0.1, 1.18); pong.scale.y = 0.45;
  add(urli(0.24), brass, 0.45, top, 1.25); const hal = add(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8742c', roughness: 0.8 }), 0.45, top + 0.08, 1.25); hal.scale.y = 0.5;
  // stacks of leaf cups, a banana leaf with tulsi, a kalash, and a brass lamp burning
  const cupGeo = leafCupGeometry(), leafM = new THREE.MeshStandardMaterial({ color: '#6f8a3a', roughness: 0.85, side: THREE.DoubleSide });
  for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) add(cupGeo, leafM, 1.15 + s * 0.2, top + i * 0.025, 1.12 + (s % 2) * 0.12);
  const banana = add(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshStandardMaterial({ color: '#4f8a34', roughness: 0.7, side: THREE.DoubleSide }), 1.4, top + 0.004, 1.4); banana.rotation.x = -Math.PI / 2;
  const kl = kalasha(0.42, copper); kl.position.set(1.85, top, 1.08); g.add(kl);
  const lamp = lampStand(0.75); lamp.position.set(-1.9, top, 1.05); g.add(lamp);
  for (const w of lamp.userData.wicks) { lamp.updateMatrixWorld(true); world._diyaLocal(g, w.clone().add(lamp.position).add(new THREE.Vector3(0, -0.03, 0)), 0.22); }
  // diyas along the plinth edge and lanterns at the steps
  for (const x of [-2.6, -1.6, 1.6, 2.6]) world._diyaLocal(g, new THREE.Vector3(x, 0.4, 2.2), 0.3);
  // stepping stones from the garden walk
  const stoneP = stoneMat('#d6c3a2', [1, 1], { blocks: false }), steps = [];
  const a = PRASAD.path, b = toWorld(0, 2.9), n = Math.ceil(a.distanceTo(b) / 0.72);
  for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); steps.push(new THREE.CylinderGeometry(0.34 + (i % 2) * 0.05, 0.36, 0.06, 9).rotateY(i * 0.7).translate(p.x + (i % 2 ? 0.06 : -0.05), 0.03, p.z)); }
  const sm = new THREE.Mesh(mergeGeos(steps), stoneP); sm.receiveShadow = true; S.add(sm);
  // the sevak behind the counter, and a helper
  const sevak = new Avatar({ name: 'Sevak', presentation: 'masc', skin: '#9c6a44', hair: 'cropped', hairColor: '#1b1512', outfit: 'dhoti', color: 'saffron', mark: 'tilak' }, { simulated: true });
  sevak.root.position.copy(toWorld(-0.4, 0.55, 0.44)); sevak.root.rotation.y = ROT; S.add(sevak.root);
  const helper = new Avatar({ name: 'Seva', presentation: 'fem', skin: '#b07a52', hair: 'bun', hairColor: '#1b1512', outfit: 'saree', color: 'ivory', mark: 'bindi' }, { simulated: true });
  helper.root.position.copy(toWorld(1.3, 0.45, 0.44)); helper.root.rotation.y = ROT + 0.25; helper.setState('idle'); S.add(helper.root);
  // keep the garden clear of the pavilion
  world.colliders.circles.push({ x: P.x, z: P.z, r: 2.55 });
  for (const [x, z] of [[-2.9, 2.0], [2.9, 2.0], [-2.9, -2.0], [2.9, -2.0], [-3.1, 0], [3.1, 0]]) { const w = toWorld(x, z); world.colliders.circles.push({ x: w.x, z: w.z, r: 0.55 }); }
  return new PrasadCounter(world, sevak, helper, toWorld(-0.6, 1.25, top + 0.1), cupGeo, leafM, ladM);
}

function kalashaSmall(k) { const g = new THREE.Group(); const m = kalasha(k, paleGold); g.add(m); return g; }
function leafCupGeometry() {
  // a dona: a little cup folded from leaves, its rim pinched into points
  const g = new THREE.CylinderGeometry(0.075, 0.045, 0.05, 10, 1, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.abs(Math.sin(a * 5)) * 0.012); } }
  g.translate(0, 0.025, 0); const base = new THREE.CircleGeometry(0.045, 10).rotateX(-Math.PI / 2); return mergeGeos([g, base]);
}

// the line, and the sevak serving it one by one
class PrasadCounter {
  constructor(world, sevak, helper, pickup, cupGeo, leafM, ladM) {
    Object.assign(this, { world, sevak, helper, pickup, cupGeo, leafM, ladM });
    this.queue = []; this.serving = null; this.nextServe = 0; this.cups = [];
    this.cupProto = (() => { const c = new THREE.Group(); c.add(new THREE.Mesh(cupGeo, leafM)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), ladM); l.position.y = 0.05; c.add(l);
      const pg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9a64a', roughness: 0.9 })); pg.scale.y = 0.5; pg.position.set(0.025, 0.035, 0.01); c.add(pg); return c; })();
  }
  get length() { return this.queue.length; }
  has(avatar) { return this.queue.some((q) => q.avatar === avatar); }
  // join the line: { player, onMove(slot), done() }
  join(avatar, opts = {}) {
    if (this.has(avatar)) return;
    const q = { avatar, ...opts, slot: this.queue.length }; this.queue.push(q);
    if (q.player && q.onMove) q.onMove(PRASAD.slot(q.slot));   // set off for your place at once
  }
  leave(avatar) { const i = this.queue.findIndex((q) => q.avatar === avatar); if (i < 0) return; if (this.serving && this.serving.q.avatar === avatar) this.serving = null; this.queue.splice(i, 1); }
  position(avatar) { return this.queue.findIndex((q) => q.avatar === avatar); }
  update(dt, t) {
    const face = (av, target, k = 8) => { const p = av.root.position; av.root.rotation.y = lerpA(av.root.rotation.y, Math.atan2(target.x - p.x, target.z - p.z), 1 - Math.exp(-dt * k)); };
    // everyone in line steps up to their place
    this.queue.forEach((q, i) => {
      const slot = PRASAD.slot(i), av = q.avatar, p = av.root.position;
      if (q.player) { if (q.slot !== i) { q.slot = i; q.onMove && q.onMove(slot.clone()); } q.atSlot = p.distanceTo(slot) < 0.35; if (q.atSlot && av.state !== 'walk') face(av, this.sevak.root.position, 5); return; }
      if (av.greet) { if (greetStep(av, dt, t)) av.greet = null; return; }   // returning your pranam, then back to waiting
      q.slot = i; const d = new THREE.Vector3(slot.x - p.x, 0, slot.z - p.z), dist = d.length();
      if (dist > 0.06) { const st = Math.min(dist, 1.1 * dt); p.addScaledVector(d.normalize(), st); av.speed = 1.1; if (av.state !== 'walk') av.setState('walk'); face(av, slot); q.atSlot = false; }
      else { q.atSlot = true; av.speed = 0; if (av.state === 'walk') av.setState(Math.random() < 0.5 ? 'idle' : 'namaste'); face(av, this.sevak.root.position, 4); }
    });
    // the sevak turns to whoever is first, ladles a cup and hands it over; they take it in both hands with a namaste
    const S = this.serving, front = this.queue[0];
    if (!S && front && front.atSlot && !front.avatar.greet && t > this.nextServe) { this.serving = { q: front, t0: t, cup: null }; this.sevak.setState('offer'); }
    if (this.serving) {
      const s = this.serving, k = t - s.t0, av = s.q.avatar;
      face(this.sevak, av.root.position, 6);
      if (!s.cup && k > 0.55) { s.cup = this.cupProto.clone(); s.cup.position.copy(this.pickup); this.world.scene.add(s.cup); s.from = this.pickup.clone(); av.setState('offer'); }
      if (s.cup) { const hands = av.handWorld(1).add(av.handWorld(-1)).multiplyScalar(0.5), f = Math.min(1, (k - 0.55) / 0.7); s.cup.position.lerpVectors(s.from, hands, f * f * (3 - 2 * f)); s.cup.position.y += Math.sin(f * Math.PI) * 0.18; }
      if (k > 1.5) {
        this.cups.push({ avatar: av, mesh: s.cup, until: t + 22 }); av.setState('namaste'); this.sevak.setState('namaste');
        this.queue.shift(); this.serving = null; this.nextServe = t + 1.1;
        const done = s.q.done; setTimeout(() => done && done(), 900);
      }
    } else if (this.sevak.state === 'namaste' && this.sevak.stateTime > 1.6) this.sevak.setState('idle');
    if (!this.serving) face(this.sevak, PRASAD.slot(0), 2);
    // cups stay in the hands for a while, then are finished
    for (let i = this.cups.length - 1; i >= 0; i--) {
      const c = this.cups[i]; if (t > c.until || !c.avatar.root.parent) { this.world.scene.remove(c.mesh); this.cups.splice(i, 1); continue; }
      const h = c.avatar.handWorld(1).add(c.avatar.handWorld(-1)).multiplyScalar(0.5); c.mesh.position.copy(h); c.mesh.rotation.y = c.avatar.root.rotation.y;
    }
    // the helper keeps the stacks of cups in order, now and then
    if (this.helper.stateTime > 6 + Math.sin(t) * 2) this.helper.setState(this.helper.state === 'offer' ? 'idle' : 'offer');
    this.sevak.update(dt, t); this.helper.update(dt, t);
  }
}
function lerpA(a, b, t) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }
