import { Cloud, CloudFog, CloudLightning, CloudRain, Plus, RotateCcw, RotateCw, Snowflake, Sun, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEFAULT_ENVIRONMENT, PLANNED_ENVIRONMENTS } from '../sim/environments';
import { formatTime, SEASON_LABELS, WEATHER_LABELS } from '../sim/environment';
import { BUILD_CATALOG } from '../sim/objects';
import type { Season, WeatherKind } from '../sim/types';
import { resetWorld, useUI, world } from '../state/store';
import { audio } from '../audio/engine';
import { focusPoint } from '../render/shared';

function Panel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <section className="card panel" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button className="icon-btn ghost" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      {children}
    </section>
  );
}

const WEATHER_ICONS: Record<WeatherKind, ReactNode> = {
  clear: <Sun size={16} />,
  cloudy: <Cloud size={16} />,
  rain: <CloudRain size={16} />,
  storm: <CloudLightning size={16} />,
  fog: <CloudFog size={16} />,
  snow: <Snowflake size={16} />,
};

const TIME_PRESETS: [string, number][] = [
  ['Dawn', 5.8],
  ['Morning', 9],
  ['Noon', 12.5],
  ['Sunset', 20.4],
  ['Night', 22.5],
  ['Midnight', 0.5],
];

export function EnvironmentPanel() {
  useUI((s) => s.tick);
  const ui = useUI();
  const env = world.env;
  const close = () => ui.setPanel('none');
  return (
    <Panel title="Environment" onClose={close}>
      <div className="field">
        <label htmlFor="time">
          Time of day <b>{formatTime(env.time)}</b>
        </label>
        <input id="time" type="range" min={0} max={23.99} step={0.05} value={env.time} onChange={(e) => world.setTime(Number(e.target.value))} />
        <div className="chips">
          {TIME_PRESETS.map(([label, t]) => (
            <button key={label} className="chip small" onClick={() => world.setTime(t)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Simulation speed</span>
        <div className="chips">
          <button className={`chip small ${world.paused ? 'on' : ''}`} onClick={() => ((world.paused = !world.paused), ui.bump())}>
            {world.paused ? 'Paused' : 'Pause'}
          </button>
          {[1, 2, 4, 8].map((s) => (
            <button key={s} className={`chip small ${!world.paused && world.speed === s ? 'on' : ''}`} onClick={() => ((world.speed = s), (world.paused = false), ui.bump())}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Weather</span>
        <div className="chips">
          {(Object.keys(WEATHER_LABELS) as WeatherKind[]).map((w) => (
            <button
              key={w}
              className={`chip small ${env.weather === w && env.lockWeather ? 'on' : ''}`}
              onClick={() => world.setWeather(w, true)}
              disabled={(w === 'snow' && env.season !== 'winter') || ((w === 'rain' || w === 'storm') && env.season === 'winter')}
              title={w === 'snow' && env.season !== 'winter' ? 'Snow needs winter' : WEATHER_LABELS[w]}
            >
              {WEATHER_ICONS[w]} {WEATHER_LABELS[w]}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={!env.lockWeather} onChange={(e) => ((env.lockWeather = !e.target.checked), ui.bump())} />
          <span>Let the weather change naturally</span>
        </label>
      </div>
      <div className="field">
        <span className="label">Season</span>
        <div className="chips">
          {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
            <button key={s} className={`chip small ${env.season === s ? 'on' : ''}`} onClick={() => world.setSeason(s)}>
              {SEASON_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="wind">
          Wind <b>{env.windOverride === null ? 'natural' : `${Math.round(env.windOverride * 100)}%`}</b>
        </label>
        <input
          id="wind"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={env.windOverride ?? env.windStrength}
          onChange={(e) => world.setWind(Number(e.target.value))}
        />
        {env.windOverride !== null && (
          <button className="chip small" onClick={() => world.setWind(null)}>
            Natural wind
          </button>
        )}
      </div>
      <div className="field worlds">
        <span className="label">Worlds</span>
        <div className="world-list">
          <span className="world current">🌲 {DEFAULT_ENVIRONMENT.name}</span>
          {PLANNED_ENVIRONMENTS.map((e) => (
            <span key={e.id} className="world planned" title={e.highlights.join(' · ')}>
              {e.name} <i>soon</i>
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function SettingsPanel() {
  const ui = useUI();
  const p = ui.prefs;
  const set = (patch: Partial<typeof p>) => {
    ui.setPrefs(patch);
    const next = { ...p, ...patch };
    audio.setVolume(next.volume, next.muted, next.ambience);
  };
  return (
    <Panel title="Settings" onClose={() => ui.setPanel('none')}>
      <div className="field">
        <label htmlFor="vol">
          Volume <b>{Math.round(p.volume * 100)}%</b>
        </label>
        <input id="vol" type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => set({ volume: Number(e.target.value) })} />
        <label className="toggle">
          <input type="checkbox" checked={p.muted} onChange={(e) => set({ muted: e.target.checked })} />
          <span>Mute all sound</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={p.ambience} onChange={(e) => set({ ambience: e.target.checked })} />
          <span>Nature ambience (wind, crickets, water, fire)</span>
        </label>
      </div>
      <div className="field">
        <span className="label">Graphics</span>
        <div className="chips">
          <button className={`chip small ${p.quality === 'high' ? 'on' : ''}`} onClick={() => set({ quality: 'high' })}>
            High (reflections, shadows, glow)
          </button>
          <button className={`chip small ${p.quality === 'low' ? 'on' : ''}`} onClick={() => set({ quality: 'low' })}>
            Light
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={p.showNames} onChange={(e) => set({ showNames: e.target.checked })} />
          <span>Show name tags</span>
        </label>
      </div>
      <div className="field">
        <span className="label">Your camper</span>
        <button className="chip" onClick={() => ui.setCreatorOpen(true)}>
          Customize {p.playerName}
        </button>
      </div>
      <div className="field">
        <span className="label">Campsite</span>
        <p className="hint">The campsite saves automatically in this browser.</p>
        <button
          className="chip danger"
          onClick={() => {
            if (window.confirm('Reset the campsite? Furniture, fire, tents and time go back to the start.')) resetWorld();
          }}
        >
          Reset campsite
        </button>
      </div>
    </Panel>
  );
}

export function HelpPanel() {
  const ui = useUI();
  const rows: [string, string][] = [
    ['Drag', 'Rotate the camera'],
    ['Right-drag / Shift-drag', 'Pan the view'],
    ['Scroll / pinch', 'Zoom'],
    ['W A S D', 'Pan (overview) or walk (following your camper)'],
    ['Shift', 'Run while walking'],
    ['Q / E', 'Turn the camera (overview)'],
    ['E', 'Interact with what is nearby (following your camper)'],
    ['C', 'Switch overview / follow camera'],
    ['1 2 3', 'Select a camper'],
    ['Space', 'Pause / resume'],
    ['B', 'Arrange furniture'],
    ['T', 'Time & weather'],
    ['Esc', 'Close / deselect / cancel'],
  ];
  return (
    <Panel title="How to play" onClose={() => ui.setPanel('none')}>
      <p className="hint">
        Watch the campers live their evening, or join in: select your camper (★) and tap the ground to walk, or tap any object to use it.
        Autonomous campers (🍃) fish, cook, tend the fire, explore and sleep on their own.
      </p>
      <dl className="keys">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function BuildPanel() {
  const ui = useUI();
  const placing = ui.placing;
  const moving = placing?.id ? world.obj(placing.id) : undefined;
  const rotate = (d: number) => ui.updatePlacing({ rot: (placing?.rot ?? 0) + d });
  return (
    <Panel
      title="Arrange the campsite"
      onClose={() => {
        ui.setPlacing(null);
        ui.setPanel('none');
      }}
    >
      {placing ? (
        <>
          <p className="hint">
            Move the pointer to position {moving ? `the ${moving.name.toLowerCase()}` : 'it'}, then tap the ground to place it. Green means the spot works.
          </p>
          <div className="row">
            <button className="chip" onClick={() => rotate(-Math.PI / 8)} aria-label="Rotate left">
              <RotateCcw size={15} /> Rotate
            </button>
            <button className="chip" onClick={() => rotate(Math.PI / 8)} aria-label="Rotate right">
              <RotateCw size={15} /> Rotate
            </button>
            <button className="chip" onClick={() => ui.setPlacing(null)}>
              Cancel
            </button>
            {moving?.custom && (
              <button
                className="chip danger"
                onClick={() => {
                  if (world.removeObject(moving.id)) {
                    ui.setPlacing(null);
                    ui.selectObject(null);
                  } else ui.showToast('Someone is using it');
                }}
              >
                <Trash2 size={15} /> Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="hint">Tap a chair, bench, lantern, crate, blanket, telescope or tent to pick it up. Or add something new:</p>
          <div className="catalog">
            {BUILD_CATALOG.map((item) => (
              <button
                key={item.label}
                className="chip"
                onClick={() => ui.setPlacing({ kind: item.kind, init: item.init, rot: 0, x: focusPoint.x, z: focusPoint.z, valid: world.canPlace(item.kind, focusPoint.x, focusPoint.z) })}
              >
                <Plus size={14} /> {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
