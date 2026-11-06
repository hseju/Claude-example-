import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { brass, kalasha, stoneMat } from './architecture.js';
import { SmokeSystem } from './fx.js';
import { normalFromCanvas, merge } from './flora.js';
import { figureSVG, CHAKRA_POINTS } from './meditator.js';
import { softDot } from './textures.js';
import { pbr, boxUV } from './pbr.js';

// Dhyana Kutir: a round meditation hut in the south-west garden. Two tiers of thatch with a brass finial, a
// front gable with a glowing Om medallion and a sign, carved teak posts with cream curtains tied back, lanterns
// under the eaves, a porch with glowing steps, and a cobbled path lined with stone lanterns past a lotus pond.
// Inside: a round jute mat, a ring of cushions, a woven pendant lamp, and an altar where a golden meditator sits
// in a halo of light that breathes with you.
// Local frame: origin at the centre of the plinth on the ground; +z points out of the door toward the courtyard.
export const HUT = {
  id: 'hut', name: 'Meditation hut', short: 'Meditation', sanskrit: 'Dhyana Kutir', capacity: 12,
  pos: new THREE.Vector3(-25, 0, 25), rot: Math.atan2(25, -25),
  blurb: 'Breathwork and short guided meditations',
};
const FLOOR = 0.55, R_PLINTH = 4.05, R_POST = 3.55, EAVE = 3.15, R_EAVE = 5.05, TIER = 4.75, DRUM = 5.2, APEX = 6.45, RIDGE = 4.95;
const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), HUT.rot).add(HUT.pos);
HUT.toWorld = toWorld;
HUT.entrance = toWorld(0, 0, 6.9);
HUT.pathEnd = toWorld(0, 0, 13.2);
HUT.labelPos = toWorld(0, APEX + 1.0, 0);
// you sit in the centre of the ring, facing the altar; the others sit around, turned toward it
const ALTAR_Z = -2.75;
HUT.seat = { pos: toWorld(0, FLOOR, 0.45), rotY: HUT.rot + Math.PI };
HUT.ring = [0, 35, -35, 65, -65, 95, -95, 125, -125, 147, -147].map((deg) => {
  const a = deg * Math.PI / 180, x = Math.sin(a) * 2.25, z = -0.25 + Math.cos(a) * 2.25;
  return { deg, local: [x, z], pos: toWorld(x, FLOOR, z), rotY: HUT.rot + Math.atan2(0 - x, -2.1 - z) };
});
HUT.sitterSeats = [65, -65, 125, -147, -95];
// camera spots (local): behind you toward the altar, your face, a wide view of the room, and the altar lamps
HUT.views = {
  altar: { pos: [0, 2.32, 3.5], look: [0, 1.92, -3.2], fov: 46 },
  pov: { pos: [0, 1.52, 0.5], look: [0, 1.9, -3.2], fov: 52 },   // your own eyes, from the centre cushion: used while practising
  face: { pos: [0.6, 1.55, -1.75], look: [0, 1.15, 1.6], fov: 40, lift: 0.31 },   // lift: how far a portrait screen raises the picture above the panel
  wide: { pos: [1.7, 2.7, 2.2], look: [-0.7, 0.95, -1.5], fov: 58 },
  flame: { pos: [0.02, 1.42, 0.2], look: [0, FLOOR + 0.36, -2.47], fov: 30 },
};

// ---------------------------------------------------------------- canvas textures
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const nrm = (c, strength, repeat) => { const t = normalFromCanvas(c, strength); t.repeat.set(...repeat); t.anisotropy = 4; return t; };
function texOf(c, repeat = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function thatchCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rnd(7);
  g.fillStyle = '#8f6c3a'; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y0 = row * 66 - 14;
    for (let i = 0; i < 1100; i++) {
      const x = r() * 512, y = y0 + r() * 70, len = 26 + r() * 56, tone = 130 + r() * 95;
      g.strokeStyle = `rgba(${tone + 45},${tone + 18},${tone * 0.5},${0.3 + r() * 0.45})`; g.lineWidth = 0.6 + r() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 7, y + len); g.stroke();
    }
    const sh = g.createLinearGradient(0, y0 + 46, 0, y0 + 70); sh.addColorStop(0, 'rgba(35,20,8,0)'); sh.addColorStop(1, 'rgba(35,20,8,0.42)');
    g.fillStyle = sh; g.fillRect(0, y0 + 46, 512, 24);
  }
  return c;
}
// a ragged fringe of straw for the eaves (alpha-tested)
function fringeCanvas() {
  const c = cv(512, 128), g = c.getContext('2d'), r = rnd(5);
  g.fillStyle = '#9a7642'; g.fillRect(0, 0, 512, 14);
  for (let i = 0; i < 1500; i++) {
    const x = r() * 512, len = 40 + r() * 86, tone = 120 + r() * 100;
    g.strokeStyle = `rgba(${tone + 50},${tone + 20},${tone * 0.48},1)`; g.lineWidth = 0.8 + r() * 1.6;
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 8, len * 0.6, x + (r() - 0.5) * 12, len); g.stroke();
  }
  return c;
}
function planksCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rnd(11);
  for (let i = 0; i < 8; i++) {
    const tone = 0.85 + r() * 0.25; g.fillStyle = `rgb(${Math.floor(122 * tone)},${Math.floor(82 * tone)},${Math.floor(50 * tone)})`; g.fillRect(i * 64, 0, 64, 512);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,35,18,${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r(); const x = i * 64 + r() * 64; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, 170, x + (r() - 0.5) * 10, 340, x + (r() - 0.5) * 6, 512); g.stroke(); }
    g.fillStyle = 'rgba(30,18,8,0.55)'; g.fillRect(i * 64, 0, 2, 512);
  }
  return c;
}
function juteCanvas() {
  // a round jute mat: concentric braided rings with a darker border
  const c = cv(1024), g = c.getContext('2d'), m = 512, r = rnd(3);
  g.fillStyle = '#b8955f'; g.beginPath(); g.arc(m, m, 510, 0, Math.PI * 2); g.fill();
  for (let rad = 10; rad < 505; rad += 11) {
    g.strokeStyle = rad > 470 ? '#7a5a32' : (rad / 11) % 2 ? '#c9a873' : '#a8844f'; g.lineWidth = 7;
    g.beginPath(); g.arc(m, m, rad, 0, Math.PI * 2); g.stroke();
    // braid ticks
    g.strokeStyle = 'rgba(70,45,20,0.25)'; g.lineWidth = 1.2;
    const n = Math.floor(rad * 0.9); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rad; g.beginPath(); g.moveTo(m + Math.cos(a) * (rad - 3), m + Math.sin(a) * (rad - 3)); g.lineTo(m + Math.cos(a + 0.02) * (rad + 3), m + Math.sin(a + 0.02) * (rad + 3)); g.stroke(); }
  }
  g.globalAlpha = 0.1; for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * 1024, r() * 1024, 2, 2); } g.globalAlpha = 1;
  return c;
}
function fabricCanvas(base, accent, h = 128) {
  const c = cv(128, h), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, h);
  g.globalAlpha = 0.14; for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? '#000' : '#fff'; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 4) { g.fillStyle = x % 8 ? '#000' : '#fff'; g.fillRect(x, 0, 1, h); } g.globalAlpha = 1;
  if (accent) { g.strokeStyle = accent; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 16); g.lineTo(128, 16); g.moveTo(0, h - 16); g.lineTo(128, h - 16); g.stroke(); }
  return c;
}
function cobbleCanvas() {
  const c = cv(512), g = c.getContext('2d'), r = rnd(21);
  g.fillStyle = '#7d6a5c'; g.fillRect(0, 0, 512, 512);
  const n = 9, cell = 512 / n;
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
    const cx = (i + 0.5 + (r() - 0.5) * 0.35 + (j % 2) * 0.5) * cell, cy = (j + 0.5 + (r() - 0.5) * 0.3) * cell, rx = cell * (0.4 + r() * 0.07), ry = cell * (0.36 + r() * 0.07);
    const tone = ['#cdb2a2', '#d9c2b2', '#c0a393', '#d3b8a6', '#bf9f8c'][Math.floor(r() * 5)];
    for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const gr = g.createRadialGradient(cx + ox - rx * 0.3, cy + oy - ry * 0.35, 2, cx + ox, cy + oy, rx * 1.1);
      gr.addColorStop(0, '#efe0d2'); gr.addColorStop(0.35, tone); gr.addColorStop(1, '#8e7464');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx + ox, cy + oy, rx, ry, r() * 0.6, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}
function woodCarvingCanvas(w = 512, h = 512, { border = true } = {}) {
  const c = cv(w, h), g = c.getContext('2d'), r = rnd(9);
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#5a3218'); bg.addColorStop(1, '#3e2210'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 120; k++) { g.strokeStyle = `rgba(20,10,4,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r(); const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 20, w * 0.7, y + (r() - 0.5) * 20, w, y + (r() - 0.5) * 10); g.stroke(); }
  if (border) { g.strokeStyle = '#c9963e'; g.lineWidth = Math.max(4, w / 90); g.strokeRect(w * 0.03, h * 0.05, w * 0.94, h * 0.9); g.lineWidth = Math.max(2, w / 220); g.strokeRect(w * 0.06, h * 0.12, w * 0.88, h * 0.76); }
  return c;
}
function lotusIcon(g, x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = color; g.lineWidth = 2.4 / s * s; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-7, 2, -6, -10, 0, -16); g.bezierCurveTo(6, -10, 7, 2, 0, 10);
  g.moveTo(0, 10); g.bezierCurveTo(-12, 8, -18, 0, -19, -7); g.bezierCurveTo(-10, -6, -4, 0, 0, 10);
  g.moveTo(0, 10); g.bezierCurveTo(12, 8, 18, 0, 19, -7); g.bezierCurveTo(10, -6, 4, 0, 0, 10);
  g.moveTo(-22, 12); g.quadraticCurveTo(0, 18, 22, 12); g.stroke(); g.restore();
}
function signCanvas(text, w = 1024, h = 184) {
  const c = woodCarvingCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f6cf78'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.floor(h * 0.42)}px Marcellus, "Trajan Pro", Georgia, serif`; g.shadowColor = 'rgba(255,190,90,.6)'; g.shadowBlur = 10;
  g.fillText(text, w / 2, h * 0.53);
  const tw = g.measureText(text).width; g.shadowBlur = 0;
  lotusIcon(g, w / 2 - tw / 2 - h * 0.42, h * 0.52, h / 70, '#f6cf78'); lotusIcon(g, w / 2 + tw / 2 + h * 0.42, h * 0.52, h / 70, '#f6cf78');
  return c;
}
function omCanvas() {
  const c = cv(512), g = c.getContext('2d');
  const bg = g.createRadialGradient(256, 240, 30, 256, 256, 256); bg.addColorStop(0, '#6a2a12'); bg.addColorStop(1, '#2e1206');
  g.fillStyle = bg; g.beginPath(); g.arc(256, 256, 254, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f2c160'; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 210, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffd77e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffb04a'; g.shadowBlur = 24;
  g.font = '300px "Tiro Devanagari Sanskrit", "Noto Sans Devanagari", "Mukta", serif'; g.fillText('ॐ', 256, 286);
  return c;
}
function haloCanvas() {
  const c = cv(512), g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(0.3, 'rgba(255,214,140,.95)'); gr.addColorStop(0.62, 'rgba(255,160,70,.55)'); gr.addColorStop(0.86, 'rgba(255,120,40,.12)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,220,160,.12)'; g.lineWidth = 3;
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 120, 256 + Math.sin(a) * 120); g.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); g.stroke(); }
  return c;
}
function paperCanvas() {
  const c = cv(128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffd99a'); gr.addColorStop(0.5, '#fff0cc'); gr.addColorStop(1, '#ffcf88'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,50,20,.55)'; g.lineWidth = 3; for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  g.lineWidth = 5; g.beginPath(); g.moveTo(0, 6); g.lineTo(128, 6); g.moveTo(0, 122); g.lineTo(128, 122); g.stroke();
  return c;
}
function rattanCanvas() {
  // an open woven shade: diagonal cane bands on a transparent ground
  const c = cv(256), g = c.getContext('2d');
  g.strokeStyle = '#c99a5a'; g.lineWidth = 7; g.lineCap = 'round';
  for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); }
  g.strokeStyle = 'rgba(80,45,15,.6)'; g.lineWidth = 1.5;
  for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i + 3, 0); g.lineTo(i + 259, 256); g.stroke(); }
  return c;
}

// ---------------------------------------------------------------- shared geometry helpers
const postProfile = (h) => [[0.17, 0], [0.17, 0.12], [0.12, 0.16], [0.11, 0.42], [0.13, 0.48], [0.105, 0.54], [0.095, h - 0.55], [0.12, h - 0.48], [0.095, h - 0.42], [0.15, h - 0.25], [0.17, h - 0.12], [0.17, h]];
const postGeo = (h) => new THREE.LatheGeometry(postProfile(h).map(([r, y]) => new THREE.Vector2(r, y)), 14);
// a cloth curtain hanging from the beam beside a post, gathered and tied at `tie` and flaring to the floor
function curtainGeo(width, height, side, tie = 0.42) {
  const g = new THREE.PlaneGeometry(1, 1, 12, 26), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;
    const wf = v > tie ? 0.13 + 0.87 * Math.pow((v - tie) / (1 - tie), 0.75) : 0.13 + 0.25 * Math.pow((tie - v) / tie, 1.1);
    const x = side * u * wf * width, y = v * height;
    const fold = Math.sin(u * Math.PI * 7 + v * 0.6) * 0.035 * (0.35 + 0.65 * u) + (Math.abs(v - tie) < 0.08 ? 0.03 : 0) + (v < 0.06 ? (0.06 - v) * 0.5 : 0);
    p.setXYZ(i, x, y, fold);
  }
  g.computeVertexNormals(); return g;
}
function leafGeo() {
  // a long tropical leaf, bent along its length
  const g = new THREE.PlaneGeometry(0.16, 1, 2, 8); g.translate(0, 0.5, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setX(i, x * Math.sin(Math.PI * Math.min(1, y * 1.15)) * 1.2); p.setZ(i, -y * y * 0.45 + Math.abs(x) * 0.3); }
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- the hut
export function buildHut(world) {
  const S = world.scene, Q = world.quality, g = new THREE.Group(); g.position.copy(HUT.pos); g.rotation.y = HUT.rot; S.add(g);
  // materials that carry a photographed surface project their UVs from the shape, so the tiling keeps a true scale
  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true, parent = g) => { if (mat.userData.boxTile) boxUV(geo, mat.userData.boxTile); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const teak = pbr('teak', { rotation: Math.PI / 2, color: '#d29a6c', roughness: 0.75 }); teak.userData.boxTile = 0.7;
  const darkTeak = pbr('teak', { color: '#9a6448', roughness: 0.8 }); darkTeak.userData.boxTile = 0.8;
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b04f', metalness: 0.9, roughness: 0.25 });
  const plank = pbr('planks', { color: '#f2d2a8', roughness: 0.8 }); plank.userData.boxTile = 1.8;
  const thatchC = thatchCanvas(), thatch = pbr('thatch', { repeat: [15, 2.2], color: '#ffd994', normal: 1.3 });
  const fringe = new THREE.MeshStandardMaterial({ map: texOf(fringeCanvas(), [16, 1]), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  const stone = pbr('sandstone', { color: '#f6dcb8' }); stone.userData.boxTile = 1.3;
  const plinthStone = pbr('sandstone', { repeat: [17, 0.42], color: '#f6dcb8' });
  const glowWarm = new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb050', emissiveIntensity: 1.6, roughness: 0.6 });
  const lampMats = [];   // materials whose glow follows the time of day
  const atAngle = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];
  const shaggy = (geo, amp, seed) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(x, z), rr = Math.hypot(x, z); if (rr < 0.05) continue; const k = 1 + (Math.sin(a * 23 + seed) * 0.6 + Math.sin(a * 57 + y * 4 + seed) * 0.4) * amp / rr; p.setX(i, x * k); p.setZ(i, z * k); } geo.computeVertexNormals(); return geo; };

  // ---- plinth, floor, porch and glowing steps
  add(new THREE.CylinderGeometry(R_PLINTH, R_PLINTH + 0.15, FLOOR, 48), plinthStone, 0, FLOOR / 2);
  const floorGeo = new THREE.CircleGeometry(R_PLINTH - 0.08, 48); floorGeo.rotateX(-Math.PI / 2); add(floorGeo, plank, 0, FLOOR + 0.004, 0, false);
  add(new THREE.BoxGeometry(3.6, FLOOR, 1.75), stone, 0, FLOOR / 2, 4.4);
  const porchFloor = new THREE.PlaneGeometry(3.45, 1.7); porchFloor.rotateX(-Math.PI / 2); add(porchFloor, plank, 0, FLOOR + 0.005, 4.45, false);
  const stripMat = new THREE.MeshStandardMaterial({ color: '#ffe0a8', emissive: '#ffbe6a', emissiveIntensity: 2.2 }); lampMats.push([stripMat, 1.2, 0.35]);
  for (let k = 0; k < 3; k++) {
    const top = FLOOR * (2 - k) / 3 + 0.0, z0 = 5.27 + k * 0.38;
    if (top > 0.01) add(new THREE.BoxGeometry(2.9 - k * 0.1, top, 0.38), stone, 0, top / 2, z0 + 0.19);
    add(new THREE.BoxGeometry(2.75 - k * 0.1, 0.03, 0.03), stripMat, 0, Math.max(0.03, top - 0.05), z0 + 0.375, false);
  }

  // ---- twelve carved teak posts, a ring beam, cream curtains tied back at every post
  const postAngles = [...Array(12)].map((_, i) => (i + 0.5) / 12 * Math.PI * 2);
  const pg = postGeo(EAVE - FLOOR);
  for (const a of postAngles) { const [x, z] = atAngle(R_POST, a); add(pg, teak, x, FLOOR, z); add(new THREE.BoxGeometry(0.4, 0.12, 0.4), stone, x, FLOOR + 0.06, z); }
  const band = new THREE.CylinderGeometry(R_POST + 0.1, R_POST + 0.1, 0.3, 48, 1, true); add(band, new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.6, side: THREE.DoubleSide }), 0, EAVE - 0.1, 0);
  // the porch: two posts, a beam, and the gable above
  for (const s of [-1, 1]) { add(postGeo(EAVE - FLOOR + 0.05), teak, s * 1.5, FLOOR, 5.05); add(new THREE.BoxGeometry(0.42, 0.12, 0.42), stone, s * 1.5, FLOOR + 0.06, 5.05); }
  add(new THREE.BoxGeometry(3.5, 0.22, 0.24), darkTeak, 0, EAVE + 0.02, 5.08);
  for (const z of [3.5, 4.3]) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.2, 1.7), darkTeak, s * 1.5, EAVE + 0.02, z);
  const curtainMat = new THREE.MeshStandardMaterial({ map: texOf(fabricCanvas('#f4e8d2', null, 256), [2, 1]), roughness: 0.85, side: THREE.DoubleSide, emissive: '#2a1a0c', emissiveIntensity: 0.15 });
  const curtains = [], ties = [];
  const placeCurtain = (px, pz, tangentAngle, side, width, height, outward = 0.13) => {
    const geo = curtainGeo(width, height, side), m = new THREE.Matrix4();
    const rx = Math.sin(tangentAngle), rz = Math.cos(tangentAngle);   // x axis of the curtain runs along the tangent
    const nx = -rz * 0, nz = 0; void nx; void nz;
    m.makeRotationY(Math.atan2(rx, rz) - Math.PI / 2); m.setPosition(px, FLOOR, pz);
    geo.applyMatrix4(m); curtains.push(geo);
    const tieP = new THREE.Vector3(side * 0.13 * width, 0.42 * height + FLOOR, 0.03).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(rx, rz) - Math.PI / 2)); ties.push([px + tieP.x, tieP.y, pz + tieP.z]);
    void outward;
  };
  for (const a of postAngles) {
    const [x, z] = atAngle(R_POST + 0.16, a), tan = a + Math.PI / 2;
    const front = Math.cos(a) > 0.95;   // the two posts either side of the door keep their curtains well open
    placeCurtain(x, z, tan, 1, front ? 0.55 : 0.85, EAVE - FLOOR - 0.12);
    placeCurtain(x, z, tan, -1, front ? 0.55 : 0.85, EAVE - FLOOR - 0.12);
  }
  for (const s of [-1, 1]) placeCurtain(s * 1.5, 5.18, Math.PI / 2, -s, 0.7, EAVE - FLOOR - 0.06);
  const cm = new THREE.Mesh(merge(curtains), curtainMat); cm.castShadow = true; g.add(cm);
  for (const [x, y, z] of ties) add(new THREE.TorusGeometry(0.06, 0.015, 6, 14), gold, x, y, z, false).rotation.x = Math.PI / 2;

  // ---- two tiers of shaggy thatch, a carved drum between them, and a brass kalash
  const layer = (rTop, rBot, y0, y1, seed, amp = 0.05) => { const geo = shaggy(new THREE.CylinderGeometry(rTop, rBot, y1 - y0, 72, 6, true), amp, seed); add(geo, thatch, 0, (y0 + y1) / 2, 0); };
  layer(1.45, R_EAVE, EAVE, TIER, 1);
  layer(1.55, R_EAVE - 0.45, EAVE + 0.42, TIER + 0.04, 2);
  layer(1.5, R_EAVE - 1.2, EAVE + 0.95, TIER + 0.07, 3);
  const ceil = new THREE.CylinderGeometry(1.4, R_EAVE - 0.1, TIER - EAVE - 0.06, 48, 1, true);
  add(ceil, new THREE.MeshStandardMaterial({ map: texOf(thatchC, [12, 1]), color: '#7a5636', roughness: 1, side: THREE.BackSide }), 0, (EAVE + TIER) / 2 - 0.05, 0, false);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, [x0, z0] = atAngle(R_POST, a), [x1, z1] = atAngle(1.35, a);
    const p0 = new THREE.Vector3(x0, EAVE + 0.02, z0), p1 = new THREE.Vector3(x1, TIER - 0.12, z1), len = p0.distanceTo(p1);
    const raf = add(new THREE.CylinderGeometry(0.035, 0.045, len, 6), darkTeak, (x0 + x1) / 2, (EAVE + TIER) / 2 - 0.05, (z0 + z1) / 2, false);
    raf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
  }
  const fringeRing = (r0, r1, yTop, h, rep) => { const geo = new THREE.CylinderGeometry(r0, r1, h, 96, 1, true); const m = fringe.clone(); m.map = fringe.map.clone(); m.map.repeat.set(rep, 1); m.map.needsUpdate = true; add(geo, m, 0, yTop - h / 2, 0, false); };
  fringeRing(R_EAVE + 0.02, R_EAVE + 0.16, EAVE + 0.08, 0.55, 30);
  fringeRing(R_EAVE - 0.06, R_EAVE + 0.05, EAVE + 0.1, 0.42, 26);
  fringeRing(R_EAVE - 0.42, R_EAVE - 0.3, EAVE + 0.5, 0.38, 26);
  const capRing = new THREE.RingGeometry(1.1, 1.62, 32); capRing.rotateX(-Math.PI / 2); add(capRing, thatch, 0, TIER + 0.08, 0, false);
  const drumC = woodCarvingCanvas(512, 96, { border: false }), dg = drumC.getContext('2d'); dg.fillStyle = '#c9963e'; for (let x = 8; x < 512; x += 32) dg.fillRect(x, 20, 6, 56);
  add(new THREE.CylinderGeometry(1.25, 1.32, DRUM - TIER + 0.12, 32, 1, true), new THREE.MeshStandardMaterial({ map: texOf(drumC, [3, 1]), roughness: 0.6, side: THREE.DoubleSide }), 0, (TIER + DRUM) / 2, 0);
  add(shaggy(new THREE.CylinderGeometry(0.14, 2.15, APEX - DRUM + 0.1, 48, 4, true), 0.035, 4), thatch, 0, (DRUM + APEX) / 2 - 0.05, 0);
  fringeRing(2.16, 2.26, DRUM + 0.0, 0.34, 14);
  const k = kalasha(0.7, brass); k.position.set(0, APEX - 0.08, 0); g.add(k);

  // ---- the front gable: thatched slabs, a carved pediment, the Om medallion and the sign
  const slope = Math.atan2(RIDGE - EAVE, 1.95), slab = Math.hypot(RIDGE - EAVE, 1.95) + 0.25;
  for (const s of [-1, 1]) {
    const m = add(new THREE.BoxGeometry(slab, 0.2, 3.0), thatch, s * 0.98, (RIDGE + EAVE) / 2 + 0.08, 4.0);
    m.rotation.z = -s * slope;
    const fr = add(new THREE.PlaneGeometry(slab, 0.4), fringe, s * 0.98, (RIDGE + EAVE) / 2 - 0.12, 5.51, false); fr.rotation.z = -s * slope;
  }
  const ped = new THREE.Shape(); ped.moveTo(-1.62, 0); ped.lineTo(1.62, 0); ped.lineTo(0, RIDGE - EAVE - 0.12); ped.closePath();
  const pedGeo = new THREE.ShapeGeometry(ped); { const p = pedGeo.attributes.position, uv = pedGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.62) / 3.24, p.getY(i) / 1.7); }
  add(pedGeo, new THREE.MeshStandardMaterial({ map: texOf(woodCarvingCanvas(512, 280)), roughness: 0.6 }), 0, EAVE + 0.12, 5.36, false);
  for (const [x0, y0, x1, y1] of [[-1.62, 0, 1.62, 0], [-1.62, 0, 0, 1.68], [1.62, 0, 0, 1.68]]) {
    const len = Math.hypot(x1 - x0, y1 - y0), m = add(new THREE.BoxGeometry(len, 0.07, 0.06), gold, (x0 + x1) / 2, EAVE + 0.12 + (y0 + y1) / 2, 5.39, false); m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  }
  const omMat = new THREE.MeshStandardMaterial({ map: texOf(omCanvas()), emissiveMap: texOf(omCanvas()), emissive: '#ffb860', emissiveIntensity: 1.4, roughness: 0.45 }); lampMats.push([omMat, 0.9, 0.25]);
  add(new THREE.CircleGeometry(0.46, 48), omMat, 0, EAVE + 0.7, 5.42, false);
  add(new THREE.TorusGeometry(0.47, 0.03, 8, 48), gold, 0, EAVE + 0.7, 5.42, false);
  const signMat = new THREE.MeshStandardMaterial({ map: texOf(signCanvas('Meditation Hut')), emissiveMap: texOf(signCanvas('Meditation Hut')), emissive: '#ffcf7a', emissiveIntensity: 0.55, roughness: 0.6 }); lampMats.push([signMat, 0.35, 0.12]);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.46, 0.08), [darkTeak, darkTeak, darkTeak, darkTeak, signMat, darkTeak]); sign.position.set(0, EAVE - 0.24, 5.24); sign.castShadow = true; g.add(sign);

  // ---- lanterns under the eaves (and two at the porch)
  const paper = new THREE.MeshStandardMaterial({ map: texOf(paperCanvas()), emissive: '#ffb45c', emissiveMap: texOf(paperCanvas()), emissiveIntensity: 1.4, roughness: 0.7 }); lampMats.push([paper, 0.7, 0.3]);
  const lanternSpots = postAngles.map(a => { const [x, z] = atAngle(R_EAVE - 0.75, a + Math.PI / 12); return [x, EAVE - 0.55, z]; }).filter(([x, , z]) => !(z > 3 && Math.abs(x) < 1.6));
  lanternSpots.push([-1.5, EAVE - 0.62, 5.42], [1.5, EAVE - 0.62, 5.42]);
  const lBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 12), paper, lanternSpots.length);
  const lCap = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 0.12, 12), darkTeak, lanternSpots.length);
  const lBase = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.11, 0.05, 12), darkTeak, lanternSpots.length);
  const lCord = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), darkTeak, lanternSpots.length);
  const m4 = new THREE.Matrix4();
  lanternSpots.forEach(([x, y, z], i) => { lBody.setMatrixAt(i, m4.makeTranslation(x, y, z)); lCap.setMatrixAt(i, m4.makeTranslation(x, y + 0.21, z)); lBase.setMatrixAt(i, m4.makeTranslation(x, y - 0.18, z)); lCord.setMatrixAt(i, m4.makeTranslation(x, y + 0.5, z)); });
  for (const im of [lBody, lCap, lBase, lCord]) g.add(im);

  // ---- inside: a round jute mat, maroon cushions in a ring, your cushion in the centre
  const mat = new THREE.CircleGeometry(2.95, 64); mat.rotateX(-Math.PI / 2); add(mat, new THREE.MeshStandardMaterial({ map: texOf(juteCanvas()), roughness: 0.95 }), 0, FLOOR + 0.012, -0.25, false);
  const cushionGeo = new THREE.LatheGeometry([[0, 0], [0.24, 0], [0.29, 0.035], [0.305, 0.075], [0.29, 0.115], [0.24, 0.14], [0, 0.145]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  const cushionMat = new THREE.MeshStandardMaterial({ map: texOf(fabricCanvas('#6b1d2b', '#c9963e')), roughness: 0.85 });
  const nCush = HUT.ring.length + 1, cushions = new THREE.InstancedMesh(cushionGeo, cushionMat, nCush);
  [[0, 0.45], ...HUT.ring.map(s => s.local)].forEach(([x, z], i) => cushions.setMatrixAt(i, m4.makeTranslation(x, FLOOR + 0.012, z)));
  cushions.castShadow = true; cushions.receiveShadow = true; g.add(cushions);
  // a singing bowl beside your cushion
  const bowl = new THREE.LatheGeometry([[0.0, 0.0], [0.07, 0.0], [0.115, 0.03], [0.135, 0.075], [0.13, 0.1], [0.125, 0.1], [0.128, 0.075], [0.11, 0.035], [0.065, 0.012], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  add(new THREE.TorusGeometry(0.1, 0.035, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7c2030', roughness: 0.9 }), 0.62, FLOOR + 0.045, 0.2, false);
  add(bowl, new THREE.MeshStandardMaterial({ color: '#b98a3c', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }), 0.62, FLOOR + 0.075, 0.2);

  // ---- the woven pendant lamp, with a real light
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), new THREE.MeshStandardMaterial({ map: texOf(rattanCanvas(), [3, 2]), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, emissive: '#ffb25a', emissiveMap: texOf(rattanCanvas(), [3, 2]), emissiveIntensity: 0.5 }));
  shade.position.set(0, 3.55, -0.25); g.add(shade);
  const bulb = add(new THREE.SphereGeometry(0.27, 16, 12), glowWarm, 0, 3.55, -0.25, false); lampMats.push([glowWarm, 1.3, 0.3]); void bulb;
  add(new THREE.CylinderGeometry(0.008, 0.008, TIER - 3.8, 4), darkTeak, 0, (TIER + 3.8) / 2, -0.25, false);
  let pendant = null;
  if (Q.level !== 'low') { pendant = new THREE.PointLight('#ffb468', 2, 9, 1.4); pendant.position.copy(new THREE.Vector3(0, 3.3, -0.25)); g.add(pendant); }

  // ---- the altar: a carved arch, a halo of light, a golden meditator, lamps, flowers and plants
  const altar = new THREE.Group(); altar.position.set(0, FLOOR, ALTAR_Z); g.add(altar);
  add(new THREE.BoxGeometry(2.1, 0.24, 0.6), teak, 0, 0.12, 0.05, true, altar);
  add(new THREE.BoxGeometry(1.6, 0.3, 0.5), darkTeak, 0, 0.39, -0.05, true, altar);
  add(new THREE.BoxGeometry(2.14, 0.04, 0.64), gold, 0, 0.245, 0.05, false, altar);
  const arch = new THREE.Shape(); arch.moveTo(-1.15, 0); arch.lineTo(1.15, 0); arch.lineTo(1.15, 1.78); arch.absarc(0, 1.78, 1.15, 0, Math.PI, false); arch.lineTo(-1.15, 0);
  const archGeo = new THREE.ShapeGeometry(arch, 24); { const p = archGeo.attributes.position, uv = archGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.15) / 2.3, p.getY(i) / 2.93); }
  add(archGeo, new THREE.MeshStandardMaterial({ map: texOf(woodCarvingCanvas(512, 580)), roughness: 0.65 }), 0, 0.54, -0.42, false, altar);
  const haloMat = new THREE.MeshBasicMaterial({ map: texOf(haloCanvas()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1, 1, 1) });
  const halo = add(new THREE.PlaneGeometry(2.3, 2.3), haloMat, 0, 1.9, -0.39, false, altar);
  const haloRing = add(new THREE.TorusGeometry(0.95, 0.035, 8, 64), gold, 0, 1.9, -0.38, false, altar);
  const figMat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.05, roughness: 0.4, metalness: 0.4, emissive: '#ffbf66', emissiveIntensity: 0.9, color: '#ffe2a2' });
  const figure = add(new THREE.PlaneGeometry(1.45, 1.45), figMat, 0, 1.78, -0.33, false, altar);
  { const img = new Image(), c = cv(512), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; figMat.map = t; figMat.emissiveMap = t;
    img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, 512, 512); t.needsUpdate = true; figMat.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(figureSVG()); }
  // chakra lights along the figure's spine
  const dot = softDot(), chakras = CHAKRA_POINTS.map((c) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: c.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 })); sp.position.set(0, 1.78 + (120 - c.y) / 240 * 1.45, -0.3); sp.scale.setScalar(0.12); altar.add(sp); return sp; });
  // lamps along the altar, brass samai stands at each side
  for (let i = 0; i < 7; i++) world._diyaLocal(g, new THREE.Vector3(-0.84 + i * 0.28, FLOOR + 0.285, ALTAR_Z + 0.29), 0.3);
  const samaiGeo = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.03], [0.06, 0.07], [0.035, 0.15], [0.03, 0.9], [0.05, 0.93], [0.15, 0.97], [0.16, 1.0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  g.updateMatrixWorld(true);
  for (const s of [-1, 1]) {
    add(samaiGeo, brass, s * 1.3, 0.0, -0.05, true, altar);
    for (let j = 0; j < 3; j++) { const a = j / 3 * Math.PI * 2; world.flames.add(new THREE.Vector3(s * 1.3 + Math.cos(a) * 0.1, FLOOR + 1.03, ALTAR_Z - 0.05 + Math.sin(a) * 0.1).applyMatrix4(g.matrixWorld), 0.28); }
  }
  for (const s of [-1, 1]) { const fl = new THREE.Group(); fl.position.set(s * 0.62, 0.55, 0.0); altar.add(fl); fl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 16), brass));
    for (let i = 0; i < 16; i++) { const a = i * 2.4, f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), new THREE.MeshStandardMaterial({ color: i % 3 ? '#f29a17' : '#f6c025', roughness: 0.9 })); f.position.set(Math.cos(a) * 0.075 * Math.sqrt(i / 16), 0.05, Math.sin(a) * 0.075 * Math.sqrt(i / 16)); fl.add(f); } }

  // ---- plants: potted palms beside the altar and around the room, broad-leaf plants outside
  const leaves = [], leafCols = [];
  const plant = (x, z, y, scale, n, pot) => {
    if (pot) add(new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.2, 0.22], [0.19, 0.34], [0.22, 0.37], [0.2, 0.39]].map(([a, b]) => new THREE.Vector2(a * scale * 1.2, b * scale * 1.2)), 16), pot, x, y, z);
    const base = y + (pot ? 0.36 * scale * 1.2 : 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + i * 0.7, tilt = 0.25 + (i % 3) * 0.22, len = scale * (0.8 + (i % 4) * 0.18);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, base, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, a, 0, 'YXZ')), new THREE.Vector3(len * 1.3, len, len));
      leaves.push(m); leafCols.push(new THREE.Color().setHSL(0.27 + (i % 5) * 0.012, 0.5, 0.26 + (i % 3) * 0.05));
    }
  };
  const brassPot = brass, clayPot = new THREE.MeshStandardMaterial({ color: '#a4532c', roughness: 0.85 });
  for (const s of [-1, 1]) plant(s * 1.85, ALTAR_Z - 0.2, FLOOR, 0.95, 11, brassPot);
  for (const a of [Math.PI * 0.62, -Math.PI * 0.62, Math.PI * 0.4, -Math.PI * 0.4]) { const [x, z] = atAngle(3.25, a); plant(x, z, FLOOR, 0.8, 9, clayPot); }
  // outside, around the plinth and the steps
  for (const [x, z, s] of [[2.3, 5.4, 1.1], [-2.3, 5.4, 1.1], [3.9, 2.9, 1.2], [-3.9, 2.9, 1.2], [4.6, 0.3, 1.0], [-4.6, -0.4, 1.0], [3.4, -3.3, 1.1], [-3.4, -3.3, 1.1]]) plant(x, z, 0, s, 13, null);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide });
  const leafIm = new THREE.InstancedMesh(leafGeo(), leafMat, leaves.length);
  leaves.forEach((m, i) => { leafIm.setMatrixAt(i, m); leafIm.setColorAt(i, leafCols[i]); }); leafIm.castShadow = true; g.add(leafIm);

  // ---- the path: cobbles, stone lanterns, a signpost, a lotus pond, rocks and flowering trees
  const cobC = cobbleCanvas();
  const pathGeo = new THREE.PlaneGeometry(2.6, 7.2, 1, 1); pathGeo.rotateX(-Math.PI / 2);
  add(pathGeo, pbr('flagstone', { repeat: [1.5, 4.1], color: '#ffe6c8', polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.02, 9.95, false); void cobC;
  const edgeMat = pbr('sandstone', { color: '#d9bc98' }); edgeMat.userData.boxTile = 0.9;
  // pink and marigold petals scattered along the path, thicker toward the edges
  { const pg = new THREE.CircleGeometry(0.045, 6); pg.scale(1, 0.62, 1); pg.rotateX(-Math.PI / 2); const N = Q.level === 'low' ? 90 : 220, pet = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), N);
    const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), pc = new THREE.Color(), r = rnd(77);
    for (let i = 0; i < N; i++) { const u = r() * 2 - 1, x = Math.sign(u) * Math.pow(Math.abs(u), 0.55) * 1.3, z = 6.4 + r() * 7.1, sc = 0.7 + r() * 0.8;
      pm.compose(new THREE.Vector3(x, 0.034 + r() * 0.004, z), pq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3), new THREE.Vector3(sc, 1, sc)); pet.setMatrixAt(i, pm);
      pet.setColorAt(i, pc.set(['#e0438f', '#d21f7a', '#f06aa8', '#f29a17', '#ffffff'][Math.floor(r() * 5)])); }
    pet.receiveShadow = true; g.add(pet); }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.07, 7.2), edgeMat, s * 1.36, 0.035, 9.95, false);
  const lanternGlow = new THREE.MeshStandardMaterial({ color: '#ffe3b0', emissive: '#ffb055', emissiveIntensity: 1.8 }); lampMats.push([lanternGlow, 0.9, 0.4]);
  const lanternStone = pbr('sandstone', { color: '#ecd2ae' }); lanternStone.userData.boxTile = 0.55;
  // every lantern lays a soft pool of warm light on the stones around it
  const poolMat = new THREE.MeshBasicMaterial({ map: softDot(), color: new THREE.Color(1.0, 0.62, 0.28), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const z of [7.3, 9.9, 12.5]) for (const s of [-1, 1]) {
    const x = s * 1.75;
    add(new THREE.BoxGeometry(0.36, 0.12, 0.36), lanternStone, x, 0.06, z); add(new THREE.BoxGeometry(0.16, 0.42, 0.16), lanternStone, x, 0.33, z);
    add(new THREE.BoxGeometry(0.32, 0.05, 0.32), lanternStone, x, 0.565, z); add(new THREE.BoxGeometry(0.24, 0.24, 0.24), lanternGlow, x, 0.71, z, false);
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) add(new THREE.BoxGeometry(0.035, 0.26, 0.035), lanternStone, x + dx, 0.71, z + dz, false);
    const cap = add(new THREE.ConeGeometry(0.29, 0.18, 4), lanternStone, x, 0.92, z); cap.rotation.y = Math.PI / 4;
    const pool = add(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2), poolMat, x, 0.045, z, false); pool.receiveShadow = false; pool.renderOrder = 2;
    world.colliders.circles.push(...[toWorld(x, 0, z)].map(p => ({ x: p.x, z: p.z, r: 0.25 })));
  }
  // signpost
  const postW = add(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), teak, 2.65, 0.75, 8.4);
  const arrowC = signCanvas('Meditation', 768, 200);
  const arrowMat = new THREE.MeshStandardMaterial({ map: texOf(arrowC), roughness: 0.6, emissive: '#ffcf7a', emissiveMap: texOf(arrowC), emissiveIntensity: 0.25 });
  const arrowShape = new THREE.Shape(); arrowShape.moveTo(-0.55, -0.15); arrowShape.lineTo(0.42, -0.15); arrowShape.lineTo(0.6, 0); arrowShape.lineTo(0.42, 0.15); arrowShape.lineTo(-0.55, 0.15); arrowShape.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.05, bevelEnabled: false }); { const p = arrowGeo.attributes.position, uv = arrowGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.6) / 1.2, (p.getY(i) + 0.15) / 0.3); }
  const arrow = new THREE.Mesh(arrowGeo, arrowMat); arrow.position.set(2.65, 1.25, 8.4); arrow.rotation.y = -Math.PI / 2 - 0.25; arrow.castShadow = true; g.add(arrow); void postW;
  world.colliders.circles.push((() => { const p = toWorld(2.65, 0, 8.4); return { x: p.x, z: p.z, r: 0.2 }; })());
  // a raised lotus pond with a rock rim
  const pondC = [-3.75, 9.9], pondR = 1.5;
  const pondShape = new THREE.Shape(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = pondR * (1 + Math.sin(a * 3 + 1) * 0.08 + Math.sin(a * 5) * 0.05); pondShape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  const water = new THREE.ShapeGeometry(pondShape, 40); water.rotateX(-Math.PI / 2); add(water, world.pondWater, pondC[0], 0.16, pondC[1], false);
  const bed = new THREE.ShapeGeometry(pondShape, 40); bed.rotateX(-Math.PI / 2); add(bed, new THREE.MeshStandardMaterial({ color: '#2b3a2c', roughness: 1 }), pondC[0], 0.04, pondC[1], false);
  const rockMat = pbr('mossstone', { flatShading: true, color: '#d8ccb6' }); rockMat.userData.boxTile = 0.8;
  const rockGeo = (r, seed) => { const geo = new THREE.DodecahedronGeometry(r, 1), p = geo.attributes.position, rr = rnd(seed); for (let i = 0; i < p.count; i++) { const f = 0.82 + rr() * 0.3; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); } geo.computeVertexNormals(); return geo; };
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = pondR * (1.06 + Math.sin(a * 3 + 1) * 0.08); add(rockGeo(0.2 + (i % 3) * 0.06, i + 3), rockMat, pondC[0] + Math.cos(a) * rr, 0.1, pondC[1] + Math.sin(a) * rr); }
  for (const [x, z, r] of [[-4.9, 8.4, 0.5], [-1.9, 11.4, 0.38], [3.0, 11.6, 0.45], [3.6, 6.4, 0.34], [-4.4, 11.3, 0.3]]) add(rockGeo(r, x * 7 + z), rockMat, x, r * 0.35, z);
  { const pw = toWorld(pondC[0], 0, pondC[1]); world._lotuses(pw.x, pw.z, pondR * 0.8, 7, 0.17); world.colliders.circles.push({ x: pw.x, z: pw.z, r: pondR + 0.3 }); }
  // flowering trees and beds framing the hut
  for (const [x, z, s] of [[-8.6, 7.4, 0.95], [9.0, 10.2, 0.9], [-8.2, -6.2, 1.0]]) { const p = toWorld(x, 0, z); world.flora.addTree('bougainvillea', p.x, p.z, s); world.colliders.circles.push({ x: p.x, z: p.z, r: 0.6 }); world.flora.addFallen(p.x, p.z, 3.0 * s, ['#d21f7a', '#e0438f', '#b8186a'], 70); }
  for (const [x, z, r, pal] of [[3.3, 9.6, 0.9, ['hibiscus', 'jasmine']], [-2.4, 6.4, 0.7, ['jasmine', 'hibiscus']]]) { const p = toWorld(x, 0, z); world.flora.addBed(p.x, p.z, r, pal); world.colliders.circles.push({ x: p.x, z: p.z, r: r + 0.1 }); }

  // ---- marigold garlands along the porch beam and down the front posts, and two tall lotus banners by the steps
  const garlandPts = [];
  const swag = (a0, a1, sag, n) => { for (let i = 0; i <= n; i++) { const u = i / n; garlandPts.push(new THREE.Vector3().lerpVectors(a0, a1, u).add(new THREE.Vector3(0, -sag * 4 * u * (1 - u), 0))); } };
  const beamY = EAVE - 0.12, beamZ = 5.24;
  for (let k = 0; k < 3; k++) swag(new THREE.Vector3(-1.5 + k, beamY, beamZ), new THREE.Vector3(-0.5 + k, beamY, beamZ), 0.16, 22);
  for (const sx of [-1.5, -0.5, 0.5, 1.5]) for (let i = 0; i < 9; i++) garlandPts.push(new THREE.Vector3(sx, beamY - 0.06 - i * 0.075, beamZ));
  for (const s2 of [-1, 1]) swag(new THREE.Vector3(s2 * 1.5, beamY, beamZ), new THREE.Vector3(s2 * 1.5, FLOOR + 0.45, beamZ - 0.02), 0.0, 28);
  const flower = new THREE.IcosahedronGeometry(0.042, 1), garland = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({ roughness: 0.7 }), garlandPts.length);
  const gm = new THREE.Matrix4(), gc = new THREE.Color();
  garlandPts.forEach((pt, i) => { gm.makeTranslation(pt.x, pt.y, pt.z); garland.setMatrixAt(i, gm); garland.setColorAt(i, gc.set(i % 3 === 0 ? '#ffd23f' : i % 3 === 1 ? '#f29a17' : '#e8641a')); });
  garland.castShadow = true; g.add(garland);
  const bannerC = cv(256, 768), bx = bannerC.getContext('2d');
  { const gr = bx.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, '#7a1630'); gr.addColorStop(1, '#5a0f24'); bx.fillStyle = gr; bx.fillRect(0, 0, 256, 768);
    bx.strokeStyle = '#e8b85a'; bx.lineWidth = 10; bx.strokeRect(14, 14, 228, 690); bx.lineWidth = 3; bx.strokeRect(30, 30, 196, 658);
    lotusIcon(bx, 128, 300, 150, '#f2c766'); bx.fillStyle = '#e8b85a';
    for (let i = 0; i < 5; i++) { bx.beginPath(); bx.moveTo(14 + i * 57, 704); bx.lineTo(42 + i * 57, 768); bx.lineTo(70 + i * 57, 704); bx.fill(); } }
  const bannerMat = new THREE.MeshStandardMaterial({ map: texOf(bannerC), side: THREE.DoubleSide, roughness: 0.8, emissive: '#3a0a14', emissiveIntensity: 0.25 });
  const banners = [];
  for (const s2 of [-1, 1]) {
    const bxp = s2 * 2.45, bzp = 6.35;
    add(new THREE.CylinderGeometry(0.045, 0.06, 3.5, 10), teak, bxp, 1.75, bzp);
    add(new THREE.SphereGeometry(0.075, 12, 8), gold, bxp, 3.55, bzp, false);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6).rotateZ(Math.PI / 2), gold, bxp, 3.3, bzp, false);
    const geo = new THREE.PlaneGeometry(0.78, 2.3, 4, 12); geo.translate(0, -1.15, 0);
    const b = new THREE.Mesh(geo, bannerMat); b.position.set(bxp, 3.28, bzp + 0.02); b.castShadow = true; g.add(b);
    banners.push({ mesh: b, base: geo.attributes.position.array.slice(), ph: s2 * 1.3 });
    world.colliders.circles.push((() => { const p = toWorld(bxp, 0, bzp); return { x: p.x, z: p.z, r: 0.15 }; })());
  }

  // ---- incense smoke at the altar, and a wind chime at the porch
  const smoke = new SmokeSystem(Q.level === 'low' ? 60 : 140); S.add(smoke.points);
  smoke.addEmitter(new THREE.Vector3(0.95, FLOOR + 0.7, ALTAR_Z + 0.2).applyMatrix4(g.matrixWorld), { rate: 4, life: 1e9, spread: 0.01 });
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), brass, 0.95, FLOOR + 0.29, ALTAR_Z + 0.2);
  world.hutSmoke = smoke;
  const chime = new THREE.Group(); chime.position.set(0.85, EAVE - 0.15, 5.32); g.add(chime);
  chime.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14), teak));
  const tubes = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, L = 0.2 + i * 0.045, pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * 0.06, -0.03, Math.sin(a) * 0.06); chime.add(pivot);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, L, 8), brass); t.position.y = -0.08 - L / 2; pivot.add(t); tubes.push({ pivot, ph: i * 1.7 }); }

  // ---- animation: lamps follow the time of day; the altar halo and chakras breathe
  HUT.breath = null;
  world.updaters.push((dt, t) => {
    const lamps = world.lampIntensity ?? 1, night = Math.min(1, lamps / 6);
    for (const [m, base, per] of lampMats) m.emissiveIntensity = base + lamps * per;
    if (pendant) pendant.intensity = 1.6 + lamps * 1.1;
    const f = HUT.breath ?? (0.5 + 0.5 * Math.sin(t * 0.55)), active = HUT.breath != null;
    halo.scale.setScalar(0.88 + f * 0.18); haloMat.color.setScalar((0.72 + f * 0.38) * (0.88 + night * 0.3)); haloRing.scale.setScalar(0.97 + f * 0.04);
    figMat.emissiveIntensity = 0.9 + f * 0.55 + night * 0.3;
    chakras.forEach((sp, i) => { const k = Math.max(0, Math.min(1, (f * 7.4 - i) / 1.4)); sp.material.opacity = (active ? 0.15 : 0.08) + k * (active ? 0.85 : 0.5); sp.scale.setScalar(0.1 + k * 0.08); });
    for (const tb of tubes) { tb.pivot.rotation.x = Math.sin(t * 1.3 + tb.ph) * 0.08; tb.pivot.rotation.z = Math.cos(t * 1.1 + tb.ph) * 0.06; }
    poolMat.opacity = 0.18 + Math.min(0.55, lamps * 0.09);
    for (const bn of banners) { const p = bn.mesh.geometry.attributes.position, B = bn.base; for (let i = 0; i < p.count; i++) { const y = B[i * 3 + 1], k = -y / 2.3; p.setZ(i, B[i * 3 + 2] + Math.sin(t * 1.4 + bn.ph + y * 1.6) * 0.07 * k + Math.sin(t * 2.3 + B[i * 3] * 3) * 0.015 * k); } p.needsUpdate = true; }
    smoke.update(dt, t);
  });

  world.colliders.circles.push({ x: HUT.pos.x, z: HUT.pos.z, r: R_PLINTH + 0.35 });
  { const p = toWorld(0, 0, 4.9); world.colliders.circles.push({ x: p.x, z: p.z, r: 1.85 }); }
  world.pickables.push(g); g.traverse(o => { o.userData.hut = true; });
  HUT.group = g;
  return g;
}
