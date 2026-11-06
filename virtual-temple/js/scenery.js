import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { softDot } from './textures.js';

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

export class Scenery {
  constructor(scene, quality, water, beds = []) {
    this.scene = scene; this.quality = quality; this.water = water; this.beds = beds;
    this.uTime = { value: 0 };
    this.group = new THREE.Group(); scene.add(this.group);
    this.followers = new THREE.Group(); scene.add(this.followers); // sky elements that stay centred on the viewer
    this._mountains();
    this._falls();
    this._clouds();
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
    for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + 1, d = a + segA + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  _mountains() {
    const low = this.quality.level === 'low';
    // near range: forested ridges with rocky cliffs where the waterfalls drop
    this.nearHeight = (r, a) => {
      const rise = smooth(92, 150, r) * (1 - smooth(185, 215, r) * 0.35);
      const south = 0.45 + 0.55 * smooth(0.3, 1.4, Math.abs(dAng(a, Math.PI / 2)));      // lower toward the gate side
      let h = (22 + 58 * ridged(a * 3.2 + 4, r * 0.012, 5)) * (0.55 + 0.6 * fbm(a * 5, r * 0.03, 3)) * south;
      for (const fa of FALLS) h += 46 * Math.exp(-Math.pow(dAng(a, fa) / 0.11, 2)) * smooth(100, 135, r);
      return rise * h - 2;
    };
    const greens = [new THREE.Color('#3f6a33'), new THREE.Color('#2f5a2c'), new THREE.Color('#58803e')], rock = new THREE.Color('#8a7a66'), tmp = new THREE.Color();
    const near = this._ring(92, 215, low ? 140 : 220, low ? 14 : 22, this.nearHeight, (c, h, r, a) => {
      c.copy(greens[Math.floor(hash(a * 40, r) * 3)]).lerp(greens[2], smooth(0, 40, h) * 0.3);
      const cliff = Math.max(...FALLS.map(fa => Math.exp(-Math.pow(dAng(a, fa) / 0.07, 2)))) * smooth(10, 40, h);
      c.lerp(rock, Math.min(1, cliff * 1.2 + smooth(55, 85, h) * 0.6 + (fbm(a * 30, r * 0.1, 2) > 0.62 ? 0.3 : 0)));
    });
    this.nearMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const nm = new THREE.Mesh(near, this.nearMat); nm.receiveShadow = false; this.group.add(nm);
    // far range: tall blue peaks with snow, fading into haze
    const far = this._ring(240, 360, low ? 120 : 180, low ? 8 : 12, (r, a) => {
      const rise = smooth(240, 290, r);
      return rise * (60 + 130 * ridged(a * 2.4 + 11, r * 0.008, 5)) * (0.75 + 0.35 * fbm(a * 3 + 7, 1.3, 3));
    }, (c, h) => { c.set('#5b6f72').lerp(tmp.set('#7d8a84'), smooth(40, 120, h)); if (h > 125) c.lerp(tmp.set('#f2f4f6'), smooth(125, 150, h)); });
    this.farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    this.group.add(new THREE.Mesh(far, this.farMat));
    // forest on the near slopes: round, leafy canopies (a few lumpy lobes over a short trunk), some in pink blossom
    const n = low ? 420 : 900, parts = [];
    const lobe = (r, x, y, z, seed) => { const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + 0.16 * Math.sin(vx * 7 + seed) * Math.sin(vy * 6 + seed * 2) * Math.sin(vz * 8 + seed * 3); p.setXYZ(i, vx * k + x, vy * k * 0.85 + y, vz * k + z); } return g; };
    parts.push(lobe(1.0, 0, 2.2, 0, 1), lobe(0.75, 0.62, 1.85, 0.25, 2), lobe(0.72, -0.6, 1.9, -0.2, 3), lobe(0.62, 0.1, 2.85, -0.1, 4));
    const trunk = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 5).translate(0, 0.8, 0).toNonIndexed();
    const geoms = [...parts, trunk], cols = [];
    for (const g of geoms) { const p = g.attributes.position, isTrunk = g === trunk; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const v = isTrunk ? 0.35 : 0.55 + 0.45 * Math.min(1, Math.max(0, (y - 1.3) / 2)); cols.push(isTrunk ? 0.42 : v, isTrunk ? 0.3 : v, isTrunk ? 0.22 : v); } }
    const merged = new THREE.BufferGeometry(); const total = geoms.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(total * 3); let o = 0;
    for (const g of geoms) { pos.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; }
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); merged.computeVertexNormals();
    const trees = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ roughness: 0.95, vertexColors: true, flatShading: true }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0); let k = 0;
    for (let i = 0; k < n && i < n * 4; i++) {
      const a = Math.random() * Math.PI * 2, r = 104 + Math.random() * 90, h = this.nearHeight(r, a);
      if (h < 1 || h > 60 || FALLS.some(fa => Math.abs(dAng(a, fa)) < 0.09)) continue;
      const s = 2.0 + Math.random() * 2.2; q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      m.compose(new THREE.Vector3(Math.cos(a) * r, h - 0.6, Math.sin(a) * r), q, new THREE.Vector3(s, s * (0.85 + Math.random() * 0.4), s)); trees.setMatrixAt(k, m);
      const bloom = Math.random() < 0.16;
      trees.setColorAt(k++, c.set(bloom ? ['#e2689a', '#d9528a', '#f08ab0'][Math.floor(Math.random() * 3)] : ['#3f7a34', '#4a8a3a', '#356c2e', '#5a9440', '#2f6230'][Math.floor(Math.random() * 5)]));
    }
    trees.count = k; this.group.add(trees);
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
    const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const mistPts = [], mistSeed = [];
    FALLS.forEach((fa, fi) => {
      const rTop = 128 + fi * 6, rBase = 112 + fi * 4;
      const top = this.nearHeight(rTop, fa), height = Math.max(40, top - 1), width = fi === 0 ? 16 : 11;
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
      for (let i = 0; i < 70; i++) { const base = dir.clone().multiplyScalar(rTop - 6 + (Math.random() - 0.5) * 6); base.x += (Math.random() - 0.5) * width; base.z += (Math.random() - 0.5) * width * 0.5; mistPts.push(base.x, 0.5, base.z); mistSeed.push(Math.random()); }
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

  // ------------------------------------------------------------ clouds and valley mist
  _cloudTexture() {
    const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S / 2; const x = c.getContext('2d');
    for (let i = 0; i < 26; i++) { const px = S * (0.15 + Math.random() * 0.7), py = S / 2 * (0.45 + Math.random() * 0.3), r = 18 + Math.random() * 34;
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S / 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  _clouds() {
    const tex = this._cloudTexture();
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    this.clouds = [];
    for (let i = 0; i < (this.quality.level === 'low' ? 10 : 18); i++) {
      const s = new THREE.Sprite(this.cloudMat); const w = 90 + Math.random() * 150; s.scale.set(w, w * 0.4, 1);
      const a = Math.random() * Math.PI * 2, r = 260 + Math.random() * 260; s.position.set(Math.cos(a) * r, 90 + Math.random() * 110, Math.sin(a) * r);
      this.followers.add(s); this.clouds.push({ s, a, r, sp: 0.004 + Math.random() * 0.006 });
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
    const n = this.beds.length ? Math.min(40, this.beds.length * 2) : 0;
    this.flutter = new THREE.InstancedMesh(wing, mat, Math.max(1, n)); this.flutter.count = n; this.flutter.frustumCulled = false;
    const cols = ['#f29a17', '#f6d23a', '#ffffff', '#3d7fd8', '#e35d9a'], c = new THREE.Color();
    this.flies = [];
    for (let i = 0; i < n; i++) { const b = this.beds[i % this.beds.length]; this.flies.push({ x: b[0], z: b[1], ph: Math.random() * 10, r: 0.8 + Math.random() * 1.6, s: 0.5 + Math.random() * 0.6 }); this.flutter.setColorAt(i, c.set(cols[i % cols.length])); }
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
    this.cloudMat.color.copy(tod.cloud); this.cloudMat.opacity = 0.35 + 0.5 * day;
    this.mistMat.color.copy(tod.cloud).lerp(new THREE.Color('#ffffff'), 0.4 * day); this.mistMat.opacity = tod.mist * 0.55;
    this.mistU.uColor.value.copy(tod.cloud).lerp(new THREE.Color('#ffffff'), 0.6 * day); this.mistU.uOpacity.value = 0.35 + 0.45 * day;
    for (const m of this.fallMats) m.color.setScalar(0.12 + 0.88 * day);
    this.starU.uOpacity.value = tod.stars; this.flyU.uOpacity.value = Math.max(tod.night, 0.3 + tod.warm * 0.7);
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
