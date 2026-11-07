import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Rng, clamp } from '../sim/math';
import type { Animal, Fish } from '../sim/types';
import { useUI, world } from '../state/store';
import { GLOBAL_UNIFORMS, glowTexture, mat, uniqueMat } from './materials';
import { Ball, Cap, Cyl } from './parts';
import { skyState } from './shared';

function FishView({ f }: { f: Fish }) {
  const g = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const m = useMemo(() => uniqueMat(f.color, { roughness: 0.35, metalness: 0.2, snow: false }), [f.color]);
  const jumpArc = useRef(0);
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    grp.visible = !f.hidden && f.state !== 'caught';
    const t = clock.elapsedTime;
    jumpArc.current = f.jump;
    const wl = world.def.waterLevel;
    const jy = f.jump > 0 ? Math.sin((1 - f.jump) * Math.PI) * 0.7 : 0;
    const y = f.state === 'hooked' ? wl - 0.05 + Math.sin(t * 20) * 0.04 : wl - f.depth * (f.state === 'nibble' ? 0.4 : 1) + jy;
    grp.position.set(f.x, y, f.z);
    grp.rotation.set(f.jump > 0 ? Math.cos((1 - f.jump) * Math.PI) * 0.8 : 0, f.heading, 0);
    if (tail.current) tail.current.rotation.y = Math.sin(t * (f.state === 'hooked' ? 25 : 8) + f.size) * 0.5;
  });
  const s = 0.4 + f.size / 45;
  return (
    <group ref={g} scale={s}>
      <mesh material={m} scale={[0.45, 0.55, 1.4]}>
        <sphereGeometry args={[0.12, 12, 8]} />
      </mesh>
      <mesh ref={tail} position={[0, 0, -0.17]} material={m}>
        <coneGeometry args={[0.08, 0.14, 3]} />
      </mesh>
      <mesh position={[0, 0.06, 0.02]} material={m} rotation={[0.3, 0, 0]} scale={[0.2, 1, 1]}>
        <coneGeometry args={[0.05, 0.08, 3]} />
      </mesh>
    </group>
  );
}

function Rabbit({ a }: { a: Animal }) {
  const g = useRef<THREE.Group>(null);
  const ears = useRef<THREE.Group>(null);
  const fur = a.id.endsWith('1') ? '#c9b8a4' : a.id.endsWith('2') ? '#8a7360' : '#e8e0d4';
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    const moving = a.state === 'move' || a.state === 'flee';
    const hop = moving ? Math.abs(Math.sin(a.hop)) * 0.18 : 0;
    grp.position.set(a.x, a.y + hop, a.z);
    grp.rotation.y = a.heading;
    if (ears.current) ears.current.rotation.x = moving ? -0.5 : Math.sin(clock.elapsedTime * 3 + a.x) * 0.1;
  });
  return (
    <group ref={g}>
      <Ball rad={0.13} p={[0, 0.12, 0]} scale={[0.9, 0.85, 1.15]} c={fur} />
      <Ball rad={0.09} p={[0, 0.22, 0.12]} c={fur} />
      <Ball rad={0.012} p={[0.04, 0.24, 0.2]} c="#1d1d1d" shadow={false} />
      <Ball rad={0.012} p={[-0.04, 0.24, 0.2]} c="#1d1d1d" shadow={false} />
      <Ball rad={0.014} p={[0, 0.21, 0.21]} c="#e8a0a0" shadow={false} />
      <group ref={ears} position={[0, 0.29, 0.1]}>
        <Cap rad={0.025} len={0.12} p={[0.035, 0.07, 0]} r={[0, 0, -0.15]} c={fur} />
        <Cap rad={0.025} len={0.12} p={[-0.035, 0.07, 0]} r={[0, 0, 0.15]} c={fur} />
      </group>
      <Ball rad={0.05} p={[0, 0.13, -0.15]} c="#f6f2ea" />
    </group>
  );
}

function Squirrel({ a }: { a: Animal }) {
  const g = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    const moving = a.state === 'move' || a.state === 'flee';
    grp.position.set(a.x, a.y + (moving ? Math.abs(Math.sin(a.hop)) * 0.1 : 0), a.z);
    grp.rotation.y = a.heading;
    if (tail.current) tail.current.rotation.x = -0.4 + Math.sin(clock.elapsedTime * 5) * 0.15;
  });
  return (
    <group ref={g} scale={0.8}>
      <Ball rad={0.08} p={[0, 0.1, 0]} scale={[0.8, 1, 1.2]} c="#b5652e" />
      <Ball rad={0.06} p={[0, 0.18, 0.08]} c="#b5652e" />
      <Ball rad={0.01} p={[0.03, 0.2, 0.13]} c="#1d1d1d" shadow={false} />
      <Ball rad={0.01} p={[-0.03, 0.2, 0.13]} c="#1d1d1d" shadow={false} />
      <group ref={tail} position={[0, 0.1, -0.08]}>
        <Ball rad={0.07} p={[0, 0.12, -0.04]} scale={[0.8, 1.6, 0.8]} c="#c9773a" />
      </group>
    </group>
  );
}

function Deer({ a }: { a: Animal }) {
  const g = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(a.x, a.y, a.z);
    grp.rotation.y = a.heading;
    const moving = a.state === 'move' || a.state === 'flee';
    const grazing = a.state === 'graze';
    if (neck.current)
      neck.current.rotation.x = THREE.MathUtils.lerp(
        neck.current.rotation.x,
        grazing ? 1.1 : -0.15 + Math.sin(clock.elapsedTime) * 0.05,
        0.05,
      );
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = moving ? Math.sin(a.hop * 2 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0;
    });
  });
  const fur = '#a8754a';
  return (
    <group ref={g}>
      <Ball rad={0.28} p={[0, 0.72, 0]} scale={[0.75, 0.75, 1.35]} c={fur} />
      {[
        [0.12, 0.25],
        [-0.12, 0.25],
        [0.12, -0.25],
        [-0.12, -0.25],
      ].map(([x, z], i) => (
        <group key={i} ref={(l) => (legs.current[i] = l)} position={[x, 0.6, z]}>
          <Cyl rt={0.035} rb={0.025} h={0.6} p={[0, -0.3, 0]} c="#8a5f3c" />
        </group>
      ))}
      <group ref={neck} position={[0, 0.85, 0.28]}>
        <Cyl rt={0.07} rb={0.09} h={0.4} p={[0, 0.17, 0.05]} r={[0.35, 0, 0]} c={fur} />
        <group position={[0, 0.38, 0.14]}>
          <Ball rad={0.11} scale={[0.8, 0.85, 1.3]} c={fur} />
          <Ball rad={0.04} p={[0, -0.02, 0.15]} c="#3a2a22" shadow={false} />
          <Ball rad={0.018} p={[0.06, 0.04, 0.08]} c="#1d1d1d" shadow={false} />
          <Ball rad={0.018} p={[-0.06, 0.04, 0.08]} c="#1d1d1d" shadow={false} />
          <Cap rad={0.03} len={0.07} p={[0.09, 0.09, -0.02]} r={[0, 0, -0.8]} c={fur} />
          <Cap rad={0.03} len={0.07} p={[-0.09, 0.09, -0.02]} r={[0, 0, 0.8]} c={fur} />
          <Cyl rt={0.012} h={0.18} p={[0.05, 0.18, -0.03]} r={[0, 0, -0.3]} c="#d8c8a8" />
          <Cyl rt={0.012} h={0.18} p={[-0.05, 0.18, -0.03]} r={[0, 0, 0.3]} c="#d8c8a8" />
        </group>
      </group>
      <Ball rad={0.06} p={[0, 0.8, -0.38]} c="#f2ece2" />
    </group>
  );
}

function Owl({ a }: { a: Animal }) {
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyeMat = useMemo(() => uniqueMat('#f6d46a', { emissive: '#f6c84a', emissiveIntensity: 0.3 }), []);
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(a.x, a.y, a.z);
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, a.heading - grp.rotation.y, 0.05);
      head.current.position.y = 0.2 + a.hop * Math.sin(clock.elapsedTime * 12) * 0.015;
    }
    eyeMat.emissiveIntensity = 0.1 + skyState.night * 0.9;
  });
  return (
    <group ref={g}>
      <Cyl rt={0.03} h={0.6} p={[0.25, -0.02, 0]} r={[0, 0, Math.PI / 2]} c="#5e4030" />
      <Ball rad={0.13} p={[0, 0.1, 0]} scale={[0.95, 1.1, 0.85]} c="#8a6a4a" />
      <Ball rad={0.09} p={[0, 0.08, 0.06]} scale={[0.9, 1.1, 0.6]} c="#d8c4a4" />
      <group ref={head} position={[0, 0.2, 0]}>
        <Ball rad={0.11} scale={[1.1, 0.9, 0.95]} c="#8a6a4a" />
        <mesh position={[0.045, 0.01, 0.085]} material={eyeMat}>
          <sphereGeometry args={[0.03, 10, 8]} />
        </mesh>
        <mesh position={[-0.045, 0.01, 0.085]} material={eyeMat}>
          <sphereGeometry args={[0.03, 10, 8]} />
        </mesh>
        <Ball rad={0.014} p={[0.045, 0.01, 0.11]} c="#111" shadow={false} />
        <Ball rad={0.014} p={[-0.045, 0.01, 0.11]} c="#111" shadow={false} />
        <mesh position={[0, -0.03, 0.1]} rotation={[Math.PI, 0, 0]} material={mat('#d9a441')}>
          <coneGeometry args={[0.015, 0.04, 4]} />
        </mesh>
        <mesh position={[0.07, 0.09, 0]} rotation={[0, 0, -0.4]} material={mat('#6a4f36')}>
          <coneGeometry args={[0.025, 0.07, 4]} />
        </mesh>
        <mesh position={[-0.07, 0.09, 0]} rotation={[0, 0, 0.4]} material={mat('#6a4f36')}>
          <coneGeometry args={[0.025, 0.07, 4]} />
        </mesh>
      </group>
    </group>
  );
}

export function Wildlife() {
  return (
    <group>
      <FishSchool />
      {world.animals.map((a) =>
        a.kind === 'rabbit' ? (
          <Rabbit key={a.id} a={a} />
        ) : a.kind === 'deer' ? (
          <Deer key={a.id} a={a} />
        ) : a.kind === 'owl' ? (
          <Owl key={a.id} a={a} />
        ) : (
          <Squirrel key={a.id} a={a} />
        ),
      )}
      <Fireflies />
      <Moths />
    </group>
  );
}

function FishSchool() {
  useUI((s) => s.tick);
  return (
    <>
      {world.fish.map((f) => (
        <FishView key={f.id} f={f} />
      ))}
    </>
  );
}

/** Fireflies drifting over the meadow and forest edges on warm nights. */
function Fireflies() {
  const N = 90;
  const { geometry, material } = useMemo(() => {
    const rng = new Rng(21);
    const centers = [
      { x: -6, z: 6, r: 5 },
      { x: -11, z: -6, r: 5 },
      { x: 3, z: 6, r: 4 },
      { x: 7, z: -6, r: 4 },
      { x: -12, z: 2, r: 4 },
    ];
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const c = centers[i % centers.length];
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * c.r;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      pos.set([x, world.terrain.height(x, z) + rng.range(0.3, 1.8), z], i * 3);
      seed[i] = rng.range(0, 100);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: GLOBAL_UNIFORMS.uTime, uVis: { value: 1 }, uMap: { value: glowTexture() }, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uPixel; varying float vBlink;
        void main() {
          vec3 p = position;
          float t = uTime * 0.35 + aSeed;
          p.x += sin(t * 1.3) * 0.9 + sin(t * 0.7 + aSeed) * 0.5;
          p.z += cos(t * 1.1) * 0.9 + cos(t * 0.5 + aSeed * 2.0) * 0.5;
          p.y += sin(t * 1.7) * 0.25;
          vBlink = smoothstep(0.2, 1.0, sin(uTime * (1.5 + fract(aSeed) * 1.5) + aSeed * 7.0) * 0.5 + 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(uPixel * 70.0 / -mv.z, 9.0 * uPixel);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uVis; varying float vBlink;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * 1.8, t.a * vBlink * uVis);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);
  useFrame(({ gl }) => {
    const env = world.env;
    const warm = env.season === 'summer' ? 1 : env.season === 'spring' ? 0.6 : env.season === 'autumn' ? 0.25 : 0;
    material.uniforms.uVis.value = skyState.night * warm * (1 - clamp(env.mix.rain * 2)) * (1 - env.mix.snow);
    material.uniforms.uPixel.value = gl.getPixelRatio();
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** A few moths fluttering around lit lanterns at night. */
function Moths() {
  const N = 9;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const lit = world.objects.filter((o) => o.kind === 'lantern' && o.on);
    const vis = skyState.night > 0.4 && world.rain() < 0.3;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const l = lit[i % Math.max(1, lit.length)];
      m.visible = Boolean(l) && vis;
      if (!l) return;
      const t = clock.elapsedTime * (2.2 + i * 0.2) + i * 2;
      const y = world.terrain.surfaceHeight(l.x, l.z) + 1.2;
      m.position.set(
        l.x + 0.26 * Math.cos(l.rot) + Math.sin(t) * 0.25,
        y + Math.sin(t * 1.7) * 0.15,
        l.z - 0.26 * Math.sin(l.rot) + Math.cos(t * 1.3) * 0.25,
      );
      m.rotation.y = t;
      m.scale.y = 0.4 + Math.abs(Math.sin(t * 12)) * 0.6;
    });
  });
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} material={mat('#e8dcc0', { snow: false })}>
          <planeGeometry args={[0.06, 0.04]} />
        </mesh>
      ))}
    </>
  );
}
