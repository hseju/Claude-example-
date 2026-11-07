import { ACTIVITY_LIST } from './activities';
import type { Character } from './types';
import type { World } from './world';

export interface Option {
  id: string;
  score: number;
}

/**
 * Score every available activity for a camper: needs, time of day and weather
 * (inside each activity's utility), personality, a variety penalty for recent
 * activities and a little randomness.
 */
export function scoreActivities(w: World, ch: Character): Option[] {
  const out: Option[] = [];
  for (const def of ACTIVITY_LIST) {
    if (def.blocked(w, ch, {}) !== null) continue;
    let u = def.utility(w, ch);
    if (!(u > 0)) continue;
    u *= ch.personality[def.id] ?? 1;
    const r = ch.recent.indexOf(def.id);
    if (r === 0) u *= 0.3;
    else if (r === 1) u *= 0.6;
    else if (r === 2) u *= 0.85;
    out.push({ id: def.id, score: u });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Pick one of the best few options, weighted toward the top score. */
export function chooseActivity(w: World, ch: Character): string | null {
  const options = scoreActivities(w, ch).map((o) => ({ ...o, score: o.score * w.rng.range(0.85, 1.15) }));
  options.sort((a, b) => b.score - a.score);
  const top = options.slice(0, 3).filter((o) => o.score > options[0]?.score * 0.6);
  if (!top.length) return null;
  const weights = top.map((o) => o.score * o.score);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = w.rng.next() * total;
  for (let i = 0; i < top.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return top[i].id;
  }
  return top[0].id;
}
