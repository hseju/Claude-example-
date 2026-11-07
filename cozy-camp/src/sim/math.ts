// Small math helpers shared by the simulation and the renderer.

export interface V2 {
  x: number;
  z: number;
}

export const v2 = (x: number, z: number): V2 => ({ x, z });

export const TAU = Math.PI * 2;

export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = wrapAngle(target - current);
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export function dist(a: V2, b: V2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function dist2(a: V2, b: V2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** Heading (rotation about +Y) that faces from `from` toward `to`. 0 faces +Z. */
export function headingTo(from: V2, to: V2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Rotate a local offset by heading and add an origin. */
export function localToWorld(origin: V2, rot: number, local: V2): V2 {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: origin.x + local.x * c + local.z * s, z: origin.z - local.x * s + local.z * c };
}

/** Distance from point p to segment ab. */
export function distToSegment(p: V2, a: V2, b: V2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2 : 0;
  t = clamp(t);
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

export function distToPolyline(p: V2, pts: V2[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

/** Deterministic seeded random (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Integer hash to [0,1). */
export function hash2(x: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [-1, 1]. */
export function noise2(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return (lerp(lerp(a, b, u), lerp(c, d, u), v) - 0.5) * 2;
}

export function fbm2(x: number, z: number, octaves = 3): number {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, z * f) * amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}

/** Point-in-ellipse normalized radius (1 = on the ellipse). */
export function ellipseRadius(p: V2, cx: number, cz: number, rx: number, rz: number): number {
  const dx = (p.x - cx) / rx;
  const dz = (p.z - cz) / rz;
  return Math.sqrt(dx * dx + dz * dz);
}
