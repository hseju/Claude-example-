import { forestNight } from './forestNight';
import type { EnvironmentDefinition } from './types';

export type { EnvironmentDefinition } from './types';

/** Worlds that run today. Each one plugs into the same character and activity systems. */
export const ENVIRONMENTS: Record<string, EnvironmentDefinition> = {
  [forestNight.id]: forestNight,
};

/**
 * The roadmap. Each entry lists what its EnvironmentDefinition will add on top of
 * the shared framework (new terrain, water body, object kinds and activities).
 */
export const PLANNED_ENVIRONMENTS = [
  {
    id: 'beach',
    name: 'Beach Camping',
    highlights: ['Ocean waves and tides', 'Swimming', 'Beach cooking', 'Surf fishing', 'Sunset relaxation'],
  },
  {
    id: 'winter',
    name: 'Winter Camping',
    highlights: ['Snowfall and drifts', 'Insulated winter tents', 'Hot beverages', 'Snow activities', 'Big warm campfires'],
  },
  {
    id: 'summer-lakeside',
    name: 'Summer Lakeside',
    highlights: ['Kayaking', 'Fishing', 'Hiking', 'Picnics', 'Swimming'],
  },
  {
    id: 'autumn-forest',
    name: 'Autumn Forest',
    highlights: ['Falling leaves', 'Morning mist', 'Forest exploration', 'Cozy evenings'],
  },
] as const;

export const DEFAULT_ENVIRONMENT = forestNight;
