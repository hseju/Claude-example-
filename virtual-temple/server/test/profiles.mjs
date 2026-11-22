// Profiles: create, sign in on a "second device", save an avatar, sign out, the wrong-passphrase limit, deletion.
// Run against `wrangler dev` (default) or a deployed server: API=https://... node test/profiles.mjs
const API = process.env.API || 'http://127.0.0.1:8787';
const ORIGIN = 'http://localhost:8765';
const email = `test-${Math.random().toString(36).slice(2, 8)}@example.com`;
const key = (s) => [...new Uint8Array(32)].map((_, i) => ((s.charCodeAt(i % s.length) * 7 + i) % 256).toString(16).padStart(2, '0')).join('');
const call = async (method, path, body, token, origin = ORIGIN) => {
  const r = await fetch(API + path, { method, headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, ...j, cors: r.headers.get('access-control-allow-origin') };
};
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const look = { name: 'Meera', presentation: 'fem', color: 'saffron', outfit: 'saree', junk: { deep: 1 } };
let r = await call('POST', '/auth/register', { email, key: key('lotus123'), look });
ok(r.status === 201 && r.token && r.profile.look.name === 'Meera' && !('junk' in r.profile.look) && r.cors === ORIGIN, 'a new profile is created, its look cleaned, for the temple site only');
const phone = r.token;
r = await call('POST', '/auth/register', { email, key: key('other') }); ok(r.status === 409, 'the same email cannot be registered twice');
r = await call('POST', '/auth/login', { email: email.toUpperCase(), key: key('wrong!') }); ok(r.status === 401 && r.code === 'wrong', 'a wrong passphrase is refused');
r = await call('POST', '/auth/login', { email: 'nobody-' + email, key: key('lotus123') }); ok(r.status === 401 && r.code === 'none', 'an unknown email is told to create a profile');
r = await call('POST', '/auth/login', { email: ' ' + email.toUpperCase() + ' ', key: key('lotus123') }); ok(r.status === 200 && r.token && r.profile.look.name === 'Meera', 'signing in on a second device brings the same avatar');
const laptop = r.token;
r = await call('PUT', '/me', { look: { ...look, color: 'teal', name: 'Meera Devi' } }, laptop); ok(r.status === 200, 'the second device saves a new look');
r = await call('GET', '/me', null, phone); ok(r.status === 200 && r.profile.look.color === 'teal' && r.profile.look.name === 'Meera Devi', 'the first device sees the new look');
r = await call('POST', '/auth/logout', null, phone); ok(r.status === 200, 'signing out on the first device');
r = await call('GET', '/me', null, phone); ok(r.status === 401, 'its session no longer works');
r = await call('GET', '/me', null, laptop); ok(r.status === 200, 'the other device stays signed in');
r = await call('GET', '/me', null, 'x'.repeat(43)); ok(r.status === 401, 'a made-up session is refused');
r = await call('POST', '/auth/login', { email, key: key('lotus123') }, null, 'https://evil.example'); ok(r.status === 403 && !r.cors, 'other websites cannot use profiles');
let last; for (let i = 0; i < 9; i++) last = await call('POST', '/auth/login', { email, key: key('guess' + i) });
ok(last.status === 429, 'after eight wrong passphrases the email is paused');
r = await call('POST', '/auth/login', { email, key: key('lotus123') }); ok(r.status === 429, 'even the right passphrase waits out the pause');
r = await call('DELETE', '/me', null, laptop); ok(r.status === 200, 'deleting the profile');
r = await call('GET', '/me', null, laptop); ok(r.status === 401, 'every session ends with it');
console.log(process.exitCode ? 'some checks failed' : 'all good');
