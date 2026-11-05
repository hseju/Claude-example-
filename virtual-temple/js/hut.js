import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { brass, kalasha, garland, stoneMat, bandMat } from './architecture.js';
import { SmokeSystem } from './fx.js';
import { normalFromCanvas } from './flora.js';

// Dhyana Kutir: an open, octagonal thatched meditation hut in the south-west garden.
// Local frame: origin at the centre of the plinth on the ground, +z points out of the door toward the courtyard.
export const HUT = {
  id: 'hut', name: 'Meditation hut', short: 'Meditation', sanskrit: 'Dhyana Kutir',
  pos: new THREE.Vector3(-25, 0, 25), rot: Math.atan2(25, -25),   // the door faces the courtyard (and the falls beyond it)
  blurb: 'Breathwork and short guided meditations',
};
const FLOOR = 0.52, R_PLINTH = 3.9, R_PILLAR = 3.32, EAVE = 3.1, R_EAVE = 4.75, APEX = 5.9;
const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), HUT.rot).add(HUT.pos);
HUT.entrance = toWorld(0, 0, 5.2);                 // where you stand to go in
HUT.labelPos = toWorld(0, APEX + 0.9, 0);
// places to sit: you take the middle cushion at the back, facing out through the door
HUT.seat = { pos: toWorld(0, FLOOR, -1.45), rotY: HUT.rot };
HUT.sitters = [{ pos: toWorld(1.4, FLOOR, -1.0), rotY: HUT.rot - 0.32 }, { pos: toWorld(-1.4, FLOOR, -1.0), rotY: HUT.rot + 0.32 }];
// camera spots in local coordinates: over the shoulder toward the view, the face, and the diya
HUT.views = {
  vista: { pos: [0.55, 1.45, -3.05], look: [-0.15, 0.95, 3.2] },
  face: { pos: [0.5, 1.62, 0.7], look: [0, 1.78, -1.45] },   // framed low, so the breathing light sits above the head
  flame: { pos: [0.04, 1.4, -1.15], look: [0, 0.95, 0.05] },   // your own view of the lamp, from the cushion
};
HUT.toWorld = toWorld;

// ---------------------------------------------------------------- canvas textures
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const nrm = (c, strength, repeat) => { const t = normalFromCanvas(c, strength); t.repeat.set(...repeat); t.anisotropy = 4; return t; };
function texOf(c, repeat = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function thatchCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rnd(7);
  g.fillStyle = '#9c7a45'; g.fillRect(0, 0, 512, 512);
  // overlapping courses of straw, each a band of fine strands
  for (let row = 0; row < 9; row++) {
    const y0 = row * 58 - 10;
    for (let i = 0; i < 900; i++) {
      const x = r() * 512, y = y0 + r() * 60, len = 20 + r() * 50, tone = 120 + r() * 90;
      g.strokeStyle = `rgba(${tone + 40},${tone + 10},${tone * 0.55},${0.35 + r() * 0.4})`; g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + len); g.stroke();
    }
    const sh = g.createLinearGradient(0, y0 + 40, 0, y0 + 62); sh.addColorStop(0, 'rgba(40,25,10,0)'); sh.addColorStop(1, 'rgba(40,25,10,0.35)');
    g.fillStyle = sh; g.fillRect(0, y0 + 40, 512, 22);
  }
  return c;
}
function planksCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rnd(11);
  for (let i = 0; i < 8; i++) {
    const tone = 0.85 + r() * 0.25; g.fillStyle = `rgb(${Math.floor(122 * tone)},${Math.floor(82 * tone)},${Math.floor(50 * tone)})`; g.fillRect(i * 64, 0, 64, 512);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,35,18,${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r(); const x = i * 64 + r() * 64; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, 170, x + (r() - 0.5) * 10, 340, x + (r() - 0.5) * 6, 512); g.stroke(); }
    g.fillStyle = 'rgba(30,18,8,0.55)'; g.fillRect(i * 64, 0, 2, 512);
    const joint = r() * 512; g.fillRect(i * 64, joint, 64, 2);
  }
  return c;
}
function durrieCanvas() {
  // a round cotton durrie: indigo, madder red and saffron rings with a lotus border
  const c = cv(1024), g = c.getContext('2d'), m = 512;
  const rings = [[500, '#2b3a6b'], [470, '#e8dcc0'], [455, '#b23a26'], [420, '#e8dcc0'], [405, '#2b3a6b'], [300, '#d99a2b'], [285, '#e8dcc0'], [270, '#2b3a6b'], [150, '#b23a26'], [135, '#e8dcc0'], [120, '#d99a2b']];
  for (const [rad, col] of rings) { g.fillStyle = col; g.beginPath(); g.arc(m, m, rad, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e8dcc0';
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.save(); g.translate(m + Math.cos(a) * 437, m + Math.sin(a) * 437); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  g.fillStyle = '#e8dcc0';
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.save(); g.translate(m + Math.cos(a) * 210, m + Math.sin(a) * 210); g.rotate(a + Math.PI / 2); g.beginPath(); g.moveTo(0, -42); g.quadraticCurveTo(26, 0, 0, 42); g.quadraticCurveTo(-26, 0, 0, -42); g.fill(); g.restore(); }
  // weave texture
  g.globalAlpha = 0.08; for (let y = 0; y < 1024; y += 4) { g.fillStyle = y % 8 ? '#000' : '#fff'; g.fillRect(0, y, 1024, 2); } g.globalAlpha = 1;
  return c;
}
function omCanvas() {
  const c = cv(512), g = c.getContext('2d');
  const bg = g.createRadialGradient(256, 256, 40, 256, 256, 300); bg.addColorStop(0, '#7a2c18'); bg.addColorStop(1, '#4a170c');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#e0b04f'; g.lineWidth = 10; g.strokeRect(22, 22, 468, 468); g.lineWidth = 3; g.strokeRect(44, 44, 424, 424);
  g.fillStyle = '#f3c968'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '300px "Tiro Devanagari Sanskrit", "Noto Sans Devanagari", "Mukta", serif'; g.fillText('ॐ', 256, 282);
  return c;
}
function fabricCanvas(base, accent) {
  const c = cv(128), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.18; for (let y = 0; y < 128; y += 3) { g.fillStyle = y % 6 ? '#000' : '#fff'; g.fillRect(0, y, 128, 1); } g.globalAlpha = 1;
  g.strokeStyle = accent; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 18); g.lineTo(128, 18); g.moveTo(0, 110); g.lineTo(128, 110); g.stroke();
  return c;
}

// ---------------------------------------------------------------- the building
export function buildHut(world) {
  const S = world.scene, g = new THREE.Group(); g.position.copy(HUT.pos); g.rotation.y = HUT.rot; S.add(g);
  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  const teak = new THREE.MeshStandardMaterial({ color: '#7a4a28', roughness: 0.62 });
  const darkTeak = new THREE.MeshStandardMaterial({ color: '#4e2d17', roughness: 0.7 });
  const plankC = planksCanvas(), plank = new THREE.MeshStandardMaterial({ map: texOf(plankC, [3, 3]), normalMap: nrm(plankC, 1.4, [3, 3]), roughness: 0.7 });
  const thatchC = thatchCanvas(), thatch = new THREE.MeshStandardMaterial({ map: texOf(thatchC, [5, 2]), normalMap: nrm(thatchC, 3, [5, 2]), roughness: 0.95, side: THREE.FrontSide });
  const stone = stoneMat('#cdb08a', [6, 0.5], { rows: 2 });
  const oct = (r) => [...Array(8)].map((_, i) => { const a = i / 8 * Math.PI * 2 + Math.PI / 8; return new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r); });

  // plinth with a carved band, wooden floor and steps up to the door
  const plinth = new THREE.CylinderGeometry(R_PLINTH, R_PLINTH + 0.15, FLOOR, 8); plinth.rotateY(Math.PI / 8); add(plinth, stone, 0, FLOOR / 2);
  const band = new THREE.CylinderGeometry(R_PLINTH + 0.03, R_PLINTH + 0.03, 0.14, 8, 1, true); band.rotateY(Math.PI / 8); add(band, bandMat('#cdb08a'), 0, FLOOR - 0.16, 0, false);
  const floor = new THREE.CircleGeometry(R_PLINTH - 0.12, 8); floor.rotateX(-Math.PI / 2); floor.rotateY(Math.PI / 8); add(floor, plank, 0, FLOOR + 0.004, 0, false);
  const apothem = R_PLINTH * Math.cos(Math.PI / 8);
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(2.2 - i * 0.12, FLOOR * (3 - i) / 3, 0.34), stone, 0, FLOOR * (3 - i) / 6, apothem + 0.17 + (2 - i) * 0.32);

  // eight turned teak pillars on stone bases, a ring beam and corner brackets
  const pillarProf = [[0.15, 0], [0.15, 0.1], [0.11, 0.14], [0.1, 0.4], [0.115, 0.46], [0.095, 0.5], [0.085, 2.0], [0.1, 2.08], [0.085, 2.14], [0.13, 2.28], [0.15, 2.4], [0.15, EAVE - FLOOR]];
  const pillarGeo = new THREE.LatheGeometry(pillarProf.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  const corners = oct(R_PILLAR);
  for (const c of corners) {
    add(pillarGeo, teak, c.x, FLOOR, c.z);
    add(new THREE.BoxGeometry(0.34, 0.12, 0.34), stone, c.x, FLOOR + 0.06, c.z);
  }
  for (let i = 0; i < 8; i++) {
    const a = corners[i], b = corners[(i + 1) % 8], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    const beam = add(new THREE.BoxGeometry(len + 0.2, 0.2, 0.18), darkTeak, mid.x, EAVE - 0.02, mid.z); beam.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
    // carved bracket under the beam at each pillar
    for (const [p, q] of [[a, b], [b, a]]) {
      const d = q.clone().sub(p).normalize(), br = add(new THREE.BoxGeometry(0.08, 0.36, 0.38), teak, p.x + d.x * 0.24, EAVE - 0.26, p.z + d.z * 0.24);
      br.rotation.y = Math.atan2(d.x, d.z); br.rotation.x = 0.55;
    }
  }

  // thatched roof: eight-sided cone with a thick, slightly ragged eave, rafters inside and a brass kalash
  const roofH = APEX - EAVE;
  const roof = new THREE.ConeGeometry(R_EAVE, roofH, 8, 8, true); roof.rotateY(Math.PI / 8);
  { const p = roof.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = (y / roofH + 0.5); const sag = Math.sin(k * Math.PI) * 0.12; const x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z); if (rr > 1e-3) { p.setX(i, x * (1 - sag / Math.max(rr, 0.3) * 0.5)); p.setZ(i, z * (1 - sag / Math.max(rr, 0.3) * 0.5)); } } roof.computeVertexNormals(); }
  add(roof, thatch, 0, EAVE + roofH / 2 + 0.04);
  const underside = new THREE.ConeGeometry(R_EAVE - 0.06, roofH - 0.12, 8, 1, true); underside.rotateY(Math.PI / 8);
  const ceil = new THREE.MeshStandardMaterial({ color: '#6b4c2c', roughness: 0.9, side: THREE.BackSide }); add(underside, ceil, 0, EAVE + (roofH - 0.12) / 2 - 0.02, 0, false);
  const fringe = new THREE.CylinderGeometry(R_EAVE + 0.04, R_EAVE + 0.12, 0.26, 8, 1, true); fringe.rotateY(Math.PI / 8);
  { const p = fringe.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - Math.random() * 0.06); }
  add(fringe, new THREE.MeshStandardMaterial({ map: texOf(thatchC, [14, 0.4]), roughness: 1, side: THREE.DoubleSide }), 0, EAVE + 0.02);
  for (const c of oct(R_EAVE - 0.1)) {
    const top = new THREE.Vector3(0, APEX - 0.15, 0), bot = new THREE.Vector3(c.x, EAVE + 0.06, c.z), len = top.distanceTo(bot);
    const raf = add(new THREE.CylinderGeometry(0.045, 0.055, len, 6), darkTeak, (top.x + bot.x) / 2, (top.y + bot.y) / 2, (top.z + bot.z) / 2, false);
    raf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
  }
  const k = kalasha(0.55, brass); k.position.set(0, APEX - 0.05, 0); g.add(k);

  // low teak railings on the side and back bays; the front three bays stay open to the view
  for (let i = 0; i < 8; i++) {
    const faceAngle = i / 8 * Math.PI * 2; // face 0 looks out of the door (+z)
    if (i === 0 || i === 1 || i === 7) continue;
    const a = corners[(i + 7) % 8], b = corners[i], len = a.distanceTo(b) - 0.24, mid = a.clone().add(b).multiplyScalar(0.5), rot = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
    const rail = new THREE.Group(); rail.position.set(mid.x, FLOOR, mid.z); rail.rotation.y = rot; g.add(rail);
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.12), teak); top.position.y = 0.62; top.castShadow = true; rail.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.09), darkTeak); bot.position.y = 0.08; rail.add(bot);
    const n = 9; for (let j = 0; j < n; j++) { const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), teak); b2.position.set(-len / 2 + (j + 0.5) / n * len, 0.35, 0); rail.add(b2); }
    if (i === 4) {   // behind the altar: a carved wooden screen
      const scr = new THREE.Mesh(new THREE.BoxGeometry(len, 1.25, 0.05), new THREE.MeshStandardMaterial({ map: jaliTexture(), color: '#8a5530', roughness: 0.7, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
      scr.position.y = 1.32; rail.add(scr);
    }
    void faceAngle;
  }
  // rolled bamboo blinds tied under the beam of every bay
  const bamboo = new THREE.MeshStandardMaterial({ color: '#b39257', roughness: 0.8 });
  for (let i = 0; i < 8; i++) {
    const a = corners[(i + 7) % 8], b = corners[i], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b) - 0.3;
    const roll = add(new THREE.CylinderGeometry(0.075, 0.075, len, 10), bamboo, mid.x * 0.97, EAVE - 0.24, mid.z * 0.97, false); roll.rotation.z = Math.PI / 2; roll.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
  }

  // inside: a round durrie, five cushions, a brass lamp in the middle, a singing bowl and a small altar
  const mat = new THREE.CircleGeometry(2.25, 48); mat.rotateX(-Math.PI / 2); add(mat, new THREE.MeshStandardMaterial({ map: texOf(durrieCanvas()), roughness: 0.95 }), 0, FLOOR + 0.012, -0.55, false);
  const cushionGeo = new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.27, 0.03], [0.285, 0.07], [0.27, 0.11], [0.22, 0.135], [0, 0.14]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const cushions = [['#c2541f', '#e0b04f', 0, -1.45], ['#7c2a3a', '#e0b04f', 1.4, -1.0], ['#7c2a3a', '#e0b04f', -1.4, -1.0], ['#2f5a5a', '#d9a548', 1.05, 0.55], ['#2f5a5a', '#d9a548', -1.05, 0.55]];
  for (const [base, acc, x, z] of cushions) add(cushionGeo, new THREE.MeshStandardMaterial({ map: texOf(fabricCanvas(base, acc)), roughness: 0.9 }), x, FLOOR + 0.012, z);
  // brass lamp on a low stand
  const stand = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.03], [0.06, 0.06], [0.035, 0.12], [0.03, 0.3], [0.05, 0.33], [0.12, 0.36], [0.13, 0.38], [0, 0.38]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  add(stand, brass, 0, FLOOR, 0.05);
  // singing bowl with its striker on a small ring cushion
  add(new THREE.TorusGeometry(0.1, 0.035, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a2a2a', roughness: 0.9 }), 0.55, FLOOR + 0.04, -1.2, false);
  const bowl = new THREE.LatheGeometry([[0.0, 0.0], [0.07, 0.0], [0.115, 0.03], [0.135, 0.075], [0.13, 0.1], [0.125, 0.1], [0.128, 0.075], [0.11, 0.035], [0.065, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  add(bowl, new THREE.MeshStandardMaterial({ color: '#b98a3c', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }), 0.55, FLOOR + 0.07, -1.2);
  const striker = add(new THREE.CylinderGeometry(0.014, 0.016, 0.22, 8), teak, 0.75, FLOOR + 0.03, -1.1); striker.rotation.z = Math.PI / 2; striker.rotation.y = 0.5;
  // the altar: a low teak table with an Om panel, two lamps, a bowl of marigolds and incense
  add(new THREE.BoxGeometry(1.5, 0.08, 0.55), teak, 0, FLOOR + 0.42, -2.75);
  for (const [x, z] of [[-0.68, -2.52], [0.68, -2.52], [-0.68, -2.98], [0.68, -2.98]]) add(new THREE.BoxGeometry(0.07, 0.42, 0.07), darkTeak, x, FLOOR + 0.21, z);
  const om = add(new THREE.BoxGeometry(0.62, 0.62, 0.05), new THREE.MeshStandardMaterial({ map: texOf(omCanvas()), roughness: 0.6, emissive: '#3a1406', emissiveIntensity: 0.25 }), 0, FLOOR + 0.8, -2.92);
  om.rotation.x = -0.12;
  const flowers = new THREE.Group(); flowers.position.set(0.42, FLOOR + 0.46, -2.7); g.add(flowers);
  flowers.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 16), brass));
  for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), new THREE.MeshStandardMaterial({ color: i % 3 ? '#f29a17' : '#f6c025', roughness: 0.9 })); const a = i * 2.4; f.position.set(Math.cos(a) * 0.07 * Math.sqrt(i / 14), 0.05, Math.sin(a) * 0.07 * Math.sqrt(i / 14)); flowers.add(f); }
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), brass, -0.42, FLOOR + 0.485, -2.7);
  const stick = add(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4), new THREE.MeshStandardMaterial({ color: '#4a2a16' }), -0.42, FLOOR + 0.62, -2.7, false); stick.rotation.z = 0.12;

  // flames: the centre lamp, the two altar lamps, and two hanging lanterns at the door
  world._diyaLocal(g, new THREE.Vector3(0, FLOOR + 0.39, 0.05), 0.5);
  world._diyaLocal(g, new THREE.Vector3(-0.25, FLOOR + 0.47, -2.62), 0.36);
  world._diyaLocal(g, new THREE.Vector3(0.22, FLOOR + 0.47, -2.62), 0.36);
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#a8782f', metalness: 0.85, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9a3c', emissiveIntensity: 1.6, transparent: true, opacity: 0.85 });
  const doorPillars = [corners[7], corners[0]];
  g.updateMatrixWorld(true);
  for (const c of doorPillars) {
    const p = c.clone().multiplyScalar(0.9); p.y = EAVE - 0.75;
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), lanternMat, p.x, p.y + 0.42, p.z, false);
    add(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 8, 1, true), glassMat, p.x, p.y, p.z, false);
    add(new THREE.ConeGeometry(0.11, 0.1, 8), lanternMat, p.x, p.y + 0.15, p.z, false);
    add(new THREE.CylinderGeometry(0.1, 0.08, 0.03, 8), lanternMat, p.x, p.y - 0.11, p.z, false);
    world.flames.add(new THREE.Vector3(p.x, p.y - 0.04, p.z).applyMatrix4(g.matrixWorld), 0.32);
  }
  // marigold garland across the doorway, mango-leaf toran above it
  const ga = corners[7].clone().setY(EAVE - 0.3), gb = corners[0].clone().setY(EAVE - 0.3);
  const gar = garland(ga.clone().applyMatrix4(g.matrixWorld), gb.clone().applyMatrix4(g.matrixWorld), 0.35, 30); S.add(gar);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7a2a', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) { const k2 = (i + 0.5) / 11, p = ga.clone().lerp(gb, k2); const leaf = add(new THREE.PlaneGeometry(0.07, 0.22), leafMat, p.x * 0.995, p.y - 0.07, p.z * 0.995, false); leaf.rotation.y = Math.atan2(gb.x - ga.x, gb.z - ga.z) - Math.PI / 2; }

  // wind chime under the front eave: five brass tubes that sway with the breeze
  const chime = new THREE.Group(); chime.position.set(0, EAVE - 0.12, R_PILLAR * Math.cos(Math.PI / 8) + 0.35); g.add(chime);
  chime.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 14), teak));
  const tubes = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, L = 0.22 + i * 0.05; const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * 0.07, -0.04, Math.sin(a) * 0.07); chime.add(pivot);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, L, 8), brass); t.position.y = -0.1 - L / 2; pivot.add(t); tubes.push({ pivot, ph: i * 1.7 }); }
  const sail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.005), teak); sail.position.y = -0.48; chime.add(sail);

  // a tulsi in a clay pot beside the steps, and stepping stones toward the garden walk
  const pot = add(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.22, 0.2], [0.2, 0.34], [0.23, 0.38], [0.2, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)), 16), new THREE.MeshStandardMaterial({ color: '#a4532c', roughness: 0.85 }), 1.55, 0, apothem + 0.55);
  void pot;
  const tulsi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshStandardMaterial({ color: '#4f7f34', roughness: 0.85 }), 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, r = 0.16 * Math.sqrt(i / 60); m4.makeScale(1, 0.7, 1).setPosition(1.55 + Math.cos(a) * r, 0.45 + (i / 60) * 0.32 + Math.random() * 0.06, apothem + 0.55 + Math.sin(a) * r); tulsi.setMatrixAt(i, m4); }
  tulsi.castShadow = true; g.add(tulsi);
  const stoneM = new THREE.MeshStandardMaterial({ color: '#a59781', roughness: 0.9 });
  for (let i = 0; i < 7; i++) { const st = add(new THREE.CylinderGeometry(0.34 + Math.random() * 0.08, 0.38, 0.06, 9), stoneM, Math.sin(i * 0.9) * 0.25, 0.03, apothem + 1.55 + i * 0.85, false); st.rotation.y = Math.random() * 3; }

  // incense smoke rising from the altar
  const smoke = new SmokeSystem(world.quality.level === 'low' ? 60 : 140); S.add(smoke.points);
  smoke.addEmitter(new THREE.Vector3(-0.4, FLOOR + 0.75, -2.7).applyMatrix4(g.matrixWorld), { rate: 4, life: 1e9, spread: 0.01 });
  world.hutSmoke = smoke;
  world.updaters.push((dt, t) => {
    const w = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9) * 0.3;
    for (const tb of tubes) { tb.pivot.rotation.x = Math.sin(t * 1.3 + tb.ph) * 0.09 * (0.6 + w * 0.4); tb.pivot.rotation.z = Math.cos(t * 1.1 + tb.ph) * 0.07; }
    chime.rotation.y = Math.sin(t * 0.4) * 0.3;
    smoke.update(dt, t);
  });

  world.colliders.circles.push({ x: HUT.pos.x, z: HUT.pos.z, r: R_PLINTH + 0.35 });
  world.pickables.push(g); g.traverse(o => { o.userData.hut = true; });
  if (world.occluders) world.occluders.push(g);
  HUT.group = g;
  return g;
}

function jaliTexture() {
  // a pierced wooden screen: rows of lotus-petal openings
  const c = cv(256, 128), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 16; y < 128; y += 32) for (let x = 16; x < 256; x += 32) {
    g.beginPath(); g.ellipse(x + ((y / 32) % 2) * 16, y, 8, 12, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
}
