import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { brass, gold, lampPostGeometry } from './architecture.js';
import { triplanar } from './pbr.js';
import { mergeGeos } from './ornament.js';

// Set dressing: the small things that make the grounds feel lived in and rich, all instanced so phones stay smooth.
//   floor:    carved curbs along every path, fallen petals over the paving, glowing golden lotus inlays
//   lanterns: brass lattice lanterns on turned posts at the path mouths and along the side paths, each with a pool of light
//   planting: flowering bougainvillea bushes along the paths, and brass urns of leafy palms at the temple steps
// Call before flora.build() so the bushes join the flora's instanced shrubs.

// the paths, as [centre x, centre z, width, depth]; the plaza is a circle of radius 12.6
const STRIPS = [[0, 31, 5, 38], [-17.5, 0, 12, 5], [17.5, 0, 12, 5], [0, -17.5, 5, 12]];
const KUNDS = [[-8.5, 25, 7.2, 12.2], [8.5, 25, 7.2, 12.2]];
const GATE_Z = 40;
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const inRect = (x, z, [cx, cz, w, d], pad = 0) => Math.abs(x - cx) < w / 2 + pad && Math.abs(z - cz) < d / 2 + pad;

export function dressWorld(world, temples) {
  const S = world.scene, r = rnd(4242), Q = world.quality, low = Q.level === 'low';
  const hits = (x, z, rad) => {
    for (const b of world.colliders.boxes) if (x > b.minX - rad && x < b.maxX + rad && z > b.minZ - rad && z < b.maxZ + rad) return true;
    for (const c of world.colliders.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return true;
    return false;
  };
  const blocked = (x, z, rad) => Math.abs(x) > 43 - rad || z < -43 + rad || z > 38 - rad || hits(x, z, rad);
  const onPath = (x, z, pad) => STRIPS.some((s) => inRect(x, z, s, pad)) || Math.hypot(x, z) < 12.6 + pad;

  // ---------------------------------------------------------------- the floor
  // carved stone curbs along both long edges of every path (broken where the gateway stands)
  const curbMat = triplanar('sandstone', { tint: '#c4a47c', tile: 1.2, roughness: 0.9 }), curbs = [];
  for (const [cx, cz, w, d] of STRIPS) {
    const alongZ = d > w, len = alongZ ? d : w, half = (alongZ ? w : d) / 2 + 0.12;
    for (const s of [-1, 1]) {
      const pieces = alongZ && cz > 20 ? [[cz - d / 2, GATE_Z - 1.4], [GATE_Z + 1.4, cz + d / 2]] : [[(alongZ ? cz : cx) - len / 2, (alongZ ? cz : cx) + len / 2]];
      for (const [a, b] of pieces) {
        const L = b - a, g = new THREE.BoxGeometry(alongZ ? 0.24 : L, 0.08, alongZ ? L : 0.24);
        g.translate(alongZ ? cx + s * half : (a + b) / 2, 0.04, alongZ ? (a + b) / 2 : cz + s * half); curbs.push(g);
      }
    }
  }
  const curb = new THREE.Mesh(mergeGeos(curbs), curbMat); curb.receiveShadow = true; S.add(curb);

  // fallen petals over the paving, thicker toward the edges where they drift
  const petalGeo = new THREE.CircleGeometry(0.045, 6); petalGeo.scale(1, 0.6, 1); petalGeo.rotateX(-Math.PI / 2);
  const spots = [];
  for (const [cx, cz, w, d] of STRIPS) {
    const n = Math.round(w * d * (low ? 0.8 : 1.7));
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, v = r() - 0.5, edge = Math.sign(u) * Math.pow(Math.abs(u), 0.5) * 0.5;
      const [x, z] = d > w ? [cx + edge * w, cz + v * d] : [cx + v * w, cz + edge * d];
      if (Math.abs(z - GATE_Z) < 1.5 && Math.abs(x) > 2.2) continue; spots.push([x, 0.028, z]); }
  }
  for (let i = 0; i < (low ? 160 : 360); i++) { const a = r() * Math.PI * 2, rr = 4.8 + Math.sqrt(r()) * 7.6; spots.push([Math.cos(a) * rr, 0.038, Math.sin(a) * rr]); }
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ roughness: 0.65, side: THREE.DoubleSide }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const petalCols = ['#e0438f', '#d21f7a', '#f06aa8', '#f29a17', '#ffd23f', '#ffffff', '#e8452c'];
  spots.forEach(([x, y, z], i) => { const sc = 0.7 + r() * 0.9; m.compose(new THREE.Vector3(x, y + r() * 0.004, z), q.setFromAxisAngle(up, r() * 6.3), new THREE.Vector3(sc, 1, sc)); petals.setMatrixAt(i, m); petals.setColorAt(i, c.set(petalCols[Math.floor(r() * petalCols.length)])); });
  petals.receiveShadow = true; S.add(petals);

  // golden lotus inlays: line-drawn lotus mandalas set into the paving, glowing softly and breathing
  const inlayTex = (() => {
    const N = 512, cvs = document.createElement('canvas'); cvs.width = cvs.height = N; const x = cvs.getContext('2d'); x.translate(N / 2, N / 2);
    x.strokeStyle = 'rgba(255,214,140,1)'; x.lineCap = 'round';
    const ring = (rr, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.stroke(); };
    ring(240, 5); ring(226, 2.5); ring(70, 4); ring(52, 2);
    for (const [n, r0, len, wid, w, off] of [[8, 70, 150, 0.36, 5, 0], [8, 64, 112, 0.3, 3, Math.PI / 8], [16, 160, 64, 0.16, 3, 0]]) for (let i = 0; i < n; i++) {
      x.save(); x.rotate(i / n * Math.PI * 2 + off); x.lineWidth = w;
      x.beginPath(); x.moveTo(-len * wid * 0.5, -r0); x.bezierCurveTo(-len * wid, -r0 - len * 0.55, -len * wid * 0.2, -r0 - len * 0.9, 0, -r0 - len); x.bezierCurveTo(len * wid * 0.2, -r0 - len * 0.9, len * wid, -r0 - len * 0.55, len * wid * 0.5, -r0); x.stroke();
      x.beginPath(); x.moveTo(0, -r0 - 6); x.lineTo(0, -r0 - len * 0.8); x.lineWidth = w * 0.5; x.stroke(); x.restore();
    }
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.fillStyle = 'rgba(255,224,160,1)'; x.beginPath(); x.arc(Math.cos(a) * 233, Math.sin(a) * 233, 4, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const inlayMat = new THREE.MeshBasicMaterial({ map: inlayTex, color: new THREE.Color(1.3, 0.95, 0.55), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
  const inlays = [[0, 22.5, 2.6], [0, 28.5, 2.6], [-14.5, 0, 2.4], [14.5, 0, 2.4], [0, -14.8, 2.4]];
  for (const [x, z, s] of inlays) { const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2), inlayMat); p.position.set(x, 0.045, z); S.add(p); }

  // ---------------------------------------------------------------- lanterns
  // a brass lantern with glowing lattice panels, a domed cap and a finial, on a turned stone post
  const lanternSpots = [];
  for (const [x, z] of [[2.95, 13.6], [-2.95, 13.6], [13.6, 2.95], [13.6, -2.95], [-13.6, 2.95], [-13.6, -2.95], [2.95, -13.6], [-2.95, -13.6]]) lanternSpots.push([x, z]);
  for (let t = 17.6; t < 23; t += 4.4) for (const s of [-1, 1]) { lanternSpots.push([t, s * 2.95]); lanternSpots.push([-t, s * 2.95]); }
  lanternSpots.push([0 + 3.0, -19.5], [-3.0, -19.5]);
  for (const s of [-1, 1]) lanternSpots.push([s * 2.95, 44.5], [s * 2.95, 48.5]);
  const ok = lanternSpots.filter(([x, z]) => !hits(x, z, 0.2));
  const H = 1.05, postGeo = lampPostGeometry(H).scale(0.7, 1, 0.7);
  const body = new THREE.CylinderGeometry(0.15, 0.15, 0.32, 6, 1, true); body.translate(0, H + 0.22, 0);
  const frameParts = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, bar = new THREE.BoxGeometry(0.025, 0.36, 0.025); bar.translate(Math.cos(a) * 0.155, H + 0.22, Math.sin(a) * 0.155); frameParts.push(bar); }
  for (const y of [H + 0.04, H + 0.4]) { const rim = new THREE.CylinderGeometry(0.19, 0.19, 0.04, 6); rim.translate(0, y, 0); frameParts.push(rim); }
  const cap = new THREE.ConeGeometry(0.2, 0.2, 6); cap.translate(0, H + 0.52, 0); frameParts.push(cap);
  const fin = new THREE.SphereGeometry(0.035, 8, 6); fin.translate(0, H + 0.65, 0); frameParts.push(fin);
  const ring = new THREE.TorusGeometry(0.04, 0.012, 6, 12); ring.translate(0, H + 0.7, 0); frameParts.push(ring);
  const frameGeo = mergeGeos(frameParts);
  const latticeTex = (() => { const N = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = N; const x = cvs.getContext('2d');
    x.fillStyle = '#ffd08a'; x.fillRect(0, 0, N, N); x.strokeStyle = '#4a2a10'; x.lineWidth = 6;
    for (let i = -N; i < N * 2; i += 26) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + N, N); x.stroke(); x.beginPath(); x.moveTo(i, N); x.lineTo(i + N, 0); x.stroke(); }
    const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd69a', map: latticeTex, emissive: '#ffae4a', emissiveMap: latticeTex, emissiveIntensity: 2.2, roughness: 0.6, side: THREE.DoubleSide });
  const stone = triplanar('sandstone', { tint: '#e7d3b3', tile: 1.2, roughness: 0.9 });
  const posts = new THREE.InstancedMesh(postGeo, stone, ok.length), bodies = new THREE.InstancedMesh(body, glass, ok.length), frames = new THREE.InstancedMesh(frameGeo, brass, ok.length);
  const poolTex = (() => { const N = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = N; const x = cvs.getContext('2d'); const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,190,110,0.85)'); g.addColorStop(0.3, 'rgba(255,160,80,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), poolMat, ok.length);
  const haloMat = new THREE.SpriteMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
  ok.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, r() * 6.3), new THREE.Vector3(1, 1, 1)); posts.setMatrixAt(i, m); bodies.setMatrixAt(i, m); frames.setMatrixAt(i, m);
    m.makeTranslation(x, 0.05, z); pools.setMatrixAt(i, m);
    const sp = new THREE.Sprite(haloMat); sp.scale.set(0.95, 0.95, 1); sp.position.set(x, H + 0.22, z); S.add(sp);   // a soft glow that always faces you
    world.colliders.circles.push({ x, z, r: 0.28 });
  });
  posts.castShadow = frames.castShadow = true; S.add(posts, bodies, frames, pools);
  world.updaters.push((dt, t) => {
    const lamps = world.lampIntensity ?? 1;
    glass.emissiveIntensity = 1.4 + lamps * 0.35 + Math.sin(t * 7.3) * 0.04;
    poolMat.opacity = 0.25 + Math.min(0.6, lamps * 0.1);
    haloMat.opacity = 0.2 + Math.min(0.55, lamps * 0.09);
    inlayMat.opacity = (0.45 + Math.min(0.35, lamps * 0.06)) * (0.85 + 0.15 * Math.sin(t * 0.9));
  });

  // ---------------------------------------------------------------- planting
  // flowering bushes along the paths: try spots a little way off each path edge, keep the walkway and everything else clear
  const bushes = [];
  const tryBush = (x, z, rad) => {
    if (onPath(x, z, 0.5 + rad) || KUNDS.some((k) => inRect(x, z, k, rad)) || blocked(x, z, rad + 0.15)) return;
    if (bushes.some(([bx, bz, br]) => Math.hypot(bx - x, bz - z) < br + rad + 0.2)) return;
    bushes.push([x, z, rad]);
  };
  for (const [cx, cz, w, d] of STRIPS) {
    const alongZ = d > w, len = alongZ ? d : w;
    for (let k = 0; k < len * (low ? 0.5 : 1.0); k++) for (const s of [-1, 1]) {
      const along = (alongZ ? cz : cx) + (r() - 0.5) * len, off = (alongZ ? w : d) / 2 + 1.0 + r() * 2.4, rad = 0.55 + r() * 0.45;
      tryBush(alongZ ? cx + s * off : along, alongZ ? along : cz + s * off, rad);
    }
  }
  for (let k = 0; k < (low ? 30 : 70); k++) { const a = r() * Math.PI * 2, rr = 14 + r() * 3.5; tryBush(Math.cos(a) * rr, Math.sin(a) * rr, 0.55 + r() * 0.4); }
  for (const [x, z, rad] of bushes) { world.flora.addHedge(x, z, rad, true); world.colliders.circles.push({ x, z, r: rad * 0.8 }); }

  // brass urns of leafy palms at the foot of each temple's steps
  const urnGeo = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.18, 0.04], [0.14, 0.08], [0.2, 0.16], [0.3, 0.32], [0.3, 0.44], [0.24, 0.54], [0.26, 0.58], [0.3, 0.6], [0.28, 0.62], [0, 0.6]].map(([a, b]) => new THREE.Vector2(a, b)), 22);
  const leaf = new THREE.PlaneGeometry(0.16, 0.9, 1, 6); leaf.translate(0, 0.45, 0);
  { const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / 0.9; p.setX(i, p.getX(i) * Math.sin(Math.min(1, t * 1.2 + 0.1) * Math.PI)); p.setZ(i, t * t * 0.35); } leaf.computeVertexNormals(); }
  const urnSpots = [];
  for (const T of Object.values(temples)) {
    for (const s of [-1, 1]) { const p = new THREE.Vector3(s * 2.95, 0, 11.7).applyAxisAngle(up, T.rot).add(T.pos); if (!world.colliders.circles.some((cc) => Math.hypot(p.x - cc.x, p.z - cc.z) < cc.r + 0.3)) urnSpots.push([p.x, p.z]); }
  }
  const urns = new THREE.InstancedMesh(urnGeo, brass, urnSpots.length), LEAVES = 14;
  const leaves = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({ color: '#4c8a34', roughness: 0.65, side: THREE.DoubleSide }), urnSpots.length * LEAVES);
  let li = 0;
  urnSpots.forEach(([x, z], i) => {
    m.makeTranslation(x, 0, z); urns.setMatrixAt(i, m); world.colliders.circles.push({ x, z, r: 0.35 });
    for (let k = 0; k < LEAVES; k++) { const e = new THREE.Euler(0.25 + r() * 0.7, k / LEAVES * Math.PI * 2 + r() * 0.3, 0, 'YXZ'), sc = 0.8 + r() * 0.5;
      m.compose(new THREE.Vector3(x, 0.56, z), q.setFromEuler(e), new THREE.Vector3(sc, sc, sc)); leaves.setMatrixAt(li, m); leaves.setColorAt(li++, c.setHSL(0.28 + r() * 0.04, 0.5, 0.28 + r() * 0.1)); }
  });
  urns.castShadow = leaves.castShadow = true; S.add(urns, leaves);
  void gold;
}
