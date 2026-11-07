import { Rng, distToPolyline, ellipseRadius, lerp, smoothstep, type V2 } from './math';
import type { DecorInstance, EnvironmentDefinition, RockInstance, TreeInstance } from './environments/types';

/**
 * Terrain queries shared by the simulation (walkability, character height) and the
 * renderer (ground mesh, water, scatter placement). Deterministic for a given
 * environment definition.
 */
export class Terrain {
  readonly trees: TreeInstance[] = [];
  readonly rocks: RockInstance[] = [];
  readonly decor: DecorInstance[] = [];

  constructor(readonly def: EnvironmentDefinition) {
    this.scatter();
  }

  lakeRadius(x: number, z: number): number {
    const l = this.def.lake;
    return l ? ellipseRadius({ x, z }, l.cx, l.cz, l.rx, l.rz) : Infinity;
  }

  streamDist(x: number, z: number): number {
    let best = Infinity;
    for (const s of this.def.streams) best = Math.min(best, distToPolyline({ x, z }, s));
    return best;
  }

  trailDist(x: number, z: number): number {
    let best = Infinity;
    for (const t of this.def.trails) best = Math.min(best, distToPolyline({ x, z }, t));
    return best;
  }

  /** Ground height including the lake basin and stream channel. */
  height(x: number, z: number): number {
    let h = this.def.baseHeight(x, z);
    const e = this.lakeRadius(x, z);
    if (e < 1.25) h = lerp(h, -1.1, smoothstep(1.2, 0.5, e));
    const d = this.streamDist(x, z);
    if (d < 1.1) h -= 0.42 * smoothstep(1.1, 0.25, d);
    return h;
  }

  /** Stream surface height near a point on the stream. */
  streamSurface(x: number, z: number): number {
    return Math.max(this.def.baseHeight(x, z) - 0.25, this.def.waterLevel + 0.01);
  }

  onDock(x: number, z: number, margin = 0): boolean {
    const d = this.def.dock;
    if (!d) return false;
    return x >= d.x0 - margin && x <= d.x1 + margin && Math.abs(z - d.z) <= d.width / 2 + margin;
  }

  /** Bridge deck height if (x, z) is on a bridge, otherwise null. */
  bridgeDeck(x: number, z: number): number | null {
    for (const b of this.def.bridges) {
      const dx = x - b.x;
      const dz = z - b.z;
      const c = Math.cos(b.rot);
      const s = Math.sin(b.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) <= b.length / 2 && Math.abs(lz) <= b.width / 2) {
        const t = lx / b.length + 0.5;
        return this.def.baseHeight(b.x, b.z) + 0.12 + Math.sin(Math.PI * t) * 0.28;
      }
    }
    return null;
  }

  /** Height that a walking character stands on (ground, dock deck or bridge deck). */
  surfaceHeight(x: number, z: number): number {
    const bridge = this.bridgeDeck(x, z);
    if (bridge !== null) return bridge;
    const h = this.height(x, z);
    if (this.onDock(x, z)) return Math.max(h, 0.1);
    return h;
  }

  isWater(x: number, z: number): boolean {
    return this.height(x, z) < this.def.waterLevel + 0.04 || this.streamDist(x, z) < 0.7;
  }

  /** Static walkability, ignoring objects. */
  walkable(x: number, z: number): boolean {
    if (this.onDock(x, z) || this.bridgeDeck(x, z) !== null) return true;
    if (Math.hypot(x, z) > this.def.walkRadius) return false;
    if (this.height(x, z) < this.def.waterLevel + 0.08) return false;
    if (this.streamDist(x, z) < 0.85) return false;
    return true;
  }

  inClearing(x: number, z: number, pad = 0): boolean {
    for (const c of this.def.clearings) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    return false;
  }

  private nearStructure(x: number, z: number, pad: number): boolean {
    if (this.onDock(x, z, pad)) return true;
    for (const b of this.def.bridges) if (Math.hypot(x - b.x, z - b.z) < b.length / 2 + pad) return true;
    for (const o of this.def.objects) if (Math.hypot(x - o.x, z - o.z) < 1.4 + pad * 0.5) return true;
    for (const v of this.def.viewpoints) if (Math.hypot(x - v.x, z - v.z) < 1.2) return true;
    return false;
  }

  private keepClear(x: number, z: number, pad: number): boolean {
    return (
      this.inClearing(x, z, pad) ||
      this.lakeRadius(x, z) < 1.12 + pad * 0.08 ||
      this.streamDist(x, z) < 1.0 + pad ||
      this.trailDist(x, z) < 1.0 + pad ||
      this.nearStructure(x, z, pad)
    );
  }

  private scatter(): void {
    const def = this.def;
    const rng = new Rng(def.seed);

    for (const t of def.fixedTrees) {
      this.trees.push({ x: t.x, z: t.z, kind: t.kind, scale: t.scale, rot: rng.range(0, 6.28), tint: rng.next() });
    }

    // Trees: denser toward the rim, kept off clearings, trails and water.
    const reserved = [...def.branchSpots, ...def.collectibleSpots, ...def.glowMushrooms];
    let attempts = 0;
    while (this.trees.length < def.treeCount + def.fixedTrees.length && attempts < def.treeCount * 40) {
      attempts++;
      const x = rng.range(-33, 33);
      const z = rng.range(-33, 33);
      const r = Math.hypot(x, z);
      if (r > 33) continue;
      const density = 0.18 + 0.82 * smoothstep(9, 21, r);
      if (!rng.chance(density)) continue;
      if (this.keepClear(x, z, 0.4)) continue;
      if (reserved.some((p) => Math.hypot(p.x - x, p.z - z) < 1.1)) continue;
      const minGap = r > 22 ? 1.5 : 2.0;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < minGap)) continue;
      const nearLake = this.lakeRadius(x, z) < 1.8;
      const roll = rng.next();
      const kind: TreeInstance['kind'] =
        r > 23 && roll < 0.45 ? 'tallPine' : nearLake && roll < 0.45 ? 'birch' : roll < 0.55 ? 'pine' : roll < 0.85 ? 'round' : 'birch';
      this.trees.push({ x, z, kind, scale: rng.range(0.8, 1.25) * (r > 22 ? 1.15 : 1), rot: rng.range(0, 6.28), tint: rng.next() });
    }

    // Rocks.
    attempts = 0;
    while (this.rocks.length < 46 && attempts < 3000) {
      attempts++;
      const x = rng.range(-26, 26);
      const z = rng.range(-26, 26);
      const r = Math.hypot(x, z);
      if (r > 27) continue;
      const lakeE = this.lakeRadius(x, z);
      const byWater = (lakeE > 1.02 && lakeE < 1.3) || (this.streamDist(x, z) > 0.9 && this.streamDist(x, z) < 1.6);
      if (!byWater && this.keepClear(x, z, 0.2)) continue;
      if (byWater && (this.nearStructure(x, z, 0.8) || this.trailDist(x, z) < 1.0)) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.2)) continue;
      if (this.rocks.some((t) => Math.hypot(t.x - x, t.z - z) < 1.0)) continue;
      const scale = byWater ? rng.range(0.25, 0.6) : rng.range(0.3, 1.0);
      this.rocks.push({ x, z, scale, rot: rng.range(0, 6.28), blocks: scale > 0.45 });
    }

    // Decorations (no collision).
    const place = (
      kind: DecorInstance['kind'],
      count: number,
      accept: (x: number, z: number) => boolean,
      scale: [number, number],
      spread = 26,
    ) => {
      let placed = 0;
      let tries = 0;
      while (placed < count && tries < count * 60) {
        tries++;
        const x = rng.range(-spread, spread);
        const z = rng.range(-spread, spread);
        if (!accept(x, z)) continue;
        this.decor.push({ x, z, kind, scale: rng.range(scale[0], scale[1]), rot: rng.range(0, 6.28), tint: rng.next() });
        placed++;
      }
    };
    const land = (x: number, z: number) => this.walkable(x, z) && !this.onDock(x, z, 0.3) && Math.hypot(x, z) < 26;
    const offPaths = (x: number, z: number) => this.trailDist(x, z) > 0.9 && !this.nearStructure(x, z, 0.3);

    place('bush', 70, (x, z) => land(x, z) && offPaths(x, z) && !this.inClearing(x, z, -1.5), [0.6, 1.2]);
    place('fern', 90, (x, z) => land(x, z) && offPaths(x, z) && !this.inClearing(x, z, -1), [0.5, 1.0]);
    place('grass', 420, (x, z) => land(x, z) && this.trailDist(x, z) > 0.6 && !this.nearStructure(x, z, -0.6), [0.5, 1.1], 22);
    place('flower', 70, (x, z) => land(x, z) && offPaths(x, z) && (Math.hypot(x + 6, z - 6.2) < 7 || Math.hypot(x, z) > 9), [0.6, 1.0], 20);
    place('mushroom', 26, (x, z) => land(x, z) && offPaths(x, z) && Math.hypot(x, z) > 9, [0.6, 1.2]);
    place('stump', 7, (x, z) => land(x, z) && offPaths(x, z) && !this.inClearing(x, z, 0) && Math.hypot(x, z) < 18, [0.8, 1.1]);
    place(
      'reed',
      60,
      (x, z) => {
        const e = this.lakeRadius(x, z);
        return e > 0.93 && e < 1.08 && !this.onDock(x, z, 1.2);
      },
      [0.6, 1.1],
    );
    place(
      'lilypad',
      14,
      (x, z) => {
        const e = this.lakeRadius(x, z);
        return e > 0.45 && e < 0.85 && !this.onDock(x, z, 1.5) && Math.hypot(x - 11, z - 1.2) > 2.2;
      },
      [0.7, 1.2],
    );
  }

  /** Random walkable point inside a disc. */
  randomWalkable(rng: Rng, cx: number, cz: number, radius: number, tries = 30): V2 | null {
    for (let i = 0; i < tries; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * radius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (this.walkable(x, z) && !this.onDock(x, z)) return { x, z };
    }
    return null;
  }
}
