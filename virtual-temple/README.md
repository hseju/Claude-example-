# Virtual Temple

A browser-based, mobile-first 3D prototype of a living temple campus. You create a small devotee avatar, walk a stone temple complex with three shrines, enter a 12-place prayer hall, take a lotus-marked spot and offer prayers: namaste, the hall bell, a diya, flowers, incense, abhishek at the Shiva shrine, and a simulated shared aarti. In the garden, a meditation hut offers guided breathwork and short guided meditations.

It is plain HTML, CSS and ES modules on top of [three.js](https://threejs.org) 0.160 (loaded from jsDelivr). There is no build step and no image asset: architecture and textures are generated in the browser. Music and ambience are licensed recordings in `audio/` (see `audio/CREDITS.md`); effects are synthesised.

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
| Devotees: rigged characters (27-bone skeleton with eyes, lids, brows, jaw and mouth corners; one skinned mesh each, smoothly weighted across shoulders, elbows, wrists, waist, knees and neck). Faces blink, glance around, smile, close their eyes in prayer and chant during aarti. Hair: short, wavy, bun, braid, ponytail, long open, curly, top knot, shikha, receding; head coverings: safa turban or Gandhi topi. with sculpted bodies by gender, build and age; faces with eyes, lids, brows, nose, lips and ears; fingers; bare feet. Saree with pleats, zari border and pallu; kurta with collar, placket and churidar; dhoti with angavastram, sacred thread and mala; salwar kameez with dupatta. Bangles, earrings, mangalsutra, anklets, bindi, tilak or tripundra, moustache or beard, glasses; elders with walking sticks, devotees carrying puja thalis, children walking with a parent | Working |
| Avatar creator: name, gender (male or female), attire, colour, skin tone, hair, head covering, build, age, facial hair, forehead mark, glasses, jewellery; scroll or pinch to look closely | Working |
| Movement: WASD/arrows, click or tap to walk, on-screen joystick on touch screens, drag to orbit, wheel/pinch zoom from overview down to a close over-the-shoulder view (also a Close view button), map with shrine destinations, collisions | Working |
| Simulated devotees walking between shrines and pausing in namaste | Working, labelled as simulated |
| Prayer hall per temple: 3 × 4 lotus spots, occupancy (`7 / 12`), pick a spot or "Choose for me", walk-in animation, cinematic prayer camera | Working |
| Full hall: join an identical second hall, or wait in line for a spot | Working (Shiva hall 1 starts full to show this) |
| Prayer actions: namaste and bow, hall bell with pendulum physics, diya that stays lit with its own light, petals that land on the thali, incense with drifting smoke, abhishek at the Shiva lingam, darshan close-up | Working |
| Aarti: schedule with countdown, preview on demand, warming altar light, conch, hand bells, drone and melody, panch-pradip lamp circled by a simulated pujari, synchronised gestures, wide camera, closing bell and bow | Working, simulated |
| Backdrop: forested mountain ranges with snow peaks behind, three large waterfalls with spray, plunge pools and a river, drifting clouds and valley mist, flocks of egrets, crows, parakeets and pigeons, butterflies; fireflies, stars and moon at night | Working |
| Time of day: Morning, Afternoon, Evening, Night, or Auto (follows the device's local time). Sky, sun or moon, light, lamps, wildlife and sound all change and blend over a few seconds | Working |
| Music and sound: three music stations from the speaker button: **Uplifting** (feel-good grooves with tabla, sitar, handpan and warm beats), **Meditation** (calm pads, piano, handpan, singing bowls) and **Classical flute** (solo Carnatic alapanas), or **Auto** (uplifting by day, meditation at night). Tracks stream, shuffle and crossfade; now playing and Next in the panel. Under it a quiet mountain stream with a songbird by day and crickets at night; soft bare-foot steps; bells that ring once and settle; outdoor sound muffles inside the halls | Working, recorded (licensed) |
| Settings: master, ambience, bells & effects and temple music volumes, mute, quality tiers, time of day, incense on/off, reduced motion | Working, saved per browser |
| Meditation hut (Dhyana Kutir): a round hut in the south-west garden with two tiers of shaggy thatch and a brass kalash, a front gable with a glowing Om medallion and a "Meditation Hut" sign, carved teak posts with cream curtains tied back, lanterns under the eaves, a porch with glowing steps, and a cobbled path lined with stone lanterns past a lotus pond, rocks, broad-leaf plants and bougainvillea. Inside: a round jute mat, twelve maroon cushions (you sit in the centre, simulated devotees around the ring; the label shows seats taken), a woven pendant lamp with a real light, and an altar where a golden meditator sits in a halo of light that swells with your breath, with chakra lights along its spine, lamps, brass samai, marigolds, potted palms and incense. Your devotee sits cross-legged (sukhasana), palms up, eyes closed, garments draped over the lap. Views: facing the altar, facing your devotee, the whole hut; while practising, the camera becomes your own eyes on the cushion (your devotee steps out of frame), with Focus and, for diya gazing, the lamp | Working |
| Breathwork with guidance: Calm breath (resonant, 5.5 s in and out), Box breathing (4-4-4-4), 4-7-8, Nadi shodhana (alternate nostril; your devotee raises the right hand), Bhramari (humming bee, with a hum to follow) and Three-part breath, for 2 to 10 minutes. A cue pill counts each phase; soft tones swell on the in-breath and ebb on the out-breath; a voice guides every breath, or the first few and then only now and then, or not at all; your devotee's chest and the altar's halo rise with the breath. A Focus view shows a meditating figure in silhouette whose aura, light motes and seven chakras follow the breath | Working |
| Guided meditations, 5 to 15 minutes: Breath awareness, Body scan, Loving-kindness (maitri), Om chanting (10 min, with a chanted Om), Stress release (10 min), Sleep meditation (15 min, yoga nidra style; the screen dims and it ends softly) and Diya gazing (trataka, from your own view of the lamp); plus Silent sitting for 5 to 20 minutes with interval bells. Chosen from a tile picker. While practising: a title bar with a timer, captions for every spoken line, a glowing waveform of what is playing, and player controls for background (soft music, nature or silence), back and forward 15 seconds, pause, and voice and volume. Singing bowls open and close every session; the screen stays awake where the browser allows; minutes, sessions and streaks are kept on the device | Working; voice uses the device's speech voices |
| Guest mode, local email profiles that save the avatar | Working (device only) |
| Google / Apple sign-in | Not connected (see below) |
| Real-time multiplayer | Not connected (architecture ready, see below) |

## Honest limits

* **Every other devotee is simulated.** The HUD says "Multiplayer offline · N simulated devotees", hall occupancy notes how many are simulated, and their name tags read "simulated" while you choose a spot.
* **Audio: recorded and licensed.** Music, ambience and the aarti are real recordings under CC BY, CC BY-SA or public domain terms (see `audio/CREDITS.md`). Music streams from two `<audio>` elements that crossfade; ambience and aarti loops are decoded only while needed, so a phone never holds the whole library in memory. Bells you ring, the conch, footsteps, offerings and the hall chant are synthesised, as is the fallback for any empty manifest slot.

### Using recorded audio

Everything is listed in `audio/manifest.json`: an ambience loop per time of day, the aarti, and `playlists` (the music stations). Add a track by putting an MP3 in `audio/music/` and an entry `{ "file", "title", "artist" }` in a playlist; see `audio/README.md`. Use MP3 or AAC for Safari support, and keep the licence and attribution for each file in `audio/CREDITS.md`.
* **The meditation guide speaks with your device's own voices** (the Web Speech API), so it works offline and needs no download, but the voice depends on the device: voices named Natural, Neural or Enhanced, or English (India), sound best, and the hut lets you choose and preview one. Captions, breath tones and the breathing light guide you even where speech is unavailable. A recorded narration can replace any script: add `"guided": { "<session id>": "audio/guided/file.mp3" }` to `audio/manifest.json` (ids: `calm`, `box`, `relax`, `nadi`, `bhramari`, `dirga`, `breath`, `body`, `maitri`, `om`, `stress`, `sleep`, `trataka`, `timer`). The scripts are original to this project.
* **Breathwork is gentle by design.** No rapid or forceful breathing; holds are short and the panel says to skip them in pregnancy or with heart, lung or blood-pressure conditions. This is a wellbeing feature, not medical advice.
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
js/avatar.js        rigged devotees: body, face, garments, jewellery, props, and their poses (walk, namaste, bow, offer, ring, aarti, seated meditation with a lap-drape morph)
js/hut.js           the meditation hut: building, furnishings, path and pond, seats, camera views, the breathing altar
js/practice.js      breathwork and guided meditation: catalogue, scripts, session timeline, spoken guide, practice log
js/meditator.js     the meditator silhouette (SVG): aura, rays, lotus seat, chakras and motes that follow the breath
js/fx.js            GPU flames, incense smoke, petals, dust motes, fountain droplets, wind sway
js/postfx.js        tilt-shift (miniature look) and colour grade
js/audio.js         Web Audio graph, zones and time-of-day mixes, music stations (streamed, shuffled, crossfaded), recorded ambience and aarti, synthesised bells and effects
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
