import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { beam as beamTexture } from './textures.js';
import { dustMotes } from './fx.js';

// Shafts of sunlight slanting through the garden canopies and into the temples' pillared halls, with motes of dust drifting
// in them. Each shaft is a pair of crossed glowing cards laid along the sun's direction, so it follows the time of day: long
// and golden when the sun is low, short and faint at noon, gone at night.

const PATHS = [[0, 31, 5, 38], [-17.5, 0, 12, 5], [17.5, 0, 12, 5], [0, -17.5, 5, 12]];
const distToPaths = (x, z) => Math.min(...PATHS.map(([cx, cz, w, d]) => Math.hypot(Math.max(0, Math.abs(x - cx) - w / 2), Math.max(0, Math.abs(z - cz) - d / 2))), Math.max(0, Math.hypot(x, z) - 12.6));

export function sunShafts(world, temples) {
  const S = world.scene, low = world.quality.level === 'low', up = new THREE.Vector3(0, 1, 0);
  // where light falls: under the garden trees nearest the paths, and into each temple's mandapa
  const spots = [];
  const trees = [];
  for (const k of ['neem', 'gulmohar', 'bougainvillea', 'jacaranda']) for (const t of world.flora.trees[k] || []) if (Math.abs(t.x) < 42 && t.z > -42 && t.z < 37) trees.push(t);
  trees.map((t) => [distToPaths(t.x, t.z), t]).filter(([d]) => d > 1.5 && d < 9).sort((a, b) => a[0] - b[0]).slice(0, low ? 4 : 10)
    .forEach(([, t]) => spots.push({ x: t.x + 0.6, z: t.z + 0.4, top: 4.6 * t.s, w: 1.3 + Math.random() * 0.8 }));
  for (const T of Object.values(temples)) for (const lx of [-3.0, 0.2, 3.0]) {
    const p = new THREE.Vector3(lx, 0, 4.3).applyAxisAngle(up, T.rot).add(T.pos);
    spots.push({ x: p.x, z: p.z, top: 5.2, w: 0.9, base: 1.2 });
  }
  const mat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: new THREE.Color(1.0, 0.86, 0.6), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const card = new THREE.PlaneGeometry(1, 1); card.translate(0, -0.5, 0);   // hangs down from its top edge
  const shafts = spots.map((sp) => {
    const g = new THREE.Group(), a = new THREE.Mesh(card, mat), b = new THREE.Mesh(card, mat); b.rotation.y = Math.PI / 2;
    g.add(a, b); g.renderOrder = 3; S.add(g); return { g, ...sp };
  });
  // dust drifting in the light
  const perShaft = low ? 16 : 34, dust = dustMotes(perShaft * shafts.length, new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)), '#ffe2a8');
  S.add(dust); const du = dust.material.uniforms; du.uPx.value = Math.min(3, world.renderer.getPixelRatio()) * 1.6;

  const last = new THREE.Vector3(), lightDir = new THREE.Vector3(), q = new THREE.Quaternion();
  const place = () => {
    const sd = world.sunDir; if (!sd) return;
    lightDir.copy(sd).multiplyScalar(-1);
    q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lightDir);
    const pos = dust.geometry.attributes.position;
    shafts.forEach((s, i) => {
      const base = s.base || 0, L = Math.min(13, (s.top - base) / Math.max(0.12, sd.y)) + 1.2;   // a little past the floor so it meets it softly
      const top = new THREE.Vector3(s.x, base, s.z).addScaledVector(sd, L - 1.2);
      s.g.position.copy(top); s.g.quaternion.copy(q); s.g.scale.set(s.w, L, s.w);
      for (let k = 0; k < perShaft; k++) { const t = Math.random() * (L - 1.2), j = i * perShaft + k;
        const p = top.clone().addScaledVector(lightDir, t).add(new THREE.Vector3((Math.random() - 0.5) * s.w * 0.7, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * s.w * 0.7));
        pos.setXYZ(j, p.x, p.y, p.z); }
    });
    pos.needsUpdate = true; dust.geometry.computeBoundingSphere();
  };
  world.updaters.push((dt, t) => {
    const sd = world.sunDir; if (!sd) return;
    if (last.distanceToSquared(sd) > 1e-6) { last.copy(sd); place(); }
    const night = world.tod ? world.tod.night : 0, lowSun = 0.45 + 0.55 * (1 - Math.min(1, Math.max(0, (sd.y - 0.15) / 0.7)));
    const k = Math.max(0, 1 - night * 1.6) * lowSun;
    mat.opacity = 0.2 * k; du.uOpacity.value = 0.9 * k; du.uTime.value = t;
    for (const s of shafts) s.g.visible = k > 0.02;
    dust.visible = k > 0.02;
  });
}
