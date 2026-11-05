# Virtual Temple

A browser-based, mobile-first 3D prototype of a living temple campus. You create a small devotee avatar, walk a stone temple complex with three shrines, enter a 12-place prayer hall, take a lotus-marked spot and offer prayers: namaste, the hall bell, a diya, flowers, incense, abhishek at the Shiva shrine, and a simulated shared aarti.

It is plain HTML, CSS and ES modules on top of [three.js](https://threejs.org) 0.160 (loaded from jsDelivr). There is no build step and no image or audio asset: architecture, textures and sound are all generated in the browser.

## Run it

Any static file server works:

```bash
cd virtual-temple
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight from disk (`file://`) does not work, because browsers block ES module imports there.

## What is in the prototype

| Area | Status |
| --- | --- |
| Miniature campus at golden hour: ivory-and-gold temples with shikharas, domed mandapas and rooftop chhatris; gateway with swinging brass bells; courtyard fountain, lotus ponds and kunds with pavilions; carved balustrades, lamp posts and rangoli; flowering trees, a brass Nandi, peacocks, hills and a waterfall; diyas, bunting, birds; tilt-shift and bloom | Working |
| Devotees: rigged characters (27-bone skeleton with eyes, lids, brows, jaw and mouth corners; one skinned mesh each, smoothly weighted across shoulders, elbows, wrists, waist, knees and neck). Faces blink, glance around, smile, close their eyes in prayer and chant during aarti. Hair: short, wavy, bun, braid, ponytail, long open, curly, top knot, shikha, receding; head coverings: safa turban or Gandhi topi. with sculpted bodies by presentation, build and age; faces with eyes, lids, brows, nose, lips and ears; fingers; bare feet. Saree with pleats, zari border and pallu; kurta with collar, placket and churidar; dhoti with angavastram, sacred thread and mala; salwar kameez with dupatta. Bangles, earrings, mangalsutra, anklets, bindi, tilak or tripundra, moustache or beard, glasses; elders with walking sticks, devotees carrying puja thalis, children walking with a parent | Working |
| Avatar creator: name, presentation, attire, colour, skin tone, hair, head covering, build, age, facial hair, forehead mark, glasses, jewellery; scroll or pinch to look closely | Working |
| Movement: WASD/arrows, click or tap to walk, on-screen joystick on touch screens, drag to orbit, wheel/pinch zoom from overview down to a close over-the-shoulder view (also a Close view button), map with shrine destinations, collisions | Working |
| Simulated devotees walking between shrines and pausing in namaste | Working, labelled as simulated |
| Prayer hall per temple: 3 × 4 lotus spots, occupancy (`7 / 12`), pick a spot or "Choose for me", walk-in animation, cinematic prayer camera | Working |
| Full hall: join an identical second hall, or wait in line for a spot | Working (Shiva hall 1 starts full to show this) |
| Prayer actions: namaste and bow, hall bell with pendulum physics, diya that stays lit with its own light, petals that land on the thali, incense with drifting smoke, abhishek at the Shiva lingam, darshan close-up | Working |
| Aarti: schedule with countdown, preview on demand, warming altar light, conch, hand bells, drone and melody, panch-pradip lamp circled by a simulated pujari, synchronised gestures, wide camera, closing bell and bow | Working, simulated |
| Backdrop: forested mountain ranges with snow peaks behind, three large waterfalls with spray, plunge pools and a river, drifting clouds and valley mist, flocks of egrets, crows, parakeets and pigeons, butterflies; fireflies, stars and moon at night | Working |
| Time of day: Morning, Afternoon, Evening, Night, or Auto (follows the device's local time). Sky, sun or moon, light, lamps, wildlife and sound all change and blend over a few seconds | Working |
| Temple soundscape: tanpura drone and raga phrases for the time of day (Bhairav at dawn on bansuri, Brindavani Sarang in the afternoon, Yaman at dusk on sitar with tabla, Malkauns at night); Indian birds (koel, bulbul, sparrow, myna, crow, barbet, parakeet, peacock, dove), cowbells, cicadas, crickets, frogs, owl; bells near and far; conch at dawn and dusk; waterfall roar; outdoor sound muffles inside the halls | Working, synthesised |
| Settings: master, ambience, bells & effects and temple music volumes, mute, quality tiers, time of day, incense on/off, reduced motion | Working, saved per browser |
| Guest mode, local email profiles that save the avatar | Working (device only) |
| Google / Apple sign-in | Not connected (see below) |
| Real-time multiplayer | Not connected (architecture ready, see below) |

## Honest limits

* **Every other devotee is simulated.** The HUD says "Multiplayer offline · N simulated devotees", hall occupancy notes how many are simulated, and their name tags read "simulated" while you choose a spot.
* **Audio: recorded where it matters.** Morning, afternoon, evening and night ambience, the morning and evening music, and the aarti are real field recordings from Indian temples and landscapes (Radio Aporee; public domain and CC BY-SA, see `audio/CREDITS.md`), trimmed, filtered and looped. Bells you ring, the conch, footsteps, offerings, the tanpura drone and the hall chant are still synthesised. Afternoon and night have no recorded music, by design: just ambience and a soft drone by the shrines.

### Using recorded audio

Drop licensed files into `virtual-temple/audio/` and point the matching slot in `audio/manifest.json` at them (empty slots use the built-in sound). For example:

```json
{
  "ambience.morning": "audio/dawn-birds.mp3",
  "ambience.night": "audio/night-crickets.mp3",
  "music.morning": "audio/bhairav-bansuri.mp3",
  "music.evening": "audio/sandhya-bhajan.mp3",
  "aarti": "audio/aarti.mp3"
}
```

Keys are `ambience.<morning|afternoon|evening|night>`, `music.<same>` and `aarti`. Each file loops while its time of day is active and replaces the matching synthesised layer; bells, conch, footsteps and offerings stay synthesised. Anything missing falls back to synthesis. Use MP3 or AAC for Safari support, and keep the licence and attribution for each file next to it.
* **Deity representations are deliberately restrained.** The Shiva shrine has a lingam on its pitha with tripundra, bilva and a dhara-patra; Ganesha is a sindoor-coated svayambhu form with inlaid eyes, silver mukut and modak, as seen in many historic shrines; Krishna is a shyam-stone murti in yellow pitambar with mukut, peacock feather, flute and vaijayanti mala. A production version should replace these with sculpted, reviewed models.

## Architecture

```
index.html          screens and HUD markup
css/app.css         UI layer
js/main.js          app state machine, input, cameras, UI wiring, render loop
js/world.js         campus: terrain, temples, gardens, NPC devotees, waypoint graph, collisions, time-of-day presets
js/scenery.js       mountains, waterfalls, river, clouds, mist, bird flocks, butterflies, fireflies, stars, moon
js/flora.js         trees (neem, gulmohar, bougainvillea, jacaranda, ashoka, coconut palm), flower beds and hedges, grass, lotus ponds, urli bowls
js/dome.js          prayer hall: shell, per-deity sanctum, 12 spots, offerings, aarti choreography
js/architecture.js  shared pieces: pillars, bells (pendulum + clapper), diyas, lamp stands, shikhara
js/avatar.js        rigged devotees: body, face, garments, jewellery, props, and their poses (walk, namaste, bow, offer, ring, aarti)
js/fx.js            GPU flames, incense smoke, petals, dust motes, fountain droplets, wind sway
js/postfx.js        tilt-shift (miniature look) and colour grade
js/audio.js         Web Audio graph, zones and time-of-day mixes, tanpura/bansuri/sitar/tabla, birds and insects, shared aarti track, optional recorded library
js/presence.js      hall capacity rules and the local simulation
js/profile.js       auth providers, profiles and settings storage
```

### Multiplayer path

`HallDirectory` in `js/presence.js` owns the rule that matters: a hall has 12 spots and a spot belongs to one occupant. `claim()` is atomic and rejects an occupant who already holds a spot anywhere; `release()` frees it and serves the waiting line; `findOrCreateAvailable()` opens identical hall instances on demand, so any number of visitors can be spread across halls of 12.

For real multiplayer, run the same class on an authoritative server (one room per hall instance, for example Colyseus or a WebSocket service) and replace `LocalSimulation` with a transport that sends `claim`, `release`, `enqueue` and avatar transforms. The server releases a spot when a client leaves or stops sending heartbeats. Friends and family can share a hall by joining the same instance id. The aarti track is already started per hall with an `offset` parameter (`TempleAudio.startAarti(duration, offset)`), so a shared server clock can keep every visitor on one ceremony track.

### Authentication

`js/profile.js` declares Google and Apple providers with `available: false`. Turning them on needs an OAuth client (Google Identity Services, Sign in with Apple JS) and a small backend that verifies the ID token and stores the avatar JSON. The "Email" provider in this prototype stores a SHA-256 hash of the passphrase (not a substitute for server-side auth) and the avatar in `localStorage` on the current device only; it is not a server account.

## Performance notes

* Quality tiers: **Low** (no shadows or post effects, 8 devotees), **Medium** (1024 shadows, tilt-shift, 14 devotees, capped pixel ratio; the default on phones), **High** (2048 shadows, 20 devotees).
* All diya flames in a scene are one GPU point draw; trees, flowers, pillars, petals and garlands are instanced; only the four diyas nearest you get real point lights.
* Reduced motion slows wind, stops camera drifts and swaps fades for cuts. The OS setting is respected on first load.
