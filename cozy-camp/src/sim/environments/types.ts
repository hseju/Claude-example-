import type { V2 } from '../math';
import type { ObjectKind, Season, WeatherKind } from '../types';

export interface ObjectSpec {
  kind: ObjectKind;
  x: number;
  z: number;
  rot?: number;
  name?: string;
  id?: string;
  /** Kind-specific initial values. */
  init?: Record<string, unknown>;
}

export interface Lake {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
}

export interface ScatterZone {
  x: number;
  z: number;
  r: number;
}

export interface SeasonPalette {
  grass: string;
  grassDry: string;
  dirt: string;
  foliage: string[];
  pine: string;
  bush: string;
  flowers: string[];
}

export interface Viewpoint extends V2 {
  label: string;
  /** Direction the camper looks at when visiting. */
  look: V2;
}

export interface CharacterSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  tent: string;
}

/**
 * Everything that makes one camping world distinct. The character, activity and
 * object systems are shared by every environment; only this data changes.
 */
export interface EnvironmentDefinition {
  id: string;
  name: string;
  tagline: string;
  status: 'playable' | 'planned';
  seed: number;
  /** Half extent of the navigable square, in metres. */
  bounds: number;
  /** Characters stay inside this radius. */
  walkRadius: number;
  defaults: { time: number; season: Season; weather: WeatherKind };
  allowedWeather: WeatherKind[];
  waterLevel: number;
  lake: Lake | null;
  streams: V2[][];
  trails: V2[][];
  bridges: { x: number; z: number; rot: number; length: number; width: number }[];
  dock: { x0: number; x1: number; z: number; width: number } | null;
  objects: ObjectSpec[];
  /** Areas kept clear of trees and rocks. */
  clearings: ScatterZone[];
  /** Explicit trees (e.g. the hammock trees). */
  fixedTrees: { x: number; z: number; kind: TreeKind; scale: number }[];
  treeCount: number;
  viewpoints: Viewpoint[];
  branchSpots: V2[];
  collectibleSpots: { x: number; z: number; kind: 'pinecone' | 'flower' | 'mushroom' | 'stone' }[];
  glowMushrooms: V2[];
  wildlife: { fish: number; rabbits: V2[]; deer: V2[]; owl: V2 | null; squirrels: V2[] };
  characters: CharacterSpec[];
  palette: Record<Season, SeasonPalette>;
  /** Terrain height at a point, before water carving is applied. */
  baseHeight(x: number, z: number): number;
}

export type TreeKind = 'pine' | 'round' | 'birch' | 'tallPine';

export interface TreeInstance {
  x: number;
  z: number;
  kind: TreeKind;
  scale: number;
  rot: number;
  tint: number;
}

export interface RockInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  blocks: boolean;
}

export interface DecorInstance {
  x: number;
  z: number;
  kind: 'bush' | 'fern' | 'grass' | 'flower' | 'mushroom' | 'reed' | 'stump' | 'lilypad';
  scale: number;
  rot: number;
  tint: number;
}
