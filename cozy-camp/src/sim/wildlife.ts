import { dampAngle, headingTo, type Rng, type V2 } from './math';
import type { Terrain } from './terrain';
import type { Animal, AnimalKind, Bobber, Character, Fish } from './types';

const SPECIES = [
  { name: 'rainbow trout', color: '#c98f8a', size: [22, 38] },
  { name: 'perch', color: '#c9b85a', size: [15, 28] },
  { name: 'golden carp', color: '#e0a03f', size: [25, 45] },
  { name: 'silver minnow', color: '#b7c2c9', size: [8, 14] },
  { name: 'bluegill', color: '#6f8fb0', size: [12, 22] },
] as const;

export function createFish(id: string, terrain: Terrain, rng: Rng): Fish {
  const lake = terrain.def.lake!;
  const sp = rng.pick(SPECIES);
  const p = randomLakePoint(terrain, rng, 0.7);
  return {
    id,
    x: p.x,
    z: p.z,
    depth: rng.range(0.25, 0.55),
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(0.3, 0.6),
    size: Math.round(rng.range(sp.size[0], sp.size[1])),
    species: sp.name,
    color: sp.color,
    state: 'swim',
    target: { x: lake.cx, z: lake.cz },
    wanderT: 0,
    jump: 0,
    hidden: false,
  };
}

export function randomLakePoint(terrain: Terrain, rng: Rng, maxE: number): V2 {
  const lake = terrain.def.lake!;
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(rng.next()) * maxE;
  return { x: lake.cx + Math.cos(a) * lake.rx * r, z: lake.cz + Math.sin(a) * lake.rz * r };
}

export interface FishHooks {
  ripple(x: number, z: number, size: number): void;
  sound(name: string, at: V2): void;
}

export function stepFish(fish: Fish[], bobbers: Bobber[], terrain: Terrain, rng: Rng, dt: number, biteBoost: number, hooks: FishHooks): void {
  for (const f of fish) {
    if (f.hidden || f.state === 'hooked' || f.state === 'caught') continue;
    f.jump = Math.max(0, f.jump - dt * 1.6);
    let speed = f.speed;
    let target = f.target;

    if (f.state === 'swim' || f.state === 'released') {
      f.wanderT -= dt;
      if (f.wanderT <= 0 || !target || Math.hypot(target.x - f.x, target.z - f.z) < 0.4) {
        f.target = target = randomLakePoint(terrain, rng, 0.78);
        f.wanderT = rng.range(4, 10);
        if (f.state === 'released') f.state = 'swim';
      }
      if (f.state === 'released') speed = 1.4;
      // Notice a bobber in the water.
      for (const b of bobbers) {
        if (!b.landed || b.claimedBy) continue;
        const d = Math.hypot(b.x - f.x, b.z - f.z);
        if (d < 7 && rng.chance(dt * 0.07 * biteBoost)) {
          f.state = 'attracted';
          b.claimedBy = f.id;
        }
      }
      if (rng.chance(dt * 0.004)) {
        f.jump = 1;
        hooks.ripple(f.x, f.z, 0.8);
        hooks.sound('fishjump', f);
      }
    }

    if (f.state === 'attracted' || f.state === 'nibble') {
      const b = bobbers.find((x) => x.claimedBy === f.id);
      if (!b) {
        f.state = 'swim';
        continue;
      }
      target = { x: b.x, z: b.z };
      speed = f.state === 'nibble' ? 0.2 : 0.75;
      const d = Math.hypot(b.x - f.x, b.z - f.z);
      if (f.state === 'attracted' && d < 0.35) {
        f.state = 'nibble';
        f.wanderT = rng.range(1.6, 3.4);
      }
      if (f.state === 'nibble') {
        f.wanderT -= dt;
        b.dip = Math.max(b.dip, Math.sin(f.wanderT * 9) > 0.6 ? 0.5 : 0);
        if (f.wanderT <= 0) {
          b.biteFish = f.id;
          b.dip = 1;
        }
      }
    }

    if (target) {
      const desired = headingTo(f, target);
      f.heading = dampAngle(f.heading, desired, 2.5, dt);
      f.x += Math.sin(f.heading) * speed * dt;
      f.z += Math.cos(f.heading) * speed * dt;
    }
    // Stay inside the lake.
    const e = terrain.lakeRadius(f.x, f.z);
    if (e > 0.85) {
      const lake = terrain.def.lake!;
      f.heading = dampAngle(f.heading, headingTo(f, { x: lake.cx, z: lake.cz }), 6, dt);
      f.x += (lake.cx - f.x) * dt * 0.3;
      f.z += (lake.cz - f.z) * dt * 0.3;
    }
  }
}

export function createAnimal(id: string, kind: AnimalKind, home: V2, terrain: Terrain): Animal {
  return {
    id,
    kind,
    x: home.x,
    z: home.z,
    y: terrain.height(home.x, home.z),
    heading: Math.random() * Math.PI * 2,
    state: 'idle',
    target: null,
    timer: Math.random() * 4,
    hop: 0,
    home,
    range: kind === 'deer' ? 4 : kind === 'owl' ? 0 : kind === 'squirrel' ? 3 : 5,
  };
}

const FLEE_DIST: Record<AnimalKind, number> = { rabbit: 2.8, deer: 4.6, owl: 0, squirrel: 2.2 };
const SPEED: Record<AnimalKind, { move: number; flee: number }> = {
  rabbit: { move: 1.1, flee: 3.2 },
  deer: { move: 0.6, flee: 2.6 },
  owl: { move: 0, flee: 0 },
  squirrel: { move: 1.4, flee: 3.6 },
};

export function stepAnimals(
  animals: Animal[],
  characters: Character[],
  terrain: Terrain,
  walkable: (x: number, z: number) => boolean,
  rng: Rng,
  dt: number,
  night: boolean,
  hoot: (a: Animal) => void,
): void {
  for (const a of animals) {
    a.timer -= dt;
    if (a.kind === 'owl') {
      // Perched: watch the nearest camper and hoot at night.
      let nearest: Character | null = null;
      let nd = 12;
      for (const c of characters) {
        const d = Math.hypot(c.x - a.x, c.z - a.z);
        if (d < nd && c.moving) {
          nd = d;
          nearest = c;
        }
      }
      if (nearest) a.heading = dampAngle(a.heading, headingTo(a, nearest), 2, dt);
      if (a.timer <= 0) {
        a.timer = rng.range(14, 32);
        if (night) {
          a.state = 'hoot';
          a.hop = 1;
          hoot(a);
        } else a.state = 'idle';
      }
      a.hop = Math.max(0, a.hop - dt * 0.8);
      continue;
    }

    // Flee from nearby campers.
    let threat: Character | null = null;
    for (const c of characters) {
      if (c.pinned && !c.moving) continue;
      if (Math.hypot(c.x - a.x, c.z - a.z) < FLEE_DIST[a.kind]) threat = c;
    }
    if (threat && a.state !== 'flee') {
      const away = headingTo(threat, a) + rng.range(-0.5, 0.5);
      const d = FLEE_DIST[a.kind] + 2.5;
      const t = { x: a.x + Math.sin(away) * d, z: a.z + Math.cos(away) * d };
      if (walkable(t.x, t.z)) {
        a.state = 'flee';
        a.target = t;
        a.timer = 3;
      }
    }

    if (a.state === 'idle' || a.state === 'graze') {
      if (a.timer <= 0) {
        const p = terrain.randomWalkable(rng, a.home.x, a.home.z, a.range, 8);
        if (p && walkable(p.x, p.z)) {
          a.state = 'move';
          a.target = p;
          a.timer = 8;
        } else a.timer = 2;
      }
    }
    if ((a.state === 'move' || a.state === 'flee') && a.target) {
      const d = Math.hypot(a.target.x - a.x, a.target.z - a.z);
      const speed = a.state === 'flee' ? SPEED[a.kind].flee : SPEED[a.kind].move;
      if (d < 0.15 || a.timer <= 0) {
        a.state = a.kind === 'deer' ? 'graze' : 'idle';
        a.timer = a.kind === 'deer' ? rng.range(5, 12) : rng.range(1.5, 5);
        a.target = null;
      } else {
        a.heading = dampAngle(a.heading, headingTo(a, a.target), 8, dt);
        const step = Math.min(d, speed * dt);
        const nx = a.x + Math.sin(a.heading) * step;
        const nz = a.z + Math.cos(a.heading) * step;
        if (walkable(nx, nz)) {
          a.x = nx;
          a.z = nz;
        } else a.timer = 0;
        a.hop += dt * (a.kind === 'deer' ? 2.2 : 7) * (speed / SPEED[a.kind].move);
      }
    }
    a.y = terrain.height(a.x, a.z);
  }
}
