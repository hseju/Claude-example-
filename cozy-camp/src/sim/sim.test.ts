import { describe, expect, it } from 'vitest';
import { forestNight } from './environments/forestNight';
import { slotApproach } from './objects';
import { restoreWorld, serializeWorld } from './persistence';
import { World } from './world';

function run(w: World, simSeconds: number, each?: () => void) {
  const steps = Math.round(simSeconds / 0.05);
  for (let i = 0; i < steps; i++) {
    w.step(0.05);
    each?.();
  }
}

function recordStarts(w: World) {
  const starts: { who: string; id: string }[] = [];
  const orig = w.startActivity.bind(w);
  w.startActivity = (ch, id, opts) => {
    const r = orig(ch, id, opts);
    if (!r) starts.push({ who: ch.id, id });
    return r;
  };
  return starts;
}

describe('layout and navigation', () => {
  const w = new World(forestNight, { seed: 1 });
  const camp = { x: 0.9, z: 3.1 };

  it('can reach every interaction point from camp', () => {
    const unreachable: string[] = [];
    for (const o of w.objects) {
      for (const s of o.slots) {
        const a = slotApproach(o, s);
        const path = w.nav.findPath(camp, a);
        const end = path?.[path.length - 1];
        if (!end || Math.hypot(end.x - a.x, end.z - a.z) > 0.9) unreachable.push(`${o.id}/${s.id}`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('can reach every viewpoint and both ends of the footbridge', () => {
    for (const vp of forestNight.viewpoints) {
      const path = w.nav.findPath(camp, vp);
      expect(path, vp.label).not.toBeNull();
      const end = path![path!.length - 1];
      expect(Math.hypot(end.x - vp.x, end.z - vp.z), vp.label).toBeLessThan(1.0);
    }
  });

  it('keeps the lake and stream off limits except for the dock and bridge', () => {
    expect(w.terrain.walkable(13, -1)).toBe(false); // lake centre
    expect(w.terrain.walkable(9.5, 1.2)).toBe(true); // dock
    expect(w.terrain.walkable(6, -11)).toBe(false); // stream
    expect(w.terrain.walkable(5.5, -12)).toBe(true); // bridge
  });
});

describe('autonomous campers', () => {
  it('live a full day: fish, cook, tend the fire, pitch the tent and sleep', () => {
    const w = new World(forestNight, { seed: 7 });
    const starts = recordStarts(w);
    let sawFishCaught = false;
    let sawMeal = false;
    let slept = new Set<string>();
    run(w, 60 * 26, () => {
      for (const e of w.events) {
        if (e.icon === '🐟') sawFishCaught = true;
        if (e.icon === '🍲') sawMeal = true;
      }
      for (const c of w.characters) if (c.activity?.id === 'sleep' && c.inSleepingBag) slept.add(c.id);
    });
    const ids = new Set(starts.map((s) => s.id));
    for (const id of ['fish', 'cook', 'eat', 'tendFire', 'sleep', 'sitFire', 'pitchTent']) expect(ids, id).toContain(id);
    expect(sawFishCaught).toBe(true);
    expect(sawMeal).toBe(true);
    expect(slept.size).toBe(3);
    expect(w.obj('tent-sprout')!.tent!.pitch).toBe(1);
    // Every camper did several different things.
    for (const c of w.characters) {
      const mine = new Set(starts.filter((s) => s.who === c.id).map((s) => s.id));
      expect(mine.size, c.name).toBeGreaterThan(4);
    }
  });

  it('take shelter when a storm rolls in', () => {
    const w = new World(forestNight, { seed: 3 });
    w.setTime(14);
    run(w, 20);
    w.setWeather('storm');
    run(w, 60);
    const sheltered = w.characters.filter((c) => c.sheltered || c.activity?.id === 'shelter');
    expect(sheltered.length).toBe(3);
  });
});

describe('campfire', () => {
  it('burns down without fuel and its intensity follows the fuel', () => {
    const w = new World(forestNight, { seed: 2 });
    for (const c of w.characters) c.autopilot = false;
    w.characters.forEach((c) => (c.controller = c.controller === 'ai' ? 'remote' : c.controller));
    w.fire.fuel = 0.2;
    run(w, 10);
    const hot = w.fire.intensity;
    run(w, 60);
    expect(w.fire.lit).toBe(false);
    expect(w.fire.intensity).toBeLessThan(hot);
  });
});

describe('player commands', () => {
  it('fishing asks the player to keep or release, and keeping fills the bucket', () => {
    const w = new World(forestNight, { seed: 11 });
    const p = w.player;
    p.autopilot = false;
    for (const c of w.characters) if (c !== p) c.controller = 'remote';
    w.setTime(20);
    const bucket = w.first('fishBucket')!;
    const before = bucket.count!;
    expect(w.startActivity(p, 'fish', { byPlayer: true })).toBeNull();
    let asked = false;
    run(w, 200, () => {
      if (p.pendingChoice && !p.pendingChoice.picked) {
        asked = true;
        w.answerChoice(p, 'keep');
      }
    });
    // Three casts may all miss; only check the outcome when something bit.
    if (asked) expect(bucket.count).toBe(before + 1);
    expect(p.activity).toBeNull();
  });

  it('refuses activities that cannot run, with a reason', () => {
    const w = new World(forestNight, { seed: 5 });
    w.setTime(13);
    expect(w.startActivity(w.player, 'stargaze', { byPlayer: true })).toMatch(/night/);
    expect(w.startActivity(w.player, 'eat', { byPlayer: true })).toMatch(/cooked/);
  });

  it('walks with direct input and collides with the campfire', () => {
    const w = new World(forestNight, { seed: 5 });
    const p = w.player;
    p.x = 0;
    p.z = 2.5;
    w.playerInput = { x: 0, z: -1, run: false };
    run(w, 4);
    expect(p.z).toBeGreaterThan(0.7); // stopped at the stone ring
  });
});

describe('building', () => {
  it('moves furniture to valid spots only and rebuilds navigation', () => {
    const w = new World(forestNight, { seed: 4 });
    expect(w.moveObject('chair-a', 13, -1, 0)).toBe(false); // in the lake
    expect(w.moveObject('chair-a', -1.5, 4.5, 0.5)).toBe(true);
    expect(w.nav.isWalkable(-1.5, 4.5)).toBe(false);
    const added = w.addObject('lantern', 2.5, 4.5, 0, { on: true });
    expect(added).not.toBeNull();
    expect(w.removeObject(added!.id)).toBe(true);
    expect(w.removeObject('campfire')).toBe(false);
  });
});

describe('persistence', () => {
  it('restores campsite state into a new world', () => {
    const a = new World(forestNight, { seed: 9 });
    a.moveObject('chair-b', 2.6, 4.4, 1);
    a.addObject('stool', -2.5, 4.6, 0);
    a.first('woodpile')!.count = 7;
    a.obj('tent-sprout')!.tent!.pitch = 1;
    a.setTime(3.5);
    a.setSeason('autumn');
    const saved = JSON.parse(JSON.stringify(serializeWorld(a)));

    const b = new World(forestNight, { seed: 10 });
    expect(restoreWorld(b, saved)).toBe(true);
    expect(b.obj('chair-b')!.x).toBeCloseTo(2.6);
    expect(b.objects.some((o) => o.kind === 'stool' && o.custom)).toBe(true);
    expect(b.first('woodpile')!.count).toBe(7);
    expect(b.obj('tent-sprout')!.tent!.pitch).toBe(1);
    expect(b.env.time).toBeCloseTo(3.5);
    expect(b.env.season).toBe('autumn');
  });
});
