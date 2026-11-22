// Virtual Temple multiplayer server: a Cloudflare Worker with one Durable Object per room.
//
// Every player in a room holds one WebSocket. The room relays what each player is doing (where they stand, how they
// move, the offerings they make) to everyone else, and it is the single authority on the twelve places in each prayer
// hall, so two friends can never take the same lotus. Simulated devotees never touch the server: each browser keeps its
// own, and they step aside for real people.
//
// Everything a room knows lives in the attachments of its sockets, so the object can hibernate between messages and
// wake with its state intact.
//
//   GET /                 a short status line
//   GET /room/<code>      upgrade to a WebSocket in room <code> (letters, digits and dashes)

import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 32;          // per room
const MAX_MESSAGE = 4096;        // bytes
const SPOTS = 12;                // places in a prayer hall
const SILENT_MS = 60_000;        // a player not heard from in this long is dropped
const ANIMS = new Set(['idle', 'walk', 'namaste', 'bow', 'offer', 'ring', 'aarti', 'meditate']);
const EVENTS = new Set(['pranam', 'bell', 'flowers', 'diya', 'incense', 'abhishek', 'pradakshina', 'aarti', 'chime']);
const MODES = new Set(['w', 'h', 'u', 'x']);   // walking the grounds, in a prayer hall, practising in the hut, elsewhere (menus)

const CORS = { 'access-control-allow-origin': '*' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = url.pathname.match(/^\/room\/([a-z0-9-]{1,40})\/?$/i);
    if (room) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade', { status: 426, headers: CORS });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(room[1].toLowerCase()));
      return stub.fetch(request);
    }
    if (url.pathname === '/' || url.pathname === '/health') return new Response('Virtual Temple multiplayer server is running', { headers: { 'content-type': 'text/plain', ...CORS } });
    return new Response('Not found', { status: 404, headers: CORS });
  },
};

// ---------------------------------------------------------------- sanitising what clients send
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const hallId = (v) => (typeof v === 'string' && /^[a-z]{3,12}-\d{1,2}$/.test(v) ? v : null);
const pid = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{3,48}$/.test(v) ? v : null);
// the avatar look: short strings and small numbers only, under known keys
function look(c) {
  const out = {};
  if (!c || typeof c !== 'object') return out;
  for (const [k, v] of Object.entries(c).slice(0, 24)) {
    if (!/^[a-zA-Z]{1,16}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = str(v, 24);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
function state(m) {
  return {
    m: MODES.has(m.m) ? m.m : 'w',
    x: r2(num(m.x, -400, 400)), y: r2(num(m.y, -5, 30)), z: r2(num(m.z, -400, 400)),
    r: r2(num(m.r, -100, 100)), a: ANIMS.has(m.a) ? m.a : 'idle', sp: r2(num(m.sp, 0, 10)),
    h: hallId(m.h),
  };
}
function event(m) {
  const e = { k: m.k };
  if (pid(m.to)) e.to = m.to;
  if (hallId(m.hall)) e.hall = m.hall;
  if (Number.isInteger(m.spot) && m.spot >= 0 && m.spot < SPOTS) e.spot = m.spot;
  if (typeof m.at === 'number' && Number.isFinite(m.at)) e.at = m.at;
  if (typeof m.dur === 'number' && Number.isFinite(m.dur)) e.dur = num(m.dur, 5, 600);
  return e;
}
const pub = (p) => ({ id: p.id, name: p.name, look: p.look, s: p.s, spot: p.spot });

// ---------------------------------------------------------------- a room
export class TempleRoom extends DurableObject {
  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('This temple is full', { status: 503, headers: CORS });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null, seen: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  _all() { return this.ctx.getWebSockets().map((ws) => ({ ws, p: ws.deserializeAttachment() || {} })); }
  _players() { return this._all().filter((x) => x.p.id); }
  _send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* closed */ } }
  _broadcast(msg, except) { const s = JSON.stringify(msg); for (const { ws, p } of this._players()) if (ws !== except && p.id) { try { ws.send(s); } catch (e) { /* closed */ } } }
  _save(ws, p) { p.seen = Date.now(); ws.serializeAttachment(p); }

  // drop anyone who has gone quiet (a phone that lost its signal can leave a socket open for a long time)
  _sweep(now) {
    for (const { ws, p } of this._all()) if (now - (p.seen || 0) > SILENT_MS) { if (p.id) this._broadcast({ t: 'leave', id: p.id }, ws); try { ws.close(4001, 'silent'); } catch (e) { /* gone */ } }
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MESSAGE) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const p = ws.deserializeAttachment() || {}, now = Date.now();
    if (Math.random() < 0.05) this._sweep(now);

    if (m.t === 'hello') {
      const id = pid(m.id); if (!id) { ws.close(4002, 'bad id'); return; }
      // the same player opening a second tab, or coming back after a dropped connection, takes over from the old socket
      for (const x of this._players()) if (x.p.id === id && x.ws !== ws) { x.p.id = null; x.ws.serializeAttachment(x.p); try { x.ws.close(4000, 'replaced'); } catch (e) { /* gone */ } }
      const q = { id, name: str(m.name, 24) || 'Devotee', look: look(m.look), s: m.s ? state(m.s) : null, spot: null, seen: now };
      ws.serializeAttachment(q);
      this._send(ws, { t: 'welcome', you: id, now, players: this._players().filter((x) => x.ws !== ws).map((x) => pub(x.p)) });
      this._broadcast({ t: 'join', p: pub(q) }, ws);
      return;
    }
    if (m.t === 'ping') { this._send(ws, { t: 'pong', c: m.c, s: now }); if (p.id) this._save(ws, p); return; }
    if (!p.id) return;   // everything else needs a hello first

    switch (m.t) {
      case 's': p.s = state(m); this._save(ws, p); this._broadcast({ t: 's', id: p.id, ...p.s }, ws); break;
      case 'e': if (EVENTS.has(m.k)) { this._save(ws, p); this._broadcast({ t: 'e', id: p.id, ...event(m) }, ws); } break;
      case 'cfg': p.name = str(m.name, 24) || p.name; p.look = look(m.look); this._save(ws, p); this._broadcast({ t: 'cfg', id: p.id, name: p.name, look: p.look }, ws); break;
      case 'claim': {
        const hall = hallId(m.hall), spot = m.spot;
        const ok = !!hall && Number.isInteger(spot) && spot >= 0 && spot < SPOTS
          && !this._players().some((x) => x.ws !== ws && x.p.spot && x.p.spot.hall === hall && x.p.spot.spot === spot);
        if (ok) { p.spot = { hall, spot }; this._save(ws, p); this._broadcast({ t: 'spot', id: p.id, hall, spot }, ws); }
        this._send(ws, { t: 'claim', ok, hall, spot });
        break;
      }
      case 'release': if (p.spot) { p.spot = null; this._save(ws, p); this._broadcast({ t: 'spot', id: p.id, hall: null }, ws); } break;
      default: break;
    }
  }

  async webSocketClose(ws, code) { this._gone(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { /* gone */ } }
  async webSocketError(ws) { this._gone(ws); }
  _gone(ws) {
    const p = ws.deserializeAttachment() || {}, id = p.id;
    if (!id) return;
    p.id = null; ws.serializeAttachment(p);
    if (!this._players().some((x) => x.ws !== ws && x.p.id === id)) this._broadcast({ t: 'leave', id }, ws);
  }
}
