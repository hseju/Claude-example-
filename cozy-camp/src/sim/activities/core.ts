import { toGameHours } from '../environment';
import { clamp, headingTo, type V2 } from '../math';
import { slotApproach, slotPose } from '../objects';
import type { ActivityGen, ActivityRun, AnimName, Character, HeldItem, NeedKey, Slot, WorldObject } from '../types';
import type { World } from '../world';

export interface ActParams {
  objectId?: string;
  slotId?: string;
  target?: V2;
}

export interface ActivityDef {
  id: string;
  /** Menu label, e.g. "Go fishing". */
  label: string;
  icon: string;
  /** Exposed to rain (AI campers will break off to find shelter). */
  outdoor: boolean;
  /** Shown in the player's activity menu. */
  menu: boolean;
  /** Reason the activity can't run right now, or null when it can. */
  blocked(w: World, ch: Character, p: ActParams): string | null;
  /** AI desire to do this right now; 0 means never. */
  utility(w: World, ch: Character): number;
  run(ctx: Ctx, p: ActParams): ActivityGen;
}

/** Thrown inside an activity script to end it early. */
export class ActivityFail extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export interface ChoiceOption {
  id: string;
  label: string;
}

/**
 * The toolbox an activity script uses. Movement, slot use, animation, held items,
 * speech bubbles, needs and player choices all go through here so every activity
 * behaves consistently and cleans up after itself when interrupted.
 */
export class Ctx {
  /** The slot the character is currently settled in, if any. */
  inSlot: { o: WorldObject; s: Slot } | null = null;

  constructor(
    readonly w: World,
    readonly ch: Character,
    readonly run: ActivityRun,
  ) {}

  get rng() {
    return this.w.rng;
  }

  step(status: string): void {
    this.run.step = status;
    this.ch.status = status;
  }

  anim(name: AnimName): void {
    if (this.ch.anim !== name) {
      this.ch.anim = name;
      this.ch.animTime = 0;
    }
  }

  hold(item: HeldItem | null, state = 0): void {
    this.ch.held = item;
    this.ch.heldState = state;
  }

  say(icon: string, text?: string, seconds = 3): void {
    this.ch.bubble = { icon, text, until: this.w.simTime + seconds };
  }

  face(target: V2 | number): void {
    this.ch.heading = typeof target === 'number' ? target : headingTo(this.ch, target);
  }

  lookAt(target: V2 | null): void {
    this.ch.lookAt = target;
  }

  onCleanup(fn: () => void): void {
    this.run.cleanups.push(fn);
  }

  /** Raise (or lower) a need at a rate per game hour. */
  gain(need: NeedKey, perHour: number, dt: number): void {
    this.ch.needs[need] = clamp(this.ch.needs[need] + perHour * toGameHours(dt));
  }

  bump(need: NeedKey, amount: number): void {
    this.ch.needs[need] = clamp(this.ch.needs[need] + amount);
  }

  *wait(seconds: number, each?: (dt: number) => void): ActivityGen {
    let t = 0;
    while (t < seconds) {
      const dt: number = yield;
      t += dt;
      each?.(dt);
    }
  }

  /** Wait until `pred` holds. Returns whether it did before the timeout. */
  *waitUntil(pred: () => boolean, timeout = Infinity, each?: (dt: number) => void): Generator<void, boolean, number> {
    let t = 0;
    while (!pred()) {
      if (t >= timeout) return false;
      const dt: number = yield;
      t += dt;
      each?.(dt);
    }
    return true;
  }

  /** Walk (or run) to a point using the navigation grid. */
  *goTo(target: V2, opts: { run?: boolean; tolerance?: number } = {}): ActivityGen {
    const tolerance = opts.tolerance ?? 0.6;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Math.hypot(this.ch.x - target.x, this.ch.z - target.z) <= tolerance) return;
      if (!this.w.navigate(this.ch, target, opts.run ?? false)) throw new ActivityFail("Can't find a way there");
      let stuck = 0;
      let last = { x: this.ch.x, z: this.ch.z };
      while (this.ch.goal) {
        const dt: number = yield;
        stuck += dt;
        if (stuck > 2.5) {
          if (Math.hypot(this.ch.x - last.x, this.ch.z - last.z) < 0.25) break;
          stuck = 0;
          last = { x: this.ch.x, z: this.ch.z };
        }
      }
      this.w.stopMoving(this.ch);
    }
    if (Math.hypot(this.ch.x - target.x, this.ch.z - target.z) > tolerance + 0.9) {
      throw new ActivityFail("Couldn't get there");
    }
  }

  reserve(_o: WorldObject, s: Slot): boolean {
    if (s.occupant && s.occupant !== this.ch.id) return false;
    s.occupant = this.ch.id;
    this.onCleanup(() => {
      if (s.occupant === this.ch.id) s.occupant = null;
    });
    return true;
  }

  /** Walk to a slot's approach point and settle into its pose. */
  *enterSlot(o: WorldObject, s: Slot, anim: AnimName, opts: { run?: boolean } = {}): ActivityGen {
    if (!this.reserve(o, s)) throw new ActivityFail('Someone else is using that');
    yield* this.goTo(slotApproach(o, s), { run: opts.run, tolerance: 0.35 });
    const pose = slotPose(o, s);
    this.ch.pinned = true;
    this.w.stopMoving(this.ch);
    this.anim(anim);
    const entry = { o, s };
    this.inSlot = entry;
    // If the activity ends while still seated (finished or interrupted), step back out.
    this.onCleanup(() => {
      if (this.inSlot === entry) {
        this.inSlot = null;
        this.w.exitSlot(this.ch, slotApproach(o, s));
      }
    });
    yield* this.slide(pose, pose.rot, pose.y, 0.45);
  }

  /** Smoothly move a pinned character to a pose. */
  *slide(to: V2, heading: number, y: number, seconds: number): ActivityGen {
    const ch = this.ch;
    const from = { x: ch.x, z: ch.z, y: ch.yOffset, h: ch.heading };
    let dh = heading - from.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    let t = 0;
    while (t < seconds) {
      const dt: number = yield;
      t += dt;
      const k = clamp(t / seconds);
      const e = k * k * (3 - 2 * k);
      ch.x = from.x + (to.x - from.x) * e;
      ch.z = from.z + (to.z - from.z) * e;
      ch.yOffset = from.y + (y - from.y) * e;
      ch.heading = from.h + dh * e;
    }
  }

  /** Step out of a slot now (instead of at cleanup). */
  *leaveSlot(o: WorldObject, s: Slot): ActivityGen {
    const a = slotApproach(o, s);
    if (this.inSlot?.s === s) this.inSlot = null;
    this.anim('idle');
    yield* this.slide(a, this.ch.heading, 0, 0.35);
    this.ch.pinned = false;
    if (s.occupant === this.ch.id) s.occupant = null;
  }

  /**
   * Ask the player to choose when they started this activity; autonomous
   * campers decide straight away using `aiPick`.
   */
  *choose(prompt: string, options: ChoiceOption[], aiPick: string, timeout = 15): Generator<void, string, number> {
    if (!this.run.byPlayer) return aiPick;
    const choice = { prompt, options, picked: null as string | null };
    this.ch.pendingChoice = choice;
    this.onCleanup(() => {
      if (this.ch.pendingChoice === choice) this.ch.pendingChoice = null;
    });
    let t = 0;
    while (!choice.picked && t < timeout) t += yield;
    if (this.ch.pendingChoice === choice) this.ch.pendingChoice = null;
    return choice.picked ?? aiPick;
  }

  event(icon: string, text: string): void {
    this.w.emit(icon, text);
  }

  sound(name: string, at?: V2): void {
    this.w.sound(name, at ?? this.ch);
  }
}

/** Find the nearest free slot among objects matching a filter. */
export function nearestFreeSlot(
  w: World,
  from: V2,
  objFilter: (o: WorldObject) => boolean,
  slotFilter: (s: Slot, o: WorldObject) => boolean = () => true,
  forId?: string,
): { o: WorldObject; s: Slot } | null {
  let best: { o: WorldObject; s: Slot } | null = null;
  let bestD = Infinity;
  for (const o of w.objects) {
    if (!objFilter(o)) continue;
    for (const s of o.slots) {
      if (s.occupant && s.occupant !== forId) continue;
      if (!slotFilter(s, o)) continue;
      const a = slotApproach(o, s);
      const d = Math.hypot(a.x - from.x, a.z - from.z);
      if (d < bestD) {
        bestD = d;
        best = { o, s };
      }
    }
  }
  return best;
}
