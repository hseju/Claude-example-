# Cozy Camping World

A small, living 3D campsite in the browser. Three cute campers spend the night in a magical
forest: they tend the fire, cook, fish off the dock, stargaze, explore the trails, chat and go
to bed in their tents. You can watch, or create your own camper and join in.

```bash
cd cozy-camp
npm install
npm run dev        # http://localhost:5173
npm test           # simulation tests (headless, no browser needed)
npm run build      # typecheck + production build in dist/
```

## What's in the first playable prototype

| Requirement | Where it lives |
|---|---|
| Explorable forest campsite: fire ring, 2 canvas tents, cooking table, tarp, lake + dock, stream + footbridge, trails, meadow with hammock, blanket, bench and telescope | `src/sim/environments/forestNight.ts` (layout), `src/render/*` (models) |
| Three animated campers: you plus Juniper and Theo (autonomous) | `src/sim/character.ts`, `src/render/Avatar.tsx` |
| Fuel-driven campfire: flames, light, sparks, smoke and crackle all follow the fuel level; it burns down, can be relit, and heavy rain can put it out | `src/sim/world.ts` (`stepFire`), `src/render/Campfire.tsx` |
| Tent with an interactive entrance: flaps open, campers crawl in and sleep in sleeping bags, lantern glow inside; tents can be pitched and packed | `src/sim/activities/tent.ts`, `src/render/Tent.tsx` |
| Fishing: fish swim on their own, notice the bobber, nibble, bite; reel in; keep or release (you choose when it's your camper) | `src/sim/activities/fishing.ts`, `src/sim/wildlife.ts` |
| Cooking: get ingredients (or a fish from the bucket), chop on the board, cook in the pan over the fire (food colour changes as it cooks), serve plates, sit down and eat | `src/sim/activities/cooking.ts` |
| Elevated overview camera (orbit, pan, zoom) and a follow camera that glides behind a camper | `src/render/CameraRig.tsx` |
| Dynamic lighting, weather, seasons, environmental sound and nature animation | `src/render/Atmosphere.tsx`, `sky.ts`, `Weather.tsx`, `Vegetation.tsx`, `src/audio/engine.ts` |

Everything you see is an actual simulated 3D object; there are no pre-rendered images or
background videos. Activities change persistent state (fuel, logs in the woodpile, fish in the
bucket, plates on the table, finds in the nature basket, tent pitch), and the campsite saves to
`localStorage` every 10 seconds and when the tab closes.

## Controls

| Input | Action |
|---|---|
| Drag | Rotate the camera |
| Right-drag, Shift-drag, two fingers | Pan |
| Scroll, pinch | Zoom |
| W A S D / arrows | Pan the overview, or walk when following your camper (Shift runs) |
| Q / E | Turn the overview camera |
| E | Interact with the nearest object while walking as your camper |
| C | Overview ↔ follow camera |
| 1 2 3 | Select a camper |
| Space | Pause / resume |
| B / T / H | Arrange furniture / time & weather / help |
| Esc | Close, deselect or cancel placement |

Tap a camper to inspect them (needs, current activity). Tap your camper (★) and then the ground
to walk, or use their activity menu. Tap an object to see its state and what you can do with it.
On touch screens a joystick appears while following your camper.

**Sandbox** (sun icon): drag the time of day, change speed (1–8×), pick the weather (clear,
cloudy, rain, thunderstorm, mist, snow in winter), switch seasons, and override the wind.

**Arrange furniture** (hammer): pick up chairs, benches, lanterns, crates, the blanket, the
telescope or a tent and put them somewhere else, or add new pieces. Placement is checked against
water, trees and other objects, and the navigation grid is rebuilt so campers walk around the new
layout.

## How the simulation works

```
World.update(dt) ── fixed sub-steps ──► environment (time, sun/moon, weather mix, wind, temperature, snow)
                                     ├─► campfire (fuel burn, intensity, kettle, pan cooking)
                                     ├─► each camper: needs → AI decision → activity script → locomotion
                                     ├─► seated campers chat; rain sends AI campers to shelter
                                     └─► fish (wander, notice bobber, nibble, bite) and animals (wander, flee)
```

- **Campers** have five needs (energy, fullness, warmth, fun, company). Needs decay with time,
  cold, rain and activity; warmth rises near the fire scaled by its intensity.
- **Decisions** (`src/sim/brain.ts`): every available activity reports a utility from needs,
  time of day and weather; personality multipliers (Juniper loves fishing and stargazing, Theo
  loves cooking and the fire), a variety penalty for recent activities and a little randomness
  pick between the top options.
- **Activities** are generator scripts (`src/sim/activities/*`). A script walks somewhere
  (A* on a 0.5 m grid with cheaper trail cells and path smoothing), reserves an interaction slot
  (seat, bed, dock spot, cooking spot), plays poses, holds items, changes world state and
  can ask the player a question. Every script cleans up after itself if it's interrupted: the
  slot is released and the camper steps back out of the chair or tent.
- **Your camper** has *autopilot*: when you're not directing them they live like the others.
  Any command or WASD movement takes over; autopilot resumes after a short pause.
- The simulation is plain TypeScript with no rendering dependencies, so `npm test` runs a
  full in-game day headless and checks the campers actually fish, cook, eat, tend the fire,
  pitch the empty tent, shelter from storms and sleep.

### Rendering

React Three Fiber renders the world from simulation state each frame without React re-renders
(UI panels refresh a few times per second). All models are built from simple primitives with
shared materials. A small shader patch adds wind sway to trees, grass and bushes, and snow that
settles on upward-facing surfaces in winter. High quality adds lake reflections, soft shadows
from the moon/sun and the fire, and bloom; **Settings → Graphics → Light** turns those off for
slower devices. Static props are merged into one mesh per material to keep draw calls down.

### Sound

All audio is synthesised with the Web Audio API (no audio files): wind, rain, fire roar and
crackles, the stream, lake lapping, crickets on warm nights, daytime birds, owl hoots, thunder
and one-shots for casting, splashes, chopping, hammering, tent zips and more. Volumes follow
the simulation and the distance from the camera focus. Sound starts after the first click or
key press (browser autoplay rules).

## Code map

```
src/sim/            simulation (no DOM, no three.js)
  world.ts          World: owns everything, steps the sim, commands, building, sandbox
  environment.ts    time of day, sun height, weather transitions, wind, temperature
  terrain.ts        height field, water, trails, deterministic tree/rock/decor scatter
  nav.ts            walkability grid, A*, string pulling, object colliders
  objects.ts        object kinds, interaction slots, colliders, build catalogue
  character.ts      camper defaults, personalities, starting needs
  brain.ts          utility-based activity choice
  activities/       campfire, cooking, fishing, tent, leisure scripts + menu/object actions
  wildlife.ts       fish and animals
  persistence.ts    save / restore
  environments/     environment definitions and the roadmap of future worlds
src/render/         React Three Fiber scene (terrain, water, sky, props, avatars, wildlife, weather, camera)
src/ui/             HUD, inspector cards, sandbox/settings/help/build panels, avatar creator
src/audio/          procedural sound engine
src/net/            planned multiplayer message contract
src/state/store.ts  the World instance, UI state (zustand), preferences, autosave
```

## Extending it

### New environments

Beach, winter, summer lakeside and autumn worlds are listed in
`src/sim/environments/index.ts` (`PLANNED_ENVIRONMENTS`) and shown as "soon" in the sandbox
panel. Each one is an `EnvironmentDefinition`: terrain function, water bodies, trails, object
layout, scatter settings, viewpoints, wildlife, season palettes and defaults. Characters,
activities, objects, weather and the renderer are shared, so a new world is mostly data plus any
new object kinds and activities it needs (for example `kayak` + `paddle`, `swim`, `snowman`).
The forest already supports all four seasons, so winter snow cover and autumn leaves are in place.

### New activities

Add an `ActivityDef` (label, icon, `blocked`, `utility`, `run` generator) to one of the files in
`src/sim/activities/` and include it in that file's export list. The AI picks it up
automatically; add its id to `MENU_ACTIVITIES` to show it in the player's menu, or to
`objectActions` to offer it on an object.

### Blender models

The prototype's models are procedural so the whole world can animate from simulation state
(flame height from fuel, tent pitch progress, door flaps, food colour, held items). Static props
can be swapped for Blender models: export a `.glb` (Y up, metres, origin on the floor, front
facing +Z), put it in `public/models/`, and list it in `MODEL_MANIFEST` in
`src/render/assets.tsx`. The procedural model is shown while it loads. Stateful pieces (campfire,
tents, lanterns, avatars) keep their procedural rigs until they're rebuilt as rigged models with
matching named parts.

### Multiplayer

`src/net/protocol.ts` defines the planned message contract. Because the simulation is
headless TypeScript, a Node server can run the authoritative `World`, validate client intents with
the same `blocked()` rules, and stream compact camper frames for interpolation. Real people would
join as `controller: 'remote'` campers with a blue ◆ name tag, so they stay distinguishable from
autonomous campers (🍃).

## Known limitations

- Single player only; multiplayer is designed but not built.
- No Blender-authored assets ship with the repo; everything is procedural.
- Only the Magical Forest world is playable.
- Performance was checked by counting draw calls (about 450 visible meshes; the fire's shadow
  pass refreshes every other frame) rather than by profiling on real hardware. The automated
  screenshots ran on a software renderer, which can't measure frame rate.
