import {
  CircleHelp,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Eye,
  Hammer,
  Moon,
  Pause,
  Play,
  Settings,
  Snowflake,
  Sun,
  SunMedium,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ACTIVITIES, objectActions } from '../sim/activities';
import { daylight, formatTime, SEASON_LABELS, timeOfDayLabel, WEATHER_LABELS } from '../sim/environment';
import type { Character, WeatherKind } from '../sim/types';
import { useUI, world } from '../state/store';
import { audio } from '../audio/engine';
import { joystick } from '../render/CameraRig';
import { AvatarCard, ObjectCard, startPlayerActivity } from './Cards';
import { BuildPanel, EnvironmentPanel, HelpPanel, SettingsPanel } from './Panels';

const WEATHER_ICON: Record<WeatherKind, ReactNode> = {
  clear: <Sun size={16} />,
  cloudy: <Cloud size={16} />,
  rain: <CloudRain size={16} />,
  storm: <CloudLightning size={16} />,
  fog: <CloudFog size={16} />,
  snow: <Snowflake size={16} />,
};

function Clock() {
  useUI((s) => s.tick);
  const ui = useUI();
  const env = world.env;
  const night = daylight(env) < 0.3;
  const weather = env.weather;
  return (
    <button className="card clock" onClick={() => ui.setPanel('environment')} aria-label="Time and weather">
      <span className="clock-icon" aria-hidden>
        {night ? <Moon size={22} /> : <SunMedium size={22} />}
      </span>
      <span className="clock-main">
        <b>{formatTime(env.time)}</b>
        <small>
          {timeOfDayLabel(env.time, env.season)} · Day {env.day}
        </small>
      </span>
      <span className="clock-weather">
        {WEATHER_ICON[weather]}
        <small>
          {WEATHER_LABELS[weather]} · {Math.round(env.temperature)}°C
        </small>
        <small>{SEASON_LABELS[env.season]}</small>
      </span>
      {world.paused && <span className="paused-badge">Paused</span>}
    </button>
  );
}

function ToolButton({ label, onClick, active, children, shortcut }: { label: string; onClick: () => void; active?: boolean; children: ReactNode; shortcut?: string }) {
  return (
    <button className={`icon-btn ${active ? 'on' : ''}`} onClick={onClick} aria-label={label} aria-pressed={active} title={shortcut ? `${label} (${shortcut})` : label}>
      {children}
    </button>
  );
}

function Toolbar() {
  useUI((s) => s.tick);
  const ui = useUI();
  const follow = ui.cameraMode === 'follow';
  const muted = ui.prefs.muted;
  return (
    <nav className="toolbar card" aria-label="Controls">
      <ToolButton
        label={follow ? 'Overview camera' : 'Follow camera'}
        shortcut="C"
        active={follow}
        onClick={() => ui.setCameraMode(follow ? 'overview' : 'follow', ui.selectedChar ?? ui.followId)}
      >
        {follow ? <Video size={19} /> : <Eye size={19} />}
      </ToolButton>
      <ToolButton label="Arrange furniture" shortcut="B" active={ui.panel === 'build'} onClick={() => ui.setPanel('build')}>
        <Hammer size={19} />
      </ToolButton>
      <ToolButton label="Time & weather" shortcut="T" active={ui.panel === 'environment'} onClick={() => ui.setPanel('environment')}>
        <SunMedium size={19} />
      </ToolButton>
      <ToolButton label={world.paused ? 'Resume' : 'Pause'} shortcut="Space" active={world.paused} onClick={() => ((world.paused = !world.paused), ui.bump())}>
        {world.paused ? <Play size={19} /> : <Pause size={19} />}
      </ToolButton>
      <button
        className="icon-btn speed"
        title="Simulation speed"
        aria-label={`Speed ${world.speed}x`}
        onClick={() => {
          const speeds = [1, 2, 4, 8];
          world.speed = speeds[(speeds.indexOf(world.speed) + 1) % speeds.length];
          ui.bump();
        }}
      >
        {world.speed}×
      </button>
      <ToolButton
        label={muted ? 'Unmute' : 'Mute'}
        active={muted}
        onClick={() => {
          ui.setPrefs({ muted: !muted });
          audio.start();
          audio.setVolume(ui.prefs.volume, !muted, ui.prefs.ambience);
        }}
      >
        {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </ToolButton>
      <ToolButton label="Settings" active={ui.panel === 'settings'} onClick={() => ui.setPanel('settings')}>
        <Settings size={19} />
      </ToolButton>
      <ToolButton label="How to play" shortcut="H" active={ui.panel === 'help'} onClick={() => ui.setPanel('help')}>
        <CircleHelp size={19} />
      </ToolButton>
    </nav>
  );
}

function initials(ch: Character) {
  return ch.name.slice(0, 1).toUpperCase();
}

function Dock() {
  useUI((s) => s.tick);
  const ui = useUI();
  return (
    <div className="dock" role="list" aria-label="Campers">
      {world.characters.map((ch, i) => {
        const selected = ui.selectedChar === ch.id;
        const following = ui.cameraMode === 'follow' && ui.followId === ch.id;
        return (
          <button
            key={ch.id}
            role="listitem"
            className={`camper card ${selected ? 'selected' : ''} ${ch.controller}`}
            onClick={() => {
              ui.selectChar(ch.id);
              if (ui.cameraMode === 'follow') ui.setCameraMode('follow', ch.id);
              else ui.focusOn(ch.x, ch.z);
            }}
            onDoubleClick={() => ui.setCameraMode('follow', ch.id)}
            title={`${ch.name} (${i + 1})`}
          >
            <span className="portrait" style={{ background: ch.appearance.top }}>
              <span style={{ color: ch.appearance.skin }}>{initials(ch)}</span>
              <i className="badge" aria-hidden>
                {ch.controller === 'player' ? '★' : '🍃'}
              </i>
            </span>
            <span className="camper-text">
              <b>
                {ch.name}
                {following && <Video size={12} className="following" />}
              </b>
              <small>
                <span aria-hidden>{ch.activity?.icon ?? (ch.moving ? '👣' : '🌿')}</span> {ch.status}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EventFeed() {
  const tick = useUI((s) => s.tick);
  const [items, setItems] = useState<{ id: number; icon: string; text: string; seen: number }[]>([]);
  const lastId = useRef(world.events[world.events.length - 1]?.id ?? 0);
  useEffect(() => {
    const fresh = world.events.filter((e) => e.id > lastId.current);
    const now = performance.now();
    if (fresh.length) {
      lastId.current = fresh[fresh.length - 1].id;
      setItems((cur) => [...cur, ...fresh.map((e) => ({ id: e.id, icon: e.icon, text: e.text, seen: now }))].slice(-3));
    } else if (items.some((i) => now - i.seen > 7000)) {
      setItems((cur) => cur.filter((i) => now - i.seen <= 7000));
    }
  }, [tick, items]);
  return (
    <div className="feed" aria-live="polite">
      {items.map((e) => (
        <div key={e.id} className="feed-item">
          <span aria-hidden>{e.icon}</span> {e.text}
        </div>
      ))}
    </div>
  );
}

function Toast() {
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUI.getState().showToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return toast ? <div className="toast">{toast}</div> : null;
}

function ChoicePrompt() {
  useUI((s) => s.tick);
  const choice = world.player.pendingChoice;
  if (!choice || choice.picked) return null;
  return (
    <div className="choice card" role="dialog" aria-label={choice.prompt}>
      <p>{choice.prompt}</p>
      <div className="row">
        {choice.options.map((o) => (
          <button key={o.id} className="chip" onClick={() => world.answerChoice(world.player, o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "E to interact" prompt when walking around as your camper. */
function InteractPrompt() {
  useUI((s) => s.tick);
  const ui = useUI();
  if (ui.cameraMode !== 'follow' || ui.followId !== world.playerId || ui.placing) return null;
  const o = world.nearbyInteractable(world.player);
  if (!o) return null;
  const first = objectActions(o).find((a) => ACTIVITIES[a.activity].blocked(world, world.player, a.params) === null);
  if (!first) return null;
  return (
    <button className="interact card" onClick={() => startPlayerActivity(first.activity, first.params)}>
      <kbd>E</kbd> {first.icon} {first.label}
      <span className="more" onClick={(e) => (e.stopPropagation(), ui.selectObject(o.id))}>
        more…
      </span>
    </button>
  );
}

function Joystick() {
  const ui = useUI();
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (!coarse || ui.cameraMode !== 'follow' || ui.followId !== world.playerId) return null;
  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    joystick.x = x;
    joystick.y = -y;
    joystick.active = true;
    setKnob({ x, y });
  };
  const end = () => {
    joystick.active = false;
    joystick.x = joystick.y = 0;
    setKnob({ x: 0, y: 0 });
  };
  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => joystick.active && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Move your camper"
    >
      <span style={{ transform: `translate(${knob.x * 30}px, ${knob.y * 30}px)` }} />
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const ui = useUI.getState();
      if (ui.creatorOpen) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        world.paused = !world.paused;
        ui.bump();
      } else if (k === 'c') ui.setCameraMode(ui.cameraMode === 'follow' ? 'overview' : 'follow', ui.selectedChar ?? ui.followId);
      else if (k === 'b') ui.setPanel('build');
      else if (k === 't') ui.setPanel('environment');
      else if (k === 'h' || k === '?') ui.setPanel('help');
      else if (k === 'r' && ui.placing) ui.updatePlacing({ rot: ui.placing.rot + Math.PI / 8 });
      else if (k === 'escape') {
        if (ui.placing) ui.setPlacing(null);
        else if (ui.panel !== 'none') ui.setPanel('none');
        else if (ui.selectedChar || ui.selectedObject) {
          ui.selectChar(null);
          ui.selectObject(null);
        } else if (ui.cameraMode === 'follow') ui.setCameraMode('overview');
      } else if (k === 'e' && ui.cameraMode === 'follow' && ui.followId === world.playerId) {
        const o = world.nearbyInteractable(world.player);
        const first = o && objectActions(o).find((a) => ACTIVITIES[a.activity].blocked(world, world.player, a.params) === null);
        if (first) startPlayerActivity(first.activity, first.params);
      } else if (k === 'f' && ui.selectedChar) ui.setCameraMode('follow', ui.selectedChar);
      else if (['1', '2', '3', '4'].includes(k)) {
        const ch = world.characters[Number(k) - 1];
        if (ch) {
          ui.selectChar(ch.id);
          if (ui.cameraMode === 'follow') ui.setCameraMode('follow', ch.id);
          else ui.focusOn(ch.x, ch.z);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function HUD() {
  useShortcuts();
  const ui = useUI();
  const selChar = ui.selectedChar ? world.char(ui.selectedChar) : undefined;
  const selObj = ui.selectedObject ? world.obj(ui.selectedObject) : undefined;
  return (
    <div className="hud">
      <div className="top-left">
        <Clock />
      </div>
      <div className="top-right">
        <Toolbar />
      </div>
      <EventFeed />
      <Toast />
      <div className="side">
        {ui.panel === 'environment' && <EnvironmentPanel />}
        {ui.panel === 'settings' && <SettingsPanel />}
        {ui.panel === 'help' && <HelpPanel />}
        {ui.panel === 'build' && <BuildPanel />}
      </div>
      <div className="inspector">
        {selChar && <AvatarCard ch={selChar} />}
        {selObj && !ui.placing && <ObjectCard o={selObj} />}
      </div>
      <div className="bottom">
        <ChoicePrompt />
        <InteractPrompt />
        <Dock />
      </div>
      <Joystick />
    </div>
  );
}
