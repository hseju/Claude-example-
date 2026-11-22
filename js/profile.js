// Accounts and saved avatars.
//
// A profile is an email, a passphrase and your avatar (its look and name). It lives on the temple server (server/,
// the Accounts object), so it follows you to any phone or browser: sign in anywhere and your devotee is there. The
// passphrase never leaves your device; it is stretched here (PBKDF2, 210,000 rounds, salted with your email) into
// a key, and the server keeps only a salted hash of that key. Signing in gives a session token kept in this browser
// until you sign out (or 180 days pass).
//
// If the server cannot be reached (offline, or a copy of the app that is not allowed to reach it), a profile can
// still be made and used on this device, as before; signing in online later moves it up to your account. Google and
// Apple sign-in are declared but switched off: they need an OAuth client (see README "Authentication"). Guests are
// never saved.

const KEY = 'vt.accounts.v1', SESSION = 'vt.session.v1', SETTINGS = 'vt.settings.v1';
export const ACCOUNTS_URL = (() => {
  // for local testing only: a copy served from this machine may use a local server (?server=ws://127.0.0.1:8787)
  try {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('server');
    if (local && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(local)) return local.replace(/^ws/, 'http');
  } catch (e) { /* not in a browser */ }
  return 'https://virtual-temple.hseju.workers.dev';
})();

function load(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// the device-only profiles' passphrase check (never stores the plain passphrase)
async function hash(text) {
  try { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vt:' + text))); }
  catch (e) { let h = 2166136261; for (const c of 'vt:' + text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16); }
}
// the key sent to the server in place of the passphrase
async function stretch(email, pass) {
  if (!crypto.subtle) throw new Error('Profiles need a secure (https) connection.');
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('virtual-temple:' + email), iterations: 210000 }, base, 256));
}
class Offline extends Error {}
async function api(method, path, body, token) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  let r;
  try {
    r = await fetch(ACCOUNTS_URL + path, { method, signal: ctl.signal, keepalive: method === 'POST' && path === '/auth/logout',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { throw new Offline('The temple server could not be reached.'); } finally { clearTimeout(timer); }
  let j = {}; try { j = await r.json(); } catch (e) { /* empty */ }
  if (r.status === 403 && !r.headers.get('access-control-allow-origin')) throw new Offline('Profiles are not available in this copy of the temple.');
  return { status: r.status, ok: r.ok, body: j };
}
const cleanEmail = (email) => {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
};
const hasLook = (l) => !!(l && Object.keys(l).length);

export const PROVIDERS = {
  google: { id: 'google', label: 'Continue with Google', available: false, reason: 'Needs a Google OAuth client ID and a token-verifying backend.' },
  apple: { id: 'apple', label: 'Continue with Apple', available: false, reason: 'Needs an Apple Services ID and a token-verifying backend.' },
  device: { id: 'device', label: 'Email', available: true },
};

export const storageAvailable = (() => { try { localStorage.setItem('vt.t', '1'); localStorage.removeItem('vt.t'); return true; } catch (e) { return false; } })();

export class ProfileStore {
  constructor() { this.user = null; }
  _cloudUser(email, token, look) { this.user = { kind: 'registered', cloud: true, email, token, avatar: hasLook(look) ? look : null, id: 'u-' + email }; this._store(); return this.user; }
  _store() { const u = this.user; if (u && u.cloud) save(SESSION, { email: u.email, cloud: true, token: u.token, avatar: u.avatar }); }
  _clear() { try { localStorage.removeItem(SESSION); } catch (e) { /* blocked */ } }

  // who was signed in on this device last time (from the copy kept here; refresh() checks it with the server)
  restore() {
    const s = load(SESSION, null); if (!s || !s.email) return null;
    if (s.cloud && s.token) { this.user = { kind: 'registered', cloud: true, email: s.email, token: s.token, avatar: s.avatar || null, id: 'u-' + s.email }; return this.user; }
    const acc = load(KEY, {})[s.email]; if (!acc) return null;
    this.user = { kind: 'registered', cloud: false, email: s.email, avatar: acc.avatar, id: 'u-' + s.email };
    return this.user;
  }
  // bring a signed-in profile up to date from the server: 'ok', 'changed' (a new look from another device),
  // 'signedout' (the session ended elsewhere), 'offline' or 'local' (a device-only profile)
  async refresh() {
    const u = this.user; if (!u || !u.cloud) return 'local';
    let r; try { r = await api('GET', '/me', null, u.token); } catch (e) { return 'offline'; }
    if (r.status === 401) { this._clear(); this.user = null; return 'signedout'; }
    if (!r.ok) return 'offline';
    const look = r.body.profile && r.body.profile.look, changed = hasLook(look) && JSON.stringify(look) !== JSON.stringify(u.avatar);
    if (hasLook(look)) u.avatar = look;
    this._store();
    return changed ? 'changed' : 'ok';
  }
  guest(avatar) { this.user = { kind: 'guest', id: 'guest-' + Math.random().toString(36).slice(2, 9), avatar }; return this.user; }

  async register(email, pass, avatar) {
    email = cleanEmail(email);
    if (pass.length < 6) throw new Error('Use a passphrase of at least 6 characters.');
    if (!storageAvailable) throw new Error('This browser is blocking site storage, so you cannot stay signed in here. Continue as a guest instead.');
    let r;
    try { r = await api('POST', '/auth/register', { email, key: await stretch(email, pass), look: avatar || {} }); }
    catch (e) { if (e instanceof Offline) return this._registerDevice(email, pass, avatar); throw e; }
    if (r.status === 201) { const u = this._cloudUser(email, r.body.token, r.body.profile && r.body.profile.look); if (!u.avatar && avatar) u.avatar = avatar; return u; }
    throw new Error(r.body.error || 'The profile could not be created. Try again.');
  }
  async signIn(email, pass) {
    email = cleanEmail(email);
    if (!storageAvailable) throw new Error('This browser is blocking site storage, so you cannot stay signed in here. Continue as a guest instead.');
    const key = await stretch(email, pass);
    let r;
    try { r = await api('POST', '/auth/login', { email, key }); }
    catch (e) { if (e instanceof Offline) return this._signInDevice(email, pass); throw e; }
    if (r.status === 200) return this._cloudUser(email, r.body.token, r.body.profile && r.body.profile.look);
    // a profile made on this device before profiles moved online: carry it up to your account now
    if (r.status === 401 && r.body.code === 'none') {
      const acc = load(KEY, {})[email];
      if (acc && acc.pass === await hash(pass)) {
        const r2 = await api('POST', '/auth/register', { email, key, look: acc.avatar || {} });
        if (r2.status === 201) { const all = load(KEY, {}); delete all[email]; save(KEY, all); return this._cloudUser(email, r2.body.token, r2.body.profile && r2.body.profile.look); }
      }
    }
    throw new Error(r.body.error || 'Signing in did not work. Try again.');
  }
  // device-only profiles: when the server cannot be reached
  async _registerDevice(email, pass, avatar) {
    const all = load(KEY, {});
    if (all[email]) throw new Error('A profile with this email already exists on this device. Sign in instead.');
    all[email] = { pass: await hash(pass), avatar, created: Date.now() }; save(KEY, all); save(SESSION, { email });
    this.user = { kind: 'registered', cloud: false, email, avatar, id: 'u-' + email }; return this.user;
  }
  async _signInDevice(email, pass) {
    const acc = load(KEY, {})[email];
    if (!acc) throw new Error('The temple server could not be reached, and there is no profile with this email saved on this device. Check your connection and try again.');
    if (acc.pass !== await hash(pass)) throw new Error('That passphrase does not match. Try again.');
    save(SESSION, { email }); this.user = { kind: 'registered', cloud: false, email, avatar: acc.avatar, id: 'u-' + email }; return this.user;
  }

  // save your avatar: to your account (and the copy kept here), or to this device for a device-only profile
  async saveAvatar(avatar) {
    const u = this.user; if (!u) return false; u.avatar = avatar;
    if (u.kind !== 'registered') return false;
    if (u.cloud) { this._store(); try { const r = await api('PUT', '/me', { look: avatar }, u.token); return r.ok; } catch (e) { return false; } }
    const all = load(KEY, {}); if (!all[u.email]) return false; all[u.email].avatar = avatar; return save(KEY, all);
  }
  async signOut() {
    const u = this.user; this._clear(); this.user = null;
    if (u && u.cloud) { try { await api('POST', '/auth/logout', null, u.token); } catch (e) { /* the session simply lapses */ } }
  }
  // delete your profile everywhere (or from this device, for a device-only profile)
  async deleteProfile() {
    const u = this.user; if (!u || u.kind !== 'registered') return false;
    if (u.cloud) { const r = await api('DELETE', '/me', null, u.token); if (!r.ok) throw new Error(r.body.error || 'The profile could not be deleted. Try again.'); }
    else { const all = load(KEY, {}); delete all[u.email]; save(KEY, all); }
    this._clear(); this.user = null; return true;
  }
  loadSettings(def) { return { ...def, ...load(SETTINGS, {}) }; }
  saveSettings(s) { save(SETTINGS, s); }
}
