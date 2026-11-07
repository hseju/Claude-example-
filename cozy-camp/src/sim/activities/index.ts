import type { ObjectKind, WorldObject } from '../types';
import { CAMPFIRE_ACTIVITIES } from './campfire';
import { COOKING_ACTIVITIES } from './cooking';
import type { ActivityDef, ActParams } from './core';
import { FISHING_ACTIVITIES } from './fishing';
import { LEISURE_ACTIVITIES } from './leisure';
import { TENT_ACTIVITIES } from './tent';

export type { ActivityDef, ActParams } from './core';

export const ACTIVITY_LIST: ActivityDef[] = [
  ...CAMPFIRE_ACTIVITIES,
  ...COOKING_ACTIVITIES,
  ...FISHING_ACTIVITIES,
  ...TENT_ACTIVITIES,
  ...LEISURE_ACTIVITIES,
];

export const ACTIVITIES: Record<string, ActivityDef> = Object.fromEntries(ACTIVITY_LIST.map((a) => [a.id, a]));

/** Activities in the order they appear in the player's menu. */
export const MENU_ACTIVITIES = [
  'sitFire',
  'tendFire',
  'gatherWood',
  'cook',
  'eat',
  'cocoa',
  'marshmallow',
  'fish',
  'explore',
  'collect',
  'chat',
  'hammock',
  'stargaze',
  'skywatch',
  'pitchTent',
  'sleep',
  'shelter',
].map((id) => ACTIVITIES[id]);

export interface ObjectAction {
  activity: string;
  label: string;
  icon: string;
  params: ActParams;
}

/** What the player can do with a selected object. */
export function objectActions(o: WorldObject): ObjectAction[] {
  const p = { objectId: o.id };
  const a = (activity: string, label?: string, icon?: string): ObjectAction => ({
    activity,
    label: label ?? ACTIVITIES[activity].label,
    icon: icon ?? ACTIVITIES[activity].icon,
    params: p,
  });
  const byKind: Partial<Record<ObjectKind, () => ObjectAction[]>> = {
    campfire: () => [a('tendFire'), a('cook'), a('cocoa'), a('marshmallow'), a('sitFire')],
    tent: () =>
      (o.tent?.pitch ?? 1) >= 1
        ? [a('sleep', 'Sleep here'), a('shelter', 'Shelter inside'), a('packTent')]
        : [a('pitchTent', 'Pitch this tent')],
    chair: () => [a('sit')],
    stool: () => [a('sit')],
    logBench: () => [a('sit')],
    bench: () => [a('sit')],
    blanket: () => [a('skywatch'), a('sit', 'Sit on the blanket')],
    woodpile: () => [a('tendFire'), a('gatherWood')],
    prepTable: () => [a('cook'), a('eat')],
    supplyBox: () => [a('cook')],
    fishBucket: () => [a('fish'), a('cook', 'Cook a fish')],
    dock: () => [a('fish')],
    tackle: () => [a('fish')],
    lantern: () => [a('toggleLantern', o.on ? 'Turn off' : 'Light it', o.on ? '🌑' : '🏮')],
    hammock: () => [a('hammock')],
    telescope: () => [a('stargaze')],
    basket: () => [a('collect'), a('explore')],
    branchSpot: () => [a('gatherWood', 'Gather these branches')],
    collectible: () => [a('collect', `Pick up the ${o.name.toLowerCase()}`)],
    tarp: () => [a('shelter')],
  };
  return byKind[o.kind]?.() ?? [];
}
