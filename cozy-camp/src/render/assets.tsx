import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ObjectKind } from '../sim/types';

/**
 * Optional Blender-made models. Export a prop from Blender as .glb (Y up, 1 unit = 1 metre,
 * origin at floor level, front facing +Z), drop it in public/models and map it here. The
 * procedural model stays as the fallback while it loads or if no model is listed.
 *
 * Only props without moving parts are swappable this way; the campfire, tents, lanterns and
 * avatars animate individual parts from simulation state and keep their procedural rigs.
 */
export const MODEL_MANIFEST: Partial<Record<SwappableKind, ModelEntry>> = {
  // chair: { url: 'models/chair.glb' },
};

export type SwappableKind = Extract<
  ObjectKind,
  'chair' | 'bench' | 'logBench' | 'stool' | 'crate' | 'supplyBox' | 'tackle' | 'dock' | 'bridge' | 'tarp'
>;

export interface ModelEntry {
  url: string;
  scale?: number;
  rotationY?: number;
  yOffset?: number;
}

function GltfModel({ entry }: { entry: ModelEntry }) {
  const gltf = useGLTF(entry.url);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return s;
  }, [gltf.scene]);
  return (
    <primitive object={scene} scale={entry.scale ?? 1} rotation={[0, entry.rotationY ?? 0, 0]} position={[0, entry.yOffset ?? 0, 0]} />
  );
}

/** Renders the Blender model for a kind when one is listed, otherwise the procedural fallback. */
export function ModelOr({ kind, children }: { kind: ObjectKind; children: ReactNode }) {
  const entry = MODEL_MANIFEST[kind as SwappableKind];
  if (!entry) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <GltfModel entry={{ ...entry, url: `${import.meta.env.BASE_URL}${entry.url}` }} />
    </Suspense>
  );
}
