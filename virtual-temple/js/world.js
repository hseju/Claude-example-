import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as TX from './textures.js';
import { brass, gold, clay, darkStone, pillarGeometry, HangingBell, diyaGeometry, kalasha, amalaka, garland, stoneMat, bandMat, shikhara, chhatri, balusterGeometry, lampPostGeometry, ivory, paleGold } from './architecture.js';
import { FlameField, fountainJets, windify } from './fx.js';
import { Avatar, randomConfig } from './avatar.js';
import { Scenery } from './scenery.js';
import { Flora } from './flora.js';

export const TEMPLES = {
  ganesha: { id: 'ganesha', name: 'Ganesha Temple', short: 'Ganesha', pos: new THREE.Vector3(-31, 0, 0), rot: Math.PI / 2, entrance: new THREE.Vector3(-19.5, 0, 0), stone: '#f1e4cf', accent: '#b8442a', icon: 'modak', flag: '#e8731c', blurb: 'Remover of obstacles. Flower offerings and aarti.' },
  shiva: { id: 'shiva', name: 'Shiva Temple', short: 'Shiva', pos: new THREE.Vector3(0, 0, -31), rot: 0, entrance: new THREE.Vector3(0, 0, -19.5), stone: '#f3ede2', accent: '#8f8778', icon: 'trishul', flag: '#e8731c', blurb: 'Shiva lingam and Nandi. Abhishek and chanting.' },
  krishna: { id: 'krishna', name: 'Krishna Temple', short: 'Krishna', pos: new THREE.Vector3(31, 0, 0), rot: -Math.PI / 2, entrance: new THREE.Vector3(19.5, 0, 0), stone: '#f2e2d2', accent: '#9a5a48', icon: 'flute', flag: '#f2b631', blurb: 'Flower gardens and flute. Devotional offerings.' },
};

const NODES = {
  spawn: [0, 47], gateOut: [0, 43], gateIn: [0, 36.5], s1: [0, 29], s2: [0, 19], cS: [0, 10.5], cSW: [-7.4, 7.4], cW: [-10.5, 0], cNW: [-7.4, -7.4],
  cN: [0, -10.5], cNE: [7.4, -7.4], cE: [10.5, 0], cSE: [7.4, 7.4], w1: [-15, 0], ganesha: [-19.5, 0], e1: [15, 0], krishna: [19.5, 0], n1: [0, -15], shiva: [0, -19.5],
  gSW: [-18, 12], gNW: [-18, -12], gSE: [18, 12], gNE: [18, -12], pondW: [-1.8, 24], pondE: [1.8, 24],
};
const EDGES = [['spawn', 'gateOut'], ['gateOut', 'gateIn'], ['gateIn', 's1'], ['s1', 'pondW'], ['s1', 'pondE'], ['pondW', 's2'], ['pondE', 's2'], ['s1', 's2'], ['s2', 'cS'],
  ['cS', 'cSE'], ['cSE', 'cE'], ['cE', 'cNE'], ['cNE', 'cN'], ['cN', 'cNW'], ['cNW', 'cW'], ['cW', 'cSW'], ['cSW', 'cS'],
  ['cW', 'w1'], ['w1', 'ganesha'], ['cE', 'e1'], ['e1', 'krishna'], ['cN', 'n1'], ['n1', 'shiva'],
  ['cSW', 'gSW'], ['cNW', 'gNW'], ['cSE', 'gSE'], ['cNE', 'gNE'], ['gSW', 'w1'], ['gNW', 'w1'], ['gSE', 'e1'], ['gNE', 'e1']];

const TOD_PRESETS = {
  morning: { sky: '#7fb2e2', mid: '#f2cdbf', hor: '#ffe3bd', sun: '#ffd39b', sunI: 2.4, hemi: 0.85, ground: '#6b5a3a', elev: 14, az: 18, fogNear: 80, fogFar: 600, lamps: 0.8, stars: 0, mist: 0.75, warm: 0.22, night: 0, exposure: 1.05, cloud: '#fff1e6' },
  afternoon: { sky: '#4a8bd6', mid: '#a8cbea', hor: '#e8eff2', sun: '#fff4e2', sunI: 3.0, hemi: 1.0, ground: '#6b5f45', elev: 62, az: 140, fogNear: 110, fogFar: 760, lamps: 0.25, stars: 0, mist: 0.12, warm: 0.04, night: 0, exposure: 1.0, cloud: '#ffffff' },
  evening: { sky: '#5856a0', mid: '#ec9c95', hor: '#ffc683', sun: '#ffa35a', sunI: 2.2, hemi: 0.6, ground: '#4a3528', elev: 7, az: 196, fogNear: 80, fogFar: 600, lamps: 2.8, stars: 0.06, mist: 0.35, warm: 0.45, night: 0.12, exposure: 1.06, cloud: '#ffc4a8' },
  night: { sky: '#060b24', mid: '#121c46', hor: '#283063', sun: '#9fb4ff', sunI: 0.75, hemi: 0.32, ground: '#22202c', elev: 40, az: -55, fogNear: 70, fogFar: 520, lamps: 6.0, stars: 1, mist: 0.3, warm: 0.3, night: 1, exposure: 1.3, cloud: '#3a4468' },
};

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer; this.quality = quality;
    this.scene = new THREE.Scene();
    this.colliders = { circles: [], boxes: [] };
    this.pickables = []; this.bells = []; this.npcs = []; this.updaters = [];
    this.windTime = { value: 0 };
    this.flames = new FlameField(320);
    this.scene.add(this.flames.points);
    this.graph = this._buildGraph();
    this.labels = [];
    this.todName = 'morning';
    this.build();
  }

  _buildGraph() {
    const nodes = {}; for (const [k, [x, z]] of Object.entries(NODES)) nodes[k] = { id: k, p: new THREE.Vector3(x, 0, z), n: [] };
    for (const [a, b] of EDGES) { nodes[a].n.push(b); nodes[b].n.push(a); }
    return nodes;
  }
  route(fromPos, toId) {
    // nearest node, then BFS shortest hop path (edges are roughly uniform length)
    let best = null, bd = Infinity; for (const n of Object.values(this.graph)) { const d = n.p.distanceToSquared(fromPos); if (d < bd) { bd = d; best = n; } }
    const prev = { [best.id]: null }, q = [best.id];
    while (q.length) { const c = q.shift(); if (c === toId) break; for (const nb of this.graph[c].n) if (!(nb in prev)) { prev[nb] = c; q.push(nb); } }
    const path = []; let c = toId; while (c) { path.unshift(this.graph[c].p.clone()); c = prev[c]; }
    return path;
  }

  build() {
    const S = this.scene;
    S.fog = new THREE.Fog('#e9cfa6', 70, 240);
    this._sky();
    // lights
    this.hemi = new THREE.HemisphereLight('#fff1d6', '#6b5a3a', 0.9); S.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe2b0', 3.0);
    this.sun.castShadow = this.quality.shadows > 0;
    this.sun.shadow.mapSize.set(this.quality.shadows || 512, this.quality.shadows || 512);
    const sc = this.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.04;
    S.add(this.sun, this.sun.target);
    this.pointPool = [];
    for (let i = 0; i < (this.quality.level === 'low' ? 2 : 4); i++) { const l = new THREE.PointLight('#ffae5a', 0, 7, 1.6); S.add(l); this.pointPool.push(l); }

    this.flora = new Flora(this.scene, this.quality, this.windTime);
    this._ground();
    this._wall();
    this._gateway();
    this._plaza();
    this._ponds();
    for (const t of Object.values(TEMPLES)) this._temple(t);
    this._chhatris();
    this._approach();
    this._courtNandi();
    this._peacock(new THREE.Vector3(23.5, 0, 9.5), -2.2);
    this._peacock(new THREE.Vector3(-21, 0, -10), 0.9);
    this._rangolis();
    this._gardens();
    this._urlis();
    this._grassPoints();
    this.flora.build((p) => this._diya(p, 0.38));
    this._pathDiyas();
    this._bunting();
    this.scenery = new Scenery(this.scene, this.quality, this.water, this.bedSpots || []);
    this._npcs();
    this.setTimeOfDay(this.todName, true);
  }

  _sky() {
    const u = this.skyU = { mid: { value: new THREE.Color('#f0b8a8') }, top: { value: new THREE.Color('#7fa7c9') }, bottom: { value: new THREE.Color('#f3d9ae') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#ffd9a0') } };
    const m = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vW;
        void main(){ float h = clamp(vW.y*1.3+0.08, 0.0, 1.0);
          vec3 c = h < 0.3 ? mix(bottom, mid, h/0.3) : mix(mid, top, pow((h-0.3)/0.7, 0.8));
          float s = max(dot(normalize(vW), normalize(sunDir)), 0.0); c += sunCol*(smoothstep(0.9993, 0.9997, s)*6.0 + pow(s, 10.0)*0.5 + pow(s, 3.0)*0.12);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), m); this.scene.add(this.sky);
  }

  _ground() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: TX.grass([60, 60]), roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; g.userData.ground = true; this.scene.add(g); this.ground = g; this.pickables.push(g);
    // inner lawn tone inside the walls: compacted earth paths
    const pathMat = new THREE.MeshStandardMaterial({ map: TX.paving('path', '#e0c9a6', [1, 8]), roughness: 0.85 });
    const strip = (x, z, w, d, rep) => { const m = pathMat.clone(); m.map = TX.paving('path', '#e0c9a6', rep); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.02, z); p.receiveShadow = true; p.userData.ground = true; this.scene.add(p); this.pickables.push(p); };
    strip(0, 31, 5, 38, [1.25, 9.5]);   // south approach through the gate
    strip(-17.5, 0, 12, 5, [3, 1.25]);  // west to Ganesha
    strip(17.5, 0, 12, 5, [3, 1.25]);   // east to Krishna
    strip(0, -17.5, 5, 12, [1.25, 3]);  // north to Shiva
    // distant hills for a soft horizon
    // the mountains, waterfalls and sky life live in scenery.js
  }

  _wall() {
    const m = stoneMat('#cfa877', [6, 0.5], { rows: 2 });
    const cap = new THREE.MeshStandardMaterial({ color: '#b98d5a', roughness: 0.8 });
    const seg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), w = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 0.7), m);
      w.position.set((x0 + x1) / 2, 0.9, (z0 + z1) / 2); w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); w.castShadow = w.receiveShadow = true; this.scene.add(w);
      const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.9), cap); c.position.copy(w.position); c.position.y = 1.88; c.rotation.y = w.rotation.y; this.scene.add(c);
      this.colliders.boxes.push({ minX: Math.min(x0, x1) - 0.5, maxX: Math.max(x0, x1) + 0.5, minZ: Math.min(z0, z1) - 0.5, maxZ: Math.max(z0, z1) + 0.5 });
    };
    seg(-46, -46, 46, -46); seg(-46, -46, -46, 40); seg(46, -46, 46, 40); seg(-46, 40, -4.2, 40); seg(4.2, 40, 46, 40);
    // corner kiosks
    for (const [x, z] of [[-46, -46], [46, -46], [-46, 40], [46, 40]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), m); b.position.set(x, 1.6, z); b.castShadow = true; this.scene.add(b);
      const d = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap); d.position.set(x, 3.2, z); this.scene.add(d);
      const k = kalasha(0.6); k.position.set(x, 4.3, z); this.scene.add(k);
    }
  }

  _gateway() {
    const S = this.scene, z = 40;
    const m = stoneMat('#efe2cb', [1, 3], { rows: 6 }), band = bandMat('#e3cfa9');
    const gate = new THREE.Group(); gate.position.set(0, 0, z); S.add(gate); this.occluders = [gate];
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.4, 2.4), m); p.position.set(s * 3.6, 3.2, 0); p.castShadow = p.receiveShadow = true; gate.add(p);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 2.6), band); b.position.set(s * 3.6, 1.0, 0); gate.add(b);
      const b2 = b.clone(); b2.position.y = 4.6; gate.add(b2);
      this.colliders.boxes.push({ minX: s * 3.6 - 1.25, maxX: s * 3.6 + 1.25, minZ: z - 1.3, maxZ: z + 1.3 });
      // guardian lamp posts
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8), m); post.position.set(s * 5.6, 0.8, 2.6); S.add(post);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.2, 10), brass); lamp.position.set(s * 5.6, 1.7, 2.6); S.add(lamp);
      this.flames.add(new THREE.Vector3(s * 5.6, 1.88, 2.6), 0.6);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 2.8), m); lintel.position.y = 6.9; lintel.castShadow = true; gate.add(lintel);
    const lb = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.35, 3.0), band); lb.position.y = 6.3; gate.add(lb);
    // stepped gopuram tiers
    for (let i = 0; i < 5; i++) {
      const w = 9.6 - i * 1.4, d = 2.6 - i * 0.25;
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), m); t.position.y = 7.9 + i * 0.95; t.castShadow = true; gate.add(t);
      const l = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.14, d + 0.2), band); l.position.y = 8.35 + i * 0.95; gate.add(l);
      for (let k = -2; k <= 2; k++) { if (Math.abs(k) * 1.6 > w / 2 - 0.4) continue; const n = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.2), darkStone); n.position.set(k * 1.6, 7.9 + i * 0.95, d / 2 + 0.05); gate.add(n); }
    }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 2.6, 4, 1), m); roof.rotation.set(Math.PI / 2, 0, Math.PI / 4); roof.scale.set(1, 1, 0.8); roof.position.y = 13; gate.add(roof);
    for (let k = -1; k <= 1; k++) { const kk = kalasha(0.7); kk.position.set(k * 0.9, 13.4, 0); gate.add(kk); }
    // hanging bells under the lintel
    const pts = [-2.4, -1.2, 0, 1.2, 2.4];
    pts.forEach((x, i) => {
      const b = new HangingBell(i === 2 ? 1.6 : 1.15); b.group.position.set(x, 6.35, 0.9); b.axis = 'x'; gate.add(b.group);
      b.worldPos = new THREE.Vector3(x, 5.6, z + 0.9); b.soundSize = i === 2 ? 1.5 : 1.05 + i * 0.04;
      this.bells.push(b); this.pickables.push(b.group);
    });
    // mango-leaf and marigold toran
    gate.add(garland(new THREE.Vector3(-2.6, 6.2, 1.45), new THREE.Vector3(2.6, 6.2, 1.45), 0.45, 34));
    gate.add(garland(new THREE.Vector3(-2.6, 6.2, -1.45), new THREE.Vector3(2.6, 6.2, -1.45), 0.45, 34));
    this.gateBells = this.bells.slice();
  }

  _plaza() {
    const S = this.scene;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(12.6, 64), new THREE.MeshStandardMaterial({ map: TX.paving('plaza', '#e6d3b4', [7, 7]), roughness: 0.82 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; plaza.userData.ground = true; S.add(plaza); this.pickables.push(plaza);
    const ring = new THREE.Mesh(new THREE.RingGeometry(12.0, 12.8, 64), new THREE.MeshStandardMaterial({ color: '#9c7a52', roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; S.add(ring);
    const inner = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.6, 48), ring.material); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.04; S.add(inner);
    // rangoli-like inlay around the fountain
    const petals = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshStandardMaterial({ color: '#b5412c', roughness: 0.7 }), 16);
    const m4 = new THREE.Matrix4(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; m4.makeRotationX(-Math.PI / 2); m4.setPosition(Math.cos(a) * 3.6, 0.045, Math.sin(a) * 3.6); petals.setMatrixAt(i, m4); } S.add(petals);
    // fountain
    const stone = stoneMat('#e3cfae', [3, 0.4], { blocks: false });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.85, 0.6, 32, 1, true), stone); basin.position.y = 0.3; basin.castShadow = basin.receiveShadow = true; S.add(basin);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.14, 8, 40), stone); lip.rotation.x = Math.PI / 2; lip.position.y = 0.6; S.add(lip);
    this.water = new THREE.MeshStandardMaterial({ color: '#3d7d7a', roughness: 0.22, metalness: 0.2, normalMap: TX.waterNormal(), normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.92 });
    const w = new THREE.Mesh(new THREE.CircleGeometry(2.7, 40), this.water); w.rotation.x = -Math.PI / 2; w.position.y = 0.5; S.add(w);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.3, 16), stone); ped.position.y = 0.95; S.add(ped);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stone); bowl.position.y = 1.75; bowl.scale.y = 0.45; S.add(bowl);
    const bw = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), this.water); bw.rotation.x = -Math.PI / 2; bw.position.y = 1.72; S.add(bw);
    // lotus bud finial
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#e9a7b0', roughness: 0.6 })); bud.scale.y = 1.5; bud.position.y = 2.0; S.add(bud);
    const jets = fountainJets(this.quality.level === 'low' ? 220 : 520, new THREE.Vector3(0, 2.1, 0), { height: 0.9, radius: 2.1 });
    S.add(jets); this.updaters.push((dt, t) => { jets.material.uniforms.uTime.value = t; });
    { const c = document.createElement('canvas'); c.width = 128; c.height = 16; const x = c.getContext('2d');
      x.fillStyle = 'rgba(220,240,245,0.55)'; x.fillRect(0, 0, 128, 16); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; x.fillRect(Math.random() * 128, Math.random() * 16, 10 + Math.random() * 30, 1 + Math.random() * 2); }
      const st = new THREE.CanvasTexture(c); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.colorSpace = THREE.SRGBColorSpace;
      const sm = new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: 0.8, depthWrite: false, color: '#eef9fb' });
      const rm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
      const ripples = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8, c0 = new THREE.Vector3(Math.cos(a) * 0.92, 1.8, Math.sin(a) * 0.92), c2 = new THREE.Vector3(Math.cos(a) * 2.05, 0.5, Math.sin(a) * 2.05);
        const curve = new THREE.QuadraticBezierCurve3(c0, new THREE.Vector3(Math.cos(a) * 1.7, 2.05, Math.sin(a) * 1.7), c2);
        S.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 6), sm));
        for (let k = 0; k < 2; k++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 24), rm.clone()); r.rotation.x = -Math.PI / 2; r.position.set(c2.x, 0.51, c2.z); S.add(r); ripples.push({ r, ph: k * 0.6 + i * 0.13 }); }
      }
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.75, 8, 1, true), sm); jet.position.y = 2.6; S.add(jet);
      // stone lotus petals crowning the upper bowl
      const petal = new THREE.SphereGeometry(0.2, 10, 8); petal.scale(0.55, 1, 0.22); petal.translate(0, 0.18, 0);
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, pm = new THREE.Mesh(petal, stone); pm.position.set(Math.cos(a) * 0.98, 1.72, Math.sin(a) * 0.98); pm.rotation.set(0, -a + Math.PI / 2, 0); pm.rotateX(0.55); S.add(pm); }
      this.updaters.push((dt, t) => { st.offset.x = (st.offset.x - dt * 1.6) % 1; for (const p of ripples) { const k = ((t * 0.8 + p.ph) % 1.2) / 1.2; p.r.scale.setScalar(1 + k * 4); p.r.material.opacity = 0.5 * (1 - k); } });
    }
    this.colliders.circles.push({ x: 0, z: 0, r: 3.0 });
    // small lotus ponds on the diagonals
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx * 4.6, z = sz * 4.6;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 8, 32), stone); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.2, z); rim.castShadow = true; S.add(rim);
      const wtr = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), this.water); wtr.rotation.x = -Math.PI / 2; wtr.position.set(x, 0.14, z); S.add(wtr);
      this._lotuses(x, z, 1.25, 4, 0.14);
      this.colliders.circles.push({ x, z, r: 1.85 });
    }
    // plaza rim diyas
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; if (this._nearAxis(a)) continue; this._diya(new THREE.Vector3(Math.cos(a) * 12.35, 0.05, Math.sin(a) * 12.35)); }
  }
  _nearAxis(a) { const d = (x) => Math.abs(Math.atan2(Math.sin(a - x), Math.cos(a - x))); return [0, Math.PI / 2, Math.PI, -Math.PI / 2].some(x => d(x) < 0.2); }

  _lotuses(cx, cz, r, n, y, rect) { this.flora.addLotusPond(cx, cz, r, y, n, rect); }

  _urlis() {
    // brass urli bowls of water with floating flowers and diyas, set around the fountain
    for (const [x, z] of [[2.9, 7.0], [-2.9, 7.0], [2.9, -7.0], [-2.9, -7.0]]) { this.flora.addUrli(x, z); this.colliders.circles.push({ x, z, r: 0.95 }); }
  }

  _grassPoints() {
    const n = this.quality.level === 'low' ? 0 : this.quality.level === 'medium' ? 2200 : 4000, pts = [];
    const blocked = (x, z) => {
      if (Math.hypot(x, z) < 13.2) return true;
      if (Math.abs(x) < 3.8 && z > 11 && z < 41) return true;
      if (Math.abs(z) < 3.2 && Math.abs(x) > 11 && Math.abs(x) < 23) return true;
      if (Math.abs(x) < 3.2 && z < -11 && z > -23) return true;
      for (const b of this.colliders.boxes) if (x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) return true;
      for (const c of this.colliders.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.2) return true;
      return false;
    };
    for (let i = 0; pts.length < n && i < n * 4; i++) { const x = (Math.random() * 2 - 1) * 45, z = -45 + Math.random() * 84; if (!blocked(x, z)) pts.push([x, z]); }
    this.flora.addGrass(pts);
  }

  _ponds() {
    // two long stepped tanks (kund) flanking the approach
    const stone = stoneMat('#d1b48a', [4, 0.3], { rows: 1 });
    for (const sx of [-1, 1]) {
      const x = sx * 8.5, z = 25, w = 6, d = 11;
      for (const [px, pz, bw, bd] of [[x, z - d / 2, w + 0.6, 0.5], [x, z + d / 2, w + 0.6, 0.5], [x - w / 2, z, 0.5, d], [x + w / 2, z, 0.5, d]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.45, bd), stone); b.position.set(px, 0.22, pz); b.castShadow = b.receiveShadow = true; this.scene.add(b);
      }
      const step = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.1, d - 0.4), new THREE.MeshStandardMaterial({ color: '#7c6a4f', roughness: 0.9 })); step.position.set(x, 0.05, z); this.scene.add(step);
      const wtr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, d - 0.5), this.water); wtr.rotation.x = -Math.PI / 2; wtr.position.set(x, 0.3, z); this.scene.add(wtr);
      this._lotuses(x, z, 2.4, 10, 0.3, [w - 1.2, d - 1.2]);
      this.colliders.boxes.push({ minX: x - w / 2 - 0.3, maxX: x + w / 2 + 0.3, minZ: z - d / 2 - 0.3, maxZ: z + d / 2 + 0.3 });
      for (let k = 0; k < 5; k++) this._diya(new THREE.Vector3(x - sx * (w / 2 + 0.05), 0.46, z - d / 2 + 1 + k * 2.2));
    }
  }

  _temple(T) {
    const g = new THREE.Group(); g.position.copy(T.pos); g.rotation.y = T.rot; this.scene.add(g); T.group = g;
    const stone = stoneMat(T.stone, [3, 1.5], { rows: 4 }), stoneFine = stoneMat(T.stone, [1, 1], { blocks: false });
    stone.roughness = 0.6; stoneFine.roughness = 0.5;
    const band = bandMat('#e9d6b4'), accent = paleGold;
    const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
    // platform (jagati) with mouldings
    add(new THREE.BoxGeometry(13, 1.2, 16), stone, 0, 0.6, 0);
    add(new THREE.BoxGeometry(13.4, 0.25, 16.4), band, 0, 0.14, 0);
    add(new THREE.BoxGeometry(13.3, 0.22, 16.3), band, 0, 1.12, 0);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(4.2, 0.24 * (i + 1), 0.42), stoneFine, 0, 0.12 * (i + 1), 9.9 - i * 0.4);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.5, 1.3, 2.2), band, s * 2.35, 0.65, 9.0); this._diyaLocal(g, new THREE.Vector3(s * 2.35, 1.32, 9.6)); this._diyaLocal(g, new THREE.Vector3(s * 2.35, 1.32, 8.4)); }
    // mandapa pillars
    const pillarGeo = pillarGeometry(3.2, 0.24);
    const pillars = new THREE.InstancedMesh(pillarGeo, stoneFine, 12); pillars.castShadow = pillars.receiveShadow = true;
    let k = 0; const m4 = new THREE.Matrix4();
    for (const x of [-4.4, -1.5, 1.5, 4.4]) for (const z of [1.4, 4.3, 7.2]) { m4.makeTranslation(x, 1.2, z); pillars.setMatrixAt(k++, m4); }
    g.add(pillars);
    add(new THREE.BoxGeometry(10.4, 0.5, 7.4), stone, 0, 4.65, 4.3);
    add(new THREE.BoxGeometry(10.9, 0.18, 7.9), band, 0, 4.4, 4.3);
    add(new THREE.BoxGeometry(11.2, 0.22, 8.2), accent, 0, 4.95, 4.3);
    // sloping eave (chajja)
    const eave = add(new THREE.BoxGeometry(11.6, 0.12, 1.2), accent, 0, 4.25, 8.2); eave.rotation.x = 0.35;
    // dome over the mandapa: this is the prayer hall
    add(new THREE.CylinderGeometry(3.0, 3.2, 0.7, 24), band, 0, 5.4, 4.3);
    const dome = add(new THREE.SphereGeometry(3.0, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), stoneFine, 0, 5.75, 4.3); dome.scale.y = 0.85;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const rib = add(new THREE.TorusGeometry(3.0, 0.05, 4, 24, Math.PI / 2), accent, 0, 5.75, 4.3); rib.rotation.set(0, a, Math.PI / 2); rib.scale.set(0.85, 1, 1); }
    const dk = kalasha(0.8); dk.position.set(0, 8.2, 4.3); g.add(dk);
    // small domed pavilions crown the mandapa corners, the front pair carrying flags
    for (const [x, z] of [[-4.6, 1.2], [4.6, 1.2], [-4.6, 7.4], [4.6, 7.4]]) {
      const c = chhatri(0.4, stoneFine, paleGold); c.position.set(x, 5.06, z); g.add(c);
      if (z > 5) this._flag(g, new THREE.Vector3(x, 5.06 + c.userData.top, z), T.flag, 0.55, -T.rot);
    }
    // sanctum walls with niches and pilasters
    add(new THREE.BoxGeometry(7.6, 5.0, 7.6), stone, 0, 3.7, -3.6);
    for (const [x, z, ry] of [[3.82, -3.6, Math.PI / 2], [-3.82, -3.6, -Math.PI / 2], [0, -7.42, Math.PI]]) {
      const n = add(new THREE.BoxGeometry(1.3, 2.0, 0.2), darkStone, x, 3.6, z); n.rotation.y = ry;
      const f = add(new THREE.BoxGeometry(1.8, 2.6, 0.18), band, x * 1.005, 3.6, z * 1.0 + (z < -7 ? -0.01 : 0)); f.rotation.y = ry; f.scale.z = 0.8;
      n.position.add(new THREE.Vector3(Math.sin(ry) * 0.06, 0, Math.cos(ry) * 0.06));
    }
    add(new THREE.BoxGeometry(8.0, 0.35, 8.0), band, 0, 6.2, -3.6);
    // shikhara
    const tower = shikhara(6.8, 9.5, stone, accent); tower.position.set(0, 6.35, -3.6); g.add(tower);
    // flag on the finial
    const flagH = 6.35 + tower.userData.top;
    add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), gold, 0, flagH + 1.0, -3.6);
    const flagGeo = new THREE.BufferGeometry();
    const fv = new Float32Array([0, 0, 0, 1.6, -0.35, 0, 0, -0.8, 0]); const fuv = new Float32Array([0, 1, 1, 0.5, 0, 0]);
    flagGeo.setAttribute('position', new THREE.BufferAttribute(fv, 3)); flagGeo.setAttribute('uv', new THREE.BufferAttribute(fuv, 2)); flagGeo.computeVertexNormals();
    const fm = windify(new THREE.MeshStandardMaterial({ color: T.flag, roughness: 0.8, side: THREE.DoubleSide }), { amp: 0.35, freq: 4.2, axis: 'z' }, this.windTime);
    const sub = new THREE.BufferGeometry(); sub.copy(flagGeo); const pos = sub.attributes.position;
    // subdivide for smooth waving
    const segs = 10, verts = [], uvs = [];
    for (let i = 0; i < segs; i++) { const a = i / segs, b = (i + 1) / segs;
      const top = (u) => [u * 1.6, -0.35 * u, 0], bot = (u) => [u * 1.6, -0.8 + 0.45 * u, 0];
      verts.push(...top(a), ...bot(a), ...top(b), ...top(b), ...bot(a), ...bot(b)); uvs.push(a, 1, a, 0, b, 1, b, 1, a, 0, b, 0); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.computeVertexNormals();
    const flag = new THREE.Mesh(fg, fm); flag.position.set(0.03, flagH + 2.15, -3.6); flag.rotation.y = -T.rot + Math.PI * 0.15; g.add(flag); void pos;
    // sanctum doorway, glowing from within
    add(new THREE.BoxGeometry(2.4, 3.2, 0.3), gold, 0, 2.8, 0.12);
    add(new THREE.BoxGeometry(1.9, 2.8, 0.32), new THREE.MeshStandardMaterial({ color: '#2a120a', emissive: '#ffa548', emissiveIntensity: 1.6, roughness: 1 }), 0, 2.6, 0.14);
    add(new THREE.BoxGeometry(0.2, 3.4, 0.4), band, -1.3, 2.9, 0.15); add(new THREE.BoxGeometry(0.2, 3.4, 0.4), band, 1.3, 2.9, 0.15);
    this._diyaLocal(g, new THREE.Vector3(-1.05, 1.24, 0.6)); this._diyaLocal(g, new THREE.Vector3(1.05, 1.24, 0.6));
    // garlands between the front pillars
    for (const [a, b] of [[-4.4, -1.5], [-1.5, 1.5], [1.5, 4.4]]) g.add(garland(new THREE.Vector3(a, 4.15, 7.45), new THREE.Vector3(b, 4.15, 7.45), 0.55, 24));
    // entrance bell
    const bell = new HangingBell(1.25); bell.group.position.set(0, 4.4, 6.6); g.add(bell.group); bell.axis = 'x';
    bell.worldPos = new THREE.Vector3(0, 3.6, 6.6).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale)); bell.soundSize = 1.2;
    this.bells.push(bell); this.pickables.push(bell.group);
    // deity-specific touches
    if (T.id === 'shiva') this._nandi(g, new THREE.Vector3(0, 1.2, 5.8));
    if (T.id === 'krishna') { this._tulsi(g, new THREE.Vector3(-5, 0, 10.8)); this._tulsi(g, new THREE.Vector3(5, 0, 10.8)); }
    if (T.id === 'ganesha') { for (const s of [-1, 1]) { const st = add(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 10), stoneFine, s * 4.8, 0.55, 11.2); void st; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.25, 0.22, 12), brass); l.position.set(s * 4.8, 1.2, 11.2); g.add(l); this._diyaLocal(g, new THREE.Vector3(s * 4.8, 1.32, 11.2), 0.55); } }
    // tappable footprint + collider in world space
    g.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.userData.shrine = T.id; });
    this.pickables.push(g); this.occluders.push(g);
    const hw = 6.6, front = 10.3, back = -8.2;
    const corners = [[-hw, back], [hw, back], [-hw, front], [hw, front]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), T.rot).add(T.pos));
    this.colliders.boxes.push({ minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)), minZ: Math.min(...corners.map(c => c.z)), maxZ: Math.max(...corners.map(c => c.z)) });
    T.labelPos = new THREE.Vector3(0, 9.5, 4.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), T.rot).add(T.pos);
  }

  _nandi(parent, p, m = darkStone, scale = 1) {
    const grp = new THREE.Group(); grp.position.copy(p); grp.scale.setScalar(scale); parent.add(grp);
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; grp.add(o); return o; };
    add(new THREE.BoxGeometry(1.4, 0.2, 2.0), 0, 0.1, 0, 1, 1, 1, stoneMat('#cfc2ad', [1, 1], { blocks: false }));
    add(new THREE.SphereGeometry(0.5, 20, 14), 0, 0.62, 0, 0.95, 0.78, 1.55);           // body, seated
    add(new THREE.SphereGeometry(0.28, 14, 10), 0, 1.0, -0.38, 1.0, 0.9, 1.0);           // hump
    add(new THREE.SphereGeometry(0.24, 14, 10), 0, 1.02, -0.92, 0.85, 1.0, 1.25).rotation.x = 0.4; // head
    add(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 10), 0, 0.86, -1.12, 1, 1, 1).rotation.x = 1.2; // muzzle
    for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.045, 0.24, 8), s * 0.13, 1.25, -0.86); h.rotation.z = -s * 0.5; add(new THREE.SphereGeometry(0.07, 8, 6), s * 0.2, 1.08, -0.82, 1.4, 0.6, 0.5); }
    for (const [x, z] of [[-0.32, -0.5], [0.32, -0.5], [-0.3, 0.55], [0.3, 0.55]]) add(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 8), x, 0.3, z).rotation.x = Math.PI / 2;
    const g2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 8, 22), new THREE.MeshStandardMaterial({ color: '#f29a17', roughness: 0.9 })); g2.position.set(0, 0.85, -0.72); g2.rotation.x = 1.1; grp.add(g2);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: '#a3242a', roughness: 0.8 })); cloth.position.set(0, 1.0, 0.15); cloth.rotation.x = 0.05; grp.add(cloth);
    return grp;
  }

  _tulsi(parent, p) {
    const m = stoneMat('#e5cfa8', [1, 1], { blocks: false });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.9), m); base.position.copy(p).add(new THREE.Vector3(0, 0.5, 0)); base.castShadow = true; parent.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.15, 1.05), m); top.position.copy(p).add(new THREE.Vector3(0, 1.05, 0)); parent.add(top);
    const leafM = windify(new THREE.MeshStandardMaterial({ color: '#3f6b2c', roughness: 0.8 }), { amp: 0.04, freq: 2.2, axis: 'x', weightBy: 'height' }, this.windTime);
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), leafM); b.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4)); parent.add(b); }
  }

  _flag(parent, pos, color, size = 1, rotY = 0) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * size, 0.02 * size, 1.6 * size, 6), gold); pole.position.copy(pos).add(new THREE.Vector3(0, 0.8 * size, 0)); parent.add(pole);
    const segs = 8, verts = [], uvs = [];
    for (let i = 0; i < segs; i++) { const a = i / segs, b = (i + 1) / segs;
      const top = (u) => [u * 1.1 * size, -0.25 * size * u, 0], bot = (u) => [u * 1.1 * size, (-0.6 + 0.35 * u) * size, 0];
      verts.push(...top(a), ...bot(a), ...top(b), ...top(b), ...bot(a), ...bot(b)); uvs.push(a, 1, a, 0, b, 1, b, 1, a, 0, b, 0); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.computeVertexNormals();
    const fm = this._flagMats = this._flagMats || {};
    const m = fm[color] || (fm[color] = windify(new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }), { amp: 0.3, freq: 4.4, axis: 'z' }, this.windTime));
    const f = new THREE.Mesh(fg, m); f.position.copy(pos).add(new THREE.Vector3(0.02, 1.58 * size, 0)); f.rotation.y = rotY + Math.PI * 0.2; parent.add(f);
  }

  _chhatris() {
    const spots = [[-12.5, 16, 1], [12.5, 16, 1], [-12.5, -15.5, 1], [12.5, -15.5, 1], [-8.5, 25, 0.62], [8.5, 25, 0.62]];
    for (const [x, z, s] of spots) {
      const c = chhatri(s); c.position.set(x, s < 1 ? 0.12 : 0, z); this.scene.add(c);
      this._flag(this.scene, new THREE.Vector3(x, c.position.y + c.userData.top, z), '#e8731c', 0.7 * s);
      this._diya(new THREE.Vector3(x, c.position.y + 0.37 * s, z), 0.55);
      if (s >= 1) { this.colliders.circles.push({ x, z, r: 1.75 * s }); for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) this._diya(new THREE.Vector3(x + dx, 0.05, z + dz), 0.42); }
    }
  }

  _approach() {
    // carved balustrades and lamp posts along the approach, and railings around the kunds
    const posts = [], balusters = [], rails = [];
    const line = (ax, az, bx, bz, y, h, step, withPosts) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / step);
      for (let i = 1; i < n; i++) { const k = i / n; balusters.push([ax + (bx - ax) * k, y, az + (bz - az) * k, h]); }
      rails.push([ax, az, bx, bz, y, h]);
      if (withPosts) { posts.push([ax, az]); posts.push([bx, bz]); }
    };
    for (const sx of [-1, 1]) {
      const zs = [13.6, 19.6, 25.6, 31.6, 37.4];
      for (let i = 0; i < zs.length - 1; i++) line(sx * 3.4, zs[i], sx * 3.4, zs[i + 1], 0, 0.72, 0.42, true);
      this.colliders.boxes.push({ minX: sx > 0 ? 3.15 : -3.65, maxX: sx > 0 ? 3.65 : -3.15, minZ: 13.3, maxZ: 37.7 });
      const x = sx * 8.5, z = 25, w = 6.6, d = 11.6;
      line(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 0.45, 0.5, 0.45, false); line(x - w / 2, z + d / 2, x + w / 2, z + d / 2, 0.45, 0.5, 0.45, false);
      line(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 0.45, 0.5, 0.45, false); line(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 0.45, 0.5, 0.45, false);
    }
    for (const T of Object.values(TEMPLES)) for (const s of [-1, 1]) { const p = new THREE.Vector3(s * 3.3, 0, 12.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), T.rot).add(T.pos); posts.push([p.x, p.z]); this.colliders.circles.push({ x: p.x, z: p.z, r: 0.4 }); }
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; posts.push([Math.cos(a) * 13.4, Math.sin(a) * 13.4]); }
    const uniq = []; for (const p of posts) if (!uniq.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.1)) uniq.push(p);
    const bGeo = balusterGeometry(1);
    const bal = new THREE.InstancedMesh(bGeo, ivory, balusters.length); bal.castShadow = this.quality.level !== 'low';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    balusters.forEach(([x, y, z, h], i) => { m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, h, 1)); bal.setMatrixAt(i, m); });
    this.scene.add(bal);
    for (const [ax, az, bx, bz, y, h] of rails) {
      const len = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
      for (const [yy, th, wd, mat] of [[y + h, 0.08, 0.2, paleGold], [y + h - 0.05, 0.06, 0.16, ivory], [y + 0.04, 0.08, 0.22, ivory]]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(len, th, wd), mat); r.position.set((ax + bx) / 2, yy, (az + bz) / 2); r.rotation.y = ang; r.castShadow = true; this.scene.add(r);
      }
    }
    const pg = lampPostGeometry(1.25);
    const pm = new THREE.InstancedMesh(pg, ivory, uniq.length); pm.castShadow = true;
    const bowls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.14, 0.16, 16), brass, uniq.length);
    uniq.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); pm.setMatrixAt(i, m); m.makeTranslation(x, 1.33, z); bowls.setMatrixAt(i, m); this._diya(new THREE.Vector3(x, 1.38, z), 0.85); });
    this.scene.add(pm, bowls);
  }

  _courtNandi() {
    const x = -6.2, z = -17.2;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 3.2), ivory); pl.position.set(x, 0.45, z); pl.castShadow = pl.receiveShadow = true; this.scene.add(pl);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 3.3), paleGold); band.position.set(x, 0.86, z); this.scene.add(band);
    this._nandi(this.scene, new THREE.Vector3(x, 0.9, z), brass, 1.2);
    this.colliders.boxes.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.7, maxZ: z + 1.7 });
  }

  _peacock(p, rotY) {
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = rotY; this.scene.add(g);
    const blue = new THREE.MeshStandardMaterial({ color: '#1d4fa6', roughness: 0.35, metalness: 0.35 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), blue); body.scale.set(0.8, 0.85, 1.4); body.position.y = 0.55; body.castShadow = true; g.add(body);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0.2), new THREE.Vector3(0, 0.8, 0.3), new THREE.Vector3(0, 0.98, 0.32)]), 8, 0.05, 8), blue); g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), blue); head.position.set(0, 1.0, 0.33); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 6), new THREE.MeshStandardMaterial({ color: '#d8c8a8' })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.99, 0.41); g.add(beak);
    for (let i = -1; i <= 1; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), blue); c.position.set(i * 0.02, 1.09, 0.32); c.rotation.z = i * 0.25; g.add(c); const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), blue); b.position.set(i * 0.033, 1.14, 0.32); g.add(b); }
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 5), new THREE.MeshStandardMaterial({ color: '#8b7a62' })); l.position.set(s * 0.07, 0.2, 0); g.add(l); }
    const fan = new THREE.Group(); fan.position.set(0, 0.55, -0.2); fan.rotation.x = -0.3; g.add(fan);
    const fGeo = new THREE.PlaneGeometry(0.3, 1.5); fGeo.translate(0, 0.75, 0);
    const fMat = new THREE.MeshStandardMaterial({ map: TX.featherTexture(), transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.2 });
    for (let i = 0; i < 23; i++) { const a = -1.35 + i / 22 * 2.7; const f = new THREE.Mesh(fGeo, fMat); f.rotation.z = a; f.position.z = -0.01 * Math.abs(a); fan.add(f); }
    this.updaters.push((dt, t) => { fan.rotation.x = -0.3 + Math.sin(t * 2.3) * 0.03; fan.scale.x = 1 + Math.sin(t * 7) * 0.01; });
    this.colliders.circles.push({ x: p.x, z: p.z, r: 0.9 });
  }

  _rangolis() {
    const place = (x, z, size, seed) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: TX.rangoli(seed), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.045, z); m.receiveShadow = true; this.scene.add(m); };
    place(0, 15.6, 3.4, 1); place(0, 34.5, 3.0, 2);
    for (const T of Object.values(TEMPLES)) place(T.entrance.x, T.entrance.z, 3.0, T.id.length);
  }

  _gardens() {
    const S = this.scene;
    const keepClear = (x, z, r) => {
      if (Math.hypot(x, z) < 15 + r) return false;
      if (Math.abs(x) < 4.5 + r && z > 8 && z < 48) return false;
      if (Math.abs(z) < 4.5 + r && Math.abs(x) < 24) return false;
      if (Math.abs(x) < 4.5 + r && z < -8 && z > -24) return false;
      if (Math.abs(x) > 44 - r || z < -44 + r || z > 38.5 - r) return false;
      for (const b of this.colliders.boxes) if (x > b.minX - r - 1.5 && x < b.maxX + r + 1.5 && z > b.minZ - r - 1.5 && z < b.maxZ + r + 1.5) return false;
      for (const [a, b] of EDGES) { const A = this.graph[a].p, B = this.graph[b].p; if (segDist(x, z, A.x, A.z, B.x, B.z) < r + 2.2) return false; }
      for (const c of this.colliders.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r + 0.8) return false;
      return true;
    };
    // trees: a mix of species, with the Krishna side given over to flowering trees
    const N = this.quality.level === 'low' ? 34 : 54, spots = [];
    let tries = 0;
    while (spots.length < N && tries++ < 4000) {
      const x = (Math.random() * 2 - 1) * 44, z = -44 + Math.random() * 82;
      if (!keepClear(x, z, 1.6) || !spots.every(s => Math.hypot(s[0] - x, s[1] - z) > 4.6)) continue;
      const nearWall = Math.abs(x) > 38 || z < -38 || z > 33, krishnaSide = x > 14;
      const r = Math.random();
      const kind = nearWall && r < 0.45 ? 'palm' : krishnaSide ? (r < 0.4 ? 'gulmohar' : r < 0.75 ? 'bougainvillea' : r < 0.9 ? 'jacaranda' : 'neem')
        : (r < 0.38 ? 'neem' : r < 0.55 ? 'ashoka' : r < 0.7 ? 'gulmohar' : r < 0.85 ? 'bougainvillea' : r < 0.93 ? 'jacaranda' : 'palm');
      spots.push([x, z, kind]);
    }
    for (const [x, z, kind] of spots) { const s = 0.85 + Math.random() * 0.35; this.flora.addTree(kind, x, z, s); this.colliders.circles.push({ x, z, r: kind === 'palm' ? 0.4 : 0.45 * s + 0.15 }); }
    // outside the walls: palms and shade trees for depth
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, r = 54 + Math.random() * 36; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 8 && z > 40) continue; this.flora.addTree(Math.random() < 0.4 ? 'palm' : Math.random() < 0.7 ? 'neem' : 'ashoka', x, z, 0.9 + Math.random() * 0.4); }
    // raised flower beds (marigold, hibiscus, jasmine); bougainvillea hedges line the approach
    const bedSpots = []; tries = 0;
    const krishnaBias = () => (Math.random() < 0.45 ? [18 + Math.random() * 26, (Math.random() * 2 - 1) * 30] : [(Math.random() * 2 - 1) * 44, -44 + Math.random() * 82]);
    while (bedSpots.length < (this.quality.level === 'low' ? 26 : 46) && tries++ < 6000) { const [x, z] = krishnaBias(); if (keepClear(x, z, 1.3) && bedSpots.every(s => Math.hypot(s[0] - x, s[1] - z) > 3.2) && spots.every(s => Math.hypot(s[0] - x, s[1] - z) > 2.8)) bedSpots.push([x, z]); }
    const palettes = [['marigold'], ['marigold', 'marigold', 'hibiscus'], ['hibiscus', 'jasmine'], ['jasmine', 'marigold'], ['marigold', 'jasmine', 'hibiscus']];
    for (const [x, z] of bedSpots) { const r = 1.0 + Math.random() * 0.45; this.flora.addBed(x, z, r, palettes[Math.floor(Math.random() * palettes.length)]); this.colliders.circles.push({ x, z, r: r + 0.1 }); }
    for (let z = 14; z < 37; z += 2.4) for (const sx of [-1, 1]) if (z < 18.2 || z > 31.8) { this.flora.addHedge(sx * 4.6, z, 0.85, true); bedSpots.push([sx * 4.6, z, 'hedge']); }
    for (const T of Object.values(TEMPLES)) for (const s of [-1, 1]) { const side = new THREE.Vector3(s * 4.4, 0, 11.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), T.rot).add(T.pos); this.flora.addBed(side.x, side.z, 0.9, ['marigold', 'hibiscus']); this.colliders.circles.push({ x: side.x, z: side.z, r: 1.0 }); bedSpots.push([side.x, side.z, 'temple']); }
    this.bedSpots = bedSpots.filter(b => b[2] !== 'hedge');
  }

  _diyaGeo() { return this._dg || (this._dg = diyaGeometry()); }
  _diya(p, scale = 0.42) {
    if (!this._diyaList) { this._diyaList = []; }
    this._diyaList.push(p.clone());
    const i = this.flames.add(new THREE.Vector3(p.x, p.y + 0.09, p.z), scale); return i;
  }
  _diyaLocal(group, p, scale) { group.updateMatrixWorld(true); const w = p.clone().applyMatrix4(group.matrixWorld); return this._diya(w, scale); }
  _pathDiyas() {
    for (let z = 13; z < 38; z += 2.6) for (const sx of [-1, 1]) this._diya(new THREE.Vector3(sx * 2.7, 0.03, z));
    for (let x = 13; x < 22; x += 2.6) for (const s of [-1, 1]) { this._diya(new THREE.Vector3(x, 0.03, s * 2.7)); this._diya(new THREE.Vector3(-x, 0.03, s * 2.7)); }
    for (let z = -13; z > -22; z -= 2.6) for (const sx of [-1, 1]) this._diya(new THREE.Vector3(sx * 2.7, 0.03, z));
    // build clay lamp bodies for every flame registered so far
    const list = this._diyaList;
    const im = new THREE.InstancedMesh(this._diyaGeo(), clay, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach((p, i) => { m.compose(p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(1.4, 1.4, 1.4)); im.setMatrixAt(i, m); });
    this.scene.add(im);
    this.diyaPositions = list.map(p => p.clone().add(new THREE.Vector3(0, 0.15, 0)));
  }

  _bunting() {
    const cols = ['#e8731c', '#f2b631', '#b3242a', '#4f7a3a', '#ffffff'];
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.42, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2)); tri.computeVertexNormals();
    const mat = windify(new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), { amp: 0.12, freq: 3.0, axis: 'z', weightBy: 'uvy' }, this.windTime);
    const lines = [];
    for (const z of [16, 33]) lines.push([new THREE.Vector3(-4.3, 4.2, z), new THREE.Vector3(4.3, 4.2, z)]);
    for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) lines.push([new THREE.Vector3(Math.cos(a) * 11.8, 4.6, Math.sin(a) * 11.8), new THREE.Vector3(0, 5.4, 0)]);
    const poleM = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 });
    let total = 0; const per = 18; const im = new THREE.InstancedMesh(tri, mat, lines.length * per);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (const [a, b] of lines) {
      for (const p of [a]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, p.y, 6), poleM); pole.position.set(p.x, p.y / 2, p.z); pole.castShadow = true; this.scene.add(pole); this.colliders.circles.push({ x: p.x, z: p.z, r: 0.25 }); }
      if (Math.abs(b.x) > 1) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, b.y, 6), poleM); pole.position.set(b.x, b.y / 2, b.z); this.scene.add(pole); this.colliders.circles.push({ x: b.x, z: b.z, r: 0.25 }); }
      const ang = Math.atan2(b.z - a.z, b.x - a.x);
      for (let i = 0; i < per; i++) { const k = (i + 0.5) / per; const p = new THREE.Vector3().lerpVectors(a, b, k); p.y -= Math.sin(k * Math.PI) * 0.6;
        m.compose(p, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(total, m); im.setColorAt(total++, c.set(cols[i % cols.length])); }
    }
    // central mast for the courtyard strings, rising from the fountain finial
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), gold); mast.position.set(0, 3.7, 0); this.scene.add(mast);
    this.scene.add(im);
  }

  _npcs() {
    const n = this.quality.npcs;
    const ids = Object.keys(this.graph);
    for (let i = 0; i < n; i++) {
      const a = new Avatar(randomConfig(Math.random()), { simulated: true, shadows: this.quality.level !== 'low' });
      const start = this.graph[ids[Math.floor(Math.random() * ids.length)]];
      a.root.position.copy(start.p).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
      this.scene.add(a.root);
      this.npcs.push({ avatar: a, path: [], wait: Math.random() * 4, goal: null });
    }
  }

  _npcPlan(npc) {
    const dests = ['ganesha', 'shiva', 'krishna', 'pondW', 'pondE', 'gSW', 'gNE', 'gSE', 'gNW', 'cSE', 'cNW', 'gateIn'];
    const goal = dests[Math.floor(Math.random() * dests.length)];
    npc.goal = goal; npc.path = this.route(npc.avatar.root.position, goal).map(p => p.add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2)));
  }

  // Time of day: morning, afternoon, evening, night. Presets blend smoothly over a few seconds.
  setTimeOfDay(name, instant = false) {
    const P = TOD_PRESETS[name]; if (!P) return;
    this.todName = name;
    const el = THREE.MathUtils.degToRad(P.elev), az = THREE.MathUtils.degToRad(P.az);
    this.todTarget = { ...P, sky: new THREE.Color(P.sky), mid: new THREE.Color(P.mid), hor: new THREE.Color(P.hor), sun: new THREE.Color(P.sun), cloud: new THREE.Color(P.cloud), ground: new THREE.Color(P.ground),
      sunDir: new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize() };
    if (instant || !this.tod) { this.tod = { ...this.todTarget, sky: this.todTarget.sky.clone(), mid: this.todTarget.mid.clone(), hor: this.todTarget.hor.clone(), sun: this.todTarget.sun.clone(), cloud: this.todTarget.cloud.clone(), ground: this.todTarget.ground.clone(), sunDir: this.todTarget.sunDir.clone() }; this._applyTOD(); }
  }
  _blendTOD(k) {
    const a = this.tod, b = this.todTarget;
    for (const key of ['sky', 'mid', 'hor', 'sun', 'cloud', 'ground']) a[key].lerp(b[key], k);
    for (const key of ['sunI', 'hemi', 'fogNear', 'fogFar', 'lamps', 'stars', 'mist', 'warm', 'night', 'exposure']) a[key] += (b[key] - a[key]) * k;
    a.sunDir.lerp(b.sunDir, k).normalize();
    this._applyTOD();
  }
  _applyTOD() {
    const s = this.tod;
    this.skyU.top.value.copy(s.sky); this.skyU.mid.value.copy(s.mid); this.skyU.bottom.value.copy(s.hor); this.skyU.sunCol.value.copy(s.sun).multiplyScalar(1 - s.night * 0.6);
    this.sunDir = s.sunDir; this.skyU.sunDir.value.copy(s.sunDir);
    this.sun.color.copy(s.sun); this.sun.intensity = s.sunI;
    this.hemi.intensity = s.hemi; this.hemi.color.copy(s.hor).lerp(new THREE.Color('#ffffff'), 0.4 * (1 - s.night)); this.hemi.groundColor.copy(s.ground);
    this.scene.fog.color.copy(s.hor).lerp(s.mid, 0.45); this.scene.fog.near = s.fogNear; this.scene.fog.far = s.fogFar;
    this.flames.uniforms.uBoost.value = 0.8 + Math.min(0.7, s.lamps * 0.1);
    this.lampIntensity = s.lamps;
    s.moonDir = s.sunDir;
    this.evening = s.warm;
  }

  update(dt, t, focus, ctx) {
    if (this.todTarget && this.tod) this._blendTOD(ctx.reducedMotion ? 1 : 1 - Math.exp(-dt * 0.9));
    this.scenery.update(dt, t, focus, this.tod, ctx.reducedMotion ? 0.35 : 1);
    this.windTime.value = t * (ctx.reducedMotion ? 0.3 : 1);
    this.flames.update(t);
        if (this.water.normalMap) { this.water.normalMap.offset.x = t * 0.012; this.water.normalMap.offset.y = t * 0.008; }
    // sun follows the focus so the shadow map stays crisp near the player
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 70); this.sun.target.position.copy(focus);
    this.sky.position.copy(focus).setY(0);
    // nearest diyas get the real point lights
    if (this.diyaPositions) {
      const near = this.diyaPositions.map((p, i) => [p.distanceToSquared(focus), i]).sort((a, b) => a[0] - b[0]).slice(0, this.pointPool.length);
      near.forEach(([d, i], k) => { const L = this.pointPool[k]; L.position.copy(this.diyaPositions[i]); L.intensity = this.lampIntensity * (0.85 + Math.sin(t * 9 + i) * 0.08 + Math.sin(t * 15.7 + i * 2) * 0.05); });
    }
    for (const b of this.bells) b.update(dt, t);
    for (const u of this.updaters) u(dt, t);
    // NPC devotees
    for (const npc of this.npcs) {
      const av = npc.avatar, p = av.root.position;
      if (npc.wait > 0) { npc.wait -= dt; av.speed = 0; if (npc.wait <= 0) { av.setState('idle'); this._npcPlan(npc); } }
      else if (npc.path.length) {
        const tgt = npc.path[0]; const d = new THREE.Vector3(tgt.x - p.x, 0, tgt.z - p.z); const dist = d.length();
        if (dist < 0.4) { npc.path.shift(); if (!npc.path.length) { const atShrine = TEMPLES[npc.goal]; npc.wait = atShrine ? 5 + Math.random() * 6 : 2 + Math.random() * 6; av.setState(atShrine ? 'namaste' : 'idle'); if (atShrine) { const dir = atShrine.pos.clone().sub(p); av.root.rotation.y = Math.atan2(dir.x, dir.z); } } }
        else {
          // yield to the player when close in front
          const sp = 1.25;
          d.normalize(); const step = d.multiplyScalar(sp * dt); const np = p.clone().add(step); this.resolve(np, 0.3); p.copy(np);
          av.speed = sp; av.setState('walk'); const ang = Math.atan2(step.x, step.z); av.root.rotation.y = lerpAngle(av.root.rotation.y, ang, 1 - Math.exp(-dt * 8));
        }
      } else this._npcPlan(npc);
      av.update(dt, t);
    }
  }

  resolve(p, r) {
    for (const c of this.colliders.circles) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    for (const b of this.colliders.boxes) {
      if (p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r) {
        const l = p.x - (b.minX - r), rr = (b.maxX + r) - p.x, t = p.z - (b.minZ - r), bb = (b.maxZ + r) - p.z, m = Math.min(l, rr, t, bb);
        if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
      }
    }
    return p;
  }
}

export function lerpAngle(a, b, t) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), pz - (az + t * dz)); }
