import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Rng } from '../sim/math';
import { world } from '../state/store';
import { glowTexture, mat } from './materials';
import { focusPoint } from './shared';

const AREA = 34;
const HEIGHT = 18;

/** Rain streaks falling around the camera focus, slanted by the wind. */
function Rain() {
  const N = 2200;
  const { geometry, drops } = useMemo(() => {
    const rng = new Rng(2);
    const drops = Array.from({ length: N }, () => ({ x: rng.range(-AREA / 2, AREA / 2), y: rng.range(0, HEIGHT), z: rng.range(-AREA / 2, AREA / 2), v: rng.range(13, 18) }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    return { geometry: g, drops };
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#b9c9dd', transparent: true, opacity: 0.4, depthWrite: false }), []);
  const lines = useRef<THREE.LineSegments>(null);
  useFrame((_, rdt) => {
    const amount = world.env.mix.rain;
    const l = lines.current;
    if (!l) return;
    l.visible = amount > 0.03;
    if (!l.visible) return;
    const dt = Math.min(rdt, 0.05) * (world.paused ? 0 : 1);
    const active = Math.floor(N * Math.min(1, amount * 1.1));
    const wx = Math.cos(world.env.windDir) * world.env.windStrength * 6;
    const wz = Math.sin(world.env.windDir) * world.env.windStrength * 6;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const fx = focusPoint.x;
    const fz = focusPoint.z;
    for (let i = 0; i < N; i++) {
      const d = drops[i];
      d.y -= d.v * dt;
      d.x += wx * dt;
      d.z += wz * dt;
      if (d.y < 0) {
        d.y += HEIGHT;
        d.x = ((d.x + AREA / 2) % AREA + AREA) % AREA - AREA / 2;
        d.z = ((d.z + AREA / 2) % AREA + AREA) % AREA - AREA / 2;
      }
      const x = fx + d.x;
      const z = fz + d.z;
      const y = i < active ? d.y : -50;
      const len = 0.35;
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x - (wx / d.v) * len, y + len, z - (wz / d.v) * len);
    }
    pos.needsUpdate = true;
    material.opacity = 0.25 + amount * 0.25;
  });
  return <lineSegments ref={lines} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Snowflakes drifting down and swirling in the wind. */
function Snow() {
  const N = 1800;
  const { geometry, flakes } = useMemo(() => {
    const rng = new Rng(3);
    const flakes = Array.from({ length: N }, () => ({ x: rng.range(-AREA / 2, AREA / 2), y: rng.range(0, HEIGHT), z: rng.range(-AREA / 2, AREA / 2), v: rng.range(0.6, 1.4), p: rng.range(0, 10) }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return { geometry: g, flakes };
  }, []);
  const material = useMemo(
    () => new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.9 }),
    [],
  );
  const pts = useRef<THREE.Points>(null);
  useFrame(({ clock }, rdt) => {
    const amount = world.env.mix.snow;
    const p = pts.current;
    if (!p) return;
    p.visible = amount > 0.03;
    if (!p.visible) return;
    const dt = Math.min(rdt, 0.05) * (world.paused ? 0 : 1);
    const t = clock.elapsedTime;
    const active = Math.floor(N * Math.min(1, amount * 1.2));
    const wx = Math.cos(world.env.windDir) * world.env.windStrength * 2.5;
    const wz = Math.sin(world.env.windDir) * world.env.windStrength * 2.5;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const f = flakes[i];
      f.y -= f.v * dt;
      f.x += (wx + Math.sin(t + f.p) * 0.4) * dt;
      f.z += (wz + Math.cos(t * 0.8 + f.p) * 0.4) * dt;
      if (f.y < 0) {
        f.y += HEIGHT;
        f.x = ((f.x + AREA / 2) % AREA + AREA) % AREA - AREA / 2;
        f.z = ((f.z + AREA / 2) % AREA + AREA) % AREA - AREA / 2;
      }
      pos.setXYZ(i, focusPoint.x + f.x, i < active ? f.y : -50, focusPoint.z + f.z);
    }
    pos.needsUpdate = true;
  });
  return <points ref={pts} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Autumn leaves tumbling down from the deciduous trees. */
function FallingLeaves() {
  const N = 140;
  const refs = useRef<THREE.InstancedMesh>(null);
  const leaves = useMemo(() => {
    const rng = new Rng(4);
    const trees = world.terrain.trees.filter((t) => t.kind === 'round' || t.kind === 'birch');
    return Array.from({ length: N }, () => {
      const tr = rng.pick(trees);
      return { tree: tr, x: tr.x, y: rng.range(0, 3), z: tr.z, p: rng.range(0, 10), v: rng.range(0.4, 0.8), c: rng.pick(['#d9772e', '#e3a63a', '#b8462e', '#c98a2e']) };
    });
  }, []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.12, 0.08), []);
  const material = useMemo(() => mat('#ffffff', { side: THREE.DoubleSide, snow: false }), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const colorsSet = useRef(false);
  useFrame(({ clock }, rdt) => {
    const m = refs.current;
    if (!m) return;
    m.visible = world.env.season === 'autumn';
    if (!m.visible) return;
    if (!colorsSet.current) {
      leaves.forEach((l, i) => m.setColorAt(i, new THREE.Color(l.c)));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      colorsSet.current = true;
    }
    const dt = Math.min(rdt, 0.05) * (world.paused ? 0 : 1);
    const t = clock.elapsedTime;
    const w = world.env.windStrength;
    leaves.forEach((l, i) => {
      l.y -= l.v * dt;
      l.x += (Math.cos(world.env.windDir) * w * 1.5 + Math.sin(t * 1.3 + l.p) * 0.5) * dt;
      l.z += (Math.sin(world.env.windDir) * w * 1.5 + Math.cos(t + l.p) * 0.5) * dt;
      const ground = world.terrain.height(l.x, l.z);
      if (l.y < ground) {
        l.y = ground + 2 + l.tree.scale * 1.5;
        l.x = l.tree.x + Math.sin(l.p * 7) * 0.8;
        l.z = l.tree.z + Math.cos(l.p * 5) * 0.8;
      }
      o.position.set(l.x, l.y, l.z);
      o.rotation.set(t * 2 + l.p, t * 1.3 + l.p, Math.sin(t * 3 + l.p));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={refs} args={[geometry, material, N]} frustumCulled={false} />;
}

export function Weather() {
  return (
    <>
      <Rain />
      <Snow />
      <FallingLeaves />
    </>
  );
}
