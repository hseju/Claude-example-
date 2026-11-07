import { slotApproach, slotPose } from '../objects';
import type { Fish } from '../types';
import { ActivityFail, nearestFreeSlot, type ActivityDef } from './core';

export const fish: ActivityDef = {
  id: 'fish',
  label: 'Go fishing',
  icon: '🎣',
  outdoor: true,
  menu: true,
  blocked(w, ch) {
    if (!w.def.lake) return 'There is no lake here';
    if (w.env.mix.storm > 0.6) return 'Too stormy to fish';
    const free = nearestFreeSlot(w, ch, (o) => o.kind === 'dock', (s) => s.kind === 'fish', ch.id);
    return free ? null : 'Both fishing spots are taken';
  },
  utility(w, ch) {
    let u = (1 - ch.needs.fun) * 0.9 + 0.15;
    const t = w.env.time;
    if ((t > 5 && t < 8) || (t > 19 && t < 23)) u += 0.2; // fish bite at dawn and dusk
    if ((w.first('fishBucket')?.count ?? 0) >= 5) u *= 0.4;
    if (t > 0.5 && t < 5) u *= 0.3;
    return u * (1 - w.rain() * 0.7);
  },
  *run(ctx) {
    const w = ctx.w;
    const spot = nearestFreeSlot(w, ctx.ch, (o) => o.kind === 'dock', (s) => s.kind === 'fish', ctx.ch.id);
    if (!spot) throw new ActivityFail('Both fishing spots are taken');
    ctx.step('Walking to the dock');
    yield* ctx.enterSlot(spot.o, spot.s, 'idle');
    ctx.hold('rod');
    ctx.onCleanup(() => {
      w.removeBobber(ctx.ch);
      if (ctx.ch.held === 'rod' || ctx.ch.held === 'fish') ctx.hold(null);
    });

    const pose = slotPose(spot.o, spot.s);
    const fwd = { x: Math.sin(pose.rot), z: Math.cos(pose.rot) };
    const side = { x: fwd.z, z: -fwd.x };
    let caught: Fish | null = null;

    for (let cast = 0; cast < 3 && !caught; cast++) {
      ctx.step('Casting the line');
      ctx.anim('cast');
      yield* ctx.wait(0.55);
      let dist = ctx.rng.range(3, 5.5);
      const lateral = ctx.rng.range(-1.4, 1.4);
      let target = { x: pose.x + fwd.x * dist + side.x * lateral, z: pose.z + fwd.z * dist + side.z * lateral };
      while (w.terrain.lakeRadius(target.x, target.z) > 0.82 && dist > 1.5) {
        dist -= 0.5;
        target = { x: pose.x + fwd.x * dist + side.x * lateral, z: pose.z + fwd.z * dist + side.z * lateral };
      }
      const bobber = w.castBobber(ctx.ch, target);
      ctx.sound('cast');
      yield* ctx.wait(0.9);
      ctx.sound('plop', target);
      w.addRipple(target.x, target.z, 0.6);

      ctx.step('Waiting for a bite');
      ctx.anim('fishIdle');
      const bit = yield* ctx.waitUntil(() => bobber.biteFish !== null, ctx.rng.range(16, 28), (dt) => {
        ctx.gain('fun', 0.25, dt);
      });
      if (!bit || !bobber.biteFish) {
        ctx.step('Reeling in, no luck this time');
        ctx.anim('reel');
        yield* ctx.wait(1.2, (dt) => {
          bobber.x += (pose.x - bobber.x) * Math.min(1, dt * 2);
          bobber.z += (pose.z - bobber.z) * Math.min(1, dt * 2);
        });
        w.removeBobber(ctx.ch);
        continue;
      }

      const f = w.fishById(bobber.biteFish);
      if (!f) {
        w.removeBobber(ctx.ch);
        continue;
      }
      ctx.step('Fish on!');
      ctx.say('❗', undefined, 1.5);
      ctx.ch.expression = 'surprised';
      ctx.sound('splash', bobber);
      w.addRipple(bobber.x, bobber.z, 1);
      f.state = 'hooked';
      ctx.anim('reel');
      let splashTimer = 0;
      yield* ctx.wait(3.2, (dt) => {
        const k = Math.min(1, dt * 0.9);
        bobber.x += (pose.x + fwd.x * 0.8 - bobber.x) * k;
        bobber.z += (pose.z + fwd.z * 0.8 - bobber.z) * k;
        f.x = bobber.x;
        f.z = bobber.z;
        splashTimer -= dt;
        if (splashTimer <= 0) {
          splashTimer = 0.6;
          w.addRipple(f.x, f.z, 0.5);
        }
      });
      w.removeBobber(ctx.ch);
      w.catchFish(f);
      caught = f;
      ctx.hold('fish', f.size / 40);
      ctx.ch.heldMeta = f.color;
      ctx.ch.expression = 'happy';
      ctx.anim('showOff');
      ctx.sound('cheer');
      ctx.say('🐟');
      ctx.event('🐟', `${ctx.ch.name} caught a ${f.size} cm ${f.species}!`);
      ctx.bump('fun', 0.25);
      yield* ctx.wait(1.8);
    }

    if (!caught) {
      ctx.hold(null);
      ctx.say('🎣');
      return;
    }

    const bucket = w.first('fishBucket');
    const keep = yield* ctx.choose(
      `Keep the ${caught.species} or let it go?`,
      [
        { id: 'keep', label: '🪣 Keep for dinner' },
        { id: 'release', label: '💙 Release it' },
      ],
      (bucket?.count ?? 0) < 5 && ctx.rng.chance(0.65) ? 'keep' : 'release',
    );

    if (keep === 'keep' && bucket) {
      yield* ctx.leaveSlot(spot.o, spot.s);
      ctx.step('Putting the fish in the bucket');
      yield* ctx.goTo(slotApproach(bucket, bucket.slots[0]), { tolerance: 0.4 });
      ctx.face(bucket);
      ctx.anim('crouch');
      yield* ctx.wait(0.8);
      bucket.count = (bucket.count ?? 0) + 1;
      w.storeFish(caught);
      ctx.sound('splash', bucket);
      ctx.hold(null);
    } else {
      ctx.step('Releasing the fish');
      ctx.anim('crouch');
      yield* ctx.wait(0.9);
      const at = { x: pose.x + fwd.x * 0.9, z: pose.z + fwd.z * 0.9 };
      w.releaseFish(caught, at);
      ctx.sound('splash', at);
      ctx.hold(null);
      ctx.say('💙');
      ctx.anim('idle');
      yield* ctx.wait(1);
    }
  },
};

export const FISHING_ACTIVITIES = [fish];
