import { createObject } from './objects';
import type { Appearance, CollectibleKind, FoodKind, Needs, ObjectKind, Season, WeatherKind } from './types';
import type { World } from './world';

export const SAVE_VERSION = 1;

interface SavedObject {
  id: string;
  kind: ObjectKind;
  x: number;
  z: number;
  rot: number;
  custom: boolean;
  count?: number;
  on?: boolean;
  color?: string;
  fire?: { fuel: number; lit: boolean };
  tent?: { pitch: number };
  basket?: Record<CollectibleKind, number>;
  plates?: { n: number; food: FoodKind };
}

export interface SavedWorld {
  v: number;
  envId: string;
  savedAt: number;
  env: { time: number; day: number; season: Season; weather: WeatherKind; lockWeather: boolean; windOverride: number | null };
  objects: SavedObject[];
  characters: { id: string; name: string; x: number; z: number; needs: Needs; autopilot: boolean; appearance: Appearance }[];
}

/** Snapshot of the persistent campsite state (not mid-activity details). */
export function serializeWorld(w: World): SavedWorld {
  return {
    v: SAVE_VERSION,
    envId: w.def.id,
    savedAt: Date.now(),
    env: {
      time: w.env.time,
      day: w.env.day,
      season: w.env.season,
      weather: w.env.weather,
      lockWeather: w.env.lockWeather,
      windOverride: w.env.windOverride,
    },
    objects: w.objects
      .filter((o) => o.kind !== 'branchSpot' && o.kind !== 'collectible')
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        x: o.x,
        z: o.z,
        rot: o.rot,
        custom: o.custom,
        count: o.count,
        on: o.on,
        color: o.color,
        fire: o.fire ? { fuel: o.fire.fuel, lit: o.fire.lit } : undefined,
        tent: o.tent ? { pitch: o.tent.pitch >= 0.5 ? 1 : 0 } : undefined,
        basket: o.basket ? { ...o.basket } : undefined,
        plates: o.prep ? { n: o.prep.plates, food: o.prep.plateFood } : undefined,
      })),
    characters: w.characters.map((c) => ({
      id: c.id,
      name: c.name,
      x: c.x,
      z: c.z,
      needs: { ...c.needs },
      autopilot: c.autopilot,
      appearance: c.appearance,
    })),
  };
}

/** Apply a saved snapshot to a freshly built world of the same environment. */
export function restoreWorld(w: World, data: SavedWorld): boolean {
  if (!data || data.v !== SAVE_VERSION || data.envId !== w.def.id) return false;
  w.env.time = data.env.time;
  w.env.day = data.env.day;
  w.setSeason(data.env.season);
  w.env.weather = data.env.weather;
  w.env.lockWeather = data.env.lockWeather;
  w.env.windOverride = data.env.windOverride ?? null;

  for (const s of data.objects) {
    let o = w.obj(s.id);
    if (!o && s.custom) {
      o = createObject({ kind: s.kind, id: s.id, x: s.x, z: s.z, rot: s.rot, init: { custom: true, color: s.color, on: s.on } });
      w.insertObject(o);
    }
    if (!o) continue;
    if (o.movable) {
      o.x = s.x;
      o.z = s.z;
      o.rot = s.rot;
    }
    if (s.count !== undefined) o.count = s.count;
    if (s.on !== undefined && o.kind === 'lantern') o.on = s.on;
    if (s.color) o.color = s.color;
    if (s.fire && o.fire) {
      o.fire.fuel = s.fire.fuel;
      o.fire.lit = s.fire.lit;
      o.fire.intensity = s.fire.lit ? 0.6 : 0;
    }
    if (s.tent && o.tent) o.tent.pitch = s.tent.pitch;
    if (s.basket && o.basket) Object.assign(o.basket, s.basket);
    if (s.plates && o.prep) {
      o.prep.plates = s.plates.n;
      o.prep.plateFood = s.plates.food;
    }
  }
  w.rebuildNav();

  for (const s of data.characters) {
    const c = w.char(s.id);
    if (!c) continue;
    Object.assign(c.needs, s.needs);
    if (c.controller === 'player') {
      c.name = s.name;
      c.appearance = s.appearance;
      c.autopilot = s.autopilot;
    }
    if (w.nav.isWalkable(s.x, s.z)) {
      c.x = s.x;
      c.z = s.z;
    }
  }
  w.version++;
  return true;
}
