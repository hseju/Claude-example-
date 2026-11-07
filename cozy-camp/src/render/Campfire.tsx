import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Rng, clamp, lerp, noise2 } from '../sim/math';
import type { WorldObject } from '../sim/types';
import { world } from '../state/store';
import { glow, glowTexture, mat, uniqueMat } from './materials';
import { Ball, Box, Cap, Cyl, Merged } from './parts';
import { quality } from './shared';

const FLAME_PROFILE = [
  [0, 0],
  [0.55, 0.06],
  [0.82, 0.22],
  [0.8, 0.42],
  [0.6, 0.64],
  [0.32, 0.84],
  [0, 1],
].map(([x, y]) => new THREE.Vector2(x, y));

const flameGeo = new THREE.LatheGeometry(FLAME_PROFILE, 12);

const RAW: Record<string, THREE.Color> = {
  stew: new THREE.Color('#e08a4a'),
  sausages: new THREE.Color('#e6a3a0'),
  fish: new THREE.Color('#b9c3c9'),
};
const COOKED: Record<string, THREE.Color> = {
  stew: new THREE.Color('#8a4b22'),
  sausages: new THREE.Color('#8f4a28'),
  fish: new THREE.Color('#c7843c'),
};

/** Fire pit with fuel-driven flames, light, sparks, smoke, grill, pan and kettle. */
export function Campfire({ o }: { o: WorldObject }) {
  const fire = o.fire!;
  const stones = useMemo(() => {
    const rng = new Rng(3);
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + rng.range(-0.1, 0.1);
      return { x: Math.cos(a) * 0.62, z: Math.sin(a) * 0.62, s: rng.range(0.13, 0.19), r: rng.range(0, 6) };
    });
  }, []);
  const logs = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return { a, tilt: 0.9 + (i % 2) * 0.1 };
      }),
    [],
  );

  const tongues = useMemo(() => {
    const rng = new Rng(8);
    return Array.from({ length: 6 }, (_, i) => ({
      x: i === 0 ? 0 : Math.cos(i * 1.3) * rng.range(0.08, 0.18),
      z: i === 0 ? 0 : Math.sin(i * 1.3) * rng.range(0.08, 0.18),
      h: i === 0 ? 0.85 : rng.range(0.4, 0.65),
      phase: rng.range(0, 10),
    }));
  }, []);

  const logRefs = useRef<(THREE.Group | null)[]>([]);
  const flameRefs = useRef<(THREE.Group | null)[]>([]);
  const flames = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const ashMat = useMemo(() => uniqueMat('#2b2420', { emissive: '#ff4a10', emissiveIntensity: 0 }), []);
  const foodMat = useMemo(() => uniqueMat('#e08a4a', { roughness: 0.6, snow: false }), []);
  const pan = useRef<THREE.Group>(null);
  const foodRefs = useRef<Record<string, THREE.Object3D | null>>({});
  const kettleSteam = useRef<THREE.Group>(null);
  const panSteam = useRef<THREE.Group>(null);

  const frame = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = fire.intensity;
    // Fire shadows refresh every other frame: the light is fixed and campers move slowly.
    const l = light.current;
    if (l?.castShadow) {
      l.shadow.autoUpdate = false;
      if (frame.current++ % 2 === 0) l.shadow.needsUpdate = true;
    }
    const env = world.env;
    // Logs visible by fuel.
    logRefs.current.forEach((g, i) => g && (g.visible = i < fire.logs));
    // Flames.
    const f = flames.current;
    if (f) {
      f.visible = k > 0.02;
      const lean = env.windStrength * 0.35;
      f.rotation.set(Math.sin(env.windDir) * lean, 0, -Math.cos(env.windDir) * lean);
      flameRefs.current.forEach((g, i) => {
        if (!g) return;
        const tg = tongues[i];
        const n = noise2(t * 3 + tg.phase, tg.phase) * 0.35 + Math.sin(t * 11 + tg.phase) * 0.12;
        const s = (0.3 + 0.75 * k) * (1 + n);
        g.scale.set(s * 0.32, tg.h * s * (1 + 0.15 * Math.sin(t * 7 + tg.phase)), s * 0.32);
        g.rotation.y = t * 0.6 + tg.phase;
      });
    }
    const flicker = 0.85 + noise2(t * 6, 1.7) * 0.18 + Math.sin(t * 17) * 0.04;
    if (light.current) {
      light.current.intensity = k * 14 * flicker + fire.ember * 1.2;
      light.current.color.setRGB(1, 0.55 + k * 0.12 - (1 - k) * 0.2, 0.28 - (1 - k) * 0.12);
      light.current.distance = 9 + k * 9;
    }
    if (halo.current) halo.current.opacity = clamp(k * 0.55 * flicker + fire.ember * 0.2);
    ashMat.emissiveIntensity = k * 0.9 + fire.ember * 0.8 + 0.05 * Math.sin(t * 2);

    // Pan and food.
    const p = fire.pan;
    if (pan.current) pan.current.visible = Boolean(p);
    if (p) {
      for (const [kind, ref] of Object.entries(foodRefs.current)) if (ref) ref.visible = kind === p.food;
      foodMat.color.copy(RAW[p.food]).lerp(COOKED[p.food], clamp(p.doneness));
      const stew = foodRefs.current.stew;
      if (stew) stew.position.y = 0.035 + Math.sin(t * 6) * 0.004 * k;
    }
    if (panSteam.current) {
      panSteam.current.visible = Boolean(p && p.doneness > 0.2 && k > 0.1);
      panSteam.current.children.forEach((c, i) => {
        const ph = (t * 0.6 + i / 3) % 1;
        c.position.set(Math.sin(i * 2 + t) * 0.05, 0.08 + ph * 0.5, Math.cos(i * 2 + t) * 0.05);
        c.scale.setScalar(0.08 + ph * 0.2);
        ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (1 - ph) * 0.35;
      });
    }
    if (kettleSteam.current) {
      kettleSteam.current.visible = fire.kettleHeat > 0.5;
      kettleSteam.current.children.forEach((c, i) => {
        const ph = (t * 0.5 + i / 3) % 1;
        c.position.set(0.12 + ph * 0.12, 0.18 + ph * 0.35, 0);
        c.scale.setScalar(0.06 + ph * 0.16);
        ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (1 - ph) * 0.3 * fire.kettleHeat;
      });
    }
  });

  const steamMats = useMemo(
    () =>
      Array.from(
        { length: 6 },
        () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#e8eef5', transparent: true, depthWrite: false, opacity: 0.3 }),
      ),
    [],
  );

  return (
    <group>
      {/* Stone ring and ash bed */}
      <Merged>
        {stones.map((s, i) => (
          <mesh
            key={i}
            position={[s.x, s.s * 0.5, s.z]}
            rotation={[s.r, s.r * 2, 0]}
            scale={[s.s, s.s * 0.75, s.s]}
            castShadow
            receiveShadow
            material={mat('#8a8680', { flatShading: true })}
          >
            <dodecahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </Merged>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={ashMat} receiveShadow>
        <circleGeometry args={[0.52, 20]} />
      </mesh>

      {/* Logs in a teepee */}
      {logs.map((l, i) => (
        <group key={i} ref={(g) => (logRefs.current[i] = g)} rotation={[0, l.a, 0]}>
          <group position={[0.2, 0.12, 0]} rotation={[0, 0, l.tilt]}>
            <Cyl rt={0.055} rb={0.065} h={0.62} c="#5e4030" />
            <Cyl rt={0.056} h={0.02} p={[0, 0.31, 0]} c="#2b201b" />
          </group>
        </group>
      ))}

      {/* Flames */}
      <group ref={flames} position={[0, 0.06, 0]}>
        {tongues.map((tg, i) => (
          <group key={i} ref={(g) => (flameRefs.current[i] = g)} position={[tg.x, 0, tg.z]}>
            <mesh geometry={flameGeo} material={glow('#ff6a1f', 0.85, true)} />
            <mesh geometry={flameGeo} material={glow('#ffd46a', 0.9, true)} scale={[0.55, 0.7, 0.55]} />
          </group>
        ))}
        <sprite position={[0, 0.35, 0]} scale={[2.6, 2.6, 1]}>
          <spriteMaterial
            ref={halo}
            map={glowTexture()}
            color="#ff8a3d"
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>
      <pointLight
        ref={light}
        position={[0, 0.7, 0]}
        decay={1.6}
        castShadow={quality.high}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.002}
        shadow-normalBias={0.08}
        shadow-radius={4}
        shadow-camera-near={0.3}
        shadow-camera-far={9}
      />
      <Sparks fire={o} />
      <Smoke fire={o} />

      {/* Grill grate on two side stones */}
      <Merged>
        <group position={[0, 0.44, 0]}>
          {[-0.24, -0.12, 0, 0.12, 0.24].map((z) => (
            <Cyl
              key={z}
              rt={0.008}
              h={0.86}
              r={[0, 0, Math.PI / 2]}
              p={[0, 0, z]}
              c="#3a3a3e"
              o={{ metalness: 0.7, roughness: 0.4 }}
              shadow={false}
            />
          ))}
          <Cyl
            rt={0.012}
            h={0.56}
            p={[-0.43, 0, 0]}
            r={[Math.PI / 2, 0, 0]}
            c="#3a3a3e"
            o={{ metalness: 0.7, roughness: 0.4 }}
            shadow={false}
          />
          <Cyl
            rt={0.012}
            h={0.56}
            p={[0.43, 0, 0]}
            r={[Math.PI / 2, 0, 0]}
            c="#3a3a3e"
            o={{ metalness: 0.7, roughness: 0.4 }}
            shadow={false}
          />
        </group>
        <Cyl rt={0.02} h={0.44} p={[-0.43, 0.22, 0.22]} c="#3a3a3e" shadow={false} />
        <Cyl rt={0.02} h={0.44} p={[0.43, 0.22, 0.22]} c="#3a3a3e" shadow={false} />
        <Cyl rt={0.02} h={0.44} p={[-0.43, 0.22, -0.22]} c="#3a3a3e" shadow={false} />
        <Cyl rt={0.02} h={0.44} p={[0.43, 0.22, -0.22]} c="#3a3a3e" shadow={false} />
      </Merged>

      {/* Pan with food */}
      <group ref={pan} position={[0.16, 0.47, 0.02]} visible={false}>
        <Cyl rt={0.19} rb={0.16} h={0.06} p={[0, 0.03, 0]} c="#2e2e33" o={{ metalness: 0.6, roughness: 0.45 }} seg={20} />
        <Box s={[0.28, 0.02, 0.04]} p={[0.32, 0.05, 0]} c="#2e2e33" />
        <group ref={(g) => (foodRefs.current.stew = g)} position={[0, 0.035, 0]}>
          <Cyl rt={0.16} h={0.03} seg={18} material={foodMat} shadow={false} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              s={[0.04, 0.03, 0.04]}
              p={[Math.cos(i * 1.4) * 0.08, 0.02, Math.sin(i * 1.4) * 0.08]}
              c={i % 2 ? '#f0a040' : '#f4e6c0'}
              shadow={false}
            />
          ))}
        </group>
        <group ref={(g) => (foodRefs.current.sausages = g)} position={[0, 0.08, 0]}>
          {[-0.07, 0, 0.07].map((z) => (
            <Cap key={z} rad={0.028} len={0.16} r={[0, 0, Math.PI / 2]} p={[0, 0, z]} material={foodMat} shadow={false} c="" />
          ))}
        </group>
        <group ref={(g) => (foodRefs.current.fish = g)} position={[0, 0.08, 0]}>
          <Ball rad={0.1} scale={[1.4, 0.4, 0.55]} material={foodMat} shadow={false} c="" />
          <mesh position={[-0.17, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={foodMat}>
            <coneGeometry args={[0.06, 0.08, 3]} />
          </mesh>
        </group>
        <group ref={panSteam}>
          {[0, 1, 2].map((i) => (
            <sprite key={i} material={steamMats[i]} />
          ))}
        </group>
      </group>

      {/* Kettle */}
      <group position={[-0.24, 0.45, -0.04]}>
        <Ball rad={0.11} scale={[1, 0.85, 1]} p={[0, 0.09, 0]} c="#3f6e7f" o={{ roughness: 0.35, metalness: 0.2 }} />
        <Cyl rt={0.05} rb={0.07} h={0.04} p={[0, 0.18, 0]} c="#3f6e7f" />
        <Ball rad={0.022} p={[0, 0.21, 0]} c="#2b2b2b" />
        <Cyl rt={0.018} rb={0.026} h={0.14} p={[0.12, 0.13, 0]} r={[0, 0, -0.9]} c="#3f6e7f" />
        <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 2, 0]} material={mat('#2b2b2b')}>
          <torusGeometry args={[0.08, 0.008, 6, 16, Math.PI]} />
        </mesh>
        <group ref={kettleSteam}>
          {[0, 1, 2].map((i) => (
            <sprite key={i} material={steamMats[i + 3]} />
          ))}
        </group>
      </group>
    </group>
  );
}

/** Rising embers: a steady trickle scaled by intensity, bursts when a log lands. */
function Sparks({ fire }: { fire: WorldObject }) {
  const N = 48;
  const { geometry, state } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    const state = Array.from({ length: N }, () => ({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
    return { geometry: g, state };
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: glowTexture() } },
        vertexShader: /* glsl */ `
          attribute float alpha; varying float vA;
          void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 70.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; varying float vA;
          void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.62, 0.25) * 1.6, t.a * vA); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const lastBurst = useRef(world.fireSparks);
  const rng = useMemo(() => new Rng(12), []);
  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.05) * (world.paused ? 0 : 1);
    const f = fire.fire!;
    let spawn = rng.chance(dt * 10 * f.intensity) ? 1 : 0;
    if (world.fireSparks !== lastBurst.current) {
      spawn += 14;
      lastBurst.current = world.fireSparks;
    }
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const alpha = geometry.attributes.alpha as THREE.BufferAttribute;
    const wx = Math.cos(world.env.windDir) * world.env.windStrength;
    const wz = Math.sin(world.env.windDir) * world.env.windStrength;
    for (let i = 0; i < N; i++) {
      const s = state[i];
      if (s.life <= 0 && spawn > 0) {
        spawn--;
        s.x = rng.range(-0.15, 0.15);
        s.y = 0.3;
        s.z = rng.range(-0.15, 0.15);
        s.vx = rng.range(-0.25, 0.25);
        s.vz = rng.range(-0.25, 0.25);
        s.vy = rng.range(0.8, 1.8);
        s.life = rng.range(0.8, 1.8);
      }
      if (s.life > 0) {
        s.life -= dt;
        s.x += (s.vx + wx * 0.8 + Math.sin(s.y * 6) * 0.2) * dt;
        s.z += (s.vz + wz * 0.8) * dt;
        s.y += s.vy * dt;
        s.vy *= 1 - dt * 0.6;
      }
      pos.setXYZ(i, s.x, s.life > 0 ? s.y : -10, s.z);
      alpha.setX(i, clamp(s.life) * 0.9);
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** Soft smoke puffs; thicker when the fire is weak, smouldering or rained on. */
function Smoke({ fire }: { fire: WorldObject }) {
  const N = 7;
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const mats = useMemo(
    () =>
      Array.from(
        { length: N },
        () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#b8b4ae', transparent: true, depthWrite: false, opacity: 0 }),
      ),
    [],
  );
  useFrame(({ clock }) => {
    const f = fire.fire!;
    const t = clock.elapsedTime;
    const amount = clamp(f.intensity * 0.35 + f.ember * 0.6 + world.rain() * 0.4 * (f.intensity + f.ember));
    const wx = Math.cos(world.env.windDir) * (0.3 + world.env.windStrength * 2);
    const wz = Math.sin(world.env.windDir) * (0.3 + world.env.windStrength * 2);
    refs.current.forEach((s, i) => {
      if (!s) return;
      const ph = (t * 0.12 + i / N) % 1;
      s.position.set(wx * ph * 1.5 + Math.sin(t * 0.7 + i) * 0.15, 0.8 + ph * 3.2, wz * ph * 1.5 + Math.cos(t * 0.5 + i) * 0.15);
      s.scale.setScalar(lerp(0.5, 2.2, ph));
      mats[i].opacity = amount * 0.22 * Math.sin(ph * Math.PI);
    });
  });
  return (
    <>
      {mats.map((m, i) => (
        <sprite key={i} ref={(s) => (refs.current[i] = s)} material={m} />
      ))}
    </>
  );
}
