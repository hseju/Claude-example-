import { MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp, fbm2, smoothstep } from '../sim/math';
import type { Season } from '../sim/types';
import { world } from '../state/store';
import { mat, waterNormalTexture } from './materials';
import { quality } from './shared';

const GROUND_SIZE = 76;
const GROUND_SEGS = 190;

/** Ground mesh with vertex colours for grass, trails, shore and campsite wear. */
export function Ground({ season, onPointer }: { season: Season; onPointer?: Record<string, unknown> }) {
  const terrain = world.terrain;
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGS, GROUND_SEGS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrain.height(x, z));
    }
    g.computeVertexNormals();
    return g;
  }, [terrain]);

  useMemo(() => {
    const pal = world.def.palette[season];
    const grass = new THREE.Color(pal.grass);
    const dry = new THREE.Color(pal.grassDry);
    const dirt = new THREE.Color(pal.dirt);
    const sand = new THREE.Color(season === 'winter' ? '#a9a49a' : '#b79f74');
    const mud = new THREE.Color('#4a3d2f');
    const bed = new THREE.Color('#3b4a45');
    const moss = new THREE.Color(pal.grass).multiplyScalar(0.72);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const n = fbm2(x * 0.18, z * 0.18);
      c.copy(grass).lerp(dry, clamp(n * 0.9 + 0.35));
      // Darker, mossier ground under the forest canopy.
      const r = Math.hypot(x, z);
      c.lerp(moss, smoothstep(10, 20, r) * 0.6);
      // Worn campsite floor and trails.
      const camp = smoothstep(3.6, 1.2, Math.hypot(x, z));
      const trail = smoothstep(0.85, 0.35, terrain.trailDist(x, z));
      c.lerp(dirt, Math.max(camp * 0.85, trail * 0.9));
      // Shore and lake bed.
      const e = terrain.lakeRadius(x, z);
      c.lerp(sand, smoothstep(1.18, 1.0, e) * 0.85);
      c.lerp(mud, smoothstep(1.0, 0.8, e));
      // Stream bed.
      const sd = terrain.streamDist(x, z);
      c.lerp(sand, smoothstep(1.4, 0.95, sd) * 0.6);
      c.lerp(bed, smoothstep(0.9, 0.4, sd));
      if (y < world.def.waterLevel - 0.1) c.lerp(bed, 0.5);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [geometry, season]);

  const material = useMemo(() => mat('#ffffff', { vertexColors: true, roughness: 0.95 }), []);
  return <mesh geometry={geometry} material={material} receiveShadow name="ground" {...onPointer} />;
}

/** The lake: planar reflections on high quality, a tinted glossy surface otherwise. */
export function Lake() {
  const lake = world.def.lake;
  const geometry = useMemo(() => {
    if (!lake) return null;
    const shape = new THREE.Shape();
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * lake.rx * 1.06;
      const y = Math.sin(a) * lake.rz * 1.06;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const g = new THREE.ShapeGeometry(shape, 24);
    // UVs in world units so the ripple texture tiles evenly.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) uv.set([pos.getX(i) / 4, pos.getY(i) / 4], i * 2);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }, [lake]);
  const normals = useMemo(() => {
    const t = waterNormalTexture().clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const w = world.env.windStrength;
    normals.offset.x += dt * (0.02 + w * 0.05);
    normals.offset.y += dt * (0.012 + w * 0.03);
    const m = matRef.current;
    if (m) m.normalScale.setScalar(0.25 + w * 0.6 + world.env.mix.rain * 0.4);
  });
  if (!lake || !geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[lake.cx, world.def.waterLevel, lake.cz]} receiveShadow>
      {quality.high ? (
        <MeshReflectorMaterial
          ref={matRef as never}
          blur={[200, 80]}
          resolution={512}
          mixBlur={0.8}
          mixStrength={3.2}
          mixContrast={1}
          roughness={0.3}
          metalness={0.15}
          depthScale={0.4}
          minDepthThreshold={0.2}
          maxDepthThreshold={1.2}
          mirror={0.75}
          color="#3b6f86"
          emissive="#0d2a3a"
          emissiveIntensity={0.5}
          normalMap={normals}
          normalScale={new THREE.Vector2(0.4, 0.4)}
          distortion={0.25}
          distortionMap={normals}
          transparent
          opacity={0.9}
        />
      ) : (
        <meshStandardMaterial
          ref={matRef}
          emissive="#0d2a3a"
          emissiveIntensity={0.5}
          color="#3b6f86"
          roughness={0.15}
          metalness={0.35}
          normalMap={normals}
          transparent
          opacity={0.86}
        />
      )}
    </mesh>
  );
}

/** Flowing stream ribbon with an animated ripple normal map. */
export function Stream() {
  const terrain = world.terrain;
  const geometry = useMemo(() => {
    const stream = world.def.streams[0];
    if (!stream) return null;
    const curve = new THREE.CatmullRomCurve3(stream.map((p) => new THREE.Vector3(p.x, 0, p.z)));
    const n = 140;
    const pts = curve.getSpacedPoints(n);
    const width = 1.15;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    for (let i = 0; i <= n; i++) {
      const p = pts[i];
      const next = pts[Math.min(n, i + 1)];
      const prev = pts[Math.max(0, i - 1)];
      const dir = next.clone().sub(prev).normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      if (i > 0) along += p.distanceTo(pts[i - 1]);
      for (const s of [-1, 1]) {
        const x = p.x + side.x * width * 0.5 * s;
        const z = p.z + side.z * width * 0.5 * s;
        pos.push(x, terrain.streamSurface(p.x, p.z), z);
        uv.push((s + 1) * 0.25, along / 3);
      }
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [terrain]);
  const normals = useMemo(() => {
    const t = waterNormalTexture().clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    return t;
  }, []);
  useFrame((_, dt) => {
    normals.offset.y -= dt * 0.45 * (world.paused ? 0 : 1);
  });
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#3f8196"
        emissive="#103848"
        emissiveIntensity={0.45}
        roughness={0.08}
        metalness={0.2}
        normalMap={normals}
        normalScale={new THREE.Vector2(1.1, 1.1)}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/** Expanding rings where bobbers land, fish jump and raindrops fall. */
export function Ripples() {
  const POOL = 40;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geometry = useMemo(() => new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), []);
  const materials = useMemo(
    () => Array.from({ length: POOL }, () => new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0, depthWrite: false })),
    [],
  );
  useFrame(() => {
    const rs = world.ripples;
    for (let i = 0; i < POOL; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const r = rs[rs.length - 1 - i];
      if (!r) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const k = r.age / 2.6;
      m.position.set(r.x, world.def.waterLevel + 0.015, r.z);
      m.scale.setScalar(0.1 + k * 1.6 * r.size);
      materials[i].opacity = (1 - k) * 0.55 * Math.min(1, r.size + 0.3);
    }
  });
  return (
    <>
      {materials.map((m, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} geometry={geometry} material={m} visible={false} renderOrder={2} />
      ))}
    </>
  );
}
