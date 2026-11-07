import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp, lerp } from '../sim/math';
import { tentSize } from '../sim/objects';
import type { WorldObject } from '../sim/types';
import { mat, uniqueMat } from './materials';
import { Ball, Box, Cap, Cyl, Merged, Rod } from './parts';

function easeOutBack(t: number) {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function triangle(a: [number, number], b: [number, number], c: [number, number]) {
  const s = new THREE.Shape();
  s.moveTo(...a);
  s.lineTo(...b);
  s.lineTo(...c);
  s.lineTo(...a);
  return new THREE.ShapeGeometry(s);
}

const BAG_COLORS = ['#c65a4a', '#4a7fb0', '#d9a441'];

/** Canvas A-frame tent: pitch animation, opening flaps, glowing when a lantern is lit inside. */
export function Tent({ o }: { o: WorldObject }) {
  const ts = o.tent!;
  const { w, d, h } = tentSize(o);
  const halfW = w / 2;
  const slant = Math.hypot(halfW, h);
  const angle = Math.atan2(h, halfW);

  const fabric = useMemo(
    () => uniqueMat(ts.color, { roughness: 0.92, side: THREE.DoubleSide, emissive: '#ffb45a', emissiveIntensity: 0 }),
    [ts.color],
  );
  const trim = useMemo(() => new THREE.Color(ts.color).multiplyScalar(0.72).getStyle(), [ts.color]);
  const back = useMemo(() => triangle([-halfW, 0], [halfW, 0], [0, h]), [halfW, h]);
  const flapL = useMemo(() => triangle([0, 0], [halfW, 0], [halfW, h]), [halfW, h]);
  const flapR = useMemo(() => triangle([0, 0], [-halfW, 0], [-halfW, h]), [halfW, h]);

  const body = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const leftFlap = useRef<THREE.Group>(null);
  const rightFlap = useRef<THREE.Group>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  const glowLevel = useRef(0);

  useFrame((_, dt) => {
    const p = ts.pitch;
    const b = body.current;
    if (b) {
      b.visible = p > 0.02;
      const up = easeOutBack(clamp(p * 1.1 - 0.1));
      const spread = clamp(p * 2.5);
      b.scale.set(lerp(0.25, 1, spread), Math.max(0.02, up), lerp(0.4, 1, spread));
    }
    if (bag.current) {
      const s = clamp(1 - p * 3);
      bag.current.visible = s > 0.02;
      bag.current.scale.setScalar(Math.max(0.01, s));
    }
    const open = ts.flap;
    const k = 1 - open * 0.82;
    leftFlap.current?.scale.set(k, k, 1);
    rightFlap.current?.scale.set(k, k, 1);
    glowLevel.current = lerp(glowLevel.current, ts.lightOn ? 1 : 0, Math.min(1, dt * 2));
    fabric.emissiveIntensity = glowLevel.current * 0.75;
    if (glowLight.current) glowLight.current.intensity = glowLevel.current * 2.2;
  });

  return (
    <group>
      {/* Packed tent bag */}
      <group ref={bag} position={[0, 0.16, 0.2]}>
        <Cyl rt={0.16} h={0.75} r={[0, 0, Math.PI / 2]} c={ts.color} />
        <Cyl rt={0.165} h={0.04} r={[0, 0, Math.PI / 2]} p={[-0.2, 0, 0]} c="#5a4636" />
        <Cyl rt={0.165} h={0.04} r={[0, 0, Math.PI / 2]} p={[0.2, 0, 0]} c="#5a4636" />
        <Cyl rt={0.02} h={0.9} r={[0, 0, Math.PI / 2]} p={[0, 0.02, -0.3]} c="#8a8a8a" />
        <Cyl rt={0.02} h={0.9} r={[0, 0, Math.PI / 2]} p={[0, 0.02, -0.38]} c="#8a8a8a" />
      </group>

      <group ref={body}>
        {/* Ground sheet and sleeping bags */}
        <Merged>
          <Box s={[w - 0.05, 0.02, d - 0.05]} p={[0, 0.01, 0]} c="#4a4a44" shadow={false} />
          {tentSize(o).sleepers.map((sx, i) => (
            <group key={i} position={[sx, 0.06, -0.15]}>
              <Cap rad={0.16} len={0.95} r={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.45]} c={BAG_COLORS[(i + (o.id.length % 3)) % 3]} />
              <Box s={[0.3, 0.08, 0.18]} p={[0, 0.03, -0.62]} c="#efe8dc" />
            </group>
          ))}
          {/* Roof panels */}
          <mesh position={[halfW / 2, h / 2, 0]} rotation={[0, 0, -angle]} material={fabric} castShadow receiveShadow>
            <boxGeometry args={[slant, 0.025, d]} />
          </mesh>
          <mesh position={[-halfW / 2, h / 2, 0]} rotation={[0, 0, angle]} material={fabric} castShadow receiveShadow>
            <boxGeometry args={[slant, 0.025, d]} />
          </mesh>
          {/* Trim along the ridge and eaves */}
          <Box s={[0.07, 0.07, d + 0.06]} p={[0, h, 0]} c={trim} />
          <Box s={[0.05, 0.04, d]} p={[halfW, 0.02, 0]} c={trim} />
          <Box s={[0.05, 0.04, d]} p={[-halfW, 0.02, 0]} c={trim} />
          {/* Back wall */}
          <mesh geometry={back} position={[0, 0, -d / 2]} material={fabric} castShadow />
        </Merged>
        {/* Door flaps (shrink toward the corners when opened) */}
        <group ref={leftFlap} position={[-halfW, 0, d / 2]}>
          <mesh geometry={flapL} material={fabric} castShadow />
        </group>
        <group ref={rightFlap} position={[halfW, 0, d / 2]}>
          <mesh geometry={flapR} material={fabric} castShadow />
        </group>
        {/* Poles, ropes and pegs */}
        <Merged>
          <Cyl rt={0.025} h={h + 0.15} p={[0, (h + 0.15) / 2, d / 2 + 0.03]} c="#6a5038" />
          <Cyl rt={0.025} h={h + 0.15} p={[0, (h + 0.15) / 2, -d / 2 - 0.03]} c="#6a5038" />
          <Ball rad={0.04} p={[0, h + 0.17, d / 2 + 0.03]} c="#d9a441" />
          <Rod a={[0, h + 0.1, d / 2 + 0.03]} b={[0, 0.02, d / 2 + 0.75]} c="#d8cdb5" rad={0.008} />
          <Rod a={[0, h + 0.1, -d / 2 - 0.03]} b={[0, 0.02, -d / 2 - 0.75]} c="#d8cdb5" rad={0.008} />
          <Rod a={[halfW, 0.05, d / 2]} b={[halfW + 0.35, 0.0, d / 2 + 0.25]} c="#d8cdb5" rad={0.008} />
          <Rod a={[-halfW, 0.05, d / 2]} b={[-halfW - 0.35, 0.0, d / 2 + 0.25]} c="#d8cdb5" rad={0.008} />
          <Rod a={[halfW, 0.05, -d / 2]} b={[halfW + 0.35, 0.0, -d / 2 - 0.25]} c="#d8cdb5" rad={0.008} />
          <Rod a={[-halfW, 0.05, -d / 2]} b={[-halfW - 0.35, 0.0, -d / 2 - 0.25]} c="#d8cdb5" rad={0.008} />
        </Merged>
        {/* Little lantern hanging inside */}
        <group position={[0, h - 0.35, -0.2]}>
          <Cyl rt={0.05} h={0.1} c="#3a3a3a" o={{ metalness: 0.5 }} shadow={false} />
          <mesh position={[0, -0.09, 0]} material={mat('#ffd59a', { emissive: '#ffb45a', emissiveIntensity: 0.6 })}>
            <sphereGeometry args={[0.05, 10, 8]} />
          </mesh>
          <pointLight ref={glowLight} color="#ffb45a" distance={4} decay={2} intensity={0} />
        </group>
      </group>
    </group>
  );
}
