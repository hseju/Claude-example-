import { clamp, damp, noise2, smoothstep, type Rng } from './math';
import type { EnvState, Season, WeatherKind, WeatherMix } from './types';

/** Game minutes that pass per simulated second at 1x speed. */
export const GAME_MINUTES_PER_SECOND = 1;

export const toGameHours = (simSeconds: number) => (simSeconds * GAME_MINUTES_PER_SECOND) / 60;

export const WEATHER_TARGETS: Record<WeatherKind, WeatherMix> = {
  clear: { cloud: 0.08, rain: 0, snow: 0, fog: 0.05, storm: 0 },
  cloudy: { cloud: 0.75, rain: 0, snow: 0, fog: 0.12, storm: 0 },
  rain: { cloud: 0.92, rain: 0.7, snow: 0, fog: 0.3, storm: 0 },
  storm: { cloud: 1, rain: 1, snow: 0, fog: 0.35, storm: 1 },
  fog: { cloud: 0.35, rain: 0, snow: 0, fog: 1, storm: 0 },
  snow: { cloud: 0.85, rain: 0, snow: 0.8, fog: 0.25, storm: 0 },
};

const WIND_BASE: Record<WeatherKind, number> = {
  clear: 0.22,
  cloudy: 0.38,
  rain: 0.5,
  storm: 0.95,
  fog: 0.08,
  snow: 0.32,
};

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  storm: 'Thunderstorm',
  fog: 'Misty',
  snow: 'Snow',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

/** Weighted natural weather transitions per season. */
const TRANSITIONS: Record<Season, Partial<Record<WeatherKind, number>>> = {
  spring: { clear: 4, cloudy: 3, rain: 2, fog: 1 },
  summer: { clear: 6, cloudy: 2, rain: 1, storm: 0.6, fog: 0.4 },
  autumn: { clear: 3, cloudy: 3, rain: 2, fog: 2 },
  winter: { clear: 3, cloudy: 3, snow: 3, fog: 1 },
};

const SEASON_TEMP: Record<Season, number> = { spring: 12, summer: 19, autumn: 9, winter: -3 };

/** Air temperature the weather is heading toward. */
export function seasonTemperature(env: EnvState): number {
  const diurnal = Math.cos(((env.time - 15) / 24) * Math.PI * 2) * 5;
  return SEASON_TEMP[env.season] + diurnal - env.mix.rain * 3 - env.windStrength * 2 - env.mix.snow * 2;
}

/** Sunrise and sunset hours per season. */
export const DAYLIGHT: Record<Season, [number, number]> = {
  spring: [6.2, 19.8],
  summer: [5.4, 20.9],
  autumn: [6.9, 18.6],
  winter: [7.8, 16.6],
};

export function createEnv(time: number, season: Season, weather: WeatherKind): EnvState {
  const mix = { ...WEATHER_TARGETS[adaptWeather(weather, season)] };
  return {
    time,
    day: 1,
    season,
    weather: adaptWeather(weather, season),
    mix,
    windStrength: WIND_BASE[weather],
    windDir: 0.8,
    gust: 0,
    temperature: SEASON_TEMP[season],
    lockWeather: false,
    windOverride: null,
    nextWeatherChange: 150,
    lightning: 0,
    snowCover: season === 'winter' ? 0.85 : 0,
    wetness: 0,
  };
}

/** Rain turns to snow in winter and snow to rain otherwise. */
export function adaptWeather(w: WeatherKind, season: Season): WeatherKind {
  if (season === 'winter' && (w === 'rain' || w === 'storm')) return 'snow';
  if (season !== 'winter' && w === 'snow') return 'rain';
  return w;
}

/** Sun elevation in [-1, 1]: 0 at sunrise/sunset, 1 at solar noon. */
export function sunHeight(time: number, season: Season): number {
  const [rise, set] = DAYLIGHT[season];
  const noon = (rise + set) / 2;
  const half = (set - rise) / 2;
  let d = time - noon;
  if (d > 12) d -= 24;
  if (d < -12) d += 24;
  if (Math.abs(d) <= half) return Math.cos((d / half) * (Math.PI / 2));
  // Below the horizon: reach -1 at solar midnight.
  const nightHalf = 12 - half;
  const dn = Math.abs(d) - half;
  return -Math.sin((dn / nightHalf) * (Math.PI / 2));
}

/** 0 = full night, 1 = full day, with soft twilight. */
export function daylight(env: EnvState): number {
  return smoothstep(-0.18, 0.25, sunHeight(env.time, env.season));
}

export const isNight = (env: EnvState) => daylight(env) < 0.2;

export function stepEnvironment(env: EnvState, dt: number, rng: Rng, simTime: number, onThunder: (delay: number) => void): void {
  const hours = toGameHours(dt);
  env.time += hours;
  if (env.time >= 24) {
    env.time -= 24;
    env.day += 1;
  }

  // Natural weather changes.
  env.nextWeatherChange -= dt * GAME_MINUTES_PER_SECOND;
  if (!env.lockWeather && env.nextWeatherChange <= 0) {
    env.weather = pickWeather(env.season, env.weather, rng);
    // Showers pass quicker than fair weather.
    env.nextWeatherChange = env.weather === 'rain' || env.weather === 'storm' ? rng.range(35, 100) : rng.range(90, 260);
  }

  const target = WEATHER_TARGETS[env.weather];
  const k = 0.22;
  env.mix.cloud = damp(env.mix.cloud, target.cloud, k, dt);
  env.mix.rain = damp(env.mix.rain, target.rain, k, dt);
  env.mix.snow = damp(env.mix.snow, target.snow, k, dt);
  env.mix.fog = damp(env.mix.fog, target.fog, k * 0.6, dt);
  env.mix.storm = damp(env.mix.storm, target.storm, k, dt);

  // Wind: base for the weather plus slow gusts.
  const base = env.windOverride ?? WIND_BASE[env.weather];
  const gustNoise = noise2(simTime * 0.13, 4.2) * 0.5 + noise2(simTime * 0.47, 9.1) * 0.25;
  env.gust = clamp(gustNoise + 0.5, 0, 1);
  env.windStrength = damp(env.windStrength, clamp(base * (0.7 + 0.6 * env.gust)), 0.6, dt);
  env.windDir += noise2(simTime * 0.02, 1.3) * 0.02 * dt;

  env.temperature = damp(env.temperature, seasonTemperature(env), 0.1, dt);

  // Ground cover.
  const snowTarget = env.season === 'winter' ? Math.max(0.8, env.mix.snow) : env.mix.snow > 0.3 ? 0.5 : 0;
  env.snowCover = damp(env.snowCover, snowTarget, 0.05, dt);
  env.wetness = damp(env.wetness, env.mix.rain > 0.15 ? 1 : 0, env.mix.rain > 0.15 ? 0.15 : 0.02, dt);

  // Lightning.
  env.lightning = Math.max(0, env.lightning - dt * 3.5);
  if (env.mix.storm > 0.5 && rng.chance(dt * 0.06 * env.mix.storm)) {
    env.lightning = 1;
    onThunder(rng.range(0.4, 2.2));
  }
}

function pickWeather(season: Season, current: WeatherKind, rng: Rng): WeatherKind {
  const table = TRANSITIONS[season];
  const entries = Object.entries(table) as [WeatherKind, number][];
  // Prefer change, but allow the same weather to continue.
  const weights = entries.map(([w, p]) => (w === current ? p * 0.6 : p));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entries[i][0];
  }
  return entries[0][0];
}

export function formatTime(time: number): string {
  const h = Math.floor(time) % 24;
  const m = Math.floor((time - Math.floor(time)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeOfDayLabel(time: number, season: Season): string {
  const [rise, set] = DAYLIGHT[season];
  if (time >= rise - 0.6 && time < rise + 1) return 'Dawn';
  if (time >= rise + 1 && time < 11.5) return 'Morning';
  if (time >= 11.5 && time < 14) return 'Midday';
  if (time >= 14 && time < set - 1) return 'Afternoon';
  if (time >= set - 1 && time < set + 0.8) return 'Dusk';
  return 'Night';
}
