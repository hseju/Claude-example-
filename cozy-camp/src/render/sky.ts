import * as THREE from 'three';
import { DAYLIGHT, sunHeight } from '../sim/environment';
import { clamp, lerp, smoothstep } from '../sim/math';
import type { EnvState } from '../sim/types';

export interface SkyState {
  top: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  lightColor: THREE.Color;
  lightIntensity: number;
  lightDir: THREE.Vector3;
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  sunGlow: number;
  moonGlow: number;
  starVis: number;
  fogDensity: number;
  night: number;
  exposure: number;
}

interface Key {
  h: number;
  top: string;
  horizon: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
}

// Sky colour keyframes by sun height (-1 midnight … 1 noon).
const KEYS: Key[] = [
  { h: -1.0, top: '#070b1f', horizon: '#18234a', hemiSky: '#3a4f8f', hemiGround: '#1a1f2c', hemi: 0.95 },
  { h: -0.3, top: '#0a1130', horizon: '#1f2b58', hemiSky: '#3d5294', hemiGround: '#1b2130', hemi: 0.95 },
  { h: -0.12, top: '#131c45', horizon: '#47406f', hemiSky: '#4b5596', hemiGround: '#221f2c', hemi: 0.95 },
  { h: 0.0, top: '#2a3a72', horizon: '#e8835c', hemiSky: '#8a7fb0', hemiGround: '#3a2a26', hemi: 0.85 },
  { h: 0.15, top: '#4f7fc4', horizon: '#f5bd86', hemiSky: '#b9c4e0', hemiGround: '#5a4a38', hemi: 0.9 },
  { h: 0.45, top: '#3f86dc', horizon: '#b8dcf3', hemiSky: '#cfe3f7', hemiGround: '#66704e', hemi: 1.0 },
  { h: 1.0, top: '#3a80d8', horizon: '#c4e3f6', hemiSky: '#d8eaf9', hemiGround: '#6b7550', hemi: 1.05 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function sample(h: number, field: 'top' | 'horizon' | 'hemiSky' | 'hemiGround', out: THREE.Color): THREE.Color {
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h));
  return out.copy(tmpA.set(a[field])).lerp(tmpB.set(b[field]), t);
}

function sampleHemi(h: number): number {
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  return lerp(a.hemi, b.hemi, clamp((h - a.h) / (b.h - a.h)));
}

const GREY_DAY = new THREE.Color('#8b95a3');
const GREY_NIGHT = new THREE.Color('#151924');
const FOG_DAY = new THREE.Color('#aeb8c2');
const FOG_NIGHT = new THREE.Color('#1c2236');

export function createSkyState(): SkyState {
  return {
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    fog: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    lightColor: new THREE.Color(),
    lightIntensity: 1,
    lightDir: new THREE.Vector3(),
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    sunGlow: 0,
    moonGlow: 0,
    starVis: 0,
    fogDensity: 0.01,
    night: 0,
    exposure: 1,
  };
}

/** Compute sky colours and celestial lighting for the current environment. */
export function computeSky(env: EnvState, out: SkyState): SkyState {
  const h = sunHeight(env.time, env.season);
  const [rise, set] = DAYLIGHT[env.season];
  const dayFrac = clamp((env.time - rise) / (set - rise));
  // Sun travels east → south → west.
  const az = lerp(-1.9, 1.9, dayFrac);
  const el = Math.asin(clamp(h)) * 0.95;
  out.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el) * 0.6 + 0.4).normalize();
  // The moon rides high through the night so campers stay softly lit.
  const nightT = ((env.time - set + 24) % 24) / (24 - (set - rise));
  const maz = lerp(-1.6, 1.6, clamp(nightT));
  const mel = 0.55 + Math.sin(clamp(nightT) * Math.PI) * 0.45;
  out.moonDir.set(Math.sin(maz) * Math.cos(mel) * 0.8 - 0.25, Math.sin(mel), -Math.cos(maz) * Math.cos(mel) - 0.35).normalize();

  sample(h, 'top', out.top);
  sample(h, 'horizon', out.horizon);
  sample(h, 'hemiSky', out.hemiSky);
  sample(h, 'hemiGround', out.hemiGround);
  out.hemiIntensity = sampleHemi(h);

  const day = smoothstep(-0.15, 0.3, h);
  out.night = 1 - day;
  const cloud = env.mix.cloud;
  const overcast = clamp(cloud * 0.85 + env.mix.rain * 0.2 + env.mix.storm * 0.2);
  const grey = tmpA.copy(GREY_NIGHT).lerp(GREY_DAY, day);
  out.top.lerp(grey, overcast * 0.75);
  out.horizon.lerp(grey, overcast * 0.6);
  out.hemiSky.lerp(grey, overcast * 0.5);

  // Fog colour follows the horizon, greyer in mist.
  out.fog.copy(out.horizon).lerp(tmpB.copy(FOG_NIGHT).lerp(FOG_DAY, day), 0.35 + env.mix.fog * 0.4);
  out.fogDensity = 0.006 + env.mix.fog * 0.03 + env.mix.rain * 0.006 + env.mix.snow * 0.01;

  const sunI = smoothstep(-0.06, 0.2, h) * (2.6 - overcast * 1.9);
  const moonI = smoothstep(0.02, -0.2, h) * (0.85 - overcast * 0.55);
  if (sunI >= moonI) {
    out.lightDir.copy(out.sunDir);
    out.lightColor.set(h < 0.25 ? '#ffb27a' : '#fff1d6').lerp(tmpA.set('#ffe8c8'), smoothstep(0.1, 0.5, h));
    out.lightIntensity = sunI;
  } else {
    out.lightDir.copy(out.moonDir);
    out.lightColor.set('#a9bdff');
    out.lightIntensity = moonI;
  }
  if (out.lightDir.y < 0.12) out.lightDir.y = 0.12;
  out.lightDir.normalize();

  out.sunGlow = smoothstep(-0.12, 0.05, h) * (1 - overcast);
  out.moonGlow = smoothstep(0.1, -0.15, h) * (1 - overcast * 0.9);
  out.starVis = smoothstep(0.02, -0.22, h) * (1 - clamp(cloud * 1.15)) * (1 - env.mix.fog * 0.7);
  out.hemiIntensity *= 1 - overcast * 0.25;

  // Lightning flash.
  if (env.lightning > 0) {
    const f = env.lightning;
    out.hemiIntensity += f * 2.5;
    out.hemiSky.lerp(tmpA.set('#dfe6ff'), f * 0.8);
    out.top.lerp(tmpA.set('#6f7aa8'), f * 0.6);
  }
  out.exposure = lerp(1.0, 1.25, out.night);
  return out;
}
