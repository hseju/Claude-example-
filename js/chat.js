import { QUICK, MAX_CHAT, checkMessage, REASONS } from './chatfilter.js';

// Private chat with the real devotees in your room. Tap someone online (their avatar, their name tag, or their row in
// Play with friends) and a small sheet opens: a ready-made phrase is one tap ("Let's go!", "Let's do a prayer
// together", "Want to leave?"), or type a few kind words. Every typed message is checked here first, so you know
// at once, and again by the server, which never passes on anything unkind, links or contact details. Messages are
// between the two of you only and are not kept: they last as long as this visit. You can mute anyone.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Chat {
  constructor(net, { toast, onIncoming }) {
    this.net = net; this.toast = toast; this.onIncoming = onIncoming || (() => {});
    this.threads = new Map();   // player id -> [{ me, text, at, state }]
    this.unread = new Map();    // player id -> count
    this.muted = new Set();
    this.open = null;           // the player id whose sheet is open
    this.$ = (id) => document.getElementById(id);
    this.$('chatQuick').innerHTML = QUICK.map((q, i) => `<button type="button" data-q="${i}">${esc(q)}</button>`).join('');
    this.$('chatQuick').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) this.send({ q: +b.dataset.q }); });
    this.$('chatForm').addEventListener('submit', (e) => { e.preventDefault(); this.sendTyped(); });
    this.$('chatText').maxLength = MAX_CHAT;
    this.$('chatText').addEventListener('input', () => { this.$('chatErr').textContent = ''; });
    this.$('chatMute').addEventListener('click', () => this.toggleMute());
    this.$('chatClose').addEventListener('click', () => this.close());
    this.$('chatNote').addEventListener('click', () => { const id = this.$('chatNote').dataset.id; this.$('chatNote').classList.remove('on'); if (id) this.openWith(id); });
    net.on('chat', (p, m) => this._incoming(p, m));
    net.on('chat-ok', (m) => this._settle(m.to, m.n, 'sent'));
    net.on('chat-no', (m) => { this._settle(m.to, m.n, 'refused'); if (REASONS[m.reason]) this._error(REASONS[m.reason]); });
    net.on('leave', (p) => { if (this.open === p.id) this.render(); });
    net.on('join', (p) => { if (this.open === p.id) this.render(); });
  }
  get unreadTotal() { let n = 0; for (const v of this.unread.values()) n += v; return n; }
  _thread(id) { if (!this.threads.has(id)) this.threads.set(id, []); return this.threads.get(id); }

  openWith(id) {
    const p = this.net.players.get(id);
    if (!p && !this.threads.has(id)) { this.toast('They are not in the temple any more', 2400); return; }
    this.open = id; this.unread.delete(id); this.onIncoming();
    this.$('chatSheet').hidden = false; this.$('chatErr').textContent = ''; this.$('chatNote').classList.remove('on');
    this.render();
  }
  close() { this.open = null; this.$('chatSheet').hidden = true; }
  toggleMute() {
    const id = this.open; if (!id) return;
    if (this.muted.has(id)) { this.muted.delete(id); this.toast('Unmuted', 1600); } else { this.muted.add(id); this.toast('Muted. You will not see their messages this visit.', 2600); }
    this.render();
  }
  render() {
    const id = this.open; if (!id) return;
    const p = this.net.players.get(id), name = (p && p.name) || this._names?.[id] || 'Devotee';
    (this._names = this._names || {})[id] = name;
    this.$('chatName').textContent = name; this.$('chatInitial').textContent = name[0].toUpperCase();
    this.$('chatStatus').textContent = p ? (this.muted.has(id) ? 'online · muted' : 'online now') : 'has left the temple';
    this.$('chatMute').textContent = this.muted.has(id) ? 'Unmute' : 'Mute';
    const list = this._thread(id);
    this.$('chatLog').innerHTML = list.length ? list.map((m) => `<div class="msg ${m.me ? 'me' : 'them'}${m.state === 'refused' ? ' refused' : ''}"><span>${esc(m.text)}</span>${m.me && m.state === 'pending' ? '<i>sending…</i>' : m.state === 'refused' ? '<i>not sent</i>' : ''}</div>`).join('')
      : `<p class="empty">Say hello to ${esc(name)}. Tap a phrase below, or write a few kind words.</p>`;
    this.$('chatLog').scrollTop = 1e6;
    const can = !!p && this.net.online;
    for (const b of this.$('chatQuick').querySelectorAll('button')) b.disabled = !can;
    this.$('chatText').disabled = !can; this.$('chatSend').disabled = !can;
  }
  sendTyped() {
    const t = this.$('chatText').value.replace(/\s+/g, ' ').trim(); if (!t) return;
    const c = checkMessage(t); if (!c.ok) { this._error(REASONS[c.reason] || 'That message cannot be sent.'); return; }
    if (this.send({ text: t })) this.$('chatText').value = '';
  }
  send(body) {
    const id = this.open; if (!id) return false;
    const n = this.net.chat(id, body);
    if (!n) { this._error('You are offline. Messages can be sent when you are connected again.'); return false; }
    this._thread(id).push({ me: true, text: body.q != null ? QUICK[body.q] : body.text, at: Date.now(), state: 'pending', n });
    this.render(); return true;
  }
  _settle(id, n, state) { const m = this._thread(id).find((x) => x.me && x.n === n); if (m) { m.state = state; if (this.open === id) this.render(); } }
  _error(msg) { this.$('chatErr').textContent = msg; }
  _incoming(p, m) {
    if (this.muted.has(p.id)) return;
    this._thread(p.id).push({ me: false, text: m.text, at: Date.now() });
    (this._names = this._names || {})[p.id] = p.name;
    if (this.open === p.id && !this.$('chatSheet').hidden) { this.render(); return; }
    this.unread.set(p.id, (this.unread.get(p.id) || 0) + 1);
    const note = this.$('chatNote'); note.dataset.id = p.id;
    note.innerHTML = `<i>${esc((p.name || 'D')[0].toUpperCase())}</i><span><b>${esc(p.name || 'Devotee')}</b> ${esc(m.text)}</span><em>Reply</em>`;
    note.classList.add('on'); clearTimeout(this._noteT); this._noteT = setTimeout(() => note.classList.remove('on'), 7000);
    this.onIncoming(p, m);
  }
}
