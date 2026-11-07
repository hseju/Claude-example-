import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { audio } from './audio/engine';
import { Scene } from './render/Scene';
import { cameraInfo, focusPoint, quality } from './render/shared';
import { useUI, world } from './state/store';
import { AvatarCreator } from './ui/AvatarCreator';
import { HUD } from './ui/HUD';

/** Starts audio on the first gesture and feeds it the simulation a few times a second. */
function useAudio() {
  const prefs = useUI((s) => s.prefs);
  useEffect(() => {
    const start = () => {
      audio.start();
      audio.setVolume(prefs.volume, prefs.muted, prefs.ambience);
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    const id = window.setInterval(() => audio.update(world, focusPoint, cameraInfo.distance), 120);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      window.clearInterval(id);
    };
  }, [prefs.volume, prefs.muted, prefs.ambience]);
}

function Intro() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 3800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`intro ${gone ? 'gone' : ''}`} aria-hidden>
      <h1>Cozy Camping World</h1>
      <p>Magical Forest · night falls over the campsite</p>
    </div>
  );
}

export function App() {
  const q = useUI((s) => s.prefs.quality);
  const creatorOpen = useUI((s) => s.creatorOpen);
  quality.high = q === 'high';
  useAudio();
  return (
    <div className="app">
      <Canvas
        key={q}
        className="world-canvas"
        shadows={quality.high ? { type: THREE.PCFSoftShadowMap } : false}
        dpr={quality.high ? [1, 2] : 1}
        gl={{ antialias: !quality.high, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 40, near: 0.1, far: 420, position: [10, 20, 20] }}
      >
        <Scene />
      </Canvas>
      <HUD />
      <Intro />
      {creatorOpen && <AvatarCreator />}
    </div>
  );
}
