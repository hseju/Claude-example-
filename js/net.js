// Multiplayer: the connection to the temple server, and the other real devotees in your room.
//
// One WebSocket per player, to a room on the server (server/ in this repository: a Cloudflare Worker with a Durable
// Object per room). You send what you are doing (where you stand, how you move, the offerings you make) and receive
// the same from everyone else in the room. The server is the authority on the places in each prayer hall. Simulated
// devotees never go over the network: every browser keeps its own, and they step aside for real people.
//
// Rooms: everyone who opens the site plainly meets in the public temple; an invite link (?room=<code>) opens a
// private temple for you and your friends. When the server cannot be reached the app carries on as before, with
// simulated devotees only, and keeps trying in the background.

export const SERVER_URL = 'wss://virtual-temple.hseju.workers.dev';   // the deployed server (see server/README.md)

const ROOM_RE = /^[a-z0-9-]{1,40}$/;
export function roomFromUrl() {
  const q = new URLSearchParams(location.search).get('room');
  return q && ROOM_RE.test(q.toLowerCase()) ? q.toLowerCase() : 'public';
}
export function newRoomCode() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = '';
  const r = crypto.getRandomValues(new Uint8Array(6)); for (const b of r) s += a[b % a.length];
  return 'temple-' + s;
}
export function inviteLink(room) {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  if (room !== 'public') u.searchParams.set('room', room);
  return u.toString();
}
// the id other players see: a hash of your profile id, so an email address never leaves your device
export function netId(profileId) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < profileId.length; i++) { const c = profileId.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0; }
  return 'p' + h1.toString(36) + h2.toString(36);
}

const r2 = (v) => Math.round(v * 100) / 100;

export class Net {
  constructor(url = SERVER_URL, room = roomFromUrl()) {
    // for local testing only: a copy served from this machine may point at a local server (?server=ws://127.0.0.1:8787)
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('server');
    if (local && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(local)) url = local;
    this.url = url; this.room = room;
    this.players = new Map();   // id -> { id, name, look, s, spot, seen }
    this.handlers = {};
    this.online = false; this.connecting = false; this.offset = 0; this.retry = 0;
    this._last = null; this._lastAt = 0; this._pingAt = 0;
    this.enabled = !!url && !/example\.workers\.dev/.test(url) && typeof WebSocket !== 'undefined';
  }
  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); }
  _emit(type, ...args) { for (const fn of this.handlers[type] || []) { try { fn(...args); } catch (e) { console.error(e); } } }
  get count() { return this.players.size + (this.online ? 1 : 0); }   // real devotees here, you included
  get now() { return Date.now() + this.offset; }                     // the server's clock

  // hello() returns { id, name, look, s }: who you are, sent on every (re)connect
  start(hello) {
    this.hello = hello; if (!this.enabled) return;
    this._open();
    // a heartbeat on a timer rather than the drawing loop, so a tab in the background (which stops drawing) stays in the room
    this._beat = setInterval(() => { if (this.online && performance.now() - this._pingAt > 20000) this.ping(); }, 25000);
  }
  switchRoom(room) {
    if (!ROOM_RE.test(room) || room === this.room) return;
    this.room = room; this._close(); this._open();
  }
  _open() {
    if (!this.enabled || this.ws) return;
    let ws;
    try { ws = new WebSocket(`${this.url}/room/${this.room}`); } catch (e) { this._later(); return; }
    this.ws = ws; this.connecting = true; this._emit('status');
    ws.onopen = () => { this.retry = 0; this._send({ t: 'hello', ...this.hello() }); this.ping(); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this._msg(m); };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null; this.online = false; this.connecting = false; this._dropAll(); this._emit('status');
      if (e.code !== 4000) this._later();   // 4000: this player opened the temple somewhere else
    };
    ws.onerror = () => {};
  }
  _close() { const ws = this.ws; this.ws = null; clearTimeout(this._rt); if (ws) { try { ws.close(1000, 'leaving'); } catch (e) { /* closed */ } } this.online = false; this.connecting = false; this._dropAll(); this._emit('status'); }
  _later() { clearTimeout(this._rt); const d = Math.min(30000, 1500 * 2 ** this.retry++) * (0.7 + Math.random() * 0.6); this._rt = setTimeout(() => this._open(), d); }
  _send(m) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  send(m) { return this.online && this._send(m); }
  ping() { this._pingAt = performance.now(); this._send({ t: 'ping', c: Date.now() }); }

  _msg(m) {
    switch (m.t) {
      case 'welcome': this.online = true; this.ever = true; this.connecting = false; this.offset = m.now - Date.now(); for (const p of m.players || []) this._join(p); this._emit('status'); this._emit('welcome'); break;
      case 'pong': { const rtt = Date.now() - m.c; if (rtt >= 0 && rtt < 5000) this.offset = m.s + rtt / 2 - Date.now(); break; }
      case 'join': this._join(m.p); this._emit('status'); break;
      case 'leave': this._leave(m.id); this._emit('status'); break;
      case 's': { const p = this.players.get(m.id); if (p) { p.s = m; p.seen = performance.now(); this._emit('state', p); } break; }
      case 'cfg': { const p = this.players.get(m.id); if (p) { p.name = m.name; p.look = m.look || {}; this._emit('look', p); this._emit('status'); } break; }
      case 'e': { const p = this.players.get(m.id); if (p) this._emit('event', p, m); break; }
      case 'spot': { const p = this.players.get(m.id); if (p) { p.spot = m.hall ? { hall: m.hall, spot: m.spot } : null; this._emit('spot', p); } break; }
      case 'claim': this._emit('claim', m); break;
      case 'chat': { const p = this.players.get(m.from); if (p) this._emit('chat', p, m); break; }
      case 'chat-ok': this._emit('chat-ok', m); break;
      case 'chat-no': this._emit('chat-no', m); break;
      default: break;
    }
  }
  _join(raw) {
    if (!raw || !raw.id) return;
    const p = { id: raw.id, name: raw.name || 'Devotee', look: raw.look || {}, s: raw.s || null, spot: raw.spot || null, seen: performance.now() };
    this.players.set(p.id, p); this._emit('join', p);
    if (p.spot) this._emit('spot', p);
  }
  _leave(id) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id);
    if (p.spot) { p.spot = null; this._emit('spot', p); }
    this._emit('leave', p);
  }
  _dropAll() { for (const id of [...this.players.keys()]) this._leave(id); }

  // a private message to one player: { q } for a ready-made phrase, or { text } (checked again by the server).
  // Returns a number that comes back with the server's answer, or 0 if offline.
  chat(to, body) { this._n = (this._n || 0) + 1; return this.send({ t: 'chat', to, n: this._n, ...body }) ? this._n : 0; }
  // your own state: sent when it changes (up to eight times a second while you move) and every few seconds when still
  tick(s) {
    if (!this.online) return;
    const now = performance.now();
    const st = { t: 's', m: s.m, x: r2(s.x), y: r2(s.y), z: r2(s.z), r: r2(s.r), a: s.a, sp: r2(s.sp || 0), h: s.h || null };
    const L = this._last;
    const changed = !L || L.m !== st.m || L.a !== st.a || L.h !== st.h || Math.abs(L.x - st.x) > 0.02 || Math.abs(L.z - st.z) > 0.02 || Math.abs(L.y - st.y) > 0.02 || Math.abs(L.r - st.r) > 0.03;
    if ((changed && now - this._lastAt > 125) || now - this._lastAt > 5000) { if (this._send(st)) { this._last = st; this._lastAt = now; } }
  }
}
