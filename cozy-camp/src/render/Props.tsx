import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp, Rng } from '../sim/math';
import type { CollectibleKind, FoodKind, WorldObject } from '../sim/types';
import { world } from '../state/store';
import { Campfire } from './Campfire';
import { ginghamTexture, glowTexture, mat, uniqueMat } from './materials';
import { Ball, Box, Cap, Cyl, Rod } from './parts';
import { focusPoint, skyState } from './shared';
import { Tent } from './Tent';

const WOOD = '#8b6142';
const WOOD_DARK = '#6a4a33';
const WOOD_LIGHT = '#b98a5e';
const METAL = '#4a4d52';

function Rounded({ s, p, r, c, radius = 0.03 }: { s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; c: string; radius?: number }) {
  return (
    <RoundedBox args={s} radius={radius} smoothness={3} position={p} rotation={r} castShadow receiveShadow material={mat(c)} />
  );
}

function Chair({ o }: { o: WorldObject }) {
  const c = o.color ?? '#c0583c';
  const frame = '#33363a';
  return (
    <group>
      {[-0.22, 0.22].map((x) => (
        <group key={x}>
          <Rod a={[x, 0, 0.2]} b={[x, 0.3, -0.18]} c={frame} rad={0.014} />
          <Rod a={[x, 0, -0.2]} b={[x, 0.3, 0.18]} c={frame} rad={0.014} />
          <Rod a={[x, 0.3, -0.2]} b={[x * 1.1, 0.72, -0.32]} c={frame} rad={0.014} />
          <Box s={[0.05, 0.03, 0.42]} p={[x * 1.15, 0.47, -0.02]} c={frame} />
        </group>
      ))}
      <mesh position={[0, 0.29, 0]} castShadow receiveShadow material={mat(c)}>
        <boxGeometry args={[0.46, 0.05, 0.42]} />
      </mesh>
      <mesh position={[0, 0.53, -0.26]} rotation={[-0.3, 0, 0]} castShadow receiveShadow material={mat(c)}>
        <boxGeometry args={[0.46, 0.42, 0.04]} />
      </mesh>
      <Cyl rt={0.035} rb={0.03} h={0.06} p={[0.27, 0.5, 0.15]} c={frame} />
    </group>
  );
}

function LogBench() {
  return (
    <group>
      <Cyl rt={0.16} h={1.6} r={[0, 0, Math.PI / 2]} p={[0, 0.22, 0]} c={WOOD} seg={12} />
      <Cyl rt={0.155} h={0.02} r={[0, 0, Math.PI / 2]} p={[0.8, 0.22, 0]} c={WOOD_LIGHT} seg={12} />
      <Cyl rt={0.155} h={0.02} r={[0, 0, Math.PI / 2]} p={[-0.8, 0.22, 0]} c={WOOD_LIGHT} seg={12} />
      <Box s={[0.12, 0.12, 0.3]} p={[-0.55, 0.06, 0]} c={WOOD_DARK} />
      <Box s={[0.12, 0.12, 0.3]} p={[0.55, 0.06, 0]} c={WOOD_DARK} />
    </group>
  );
}

function Bench() {
  return (
    <group>
      {[-0.12, 0.0, 0.12].map((z) => (
        <Rounded key={z} s={[1.6, 0.04, 0.11]} p={[0, 0.36, z]} c={WOOD_LIGHT} radius={0.015} />
      ))}
      {[0.48, 0.6].map((y) => (
        <Rounded key={y} s={[1.6, 0.09, 0.03]} p={[0, y, -0.2]} r={[-0.15, 0, 0]} c={WOOD_LIGHT} radius={0.012} />
      ))}
      {[-0.7, 0.7].map((x) => (
        <group key={x}>
          <Box s={[0.06, 0.36, 0.06]} p={[x, 0.18, 0.12]} c={WOOD_DARK} />
          <Box s={[0.06, 0.66, 0.06]} p={[x, 0.33, -0.17]} c={WOOD_DARK} />
        </group>
      ))}
    </group>
  );
}

function Stool() {
  return (
    <group>
      <Cyl rt={0.2} rb={0.22} h={0.3} p={[0, 0.15, 0]} c={WOOD} seg={12} />
      <Cyl rt={0.195} h={0.015} p={[0, 0.305, 0]} c={WOOD_LIGHT} seg={12} />
    </group>
  );
}

function Woodpile({ o }: { o: WorldObject }) {
  const slots = useMemo(() => {
    const out: [number, number][] = [];
    const rows = [4, 3, 2, 1];
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * 0.16, 0.075 + row * 0.13]);
    });
    return out;
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => refs.current.forEach((g, i) => g && (g.visible = i < (o.count ?? 0))));
  return (
    <group>
      <Box s={[0.9, 0.04, 0.5]} p={[0, 0.02, 0]} c={WOOD_DARK} />
      {slots.map(([x, y], i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={[x, y + 0.02, 0]}>
          <Cyl rt={0.07} h={0.6} r={[Math.PI / 2, 0, 0]} c={i % 3 ? WOOD : '#7a5338'} seg={8} />
          <Cyl rt={0.068} h={0.01} r={[Math.PI / 2, 0, 0]} p={[0, 0, 0.3]} c={WOOD_LIGHT} seg={8} />
        </group>
      ))}
      {/* Chopping block with an axe */}
      <group position={[0.85, 0, 0.1]}>
        <Cyl rt={0.2} rb={0.22} h={0.32} p={[0, 0.16, 0]} c={WOOD} />
        <Cyl rt={0.195} h={0.01} p={[0, 0.325, 0]} c={WOOD_LIGHT} />
        <group position={[0, 0.34, 0]} rotation={[0, 0.6, -0.5]}>
          <Cyl rt={0.018} h={0.5} p={[0, 0.25, 0]} c="#9a6a3e" />
          <Box s={[0.14, 0.09, 0.025]} p={[0.05, 0.02, 0]} c="#9aa0a6" o={{ metalness: 0.6, roughness: 0.4 }} />
        </group>
      </group>
    </group>
  );
}

const FOOD_COLORS: Record<FoodKind, string> = { stew: '#9a5a2a', sausages: '#9a4f2b', fish: '#c7843c' };

function PrepTable({ o }: { o: WorldObject }) {
  const prep = o.prep!;
  const plates = useRef<(THREE.Group | null)[]>([]);
  const veg = useRef<(THREE.Object3D | null)[]>([]);
  const raw = useRef<Record<string, THREE.Object3D | null>>({});
  const plateFood = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    plates.current.forEach((g, i) => g && (g.visible = i < prep.plates));
    plateFood.current.forEach((m) => {
      if (m) (m.material as THREE.MeshStandardMaterial).color.set(FOOD_COLORS[prep.plateFood]);
    });
    const food = prep.food;
    for (const [k, r] of Object.entries(raw.current)) if (r) r.visible = food === k;
    veg.current.forEach((v, i) => v && (v.visible = food !== null && i < Math.ceil(prep.progress * 8)));
  });
  const plateMats = useMemo(() => Array.from({ length: 4 }, () => uniqueMat('#9a5a2a', { roughness: 0.6 })), []);
  return (
    <group>
      <Rounded s={[1.44, 0.05, 0.72]} p={[0, 0.72, 0]} c="#c79a6a" radius={0.02} />
      {[
        [-0.65, -0.3],
        [0.65, -0.3],
        [-0.65, 0.3],
        [0.65, 0.3],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} rt={0.022} h={0.72} p={[x, 0.36, z]} c={METAL} />
      ))}
      {/* Cutting board with ingredients being prepared */}
      <Rounded s={[0.42, 0.025, 0.28]} p={[0, 0.76, 0.12]} c={WOOD_LIGHT} radius={0.01} />
      <group position={[0, 0.79, 0.12]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} ref={(m) => (veg.current[i] = m)} position={[-0.15 + (i % 4) * 0.08, 0.008, -0.06 + Math.floor(i / 4) * 0.1]} material={mat(i % 3 === 0 ? '#f08a3a' : i % 3 === 1 ? '#e84a3a' : '#f2e2b8')} castShadow>
            <boxGeometry args={[0.035, 0.025, 0.035]} />
          </mesh>
        ))}
        <group ref={(g) => (raw.current.stew = g)}>
          <mesh position={[0.15, 0.03, 0]} rotation={[0, 0, Math.PI / 2]} material={mat('#f08a3a')}>
            <coneGeometry args={[0.022, 0.16, 8]} />
          </mesh>
          <Ball rad={0.035} p={[0.13, 0.03, 0.07]} c="#d84a3a" />
        </group>
        <group ref={(g) => (raw.current.sausages = g)}>
          <Cap rad={0.022} len={0.12} r={[0, 0, Math.PI / 2]} p={[0.12, 0.025, -0.04]} c="#e6a3a0" />
          <Cap rad={0.022} len={0.12} r={[0, 0, Math.PI / 2]} p={[0.12, 0.025, 0.02]} c="#e6a3a0" />
        </group>
        <group ref={(g) => (raw.current.fish = g)}>
          <Ball rad={0.07} scale={[1.5, 0.4, 0.55]} p={[0.06, 0.02, 0]} c="#b9c3c9" />
        </group>
      </group>
      {/* Plates of food ready to eat */}
      {[-0.52, -0.3, 0.34, 0.54].map((x, i) => (
        <group key={i} ref={(g) => (plates.current[i] = g)} position={[x, 0.76, i < 2 ? -0.14 : 0.14]}>
          <Cyl rt={0.1} rb={0.06} h={0.05} p={[0, 0.025, 0]} c="#e9e2d2" seg={14} />
          <mesh ref={(m) => (plateFood.current[i] = m)} position={[0, 0.05, 0]} material={plateMats[i]}>
            <cylinderGeometry args={[0.08, 0.08, 0.012, 12]} />
          </mesh>
        </group>
      ))}
      {/* Supplies on the table */}
      <Cyl rt={0.035} h={0.12} p={[0.6, 0.81, -0.22]} c="#c2873a" o={{ roughness: 0.4 }} />
      <Cyl rt={0.03} h={0.1} p={[0.5, 0.8, -0.26]} c="#9e3b2f" o={{ roughness: 0.4 }} />
      <TableLantern />
      {/* Cooler under the table */}
      <Rounded s={[0.5, 0.3, 0.32]} p={[-0.35, 0.15, -0.05]} c="#3f7fa8" radius={0.04} />
      <Box s={[0.52, 0.04, 0.34]} p={[-0.35, 0.31, -0.05]} c="#e9e7e1" />
    </group>
  );
}

function TableLantern() {
  const m = useMemo(() => uniqueMat('#ffe0a6', { emissive: '#ffb45a', emissiveIntensity: 1.5 }), []);
  useFrame(({ clock }) => {
    m.emissiveIntensity = (0.4 + skyState.night * 1.8) * (0.92 + Math.sin(clock.elapsedTime * 9) * 0.04);
  });
  return (
    <group position={[-0.58, 0.75, -0.2]}>
      <Cyl rt={0.06} rb={0.07} h={0.03} p={[0, 0.015, 0]} c={METAL} />
      <mesh position={[0, 0.1, 0]} material={m}>
        <cylinderGeometry args={[0.05, 0.05, 0.13, 10]} />
      </mesh>
      <Cyl rt={0.06} rb={0.045} h={0.03} p={[0, 0.18, 0]} c={METAL} />
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0]} material={mat(METAL)}>
        <torusGeometry args={[0.035, 0.006, 6, 12, Math.PI]} />
      </mesh>
    </group>
  );
}

function Tarp() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.3, 2.7, 12, 10);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // Slopes from 2.0 m at the front to 1.65 m at the back, sagging between poles.
      const base = 1.82 + (z / 2.7) * 0.36;
      const sag = (1 - (x / 1.65) ** 2) * (1 - (z / 1.35) ** 2) * 0.12;
      p.setY(i, base - sag);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow material={mat('#c9a46a', { side: THREE.DoubleSide, roughness: 0.95 })} />
      {[
        [-1.6, 1.3, 2.0],
        [1.6, 1.3, 2.0],
        [-1.6, -1.3, 1.64],
        [1.6, -1.3, 1.64],
      ].map(([x, z, h]) => (
        <group key={`${x}${z}`}>
          <Cyl rt={0.03} h={h} p={[x, h / 2, z]} c="#6a5038" />
          <Rod a={[x, h, z]} b={[x * 1.35, 0, z * 1.5]} c="#d8cdb5" rad={0.008} />
        </group>
      ))}
      {/* String of little lights along the front edge */}
      <TarpLights />
    </group>
  );
}

function TarpLights() {
  const m = useMemo(() => uniqueMat('#ffe7b0', { emissive: '#ffcf7a', emissiveIntensity: 1 }), []);
  useFrame(({ clock }) => {
    m.emissiveIntensity = skyState.night * (1.6 + Math.sin(clock.elapsedTime * 2) * 0.2);
  });
  return (
    <group>
      {Array.from({ length: 9 }, (_, i) => {
        const x = -1.55 + i * 0.39;
        return (
          <mesh key={i} position={[x, 1.93 - Math.sin((i / 8) * Math.PI) * 0.1, 1.33]} material={m}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

function SupplyBox() {
  return (
    <group>
      <Rounded s={[0.82, 0.42, 0.52]} p={[0, 0.21, 0]} c={WOOD} radius={0.03} />
      {[-0.12, 0.12].map((y) => (
        <Box key={y} s={[0.84, 0.04, 0.54]} p={[0, 0.21 + y, 0]} c={WOOD_DARK} />
      ))}
      <group position={[0, 0.43, -0.22]} rotation={[-0.5, 0, 0]}>
        <Rounded s={[0.84, 0.04, 0.5]} p={[0, 0, 0.25]} c={WOOD_LIGHT} radius={0.015} />
      </group>
      <Ball rad={0.06} p={[-0.2, 0.44, 0.05]} c="#d84a3a" />
      <Ball rad={0.055} p={[-0.08, 0.44, 0.1]} c="#e9c64a" />
      <mesh position={[0.15, 0.45, 0.05]} rotation={[0.3, 0, 1.4]} material={mat('#f08a3a')}>
        <coneGeometry args={[0.03, 0.2, 8]} />
      </mesh>
      <Cyl rt={0.07} h={0.14} p={[0.25, 0.48, -0.08]} c="#e8dcc0" />
    </group>
  );
}

function FishBucket({ o }: { o: WorldObject }) {
  const tails = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(({ clock }) => {
    tails.current.forEach((t, i) => {
      if (!t) return;
      t.visible = i < (o.count ?? 0);
      t.rotation.z = Math.sin(clock.elapsedTime * 4 + i * 2) * 0.25;
    });
  });
  return (
    <group>
      <Cyl rt={0.2} rb={0.16} h={0.3} p={[0, 0.15, 0]} c="#7e8f9a" o={{ metalness: 0.5, roughness: 0.4 }} seg={16} />
      <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#3d6f8a', { roughness: 0.15 })}>
        <circleGeometry args={[0.18, 16]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0]} material={mat(METAL)}>
        <torusGeometry args={[0.2, 0.008, 6, 16, Math.PI]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => (tails.current[i] = m)} position={[Math.cos(i * 1.7) * 0.08, 0.33, Math.sin(i * 1.7) * 0.08]} rotation={[0, i, 0]} material={mat(['#c98f8a', '#c9b85a', '#e0a03f', '#b7c2c9'][i])}>
          <coneGeometry args={[0.035, 0.08, 3]} />
        </mesh>
      ))}
    </group>
  );
}

function Dock() {
  const d = world.def.dock!;
  const len = d.x1 - d.x0;
  const planks = Math.round(len / 0.24);
  const deck = 0.1;
  return (
    <group>
      {Array.from({ length: planks }, (_, i) => {
        const x = -len / 2 + (i + 0.5) * (len / planks);
        return <Box key={i} s={[len / planks - 0.03, 0.05, d.width]} p={[x, deck - 0.025, 0]} c={i % 3 === 0 ? '#9a7350' : i % 3 === 1 ? '#a57d58' : '#8f6a49'} />;
      })}
      <Box s={[len, 0.08, 0.08]} p={[0, deck - 0.08, d.width / 2 - 0.04]} c={WOOD_DARK} />
      <Box s={[len, 0.08, 0.08]} p={[0, deck - 0.08, -d.width / 2 + 0.04]} c={WOOD_DARK} />
      {[-1.2, 0.3, 1.8].map((x) =>
        [-1, 1].map((s) => <Cyl key={`${x}${s}`} rt={0.07} h={1.3} p={[x, deck - 0.6, s * (d.width / 2 - 0.05)]} c={WOOD_DARK} />),
      )}
      {/* Mooring post with rope at the end */}
      <Cyl rt={0.06} h={0.45} p={[len / 2 - 0.1, deck + 0.2, -d.width / 2 + 0.08]} c={WOOD_DARK} />
      <mesh position={[len / 2 - 0.1, deck + 0.3, -d.width / 2 + 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mat('#d8cdb5')}>
        <torusGeometry args={[0.07, 0.015, 6, 14]} />
      </mesh>
    </group>
  );
}

function Tackle() {
  return (
    <group>
      <Rounded s={[0.5, 0.22, 0.3]} p={[0, 0.11, 0]} c="#4f7a4a" radius={0.03} />
      <Box s={[0.18, 0.03, 0.04]} p={[0, 0.25, 0]} c="#2f3a2e" />
      <Rod a={[-0.3, 0, -0.2]} b={[-0.18, 1.5, -0.32]} c="#5a3a28" rad={0.012} />
      <Rod a={[-0.2, 0, -0.22]} b={[-0.02, 1.45, -0.36]} c="#3a5a7a" rad={0.012} />
    </group>
  );
}

function Lantern({ o }: { o: WorldObject }) {
  const swing = useRef<THREE.Group>(null);
  const glassMat = useMemo(() => uniqueMat('#ffe0a6', { emissive: '#ffb45a', emissiveIntensity: 2 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const w = world.env.windStrength;
    if (swing.current) {
      swing.current.rotation.z = Math.sin(t * 1.6 + o.x) * (0.03 + w * 0.12);
      swing.current.rotation.x = Math.cos(t * 1.3 + o.z) * (0.02 + w * 0.08);
    }
    const flicker = 0.9 + Math.sin(t * 13 + o.x) * 0.05 + Math.sin(t * 7.3) * 0.05;
    glassMat.emissiveIntensity = o.on ? (0.6 + skyState.night * 2.2) * flicker : 0;
    glassMat.color.set(o.on ? '#ffe0a6' : '#7d776c');
  });
  return (
    <group>
      <Cyl rt={0.04} rb={0.05} h={1.5} p={[0, 0.75, 0]} c={WOOD_DARK} />
      <Box s={[0.32, 0.04, 0.04]} p={[0.14, 1.45, 0]} c={WOOD_DARK} />
      <group ref={swing} position={[0.26, 1.43, 0]}>
        <Rod a={[0, 0, 0]} b={[0, -0.1, 0]} c={METAL} rad={0.006} />
        <group position={[0, -0.26, 0]}>
          <Cyl rt={0.07} rb={0.08} h={0.03} p={[0, 0.13, 0]} c={METAL} o={{ metalness: 0.6, roughness: 0.4 }} />
          <mesh material={glassMat}>
            <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
          </mesh>
          <Cyl rt={0.08} h={0.03} p={[0, -0.11, 0]} c={METAL} o={{ metalness: 0.6, roughness: 0.4 }} />
          <mesh position={[0, 0.17, 0]} material={mat(METAL)}>
            <torusGeometry args={[0.04, 0.007, 6, 12, Math.PI]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Hammock({ o }: { o: WorldObject }) {
  const fabric = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.8, 2.6, 6, 18);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const along = z / 1.3;
      const y = 0.95 - 0.42 * (1 - along * along) + (x / 0.4) ** 2 * 0.12 * (1 - along * along);
      p.setXYZ(i, x * (0.45 + 0.55 * (1 - along * along)), y, z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const swing = useRef<THREE.Group>(null);
  useFrame(() => {
    const busy = o.slots[0].occupant !== null;
    const amp = (busy ? 0.1 : 0.03) + world.env.windStrength * 0.05;
    if (swing.current) swing.current.rotation.z = Math.sin(o.swing ?? 0) * amp;
  });
  return (
    <group>
      <group ref={swing} position={[0, 1.0, 0]}>
        <group position={[0, -1.0, 0]}>
          <mesh geometry={fabric} castShadow receiveShadow material={mat('#e07a5a', { side: THREE.DoubleSide })} />
          <mesh geometry={fabric} position={[0, 0.005, 0]} scale={[0.6, 1, 1]} material={mat('#f2d06b', { side: THREE.DoubleSide })} />
        </group>
      </group>
      <Rod a={[0, 0.95, -1.3]} b={[0, 1.55, -1.85]} c="#d8cdb5" rad={0.012} />
      <Rod a={[0, 0.95, 1.3]} b={[0, 1.55, 1.85]} c="#d8cdb5" rad={0.012} />
    </group>
  );
}

function Telescope({ o }: { o: WorldObject }) {
  const tube = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const busy = o.slots[0].occupant !== null;
    const g = tube.current;
    if (!g) return;
    const targetTilt = busy ? 0.95 : 0.7;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -targetTilt, 0.03);
    g.rotation.y = busy ? Math.sin(clock.elapsedTime * 0.2) * 0.3 : THREE.MathUtils.lerp(g.rotation.y, 0, 0.03);
  });
  return (
    <group>
      {[0, 2.09, 4.19].map((a) => (
        <Rod key={a} a={[0, 0.9, 0]} b={[Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32 - 0.05]} c="#5a4636" rad={0.018} shadow />
      ))}
      <group ref={tube} position={[0, 0.95, 0]} rotation={[-0.7, 0, 0]}>
        <Cyl rt={0.07} rb={0.055} h={0.75} r={[Math.PI / 2, 0, 0]} p={[0, 0, 0.12]} c="#3e5f8a" o={{ metalness: 0.4, roughness: 0.4 }} />
        <Cyl rt={0.075} h={0.06} r={[Math.PI / 2, 0, 0]} p={[0, 0, 0.48]} c="#d9b45a" o={{ metalness: 0.7, roughness: 0.3 }} />
        <Cyl rt={0.025} h={0.1} r={[Math.PI / 2, 0, 0]} p={[0, 0, -0.29]} c="#2a2a2a" />
      </group>
    </group>
  );
}

function Blanket() {
  const tex = ginghamTexture();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.1]} receiveShadow material={mat('#ffffff', { map: tex, roughness: 1 })}>
        <planeGeometry args={[2.0, 1.6]} />
      </mesh>
      {/* Picnic basket and mugs */}
      <group position={[0.75, 0, -0.5]} rotation={[0, 0.4, 0]}>
        <Rounded s={[0.4, 0.22, 0.28]} p={[0, 0.11, 0]} c="#b98a4e" radius={0.03} />
        <mesh position={[0, 0.24, 0]} rotation={[0, 0, 0]} material={mat('#8a6238')}>
          <torusGeometry args={[0.14, 0.015, 6, 14, Math.PI]} />
        </mesh>
      </group>
      <Cyl rt={0.04} h={0.08} p={[-0.8, 0.05, -0.45]} c="#e8dcc0" />
      <Cyl rt={0.04} h={0.08} p={[-0.65, 0.05, -0.55]} c="#7fa8c9" />
    </group>
  );
}

const FIND_COLORS: Record<CollectibleKind, string> = { pinecone: '#7a5232', flower: '#e98aa0', mushroom: '#c4553f', stone: '#8f9aa6' };

function Basket({ o }: { o: WorldObject }) {
  const items = useMemo(() => {
    const rng = new Rng(4);
    return Array.from({ length: 12 }, () => [rng.range(-0.12, 0.12), rng.range(0.16, 0.24), rng.range(-0.1, 0.1)] as [number, number, number]);
  }, []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(() => items.map(() => uniqueMat('#7a5232', { roughness: 0.7 })), [items]);
  useFrame(() => {
    const b = o.basket!;
    const list: CollectibleKind[] = [];
    (['pinecone', 'flower', 'mushroom', 'stone'] as CollectibleKind[]).forEach((k) => {
      for (let i = 0; i < Math.min(3, b[k]); i++) list.push(k);
    });
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = i < list.length;
      if (list[i]) mats[i].color.set(FIND_COLORS[list[i]]);
    });
  });
  return (
    <group>
      <Cyl rt={0.24} rb={0.18} h={0.22} p={[0, 0.11, 0]} c="#c49a5e" seg={14} />
      <mesh position={[0, 0.22, 0]} rotation={[0, 0.3, 0]} material={mat('#a57b45')}>
        <torusGeometry args={[0.22, 0.015, 6, 16, Math.PI]} />
      </mesh>
      {items.map((p, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} position={p} material={mats[i]} castShadow>
          <icosahedronGeometry args={[0.05, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Crate() {
  return (
    <group>
      <Rounded s={[0.78, 0.5, 0.58]} p={[0, 0.25, 0]} c="#a87a50" radius={0.025} />
      {[-0.13, 0.13].map((y) => (
        <Box key={y} s={[0.8, 0.05, 0.6]} p={[0, 0.25 + y, 0]} c={WOOD_DARK} />
      ))}
      <Ball rad={0.07} p={[0.15, 0.56, 0.05]} c="#5a7a4a" />
    </group>
  );
}

function BranchSpot({ o }: { o: WorldObject }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = Boolean(o.on);
  });
  return (
    <group ref={ref}>
      <Cyl rt={0.03} rb={0.04} h={0.8} r={[0, 0.3, Math.PI / 2]} p={[0, 0.04, 0]} c="#6a4a33" />
      <Cyl rt={0.025} rb={0.035} h={0.65} r={[0, -0.6, Math.PI / 2]} p={[0.05, 0.08, 0.05]} c="#7a5338" />
      <Cyl rt={0.02} rb={0.03} h={0.55} r={[0, 1.2, Math.PI / 2]} p={[-0.05, 0.06, -0.05]} c="#5e4030" />
      <Ball rad={0.06} scale={[1.2, 0.3, 0.8]} p={[0.25, 0.03, 0.1]} c="#6a8a3a" shadow={false} />
    </group>
  );
}

function Collectible({ o }: { o: WorldObject }) {
  const ref = useRef<THREE.Group>(null);
  const sparkle = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.visible = Boolean(o.on);
    if (sparkle.current) sparkle.current.opacity = (0.15 + skyState.night * 0.4) * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2 + o.x));
  });
  const kind = o.collectible!;
  return (
    <group ref={ref}>
      {kind === 'pinecone' && (
        <group position={[0, 0.06, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, -0.04 + i * 0.04, 0]} material={mat('#7a5232')} castShadow>
              <coneGeometry args={[0.055 - i * 0.012, 0.06, 7]} />
            </mesh>
          ))}
        </group>
      )}
      {kind === 'flower' && (
        <group>
          <Cyl rt={0.008} h={0.2} p={[0, 0.1, 0]} c="#4f7a3a" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Ball key={i} rad={0.03} p={[Math.cos(i * 1.256) * 0.035, 0.21, Math.sin(i * 1.256) * 0.035]} c="#f2a5c0" shadow={false} />
          ))}
          <Ball rad={0.022} p={[0, 0.215, 0]} c="#f6d65a" shadow={false} />
        </group>
      )}
      {kind === 'mushroom' && (
        <group>
          <Cyl rt={0.03} rb={0.04} h={0.12} p={[0, 0.06, 0]} c="#efe6d6" />
          <mesh position={[0, 0.12, 0]} material={mat('#d0483a', { roughness: 0.5 })} castShadow>
            <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <Ball rad={0.014} p={[0.04, 0.19, 0.03]} c="#ffffff" shadow={false} />
          <Ball rad={0.012} p={[-0.03, 0.2, -0.02]} c="#ffffff" shadow={false} />
        </group>
      )}
      {kind === 'stone' && <Ball rad={0.07} scale={[1.2, 0.55, 0.9]} p={[0, 0.035, 0]} c="#8f9aa6" o={{ roughness: 0.35 }} />}
      <sprite position={[0, 0.35, 0]} scale={[0.35, 0.35, 1]}>
        <spriteMaterial ref={sparkle} map={glowTexture()} color="#fff4c2" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

function Bridge() {
  const b = world.def.bridges[0];
  const planks = 14;
  const arch = (t: number) => 0.12 + Math.sin(Math.PI * t) * 0.28;
  return (
    <group>
      {Array.from({ length: planks }, (_, i) => {
        const t = (i + 0.5) / planks;
        const x = (t - 0.5) * b.length;
        const slope = Math.cos(Math.PI * t) * 0.28 * (Math.PI / b.length);
        return <Box key={i} s={[b.length / planks - 0.025, 0.05, b.width]} p={[x, arch(t), 0]} r={[0, 0, Math.atan(slope)]} c={i % 2 ? '#9a7350' : '#a57d58'} />;
      })}
      {[-1, 1].map((s) => (
        <group key={s}>
          {Array.from({ length: 5 }, (_, i) => {
            const t = i / 4;
            const x = (t - 0.5) * b.length;
            return <Cyl key={i} rt={0.035} h={0.5} p={[x, arch(t) + 0.25, s * (b.width / 2 - 0.03)]} c={WOOD_DARK} />;
          })}
          {Array.from({ length: 4 }, (_, i) => {
            const t0 = i / 4;
            const t1 = (i + 1) / 4;
            return (
              <Rod
                key={i}
                a={[(t0 - 0.5) * b.length, arch(t0) + 0.5, s * (b.width / 2 - 0.03)]}
                b={[(t1 - 0.5) * b.length, arch(t1) + 0.5, s * (b.width / 2 - 0.03)]}
                c={WOOD_LIGHT}
                rad={0.025}
                shadow
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** Renders one world object at its position. */
export function ObjectView({ o, version }: { o: WorldObject; version: number }) {
  const group = useRef<THREE.Group>(null);
  const flat = o.kind === 'dock';
  const y = flat ? 0 : o.kind === 'bridge' ? world.def.baseHeight(o.x, o.z) : world.terrain.surfaceHeight(o.x, o.z);
  void version;
  const body = (() => {
    switch (o.kind) {
      case 'campfire':
        return <Campfire o={o} />;
      case 'tent':
        return <Tent o={o} />;
      case 'chair':
        return <Chair o={o} />;
      case 'logBench':
        return <LogBench />;
      case 'bench':
        return <Bench />;
      case 'stool':
        return <Stool />;
      case 'woodpile':
        return <Woodpile o={o} />;
      case 'prepTable':
        return <PrepTable o={o} />;
      case 'tarp':
        return <Tarp />;
      case 'supplyBox':
        return <SupplyBox />;
      case 'fishBucket':
        return <FishBucket o={o} />;
      case 'dock':
        return <Dock />;
      case 'tackle':
        return <Tackle />;
      case 'lantern':
        return <Lantern o={o} />;
      case 'hammock':
        return <Hammock o={o} />;
      case 'telescope':
        return <Telescope o={o} />;
      case 'blanket':
        return <Blanket />;
      case 'basket':
        return <Basket o={o} />;
      case 'crate':
        return <Crate />;
      case 'branchSpot':
        return <BranchSpot o={o} />;
      case 'collectible':
        return <Collectible o={o} />;
      case 'bridge':
        return <Bridge />;
      default:
        return null;
    }
  })();
  return (
    <group ref={group} position={[o.x, y, o.z]} rotation={[0, o.rot, 0]} userData={{ objectId: o.id }}>
      {body}
    </group>
  );
}

/** Point lights for lit lanterns (a fixed pool so shaders never recompile). */
export function LanternLights() {
  const POOL = 3;
  const refs = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(({ clock }) => {
    const lit = world.objects.filter((o) => o.kind === 'lantern' && o.on);
    lit.sort((a, b) => Math.hypot(a.x - focusPoint.x, a.z - focusPoint.z) - Math.hypot(b.x - focusPoint.x, b.z - focusPoint.z));
    for (let i = 0; i < POOL; i++) {
      const l = refs.current[i];
      if (!l) continue;
      const o = lit[i];
      if (!o) {
        l.intensity = 0;
        continue;
      }
      const c = Math.cos(o.rot);
      const s = Math.sin(o.rot);
      l.position.set(o.x + 0.26 * c, world.terrain.surfaceHeight(o.x, o.z) + 1.15, o.z - 0.26 * s);
      const flicker = 0.92 + Math.sin(clock.elapsedTime * 13 + o.x) * 0.05;
      l.intensity = (0.4 + skyState.night * 3.2) * flicker * clamp(1 - world.daylight() * 0.7);
    }
  });
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <pointLight key={i} ref={(l) => (refs.current[i] = l)} color="#ffc27a" distance={9} decay={1.7} intensity={0} />
      ))}
    </>
  );
}
