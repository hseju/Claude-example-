import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { World, TEMPLES, lerpAngle } from './world.js';
import { PrayerHall, SPOTS, ENTRANCE } from './dome.js';
import { Avatar, defaultConfig, randomConfig, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, OUTFITS, CLOTH_COLORS, PRESENTATIONS, BUILDS, AGES, FACIAL, MARKS, JEWELLERY, HEADWEAR } from './avatar.js';
import { TempleAudio } from './audio.js';
import { HallDirectory, LocalSimulation, HALL_CAPACITY } from './presence.js';
import { ProfileStore, storageAvailable } from './profile.js';
import { PostFX } from './postfx.js';
import { setAnisotropy } from './textures.js';
import { HUT } from './hut.js';
import { BREATHWORK, MEDITATIONS, TIMER, Guide, Session, PracticeLog } from './practice.js';
import { meditatorSVG, MeditatorVisual } from './meditator.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------- settings & quality
const profiles = new ProfileStore();
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = profiles.loadSettings({ quality: 'auto', tod: 'auto', incense: true, reducedMotion: prefersReduced, master: 80, ambience: 70, effects: 85, ceremony: 80, muted: false, musicStyle: 'auto', guideMode: 'guide', voiceURI: '', practiceBg: 'auto', breathTones: true });
const dpr = window.devicePixelRatio || 1;
function qualityPreset(q) {
  if (q === 'auto') q = (isTouch && Math.min(screen.width, screen.height) < 820) ? 'medium' : 'high';
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
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const post = new PostFX(renderer); post.enabled = Q.post;
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 2200);

const audio = new TempleAudio();
audio.levels = { master: settings.master / 100, ambience: settings.ambience / 100, effects: settings.effects / 100, ceremony: settings.ceremony / 100 };
audio.muted = settings.muted;

let world, hall, directory, sim, playerRing;
const app = { mode: 'loading', hallState: null, currentHall: null, templeId: null, camMode: 'world', time: 0 };
const me = { id: null, config: defaultConfig(), avatar: null };
const cam = { close: 0, yaw: 0, pitch: 0.27, dist: 27, tYaw: 0, tPitch: 0.27, tDist: 27, eff: 27, pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 32 };
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
  $('simCount').textContent = world.npcs.length + (world.hutSitters || []).length;
  buildLabels(); buildCreator(); bindUI(); applySettingsUI();
  onResize();
  const restored = storageAvailable ? profiles.restore() : null;
  if (restored && restored.avatar) { me.config = { ...defaultConfig(), ...restored.avatar }; if (me.config.presentation === 'neutral') me.config.presentation = /saree|salwar/.test(me.config.outfit) ? 'fem' : 'masc'; }
  me.avatar = new Avatar(me.config, { shadows: Q.level !== 'low' });
  me.avatar.root.position.set(0, 0, 46.5); me.avatar.root.rotation.y = Math.PI;
  world.scene.add(me.avatar.root);
  playerRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(2.2), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  playerRing.rotation.x = -Math.PI / 2; world.scene.add(playerRing);
  if (/[?&]debug\b/.test(location.search)) window.__vt = { app, me, world, hall, directory, cam, input, settings, audio, preview, refreshCreator, hut: { state: hutState, guide, enter: enterHut, leave: leaveHut, start: startSession, end: endSession } }; // local testing hook
  setMode('welcome');
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
  if (m === 'welcome') {
    const u = profiles.user;
    if (u && u.kind === 'registered') { $('guestBtn').textContent = 'Continue as ' + (u.avatar?.name || 'devotee'); $('signinBtn').textContent = 'Switch profile'; }
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
    b.addEventListener('click', () => { me.config[key] = it.id ?? it; if (key === 'presentation') presetsFor(me.config); refreshCreator(); audio.uiTap(); });
    el.appendChild(b);
  }
}
function presetsFor(c) {
  if (c.presentation === 'fem' && (c.outfit === 'dhoti' || c.outfit === 'kurta')) c.outfit = 'saree';
  if (c.presentation === 'masc' && (c.outfit === 'saree' || c.outfit === 'salwar')) c.outfit = 'kurta';
  if (c.presentation === 'masc' && (c.hair === 'braid' || c.hair === 'bun')) c.hair = 'short';
  if (c.presentation === 'fem') { c.facial = 'none'; if (c.mark === 'tripundra') c.mark = 'bindi'; }
}
function refreshCreator() {
  chipGroup($('cPres'), PRESENTATIONS, 'presentation');
  chipGroup($('cOutfit'), OUTFITS, 'outfit');
  chipGroup($('cColor'), CLOTH_COLORS, 'color', (b, it) => { b.className = 'swatch'; b.style.background = `linear-gradient(135deg, ${it.base} 60%, ${it.accent} 60%)`; b.setAttribute('aria-label', it.id); });
  chipGroup($('cSkin'), SKIN_TONES, 'skin', (b, it) => { b.className = 'swatch'; b.style.background = it; b.setAttribute('aria-label', 'Skin tone'); });
  chipGroup($('cHair'), HAIR_STYLES, 'hair');
  chipGroup($('cHairColor'), HAIR_COLORS, 'hairColor', (b, it) => { b.className = 'swatch'; b.style.background = it; b.setAttribute('aria-label', 'Hair colour'); });
  chipGroup($('cHeadwear'), HEADWEAR, 'headwear');
  chipGroup($('cBuild'), BUILDS, 'build'); chipGroup($('cAge'), AGES, 'age');
  chipGroup($('cFacial'), FACIAL, 'facial'); $('cFacial').hidden = me.config.presentation === 'fem';
  chipGroup($('cMark'), MARKS, 'mark'); chipGroup($('cJewel'), JEWELLERY, 'jewellery');
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
    if (profiles.user && profiles.user.kind === 'registered') { profiles.saveAvatar({ ...me.config }); toast('Avatar saved to your profile'); }
    enterWorld();
  });
}
function openCreator(fromWorld = false) {
  const u = profiles.user;
  $('creatorMode').textContent = u && u.kind === 'registered' ? `Saved to the profile for ${u.email} on this device.` : 'Guest avatar. It will not be saved after you leave.';
  $('creatorDone').textContent = fromWorld ? 'Save and return' : 'Enter the temple';
  $('cName').value = me.config.name || '';
  refreshCreator(); setMode('creator');
  setTimeout(() => !isTouch && $('cName').focus(), 50);
}

// ---------------------------------------------------------------- world entry
let entered = false;
function enterWorld() {
  updateProfileChip();
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
    audio.applyZone({ entrance: 0, courtyard: 0, corridor: 0.2, dome: 1, garden: 0, ganesha: +(h.templeId === 'ganesha'), shiva: +(h.templeId === 'shiva'), krishna: +(h.templeId === 'krishna') }, 1.4);
    snapCamera();
    if (spot >= 0) setTimeout(() => chooseSpot(spot), 600);
  });
}
function chooseSpot(i) {
  const h = app.currentHall;
  if (!directory.claim(h.id, i, { id: me.id, name: me.config.name, simulated: false, config: me.config })) { toast('That place was just taken. Choose another lotus.'); return; }
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
  if (app.pendingAarti) { app.pendingAarti = false; setTimeout(beginAarti, 800); }
  else toast('You are in your place. Choose a prayer below.', 3200);
}
function leaveHall() {
  if (app.aarti) endAarti(true);
  directory.leaveQueue(me.id);
  const back = () => fadeThrough(() => {
    if (app.leftSpot >= 0) hall._extinguish(app.leftSpot); app.leftSpot = -1;
    directory.release(me.id); hall.mySpot = -1; hall.clearOccupants();
    const T = TEMPLES[app.templeId];
    world.scene.add(me.avatar.root);
    const out = T.entrance.clone().add(T.entrance.clone().setY(0).normalize().multiplyScalar(-1.5));
    me.avatar.root.position.copy(out); const away = out.clone().negate(); me.avatar.root.rotation.y = Math.atan2(away.x, away.z); me.avatar.setState('idle');
    cam.tYaw = cam.yaw = Math.atan2(-away.x, -away.z);
    app.currentHall = null; app.hallState = null; input.auto = [];
    $('spotSheet').hidden = true; $('actions').hidden = true; $('fullSheet').hidden = true;
    setMode('world'); app.camMode = 'world'; snapCamera();
  });
  if (app.hallState === 'seated') {
    const s = SPOTS[hall.mySpot], aisle = s.x > 0 ? s.x - 1.5 : s.x + 1.5;
    app.leftSpot = hall.mySpot; directory.release(me.id); hall.mySpot = -1; hall.refreshMarkers();
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
  const sims = directory.simulatedCount(h);
  $('hallNote').textContent = sims ? `${sims} simulated devotee${sims === 1 ? '' : 's'} · multiplayer offline` : 'No one else is here';
  $('occDots').innerHTML = h.spots.map(s => `<i class="${s ? (s.id === me.id ? 'me' : 's') : ''}"></i>`).join('');
}

// ---------------------------------------------------------------- prayer actions
let lastAct = 0;
function act(name) {
  if (app.mode !== 'hall' || app.hallState !== 'seated' || app.aarti) return;
  const now = performance.now(); if (now - lastAct < 350) return; lastAct = now;
  const av = me.avatar, i = hall.mySpot;
  if (name === 'namaste') { av.setState('bow'); setTimeout(() => av.state === 'bow' && av.setState('namaste'), 2500); }
  if (name === 'bell') hall.ringBell(av);
  if (name === 'diya') {
    if (hall.spotState[i].lit) { toast('Your diya is already burning'); return; }
    av.setState('offer'); setTimeout(() => { hall.lightDiya(i); $('aDiya').classList.add('done'); }, 800); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 1800);
  }
  if (name === 'flowers') hall.offerFlowers(av);
  if (name === 'incense') {
    av.setState('offer'); setTimeout(() => { hall.offerIncense(i); $('aIncense').classList.add('done'); }, 700); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 1800);
    if (!settings.incense) toast('Incense offered. Smoke effects are turned off in settings.');
  }
  if (name === 'abhishek' && app.templeId === 'shiva') { av.setState('offer'); hall.abhishek(); setTimeout(() => av.state === 'offer' && av.setState('namaste'), 1800); }
  if (name === 'darshan') { app.camMode = app.camMode === 'darshan' ? 'prayer' : 'darshan'; $('aDarshan').setAttribute('aria-pressed', String(app.camMode === 'darshan')); }
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
function beginAarti() {
  if (app.aarti || app.hallState !== 'seated') return;
  const dur = 60;
  app.aarti = { t: 0, dur };
  document.body.classList.add('ceremony');
  sim.gather(app.currentHall.id, 11);
  hall.startAarti(dur); audio.startAarti(dur);
  hall.onAartiEnd = () => endAarti(false);
  app.camMode = settings.reducedMotion ? 'prayer' : 'aarti';
  $('aartiDeva').textContent = MANTRA[app.templeId];
  $('aartiLine').textContent = `${nextAarti().name.replace(' aarti', '')} aarti preview · ${TEMPLES[app.templeId].name}, hall ${app.currentHall.index}`;
  setTimeout(() => app.aarti && $('aartiCaption').classList.add('on'), 9000);
  setTimeout(() => $('aartiCaption').classList.remove('on'), 22000);
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
  { const el = document.createElement('div'); el.className = 'wlabel'; el.innerHTML = `<i class="ico">${meditatorSVG('lbl', { full: false })}</i><div><b>Meditation</b><em>hut</em><span>Breathwork · guided meditation</span></div>`;
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
    const nm = me.config.name || 'You'; if (labelEls.me.dataset.n !== nm) { labelEls.me.dataset.n = nm; labelEls.me.innerHTML = `<i>${escapeHtml(nm[0].toUpperCase())}</i>${escapeHtml(nm)}`; } project(me.avatar.root.position, labelEls.me, 2.05); if ((cam.close || 0) > 0.55) labelEls.me.style.display = 'none';
    labelEls.sims.forEach(e => (e.style.display = 'none'));
  } else if (app.mode === 'hall') {
    for (const T of Object.values(TEMPLES)) labelEls[T.id].style.display = 'none';
    labelEls.hut.style.display = 'none';
    project(me.avatar.root.position, labelEls.me, 2.0);
    if (app.camMode === 'prayer' || app.camMode === 'darshan' || app.camMode === 'aarti') labelEls.me.style.display = 'none';
    // show a quiet "simulated" tag over other devotees while choosing a place
    const occ = [...hall.occupants.values()];
    while (labelEls.sims.length < occ.length) { const e = document.createElement('div'); e.className = 'nlabel sim'; e.textContent = 'simulated'; $('labels').appendChild(e); labelEls.sims.push(e); }
    labelEls.sims.forEach((e, i) => { if (i < occ.length && app.hallState === 'select') { e.textContent = `${occ[i].config.name} · simulated`; project(occ[i].root.position, e, 1.95); } else e.style.display = 'none'; });
  }
}

// ---------------------------------------------------------------- navigation
const DEST = (id) => TEMPLES[id] || (id === 'hut' ? HUT : null);
function goTo(id) {
  if (app.mode !== 'world') return;
  const D = DEST(id); if (!D) return;
  audio.uiTap();
  input.auto = world.route(me.avatar.root.position, id).slice(1);
  if (input.auto.length === 0 || me.avatar.root.position.distanceTo(D.entrance) < 2) { input.auto = []; if (id === 'hut') enterHut(); else enterTemple(id); return; }
  app.arriveShrine = id;
  $('map').classList.remove('on'); $('mapBtn').setAttribute('aria-pressed', 'false');
  toast(`Walking to the ${D.name.toLowerCase().startsWith('meditation') ? 'meditation hut' : D.name}`, 2000);
}
function nearHut() { return HUT.entrance.distanceTo(me.avatar.root.position) < 2.8; }
function worldPranam() {
  if (app.mode !== 'world') return;
  input.auto = []; const av = me.avatar; av.setState('bow'); app.pranamUntil = app.time + 2.6;
  const T = nearShrine() || Object.values(TEMPLES).sort((a, b) => a.pos.distanceTo(av.root.position) - b.pos.distanceTo(av.root.position))[0];
  const d = T.pos.clone().sub(av.root.position); av.root.rotation.y = Math.atan2(d.x, d.z);
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
      if (k === 'enter') { const T = nearShrine(); if (T) enterTemple(T.id); else if (nearHut()) enterHut(); }
    }
    if (app.mode === 'hall') { const map = { 1: 'namaste', 2: 'bell', 3: 'diya', 4: 'flowers', 5: 'incense', 6: 'abhishek' }; if (map[k]) act(map[k]); }
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
    if (input.drag && (app.mode === 'world' || app.mode === 'welcome')) { cam.tYaw -= dx * 0.006; cam.tPitch = THREE.MathUtils.clamp(cam.tPitch + dy * 0.004, 0.1, 1.25); }
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
function zoom(d) { if (app.mode === 'creator') { preview.dist = THREE.MathUtils.clamp((preview.dist || 4.4) + d * 0.25, 1.1, 5); return; } cam.tDist = THREE.MathUtils.clamp(cam.tDist + d * Math.max(0.25, cam.tDist / 22), 2.4, 44); }
const ray = new THREE.Raycaster(), occRay = new THREE.Raycaster();
function tap(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  if (app.mode === 'world') {
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
  tapMarker.position.copy(p).setY(0.06); tapMarker.userData.t = 0; tapMarker.visible = true;
}

// ---------------------------------------------------------------- UI wiring
function closeAllPanels() { for (const id of ['auth', 'schedule', 'settings', 'todPop', 'soundPop']) $(id).hidden = true; $('map').classList.remove('on'); $('mapBtn').setAttribute('aria-pressed', 'false'); }
function toggleMap() { const on = !$('map').classList.contains('on'); $('map').classList.toggle('on', on); $('mapBtn').setAttribute('aria-pressed', String(on)); }
let authMode = 'signin';
function setAuthMode(m) { authMode = m; $('tabSignin').setAttribute('aria-selected', String(m === 'signin')); $('tabCreate').setAttribute('aria-selected', String(m === 'create')); $('authSubmit').textContent = m === 'signin' ? 'Sign in' : 'Create profile'; $('authPass').autocomplete = m === 'signin' ? 'current-password' : 'new-password'; $('authErr').textContent = ''; }
function startAudioOnce() { if (!audio.ctx) audio.start().then(() => audio.applyZone(audio.zone, 0.5)); else audio.start(); }

function bindUI() {
  bindInput();
  document.addEventListener('pointerdown', startAudioOnce, { capture: true });
  document.addEventListener('keydown', startAudioOnce, { capture: true });
  $('guestBtn').addEventListener('click', () => {
    if (profiles.user && profiles.user.kind === 'registered') { me.avatar.setConfig(me.config); enterWorld(); return; }
    profiles.guest(me.config); openCreator();
  });
  $('signinBtn').addEventListener('click', () => { setAuthMode('signin'); $('auth').hidden = false; if (!storageAvailable) $('authErr').textContent = 'This browser is blocking site storage, so profiles cannot be saved here. You can still continue as a guest.'; });
  $('tabSignin').addEventListener('click', () => setAuthMode('signin'));
  $('tabCreate').addEventListener('click', () => setAuthMode('create'));
  $('authGuest').addEventListener('click', () => { $('auth').hidden = true; if (app.mode === 'world') return; profiles.guest(me.config); openCreator(); });
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('authErr').textContent = '';
    try {
      if (authMode === 'signin') {
        const u = await profiles.signIn($('authEmail').value, $('authPass').value);
        $('auth').hidden = true;
        if (u.avatar) { me.config = { ...u.avatar }; me.avatar.setConfig(me.config); toast(`Welcome back, ${me.config.name}`); enterWorld(); }
        else openCreator();
      } else {
        const wasInWorld = app.mode === 'world';
        const u = await profiles.register($('authEmail').value, $('authPass').value, wasInWorld ? { ...me.config } : null);
        $('auth').hidden = true;
        if (wasInWorld) { toast('Profile created. Your avatar is saved on this device.'); updateProfileChip(); renderAccount(); }
        else { void u; openCreator(); }
      }
    } catch (err) { $('authErr').textContent = err.message; }
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
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
  $('enterBtn').addEventListener('click', () => { const T = nearShrine(); if (T) enterTemple(T.id); else if (nearHut()) enterHut(); });
  bindHut();
  $('pranamBtn').addEventListener('click', worldPranam);
  $('closeBtn').addEventListener('click', () => { const near = cam.tDist < 6; if (!near) cam.farDist = cam.tDist; cam.tDist = near ? (cam.farDist || 27) : 3.2; if (!near) cam.tYaw = me.avatar.root.rotation.y + Math.PI; $('closeBtn').setAttribute('aria-pressed', String(!near)); });
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));
  $('mapCanvas').addEventListener('click', (e) => {
    const r = e.target.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 100 - 50, z = (e.clientY - r.top) / r.height * 100 - 50;
    for (const T of Object.values(TEMPLES)) if (Math.hypot(T.pos.x - x, T.pos.z - z) < 10) return goTo(T.id);
    if (Math.hypot(HUT.pos.x - x, HUT.pos.z - z) < 7) return goTo('hut');
    input.auto = [world.resolve(new THREE.Vector3(x, 0, z), 0.4)]; app.arriveShrine = null;
  });
  // prayer
  $('aNamaste').onclick = () => act('namaste'); $('aBell').onclick = () => act('bell'); $('aDiya').onclick = () => act('diya');
  $('aFlowers').onclick = () => act('flowers'); $('aIncense').onclick = () => act('incense'); $('aAbhishek').onclick = () => act('abhishek');
  $('aDarshan').onclick = () => act('darshan'); $('aAarti').onclick = () => beginAarti();
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
  box.innerHTML = `<div class="setrow"><span><b style="font-weight:600">${escapeHtml(me.config.name || 'Devotee')}</b><br><span class="note">${reg ? 'Profile saved on this device · ' + escapeHtml(u.email) : 'Guest · nothing is saved'}</span></span></div>
    <div class="row"><button class="btn small" id="editAvatar">Edit avatar</button>${reg ? '<button class="btn small ghost" id="signOut">Sign out</button>' : '<button class="btn small" id="saveProfile">Create profile to save</button>'}</div>`;
  $('editAvatar').onclick = () => { $('settings').hidden = true; if (app.mode === 'hall') { toast('Leave the prayer hall to change your avatar'); return; } openCreator(true); };
  if (reg) $('signOut').onclick = () => { profiles.signOut(); profiles.guest(me.config); updateProfileChip(); renderAccount(); toast('Signed out. You are continuing as a guest.'); };
  else $('saveProfile').onclick = () => { $('settings').hidden = true; setAuthMode('create'); $('auth').hidden = false; };
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
  g.fillStyle = 'rgba(246,236,218,.55)'; for (const n of world.npcs) { const p = n.avatar.root.position; g.beginPath(); g.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); g.fill(); }
  const p = me.avatar.root.position, a = me.avatar.root.rotation.y;
  g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-a + Math.PI); g.fillStyle = '#e98a1f'; g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 9); g.lineTo(-9, 9); g.closePath(); g.fill(); g.restore();
}

// ---------------------------------------------------------------- meditation hut
const guide = new Guide();
const hutState = { view: 'vista', session: null, def: null, kind: null, tab: 'breathe', mins: {}, voiceOff: false, paused: false, wake: null, rec: null, ui: {} };
const HUT_ZONE = { entrance: 0, courtyard: 0, corridor: 0, dome: 0.15, garden: 0.9, ganesha: 0, shiva: 0, krishna: 0 };
const VIEW_NAMES = { vista: 'Looking out over the gardens', face: 'Facing your devotee', flame: 'Looking at the lamp' };
function enterHut() {
  if (app.mode !== 'world') return;
  input.auto = []; app.arriveShrine = null; closeAllPanels(); startAudioOnce();
  fadeThrough(() => {
    setMode('hut');
    const av = me.avatar; av.root.position.copy(HUT.seat.pos); av.root.rotation.y = HUT.seat.rotY; av.setState('meditate'); av.breath = null;
    hutState.view = 'vista'; cam.hutSnap = true; if (playerRing) playerRing.visible = false;
    showHutPanel();
    if (audio.ctx) audio.applyZone(HUT_ZONE, 1.2);
  });
}
function leaveHut() {
  if (app.mode !== 'hut') return;
  endSession(true);
  fadeThrough(() => {
    const av = me.avatar; av.setState('idle'); av.breath = null;
    av.root.position.copy(HUT.entrance); av.root.rotation.y = HUT.rot;
    if (playerRing) playerRing.visible = true;
    $('doneCard').hidden = true;
    setMode('world');
    cam.tYaw = cam.yaw = HUT.rot + Math.PI - 0.7; cam.tDist = cam.dist = cam.eff = 10; cam.tPitch = cam.pitch = 0.3; snapCamera();
  });
}
function showHutPanel() {
  $('sessionUI').hidden = true; $('doneCard').hidden = true; $('hutPanel').hidden = false;
  renderHutPanel();
}
function selectHutTab(tab) {
  hutState.tab = tab;
  for (const [id, t] of [['Breathe', 'breathe'], ['Meditate', 'meditate'], ['Sit', 'sit']]) { $('tab' + id).setAttribute('aria-selected', String(t === tab)); $('list' + id).hidden = t !== tab; }
}
function renderHutPanel() {
  const card = (kind, d) => {
    const opts = kind === 'meditation' ? [d.min] : d.minutes, chosen = hutState.mins[d.id] ?? (kind === 'meditation' ? d.min : d.def);
    const pat = kind === 'breath' ? d.pattern.map(p => p[1]).join(' · ') + ' s' : kind === 'meditation' ? `${d.min} min · guided` : 'bells only';
    const mins = kind === 'meditation' ? '' : `<span class="mins" role="group" aria-label="Minutes">${opts.map(m => `<button data-id="${d.id}" data-min="${m}" aria-pressed="${m === chosen}">${m} min</button>`).join('')}</span>`;
    return `<div class="pcard"><div class="h"><b>${d.name}</b><i>${d.tag}</i><span class="pat">${pat}</span></div><p>${d.sub}</p>
      <div class="go">${mins}<button class="btn small primary start" data-start="${kind}:${d.id}">Begin</button></div></div>`;
  };
  $('listBreathe').innerHTML = BREATHWORK.map(d => card('breath', d)).join('');
  $('listMeditate').innerHTML = MEDITATIONS.map(d => card('meditation', d)).join('');
  $('listSit').innerHTML = card('timer', TIMER);
  for (const b of $('hutPanel').querySelectorAll('[data-min]')) b.onclick = () => { hutState.mins[b.dataset.id] = +b.dataset.min; renderHutPanel(); audio.uiTap(); };
  for (const b of $('hutPanel').querySelectorAll('[data-start]')) b.onclick = () => { const [kind, id] = b.dataset.start.split(':'); startSession(kind, id); };
  selectHutTab(hutState.tab);
  $('voiceMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === settings.guideMode)));
  $('bgMode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === settings.practiceBg)));
  $('tTones').setAttribute('aria-checked', String(settings.breathTones));
  renderVoices();
  const st = PracticeLog.summary();
  $('practiceStats').textContent = st.total ? `Today ${st.today} min · this week ${st.week} min in ${st.weekSessions} session${st.weekSessions === 1 ? '' : 's'}${st.streak > 1 ? ` · ${st.streak}-day streak` : ''}` : 'Your practice is kept on this device only.';
}
function renderVoices() {
  const sel = $('voicePick'), vs = guide.voices();
  if (!guide.ok) { sel.innerHTML = '<option>Not available here</option>'; sel.disabled = true; $('voiceTest').disabled = true; $('voiceNote').textContent = 'This browser cannot speak, so captions and breath tones will guide you instead.'; return; }
  const cur = settings.voiceURI && vs.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : vs[0]?.voiceURI;
  const html = vs.length ? vs.slice(0, 24).map(v => `<option value="${escapeHtml(v.voiceURI)}"${v.voiceURI === cur ? ' selected' : ''}>${escapeHtml(v.name.replace(/^(Microsoft|Google)\s+/, ''))} · ${escapeHtml(v.lang)}</option>`).join('') : '<option>Default voice</option>';
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  sel.disabled = !vs.length;
  $('voiceNote').textContent = 'Voices come from your device. Ones marked Natural, Neural or Enhanced, or English (India), usually sound calmest.';
}
function startSession(kind, id) {
  const def = kind === 'breath' ? BREATHWORK.find(d => d.id === id) : kind === 'meditation' ? MEDITATIONS.find(d => d.id === id) : TIMER;
  if (!def) return;
  startAudioOnce(); guide.unlock();
  guide.voiceURI = settings.voiceURI || null; guide.volume = Math.max(0.25, settings.master / 100); guide.muted = settings.muted || hutState.voiceOff;
  guide.onCaption = showCaption;
  const minutes = hutState.mins[def.id] ?? (kind === 'meditation' ? def.min : def.def);
  const recorded = audio.manifest?.guided?.[def.id] || null;
  const S = new Session(kind, def, { minutes, voice: settings.guideMode, tones: settings.breathTones, audio, guide, recorded });
  S.onEnd = finishSession;
  Object.assign(hutState, { session: S, def, kind, paused: false, ui: {} });
  const bg = settings.practiceBg === 'auto' ? (kind === 'breath' ? 'nature' : 'music') : settings.practiceBg;
  audio.setSessionMix({ music: bg === 'music' ? 'meditation' : null, musicLevel: 0.28, ambience: bg === 'silence' ? 0.1 : bg === 'music' ? 0.45 : 0.8 });
  if (recorded) { hutState.rec = new Audio(recorded); hutState.rec.play().catch(() => {}); }
  $('hutPanel').hidden = true; $('doneCard').hidden = true; $('sessionUI').hidden = false;
  $('sTitle').textContent = def.name; $('orb').classList.toggle('calm', kind !== 'breath'); $('orb').hidden = def.view === 'flame'; $('sessionUI').classList.toggle('noorb', def.view === 'flame');
  $('sPause').querySelector('span').textContent = 'Pause'; $('sCaption').textContent = ''; $('sCaption').classList.add('dim');
  if (def.view) { hutState.view = def.view; }
  requestWake();
  S.start();
}
function togglePause() {
  const S = hutState.session; if (!S) return;
  hutState.paused = !hutState.paused;
  if (hutState.paused) { S.pause(); hutState.rec?.pause(); } else { S.resume(); hutState.rec?.play().catch(() => {}); }
  $('sPause').querySelector('span').textContent = hutState.paused ? 'Resume' : 'Pause';
  $('sPause').querySelector('svg').innerHTML = hutState.paused ? '<path d="M8 5l11 7-11 7z"/>' : '<path d="M9 5v14M15 5v14"/>';
  me.avatar.breath = null;
}
function endSession(silent = false) {
  const S = hutState.session; if (!S) return;
  S.stop(); hutState.rec?.pause(); hutState.rec = null;
  if (S.elapsed > 60) PracticeLog.add({ kind: hutState.kind, id: hutState.def.id, minutes: S.elapsed / 60, partial: true });
  hutState.session = null; me.avatar.breath = null; releaseWake();
  audio.clearSessionMix();
  if (hutState.view === 'flame') hutState.view = 'vista';
  if (!silent) showHutPanel();
}
function finishSession() {
  const S = hutState.session, def = hutState.def; if (!S) return;
  PracticeLog.add({ kind: hutState.kind, id: def.id, minutes: S.total / 60 });
  hutState.session = null; hutState.rec = null; me.avatar.breath = null; releaseWake();
  setTimeout(() => { if (!hutState.session) audio.clearSessionMix(); }, 4000);   // let the last bowl ring out
  if (hutState.view === 'flame') hutState.view = 'vista';
  const st = PracticeLog.summary(), mins = Math.round(S.total / 60);
  $('sessionUI').hidden = true; $('doneCard').hidden = false;
  $('doneTitle').textContent = ['Well done', 'Beautifully done', 'Peace be with you'][Math.floor(Math.random() * 3)];
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
function updateSessionUI() {
  const S = hutState.session, u = hutState.ui; if (!S) return;
  const st = S.state;
  if (!hutState.visual) hutState.visual = new MeditatorVisual($('mediWrap'), { reducedMotion: settings.reducedMotion });
  hutState.visual.reduced = settings.reducedMotion;
  hutState.visual.update(hutState.paused ? 0.5 : st.fill, app.time, { hold: st.phase === 'hold' });
  const label = S.kind === 'breath' ? (hutState.paused ? 'Paused' : st.label) : (hutState.paused ? 'Paused' : hutState.def.tag);
  const count = S.kind === 'breath' ? (st.left ? String(st.left) : '') : fmt(S.remaining);
  if (u.label !== label) { u.label = label; $('oPhase').textContent = label; }
  if (u.count !== count) { u.count = count; $('oCount').textContent = count; }
  const left = fmt(S.remaining) + ' left';
  if (u.left !== left) { u.left = left; $('sTime').textContent = left; $('sBar').style.width = (100 * S.elapsed / S.total).toFixed(1) + '%'; }
}
function bindHut() {
  $('mediWrap').innerHTML = meditatorSVG('sess'); $('hutMark').innerHTML = meditatorSVG('hm', { full: false });
  $('doneMark').innerHTML = meditatorSVG('dm'); new MeditatorVisual($('doneMark'), { reducedMotion: true }).update(1, 0);
  $('hutLeave').onclick = leaveHut;
  $('tabBreathe').onclick = () => selectHutTab('breathe'); $('tabMeditate').onclick = () => selectHutTab('meditate'); $('tabSit').onclick = () => selectHutTab('sit');
  $('voiceMode').querySelectorAll('button').forEach(b => b.onclick = () => { settings.guideMode = b.dataset.v; persist(); renderHutPanel(); });
  $('bgMode').querySelectorAll('button').forEach(b => b.onclick = () => { settings.practiceBg = b.dataset.b; persist(); renderHutPanel(); });
  $('tTones').onclick = () => { settings.breathTones = !settings.breathTones; persist(); renderHutPanel(); };
  $('voicePick').onchange = (e) => { settings.voiceURI = e.target.value; persist(); };
  $('voiceTest').onclick = () => { guide.voiceURI = settings.voiceURI || null; guide.volume = Math.max(0.25, settings.master / 100); guide.muted = false; guide.cancel(); guide.say('Breathe in, slowly. And let it go.', { caption: false }); };
  if (guide.ok && 'speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { if (app.mode === 'hut' && !$('hutPanel').hidden) renderVoices(); });
  $('sPause').onclick = togglePause;
  $('sEnd').onclick = () => endSession();
  $('sVoice').onclick = () => { hutState.voiceOff = !hutState.voiceOff; guide.muted = hutState.voiceOff || settings.muted; if (hutState.voiceOff) guide.cancel(); $('sVoice').setAttribute('aria-pressed', String(hutState.voiceOff)); $('sVoice').setAttribute('aria-label', hutState.voiceOff ? 'Turn the voice back on' : 'Mute the voice'); toast(hutState.voiceOff ? 'Voice off; captions and tones continue' : 'Voice on', 2000); };
  $('hutView').onclick = () => {
    const order = ['vista', 'face'].concat(hutState.def?.view === 'flame' && hutState.session ? ['flame'] : []);
    hutState.view = order[(order.indexOf(hutState.view) + 1) % order.length]; toast(VIEW_NAMES[hutState.view], 1600);
  };
  $('doneAgain').onclick = () => { const [k, id] = hutState.again || []; if (k) startSession(k, id); };
  $('doneMore').onclick = showHutPanel;
  $('doneLeave').onclick = leaveHut;
}
function updateHut(dt, t, ctx) {
  const av = me.avatar, S = hutState.session;
  if (S && !hutState.paused) { S.update(dt); const breathing = S.kind === 'breath' && S.state.phase !== 'intro' && S.state.phase !== 'close'; av.breath = breathing ? S.state.fill : null; av.mudra = breathing && hutState.def.id === 'nadi' ? 'nadi' : null; }
  else if (!S) av.mudra = null;
  if (S) updateSessionUI();
  av.update(dt, t);
  const V = HUT.views[hutState.view] || HUT.views.vista, drift = settings.reducedMotion ? 0 : Math.sin(t * 0.06) * 0.16;
  const want = HUT.toWorld(V.pos[0] + drift, V.pos[1] + (settings.reducedMotion ? 0 : Math.sin(t * 0.045) * 0.04), V.pos[2]), look = HUT.toWorld(...V.look);
  const k = cam.hutSnap ? 1 : 1 - Math.exp(-dt * 1.4); cam.hutSnap = false;
  camera.position.lerp(want, k); cam.target.lerp(look, k); camera.lookAt(cam.target);
  const fov = hutState.view === 'flame' ? 34 : hutState.view === 'face' ? 38 : 50; camera.fov += (fov - camera.fov) * k;
  world.update(dt, t, av.root.position, ctx);
  if (world.hutSmoke) world.hutSmoke.enabled = settings.incense;
  if (audio.ctx) { if (Math.floor(t) !== app.hutTick) { app.hutTick = Math.floor(t); audio.applyZone(HUT_ZONE, 1); } audio.setListener(av.root.position.clone().setY(av.root.position.y + 0.95), HUT.toWorld(0, 0, 1).sub(HUT.pos).normalize()); }
  camera.updateProjectionMatrix();
  post.tilt.amount = 0; renderer.toneMappingExposure = world.tod.exposure;
  post.finalMat.uniforms.uVignette.value = S ? 0.55 : 0.42; post.finalMat.uniforms.uWarm.value = 0.16 + world.evening * 0.2; post.bloom.strength = Q.bloom; post.bloom.threshold = 1.4;
  post.render(world.scene, camera);
}

// ---------------------------------------------------------------- per-frame
let last = 0, stepIdx = 0;
const tmp = new THREE.Vector3();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; app.time += dt; const t = app.time;
  const ctx = { reducedMotion: settings.reducedMotion, incense: settings.incense, player: me.avatar };
  if (app.mode === 'creator') {
    preview.avatar.update(dt, t); if (!input.drag) preview.avatar.root.rotation.y += dt * (settings.reducedMotion ? 0 : 0.35);
    const narrow = innerWidth < 720;
    camera.fov = 30;
    const pd = preview.dist || 4.4, zk = THREE.MathUtils.clamp((4.4 - pd) / 3.3, 0, 1), lookY = 0.92 + zk * 0.7;
    if (narrow) { camera.position.set(0, 1.4 + zk * 0.25, 8 * pd / 4.4); camera.lookAt(0, -0.2 + zk * 1.55, 0); } else { camera.position.set(0.95 * pd / 4.4, 1.25 + zk * 0.35, pd); camera.lookAt(0.95 * pd / 4.4, lookY, 0); }
    camera.updateProjectionMatrix(); post.tilt.amount = 0; post.bloom.strength = 0; post.finalMat.uniforms.uVignette.value = 0.5; post.render(preview.scene, camera); return;
  }
  if (app.mode === 'hall') { updateHall(dt, t, ctx); positionLabels(); return; }
  if (app.mode === 'hut') { updateHut(dt, t, ctx); return; }
  updateWorld(dt, t, ctx);
  positionLabels();
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
      if (dist < 0.35) { input.auto.shift(); if (!input.auto.length && app.arriveShrine) { const id = app.arriveShrine; app.arriveShrine = null; const T = DEST(id); const dir = T.pos.clone().sub(p); av.root.rotation.y = Math.atan2(dir.x, dir.z); } }
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
    } else if (nearHut() && $('fullSheet').hidden) {
      $('promptTitle').textContent = 'Meditation hut'; $('promptSub').textContent = 'Dhyana Kutir · breathwork and short guided meditations';
      $('enterBtn').textContent = 'Enter hut'; $('prompt').classList.add('on');
    } else $('prompt').classList.remove('on');
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
    audio.setListener(p.clone().setY(1.6), fwd);
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
    cam.yaw += (cam.tYaw - cam.yaw) * lerp; cam.pitch += (cam.tPitch - cam.pitch) * lerp; cam.dist += (cam.tDist - cam.dist) * lerp;
    cam.close = clamp01((10 - cam.dist) / 7);
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const focus = p.clone().add(new THREE.Vector3(0, 1.5 - cam.close * 0.05, 0)).addScaledVector(right, cam.close * 0.32);
    cam.target.lerp(focus, 1 - Math.exp(-dt * 8));
    // portrait screens get a little more distance; temples and the gateway pull the camera in rather than hide you
    let want = cam.dist * (camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.6 * (1 - cam.close) : 1);
    // inside the walls, keep the camera inside too, so the gateway never fills the foreground
    const cz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
    if (p.z < 39.5 && cz > 0.05) want = Math.max(Math.min(9, want), Math.min(want, (38.5 - cam.target.z) / cz));
    const dirAt = (pitch, out) => out.set(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
    // first try lifting the camera over the obstacle, then pull it closer as a last resort
    const basePitch = cam.pitch + (0.14 - cam.pitch) * cam.close;
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
    camera.position.copy(cam.target).addScaledVector(dir, cam.eff);
    camera.lookAt(cam.target); camera.fov = 52 - cam.close * 8;
    world.update(dt, t, p, ctx);
    if (playerRing) { playerRing.position.set(p.x, 0.06, p.z); const k = settings.reducedMotion ? 1 : 1 + Math.sin(t * 2.4) * 0.06; playerRing.scale.set(k, k, k); playerRing.material.opacity = 0.85 * (1 - cam.close * 0.8); }
  }
  camera.updateProjectionMatrix();
  post.tilt.amount = Q.tilt * (app.mode === 'welcome' ? 0.15 : 0.22 * (1 - (cam.close || 0))); post.tilt.focus = 0.4; post.tilt.band = 0.32; renderer.toneMappingExposure = world.tod.exposure;
  post.finalMat.uniforms.uVignette.value = 0.34; post.finalMat.uniforms.uWarm.value = 0.12 + world.evening * 0.2; post.bloom.strength = Q.bloom; post.bloom.threshold = 1.5;
  post.render(world.scene, camera);
}

function updateHall(dt, t, ctx) {
  const av = me.avatar, p = av.root.position;
  if (input.auto.length) {
    const tgt = input.auto[0]; const d = new THREE.Vector3(tgt.x - p.x, 0, tgt.z - p.z); const dist = d.length();
    if (dist < 0.08) { input.auto.shift(); if (!input.auto.length) { if (app.hallState === 'walking') seated(); else if (app.hallState === 'leaving' && app.onArrive) { const f = app.onArrive; app.onArrive = null; f(); } } }
    else { d.normalize(); const step = Math.min(dist, 1.5 * dt); p.addScaledVector(d, step); av.speed = 1.5; av.setState('walk'); av.root.rotation.y = lerpAngle(av.root.rotation.y, Math.atan2(d.x, d.z), 1 - Math.exp(-dt * 10)); }
  }
  if (app.hallState === 'seated') av.root.rotation.y = lerpAngle(av.root.rotation.y, Math.PI, 1 - Math.exp(-dt * 6));
  av.update(dt, t); footsteps(av);
  hall.update(dt, t, ctx);
  if (app.aarti) { app.aarti.t += dt; }
  const want = hall.cameraFor(app.camMode, t, p);
  const k = 1 - Math.exp(-dt * (settings.reducedMotion ? 10 : app.camMode === 'aarti' ? 1.2 : 2.4));
  if (!cam.hallInit) { camera.position.copy(want.pos); cam.target.copy(want.target); camera.fov = want.fov; cam.hallInit = true; }
  camera.position.lerp(want.pos, k); cam.target.lerp(want.target, k);
  const wantFov = camera.aspect < 1 ? Math.min(82, want.fov * (1 + (1 - camera.aspect) * 0.75)) : want.fov; camera.fov += (wantFov - camera.fov) * k;
  camera.lookAt(cam.target); camera.updateProjectionMatrix();
  if (audio.ctx) audio.setListener(camera.position, tmp.copy(cam.target).sub(camera.position).normalize());
  post.tilt.amount = app.camMode === 'select' ? 0.6 : 0.5; post.tilt.band = app.camMode === 'select' ? 0.3 : 0.34; post.tilt.focus = 0.5;
  if (!Q.post) post.tilt.amount = 0;
  post.bloom.strength = Q.bloom * 1.2; post.bloom.threshold = 1.2;
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
  else if (!audio.nowPlaying) toast(`${st.label} music`);
}
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderNowPlaying() {
  const np = audio.nowPlaying;
  $('nowPlaying').innerHTML = np ? `<b>${esc(np.title)}</b> · ${esc(np.artist)}` : (settings.musicStyle === 'off' ? 'Music is off' : 'Starts when sound is on');
}
function renderSoundPop() {
  const pop = $('soundPop'); if (pop.hidden) return;
  const np = audio.nowPlaying, station = np && MUSIC_STYLES.find(s => s.id === np.station);
  const opt = (s) => `<button data-m="${s.id}" aria-pressed="${settings.musicStyle === s.id}"><span><b>${s.label}</b><small>${s.sub}</small></span></button>`;
  pop.innerHTML = `<h3>Music</h3>` +
    (np ? `<div class="np"><i aria-hidden="true">♪</i><span><b>${esc(np.title)}</b><small>${esc(np.artist)} · ${station ? station.label : ''}</small></span><button id="npNext" aria-label="Next track">Next</button></div>` : '') +
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
