import { Canvas, useFrame } from '@react-three/fiber';
import { Shuffle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createCharacter } from '../sim/character';
import type { Appearance, HairStyle, HatStyle } from '../sim/types';
import { useUI } from '../state/store';
import { Avatar } from '../render/Avatar';

const SKINS = ['#fbe0cb', '#f1c7a4', '#e0a983', '#c98e6a', '#a5694a', '#7a4a32'];
const HAIR_COLORS = ['#2d1f1a', '#5a3a2a', '#8a5a34', '#c9893f', '#e3c27a', '#b0473a', '#8f8f97', '#4a5f8f'];
const CLOTHES = ['#e0874f', '#c94f4f', '#d9b44a', '#6f9e6b', '#4f7fb0', '#7b6bb0', '#e6dccb', '#3f4a5a'];
const BOTTOMS = ['#4b5d7a', '#5c4a3d', '#7a6550', '#3f4a3a', '#2f3440', '#a08a6a'];
const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'bob', label: 'Bob' },
  { id: 'short', label: 'Short' },
  { id: 'bun', label: 'Bun' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'curly', label: 'Curly' },
  { id: 'buzz', label: 'Buzz' },
];
const HATS: { id: HatStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'bucket', label: 'Bucket hat' },
  { id: 'cap', label: 'Cap' },
];

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button key={c} role="radio" aria-checked={value === c} aria-label={c} className={`swatch ${value === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function PreviewModel({ appearance }: { appearance: Appearance }) {
  const ch = useMemo(() => {
    const c = createCharacter({ id: 'preview', name: '', controller: 'remote', x: 0, z: 0, tentId: '' });
    c.heading = 0.4;
    c.anim = 'wave';
    return c;
  }, []);
  ch.appearance = appearance;
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    ch.animTime += dt;
    ch.heading = 0.35 + Math.sin(t.current * 0.6) * 0.45;
    ch.anim = t.current % 8 < 2.2 ? 'wave' : 'idle';
  });
  return <Avatar ch={ch} preview />;
}

export function AvatarCreator() {
  const ui = useUI();
  const [name, setName] = useState(ui.prefs.playerName);
  const [a, setA] = useState<Appearance>(ui.prefs.appearance);
  const set = (patch: Partial<Appearance>) => setA((cur) => ({ ...cur, ...patch }));
  const first = !ui.prefs.created;

  const save = () => {
    ui.setPrefs({ appearance: a, playerName: name.trim().slice(0, 16) || 'Robin', created: true });
    ui.setCreatorOpen(false);
  };
  const randomize = () =>
    setA((cur) => ({
      ...cur,
      skin: pick(SKINS),
      hair: pick(HAIR_COLORS),
      hairStyle: pick(HAIR_STYLES).id,
      top: pick(CLOTHES),
      bottom: pick(BOTTOMS),
      hat: pick(HATS).id,
      hatColor: pick(CLOTHES),
      scarf: Math.random() < 0.35,
    }));

  return (
    <div className="modal-backdrop">
      <div className="modal card creator" role="dialog" aria-label="Create your camper">
        <div className="preview">
          <Canvas camera={{ fov: 30, position: [0, 0.95, 3.4] }} dpr={[1, 2]} shadows>
            <color attach="background" args={['#1d2340']} />
            <hemisphereLight args={['#c9d4ff', '#3a2f2a', 1.1]} />
            <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow />
            <pointLight position={[-1.2, 0.6, 1.2]} color="#ffa25a" intensity={3} distance={6} />
            <group position={[0, -0.05, 0]}>
              <PreviewModel appearance={a} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[1.1, 40]} />
                <meshStandardMaterial color="#4c7a39" roughness={1} />
              </mesh>
            </group>
            <CameraAim />
          </Canvas>
          <p className="preview-name">{name || 'Your camper'}</p>
        </div>
        <div className="options">
          <h2>{first ? 'Welcome to Cozy Camp' : 'Your camper'}</h2>
          {first && <p className="hint">Make a little camper of your own. Juniper and Theo already have the fire going.</p>}
          <div className="field">
            <label htmlFor="cname">Name</label>
            <input id="cname" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <span className="label">Skin</span>
            <Swatches label="Skin tone" colors={SKINS} value={a.skin} onChange={(skin) => set({ skin })} />
          </div>
          <div className="field">
            <span className="label">Hair</span>
            <div className="chips">
              {HAIR_STYLES.map((h) => (
                <button key={h.id} className={`chip small ${a.hairStyle === h.id ? 'on' : ''}`} onClick={() => set({ hairStyle: h.id })}>
                  {h.label}
                </button>
              ))}
            </div>
            <Swatches label="Hair colour" colors={HAIR_COLORS} value={a.hair} onChange={(hair) => set({ hair })} />
          </div>
          <div className="field">
            <span className="label">Jacket</span>
            <Swatches label="Jacket colour" colors={CLOTHES} value={a.top} onChange={(top) => set({ top })} />
            <span className="label">Trousers</span>
            <Swatches label="Trousers colour" colors={BOTTOMS} value={a.bottom} onChange={(bottom) => set({ bottom })} />
          </div>
          <div className="field">
            <span className="label">Hat</span>
            <div className="chips">
              {HATS.map((h) => (
                <button key={h.id} className={`chip small ${a.hat === h.id ? 'on' : ''}`} onClick={() => set({ hat: h.id })}>
                  {h.label}
                </button>
              ))}
            </div>
            {a.hat !== 'none' && <Swatches label="Hat colour" colors={CLOTHES} value={a.hatColor} onChange={(hatColor) => set({ hatColor })} />}
            <label className="toggle">
              <input type="checkbox" checked={a.scarf} onChange={(e) => set({ scarf: e.target.checked })} />
              <span>Cosy scarf</span>
            </label>
          </div>
          <div className="row end">
            <button className="chip" onClick={randomize}>
              <Shuffle size={15} /> Surprise me
            </button>
            {!first && (
              <button className="chip" onClick={() => ui.setCreatorOpen(false)}>
                Cancel
              </button>
            )}
            <button className="chip primary" onClick={save}>
              {first ? 'Start camping' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CameraAim() {
  useFrame(({ camera }) => camera.lookAt(new THREE.Vector3(0, 0.6, 0)));
  return null;
}
