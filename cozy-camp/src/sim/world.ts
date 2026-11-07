import { ACTIVITIES, objectActions, type ActParams } from './activities';
import { ActivityFail, Ctx } from './activities/core';
import { chooseActivity } from './brain';
import { createCharacter } from './character';
import { adaptWeather, createEnv, daylight, seasonTemperature, stepEnvironment, toGameHours } from './environment';
import type { EnvironmentDefinition } from './environments/types';
import { Rng, clamp, damp, dampAngle, smoothstep, type V2 } from './math';
import { NavGrid } from './nav';
import { KINDS, createObject, tentSize } from './objects';
import { Terrain } from './terrain';
import type {
  ActivityRun,
  Animal,
  Appearance,
  Bobber,
  CampfireState,
  Character,
  EnvState,
  Fish,
  ObjectKind,
  Ripple,
  Season,
  WeatherKind,
  WorldEvent,
  WorldObject,
} from './types';
import { createAnimal, createFish, randomLakePoint, stepAnimals, stepFish } from './wildlife';

export interface SoundCue {
  name: string;
  x: number;
  z: number;
}

export interface StartOptions {
  byPlayer?: boolean;
  params?: ActParams;
}

const SEATED_ACTIVITIES = new Set(['sitFire', 'sit', 'cocoa', 'eat', 'marshmallow', 'skywatch', 'cook', 'shelter']);
const MAX_STEP = 0.05;

/**
 * The whole simulation: environment, objects, campers, wildlife. Plain TypeScript,
 * independent of rendering, so it can run headless in tests or (later) on a server.
 */
export class World {
  readonly terrain: Terrain;
  readonly nav: NavGrid;
  readonly rng: Rng;
  env: EnvState;
  objects: WorldObject[] = [];
  private objMap = new Map<string, WorldObject>();
  characters: Character[] = [];
  fish: Fish[] = [];
  animals: Animal[] = [];
  bobbers: Bobber[] = [];
  ripples: Ripple[] = [];
  events: WorldEvent[] = [];
  sounds: SoundCue[] = [];
  shootingStars: { at: number; seed: number }[] = [];

  simTime = 0;
  speed = 1;
  paused = false;
  /** Bumped whenever objects are added, removed or moved. */
  version = 0;
  mealCalledAt = -999;
  /** Incremented when logs land in the fire (renderer bursts sparks). */
  fireSparks = 0;
  /** Direction input for the player avatar (camera relative, already rotated to world). */
  playerInput = { x: 0, z: 0, run: false };
  readonly playerId = 'player';

  private eventSeq = 0;
  private fishSeq = 0;
  private fishRespawns: number[] = [];
  private thunder: number[] = [];
  private socialTimer = 0;
  private interruptTimer = 0;
  private campfireRef: WorldObject;

  constructor(
    readonly def: EnvironmentDefinition,
    opts: { playerName?: string; playerAppearance?: Appearance; seed?: number } = {},
  ) {
    this.rng = new Rng(opts.seed ?? (Date.now() & 0xffffffff));
    this.terrain = new Terrain(def);
    this.env = createEnv(def.defaults.time, def.defaults.season, def.defaults.weather);

    for (const spec of def.objects) this.insertObject(createObject(spec));
    def.branchSpots.forEach((p, i) =>
      this.insertObject(createObject({ kind: 'branchSpot', id: `branches-${i}`, x: p.x, z: p.z, rot: this.rng.range(0, 6.28) })),
    );
    def.collectibleSpots.forEach((p, i) =>
      this.insertObject(
        createObject({ kind: 'collectible', id: `find-${i}`, x: p.x, z: p.z, rot: this.rng.range(0, 6.28), init: { collectible: p.kind } }),
      ),
    );
    const fire = this.objects.find((o) => o.kind === 'campfire');
    if (!fire) throw new Error('Environment needs a campfire');
    this.campfireRef = fire;

    this.nav = new NavGrid(this.terrain, def.bounds);
    this.rebuildNav();

    for (const spec of def.characters) {
      const isPlayer = spec.id === this.playerId;
      this.characters.push(
        createCharacter({
          id: spec.id,
          name: isPlayer ? (opts.playerName ?? spec.name) : spec.name,
          controller: isPlayer ? 'player' : 'ai',
          x: spec.x,
          z: spec.z,
          tentId: spec.tent,
          appearance: isPlayer ? opts.playerAppearance : undefined,
        }),
      );
    }

    if (def.lake) for (let i = 0; i < def.wildlife.fish; i++) this.fish.push(createFish(`fish-${this.fishSeq++}`, this.terrain, this.rng));
    def.wildlife.rabbits.forEach((p, i) => this.animals.push(createAnimal(`rabbit-${i}`, 'rabbit', p, this.terrain)));
    def.wildlife.deer.forEach((p, i) => this.animals.push(createAnimal(`deer-${i}`, 'deer', p, this.terrain)));
    def.wildlife.squirrels.forEach((p, i) => this.animals.push(createAnimal(`squirrel-${i}`, 'squirrel', p, this.terrain)));
    if (def.wildlife.owl) {
      const p = def.wildlife.owl;
      const tree = this.terrain.trees.reduce((best, t) =>
        Math.hypot(t.x - p.x, t.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? t : best,
      );
      const owl = createAnimal('owl', 'owl', { x: tree.x + 0.32, z: tree.z + 0.3 }, this.terrain);
      owl.y = this.terrain.height(tree.x, tree.z) + 2.15 * tree.scale;
      owl.heading = Math.atan2(-tree.x, -tree.z);
      this.animals.push(owl);
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  get campfire(): WorldObject {
    return this.campfireRef;
  }

  get fire(): CampfireState {
    return this.campfireRef.fire!;
  }

  get player(): Character {
    return this.char(this.playerId)!;
  }

  obj(id: string): WorldObject | undefined {
    return this.objMap.get(id);
  }

  first(kind: ObjectKind): WorldObject | undefined {
    return this.objects.find((o) => o.kind === kind);
  }

  char(id: string): Character | undefined {
    return this.characters.find((c) => c.id === id);
  }

  daylight(): number {
    return daylight(this.env);
  }

  isNight(): boolean {
    return this.daylight() < 0.2;
  }

  /** How wet it is outside: rain, plus a little for snow. */
  rain(): number {
    return Math.max(this.env.mix.rain, this.env.mix.snow * 0.5);
  }

  isSheltered(x: number, z: number): boolean {
    for (const o of this.objects) {
      if (o.kind !== 'tarp' && !(o.kind === 'tent' && (o.tent?.pitch ?? 0) >= 1)) continue;
      const dx = x - o.x;
      const dz = z - o.z;
      const c = Math.cos(o.rot);
      const s = Math.sin(o.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const [hw, hd] = o.kind === 'tarp' ? [1.6, 1.3] : [tentSize(o).w / 2, tentSize(o).d / 2];
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) return true;
    }
    return false;
  }

  fishById(id: string): Fish | undefined {
    return this.fish.find((f) => f.id === id);
  }

  bobberOf(ch: Character): Bobber | undefined {
    return this.bobbers.find((b) => b.ownerId === ch.id);
  }

  /** Nearest object the camper could interact with, for the walk-mode prompt. */
  nearbyInteractable(ch: Character, radius = 2.3): WorldObject | null {
    let best: WorldObject | null = null;
    let bestD = radius;
    for (const o of this.objects) {
      if (o.kind === 'bridge' || ((o.kind === 'branchSpot' || o.kind === 'collectible') && !o.on)) continue;
      if (!objectActions(o).length) continue;
      const d = Math.hypot(o.x - ch.x, o.z - ch.z) - (o.kind === 'dock' ? 2 : o.kind === 'tent' ? 1.1 : 0);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Simulation loop
  // -------------------------------------------------------------------------

  /** Advance by real seconds, honouring pause and speed. */
  update(realDt: number): void {
    if (this.paused) return;
    const dt = Math.min(realDt, 0.1) * this.speed;
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    for (let i = 0; i < steps; i++) this.step(dt / steps);
  }

  step(dt: number): void {
    this.simTime += dt;
    stepEnvironment(this.env, dt, this.rng, this.simTime, (delay) => this.thunder.push(this.simTime + delay));
    this.thunder = this.thunder.filter((t) => {
      if (this.simTime < t) return true;
      this.sound('thunder', this.campfire);
      return false;
    });

    this.stepFire(dt);
    this.stepObjects(dt);
    for (const ch of this.characters) this.stepCharacter(ch, dt);
    this.stepSocial(dt);
    this.stepRainInterrupts(dt);
    this.stepWildlife(dt);

    for (const b of this.bobbers) {
      if (!b.landed) {
        b.flight = Math.min(1, b.flight + dt / 0.85);
        if (b.flight >= 1) b.landed = true;
      }
      b.dip = Math.max(0, b.dip - dt * 2.5);
    }
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 2.6);
    if (this.env.mix.rain > 0.2 && this.def.lake) {
      // Raindrops dimple the lake.
      const n = this.rng.chance(dt * 12 * this.env.mix.rain) ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const p = randomLakePoint(this.terrain, this.rng, 0.9);
        this.addRipple(p.x, p.z, 0.25);
      }
    }
    if (this.isNight() && this.env.mix.cloud < 0.4 && this.rng.chance(dt * 0.006)) this.shootingStar();
    this.shootingStars = this.shootingStars.filter((s) => this.simTime - s.at < 3);
    if (this.sounds.length > 60) this.sounds.splice(0, this.sounds.length - 60);
  }

  private stepFire(dt: number): void {
    const f = this.fire;
    if (f.lit) {
      const rate = 0.0052 * (1 + this.env.windStrength * 0.5) * (1 + this.rain() * 1.2);
      f.fuel = Math.max(0, f.fuel - rate * dt);
      if (f.fuel <= 0) {
        f.lit = false;
        f.ember = 1;
        this.emit('🪵', 'The campfire has burned down to embers');
      } else if (this.env.mix.rain > 0.8 && f.fuel < 0.18 && this.rng.chance(dt * 0.05)) {
        f.lit = false;
        f.ember = 0.6;
        this.emit('🌧️', 'The rain put out the campfire');
      }
    }
    f.ember = f.lit ? 0 : Math.max(0, f.ember - dt * 0.012);
    const target = f.lit ? 0.22 + 0.78 * smoothstep(0, 0.95, f.fuel) : 0;
    f.intensity = damp(f.intensity, target, 1.2, dt);
    f.logs = clamp(Math.ceil(f.fuel / 0.3), f.fuel > 0 || f.ember > 0.05 ? 1 : 0, 5);
    f.kettleHeat = damp(f.kettleHeat, f.lit ? 0.3 + f.intensity * 0.7 : 0, 0.08, dt);
    if (f.pan && f.intensity > 0.08) f.pan.doneness = Math.min(1.2, f.pan.doneness + dt * 0.06 * (0.35 + f.intensity));
  }

  private stepObjects(dt: number): void {
    for (const o of this.objects) {
      if ((o.kind === 'branchSpot' || o.kind === 'collectible') && !o.on && o.respawnAt !== undefined && this.simTime >= o.respawnAt) {
        o.on = true;
      }
      if (o.tent) o.tent.flap = damp(o.tent.flap, o.tent.flapTarget, 3.5, dt);
      if (o.kind === 'hammock') {
        const busy = o.slots[0].occupant !== null;
        o.swing = (o.swing ?? 0) + dt * (busy ? 1.15 : 0.8);
      }
    }
  }

  private stepCharacter(ch: Character, dt: number): void {
    this.stepNeeds(ch, dt);
    ch.sheltered = this.isSheltered(ch.x, ch.z);
    ch.animTime += dt;

    const manual = ch.controller === 'player' && this.applyPlayerInput(ch, dt);

    const aiDriven = ch.controller === 'ai' || (ch.controller === 'player' && ch.autopilot && this.simTime >= ch.manualUntil);
    if (!ch.activity && aiDriven && !manual && this.simTime >= ch.thinkAt && !ch.slide) {
      const id = chooseActivity(this, ch);
      if (id) this.startActivity(ch, id);
      else ch.thinkAt = this.simTime + 2;
    }

    if (ch.activity) this.tickActivity(ch, dt);
    if (!manual) this.stepLocomotion(ch, dt);

    if (ch.bubble && this.simTime > ch.bubble.until) ch.bubble = null;
    const sleeping = ch.activity?.id === 'sleep' && ch.inSleepingBag;
    if (!sleeping && !ch.chatPartner && ch.expression !== 'surprised' && ch.expression !== 'talk') {
      const nearFire = Math.hypot(ch.x - this.campfire.x, ch.z - this.campfire.z) < 3.5 && this.fire.intensity > 0.3;
      ch.expression = ch.needs.energy < 0.22 ? 'sleepy' : ch.needs.warmth < 0.25 && !nearFire ? 'cold' : 'happy';
    }
    if (ch.expression === 'surprised' && ch.animTime > 2) ch.expression = 'happy';
    if (!ch.chatPartner && ch.expression === 'talk' && !ch.bubble) ch.expression = 'happy';
    if (!ch.activity && !ch.moving && !ch.pinned) {
      ch.status = aiDriven ? 'Deciding what to do next' : 'Waiting for you';
    }
  }

  private stepNeeds(ch: Character, dt: number): void {
    const h = toGameHours(dt);
    const n = ch.needs;
    const sleeping = ch.activity?.id === 'sleep' && ch.inSleepingBag;
    if (!sleeping) n.energy -= 0.055 * h * (ch.moving ? 1.3 : 1);
    n.hunger -= 0.085 * h * (sleeping ? 0.35 : 1);
    if (!sleeping) {
      n.fun -= 0.1 * h;
      n.social -= 0.07 * h;
    }
    const cold = clamp((17 - this.env.temperature) / 20, 0, 1.3);
    let dw = -(0.04 + 0.22 * cold);
    if (!ch.sheltered) dw -= this.rain() * 0.35;
    const fd = Math.hypot(ch.x - this.campfire.x, ch.z - this.campfire.z);
    if (fd < 4.5) dw += this.fire.intensity * 1.1 * (1 - fd / 4.5);
    if (sleeping) dw += 0.35;
    n.warmth += dw * h;
    for (const k of Object.keys(n) as (keyof typeof n)[]) n[k] = clamp(n[k]);
  }

  private applyPlayerInput(ch: Character, dt: number): boolean {
    const inp = this.playerInput;
    const mag = Math.hypot(inp.x, inp.z);
    if (mag < 0.05) return false;
    if (ch.slide) {
      this.stepLocomotion(ch, dt);
      return true;
    }
    if (ch.activity) this.cancelActivity(ch);
    if (ch.slide) return true;
    ch.pinned = false;
    ch.manualUntil = this.simTime + 30;
    if (ch.goal) this.stopMoving(ch);
    const k = Math.min(1, mag);
    const dx = inp.x / mag;
    const dz = inp.z / mag;
    const speed = (inp.run ? 2.7 : 1.5) * ch.appearance.scale * k;
    ch.heading = dampAngle(ch.heading, Math.atan2(dx, dz), 12, dt);
    const nx = ch.x + dx * speed * dt;
    const nz = ch.z + dz * speed * dt;
    const free = (x: number, z: number) => this.nav.isWalkable(x, z) || !this.nav.isWalkable(ch.x, ch.z);
    if (free(nx, nz)) {
      ch.x = nx;
      ch.z = nz;
    } else if (free(nx, ch.z)) ch.x = nx;
    else if (free(ch.x, nz)) ch.z = nz;
    ch.moving = true;
    ch.running = inp.run;
    ch.speed = speed;
    ch.anim = 'idle';
    ch.status = 'Exploring on foot';
    return true;
  }

  private stepLocomotion(ch: Character, dt: number): void {
    if (ch.slide) {
      const s = ch.slide;
      s.t += dt;
      const k = clamp(s.t / s.dur);
      const e = k * k * (3 - 2 * k);
      ch.x = s.fx + (s.tx - s.fx) * e;
      ch.z = s.fz + (s.tz - s.fz) * e;
      ch.yOffset = s.fy * (1 - e);
      ch.moving = false;
      if (k >= 1) {
        ch.slide = null;
        ch.pinned = false;
      }
      return;
    }
    if (ch.pinned || !ch.goal) {
      ch.moving = false;
      ch.speed = 0;
      return;
    }
    const wp = ch.path[ch.pathIndex];
    if (!wp) {
      this.stopMoving(ch);
      return;
    }
    const hurry = ch.running || (this.rain() > 0.45 && !ch.sheltered);
    const maxSpeed = (hurry ? 2.4 : 1.3) * ch.appearance.scale;
    ch.speed = damp(ch.speed, maxSpeed, 6, dt);
    const dx = wp.x - ch.x;
    const dz = wp.z - ch.z;
    const d = Math.hypot(dx, dz);
    const step = ch.speed * dt;
    if (d <= step) {
      ch.x = wp.x;
      ch.z = wp.z;
      ch.pathIndex++;
      if (ch.pathIndex >= ch.path.length) {
        this.stopMoving(ch);
        return;
      }
    } else {
      ch.heading = dampAngle(ch.heading, Math.atan2(dx, dz), 10, dt);
      ch.x += (dx / d) * step;
      ch.z += (dz / d) * step;
    }
    // Gentle separation so campers don't walk through each other.
    for (const o of this.characters) {
      if (o === ch || o.pinned) continue;
      const ox = ch.x - o.x;
      const oz = ch.z - o.z;
      const dd = Math.hypot(ox, oz);
      if (dd > 0.001 && dd < 0.55) {
        const push = (0.55 - dd) * 0.4;
        const nx = ch.x + (ox / dd) * push;
        const nz = ch.z + (oz / dd) * push;
        if (this.nav.isWalkable(nx, nz)) {
          ch.x = nx;
          ch.z = nz;
        }
      }
    }
    ch.moving = true;
  }

  /** Seated campers near each other chat now and then. */
  private stepSocial(dt: number): void {
    this.socialTimer -= dt;
    const seated = this.characters.filter((c) => c.pinned && c.activity && SEATED_ACTIVITIES.has(c.activity.id) && !c.chatPartner);
    for (let i = 0; i < seated.length; i++) {
      for (let j = i + 1; j < seated.length; j++) {
        const a = seated[i];
        const b = seated[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) > 3.4) continue;
        const g = (0.3 * toGameHours(dt)) / 1;
        a.needs.social = clamp(a.needs.social + g);
        b.needs.social = clamp(b.needs.social + g);
        if (this.socialTimer <= 0) {
          const speaker = this.rng.chance(0.5) ? a : b;
          speaker.bubble = { icon: this.rng.pick(['💬', '😄', '🌙', '⭐', '🎵', '🔥', '😊']), until: this.simTime + 2.4 };
          speaker.expression = 'talk';
          speaker.animTime = 0;
        }
      }
    }
    if (this.socialTimer <= 0) this.socialTimer = this.rng.range(6, 12);
  }

  /** AI campers caught out in heavy rain break off and find shelter. */
  private stepRainInterrupts(dt: number): void {
    this.interruptTimer -= dt;
    if (this.interruptTimer > 0) return;
    this.interruptTimer = 2;
    if (this.rain() < 0.45) return;
    for (const ch of this.characters) {
      const run = ch.activity;
      const aiDriven = ch.controller === 'ai' || (ch.autopilot && this.simTime >= ch.manualUntil);
      if (!aiDriven || !run || run.byPlayer || !run.outdoor || ch.sheltered) continue;
      if (this.rng.chance(0.5) && ACTIVITIES.shelter.blocked(this, ch, {}) === null) {
        this.startActivity(ch, 'shelter');
      }
    }
  }

  private stepWildlife(dt: number): void {
    const t = this.env.time;
    const boost = (t > 5 && t < 8) || (t > 19 && t < 22.5) ? 1.6 : this.isNight() ? 0.9 : 1;
    stepFish(this.fish, this.bobbers, this.terrain, this.rng, dt, boost * (1 + this.env.mix.rain * 0.4), {
      ripple: (x, z, s) => this.addRipple(x, z, s),
      sound: (name, at) => this.sound(name, at),
    });
    this.fishRespawns = this.fishRespawns.filter((at) => {
      if (this.simTime < at) return true;
      this.fish.push(createFish(`fish-${this.fishSeq++}`, this.terrain, this.rng));
      return false;
    });
    const night = this.isNight();
    stepAnimals(
      this.animals,
      this.characters,
      this.terrain,
      (x, z) => this.nav.isWalkable(x, z) && !this.terrain.onDock(x, z),
      this.rng,
      dt,
      night,
      (a) => this.sound('owl', a),
    );
  }

  // -------------------------------------------------------------------------
  // Activities
  // -------------------------------------------------------------------------

  /** Start an activity. Returns null on success or the reason it can't start. */
  startActivity(ch: Character, id: string, opts: StartOptions = {}): string | null {
    const def = ACTIVITIES[id];
    if (!def) return 'Unknown activity';
    const params = opts.params ?? {};
    const reason = def.blocked(this, ch, params);
    if (reason) return reason;
    if (ch.activity) this.cancelActivity(ch);
    const run: ActivityRun = {
      id,
      label: def.label,
      icon: def.icon,
      gen: undefined as unknown as ActivityRun['gen'],
      byPlayer: Boolean(opts.byPlayer),
      outdoor: def.outdoor,
      startedAt: this.simTime,
      cleanups: [],
      step: def.label,
    };
    const ctx = new Ctx(this, ch, run);
    run.gen = def.run(ctx, params);
    ch.activity = run;
    ch.status = def.label;
    if (opts.byPlayer) ch.manualUntil = this.simTime + 20;
    return null;
  }

  private tickActivity(ch: Character, dt: number): void {
    const run = ch.activity!;
    try {
      const r = run.gen.next(dt);
      if (r.done && ch.activity === run) this.endActivity(ch);
    } catch (e) {
      if (e instanceof ActivityFail) {
        if (run.byPlayer) this.emit('💭', `${ch.name}: ${e.reason}`);
        ch.status = e.reason;
      } else {
        console.error('Activity crashed', run.id, e);
      }
      if (ch.activity === run) this.endActivity(ch);
    }
  }

  private endActivity(ch: Character): void {
    const run = ch.activity;
    if (!run) return;
    ch.activity = null;
    for (const fn of run.cleanups.reverse()) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
    if (run.id !== 'walk' && run.id !== 'chatListen') {
      ch.recent.unshift(run.id);
      ch.recent.length = Math.min(ch.recent.length, 4);
    }
    ch.thinkAt = this.simTime + this.rng.range(1.5, 4);
    this.stopMoving(ch);
    if (!ch.slide) {
      ch.pinned = false;
      ch.yOffset = 0;
    }
    ch.held = null;
    ch.heldMeta = null;
    ch.lookAt = null;
    ch.lookUp = 0;
    ch.inSleepingBag = false;
    ch.anim = 'idle';
    ch.pendingChoice = null;
    for (const b of [...this.bobbers]) if (b.ownerId === ch.id) this.removeBobber(ch);
  }

  cancelActivity(ch: Character): void {
    const run = ch.activity;
    if (!run) return;
    try {
      run.gen.return(undefined);
    } catch {
      /* ignore */
    }
    this.endActivity(ch);
  }

  /** Player command: walk to a point. */
  commandWalk(ch: Character, target: V2): void {
    this.startActivity(ch, 'walk', { byPlayer: true, params: { target } });
    ch.manualUntil = this.simTime + 30;
  }

  answerChoice(ch: Character, id: string): void {
    if (ch.pendingChoice) ch.pendingChoice.picked = id;
  }

  navigate(ch: Character, target: V2, run = false): boolean {
    if (ch.pinned && !ch.slide) ch.pinned = false;
    const path = this.nav.findPath(ch, target);
    if (!path) return false;
    ch.path = path;
    ch.pathIndex = 0;
    ch.goal = path[path.length - 1];
    ch.running = run;
    ch.moving = true;
    return true;
  }

  stopMoving(ch: Character): void {
    ch.goal = null;
    ch.path = [];
    ch.pathIndex = 0;
    ch.moving = false;
    ch.running = false;
  }

  exitSlot(ch: Character, to: V2): void {
    ch.slide = { fx: ch.x, fz: ch.z, fy: ch.yOffset, tx: to.x, tz: to.z, t: 0, dur: 0.45 };
    ch.pinned = true;
    ch.inSleepingBag = false;
  }

  // -------------------------------------------------------------------------
  // Fishing helpers
  // -------------------------------------------------------------------------

  castBobber(ch: Character, target: V2): Bobber {
    this.removeBobber(ch);
    const b: Bobber = {
      ownerId: ch.id,
      sx: ch.x + Math.sin(ch.heading) * 0.9,
      sz: ch.z + Math.cos(ch.heading) * 0.9,
      x: target.x,
      z: target.z,
      flight: 0,
      landed: false,
      dip: 0,
      claimedBy: null,
      biteFish: null,
    };
    this.bobbers.push(b);
    return b;
  }

  removeBobber(ch: Character): void {
    const b = this.bobberOf(ch);
    if (!b) return;
    this.bobbers = this.bobbers.filter((x) => x !== b);
    if (b.claimedBy) {
      const f = this.fishById(b.claimedBy);
      if (f && (f.state === 'attracted' || f.state === 'nibble')) f.state = 'swim';
    }
  }

  catchFish(f: Fish): void {
    f.state = 'caught';
    f.hidden = true;
  }

  storeFish(f: Fish): void {
    this.fish = this.fish.filter((x) => x !== f);
    this.fishRespawns.push(this.simTime + this.rng.range(120, 240));
  }

  releaseFish(f: Fish, at: V2): void {
    f.hidden = false;
    f.state = 'released';
    f.x = at.x;
    f.z = at.z;
    f.target = randomLakePoint(this.terrain, this.rng, 0.7);
    f.wanderT = 3;
    this.addRipple(at.x, at.z, 0.9);
  }

  addRipple(x: number, z: number, size: number): void {
    if (this.ripples.length > 40) this.ripples.shift();
    this.ripples.push({ x, z, age: 0, size });
  }

  shootingStar(): void {
    this.shootingStars.push({ at: this.simTime, seed: this.rng.next() });
  }

  sparks(n: number): void {
    this.fireSparks += n;
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  emit(icon: string, text: string): void {
    this.events.push({ id: ++this.eventSeq, icon, text, at: this.simTime });
    if (this.events.length > 30) this.events.shift();
  }

  sound(name: string, at: V2): void {
    this.sounds.push({ name, x: at.x, z: at.z });
  }

  // -------------------------------------------------------------------------
  // Building
  // -------------------------------------------------------------------------

  rebuildNav(): void {
    this.nav.rebuild(this.objects);
  }

  /** Insert an already-built object (used by save restore). */
  insertObject(o: WorldObject): void {
    this.objects.push(o);
    this.objMap.set(o.id, o);
  }

  /** Footprint radius used for placement checks. */
  footprint(o: Pick<WorldObject, 'kind' | 'collider'>): number {
    if (o.kind === 'blanket') return 1.0;
    const c = o.collider;
    if (!c) return 0.4;
    return c.type === 'circle' ? c.r : Math.hypot(c.hw, c.hd) * 0.85;
  }

  canPlace(kind: ObjectKind, x: number, z: number, ignoreId?: string): boolean {
    const probe = { kind, collider: kind === 'tent' ? { type: 'box' as const, hw: 1.15, hd: 1.3 } : KINDS[kind].collider };
    const r = this.footprint(probe);
    if (Math.hypot(x, z) > this.def.walkRadius - 1.2) return false;
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a / 8) * Math.PI * 2) * r * 0.9;
      const pz = z + Math.sin((a / 8) * Math.PI * 2) * r * 0.9;
      if (!this.terrain.walkable(px, pz) || this.terrain.onDock(px, pz) || this.terrain.bridgeDeck(px, pz) !== null) return false;
    }
    if (!this.terrain.walkable(x, z)) return false;
    for (const t of this.terrain.trees) if (Math.hypot(t.x - x, t.z - z) < r + 0.45 * t.scale) return false;
    for (const o of this.objects) {
      if (o.id === ignoreId || o.kind === 'bridge' || o.kind === 'branchSpot' || o.kind === 'collectible') continue;
      if (o.kind === 'tarp' || o.kind === 'dock') continue;
      if (Math.hypot(o.x - x, o.z - z) < r + this.footprint(o) * 0.9) return false;
    }
    for (const c of this.characters) if (c.pinned && Math.hypot(c.x - x, c.z - z) < r + 0.3) return false;
    return true;
  }

  isInUse(o: WorldObject): boolean {
    return o.slots.some((s) => s.occupant !== null);
  }

  moveObject(id: string, x: number, z: number, rot: number): boolean {
    const o = this.obj(id);
    if (!o || !o.movable || this.isInUse(o)) return false;
    if (!this.canPlace(o.kind, x, z, id)) return false;
    o.x = x;
    o.z = z;
    o.rot = rot;
    this.rebuildNav();
    this.version++;
    return true;
  }

  addObject(kind: ObjectKind, x: number, z: number, rot: number, init: Record<string, unknown> = {}): WorldObject | null {
    if (!this.canPlace(kind, x, z)) return null;
    const o = createObject({ kind, x, z, rot, init: { ...init, custom: true } });
    this.insertObject(o);
    this.rebuildNav();
    this.version++;
    return o;
  }

  removeObject(id: string): boolean {
    const o = this.obj(id);
    if (!o || !o.custom || this.isInUse(o)) return false;
    this.objects = this.objects.filter((x) => x !== o);
    this.objMap.delete(id);
    this.rebuildNav();
    this.version++;
    return true;
  }

  // -------------------------------------------------------------------------
  // Sandbox
  // -------------------------------------------------------------------------

  setTime(hours: number): void {
    this.env.time = ((hours % 24) + 24) % 24;
  }

  setWeather(kind: WeatherKind, lock = true): void {
    this.env.weather = adaptWeather(kind, this.env.season);
    this.env.lockWeather = lock;
    this.env.nextWeatherChange = this.rng.range(120, 260);
  }

  setSeason(season: Season): void {
    this.env.season = season;
    this.env.weather = adaptWeather(this.env.weather, season);
    this.env.snowCover = season === 'winter' ? 0.85 : 0;
    this.env.temperature = seasonTemperature(this.env);
  }

  setWind(strength: number | null): void {
    this.env.windOverride = strength;
  }
}
