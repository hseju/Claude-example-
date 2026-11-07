import { clamp, type V2 } from '../math';
import { SEAT_KINDS, slotApproach } from '../objects';
import type { ActivityGen, Character, Slot, WorldObject } from '../types';
import type { World } from '../world';
import { ActivityFail, Ctx, nearestFreeSlot, type ActivityDef, type ActParams } from './core';

export const FIRE_SEAT_RADIUS = 4.2;

export function freeFireSeat(w: World, ch: Character): { o: WorldObject; s: Slot } | null {
  const fire = w.campfire;
  return nearestFreeSlot(
    w,
    ch,
    (o) => SEAT_KINDS.includes(o.kind) && Math.hypot(o.x - fire.x, o.z - fire.z) < FIRE_SEAT_RADIUS,
    () => true,
    ch.id,
  );
}

export function anySeat(w: World, ch: Character, near: V2 = ch): { o: WorldObject; s: Slot } | null {
  return (
    freeFireSeat(w, ch) ??
    nearestFreeSlot(
      w,
      near,
      (o) => SEAT_KINDS.includes(o.kind) || o.kind === 'blanket',
      () => true,
      ch.id,
    )
  );
}

/** A standing spot on a ring around the fire, on the side the camper approaches from. */
export function fireRingPoint(w: World, from: V2, radius = 1.2, angleOffset = 0): V2 {
  const f = w.campfire;
  let a = Math.atan2(from.z - f.z, from.x - f.x) + angleOffset;
  for (let i = 0; i < 12; i++) {
    const p = { x: f.x + Math.cos(a) * radius, z: f.z + Math.sin(a) * radius };
    if (w.nav.isWalkable(p.x, p.z)) return p;
    a += (i % 2 === 0 ? 1 : -1) * (i + 1) * 0.35;
  }
  return w.nav.nearestWalkable(f.x + radius, f.z) ?? { x: f.x + radius, z: f.z };
}

/** Fetch one log from the woodpile, add it to the fire and light the fire if needed. */
export function* addLogRoutine(ctx: Ctx): ActivityGen {
  const w = ctx.w;
  const pile = w.first('woodpile');
  if (!pile) throw new ActivityFail('There is no woodpile');
  if ((pile.count ?? 0) <= 0) throw new ActivityFail('The woodpile is empty');
  ctx.step('Fetching a log from the woodpile');
  yield* ctx.goTo(slotApproach(pile, pile.slots[0]), { tolerance: 0.45 });
  ctx.face(pile);
  ctx.anim('pickup');
  yield* ctx.wait(0.7);
  if ((pile.count ?? 0) <= 0) throw new ActivityFail('Someone took the last log');
  pile.count = (pile.count ?? 1) - 1;
  ctx.hold('log');
  ctx.sound('wood');
  yield* ctx.wait(0.4);
  ctx.onCleanup(() => {
    if (ctx.ch.held === 'log') ctx.hold(null);
  });

  ctx.step('Adding wood to the fire');
  const fire = w.fire;
  yield* ctx.goTo(fireRingPoint(w, ctx.ch, 1.2), { tolerance: 0.35 });
  ctx.face(w.campfire);
  ctx.anim('toss');
  yield* ctx.wait(0.55);
  ctx.hold(null);
  fire.fuel = Math.min(1.6, fire.fuel + 0.38);
  ctx.sound('log', w.campfire);
  w.sparks(1);
  yield* ctx.wait(0.5);
  if (!fire.lit) {
    ctx.step('Lighting the fire');
    ctx.hold('match');
    ctx.anim('strike');
    yield* ctx.wait(1.3);
    ctx.sound('match', w.campfire);
    fire.lit = true;
    ctx.hold(null);
    ctx.event('🔥', `${ctx.ch.name} lit the campfire`);
    yield* ctx.wait(0.6);
  }
  ctx.anim('idle');
  ctx.bump('fun', 0.03);
}

export const tendFire: ActivityDef = {
  id: 'tendFire',
  label: 'Add firewood',
  icon: '🪵',
  outdoor: true,
  menu: true,
  blocked(w) {
    const pile = w.first('woodpile');
    if (!pile || (pile.count ?? 0) <= 0) return 'The woodpile is empty';
    if (w.fire.fuel > 1.25) return 'The fire is already roaring';
    return null;
  },
  utility(w, ch) {
    const fire = w.fire;
    const evening = w.isNight() || w.env.time > 17 ? 1 : 0.35;
    const cold = 1 - ch.needs.warmth;
    let u = fire.fuel < 0.3 ? 1.35 : clamp(0.95 - fire.fuel) * 1.4;
    u *= evening;
    u += cold * 0.2;
    if (w.fire.pan && fire.fuel < 0.5) u += 0.5;
    return u * (1 - w.rain() * 0.4);
  },
  *run(ctx) {
    const extra = ctx.w.fire.fuel < 0.3 && (ctx.w.first('woodpile')?.count ?? 0) > 1 ? 2 : 1;
    for (let i = 0; i < extra; i++) yield* addLogRoutine(ctx);
    ctx.anim('look');
    ctx.lookAt(ctx.w.campfire);
    ctx.step('Watching the flames');
    yield* ctx.wait(2.5);
    ctx.lookAt(null);
    ctx.say('🔥');
  },
};

export const gatherWood: ActivityDef = {
  id: 'gatherWood',
  label: 'Gather firewood',
  icon: '🌲',
  outdoor: true,
  menu: true,
  blocked(w, _ch, p) {
    const pile = w.first('woodpile');
    if (pile && (pile.count ?? 0) >= 10) return 'The woodpile is full';
    if (p.objectId) {
      const o = w.obj(p.objectId);
      if (!o?.on) return 'Nothing left to collect here';
      return null;
    }
    if (!w.objects.some((o) => o.kind === 'branchSpot' && o.on)) return 'No fallen branches nearby right now';
    return null;
  },
  utility(w) {
    const count = w.first('woodpile')?.count ?? 0;
    let u = count < 3 ? ((3 - count) / 3) * 1.15 + 0.15 : count < 6 ? 0.18 : 0.04;
    if (w.isNight()) u *= 0.65;
    return u * (1 - w.rain() * 0.8);
  },
  *run(ctx, p) {
    const w = ctx.w;
    let spot: WorldObject | undefined = p.objectId ? w.obj(p.objectId) : undefined;
    if (!spot) {
      const free = nearestFreeSlot(
        w,
        ctx.ch,
        (o) => o.kind === 'branchSpot' && Boolean(o.on),
        () => true,
        ctx.ch.id,
      );
      spot = free?.o;
    }
    if (!spot || !spot.on) throw new ActivityFail('No fallen branches to gather');
    const s = spot.slots[0];
    if (!ctx.reserve(spot, s)) throw new ActivityFail('Someone is already gathering there');
    if (w.isNight()) ctx.hold('lantern');
    ctx.step('Looking for fallen branches');
    yield* ctx.goTo(slotApproach(spot, s), { tolerance: 0.4 });
    ctx.face(spot);
    ctx.anim('pickup');
    ctx.hold(null);
    yield* ctx.wait(1.6);
    if (!spot.on) throw new ActivityFail('The branches are gone');
    spot.on = false;
    spot.respawnAt = w.simTime + ctx.rng.range(140, 280);
    s.occupant = null;
    ctx.hold('branch');
    ctx.sound('wood');
    ctx.say('🪵');
    ctx.anim('idle');
    ctx.step('Carrying firewood back to camp');
    const pile = w.first('woodpile');
    if (!pile) return;
    yield* ctx.goTo(slotApproach(pile, pile.slots[0]), { tolerance: 0.45 });
    ctx.face(pile);
    ctx.anim('crouch');
    yield* ctx.wait(0.8);
    ctx.hold(null);
    pile.count = Math.min(10, (pile.count ?? 0) + 2);
    ctx.sound('wood');
    ctx.bump('fun', 0.05);
    ctx.anim('idle');
    yield* ctx.wait(0.4);
  },
};

/** Sit somewhere, warming up by the fire if close enough. */
export function* sitRoutine(ctx: Ctx, o: WorldObject, s: Slot, seconds: number, anim: 'sit' | 'sitDrink' = 'sit'): ActivityGen {
  const w = ctx.w;
  yield* ctx.enterSlot(o, s, anim);
  const byFire = Math.hypot(o.x - w.campfire.x, o.z - w.campfire.z) < FIRE_SEAT_RADIUS;
  ctx.step(byFire ? 'Relaxing by the fire' : `Relaxing on the ${o.name.toLowerCase()}`);
  let lookTimer = 4;
  yield* ctx.wait(seconds, (dt) => {
    ctx.gain('fun', 0.12, dt);
    ctx.gain('energy', 0.06, dt);
    lookTimer -= dt;
    if (lookTimer <= 0) {
      lookTimer = ctx.rng.range(4, 9);
      ctx.lookAt(byFire && ctx.rng.chance(0.6) ? w.campfire : null);
    }
  });
  ctx.lookAt(null);
}

export const sitFire: ActivityDef = {
  id: 'sitFire',
  label: 'Sit by the fire',
  icon: '🪑',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    return freeFireSeat(w, ch) ? null : 'All seats by the fire are taken';
  },
  utility(w, ch) {
    const fire = w.fire;
    const cold = 1 - ch.needs.warmth;
    let u = cold * 1.3 * (0.3 + fire.intensity) + (1 - ch.needs.social) * 0.5;
    if (w.env.time > 17 || w.env.time < 2) u += 0.25;
    if (w.isNight()) u += 0.15;
    if (!fire.lit) u *= 0.35;
    return u * (1 - w.rain() * 0.7);
  },
  *run(ctx) {
    const seat = freeFireSeat(ctx.w, ctx.ch);
    if (!seat) throw new ActivityFail('No free seat by the fire');
    yield* sitRoutine(ctx, seat.o, seat.s, ctx.run.byPlayer ? 900 : ctx.rng.range(24, 44));
  },
};

export const sit: ActivityDef = {
  id: 'sit',
  label: 'Sit down',
  icon: '🪑',
  outdoor: true,
  menu: false,
  blocked(w, ch, p) {
    const o = p.objectId ? w.obj(p.objectId) : undefined;
    if (o) return o.slots.some((s) => !s.occupant || s.occupant === ch.id) ? null : 'That seat is taken';
    return anySeat(w, ch) ? null : 'No free seats';
  },
  utility(w, ch) {
    // Enjoy the meadow bench or blanket now and then during the day.
    return w.daylight() > 0.4 ? 0.12 + (1 - ch.needs.energy) * 0.2 : 0.04;
  },
  *run(ctx, p) {
    const w = ctx.w;
    let target: { o: WorldObject; s: Slot } | null = null;
    if (p.objectId) {
      const o = w.obj(p.objectId);
      const s = o?.slots.find((x) => !x.occupant || x.occupant === ctx.ch.id);
      if (o && s) target = { o, s };
    } else if (!ctx.run.byPlayer) {
      target = nearestFreeSlot(
        w,
        ctx.ch,
        (o) => o.kind === 'bench' || o.kind === 'blanket',
        () => true,
        ctx.ch.id,
      );
    }
    target ??= anySeat(w, ctx.ch);
    if (!target) throw new ActivityFail('No free seats');
    yield* sitRoutine(ctx, target.o, target.s, ctx.run.byPlayer ? 900 : ctx.rng.range(20, 36));
  },
};

export const marshmallow: ActivityDef = {
  id: 'marshmallow',
  label: 'Toast marshmallows',
  icon: '🍡',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    if (!w.fire.lit || w.fire.intensity < 0.2) return 'Light the fire first';
    return freeFireSeat(w, ch) ? null : 'All seats by the fire are taken';
  },
  utility(w, ch) {
    const fire = w.fire;
    let u = (1 - ch.needs.fun) * 0.75 + (1 - ch.needs.hunger) * 0.2;
    if (w.isNight()) u += 0.3;
    return u * fire.intensity * (1 - w.rain() * 0.8);
  },
  *run(ctx) {
    const w = ctx.w;
    const seat = freeFireSeat(w, ctx.ch);
    if (!seat) throw new ActivityFail('No free seat by the fire');
    yield* ctx.enterSlot(seat.o, seat.s, 'sit');
    ctx.onCleanup(() => ctx.hold(null));
    const rounds = ctx.rng.int(2, 3);
    for (let i = 0; i < rounds; i++) {
      ctx.step('Toasting a marshmallow');
      ctx.hold('stick', 0);
      ctx.anim('sitRoast');
      ctx.lookAt(w.campfire);
      const done = yield* ctx.waitUntil(
        () => ctx.ch.heldState >= 1,
        30,
        (dt) => {
          ctx.ch.heldState = Math.min(1, ctx.ch.heldState + dt * 0.11 * (0.25 + w.fire.intensity));
          ctx.gain('warmth', 0.6 * w.fire.intensity, dt);
        },
      );
      ctx.lookAt(null);
      if (!done) break;
      ctx.step('Eating a toasty marshmallow');
      ctx.anim('sitEat');
      yield* ctx.wait(2.2);
      ctx.bump('hunger', 0.06);
      ctx.bump('fun', 0.12);
      ctx.say(ctx.rng.pick(['😋', '🍡', '✨']));
      ctx.anim('sit');
      yield* ctx.wait(1.2);
    }
    ctx.hold(null);
    yield* ctx.wait(ctx.rng.range(3, 6));
  },
};

export const cocoa: ActivityDef = {
  id: 'cocoa',
  label: 'Make hot cocoa',
  icon: '☕',
  outdoor: true,
  menu: true,
  blocked(w) {
    if (!w.fire.lit && w.fire.kettleHeat < 0.4) return 'The kettle needs a fire';
    return null;
  },
  utility(w, ch) {
    let u = (1 - ch.needs.warmth) * 1.05;
    if (w.env.temperature < 10) u += 0.25;
    if (w.env.time > 6 && w.env.time < 10) u += 0.35;
    if (ch.recent.includes('cocoa')) u *= 0.5;
    return u;
  },
  *run(ctx) {
    const w = ctx.w;
    ctx.step('Heading to the kettle');
    yield* ctx.goTo(fireRingPoint(w, { x: w.campfire.x - 3, z: w.campfire.z + 0.4 }, 1.15), { tolerance: 0.35 });
    ctx.face(w.campfire);
    if (w.fire.kettleHeat < 0.45) {
      ctx.step('Waiting for the kettle to warm up');
      ctx.anim('idle');
      const warm = yield* ctx.waitUntil(() => w.fire.kettleHeat >= 0.45, 30);
      if (!warm) throw new ActivityFail('The kettle never warmed up');
    }
    ctx.step('Pouring hot cocoa');
    ctx.anim('pour');
    ctx.hold('mug', 0);
    ctx.onCleanup(() => ctx.hold(null));
    yield* ctx.wait(1.8);
    ctx.sound('pour');
    ctx.ch.heldState = 1;
    ctx.anim('idle');
    const seat = anySeat(w, ctx.ch);
    const sipping = ctx.run.byPlayer ? 60 : ctx.rng.range(16, 24);
    if (seat) {
      yield* ctx.enterSlot(seat.o, seat.s, 'sitDrink');
      ctx.step('Sipping hot cocoa');
      yield* ctx.wait(sipping, (dt) => {
        ctx.gain('warmth', 1.4, dt);
        ctx.gain('fun', 0.25, dt);
      });
    } else {
      ctx.step('Sipping hot cocoa');
      ctx.anim('eatStand');
      yield* ctx.wait(sipping * 0.6, (dt) => ctx.gain('warmth', 1.4, dt));
    }
    ctx.say('☕');
    ctx.hold(null);
  },
};

export const CAMPFIRE_ACTIVITIES = [tendFire, gatherWood, sitFire, sit, marshmallow, cocoa];

export type { ActParams };
