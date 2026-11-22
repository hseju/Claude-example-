# Virtual Temple multiplayer server

A Cloudflare Worker with one Durable Object per room. Each player keeps one WebSocket to their room. The room relays where everyone is and what they do: walking, sitting in the hut, offerings in the prayer halls, pranam, the shared aarti. It is also the single authority on the twelve places in each prayer hall, so two people can never take the same lotus. Simulated devotees never touch the server; every browser keeps its own, and they step aside for real people.

It runs on Cloudflare's free plan. The room's whole state lives in its sockets' attachments, so the room can sleep between messages.

## Protocol (JSON over WebSocket, `wss://<worker>/room/<code>`)

| From | Message | Meaning |
| --- | --- | --- |
| client | `hello {id, name, look, s}` | join the room: a hashed player id, display name, avatar look and first state |
| client | `s {m, x, y, z, r, a, sp, h}` | your state: mode (`w` grounds, `h` prayer hall, `u` meditation hut, `x` menus), position, facing, animation, speed, hall id |
| client | `e {k, to?, hall?, spot?, at?, dur?}` | an event: `pranam`, `bell`, `flowers`, `diya`, `incense`, `abhishek`, `pradakshina`, `aarti` |
| client | `cfg {name, look}` | your name or look changed |
| client | `claim {hall, spot}` / `release` | take or leave a place in a prayer hall |
| client | `chat {to, q \| text, n}` | a private message: ready-made phrase number `q`, or typed `text` (checked by `js/chatfilter.js`; at most 5 per 10 seconds) |
| client | `ping {c}` | clock sync and keep-alive |
| server | `welcome {you, now, players}` | everyone already here, with their state and places |
| server | `join`, `leave`, `s`, `e`, `cfg`, `spot` | the same, relayed from other players |
| server | `claim {ok, hall, spot}` | whether your place was yours to take |
| server | `chat {from, text, q}` | a private message for you |
| server | `chat-ok {to, n}` / `chat-no {to, n, reason}` | your message was delivered, or not (`unkind`, `link`, `contact`, `long`, `slow`, `gone`) |
| server | `pong {c, s}` | the server's clock |

Everything a client sends is checked and trimmed: known keys and modes only, numbers clamped, names stripped of markup (and unkind names replaced with "Devotee"), messages under 4 KB. Chat goes only to the one player it is for and is never stored. A room holds at most 32 players. Anyone silent for two and a half minutes is dropped (the app pings every 25 seconds, even from a background tab).

## Profiles (HTTPS, JSON)

Devotee profiles live in a second Durable Object, `Accounts`, so they follow players to any device. Only the temple's own site may call these (CORS): `https://hseju.github.io`, and localhost for testing.

| Request | Body | Result |
| --- | --- | --- |
| `POST /auth/register` | `{email, key, look}` | a new profile and a session token |
| `POST /auth/login` | `{email, key}` | a session token and the saved look |
| `POST /auth/logout` | | ends this session only |
| `GET /me` | | the profile |
| `PUT /me` | `{look}` | saves the avatar |
| `DELETE /me` | | deletes the profile and every session |

`key` is the passphrase stretched in the browser (PBKDF2-SHA-256, 210,000 rounds, salted with the email); the passphrase itself is never sent. The server stores a salted SHA-256 of the key and only hashes of session tokens. After eight wrong passphrases an email waits fifteen minutes; each network address gets 40 attempts per fifteen minutes. Sessions last 180 days, at most 12 per profile.

## Run it locally

```sh
cd server
npm install
npm run dev                 # wrangler dev on http://127.0.0.1:8787
npm test                    # two simulated players run through join, move, pranam, places, leave; then profiles
```

Open the app with `?server=ws://127.0.0.1:8787` to use the local server. This only works when the app itself is served from localhost.

## Deploy

```sh
cd server
CLOUDFLARE_API_TOKEN=<token with the "Edit Cloudflare Workers" template> npx wrangler deploy
```

Then set `SERVER_URL` in `../js/net.js` to the `wss://` address wrangler prints, and publish the site. The live server is `https://virtual-temple.hseju.workers.dev` (account subdomain `hseju`). An account-owned token also needs `CLOUDFLARE_ACCOUNT_ID` set.
