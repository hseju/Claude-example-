import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DecorInstance, TreeInstance } from '../sim/environments/types';
import { Rng } from '../sim/math';
import type { Season } from '../sim/types';
import { world } from '../state/store';
import { glowTexture, mat, uniqueMat } from './materials';
import { skyState } from './shared';

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

function cone(r: number, h: number, y: number, seg = 9) {
  return new THREE.ConeGeometry(r, h, seg, 1).translate(0, y, 0);
}

function blob(r: number, x: number, y: number, z: number, detail = 2) {
  return new THREE.IcosahedronGeometry(r, detail).translate(x, y, z);
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  });
  const m = mergeGeometries(clean, false)!;
  m.computeVertexNormals();
  return m;
}

const GEO = {
  pineTrunk: () => new THREE.CylinderGeometry(0.1, 0.17, 1.3, 7).translate(0, 0.65, 0),
  pineTop: () => merge([cone(1.15, 1.5, 1.45), cone(0.9, 1.35, 2.2), cone(0.6, 1.15, 2.95)]),
  tallTop: () => merge([cone(1.25, 1.6, 1.6), cone(1.0, 1.5, 2.5), cone(0.75, 1.35, 3.35), cone(0.45, 1.1, 4.1)]),
  roundTrunk: () => new THREE.CylinderGeometry(0.11, 0.18, 1.6, 7).translate(0, 0.8, 0),
  roundTop: () => merge([blob(1.05, 0, 2.2, 0), blob(0.7, 0.62, 1.9, 0.2), blob(0.65, -0.55, 2.0, -0.3), blob(0.55, 0.1, 2.85, 0.15, 1)]),
  birchTrunk: () => new THREE.CylinderGeometry(0.07, 0.1, 2.3, 6).translate(0, 1.15, 0),
  birchTop: () => merge([blob(0.62, 0, 2.45, 0), blob(0.45, 0.3, 2.95, -0.1), blob(0.42, -0.32, 2.2, 0.2)]),
  rock: () => {
    const g = new THREE.IcosahedronGeometry(0.6, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    const rng = new Rng(5);
    for (let i = 0; i < p.count; i++) {
      const k = 0.85 + rng.next() * 0.3;
      p.setXYZ(i, p.getX(i) * k, Math.max(p.getY(i) * 0.62 * k, -0.15), p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  },
  bush: () => merge([blob(0.5, 0, 0.38, 0, 1), blob(0.38, 0.38, 0.3, 0.1, 1), blob(0.35, -0.32, 0.28, -0.15, 1)]),
  fern: () =>
    merge(
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return new THREE.ConeGeometry(0.09, 0.75, 4, 1).scale(1, 1, 0.3).translate(0, 0.37, 0).rotateX(0.95).rotateY(a);
      }),
    ),
  grass: () =>
    merge(
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return new THREE.ConeGeometry(0.028, 0.34 + (i % 3) * 0.06, 3, 1)
          .translate(0, 0.17, 0)
          .rotateX(0.18 + (i % 2) * 0.1)
          .rotateY(a)
          .translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
      }),
    ),
  stem: () => new THREE.CylinderGeometry(0.012, 0.015, 0.3, 4).translate(0, 0.15, 0),
  flowerHead: () => new THREE.IcosahedronGeometry(0.055, 0).translate(0, 0.31, 0),
  mushStem: () => new THREE.CylinderGeometry(0.035, 0.045, 0.14, 6).translate(0, 0.07, 0),
  mushCap: () => new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.13, 0),
  reed: () =>
    merge([
      new THREE.CylinderGeometry(0.012, 0.016, 0.9, 4).translate(0, 0.45, 0),
      new THREE.CylinderGeometry(0.012, 0.016, 0.75, 4).translate(0.07, 0.37, 0.03),
      new THREE.CylinderGeometry(0.012, 0.016, 0.8, 4).translate(-0.06, 0.4, -0.04),
      new THREE.CapsuleGeometry(0.03, 0.12, 2, 6).translate(0, 0.9, 0),
    ]),
  stump: () => new THREE.CylinderGeometry(0.26, 0.32, 0.36, 9).translate(0, 0.18, 0),
  lily: () => new THREE.CircleGeometry(0.34, 14, 0.4, Math.PI * 1.8).rotateX(-Math.PI / 2),
};

// ---------------------------------------------------------------------------
// Instancing helper
// ---------------------------------------------------------------------------

interface Inst {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number | [number, number, number];
  color?: THREE.Color;
}

function Instanced({
  geometry,
  material,
  items,
  castShadow = true,
  receiveShadow = true,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Inst[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(0, it.rot, 0);
      if (Array.isArray(it.scale)) o.scale.set(...it.scale);
      else o.scale.setScalar(it.scale);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.color) m.setColorAt(i, it.color);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />;
}

// ---------------------------------------------------------------------------
// Trees, rocks and ground cover
// ---------------------------------------------------------------------------

export function Vegetation({ season }: { season: Season }) {
  const terrain = world.terrain;
  const pal = world.def.palette[season];
  const geos = useMemo(
    () => Object.fromEntries(Object.entries(GEO).map(([k, f]) => [k, f()])) as Record<keyof typeof GEO, THREE.BufferGeometry>,
    [],
  );

  const trunkMat = useMemo(() => mat('#6b4a33', { sway: 0.5, roughness: 0.95 }), []);
  const birchMat = useMemo(() => mat('#e8e2d6', { sway: 0.5, roughness: 0.8 }), []);
  const leafMat = useMemo(() => mat('#ffffff', { sway: 0.5, roughness: 0.9 }), []);
  const rockMat = useMemo(() => mat('#ffffff', { flatShading: true, roughness: 0.95 }), []);
  const bushMat = useMemo(() => mat('#ffffff', { sway: 0.6, roughness: 0.9 }), []);
  const grassMat = useMemo(() => mat('#ffffff', { sway: 2.4, roughness: 0.9, snow: false }), []);
  const stemMat = useMemo(() => mat('#4f7a3a', { sway: 2.5, snow: false }), []);
  const headMat = useMemo(() => mat('#ffffff', { sway: 2.5, snow: false, roughness: 0.7 }), []);
  const capMat = useMemo(() => mat('#c4553f', { roughness: 0.6 }), []);
  const mushStemMat = useMemo(() => mat('#efe6d6'), []);
  const reedMat = useMemo(() => mat('#7c8a4a', { sway: 1.4, snow: false }), []);
  const stumpMat = useMemo(() => mat('#7a5a3e'), []);
  const lilyMat = useMemo(() => mat('#4f8a46', { roughness: 0.6, snow: false, side: THREE.DoubleSide }), []);

  const trees = useMemo(() => {
    const groups: Record<TreeInstance['kind'], Inst[]> = { pine: [], tallPine: [], round: [], birch: [] };
    const tops: Record<TreeInstance['kind'], Inst[]> = { pine: [], tallPine: [], round: [], birch: [] };
    const foliage = pal.foliage.map((c) => new THREE.Color(c));
    for (const t of terrain.trees) {
      const y = terrain.height(t.x, t.z) - 0.05;
      const base: Inst = { x: t.x, y, z: t.z, rot: t.rot, scale: t.scale };
      groups[t.kind].push(base);
      let color: THREE.Color;
      if (t.kind === 'pine' || t.kind === 'tallPine') {
        color = new THREE.Color(pal.pine).multiplyScalar(0.85 + t.tint * 0.3);
      } else {
        color = foliage[Math.floor(t.tint * foliage.length) % foliage.length].clone().multiplyScalar(0.88 + ((t.tint * 7) % 1) * 0.24);
        if (t.kind === 'birch') color.lerp(new THREE.Color('#d8e07a'), season === 'autumn' ? 0.5 : 0.15);
      }
      tops[t.kind].push({ ...base, color });
    }
    return { groups, tops };
  }, [terrain, pal, season]);

  const rocks = useMemo(
    () =>
      terrain.rocks.map((r) => ({
        x: r.x,
        y: terrain.height(r.x, r.z) - 0.05 * r.scale,
        z: r.z,
        rot: r.rot,
        scale: r.scale,
        color: new THREE.Color('#8d8a84').multiplyScalar(0.8 + (r.rot % 1) * 0.35),
      })),
    [terrain],
  );

  const decor = useMemo(() => {
    const by: Record<DecorInstance['kind'], Inst[]> = {
      bush: [],
      fern: [],
      grass: [],
      flower: [],
      mushroom: [],
      reed: [],
      stump: [],
      lilypad: [],
    };
    const flowerCols = pal.flowers.map((c) => new THREE.Color(c));
    const grass = new THREE.Color(pal.grass).multiplyScalar(1.12);
    const grassDry = new THREE.Color(pal.grassDry);
    for (const d of terrain.decor) {
      const y = d.kind === 'lilypad' ? world.def.waterLevel + 0.012 : terrain.height(d.x, d.z) - 0.02;
      let color: THREE.Color | undefined;
      if (d.kind === 'bush') color = new THREE.Color(pal.bush).multiplyScalar(0.85 + d.tint * 0.3);
      if (d.kind === 'fern') color = new THREE.Color(pal.bush).lerp(new THREE.Color(pal.grass), 0.3).multiplyScalar(0.9 + d.tint * 0.2);
      if (d.kind === 'grass') color = grass.clone().lerp(grassDry, d.tint);
      if (d.kind === 'flower') color = flowerCols[Math.floor(d.tint * flowerCols.length) % flowerCols.length];
      if (season === 'winter' && (d.kind === 'flower' || d.kind === 'fern' || d.kind === 'lilypad')) continue;
      by[d.kind].push({ x: d.x, y, z: d.z, rot: d.rot, scale: d.scale, color });
    }
    return by;
  }, [terrain, pal, season]);

  return (
    <group>
      <Instanced geometry={geos.pineTrunk} material={trunkMat} items={trees.groups.pine} />
      <Instanced geometry={geos.pineTop} material={leafMat} items={trees.tops.pine} />
      <Instanced
        geometry={geos.pineTrunk}
        material={trunkMat}
        items={trees.groups.tallPine.map((t) => ({ ...t, scale: (t.scale as number) * 1.25 }))}
      />
      <Instanced
        geometry={geos.tallTop}
        material={leafMat}
        items={trees.tops.tallPine.map((t) => ({ ...t, scale: (t.scale as number) * 1.25 }))}
      />
      <Instanced geometry={geos.roundTrunk} material={trunkMat} items={trees.groups.round} />
      <Instanced geometry={geos.roundTop} material={leafMat} items={trees.tops.round} />
      <Instanced geometry={geos.birchTrunk} material={birchMat} items={trees.groups.birch} />
      <Instanced geometry={geos.birchTop} material={leafMat} items={trees.tops.birch} />
      <Instanced geometry={geos.rock} material={rockMat} items={rocks} />
      <Instanced geometry={geos.bush} material={bushMat} items={decor.bush} />
      <Instanced geometry={geos.fern} material={bushMat} items={decor.fern} castShadow={false} />
      <Instanced geometry={geos.grass} material={grassMat} items={decor.grass} castShadow={false} />
      <Instanced geometry={geos.stem} material={stemMat} items={decor.flower} castShadow={false} />
      <Instanced geometry={geos.flowerHead} material={headMat} items={decor.flower} castShadow={false} />
      <Instanced geometry={geos.mushStem} material={mushStemMat} items={decor.mushroom} castShadow={false} />
      <Instanced geometry={geos.mushCap} material={capMat} items={decor.mushroom} castShadow={false} />
      <Instanced geometry={geos.reed} material={reedMat} items={decor.reed} castShadow={false} />
      <Instanced geometry={geos.stump} material={stumpMat} items={decor.stump} />
      <Instanced geometry={geos.lily} material={lilyMat} items={decor.lilypad} castShadow={false} />
      <GlowMushrooms />
    </group>
  );
}

/** Softly glowing mushrooms: the forest's touch of magic after dark. */
function GlowMushrooms() {
  const items = useMemo(() => {
    const rng = new Rng(99);
    const out: Inst[] = [];
    for (const p of world.def.glowMushrooms) {
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const x = p.x + rng.range(-0.45, 0.45);
        const z = p.z + rng.range(-0.45, 0.45);
        out.push({ x, y: world.terrain.height(x, z) - 0.01, z, rot: rng.range(0, 6.3), scale: rng.range(0.7, 1.5) });
      }
    }
    return out;
  }, []);
  const stem = useMemo(() => new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6).translate(0, 0.08, 0), []);
  const cap = useMemo(
    () => new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.15, 0),
    [],
  );
  const capMat = useMemo(() => uniqueMat('#7fe8dc', { emissive: '#4fe0d0', emissiveIntensity: 0.4, roughness: 0.4 }), []);
  const stemMat = useMemo(() => uniqueMat('#d8efe9', { emissive: '#2fa89a', emissiveIntensity: 0.2 }), []);

  const glow = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts = world.def.glowMushrooms.map((p) => [p.x, world.terrain.height(p.x, p.z) + 0.2, p.z]).flat();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const glowMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.6,
        map: glowTexture(),
        color: '#5ff0e0',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const night = skyState.night;
    const pulse = 0.85 + Math.sin(clock.elapsedTime * 1.3) * 0.15;
    capMat.emissiveIntensity = (0.15 + night * 1.6) * pulse;
    stemMat.emissiveIntensity = 0.05 + night * 0.5;
    glowMat.opacity = night * 0.45 * pulse;
  });
  return (
    <group>
      <Instanced geometry={stem} material={stemMat} items={items} castShadow={false} />
      <Instanced geometry={cap} material={capMat} items={items} castShadow={false} />
      <points geometry={glow} material={glowMat} />
    </group>
  );
}
