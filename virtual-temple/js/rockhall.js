import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { triplanar } from './pbr.js';
import { relief, mergeGeos, beadRing, petalRing } from './ornament.js';
import { brass, clay, diyaGeometry } from './architecture.js';

// An ancient rock-cut shrine for the prayer halls, in the manner of the cave temples: dark granite walls of great cut
// blocks, massive square pillars carved with chaitya arches and lotus bands under cushion capitals, a ceiling that steps
// up in carved corbels to a flat slab, and an opening in the rock through which a shaft of daylight falls on the sanctum.
// It is lit by oil lamps: rows of diyas on the ledges, in the wall niches, at the pillar feet and on the sanctum steps,
// two tall brass lamp towers, warm halos on the stone and long reflections in the wet floor.

export const HALL = { X: 11, BACK: -6.8, FRONT: 10.9, CEIL: 8.4, AISLE: 5.6, PIL_X: 7.0, PIL_Z: [-4.6, -0.4, 3.8, 8.0], DOOR_W: 1.85, DOOR_TOP: 4.6, OCULUS: new THREE.Vector3(0, 8.4, -3.4) };
export const ROCK = '#5a4c41', CARVE = '#6d5c4c', DEEP = '#3a3029';

export const granite = (tint = ROCK, tile = 2.4) => triplanar('ashlar', { tint, tile, roughness: 0.9, normal: 1.2, cacheKey: 'rockhall' });
export const carvedStone = (tint = CARVE) => triplanar('sandstone', { tint, tile: 1.3, roughness: 0.85, normal: 1.3, cacheKey: 'rockhall' });
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const carving = new Map();
// a carved band material whose motif repeats every `unit` metres along a band `len` long
export function carved(kind, len, unit = 1.8, vertical = false) { const m = relief(kind, CARVE, { repeat: [Math.max(1, Math.round(len / unit)), 1], strength: 6, roughness: 0.86, vertical }); return m; }
void carving;

// ---------------------------------------------------------------- the rock-cut pillar
// plinth, a block carved with a chaitya arch on each face, an octagonal shaft, a lotus-band block, a fluted neck,
// a cushion capital and a cross bracket under the beam (about 5 m to the beam)
export function pillarParts() {
  const plain = [];
  const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y + h / 2, 0); return g; };
  plain.push(box(1.3, 0.26, 1.3, 0));
  const oct = new THREE.CylinderGeometry(0.44, 0.44, 1.2, 8); oct.rotateY(Math.PI / 8); oct.translate(0, 1.4 + 0.6, 0); plain.push(oct);
  plain.push(beadRing(0.42, 22, 0.05, 2.62), beadRing(0.42, 22, 0.05, 1.42));
  const neck = new THREE.CylinderGeometry(0.37, 0.4, 0.75, 16); { const p = neck.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.06 * (0.5 + 0.5 * Math.cos(a * 16)); p.setXYZ(i, x * k, p.getY(i), z * k); } } neck.translate(0, 3.45 + 0.375, 0); plain.push(neck);
  const cush = new THREE.SphereGeometry(0.66, 24, 10); { const p = cush.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.05 * Math.cos(a * 24); p.setXYZ(i, x * k, p.getY(i) * 0.42, z * k); } } cush.translate(0, 4.42, 0); plain.push(cush);
  plain.push(box(1.35, 0.22, 1.35, 4.62));
  for (const rot of [0, Math.PI / 2]) { const arm = box(2.3, 0.3, 0.62, 4.82); arm.rotateY(rot); plain.push(arm); const roll = new THREE.CylinderGeometry(0.17, 0.17, 0.62, 12); roll.rotateX(Math.PI / 2); roll.translate(1.08, 4.88, 0); roll.rotateY(rot); plain.push(roll); const roll2 = roll.clone(); roll2.rotateY(Math.PI); plain.push(roll2); }
  const ped = new THREE.BoxGeometry(1.05, 1.15, 1.05); ped.translate(0, 0.26 + 0.575, 0);   // carved with a chaitya arch on each face
  const mid = new THREE.BoxGeometry(0.92, 0.8, 0.92); mid.translate(0, 2.65 + 0.4, 0);     // carved with a lotus band
  return { plain: mergeGeos(plain), ped, mid, top: 5.12 };
}

// ---------------------------------------------------------------- a deepastambha: a tall brass lamp tower ringed with tiers of little lamps
export function lampTower(h = 3.3) {
  const parts = [lathe([[0, 0], [0.5, 0], [0.5, 0.1], [0.42, 0.16], [0.36, 0.3], [0.2, 0.42], [0.13, 0.5], [0.13, 0.56], [0.1, 0.6]], 24)];
  parts.push(lathe([[0.1, 0.58], [0.09, h * 0.5], [0.075, h * 0.92], [0, h * 0.94]], 12));
  const wicks = []; const tiers = [[0.5, 14], [0.43, 12], [0.36, 10], [0.29, 8], [0.22, 6], [0.15, 4]];
  tiers.forEach(([r, n], i) => {
    const y = 0.85 + i * 0.4;
    parts.push(lathe([[0.08, y - 0.06], [r * 0.6, y - 0.03], [r, y], [r + 0.03, y + 0.03], [r - 0.02, y + 0.035], [0.08, y + 0.01]], 28));
    for (let k = 0; k < n; k++) { const a = (k + (i % 2) * 0.5) / n * Math.PI * 2, x = Math.cos(a) * (r - 0.03), z = Math.sin(a) * (r - 0.03);
      const cup = new THREE.SphereGeometry(0.035, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); cup.translate(x, y + 0.06, z); parts.push(cup);
      wicks.push(new THREE.Vector3(x, y + 0.11, z)); }
  });
  parts.push(beadRing(0.5, 30, 0.03, 0.12));
  const top = lathe([[0, 0], [0.09, 0], [0.12, 0.08], [0.09, 0.16], [0.04, 0.2], [0.05, 0.26], [0, 0.34]], 14); top.translate(0, h * 0.93, 0); parts.push(top);
  const m = new THREE.Mesh(mergeGeos(parts), brass); m.castShadow = true;
  return { mesh: m, wicks };
}

// ---------------------------------------------------------------- textures
function fernTexture() {
  const W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.strokeStyle = '#3c5a26'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 0); x.quadraticCurveTo(W / 2 + 6, H * 0.5, W / 2 - 4, H); x.stroke();
  for (let i = 0; i < 26; i++) { const t = i / 26, y = 6 + t * (H - 20), len = (W * 0.46) * (1 - t * 0.6), cx = W / 2 + Math.sin(t * 3) * 4;
    for (const s of [-1, 1]) { x.fillStyle = ['#4f7a30', '#5f8a38', '#456e2a'][i % 3]; x.beginPath(); x.ellipse(cx + s * len * 0.5, y + 4, len * 0.5, 3.2, s * 0.35, 0, Math.PI * 2); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,200,120,1)'); g.addColorStop(0.2, 'rgba(255,160,70,0.55)'); g.addColorStop(0.55, 'rgba(255,120,40,0.16)'); g.addColorStop(1, 'rgba(255,100,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- the lamp light: halos, pools and wet reflections (all instanced, all additive)
// spots: [{ p: Vector3 (where the diya sits), wall: Vector3 normal into the room or null, pool: radius, refl: length or 0 }]
export function lampGlow(spots, { reflections = true } = {}) {
  const grp = new THREE.Group(), gt = glowTexture(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const add = (geo, mat, list, place) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((s, i) => { place(s, m4); im.setMatrixAt(i, m4); }); im.renderOrder = 4; im.frustumCulled = false; grp.add(im); return im; };
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pm = new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4 });
  const pools = add(flat, pm, spots.filter((s) => s.pool), (s, m) => { const n = s.wall || new THREE.Vector3(); m.compose(new THREE.Vector3(s.p.x + n.x * s.pool * 0.35, (s.floorY ?? s.p.y) + 0.008, s.p.z + n.z * s.pool * 0.35), q.identity(), new THREE.Vector3(s.pool * 2, 1, s.pool * 2)); });
  const wm = new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5, side: THREE.DoubleSide });
  const halos = add(new THREE.PlaneGeometry(1, 1), wm, spots.filter((s) => s.wall), (s, m) => { q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.wall); m.compose(s.p.clone().addScaledVector(s.wall, -(s.inset ?? 0.24)).add(new THREE.Vector3(0, 0.55, 0)), q, new THREE.Vector3(1.5, 2.0, 1)); });
  let streaks = null;
  if (reflections) {
    const sm = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(1.0, 0.62, 0.26) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; varying float vSeed;
        void main(){ vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float L = length(instanceMatrix[0].xyz);
          vec2 d = cameraPosition.xz - c.xz; float dl = length(d); d = dl > 0.001 ? d / dl : vec2(0.0, 1.0); vec2 pp = vec2(-d.y, d.x);
          vec2 off = pp * position.x * L * 0.16 + d * (position.y + 0.5) * L;
          vUv = uv; vSeed = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
          gl_Position = projectionMatrix * viewMatrix * vec4(c.x + off.x, c.y, c.z + off.y, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv; varying float vSeed;
        void main(){ float along = vUv.y, across = (vUv.x - 0.5) * 2.0;
          float a = exp(-across * across * 4.0) * (1.0 - smoothstep(0.0, 1.0, along)) * smoothstep(0.0, 0.08, along);
          a *= 0.7 + 0.3 * sin(along * 46.0 - uTime * 1.6 + vSeed * 6.0);
          a *= 0.88 + 0.12 * sin(uTime * 9.0 + vSeed * 17.0);
          gl_FragColor = vec4(uColor * a * uOpacity, 1.0); }`,
    });
    streaks = add(new THREE.PlaneGeometry(1, 1), sm, spots.filter((s) => s.refl), (s, m) => { const n = s.wall || new THREE.Vector3(); m.compose(new THREE.Vector3(s.p.x + n.x * 0.32, 0.014, s.p.z + n.z * 0.32), q.identity(), new THREE.Vector3(s.refl, 1, 1)); });
  }
  void up;
  return { group: grp, pools, halos, streaks, poolMat: pm, haloMat: wm, streakMat: streaks && streaks.material };
}

// ---------------------------------------------------------------- the shell
export function buildRockHall(S, quality) {
  const H = HALL, rock = granite(), deep = granite(DEEP, 2.4), stone = carvedStone();
  const g = new THREE.Group(); S.add(g);
  const box = (w, h, d, mat, x, y, z, { cast = false } = {}) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.receiveShadow = true; o.castShadow = cast; g.add(o); return o; };
  const T = 0.8, top = H.CEIL + 1.2, X = H.X;
  // walls: the back wall with the sanctum doorway cut in it, the entrance wall with its doorway, and the two sides
  box(X - H.DOOR_W, top, T, rock, -(X + H.DOOR_W) / 2, top / 2, H.BACK - T / 2, { cast: true }); box(X - H.DOOR_W, top, T, rock, (X + H.DOOR_W) / 2, top / 2, H.BACK - T / 2, { cast: true });
  box(H.DOOR_W * 2, top - H.DOOR_TOP, T, rock, 0, H.DOOR_TOP + (top - H.DOOR_TOP) / 2, H.BACK - T / 2, { cast: true });
  const DW = 1.2; box(X - DW, top, T, rock, -(X + DW) / 2, top / 2, H.FRONT + T / 2); box(X - DW, top, T, rock, (X + DW) / 2, top / 2, H.FRONT + T / 2); box(DW * 2, top - 3.6, T, rock, 0, 3.6 + (top - 3.6) / 2, H.FRONT + T / 2);
  for (const s of [-1, 1]) box(T, top, H.FRONT - H.BACK + T * 2, rock, s * (X + T / 2), top / 2, (H.FRONT + H.BACK) / 2);
  // the sanctum cell behind the doorway: dark rock on three sides and a low roof
  for (const s of [-1, 1]) box(0.5, 5.2, 4.2, deep, s * 2.35, 2.6, -8.7);
  box(5.2, 5.2, 0.5, deep, 0, 2.6, -10.75); box(5.2, 0.5, 4.4, deep, 0, 5.2, -8.7);
  // the floor: dark flagstones, wet and glossy
  // (built by the hall itself so it can keep its own material)
  // a plinth moulding round the walls, its top a ledge for lamps, and a carved frieze under the ceiling
  const LEN = H.FRONT - H.BACK, ledge = 0.55;
  for (const s of [-1, 1]) {
    box(0.26, ledge, LEN, carved('lotus', LEN, 2.2), s * (X - 0.13), ledge / 2, (H.FRONT + H.BACK) / 2);
    box(0.2, 0.55, LEN, carved('vine', LEN, 2.2), s * (X - 0.1), H.AISLE - 0.85, (H.FRONT + H.BACK) / 2);
    box(X - 2.9, ledge, 0.26, carved('lotus', X - 2.9, 2.2), s * (X + 2.9) / 2, ledge / 2, H.BACK + 0.13);
    box(X - 1.2, 0.5, 0.2, carved('beads', X - 1.2, 1.6), s * (X + 1.2) / 2, H.AISLE - 0.85, H.FRONT - 0.1);
  }
  // the pillars, in two rows, and the beams they carry
  const P = pillarParts(), n = H.PIL_Z.length * 2;
  const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = im.receiveShadow = true; g.add(im); return im; };
  const pPlain = mk(P.plain, stone), pPed = mk(P.ped, carved('gavaksha', 1, 1)), pMid = mk(P.mid, carved('lotus', 1, 1)), m4 = new THREE.Matrix4();
  let i = 0; const pillars = [];
  for (const s of [-1, 1]) for (const z of H.PIL_Z) { m4.makeTranslation(s * H.PIL_X, 0, z); pPlain.setMatrixAt(i, m4); pPed.setMatrixAt(i, m4); pMid.setMatrixAt(i, m4); pillars.push(new THREE.Vector3(s * H.PIL_X, 0, z)); i++; }
  for (const s of [-1, 1]) {
    box(0.9, H.AISLE - P.top, LEN, carved('diamond', LEN, 2.4), s * H.PIL_X, (P.top + H.AISLE) / 2, (H.FRONT + H.BACK) / 2, { cast: true });   // the long beam over each row
    for (const z of H.PIL_Z) box(X - H.PIL_X, 0.42, 0.7, stone, s * (X + H.PIL_X) / 2, H.AISLE - 0.21, z);   // cross beams over the aisles
  }
  // the ceiling: flat over the aisles, then stepping up in four carved corbel courses to a slab with an opening in the rock
  const kinds = ['beads', 'lotus', 'vine', 'diamond'], step = (H.CEIL - H.AISLE) / 4;
  for (let k = 0; k < 4; k++) {
    const inner = H.PIL_X - 0.45 - 0.62 * (k + 1), y0 = H.AISLE + step * k;
    for (const s of [-1, 1]) {
      box(X - inner + 0.4, step, LEN + T, rock, s * (X + inner + 0.4) / 2, y0 + step / 2, (H.FRONT + H.BACK) / 2, { cast: true });
      const band = new THREE.Mesh(new THREE.PlaneGeometry(LEN, step * 0.86), carved(kinds[k], LEN, 1.4 + k * 0.2)); band.position.set(s * (inner - 0.005), y0 + step / 2, (H.FRONT + H.BACK) / 2); band.rotation.y = -s * Math.PI / 2; g.add(band);
    }
  }
  const inner = H.PIL_X - 0.45 - 0.62 * 4 + 0.2;
  const sh = new THREE.Shape(); sh.moveTo(-inner, -H.FRONT - T); sh.lineTo(inner, -H.FRONT - T); sh.lineTo(inner, -H.BACK + T); sh.lineTo(-inner, -H.BACK + T); sh.closePath();
  const hole = new THREE.Path(); hole.absarc(H.OCULUS.x, -H.OCULUS.z, 0.9, 0, Math.PI * 2, true); sh.holes.push(hole);
  const slab = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 28 }); slab.rotateX(-Math.PI / 2); slab.translate(0, H.CEIL, 0);
  const slabM = new THREE.Mesh(slab, rock); slabM.castShadow = slabM.receiveShadow = true; g.add(slabM);
  // a carved lotus on the ceiling slab over the hall
  const lotusC = new THREE.Mesh(mergeGeos([petalRing(0.55, 12, 0.5, { down: true, lean: 0.9, rows: 2 }), new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)]), stone);
  lotusC.position.set(0, H.CEIL - 0.02, 3.2); g.add(lotusC);
  // the opening: a rough throat through the rock, sky beyond, and ferns hanging over its lip
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 1.6, 22, 3, true), deep); throat.material = deep; throat.position.set(H.OCULUS.x, H.CEIL + 0.5 + 0.8, H.OCULUS.z);
  { const p = throat.geometry.attributes.position; for (let j = 0; j < p.count; j++) { const x = p.getX(j), z = p.getZ(j), a = Math.atan2(z, x), k = 1 + 0.08 * Math.sin(a * 5 + p.getY(j) * 3) + 0.05 * Math.sin(a * 11); p.setXYZ(j, x * k, p.getY(j), z * k); } throat.geometry.computeVertexNormals(); }
  throat.material = deep.clone(); throat.material.side = THREE.BackSide; g.add(throat);
  const skyM = new THREE.MeshBasicMaterial({ color: '#fff1d6', fog: false }), sky = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), skyM); sky.rotation.x = Math.PI / 2; sky.position.set(H.OCULUS.x, H.CEIL + 2.2, H.OCULUS.z); g.add(sky);
  const fern = new THREE.MeshStandardMaterial({ map: fernTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2 + 0.3, f = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.9 + (j % 3) * 0.25), fern);
    f.geometry.translate(0, -0.45 - (j % 3) * 0.12, 0); f.position.set(H.OCULUS.x + Math.cos(a) * 0.92, H.CEIL + 0.02, H.OCULUS.z + Math.sin(a) * 0.92); f.rotation.set(0, -a + Math.PI / 2, 0); f.rotateX(0.35 + (j % 2) * 0.2); g.add(f); }
  // carved wall niches between the pillars, each holding a lamp, and two larger ones flanking the sanctum
  const niches = [];
  const niche = (x, z, ry, w = 1.1, hgt = 1.7, sill = 1.25) => {
    const ng = new THREE.Group(); ng.position.set(x, 0, z); ng.rotation.y = ry; g.add(ng);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), deep); back.position.set(0, sill + hgt / 2, 0.012); ng.add(back);
    const add = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = false; o.receiveShadow = true; ng.add(o); return o; };
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, hgt + 0.1, 0.2), carved('diamond', hgt, 0.6, true), s * (w / 2 + 0.1), sill + hgt / 2, 0.1);
    add(new THREE.BoxGeometry(w + 0.6, 0.14, 0.34), stone, 0, sill - 0.07, 0.17);
    add(new THREE.BoxGeometry(w + 0.7, 0.6, 0.26), carved('gavaksha', w + 0.7, 1.4), 0, sill + hgt + 0.33, 0.13);
    add(new THREE.BoxGeometry(w + 0.9, 0.12, 0.34), stone, 0, sill + hgt + 0.69, 0.17);
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)); niches.push({ p: new THREE.Vector3(x, sill, z).addScaledVector(n, 0.14), n });
  };
  for (const s of [-1, 1]) for (const z of [-2.5, 1.7, 5.9]) niche(s * (X - 0.001), z, -s * Math.PI / 2);
  for (const s of [-1, 1]) niche(s * 8.7, H.BACK + 0.001, 0, 1.3, 2.1, 1.1);
  // the sanctum doorway: receding carved jambs, a lintel of chaitya arches, a cornice and two pilasters
  const D = H.DOOR_W, F = H.BACK;
  for (const s of [-1, 1]) {
    box(0.36, H.DOOR_TOP - 0.6, 0.2, carved('vine', H.DOOR_TOP, 1.0, true), s * (D + 0.18), 0.6 + (H.DOOR_TOP - 0.6) / 2, F + 0.1);
    box(0.3, H.DOOR_TOP - 0.6, 0.14, carved('beads', H.DOOR_TOP, 0.8, true), s * (D + 0.51), 0.6 + (H.DOOR_TOP - 0.6) / 2, F + 0.07);
    box(0.62, 4.2, 0.36, stone, s * 3.2, 0.6 + 2.1, F + 0.18, { cast: true }); box(0.8, 0.3, 0.46, stone, s * 3.2, 4.95, F + 0.23); box(0.78, 0.36, 0.44, carved('lotus', 0.8, 0.8), s * 3.2, 0.78, F + 0.22);
  }
  box(2 * D + 1.4, 0.55, 0.26, carved('gavaksha', 2 * D + 1.4, 1.3), 0, H.DOOR_TOP + 0.275, F + 0.13);
  box(7.4, 0.24, 0.4, carved('beads', 7.4, 1.4), 0, 6.0, F + 0.2);
  return { group: g, pillars, niches, sky: skyM, rock, stone, deep, ledgeY: ledge };
}

// ---------------------------------------------------------------- diyas on every ledge
export function diyaField(spots) {
  const im = new THREE.InstancedMesh(diyaGeometry(), clay, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => { m4.compose(s.p, q.setFromAxisAngle(up, Math.random() * 6.28), new THREE.Vector3(1, 1, 1).multiplyScalar(s.size || 1.4)); im.setMatrixAt(i, m4); });
  im.castShadow = false; return im;
}
