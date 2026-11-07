import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Paintings for the prayer halls, drawn in code: fresco murals in the manner of Indian temple wall painting (ochre plaster,
// a red and gold border with a creeper, a cusped arch, and a scene: peacocks under a tree of life, swans in a lotus pond, a
// garlanded elephant under a parasol, or a lotus mandala), a painted ceiling of concentric lotus rings, stars and marigold
// swags, and stained glass in deep jewel colours.

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// ---------------------------------------------------------------- shared motifs
function lotusFlower(x, cx, cy, s, petal = '#f29ab4', tip = '#e05a8a') {
  for (const [n, len, wid, rot] of [[8, 1, 0.34, 0], [6, 0.78, 0.36, Math.PI / 6]]) for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / (n + 1)) + rot * 0;
    x.save(); x.translate(cx, cy); x.rotate(a + Math.PI / 2);
    const g = x.createLinearGradient(0, 0, 0, -s * len); g.addColorStop(0, '#fff2f4'); g.addColorStop(0.6, petal); g.addColorStop(1, tip);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(s * wid, -s * len * 0.5, 0, -s * len); x.quadraticCurveTo(-s * wid, -s * len * 0.5, 0, 0); x.fill();
    x.strokeStyle = 'rgba(120,30,60,0.35)'; x.lineWidth = 1; x.stroke(); x.restore();
  }
  x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(cx, cy - s * 0.08, s * 0.12, 0, Math.PI * 2); x.fill();
}
function leafSpray(x, cx, cy, s, ang, r) {
  for (let i = 0; i < 5; i++) { x.save(); x.translate(cx, cy); x.rotate(ang + (i - 2) * 0.45); x.fillStyle = ['#3f7a34', '#4f8a3c', '#2f6a2c'][i % 3];
    x.beginPath(); x.ellipse(0, -s * 0.5, s * 0.16, s * 0.5, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  void r;
}
function peacock(x, cx, cy, s, flip) {
  x.save(); x.translate(cx, cy); x.scale(flip ? -1 : 1, 1);
  // the tail, a long fan of eyes trailing behind and down
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.13 + i * 0.034), L = s * (1.25 - Math.abs(i - 4) * 0.05);   // trailing behind, down to the ground
    x.strokeStyle = '#2f7a4a'; x.lineWidth = s * 0.05; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * L, Math.sin(a) * L); x.stroke();
    for (let k = 1; k <= 3; k++) { const ex = Math.cos(a) * L * k / 3, ey = Math.sin(a) * L * k / 3;
      x.fillStyle = '#1f9a8a'; x.beginPath(); x.ellipse(ex, ey, s * 0.09, s * 0.12, a, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f2c43a'; x.beginPath(); x.ellipse(ex, ey, s * 0.05, s * 0.07, a, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1a2a8a'; x.beginPath(); x.arc(ex, ey, s * 0.03, 0, Math.PI * 2); x.fill(); } }
  // body, neck and head
  x.fillStyle = '#1f5aa8'; x.beginPath(); x.ellipse(0, -s * 0.05, s * 0.32, s * 0.2, -0.2, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#1f5aa8'; x.lineWidth = s * 0.12; x.lineCap = 'round'; x.beginPath(); x.moveTo(-s * 0.18, -s * 0.12); x.quadraticCurveTo(-s * 0.32, -s * 0.45, -s * 0.22, -s * 0.62); x.stroke();
  x.fillStyle = '#1f5aa8'; x.beginPath(); x.arc(-s * 0.22, -s * 0.66, s * 0.08, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f2c43a'; x.beginPath(); x.moveTo(-s * 0.3, -s * 0.66); x.lineTo(-s * 0.4, -s * 0.63); x.lineTo(-s * 0.3, -s * 0.62); x.fill();
  for (let k = 0; k < 3; k++) { x.strokeStyle = '#1f5aa8'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-s * 0.22, -s * 0.73); x.lineTo(-s * 0.26 + k * s * 0.04, -s * 0.86); x.stroke(); x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(-s * 0.26 + k * s * 0.04, -s * 0.87, 2, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-s * 0.25, -s * 0.67, s * 0.02, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#7a4a2a'; x.lineWidth = s * 0.04; x.beginPath(); x.moveTo(-s * 0.05, s * 0.12); x.lineTo(-s * 0.08, s * 0.4); x.moveTo(s * 0.08, s * 0.12); x.lineTo(s * 0.06, s * 0.4); x.stroke();
  x.restore();
}
function swan(x, cx, cy, s, flip) {
  x.save(); x.translate(cx, cy); x.scale(flip ? -1 : 1, 1);
  x.fillStyle = '#f7f2ea'; x.beginPath(); x.moveTo(-s * 0.5, 0); x.quadraticCurveTo(-s * 0.4, s * 0.3, s * 0.3, s * 0.18); x.quadraticCurveTo(s * 0.6, s * 0.05, s * 0.5, -s * 0.25); x.quadraticCurveTo(s * 0.2, -s * 0.05, -s * 0.5, 0); x.fill();
  x.strokeStyle = '#f7f2ea'; x.lineWidth = s * 0.1; x.lineCap = 'round'; x.beginPath(); x.moveTo(-s * 0.4, 0); x.bezierCurveTo(-s * 0.7, -s * 0.3, -s * 0.3, -s * 0.6, -s * 0.5, -s * 0.8); x.stroke();
  x.fillStyle = '#e8862a'; x.beginPath(); x.moveTo(-s * 0.55, -s * 0.82); x.lineTo(-s * 0.72, -s * 0.78); x.lineTo(-s * 0.55, -s * 0.75); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(-s * 0.52, -s * 0.83, s * 0.025, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(160,140,120,0.6)'; x.lineWidth = 1.2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(-s * 0.1 + k * s * 0.12, s * 0.02); x.quadraticCurveTo(s * 0.1 + k * s * 0.1, -s * 0.12, s * 0.35, -s * 0.15 + k * s * 0.02); x.stroke(); }
  x.restore();
}
function elephant(x, cx, cy, s) {
  x.save(); x.translate(cx, cy);
  const grey = '#8a8a9c', dark = '#5e5e74';
  for (const lx of [-0.42, -0.2, 0.18, 0.4]) { x.fillStyle = lx < 0 ? dark : grey; x.beginPath(); x.roundRect(s * lx - s * 0.08, s * 0.05, s * 0.16, s * 0.42, s * 0.05); x.fill(); }
  x.fillStyle = grey; x.beginPath(); x.ellipse(0, -s * 0.05, s * 0.55, s * 0.32, 0, 0, Math.PI * 2); x.fill();
  // the caparison: a red cloth with a gold border and a fringe of tassels
  x.fillStyle = '#b8241e'; x.beginPath(); x.moveTo(-s * 0.3, -s * 0.34); x.lineTo(s * 0.32, -s * 0.34); x.lineTo(s * 0.36, s * 0.08); x.lineTo(-s * 0.34, s * 0.08); x.closePath(); x.fill();
  x.strokeStyle = '#f2c43a'; x.lineWidth = s * 0.03; x.stroke();
  for (let i = 0; i < 9; i++) { x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(-s * 0.3 + i * s * 0.08, s * 0.11, s * 0.02, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#f2c43a'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(-s * 0.18 + i * s * 0.12, -s * 0.13, s * 0.035, 0, Math.PI * 2); x.fill(); }
  // head, ear, eye, tusk and the trunk lifting a garland
  x.fillStyle = grey; x.beginPath(); x.ellipse(s * 0.58, -s * 0.18, s * 0.24, s * 0.26, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = dark; x.beginPath(); x.ellipse(s * 0.48, -s * 0.16, s * 0.15, s * 0.22, 0.2, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#b8241e'; x.beginPath(); x.ellipse(s * 0.66, -s * 0.36, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(s * 0.66, -s * 0.22, s * 0.025, 0, Math.PI * 2); x.fill();
  x.strokeStyle = grey; x.lineWidth = s * 0.1; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * 0.74, -s * 0.08); x.bezierCurveTo(s * 0.9, s * 0.1, s * 1.0, -s * 0.2, s * 0.92, -s * 0.42); x.stroke();
  x.strokeStyle = '#f7f2ea'; x.lineWidth = s * 0.04; x.beginPath(); x.moveTo(s * 0.68, -s * 0.03); x.quadraticCurveTo(s * 0.8, s * 0.06, s * 0.86, -s * 0.02); x.stroke();
  for (let i = 0; i < 10; i++) { const a = Math.PI * 0.15 + i / 9 * Math.PI * 0.7; x.fillStyle = i % 2 ? '#f29a17' : '#f6c025'; x.beginPath(); x.arc(s * 0.92 + Math.cos(a) * s * 0.16, -s * 0.42 + Math.sin(a) * s * 0.2, s * 0.035, 0, Math.PI * 2); x.fill(); }
  // a ceremonial parasol held over its back
  x.strokeStyle = '#7a4a2a'; x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(0, -s * 0.34); x.lineTo(0, -s * 0.8); x.stroke();
  x.fillStyle = '#e8862a'; x.beginPath(); x.moveTo(-s * 0.3, -s * 0.78); x.quadraticCurveTo(0, -s * 1.02, s * 0.3, -s * 0.78); x.closePath(); x.fill();
  for (let i = 0; i < 7; i++) { x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(-s * 0.27 + i * s * 0.09, -s * 0.76, s * 0.025, 0, Math.PI * 2); x.fill(); }
  x.restore();
}

// ---------------------------------------------------------------- a fresco panel
export function frescoTexture(kind, seed = 3) {
  const W = 512, H = 640, c = canvas(W, H), x = c.getContext('2d'), r = rnd(seed);
  // ochre plaster, mottled
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#d89a54'); bg.addColorStop(1, '#c4783e'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,180,0.06)' : 'rgba(90,40,10,0.06)'; x.beginPath(); x.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2); x.fill(); }
  // the border: red, a gold rule with dots, and a creeper of leaves and red buds
  x.fillStyle = '#8a1f1a'; x.fillRect(0, 0, W, 34); x.fillRect(0, H - 34, W, 34); x.fillRect(0, 0, 34, H); x.fillRect(W - 34, 0, 34, H);
  x.strokeStyle = '#e8b84a'; x.lineWidth = 4; x.strokeRect(36, 36, W - 72, H - 72); x.lineWidth = 2; x.strokeRect(46, 46, W - 92, H - 92);
  for (let t = 0; t < 1; t += 1 / 44) { for (const [px, py] of [[17 + t * (W - 34), 17], [17 + t * (W - 34), H - 17], [17, 17 + t * (H - 34)], [W - 17, 17 + t * (H - 34)]]) {
    x.fillStyle = '#3f7a34'; x.beginPath(); x.ellipse(px, py, 5, 3, t * 40, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e04a2a'; x.beginPath(); x.arc(px + 4, py - 2, 2.4, 0, Math.PI * 2); x.fill(); } }
  // the cusped arch framing the scene
  const ax = W / 2, ay = 190, ar = W / 2 - 60;
  const arch = () => { x.beginPath(); x.moveTo(60, H - 60); x.lineTo(60, ay);
    for (let i = 0; i <= 6; i++) { const a0 = Math.PI + i * Math.PI / 7, a1 = Math.PI + (i + 1) * Math.PI / 7; const mx = ax + Math.cos((a0 + a1) / 2) * ar, my = ay + Math.sin((a0 + a1) / 2) * ar * 0.8; x.quadraticCurveTo(mx, my - 18, ax + Math.cos(a1) * ar, ay + Math.sin(a1) * ar * 0.8); }
    x.lineTo(W - 60, H - 60); x.closePath(); };
  const [c0, c1] = { peacocks: ['#f2e2b8', '#d8b07a'], lotus: ['#f4c088', '#cf6e44'], elephant: ['#c4d8c2', '#8cb094'], mandala: ['#a4302a', '#6a1a16'] }[kind] || ['#f2e2b8', '#d8b07a'];
  const sky = x.createLinearGradient(0, ay - ar * 0.8, 0, H - 60); sky.addColorStop(0, c0); sky.addColorStop(1, c1);
  arch(); x.fillStyle = sky; x.fill();
  x.save(); arch(); x.clip(); for (let i = 0; i < 260; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,210,0.07)' : 'rgba(80,30,10,0.06)'; x.beginPath(); x.arc(r() * W, r() * H, 3 + r() * 10, 0, Math.PI * 2); x.fill(); } x.restore();
  x.strokeStyle = '#e8b84a'; x.lineWidth = 5; arch(); x.stroke();
  x.strokeStyle = '#8a1f1a'; x.lineWidth = 2; x.save(); x.translate(W / 2, H / 2); x.scale(1.03, 1.02); x.translate(-W / 2, -H / 2); arch(); x.stroke(); x.restore();
  // the scene
  if (kind === 'peacocks') {
    x.strokeStyle = '#6a3a1e'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.moveTo(W / 2, H - 70); x.bezierCurveTo(W / 2 - 20, 420, W / 2 + 20, 300, W / 2, 200); x.stroke();
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42, L = 90 + r() * 40; x.lineWidth = 6; x.beginPath(); x.moveTo(W / 2, 240 + i * 14); x.quadraticCurveTo(W / 2 + Math.cos(a) * L * 0.5, 230 + Math.sin(a) * L * 0.4, W / 2 + Math.cos(a) * L * 1.3, 220 + Math.sin(a) * L * 0.9 + i * 10); x.stroke(); }
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()), px = W / 2 + Math.cos(a) * d * 170, py = 230 + Math.sin(a) * d * 110; leafSpray(x, px, py, 22, r() * 6, r); }
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()), px = W / 2 + Math.cos(a) * d * 160, py = 230 + Math.sin(a) * d * 100; x.fillStyle = r() < 0.5 ? '#e04a2a' : '#f6a8c4'; x.beginPath(); x.arc(px, py, 6, 0, Math.PI * 2); x.fill(); x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(px, py, 2, 0, Math.PI * 2); x.fill(); }
    peacock(x, W / 2 - 78, H - 190, 104, true); peacock(x, W / 2 + 78, H - 190, 104, false);   // facing each other across the tree
  } else if (kind === 'lotus') {
    const sg = x.createRadialGradient(W / 2, 260, 10, W / 2, 260, 90); sg.addColorStop(0, '#fff2b0'); sg.addColorStop(1, 'rgba(242,196,58,0)'); x.fillStyle = sg; x.beginPath(); x.arc(W / 2, 260, 90, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.strokeStyle = '#f2c43a'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * 44, 260 + Math.sin(a) * 44); x.lineTo(W / 2 + Math.cos(a) * 70, 260 + Math.sin(a) * 70); x.stroke(); }
    x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(W / 2, 260, 36, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2f6a7a'; x.fillRect(60, 420, W - 120, H - 480);
    for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(200,240,240,0.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(70, 440 + i * 22); for (let px = 70; px < W - 70; px += 20) x.quadraticCurveTo(px + 5, 435 + i * 22, px + 10, 440 + i * 22); x.stroke(); }
    for (let i = 0; i < 9; i++) { x.fillStyle = '#3f8a44'; x.beginPath(); x.ellipse(90 + i * 42, 470 + (i % 3) * 40, 22, 9, 0, 0.3, Math.PI * 2 - 0.3); x.lineTo(90 + i * 42, 470 + (i % 3) * 40); x.fill(); }
    for (const [px, py, s] of [[130, 470, 46], [W - 130, 480, 46], [W / 2, 540, 52], [200, 560, 36], [W - 200, 555, 36]]) lotusFlower(x, px, py, s);
    swan(x, W / 2 - 110, 420, 90, false); swan(x, W / 2 + 110, 420, 90, true);
    for (let i = 0; i < 4; i++) { x.strokeStyle = '#5a2a1a'; x.lineWidth = 2; const bx = 140 + i * 70, by = 320 + (i % 2) * 20; x.beginPath(); x.moveTo(bx - 10, by); x.quadraticCurveTo(bx - 5, by - 7, bx, by); x.quadraticCurveTo(bx + 5, by - 7, bx + 10, by); x.stroke(); }
  } else if (kind === 'elephant') {
    x.fillStyle = '#7a8a3a'; x.fillRect(60, 500, W - 120, H - 560);
    for (let i = 0; i < 16; i++) lotusFlower(x, 80 + i * 24, 520 + (i % 2) * 14, 14, '#f6c0cc', '#e8862a');
    elephant(x, W / 2 - 60, 420, 150);
    for (let i = 0; i < 5; i++) { const px = 90 + i * 80; x.fillStyle = '#3f7a34'; x.beginPath(); x.ellipse(px, 250, 26, 40, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#6a3a1e'; x.fillRect(px - 3, 280, 6, 30); }
  } else {
    const cx = W / 2, cy = 360;
    x.fillStyle = 'rgba(242,196,58,0.25)'; x.beginPath(); x.arc(cx, cy, 168, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#f2c43a'; x.lineWidth = 3; x.stroke();
    for (let ring = 4; ring >= 0; ring--) { const n = 8 + ring * 4, R0 = 22 + ring * 24; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + ring * 0.2;
      x.save(); x.translate(cx + Math.cos(a) * R0 * 0.55, cy + Math.sin(a) * R0 * 0.55); x.rotate(a + Math.PI / 2);
      x.fillStyle = ['#b8241e', '#e8862a', '#1f6a7a', '#f29ab4', '#f2c43a'][ring]; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(R0 * 0.22, -R0 * 0.45, 0, -R0 * 0.9); x.quadraticCurveTo(-R0 * 0.22, -R0 * 0.45, 0, 0); x.fill();
      x.strokeStyle = '#f2c43a'; x.lineWidth = 1.5; x.stroke(); x.restore(); } }
    x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(cx, cy, 22, 0, Math.PI * 2); x.fill(); x.fillStyle = '#b8241e'; x.beginPath(); x.arc(cx, cy, 10, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 20; i++) leafSpray(x, 100 + (i % 10) * 35, i < 10 ? 168 : 560, 16, i < 10 ? Math.PI : 0, r);
    for (const [px, py] of [[110, 560], [W - 110, 560]]) lotusFlower(x, px, py, 34);
  }
  // age: a soft vignette and fine cracks in the plaster
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,25,5,0.35)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(60,30,10,0.18)'; x.lineWidth = 0.8;
  for (let i = 0; i < 26; i++) { let px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
  return tex(c);
}

// ---------------------------------------------------------------- the painted ceiling (unwrapped: the top row is the crown of the dome)
export function ceilingTexture() {
  const W = 2048, H = 512, c = canvas(W, H), x = c.getContext('2d');
  const band = (y0, y1, col) => { x.fillStyle = col; x.fillRect(0, y0, W, y1 - y0); };
  const gold = '#e8b84a';
  // a golden sun at the crown: stripes that converge into rays
  for (let i = 0; i < 48; i++) { x.fillStyle = i % 2 ? '#f2c43a' : '#e8862a'; x.fillRect(i * W / 48, 0, W / 48 + 1, 64); }
  band(64, 74, '#8a1f1a'); for (let i = 0; i < 96; i++) { x.fillStyle = gold; x.beginPath(); x.arc((i + 0.5) * W / 96, 69, 3, 0, Math.PI * 2); x.fill(); }
  // a ring of pink lotus petals on deep blue
  band(74, 180, '#1d2a5a');
  for (let i = 0; i < 24; i++) { const cx = (i + 0.5) * W / 24, pw = W / 24 * 0.42; const g = x.createLinearGradient(0, 78, 0, 176); g.addColorStop(0, '#fff2f4'); g.addColorStop(1, '#e05a8a');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx - pw, 78); x.quadraticCurveTo(cx - pw, 150, cx, 176); x.quadraticCurveTo(cx + pw, 150, cx + pw, 78); x.closePath(); x.fill(); x.strokeStyle = gold; x.lineWidth = 3; x.stroke(); }
  band(180, 192, gold);
  // a band of gold stars on midnight blue
  band(192, 300, '#162050');
  const star = (cx, cy, r0) => { x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? r0 * 0.42 : r0; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
  for (let i = 0; i < 36; i++) { x.fillStyle = gold; star((i + 0.5) * W / 36, 246, 22); x.fillStyle = '#b8241e'; x.beginPath(); x.arc((i + 0.5) * W / 36, 246, 5, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(255,230,160,0.7)'; x.beginPath(); x.arc(Math.random() * W, 196 + Math.random() * 100, 1.2, 0, Math.PI * 2); x.fill(); }
  band(300, 314, gold); for (let i = 0; i < 64; i++) { x.fillStyle = '#b8241e'; const cx = (i + 0.5) * W / 64; x.beginPath(); x.moveTo(cx, 301); x.lineTo(cx + 6, 307); x.lineTo(cx, 313); x.lineTo(cx - 6, 307); x.fill(); }
  // a larger ring of teal petals with small flowers between
  band(314, 430, '#1f4a5a');
  for (let i = 0; i < 36; i++) { const cx = (i + 0.5) * W / 36, pw = W / 36 * 0.4; const g = x.createLinearGradient(0, 318, 0, 426); g.addColorStop(0, '#9fd8c8'); g.addColorStop(1, '#1f7a6a');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx - pw, 318); x.quadraticCurveTo(cx - pw, 400, cx, 426); x.quadraticCurveTo(cx + pw, 400, cx + pw, 318); x.closePath(); x.fill(); x.strokeStyle = gold; x.lineWidth = 2.5; x.stroke();
    const fx = cx + W / 72; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.fillStyle = '#f29ab4'; x.beginPath(); x.ellipse(fx + Math.cos(a) * 7, 400 + Math.sin(a) * 7, 6, 3.5, a, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(fx, 400, 3.5, 0, Math.PI * 2); x.fill(); }
  // marigold swags and little bells on red, round the rim
  band(430, 512, '#8a1f1a'); band(430, 438, gold); band(504, 512, gold);
  for (let i = 0; i < 32; i++) { const x0 = i * W / 32, x1 = (i + 1) * W / 32; for (let k = 0; k <= 14; k++) { const t = k / 14, px = x0 + (x1 - x0) * t, py = 448 + Math.sin(t * Math.PI) * 30; x.fillStyle = k % 3 ? '#f29a17' : '#f6c025'; x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = gold; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, 440); x.lineTo(x0, 470); x.stroke(); x.fillStyle = gold; x.beginPath(); x.moveTo(x0 - 6, 482); x.quadraticCurveTo(x0, 462, x0 + 6, 482); x.closePath(); x.fill(); }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- stained glass for the hall windows
export function stainedGlassTexture(blur = false) {
  const W = 256, H = 384, c = canvas(W, H), x = c.getContext('2d'), r = rnd(29);
  const pal = ['#1f3aa8', '#b81e3a', '#1f8a5a', '#e8a21e', '#d24a8a', '#2a8ab8'];
  x.fillStyle = '#1f3aa8'; x.fillRect(0, 0, W, H);
  // diamond panes
  const D = 32; for (let j = -1; j < H / D * 2 + 2; j++) for (let i = -1; i < W / D + 2; i++) { const cx = i * D + (j % 2 ? D / 2 : 0), cy = j * D / 2;
    x.fillStyle = pal[Math.floor(r() * pal.length)]; x.beginPath(); x.moveTo(cx, cy - D / 2); x.lineTo(cx + D / 2, cy); x.lineTo(cx, cy + D / 2); x.lineTo(cx - D / 2, cy); x.closePath(); x.fill(); }
  // a lotus in the middle, in warm glass
  const cx = W / 2, cy = H * 0.55;
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38; x.save(); x.translate(cx, cy); x.rotate(a + Math.PI / 2); x.fillStyle = i % 2 ? '#f29ab4' : '#e05a8a'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(26, -60, 0, -110); x.quadraticCurveTo(-26, -60, 0, 0); x.fill(); x.restore(); }
  x.fillStyle = '#f2c43a'; x.beginPath(); x.arc(cx, cy - 6, 16, 0, Math.PI * 2); x.fill();
  // the lead lines
  x.strokeStyle = '#2a1a10'; x.lineWidth = blur ? 0 : 4;
  if (!blur) { for (let j = -1; j < H / D * 2 + 2; j++) for (let i = -1; i < W / D + 2; i++) { const px = i * D + (j % 2 ? D / 2 : 0), py = j * D / 2; x.beginPath(); x.moveTo(px, py - D / 2); x.lineTo(px + D / 2, py); x.lineTo(px, py + D / 2); x.lineTo(px - D / 2, py); x.closePath(); x.stroke(); }
    x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6); }
  if (blur) { const b = canvas(32, 48), bx = b.getContext('2d'); bx.drawImage(c, 0, 0, 32, 48); const out = canvas(128, 192), ox = out.getContext('2d'); ox.imageSmoothingEnabled = true; ox.drawImage(b, 0, 0, 128, 192);
    const g = ox.createRadialGradient(64, 96, 20, 64, 96, 96); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); ox.globalCompositeOperation = 'destination-out'; ox.fillStyle = g; ox.fillRect(0, 0, 128, 192); return tex(out); }
  return tex(c);
}
