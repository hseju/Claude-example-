import { localToWorld, type V2 } from './math';
import type { ObjectSpec } from './environments/types';
import type { CollectibleKind, Collider, ObjectKind, Slot, SlotKind, WorldObject } from './types';

interface KindInfo {
  name: string;
  movable: boolean;
  collider: Collider | null;
  slots: () => Slot[];
}

const slot = (
  id: string,
  kind: SlotKind,
  x: number,
  z: number,
  rot: number,
  approach: { x: number; z: number },
  y = 0,
): Slot => ({ id, kind, local: { x, z, rot, y }, approach, occupant: null });

const seat = (id: string, x: number, y: number, depth = 0.62) => slot(id, 'sit', x, 0, 0, { x, z: depth }, y);

export const KINDS: Record<ObjectKind, KindInfo> = {
  campfire: {
    name: 'Campfire',
    movable: false,
    collider: { type: 'circle', r: 0.72 },
    slots: () => [
      slot('cook', 'cook', 0, 1.2, Math.PI, { x: 0, z: 1.3 }),
      slot('tend', 'use', 0.95, 0.8, Math.atan2(-0.95, -0.8), { x: 1.05, z: 0.9 }),
    ],
  },
  chair: { name: 'Camp chair', movable: true, collider: { type: 'circle', r: 0.3 }, slots: () => [seat('seat', 0, 0.3)] },
  stool: { name: 'Log stool', movable: true, collider: { type: 'circle', r: 0.25 }, slots: () => [seat('seat', 0, 0.3, 0.55)] },
  logBench: {
    name: 'Log bench',
    movable: true,
    collider: { type: 'box', hw: 0.8, hd: 0.2 },
    slots: () => [seat('left', -0.4, 0.3), seat('right', 0.4, 0.3)],
  },
  bench: {
    name: 'Bench',
    movable: true,
    collider: { type: 'box', hw: 0.8, hd: 0.24 },
    slots: () => [seat('left', -0.4, 0.36, 0.66), seat('right', 0.4, 0.36, 0.66)],
  },
  woodpile: {
    name: 'Woodpile',
    movable: true,
    collider: { type: 'box', hw: 0.6, hd: 0.32 },
    slots: () => [slot('use', 'use', 0, 0.75, Math.PI, { x: 0, z: 0.8 })],
  },
  prepTable: {
    name: 'Cooking table',
    movable: false,
    collider: { type: 'box', hw: 0.72, hd: 0.36 },
    slots: () => [slot('cook', 'cook', 0, 0.72, Math.PI, { x: 0, z: 0.8 })],
  },
  tarp: {
    name: 'Tarp shelter',
    movable: false,
    collider: null,
    slots: () => [
      slot('s1', 'shelter', -1.2, 0.55, 0.4, { x: -1.2, z: 0.55 }),
      slot('s2', 'shelter', 1.2, 0.55, -0.4, { x: 1.2, z: 0.55 }),
      slot('s3', 'shelter', 1.15, -0.8, -2.2, { x: 1.15, z: -0.8 }),
    ],
  },
  supplyBox: {
    name: 'Food supplies',
    movable: true,
    collider: { type: 'box', hw: 0.42, hd: 0.28 },
    slots: () => [slot('use', 'use', 0, 0.62, Math.PI, { x: 0, z: 0.68 })],
  },
  fishBucket: {
    name: 'Fish bucket',
    movable: false,
    collider: null,
    slots: () => [slot('use', 'use', 0, -0.48, 0, { x: 0, z: -0.48 })],
  },
  dock: {
    name: 'Fishing dock',
    movable: false,
    collider: null,
    slots: () => [
      slot('fish1', 'fish', 1.85, -0.3, Math.PI / 2, { x: 1.85, z: -0.3 }),
      slot('fish2', 'fish', 1.85, 0.32, Math.PI / 2, { x: 1.85, z: 0.32 }),
    ],
  },
  lantern: {
    name: 'Lantern',
    movable: true,
    collider: { type: 'circle', r: 0.14 },
    slots: () => [slot('use', 'use', 0, 0.5, Math.PI, { x: 0, z: 0.55 })],
  },
  hammock: {
    name: 'Hammock',
    movable: false,
    collider: { type: 'box', hw: 0.32, hd: 1.25 },
    slots: () => [slot('lie', 'lie', 0, 0.1, 0, { x: 0.85, z: 0.1 }, 0.52)],
  },
  telescope: {
    name: 'Telescope',
    movable: true,
    collider: { type: 'circle', r: 0.3 },
    slots: () => [slot('use', 'use', 0, -0.55, 0, { x: 0, z: -0.68 })],
  },
  blanket: {
    name: 'Picnic blanket',
    movable: true,
    collider: null,
    slots: () => [
      slot('left', 'sit', -0.42, 0.05, 0, { x: -0.42, z: 1.05 }, 0.03),
      slot('right', 'sit', 0.42, 0.05, 0, { x: 0.42, z: 1.05 }, 0.03),
    ],
  },
  basket: {
    name: 'Nature basket',
    movable: true,
    collider: { type: 'circle', r: 0.24 },
    slots: () => [slot('use', 'use', 0, 0.58, Math.PI, { x: 0, z: 0.62 })],
  },
  crate: {
    name: 'Storage crate',
    movable: true,
    collider: { type: 'box', hw: 0.4, hd: 0.3 },
    slots: () => [slot('use', 'use', 0, 0.65, Math.PI, { x: 0, z: 0.7 })],
  },
  tent: {
    name: 'Tent',
    movable: true,
    collider: { type: 'box', hw: 1.15, hd: 1.3 },
    slots: () => [],
  },
  branchSpot: {
    name: 'Fallen branches',
    movable: false,
    collider: null,
    slots: () => [slot('use', 'use', 0, 0.5, Math.PI, { x: 0, z: 0.5 })],
  },
  collectible: {
    name: 'Nature find',
    movable: false,
    collider: null,
    slots: () => [slot('use', 'use', 0, 0.45, Math.PI, { x: 0, z: 0.45 })],
  },
  bridge: { name: 'Footbridge', movable: false, collider: null, slots: () => [] },
  tackle: {
    name: 'Tackle box',
    movable: false,
    collider: { type: 'box', hw: 0.3, hd: 0.2 },
    slots: () => [slot('use', 'use', 0, 0.55, Math.PI, { x: 0, z: 0.6 })],
  },
};

export const TENT_SIZES = {
  big: { w: 2.3, d: 2.6, h: 1.75, sleepers: [-0.46, 0.46] },
  small: { w: 1.65, d: 2.1, h: 1.35, sleepers: [0] },
};

export function tentSize(o: WorldObject) {
  return o.id === 'tent-sprout' || o.name.toLowerCase().includes('sprout') ? TENT_SIZES.small : TENT_SIZES.big;
}

const COLLECTIBLE_NAMES: Record<CollectibleKind, string> = {
  pinecone: 'Pinecone',
  flower: 'Wildflower',
  mushroom: 'Mushroom',
  stone: 'Smooth stone',
};

let counter = 0;
export function newObjectId(kind: ObjectKind): string {
  counter++;
  return `${kind}-${Date.now().toString(36)}-${counter}`;
}

export function createObject(spec: ObjectSpec): WorldObject {
  const info = KINDS[spec.kind];
  const init = spec.init ?? {};
  const o: WorldObject = {
    id: spec.id ?? newObjectId(spec.kind),
    kind: spec.kind,
    name: spec.name ?? info.name,
    x: spec.x,
    z: spec.z,
    rot: spec.rot ?? 0,
    movable: info.movable,
    custom: Boolean(init.custom),
    slots: info.slots(),
    collider: info.collider ? { ...info.collider } : null,
  };
  switch (spec.kind) {
    case 'campfire':
      o.fire = {
        fuel: Number(init.fuel ?? 0.8),
        lit: Boolean(init.lit ?? true),
        logs: 3,
        ember: 0,
        intensity: init.lit === false ? 0 : 0.8,
        pan: null,
        kettleHeat: 0.6,
      };
      break;
    case 'tent': {
      o.tent = {
        pitch: Number(init.pitch ?? 1),
        flap: 0,
        flapTarget: 0,
        color: String(init.color ?? '#d9c49a'),
        label: String(init.label ?? o.name),
        lightOn: false,
      };
      const size = tentSize(o);
      o.collider = { type: 'box', hw: size.w / 2, hd: size.d / 2 };
      // Entrance faces local +Z. Sleepers lie with their heads toward the back wall.
      o.slots = [
        slot('door', 'stand', 0, size.d / 2 + 0.45, Math.PI, { x: 0, z: size.d / 2 + 0.55 }),
        ...size.sleepers.map((sx, i) => slot(`bed${i + 1}`, 'sleep', sx, -0.15, 0, { x: 0, z: size.d / 2 + 0.55 }, 0.04)),
      ];
      break;
    }
    case 'woodpile':
    case 'fishBucket':
      o.count = Number(init.count ?? 0);
      break;
    case 'lantern':
      o.on = Boolean(init.on ?? true);
      break;
    case 'branchSpot':
      o.on = true;
      break;
    case 'collectible':
      o.on = true;
      o.collectible = (init.collectible as CollectibleKind) ?? 'pinecone';
      o.name = COLLECTIBLE_NAMES[o.collectible];
      break;
    case 'prepTable':
      o.prep = { food: null, progress: 0, plates: 0, plateFood: 'stew' };
      break;
    case 'basket':
      o.basket = { pinecone: 0, flower: 0, mushroom: 0, stone: 0 };
      break;
    case 'hammock':
      o.swing = 0;
      break;
    case 'chair':
      o.color = String(init.color ?? '#c0583c');
      break;
  }
  return o;
}

export function slotPose(o: WorldObject, s: Slot): { x: number; z: number; rot: number; y: number } {
  const p = localToWorld(o, o.rot, s.local);
  return { x: p.x, z: p.z, rot: o.rot + s.local.rot, y: s.local.y ?? 0 };
}

export function slotApproach(o: WorldObject, s: Slot): V2 {
  return localToWorld(o, o.rot, s.approach);
}

export const SEAT_KINDS: ObjectKind[] = ['chair', 'stool', 'logBench', 'bench'];

/** Items the player can add in build mode. */
export const BUILD_CATALOG: { kind: ObjectKind; label: string; init?: Record<string, unknown> }[] = [
  { kind: 'chair', label: 'Red chair', init: { color: '#c0583c' } },
  { kind: 'chair', label: 'Blue chair', init: { color: '#3c7fa8' } },
  { kind: 'chair', label: 'Mustard chair', init: { color: '#d39a3a' } },
  { kind: 'stool', label: 'Log stool' },
  { kind: 'bench', label: 'Bench' },
  { kind: 'lantern', label: 'Lantern', init: { on: true } },
  { kind: 'crate', label: 'Crate' },
  { kind: 'blanket', label: 'Blanket' },
];
