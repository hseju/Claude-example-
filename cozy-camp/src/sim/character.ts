import type { Appearance, Character, Controller, Needs } from './types';

export const DEFAULT_PLAYER_APPEARANCE: Appearance = {
  skin: '#f1c7a4',
  hair: '#5a3a2a',
  hairStyle: 'bob',
  top: '#e0874f',
  bottom: '#4b5d7a',
  shoes: '#5a4235',
  hat: 'beanie',
  hatColor: '#c94f4f',
  scarf: false,
  scale: 1,
};

export const NPC_APPEARANCE: Record<string, Appearance> = {
  juniper: {
    skin: '#c98e6a',
    hair: '#2d1f1a',
    hairStyle: 'bun',
    top: '#6f9e6b',
    bottom: '#5c4a3d',
    shoes: '#3c3330',
    hat: 'none',
    hatColor: '#e2c25b',
    scarf: true,
    scale: 0.97,
  },
  theo: {
    skin: '#f3d2b8',
    hair: '#c9893f',
    hairStyle: 'curly',
    top: '#4f7fb0',
    bottom: '#7a6550',
    shoes: '#4a3a30',
    hat: 'bucket',
    hatColor: '#d9b46b',
    scarf: false,
    scale: 1.03,
  },
};

export const PERSONALITIES: Record<string, Partial<Record<string, number>>> = {
  juniper: { wakeHour: 5.9, fish: 1.5, stargaze: 1.45, hammock: 1.25, skywatch: 1.2, explore: 1.1, cook: 0.7, gatherWood: 0.8 },
  theo: { wakeHour: 6.7, cook: 1.55, tendFire: 1.45, gatherWood: 1.35, explore: 1.2, marshmallow: 1.25, fish: 0.85, cocoa: 1.1 },
  player: { wakeHour: 7.2 },
};

const START_NEEDS: Record<string, Needs> = {
  player: { energy: 0.78, hunger: 0.58, warmth: 0.62, fun: 0.5, social: 0.6 },
  juniper: { energy: 0.72, hunger: 0.62, warmth: 0.5, fun: 0.42, social: 0.45 },
  theo: { energy: 0.82, hunger: 0.44, warmth: 0.66, fun: 0.55, social: 0.55 },
};

export function createCharacter(opts: {
  id: string;
  name: string;
  controller: Controller;
  x: number;
  z: number;
  tentId: string;
  appearance?: Appearance;
}): Character {
  return {
    id: opts.id,
    name: opts.name,
    controller: opts.controller,
    autopilot: true,
    appearance: opts.appearance ?? NPC_APPEARANCE[opts.id] ?? DEFAULT_PLAYER_APPEARANCE,
    personality: PERSONALITIES[opts.id] ?? {},
    x: opts.x,
    z: opts.z,
    yOffset: 0,
    heading: Math.atan2(-opts.x, -opts.z),
    speed: 0,
    moving: false,
    running: false,
    path: [],
    pathIndex: 0,
    goal: null,
    pinned: false,
    slide: null,
    tentId: opts.tentId,
    thinkAt: 1 + Math.random() * 2,
    anim: 'idle',
    animTime: Math.random() * 10,
    held: null,
    heldState: 0,
    heldMeta: null,
    inSleepingBag: false,
    expression: 'happy',
    lookAt: null,
    lookUp: 0,
    needs: { ...(START_NEEDS[opts.id] ?? START_NEEDS.player) },
    activity: null,
    recent: [],
    status: 'Enjoying the evening',
    bubble: null,
    pendingChoice: null,
    manualUntil: 0,
    pockets: [],
    sheltered: false,
    chatPartner: null,
    nextIdleThought: 5 + Math.random() * 10,
  };
}

export const NEED_LABELS: Record<keyof Needs, { label: string; icon: string }> = {
  energy: { label: 'Energy', icon: '🌙' },
  hunger: { label: 'Fullness', icon: '🍲' },
  warmth: { label: 'Warmth', icon: '🔥' },
  fun: { label: 'Fun', icon: '✨' },
  social: { label: 'Company', icon: '💬' },
};
