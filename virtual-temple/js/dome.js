import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as TX from './textures.js';
import { brass, gold, copper, clay, darkStone, HangingBell, diyaGeometry, lampStand, kalasha, garland } from './architecture.js';
import { FlameField, SmokeSystem, PetalOffering, dustMotes } from './fx.js';
import { mergeGeos, petalRing } from './ornament.js';
import { greetStep } from './greet.js';
import { Avatar } from './avatar.js';
import { HALL, buildRockHall, lampTower, lampGlow, diyaField, granite, carvedStone, carved, roughBox } from './rockhall.js';
import { pbr } from './pbr.js';

// The immersive prayer hall: one circular domed mandapa with 12 lotus-marked prayer spots in
// three rows of four, facing the sanctum. The shell is shared; the sanctum is rebuilt per deity.

const R = 11;
export const SPOTS = [];
for (const z of [-1.4, 1.6, 4.6]) for (const x of [-4.5, -1.5, 1.5, 4.5]) SPOTS.push(new THREE.Vector3(x, 0, z));
export const ENTRANCE = new THREE.Vector3(0, 0, 9.6);
const ALTAR_FOCUS = new THREE.Vector3(0, 1.75, -8.6);

// the height of the floor underfoot: three steps up to the sanctum platform, which runs back into the chamber
export function hallFloor(x, z) {
  const ax = Math.abs(x);
  if (ax < 3.2 && z < -5.5) return 0.6;
  if (ax < 3.4 && z < -5.05) return 0.4;
  if (ax < 3.6 && z < -4.6) return 0.2;
  return 0;
}
// where a devotee walks from their place: to the nearer bell, to the foot of the steps to offer flowers, or up into the
// sanctum and once round the deity, keeping it on the right (pradakshina). Returns the way out, the circuit, where to face and what to frame.
export function hallRoute(kind, spot) {
  const V = THREE.Vector3, s = SPOTS[spot], side = s.x < 0 ? -1 : 1, ax = s.x > 0 ? s.x - 1.5 : s.x + 1.5;
  const out = [new V(ax, 0, s.z)];
  if (ax === 0) out.push(new V(0, 0, -2.0), new V(side * 1.5, 0, -2.95)); else out.push(new V(ax, 0, -1.9));
  if (kind === 'bell') { out.push(new V(side * 2.9, 0, -2.58)); return { out, side, bell: side < 0 ? 0 : 1, face: new V(side * 2.9, 0, -3.2), focus: new V(side * 2.9, 2.0, -3.0) }; }
  if (ax !== 0) out.push(new V(side * 1.5, 0, -2.95));
  out.push(new V(side * 1.12, 0, -4.32));
  if (kind === 'flowers') return { out, side, face: new V(0, 0, -5.75), focus: new V(0, 0.8, -5.6) };
  out.push(new V(side * 0.83, 0, -6.25), new V(side * 0.82, 0, -7.05));
  const R = HALL.RING_R, C = HALL.AIM.z, a0 = Math.PI / 2 + (side < 0 ? 0.42 : -0.42), ring = [];
  for (let k = 1; k <= 32; k++) { const a = a0 + k / 32 * Math.PI * 2; ring.push(new V(Math.cos(a) * R, 0, C + Math.sin(a) * R)); }
  return { out, ring, side, face: new V(0, 0, C), focus: new V(0, 1.3, C) };
}

export class PrayerHall {
  constructor(renderer, quality, audio) {
    this.renderer = renderer; this.quality = quality; this.audio = audio;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b120c');
    this.scene.fog = new THREE.Fog('#2a1a10', 18, 40);
    this.flames = new FlameField(360); this.scene.add(this.flames.points);
    this.smoke = new SmokeSystem(quality.level === 'low' ? 180 : 420); this.scene.add(this.smoke.points);
    this.petals = new PetalOffering(700); this.scene.add(this.petals.mesh);
    this.occupants = new Map(); // spot -> Avatar (simulated devotees)
    this.spotState = SPOTS.map(() => ({ lit: false, flame: -1, incense: null, light: null }));
    this.templeId = null; this.aarti = null; this.hover = -1; this.mySpot = -1; this.selecting = false;
    this.buildShell();
  }

  buildShell() {
    const S = this.scene, Q = this.quality, low = Q.level === 'low', V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.hemi = new THREE.HemisphereLight('#e6d6c4', '#6a4426', 0.26);   // the ground colour is lamplight thrown up off the floor onto the dome and the soffits S.add(this.hemi);
    this.ambientBase = 0.26; this.sunBase = 70;
    // daylight falling through the opening in the rock, onto the lingam in the sanctum
    // the cave hewn from the rock: walls, ceiling and the opening, pillars, carved panels, benches and the niche shrine
    const R = this.rock = buildRockHall(S, Q); this.skyMat = R.sky; const stoneFine = R.shrine;
    const O = HALL.OCULUS, aim = HALL.AIM, dir = aim.clone().sub(O).normalize(), L0 = aim.distanceTo(O);
    this.sun = new THREE.SpotLight('#ffe2b0', 70, 22, 0.15, 0.5, 1.2); this.sun.position.copy(R.lightPos); this.sun.target.position.copy(aim);
    this.sun.castShadow = Q.shadows > 0; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.camera.near = 0.5; this.sun.shadow.camera.far = 20; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
    S.add(this.sun, this.sun.target);
    // the floor: dark flagstones, wet and glossy, catching the lamplight
    const floorM = pbr('flagstone', { repeat: [5, 4.4], roughness: 0.62, color: '#b9aa9c', normal: 0.8, envMapIntensity: 1.6 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 19.4), floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 2.05); floor.receiveShadow = true; floor.userData.floor = true; S.add(floor); this.floor = floor;
    // the shaft of light and the dust drifting in it
    const beamM = this.beamMat = new THREE.MeshBasicMaterial({ map: TX.beam(), color: '#ffe2b0', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const card = new THREE.PlaneGeometry(1.3, L0 + 1.0); card.translate(0, -(L0 + 1.0) / 2, 0); this.beams = [];
    for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(card, beamM); b.position.copy(O).addScaledVector(dir, -0.9); b.quaternion.setFromUnitVectors(V(0, -1, 0), dir); b.rotateY(r); b.renderOrder = 5; S.add(b); this.beams.push(b); }
    this.dust = dustMotes(low ? 120 : 260, new THREE.Box3(V(-1, 0, -9), V(1, 9, -3)), '#ffe6b8'); S.add(this.dust);
    { const p = this.dust.geometry.attributes.position, side = V(1, 0, 0), perp = new THREE.Vector3().crossVectors(dir, side).normalize();
      for (let i = 0; i < p.count; i++) { const t = Math.random() * (L0 - 0.4), q = O.clone().addScaledVector(dir, t).addScaledVector(side, (Math.random() - 0.5) * 0.9).addScaledVector(perp, (Math.random() - 0.5) * 0.9); p.setXYZ(i, q.x, q.y, q.z); }
      p.needsUpdate = true; this.dust.geometry.computeBoundingSphere(); }
    // oil lamps everywhere: on the rock benches under the carvings, at the pillar feet, on the sanctum steps, and two tall lamp towers
    const spots = [], Bn = R.bench;
    for (const s of [-1, 1]) for (let z = -6.1; z <= 10.3; z += 0.9) spots.push({ p: V(s * Bn.sideX, Bn.y, z), wall: V(-s, 0, 0), inset: -0.3, pool: 0.95, floorY: 0, refl: 1.8 });
    for (const s of [-1, 1]) for (let x = 3.75; x <= 10.4; x += 0.9) spots.push({ p: V(s * x, Bn.y, Bn.backZ), wall: V(0, 0, 1), inset: 0.14, pool: 0.95, floorY: 0, refl: 1.8 });
    for (const pl of R.pillars) for (const dz of [-0.72, 0.72]) spots.push({ p: V(pl.x - Math.sign(pl.x) * 0.86, 0, pl.z + dz), pool: 0.8, floorY: 0, refl: 1.4 });
    for (let i = 0; i < 3; i++) { const y = 0.2 + 0.2 * i, z = -5.1 - 0.45 * i + 0.22, hw = (7.2 - i * 0.4) / 2 - 0.28; for (const s of [-1, 1]) spots.push({ p: V(s * hw, y, z), pool: 0.6, floorY: y }); }
    for (const s of [-1, 1]) spots.push({ p: V(s * 2.95, 0.6, -6.3), pool: 0.6, floorY: 0.6 });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (Math.sin(a) > 0.55) continue; spots.push({ p: V(Math.cos(a) * 2.58, 0.62, HALL.AIM.z + Math.sin(a) * 2.58), pool: 0.55, floorY: 0.62 }); }   // round the pradakshina path
    for (const [x, z] of [[-2.2, -3.9], [2.3, -4.1], [-4.4, -4.1], [4.3, -4.2]]) spots.push({ p: V(x, 0, z), pool: 0.8, floorY: 0, refl: 1.5 });   // a few set on the floor before the steps
    this.shellFlames = spots.map((s) => ({ p: s.p.clone().add(V(0, 0.1, 0)), s: 0.3 }));
    S.add(diyaField(spots));
    this.towers = [];
    for (const s of [-1, 1]) {
      const T = lampTower(3.3); T.mesh.position.set(s * 5.55, 0, -5.25); S.add(T.mesh);
      for (const w of T.wicks) this.shellFlames.push({ p: w.clone().add(T.mesh.position), s: 0.2 });
      spots.push({ p: T.mesh.position.clone(), pool: 2.1, floorY: 0, refl: 3.6, noDiya: true });
      const L = new THREE.PointLight('#ffa65a', 18, 14, 1.3); L.position.set(s * 5.55, 2.4, -5.25); S.add(L); this.towers.push(L);
    }
    if (!low) for (const s of [-1, 1]) { const L = new THREE.PointLight('#ff9c52', 10, 13, 1.35); L.position.set(s * 9.2, 1.6, 2.4); S.add(L); this.towers.push(L); }
    this.glow = lampGlow(spots, { reflections: !low }); S.add(this.glow.group);
    // petals strewn before the sanctum steps
    { const pts = []; for (let i = 0; i < 90; i++) { const a = (Math.random() - 0.5) * 2.6, d = Math.pow(Math.random(), 1.6) * 4.2; pts.push(V(Math.sin(a) * d * 1.3, 0.012, -4.6 + Math.cos(a) * d)); }
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, r = HALL.RING_IN + 0.08 + Math.random() * (HALL.RING_OUT - HALL.RING_IN - 0.16); pts.push(V(Math.cos(a) * r, 0.648, HALL.AIM.z + Math.sin(a) * r)); }   // on the path round the deity
      for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) pts.push(V((Math.random() - 0.5) * (6.6 - i * 0.4), 0.2 + 0.2 * i + 0.012, -5.1 - 0.45 * i + (Math.random() - 0.5) * 0.4));
      const pm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 7).scale(1, 1.6, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }), pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
      pts.forEach((p, i) => { m4.compose(p, q.setFromAxisAngle(V(0, 1, 0), Math.random() * 6.3), V(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.6)); pm.setMatrixAt(i, m4); pm.setColorAt(i, col.set(['#e8608c', '#f28aaa', '#d94a7a', '#f6a8c0'][i % 4])); });
      S.add(pm); }
    // entrance doorway
    const door = new THREE.Group(); door.position.set(0, 0, HALL.FRONT); S.add(door);
    const dm = new THREE.MeshBasicMaterial({ color: '#f7dfb0', fog: false }); const opening = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), dm); opening.position.set(0, 1.8, 0.02); opening.rotation.y = Math.PI; door.add(opening);
    for (const s of [-1, 1]) { const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.0, 0.6), stoneFine); jamb.position.set(s * 1.4, 2.0, 0); door.add(jamb); }
    const lint = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 0.6), carved('gavaksha', 3.3, 1.2)); lint.position.set(0, 4.1, 0); door.add(lint);
    door.add(garland(new THREE.Vector3(-1.2, 3.75, -0.32), new THREE.Vector3(1.2, 3.75, -0.32), 0.35, 26));
    this.exitMarker = door;
    // spot markers
    const markGeo = new THREE.PlaneGeometry(1.25, 1.25);
    this.markers = SPOTS.map((p, i) => {
      const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: TX.lotusMark(), transparent: true, depthWrite: false, color: '#ffcf70', opacity: 0.8, blending: THREE.AdditiveBlending, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(0.012); m.userData.spot = i; m.renderOrder = 2; S.add(m); return m;
    });
    // personal diya stands in front of each spot, with an incense holder
    const standGeo = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.12, 0.02], [0.04, 0.05], [0.025, 0.28], [0.1, 0.31], [0.11, 0.33], [0, 0.33]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const dg = diyaGeometry();
    this.stands = SPOTS.map((p) => {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z - 0.85); S.add(g);
      const st = new THREE.Mesh(standGeo, brass); st.castShadow = true; g.add(st);
      const d = new THREE.Mesh(dg, clay); d.position.y = 0.33; d.scale.setScalar(1.3); g.add(d);
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.05, 8), brass); holder.position.set(0.18, 0.025, 0); g.add(holder);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 4), new THREE.MeshStandardMaterial({ color: '#4a2a1c', roughness: 0.9 })); stick.position.set(0.18, 0.2, 0); stick.rotation.z = -0.12; stick.visible = false; g.add(stick);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5a1a' })); ember.position.set(0.199, 0.36, 0); ember.visible = false; g.add(ember);
      return { group: g, stick, ember, flamePos: new THREE.Vector3(p.x, 0.43, p.z - 0.85 + 0.03), tip: new THREE.Vector3(p.x + 0.2, 0.37, p.z - 0.85) };
    });
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
  }

  // the shaft through the rock follows the time of day; at night the shrine is lit by its lamps and a thin moonbeam
  setTimeOfDay(tod) {
    const P = { morning: ['#ffe6c0', 80, 0.22, '#fff1d6', 0.26, 1], afternoon: ['#fff6ea', 90, 0.2, '#ffffff', 0.28, 1], evening: ['#ffbc80', 60, 0.24, '#ffc890', 0.22, 0.85], night: ['#9db0f0', 10, 0.06, '#1c2850', 0.14, 0.3] }[tod];
    if (!P) return;
    const [sun, si, beam, sky, hemi, dust] = P;
    this.sun.color.set(sun); this.sunBase = si; this.ambientBase = hemi;
    if (!this.aarti) { this.sun.intensity = si; this.hemi.intensity = hemi; }
    this.beamMat.opacity = beam; this.beamMat.color.set(sun); this.skyMat.color.set(sky);
    this.dust.material.uniforms.uOpacity.value = dust;
  }

  // ---------- sanctum ----------
  setTemple(id) {
    if (this.templeId === id) return;
    this.templeId = id;
    if (this.altar) { this.scene.remove(this.altar); }
    for (const L of this.altarLights || []) this.scene.remove(L);
    // reset flames (keep personal diya slots consistent)
    this.flames.count = 0; this.flames.points.geometry.setDrawRange(0, 0);
    for (const f of this.shellFlames) this.flames.add(f.p, f.s);   // the shrine's own lamps, always burning
    this.spotState.forEach(s => { s.lit = false; s.flame = -1; s.incense = null; if (s.light) { this.scene.remove(s.light); s.light = null; } });
    this.stands.forEach(s => { s.stick.visible = false; s.ember.visible = false; });
    this.smoke.clear(); this.petals.mesh.count = 0; this.petals.flying.length = 0;
    const A = this.altar = new THREE.Group(); this.scene.add(A);
    const stone = granite(), fine = carvedStone();   // the same dark granite as the rock-cut hall
    const add = (geo, m, x, y, z, parent = A) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
    // raised platform with three steps
    for (let i = 0; i < 3; i++) add(roughBox(7.2 - i * 0.4, 0.2, 1.0, { amp: 0.022, seed: i * 3 }), stone, 0, 0.1 + i * 0.2, -5.1 - i * 0.45);
    add(roughBox(6.4, 0.6, 6.0, { amp: 0.02, seed: 9 }), stone, 0, 0.3, -9.1);   // the platform, running back into the sanctum chamber
    // a brass prabhavali (radiant arch) behind Ganesha and Krishna; the lingam stands bare in its beam of light
    if (id !== 'shiva') {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 10, 40, Math.PI), brass); arch.position.set(0, 2.05, -9.6); A.add(arch);
      const arch2 = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.035, 8, 40, Math.PI), brass); arch2.position.set(0, 2.05, -9.62); A.add(arch2);
      for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), brass); f.position.set(Math.cos(a) * 1.42, 2.05 + Math.sin(a) * 1.42, -9.62); f.rotation.z = a - Math.PI / 2; A.add(f); }
    }
    // an incense pot at the foot of the steps, as in the old shrines, its smoke curling up into the lamplight
    const pot = add(new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.16, 0.06], [0.2, 0.2], [0.17, 0.32], [0.11, 0.36], [0.14, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 20), brass, -3.5, 0, -4.3); void pot;
    for (let i = 0; i < 3; i++) { const st = add(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), new THREE.MeshStandardMaterial({ color: '#4a2a1c', roughness: 0.9 }), -3.5 + (i - 1) * 0.04, 0.6, -4.3); st.rotation.z = (i - 1) * 0.18; }
    // deity
    if (id === 'shiva') this._shiva(A, add); else if (id === 'ganesha') this._ganesha(A, add); else this._krishna(A, add);
    // lamp stands, offering table, kalash, bell
    this.lampFlames = [];
    for (const s of [-1, 1]) {
      const ls = lampStand(1.55); ls.position.set(s * 2.35, 0.6, -6.1); A.add(ls);
      for (const w of ls.userData.wicks) this.lampFlames.push(this.flames.add(w.clone().add(ls.position).add(new THREE.Vector3(0, 0.06, 0)), 0.42));
    }
    for (const s of [-1, 1]) { const d = new THREE.Mesh(diyaGeometry(), clay); d.position.set(s * 0.9, 0.62, -7.2); d.scale.setScalar(1.6); A.add(d); this.flames.add(new THREE.Vector3(s * 0.9, 0.73, -7.17), 0.38); }
    const table = add(new THREE.CylinderGeometry(0.55, 0.5, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#5a2d1a', roughness: 0.6 }), 0, 0.66, -5.75);
    void table;
    this.thali = add(new THREE.CylinderGeometry(0.42, 0.38, 0.04, 32), brass, 0, 0.74, -5.75);
    this.thaliTop = new THREE.Vector3(0, 0.78, -5.75);
    const k = kalasha(0.55, copper); k.position.set(-1.25, 0.6, -6.0); A.add(k);
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.95 })); coco.position.set(-1.25, 1.18, -6.0); A.add(coco);
    for (let i = 0; i < 5; i++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#3d6b2a', roughness: 0.8 })); const a = i / 5 * Math.PI * 2; leaf.position.set(-1.25 + Math.cos(a) * 0.1, 1.08, -6.0 + Math.sin(a) * 0.1); leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); A.add(leaf); }
    // altar incense (dhoop) is always burning, gently
    this.altarSmoke = [this.smoke.addEmitter(new THREE.Vector3(1.25, 1.0, -6.0), { rate: 6, life: 1e9 }), this.smoke.addEmitter(new THREE.Vector3(-3.5, 0.86, -4.3), { rate: 4, life: 1e9 })];
    const dhoop = add(new THREE.CylinderGeometry(0.1, 0.07, 0.4, 12), brass, 1.25, 0.8, -6.0); void dhoop;
    // the main hall bell, hung from the ceiling with a pull rope
    // two bells hung on long chains either side of the approach, low enough for a devotee to reach the rope
    for (const b of this.bells || []) this.scene.remove(b.group);
    this.bells = [-1, 1].map((s) => {
      const b = new HangingBell(1.6, 0.9), x = s * 2.9, z = -3.0, top = this.rock.ceilAt(x, z) - 3.1; b.group.position.set(x, 3.1, z); b.axis = 'z';
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top, 6), brass); chain.position.y = top / 2; b.group.add(chain);
      this.scene.add(b.group);
      b.onStrike = (bb, e = 1) => this.audio.bell(bb.group.getWorldPosition(new THREE.Vector3()), { size: 1.45, gain: 0.7 * (0.3 + 0.7 * e * e), hall: 0.6 });
      return b;
    });
    this.bell = this.bells[0];
    // sanctum light
    this.sanctBase = 6.5; this.fillBase = 8;   // low: the shrine is lit by its lamps and the shaft of daylight
    const sanct = new THREE.PointLight('#ffa255', this.sanctBase, 9, 1.5); sanct.position.set(0, 3.3, -8.4);
    const fill = new THREE.SpotLight('#ffbf80', this.fillBase, 16, 0.32, 0.7, 1.4); fill.position.set(0, 5.0, -2); fill.target.position.set(0, 1.4, -9.0);
    const lampL = new THREE.PointLight('#ff9f4a', 3, 7, 1.8); lampL.position.set(0, 2.0, -5.8);
    this.altarLights = [sanct, fill, fill.target, lampL]; this.sanct = sanct; this.fill = fill; this.lampLight = lampL;
    for (const L of this.altarLights) this.scene.add(L);
    // aarti lamp (panch-pradip) hidden until the ceremony
    this.aartiLamp = new THREE.Group(); const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.022, 20), brass); this.aartiLamp.add(plate);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.1, 8), brass); handle.position.y = -0.06; this.aartiLamp.add(handle);
    this.aartiLamp.visible = false; this.scene.add(this.aartiLamp);
    this.aartiFlames = []; for (let i = 0; i < 5; i++) this.aartiFlames.push(this.flames.add(new THREE.Vector3(0, -50, 0), 0.4));
    this.aartiLight = new THREE.PointLight('#ffb15a', 0, 6, 1.6); this.scene.add(this.aartiLight);
    // priest (simulated) stands to the side of the sanctum
    if (this.priest) this.scene.remove(this.priest.root);
    this.priest = new Avatar({ name: 'Pujari', presentation: 'masc', skin: '#a8714a', hair: 'cropped', hairColor: '#1b1512', outfit: 'dhoti', color: 'saffron' }, { simulated: true });
    this.priest.root.position.set(1.6, 0.6, -6.6); this.priest.root.rotation.y = -Math.PI * 0.82; this.scene.add(this.priest.root);
    // personal diya flame slots after the shared ones
    // environment map for brass and marble sheen
    if (this.envRT) this.envRT.dispose();
    this.scene.updateMatrixWorld(true);
    this.envRT = this.pmrem.fromScene(this.scene, 0.04); this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55;
  }

  _shiva(A, add) {
    const ped = add(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 32), darkStone, 0, 0.85, -8.9);
    void ped;
    const yoni = add(new THREE.CylinderGeometry(0.8, 0.75, 0.22, 32), darkStone, 0, 1.21, -8.9);
    const spout = add(new THREE.BoxGeometry(0.85, 0.12, 0.28), darkStone, 0.95, 1.25, -8.9); void yoni; void spout;
    const lingGeo = new THREE.CylinderGeometry(0.3, 0.33, 0.8, 40, 1); lingGeo.translate(0, 0.4, 0);
    const lm = new THREE.MeshStandardMaterial({ map: TX.tripundra(), roughness: 0.32, metalness: 0.05 });
    const ling = add(lingGeo, lm, 0, 1.32, -8.9); ling.rotation.y = -Math.PI / 2;
    const cap = add(new THREE.SphereGeometry(0.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1d1a19', roughness: 0.3 }), 0, 2.12, -8.9); void cap;
    // bilva leaves and white flowers on the pitha
    const leafM = new THREE.MeshStandardMaterial({ color: '#3c6b2b', roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; for (let k = -1; k <= 1; k++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), leafM); l.scale.set(0.6, 1.3, 1); l.position.set(Math.cos(a) * 0.55, 1.33, -8.9 + Math.sin(a) * 0.55); l.rotation.set(-Math.PI / 2, 0, a + k * 0.6); A.add(l); } }
    A.add(ringOf(0.48, 1.34, -8.9, 22, '#ffffff', 0.05));
    // a jasmine garland draped round the lingam, a pink lotus at its heart and another on the pitha, and a brass lamp beside it
    for (const [r, y0, drop, n, col, sz] of [[0.355, 1.9, 0.46, 46, '#fbf5e6', 0.036], [0.37, 1.84, 0.36, 40, '#f1e6cc', 0.03]]) {
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(sz, 7, 5), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }), n), m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, f = Math.max(0, Math.sin(a)), rr = r + f * 0.03; m4.makeTranslation(Math.cos(a) * rr, y0 - Math.pow(f, 1.6) * drop, -8.9 + Math.sin(a) * rr); im.setMatrixAt(i, m4); }
      A.add(im);
    }
    const lotusM = new THREE.MeshStandardMaterial({ color: '#ef7fa3', roughness: 0.55, side: THREE.DoubleSide }), heart = new THREE.MeshStandardMaterial({ color: '#f2c43a', roughness: 0.6 });
    for (const [x, y, z, sc] of [[0, 1.43, -8.5, 1.7], [0, 1.27, -8.22, 1.8]]) {
      const lo = new THREE.Mesh(mergeGeos([petalRing(0.025, 8, 0.075, { lean: 0.45, rows: 2 })]), lotusM); lo.position.set(x, y, z); lo.scale.setScalar(sc); lo.rotation.x = 0.5; A.add(lo);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), heart); c.position.set(x, y + 0.03, z); A.add(c);
    }
    const samai = lampStand(0.85); samai.position.set(0.85, 0.6, -7.95); A.add(samai);
    for (const w of samai.userData.wicks) this.flames.add(w.clone().add(samai.position).add(new THREE.Vector3(0, 0.05, 0)), 0.26);
    // copper dhara-patra above the lingam
    const pot = add(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), copper, 0, 3.2, -8.9); pot.scale.y = 1.1;
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.006, 0.006, 1.6, 4), brass, s * 0.25, 4.0, -8.9);
    this.dripFrom = new THREE.Vector3(0, 2.92, -8.9);
    const streamGeo = new THREE.CylinderGeometry(0.012, 0.02, 1, 8); streamGeo.translate(0, -0.5, 0);
    this.stream = new THREE.Mesh(streamGeo, new THREE.MeshStandardMaterial({ color: '#dcefff', transparent: true, opacity: 0.0, roughness: 0.05, metalness: 0.1 }));
    this.stream.position.copy(this.dripFrom); this.stream.scale.y = 0.8; A.add(this.stream);
    // trishul to one side
    const tri = new THREE.Group(); tri.position.set(-2.2, 0.6, -11.4); A.add(tri);
    tri.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), gold)).position.y = 1.3;
    for (const x of [-0.18, 0, 0.18]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.045, x === 0 ? 0.45 : 0.32, 6), gold); p.position.set(x, 2.75 + (x === 0 ? 0.05 : 0), 0); tri.add(p); }
    const cross = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16, Math.PI), gold); cross.rotation.z = Math.PI; cross.position.y = 2.65; tri.add(cross);
    const dam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 })); dam.position.y = 2.2; dam.rotation.z = Math.PI / 2; tri.add(dam);
    // Nandi in the hall, facing the lingam
    const n = nandi(); n.position.set(0, 0, -3.25); n.scale.setScalar(0.7); this.scene.userData.nandi && this.scene.remove(this.scene.userData.nandi); A.add(n);
  }

  _ganesha(A, add) {
    add(new THREE.LatheGeometry([[0, 0], [0.85, 0], [0.85, 0.1], [0.7, 0.2], [0.65, 0.5], [0.8, 0.6], [0.8, 0.68], [0, 0.68]].map(([x, y]) => new THREE.Vector2(x, y)), 32), fine2(), 0, 0.6, -9.0);
    // self-manifest (svayambhu) form, coated in sindoor, with inlaid eyes, as in many
    // historic Ganesha shrines; a silver mukut and garland complete the shringar
    const sindoor = new THREE.MeshStandardMaterial({ map: TX.sandstone('sindoor', '#b8341d', { blocks: false, repeat: [2, 2] }), color: '#ffb6a0', roughness: 0.55, metalness: 0.05 });
    const g = new THREE.SphereGeometry(0.62, 40, 28); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const k = 1 + Math.sin(v.x * 5 + v.y * 3) * 0.035 + (v.y < 0 ? -v.y * 0.25 : 0); v.x *= k * 1.05; v.z *= k * 0.85; v.y *= 1.05; pos.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const body = add(g, sindoor, 0, 1.85, -9.0); void body;
    const head = add(new THREE.SphereGeometry(0.42, 32, 24), sindoor, 0, 2.55, -8.9); head.scale.set(1.05, 0.95, 0.9);
    const trunkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.45, -8.55), new THREE.Vector3(-0.05, 2.15, -8.42), new THREE.Vector3(-0.08, 1.9, -8.43), new THREE.Vector3(-0.2, 1.72, -8.5), new THREE.Vector3(-0.33, 1.78, -8.52)]);
    add(new THREE.TubeGeometry(trunkCurve, 24, 0.075, 12, false), sindoor, 0, 0, 0);
    add(new THREE.SphereGeometry(0.076, 12, 8), sindoor, -0.33, 1.78, -8.52);
    for (const s of [-1, 1]) {
      // inlaid eyes (silver and dark stone), set into the sindoor
      add(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: '#e9e4da', metalness: 0.8, roughness: 0.25 }), s * 0.16, 2.63, -8.56).scale.set(1.25, 0.55, 0.35);
      add(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshStandardMaterial({ color: '#150d0a', roughness: 0.1 }), s * 0.16, 2.63, -8.535);
      // broad ears suggested in relief
      const ear = add(new THREE.SphereGeometry(0.34, 20, 14), sindoor, s * 0.48, 2.5, -9.0); ear.scale.set(0.5, 1.0, 0.25); ear.rotation.y = s * 0.3;
    }
    // single tusk
    const tusk = add(new THREE.ConeGeometry(0.035, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.3 }), 0.13, 2.25, -8.5); tusk.rotation.x = 1.9;
    // silver crown
    const silver = new THREE.MeshStandardMaterial({ color: '#d9dadc', metalness: 1, roughness: 0.25 });
    add(new THREE.LatheGeometry([[0.3, 0], [0.34, 0.06], [0.3, 0.12], [0.22, 0.32], [0.15, 0.44], [0.06, 0.55], [0.08, 0.6], [0, 0.68]].map(([x, y]) => new THREE.Vector2(x, y)), 24), silver, 0, 2.86, -8.95);
    // marigold garland
    A.add(ringOf(0.55, 2.0, -8.7, 34, '#f29a17', 0.07, 0.75));
    A.add(ringOf(0.5, 1.75, -8.7, 30, '#ffffff', 0.05, 0.7));
    // modak offering
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#f1e3c4', roughness: 0.6 })); m.position.set(-0.6 + (i % 3) * 0.08, 1.33 + Math.floor(i / 3) * 0.08, -8.35 + (i % 2) * 0.05); A.add(m); }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.02, 20), brass); plate.position.set(-0.52, 1.29, -8.35); A.add(plate);
  }

  _krishna(A, add) {
    add(new THREE.LatheGeometry([[0, 0], [0.7, 0], [0.7, 0.12], [0.55, 0.22], [0.55, 0.5], [0.66, 0.6], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)), 32), fine2(), 0, 0.6, -9.0);
    // shyam (dark) stone murti draped in yellow pitambar, with crown, peacock feather, flute and
    // vaijayanti mala. Facial features are left to the shringar, as it is often seen at darshan.
    const shyam = new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.3, metalness: 0.1 });
    const pitambar = new THREE.MeshStandardMaterial({ color: '#f0b62a', roughness: 0.4, metalness: 0.2 });
    add(new THREE.LatheGeometry([[0.0, 0], [0.42, 0], [0.4, 0.2], [0.33, 0.7], [0.26, 1.0], [0.24, 1.05], [0, 1.05]].map(([x, y]) => new THREE.Vector2(x, y)), 32), pitambar, 0, 1.2, -9.0);
    add(new THREE.TorusGeometry(0.42, 0.03, 8, 32), gold, 0, 1.23, -9.0).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 24), shyam, 0, 2.5, -9.0);
    add(new THREE.SphereGeometry(0.26, 20, 12), shyam, 0, 2.78, -9.0).scale.set(1.25, 0.45, 0.9);
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12), shyam, 0, 2.92, -9.0);
    add(new THREE.SphereGeometry(0.2, 28, 20), shyam, 0, 3.12, -9.0).scale.set(0.92, 1.08, 0.95);
    // arms raised to the flute, held across to the right
    const arm = (from, to) => { const d = to.clone().sub(from); const m = add(new THREE.CylinderGeometry(0.055, 0.06, d.length(), 10), shyam, 0, 0, 0); m.position.copy(from).add(to).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
    arm(new THREE.Vector3(-0.3, 2.72, -9.0), new THREE.Vector3(-0.38, 2.4, -8.8)); arm(new THREE.Vector3(-0.38, 2.4, -8.8), new THREE.Vector3(-0.12, 3.0, -8.72));
    arm(new THREE.Vector3(0.3, 2.72, -9.0), new THREE.Vector3(0.45, 2.45, -8.85)); arm(new THREE.Vector3(0.45, 2.45, -8.85), new THREE.Vector3(0.36, 2.98, -8.72));
    const flute = add(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 10), gold, 0.28, 3.02, -8.72); flute.rotation.z = Math.PI / 2 - 0.12;
    // pitambar shawl and jewellery
    add(new THREE.TorusGeometry(0.24, 0.035, 8, 24), pitambar, 0, 2.62, -8.98).rotation.x = Math.PI / 2;
    A.add(ringOf(0.36, 2.25, -8.82, 42, '#e8442e', 0.045, 1.8)); // vaijayanti mala, long loop
    A.add(ringOf(0.3, 2.3, -8.8, 36, '#ffffff', 0.035, 1.6));
    // crown with peacock feather
    add(new THREE.LatheGeometry([[0.19, 0], [0.22, 0.05], [0.18, 0.12], [0.15, 0.3], [0.09, 0.4], [0.03, 0.46], [0, 0.48]].map(([x, y]) => new THREE.Vector2(x, y)), 24), gold, 0, 3.22, -9.0);
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.56), new THREE.MeshStandardMaterial({ map: TX.featherTexture(), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, roughness: 0.5 }));
    feather.position.set(0.12, 3.68, -9.05); feather.rotation.z = -0.35; A.add(feather);
    // flowers at the feet
    for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: ['#f29a17', '#ffffff', '#e86a8e', '#f6c025'][i % 4], roughness: 0.7 })); const a = i / 26 * Math.PI * 2; f.position.set(Math.cos(a) * 0.6, 1.24, -9.0 + Math.sin(a) * 0.6); A.add(f); }
  }

  // ---------- occupants ----------
  sync(hall, playerId) {
    const keep = new Set();
    hall.spots.forEach((o, i) => {
      if (!o || o.id === playerId) return;
      keep.add(i);
      const cur = this.occupants.get(i);
      if (cur && cur.occId === o.id) return;
      if (cur) this.scene.remove(cur.root);
      const a = new Avatar(o.config, { simulated: true, shadows: this.quality.level !== 'low' }); a.occId = o.id; a.root.position.copy(SPOTS[i]); a.root.rotation.y = Math.PI;
      a.nextAct = 3 + Math.random() * 10; a.setState(Math.random() < 0.6 ? 'namaste' : 'idle');
      this.scene.add(a.root); this.occupants.set(i, a);
    });
    for (const [i, a] of this.occupants) if (!keep.has(i)) {
      this.scene.remove(a.root); this.occupants.delete(i); if (this.simWalker === a) this.simWalker = null;
      const st = this.spotState[i]; if (st.lit && i !== this.mySpot) this._extinguish(i);
    }
    this.hall = hall; this.playerId = playerId; this.refreshMarkers();
  }
  clearOccupants() { for (const a of this.occupants.values()) this.scene.remove(a.root); this.occupants.clear(); this.simWalker = null; }

  refreshMarkers() {
    if (!this.hall) return;
    this.markers.forEach((m, i) => {
      const o = this.hall.spots[i];
      const mine = o && o.id === this.playerId;
      const col = mine ? '#ff9b3d' : o ? '#ffffff' : (i === this.hover ? '#fff1b8' : '#ffcf70');
      m.material.color.set(col);
      m.userData.base = mine ? 0.95 : o ? 0.12 : (i === this.hover ? 1.0 : 0.75);
      m.visible = this.selecting || mine || !o;
      if (!this.selecting && !mine) m.userData.base *= 0.35;
    });
  }

  // ---------- actions ----------
  // the devotees near you turn to you, return your namaste with a bow, and turn back to the deity
  greetFrom(me) {
    let best = null, bd = 3.4;
    for (const [, a] of this.occupants) { if (a.walkPts || a.greet) continue; const d = a.root.position.distanceTo(me.root.position); if (d < bd) { bd = d; best = a; } }
    if (best) best.greet = { at: (this._t || 0) + 0.3, target: me.root.position };
    return best;
  }

  // a simulated devotee leaves their place for a moment, and comes back
  _simErrand(i, a, kind) {
    const r = hallRoute(kind, i), home = SPOTS[i].clone(), V = THREE.Vector3; this.simWalker = a;
    const faceTo = (p) => { a.root.rotation.y = Math.atan2(p.x - a.root.position.x, p.z - a.root.position.z); };
    const back = () => { if (!this.occupants.has(i)) { this.simWalker = null; return; } a.walkPts = [...r.out].reverse().map((v) => v.clone()).concat([home]); a.walkDone = () => { this.simWalker = null; a.root.rotation.y = Math.PI; a.setState('namaste'); a.nextAct = 8 + Math.random() * 10; }; };
    a.walkPts = r.out.map((v) => v.clone());
    a.walkDone = () => {
      faceTo(r.face);
      if (kind === 'bell') { a.setState('ring'); setTimeout(() => this.bells[r.bell].strike(0.9), 420); setTimeout(back, 1700); }
      else if (kind === 'flowers') { a.setState('offer'); setTimeout(() => this.petals.throw(a.chestWorld().add(new V(0, 0.05, -0.2)), this.thaliTop, 16), 450); setTimeout(back, 1900); }
      else { a.walkPts = r.ring.map((v) => v.clone()); a.walkDone = () => { faceTo(r.face); a.setState('namaste'); setTimeout(back, 1300); }; }
    };
  }

  ringBell(avatar) {
    if (avatar) { avatar.setState('ring'); setTimeout(() => avatar.state === 'ring' && avatar.setState('namaste'), 1600); }
    const p = avatar ? avatar.root.position : null; (p && p.x > 0 ? this.bells[1] : this.bells[0]).strike(1.1);
  }
  lightDiya(i, { sound = true } = {}) {
    const st = this.spotState[i]; if (st.lit) return false;
    st.lit = true; st.flame = this.flames.add(this.stands[i].flamePos, 0.0); st.grow = 0;
    if (i === this.mySpot) { const L = new THREE.PointLight('#ffab55', 0, 3.2, 1.6); L.position.copy(this.stands[i].flamePos).add(new THREE.Vector3(0, 0.12, 0)); this.scene.add(L); st.light = L; }
    if (sound) this.audio.ignite(this.stands[i].flamePos);
    return true;
  }
  _extinguish(i) { const st = this.spotState[i]; if (st.flame >= 0) this.flames.set(st.flame, new THREE.Vector3(0, -50, 0), 0); st.lit = false; st.flame = -1; if (st.light) { this.scene.remove(st.light); st.light = null; } }
  offerFlowers(avatar) {
    if (avatar) { avatar.setState('offer'); setTimeout(() => avatar.state === 'offer' && avatar.setState('namaste'), 1700); }
    const from = avatar ? avatar.chestWorld().add(new THREE.Vector3(0, 0.05, -0.25)) : new THREE.Vector3(0, 1.3, -3);
    setTimeout(() => { this.petals.throw(from, this.thaliTop, 26); this.audio.shimmer(this.thaliTop); }, 450);
  }
  offerIncense(i) {
    const st = this.spotState[i], s = this.stands[i];
    s.stick.visible = true; s.ember.visible = true;
    if (st.incense) st.incense.age = 0; else st.incense = this.smoke.addEmitter(s.tip, { rate: 11, life: 75 });
    st.incenseUntil = performance.now() + 75000;
    this.audio.ignite(s.tip);
  }
  abhishek() {
    if (!this.stream) return;
    this.pour = 4.2; this.audio.water(this.dripFrom);
  }

  pickMarker(ray) { const hits = ray.intersectObjects(this.markers.filter(m => m.visible), false); return hits.length ? hits[0].object.userData.spot : -1; }
  pickBell(ray) { return this.bells.some((b) => ray.intersectObject(b.group, true).length > 0); }

  // ---------- aarti ----------
  startAarti(duration = 60) {
    this.aarti = { t: 0, dur: duration, bellRung: false };
    this.aartiLamp.visible = true;
    this.priest.setState('aartiPriest');
  }
  stopAarti() {
    this.aarti = null; this.aartiLamp.visible = false; this.priest.setState('idle'); this.aartiLight.intensity = 0;
    this.aartiFlames.forEach(f => this.flames.set(f, new THREE.Vector3(0, -50, 0)));
  }

  cameraFor(mode, t, player) {
    if (mode === 'select') return { pos: new THREE.Vector3(0, 4.6, 9.7), target: new THREE.Vector3(0, 0.6, -1.8), fov: 60 };
    const V = THREE.Vector3;
    // close on your own lamp stand: your hands, the wick catching, the incense
    if (mode === 'diya') { const sd = player.x <= 0 ? 1 : -1; return { pos: new V(player.x + sd * 0.85, 1.0, player.z - 2.3), target: new V(player.x, 0.55, player.z - 0.75), fov: 40 }; }
    if (mode === 'abhishek') return { pos: new V(0.7, 2.4, -5.3), target: new V(0, 1.85, -8.9), fov: 40 };
    // walking to the bell or the steps: keep both you and what you are going to in frame, from the side and a little above
    const framing = (F) => {
      const P = player.clone().setY(player.y + 0.7), mid = P.clone().add(F).multiplyScalar(0.5), dx = F.x - P.x, dz = F.z - P.z, d = Math.hypot(dx, dz) || 1;
      let nx = -dz / d, nz = dx / d; if (nz < 0) { nx = -nx; nz = -nz; }
      const back = 2.3 + d * 0.5; return { pos: new V(mid.x + nx * back, mid.y + 1.2 + d * 0.12, mid.z + nz * back), target: mid, fov: 52 };
    };
    if (mode === 'errand') return framing(this.errandFocus || new V(0, 0.8, -5.6));
    // walking round the deity: from the far side of the chamber, high, looking down past the lingam at you
    if (mode === 'pradakshina') {
      if (player.z > HALL.BACK - 0.2) return framing(new V(0, 1.3, HALL.AIM.z));
      const a = Math.atan2(player.z - HALL.AIM.z, player.x) + Math.PI - 0.6;
      return { pos: new V(Math.cos(a) * 1.6, 3.9, HALL.AIM.z + Math.sin(a) * 1.6), target: player.clone().add(new V(0, 0.75, 0)), fov: 64 };
    }
    if (mode === 'walk') { const pos = player.clone().add(new THREE.Vector3(0, 3.2, 4.8)); pos.z = Math.min(pos.z, HALL.FRONT - 0.7); pos.y = Math.min(pos.y, 4.5); return { pos, target: player.clone().add(new THREE.Vector3(0, 0.8, -3)), fov: 50 }; }
    if (mode === 'aarti') { const a = Math.sin(t * 0.06) * 0.5; return { pos: new THREE.Vector3(Math.sin(a) * 9, 4.4 + Math.sin(t * 0.09) * 0.4, 9.0 + Math.cos(a) * 0.6), target: new THREE.Vector3(0, 1.4, -4.2), fov: 50 }; }
    if (mode === 'darshan') return { pos: new THREE.Vector3(0, 1.75, -4.4), target: ALTAR_FOCUS.clone(), fov: 38 };
    // prayer: over the devotee's shoulder, framing the sanctum, with your devotee in the lower corner
    const side = player.x >= 0 ? 1.0 : -1.0;
    return { pos: player.clone().add(new THREE.Vector3(side, 1.85, 3.0)), target: new THREE.Vector3(player.x * 0.2 + side * 0.5, 1.7, -8.4), fov: 44 };
  }

  update(dt, t, ctx) {
    this._t = t;
    this.flames.update(t);
    this.smoke.enabled = ctx.incense; this.smoke.density = this.quality.level === 'low' ? 0.5 : 1;
    this.smoke.update(dt, t); this.petals.update(dt);
    this.dust.material.uniforms.uTime.value = t; this.dust.visible = !ctx.reducedMotion || true;
    if (this.glow.streakMat) this.glow.streakMat.uniforms.uTime.value = t;
    for (let i = 0; i < this.towers.length; i++) this.towers[i].intensity = (i < 2 ? 18 : 10) * (0.93 + Math.sin(t * 8.3 + i * 2.1) * 0.04 + Math.sin(t * 13.7 + i) * 0.03);
    for (const b of this.bells) b.update(dt, t);
    // markers pulse softly
    const pulse = ctx.reducedMotion ? 1 : 0.85 + Math.sin(t * 2.2) * 0.15;
    this.markers.forEach(m => { m.material.opacity = (m.userData.base ?? 0.7) * pulse; });
    // personal diyas: flame grows when lit; incense burns out
    this.spotState.forEach((st, i) => {
      if (st.lit && st.flame >= 0) { st.grow = Math.min(1, (st.grow || 0) + dt * 1.6); this.flames.set(st.flame, null, 0.32 * st.grow); if (st.light) st.light.intensity = 1.6 * st.grow * (0.9 + Math.sin(t * 11 + i) * 0.06 + Math.sin(t * 17.3) * 0.04); }
      if (st.incense && performance.now() > st.incenseUntil) { st.incense = null; this.stands[i].ember.visible = false; this.stands[i].stick.visible = false; }
    });
    this.lampLight.intensity = 3 + Math.sin(t * 9) * 0.25 + Math.sin(t * 14.1) * 0.15;
    // abhishek stream
    if (this.stream) { const on = this.pour > 0; if (on) this.pour -= dt; const o = this.stream.material.opacity; this.stream.material.opacity = o + ((on ? 0.55 : 0) - o) * Math.min(1, dt * 4); this.stream.scale.y = 0.62 + Math.sin(t * 20) * 0.01; }
    // simulated occupants: quiet, occasional devotion
    for (const [i, a] of this.occupants) {
      a.nextAct -= dt;
      if (!this.aarti && a.nextAct <= 0) {
        a.nextAct = 9 + Math.random() * 16; const r = Math.random();
        if (r < 0.35) a.setState('bow'); else if (r < 0.55 && !this.spotState[i].lit) { a.setState('offer'); setTimeout(() => this.lightDiya(i, { sound: false }), 900); }
        else if (r < 0.62 && ctx.incense) { a.setState('offer'); this.offerIncense(i); }
        else if (r < 0.72 && !this.simWalker && !this.playerErrand) this._simErrand(i, a, r < 0.66 ? 'bell' : r < 0.69 ? 'flowers' : 'pradakshina');
        else a.setState(Math.random() < 0.5 ? 'namaste' : 'idle');
      }
      if (a.greet) {
        const G = a.greet;
        if (!G.done) { if (greetStep(a, dt, t)) G.done = true; }
        else { a.root.rotation.y = lerpA(a.root.rotation.y, Math.PI, 1 - Math.exp(-dt * 6)); if (Math.abs(Math.atan2(Math.sin(a.root.rotation.y - Math.PI), Math.cos(a.root.rotation.y - Math.PI))) < 0.04) { a.root.rotation.y = Math.PI; a.greet = null; } }   // and back to the deity
        a.update(dt, t); continue;
      }
      if (a.walkPts && a.walkPts.length) {
        const P = a.root.position, T = a.walkPts[0], dx = T.x - P.x, dz = T.z - P.z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) { a.walkPts.shift(); if (!a.walkPts.length) { a.walkPts = null; const f = a.walkDone; a.walkDone = null; f && f(); } }
        else { const st = Math.min(dist, 1.3 * dt); P.x += dx / dist * st; P.z += dz / dist * st; a.speed = 1.3; if (a.state !== 'walk') a.setState('walk'); a.root.rotation.y = lerpA(a.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10)); }
        a.root.position.y += (hallFloor(a.root.position.x, a.root.position.z) - a.root.position.y) * (1 - Math.exp(-dt * 14));
      }
      if (a.state === 'bow' && a.stateTime > 2.5) a.setState('namaste');
      if (a.state === 'offer' && a.stateTime > 1.8) a.setState('namaste');
      if (a.state === 'ring' && a.stateTime > 1.6 && !a.walkPts) a.setState('namaste');
      a.update(dt, t);
    }
    // aarti choreography
    if (this.aarti) {
      const A = this.aarti; A.t += dt; const k = A.t;
      const warm = smooth(2, 10, k) * (1 - smooth(A.dur - 6, A.dur, k));
      this.hemi.intensity = this.ambientBase * (1 - 0.45 * warm); this.sun.intensity = this.sunBase * (1 - 0.6 * warm);
      this.sanct.intensity = this.sanctBase + 10 * warm; this.sanct.color.set('#ffa255').lerp(new THREE.Color('#ff9a3c'), warm);
      this.fill.intensity = this.fillBase + 22 * warm;
      const active = k > 10 && k < A.dur - 9;
      const lampOn = smooth(9, 11, k) * (1 - smooth(A.dur - 9, A.dur - 7, k));
      this.priest.lampAngle = (this.priest.lampAngle || 0) + dt * (active ? 2.3 : 0.4);
      // the lamp rides just above the priest's joined hands, which circle before the deity
      const ang = this.priest.lampAngle, lp = this.priest.handWorld(1).add(this.priest.handWorld(-1)).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.1, 0));
      this.aartiLamp.position.copy(lp); this.aartiLamp.rotation.set(0.12, 0, 0);
      this.aartiFlames.forEach((f, i) => { const a2 = i / 5 * Math.PI * 2; this.flames.set(f, lp.clone().add(new THREE.Vector3(Math.cos(a2) * 0.065, 0.04, Math.sin(a2) * 0.065)), 0.26 * lampOn); });
      this.aartiLight.position.copy(lp); this.aartiLight.intensity = 4.5 * lampOn;
      // devotees follow the ceremony together
      const all = [...this.occupants.values()]; if (ctx.player) all.push(ctx.player);
      for (const a of all) {
        if (k < A.dur - 6) { if (a.state !== 'aarti' && a.state !== 'ring' && a.state !== 'offer' && k > 4) a.setState('aarti'); }
        else if (a.state !== 'bow') a.setState('bow');
      }
      if (!A.bellRung && k > A.dur - 7) { A.bellRung = true; this.bell.strike(0.25); }
      if (k >= A.dur) { this.stopAarti(); for (const a of all) a.setState('namaste'); this.hemi.intensity = this.ambientBase; this.sun.intensity = this.sunBase; this.onAartiEnd && this.onAartiEnd(); }
    }
    this.priest.update(dt, t);
  }
}

function lerpA(a, b, t) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function fine2() { return carvedStone(); }
function ringOf(r, y, z, n, color, size = 0.05, drop = 0) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 7, 5), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const x = Math.cos(a) * r; const front = Math.sin(a); const yy = y - (front > 0 ? front * drop : 0); m.makeTranslation(x, yy, z + Math.sin(a) * r * 0.6); im.setMatrixAt(i, m); }
  return im;
}
function nandi() {
  const m = darkStone, grp = new THREE.Group();
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; grp.add(o); return o; };
  add(new THREE.BoxGeometry(1.4, 0.25, 2.0), 0, 0.125, 0, 1, 1, 1, carvedStone());
  add(new THREE.SphereGeometry(0.5, 20, 14), 0, 0.68, 0, 0.95, 0.78, 1.55);
  add(new THREE.SphereGeometry(0.28, 14, 10), 0, 1.06, -0.38, 1.0, 0.9, 1.0);
  add(new THREE.SphereGeometry(0.24, 14, 10), 0, 1.08, -0.92, 0.85, 1.0, 1.25).rotation.x = 0.4;
  add(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 10), 0, 0.92, -1.12).rotation.x = 1.2;
  for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.045, 0.24, 8), s * 0.13, 1.31, -0.86); h.rotation.z = -s * 0.5; add(new THREE.SphereGeometry(0.07, 8, 6), s * 0.2, 1.14, -0.82, 1.4, 0.6, 0.5); }
  for (const [x, z] of [[-0.32, -0.5], [0.32, -0.5], [-0.3, 0.55], [0.3, 0.55]]) add(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 8), x, 0.36, z).rotation.x = Math.PI / 2;
  const g2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 8, 22), new THREE.MeshStandardMaterial({ color: '#f29a17', roughness: 0.9 })); g2.position.set(0, 0.92, -0.72); g2.rotation.x = 1.1; grp.add(g2);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: '#a3242a', roughness: 0.8 })); cloth.position.set(0, 1.06, 0.15); grp.add(cloth);
  return grp;
}
