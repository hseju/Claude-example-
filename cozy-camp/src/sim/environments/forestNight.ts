import { fbm2, headingTo, noise2, smoothstep } from '../math';
import type { EnvironmentDefinition } from './types';

const FIRE = { x: 0, z: 0 };
const faceFire = (x: number, z: number) => headingTo({ x, z }, FIRE);

/**
 * Magical Forest at Night: the first playable world. A compact campsite with a
 * fire ring, two canvas tents, a lake with a dock, a stream with a footbridge,
 * forest trails and a relaxation meadow.
 */
export const forestNight: EnvironmentDefinition = {
  id: 'forest-night',
  name: 'Magical Forest',
  tagline: 'A quiet campsite under the stars',
  status: 'playable',
  seed: 20261107,
  bounds: 24,
  walkRadius: 20.5,
  defaults: { time: 21.0, season: 'summer', weather: 'clear' },
  allowedWeather: ['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'],
  waterLevel: -0.18,
  lake: { cx: 13, cz: -1, rx: 6.5, rz: 5.5 },
  streams: [
    [
      { x: -2, z: -27 },
      { x: 0, z: -20 },
      { x: 4, z: -15 },
      { x: 6, z: -11 },
      { x: 9, z: -7.5 },
      { x: 11.2, z: -5.2 },
    ],
  ],
  trails: [
    // Meadow loop through the western woods to the footbridge.
    [
      { x: 0.6, z: 2.6 },
      { x: -1.6, z: 4.7 },
      { x: -4.2, z: 6.9 },
      { x: -8.0, z: 8.2 },
      { x: -12.0, z: 5.6 },
      { x: -13.4, z: 0.2 },
      { x: -12.6, z: -5.4 },
      { x: -8.6, z: -9.6 },
      { x: -4.0, z: -11.4 },
      { x: 0.5, z: -11.1 },
      { x: 4.07, z: -11.28 },
      { x: 6.93, z: -12.72 },
      { x: 9.4, z: -11.6 },
      { x: 10.6, z: -9.9 },
    ],
    // Camp to the footbridge.
    [
      { x: 0.3, z: -3.0 },
      { x: 1.0, z: -6.5 },
      { x: 2.2, z: -9.0 },
      { x: 3.2, z: -10.6 },
      { x: 4.07, z: -11.28 },
    ],
    // Camp to the dock.
    [
      { x: 1.2, z: 2.2 },
      { x: 3.6, z: 2.1 },
      { x: 5.9, z: 1.2 },
    ],
    // Tent spurs.
    [
      { x: -1.6, z: -1.4 },
      { x: -3.9, z: -2.0 },
    ],
    [
      { x: -0.4, z: -2.6 },
      { x: -1.0, z: -5.0 },
    ],
  ],
  bridges: [{ x: 5.5, z: -12, rot: 0.4636, length: 3.4, width: 1.2 }],
  dock: { x0: 5.9, x1: 10.3, z: 1.2, width: 1.3 },
  objects: [
    { kind: 'campfire', id: 'campfire', x: 0, z: 0, name: 'Campfire', init: { fuel: 0.9, lit: true } },
    { kind: 'chair', id: 'chair-a', x: -2.2, z: 0.85, rot: faceFire(-2.2, 0.85), init: { color: '#c0583c' } },
    { kind: 'chair', id: 'chair-b', x: 2.2, z: 0.9, rot: faceFire(2.2, 0.9), init: { color: '#3c7fa8' } },
    { kind: 'chair', id: 'chair-c', x: -1.5, z: -1.95, rot: faceFire(-1.5, -1.95), init: { color: '#d39a3a' } },
    { kind: 'logBench', id: 'log-bench', x: 1.35, z: -2.05, rot: faceFire(1.35, -2.05) },
    { kind: 'prepTable', id: 'prep-table', x: 4.0, z: -1.7, rot: 0, name: 'Cooking table' },
    { kind: 'tarp', id: 'tarp', x: 4.0, z: -1.8, rot: 0, name: 'Tarp shelter' },
    { kind: 'supplyBox', id: 'supplies', x: 2.75, z: -3.25, rot: 0.3, name: 'Food supplies' },
    { kind: 'woodpile', id: 'woodpile', x: -3.4, z: 2.6, rot: 0.4, name: 'Woodpile', init: { count: 4 } },
    {
      kind: 'tent',
      id: 'tent-meadow',
      x: -5.6,
      z: -3.0,
      rot: faceFire(-5.6, -3.0),
      name: 'Meadow tent',
      init: { pitch: 1, color: '#d9c49a', label: 'Meadow tent' },
    },
    {
      kind: 'tent',
      id: 'tent-sprout',
      x: -1.3,
      z: -6.3,
      rot: faceFire(-1.3, -6.3),
      name: 'Sprout tent',
      init: { pitch: 0, color: '#9bb37a', label: 'Sprout tent' },
    },
    { kind: 'basket', id: 'basket', x: -3.0, z: -3.6, rot: 0.6, name: 'Nature basket' },
    { kind: 'crate', id: 'crate', x: -4.3, z: -0.35, rot: 0.2, name: 'Storage crate' },
    { kind: 'lantern', id: 'lantern-camp', x: -3.6, z: -1.0, name: 'Camp lantern', init: { on: true } },
    { kind: 'lantern', id: 'lantern-dock', x: 6.2, z: 2.25, name: 'Dock lantern', init: { on: true } },
    { kind: 'lantern', id: 'lantern-meadow', x: -6.3, z: 4.3, name: 'Meadow lantern', init: { on: true } },
    { kind: 'dock', id: 'dock', x: 8.1, z: 1.2, name: 'Fishing dock' },
    { kind: 'fishBucket', id: 'fish-bucket', x: 8.9, z: 1.68, name: 'Fish bucket', init: { count: 1 } },
    { kind: 'tackle', id: 'tackle', x: 6.5, z: 0.15, rot: 0.4, name: 'Tackle box' },
    { kind: 'hammock', id: 'hammock', x: -9.6, z: 3.7, rot: 0, name: 'Hammock' },
    { kind: 'blanket', id: 'blanket', x: -5.3, z: 6.3, rot: 0.25, name: 'Picnic blanket' },
    { kind: 'telescope', id: 'telescope', x: -2.4, z: 8.3, rot: 0, name: 'Telescope' },
    { kind: 'bench', id: 'bench', x: -7.6, z: 8.7, rot: 0.15, name: 'Meadow bench' },
    { kind: 'bridge', id: 'bridge', x: 5.5, z: -12, rot: 0.4636, name: 'Footbridge' },
  ],
  clearings: [
    { x: 0, z: -1.5, r: 8.6 },
    { x: -6, z: 6.2, r: 5.0 },
    { x: 4.8, z: 1.2, r: 3.2 },
    { x: 10.6, z: -9.9, r: 2.2 },
    { x: -1.3, z: -6.3, r: 2.6 },
  ],
  fixedTrees: [
    { x: -9.6, z: 1.75, kind: 'round', scale: 1.1 },
    { x: -9.6, z: 5.65, kind: 'round', scale: 1.05 },
    { x: -15.2, z: -1.6, kind: 'tallPine', scale: 1.55 },
    { x: -7.7, z: -5.8, kind: 'pine', scale: 1.15 },
  ],
  treeCount: 270,
  viewpoints: [
    { x: 10.6, z: -9.9, label: 'Lake overlook', look: { x: 13, z: -1 } },
    { x: 5.5, z: -12, label: 'Footbridge', look: { x: 7.5, z: -9 } },
    { x: -13.3, z: -1.0, label: 'Old pine', look: { x: -15.2, z: -1.6 } },
    { x: -10.4, z: -8.4, label: 'Glowing grove', look: { x: -11.5, z: -8.8 } },
    { x: -4.6, z: 7.6, label: 'Meadow', look: { x: -2, z: 12 } },
  ],
  branchSpots: [
    { x: -11.0, z: 3.6 },
    { x: -12.6, z: -3.0 },
    { x: -9.6, z: -9.0 },
    { x: -5.4, z: -10.4 },
    { x: -1.4, z: -10.0 },
    { x: 2.4, z: -7.8 },
    { x: -8.6, z: 9.4 },
    { x: -14.0, z: 1.6 },
  ],
  collectibleSpots: [
    { x: -12.4, z: -1.6, kind: 'pinecone' },
    { x: -6.4, z: -11.6, kind: 'pinecone' },
    { x: -10.9, z: -7.6, kind: 'mushroom' },
    { x: -11.8, z: -9.3, kind: 'mushroom' },
    { x: -6.9, z: 5.1, kind: 'flower' },
    { x: -3.3, z: 5.8, kind: 'flower' },
    { x: -7.9, z: 7.1, kind: 'flower' },
    { x: 2.8, z: -13.2, kind: 'stone' },
    { x: 6.4, z: -3.9, kind: 'stone' },
  ],
  glowMushrooms: [
    { x: -10.6, z: -8.6 },
    { x: -11.3, z: -8.1 },
    { x: -12.2, z: -7.3 },
    { x: -9.1, z: -10.1 },
    { x: -11.9, z: -9.9 },
    { x: -13.9, z: 2.3 },
    { x: -14.4, z: -0.6 },
    { x: 2.9, z: -10.4 },
    { x: -6.8, z: -10.9 },
    { x: -8.9, z: 10.0 },
  ],
  wildlife: {
    fish: 8,
    rabbits: [
      { x: -7.0, z: 3.0 },
      { x: -11.0, z: -4.0 },
      { x: 3.0, z: 6.0 },
    ],
    deer: [{ x: -14.0, z: -7.5 }],
    owl: { x: -7.7, z: -5.8 },
    squirrels: [{ x: -13.0, z: 2.0 }],
  },
  characters: [
    { id: 'player', name: 'Robin', x: 0.9, z: 3.1, tent: 'tent-sprout' },
    { id: 'juniper', name: 'Juniper', x: -2.0, z: 1.8, tent: 'tent-meadow' },
    { id: 'theo', name: 'Theo', x: 2.4, z: 2.2, tent: 'tent-meadow' },
  ],
  palette: {
    spring: {
      grass: '#5f8f45',
      grassDry: '#7a9b52',
      dirt: '#8c6c4b',
      foliage: ['#6aa34f', '#7fb35a', '#e3a6c0'],
      pine: '#35633f',
      bush: '#4f8443',
      flowers: ['#f6e27a', '#f2a5c0', '#c6b5f5'],
    },
    summer: {
      grass: '#4c7a39',
      grassDry: '#6b8a45',
      dirt: '#8a6a48',
      foliage: ['#3f7a3a', '#4b8a3e', '#5a9147'],
      pine: '#2d573a',
      bush: '#3d6e3a',
      flowers: ['#f2d16b', '#e98aa0', '#b9a6f0'],
    },
    autumn: {
      grass: '#7b7a3f',
      grassDry: '#94803f',
      dirt: '#8a6545',
      foliage: ['#d9772e', '#e3a63a', '#b8462e', '#c98a2e'],
      pine: '#2f5236',
      bush: '#9a6a30',
      flowers: ['#e3a63a', '#c95a3a', '#d9c06b'],
    },
    winter: {
      grass: '#8f9c92',
      grassDry: '#a3aca3',
      dirt: '#7d6a5a',
      foliage: ['#7a6a58', '#6f604f', '#85745f'],
      pine: '#2c4b3a',
      bush: '#5d6b5c',
      flowers: ['#dfe7ef', '#c9d6e3', '#e9eef2'],
    },
  },
  baseHeight(x: number, z: number): number {
    const r = Math.hypot(x, z);
    let h = fbm2(x * 0.08 + 3.1, z * 0.08 - 1.7) * 0.42 + noise2(x * 0.32 + 7, z * 0.32 - 3) * 0.05;
    // Keep the campsite and meadow nearly flat.
    const flat = Math.min(smoothstep(5, 11, Math.hypot(x, z + 1)), smoothstep(3, 7, Math.hypot(x + 6, z - 6.2)));
    h *= 0.25 + 0.75 * flat;
    // A rim of low hills turns the world into a miniature diorama.
    h += smoothstep(19, 31, r) * 3.6 * (0.75 + 0.25 * noise2(x * 0.18, z * 0.18));
    return h;
  },
};
