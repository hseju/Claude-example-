import type { ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { mat, type StylizedOptions } from './materials';

type V3 = [number, number, number];

interface PartProps {
  p?: V3;
  r?: V3;
  /** Colour; ignored when `material` is given. */
  c?: string;
  o?: StylizedOptions;
  shadow?: boolean;
  material?: THREE.Material;
  name?: string;
  visible?: boolean;
  scale?: V3;
}

/** Small JSX helpers for building props out of primitives with shared materials. */
export function Box({ s, p, r, c, o, shadow = true, material, ...rest }: PartProps & { s: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow={shadow} receiveShadow material={material ?? mat(c ?? '#ffffff', o)} {...rest}>
      <boxGeometry args={s} />
    </mesh>
  );
}

export function Cyl({
  rt,
  rb,
  h,
  seg = 10,
  p,
  r,
  c,
  o,
  shadow = Math.max(rt, rb ?? rt) > 0.02,
  material,
  ...rest
}: PartProps & { rt: number; rb?: number; h: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow={shadow} receiveShadow material={material ?? mat(c ?? '#ffffff', o)} {...rest}>
      <cylinderGeometry args={[rt, rb ?? rt, h, seg]} />
    </mesh>
  );
}

export function Ball({
  rad,
  p,
  r,
  c,
  o,
  shadow = rad > 0.045,
  scale,
  material,
  seg = 14,
  ...rest
}: PartProps & { rad: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} scale={scale} castShadow={shadow} receiveShadow material={material ?? mat(c ?? '#ffffff', o)} {...rest}>
      <sphereGeometry args={[rad, seg, Math.max(6, Math.round(seg * 0.7))]} />
    </mesh>
  );
}

export function Cap({ rad, len, p, r, c, o, shadow = true, material, ...rest }: PartProps & { rad: number; len: number }) {
  return (
    <mesh position={p} rotation={r} castShadow={shadow} receiveShadow material={material ?? mat(c ?? '#ffffff', o)} {...rest}>
      <capsuleGeometry args={[rad, len, 4, 10]} />
    </mesh>
  );
}

/** A thin rod between two points (ropes, poles, rails). */
export function Rod({
  a,
  b,
  rad = 0.015,
  c,
  o,
  shadow = false,
}: {
  a: V3;
  b: V3;
  rad?: number;
  c: string;
  o?: StylizedOptions;
  shadow?: boolean;
}) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const len = va.distanceTo(vb);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return (
    <mesh position={mid} quaternion={q} castShadow={shadow} material={mat(c, o)}>
      <cylinderGeometry args={[rad, rad, len, 5]} />
    </mesh>
  );
}

export type GroupProps = ThreeElements['group'];

/**
 * Merges the static meshes inside it into one mesh per material after mount,
 * cutting draw calls for props built from many primitives. Only use around
 * parts whose transforms and visibility never change (materials may animate).
 */
export function Merged({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
    const sources: THREE.Mesh[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
      const material = m.material as THREE.MeshStandardMaterial;
      if (material.map || material.transparent) return;
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(inv.clone().multiply(m.matrixWorld));
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      const b = buckets.get(material) ?? { geos: [], cast: false };
      b.geos.push(geo);
      b.cast ||= m.castShadow;
      buckets.set(material, b);
      sources.push(m);
    });
    const merged: THREE.Mesh[] = [];
    for (const [material, b] of buckets) {
      const geo = mergeGeometries(b.geos, false);
      b.geos.forEach((x) => x.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      merged.push(mesh);
      g.add(mesh);
    }
    for (const s of sources) s.visible = false;
    return () => {
      for (const m of merged) {
        g.remove(m);
        m.geometry.dispose();
      }
      for (const s of sources) s.visible = true;
    };
  }, []);
  return <group ref={ref}>{children}</group>;
}
