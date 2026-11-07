import { create } from 'zustand';
import { DEFAULT_PLAYER_APPEARANCE } from '../sim/character';
import { DEFAULT_ENVIRONMENT } from '../sim/environments';
import { restoreWorld, serializeWorld, type SavedWorld } from '../sim/persistence';
import type { Appearance, ObjectKind } from '../sim/types';
import { World } from '../sim/world';

const SAVE_KEY = 'cozy-camp:world:v1';
const PREFS_KEY = 'cozy-camp:prefs:v1';

export type Quality = 'high' | 'low';
export type CameraMode = 'overview' | 'follow';
export type Panel = 'none' | 'environment' | 'settings' | 'help' | 'build';

export interface Prefs {
  volume: number;
  muted: boolean;
  ambience: boolean;
  quality: Quality;
  showNames: boolean;
  created: boolean;
  playerName: string;
  appearance: Appearance;
}

const DEFAULT_PREFS: Prefs = {
  volume: 0.7,
  muted: false,
  ambience: true,
  quality: 'high',
  showNames: true,
  created: false,
  playerName: 'Robin',
  appearance: DEFAULT_PLAYER_APPEARANCE,
};

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

export function loadPrefs(): Prefs {
  const saved = readJSON<Partial<Prefs>>(PREFS_KEY);
  return { ...DEFAULT_PREFS, ...saved, appearance: { ...DEFAULT_PREFS.appearance, ...(saved?.appearance ?? {}) } };
}

function createWorld(prefs: Prefs): World {
  const w = new World(DEFAULT_ENVIRONMENT, { playerName: prefs.playerName, playerAppearance: prefs.appearance });
  const saved = readJSON<SavedWorld>(SAVE_KEY);
  if (saved) restoreWorld(w, saved);
  // Preferences are the source of truth for the player's look.
  w.player.name = prefs.playerName;
  w.player.appearance = prefs.appearance;
  return w;
}

const initialPrefs = loadPrefs();

/** The one simulation instance. Components read it every frame; React state only mirrors what the UI shows. */
export const world = createWorld(initialPrefs);

export function saveWorld(): void {
  writeJSON(SAVE_KEY, serializeWorld(world));
}

export function resetWorld(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

interface Placing {
  kind: ObjectKind;
  init?: Record<string, unknown>;
  /** Existing object being moved, or undefined when adding a new one. */
  id?: string;
  rot: number;
  x: number;
  z: number;
  valid: boolean;
}

interface UIState {
  /** Increments a few times per second so panels re-read the simulation. */
  tick: number;
  selectedChar: string | null;
  selectedObject: string | null;
  hoverObject: string | null;
  cameraMode: CameraMode;
  followId: string;
  panel: Panel;
  placing: Placing | null;
  creatorOpen: boolean;
  prefs: Prefs;
  /** Set when the camera should glide to a point (e.g. from a toast). */
  focus: { x: number; z: number; at: number } | null;
  toast: string | null;

  bump(): void;
  selectChar(id: string | null): void;
  selectObject(id: string | null): void;
  setHover(id: string | null): void;
  setCameraMode(mode: CameraMode, followId?: string): void;
  setPanel(panel: Panel): void;
  setPlacing(p: Placing | null): void;
  updatePlacing(p: Partial<Placing>): void;
  setCreatorOpen(open: boolean): void;
  setPrefs(p: Partial<Prefs>): void;
  focusOn(x: number, z: number): void;
  showToast(text: string | null): void;
}

export const useUI = create<UIState>((set, get) => ({
  tick: 0,
  selectedChar: null,
  selectedObject: null,
  hoverObject: null,
  cameraMode: 'overview',
  followId: world.playerId,
  panel: 'none',
  placing: null,
  creatorOpen: !initialPrefs.created,
  prefs: initialPrefs,
  focus: null,
  toast: null,

  bump: () => set((s) => ({ tick: s.tick + 1 })),
  selectChar: (id) => set({ selectedChar: id, selectedObject: null }),
  selectObject: (id) => set({ selectedObject: id, selectedChar: id ? null : get().selectedChar }),
  setHover: (id) => set({ hoverObject: id }),
  setCameraMode: (mode, followId) => set({ cameraMode: mode, followId: followId ?? get().followId }),
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? 'none' : panel, placing: panel === 'build' ? s.placing : null })),
  setPlacing: (placing) => set({ placing }),
  updatePlacing: (p) => set((s) => (s.placing ? { placing: { ...s.placing, ...p } } : {})),
  setCreatorOpen: (creatorOpen) => set({ creatorOpen }),
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p };
    writeJSON(PREFS_KEY, prefs);
    if (p.appearance) world.player.appearance = prefs.appearance;
    if (p.playerName) world.player.name = prefs.playerName;
    set({ prefs });
  },
  focusOn: (x, z) => set({ focus: { x, z, at: performance.now() } }),
  showToast: (toast) => set({ toast }),
}));

// Handy for debugging and automated checks: open the app with ?debug.
if (typeof window !== 'undefined' && (import.meta.env.DEV || window.location.search.includes('debug'))) {
  (window as unknown as Record<string, unknown>).cozy = { world, useUI };
}

// Save the campsite regularly and when the tab is hidden or closed.
if (typeof window !== 'undefined') {
  setInterval(saveWorld, 10000);
  window.addEventListener('beforeunload', saveWorld);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveWorld();
  });
}
