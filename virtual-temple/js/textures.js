import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Procedural canvas textures: carved sandstone, marble, paving, grass, water ripples,
// lotus floor markings and devotional inscriptions. No external image assets are needed.

const cache = new Map();
let maxAniso = 4;
export function setAnisotropy(a) { maxAniso = a; }

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(ctx, w, h, r, n, colors, alpha = 0.08, size = [0.5, 2]) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + r());
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}
function cloudy(ctx, w, h, r, colors, n = 60, alpha = 0.06) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = (0.05 + r() * 0.25) * w;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = colors[Math.floor(r() * colors.length)];
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
}

export function sandstone(key = 'sand', base = '#d8b98c', { blocks = true, repeat = [1, 1], rows = 4 } = {}) {
  const id = `ss:${key}:${base}:${blocks}:${rows}`;
  if (cache.has(id)) { const t = cache.get(id).clone(); t.repeat.set(...repeat); t.needsUpdate = true; return t; }
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rand(key.length * 977 + rows);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  cloudy(ctx, S, S, r, ['#f3dcb2', '#b98d5e', '#c99f6c', '#e8cc9c'], 70, 0.09);
  speckle(ctx, S, S, r, 4000, ['#8a6640', '#f5e4c2', '#a87f52'], 0.12);
  if (blocks) {
    ctx.strokeStyle = 'rgba(90,60,35,0.38)'; ctx.lineWidth = 1.4;
    const rh = S / rows;
    for (let y = 0; y < rows; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * rh + 0.5); ctx.lineTo(S, y * rh + 0.5); ctx.stroke();
      const cols = 2 + (y % 2), off = (y % 2) * (S / cols / 2);
      for (let x = 0; x <= cols; x++) { const xx = (x * S / cols + off) % S; ctx.beginPath(); ctx.moveTo(xx, y * rh); ctx.lineTo(xx, (y + 1) * rh); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,240,210,0.12)'; ctx.fillRect(0, y * rh + 1.5, S, 1.2);
    }
  }
  const t = tex(c, { repeat }); cache.set(id, t); return t;
}

export function carvedBand(base = '#cfae7f') {
  const id = 'band:' + base; if (cache.has(id)) return cache.get(id);
  const W = 512, H = 64, c = canvas(W, H), ctx = c.getContext('2d'), r = rand(7);
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, r, 1500, ['#7a5734', '#f1dcb3'], 0.12);
  ctx.strokeStyle = 'rgba(80,52,28,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(W, 6); ctx.moveTo(0, H - 6); ctx.lineTo(W, H - 6); ctx.stroke();
  // repeating lotus-petal / kirtimukha-inspired rhythm
  for (let x = 16; x < W; x += 32) {
    ctx.fillStyle = 'rgba(70,45,25,0.45)';
    ctx.beginPath(); ctx.ellipse(x, H / 2, 9, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,205,0.35)';
    ctx.beginPath(); ctx.ellipse(x - 2, H / 2 - 3, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  const t = tex(c, { repeat: [1, 1] }); cache.set(id, t); return t;
}

export function marble(key = 'marble', base = '#efe8dc', vein = 'rgba(140,120,100,0.35)', repeat = [1, 1]) {
  const id = `mb:${key}`; if (cache.has(id)) { const t = cache.get(id); t.repeat.set(...repeat); return t; }
  const S = 512, c = canvas(S), ctx = c.getContext('2d'), r = rand(key.length * 31 + 5);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  cloudy(ctx, S, S, r, ['#ffffff', '#ddd2c2', '#e8dccb'], 50, 0.15);
  ctx.strokeStyle = vein;
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.5 + r() * 1.6; ctx.beginPath();
    let x = r() * S, y = r() * S; ctx.moveTo(x, y);
    for (let k = 0; k < 30; k++) { x += (r() - 0.3) * 30; y += (r() - 0.5) * 24; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // inlaid tile grid
  ctx.strokeStyle = 'rgba(120,90,60,0.25)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  const t = tex(c, { repeat }); cache.set(id, t); return t;
}

export function paving(key = 'pave', base = '#c9b08a', repeat = [1, 1]) {
  const id = `pv:${key}:${base}`; if (cache.has(id)) { const t = cache.get(id).clone(); t.repeat.set(...repeat); t.needsUpdate = true; return t; }
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rand(base.length * 13 + key.length);
  ctx.fillStyle = '#7d6748'; ctx.fillRect(0, 0, S, S);
  const n = 4, cs = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = 0.88 + r() * 0.2;
    const col = new THREE.Color(base).multiplyScalar(l);
    ctx.fillStyle = '#' + col.getHexString();
    ctx.fillRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4);
  }
  cloudy(ctx, S, S, r, ['#efe0c0', '#9f845e'], 40, 0.08);
  speckle(ctx, S, S, r, 3000, ['#5e4a30', '#f4e8cf'], 0.12);
  const t = tex(c, { repeat }); cache.set(id, t); return t;
}

export function grass(repeat = [30, 30]) {
  const id = 'grass'; if (cache.has(id)) return cache.get(id);
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rand(42);
  ctx.fillStyle = '#5d7a3a'; ctx.fillRect(0, 0, S, S);
  cloudy(ctx, S, S, r, ['#7a9446', '#4a6a2e', '#8a9a4c', '#3f5c28'], 80, 0.12);
  for (let i = 0; i < 5000; i++) {
    ctx.strokeStyle = ['#6f8f3e', '#4c6b2a', '#87a24c', '#3b5524'][Math.floor(r() * 4)]; ctx.globalAlpha = 0.35;
    const x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = tex(c, { repeat }); cache.set(id, t); return t;
}

export function waterNormal() {
  const id = 'waterN'; if (cache.has(id)) return cache.get(id);
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
  // sum of sines height field -> normal map (tileable)
  const h = (x, y) => Math.sin((x + y * 0.3) / S * Math.PI * 8) * 0.5 + Math.sin((x * 0.6 - y) / S * Math.PI * 12) * 0.3 + Math.sin((x * 1.3 + y * 0.9) / S * Math.PI * 22) * 0.15;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
    const i = (y * S + x) * 4; img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c, { srgb: false, repeat: [3, 3] }); cache.set(id, t); return t;
}

export function radialGlow(inner = 'rgba(255,220,150,1)', outer = 'rgba(255,140,40,0)') {
  const id = 'glow:' + inner + outer; if (cache.has(id)) return cache.get(id);
  const S = 128, c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(id, t); return t;
}

export function beam() {
  const id = 'beam'; if (cache.has(id)) return cache.get(id);
  const W = 64, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,236,190,0.9)'); g.addColorStop(0.7, 'rgba(255,220,160,0.25)'); g.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const gx = ctx.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.3, 'rgba(0,0,0,0)'); gx.addColorStop(0.7, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = gx; ctx.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(id, t); return t;
}

export function lotusMark() {
  const id = 'lotusMark'; if (cache.has(id)) return cache.get(id);
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), cx = S / 2;
  ctx.translate(cx, cx);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
  const petals = (n, len, wid, rot) => { for (let i = 0; i < n; i++) { ctx.save(); ctx.rotate(rot + i * Math.PI * 2 / n); ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(wid, -len * 0.55, 0, -len); ctx.quadraticCurveTo(-wid, -len * 0.55, 0, -18); ctx.fill(); ctx.stroke(); ctx.restore(); } };
  petals(16, 118, 26, Math.PI / 16); petals(8, 92, 30, 0);
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 124, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(id, t); return t;
}

export function inscription(text, { w = 1024, h = 192, color = '#f3d38a', bg = '#5a1b16', font = '"Tiro Devanagari Sanskrit", "Mukta", serif' } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 4; ctx.strokeRect(10, 10, w - 20, h - 20); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(h * 0.48)}px ${font}`; ctx.fillText(text, w / 2, h / 2 + h * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}

export function domeCeiling() {
  const id = 'domeCeil'; if (cache.has(id)) return cache.get(id);
  // equirect-ish texture mapped onto a hemisphere: concentric corbelled rings with petal friezes
  const W = 1024, H = 512, c = canvas(W, H), ctx = c.getContext('2d'), r = rand(9);
  ctx.fillStyle = '#e9dcc6'; ctx.fillRect(0, 0, W, H);
  const rings = 9;
  for (let i = 0; i < rings; i++) {
    const y0 = (i / rings) * H, y1 = ((i + 1) / rings) * H;
    ctx.fillStyle = i % 2 ? '#e2d2b8' : '#f1e6d2'; ctx.fillRect(0, y0, W, y1 - y0);
    ctx.fillStyle = 'rgba(95,60,35,0.35)'; ctx.fillRect(0, y1 - 3, W, 3);
    ctx.fillStyle = 'rgba(255,250,240,0.5)'; ctx.fillRect(0, y0, W, 2);
    const n = 24 + i * 4, step = W / n;
    for (let k = 0; k < n; k++) {
      const x = k * step + step / 2, cy = (y0 + y1) / 2;
      if (i % 3 === 1) { ctx.fillStyle = 'rgba(150,40,30,0.25)'; ctx.beginPath(); ctx.ellipse(x, cy, step * 0.28, (y1 - y0) * 0.36, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (i % 3 === 2) { ctx.fillStyle = 'rgba(176,130,52,0.45)'; ctx.beginPath(); ctx.moveTo(x, y0 + 4); ctx.lineTo(x + step * 0.35, cy); ctx.lineTo(x, y1 - 6); ctx.lineTo(x - step * 0.35, cy); ctx.closePath(); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(95,60,35,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y1 - 4, step * 0.4, Math.PI, 0); ctx.stroke(); }
    }
  }
  speckle(ctx, W, H, r, 6000, ['#8a6a48', '#ffffff'], 0.08);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = maxAniso; cache.set(id, t); return t;
}

export function jali() {
  const id = 'jali'; if (cache.has(id)) return cache.get(id);
  const S = 256, c = canvas(S), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'destination-out';
  const n = 6, s = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cx = x * s + s / 2, cy = y * s + s / 2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? s * 0.2 : s * 0.42; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set(id, t); return t;
}

export function featherTexture() {
  const id = 'feather'; if (cache.has(id)) return cache.get(id);
  const W = 128, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.translate(W / 2, H);
  ctx.strokeStyle = 'rgba(40,120,90,0.9)'; ctx.lineWidth = 1;
  for (let i = 0; i < 80; i++) { const y = -i * 2.8; const sp = Math.sin(i / 80 * Math.PI) * 50; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-sp, y - 18); ctx.moveTo(0, y); ctx.lineTo(sp, y - 18); ctx.stroke(); }
  const eye = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -170, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill(); };
  eye(34, 'rgba(30,140,90,0.95)'); eye(25, 'rgba(200,160,50,0.95)'); eye(18, 'rgba(20,70,140,1)'); eye(9, 'rgba(10,20,50,1)');
  ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -200); ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(id, t); return t;
}

export function softDot() {
  const id = 'softDot'; if (cache.has(id)) return cache.get(id);
  const S = 64, c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); cache.set(id, t); return t;
}

export function tripundra() {
  const id = 'tripundra'; if (cache.has(id)) return cache.get(id);
  const W = 512, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#1d1a19'; ctx.fillRect(0, 0, W, H);
  const r = rand(3); speckle(ctx, W, H, r, 2500, ['#3a3531', '#0d0b0a'], 0.4);
  // three horizontal bands of vibhuti across the front (u around 0.25 faces +z after mapping)
  ctx.fillStyle = 'rgba(240,236,226,0.92)';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W * 0.13, H * (0.36 + i * 0.07), W * 0.24, H * 0.035, 6) : ctx.rect(W * 0.13, H * (0.36 + i * 0.07), W * 0.24, H * 0.035); ctx.fill(); }
  ctx.fillStyle = '#b3121b'; ctx.beginPath(); ctx.arc(W * 0.25, H * 0.43, 7, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(id, t); return t;
}
