// Prayer-hall presence and capacity.
//
// The rule that matters: every prayer hall instance has exactly 12 spots, and each spot
// belongs to at most one occupant. `HallDirectory` owns that rule and is written so it can
// sit on an authoritative server unchanged. In this prototype it runs in the browser and is
// driven by `LocalSimulation`, which fills halls with clearly-labelled simulated devotees.
// A networked build swaps LocalSimulation for a transport (WebSocket etc.) that forwards
// claim/release/heartbeat messages; spots are released on exit or when heartbeats stop.

export const HALL_CAPACITY = 12;

export class HallDirectory {
  constructor(temples) {
    this.halls = new Map(); // hallId -> hall
    this.listeners = new Set();
    for (const t of temples) this.ensureInstance(t, 1);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(hall) { for (const fn of this.listeners) fn(hall); }

  ensureInstance(templeId, index) {
    const id = `${templeId}-${index}`;
    if (!this.halls.has(id)) this.halls.set(id, { id, templeId, index, spots: new Array(HALL_CAPACITY).fill(null), queue: [] });
    return this.halls.get(id);
  }
  instances(templeId) { return [...this.halls.values()].filter(h => h.templeId === templeId).sort((a, b) => a.index - b.index); }
  get(id) { return this.halls.get(id); }
  occupancy(hall) { return hall.spots.filter(Boolean).length; }
  simulatedCount(hall) { return hall.spots.filter(s => s && s.simulated).length; }
  freeSpots(hall) { return hall.spots.map((s, i) => (s ? -1 : i)).filter(i => i >= 0); }

  // Atomic claim. Returns true only if the spot was empty and the occupant held no other spot.
  claim(hallId, spot, occupant) {
    const h = this.halls.get(hallId); if (!h || spot < 0 || spot >= HALL_CAPACITY) return false;
    if (h.spots[spot]) return false;
    for (const hall of this.halls.values()) if (hall.spots.some(s => s && s.id === occupant.id)) return false;
    h.spots[spot] = { ...occupant, since: Date.now() };
    h.queue = h.queue.filter(q => q.id !== occupant.id);
    this._emit(h); return true;
  }
  release(occupantId) {
    for (const h of this.halls.values()) {
      const i = h.spots.findIndex(s => s && s.id === occupantId);
      if (i >= 0) { h.spots[i] = null; this._emit(h); this._serveQueue(h); return { hall: h, spot: i }; }
    }
    return null;
  }
  spotOf(occupantId) {
    for (const h of this.halls.values()) { const i = h.spots.findIndex(s => s && s.id === occupantId); if (i >= 0) return { hall: h, spot: i }; }
    return null;
  }
  // Prefer the lowest-numbered hall with room; open a new identical instance when all are full.
  findOrCreateAvailable(templeId) {
    const list = this.instances(templeId);
    const open = list.find(h => this.occupancy(h) < HALL_CAPACITY);
    return open || this.ensureInstance(templeId, list.length + 1);
  }
  enqueue(hallId, waiter) { const h = this.halls.get(hallId); if (h && !h.queue.some(q => q.id === waiter.id)) h.queue.push(waiter); this._emit(h); }
  leaveQueue(waiterId) { for (const h of this.halls.values()) h.queue = h.queue.filter(q => q.id !== waiterId); }
  _serveQueue(h) {
    if (!h.queue.length) return;
    const free = this.freeSpots(h); if (!free.length) return;
    const w = h.queue.shift();
    if (w.onSpot) w.onSpot(h, free[0]);
  }
}

// Simulated devotees. Never presented as real people: every occupant carries simulated: true,
// and the UI labels them as such.
export class LocalSimulation {
  constructor(directory, makeConfig) {
    this.dir = directory; this.makeConfig = makeConfig; this.n = 0; this.timer = null;
    this.waitingFor = null; // hall id the player is queued for: speeds up a departure for the demo
  }
  seed(plan) { // { templeId: count }
    for (const [templeId, count] of Object.entries(plan)) {
      const h = this.dir.ensureInstance(templeId, 1);
      const spots = shuffle([...Array(12).keys()]).slice(0, count);
      for (const s of spots) this.dir.claim(h.id, s, this._sim());
    }
    if (plan.shiva >= 12) { const h2 = this.dir.ensureInstance('shiva', 2); for (const s of shuffle([...Array(12).keys()]).slice(0, 3)) this.dir.claim(h2.id, s, this._sim()); }
  }
  _sim() { const cfg = this.makeConfig(Math.random()); return { id: `sim-${++this.n}`, name: cfg.name, simulated: true, config: cfg }; }
  start() {
    const tick = () => {
      this.churn();
      this.timer = setTimeout(tick, this.waitingFor ? 6000 + Math.random() * 4000 : 16000 + Math.random() * 14000);
    };
    this.timer = setTimeout(tick, 12000);
  }
  churn() {
    const halls = [...this.dir.halls.values()];
    const h = this.waitingFor ? this.dir.get(this.waitingFor) : halls[Math.floor(Math.random() * halls.length)];
    if (!h) return;
    const occ = this.dir.occupancy(h);
    const sims = h.spots.map((s, i) => (s && s.simulated ? i : -1)).filter(i => i >= 0);
    if ((this.waitingFor || occ > 6 || Math.random() < 0.45) && sims.length) {
      const i = sims[Math.floor(Math.random() * sims.length)];
      this.dir.release(h.spots[i].id);
    } else if (occ < 10 && !this.waitingFor) {
      const free = this.dir.freeSpots(h);
      if (free.length) this.dir.claim(h.id, free[Math.floor(Math.random() * free.length)], this._sim());
    }
  }
  // Called by the aarti preview so the hall looks gathered (only simulated devotees join).
  gather(hallId, target = 10) {
    const h = this.dir.get(hallId); const joined = [];
    while (this.dir.occupancy(h) < target) { const free = this.dir.freeSpots(h); if (!free.length) break; const o = this._sim(); if (this.dir.claim(h.id, free[Math.floor(Math.random() * free.length)], o)) joined.push(o); }
    return joined;
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
