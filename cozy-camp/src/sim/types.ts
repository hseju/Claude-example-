import type { V2 } from './math';

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export type HairStyle = 'short' | 'bob' | 'bun' | 'ponytail' | 'curly' | 'buzz';
export type HatStyle = 'none' | 'beanie' | 'bucket' | 'cap';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  shoes: string;
  hat: HatStyle;
  hatColor: string;
  scarf: boolean;
  /** 0.9 – 1.1, small height variation */
  scale: number;
}

/** Who drives a character. `remote` is reserved for multiplayer users. */
export type Controller = 'player' | 'ai' | 'remote';

export interface Needs {
  energy: number;
  hunger: number;
  warmth: number;
  fun: number;
  social: number;
}

export type NeedKey = keyof Needs;

export type AnimName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sitEat'
  | 'sitDrink'
  | 'sitRoast'
  | 'sitChat'
  | 'lie'
  | 'sleep'
  | 'crouch'
  | 'pickup'
  | 'chop'
  | 'stir'
  | 'pour'
  | 'cast'
  | 'fishIdle'
  | 'reel'
  | 'showOff'
  | 'hammer'
  | 'strike'
  | 'toss'
  | 'telescope'
  | 'look'
  | 'wave'
  | 'talk'
  | 'stretch'
  | 'hammock'
  | 'shiver'
  | 'eatStand';

export type HeldItem =
  | 'rod'
  | 'log'
  | 'branch'
  | 'pan'
  | 'bowl'
  | 'mug'
  | 'fish'
  | 'stick'
  | 'match'
  | 'mallet'
  | 'pinecone'
  | 'flower'
  | 'mushroom'
  | 'stone'
  | 'knife'
  | 'lantern';

export type CollectibleKind = 'pinecone' | 'flower' | 'mushroom' | 'stone';

export interface Bubble {
  icon: string;
  text?: string;
  until: number;
}

export interface PendingChoice {
  prompt: string;
  options: { id: string; label: string }[];
  picked: string | null;
}

export interface Character {
  id: string;
  name: string;
  controller: Controller;
  /** Player-owned avatars may run on autopilot when not directed. */
  autopilot: boolean;
  appearance: Appearance;
  personality: Partial<Record<string, number>>;

  x: number;
  z: number;
  /** Extra vertical offset (sitting on a chair, lying in a hammock). */
  yOffset: number;
  heading: number;
  speed: number;
  moving: boolean;
  running: boolean;
  path: V2[];
  pathIndex: number;
  /** Final destination of the current path, if any. */
  goal: V2 | null;
  /** When set, locomotion is suspended and the activity positions the character directly. */
  pinned: boolean;
  /** Short scripted move that ignores navigation (stepping out of a chair or tent). */
  slide: { fx: number; fz: number; fy: number; tx: number; tz: number; t: number; dur: number } | null;
  /** The tent this camper sleeps in. */
  tentId: string;
  /** Sim time of the next AI decision. */
  thinkAt: number;

  anim: AnimName;
  animTime: number;
  held: HeldItem | null;
  /** Visual state of what is held, e.g. marshmallow toast level or food doneness. */
  heldState: number;
  /** Extra info for the held item: food kind, fish colour, collectible kind. */
  heldMeta: string | null;
  inSleepingBag: boolean;
  expression: 'happy' | 'neutral' | 'sleepy' | 'talk' | 'surprised' | 'cold';
  lookAt: V2 | null;
  lookUp: number;

  needs: Needs;
  activity: ActivityRun | null;
  /** Ids of recently finished activities, newest first. */
  recent: string[];
  /** Short line describing what the camper is doing right now. */
  status: string;
  bubble: Bubble | null;
  pendingChoice: PendingChoice | null;
  /** Sim time until which the AI should not take over a player avatar. */
  manualUntil: number;
  pockets: CollectibleKind[];
  /** Where the character currently has shelter from rain. */
  sheltered: boolean;
  chatPartner: string | null;
  nextIdleThought: number;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

/** Generator-driven activity script. `yield` hands control back for one frame and receives dt. */
export type ActivityGen = Generator<void, void, number>;

export interface ActivityRun {
  id: string;
  label: string;
  icon: string;
  gen: ActivityGen;
  /** True when the user asked for this activity (choices go to the UI). */
  byPlayer: boolean;
  outdoor: boolean;
  startedAt: number;
  cleanups: (() => void)[];
  step: string;
}

// ---------------------------------------------------------------------------
// World objects
// ---------------------------------------------------------------------------

export type ObjectKind =
  | 'campfire'
  | 'tent'
  | 'chair'
  | 'logBench'
  | 'bench'
  | 'woodpile'
  | 'prepTable'
  | 'supplyBox'
  | 'fishBucket'
  | 'dock'
  | 'lantern'
  | 'hammock'
  | 'telescope'
  | 'blanket'
  | 'basket'
  | 'tarp'
  | 'crate'
  | 'stool'
  | 'branchSpot'
  | 'collectible'
  | 'bridge'
  | 'tackle';

export type SlotKind = 'sit' | 'lie' | 'stand' | 'sleep' | 'fish' | 'cook' | 'use' | 'shelter';

export interface Slot {
  id: string;
  kind: SlotKind;
  /** Local pose when using the slot. */
  local: { x: number; z: number; rot: number; y?: number };
  /** Local approach point to walk to before snapping into the pose. */
  approach: { x: number; z: number };
  occupant: string | null;
  /** Slot sits beside the fire (gets warmth). */
  nearFire?: boolean;
}

export type FoodKind = 'stew' | 'sausages' | 'fish';

export interface CampfireState {
  fuel: number;
  lit: boolean;
  /** Visible logs in the fire pit. */
  logs: number;
  /** Ember glow after the flames die. */
  ember: number;
  /** 0–1 smoothed, what the renderer should show. */
  intensity: number;
  pan: { food: FoodKind; doneness: number } | null;
  kettleHeat: number;
}

export interface TentState {
  /** Pitch progress, 0 = packed bag, 1 = fully pitched. */
  pitch: number;
  flap: number;
  flapTarget: number;
  color: string;
  label: string;
  lightOn: boolean;
}

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  name: string;
  x: number;
  z: number;
  rot: number;
  movable: boolean;
  /** Added by the player in build mode (can be removed). */
  custom: boolean;
  slots: Slot[];
  collider: Collider | null;
  // Kind specific state. Only the relevant field is populated.
  fire?: CampfireState;
  tent?: TentState;
  count?: number;
  /** Lantern on/off, branch present, collectible present... */
  on?: boolean;
  respawnAt?: number;
  collectible?: CollectibleKind;
  /** Prep table: recipe being prepared (0–1 progress) and plates ready. */
  prep?: { food: FoodKind | null; progress: number; plates: number; plateFood: FoodKind };
  basket?: Record<CollectibleKind, number>;
  color?: string;
  /** Hammock swing phase. */
  swing?: number;
}

export type Collider = { type: 'circle'; r: number } | { type: 'box'; hw: number; hd: number };

// ---------------------------------------------------------------------------
// Wildlife
// ---------------------------------------------------------------------------

export type FishState = 'swim' | 'attracted' | 'nibble' | 'hooked' | 'caught' | 'released';

export interface Fish {
  id: string;
  x: number;
  z: number;
  depth: number;
  heading: number;
  speed: number;
  size: number;
  species: string;
  color: string;
  state: FishState;
  target: V2 | null;
  wanderT: number;
  jump: number;
  hidden: boolean;
}

export type AnimalKind = 'rabbit' | 'deer' | 'owl' | 'squirrel';

export interface Animal {
  id: string;
  kind: AnimalKind;
  x: number;
  z: number;
  y: number;
  heading: number;
  state: 'idle' | 'move' | 'flee' | 'graze' | 'hoot';
  target: V2 | null;
  timer: number;
  hop: number;
  home: V2;
  range: number;
}

export interface Bobber {
  ownerId: string;
  /** Where the cast started (rod tip on the dock). */
  sx: number;
  sz: number;
  x: number;
  z: number;
  /** 0–1 flight progress of the cast. */
  flight: number;
  landed: boolean;
  dip: number;
  /** Fish that has noticed this bobber. */
  claimedBy: string | null;
  /** Fish that is biting right now. */
  biteFish: string | null;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

export interface WeatherMix {
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  storm: number;
}

export interface EnvState {
  /** Hour of day, 0–24. */
  time: number;
  day: number;
  season: Season;
  weather: WeatherKind;
  mix: WeatherMix;
  windStrength: number;
  windDir: number;
  gust: number;
  temperature: number;
  lockWeather: boolean;
  /** Sandbox override for wind strength (null = natural). */
  windOverride: number | null;
  nextWeatherChange: number;
  lightning: number;
  /** 0–1, how much snow covers the ground (accumulates slowly). */
  snowCover: number;
  /** 0–1 ground wetness. */
  wetness: number;
}

export interface WorldEvent {
  id: number;
  icon: string;
  text: string;
  at: number;
}

export interface Ripple {
  x: number;
  z: number;
  age: number;
  size: number;
}
