import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { softDot } from './textures.js';
import { shikhara } from './architecture.js';

// The living backdrop around the campus: layered mountain ranges, three great waterfalls with
// mist and a river, drifting clouds and valley mist, flocks of egrets, crows and parakeets,
// pigeons around the spires, butterflies over the flower beds, golden motes of light (fireflies by night), stars
// and the moon. Everything reacts to the time-of-day state passed to `update()`.

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
const ridged = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; } return s; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const FALLS = [-Math.PI * 0.5, -Math.PI * 0.68, -Math.PI * 0.31]; // north, north-west, north-east
// aerial perspective: beyond the campus, each layer further away fades a little more into the colour of the haze, so ridges
// read one behind another the way they do in a painting
const HAZE = { value: 0.5 };
function hazeShader(sh, k = 1) {
  sh.uniforms.uHaze = HAZE;
  sh.fragmentShader = 'uniform float uHaze;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
    #ifdef USE_FOG
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(110.0, 420.0, vFogDepth) * uHaze * ${k.toFixed(2)});
    #endif`);
}
function hazy(mat, k = 1) { const prev = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); hazeShader(sh, k); }; mat.customProgramCacheKey = () => 'hazy' + k; return mat; }
const PALACE_A = -Math.PI * 0.405;   // the palace on the hill, framed between the north and north-east falls
const CASCADES = [-Math.PI * 0.585, -Math.PI * 0.245, -Math.PI * 0.79, -Math.PI * 0.12];   // streams tumbling down the near slopes
const HILL_TEMPLES = [[-Math.PI * 0.9, 158, 1.0], [-Math.PI * 0.06, 162, 0.9], [-Math.PI * 0.66, 186, 0.75]];   // smaller temples on the far hills

export class Scenery {
  constructor(scene, quality, water, beds = []) {
    this.scene = scene; this.quality = quality; this.water = water; this.beds = beds;
    this.uTime = { value: 0 };
    this.group = new THREE.Group(); scene.add(this.group);
    this.followers = new THREE.Group(); scene.add(this.followers); // sky elements that stay centred on the viewer
    this._mountains();
    this._falls();
    this._clouds();
    this._palace();
    this._cascades();
    this._hillTemples();
    this._flocks();
    this._butterflies();
    this._night();
  }

  // ------------------------------------------------------------ mountains
  _ring(r0, r1, segA, segR, heightFn, colorFn) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (let j = 0; j <= segR; j++) for (let i = 0; i <= segA; i++) {
      const a = i / segA * Math.PI * 2, r = r0 + (r1 - r0) * j / segR, h = heightFn(r, a);
      pos.push(Math.cos(a) * r, h, Math.sin(a) * r); colorFn(c, h, r, a); col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + 1, d = a + segA + 1, e = d + 1; idx.push(a, b, d, b, e, d); }   // wound so the surface faces up (it was upside down, so the hills were culled from above)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  _mountains() {
    const low = this.quality.level === 'low';
    // near range: forested ridges with rocky cliffs where the waterfalls drop
    this.nearHeight = (r, a, cliff = false) => {   // cliff: the height before the gorge is carved (the top of a waterfall)
      const rise = smooth(92, 150, r) * (1 - smooth(185, 215, r) * 0.35);
      const south = 0.45 + 0.55 * smooth(0.3, 1.4, Math.abs(dAng(a, Math.PI / 2)));      // lower toward the gate side
      let h = (22 + 58 * ridged(a * 3.2 + 4, r * 0.012, 5)) * (0.55 + 0.6 * fbm(a * 5, r * 0.03, 3)) * south;
      for (const fa of FALLS) h += 46 * Math.exp(-Math.pow(dAng(a, fa) / 0.11, 2)) * smooth(100, 135, r);
      // a gorge in front of each cliff, so the waterfall drops all the way to its pool in plain view
      let gorge = 0; FALLS.forEach((fa, fi) => { const rTop = 128 + fi * 6, w = fi === 0 ? 0.085 : 0.065; gorge = Math.max(gorge, Math.exp(-Math.pow(dAng(a, fa) / w, 2)) * (1 - smooth(rTop - 5, rTop + 2, r))); });
      return rise * h * (1 - (cliff ? 0 : gorge) * 0.94) - 2;
    };
    const greens = [new THREE.Color('#4c8a36'), new THREE.Color('#3b7430'), new THREE.Color('#6da444')], rock = new THREE.Color('#8a7a66'), tmp = new THREE.Color();
    const near = this._ring(92, 215, low ? 140 : 220, low ? 14 : 22, this.nearHeight, (c, h, r, a) => {
      // broad, soft patches of forest green and lighter meadow (no per-triangle speckle), greener and darker low down
      const pn = fbm(a * 14 + 2, r * 0.04, 3); c.copy(greens[1]).lerp(greens[0], smooth(0.3, 0.6, pn)).lerp(greens[2], smooth(0.55, 0.8, pn) * 0.7 + smooth(0, 40, h) * 0.2); void hash;
      const cliff = Math.max(...FALLS.map(fa => Math.exp(-Math.pow(dAng(a, fa) / 0.07, 2)))) * smooth(10, 40, h);
      c.lerp(rock, Math.min(1, cliff * 1.2 + smooth(55, 85, h) * 0.6 + (fbm(a * 30, r * 0.1, 2) > 0.62 ? 0.3 : 0)));
    });
    this.nearMat = hazy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 0.55);   // smooth, rolling slopes
    const nm = new THREE.Mesh(near, this.nearMat); nm.receiveShadow = false; this.group.add(nm);
    // far range: tall blue peaks with snow, fading into haze
    const far = this._ring(240, 360, low ? 120 : 180, low ? 8 : 12, (r, a) => {
      const rise = smooth(240, 290, r);
      return rise * (60 + 130 * ridged(a * 2.4 + 11, r * 0.008, 5)) * (0.75 + 0.35 * fbm(a * 3 + 7, 1.3, 3));
    }, (c, h) => { c.set('#5b6f72').lerp(tmp.set('#7d8a84'), smooth(40, 120, h)); if (h > 125) c.lerp(tmp.set('#f2f4f6'), smooth(125, 150, h)); });
    this.farMat = hazy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.8);
    this.group.add(new THREE.Mesh(far, this.farMat));
    // forest on the near slopes: thousands of painted canopy cards that always face you, packed so the crowns overlap into one
    // continuous, lumpy forest (lit from the sun's side, darker underneath), with groves of pink blossom. Cheap on phones:
    // one draw for the whole forest.
    const n = low ? 1800 : 4400;
    const tex = this._canopyAtlas();
    const card = new THREE.PlaneGeometry(1, 1); card.translate(0, 0.42, 0);
    { const nr = card.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0); }   // lit like the ground it stands on
    const cell = new Float32Array(n), mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, transparent: false });
    mat.onBeforeCompile = (sh) => { hazeShader(sh, 0.45);
      sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  #ifdef USE_MAP\n  vMapUv = (uv + vec2(mod(aCell, 2.0), floor(aCell / 2.0))) * 0.5;\n  #endif')
        .replace('#include <project_vertex>', `
          vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bsx = length(instanceMatrix[0].xyz), bsy = length(instanceMatrix[1].xyz);
          vec4 mvPosition = mvCenter + vec4(transformed.x * bsx, transformed.y * bsy, 0.0, 0.0);
          gl_Position = projectionMatrix * mvPosition;`);
    };
    const trees = new THREE.InstancedMesh(card, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let k = 0;
    const groveAt = (a) => fbm(a * 9 + 3, 0.5, 2) > 0.62;   // blossom grows in groves, not scattered
    for (let i = 0; k < n && i < n * 4; i++) {
      const a = Math.random() * Math.PI * 2, r = 100 + Math.pow(Math.random(), 0.8) * 100, h = this.nearHeight(r, a);
      if (h < 0.5 || h > 64 || FALLS.some(fa => Math.abs(dAng(a, fa)) < 0.1) || (Math.abs(dAng(a, PALACE_A)) < 0.17 && r > 135) || CASCADES.some(ca => Math.abs(dAng(a, ca)) < 0.035) || HILL_TEMPLES.some(([ta]) => Math.abs(dAng(a, ta)) < 0.09)) continue;
      const s2 = (6.5 + Math.random() * 5.5) * (0.8 + r / 400), bloom = groveAt(a) && Math.random() < 0.5;
      m.compose(new THREE.Vector3(Math.cos(a) * r, h - s2 * 0.12, Math.sin(a) * r), q, new THREE.Vector3(s2 * (0.95 + Math.random() * 0.3), s2, 1)); trees.setMatrixAt(k, m);
      cell[k] = bloom ? 3 : Math.floor(Math.random() * 3);
      const v = 1.0 + Math.random() * 0.28; trees.setColorAt(k++, c.setRGB(v, v * (0.98 + Math.random() * 0.06), v * 0.92));
    }
    card.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
    trees.count = k; trees.frustumCulled = false; this.group.add(trees); this.hillForest = trees;
  }
  // four painted canopies in one texture: a broad round crown, a tall crown, a lighter feathery crown, and a crown in pink blossom
  _canopyAtlas() {
    const S = 256, cvs = document.createElement('canvas'); cvs.width = cvs.height = S * 2; const x = cvs.getContext('2d');
    const rnd = (() => { let s2 = 7; return () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647); })();
    const crown = (ox, oy, { w = 0.8, hgt = 0.8, greens, bloom = null, lobes = 30 }) => {
      const cx = ox + S / 2, base = oy + S * 0.92, top = base - S * hgt;
      x.fillStyle = '#4a3424'; x.fillRect(cx - S * 0.022, base - S * 0.16, S * 0.044, S * 0.16);
      // back to front, low to high: each billow is a soft ball lit from the upper left
      const balls = [];
      for (let i = 0; i < lobes; i++) { const t = rnd(), yy = top + S * 0.1 + (base - S * 0.2 - top) * Math.pow(t, 0.9), spread = Math.sin(Math.min(1, t * 1.1 + 0.15) * Math.PI) * S * w * 0.42;
        balls.push([cx + (rnd() * 2 - 1) * spread, yy, S * (0.1 + rnd() * 0.07) * (0.7 + 0.5 * (1 - t)), t]); }
      balls.sort((p1, p2) => p2[1] - p1[1]);
      // each billow is painted with leaf dabs: a dark base, then small strokes that are lighter toward the sun (upper left);
      // in a blossoming crown, some of the sunlit dabs are flowers
      for (const [px, yy, rr, t] of balls) {
        const col = new THREE.Color(greens[Math.floor(rnd() * greens.length)]), k = 1.0 - t * 0.35;
        x.fillStyle = shade('#' + col.getHexString(), 0.62 * k); x.beginPath(); x.arc(px, yy, rr * 0.92, 0, Math.PI * 2); x.fill();
        for (let d = 0; d < 70; d++) {
          const ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * rr, dx = Math.cos(ang) * rad, dy = Math.sin(ang) * rad;
          const lit = Math.max(0, Math.min(1, 0.55 - (dx + dy * 1.2) / (2.2 * rr) + (rnd() - 0.5) * 0.25));
          const flower = bloom && lit > 0.45 && rnd() < 0.42;
          x.fillStyle = flower ? bloom[Math.floor(rnd() * bloom.length)] : shade(lit > 0.78 ? '#b8d878' : '#' + col.getHexString(), (0.7 + lit * 0.65) * k);
          x.beginPath(); x.ellipse(px + dx, yy + dy, rr * (0.13 + rnd() * 0.1), rr * (0.09 + rnd() * 0.07), rnd() * Math.PI, 0, Math.PI * 2); x.fill();
        }
      }
    };
    const shade = (hex, k) => { const c2 = new THREE.Color(hex); return `rgb(${Math.min(255, c2.r * 255 * k) | 0},${Math.min(255, c2.g * 255 * k) | 0},${Math.min(255, c2.b * 255 * k) | 0})`; };
    crown(0, 0, { w: 0.92, hgt: 0.74, greens: ['#4f9038', '#46852f', '#5c9c40'] });
    crown(S, 0, { w: 0.64, hgt: 0.86, greens: ['#3f7a30', '#478434', '#36702c'] });
    crown(0, S, { w: 0.88, hgt: 0.7, greens: ['#68a446', '#5c983e', '#74ae4e'] });
    crown(S, S, { w: 0.9, hgt: 0.74, greens: ['#5a9040', '#4f8638'], bloom: ['#f5a8c8', '#ee88b4', '#fac8dc', '#fff0f5'] });
    const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // ------------------------------------------------------------ waterfalls, pools and the river
  _streakTexture() {
    const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = 'rgba(210,232,240,0.55)'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { const a = 0.25 + Math.random() * 0.7; x.fillStyle = `rgba(255,255,255,${a})`; const w = 1 + Math.random() * 3, px = Math.random() * W, py = Math.random() * H, len = 30 + Math.random() * 140; x.fillRect(px, py, w, len); if (py + len > H) x.fillRect(px, py - H, w, len); }
    const edge = x.createLinearGradient(0, 0, W, 0); edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(0.3, 'rgba(0,0,0,0)'); edge.addColorStop(0.7, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = edge; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 5, 40 + Math.random() * 120); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  _falls() {
    const tex = this._streakTexture();
    this.fallTex = [tex, tex.clone()]; this.fallTex[1].needsUpdate = true; this.fallTex[1].repeat.set(1, 1.6);
    this.fallMats = this.fallTex.map((t, i) => new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: i ? 0.55 : 0.9, depthWrite: false, side: THREE.DoubleSide, color: '#ffffff' }));
    const rockM = hazy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.7);
    const mistPts = [], mistSeed = [];
    // foam: soft white blobs of churning water, two layers turning opposite ways
    const foamTex = (() => { const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.translate(S / 2, S / 2);
      for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * S * 0.46, rr = 4 + Math.random() * 14, al = 0.25 + 0.55 * (1 - r / (S * 0.46));
        const g = x.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-S / 2, -S / 2, S, S); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.center.set(0.5, 0.5); return t; })();
    this.foamMats = [0, 1].map((i) => { const t = foamTex.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5); return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: i ? 0.55 : 0.85, depthWrite: false, color: '#ffffff' }); });
    this.lipMat = new THREE.MeshBasicMaterial({ map: this.fallTex[0], transparent: true, opacity: 0.55, depthWrite: false, color: '#ffffff' });
    this.cloudMistMat = new THREE.SpriteMaterial({ map: softDot(), color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false });
    this.fallMists = [];
    this.rainbowMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      map: (() => { const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        const bands = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#32ade6', '#5856d6', '#af52de'];
        bands.forEach((col, i) => { x.strokeStyle = col; x.globalAlpha = 0.55; x.lineWidth = 3.2; x.beginPath(); x.arc(W / 2, H * 1.15, H * 0.98 - i * 3.1, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); });
        x.globalCompositeOperation = 'destination-in'; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    FALLS.forEach((fa, fi) => {
      const rTop = 128 + fi * 6, rBase = 112 + fi * 4;
      const top = this.nearHeight(rTop, fa, true), height = Math.max(40, top - 1), width = fi === 0 ? 16 : 11;
      const dir = new THREE.Vector3(Math.cos(fa), 0, Math.sin(fa));
      // a weathered rock buttress behind the fall, mossy toward the top
      const rg = new THREE.IcosahedronGeometry(1, 4), rp = rg.attributes.position, rc = [], cc = new THREE.Color();
      for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i); const n = 1 + (fbm(v.x * 2.2 + fi * 3, v.y * 2.6 + v.z, 4) - 0.5) * 0.55; v.multiplyScalar(n); rp.setXYZ(i, v.x, v.y, v.z);
        cc.set('#6f6455').lerp(new THREE.Color('#3f5f34'), Math.max(0, v.y) * 0.8 * (fbm(v.x * 6, v.z * 6, 2) > 0.45 ? 1 : 0.3)); rc.push(cc.r, cc.g, cc.b); }
      rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rg.computeVertexNormals();
      const face = new THREE.Mesh(rg, rockM); face.scale.set(width * 1.5, height * 0.62, 10);
      face.position.copy(dir).multiplyScalar(rTop + 9).setY(height * 0.42); face.lookAt(0, face.position.y, 0); this.group.add(face);
      // two sheets of falling water, slightly bowed, scrolling at different speeds
      for (let s = 0; s < 2; s++) {
        const g = new THREE.PlaneGeometry(width * (s ? 1.2 : 1), height, 6, 16); const gp = g.attributes.position;
        for (let i = 0; i < gp.count; i++) { const y = gp.getY(i), k = (height / 2 - y) / height; gp.setX(i, gp.getX(i) * (0.75 + k * 0.5)); gp.setZ(i, k * k * 4 + (s ? 0.4 : 0)); }
        const sheet = new THREE.Mesh(g, this.fallMats[s]); sheet.position.copy(dir).multiplyScalar(rTop - 1.2).setY(height / 2 - 0.5); sheet.lookAt(0, sheet.position.y, 0); sheet.renderOrder = 3; this.group.add(sheet);
      }
      // plunge pool and the river that winds away from it
      const pool = new THREE.Mesh(new THREE.CircleGeometry(width * 1.1, 28), this.water); pool.rotation.x = -Math.PI / 2; pool.position.copy(dir).multiplyScalar(rTop - 7).setY(0.25); this.group.add(pool);
      for (let i = 0; i < 110; i++) { const base = dir.clone().multiplyScalar(rTop - 6 + (Math.random() - 0.5) * 6); base.x += (Math.random() - 0.5) * width; base.z += (Math.random() - 0.5) * width * 0.5; mistPts.push(base.x, 0.5, base.z); mistSeed.push(Math.random()); }
      // white water: churning foam where the fall lands, a bright lip where it spills over, and mist billowing up
      const poolC = dir.clone().multiplyScalar(rTop - 7).setY(0.3), toC = Math.atan2(-dir.x, -dir.z);
      for (const [rad, mat, y] of [[width * 0.75, this.foamMats[0], 0.32], [width * 1.05, this.foamMats[1], 0.3]]) {
        const f = new THREE.Mesh(new THREE.CircleGeometry(rad, 32).rotateX(-Math.PI / 2), mat); f.position.copy(poolC).setY(y); f.renderOrder = 4; this.group.add(f); }
      const lipG = new THREE.CylinderGeometry(0.9, 0.9, width * 1.05, 10, 1, false, 0, Math.PI); lipG.rotateZ(Math.PI / 2);
      const lip = new THREE.Mesh(lipG, this.lipMat); lip.position.copy(dir).multiplyScalar(rTop - 1.2).setY(height - 1.0); lip.rotation.y = toC; lip.renderOrder = 4; this.group.add(lip);
      // soft spray puffs where the water tumbles over the edge, and a veil of mist down the face of the fall
      const across = new THREE.Vector3(-dir.z, 0, dir.x);
      for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(this.cloudMistMat); const w2 = width * (0.35 + Math.random() * 0.2); sp.scale.set(w2, w2 * 0.6, 1);
        sp.position.copy(dir).multiplyScalar(rTop - 2.4).addScaledVector(across, (k / 5 - 0.5) * width * 0.9).setY(height - 1.2 + Math.random()); sp.renderOrder = 5; this.group.add(sp); this.fallMists.push({ s: sp, y0: sp.position.y, ph: Math.random() * 6 }); }
      for (let k = 0; k < 10; k++) { const sp = new THREE.Sprite(this.cloudMistMat); const w2 = width * (1.3 + Math.random() * 0.9) * (1 - k * 0.04); sp.scale.set(w2, w2 * 0.7, 1);
        sp.position.copy(dir).multiplyScalar(rTop - 6 + (Math.random() - 0.5) * 4).addScaledVector(across, (Math.random() - 0.5) * width).setY(3 + k * height * 0.045); sp.renderOrder = 5; this.group.add(sp); this.fallMists.push({ s: sp, y0: sp.position.y, ph: Math.random() * 6 }); }
      if (fi === 0) {   // a faint rainbow in the spray of the main fall, in daylight
        const rb = new THREE.Mesh(new THREE.PlaneGeometry(width * 3.2, width * 1.6), this.rainbowMat); rb.position.copy(dir).multiplyScalar(rTop - 6).setY(height * 0.36); rb.lookAt(0, rb.position.y, 0); rb.renderOrder = 6; this.group.add(rb); }
      if (fi === 0) this._river(fa, rTop - 7, width);
    });
    // spray and mist at the foot of each fall, animated on the GPU
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mistPts, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(mistSeed, 1));
    this.mistU = { uTime: this.uTime, uMap: { value: softDot() }, uColor: { value: new THREE.Color('#f4f8fa') }, uOpacity: { value: 0.5 }, uPx: { value: 1 } };
    this.spray = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.mistU, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ float k = fract(uTime*0.07 + aSeed); vec3 p = position; p.y += k*22.0; p.x += sin(aSeed*40.0+uTime*0.3)*3.0*k;
          vec4 mv = modelViewMatrix*vec4(p,1.0); vA = sin(k*3.14159); gl_PointSize = uPx*(900.0 + 1600.0*k)/-mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).a*vA*uOpacity*0.45; gl_FragColor = vec4(uColor, a); }` }));
    this.spray.frustumCulled = false; this.group.add(this.spray);
  }
  _river(fa, r0, w) {
    // from the pool toward the campus, then curving east around the walls
    const pts = []; for (let i = 0; i <= 12; i++) { const r = r0 - i * 2.6; pts.push(new THREE.Vector3(Math.cos(fa + Math.sin(i * 0.6) * 0.03) * r, 0, Math.sin(fa + Math.sin(i * 0.6) * 0.03) * r)); }
    const rEnd = r0 - 12 * 2.6; for (let i = 1; i <= 26; i++) { const a = fa + i * 0.06; const r = rEnd + Math.sin(i * 0.5) * 2.5; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const curve = new THREE.CatmullRomCurve3(pts), N = 120, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPoint(u), t = curve.getTangent(u), side = new THREE.Vector3(-t.z, 0, t.x).normalize(), width = w * 0.55 * (1 - u * 0.35);
      for (const s of [-1, 1]) { pos.push(p.x + side.x * width * s, 0.12, p.z + side.z * width * s); uv.push(s < 0 ? 0 : 1, u * 20); }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    this.group.add(new THREE.Mesh(g, this.water));
  }

  // ------------------------------------------------------------ a palace on the hill
  // Framed between the two northern waterfalls when you look up the main approach: an ivory palace on a terrace,
  // with domed pavilions, a tall tower, rows of warmly lit windows and a soft halo above it at dusk.
  // the height a building on the hills must stand at to be seen from the campus over the ridges in front of it
  ridgeAbove(r, a) { let top = this.nearHeight(r, a); for (let rr = 100; rr < r; rr += 4) { const k = (rr - 30) / (r - 30); top = Math.max(top, this.nearHeight(rr, a) / k - 4); } return Math.min(top, this.nearHeight(r, a) + 30); }
  _palace() {
    const a = PALACE_A, r = 172, h = this.ridgeAbove(r, a), g = new THREE.Group();
    g.position.set(Math.cos(a) * r, h + 2, Math.sin(a) * r); g.rotation.y = Math.atan2(-g.position.x, -g.position.z); this.group.add(g);
    const ivory = new THREE.MeshStandardMaterial({ color: '#f4e6cc', roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: '#e6b85c', metalness: 0.6, roughness: 0.4 });
    const glow = this.palaceGlow = new THREE.MeshStandardMaterial({ color: '#ffd59a', emissive: '#ffb050', emissiveIntensity: 1.6 });
    const box = (w, hh, d, x, y, z, m = ivory) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); b.position.set(x, y + hh / 2, z); g.add(b); return b; };
    const cyl = (r0, hh, x, y, z, m = ivory) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0 * 1.08, hh, 14), m); c.position.set(x, y + hh / 2, z); g.add(c); return c; };
    const dome = (rr, x, y, z, m = ivory) => { const d = new THREE.Mesh(new THREE.SphereGeometry(rr, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); d.scale.y = 1.3; d.position.set(x, y, z); g.add(d);
      const f = new THREE.Mesh(new THREE.ConeGeometry(rr * 0.1, rr * 0.75, 8), gold); f.position.set(x, y + rr * 1.3 + rr * 0.3, z); g.add(f); };
    // an arched window: a tall glowing slot with a rounded head
    const arch = (x, y, z, w = 1.3, hh = 4) => { box(w, hh, 0.3, x, y, z, glow); const c = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.3, 12, 1, false, 0, Math.PI), glow); c.rotation.set(Math.PI / 2, 0, Math.PI / 2); c.position.set(x, y + hh, z); g.add(c); };
    const chhatri = (x, y, z, rr = 1.6) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.16, 2.4, x + dx * rr * 0.6, y, z + dz * rr * 0.6); box(rr * 1.6, 0.3, rr * 1.6, x, y + 2.4, z); dome(rr * 0.75, x, y + 2.7, z, gold); };
    box(52, 6, 30, 0, -2, 0); box(54, 0.8, 32, 0, 4, 0, gold);                              // terrace and its gilded lip
    box(26, 12, 14, 0, 4.8, 0); box(28, 1, 16, 0, 16.8, 0);                                 // main hall
    cyl(6.4, 3, 0, 17.8, 0); dome(7, 0, 20.8, 0, gold);                                      // golden central dome on its drum
    for (const s of [-1, 1]) {
      box(9, 9, 11, s * 18.5, 4.8, 1.5); dome(3.8, s * 18.5, 13.8, 1.5);                   // side pavilions
      chhatri(s * 11, 17.8, 5); chhatri(s * 11, 17.8, -5);                                 // pavilions on the roof corners
      for (const z of [-13, 13]) { cyl(0.85, 22, s * 25, 4.8, z); box(2.4, 0.5, 2.4, s * 25, 26.8, z, gold); dome(1.2, s * 25, 27.3, z); }   // minarets at the terrace corners
      arch(s * 18.5, 7, 7.1, 1.2, 3.4);
    }
    const tower = shikhara(9, 30, ivory, gold, 10); tower.position.set(0, 4.8, -12); g.add(tower);
    for (let i = 0; i < 7; i++) arch(-9 + i * 3, 7.5, 7.1);
    const halo = this.palaceHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(1.0, 0.78, 0.45), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(90, 90, 1); halo.position.set(0, 30, -6); g.add(halo);
  }

  // ------------------------------------------------------------ cascades and hill temples
  // a stream of white water following the slope down from the ridge, stepping over ledges, with spray where it breaks
  _cascades() {
    const mat = this.fallMats[0], spray = new THREE.SpriteMaterial({ map: softDot(), color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    for (const [ci, ca] of CASCADES.entries()) {
      const pos = [], uv = [], idx = [], N = 40, r0 = 196 - ci * 6, r1 = 116; let along = 0, prev = null;
      for (let i = 0; i <= N; i++) {
        const t = i / N, r = r0 + (r1 - r0) * t, a = ca + Math.sin(t * 5 + ci) * 0.018, h = this.nearHeight(r, a) + 0.7, w = 3.2 + t * 2.2;
        const c = new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r), side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        if (prev) along += c.distanceTo(prev); prev = c;
        for (const s2 of [-1, 1]) { const p = c.clone().addScaledVector(side, s2 * w / 2); pos.push(p.x, p.y, p.z); uv.push(s2 < 0 ? 0 : 1, along / 18); }
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        if (i % 8 === 4) { const sp = new THREE.Sprite(spray); sp.scale.set(w * 2.2, w * 1.2, 1); sp.position.copy(c).setY(h + 1.2); this.group.add(sp); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 3; this.group.add(m);
    }
  }
  // smaller temples on the far hills: a terrace, a tower, a domed hall and a lit doorway, glowing at dusk
  _hillTemples() {
    const ivory = new THREE.MeshStandardMaterial({ color: '#f1e1c6', roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: '#e6b85c', metalness: 0.6, roughness: 0.4 });
    for (const [a, r, sc] of HILL_TEMPLES) {
      const h = this.ridgeAbove(r, a), g = new THREE.Group(); g.position.set(Math.cos(a) * r, h + 1, Math.sin(a) * r); g.rotation.y = Math.atan2(-g.position.x, -g.position.z); g.scale.setScalar(sc * 1.4); this.group.add(g);
      const box = (w, hh, d, x, y, z, m = ivory) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); b.position.set(x, y + hh / 2, z); g.add(b); };
      box(24, 4, 18, 0, -3, 0); box(25, 0.6, 19, 0, 1, 0, gold);
      for (let k = 0; k < 4; k++) box(6 - k * 0.6, 0.5, 1.2, 0, -3 + k * 1, 9.2 + k * 0.4);                     // steps up to the terrace
      box(10, 5, 8, 0, 1.6, 2.5); const dm = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), ivory); dm.scale.y = 1.2; dm.position.set(0, 6.6, 2.5); g.add(dm);
      const tower = shikhara(6.5, 15, ivory, gold, 8); tower.position.set(0, 1.6, -4.5); g.add(tower);
      for (const s2 of [-1, 1]) { box(2.4, 2.6, 2.4, s2 * 8.5, 1.6, 5); const d2 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gold); d2.position.set(s2 * 8.5, 4.2, 5); g.add(d2); }
      box(2.2, 3.2, 0.3, 0, 1.6, 6.55, this.palaceGlow);
      for (const s2 of [-1, 1]) box(0.8, 1.8, 0.3, s2 * 3, 2.4, 6.55, this.palaceGlow);
      const halo = new THREE.Sprite(this.palaceHalo.material); halo.scale.set(46, 46, 1); halo.position.set(0, 12, -2); g.add(halo);
    }
  }

  // ------------------------------------------------------------ clouds and valley mist
  // painted clouds: billowing lobes along a flat base, a warm rim where the sun catches the tops, violet in the undersides
  _cloudTexture(stratus = false) {
    const S = 512, H = stratus ? 96 : 256, c = document.createElement('canvas'); c.width = S; c.height = H; const x = c.getContext('2d');
    const lobes = stratus ? 30 : 34;
    for (let i = 0; i < lobes; i++) {
      const u = 0.1 + Math.random() * 0.8, mid = 1 - Math.abs(u - 0.5) * 1.5, r = stratus ? 14 + Math.random() * 18 : (24 + Math.random() * 46) * (0.45 + mid * 0.75);
      const px = S * u, py = stratus ? H * (0.42 + Math.random() * 0.2) : H * 0.66 - r * (0.2 + Math.random() * 0.55) * mid;
      const g = x.createRadialGradient(px, py - r * 0.3, r * 0.1, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.55, 'rgba(255,255,255,0.82)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r * (stratus ? 2.6 : 1.05), r, 0, 0, Math.PI * 2); x.fill();
    }
    x.globalCompositeOperation = 'destination-out';   // a soft, flat base
    const cut = x.createLinearGradient(0, H * 0.62, 0, H * 0.8); cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = cut; x.fillRect(0, 0, S, H);
    x.globalCompositeOperation = 'source-atop';        // shading only where there is cloud
    const sh = x.createLinearGradient(0, 0, 0, H * 0.75); sh.addColorStop(0, 'rgba(255,236,200,0.5)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,118,178,0.55)'); x.fillStyle = sh; x.fillRect(0, 0, S, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  _clouds() {
    const tex = this._cloudTexture();
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    this.clouds = [];
    for (let i = 0; i < (this.quality.level === 'low' ? 10 : 20); i++) {
      const s = new THREE.Sprite(this.cloudMat); const w = 110 + Math.random() * 170; s.scale.set(w, w * 0.5, 1);
      const a = Math.random() * Math.PI * 2, r = 260 + Math.random() * 260; s.position.set(Math.cos(a) * r, 90 + Math.random() * 110, Math.sin(a) * r);
      this.followers.add(s); this.clouds.push({ s, a, r, sp: 0.004 + Math.random() * 0.006 });
    }
    // low banks of layered cloud resting on the far ranges give the sky depth
    this.bankMat = new THREE.SpriteMaterial({ map: this._cloudTexture(true), transparent: true, depthWrite: false, fog: false, opacity: 0.8 });
    for (let i = 0; i < (this.quality.level === 'low' ? 6 : 12); i++) {
      const sp = new THREE.Sprite(this.bankMat), w = 160 + Math.random() * 200; sp.scale.set(w, w * 0.19, 1);
      const a = Math.random() * Math.PI * 2, r = 330 + Math.random() * 160; sp.position.set(Math.cos(a) * r, 34 + Math.random() * 40, Math.sin(a) * r);
      this.followers.add(sp); this.clouds.push({ s: sp, a, r, sp: 0.002 + Math.random() * 0.003 });
    }
    this.mistMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.5 });
    this.mists = [];
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(this.mistMat); const w = 70 + Math.random() * 60; s.scale.set(w, 14, 1); const a = -Math.PI * 0.95 + Math.random() * Math.PI * 0.9 + (i % 3 === 0 ? Math.PI : 0), r = 100 + Math.random() * 40; s.position.set(Math.cos(a) * r, 10 + Math.random() * 12, Math.sin(a) * r); this.group.add(s); this.mists.push({ s, a, r }); }
  }

  // ------------------------------------------------------------ birds
  _flocks() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, 0.08, 0, -0.2, -0.08, 0, -0.2, 0, 0, 0.12, 0.75, 0.02, -0.08, 0, 0, -0.14, 0, 0, 0.12, 0, 0, -0.14, -0.75, 0.02, -0.08], 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        transformed.y += sin(uTime * 9.0 + ph) * abs(position.x) * 0.9;`);
    };
    const flocks = [
      { n: 9, color: '#f4f2ea', scale: 2.4, cx: -20, cz: -150, R: 120, H: 70, w: 0.025, v: true },   // egrets over the mountains
      { n: 7, color: '#f4f2ea', scale: 2.2, cx: 40, cz: -120, R: 90, H: 55, w: -0.03, v: true },
      { n: 8, color: '#2d2723', scale: 1.4, cx: 0, cz: -10, R: 46, H: 26, w: 0.07, v: false },         // crows over the courtyard
      { n: 10, color: '#4c9a3c', scale: 0.9, cx: 10, cz: 10, R: 34, H: 15, w: -0.13, v: false },      // parakeets
      { n: 6, color: '#8f9294', scale: 0.9, cx: 0, cz: -31, R: 9, H: 22, w: 0.22, v: false },          // pigeons round the Shiva spire
      { n: 6, color: '#2d2723', scale: 1.6, cx: -60, cz: -40, R: 80, H: 45, w: 0.035, v: false },
    ];
    const total = flocks.reduce((s, f) => s + f.n, 0);
    this.birds = new THREE.InstancedMesh(geo, mat, total); this.birds.frustumCulled = false;
    const c = new THREE.Color(); let k = 0;
    this.flockData = flocks.map((f) => { const members = []; for (let i = 0; i < f.n; i++) { const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      members.push({ k: k, off: f.v ? new THREE.Vector3(side * rank * 2.2, (Math.random() - 0.5) * 1.2, rank * 2.6) : new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 9), ph: Math.random() * 6 });
      this.birds.setColorAt(k++, c.set(f.color)); } return { ...f, a: Math.random() * 6, members }; });
    this.group.add(this.birds);
  }

  _butterflies() {
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0.16, 0, 0.1, 0.13, 0, -0.08, 0, 0, 0.06, 0.13, 0, -0.08, 0, 0, -0.06, 0, 0, 0.06, -0.16, 0, 0.1, -0.13, 0, -0.08, 0, 0, 0.06, -0.13, 0, -0.08, 0, 0, -0.06], 3));
    wing.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = this.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 2.3; float f = sin(uTime * 22.0 + ph);
      transformed.y += abs(position.x) * f * 1.2; transformed.x *= 0.6 + 0.4 * abs(cos(uTime * 22.0 + ph));`); };
    const n = this.beds.length ? Math.min(this.quality.level === 'low' ? 30 : 70, this.beds.length * 2) : 0;
    this.flutter = new THREE.InstancedMesh(wing, mat, Math.max(1, n)); this.flutter.count = n; this.flutter.frustumCulled = false;
    const cols = ['#f29a17', '#f6d23a', '#ffffff', '#3d7fd8', '#e35d9a'], c = new THREE.Color();
    this.flies = [];
    for (let i = 0; i < n; i++) { const b = this.beds[i % this.beds.length]; this.flies.push({ x: b[0], z: b[1], ph: Math.random() * 10, r: 0.8 + Math.random() * 1.6, s: 0.5 + Math.random() * 0.6 }); if (i % 3 === 0) this.flutter.setColorAt(i, c.setRGB(2.4, 1.7, 0.55)); else this.flutter.setColorAt(i, c.set(cols[i % cols.length])); }
    this.group.add(this.flutter);
  }

  _night() {
    // stars and moon live on the sky dome; fireflies drift over the gardens
    const N = 1600, sp = new Float32Array(N * 3), ss = new Float32Array(N);
    for (let i = 0; i < N; i++) { const u = Math.random(), v = 0.08 + Math.random() * 0.92, th = u * Math.PI * 2, ph = Math.acos(v); sp.set([Math.sin(ph) * Math.cos(th) * 760, Math.cos(ph) * 760, Math.sin(ph) * Math.sin(th) * 760], i * 3); ss[i] = Math.random(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    this.starU = { uTime: this.uTime, uOpacity: { value: 0 }, uPx: { value: 1 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.starU, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA; void main(){ vA = 0.55 + 0.45*sin(uTime*(1.0+aSeed*2.0)+aSeed*50.0); gl_PointSize = uPx*(1.0 + aSeed*aSeed*2.6); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d))*vA*uOpacity; gl_FragColor = vec4(vec3(1.0,0.97,0.9)*a, a); }', blending: THREE.AdditiveBlending }));
    this.stars.frustumCulled = false; this.followers.add(this.stars);
    const mc = document.createElement('canvas'); mc.width = mc.height = 128; const x = mc.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,253,240,1)'); g.addColorStop(0.22, 'rgba(250,246,226,1)'); g.addColorStop(0.27, 'rgba(200,215,255,0.35)'); g.addColorStop(1, 'rgba(160,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false, fog: false, opacity: 0 })); this.moon.scale.set(90, 90, 1); this.followers.add(this.moon);
    const F = this.quality.level === 'low' ? 80 : 200, fp = new Float32Array(F * 3), fs = new Float32Array(F);
    for (let i = 0; i < F; i++) { const b = this.beds.length ? this.beds[i % this.beds.length] : [0, 0]; fp.set([b[0] + (Math.random() - 0.5) * 6, 0.4 + Math.random() * 2.2, b[1] + (Math.random() - 0.5) * 6], i * 3); fs[i] = Math.random(); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
    this.flyU = { uTime: this.uTime, uOpacity: { value: 0 }, uPx: { value: 1 } };
    this.fireflies = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: this.flyU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ vec3 p = position; p.x += sin(uTime*0.3+aSeed*30.0)*1.2; p.y += sin(uTime*0.5+aSeed*17.0)*0.5; p.z += cos(uTime*0.27+aSeed*23.0)*1.2;
          vA = pow(max(0.0, sin(uTime*(0.8+aSeed)+aSeed*40.0)), 3.0); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = uPx*90.0/-mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5))*vA*uOpacity; gl_FragColor = vec4(vec3(2.2,1.55,0.62)*a, a); }' }));
    this.fireflies.frustumCulled = false; this.group.add(this.fireflies);
  }

  setPixelScale(px) { this.mistU.uPx.value = px; this.starU.uPx.value = px; this.flyU.uPx.value = px; }

  update(dt, t, focus, tod, motion = 1) {
    this.uTime.value = t * motion;
    this.followers.position.set(focus.x, 0, focus.z);
    for (const tex of this.fallTex) tex.offset.y = (t * (tex === this.fallTex[0] ? 0.55 : 0.8)) % 1;
    // tint by time of day
    const day = 1 - tod.night;
    this.cloudMat.color.copy(tod.cloud); this.cloudMat.opacity = 0.35 + 0.55 * day; this.bankMat.color.copy(tod.cloud); this.bankMat.opacity = 0.3 + 0.5 * day;
    if (this.palaceGlow) { const lamps = tod.lamps ?? 1; this.palaceGlow.emissiveIntensity = 0.6 + lamps * 0.55; this.palaceHalo.material.opacity = 0.12 + Math.min(0.5, lamps * 0.08); }
    this.mistMat.color.copy(tod.cloud).lerp(new THREE.Color('#ffffff'), 0.4 * day); this.mistMat.opacity = tod.mist * 0.55;
    this.mistU.uColor.value.copy(tod.cloud).lerp(new THREE.Color('#ffffff'), 0.6 * day); this.mistU.uOpacity.value = 0.35 + 0.45 * day;
    for (const m of this.fallMats) m.color.setScalar(0.12 + 0.88 * day);
    // foam churns, the lip glows with the fall, mist billows and drifts, the rainbow shows only in daylight
    if (this.foamMats) { this.foamMats[0].map.rotation = t * 0.25 * motion; this.foamMats[1].map.rotation = -t * 0.15 * motion; for (const m of this.foamMats) m.color.setScalar(0.15 + 0.85 * day);
      this.lipMat.color.setScalar(0.15 + 0.85 * day); this.cloudMistMat.color.copy(tod.cloud).lerp(new THREE.Color('#ffffff'), 0.7 * day); this.cloudMistMat.opacity = 0.2 + 0.24 * day;
      for (const f of this.fallMists) { f.s.position.y = f.y0 + Math.sin(t * 0.3 * motion + f.ph) * 1.5; f.s.material.rotation = 0; }
      this.rainbowMat.opacity = Math.max(0, day - (tod.warm || 0) * 0.6) * 0.75; }
    this.starU.uOpacity.value = tod.stars; this.flyU.uOpacity.value = Math.max(tod.night, 0.3 + tod.warm * 0.7);
    HAZE.value = 0.35 + (tod.mist || 0) * 0.45;
    this.moon.material.opacity = tod.night; this.moon.position.copy(tod.moonDir).multiplyScalar(650);
    for (const c of this.clouds) { c.a += c.sp * dt * motion; c.s.position.x = Math.cos(c.a) * c.r; c.s.position.z = Math.sin(c.a) * c.r; }
    for (const m of this.mists) m.s.position.y = 10 + Math.sin(t * 0.05 + m.a * 3) * 2;
    // flocks fly by day and roost at night
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    this.birds.visible = tod.night < 0.85;
    if (this.birds.visible) {
      for (const f of this.flockData) {
        f.a += f.w * dt * motion;
        const cx = f.cx + Math.cos(f.a) * f.R, cz = f.cz + Math.sin(f.a) * f.R, heading = Math.atan2(-Math.sin(f.a) * Math.sign(f.w), Math.cos(f.a) * Math.sign(f.w));
        for (const b of f.members) {
          const o = b.off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
          p.set(cx + o.x + Math.sin(t * 0.7 + b.ph) * 0.6, f.H + b.off.y + Math.sin(t * 0.5 + b.ph) * 0.8, cz + o.z);
          e.set(0, heading, Math.sin(t * 0.6 + b.ph) * 0.15); q.setFromEuler(e); sc.setScalar(f.scale);
          m4.compose(p, q, sc); this.birds.setMatrixAt(b.k, m4);
        }
      }
      this.birds.instanceMatrix.needsUpdate = true;
    }
    // butterflies wander over the flower beds in daylight
    this.flutter.visible = tod.night < 0.4 && this.flies.length > 0;
    if (this.flutter.visible) {
      this.flies.forEach((b, i) => {
        const k = t * b.s * motion + b.ph;
        p.set(b.x + Math.sin(k * 0.9) * b.r + Math.sin(k * 2.3) * 0.3, 0.7 + Math.sin(k * 1.7) * 0.35 + Math.sin(k * 5) * 0.08, b.z + Math.cos(k * 0.7) * b.r);
        e.set(0, k * 0.9, 0); q.setFromEuler(e); sc.setScalar(1.4); m4.compose(p, q, sc); this.flutter.setMatrixAt(i, m4);
      });
      this.flutter.instanceMatrix.needsUpdate = true;
    }
  }
}
