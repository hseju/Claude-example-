import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createObject } from '../sim/objects';
import type { WorldObject } from '../sim/types';
import { useUI, world } from '../state/store';
import { Avatars } from './Avatar';
import { CameraRig } from './CameraRig';
import { CelestialLights, Clouds, EnvironmentDriver, SkyDome } from './Atmosphere';
import { LanternLights, ObjectView } from './Props';
import { quality } from './shared';
import { Ground, Lake, Ripples, Stream } from './Terrain';
import { Vegetation } from './Vegetation';
import { Weather } from './Weather';
import { Wildlife } from './Wildlife';

/** Advances the simulation and nudges React a few times per second. */
function SimDriver() {
  const acc = useRef(0);
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    const dbg = (window as unknown as { cozy?: Record<string, unknown> }).cozy;
    if (dbg) {
      dbg.gl = gl;
      dbg.scene = scene;
    }
  }, [gl, scene]);
  useFrame((_, dt) => {
    world.update(dt);
    // Shadows are rendered once per frame (not again for the lake reflection).
    gl.shadowMap.needsUpdate = true;
    acc.current += dt;
    if (acc.current > 0.15) {
      acc.current = 0;
      useUI.getState().bump();
    }
  }, -3);
  return null;
}

const MemoObject = memo(ObjectView, (a, b) => a.o === b.o && a.version === b.version);

function Objects() {
  useUI((s) => s.tick);
  const placingId = useUI((s) => s.placing?.id);
  const version = world.version;
  const onClick = (o: WorldObject) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const ui = useUI.getState();
    if (ui.panel === 'build') {
      if (ui.placing) return;
      if (o.movable && !world.isInUse(o)) {
        ui.setPlacing({ id: o.id, kind: o.kind, rot: o.rot, x: o.x, z: o.z, valid: true });
        ui.selectObject(o.id);
      } else {
        ui.selectObject(o.id);
        ui.showToast(o.movable ? 'Someone is using that right now' : `The ${o.name.toLowerCase()} stays where it is`);
      }
      return;
    }
    ui.selectObject(o.id);
  };
  return (
    <group>
      {world.objects.map((o) => (
        <group
          key={o.id}
          visible={o.id !== placingId}
          onClick={o.kind === 'bridge' ? undefined : onClick(o)}
          onPointerOver={(e) => {
            if (o.kind === 'bridge') return;
            e.stopPropagation();
            useUI.getState().setHover(o.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (useUI.getState().hoverObject === o.id) useUI.getState().setHover(null);
            document.body.style.cursor = '';
          }}
        >
          <MemoObject o={o} version={version} />
        </group>
      ))}
    </group>
  );
}

function ringRadius(o: WorldObject): number {
  if (o.kind === 'tent') return 1.7;
  if (o.kind === 'dock') return 1.2;
  if (o.kind === 'hammock' || o.kind === 'logBench' || o.kind === 'bench' || o.kind === 'prepTable' || o.kind === 'blanket') return 1.0;
  if (o.kind === 'campfire' || o.kind === 'tarp') return 1.0;
  return 0.55;
}

/** Soft animated rings under the selected and hovered things. */
function Selection() {
  const sel = useRef<THREE.Mesh>(null);
  const hov = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), []);
  const selMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffe7b0', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
    [],
  );
  const hovMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), []);
  useFrame(({ clock }) => {
    const ui = useUI.getState();
    const t = clock.elapsedTime;
    const s = sel.current;
    const h = hov.current;
    if (s) {
      const ch = ui.selectedChar ? world.char(ui.selectedChar) : undefined;
      const o = ui.selectedObject ? world.obj(ui.selectedObject) : undefined;
      if (ch && !(ch.inSleepingBag && ch.pinned)) {
        s.visible = true;
        s.position.set(ch.x, world.terrain.surfaceHeight(ch.x, ch.z) + 0.03, ch.z);
        s.scale.setScalar(0.45 + Math.sin(t * 3) * 0.03);
      } else if (o && !ui.placing) {
        s.visible = true;
        const y = o.kind === 'dock' ? 0.12 : world.terrain.surfaceHeight(o.x, o.z) + 0.03;
        const c = o.kind === 'dock' ? { x: o.x + 1.85, z: o.z } : o;
        s.position.set(c.x, y, c.z);
        s.scale.setScalar(ringRadius(o) * (1 + Math.sin(t * 3) * 0.04));
      } else s.visible = false;
    }
    if (h) {
      const o = ui.hoverObject ? world.obj(ui.hoverObject) : undefined;
      if (o && o.id !== ui.selectedObject && !ui.placing) {
        h.visible = true;
        const y = o.kind === 'dock' ? 0.12 : world.terrain.surfaceHeight(o.x, o.z) + 0.03;
        h.position.set(o.kind === 'dock' ? o.x + 1.85 : o.x, y, o.z);
        h.scale.setScalar(ringRadius(o));
      } else h.visible = false;
    }
  });
  return (
    <>
      <mesh ref={sel} geometry={geo} material={selMat} renderOrder={5} visible={false} />
      <mesh ref={hov} geometry={geo} material={hovMat} renderOrder={5} visible={false} />
    </>
  );
}

/** Preview of furniture being placed in build mode. */
function PlacementGhost() {
  const placing = useUI((s) => s.placing);
  const ring = useRef<THREE.Mesh>(null);
  const ghostObj = useMemo(() => {
    if (!placing) return null;
    const src = placing.id ? world.obj(placing.id) : undefined;
    const o = createObject({
      kind: placing.kind,
      id: `ghost-${placing.kind}`,
      x: 0,
      z: 0,
      init: { ...(placing.init ?? {}), color: src?.color },
    });
    if (src?.tent && o.tent) {
      o.tent.pitch = src.tent.pitch;
      o.tent.color = src.tent.color;
      o.name = src.name;
    }
    return o;
  }, [placing?.kind, placing?.id, placing?.init]);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#7be08a', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    [],
  );
  const geo = useMemo(() => new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), []);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = useUI.getState().placing;
    if (!p || !group.current || !ghostObj) return;
    const y = world.terrain.surfaceHeight(p.x, p.z);
    group.current.position.set(p.x, y, p.z);
    group.current.rotation.y = p.rot;
    ringMat.color.set(p.valid ? '#7be08a' : '#ff6b5a');
    if (ring.current) ring.current.scale.setScalar(Math.max(0.6, world.footprint(ghostObj) + 0.2));
  });
  if (!placing || !ghostObj) return null;
  return (
    <group ref={group}>
      <group position={[-ghostObj.x, 0, -ghostObj.z]}>
        <group position={[0, 0.02, 0]}>
          <GhostBody o={ghostObj} />
        </group>
      </group>
      <mesh ref={ring} geometry={geo} material={ringMat} position={[0, 0.04, 0]} renderOrder={6} />
    </group>
  );
}

function GhostBody({ o }: { o: WorldObject }) {
  // ObjectView positions at the object's coordinates; the ghost object sits at the origin.
  return (
    <group rotation={[0, -o.rot, 0]}>
      <ObjectView o={o} version={0} />
    </group>
  );
}

/** A small ring where the player last asked their camper to walk. */
function WalkMarker() {
  const ref = useRef<THREE.Mesh>(null);
  const m = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), []);
  const geo = useMemo(() => new THREE.RingGeometry(0.25, 0.32, 32).rotateX(-Math.PI / 2), []);
  useFrame((_, dt) => {
    const mk = walkMarker;
    if (!ref.current) return;
    mk.age += dt;
    ref.current.visible = mk.age < 1.2;
    ref.current.position.set(mk.x, world.terrain.surfaceHeight(mk.x, mk.z) + 0.03, mk.z);
    ref.current.scale.setScalar(1 + mk.age * 0.8);
    m.opacity = Math.max(0, 0.8 - mk.age * 0.7);
  });
  return <mesh ref={ref} geometry={geo} material={m} visible={false} />;
}

const walkMarker = { x: 0, z: 0, age: 99 };

function groundHandlers() {
  return {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const ui = useUI.getState();
      if (!ui.placing) return;
      const { x, z } = e.point;
      ui.updatePlacing({ x, z, valid: world.canPlace(ui.placing.kind, x, z, ui.placing.id) });
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      const ui = useUI.getState();
      const { x, z } = e.point;
      if (ui.placing) {
        const p = ui.placing;
        const ok = p.id ? world.moveObject(p.id, x, z, p.rot) : Boolean(world.addObject(p.kind, x, z, p.rot, p.init));
        if (ok) {
          ui.setPlacing(null);
          ui.selectObject(null);
        } else ui.showToast("That spot doesn't work. Try somewhere flat and clear.");
        return;
      }
      const player = world.player;
      const directing = ui.selectedChar === player.id || (ui.cameraMode === 'follow' && ui.followId === player.id);
      if (directing) {
        world.commandWalk(player, { x, z });
        walkMarker.x = x;
        walkMarker.z = z;
        walkMarker.age = 0;
      } else {
        ui.selectObject(null);
        ui.selectChar(null);
      }
    },
  };
}

function useSeason() {
  useUI((s) => s.tick);
  return world.env.season;
}

function Effects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
      <Vignette offset={0.3} darkness={0.55} eskil={false} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export function Scene() {
  const season = useSeason();
  const handlers = useMemo(groundHandlers, []);
  return (
    <>
      <SimDriver />
      <EnvironmentDriver />
      <CelestialLights />
      <SkyDome />
      <Clouds />
      <Ground season={season} onPointer={handlers} />
      <Lake />
      <Stream />
      <Ripples />
      <Vegetation season={season} />
      <Objects />
      <LanternLights />
      <Avatars />
      <Wildlife />
      <Weather />
      <Selection />
      <PlacementGhost />
      <WalkMarker />
      <CameraRig />
      {quality.high && <Effects />}
    </>
  );
}
