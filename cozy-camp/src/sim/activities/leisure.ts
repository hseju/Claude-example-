import { headingTo, type V2 } from '../math';
import { slotApproach } from '../objects';
import type { Animal, Character, CollectibleKind, WorldObject } from '../types';
import type { World } from '../world';
import { anySeat } from './campfire';
import { ActivityFail, Ctx, nearestFreeSlot, type ActivityDef } from './core';

const COLLECT_ICON: Record<CollectibleKind, string> = {
  pinecone: '🌰',
  flower: '🌼',
  mushroom: '🍄',
  stone: '🪨',
};

const ANIMAL_ICON: Record<Animal['kind'], string> = {
  rabbit: '🐇',
  deer: '🦌',
  owl: '🦉',
  squirrel: '🐿️',
};

const ANIMAL_NAME: Record<Animal['kind'], string> = {
  rabbit: 'a rabbit',
  deer: 'a deer',
  owl: 'an owl',
  squirrel: 'a squirrel',
};

export const hammock: ActivityDef = {
  id: 'hammock',
  label: 'Relax in the hammock',
  icon: '🌿',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    const h = w.first('hammock');
    if (!h) return 'There is no hammock';
    return h.slots[0].occupant && h.slots[0].occupant !== ch.id ? 'Someone is in the hammock' : null;
  },
  utility(w, ch) {
    let u = (1 - ch.needs.energy) * 0.5 + (1 - ch.needs.fun) * 0.5 + 0.12;
    if (w.daylight() < 0.3) u *= 0.6;
    return u * (1 - w.rain());
  },
  *run(ctx) {
    const h = ctx.w.first('hammock')!;
    ctx.step('Walking to the hammock');
    yield* ctx.enterSlot(h, h.slots[0], 'hammock');
    ctx.step('Swaying in the hammock');
    const duration = ctx.run.byPlayer ? 900 : ctx.rng.range(28, 48);
    let doze = false;
    yield* ctx.wait(duration, (dt) => {
      ctx.gain('energy', 0.35, dt);
      ctx.gain('fun', 0.35, dt);
      if (!doze && ctx.ch.needs.energy < 0.4 && ctx.w.isNight()) {
        doze = true;
        ctx.ch.expression = 'sleepy';
        ctx.step('Dozing in the hammock');
        ctx.say('💤', undefined, 5);
      }
    });
    ctx.ch.expression = 'happy';
  },
};

export const stargaze: ActivityDef = {
  id: 'stargaze',
  label: 'Look through the telescope',
  icon: '🔭',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    const t = w.first('telescope');
    if (!t) return 'There is no telescope';
    if (w.daylight() > 0.35) return 'Wait for the night sky';
    if (w.env.mix.cloud > 0.7 || w.env.mix.fog > 0.75) return 'Too cloudy to see the stars';
    if (t.slots[0].occupant && t.slots[0].occupant !== ch.id) return 'Someone is using the telescope';
    return null;
  },
  utility(w, ch) {
    if (w.daylight() > 0.3) return 0;
    return ((1 - ch.needs.fun) * 1.0 + 0.45) * (1 - w.env.mix.cloud);
  },
  *run(ctx) {
    const w = ctx.w;
    const t = w.first('telescope')!;
    ctx.step('Walking to the telescope');
    yield* ctx.enterSlot(t, t.slots[0], 'telescope');
    ctx.step('Stargazing through the telescope');
    const duration = ctx.run.byPlayer ? 40 : ctx.rng.range(15, 26);
    let wonder = 3;
    let spotted = false;
    yield* ctx.wait(duration, (dt) => {
      ctx.gain('fun', 0.9, dt);
      wonder -= dt;
      if (wonder <= 0) {
        wonder = ctx.rng.range(4, 7);
        ctx.say(ctx.rng.pick(['✨', '🌙', '🪐', '⭐']), undefined, 2.5);
        if (!spotted && ctx.rng.chance(0.3)) {
          spotted = true;
          w.shootingStar();
          ctx.say('🌠', 'A shooting star!', 3);
          ctx.event('🌠', `${ctx.ch.name} spotted a shooting star`);
          ctx.bump('fun', 0.1);
        }
      }
    });
  },
};

export const skywatch: ActivityDef = {
  id: 'skywatch',
  label: 'Lie on the blanket',
  icon: '🧺',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    return nearestFreeSlot(
      w,
      ch,
      (o) => o.kind === 'blanket',
      () => true,
      ch.id,
    )
      ? null
      : 'The blanket is full';
  },
  utility(w, ch) {
    let u = (1 - ch.needs.fun) * 0.55 + (1 - ch.needs.energy) * 0.2;
    if (w.isNight() && w.env.mix.cloud < 0.5) u += 0.3;
    return u * (1 - w.rain());
  },
  *run(ctx) {
    const w = ctx.w;
    const spot = nearestFreeSlot(
      w,
      ctx.ch,
      (o) => o.kind === 'blanket',
      () => true,
      ctx.ch.id,
    );
    if (!spot) throw new ActivityFail('The blanket is full');
    ctx.step('Heading to the picnic blanket');
    yield* ctx.enterSlot(spot.o, spot.s, 'sit');
    yield* ctx.wait(2);
    ctx.anim('lie');
    ctx.ch.lookUp = 1;
    ctx.onCleanup(() => (ctx.ch.lookUp = 0));
    const night = w.isNight();
    ctx.step(night ? 'Counting stars from the blanket' : 'Watching the clouds drift by');
    let t = 4;
    yield* ctx.wait(ctx.run.byPlayer ? 900 : ctx.rng.range(22, 36), (dt) => {
      ctx.gain('fun', 0.5, dt);
      ctx.gain('energy', 0.2, dt);
      t -= dt;
      if (t <= 0) {
        t = ctx.rng.range(6, 10);
        ctx.say(night ? ctx.rng.pick(['⭐', '✨', '🌙']) : ctx.rng.pick(['☁️', '🌤️', '🦋']), undefined, 2.5);
      }
    });
    ctx.ch.lookUp = 0;
    ctx.anim('sit');
    yield* ctx.wait(1.2);
  },
};

function awakeOthers(w: World, ch: Character): Character[] {
  return w.characters.filter(
    (c) => c.id !== ch.id && c.activity?.id !== 'sleep' && !(c.activity?.id === 'shelter' && c.pinned) && !c.chatPartner,
  );
}

export const chat: ActivityDef = {
  id: 'chat',
  label: 'Chat with someone',
  icon: '💬',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    return awakeOthers(w, ch).length ? null : 'Everyone else is asleep';
  },
  utility(w, ch) {
    return awakeOthers(w, ch).length ? (1 - ch.needs.social) * 1.25 + 0.05 : 0;
  },
  *run(ctx) {
    const w = ctx.w;
    const others = awakeOthers(w, ctx.ch).sort(
      (a, b) => Math.hypot(a.x - ctx.ch.x, a.z - ctx.ch.z) - Math.hypot(b.x - ctx.ch.x, b.z - ctx.ch.z),
    );
    const partner = others[0];
    if (!partner) throw new ActivityFail('Nobody to talk to');
    ctx.step(`Walking over to ${partner.name}`);

    // Walk up to them, re-targeting if they move.
    for (let i = 0; i < 4; i++) {
      const toMe = headingTo(partner, ctx.ch);
      const spot = w.nav.nearestWalkable(partner.x + Math.sin(toMe) * 1.0, partner.z + Math.cos(toMe) * 1.0, 3);
      if (!spot) throw new ActivityFail(`Can't reach ${partner.name}`);
      yield* ctx.goTo(spot, { tolerance: 0.5 });
      if (Math.hypot(partner.x - ctx.ch.x, partner.z - ctx.ch.z) < 1.8) break;
    }
    if (Math.hypot(partner.x - ctx.ch.x, partner.z - ctx.ch.z) > 2.6) throw new ActivityFail(`${partner.name} wandered off`);

    // If they are seated, take a seat nearby when there is one.
    let seated = false;
    if (partner.pinned) {
      const seat = anySeat(w, ctx.ch, partner);
      if (seat && Math.hypot(seat.o.x - partner.x, seat.o.z - partner.z) < 2.6) {
        yield* ctx.enterSlot(seat.o, seat.s, 'sitChat');
        seated = true;
      }
    } else if (partner.controller === 'ai' && (!partner.activity || partner.activity.id === 'wander')) {
      w.startActivity(partner, 'chatListen', { params: { target: { x: ctx.ch.x, z: ctx.ch.z } } });
    }

    ctx.ch.chatPartner = partner.id;
    partner.chatPartner = ctx.ch.id;
    ctx.onCleanup(() => {
      ctx.ch.chatPartner = null;
      if (partner.chatPartner === ctx.ch.id) partner.chatPartner = null;
    });
    ctx.step(`Chatting with ${partner.name}`);
    if (!seated) {
      ctx.face(partner);
      ctx.anim('wave');
      yield* ctx.wait(1.0);
      ctx.anim('talk');
    }
    let turn = 0;
    const topics = ['💬', '😄', '🌙', '⭐', '🎵', '🐟', '🍲', '🌲', '🔥', '🦉'];
    yield* ctx.wait(ctx.rng.range(10, 16), (dt) => {
      ctx.gain('social', 1.6, dt);
      ctx.gain('fun', 0.3, dt);
      partner.needs.social = Math.min(1, partner.needs.social + (1.4 * dt) / 60);
      if (!seated) ctx.face(partner);
      turn -= dt;
      if (turn <= 0) {
        turn = ctx.rng.range(2, 3.5);
        const speaker = ctx.rng.chance(0.5) ? ctx.ch : partner;
        speaker.bubble = { icon: ctx.rng.pick(topics), until: w.simTime + 2.2 };
        speaker.expression = 'talk';
        const other = speaker === ctx.ch ? partner : ctx.ch;
        other.expression = 'happy';
      }
    });
    ctx.ch.expression = 'happy';
    partner.expression = 'happy';
    if (!seated) {
      ctx.anim('wave');
      yield* ctx.wait(1);
    }
  },
};

/** Internal: stand and listen when someone comes over to chat. */
export const chatListen: ActivityDef = {
  id: 'chatListen',
  label: 'Chatting',
  icon: '💬',
  outdoor: true,
  menu: false,
  blocked: () => null,
  utility: () => 0,
  *run(ctx, p) {
    ctx.w.stopMoving(ctx.ch);
    if (p.target) ctx.face(p.target);
    ctx.step('Chatting');
    ctx.anim('talk');
    yield* ctx.waitUntil(() => ctx.ch.chatPartner !== null, 4);
    yield* ctx.waitUntil(
      () => ctx.ch.chatPartner === null,
      25,
      () => {
        const partner = ctx.ch.chatPartner ? ctx.w.char(ctx.ch.chatPartner) : undefined;
        if (partner) ctx.face(partner);
      },
    );
    ctx.anim('wave');
    yield* ctx.wait(0.8);
  },
};

export const wander: ActivityDef = {
  id: 'wander',
  label: 'Stroll around camp',
  icon: '🚶',
  outdoor: true,
  menu: false,
  blocked: () => null,
  utility(w, ch) {
    return (0.12 + (1 - ch.needs.fun) * 0.1) * (1 - w.rain() * 0.8);
  },
  *run(ctx) {
    const w = ctx.w;
    const center = Math.hypot(ctx.ch.x, ctx.ch.z) > 9 ? { x: 0, z: 0 } : ctx.ch;
    const p = w.terrain.randomWalkable(ctx.rng, center.x, center.z, 5);
    if (!p) return;
    ctx.step('Strolling around camp');
    yield* ctx.goTo(p, { tolerance: 0.6 });
    ctx.step('Taking in the view');
    ctx.anim('look');
    const a = ctx.rng.range(0, Math.PI * 2);
    ctx.lookAt({ x: ctx.ch.x + Math.sin(a) * 5, z: ctx.ch.z + Math.cos(a) * 5 });
    yield* ctx.wait(ctx.rng.range(3, 6));
    ctx.lookAt(null);
    if (ctx.rng.chance(0.3)) {
      ctx.anim('stretch');
      yield* ctx.wait(2);
    }
  },
};

function* collectRoutine(ctx: Ctx, item: WorldObject): Generator<void, boolean, number> {
  const w = ctx.w;
  if (!item.on || !item.collectible) return false;
  const s = item.slots[0];
  if (s.occupant && s.occupant !== ctx.ch.id) return false;
  if (!ctx.reserve(item, s)) return false;
  ctx.step(`Picking up a ${item.name.toLowerCase()}`);
  yield* ctx.goTo(slotApproach(item, s), { tolerance: 0.4 });
  ctx.face(item);
  ctx.anim('pickup');
  const keep = ctx.ch.held;
  yield* ctx.wait(1.0);
  if (!item.on) return false;
  item.on = false;
  item.respawnAt = w.simTime + ctx.rng.range(200, 400);
  s.occupant = null;
  ctx.ch.pockets.push(item.collectible);
  ctx.hold(item.collectible, 0);
  ctx.say(COLLECT_ICON[item.collectible]);
  ctx.bump('fun', 0.08);
  ctx.anim('idle');
  yield* ctx.wait(1.2);
  ctx.hold(keep);
  return true;
}

function* depositFinds(ctx: Ctx): Generator<void, void, number> {
  const w = ctx.w;
  const basket = w.first('basket');
  if (!basket?.basket || !ctx.ch.pockets.length) return;
  ctx.step('Adding finds to the nature basket');
  yield* ctx.goTo(slotApproach(basket, basket.slots[0]), { tolerance: 0.5 });
  ctx.face(basket);
  ctx.anim('crouch');
  yield* ctx.wait(1);
  const n = ctx.ch.pockets.length;
  for (const k of ctx.ch.pockets) basket.basket[k] += 1;
  ctx.ch.pockets = [];
  ctx.event('🧺', `${ctx.ch.name} added ${n} nature ${n === 1 ? 'find' : 'finds'} to the basket`);
  ctx.anim('idle');
}

function nearestAnimal(w: World, at: V2, radius: number): Animal | null {
  let best: Animal | null = null;
  let bestD = radius;
  for (const a of w.animals) {
    const d = Math.hypot(a.x - at.x, a.z - at.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export const explore: ActivityDef = {
  id: 'explore',
  label: 'Explore the trails',
  icon: '🧭',
  outdoor: true,
  menu: true,
  blocked(w) {
    return w.env.mix.storm > 0.6 ? 'Too stormy to go exploring' : null;
  },
  utility(w, ch) {
    let u = (1 - ch.needs.fun) * 0.8 + 0.18;
    if (w.daylight() < 0.4) u *= 0.45;
    if (w.env.time > 0.5 && w.env.time < 5) u *= 0.2;
    return u * (1 - w.rain() * 0.85);
  },
  *run(ctx, p) {
    const w = ctx.w;
    const night = w.isNight();
    if (night) ctx.hold('lantern');
    ctx.onCleanup(() => {
      if (ctx.ch.held === 'lantern') ctx.hold(null);
    });
    const spots = [...w.def.viewpoints].sort(() => ctx.rng.next() - 0.5).slice(0, p.target ? 1 : ctx.rng.int(1, 2));
    const route = p.target ? [{ x: p.target.x, z: p.target.z, label: 'there', look: p.target }] : spots;
    const seen = new Set<string>();

    for (const vp of route) {
      ctx.step(`Exploring: ${vp.label}`);
      yield* ctx.goTo(vp, { tolerance: 1.0 });
      ctx.face(vp.look);
      ctx.anim('look');
      ctx.lookAt(vp.look);
      yield* ctx.wait(ctx.rng.range(3.5, 6), (dt) => ctx.gain('fun', 0.5, dt));
      ctx.lookAt(null);

      const animal = nearestAnimal(w, ctx.ch, 9);
      if (animal && !seen.has(animal.id)) {
        seen.add(animal.id);
        ctx.step(`Watching ${ANIMAL_NAME[animal.kind]}`);
        ctx.face(animal);
        ctx.lookAt(animal);
        ctx.say(ANIMAL_ICON[animal.kind], undefined, 3);
        yield* ctx.wait(3);
        ctx.lookAt(null);
        ctx.bump('fun', 0.1);
        if (ctx.rng.chance(0.5)) ctx.event(ANIMAL_ICON[animal.kind], `${ctx.ch.name} spotted ${ANIMAL_NAME[animal.kind]}`);
      }

      // Pick up a nature find if one is close by.
      const find = nearestFreeSlot(
        w,
        ctx.ch,
        (o) => o.kind === 'collectible' && Boolean(o.on),
        () => true,
        ctx.ch.id,
      );
      if (find && Math.hypot(find.o.x - ctx.ch.x, find.o.z - ctx.ch.z) < 7) yield* collectRoutine(ctx, find.o);
    }
    yield* depositFinds(ctx);
  },
};

export const collect: ActivityDef = {
  id: 'collect',
  label: 'Collect nature finds',
  icon: '🍄',
  outdoor: true,
  menu: true,
  blocked(w, _ch, p) {
    if (p.objectId) return w.obj(p.objectId)?.on ? null : 'Already collected';
    return w.objects.some((o) => o.kind === 'collectible' && o.on) ? null : 'Nothing to collect right now';
  },
  utility(w, ch) {
    return w.daylight() > 0.4 ? (1 - ch.needs.fun) * 0.35 : 0.05;
  },
  *run(ctx, p) {
    const w = ctx.w;
    if (w.isNight()) ctx.hold('lantern');
    ctx.onCleanup(() => {
      if (ctx.ch.held === 'lantern') ctx.hold(null);
    });
    const first = p.objectId ? w.obj(p.objectId) : undefined;
    let got = 0;
    if (first) {
      if (yield* collectRoutine(ctx, first)) got++;
    }
    while (got < (first ? 1 : 3)) {
      const find = nearestFreeSlot(
        w,
        ctx.ch,
        (o) => o.kind === 'collectible' && Boolean(o.on),
        () => true,
        ctx.ch.id,
      );
      if (!find) break;
      if (yield* collectRoutine(ctx, find.o)) got++;
      else break;
    }
    if (!got) throw new ActivityFail('Nothing left to collect');
    yield* depositFinds(ctx);
  },
};

export const walk: ActivityDef = {
  id: 'walk',
  label: 'Walk',
  icon: '👣',
  outdoor: true,
  menu: false,
  blocked: () => null,
  utility: () => 0,
  *run(ctx, p) {
    if (!p.target) return;
    ctx.step('Walking');
    yield* ctx.goTo(p.target, { tolerance: 0.3 });
    ctx.anim('idle');
    ctx.step('Looking around');
    yield* ctx.wait(1.5);
  },
};

export const toggleLantern: ActivityDef = {
  id: 'toggleLantern',
  label: 'Switch lantern',
  icon: '🏮',
  outdoor: true,
  menu: false,
  blocked: (w, _ch, p) => (p.objectId && w.obj(p.objectId)?.kind === 'lantern' ? null : 'Pick a lantern'),
  utility: () => 0,
  *run(ctx, p) {
    const lantern = p.objectId ? ctx.w.obj(p.objectId) : undefined;
    if (!lantern) return;
    ctx.step(lantern.on ? 'Turning off the lantern' : 'Lighting the lantern');
    yield* ctx.goTo(slotApproach(lantern, lantern.slots[0]), { tolerance: 0.45 });
    ctx.face(lantern);
    ctx.anim('pickup');
    yield* ctx.wait(0.7);
    lantern.on = !lantern.on;
    ctx.sound('click', lantern);
    ctx.anim('idle');
    yield* ctx.wait(0.4);
  },
};

export const LEISURE_ACTIVITIES = [hammock, stargaze, skywatch, chat, chatListen, wander, explore, collect, walk, toggleLantern];
