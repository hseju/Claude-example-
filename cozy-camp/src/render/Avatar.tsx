import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp, damp, dampAngle, headingTo, lerp, noise2, wrapAngle } from '../sim/math';
import type { Appearance, Character } from '../sim/types';
import { useUI, world } from '../state/store';
import { glowTexture, mat, uniqueMat } from './materials';
import { Ball, Box, Cap, Cyl } from './parts';
import { rodTips } from './shared';

interface Pose {
  bodyY: number;
  pitch: number;
  roll: number;
  legL: number;
  legR: number;
  legSpread: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  lie: number;
}

const zeroPose = (): Pose => ({
  bodyY: 0,
  pitch: 0,
  roll: 0,
  legL: 0,
  legR: 0,
  legSpread: 0,
  armLx: 0,
  armLz: 0.08,
  armRx: 0,
  armRz: -0.08,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  lie: 0,
});

const SIT_Y = -0.27;

function sitBase(p: Pose) {
  p.bodyY = SIT_Y;
  p.legL = p.legR = -1.35;
  p.legSpread = 0.12;
  p.armLx = p.armRx = -0.55;
  p.armLz = 0.25;
  p.armRz = -0.25;
}

/** Target pose for the current animation. Pure function of time and character state. */
function computePose(ch: Character, anim: string, t: number, p: Pose) {
  const n = (s: number) => noise2(t * s, ch.x * 0.3);
  switch (anim) {
    case 'walk':
    case 'run': {
      const run = anim === 'run';
      const ph = t * (run ? 13 : 9) * Math.min(1.4, 0.4 + ch.speed / 1.3);
      const sw = run ? 0.85 : 0.55;
      p.legL = Math.sin(ph) * sw;
      p.legR = -Math.sin(ph) * sw;
      p.armLx = -Math.sin(ph) * sw * 0.9;
      p.armRx = Math.sin(ph) * sw * 0.9;
      p.armLz = 0.12;
      p.armRz = -0.12;
      p.bodyY = Math.abs(Math.sin(ph)) * (run ? 0.05 : 0.03);
      p.roll = Math.sin(ph) * 0.04;
      p.pitch = run ? 0.18 : 0.04;
      break;
    }
    case 'sit':
      sitBase(p);
      p.headYaw = n(0.3) * 0.4;
      p.bodyY += Math.sin(t * 2) * 0.004;
      break;
    case 'sitChat':
      sitBase(p);
      p.armRx = -0.7 + Math.sin(t * 3) * 0.25;
      p.armRz = -0.3;
      p.headPitch = Math.sin(t * 4) * 0.06;
      break;
    case 'sitEat': {
      sitBase(p);
      p.armLx = -1.0;
      p.armLz = 0.45;
      const bite = (Math.sin(t * 2.2) + 1) / 2;
      p.armRx = lerp(-0.9, -2.1, bite);
      p.armRz = 0.25;
      p.headPitch = 0.15 - bite * 0.1;
      break;
    }
    case 'sitDrink':
    case 'eatStand': {
      if (anim === 'sitDrink') sitBase(p);
      const sip = clamp(Math.sin(t * 0.9) * 2 - 0.6);
      p.armRx = lerp(-1.0, -2.3, sip);
      p.armRz = 0.3;
      p.armLx = -0.8;
      p.armLz = 0.35;
      p.headPitch = -sip * 0.18;
      break;
    }
    case 'sitRoast':
      sitBase(p);
      p.armRx = -1.25 + Math.sin(t * 1.5) * 0.05;
      p.armRz = 0.15;
      p.armLx = -1.1;
      p.armLz = 0.35;
      p.headPitch = 0.2;
      p.pitch = 0.1;
      break;
    case 'lie':
      p.lie = 1;
      p.armLz = 0.35;
      p.armRz = -0.35;
      p.headPitch = -0.1;
      break;
    case 'sleep':
      p.lie = 1;
      p.armLz = 0.15;
      p.armRz = -0.15;
      p.headRoll = 0.25;
      p.bodyY = Math.sin(t * 1.4) * 0.006;
      break;
    case 'hammock':
      p.lie = 1;
      p.armLx = p.armRx = -2.7;
      p.armLz = 0.7;
      p.armRz = -0.7;
      p.legL = 0.05;
      p.legR = -0.08;
      break;
    case 'crouch':
      p.bodyY = -0.13;
      p.legL = p.legR = -0.9;
      p.legSpread = 0.15;
      p.armLx = p.armRx = -0.75;
      p.pitch = 0.25;
      break;
    case 'pickup': {
      const reach = (Math.sin(t * 4) + 1) / 2;
      p.bodyY = -0.14;
      p.legL = p.legR = -0.9;
      p.legSpread = 0.15;
      p.pitch = 0.4;
      p.armLx = p.armRx = -0.7 - reach * 0.5;
      p.headPitch = 0.3;
      break;
    }
    case 'chop':
      p.armRx = -0.95 + Math.sin(t * 11) * 0.35;
      p.armLx = -0.75;
      p.armLz = 0.3;
      p.pitch = 0.12;
      p.headPitch = 0.3;
      break;
    case 'stir':
      p.armRx = -1.0 + Math.sin(t * 4) * 0.15;
      p.armRz = Math.cos(t * 4) * 0.2 - 0.05;
      p.armLx = -0.3;
      p.pitch = 0.1;
      p.headPitch = 0.3;
      break;
    case 'pour':
      p.armRx = -1.15;
      p.armRz = 0.25 + Math.sin(t * 2) * 0.05;
      p.armLx = -0.9;
      p.armLz = 0.3;
      p.headPitch = 0.3;
      p.pitch = 0.1;
      break;
    case 'cast': {
      const k = clamp(t / 0.55);
      p.armRx = k < 0.5 ? lerp(-0.9, -3.3, k * 2) : lerp(-3.3, -1.0, (k - 0.5) * 2);
      p.armLx = p.armRx * 0.9;
      p.armLz = 0.25;
      p.pitch = k < 0.5 ? -0.12 : 0.15;
      break;
    }
    case 'fishIdle':
      p.armRx = -0.95 + Math.sin(t * 1.2) * 0.03;
      p.armLx = -0.85;
      p.armLz = 0.3;
      p.armRz = 0.05;
      p.headYaw = n(0.2) * 0.25;
      break;
    case 'reel':
      p.armRx = -1.0 + Math.sin(t * 9) * 0.12;
      p.armRz = Math.cos(t * 9) * 0.12;
      p.armLx = -1.1;
      p.armLz = 0.3;
      p.pitch = -0.12;
      break;
    case 'showOff': {
      p.armRx = p.armLx = -2.7;
      p.armRz = -0.15;
      p.armLz = 0.15;
      p.bodyY = Math.abs(Math.sin(t * 7)) * 0.05;
      break;
    }
    case 'hammer':
      p.bodyY = -0.1;
      p.legL = p.legR = -0.7;
      p.legSpread = 0.15;
      p.pitch = 0.35;
      p.armRx = Math.sin(t * 9) > 0 ? -1.9 : -0.55;
      p.armLx = -0.7;
      p.headPitch = 0.25;
      break;
    case 'strike':
      p.bodyY = -0.12;
      p.legL = p.legR = -0.85;
      p.pitch = 0.3;
      p.armLx = -0.9;
      p.armLz = 0.3;
      p.armRx = -0.9 + Math.sin(t * 12) * 0.25;
      p.armRz = 0.3;
      break;
    case 'toss': {
      const k = clamp(t / 0.5);
      p.armRx = lerp(-0.6, -1.6, k);
      p.armLx = lerp(-0.6, -1.4, k);
      p.pitch = 0.15 * k;
      break;
    }
    case 'telescope':
      p.pitch = 0.2;
      p.headPitch = 0.05;
      p.armRx = p.armLx = -1.35;
      p.armRz = 0.25;
      p.armLz = -0.05;
      break;
    case 'look':
      p.headYaw = n(0.25) * 0.5;
      if (Math.sin(t * 0.7) > 0.5) {
        p.armRx = -2.4;
        p.armRz = 0.45;
      }
      break;
    case 'wave':
      p.armRx = -2.8;
      p.armRz = -0.35 + Math.sin(t * 10) * 0.35;
      break;
    case 'talk':
      p.armRx = -0.45 + Math.sin(t * 3) * 0.3;
      p.armLx = -0.3 + Math.sin(t * 2.3 + 1) * 0.15;
      p.headPitch = Math.sin(t * 4) * 0.06;
      break;
    case 'stretch': {
      const k = (Math.sin(t * 2) + 1) / 2;
      p.armRx = p.armLx = -2.9 - k * 0.2;
      p.armRz = -0.25;
      p.armLz = 0.25;
      p.pitch = -0.12 * k;
      p.bodyY = k * 0.03;
      break;
    }
    case 'shiver':
      p.roll = Math.sin(t * 40) * 0.03;
      p.armLx = p.armRx = -0.6;
      p.armLz = 0.6;
      p.armRz = -0.6;
      break;
    default:
      // idle: breathe, glance around
      p.bodyY = Math.sin(t * 2) * 0.006;
      p.headYaw = n(0.25) * 0.5;
      p.armLx = Math.sin(t * 1.3) * 0.04;
      p.armRx = -Math.sin(t * 1.3) * 0.04;
  }

  // Carrying overrides the arms while walking or standing.
  const held = ch.held;
  if ((held === 'log' || held === 'branch') && p.lie === 0) {
    p.armLx = p.armRx = -0.85;
    p.armLz = 0.45;
    p.armRz = -0.45;
  } else if ((held === 'pan' || held === 'bowl') && (anim === 'walk' || anim === 'run' || anim === 'idle')) {
    p.armRx = -0.95;
    p.armLx = -0.95;
    p.armRz = 0.2;
    p.armLz = -0.2;
  } else if (held === 'lantern' && anim !== 'pickup') {
    p.armLx = Math.min(p.armLx, -0.5);
    p.armLz = 0.15;
  } else if ((held === 'rod' && (anim === 'walk' || anim === 'idle')) || (held === 'mug' && anim !== 'sitDrink' && anim !== 'eatStand')) {
    p.armRx = -0.7;
  }

  // Weather reactions while walking about.
  if (ch.expression === 'cold' && anim === 'idle') {
    p.roll = Math.sin(t * 40) * 0.02;
    p.armLz = 0.5;
    p.armRz = -0.5;
    p.armLx = p.armRx = -0.5;
  }
  if (world.rain() > 0.45 && !ch.sheltered && (anim === 'walk' || anim === 'run') && !held) {
    // Hands over the head in the rain.
    p.armLx = p.armRx = -2.9;
    p.armLz = 0.5;
    p.armRz = -0.5;
  }
}

const BAG = '#b8574a';

function Hair({ a }: { a: Appearance }) {
  const c = a.hair;
  const o = { roughness: 0.75 };
  const cap = (
    <mesh rotation={[-0.42, 0, 0]} castShadow material={mat(c, o)}>
      <sphereGeometry args={[0.268, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
    </mesh>
  );
  const fringe = (
    <group>
      <Ball rad={0.075} p={[-0.1, 0.16, 0.19]} scale={[1.2, 0.8, 0.7]} c={c} o={o} />
      <Ball rad={0.075} p={[0.02, 0.18, 0.2]} scale={[1.3, 0.8, 0.7]} c={c} o={o} />
      <Ball rad={0.07} p={[0.13, 0.15, 0.18]} scale={[1.1, 0.8, 0.7]} c={c} o={o} />
    </group>
  );
  switch (a.hairStyle) {
    case 'buzz':
      return (
        <mesh rotation={[-0.42, 0, 0]} material={mat(c, o)}>
          <sphereGeometry args={[0.256, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        </mesh>
      );
    case 'bob':
      return (
        <group>
          {cap}
          {fringe}
          <Ball rad={0.16} p={[0.19, -0.02, -0.03]} scale={[0.6, 1.05, 1]} c={c} o={o} />
          <Ball rad={0.16} p={[-0.19, -0.02, -0.03]} scale={[0.6, 1.05, 1]} c={c} o={o} />
          <Ball rad={0.21} p={[0, -0.02, -0.12]} scale={[1.1, 0.95, 0.8]} c={c} o={o} />
        </group>
      );
    case 'bun':
      return (
        <group>
          {cap}
          {fringe}
          <Ball rad={0.11} p={[0, 0.25, -0.1]} c={c} o={o} />
          <mesh position={[0, 0.2, -0.08]} rotation={[0.9, 0, 0]} material={mat('#e0c25b')}>
            <torusGeometry args={[0.06, 0.015, 6, 14]} />
          </mesh>
        </group>
      );
    case 'ponytail':
      return (
        <group>
          {cap}
          {fringe}
          <Cap rad={0.065} len={0.2} p={[0, -0.02, -0.29]} r={[0.35, 0, 0]} c={c} o={o} />
          <Ball rad={0.045} p={[0, 0.1, -0.25]} c="#d9534f" />
        </group>
      );
    case 'curly':
      return (
        <group>
          {Array.from({ length: 13 }, (_, i) => {
            const a2 = (i / 13) * Math.PI * 2;
            const ring = i % 2 === 0 ? 0.2 : 0.12;
            return <Ball key={i} rad={0.09} p={[Math.cos(a2) * ring, 0.15 + (i % 3) * 0.035, Math.sin(a2) * ring - 0.05]} c={c} o={o} />;
          })}
          <Ball rad={0.12} p={[0, 0.2, -0.04]} c={c} o={o} />
          <Ball rad={0.1} p={[0.18, 0.02, -0.08]} c={c} o={o} />
          <Ball rad={0.1} p={[-0.18, 0.02, -0.08]} c={c} o={o} />
          <Ball rad={0.13} p={[0, 0.02, -0.17]} c={c} o={o} />
        </group>
      );
    default:
      return (
        <group>
          {cap}
          {fringe}
        </group>
      );
  }
}

function Hat({ a }: { a: Appearance }) {
  const c = a.hatColor;
  switch (a.hat) {
    case 'beanie':
      return (
        <group position={[0, 0.03, -0.01]} rotation={[-0.18, 0, 0]}>
          <mesh material={mat(c)} castShadow>
            <sphereGeometry args={[0.285, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(new THREE.Color(c).multiplyScalar(0.8).getStyle())}>
            <torusGeometry args={[0.278, 0.035, 8, 26]} />
          </mesh>
          <Ball rad={0.065} p={[0, 0.3, 0]} c="#f3ede2" />
        </group>
      );
    case 'bucket':
      return (
        <group position={[0, 0.14, -0.02]} rotation={[-0.12, 0, 0]}>
          <Cyl rt={0.2} rb={0.255} h={0.17} p={[0, 0.08, 0]} c={c} seg={20} />
          <Cyl rt={0.36} rb={0.37} h={0.02} p={[0, 0.0, 0]} c={c} seg={24} />
          <Cyl rt={0.257} h={0.035} p={[0, 0.03, 0]} c="#6a5038" seg={20} />
        </group>
      );
    case 'cap':
      return (
        <group position={[0, 0.04, 0]} rotation={[-0.2, 0, 0]}>
          <mesh material={mat(c)} castShadow>
            <sphereGeometry args={[0.275, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          <Box s={[0.3, 0.02, 0.18]} p={[0, 0.06, 0.3]} r={[0.15, 0, 0]} c={c} />
          <Ball rad={0.03} p={[0, 0.275, 0]} c={c} />
        </group>
      );
    default:
      return null;
  }
}

function HeldItem({ ch, item }: { ch: Character; item: Character['held'] }) {
  const toastMat = useMemo(() => uniqueMat('#fbf6ec', { roughness: 0.6, snow: false }), []);
  const fishMat = useMemo(() => uniqueMat('#c98f8a', { roughness: 0.4, snow: false }), []);
  const tip = useRef<THREE.Object3D>(null);
  const steam = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => {
    if (item === 'stick') toastMat.color.set('#fbf6ec').lerp(new THREE.Color('#c98a3e'), ch.heldState);
    if ((item === 'fish' || item === 'pan') && ch.heldMeta?.startsWith('#')) fishMat.color.set(ch.heldMeta);
    if (item === 'rod' && tip.current) {
      const v = rodTips.get(ch.id) ?? new THREE.Vector3();
      tip.current.getWorldPosition(v);
      rodTips.set(ch.id, v);
    }
    if (steam.current) steam.current.opacity = ch.heldState > 0.5 ? 0.25 + Math.sin(clock.elapsedTime * 3) * 0.08 : 0;
  });
  switch (item) {
    case 'rod': {
      const dir = new THREE.Vector3(0, -0.3, 1).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      return (
        <group quaternion={q}>
          <Cyl rt={0.008} rb={0.016} h={1.5} p={[0, 0.7, 0]} c="#5a3a28" />
          <Cyl rt={0.025} h={0.06} p={[0.03, 0.12, 0]} r={[0, 0, Math.PI / 2]} c="#9aa0a6" o={{ metalness: 0.6 }} />
          <object3D ref={tip} position={[0, 1.45, 0]} />
        </group>
      );
    }
    case 'pan':
      return (
        <group position={[0, -0.02, 0.18]}>
          <Cyl rt={0.17} rb={0.14} h={0.05} c="#2e2e33" o={{ metalness: 0.6, roughness: 0.45 }} seg={16} />
          <Box s={[0.04, 0.02, 0.2]} p={[0, 0.01, -0.17]} c="#2e2e33" />
          <Cyl
            rt={0.14}
            h={0.02}
            p={[0, 0.03, 0]}
            c={ch.heldMeta === 'stew' ? '#9a5a2a' : ch.heldMeta === 'sausages' ? '#a8603a' : '#c7843c'}
            seg={14}
          />
        </group>
      );
    case 'bowl':
      return (
        <group position={[-0.05, 0.02, 0.1]}>
          <Cyl rt={0.1} rb={0.06} h={0.06} c="#e9e2d2" seg={14} />
          <Cyl
            rt={0.085}
            h={0.012}
            p={[0, 0.03, 0]}
            c={ch.heldMeta === 'stew' ? '#9a5a2a' : ch.heldMeta === 'sausages' ? '#a8603a' : '#c7843c'}
            seg={12}
          />
        </group>
      );
    case 'mug':
      return (
        <group position={[0, -0.02, 0.06]}>
          <Cyl rt={0.045} h={0.1} c="#d96a4a" seg={12} />
          <mesh position={[0.05, 0, 0]} rotation={[0, 0, 0]} material={mat('#d96a4a')}>
            <torusGeometry args={[0.03, 0.01, 6, 10]} />
          </mesh>
          <Cyl rt={0.04} h={0.01} p={[0, 0.048, 0]} c="#6a3a22" />
          <sprite position={[0, 0.15, 0]} scale={[0.14, 0.2, 1]}>
            <spriteMaterial ref={steam} map={glowTexture()} color="#ffffff" transparent depthWrite={false} opacity={0} />
          </sprite>
        </group>
      );
    case 'fish':
      return (
        <group position={[0, -0.12, 0.05]} rotation={[0, Math.PI / 2, 0]} scale={0.6 + ch.heldState * 0.8}>
          <Ball rad={0.1} scale={[1.6, 0.6, 0.45]} material={fishMat} />
          <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={fishMat}>
            <coneGeometry args={[0.07, 0.1, 3]} />
          </mesh>
          <Ball rad={0.015} p={[0.12, 0.02, 0.04]} c="#1d1d1d" shadow={false} />
        </group>
      );
    case 'stick':
      return (
        <group rotation={[1.2, 0, 0]}>
          <Cyl rt={0.008} h={0.9} p={[0, 0.4, 0]} c="#7a5338" />
          <mesh position={[0, 0.86, 0]} material={toastMat}>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
          </mesh>
        </group>
      );
    case 'match':
      return (
        <group position={[0, 0.02, 0.04]}>
          <Cyl rt={0.006} h={0.07} c="#e8d8b0" />
          <Ball rad={0.012} p={[0, 0.04, 0]} c="#ff8a3a" o={{ emissive: '#ff6a1a', emissiveIntensity: 2 }} />
        </group>
      );
    case 'mallet':
      return (
        <group rotation={[1.4, 0, 0]}>
          <Cyl rt={0.014} h={0.3} p={[0, 0.12, 0]} c="#9a6a3e" />
          <Cyl rt={0.045} h={0.12} p={[0, 0.27, 0]} r={[0, 0, Math.PI / 2]} c="#5a4636" />
        </group>
      );
    case 'knife':
      return (
        <group rotation={[1.3, 0, 0]}>
          <Box s={[0.02, 0.07, 0.025]} p={[0, 0.02, 0]} c="#3a2a22" />
          <Box s={[0.008, 0.11, 0.03]} p={[0, 0.11, 0]} c="#c9ced3" o={{ metalness: 0.7, roughness: 0.3 }} />
        </group>
      );
    case 'lantern':
      return (
        <group position={[0, -0.14, 0]}>
          <Cyl rt={0.05} h={0.02} p={[0, 0.08, 0]} c="#3a3a3a" />
          <mesh material={mat('#ffe0a6', { emissive: '#ffb45a', emissiveIntensity: 2.4 })}>
            <cylinderGeometry args={[0.042, 0.042, 0.13, 10]} />
          </mesh>
          <Cyl rt={0.055} h={0.02} p={[0, -0.075, 0]} c="#3a3a3a" />
          <sprite scale={[0.7, 0.7, 1]}>
            <spriteMaterial
              map={glowTexture()}
              color="#ffb45a"
              transparent
              opacity={0.35}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      );
    case 'pinecone':
      return <Ball rad={0.05} scale={[0.8, 1.2, 0.8]} c="#7a5232" />;
    case 'flower':
      return (
        <group>
          <Cyl rt={0.006} h={0.15} p={[0, 0.07, 0]} c="#4f7a3a" />
          <Ball rad={0.04} p={[0, 0.16, 0]} c="#f2a5c0" />
        </group>
      );
    case 'mushroom':
      return (
        <group>
          <Cyl rt={0.02} h={0.07} c="#efe6d6" />
          <Ball rad={0.05} p={[0, 0.05, 0]} scale={[1, 0.6, 1]} c="#d0483a" />
        </group>
      );
    case 'stone':
      return <Ball rad={0.05} scale={[1.2, 0.6, 0.9]} c="#8f9aa6" />;
    default:
      return null;
  }
}

/** Items carried in both arms in front of the chest. */
function CarryItem({ item }: { item: Character['held'] }) {
  if (item === 'log')
    return (
      <group position={[0, 0.5, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <Cyl rt={0.07} h={0.55} c="#6a4a33" />
        <Cyl rt={0.068} h={0.01} p={[0, 0.276, 0]} c="#b98a5e" />
      </group>
    );
  if (item === 'branch')
    return (
      <group position={[0, 0.5, 0.2]}>
        <Cyl rt={0.025} h={0.75} r={[0, 0, 1.4]} c="#6a4a33" />
        <Cyl rt={0.02} h={0.65} r={[0.2, 0, 1.75]} p={[0, 0.03, 0.02]} c="#7a5338" />
        <Cyl rt={0.02} h={0.6} r={[-0.2, 0, 1.2]} p={[0, -0.02, -0.02]} c="#5e4030" />
      </group>
    );
  return null;
}

export function Avatar({ ch, preview = false }: { ch: Character; preview?: boolean }) {
  const a = ch.appearance;
  const root = useRef<THREE.Group>(null);
  const swing = useRef<THREE.Group>(null);
  const lie = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const smile = useRef<THREE.Mesh>(null);
  const mouthO = useRef<THREE.Mesh>(null);
  const bag = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const handItem = useRef<THREE.Group>(null);
  const carry = useRef<THREE.Group>(null);
  const pose = useRef<Pose>(zeroPose());
  const target = useRef<Pose>(zeroPose());
  const blink = useRef({ next: 2, until: 0 });
  const heldRef = useRef<Character['held']>(null);
  const forceRender = useUI((s) => s.tick);
  void forceRender;

  const cheekMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f29a9a', transparent: true, opacity: 0.55, roughness: 0.9 }),
    [],
  );

  useFrame(({ clock }, rdt) => {
    const dt = Math.min(rdt, 0.05);
    const r = root.current;
    if (!r) return;
    const y = world.terrain.surfaceHeight(ch.x, ch.z) + ch.yOffset;
    r.position.set(ch.x, y, ch.z);
    r.rotation.y = ch.heading;

    // Hammock swing.
    const hammock = ch.activity?.id === 'hammock' && ch.pinned ? world.first('hammock') : undefined;
    if (swing.current) {
      const amp = hammock ? 0.1 + world.env.windStrength * 0.05 : 0;
      swing.current.rotation.z = hammock ? Math.sin(hammock.swing ?? 0) * amp : 0;
    }

    const anim = ch.moving ? (ch.running || (world.rain() > 0.45 && !ch.sheltered) ? 'run' : 'walk') : ch.anim;
    const tp = target.current;
    Object.assign(tp, zeroPose());
    computePose(ch, anim, ch.animTime, tp);

    // Head turns toward whatever the camper is looking at.
    if (ch.lookAt && tp.lie === 0) {
      const rel = wrapAngle(headingTo(ch, ch.lookAt) - ch.heading);
      tp.headYaw = clamp(rel, -1.1, 1.1);
    }
    if (ch.lookUp > 0) tp.headPitch = -0.45 * ch.lookUp;

    const p = pose.current;
    const k = ch.moving ? 14 : 8;
    for (const key of Object.keys(p) as (keyof Pose)[]) {
      p[key] = key === 'headYaw' ? dampAngle(p[key], tp[key], 6, dt) : damp(p[key], tp[key], key === 'lie' ? 5 : k, dt);
    }

    if (lie.current) {
      lie.current.rotation.x = (-Math.PI / 2) * p.lie;
      lie.current.position.set(0, 0.17 * p.lie, 0.45 * p.lie);
    }
    if (body.current) {
      body.current.position.y = p.bodyY;
      body.current.rotation.set(p.pitch, 0, p.roll);
    }
    legL.current?.rotation.set(p.legL, 0, p.legSpread);
    legR.current?.rotation.set(p.legR, 0, -p.legSpread);
    armL.current?.rotation.set(p.armLx, 0, p.armLz);
    armR.current?.rotation.set(p.armRx, 0, p.armRz);
    head.current?.rotation.set(p.headPitch, p.headYaw, p.headRoll);

    // Face.
    const now = clock.elapsedTime;
    const b = blink.current;
    if (now > b.next) {
      b.until = now + 0.12;
      b.next = now + 2.5 + Math.random() * 3;
    }
    const asleep = ch.anim === 'sleep' || (ch.anim === 'hammock' && ch.expression === 'sleepy');
    const eyeOpen = asleep ? 0.12 : now < b.until ? 0.1 : ch.expression === 'sleepy' ? 0.45 : ch.expression === 'surprised' ? 1.25 : 1;
    if (eyes.current) eyes.current.scale.y = damp(eyes.current.scale.y, eyeOpen, 25, dt);
    const talking = ch.expression === 'talk' || ch.expression === 'surprised';
    if (smile.current) smile.current.visible = !talking;
    if (mouthO.current) {
      mouthO.current.visible = talking;
      mouthO.current.scale.y = ch.expression === 'surprised' ? 1.3 : 0.6 + Math.abs(Math.sin(now * 10)) * 0.6;
    }
    cheekMat.opacity = ch.expression === 'cold' ? 0.85 : 0.55;
    if (bag.current) bag.current.visible = ch.inSleepingBag;
    if (shadow.current) {
      shadow.current.visible = ch.yOffset < 0.2 && p.lie < 0.5;
      shadow.current.position.y = 0.015 - ch.yOffset;
    }

    if (heldRef.current !== ch.held) heldRef.current = ch.held;
    if (handItem.current) handItem.current.visible = !(ch.held === 'log' || ch.held === 'branch');
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const ui = useUI.getState();
    if (ui.placing) return;
    ui.selectChar(ch.id);
  };

  const skin = a.skin;
  const s = a.scale;
  return (
    <group
      ref={root}
      onClick={preview ? undefined : onClick}
      onPointerOver={preview ? undefined : () => (document.body.style.cursor = 'pointer')}
      onPointerOut={preview ? undefined : () => (document.body.style.cursor = '')}
    >
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={1}>
        <planeGeometry args={[0.75, 0.75]} />
        <meshBasicMaterial map={glowTexture()} color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <group ref={swing} position={[0, 0.48, 0]}>
        <group position={[0, -0.48, 0]}>
          <group ref={lie} scale={s}>
            <group ref={body}>
              {/* Legs */}
              <group ref={legL} position={[-0.085, 0.32, 0]}>
                <Cap rad={0.068} len={0.13} p={[0, -0.13, 0]} c={a.bottom} />
                <Ball rad={0.075} p={[0, -0.27, 0.035]} scale={[1, 0.7, 1.35]} c={a.shoes} />
              </group>
              <group ref={legR} position={[0.085, 0.32, 0]}>
                <Cap rad={0.068} len={0.13} p={[0, -0.13, 0]} c={a.bottom} />
                <Ball rad={0.075} p={[0, -0.27, 0.035]} scale={[1, 0.7, 1.35]} c={a.shoes} />
              </group>
              {/* Torso */}
              <Cyl rt={0.165} rb={0.175} h={0.11} p={[0, 0.355, 0]} c={a.bottom} seg={16} />
              <Cap rad={0.16} len={0.12} p={[0, 0.47, 0]} c={a.top} />
              <Ball rad={0.025} p={[0, 0.5, 0.155]} c={new THREE.Color(a.top).multiplyScalar(0.75).getStyle()} shadow={false} />
              <Ball rad={0.025} p={[0, 0.42, 0.162]} c={new THREE.Color(a.top).multiplyScalar(0.75).getStyle()} shadow={false} />
              {a.scarf && (
                <group>
                  <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#d9534f')} castShadow>
                    <torusGeometry args={[0.13, 0.05, 8, 18]} />
                  </mesh>
                  <Box s={[0.08, 0.18, 0.04]} p={[0.07, 0.5, 0.15]} r={[0.1, 0, 0.1]} c="#d9534f" />
                </group>
              )}
              {/* Arms */}
              <group ref={armL} position={[-0.19, 0.56, 0]}>
                <Cap rad={0.052} len={0.13} p={[0, -0.11, 0]} c={a.top} />
                <Ball rad={0.058} p={[0, -0.22, 0]} c={skin} />
              </group>
              <group ref={armR} position={[0.19, 0.56, 0]}>
                <Cap rad={0.052} len={0.13} p={[0, -0.11, 0]} c={a.top} />
                <Ball rad={0.058} p={[0, -0.22, 0]} c={skin} />
                <group ref={handItem} position={[0, -0.24, 0.02]}>
                  {ch.held !== 'lantern' && <HeldItem ch={ch} item={ch.held} />}
                </group>
              </group>
              {ch.held === 'lantern' && (
                <group position={[-0.24, 0.32, 0.12]}>
                  <HeldItem ch={ch} item="lantern" />
                </group>
              )}
              <group ref={carry}>
                <CarryItem item={ch.held} />
              </group>
              {/* Head */}
              <group ref={head} position={[0, 0.6, 0]}>
                <group position={[0, 0.25, 0]}>
                  <Ball rad={0.25} c={skin} seg={24} o={{ roughness: 0.7 }} />
                  <Ball rad={0.05} p={[0.245, -0.01, 0]} c={skin} />
                  <Ball rad={0.05} p={[-0.245, -0.01, 0]} c={skin} />
                  <group ref={eyes} position={[0, -0.01, 0]}>
                    {[-1, 1].map((sx) => (
                      <group key={sx} position={[sx * 0.088, 0, 0.226]}>
                        <Ball rad={0.038} scale={[0.82, 1.15, 0.5]} c="#231a17" o={{ roughness: 0.3 }} shadow={false} />
                        <Ball
                          rad={0.012}
                          p={[0.012, 0.02, 0.02]}
                          c="#ffffff"
                          o={{ emissive: '#ffffff', emissiveIntensity: 0.4 }}
                          shadow={false}
                        />
                      </group>
                    ))}
                  </group>
                  {[-1, 1].map((sx) => (
                    <mesh key={sx} position={[sx * 0.15, -0.075, 0.19]} scale={[1, 0.6, 0.35]} material={cheekMat}>
                      <sphereGeometry args={[0.042, 10, 8]} />
                    </mesh>
                  ))}
                  <mesh ref={smile} position={[0, -0.085, 0.238]} rotation={[0.2, 0, Math.PI]} material={mat('#5a2a22')}>
                    <torusGeometry args={[0.032, 0.008, 6, 12, Math.PI]} />
                  </mesh>
                  <mesh ref={mouthO} position={[0, -0.095, 0.235]} scale={[1, 0.8, 0.4]} material={mat('#5a2a22')} visible={false}>
                    <sphereGeometry args={[0.024, 10, 8]} />
                  </mesh>
                  <Hair a={a} />
                  <Hat a={a} />
                </group>
              </group>
            </group>
            {/* Sleeping bag tucked over the body */}
            <mesh ref={bag} position={[0, 0.28, 0]} visible={false} castShadow material={mat(BAG)}>
              <capsuleGeometry args={[0.2, 0.42, 4, 12]} />
            </mesh>
          </group>
        </group>
      </group>
      {!preview && <AvatarLabel ch={ch} />}
    </group>
  );
}

function AvatarLabel({ ch }: { ch: Character }) {
  useUI((s) => s.tick);
  const selected = useUI((s) => s.selectedChar === ch.id);
  const showNames = useUI((s) => s.prefs.showNames);
  const following = useUI((s) => s.cameraMode === 'follow' && s.followId === ch.id);
  const bubble = ch.bubble;
  const kind = ch.controller === 'player' ? 'you' : ch.controller === 'remote' ? 'remote' : 'ai';
  const asleepInTent = ch.activity?.id === 'sleep' && ch.inSleepingBag;
  const y = ch.activity?.id === 'sleep' && ch.inSleepingBag ? 0.8 : 1.42 * ch.appearance.scale;
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`avatar-label ${selected ? 'selected' : ''}`}>
        {bubble && (
          <div className="bubble" key={bubble.until}>
            <span>{bubble.icon}</span>
            {bubble.text && <em>{bubble.text}</em>}
          </div>
        )}
        {(selected || (showNames && !asleepInTent)) && !following && (
          <div className={`nametag ${kind}`}>
            <i aria-hidden>{kind === 'you' ? '★' : kind === 'remote' ? '◆' : '🍃'}</i>
            {ch.name}
          </div>
        )}
      </div>
    </Html>
  );
}

/** Fishing line from rod tip to bobber, and the bobber itself. */
export function FishingLines() {
  const POOL = 3;
  const bobbers = useRef<(THREE.Group | null)[]>([]);
  const geos = useMemo(
    () =>
      Array.from({ length: POOL }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
        return g;
      }),
    [],
  );
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#e8eef2', transparent: true, opacity: 0.7 }), []);
  const lineObjs = useMemo(() => geos.map((g) => new THREE.Line(g, lineMat)), [geos, lineMat]);
  useFrame(({ clock }) => {
    const wl = world.def.waterLevel;
    for (let i = 0; i < POOL; i++) {
      const b = world.bobbers[i];
      const line = lineObjs[i];
      const bob = bobbers.current[i];
      if (!line || !bob) continue;
      const tip = b ? rodTips.get(b.ownerId) : undefined;
      if (!b || !tip) {
        line.visible = false;
        bob.visible = false;
        continue;
      }
      line.visible = bob.visible = true;
      const f = b.flight;
      const bx = lerp(b.sx, b.x, f);
      const bz = lerp(b.sz, b.z, f);
      const by = b.landed
        ? wl + 0.02 - b.dip * 0.07 + Math.sin(clock.elapsedTime * 2 + i) * 0.01
        : lerp(tip.y, wl, f) + Math.sin(f * Math.PI) * 1.4;
      bob.position.set(bx, by, bz);
      const pos = geos[i].attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < 10; j++) {
        const t = j / 9;
        const sag = Math.sin(t * Math.PI) * (b.landed ? 0.25 : 0.05);
        pos.setXYZ(j, lerp(tip.x, bx, t), lerp(tip.y, by, t) - sag, lerp(tip.z, bz, t));
      }
      pos.needsUpdate = true;
      geos[i].computeBoundingSphere();
    }
  });
  return (
    <>
      {geos.map((_g, i) => (
        <group key={i}>
          <primitive object={lineObjs[i]} visible={false} />
          <group ref={(gr) => (bobbers.current[i] = gr)} visible={false}>
            <Ball rad={0.04} p={[0, 0.02, 0]} c="#e84a3a" shadow={false} />
            <Ball rad={0.041} p={[0, -0.005, 0]} scale={[1, 0.5, 1]} c="#ffffff" shadow={false} />
          </group>
        </group>
      ))}
    </>
  );
}

export function Avatars() {
  return (
    <>
      {world.characters.map((c) => (
        <Avatar key={c.id} ch={c} />
      ))}
      <FishingLines />
    </>
  );
}
