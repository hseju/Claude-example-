import { slotApproach } from '../objects';
import type { ActivityGen, FoodKind } from '../types';
import type { World } from '../world';
import { addLogRoutine, anySeat } from './campfire';
import { ActivityFail, Ctx, type ActivityDef } from './core';

export const FOOD_NAMES: Record<FoodKind, string> = {
  stew: 'veggie stew',
  sausages: 'campfire sausages',
  fish: 'grilled fish',
};

const MEAL_TIMES: [number, number][] = [
  [7, 9.5],
  [12, 14],
  [18, 22],
];

const isMealTime = (t: number) => MEAL_TIMES.some(([a, b]) => t >= a && t < b);

function avgHungerDeficit(w: World): number {
  const awake = w.characters.filter((c) => c.activity?.id !== 'sleep');
  if (!awake.length) return 0;
  return awake.reduce((s, c) => s + (1 - c.needs.hunger), 0) / awake.length;
}

/** Take a plate from the table, find a seat and eat. */
function* eatRoutine(ctx: Ctx): ActivityGen {
  const w = ctx.w;
  const table = w.first('prepTable');
  if (!table?.prep || table.prep.plates <= 0) throw new ActivityFail('There is no food ready');
  ctx.step('Grabbing a plate');
  yield* ctx.goTo(slotApproach(table, table.slots[0]), { tolerance: 0.7 });
  ctx.face(table);
  ctx.anim('pickup');
  yield* ctx.wait(0.6);
  if (table.prep.plates <= 0) throw new ActivityFail('Someone took the last plate');
  table.prep.plates -= 1;
  const food = table.prep.plateFood;
  ctx.hold('bowl', 1);
  ctx.ch.heldMeta = food;
  ctx.onCleanup(() => ctx.hold(null));
  ctx.anim('idle');
  const seat = anySeat(w, ctx.ch);
  const duration = 12;
  if (seat) {
    yield* ctx.enterSlot(seat.o, seat.s, 'sitEat');
  } else {
    ctx.anim('eatStand');
  }
  ctx.step(`Eating ${FOOD_NAMES[food]}`);
  ctx.say('😋');
  yield* ctx.wait(duration, (dt) => {
    ctx.ch.needs.hunger = Math.min(1, ctx.ch.needs.hunger + (0.62 * dt) / duration);
    ctx.gain('warmth', 0.5, dt);
    ctx.gain('fun', 0.2, dt);
  });
  ctx.hold(null);
  ctx.say(ctx.rng.pick(['😊', '🍲', '💛']));
  if (seat) {
    ctx.anim('sit');
    yield* ctx.wait(ctx.rng.range(3, 7));
  }
}

export const cook: ActivityDef = {
  id: 'cook',
  label: 'Cook a meal',
  icon: '🍳',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    const table = w.first('prepTable');
    if (!table?.prep) return 'There is no cooking table';
    if (w.characters.some((c) => c !== ch && c.activity?.id === 'cook')) return 'Someone is already cooking';
    const pan = w.fire.pan;
    const cookSlot = w.campfire.slots.find((s) => s.id === 'cook');
    if (pan && cookSlot?.occupant && cookSlot.occupant !== ch.id) return 'Someone is already cooking';
    if (table.slots[0].occupant && table.slots[0].occupant !== ch.id) return 'Someone is using the cooking table';
    if (!pan && table.prep.plates >= 2) return 'There is food ready to eat';
    if (!w.fire.lit && (w.first('woodpile')?.count ?? 0) <= 0) return 'The fire is out and there is no firewood';
    return null;
  },
  utility(w, ch) {
    let u = (1 - ch.needs.hunger) * 1.15 + avgHungerDeficit(w) * 0.5;
    if (isMealTime(w.env.time)) u += 0.35;
    if (w.fire.pan) u += 0.6; // finish what someone started
    if (!w.fire.lit) u *= 0.6;
    return u * (1 - w.rain() * 0.5);
  },
  *run(ctx) {
    const w = ctx.w;
    const table = w.first('prepTable')!;
    const prep = table.prep!;
    const fire = w.fire;

    if (!fire.lit || fire.fuel < 0.25) yield* addLogRoutine(ctx);

    let food: FoodKind;
    if (fire.pan) {
      food = fire.pan.food;
    } else {
      const bucket = w.first('fishBucket');
      const canFish = (bucket?.count ?? 0) > 0;
      const choice = yield* ctx.choose(
        'What should we cook?',
        [
          { id: 'stew', label: '🍲 Veggie stew' },
          { id: 'sausages', label: '🌭 Sausages' },
          ...(canFish ? [{ id: 'fish', label: '🐟 Grilled fish' }] : []),
        ],
        canFish && ctx.rng.chance(0.6) ? 'fish' : ctx.rng.pick(['stew', 'sausages']),
      );
      food = choice as FoodKind;

      if (food === 'fish' && bucket) {
        ctx.step('Fetching a fish from the bucket');
        yield* ctx.goTo(slotApproach(bucket, bucket.slots[0]), { tolerance: 0.4 });
        ctx.face(bucket);
        ctx.anim('crouch');
        yield* ctx.wait(0.8);
        if ((bucket.count ?? 0) <= 0) {
          food = 'stew';
        } else {
          bucket.count = (bucket.count ?? 1) - 1;
          ctx.hold('fish', 0.5);
          ctx.ch.heldMeta = '#d9a066';
        }
        ctx.anim('idle');
      } else {
        const box = w.first('supplyBox');
        if (box) {
          ctx.step('Getting ingredients');
          yield* ctx.goTo(slotApproach(box, box.slots[0]), { tolerance: 0.5 });
          ctx.face(box);
          ctx.anim('crouch');
          yield* ctx.wait(1.0);
          ctx.sound('box');
          ctx.anim('idle');
        }
      }

      // Prepare ingredients on the table.
      ctx.step(`Preparing ${FOOD_NAMES[food]}`);
      yield* ctx.enterSlot(table, table.slots[0], 'chop');
      ctx.hold('knife');
      prep.food = food;
      prep.progress = 0;
      ctx.onCleanup(() => {
        if (prep.food && !fire.pan) prep.food = null;
      });
      let chopTimer = 0;
      yield* ctx.wait(5.5, (dt) => {
        prep.progress = Math.min(1, prep.progress + dt / 5.5);
        chopTimer -= dt;
        if (chopTimer <= 0) {
          chopTimer = 0.45;
          ctx.sound('chop', table);
        }
      });
      yield* ctx.leaveSlot(table, table.slots[0]);
      prep.food = null;
      ctx.hold('pan', 0);
      ctx.ch.heldMeta = food;
    }

    // Cook over the fire.
    const cookSlot = w.campfire.slots.find((s) => s.id === 'cook')!;
    ctx.step(`Cooking ${FOOD_NAMES[food]}`);
    yield* ctx.enterSlot(w.campfire, cookSlot, 'stir');
    if (!fire.pan) {
      fire.pan = { food, doneness: 0 };
      ctx.sound('sizzle', w.campfire);
    }
    ctx.hold(null);
    ctx.lookAt(w.campfire);
    const cooked = yield* ctx.waitUntil(
      () => (fire.pan?.doneness ?? 0) >= 1,
      75,
      (dt) => {
        ctx.gain('warmth', 0.8 * fire.intensity, dt);
        ctx.gain('fun', 0.15, dt);
      },
    );
    ctx.lookAt(null);
    if (!cooked || !fire.pan) throw new ActivityFail('The fire was too low to cook');

    // Serve.
    ctx.step('Serving the food');
    fire.pan = null;
    ctx.hold('pan', 1);
    ctx.ch.heldMeta = food;
    yield* ctx.leaveSlot(w.campfire, cookSlot);
    yield* ctx.goTo(slotApproach(table, table.slots[0]), { tolerance: 0.6 });
    ctx.face(table);
    ctx.anim('pour');
    yield* ctx.wait(1.4);
    prep.plates = Math.min(4, prep.plates + 3);
    prep.plateFood = food;
    ctx.hold(null);
    ctx.anim('wave');
    ctx.say('🍲', 'Food is ready!', 4);
    ctx.event('🍲', `${ctx.ch.name} cooked ${FOOD_NAMES[food]} for everyone`);
    w.mealCalledAt = w.simTime;
    ctx.bump('fun', 0.15);
    yield* ctx.wait(1.2);

    if (ctx.ch.needs.hunger < 0.85) yield* eatRoutine(ctx);
  },
};

export const eat: ActivityDef = {
  id: 'eat',
  label: 'Have a meal',
  icon: '🍲',
  outdoor: true,
  menu: true,
  blocked(w) {
    const table = w.first('prepTable');
    return table?.prep && table.prep.plates > 0 ? null : 'Nothing has been cooked yet';
  },
  utility(w, ch) {
    let u = (1 - ch.needs.hunger) * 1.8 + 0.2;
    if (w.simTime - w.mealCalledAt < 60) u += 0.6;
    if (ch.needs.hunger > 0.9) u *= 0.15;
    return u;
  },
  run: (ctx) => eatRoutine(ctx),
};

export const COOKING_ACTIVITIES = [cook, eat];
