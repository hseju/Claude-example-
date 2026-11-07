import type { V2 } from './math';
import type { Terrain } from './terrain';
import type { WorldObject } from './types';

const SQRT2 = Math.SQRT2;

/**
 * Grid navigation: static terrain + object colliders baked into a walkability grid,
 * A* search with cheaper trail cells, then string-pulling to smooth the path.
 */
export class NavGrid {
  readonly cell: number;
  readonly size: number;
  readonly origin: number;
  /** 0 = blocked, otherwise traversal cost multiplier * 10. */
  private cost: Uint8Array;
  private staticCost: Uint8Array;

  // Scratch buffers for A*.
  private g: Float32Array;
  private parent: Int32Array;
  private closed: Uint8Array;
  private stamp: Uint32Array;
  private searchId = 0;

  constructor(
    private terrain: Terrain,
    bounds: number,
    cell = 0.5,
  ) {
    this.cell = cell;
    this.size = Math.ceil((bounds * 2) / cell);
    this.origin = -bounds;
    const n = this.size * this.size;
    this.cost = new Uint8Array(n);
    this.staticCost = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.stamp = new Uint32Array(n);
    this.bakeStatic();
  }

  private bakeStatic(): void {
    const t = this.terrain;
    for (let iz = 0; iz < this.size; iz++) {
      for (let ix = 0; ix < this.size; ix++) {
        const { x, z } = this.center(ix, iz);
        let c = 0;
        if (t.walkable(x, z)) {
          c = t.trailDist(x, z) < 0.7 || t.onDock(x, z) || t.bridgeDeck(x, z) !== null ? 7 : 10;
        }
        this.staticCost[iz * this.size + ix] = c;
      }
    }
    // Trees and big rocks.
    for (const tree of t.trees) this.stampCircle(this.staticCost, tree.x, tree.z, 0.32 * tree.scale + 0.12);
    for (const rock of t.rocks) if (rock.blocks) this.stampCircle(this.staticCost, rock.x, rock.z, 0.55 * rock.scale);
  }

  /** Re-bake dynamic colliders from world objects (after furniture moves). */
  rebuild(objects: WorldObject[]): void {
    this.cost.set(this.staticCost);
    for (const o of objects) {
      if (!o.collider) continue;
      if (o.kind === 'tent' && (o.tent?.pitch ?? 1) < 0.5) {
        this.stampCircle(this.cost, o.x, o.z, 0.35);
        continue;
      }
      if (o.collider.type === 'circle') this.stampCircle(this.cost, o.x, o.z, o.collider.r);
      else this.stampBox(this.cost, o.x, o.z, o.rot, o.collider.hw, o.collider.hd);
    }
  }

  center(ix: number, iz: number): V2 {
    return { x: this.origin + (ix + 0.5) * this.cell, z: this.origin + (iz + 0.5) * this.cell };
  }

  toCell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.origin) / this.cell), Math.floor((z - this.origin) / this.cell)];
  }

  private inBounds(ix: number, iz: number): boolean {
    return ix >= 0 && iz >= 0 && ix < this.size && iz < this.size;
  }

  private stampCircle(buf: Uint8Array, x: number, z: number, r: number): void {
    const [x0, z0] = this.toCell(x - r, z - r);
    const [x1, z1] = this.toCell(x + r, z + r);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        const c = this.center(ix, iz);
        if (Math.hypot(c.x - x, c.z - z) <= r + this.cell * 0.35) buf[iz * this.size + ix] = 0;
      }
    }
  }

  private stampBox(buf: Uint8Array, x: number, z: number, rot: number, hw: number, hd: number): void {
    const r = Math.hypot(hw, hd);
    const [x0, z0] = this.toCell(x - r, z - r);
    const [x1, z1] = this.toCell(x + r, z + r);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const pad = this.cell * 0.3;
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        if (!this.inBounds(ix, iz)) continue;
        const p = this.center(ix, iz);
        const dx = p.x - x;
        const dz = p.z - z;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (Math.abs(lx) <= hw + pad && Math.abs(lz) <= hd + pad) buf[iz * this.size + ix] = 0;
      }
    }
  }

  isWalkable(x: number, z: number): boolean {
    const [ix, iz] = this.toCell(x, z);
    return this.inBounds(ix, iz) && this.cost[iz * this.size + ix] > 0;
  }

  /** Nearest walkable cell centre to a point, searching outward in rings. */
  nearestWalkable(x: number, z: number, maxRadius = 8): V2 | null {
    if (this.isWalkable(x, z)) return { x, z };
    const [cx, cz] = this.toCell(x, z);
    const maxR = Math.ceil(maxRadius / this.cell);
    for (let r = 1; r <= maxR; r++) {
      let best: V2 | null = null;
      let bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = cx + dx;
          const iz = cz + dz;
          if (!this.inBounds(ix, iz) || this.cost[iz * this.size + ix] === 0) continue;
          const p = this.center(ix, iz);
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Whether a straight walk between two points stays on walkable cells. */
  lineClear(a: V2, b: V2): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(d / (this.cell * 0.35)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /**
   * A* from `from` to `to`. Returns smoothed waypoints ending exactly at the goal
   * (or the nearest walkable point to it), or null when unreachable.
   */
  findPath(from: V2, to: V2): V2[] | null {
    const start = this.nearestWalkable(from.x, from.z, 3);
    const goal = this.nearestWalkable(to.x, to.z, 6);
    if (!start || !goal) return null;
    if (this.lineClear(start, goal)) return [goal];

    const N = this.size;
    const [sx, sz] = this.toCell(start.x, start.z);
    const [gx, gz] = this.toCell(goal.x, goal.z);
    const startIdx = sz * N + sx;
    const goalIdx = gz * N + gx;
    this.searchId++;
    if (this.searchId === 0xffffffff) {
      this.stamp.fill(0);
      this.searchId = 1;
    }
    const id = this.searchId;

    const heap = new MinHeap();
    const h = (ix: number, iz: number) => {
      const dx = Math.abs(ix - gx);
      const dz = Math.abs(iz - gz);
      return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) * 0.7;
    };
    this.stamp[startIdx] = id;
    this.g[startIdx] = 0;
    this.parent[startIdx] = -1;
    this.closed[startIdx] = 0;
    heap.push(startIdx, h(sx, sz));

    let found = false;
    let expanded = 0;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (this.closed[cur] && this.stamp[cur] === id) continue;
      this.closed[cur] = 1;
      if (cur === goalIdx) {
        found = true;
        break;
      }
      if (++expanded > 40000) break;
      const cx = cur % N;
      const cz = (cur / N) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.inBounds(nx, nz)) continue;
          const ni = nz * N + nx;
          const c = this.cost[ni];
          if (c === 0) continue;
          // No corner cutting.
          if (dx !== 0 && dz !== 0 && (this.cost[cz * N + nx] === 0 || this.cost[nz * N + cx] === 0)) continue;
          const step = (dx !== 0 && dz !== 0 ? SQRT2 : 1) * (c / 10);
          const ng = this.g[cur] + step;
          if (this.stamp[ni] !== id) {
            this.stamp[ni] = id;
            this.closed[ni] = 0;
            this.g[ni] = Infinity;
          }
          if (this.closed[ni]) continue;
          if (ng < this.g[ni]) {
            this.g[ni] = ng;
            this.parent[ni] = cur;
            heap.push(ni, ng + h(nx, nz));
          }
        }
      }
    }
    if (!found) return null;

    const cells: V2[] = [];
    for (let i = goalIdx; i !== -1; i = this.parent[i]) cells.push(this.center(i % N, (i / N) | 0));
    cells.reverse();
    cells[cells.length - 1] = goal;

    // String pulling.
    const out: V2[] = [];
    let anchor = start;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineClear(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    const items = this.items;
    const prio = this.prio;
    items.push(item);
    prio.push(p);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prio[parent] <= prio[i]) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      [prio[i], prio[parent]] = [prio[parent], prio[i]];
      i = parent;
    }
  }
  pop(): number {
    const items = this.items;
    const prio = this.prio;
    const top = items[0];
    const lastI = items.pop()!;
    const lastP = prio.pop()!;
    if (items.length > 0) {
      items[0] = lastI;
      prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && prio[l] < prio[m]) m = l;
        if (r < items.length && prio[r] < prio[m]) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        [prio[i], prio[m]] = [prio[m], prio[i]];
        i = m;
      }
    }
    return top;
  }
}
