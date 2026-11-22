// Two players in one room: they see each other join, move, make offerings, claim places (never the same one), and leave.
// Run against `wrangler dev` (default) or a deployed server: SERVER=wss://... node test/smoke.mjs
const BASE = process.env.SERVER || 'ws://127.0.0.1:8787';
const room = 'smoke-' + Math.random().toString(36).slice(2, 7);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function player(id, name) {
  const ws = new WebSocket(`${BASE}/room/${room}`), inbox = [];
  const P = { ws, inbox, id, send: (m) => ws.send(JSON.stringify(m)), next: async (t, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { const i = inbox.findIndex((m) => m.t === t); if (i >= 0) return inbox.splice(i, 1)[0]; await wait(20); } throw new Error(`${name} never got "${t}" (has ${inbox.map((m) => m.t).join(',')})`); } };
  ws.onmessage = (e) => inbox.push(JSON.parse(e.data));
  P.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not connect to ' + BASE)); });
  P.hello = async () => { await P.open; P.send({ t: 'hello', id, name, look: { color: '#ff9933', presentation: 'fem', bad: { nested: 1 } }, s: { m: 'w', x: 1, z: 2, r: 0, a: 'idle' } }); return P.next('welcome'); };
  return P;
}
const ok = (c, msg) => { if (!c) throw new Error('FAILED: ' + msg); console.log('ok  ', msg); };
const A = player('guest-aaa111', 'Meera'), B = player('guest-bbb222', 'Arjun');
const wa = await A.hello(); ok(wa.players.length === 0, 'first player finds the room empty');
const wb = await B.hello(); ok(wb.players.length === 1 && wb.players[0].name === 'Meera', 'second player sees the first, with name');
ok(!('bad' in wb.players[0].look), 'nested junk is stripped from the look');
const j = await A.next('join'); ok(j.p.id === 'guest-bbb222', 'first player hears the second join');
B.send({ t: 's', m: 'w', x: 3.333, z: -4, r: 1.2, a: 'walk', sp: 2.5, h: 'nope' });
const s = await A.next('s'); ok(s.id === 'guest-bbb222' && s.x === 3.33 && s.a === 'walk' && s.h === null, 'movement is relayed, rounded and checked');
B.send({ t: 'e', k: 'pranam', to: 'guest-aaa111' }); const e = await A.next('e'); ok(e.k === 'pranam' && e.to === 'guest-aaa111', 'a pranam reaches the other player');
// private chat: a ready-made phrase and kind words arrive; unkind words, links and floods do not
B.send({ t: 'chat', to: 'guest-aaa111', q: 1, n: 1 }); const c1 = await A.next('chat'); ok(c1.from === 'guest-bbb222' && c1.text === "Let's go!", 'a ready-made phrase reaches Meera'); ok((await B.next('chat-ok')).n === 1, 'Arjun sees it delivered');
await wait(800); B.send({ t: 'chat', to: 'guest-aaa111', text: 'Shall we do the aarti together?', n: 2 }); ok((await A.next('chat')).text === 'Shall we do the aarti together?', 'kind typed words reach Meera'); await B.next('chat-ok');
await wait(800); B.send({ t: 'chat', to: 'guest-aaa111', text: 'you are a f u c k i n g idiot', n: 3 }); const no1 = await B.next('chat-no'); ok(no1.reason === 'unkind' && no1.n === 3, 'unkind words are refused');
await wait(800); B.send({ t: 'chat', to: 'guest-aaa111', text: 'visit www.example.com', n: 4 }); ok((await B.next('chat-no')).reason === 'link', 'links are refused');
await wait(300); ok(!A.inbox.some((m) => m.t === 'chat'), 'Meera never sees the refused messages');
await wait(800); for (let i = 0; i < 6; i++) B.send({ t: 'chat', to: 'guest-aaa111', q: 0, n: 10 + i }); await wait(600);
ok(B.inbox.some((m) => m.t === 'chat-no' && m.reason === 'slow'), 'a flood of messages is slowed down'); A.inbox.length = 0; B.inbox.length = 0;
const C = player('guest-ccc333', 'chutiya'); const wc = await C.hello(); const jc = await A.next('join'); ok(jc.p.name === 'Devotee', 'an unkind display name is shown as "Devotee"'); C.ws.close(); await A.next('leave'); await B.next('join'); await B.next('leave');
B.send({ t: 'e', k: 'launch-missiles' }); await wait(300); ok(!A.inbox.some((m) => m.t === 'e'), 'unknown events are dropped');
A.send({ t: 'claim', hall: 'shiva-1', spot: 4 }); const ca = await A.next('claim'); ok(ca.ok, 'Meera claims place 4 in shiva-1');
const sp = await B.next('spot'); ok(sp.id === 'guest-aaa111' && sp.spot === 4, 'Arjun is told place 4 is taken');
B.send({ t: 'claim', hall: 'shiva-1', spot: 4 }); const cb = await B.next('claim'); ok(!cb.ok, 'Arjun cannot take the same place');
B.send({ t: 'claim', hall: 'shiva-1', spot: 5 }); ok((await B.next('claim')).ok, 'Arjun takes place 5 instead');
A.send({ t: 'release' }); const rel = await B.next('spot'); ok(rel.id === 'guest-aaa111' && rel.hall === null, 'leaving the place frees it');
A.send({ t: 'ping', c: 123 }); const pg = await A.next('pong'); ok(pg.c === 123 && Math.abs(pg.s - Date.now()) < 60000, 'clock sync answers');
// the same player reconnecting replaces the old socket without a spurious "leave"
const A2 = player('guest-aaa111', 'Meera'); const w2 = await A2.hello(); ok(w2.players.some((p) => p.id === 'guest-bbb222' && p.spot && p.spot.spot === 5), 'a rejoining player sees who holds which place');
await wait(400); ok(!B.inbox.some((m) => m.t === 'leave'), 'a reconnect does not look like leaving');
A2.ws.close(); const lv = await B.next('leave'); ok(lv.id === 'guest-aaa111', 'closing the app tells the others');
B.ws.close(); try { A.ws.close(); } catch (e) {}
console.log('all good');
