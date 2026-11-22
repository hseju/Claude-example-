import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { World, TEMPLES, lerpAngle } from './world.js';
import { PrayerHall, SPOTS, ENTRANCE, hallRoute, hallFloor } from './dome.js';
import { Avatar, defaultConfig, randomConfig, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, OUTFITS, CLOTH_COLORS, PRESENTATIONS, BUILDS, AGES, FACIAL, MARKS, JEWELLERY, HEADWEAR, optionsFor, fitToPresentation } from './avatar.js';
import { TempleAudio } from './audio.js';
import { HallDirectory, LocalSimulation, HALL_CAPACITY } from './presence.js';
import { ProfileStore, storageAvailable } from './profile.js';
import { PostFX } from './postfx.js';
import { setAnisotropy } from './textures.js';
import { setPBRAnisotropy } from './pbr.js';
import { HUT, hutFloor, hutInside } from './hut.js';
import { Net, newRoomCode, inviteLink, netId } from './net.js';
import { RemotePlayers } from './remote.js';
import { Chat } from './chat.js';
import { PRASAD } from './prasad.js';
import { BREATHWORK, MEDITATIONS, TIMER, Guide, Session, PracticeLog, EXTRA_LINES } from './practice.js';
import { meditatorSVG, MeditatorVisual } from './meditator.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------- settings & quality
const profiles = new ProfileStore();
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = profiles.loadSettings({ quality: 'auto', tod: 'auto', incense: true, reducedMotion: prefersReduced, master: 80, ambience: 70, effects: 85, ceremony: 80, muted: false, musicStyle: 'auto', guideMode: 'guide', voiceURI: '', guideVoice: 'recorded', practiceBg: 'auto', breathTones: true });
const dpr = window.devicePixelRatio || 1;
function qualityPreset(q) {
  if (q === 'auto') q = 'high';   // the app is made for phones: they get the full look by default
  return {
    low: { level: 'low', pr: Math.min(dpr, 1), shadows: 0, post: false, npcs: 10, tilt: 0, bloom: 0 },
    medium: { level: 'medium', pr: Math.min(dpr, isTouch ? 1.3 : 1.5), shadows: 1024, post: true, npcs: 18, tilt: 1.5, bloom: 0.5 },
    high: { level: 'high', pr: Math.min(dpr, 2), shadows: 2048, post: true, npcs: 28, tilt: 2.0, bloom: 0.6 },
  }[q];
}
const Q = qualityPreset(settings.quality);
if (settings.reducedMotion) document.body.classList.add('reduced');

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.post, powerPreference: 'high-performance' });
} catch (e) {
  $('loadText').textContent = 'This browser could not start WebGL. Try a recent version of Chrome, Safari, Firefox or Edge with hardware acceleration on.';
  throw e;
}
renderer.setPixelRatio(Q.pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.shadows > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy())); setPBRAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const post = new PostFX(renderer); post.enabled = Q.post;
// the painted look: small brush strokes at full resolution (a broader brush on high), off on low
post.paint.enabled = Q.level !== 'low'; post.paint.radius = Q.level === 'high' ? 3 : 2; post.paint.scale = 1;   // full resolution keeps signs and lanterns crisp post.finalMat.uniforms.uGrain.value = Q.level === 'low' ? 0 : 0.035;
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 2200);

const audio = new TempleAudio();
audio.levels = { master: settings.master / 100, ambience: settings.ambience / 100, effects: settings.effects / 100, ceremony: settings.ceremony / 100 };
audio.muted = settings.muted;

let world, hall, directory, sim, playerRing;
const app = { mode: 'loading', hallState: null, currentHall: null, templeId: null, camMode: 'world', time: 0 };
const me = { id: null, config: defaultConfig(), avatar: null };
// the camera starts close behind your devotee, as in a third-person RPG; the overview is one tap away
const CLOSE_DIST = 5.0;
const cam = { close: 1, yaw: 0, pitch: 0.2, dist: CLOSE_DIST, tYaw: 0, tPitch: 0.2, tDist: CLOSE_DIST, eff: CLOSE_DIST, pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 32 };
const input = { keys: new Set(), joy: new THREE.Vector2(), auto: [], pointers: new Map(), drag: false };

// ---------------------------------------------------------------- boot
async function boot() {
  const fontWait = Promise.race([document.fonts ? Promise.all([document.fonts.load('48px "Tiro Devanagari Sanskrit"', 'ॐ नमः'), document.fonts.load('20px Marcellus')]) : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]);
  await fontWait.catch(() => {});
  $('loadText').textContent = 'Laying the stones';
  await frame();
  world = new World(renderer, Q);
  $('loadText').textContent = 'Lighting the lamps';
  await frame();
  hall = new PrayerHall(renderer, Q, audio);
  applyTOD(true);
  setInterval(() => applyTOD(), 30000);
  directory = new HallDirectory(Object.keys(TEMPLES));
  sim = new LocalSimulation(directory, randomConfig);
  sim.seed({ ganesha: 7, shiva: 12, krishna: 4 });
  sim.start();
  directory.on(onHallChange);
  for (const b of world.bells) b.onStrike = (bell, e = 1) => audio.bell(bell.worldPos, { size: bell.soundSize || 1, gain: 0.42 * (0.25 + 0.75 * e * e), hall: 0.05, stone: 0.35 });
  renderPresence();
  buildLabels(); buildCreator(); bindUI(); applySettingsUI();
  onResize();
  const restored = storageAvailable ? profiles.restore() : null;
  if (restored && restored.avatar) { me.config = { ...defaultConfig(), ...restored.avatar }; if (me.config.presentation === 'neutral') me.config.presentation = /saree|salwar/.test(me.config.outfit) ? 'fem' : 'masc'; }
  me.avatar = new Avatar(me.config, { shadows: Q.level !== 'low' });
  me.avatar.root.position.set(0, 0, 46.5); me.avatar.root.rotation.y = Math.PI;
  world.scene.add(me.avatar.root);
  playerRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(2.2), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  playerRing.rotation.x = -Math.PI / 2; world.scene.add(playerRing);
  if (/[?&]debug\b/.test(location.search)) window.__vt = { app, me, world, hall, post, directory, cam, input, settings, audio, preview, refreshCreator, hut: { state: hutState, guide, model: HUT, enter: enterHut, leave: leaveHut, start: startSession, end: endSession }, net, profiles, get remotes() { return remotes; }, temples: TEMPLES, spots: SPOTS, seated, act, beginAarti, enterTemple }; // local testing hook
  setMode('welcome');
  if (restored) profiles.refresh().then(onProfileRefresh);   // the copy kept here is shown at once; the server has the final word
  $('loading').style.opacity = '0'; setTimeout(() => $('loading').remove(), 900);
  last = performance.now(); requestAnimationFrame(loop);
}
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

function setMode(m) {
  app.mode = m;
  $('welcome').hidden = m !== 'welcome';
  $('creator').hidden = m !== 'creator';
  $('hud').classList.toggle('on', m === 'world');
  $('prayer').classList.toggle('on', m === 'hall');
  $('hutUI').classList.toggle('on', m === 'hut');
  $('labels').style.display = (m === 'world' || m === 'hall') ? '' : 'none';
  if (m !== 'world') { $('prompt').classList.remove('on'); $('map').classList.remove('on'); }
  if (m === 'welcome') renderWelcome();
}
function renderWelcome() {
  const u = profiles.user, reg = u && u.kind === 'registered';
  $('guestBtn').textContent = reg ? 'Continue as ' + ((u.avatar && u.avatar.name) || 'devotee') : 'Enter as guest';
  $('signinBtn').textContent = reg ? 'Switch profile' : 'Sign in or create profile';
}
// what the server said about the profile remembered on this device
function onProfileRefresh(res) {
  if (res === 'changed' && app.mode === 'welcome' && profiles.user && profiles.user.avatar) { me.config = { ...defaultConfig(), ...profiles.user.avatar }; me.avatar.setConfig(me.config); renderWelcome(); }
  if (res === 'signedout') {
    if (app.mode === 'welcome') { me.config = defaultConfig(); me.avatar.setConfig(me.config); renderWelcome(); }
    toast('You were signed out. Sign in again to use your profile.', 3600);
  }
}

// ---------------------------------------------------------------- creator
const preview = { scene: null, avatar: null, light: null };
function buildCreatorScene() {
  const s = new THREE.Scene(); s.background = new THREE.Color('#24150e'); s.fog = new THREE.Fog('#24150e', 6, 14);
  s.add(new THREE.HemisphereLight('#ffe9cc', '#3a2418', 0.9));
  const key = new THREE.DirectionalLight('#ffd6a0', 2.6); key.position.set(2, 4, 3); key.castShadow = Q.shadows > 0; key.shadow.mapSize.set(1024, 1024); s.add(key);
  const rim = new THREE.PointLight('#ff9a4a', 6, 6, 1.5); rim.position.set(-1.5, 2, -1.2); s.add(rim);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.16, 48), new THREE.MeshStandardMaterial({ color: '#c9a57a', roughness: 0.5 })); ped.position.y = -0.08; ped.receiveShadow = true; s.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.02, 8, 64), new THREE.MeshStandardMaterial({ color: '#e0b04f', metalness: 1, roughness: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; s.add(ring);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#3a2418', roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.16; floor.receiveShadow = true; s.add(floor);
  preview.scene = s;
}
function chipGroup(el, items, key, render) {
  el.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button'); b.type = 'button';
    if (render) render(b, it); else { b.className = 'chip'; b.textContent = it.label; }
    b.setAttribute('aria-pressed', String(me.config[key] === (it.id ?? it)));
    b.addEventListener('click', () => { const prev = me.config[key]; me.config[key] = it.id ?? it; if (key === 'presentation') presetsFor(me.config, prev); refreshCreator(); audio.uiTap(); });
    el.appendChild(b);
  }
}
// switching gender: what you chose for the other one is remembered, so switching back brings it back; anything that does
// not suit the new one starts from a sensible choice (saree, braid and bindi; kurta, short hair and tilak)
const lookMemo = {};
function presetsFor(c, from) {
  const keys = ['outfit', 'hair', 'headwear', 'mark', 'facial'];
  if (from && from !== c.presentation) lookMemo[from] = Object.fromEntries(keys.map((k) => [k, c[k]]));
  if (lookMemo[c.presentation]) Object.assign(c, lookMemo[c.presentation]);
  fitToPresentation(c);
}
function refreshCreator() {
  chipGroup($('cPres'), PRESENTATIONS, 'presentation');
  const g = me.config.presentation === 'masc' ? 'masc' : 'fem';   // only the choices that suit the chosen gender
  chipGroup($('cOutfit'), optionsFor(OUTFITS, g), 'outfit');
  chipGroup($('cColor'), CLOTH_COLORS, 'color', (b, it) => { b.className = 'swatch'; b.style.background = `linear-gradient(135deg, ${it.base} 60%, ${it.accent} 60%)`; b.setAttribute('aria-label', it.id); });
  chipGroup($('cSkin'), SKIN_TONES, 'skin', (b, it) => { b.className = 'swatch'; b.style.background = it; b.setAttribute('aria-label', 'Skin tone'); });
  chipGroup($('cHair'), optionsFor(HAIR_STYLES, g), 'hair');
  chipGroup($('cHairColor'), HAIR_COLORS, 'hairColor', (b, it) => { b.className = 'swatch'; b.style.background = it; b.setAttribute('aria-label', 'Hair colour'); });
  chipGroup($('cHeadwear'), optionsFor(HEADWEAR, g), 'headwear'); $('cHeadTitle').textContent = g === 'fem' ? 'Head covering & flowers' : 'Head covering';
  chipGroup($('cBuild'), BUILDS, 'build'); chipGroup($('cAge'), AGES, 'age');
  chipGroup($('cFacial'), optionsFor(FACIAL, g), 'facial'); $('cFacial').hidden = g === 'fem';
  chipGroup($('cMark'), optionsFor(MARKS, g), 'mark'); chipGroup($('cJewel'), JEWELLERY.map((j) => ({ id: j.id, label: j[g] || j.label })), 'jewellery');
  chipGroup($('cGlasses'), [{ id: false, label: 'No glasses' }, { id: true, label: 'Glasses' }], 'glasses');
  if (preview.avatar) preview.avatar.setConfig(me.config);
}
function buildCreator() {
  buildCreatorScene();
  preview.avatar = new Avatar(me.config); preview.scene.add(preview.avatar.root);
  $('cName').addEventListener('input', (e) => { me.config.name = e.target.value.slice(0, 20); });
  $('creatorRandom').addEventListener('click', () => { const n = me.config.name; me.config = { ...randomConfig(Math.random()), name: n }; refreshCreator(); });
  $('creatorDone').addEventListener('click', () => {
    me.config.name = ($('cName').value.trim() || 'Devotee').slice(0, 20);
    me.avatar.setConfig(me.config);
    if (profiles.user && profiles.user.kind === 'registered') { profiles.saveAvatar({ ...me.config }).then((ok) => toast(ok ? 'Avatar saved to your profile' : 'Avatar saved here; it will reach your profile next time you are online', 2800)); }
    enterWorld();
  });
}
function openCreator(fromWorld = false) {
  const u = profiles.user;
  $('creatorMode').textContent = u && u.kind === 'registered' ? (u.cloud ? `Saved to your profile (${u.email}), on every device you sign in on.` : `Saved to the profile for ${u.email} on this device.`) : 'Guest avatar. It will not be saved after you leave.';
  $('creatorDone').textContent = fromWorld ? 'Save and return' : 'Enter the temple';
  $('cName').value = me.config.name || '';
  refreshCreator(); setMode('creator');
  setTimeout(() => !isTouch && $('cName').focus(), 50);
}

// ---------------------------------------------------------------- world entry
let entered = false;
function enterWorld() {
  updateProfileChip(); startNet();
  fadeThrough(() => {
    setMode('world'); app.camMode = 'world';
    if (!entered) { me.avatar.root.position.set(0, 0, 46.5); me.avatar.root.rotation.y = Math.PI; cam.yaw = cam.tYaw = 0; entered = true; toast('Walk through the gate. Tap a shrine or open the map to choose where to go.', 5200); }
    snapCamera();
  });
}
function updateProfileChip() {
  const u = profiles.user;
  $('pName').textContent = me.config.name || 'Devotee';
  $('pDot').textContent = (me.config.name || 'D')[0].toUpperCase();
  $('pKind').textContent = u && u.kind === 'registered' ? 'saved' : 'guest';
  me.id = u ? u.id : (me.id || 'guest-' + Math.random().toString(36).slice(2, 8));
}

// ---------------------------------------------------------------- hall flow
function freeText(h) { const n = HALL_CAPACITY - directory.occupancy(h); return `${n === 1 ? 'One place is' : n + ' places are'} free. Tap a glowing lotus; dim ones are taken.`; }
function hallLabel(h) { return `Prayer hall ${h.index} · ${directory.occupancy(h)} / ${HALL_CAPACITY}`; }
function enterTemple(id) {
  if (app.mode !== 'world') return;
  // friends from your room in one of this temple's halls: join them there (a simulated devotee makes room if it is full)
  const withFriends = directory.instances(id).find((h) => h.spots.some((o) => o && o.remote));
  if (withFriends) { if (directory.occupancy(withFriends) >= HALL_CAPACITY) makeRoom(withFriends); if (directory.occupancy(withFriends) < HALL_CAPACITY) return goHall(withFriends); }
  const first = directory.instances(id)[0];
  if (directory.occupancy(first) < HALL_CAPACITY) return goHall(first);
  const alt = directory.findOrCreateAvailable(id);
  $('fullTitle').textContent = `${TEMPLES[id].name}, hall ${first.index} is full`;
  $('fullSub').textContent = `All ${HALL_CAPACITY} places are taken. Hall ${alt.index} is identical and has ${HALL_CAPACITY - directory.occupancy(alt)} free places.`;
  $('joinOther').textContent = `Join hall ${alt.index} (${directory.occupancy(alt)} / ${HALL_CAPACITY})`;
  $('joinOther').onclick = () => { $('fullSheet').hidden = true; goHall(alt); };
  $('waitSpot').onclick = () => {
    $('fullSheet').hidden = true;
    sim.waitingFor = first.id;
    directory.enqueue(first.id, { id: me.id, onSpot: (h, spot) => { sim.waitingFor = null; toast('A place has opened for you'); goHall(h, spot); } });
    toast(`You are first in line for hall ${first.index}. Keep exploring; you will be brought in when a place opens.`, 5000);
  };
  $('cancelFull').onclick = () => { $('fullSheet').hidden = true; };
  $('fullSheet').hidden = false;
}
function goHall(h, spot = -1) {
  directory.leaveQueue(me.id);
  $('prompt').classList.remove('on');
  fadeThrough(() => {
    app.currentHall = h; app.templeId = h.templeId;
    if (hall.lastHallId !== h.id) hall.templeId = null; hall.lastHallId = h.id;
    hall.setTemple(h.templeId); hall.mySpot = -1; hall.selecting = true; hall.sync(h, me.id);
    hall.scene.add(me.avatar.root); me.avatar.root.position.copy(ENTRANCE); me.avatar.root.rotation.y = Math.PI; me.avatar.setState('idle');
    setMode('hall'); updateHallUI();
    $('aAbhishek').hidden = h.templeId !== 'shiva';
    ['aDiya', 'aIncense'].forEach(id => $(id).classList.remove('done'));
    app.camMode = 'select'; app.hallState = 'select';
    $('actions').hidden = true; $('spotSheet').hidden = false; $('fullSheet').hidden = true;
    $('spotSub').textContent = freeText(h);
    audio.setSanctum(h.templeId);   // in the Shiva hall the music and the sounds of outside fall silent under a chanted Om
    audio.applyZone({ entrance: 0, courtyard: 0, corridor: 0.2, dome: 1, garden: 0, ganesha: +(h.templeId === 'ganesha'), shiva: +(h.templeId === 'shiva'), krishna: +(h.templeId === 'krishna') }, 1.4);
    snapCamera();
    if (!app.lookHinted) { app.lookHinted = true; setTimeout(() => toast('Drag to look around the hall, pinch to zoom', 3200), 900); }
    if (spot >= 0) setTimeout(() => chooseSpot(spot), 600);
  });
}
function chooseSpot(i) {
  const h = app.currentHall;
  if (!directory.claim(h.id, i, { id: me.id, name: me.config.name, simulated: false, config: me.config })) { toast('That place was just taken. Choose another lotus.'); return; }
  net.send({ t: 'claim', hall: h.id, spot: i });
  audio.uiTap();
  hall.mySpot = i; hall.selecting = false; hall.refreshMarkers();
  $('spotSheet').hidden = true;
  const s = SPOTS[i], aisle = s.x > 0 ? s.x - 1.5 : s.x + 1.5;
  input.auto = [new THREE.Vector3(aisle, 0, 7.2), new THREE.Vector3(aisle, 0, s.z), s.clone()];
  app.hallState = 'walking'; app.camMode = 'walk';
}
function autoSpot() {
  const h = app.currentHall; const free = directory.freeSpots(h);
  if (!free.length) { toast('No places are free right now.'); return; }
  free.sort((a, b) => (SPOTS[a].z - SPOTS[b].z) * 10 + Math.abs(SPOTS[a].x) - Math.abs(SPOTS[b].x));
  chooseSpot(free[0]);
}
function seated() {
  app.hallState = 'seated'; app.camMode = 'prayer';
  me.avatar.root.rotation.y = Math.PI; me.avatar.setState('namaste');
  $('actions').hidden = false;
  const ra = app.remoteAarti; const raAt = ra && app.currentHall && ra.hall === app.currentHall.id ? (net.now - ra.at) / 1000 : -1;
  if (raAt >= 0 && raAt < ra.dur - 8) { app.remoteAarti = null; setTimeout(() => beginAarti((net.now - ra.at) / 1000, ra.by), 600); }
  else if (app.pendingAarti) { app.pendingAarti = false; setTimeout(() => beginAarti(), 800); }
  else toast('You are in your place. Choose a prayer below.', 3200);
}
function leaveHall() {
  if (app.aarti) endAarti(true);
  directory.leaveQueue(me.id);
  const back = () => fadeThrough(() => {
    if (app.leftSpot >= 0) hall._extinguish(app.leftSpot); app.leftSpot = -1;
    releaseMe(); hall.mySpot = -1; hall.clearOccupants();
    const T = TEMPLES[app.templeId];
    world.scene.add(me.avatar.root);
    const out = T.entrance.clone().add(T.entrance.clone().setY(0).normalize().multiplyScalar(-1.5));
    me.avatar.root.position.copy(out); const away = out.clone().negate(); me.avatar.root.rotation.y = Math.atan2(away.x, away.z); me.avatar.setState('idle');
    cam.tYaw = cam.yaw = Math.atan2(-away.x, -away.z);
    app.currentHall = null; app.hallState = null; input.auto = []; audio.setSanctum(null);
    $('spotSheet').hidden = true; $('actions').hidden = true; $('fullSheet').hidden = true;
    setMode('world'); app.camMode = 'world'; snapCamera();
  });
  if (app.errand) { app.errand = null; hall.playerErrand = null; hall.errandFocus = null; app.onArrive = null; input.auto = []; $('actions').classList.remove('busy'); app.leftSpot = hall.mySpot; releaseMe(); hall.mySpot = -1; back(); return; }
  if (app.hallState === 'seated') {
    const s = SPOTS[hall.mySpot], aisle = s.x > 0 ? s.x - 1.5 : s.x + 1.5;
    app.leftSpot = hall.mySpot; releaseMe(); hall.mySpot = -1; hall.refreshMarkers();
    input.auto = [new THREE.Vector3(aisle, 0, s.z), new THREE.Vector3(aisle, 0, 7.2), ENTRANCE.clone()];
    app.hallState = 'leaving'; app.camMode = 'walk'; $('actions').hidden = true; app.onArrive = back;
  } else back();
}
function onHallChange(h) {
  if (app.mode === 'hall' && app.currentHall && h.id === app.currentHall.id) { hall.sync(h, me.id); updateHallUI(); if (app.hallState === 'select') $('spotSub').textContent = freeText(h); }
  updateLabels(true);
}
function updateHallUI() {
  const h = app.currentHall; if (!h) return;
  $('hallTitle').textContent = TEMPLES[h.templeId].name;
  $('hallSub').textContent = hallLabel(h);
  // who is here, without counting: friends by name, otherwise just that others are praying
  const others = h.spots.filter((s) => s && s.id !== me.id), friends = others.filter((s) => s.remote).map((s) => (net.players.get(s.id) || s).name || 'a friend');
  $('hallNote').textContent = friends.length ? (friends.length <= 2 ? friends.join(' and ') : friends.slice(0, 2).join(', ') + ' and friends') + ' here with you'
    : others.length ? 'Devotees are praying here' : 'No one else is here';
  $('occDots').innerHTML = h.spots.map(s => `<i class="${s ? (s.id === me.id ? 'me' : s.remote ? 'f' : 's') : ''}"></i>`).join('');
}

// ---------------------------------------------------------------- prayer actions
let lastAct = 0;
function act(name) {
  if (app.mode !== 'hall' || app.hallState !== 'seated' || app.aarti) return;
  const now = performance.now(); if (now - lastAct < 350) return; lastAct = now;
  const av = me.avatar, i = hall.mySpot;
  const SHARED = { namaste: 'pranam', bell: 'bell', flowers: 'flowers', pradakshina: 'pradakshina', diya: 'diya', incense: 'incense', abhishek: 'abhishek' };
  if (SHARED[name] && !(name === 'diya' && hall.spotState[i].lit)) net.send({ t: 'e', k: SHARED[name], hall: app.currentHall.id, spot: i });   // the others in this hall see it
  if (name === 'namaste') { av.setState('bow'); setTimeout(() => av.state === 'bow' && av.setState('namaste'), 2500); const who = hall.greetFrom(av); if (who) toast(`${who.config.name || 'The devotee beside you'} returns your namaste`, 2400); }
  if (name === 'bell' || name === 'flowers' || name === 'pradakshina') { startErrand(name); return; }
  if (name === 'diya') {
    if (hall.spotState[i].lit) { toast('Your diya is already burning'); return; }
    showShot('diya', 3.6);
    av.setState('offer'); setTimeout(() => { hall.lightDiya(i); $('aDiya').classList.add('done'); }, 1000); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 2200);
  }
  if (name === 'incense') {
    showShot('diya', 3.4);
    av.setState('offer'); setTimeout(() => { hall.offerIncense(i); $('aIncense').classList.add('done'); }, 900); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 2100);
    if (!settings.incense) toast('Incense offered. Smoke effects are turned off in settings.');
  }
  if (name === 'abhishek' && app.templeId === 'shiva') { showShot('abhishek', 5); av.setState('offer'); hall.abhishek(); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 1800); }
  if (name === 'darshan') { app.camMode = app.camMode === 'darshan' ? 'prayer' : 'darshan'; $('aDarshan').setAttribute('aria-pressed', String(app.camMode === 'darshan')); }
}

// a few seconds close on what you are doing, then back to your view of the sanctum
function showShot(mode, dur) { app.shot = { mode, until: app.time + dur, ret: app.camMode === 'darshan' ? 'darshan' : 'prayer' }; app.camMode = mode; $('actions').classList.add('busy'); }
// leave your place for a moment: walk to the nearer bell and ring it, to the foot of the steps to shower flowers into the
// thali, or up into the sanctum and once round the deity (pradakshina); then back to your place
function startErrand(kind) {
  const r = hallRoute(kind, hall.mySpot), E = { kind, r, home: SPOTS[hall.mySpot].clone() };
  app.errand = E; app.shot = null; hall.playerErrand = kind; hall.errandFocus = r.focus;
  app.hallState = 'errand'; app.camMode = kind === 'pradakshina' ? 'pradakshina' : 'errand';
  $('actions').classList.add('busy');
  input.auto = r.out.map((v) => v.clone()); app.onArrive = errandArrived;
}
function errandArrived() {
  const E = app.errand; if (!E) return; const av = me.avatar, r = E.r;
  const face = () => { const p = av.root.position; av.root.rotation.y = Math.atan2(r.face.x - p.x, r.face.z - p.z); };
  const goHome = () => { if (app.errand !== E) return; app.camMode = 'walk'; input.auto = [...r.out].reverse().map((v) => v.clone()).concat([E.home.clone()]); app.onArrive = errandDone; };
  face();
  if (E.kind === 'bell') { av.setState('ring'); setTimeout(() => { if (app.errand === E) hall.bells[r.bell].strike(1.15); }, 420); setTimeout(goHome, 2000); }
  else if (E.kind === 'flowers') { av.setState('offer'); setTimeout(() => { if (app.errand !== E) return; hall.petals.throw(av.chestWorld().add(new THREE.Vector3(0, 0.05, -0.2)), hall.thaliTop, 32); audio.shimmer(hall.thaliTop); }, 450); setTimeout(goHome, 2300); }
  else { input.auto = r.ring.map((v) => v.clone()); app.onArrive = () => { if (app.errand !== E) return; face(); av.setState('namaste'); setTimeout(goHome, 1500); }; }
}
function errandDone() {
  if (!app.errand) return; app.errand = null; hall.playerErrand = null; hall.errandFocus = null;
  app.hallState = 'seated'; app.camMode = 'prayer'; me.avatar.setState('namaste'); $('actions').classList.remove('busy');
}

// ---------------------------------------------------------------- multiplayer
// Real devotees from your room (see net.js and server/): they walk the grounds, sit in the hut, take places in the prayer
// halls and make offerings beside you. The simulated devotees stay, so the temple is never empty, and step aside for them.
const net = new Net();
let remotes = null, netReady = false, chat = null;
const myNetId = () => netId(me.id || 'guest');
function myNetState() {
  const av = me.avatar, p = av.root.position, m = app.mode === 'world' ? 'w' : app.mode === 'hall' ? 'h' : app.mode === 'hut' ? 'u' : 'x';
  return { m, x: p.x, y: p.y, z: p.z, r: av.root.rotation.y, a: av.state, sp: av.speed || 0, h: m === 'h' && app.currentHall ? app.currentHall.id : null };
}
function startNet() {
  if (remotes) { if (netReady) net.send({ t: 'cfg', name: me.config.name || 'Devotee', look: me.config }); return; }
  remotes = new RemotePlayers(world.scene, $('labels'), { shadows: Q.level !== 'low' });
  chat = new Chat(net, { toast, onIncoming: (p, m) => { if (p && m) remotes.say(p, m.text); renderPresence(); } });
  remotes.onTap = (id) => openChat(id);
  net.on('join', (p) => { remotes.add(p); if (netReady) toast(`${p.name} has come to the temple`, 2800); });
  net.on('leave', (p) => { remotes.remove(p); if (netReady && net.online) toast(`${p.name} has left`, 2200); });
  net.on('state', (p) => remotes.state(p));
  net.on('look', (p) => { remotes.look(p); if (p.spot) { directory.release(p.id); applyRemoteSpot(p); } });
  net.on('spot', applyRemoteSpot);
  net.on('claim', (m) => { if (!m.ok && app.mode === 'hall' && app.currentHall && m.hall === app.currentHall.id && hall.mySpot === m.spot) lostSpot(); });
  net.on('event', onNetEvent);
  net.on('welcome', () => { netReady = true; if (app.mode === 'hall' && app.currentHall && hall.mySpot >= 0) net.send({ t: 'claim', hall: app.currentHall.id, spot: hall.mySpot }); renderPresence(); });
  net.on('status', () => { if (!net.online) netReady = false; renderPresence(); });
  net.start(() => ({ id: myNetId(), name: me.config.name || 'Devotee', look: me.config, s: myNetState() }));
  renderPresence();
}
// a chat with a real devotee: from their avatar, their name tag, or their row in Play with friends
function openChat(id) { if (!chat) return; closeAllPanels(); chat.openWith(id); }
function releaseMe() { directory.release(me.id); net.send({ t: 'release' }); }
function makeRoom(h) { const o = h.spots.find((x) => x && x.simulated); if (o) directory.release(o.id); }
// the server says where a friend sits: mirror it in this browser's halls, where a simulated devotee steps aside for them
function applyRemoteSpot(p) {
  const cur = directory.spotOf(p.id);
  if (cur && p.spot && cur.hall.id === p.spot.hall && cur.spot === p.spot.spot) return;
  if (cur) directory.release(p.id);
  if (!p.spot) return;
  const [templeId, idx] = p.spot.hall.split('-'); if (!TEMPLES[templeId]) return;
  let h = null; for (let i = 1; i <= Math.min(+idx, 20); i++) h = directory.ensureInstance(templeId, i);
  if (!h) return;
  const o = h.spots[p.spot.spot];
  if (o && o.id === me.id) lostSpot();
  else if (o) directory.release(o.id);
  directory.claim(h.id, p.spot.spot, { id: p.id, name: p.name, simulated: false, remote: true, config: p.look });
}
// someone reached your place at the server first: back to choosing, with a word of explanation
function lostSpot() {
  if (app.mode !== 'hall' || hall.mySpot < 0) return;
  if (app.aarti) endAarti(true);
  directory.release(me.id);
  app.errand = null; hall.playerErrand = null; hall.errandFocus = null; app.onArrive = null; input.auto = []; $('actions').classList.remove('busy');
  hall.mySpot = -1; hall.selecting = true; hall.refreshMarkers();
  me.avatar.root.position.copy(ENTRANCE); me.avatar.root.rotation.y = Math.PI; me.avatar.setState('idle');
  app.hallState = 'select'; app.camMode = 'select'; $('actions').hidden = true; $('spotSheet').hidden = false; $('spotSub').textContent = freeText(app.currentHall);
  toast('Another devotee reached that place a moment before you. Choose another lotus.', 3600);
}
function onNetEvent(p, m) {
  const name = p.name || 'A devotee';
  if (m.k === 'aarti' && m.hall) {
    const offset = (net.now - m.at) / 1000, dur = m.dur || 60;
    if (offset < 0 || offset > dur - 8) return;
    const T = TEMPLES[m.hall.split('-')[0]];
    if (app.mode === 'hall' && app.currentHall && app.currentHall.id === m.hall) {
      if (app.hallState === 'seated' && !app.aarti) { beginAarti(offset, p); toast(`${name} has begun the aarti`, 2600); }
      else if (!app.aarti) { app.remoteAarti = { hall: m.hall, at: m.at, dur, by: p }; toast(`${name} has begun the aarti here. Take a place to join in.`, 3800); }
    } else toast(`${name} has begun the aarti in the ${T ? T.name : 'temple'}`, 3200);
    return;
  }
  if (m.hall) {   // an offering in a prayer hall: seen by those in the same hall
    if (app.mode === 'hall' && app.currentHall && app.currentHall.id === m.hall) { hall.remoteAct(p.id, m.k); if (m.k === 'pranam') toast(`${name} offers namaste`, 2000); }
    return;
  }
  if (m.k === 'pranam') { remotes.bow(p); if (m.to === myNetId()) toast(`${name} offers you pranam`, 3000); }
}
// the presence pill, and the Play with friends sheet behind it
function renderPresence() {
  // no numbers for now: just whether you are online (and in a private temple)
  const priv = net.room !== 'public';
  let txt;
  if (!net.enabled) txt = 'Offline';
  else if (net.online) txt = priv ? 'Online · private' : 'Online';
  else if (!net.ever && net.retry >= 3) txt = 'Offline';   // this copy cannot reach the server (it keeps trying quietly)
  else txt = net.connecting ? 'Connecting…' : 'Reconnecting…';
  $('presenceText').textContent = txt;
  $('presence').classList.toggle('live', net.online);
  const unread = chat ? chat.unreadTotal : 0; $('presenceUnread').hidden = !unread; $('presenceUnread').textContent = unread > 9 ? '9+' : String(unread);
  if (!$('roomSheet').hidden) renderRoomSheet();
}
function renderRoomSheet() {
  const priv = net.room !== 'public';
  $('roomSub').textContent = !net.enabled ? 'Multiplayer is not set up in this copy of the temple, so everyone here is simulated.'
    : !net.online ? 'Connecting to the temple server… Simulated devotees keep you company meanwhile.'
    : priv ? `You are in a private temple (${net.room}). Only people with your invite link can join.` : 'You are in the public temple: anyone who opens the site walks here with you.';
  const people = net.online ? [{ name: (me.config.name || 'You') + ' (you)' }, ...net.players.values()] : [];
  $('roomList').innerHTML = people.length ? people.map((p) => `<div class="who"><i>${escapeHtml((p.name || 'D')[0].toUpperCase())}</i><span>${escapeHtml(p.name || 'Devotee')}</span>${p.id ? `<button class="btn small" data-chat="${escapeHtml(p.id)}">Chat${chat && chat.unread.get(p.id) ? ` (${chat.unread.get(p.id)})` : ''}</button>` : ''}<em>${p.spot ? `in ${escapeHtml(TEMPLES[p.spot.hall.split('-')[0]] ? TEMPLES[p.spot.hall.split('-')[0]].short : 'a')} temple` : p.s && p.s.m === 'u' ? 'meditating' : p.s && p.s.m === 'h' ? 'in a prayer hall' : ''}</em></div>`).join('') : '';
  $('roomInvite').textContent = priv ? 'Share invite link' : 'Invite friends to a private temple';
  $('roomInvite').disabled = !net.enabled;
  $('roomPublic').hidden = !priv;
}
async function inviteFriends() {
  if (!net.enabled) return;
  if (net.room === 'public') { net.switchRoom(newRoomCode()); history.replaceState(null, '', inviteLink(net.room)); }
  const url = inviteLink(net.room);
  try { if (navigator.share) { await navigator.share({ title: 'Virtual Temple', text: 'Come to the temple with me', url }); renderRoomSheet(); return; } } catch (e) { if (e && e.name === 'AbortError') { renderRoomSheet(); return; } }
  try { await navigator.clipboard.writeText(url); toast('Invite link copied. Send it to your friends.', 3200); } catch (e) { prompt('Copy this invite link and send it to your friends:', url); }
  renderRoomSheet();
}

// ---------------------------------------------------------------- aarti
const SCHEDULE = [['Mangala aarti', 5, 30], ['Shringar aarti', 7, 45], ['Rajbhog aarti', 12, 0], ['Sandhya aarti', 18, 30], ['Shayan aarti', 21, 0]];
function nextAarti(now = new Date()) {
  for (let d = 0; d < 2; d++) for (const [name, h, m] of SCHEDULE) { const t = new Date(now); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); if (t > now) return { name, t }; }
}
function renderSchedule() {
  const n = nextAarti(); const fmt = (h, m) => new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('schedList').innerHTML = SCHEDULE.map(([name, h, m]) => `<div class="${n.name === name ? 'next' : ''}"><span>${name}${n.name === name ? ' · next' : ''}</span><time>${fmt(h, m)}</time></div>`).join('');
}
function updateCountdown() {
  const n = nextAarti(); const ms = n.t - new Date(); const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60;
  $('aartiCountdown').textContent = (h ? `${h}h ` : '') + `${m}m`;
  $('aartiChip').setAttribute('aria-label', `${n.name} in ${h} hours ${m} minutes. Open schedule`);
}
function requestAarti(templeId) {
  $('schedule').hidden = true;
  app.pendingAarti = true;
  if (app.mode === 'world') { enterTemple(templeId); if (!$('fullSheet').hidden) return; setTimeout(() => app.hallState === 'select' && autoSpot(), 1000); return; }
  if (app.mode === 'hall') { if (app.hallState === 'select') autoSpot(); else if (app.hallState === 'seated') { app.pendingAarti = false; beginAarti(); } }
}
const MANTRA = { ganesha: 'ॐ गं गणपतये नमः', shiva: 'ॐ नमः शिवाय', krishna: 'ॐ नमो भगवते वासुदेवाय' };
function beginAarti(offset = 0, by = null) {
  if (app.aarti || app.hallState !== 'seated') return;
  const dur = 60;
  app.aarti = { t: offset, dur };
  document.body.classList.add('ceremony');
  sim.gather(app.currentHall.id, 11);
  hall.startAarti(dur); hall.aarti.t = offset; audio.startAarti(dur, offset);
  if (!by) net.send({ t: 'e', k: 'aarti', hall: app.currentHall.id, at: net.now, dur });   // friends in this hall join the same ceremony, in step
  hall.onAartiEnd = () => endAarti(false);
  app.camMode = settings.reducedMotion ? 'prayer' : 'aarti';
  $('aartiDeva').textContent = MANTRA[app.templeId];
  $('aartiLine').textContent = `${nextAarti().name.replace(' aarti', '')} aarti preview · ${TEMPLES[app.templeId].name}, hall ${app.currentHall.index}`;
  if (offset < 18) { setTimeout(() => app.aarti && $('aartiCaption').classList.add('on'), Math.max(0, 9 - offset) * 1000); setTimeout(() => $('aartiCaption').classList.remove('on'), (22 - offset) * 1000); }
}
function endAarti(abort) {
  if (!app.aarti) return;
  app.aarti = null; document.body.classList.remove('ceremony'); $('aartiCaption').classList.remove('on');
  if (abort) hall.stopAarti();
  audio.stopAarti();
  if (app.hallState === 'seated') { app.camMode = 'prayer'; if (!abort) toast('The aarti is complete', 3200); }
}

// ---------------------------------------------------------------- labels
const labelEls = {};
const ICONS = {
  trishul: '<svg viewBox="0 0 32 32"><path d="M16 4v24M10 6c0 6 2 9 6 9s6-3 6-9M10 6l-1.5 2M22 6l1.5 2M16 4l-1.5 2.5M16 4l1.5 2.5M13 24h6"/></svg>',
  modak: '<svg viewBox="0 0 32 32"><path d="M16 4c-2 4-9 9-9 15a9 5 0 0 0 18 0c0-6-7-11-9-15z"/><path d="M16 4v18M12 9c-1 4-1 9 0 13M20 9c1 4 1 9 0 13"/></svg>',
  lotus: '<svg viewBox="0 0 32 32"><path d="M16 7c-3 4-3 9 0 13 3-4 3-9 0-13zM16 20c-4-1-8-4-9.5-9 4.5 0 7.5 3 9.5 9zM16 20c4-1 8-4 9.5-9-4.5 0-7.5 3-9.5 9zM6 23c4 3 16 3 20 0"/></svg>',
  flute: '<svg viewBox="0 0 32 32"><path d="M5 25 25 7l2 2L7 27z"/><circle cx="12" cy="19.5" r=".8"/><circle cx="15" cy="16.8" r=".8"/><circle cx="18" cy="14.1" r=".8"/><path d="M24 4c2 0 4 2 4 4"/></svg>',
};
function buildLabels() {
  const root = $('labels');
  for (const T of Object.values(TEMPLES)) {
    const el = document.createElement('div'); el.className = 'wlabel'; el.innerHTML = `<i class="ico">${ICONS[T.icon]}</i><div><b>${T.short}</b><em>Temple</em><span></span></div>`;
    el.addEventListener('click', () => goTo(T.id)); root.appendChild(el); labelEls[T.id] = el;
  }
  { const el = document.createElement('div'); el.className = 'wlabel'; el.innerHTML = `<i class="ico">${meditatorSVG('lbl', { full: false })}</i><div><b>Meditation</b><em>hut</em><span>${(world.hutSitters || []).length} / ${HUT.capacity} seats · breathe & meditate</span></div>`;
    el.addEventListener('click', () => goTo('hut')); root.appendChild(el); labelEls.hut = el; }
  labelEls.me = document.createElement('div'); labelEls.me.className = 'nlabel me'; root.appendChild(labelEls.me);
  labelEls.sims = [];
  updateLabels(true);
}
function updateLabels(text = false) {
  if (!directory) return;
  if (text) for (const T of Object.values(TEMPLES)) {
    const hs = directory.instances(T.id); const h = hs.find(x => directory.occupancy(x) < HALL_CAPACITY) || hs[0];
    labelEls[T.id].querySelector('span').textContent = `Hall ${h.index} · ${directory.occupancy(h)} / ${HALL_CAPACITY}` + (hs.length > 1 ? ` · ${hs.length} halls` : '');
  }
}
const _v = new THREE.Vector3();
function project(p, el, yOff = 0) {
  _v.copy(p); _v.y += yOff; _v.project(camera);
  const vis = _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15;
  el.style.display = vis ? '' : 'none';
  if (vis) el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  return vis;
}
function positionLabels() {
  if (app.mode === 'world') {
    for (const T of Object.values(TEMPLES)) { const d = T.entrance.distanceTo(me.avatar.root.position); project(T.labelPos, labelEls[T.id]); labelEls[T.id].style.opacity = d < 6 ? '0.35' : '1'; }
    { const d = HUT.entrance.distanceTo(me.avatar.root.position); project(HUT.labelPos, labelEls.hut); labelEls.hut.style.opacity = d < 6 ? '0.35' : '1'; }
    const nm = me.config.name || 'You'; if (labelEls.me.dataset.n !== nm) { labelEls.me.dataset.n = nm; labelEls.me.innerHTML = `<i>${escapeHtml(nm[0].toUpperCase())}</i>${escapeHtml(nm)}`; } project(me.avatar.root.position, labelEls.me, 1.55); if ((cam.close || 0) > 0.55) labelEls.me.style.display = 'none';
    labelEls.sims.forEach(e => (e.style.display = 'none'));
  } else if (app.mode === 'hall') {
    for (const T of Object.values(TEMPLES)) labelEls[T.id].style.display = 'none';
    labelEls.hut.style.display = 'none';
    project(me.avatar.root.position, labelEls.me, 1.5);
    if (app.camMode === 'prayer' || app.camMode === 'darshan' || app.camMode === 'aarti') labelEls.me.style.display = 'none';
    // show a quiet "simulated" tag over other devotees while choosing a place
    const occ = [...hall.occupants.values()];
    while (labelEls.sims.length < occ.length) { const e = document.createElement('div'); e.className = 'nlabel sim'; e.textContent = 'simulated'; $('labels').appendChild(e); labelEls.sims.push(e); }
    labelEls.sims.forEach((e, i) => {
      const a = occ[i];
      if (a && (app.hallState === 'select' || (a.remote && app.camMode !== 'aarti'))) {
        const nm = a.remote ? ((net.players.get(a.occId) || {}).name || a.config.name || 'Devotee') : a.config.name, key = (a.remote ? 'f:' : 's:') + nm;
        if (e.dataset.k !== key) { e.dataset.k = key; e.className = a.remote ? 'nlabel friend' : 'nlabel sim'; e.onclick = a.remote ? () => openChat(a.occId) : null; e.innerHTML = a.remote ? `<i>${escapeHtml(nm[0].toUpperCase())}</i>${escapeHtml(nm)}` : `${escapeHtml(nm)} · simulated`; }
        project(a.root.position, e, 1.45);
      } else e.style.display = 'none';
    });
  }
}

// ---------------------------------------------------------------- navigation
const DEST = (id) => TEMPLES[id] || (id === 'hut' ? HUT : id === 'prasad' ? PRASAD : null);
function goTo(id) {
  if (app.mode !== 'world') return;
  const D = DEST(id); if (!D) return;
  audio.uiTap();
  input.auto = world.route(me.avatar.root.position, id).slice(1);
  if (input.auto.length === 0 || me.avatar.root.position.distanceTo(D.entrance) < 2 || (id === 'hut' && inHut())) { input.auto = []; if (id === 'hut') hutDoor(); else if (id === 'prasad') receivePrasad(); else enterTemple(id); return; }
  app.arriveShrine = id;
  $('map').classList.remove('on'); $('mapBtn').setAttribute('aria-pressed', 'false');
  toast(`Walking to the ${D.name.toLowerCase().startsWith('meditation') ? 'meditation hut' : id === 'prasad' ? 'prasad centre' : D.name}`, 2000);
}
function nearHut() { const p = me.avatar.root.position; return HUT.entrance.distanceTo(p) < 2.8 || hutInside(p.x, p.z); }
const inHut = () => { const p = me.avatar.root.position; return hutInside(p.x, p.z); };
// walk in through the door: up the steps, across the porch, and onto the floor just behind the centre cushion
function walkIntoHut() {
  if (app.mode !== 'world') return;
  input.auto = [HUT.toWorld(0, 0, 6.2), HUT.toWorld(0, 0, 4.6), HUT.toWorld(0, 0, 2.9), HUT.inside.clone().setY(0)]; app.arriveShrine = null; app.hutArrive = true;
}
const hutDoor = () => (inHut() ? enterHut() : walkIntoHut());
function nearPrasad() { return world.prasad && PRASAD.front.distanceTo(me.avatar.root.position) < 3.2; }
function receivePrasad() {
  if (!world.prasad || world.prasad.has(me.avatar)) return;
  world.prasad.join(me.avatar, { player: true, onMove: (slot) => { input.auto = [slot]; app.arriveShrine = null; }, done: () => toast('You received prasad · a besan laddoo and sweet pongal in a leaf cup', 3800) });
  const ahead = world.prasad.position(me.avatar);
  toast(ahead > 0 ? `You join the line for prasad · ${ahead} ahead of you` : 'The sevak turns to you with prasad', 2400);
}
function worldPranam() {
  if (app.mode !== 'world') return;
  input.auto = []; const av = me.avatar; av.setState('bow'); app.pranamUntil = app.time + 2.6;
  // to the nearest devotee who is facing you (within a few steps, or close beside you at a shrine): they bow back.
  // Anyone turned away does not see it. With no one facing you, your pranam goes to the shrine before you, or the nearest temple
  const T = nearShrine(), who = world.nearestDevotee(av.root.position, 4.5, true), dWho = who ? who.avatar.root.position.distanceTo(av.root.position) : 99;
  // a friend from your room counts too: they see you bow to them, and decide for themselves whether to bow back
  const friend = remotes ? remotes.nearest(av.root.position, 4.5) : null, dF = friend ? friend.avatar.root.position.distanceTo(av.root.position) : 99;
  const toFriend = friend && dF <= dWho && (!T || dF < 2.6);
  const toWho = !toFriend && who && (!T || dWho < 2.6);
  const at = toFriend ? friend.avatar.root.position : toWho ? who.avatar.root.position : T ? T.pos : Object.values(TEMPLES).sort((a, b) => a.pos.distanceTo(av.root.position) - b.pos.distanceTo(av.root.position))[0].pos;
  const d = at.clone().sub(av.root.position); av.root.rotation.y = Math.atan2(d.x, d.z);
  net.send({ t: 'e', k: 'pranam', ...(toFriend ? { to: friend.p.id } : {}) });
  if (toFriend) toast(`You offer pranam to ${friend.p.name}`, 2400);
  else if (toWho) { world.greet(who, av); toast(`${who.avatar.config.name || 'A devotee'} returns your pranam`, 2400); }
}
function nearShrine() {
  for (const T of Object.values(TEMPLES)) if (T.entrance.distanceTo(me.avatar.root.position) < 3.4) return T;
  return null;
}

// ---------------------------------------------------------------- input
function bindInput() {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(); input.keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (app.mode === 'world') {
      if (k === 'q') cam.tYaw += 0.4; if (k === 'e') cam.tYaw -= 0.4;
      if (k === '+' || k === '=') zoom(-3); if (k === '-') zoom(3);
      if (k === 'm') toggleMap();
      if (k === 'p') worldPranam();
      if (k === 'enter') { const T = nearShrine(); if (T) enterTemple(T.id); else if (nearHut()) hutDoor(); }
    }
    if (app.mode === 'hall') { const map = { 1: 'namaste', 2: 'bell', 3: 'diya', 4: 'flowers', 5: 'incense', 6: 'abhishek', 7: 'pradakshina' }; if (map[k]) act(map[k]); if (k === 'q') look.tYaw += 0.4; if (k === 'e') look.tYaw -= 0.4; }
    if (k === 'escape') closeAllPanels();
    if (app.mode === 'hut' && k === 'escape') { if (!$('doneCard').hidden) showHutPanel(); else if (hutState.session) endSession(); else leaveHut(); }
    if (app.mode === 'hut' && k === ' ' && hutState.session) togglePause();
  });
  addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); input.drag = false; if (input.pointers.size === 2) input.pinch = pinchDist(); });
  canvas.addEventListener('pointermove', (e) => {
    const p = input.pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) input.drag = true;
    if (input.pointers.size === 2) { const d = pinchDist(); if (input.pinch) zoom((input.pinch - d) * 0.06); input.pinch = d; return; }
    if (input.drag && app.mode === 'hall') { look.tYaw -= dx * 0.005; look.tPitch = THREE.MathUtils.clamp(look.tPitch - dy * 0.004, -1.25, 1.25); }   // drag to look round the hall, up to the carvings and the opening in the rock
    if (input.drag && (app.mode === 'world' || app.mode === 'welcome')) { cam.tYaw -= dx * 0.006; cam.tPitch = THREE.MathUtils.clamp(cam.tPitch + dy * 0.004, -0.6, 1.35); }   // drag up to look up at the sky, down to look down on the ground
    if (input.drag && app.mode === 'creator' && preview.avatar) preview.avatar.root.rotation.y += dx * 0.012;
  });
  const up = (e) => {
    const p = input.pointers.get(e.pointerId); input.pointers.delete(e.pointerId); if (input.pointers.size < 2) input.pinch = null;
    if (p && !input.drag && performance.now() - p.t < 450) tap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { input.pointers.delete(e.pointerId); });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY * 0.012); }, { passive: false });
  // joystick
  const joy = $('joy'), knob = joy.querySelector('.knob'); let jid = null;
  const jmove = (e) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } input.joy.set(x, -y); knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`; };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); input.auto = []; jmove(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; input.joy.set(0, 0); knob.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
}
function pinchDist() { const a = [...input.pointers.values()]; return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
function zoom(d) { if (app.mode === 'hall') { look.tZoom = THREE.MathUtils.clamp(look.tZoom + d * 0.04, 0.5, 1.3); return; } if (app.mode === 'creator') { preview.dist = THREE.MathUtils.clamp((preview.dist || 4.4) + d * 0.25, 1.1, 5); return; } cam.tDist = THREE.MathUtils.clamp(cam.tDist + d * Math.max(0.25, cam.tDist / 22), 2.1, 44); }
const ray = new THREE.Raycaster(), occRay = new THREE.Raycaster();
function tap(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  if (app.mode === 'world') {
    if (remotes) { const f = ray.intersectObjects(remotes.picks(), false)[0]; if (f) { openChat(f.object.userData.remoteId); return; } }
    const hits = ray.intersectObjects(world.pickables, true);
    for (const h of hits) {
      const o = h.object;
      if (o.userData.bell) { o.userData.bell.strike(0.9); return; }
      if (o.userData.shrine) { goTo(o.userData.shrine); return; }
      if (o.userData.hut) { goTo('hut'); return; }
      if (o.userData.ground) { const p = h.point.clone().setY(0); input.auto = [p]; app.arriveShrine = null; showTapMarker(p); return; }
    }
  } else if (app.mode === 'hall') {
    if (app.hallState === 'select') { const s = hall.pickMarker(ray); if (s >= 0) { if (app.currentHall.spots[s]) toast('That place is taken'); else chooseSpot(s); } return; }
    if (app.hallState === 'seated' && hall.pickBell(ray)) act('bell');
  }
}
let tapMarker;
function showTapMarker(p) {
  if (!tapMarker) { tapMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 32), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, depthWrite: false })); tapMarker.rotation.x = -Math.PI / 2; world.scene.add(tapMarker); }
  tapMarker.position.copy(p).setY(hutFloor(p.x, p.z) + 0.06); tapMarker.userData.t = 0; tapMarker.visible = true;
}

// ---------------------------------------------------------------- UI wiring
function closeAllPanels() { for (const id of ['auth', 'schedule', 'settings', 'todPop', 'soundPop', 'roomSheet', 'chatSheet']) $(id).hidden = true; if (chat) chat.open = null; $('map').classList.remove('on'); $('mapBtn').setAttribute('aria-pressed', 'false'); }
function toggleMap() { const on = !$('map').classList.contains('on'); $('map').classList.toggle('on', on); $('mapBtn').setAttribute('aria-pressed', String(on)); }
let authMode = 'signin';
function setAuthMode(m) { authMode = m; $('tabSignin').setAttribute('aria-selected', String(m === 'signin')); $('tabCreate').setAttribute('aria-selected', String(m === 'create')); $('authSubmit').textContent = m === 'signin' ? 'Sign in' : 'Create profile'; $('authPass').autocomplete = m === 'signin' ? 'current-password' : 'new-password'; $('authErr').textContent = ''; }
function startAudioOnce() { if (!audio.ctx) audio.start().then(() => audio.applyZone(audio.zone, 0.5)); else audio.start(); }

function bindUI() {
  bindInput();
  document.addEventListener('pointerdown', startAudioOnce, { capture: true });
  document.addEventListener('keydown', startAudioOnce, { capture: true });
  $('guestBtn').addEventListener('click', () => {
    if (profiles.user && profiles.user.kind === 'registered') { if (!profiles.user.avatar) { openCreator(); return; } me.avatar.setConfig(me.config); enterWorld(); return; }
    profiles.guest(me.config); openCreator();
  });
  $('signinBtn').addEventListener('click', () => { setAuthMode('signin'); $('auth').hidden = false; if (!storageAvailable) $('authErr').textContent = 'This browser is blocking site storage, so profiles cannot be saved here. You can still continue as a guest.'; });
  $('tabSignin').addEventListener('click', () => setAuthMode('signin'));
  $('tabCreate').addEventListener('click', () => setAuthMode('create'));
  $('authGuest').addEventListener('click', () => { $('auth').hidden = true; if (app.mode === 'world') return; profiles.guest(me.config); openCreator(); });
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('authErr').textContent = '';
    const btn = $('authSubmit'), label = btn.textContent; btn.disabled = true; btn.textContent = authMode === 'signin' ? 'Signing in…' : 'Creating…';
    try {
      if (authMode === 'signin') {
        const u = await profiles.signIn($('authEmail').value, $('authPass').value);
        $('auth').hidden = true;
        if (u.avatar) { me.config = { ...defaultConfig(), ...u.avatar }; me.avatar.setConfig(me.config); toast(`Welcome back, ${me.config.name}` + (u.cloud ? '' : ' (profile on this device only)'), 3000); if (app.mode === 'world') { updateProfileChip(); renderAccount(); startNet(); } else enterWorld(); }
        else openCreator();
      } else {
        const wasInWorld = app.mode === 'world';
        const u = await profiles.register($('authEmail').value, $('authPass').value, wasInWorld ? { ...me.config } : null);
        $('auth').hidden = true;
        const where = u.cloud ? 'Your avatar now follows you to any device.' : 'The temple server could not be reached, so it is saved on this device only.';
        if (wasInWorld) { toast('Profile created. ' + where, 3600); updateProfileChip(); renderAccount(); }
        else { if (!u.cloud) toast('Profile created on this device only: the temple server could not be reached.', 3600); openCreator(); }
      }
    } catch (err) { $('authErr').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = label; }
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
  $('presence').addEventListener('click', () => { closeAllPanels(); $('roomSheet').hidden = false; renderRoomSheet(); });
  $('roomInvite').addEventListener('click', inviteFriends);
  $('roomList').addEventListener('click', (e) => { const b = e.target.closest('[data-chat]'); if (b) openChat(b.dataset.chat); });
  $('roomPublic').addEventListener('click', () => { net.switchRoom('public'); history.replaceState(null, '', inviteLink('public')); renderRoomSheet(); toast('Back in the public temple', 2000); });
  // HUD
  $('mapBtn').addEventListener('click', toggleMap);
  $('settingsBtn').addEventListener('click', () => { renderAccount(); $('settings').hidden = false; });
  $('profileChip').addEventListener('click', () => { renderAccount(); $('settings').hidden = false; });
  $('aartiChip').addEventListener('click', () => { renderSchedule(); $('schedTemple').value = nearestTemple(); $('schedule').hidden = false; });
  $('previewAarti').addEventListener('click', () => requestAarti($('schedTemple').value));
  $('soundBtn').addEventListener('click', () => { const on = $('soundPop').hidden; closeAllPanels(); $('soundPop').hidden = !on; $('soundBtn').setAttribute('aria-expanded', String(on)); renderSoundPop(); startAudioOnce(); });
  audio.musicStyle = settings.musicStyle || 'auto';
  audio.onTrack = () => { renderSoundPop(); renderNowPlaying(); };
  $('musicSeg').querySelectorAll('button').forEach(b => b.onclick = () => setMusicStyle(b.dataset.m));
  const hold = (id, fn) => { const b = $(id); let t; b.addEventListener('pointerdown', () => { fn(); t = setInterval(fn, 120); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearInterval(t)); b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fn(); }); };
  hold('camLeft', () => (cam.tYaw += 0.12)); hold('camRight', () => (cam.tYaw -= 0.12)); hold('zoomIn', () => zoom(-1.5)); hold('zoomOut', () => zoom(1.5));
  $('enterBtn').addEventListener('click', () => { const T = nearShrine(); if (T) enterTemple(T.id); else if (nearHut()) hutDoor(); else if (nearPrasad()) receivePrasad(); });
  bindHut();
  $('pranamBtn').addEventListener('click', worldPranam);
  $('closeBtn').setAttribute('aria-pressed', 'true');
  $('closeBtn').addEventListener('click', () => { const near = cam.tDist < 6; if (!near) cam.farDist = cam.tDist; cam.tDist = near ? (cam.farDist || 27) : CLOSE_DIST; cam.tPitch = near ? 0.32 : 0.2; if (!near) cam.tYaw = me.avatar.root.rotation.y + Math.PI; $('closeBtn').setAttribute('aria-pressed', String(!near)); });
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));
  $('mapCanvas').addEventListener('click', (e) => {
    const r = e.target.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 100 - 50, z = (e.clientY - r.top) / r.height * 100 - 50;
    for (const T of Object.values(TEMPLES)) if (Math.hypot(T.pos.x - x, T.pos.z - z) < 10) return goTo(T.id);
    if (Math.hypot(HUT.pos.x - x, HUT.pos.z - z) < 7) return goTo('hut');
    if (Math.hypot(PRASAD.pos.x - x, PRASAD.pos.z - z) < 6) return goTo('prasad');
    input.auto = [world.resolve(new THREE.Vector3(x, 0, z), 0.4)]; app.arriveShrine = null;
  });
  // prayer
  $('aNamaste').onclick = () => act('namaste'); $('aBell').onclick = () => act('bell'); $('aDiya').onclick = () => act('diya');
  $('aFlowers').onclick = () => act('flowers'); $('aIncense').onclick = () => act('incense'); $('aAbhishek').onclick = () => act('abhishek');
  $('aDarshan').onclick = () => act('darshan'); $('aAarti').onclick = () => beginAarti(); $('aPradakshina').onclick = () => act('pradakshina');
  $('exitBtn').onclick = leaveHall; $('cancelSpot').onclick = leaveHall; $('autoSpot').onclick = autoSpot;
  // settings
  for (const k of ['Master', 'Ambience', 'Effects', 'Ceremony']) {
    $('v' + k).addEventListener('input', (e) => { const key = k.toLowerCase(); settings[key] = +e.target.value; $('v' + k + 'V').textContent = e.target.value; audio.setLevel(key, settings[key] / 100); persist(); });
  }
  $('tMute').onclick = () => { settings.muted = !settings.muted; audio.setMuted(settings.muted); applySettingsUI(); persist(); };
  $('tIncense').onclick = () => { settings.incense = !settings.incense; applySettingsUI(); persist(); };
  $('tMotion').onclick = () => { settings.reducedMotion = !settings.reducedMotion; document.body.classList.toggle('reduced', settings.reducedMotion); applySettingsUI(); persist(); };
  $('qSeg').querySelectorAll('button').forEach(b => b.onclick = () => { if (settings.quality === b.dataset.q) return; settings.quality = b.dataset.q; persist(); toast('Reloading with the new quality setting'); setTimeout(() => location.reload(), 500); });
  $('todSeg').querySelectorAll('button').forEach(b => b.onclick = () => setTOD(b.dataset.t));
  $('todChip').addEventListener('click', () => { const on = $('todPop').hidden; closeAllPanels(); $('todPop').hidden = !on; $('todChip').setAttribute('aria-expanded', String(on)); renderTodPop(); });
  addEventListener('resize', onResize);
  setInterval(updateCountdown, 15000); updateCountdown();
}
function nearestTemple() { let best = 'ganesha', bd = Infinity; for (const T of Object.values(TEMPLES)) { const d = T.pos.distanceTo(me.avatar.root.position); if (d < bd) { bd = d; best = T.id; } } return app.templeId && app.mode === 'hall' ? app.templeId : best; }
function persist() { profiles.saveSettings(settings); }
function applySettingsUI() {
  for (const k of ['Master', 'Ambience', 'Effects', 'Ceremony']) { const key = k.toLowerCase(); $('v' + k).value = settings[key]; $('v' + k + 'V').textContent = settings[key]; }
  $('tMute').setAttribute('aria-checked', String(settings.muted)); $('soundBtn').setAttribute('aria-pressed', String(settings.muted));
  $('soundBtn').setAttribute('aria-label', settings.muted ? 'Sound and music (muted)' : 'Sound and music');
  $('musicSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === settings.musicStyle)));
  $('soundBtn').querySelector('.wave').style.opacity = settings.muted ? '0.15' : '1';
  $('tIncense').setAttribute('aria-checked', String(settings.incense)); $('tMotion').setAttribute('aria-checked', String(settings.reducedMotion));
  $('qSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === Q.level)));
  $('todSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === settings.tod)));
}
function renderAccount() {
  const u = profiles.user, box = $('accountBox');
  const reg = u && u.kind === 'registered';
  const where = reg ? (u.cloud ? 'Signed in · follows you to any device · ' : 'Profile saved on this device only · ') + escapeHtml(u.email) : 'Guest · nothing is saved';
  box.innerHTML = `<div class="setrow"><span><b style="font-weight:600">${escapeHtml(me.config.name || 'Devotee')}</b><br><span class="note">${where}</span></span></div>
    <div class="row"><button class="btn small" id="editAvatar">Edit avatar</button>${reg ? '<button class="btn small ghost" id="signOut">Sign out</button><button class="btn small ghost" id="deleteProfile">Delete profile</button>' : '<button class="btn small" id="saveProfile">Create profile to save</button>'}</div>`;
  $('editAvatar').onclick = () => { $('settings').hidden = true; if (app.mode === 'hall') { toast('Leave the prayer hall to change your avatar'); return; } openCreator(true); };
  if (reg) {
    $('signOut').onclick = () => goHome(profiles.signOut(), 'Signed out');
    $('deleteProfile').onclick = async () => {
      if (!confirm(`Delete the profile for ${u.email}? Your saved avatar is removed${u.cloud ? ' from every device' : ''}. This cannot be undone.`)) return;
      try { await profiles.deleteProfile(); goHome(null, 'Profile deleted'); } catch (e) { toast(e.message, 3600); }
    };
  }
  else $('saveProfile').onclick = () => { $('settings').hidden = true; setAuthMode('create'); $('auth').hidden = false; };
}
// back to the home screen (after signing out or deleting a profile): a fresh start, with nothing of the last devotee left
async function goHome(pending, msg) {
  if (hutState.session) endSession(true);
  toast(msg, 1600); $('fade').classList.add('on');
  try { await Promise.race([pending, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* signed out locally either way */ }
  setTimeout(() => location.reload(), settings.reducedMotion ? 0 : 450);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastT;
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function fadeThrough(fn) {
  const f = $('fade'); if (settings.reducedMotion) { fn(); return; }
  f.classList.add('on'); setTimeout(() => { fn(); requestAnimationFrame(() => setTimeout(() => f.classList.remove('on'), 80)); }, 620);
}
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight, Q.pr);
  for (const o of [world?.flames, hall?.flames]) if (o) o.uniforms.uPx.value = Q.pr * innerHeight / 900;
  if (hall) { hall.smoke.uniforms.uPx.value = Q.pr * innerHeight / 900; hall.dust.material.uniforms.uPx.value = Q.pr * innerHeight / 900; }
  if (world) world.scenery.setPixelScale(Q.pr * innerHeight / 900);
  if (world?.hutSmoke) world.hutSmoke.uniforms.uPx.value = Q.pr * innerHeight / 900;
}

// ---------------------------------------------------------------- map
function drawMap() {
  const c = $('mapCanvas'), g = c.getContext('2d'), s = 4, X = (x) => (x + 50) * s, Z = (z) => (z + 50) * s;
  g.clearRect(0, 0, 400, 400); g.fillStyle = '#3e5a2c'; g.fillRect(0, 0, 400, 400);
  g.strokeStyle = '#c9a877'; g.lineWidth = 6; g.strokeRect(X(-46), Z(-46), 92 * s, 86 * s);
  g.fillStyle = '#cdb38b'; g.fillRect(X(-2.5), Z(12), 5 * s, 38 * s); g.fillRect(X(-23.5), Z(-2.5), 47 * s, 5 * s); g.fillRect(X(-2.5), Z(-23.5), 5 * s, 12 * s);
  g.beginPath(); g.arc(X(0), Z(0), 12.6 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3d7d7a'; g.beginPath(); g.arc(X(0), Z(0), 2.7 * s, 0, Math.PI * 2); g.fill(); g.fillRect(X(-11.5), Z(19.5), 6 * s, 11 * s); g.fillRect(X(5.5), Z(19.5), 6 * s, 11 * s);
  g.font = '600 22px Mukta, sans-serif'; g.textAlign = 'center';
  for (const T of Object.values(TEMPLES)) {
    const w = T.rot === 0 ? 13 : 16, d = T.rot === 0 ? 16 : 13;
    g.fillStyle = '#e2c79c'; g.fillRect(X(T.pos.x - w / 2), Z(T.pos.z - d / 2), w * s, d * s);
    g.fillStyle = '#9e2a26'; g.beginPath(); g.arc(X(T.pos.x), Z(T.pos.z), 3 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a160f'; g.fillText(T.short, X(T.pos.x), Z(T.pos.z) + (T.rot === 0 ? -9 * s : 11 * s));
  }
  { const hx = X(HUT.pos.x), hz = Z(HUT.pos.z); g.fillStyle = '#c99a4a'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; g[i ? 'lineTo' : 'moveTo'](hx + Math.cos(a) * 4.4 * s, hz + Math.sin(a) * 4.4 * s); } g.closePath(); g.fill();
    g.fillStyle = '#2a160f'; g.fillText('Meditation', hx, hz + 8 * s); }
  { const px = X(PRASAD.pos.x), pz = Z(PRASAD.pos.z); g.save(); g.translate(px, pz); g.rotate(-PRASAD.rot); g.fillStyle = '#d9a64a'; g.fillRect(-3.2 * s, -2.3 * s, 6.4 * s, 4.6 * s); g.restore();
    g.fillStyle = '#2a160f'; g.fillText('Prasad', px, pz + 8 * s); }
  g.fillStyle = 'rgba(246,236,218,.55)'; for (const n of world.npcs) { const p = n.avatar.root.position; g.beginPath(); g.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); g.fill(); }
  const p = me.avatar.root.position, a = me.avatar.root.rotation.y;
  g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-a + Math.PI); g.fillStyle = '#e98a1f'; g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 9); g.lineTo(-9, 9); g.closePath(); g.fill(); g.restore();
}

// ---------------------------------------------------------------- meditation hut
const guide = new Guide();
guide.audio = audio; guide.loadClips().then(() => { if (app.mode === 'hut' && !$('hutPanel').hidden) renderVoices(); });
// the recorded temple guide by default (heard on every device); or one of the device's own speech voices if chosen
function applyGuideVoice() {
  const v = settings.guideVoice || 'recorded';
  guide.useRecorded = guide.hasRecorded && (v === 'recorded' || !guide.ok || !guide.voices().some((x) => x.voiceURI === v));
  guide.voiceURI = guide.useRecorded || v === 'recorded' ? null : v;
}
const hutState = { view: 'altar', session: null, def: null, kind: null, tab: 'breathe', sel: { breathe: 'calm', meditate: 'breath', sit: 'timer' }, mins: {}, voiceOff: false, paused: false, wake: null, rec: null, ui: {}, pop: null };
const HUT_ZONE = { entrance: 0, courtyard: 0, corridor: 0, dome: 0.15, garden: 0.9, ganesha: 0, shiva: 0, krishna: 0 };
const VIEW_NAMES = { pov: 'Your view of the altar', altar: 'Facing the altar', face: 'Facing your devotee', wide: 'The whole hut', flame: 'Looking at the lamp', focus: 'Focus: the breathing figure' };
// line icons for the practice tiles
const P_ICONS = {
  lotus: '<path d="M16 7c-3 4-3 9 0 13 3-4 3-9 0-13zM16 20c-4-1-8-4-9.5-9 4.5 0 7.5 3 9.5 9zM16 20c4-1 8-4 9.5-9-4.5 0-7.5 3-9.5 9zM6 23c4 3 16 3 20 0"/>',
  box: '<rect x="8" y="8" width="16" height="16" rx="2"/><path d="M8 4.5h16M27.5 8v16M24 27.5H8M4.5 24V8"/>',
  hourglass: '<path d="M9 5h14M9 27h14M10 5c0 6 12 8 12 11s-12 5-12 11M22 5c0 6-12 8-12 11s12 5 12 11"/>',
  nadi: '<path d="M11 6v20M21 6v20M11 11l-4 4 4 4M21 21l4-4-4-4"/>',
  hum: '<path d="M5 16h2M10 11v10M14 7v18M18 10v12M22 13v6M27 16h-2"/>',
  layers: '<path d="M6 24h20M8 19h16M10 14h12M16 5v5M13 8l3-3 3 3"/>',
  breath: '<path d="M5 12h14a4 4 0 1 0-4-4M5 17h19a4 4 0 1 1-4 4M5 22h8"/>',
  body: '<circle cx="16" cy="6" r="2.6"/><path d="M16 9v9M10 13h12M12 27l4-9 4 9"/>',
  heart: '<path d="M16 26s-9-5.6-9-12.2A5 5 0 0 1 16 10a5 5 0 0 1 9 3.8C25 20.4 16 26 16 26z"/>',
  om: '<circle cx="16" cy="6.5" r="2.6"/><path d="M16 10c-3 0-5 2-5 5v4h10v-4c0-3-2-5-5-5zM11 17l-5 5h20l-5-5M9 25h14"/>',
  leaf: '<path d="M7 25c0-10 7-17 18-18 0 11-7 18-18 18zM7 25l10-10"/>',
  moon: '<path d="M25 19.5A10 10 0 1 1 13 6a8 8 0 0 0 12 13.5z"/>',
  flame: '<path d="M16 4c4 5 7 8 7 13a7 7 0 0 1-14 0c0-3 1.5-5.5 3-7 0 3 1.5 4.5 3 4.5-1.5-4 0-7.5 1-10.5z"/>',
  timer: '<circle cx="16" cy="17" r="10"/><path d="M16 11v6l4 3M12 3h8"/>',
};
const pIcon = (k) => `<svg viewBox="0 0 32 32" aria-hidden="true">${P_ICONS[k] || P_ICONS.lotus}</svg>`;
function enterHut() {
  if (app.mode !== 'world') return;
  input.auto = []; app.arriveShrine = null; closeAllPanels(); startAudioOnce();
  fadeThrough(() => {
    setMode('hut');
    const av = me.avatar; av.root.position.copy(HUT.seat.pos); av.root.rotation.y = HUT.seat.rotY; av.setState('meditate'); av.breath = null;
    hutState.view = 'altar'; cam.hutSnap = true; if (playerRing) playerRing.visible = false;
    showHutPanel();
    if (audio.ctx) audio.applyZone(HUT_ZONE, 1.2);
  });
}
function leaveHut() {
  if (app.mode !== 'hut') return;
  endSession(true);
  fadeThrough(() => {
    const av = me.avatar; av.setState('idle'); av.breath = null; av.root.visible = true;
    camera.clearViewOffset(); cam.hutLift = 0;
    av.root.position.copy(HUT.inside); av.root.rotation.y = HUT.seat.rotY;   // you stand up inside the hut, free to look round and walk out
    if (playerRing) playerRing.visible = true;
    $('doneCard').hidden = true; $('hutUI').classList.remove('insession');
    setMode('world');
    cam.tYaw = cam.yaw = HUT.seat.rotY + Math.PI; cam.tDist = cam.dist = cam.eff = CLOSE_DIST; cam.tPitch = cam.pitch = 0.2; snapCamera();
  });
}
function showHutPanel() {
  $('sessionUI').hidden = true; $('doneCard').hidden = true; $('hutPanel').hidden = false; $('hutUI').classList.remove('insession');
  if (hutState.view === 'focus' || hutState.view === 'flame') hutState.view = 'altar';
  renderHutPanel();
}
function selectHutTab(tab) {
  hutState.tab = tab;
  for (const [id, t] of [['Breathe', 'breathe'], ['Meditate', 'meditate'], ['Sit', 'sit']]) { $('tab' + id).setAttribute('aria-selected', String(t === tab)); $('list' + id).hidden = t !== tab; }
  renderDetail();
}
const practiceDef = (kind, id) => kind === 'breath' ? BREATHWORK.find(d => d.id === id) : kind === 'meditation' ? MEDITATIONS.find(d => d.id === id) : TIMER;
const TAB_KIND = { breathe: 'breath', meditate: 'meditation', sit: 'timer' };
function renderHutPanel() {
  const tile = (kind, d, tab) => { const mins = hutState.mins[d.id] ?? (kind === 'meditation' ? d.min : d.def);
    return `<button class="tile" role="radio" aria-checked="${hutState.sel[tab] === d.id}" data-tab="${tab}" data-id="${d.id}">${pIcon(d.icon)}<b>${d.name}</b><small>${mins} min</small></button>`; };
  $('listBreathe').innerHTML = BREATHWORK.map(d => tile('breath', d, 'breathe')).join('');
  $('listMeditate').innerHTML = MEDITATIONS.map(d => tile('meditation', d, 'meditate')).join('');
  $('listSit').innerHTML = tile('timer', TIMER, 'sit');
  for (const b of $('hutPanel').querySelectorAll('.tile')) b.onclick = () => { hutState.sel[b.dataset.tab] = b.dataset.id; audio.uiTap(); renderHutPanel(); };
  selectHutTab(hutState.tab);
  $('voiceMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === settings.guideMode)));
  $('bgMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === settings.practiceBg)));
  $('tTones').setAttribute('aria-checked', String(settings.breathTones));
  renderVoices();
  const taken = (world.hutSitters || []).length + 1;
  $('hutSeats').textContent = `${taken} of ${HUT.capacity} seats taken.`;
  const st = PracticeLog.summary();
  $('practiceStats').textContent = st.total ? `Today ${st.today} min · this week ${st.week} min in ${st.weekSessions} session${st.weekSessions === 1 ? '' : 's'}${st.streak > 1 ? ` · ${st.streak}-day streak` : ''}` : 'Your practice is kept on this device only.';
}
function renderDetail() {
  const tab = hutState.tab, kind = TAB_KIND[tab], d = practiceDef(kind, hutState.sel[tab]); if (!d) return;
  const opts = kind === 'meditation' ? [] : d.minutes, chosen = hutState.mins[d.id] ?? (kind === 'meditation' ? d.min : d.def);
  const pat = kind === 'breath' ? d.pattern.map(p => p[1]).join(' · ') + ' s' : kind === 'meditation' ? `${d.min} min · guided` : 'bells only';
  const mins = opts.length ? `<span class="mins" role="group" aria-label="Minutes">${opts.map(m => `<button data-min="${m}" aria-pressed="${m === chosen}">${m} min</button>`).join('')}</span>` : '';
  $('pDetail').innerHTML = `<div class="h"><b>${d.name}</b><i>${d.tag}</i><span class="pat">${pat}</span></div><p>${d.sub}</p><div class="go">${mins}<button class="btn small primary start" id="pBegin">Begin</button></div>`;
  for (const b of $('pDetail').querySelectorAll('[data-min]')) b.onclick = () => { hutState.mins[d.id] = +b.dataset.min; audio.uiTap(); renderHutPanel(); };
  $('pBegin').onclick = () => startSession(kind, d.id);
}
function renderVoices() {
  const sel = $('voicePick'), vs = guide.ok ? guide.voices() : [];
  applyGuideVoice();
  const cur = guide.useRecorded ? 'recorded' : guide.voiceURI || vs[0]?.voiceURI;
  const opts = (guide.hasRecorded ? [`<option value="recorded"${cur === 'recorded' ? ' selected' : ''}>Temple guide · recorded voice</option>`] : [])
    .concat(vs.slice(0, 24).map(v => `<option value="${escapeHtml(v.voiceURI)}"${v.voiceURI === cur ? ' selected' : ''}>${escapeHtml(v.name.replace(/^(Microsoft|Google)\s+/, ''))} · ${escapeHtml(v.lang)}</option>`));
  if (!opts.length && !guide.ok) { sel.innerHTML = '<option>Not available here</option>'; sel.disabled = true; $('voiceTest').disabled = true; $('voiceNote').textContent = 'The guide\'s voice could not be loaded, so captions and breath tones will guide you instead.'; return; }
  const html = opts.length ? opts.join('') : '<option>Default voice</option>';
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  sel.disabled = opts.length < 2; $('voiceTest').disabled = false;
  $('voiceNote').textContent = guide.hasRecorded ? (vs.length ? 'The recorded guide plays on every device. You can also choose one of your device\'s own voices.' : 'A calm recorded voice guides every practice.')
    : 'Voices come from your device. Ones marked Natural, Neural or Enhanced, or English (India), usually sound calmest.';
}
function sessionBg() { return settings.practiceBg === 'auto' ? (hutState.kind === 'breath' ? 'nature' : 'music') : settings.practiceBg; }
function applySessionMix() {
  const bg = sessionBg(), lvl = hutState.musicLevel ?? 0.28;
  audio.setSessionMix({ music: bg === 'music' ? 'meditation' : null, musicLevel: lvl, ambience: bg === 'silence' ? 0.1 : bg === 'music' ? 0.45 : 0.8 });
}
function startSession(kind, id) {
  const def = practiceDef(kind, id); if (!def) return;
  startAudioOnce(); applyGuideVoice(); if (!guide.useRecorded) guide.unlock();
  guide.volume = hutState.voiceVol ?? Math.max(0.25, settings.master / 100); guide.muted = settings.muted || hutState.voiceOff;
  guide.onCaption = showCaption;
  const minutes = hutState.mins[def.id] ?? (kind === 'meditation' ? def.min : def.def);
  const recorded = audio.manifest?.guided?.[def.id] || null;
  const S = new Session(kind, def, { minutes, voice: settings.guideMode, tones: settings.breathTones, audio, guide, recorded });
  S.onEnd = finishSession;
  Object.assign(hutState, { session: S, def, kind, paused: false, ui: {} });
  applySessionMix();
  if (recorded) { hutState.rec = new Audio(recorded); hutState.rec.play().catch(() => {}); }
  $('hutPanel').hidden = true; $('doneCard').hidden = true; $('sessionUI').hidden = false; $('hutUI').classList.add('insession'); closeSessionPop();
  $('sHead').textContent = kind === 'breath' ? 'Breathwork in progress' : kind === 'timer' ? 'Silent sitting' : 'Meditation in progress';
  $('sTitle').textContent = `${def.name} · ${def.tag}`;
  $('orb').classList.toggle('calm', kind !== 'breath');
  setPauseIcon(false); $('sCaption').textContent = ''; $('sCaption').classList.add('dim'); $('sleepDim').style.opacity = 0;
  hutState.view = def.view || 'pov';   // while practising you see through your own eyes; your devotee is out of frame
  requestWake();
  S.start();
}
function setPauseIcon(paused) {
  $('sPause').innerHTML = paused ? '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
  $('sPause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}
function togglePause() {
  const S = hutState.session; if (!S) return;
  hutState.paused = !hutState.paused;
  if (hutState.paused) { S.pause(); hutState.rec?.pause(); } else { S.resume(); hutState.rec?.play().catch(() => {}); }
  setPauseIcon(hutState.paused);
  me.avatar.breath = null;
}
function seekSession(d) {
  const S = hutState.session; if (!S) return;
  S.seek(d); if (hutState.rec) try { hutState.rec.currentTime = Math.max(0, hutState.rec.currentTime + d); } catch (e) {}
  toast(d < 0 ? 'Back 15 seconds' : 'Forward 15 seconds', 1200);
}
function endSession(silent = false) {
  const S = hutState.session; if (!S) return;
  S.stop(); hutState.rec?.pause(); hutState.rec = null;
  if (S.elapsed > 60) PracticeLog.add({ kind: hutState.kind, id: hutState.def.id, minutes: S.elapsed / 60, partial: true });
  hutState.session = null; me.avatar.breath = null; releaseWake(); closeSessionPop();
  audio.clearSessionMix(); HUT.breath = null; hutState.view = 'altar'; me.avatar.root.visible = true;
  if (!silent) showHutPanel();
}
function finishSession() {
  const S = hutState.session, def = hutState.def; if (!S) return;
  PracticeLog.add({ kind: hutState.kind, id: def.id, minutes: S.total / 60 });
  hutState.session = null; hutState.rec = null; me.avatar.breath = null; releaseWake(); closeSessionPop();
  setTimeout(() => { if (!hutState.session) audio.clearSessionMix(); }, def.sleep ? 12000 : 4000);   // let the last bowl (or the music) ring out
  hutState.view = 'altar'; me.avatar.root.visible = true;
  HUT.breath = null;
  const st = PracticeLog.summary(), mins = Math.round(S.total / 60);
  $('sessionUI').hidden = true; $('doneCard').hidden = false; $('hutUI').classList.remove('insession');
  $('doneTitle').textContent = def.sleep ? 'Sleep well' : ['Well done', 'Beautifully done', 'Peace be with you'][Math.floor(Math.random() * 3)];
  $('doneSub').textContent = `${mins} minute${mins === 1 ? '' : 's'} of ${def.name.toLowerCase()}${S.kind === 'breath' && S.cycles ? `, ${S.cycles} breaths` : ''}. Today: ${st.today} min${st.streak > 1 ? ` · ${st.streak}-day streak` : ''}.`;
  hutState.again = [hutState.kind, def.id];
}
function showCaption(text) {
  const c = $('sCaption'); c.textContent = text; c.classList.remove('dim');
  clearTimeout(hutState.capT); hutState.capT = setTimeout(() => c.classList.add('dim'), Math.max(4500, text.split(' ').length * 520));
}
async function requestWake() { try { hutState.wake = await navigator.wakeLock?.request('screen'); } catch (e) {} }
function releaseWake() { try { hutState.wake?.release(); } catch (e) {} hutState.wake = null; }
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
// pop-ups from the player bar: background sound, and volume and voice
function closeSessionPop() { hutState.pop = null; $('sPop').hidden = true; $('sMusic').setAttribute('aria-expanded', 'false'); $('sVol').setAttribute('aria-expanded', 'false'); }
function openSessionPop(which) {
  if (hutState.pop === which) { closeSessionPop(); return; }
  hutState.pop = which; const pop = $('sPop'); pop.hidden = false;
  $('sMusic').setAttribute('aria-expanded', String(which === 'music')); $('sVol').setAttribute('aria-expanded', String(which === 'vol'));
  if (which === 'music') {
    const bg = sessionBg(), np = audio.nowPlaying;
    pop.innerHTML = `<h3>Background</h3>` + [['music', 'Soft music', 'Calm meditation music, low under the voice'], ['nature', 'Nature', 'The stream and birds, or crickets at night'], ['silence', 'Silence', 'Only the voice, tones and bowls']]
      .map(([id, l, sub]) => `<button class="opt" data-bg="${id}" aria-pressed="${bg === id}"><b>${l}</b><br><small class="note">${sub}</small></button>`).join('') +
      (bg === 'music' && np ? `<div class="setrow"><span class="note">♪ ${escapeHtml(np.title)} · ${escapeHtml(np.artist)}</span><button class="btn small" id="popNext">Next</button></div>` : '');
    pop.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => { settings.practiceBg = b.dataset.bg; persist(); applySessionMix(); hutState.pop = null; openSessionPop('music'); });
    const nx = pop.querySelector('#popNext'); if (nx) nx.onclick = () => { audio.skipTrack(); setTimeout(() => { hutState.pop = null; openSessionPop('music'); }, 200); };
  } else {
    const vv = Math.round((hutState.voiceVol ?? guide.volume) * 100), mv = Math.round((hutState.musicLevel ?? 0.28) / 0.6 * 100);
    pop.innerHTML = `<h3>Volume</h3>
      <div class="setrow"><span>Voice guide</span><button class="toggle" id="popVoice" role="switch" aria-checked="${!hutState.voiceOff}" aria-label="Voice guide"></button></div>
      <div class="setrow"><span>Voice volume</span><span>${vv}</span><input type="range" id="popVoiceVol" min="10" max="100" value="${vv}"></div>
      <div class="setrow"><span>Background volume</span><span>${mv}</span><input type="range" id="popMusicVol" min="0" max="100" value="${mv}"></div>
      <div class="setrow"><span>Breath tones</span><button class="toggle" id="popTones" role="switch" aria-checked="${settings.breathTones}" aria-label="Breath tones"></button></div>`;
    $('popVoice').onclick = () => { hutState.voiceOff = !hutState.voiceOff; guide.muted = hutState.voiceOff || settings.muted; if (hutState.voiceOff) guide.cancel(); hutState.pop = null; openSessionPop('vol'); };
    $('popVoiceVol').oninput = (e) => { hutState.voiceVol = guide.volume = +e.target.value / 100; e.target.previousElementSibling.textContent = e.target.value; };
    $('popMusicVol').oninput = (e) => { hutState.musicLevel = +e.target.value / 100 * 0.6; e.target.previousElementSibling.textContent = e.target.value; if (audio.session) { audio.session.musicLevel = hutState.musicLevel; audio.session.ambience = (sessionBg() === 'silence' ? 0.1 : 0.45) * (0.4 + hutState.musicLevel / 0.6 * 1.2); audio.applyZone(audio.zone, 0.3); } };
    $('popTones').onclick = () => { settings.breathTones = !settings.breathTones; persist(); if (hutState.session) hutState.session.tones = settings.breathTones; hutState.pop = null; openSessionPop('vol'); };
  }
}
// a glowing waveform under the scene: the sound that is playing, with the breath underneath it
function drawWave(t) {
  const c = $('sWave'), w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  if (!hutState.an && audio.ctx && audio.out) { hutState.an = audio.ctx.createAnalyser(); hutState.an.fftSize = 256; hutState.an.smoothingTimeConstant = 0.82; audio.out.connect(hutState.an); hutState.waveData = new Uint8Array(hutState.an.frequencyBinCount); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (hutState.an) hutState.an.getByteFrequencyData(hutState.waveData);
  const S = hutState.session, fill = S ? S.state.fill : 0.5, N = Math.max(24, Math.floor(w / 9)), bw = w / N;
  const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, 'rgba(255,190,90,0)'); grad.addColorStop(0.2, 'rgba(255,200,110,.85)'); grad.addColorStop(0.5, 'rgba(255,236,190,1)'); grad.addColorStop(0.8, 'rgba(255,200,110,.85)'); grad.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = grad; g.shadowColor = 'rgba(255,170,70,.8)'; g.shadowBlur = 10;
  for (let i = 0; i < N; i++) {
    const d = Math.abs(i - (N - 1) / 2) / (N / 2), bin = 2 + Math.floor(d * 40), a = hutState.waveData ? hutState.waveData[bin] / 255 : 0;
    const base = hutState.paused ? 0.06 : (0.1 + 0.22 * fill) * (1 - d * 0.7) + 0.05 * Math.sin(t * 2.6 + i * 0.55) * (1 - d);
    const amp = Math.max(0.04, base, a * (1 - d * 0.35) * 1.1) * h * 0.92, x = i * bw + bw * 0.3;
    g.beginPath(); g.roundRect ? g.roundRect(x, (h - amp) / 2, bw * 0.4, amp, bw * 0.2) : g.rect(x, (h - amp) / 2, bw * 0.4, amp); g.fill();
  }
}
function updateSessionUI() {
  const S = hutState.session, u = hutState.ui; if (!S) return;
  const st = S.state, focus = hutState.view === 'focus';
  $('orb').hidden = !focus; $('sessionUI').classList.toggle('noorb', !focus);
  if (focus) {
    if (!hutState.visual) hutState.visual = new MeditatorVisual($('mediWrap'), { reducedMotion: settings.reducedMotion });
    hutState.visual.reduced = settings.reducedMotion;
    hutState.visual.update(hutState.paused ? 0.5 : st.fill, app.time, { hold: st.phase === 'hold' });
  }
  const breathing = S.kind === 'breath' && st.phase !== 'intro' && st.phase !== 'close';
  const label = hutState.paused ? 'Paused' : S.kind === 'breath' ? st.label : hutState.def.tag;
  const count = S.kind === 'breath' ? (st.left ? String(st.left) : '') : '';
  if (u.label !== label) { u.label = label; $('oPhase').textContent = label; $('sPhaseLabel').textContent = label; }
  if (u.count !== count) { u.count = count; $('oCount').textContent = S.kind === 'breath' ? count : fmt(S.remaining); $('sPhaseCount').textContent = count; }
  $('sPhase').classList.toggle('off', focus || !(breathing || hutState.paused));
  const left = fmt(S.remaining);
  if (u.left !== left) { u.left = left; $('sTime').textContent = left; $('sBar').style.width = (100 * S.elapsed / S.total).toFixed(1) + '%'; if (S.kind !== 'breath') $('oCount').textContent = left; }
  if (hutState.def.sleep) $('sleepDim').style.opacity = (Math.max(0, Math.min(1, (S.elapsed - (S.total - 330)) / 240)) * 0.72).toFixed(3);
  drawWave(app.time);
}
function bindHut() {
  $('mediWrap').innerHTML = meditatorSVG('sess'); $('hutMark').innerHTML = meditatorSVG('hm', { full: false });
  $('doneMark').innerHTML = meditatorSVG('dm'); new MeditatorVisual($('doneMark'), { reducedMotion: true }).update(1, 0);
  $('hutLeave').onclick = leaveHut;
  $('tabBreathe').onclick = () => selectHutTab('breathe'); $('tabMeditate').onclick = () => selectHutTab('meditate'); $('tabSit').onclick = () => selectHutTab('sit');
  $('voiceMode').querySelectorAll('button').forEach(b => b.onclick = () => { settings.guideMode = b.dataset.v; persist(); renderHutPanel(); });
  $('bgMode').querySelectorAll('button').forEach(b => b.onclick = () => { settings.practiceBg = b.dataset.b; persist(); renderHutPanel(); });
  $('tTones').onclick = () => { settings.breathTones = !settings.breathTones; persist(); renderHutPanel(); };
  $('voicePick').onchange = (e) => { settings.guideVoice = e.target.value; persist(); applyGuideVoice(); };
  $('voiceTest').onclick = () => { startAudioOnce(); applyGuideVoice(); if (!guide.useRecorded) guide.unlock(); guide.volume = hutState.voiceVol ?? Math.max(0.25, settings.master / 100); guide.muted = false; guide.cancel(); guide.say(EXTRA_LINES.test, { caption: false }); };
  if (guide.ok && 'speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { if (app.mode === 'hut' && !$('hutPanel').hidden) renderVoices(); });
  $('sPause').onclick = togglePause;
  $('sBack').onclick = () => endSession();
  $('sPrev').onclick = () => seekSession(-15); $('sNext').onclick = () => seekSession(15);
  $('sMusic').onclick = () => openSessionPop('music'); $('sVol').onclick = () => openSessionPop('vol');
  const cycleView = (inSession) => {
    const order = inSession ? ['pov', 'focus'].concat(hutState.def?.view === 'flame' ? ['flame'] : []) : ['altar', 'face', 'wide'];
    hutState.view = order[(order.indexOf(hutState.view) + 1) % order.length]; toast(VIEW_NAMES[hutState.view], 1600);
  };
  $('hutView').onclick = () => cycleView(false); $('sView').onclick = () => cycleView(true);
  $('doneAgain').onclick = () => { const [k, id] = hutState.again || []; if (k) startSession(k, id); };
  $('doneMore').onclick = showHutPanel;
  $('doneLeave').onclick = leaveHut;
}
function updateHut(dt, t, ctx) {
  const av = me.avatar, S = hutState.session;
  if (S && !hutState.paused) { S.update(dt); const breathing = S.kind === 'breath' && S.state.phase !== 'intro' && S.state.phase !== 'close'; av.breath = breathing ? S.state.fill : null; av.mudra = breathing && hutState.def.id === 'nadi' ? 'nadi' : null; HUT.breath = S.state.fill; }
  else if (!S) av.mudra = null;
  if (S) updateSessionUI();
  av.update(dt, t);
  const vk = hutState.view === 'focus' ? 'pov' : hutState.view, V = HUT.views[vk] || HUT.views.altar, pov = vk === 'pov' || vk === 'flame';
  const drift = settings.reducedMotion ? 0 : Math.sin(t * 0.06) * (pov ? 0.03 : 0.16);
  av.root.visible = !(S && pov);   // through your own eyes, your devotee is out of the picture
  const want = HUT.toWorld(V.pos[0] + drift, V.pos[1] + (settings.reducedMotion ? 0 : Math.sin(t * 0.045) * 0.04), V.pos[2]), look = HUT.toWorld(...V.look);
  const k = cam.hutSnap ? 1 : 1 - Math.exp(-dt * 1.4); cam.hutSnap = false;
  camera.position.lerp(want, k); cam.target.lerp(look, k); camera.lookAt(cam.target);
  const fov = (V.fov || 46) * (camera.aspect < 1 && pov ? 1.25 : 1); camera.fov += (fov - camera.fov) * k;
  // on a portrait screen the practice panel covers the lower part: lift the picture into the space above it
  const lift = innerWidth < innerHeight && !S && !$('hutPanel').hidden ? V.lift ?? 0.28 : 0;
  cam.hutLift = (cam.hutLift || 0) + (lift - (cam.hutLift || 0)) * (cam.hutLift === undefined ? 1 : Math.max(k, 0.08));
  // (setViewOffset also sets the aspect from its full size, so it gets the real screen size)
  if (cam.hutLift > 0.002) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * cam.hutLift, innerWidth, innerHeight); else camera.clearViewOffset();
  world.update(dt, t, av.root.position, ctx);
  if (world.hutSmoke) world.hutSmoke.enabled = settings.incense;
  if (audio.ctx) { if (Math.floor(t) !== app.hutTick) { app.hutTick = Math.floor(t); audio.applyZone(HUT_ZONE, 1); } audio.setListener(av.root.position.clone().setY(av.root.position.y + 0.95), HUT.toWorld(0, 0, -1).sub(HUT.pos).normalize()); }
  camera.updateProjectionMatrix();
  post.tilt.amount = 0; renderer.toneMappingExposure = world.tod.exposure;
  aimShafts(S ? 0.35 : 0.7); post.finalMat.uniforms.uVignette.value = S ? 0.55 : 0.46; post.finalMat.uniforms.uWarm.value = 0.18 + world.evening * 0.2; post.bloom.strength = Q.bloom * 1.6; post.bloom.threshold = 1.1;
  post.render(world.scene, camera);
}

// light shafts stream from the sun's place on screen; they fade as you turn away from it and at night
const _sunP = new THREE.Vector3(), _camF = new THREE.Vector3();
function aimShafts(amount = 1) {
  if (!world || !world.sunDir) { post.shafts.strength = 0; return; }
  _sunP.copy(camera.position).addScaledVector(world.sunDir, 1000).project(camera);
  camera.getWorldDirection(_camF); const facing = _camF.dot(world.sunDir);
  post.shafts.sun.set(_sunP.x * 0.5 + 0.5, _sunP.y * 0.5 + 0.5);
  const day = 1 - (world.tod.night || 0), low = 0.55 + 0.45 * (1 - Math.min(1, Math.max(0, world.sunDir.y - 0.15) / 0.7));
  post.shafts.strength = Q.post ? amount * day * low * Math.max(0, Math.min(1, (facing + 0.15) / 0.6)) * 0.55 : 0;
}

// ---------------------------------------------------------------- per-frame
let last = 0, stepIdx = 0;
const tmp = new THREE.Vector3(), lookDir = new THREE.Vector3(), lookAt = new THREE.Vector3();
const look = { yaw: 0, pitch: 0, zoom: 1, tYaw: 0, tPitch: 0, tZoom: 1, mode: null };   // your own turn of the head inside a prayer hall
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; app.time += dt; const t = app.time;
  const ctx = { reducedMotion: settings.reducedMotion, incense: settings.incense, player: me.avatar };
  if (app.mode === 'creator') {
    preview.avatar.update(dt, t); if (!input.drag) preview.avatar.root.rotation.y += dt * (settings.reducedMotion ? 0 : 0.35);
    const narrow = innerWidth < 720;
    camera.fov = 30;
    // framed for a devotee about 1.3 m tall; zooming in ends on the face
    const pd = preview.dist || 4.4, zk = THREE.MathUtils.clamp((4.4 - pd) / 3.3, 0, 1), D = pd * 0.84 + zk * 0.6;
    if (narrow) { camera.position.set(0, 1.0 + zk * 0.1, 7.4 * D / 4.4); camera.lookAt(0, -0.12 + zk * 0.67, 0); } else { camera.position.set(0.216 * D, 0.95 + zk * 0.15, D); camera.lookAt(0.216 * D, 0.68 + zk * 0.34, 0); }
    camera.updateProjectionMatrix(); post.tilt.amount = 0; post.bloom.strength = 0; post.shafts.strength = 0; post.finalMat.uniforms.uVignette.value = 0.5; post.render(preview.scene, camera); return;
  }
  if (me.avatar) net.tick(myNetState());
  if (app.mode === 'hall') { updateHall(dt, t, ctx); positionLabels(); remotes && remotes.hideLabels(); return; }
  if (app.mode === 'hut') { updateHut(dt, t, ctx); remotes && remotes.update(dt, t, { project, showLabels: !hutState.session }); return; }
  updateWorld(dt, t, ctx);
  positionLabels();
  remotes && remotes.update(dt, t, { project, showLabels: app.mode === 'world' });
}

function updateWorld(dt, t, ctx) {
  const av = me.avatar, p = av.root.position;
  let mx = 0, mz = 0;
  if (app.mode === 'world') {
    const k = input.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + input.joy.y;
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + input.joy.x;
    if (Math.abs(f) + Math.abs(r) > 0.05) {
      input.auto = []; app.arriveShrine = null;
      const fw = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), rt = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      const d = fw.multiplyScalar(f).add(rt.multiplyScalar(r)); const l = Math.min(1, d.length()); d.normalize().multiplyScalar(l); mx = d.x; mz = d.z;
    } else if (input.auto.length) {
      const tgt = input.auto[0]; const d = new THREE.Vector3(tgt.x - p.x, 0, tgt.z - p.z); const dist = d.length();
      if (dist < 0.35) { input.auto.shift(); if (!input.auto.length && app.arriveShrine) { const id = app.arriveShrine; app.arriveShrine = null; if (id === 'hut') walkIntoHut(); else { const T = DEST(id); const dir = T.pos.clone().sub(p); av.root.rotation.y = Math.atan2(dir.x, dir.z); } }
        else if (!input.auto.length && app.hutArrive) { app.hutArrive = false; av.root.rotation.y = HUT.seat.rotY; cam.tYaw = lerpAngle(cam.yaw, HUT.seat.rotY + Math.PI, 1); toast('Inside the Dhyana Kutir. Sit on the centre cushion when you are ready', 3200); } }
      else { d.normalize(); const sl = Math.min(1, dist / 0.8 + 0.3); mx = d.x * sl; mz = d.z * sl; }
    }
  }
  const speed = 4.2, mv = Math.hypot(mx, mz);
  if (mv > 0.01) {
    const np = p.clone().add(new THREE.Vector3(mx, 0, mz).multiplyScalar(speed * dt));
    world.resolve(np, 0.34);
    for (const n of world.npcs) { const q = n.avatar.root.position; const dx = q.x - np.x, dz = q.z - np.z, d = Math.hypot(dx, dz); if (d < 0.62 && d > 1e-3) { q.x = np.x + dx / d * 0.62; q.z = np.z + dz / d * 0.62; world.resolve(q, 0.3); } } // devotees step aside
    const moved = np.distanceTo(p) / dt; p.copy(np);
    av.speed = Math.min(moved, speed); av.setState(moved > 0.25 ? 'walk' : 'idle');
    av.root.rotation.y = lerpAngle(av.root.rotation.y, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
    // stuck on an obstacle while auto-walking: drop the waypoint
    if (input.auto.length && moved < 0.3) { input.stuck = (input.stuck || 0) + dt; if (input.stuck > 0.6) { input.auto.shift(); input.stuck = 0; } } else input.stuck = 0;
  } else if (av.state === 'walk') av.setState('idle');
  if (av.state === 'bow' && app.time > (app.pranamUntil || 0)) av.setState('namaste');
  if (app.mode === 'world') p.y += (hutFloor(p.x, p.z) - p.y) * (1 - Math.exp(-dt * 14));   // up the hut's steps and onto its floor
  av.update(dt, t);
  footsteps(av);
  // gate bells chime as you pass beneath them
  if (Math.abs(p.z - 40) < 1.2 && Math.abs(p.x) < 3 && mv > 0.1 && t - (app.gateT || 0) > 2.5) { app.gateT = t; const b = world.gateBells[Math.floor(Math.random() * world.gateBells.length)]; b.strike(0.7); }
  // shrine prompt
  if (app.mode === 'world') {
    const T = nearShrine();
    if (T && $('fullSheet').hidden) {
      const h = directory.instances(T.id).find(x => directory.occupancy(x) < HALL_CAPACITY) || directory.instances(T.id)[0];
      $('promptTitle').textContent = T.name; $('promptSub').textContent = `${hallLabel(h)} places taken · ${T.blurb}`;
      $('enterBtn').textContent = directory.occupancy(h) >= HALL_CAPACITY ? 'Enter (full)' : 'Enter prayer hall';
      $('prompt').classList.add('on');
    } else if (nearHut() && $('fullSheet').hidden && !(input.auto.length && app.hutArrive)) {
      const inside = inHut();
      $('promptTitle').textContent = inside ? 'Dhyana Kutir' : 'Meditation hut';
      $('promptSub').textContent = inside ? 'Sit on the centre cushion to breathe and meditate with the others' : 'Dhyana Kutir · breathwork and short guided meditations';
      $('enterBtn').textContent = inside ? 'Sit and practise' : 'Go inside'; $('prompt').classList.add('on');
    } else if (nearPrasad() && !world.prasad.has(me.avatar) && $('fullSheet').hidden) {
      const q = world.prasad.length;
      $('promptTitle').textContent = 'Prasad centre'; $('promptSub').textContent = `A sevak shares prasad: a laddoo and sweet pongal in a leaf cup · ${q ? q + ' in line' : 'no one waiting'}`;
      $('enterBtn').textContent = 'Receive prasad'; $('prompt').classList.add('on');
    } else $('prompt').classList.remove('on');
    // stepping out of the prasad line
    if (world.prasad && world.prasad.has(me.avatar) && !input.auto.length) { const slot = PRASAD.slot(world.prasad.position(me.avatar)); if (p.distanceTo(slot) > 1.6) { world.prasad.leave(me.avatar); toast('You step out of the line', 1600); } }
    if ($('map').classList.contains('on') && Math.floor(t * 10) % 3 === 0) drawMap();
  }
  if (tapMarker && tapMarker.visible) { tapMarker.userData.t += dt; const k = tapMarker.userData.t; tapMarker.scale.setScalar(1 + k * 1.5); tapMarker.material.opacity = Math.max(0, 1 - k * 1.4); if (k > 0.8) tapMarker.visible = false; }
  // audio zones
  if (audio.ctx) {
    const dGate = Math.hypot(p.x, p.z - 40), r = Math.hypot(p.x, p.z);
    const zone = { entrance: clamp01(1 - (dGate - 4) / 14), courtyard: clamp01(1 - (r - 9) / 12), corridor: 0, dome: 0, garden: clamp01((r - 14) / 14) * 0.8, ganesha: 0, shiva: 0, krishna: 0 };
    for (const T of Object.values(TEMPLES)) { const d = T.entrance.distanceTo(p); zone.corridor = Math.max(zone.corridor, clamp01(1 - (d - 1) / 7)); zone[T.id] = clamp01(1 - (d - 4) / 18); }
    if (app.mode === 'welcome') { zone.entrance = 0.6; zone.courtyard = 0.6; }
    if (Math.floor(t * 4) !== app.zoneTick) { app.zoneTick = Math.floor(t * 4); audio.applyZone(zone, 0.8); }
    const fwd = tmp.set(p.x - camera.position.x, 0, p.z - camera.position.z).normalize();
    audio.setListener(p.clone().setY(1.1), fwd);
  }
  // camera
  const lerp = 1 - Math.exp(-dt * (settings.reducedMotion ? 14 : 6));
  if (app.mode === 'welcome' || app.mode === 'loading') {
    // a slow sweep across the campus toward the mountains and waterfalls in the north
    const a = settings.reducedMotion ? 0 : Math.sin(t * 0.05) * 0.4;
    cam.pos.set(Math.sin(a) * 22, 13, 33); cam.target.set(Math.sin(a) * 14, 11, -60); camera.fov = 54;
    camera.position.lerp(cam.pos, 1 - Math.exp(-dt * 2)); camera.lookAt(cam.target);
    world.update(dt, t, new THREE.Vector3(0, 0, 0), ctx);
  } else {
    // close up, the camera drops to just behind the shoulder and follows your devotee
    if (app.mode === 'world' && input.auto.length && cam.close > 0.3) cam.tYaw = lerpAngle(cam.tYaw, av.root.rotation.y + Math.PI, 1 - Math.exp(-dt * 1.5 * cam.close));
    // close up, the camera drifts round behind you as you walk (never when you walk toward it, so it cannot spin)
    else if (app.mode === 'world' && cam.close > 0.5 && av.state === 'walk' && !input.drag) { const d = Math.atan2(Math.sin(av.root.rotation.y + Math.PI - cam.tYaw), Math.cos(av.root.rotation.y + Math.PI - cam.tYaw)); if (Math.abs(d) < 2.0) cam.tYaw += d * (1 - Math.exp(-dt * 0.9)); }
    cam.yaw += (cam.tYaw - cam.yaw) * lerp; cam.pitch += (cam.tPitch - cam.pitch) * lerp; cam.dist += (cam.tDist - cam.dist) * lerp;
    cam.close = clamp01((10 - cam.dist) / 7);
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    // close up, the camera looks a little over your head, so your devotee sits low in the frame with the world ahead
    const hutCam = app.mode === 'world' && hutInside(p.x, p.z);   // under the thatch the camera comes down and in, with a wider view
    cam.hutK = (cam.hutK || 0) + ((hutCam ? 1 : 0) - (cam.hutK || 0)) * (1 - Math.exp(-dt * 3));
    const focus = p.clone().add(new THREE.Vector3(0, 1.05 + cam.close * 0.8 * (1 - cam.hutK * 0.55), 0)).addScaledVector(right, cam.close * 0.55 * (1 - cam.hutK * 0.6));
    cam.target.lerp(focus, 1 - Math.exp(-dt * 8));
    // portrait screens get a little more distance; temples and the gateway pull the camera in rather than hide you
    let want = cam.dist * (camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.6 * (1 - cam.close) : 1);
    // inside the walls, keep the camera inside too, so the gateway never fills the foreground
    const cz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
    if (p.z < 39.5 && cz > 0.05) want = Math.max(Math.min(9, want), Math.min(want, (38.5 - cam.target.z) / cz));
    const dirAt = (pitch, out) => out.set(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
    // inside the meditation hut the camera stays under the beams, within the ring of posts
    if (hutCam) {
      const pc = Math.min(cam.pitch, 0.22), cx = cam.target.x - HUT.pos.x, czz = cam.target.z - HUT.pos.z, dx = Math.sin(cam.yaw) * Math.cos(pc), dz = Math.cos(cam.yaw) * Math.cos(pc);
      const a2 = dx * dx + dz * dz, b = cx * dx + czz * dz, c2 = cx * cx + czz * czz - (HUT.radius - 0.3) ** 2, disc = b * b - a2 * c2;
      want = Math.min(want, 2.8, disc > 0 ? Math.max(1.2, (-b + Math.sqrt(disc)) / a2) : 1.2);
    }
    // first try lifting the camera over the obstacle, then pull it closer as a last resort
    const basePitch = hutCam ? Math.min(cam.pitch, 0.22) : cam.pitch;   // your own tilt, close up or far away
    let pitch = basePitch, allowed = want;
    for (let i = 0; i < 6; i++) {
      const pt = Math.min(1.3, basePitch + i * 0.12); occRay.set(cam.target, dirAt(pt, tmp)); occRay.far = want;
      const hit = world.occluders.length ? occRay.intersectObjects(world.occluders, true)[0] : null;
      if (!hit) { pitch = pt; allowed = want; break; }
      if (i === 5) { pitch = basePitch; allowed = Math.max(Math.min(2.2, want), hit.distance - 0.6); }
    }
    cam.effPitch = cam.effPitch ?? basePitch;
    cam.effPitch += (pitch - cam.effPitch) * (1 - Math.exp(-dt * (pitch > cam.effPitch ? 6 : 1.5)));
    cam.eff += (allowed - cam.eff) * (allowed < cam.eff ? 1 - Math.exp(-dt * 10) : 1 - Math.exp(-dt * 2));
    const dir = dirAt(cam.effPitch, tmp);
    // looking up, the camera sinks behind your devotee; it comes in closer rather than dip under the ground
    const above = cam.effPitch < 0 ? Math.max(0.6, (cam.target.y - 0.35) / -Math.sin(cam.effPitch)) : Infinity;
    camera.position.copy(cam.target).addScaledVector(dir, Math.min(cam.eff, above));
    camera.lookAt(cam.target); camera.fov = 52 - cam.close * 8 + cam.hutK * (camera.aspect < 1 ? 26 : 16);
    world.update(dt, t, p, ctx);
    if (playerRing) { playerRing.position.set(p.x, p.y + 0.06, p.z); const k = settings.reducedMotion ? 1 : 1 + Math.sin(t * 2.4) * 0.06; playerRing.scale.set(k, k, k); playerRing.material.opacity = 0.85 * Math.max(0, 1 - cam.close * 1.4); }   // the ring helps from afar; close up it would only clutter the scene
  }
  camera.updateProjectionMatrix();
  post.tilt.amount = Q.tilt * (app.mode === 'welcome' ? 0.06 : 0.08 * (1 - (cam.close || 0))); post.tilt.focus = 0.4; post.tilt.band = 0.32; renderer.toneMappingExposure = world.tod.exposure;
  aimShafts(1); post.finalMat.uniforms.uVignette.value = 0.32; post.finalMat.uniforms.uWarm.value = 0.16 + world.evening * 0.2; post.bloom.strength = Q.bloom * 1.6; post.bloom.threshold = 1.05;
  post.render(world.scene, camera);
}

function updateHall(dt, t, ctx) {
  const av = me.avatar, p = av.root.position;
  if (input.auto.length) {
    const tgt = input.auto[0]; const d = new THREE.Vector3(tgt.x - p.x, 0, tgt.z - p.z); const dist = d.length();
    if (dist < 0.08) { input.auto.shift(); if (!input.auto.length) { if (app.hallState === 'walking') seated(); else if (app.onArrive) { const f = app.onArrive; app.onArrive = null; f(); } } }
    else { d.normalize(); const step = Math.min(dist, 1.5 * dt); p.addScaledVector(d, step); av.speed = 1.5; av.setState('walk'); av.root.rotation.y = lerpAngle(av.root.rotation.y, Math.atan2(d.x, d.z), 1 - Math.exp(-dt * 10)); }
  }
  if (app.hallState === 'seated') av.root.rotation.y = lerpAngle(av.root.rotation.y, Math.PI, 1 - Math.exp(-dt * 6));
  p.y += (hallFloor(p.x, p.z) - p.y) * (1 - Math.exp(-dt * 14));   // up and down the sanctum steps
  if (app.errand && av.state === 'ring' && !input.auto.length && av.stateTime > 1.7) av.setState('idle');
  if (app.shot && app.time > app.shot.until) { if (app.camMode === app.shot.mode && app.hallState === 'seated' && !app.aarti) app.camMode = app.shot.ret; app.shot = null; if (!app.errand) $('actions').classList.remove('busy'); }
  av.update(dt, t); footsteps(av);
  hall.update(dt, t, ctx);
  if (app.aarti) { app.aarti.t += dt; }
  const want = hall.cameraFor(app.camMode, t, p);
  const k = 1 - Math.exp(-dt * (settings.reducedMotion ? 10 : app.camMode === 'aarti' ? 1.2 : 2.4));
  if (!cam.hallInit) { camera.position.copy(want.pos); cam.target.copy(want.target); camera.fov = want.fov; cam.hallInit = true; }
  camera.position.lerp(want.pos, k); cam.target.lerp(want.target, k);
  if (look.mode !== app.camMode) { look.mode = app.camMode; look.tYaw = 0; look.tPitch = 0; look.tZoom = 1; }
  const lk = 1 - Math.exp(-dt * 9); look.yaw += (look.tYaw - look.yaw) * lk; look.pitch += (look.tPitch - look.pitch) * lk; look.zoom += (look.tZoom - look.zoom) * lk;
  const wantFov = (camera.aspect < 1 ? Math.min(82, want.fov * (1 + (1 - camera.aspect) * 0.75)) : want.fov) * look.zoom; camera.fov += (wantFov - camera.fov) * k;
  { const d = lookDir.copy(cam.target).sub(camera.position), L = d.length() || 1, y0 = Math.atan2(d.x, d.z), p0 = Math.asin(THREE.MathUtils.clamp(d.y / L, -1, 1));
    const yy = y0 + look.yaw, pp = THREE.MathUtils.clamp(p0 + look.pitch, -1.45, 1.45);
    lookAt.set(camera.position.x + Math.sin(yy) * Math.cos(pp) * L, camera.position.y + Math.sin(pp) * L, camera.position.z + Math.cos(yy) * Math.cos(pp) * L); }
  camera.lookAt(lookAt); camera.updateProjectionMatrix();
  if (audio.ctx) audio.setListener(camera.position, tmp.copy(lookAt).sub(camera.position).normalize());
  post.tilt.amount = app.camMode === 'select' ? 0.3 : 0.22; post.tilt.band = app.camMode === 'select' ? 0.3 : 0.34; post.tilt.focus = 0.5;
  if (!Q.post) post.tilt.amount = 0;
  post.bloom.strength = Q.bloom * 1.7; post.bloom.threshold = 1.0; post.shafts.strength = 0;
  post.finalMat.uniforms.uVignette.value = app.aarti ? 0.6 : 0.42; post.finalMat.uniforms.uWarm.value = app.aarti ? 0.45 : 0.25;
  renderer.toneMappingExposure = 1.05;
  post.render(hall.scene, camera);
}
function footsteps(av) {
  if (av.state !== 'walk') return;
  const i = Math.floor(av.walkPhase / Math.PI); if (i !== stepIdx) { stepIdx = i; audio.footstep(app.mode === 'hall' ? 0.7 : 1); }
}
// ---------------------------------------------------------------- time of day
const TOD_INFO = {
  morning: { label: 'Morning', icon: 'sunrise', sound: 'Soft sunrise light, a mountain stream and a songbird' },
  afternoon: { label: 'Afternoon', icon: 'sun', sound: 'Warm, still light over the stream and gardens' },
  evening: { label: 'Evening', icon: 'sunset', sound: 'Golden dusk, lamps glowing, the stream still running' },
  night: { label: 'Night', icon: 'moon', sound: 'Moonlight, fireflies and crickets; Auto music turns to meditation' },
};
// music styles offered in the sound panel; the stations themselves come from audio/manifest.json
const MUSIC_STYLES = [
  { id: 'auto', label: 'Auto', sub: 'Uplifting rhythms by day, meditation at night' },
  { id: 'uplifting', label: 'Uplifting', sub: 'Feel-good grooves: tabla, sitar, handpan, warm beats' },
  { id: 'meditation', label: 'Meditation', sub: 'Slow, airy and calm: pads, piano, handpan, singing bowls' },
  { id: 'flute', label: 'Classical flute', sub: 'Solo Carnatic flute, unhurried raga' },
  { id: 'off', label: 'Off', sub: 'Only nature sounds and bells' },
];
const TOD_ICONS = {
  sunrise: '<svg viewBox="0 0 24 24"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 4v4M4.9 9.9l2 2M19.1 9.9l-2 2M8 22h8"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  sunset: '<svg viewBox="0 0 24 24"><path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 9V5M9 7l3 3 3-3M8 22h8"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
function localTOD(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return h >= 5 && h < 10.5 ? 'morning' : h < 16.5 && h >= 10.5 ? 'afternoon' : h >= 16.5 && h < 19.75 ? 'evening' : 'night'; }
function currentTOD() { return settings.tod === 'auto' ? localTOD() : settings.tod; }
let activeTOD = null;
function applyTOD(instant = false) {
  const t = currentTOD(); updateTodChip(t);
  if (t === activeTOD && !instant) return;
  activeTOD = t; world.setTimeOfDay(t, instant); hall.setTimeOfDay(t); audio.setTimeOfDay(t);
}
function setTOD(v) { settings.tod = v; persist(); applyTOD(); applySettingsUI(); renderTodPop(); const i = TOD_INFO[currentTOD()]; toast(`${i.label}${v === 'auto' ? ' (your local time)' : ''}. ${i.sound}.`, 4200); }
function updateTodChip(t = currentTOD()) {
  const i = TOD_INFO[t]; $('todChip').innerHTML = `${TOD_ICONS[i.icon]}<span>${i.label}</span>${settings.tod === 'auto' ? '<span class="tag">auto</span>' : ''}`;
  $('todChip').setAttribute('aria-label', `Time of day: ${i.label}${settings.tod === 'auto' ? ', following your local time' : ''}. Change`);
}
function setMusicStyle(id) {
  settings.musicStyle = id; persist(); startAudioOnce(); audio.setMusicStyle(id); applySettingsUI(); renderSoundPop();
  const st = MUSIC_STYLES.find(s => s.id === id); if (id === 'off') toast('Music off. Only nature sounds and bells.');
  else if (audio.sanctum) toast(`${st.label} music will play when you leave the Shiva hall`);
  else if (!audio.nowPlaying) toast(`${st.label} music`);
}
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderNowPlaying() {
  const np = audio.nowPlaying;
  $('nowPlaying').innerHTML = np ? `<b>${esc(np.title)}</b> · ${esc(np.artist)}` : audio.sanctum ? '<b>Om</b> · chanted in the Shiva hall' : (settings.musicStyle === 'off' ? 'Music is off' : 'Starts when sound is on');
}
function renderSoundPop() {
  const pop = $('soundPop'); if (pop.hidden) return;
  const np = audio.nowPlaying, station = np && MUSIC_STYLES.find(s => s.id === np.station);
  const opt = (s) => `<button data-m="${s.id}" aria-pressed="${settings.musicStyle === s.id}"><span><b>${s.label}</b><small>${s.sub}</small></span></button>`;
  pop.innerHTML = `<h3>Music</h3>` +
    (np ? `<div class="np"><i aria-hidden="true">♪</i><span><b>${esc(np.title)}</b><small>${esc(np.artist)} · ${station ? station.label : ''}</small></span><button id="npNext" aria-label="Next track">Next</button></div>`
      : audio.sanctum ? `<div class="np"><i aria-hidden="true">ॐ</i><span><b>Om</b><small>Chanted in the Shiva hall · your music picks up again outside</small></span></div>` : '') +
    MUSIC_STYLES.map(opt).join('') +
    `<div class="row"><span>Mute everything</span><button class="toggle" id="popMute" role="switch" aria-checked="${settings.muted}" aria-label="Mute everything"></button></div>`;
  pop.querySelectorAll('[data-m]').forEach(b => b.onclick = () => setMusicStyle(b.dataset.m));
  const nx = pop.querySelector('#npNext'); if (nx) nx.onclick = () => audio.skipTrack();
  pop.querySelector('#popMute').onclick = () => { settings.muted = !settings.muted; audio.setMuted(settings.muted); applySettingsUI(); persist(); renderSoundPop(); };
}
function renderTodPop() {
  const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const opt = (v, label, sub, icon) => `<button data-tod="${v}" aria-pressed="${settings.tod === v}"><i>${TOD_ICONS[icon]}</i><span><b>${label}</b><small>${sub}</small></span></button>`;
  $('todPop').innerHTML = `<h3>Time of day</h3>` + opt('auto', 'Match my local time', `${now} here, so ${TOD_INFO[localTOD()].label.toLowerCase()}`, TOD_INFO[localTOD()].icon) +
    Object.entries(TOD_INFO).map(([k, i]) => opt(k, i.label, i.sound, i.icon)).join('');
  $('todPop').querySelectorAll('[data-tod]').forEach(b => b.onclick = () => { setTOD(b.dataset.tod); $('todPop').hidden = true; $('todChip').setAttribute('aria-expanded', 'false'); });
}

function snapCamera() { cam.hallInit = false; cam.target.copy(me.avatar.root.position).add(new THREE.Vector3(0, 0.9, 0)); }
const clamp01 = (x) => Math.max(0, Math.min(1, x));

boot().catch((e) => { console.error(e); const l = $('loadText'); if (l) l.textContent = 'Something went wrong while building the temple: ' + e.message; });
