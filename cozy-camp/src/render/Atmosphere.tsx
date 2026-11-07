import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Rng } from '../sim/math';
import { world } from '../state/store';
import { GLOBAL_UNIFORMS, glowTexture } from './materials';
import { focusPoint, quality, skyState } from './shared';
import { computeSky } from './sky';

const SKY_RADIUS = 190;

/** Updates sky state, fog, exposure and shared shader uniforms every frame. */
export function EnvironmentDriver() {
  const { scene, gl } = useThree();
  const fog = useMemo(() => new THREE.FogExp2('#1c2236', 0.01), []);
  scene.fog = fog;
  useFrame((_, dt) => {
    const env = world.env;
    computeSky(env, skyState);
    fog.color.copy(skyState.fog);
    fog.density = skyState.fogDensity;
    gl.toneMappingExposure = skyState.exposure;
    GLOBAL_UNIFORMS.uTime.value += Math.min(dt, 0.1) * (world.paused ? 0.15 : 1);
    GLOBAL_UNIFORMS.uWindDir.value.set(Math.cos(env.windDir), Math.sin(env.windDir));
    GLOBAL_UNIFORMS.uWindStrength.value = 0.15 + env.windStrength * 1.4;
    GLOBAL_UNIFORMS.uSnow.value = env.snowCover;
    GLOBAL_UNIFORMS.uWet.value = env.wetness * (1 - env.snowCover);
  }, -2);
  return null;
}

/** Moon or sun light, hemisphere fill and a faint ambient. Shadows follow the camera focus. */
export function CelestialLights() {
  const dir = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const d = dir.current;
    const h = hemi.current;
    if (!d || !h) return;
    target.position.copy(focusPoint);
    target.updateMatrixWorld();
    d.position.copy(focusPoint).addScaledVector(skyState.lightDir, 40);
    d.color.copy(skyState.lightColor);
    d.intensity = skyState.lightIntensity;
    h.color.copy(skyState.hemiSky);
    h.groundColor.copy(skyState.hemiGround);
    h.intensity = skyState.hemiIntensity;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={dir}
        target={target}
        castShadow={quality.high}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={5}
        shadow-camera-far={90}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <hemisphereLight ref={hemi} />
    </>
  );
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uSunGlow;
  uniform float uMoonGlow;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    float t = pow(smoothstep(-0.05, 0.75, h), 0.65);
    vec3 col = mix(uHorizon, uTop, t);
    float sun = max(dot(d, normalize(uSunDir)), 0.0);
    col += vec3(1.0, 0.62, 0.35) * pow(sun, 8.0) * 0.55 * uSunGlow;
    col += vec3(1.0, 0.85, 0.6) * pow(sun, 200.0) * 2.0 * uSunGlow;
    float moon = max(dot(d, normalize(uMoonDir)), 0.0);
    col += vec3(0.55, 0.65, 1.0) * pow(moon, 30.0) * 0.25 * uMoonGlow;
    // Below the horizon fade toward the horizon colour so hills blend in.
    col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.2, d.y));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function SkyDome() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunGlow: { value: 0 },
      uMoonGlow: { value: 0 },
    }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    uniforms.uTop.value.copy(skyState.top);
    uniforms.uHorizon.value.copy(skyState.horizon);
    uniforms.uSunDir.value.copy(skyState.sunDir);
    uniforms.uMoonDir.value.copy(skyState.moonDir);
    uniforms.uSunGlow.value = skyState.sunGlow;
    uniforms.uMoonGlow.value = skyState.moonGlow;
    group.current?.position.set(camera.position.x, 0, camera.position.z);
  });
  return (
    <group ref={group}>
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <Stars />
      <Moon />
      <ShootingStars />
    </group>
  );
}

function Stars() {
  const { geometry, material } = useMemo(() => {
    const rng = new Rng(77);
    const n = 1600;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const tint = new Float32Array(n);
    // A band of extra faint stars hints at the Milky Way.
    const band = new THREE.Vector3(0.3, 0.6, -0.75).normalize();
    for (let i = 0; i < n; i++) {
      let v = new THREE.Vector3();
      if (i < n * 0.4) {
        const a = rng.range(0, Math.PI * 2);
        const u = new THREE.Vector3(1, 0, 0).cross(band).normalize();
        const w = band.clone().cross(u).normalize();
        v.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)).addScaledVector(band, rng.range(-0.12, 0.12));
      } else {
        v.set(rng.range(-1, 1), rng.range(0.02, 1), rng.range(-1, 1));
      }
      v = v.normalize();
      if (v.y < 0.03) v.y = 0.03 + rng.next() * 0.3;
      v.normalize().multiplyScalar(SKY_RADIUS * 0.95);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = i < n * 0.4 ? rng.range(0.8, 1.6) : rng.range(1.2, 3.2) * (rng.chance(0.05) ? 1.7 : 1);
      phase[i] = rng.range(0, 100);
      tint[i] = rng.next();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: GLOBAL_UNIFORMS.uTime, uVis: { value: 1 }, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aPhase; attribute float aTint;
        uniform float uTime; uniform float uPixel;
        varying float vTw; varying float vTint; varying float vH;
        void main() {
          vTw = 0.65 + 0.35 * sin(uTime * (1.2 + fract(aPhase) * 2.5) + aPhase);
          vTint = aTint;
          vH = normalize(position).y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixel;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uVis; varying float vTw; varying float vTint; varying float vH;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.75), vTint);
          gl_FragColor = vec4(col * 1.4, a * vTw * uVis * smoothstep(0.0, 0.15, vH));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    return { geometry: g, material: m };
  }, []);
  const { gl } = useThree();
  useFrame(() => {
    material.uniforms.uVis.value = skyState.starVis;
    material.uniforms.uPixel.value = gl.getPixelRatio();
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-9} />;
}

function Moon() {
  const ref = useRef<THREE.Group>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const disc = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.position.copy(skyState.moonDir).multiplyScalar(SKY_RADIUS * 0.8);
    g.lookAt(0, 0, 0);
    const vis = skyState.moonGlow;
    g.visible = vis > 0.02;
    if (halo.current) halo.current.opacity = vis * 0.45;
    if (disc.current) disc.current.opacity = Math.min(1, vis * 1.3);
  });
  return (
    <group ref={ref}>
      <mesh>
        <circleGeometry args={[5.5, 40]} />
        <meshBasicMaterial ref={disc} color="#fff6dc" transparent toneMapped={false} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[1.6, 1.2, 0.05]}>
        <circleGeometry args={[1.1, 20]} />
        <meshBasicMaterial color="#e6dcc2" transparent opacity={0.5} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[-1.8, -1.4, 0.05]}>
        <circleGeometry args={[0.8, 20]} />
        <meshBasicMaterial color="#e6dcc2" transparent opacity={0.45} fog={false} depthWrite={false} />
      </mesh>
      <sprite scale={[40, 40, 1]}>
        <spriteMaterial ref={halo} map={glowTexture()} color="#9fb4ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    </group>
  );
}

function ShootingStars() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const state = useRef<{ at: number; start: THREE.Vector3; dir: THREE.Vector3 } | null>(null);
  useFrame(() => {
    const latest = world.shootingStars[world.shootingStars.length - 1];
    if (latest && (!state.current || state.current.at !== latest.at)) {
      const r = new Rng(Math.floor(latest.seed * 1e6));
      const start = new THREE.Vector3(r.range(-1, 1), r.range(0.45, 0.85), r.range(-1, -0.2)).normalize().multiplyScalar(SKY_RADIUS * 0.9);
      const dir = new THREE.Vector3(r.range(-1, 1), r.range(-0.5, -0.2), r.range(-0.2, 0.2)).normalize();
      state.current = { at: latest.at, start, dir };
    }
    const m = ref.current;
    if (!m || !mat.current) return;
    const s = state.current;
    const age = s ? world.simTime - s.at : 99;
    if (!s || age > 1.2 || age < 0) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const p = s.start.clone().addScaledVector(s.dir, age * 70);
    m.position.copy(p);
    m.lookAt(p.clone().add(s.dir));
    mat.current.opacity = Math.sin((age / 1.2) * Math.PI) * skyState.starVis;
  });
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={[0.35, 0.35, 16]} />
      <meshBasicMaterial ref={mat} color="#fff8e6" transparent toneMapped={false} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** Puffy clouds drifting with the wind, thicker as cloud cover rises. */
export function Clouds() {
  const clouds = useMemo(() => {
    const rng = new Rng(31);
    return Array.from({ length: 16 }, (_, i) => ({
      x: rng.range(-90, 90),
      z: rng.range(-90, 60),
      y: rng.range(38, 52),
      s: rng.range(5, 10),
      puffs: Array.from({ length: rng.int(4, 7) }, () => [rng.range(-1.6, 1.6), rng.range(-0.2, 0.5), rng.range(-0.8, 0.8), rng.range(0.7, 1.3)]),
      threshold: i / 16,
    }));
  }, []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.8, depthWrite: false, flatShading: true }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const env = world.env;
    const drift = (0.4 + env.windStrength * 3) * dt * world.speed * (world.paused ? 0 : 1);
    const dx = Math.cos(env.windDir) * drift;
    const dz = Math.sin(env.windDir) * drift;
    const cover = env.mix.cloud;
    material.opacity = 0.35 + cover * 0.5;
    const night = skyState.night;
    material.color.setRGB(1 - night * 0.55 - env.mix.storm * 0.45, 1 - night * 0.5 - env.mix.storm * 0.45, 1 - night * 0.4 - env.mix.storm * 0.4);
    g.children.forEach((c, i) => {
      const cl = clouds[i];
      c.position.x += dx;
      c.position.z += dz;
      if (c.position.x > 110) c.position.x -= 220;
      if (c.position.x < -110) c.position.x += 220;
      if (c.position.z > 80) c.position.z -= 180;
      if (c.position.z < -100) c.position.z += 180;
      const show = cover > cl.threshold * 0.9;
      const target = show ? cl.s : 0.001;
      c.scale.setScalar(THREE.MathUtils.lerp(c.scale.x, target, Math.min(1, dt * 0.5)));
      c.visible = c.scale.x > 0.05;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={0.001}>
          {c.puffs.map(([px, py, pz, ps], j) => (
            <mesh key={j} position={[px, py, pz]} scale={[ps, ps * 0.6, ps * 0.8]} material={material}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
