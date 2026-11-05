// Accounts and saved avatars.
//
// Providers are pluggable. This prototype ships one working provider, "device", which keeps a
// passphrase-protected profile in this browser only. Google and Apple sign-in need an OAuth
// client and a backend to verify tokens, so they are declared but report `available: false`
// until configured (see README "Authentication"). Guests are never persisted.

const KEY = 'vt.accounts.v1', SESSION = 'vt.session.v1', SETTINGS = 'vt.settings.v1';

function load(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

async function hash(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vt:' + text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { // non-secure context fallback (still never stores the plain passphrase)
    let h = 2166136261; for (const c of 'vt:' + text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
  }
}

export const PROVIDERS = {
  google: { id: 'google', label: 'Continue with Google', available: false, reason: 'Needs a Google OAuth client ID and a token-verifying backend.' },
  apple: { id: 'apple', label: 'Continue with Apple', available: false, reason: 'Needs an Apple Services ID and a token-verifying backend.' },
  device: { id: 'device', label: 'Email', available: true },
};

export const storageAvailable = (() => { try { localStorage.setItem('vt.t', '1'); localStorage.removeItem('vt.t'); return true; } catch (e) { return false; } })();

export class ProfileStore {
  constructor() { this.user = null; }
  restore() {
    const s = load(SESSION, null); if (!s) return null;
    const acc = load(KEY, {})[s.email]; if (!acc) return null;
    this.user = { kind: 'registered', email: s.email, avatar: acc.avatar, id: 'u-' + s.email };
    return this.user;
  }
  guest(avatar) { this.user = { kind: 'guest', id: 'guest-' + Math.random().toString(36).slice(2, 9), avatar }; return this.user; }
  async register(email, pass, avatar) {
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (pass.length < 6) throw new Error('Use a passphrase of at least 6 characters.');
    if (!storageAvailable) throw new Error('This browser is blocking site storage, so a profile cannot be saved. Continue as a guest instead.');
    const all = load(KEY, {});
    if (all[email]) throw new Error('A profile with this email already exists on this device. Sign in instead.');
    all[email] = { pass: await hash(pass), avatar, created: Date.now() }; save(KEY, all); save(SESSION, { email });
    this.user = { kind: 'registered', email, avatar, id: 'u-' + email }; return this.user;
  }
  async signIn(email, pass) {
    email = email.trim().toLowerCase();
    const acc = load(KEY, {})[email];
    if (!acc) throw new Error('No profile with this email on this device. Create one below.');
    if (acc.pass !== await hash(pass)) throw new Error('That passphrase does not match. Try again.');
    save(SESSION, { email }); this.user = { kind: 'registered', email, avatar: acc.avatar, id: 'u-' + email }; return this.user;
  }
  saveAvatar(avatar) {
    if (!this.user) return false; this.user.avatar = avatar;
    if (this.user.kind !== 'registered') return false;
    const all = load(KEY, {}); if (!all[this.user.email]) return false; all[this.user.email].avatar = avatar; return save(KEY, all);
  }
  signOut() { try { localStorage.removeItem(SESSION); } catch (e) {} this.user = null; }
  loadSettings(def) { return { ...def, ...load(SETTINGS, {}) }; }
  saveSettings(s) { save(SETTINGS, s); }
}
