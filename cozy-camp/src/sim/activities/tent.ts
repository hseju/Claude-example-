import { localToWorld } from '../math';
import { slotApproach, slotPose, tentSize } from '../objects';
import type { ActivityGen, Character, Slot, WorldObject } from '../types';
import type { World } from '../world';
import { ActivityFail, Ctx, nearestFreeSlot, type ActivityDef } from './core';

/** The camper's own tent if it has room, otherwise any pitched tent with a free bed. */
export function findBed(w: World, ch: Character, preferId?: string): { o: WorldObject; s: Slot } | null {
  const free = (o: WorldObject) => o.slots.find((s) => s.kind === 'sleep' && (!s.occupant || s.occupant === ch.id));
  for (const id of [preferId, ch.tentId]) {
    const t = id ? w.obj(id) : undefined;
    if (t?.tent && t.tent.pitch >= 1) {
      const s = free(t);
      if (s) return { o: t, s };
    }
  }
  return nearestFreeSlot(
    w,
    ch,
    (o) => o.kind === 'tent' && (o.tent?.pitch ?? 0) >= 1,
    (s) => s.kind === 'sleep',
    ch.id,
  );
}

function isSleepTime(w: World): boolean {
  const t = w.env.time;
  return t >= 23.5 || t < 5.5;
}

/** Crawl into a tent bed. Registers cleanup that crawls back out if interrupted. */
function* crawlIn(ctx: Ctx, tent: WorldObject, bed: Slot, anim: 'sleep' | 'sit'): ActivityGen {
  const ts = tent.tent!;
  if (!ctx.reserve(tent, bed)) throw new ActivityFail('That bed is taken');
  const door = slotApproach(tent, tent.slots[0]);
  yield* ctx.goTo(door, { tolerance: 0.35, run: ctx.w.rain() > 0.4 });
  ctx.face(tent);
  ts.flapTarget = 1;
  ctx.sound('zip', tent);
  ctx.anim('crouch');
  yield* ctx.wait(0.6);
  ctx.ch.pinned = true;
  ctx.w.stopMoving(ctx.ch);
  const pose = slotPose(tent, bed);
  const entry = { o: tent, s: bed };
  ctx.inSlot = entry;
  ctx.onCleanup(() => {
    ctx.ch.inSleepingBag = false;
    if (ctx.inSlot === entry) {
      ctx.inSlot = null;
      ts.flap = Math.max(ts.flap, 0.6);
      ts.flapTarget = 0;
      ctx.w.exitSlot(ctx.ch, door);
    }
  });
  yield* ctx.slide(pose, pose.rot, pose.y, 0.9);
  ctx.anim(anim);
  ctx.ch.inSleepingBag = anim === 'sleep';
}

function* crawlOut(ctx: Ctx, tent: WorldObject): ActivityGen {
  const ts = tent.tent!;
  ts.flapTarget = 1;
  ctx.sound('zip', tent);
  ctx.ch.inSleepingBag = false;
  ctx.anim('crouch');
  const door = slotApproach(tent, tent.slots[0]);
  ctx.inSlot = null;
  yield* ctx.slide(door, tent.rot, 0, 0.9);
  ctx.ch.pinned = false;
  for (const s of tent.slots) if (s.occupant === ctx.ch.id) s.occupant = null;
  ctx.anim('idle');
  yield* ctx.wait(0.4);
  if (!tent.slots.some((s) => s.kind === 'sleep' && s.occupant)) ts.flapTarget = 0;
}

export const sleep: ActivityDef = {
  id: 'sleep',
  label: 'Sleep in the tent',
  icon: '💤',
  outdoor: false,
  menu: true,
  blocked(w, ch) {
    return findBed(w, ch) ? null : 'Pitch a tent first';
  },
  utility(w, ch) {
    const tired = 1 - ch.needs.energy;
    const t = w.env.time;
    if (isSleepTime(w)) {
      let u = 0.9 + tired * 1.6;
      if (t >= 1 && t < 5.5) u += 0.8;
      return u;
    }
    return tired > 0.8 ? 0.6 + tired : 0;
  },
  *run(ctx, p) {
    const w = ctx.w;
    const bed = findBed(w, ctx.ch, p.objectId);
    if (!bed) throw new ActivityFail('No free bed');
    const tent = bed.o;
    ctx.step(`Heading to the ${tent.name.toLowerCase()}`);
    yield* crawlIn(ctx, tent, bed.s, 'sleep');
    const ts = tent.tent!;
    ts.flapTarget = 0;
    ctx.ch.expression = 'sleepy';
    if (w.isNight()) {
      ctx.step('Reading by lantern light');
      ts.lightOn = true;
      ctx.onCleanup(() => {
        if (!tent.slots.some((s) => s.occupant && s.occupant !== ctx.ch.id)) ts.lightOn = false;
      });
      yield* ctx.wait(6);
      ts.lightOn = false;
    }
    ctx.step('Sleeping');
    let zTimer = 0;
    const wake = () => {
      const e = ctx.ch.needs.energy;
      if (ctx.run.byPlayer) return e >= 0.99 && !isSleepTime(w);
      const t = w.env.time;
      const wakeHour = ctx.ch.personality.wakeHour ?? 6.8;
      // Up in the morning once rested; also up if the clock is moved into the day.
      return (e >= 0.9 && t >= wakeHour && t < 22) || (e >= 0.5 && t >= 9 && t < 21);
    };
    yield* ctx.waitUntil(wake, Infinity, (dt) => {
      ctx.gain('energy', 0.15, dt);
      ctx.gain('warmth', 0.5, dt);
      zTimer -= dt;
      if (zTimer <= 0) {
        zTimer = 6;
        ctx.say('💤', undefined, 4);
      }
    });
    ctx.step('Waking up');
    ctx.ch.expression = 'happy';
    yield* crawlOut(ctx, tent);
    ctx.anim('stretch');
    yield* ctx.wait(2.2);
    ctx.say('☀️');
    if (w.daylight() > 0.2) ctx.event('☀️', `${ctx.ch.name} is up and about`);
  },
};

export const shelter: ActivityDef = {
  id: 'shelter',
  label: 'Shelter from the rain',
  icon: '☔',
  outdoor: false,
  menu: true,
  blocked(w, ch) {
    if (w.rain() < 0.15) return "It isn't raining";
    if (ch.sheltered && ch.activity?.id === 'shelter') return 'Already sheltered';
    return null;
  },
  utility(w, ch) {
    if (w.rain() < 0.35 || ch.sheltered) return 0;
    return 1.5 + w.rain() * 1.5;
  },
  *run(ctx, p) {
    const w = ctx.w;
    const bed = findBed(w, ctx.ch, p.objectId);
    const tarp = nearestFreeSlot(w, ctx.ch, (o) => o.kind === 'tarp', () => true, ctx.ch.id);
    const picked = p.objectId ? w.obj(p.objectId)?.kind : undefined;
    const preferTent =
      bed && picked !== 'tarp' && (picked === 'tent' || !tarp || Math.hypot(bed.o.x - ctx.ch.x, bed.o.z - ctx.ch.z) < Math.hypot(tarp.o.x - ctx.ch.x, tarp.o.z - ctx.ch.z) + 3);
    ctx.say('🌧️', 'Brr, rain!', 2.5);
    const stillRaining = () => w.rain() > 0.12;
    if (preferTent && bed) {
      ctx.step('Hurrying to the tent');
      yield* crawlIn(ctx, bed.o, bed.s, 'sit');
      const ts = bed.o.tent!;
      ts.flapTarget = 0.35;
      ctx.step('Listening to the rain from the tent');
      if (w.isNight()) ts.lightOn = true;
      ctx.onCleanup(() => (ts.lightOn = false));
      yield* ctx.waitUntil(() => !stillRaining(), 400, (dt) => {
        ctx.gain('warmth', 0.3, dt);
        ctx.gain('energy', 0.05, dt);
      });
      ts.lightOn = false;
      yield* crawlOut(ctx, bed.o);
    } else if (tarp) {
      ctx.step('Hurrying under the tarp');
      yield* ctx.enterSlot(tarp.o, tarp.s, 'idle', { run: true });
      ctx.step('Waiting out the rain under the tarp');
      yield* ctx.waitUntil(() => !stillRaining(), 400, (dt) => ctx.gain('fun', 0.05, dt));
    } else {
      throw new ActivityFail('Nowhere dry to go');
    }
    ctx.say('🌤️');
  },
};

function tentCorners(tent: WorldObject) {
  const size = tentSize(tent);
  const hw = size.w / 2 + 0.45;
  const hd = size.d / 2 + 0.45;
  return [
    { x: -hw, z: hd },
    { x: hw, z: hd },
    { x: hw, z: -hd },
    { x: -hw, z: -hd },
  ].map((c) => localToWorld(tent, tent.rot, c));
}

export const pitchTent: ActivityDef = {
  id: 'pitchTent',
  label: 'Pitch a tent',
  icon: '⛺',
  outdoor: true,
  menu: true,
  blocked(w, _ch, p) {
    const target = p.objectId ? w.obj(p.objectId) : undefined;
    if (target) return (target.tent?.pitch ?? 1) < 1 ? null : 'That tent is already up';
    return w.objects.some((o) => o.kind === 'tent' && (o.tent?.pitch ?? 1) < 1) ? null : 'All tents are pitched';
  },
  utility(w, ch) {
    const packed = w.objects.filter((o) => o.kind === 'tent' && (o.tent?.pitch ?? 1) < 1);
    if (!packed.length) return 0;
    let u = 0.55;
    if (packed.some((t) => t.id === ch.tentId)) u += 0.6;
    if (w.env.time > 22 || w.env.time < 5) u += 0.4;
    return u * (1 - w.rain() * 0.6);
  },
  *run(ctx, p) {
    const w = ctx.w;
    const tent =
      (p.objectId ? w.obj(p.objectId) : undefined) ??
      w.obj(ctx.ch.tentId) ??
      w.objects.find((o) => o.kind === 'tent' && (o.tent?.pitch ?? 1) < 1);
    if (!tent?.tent || tent.tent.pitch >= 1) throw new ActivityFail('No tent to pitch');
    const door = tent.slots[0];
    if (!ctx.reserve(tent, door)) throw new ActivityFail('Someone is already setting it up');
    const ts = tent.tent;
    ctx.step(`Pitching the ${tent.name.toLowerCase()}`);
    const corners = tentCorners(tent);
    for (let i = 0; i < corners.length; i++) {
      yield* ctx.goTo(corners[i], { tolerance: 0.45 });
      ctx.face(tent);
      ctx.hold('mallet');
      ctx.anim('hammer');
      const start = ts.pitch;
      const end = (i + 1) / corners.length;
      let knock = 0;
      yield* ctx.wait(2.4, (dt) => {
        ts.pitch = Math.min(end, ts.pitch + ((end - start) * dt) / 2.4);
        knock -= dt;
        if (knock <= 0) {
          knock = 0.6;
          ctx.sound('hammer', tent);
        }
      });
      ts.pitch = end;
      ctx.hold(null);
      ctx.anim('idle');
    }
    ts.pitch = 1;
    w.rebuildNav();
    ctx.event('⛺', `${ctx.ch.name} pitched the ${tent.name.toLowerCase()}`);
    ctx.say('⛺');
    ctx.bump('fun', 0.2);
  },
};

export const packTent: ActivityDef = {
  id: 'packTent',
  label: 'Pack up the tent',
  icon: '🎒',
  outdoor: true,
  menu: false,
  blocked(w, _ch, p) {
    const tent = p.objectId ? w.obj(p.objectId) : undefined;
    if (!tent?.tent) return 'Pick a tent first';
    if (tent.tent.pitch <= 0) return 'Already packed';
    if (tent.slots.some((s) => s.occupant)) return 'Someone is using it';
    return null;
  },
  utility: () => 0,
  *run(ctx, p) {
    const w = ctx.w;
    const tent = p.objectId ? w.obj(p.objectId) : undefined;
    if (!tent?.tent) throw new ActivityFail('No tent');
    const door = tent.slots[0];
    if (!ctx.reserve(tent, door)) throw new ActivityFail('Someone is using it');
    const ts = tent.tent;
    ctx.step(`Packing up the ${tent.name.toLowerCase()}`);
    const corners = tentCorners(tent).reverse();
    for (let i = 0; i < corners.length; i++) {
      yield* ctx.goTo(corners[i], { tolerance: 0.45 });
      ctx.face(tent);
      ctx.anim('pickup');
      const start = ts.pitch;
      const end = 1 - (i + 1) / corners.length;
      yield* ctx.wait(1.8, (dt) => {
        ts.pitch = Math.max(end, ts.pitch - ((start - end) * dt) / 1.8);
      });
      ts.pitch = end;
    }
    ts.pitch = 0;
    ctx.anim('idle');
    w.rebuildNav();
    ctx.event('🎒', `${ctx.ch.name} packed up the ${tent.name.toLowerCase()}`);
  },
};

export const TENT_ACTIVITIES = [sleep, shelter, pitchTent, packTent];
