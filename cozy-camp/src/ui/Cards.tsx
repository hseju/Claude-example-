import { CircleStop, Footprints, Move, Palette, Video, X } from 'lucide-react';
import { ACTIVITIES, MENU_ACTIVITIES, objectActions } from '../sim/activities';
import { FOOD_NAMES } from '../sim/activities/cooking';
import { NEED_LABELS } from '../sim/character';
import type { Character, NeedKey, WorldObject } from '../sim/types';
import { useUI, world } from '../state/store';
import { audio } from '../audio/engine';

export function startPlayerActivity(id: string, params = {}) {
  const ui = useUI.getState();
  const err = world.startActivity(world.player, id, { byPlayer: true, params });
  audio.play('ui');
  if (err) ui.showToast(err);
}

const FAVOURITE_NAMES: Record<string, string> = {
  fish: 'fishing',
  stargaze: 'stargazing',
  hammock: 'the hammock',
  skywatch: 'lying under the sky',
  explore: 'exploring',
  cook: 'cooking',
  tendFire: 'tending the fire',
  gatherWood: 'gathering wood',
  marshmallow: 'marshmallows',
  cocoa: 'hot cocoa',
};

function favourites(ch: Character): string {
  const fav = Object.entries(ch.personality)
    .filter(([k, v]) => FAVOURITE_NAMES[k] && (v ?? 0) > 1.1)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([k]) => FAVOURITE_NAMES[k]);
  return fav.length ? fav.join(', ') : 'a bit of everything';
}

function NeedBars({ ch }: { ch: Character }) {
  return (
    <div className="needs">
      {(Object.keys(NEED_LABELS) as NeedKey[]).map((k) => {
        const v = ch.needs[k];
        return (
          <div className="need" key={k} title={`${NEED_LABELS[k].label}: ${Math.round(v * 100)}%`}>
            <span className="need-icon" aria-hidden>
              {NEED_LABELS[k].icon}
            </span>
            <span className="need-label">{NEED_LABELS[k].label}</span>
            <span className="bar">
              <span className={`fill ${v < 0.25 ? 'low' : ''}`} style={{ width: `${Math.round(v * 100)}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AvatarCard({ ch }: { ch: Character }) {
  useUI((s) => s.tick);
  const ui = useUI();
  const isPlayer = ch.controller === 'player';
  const following = ui.cameraMode === 'follow' && ui.followId === ch.id;
  const run = ch.activity;
  return (
    <section className="card avatar-card" aria-label={`${ch.name} details`}>
      <header>
        <div>
          <h2>{ch.name}</h2>
          <span className={`tag ${isPlayer ? 'you' : 'ai'}`}>{isPlayer ? '★ Your camper' : '🍃 Autonomous camper'}</span>
        </div>
        <button className="icon-btn ghost" aria-label="Close" onClick={() => ui.selectChar(null)}>
          <X size={18} />
        </button>
      </header>
      <p className="status">
        <span aria-hidden>{run?.icon ?? '🌿'}</span> {ch.status}
      </p>
      <NeedBars ch={ch} />
      <div className="row">
        <button className={`chip ${following ? 'on' : ''}`} onClick={() => ui.setCameraMode(following ? 'overview' : 'follow', ch.id)}>
          <Video size={15} /> {following ? 'Stop following' : 'Follow'}
        </button>
        {isPlayer && run && (
          <button className="chip" onClick={() => world.cancelActivity(ch)}>
            <CircleStop size={15} /> Stop
          </button>
        )}
        {isPlayer && (
          <button className="chip" onClick={() => ui.setCreatorOpen(true)}>
            <Palette size={15} /> Look
          </button>
        )}
      </div>
      {isPlayer ? (
        <>
          <label className="toggle">
            <input
              type="checkbox"
              checked={ch.autopilot}
              onChange={(e) => {
                ch.autopilot = e.target.checked;
                if (e.target.checked) ch.manualUntil = 0;
                ui.bump();
              }}
            />
            <span>Autopilot when idle</span>
          </label>
          <p className="hint">
            <Footprints size={13} /> Tap the ground to walk, or pick something to do:
          </p>
          <div className="activity-grid">
            {MENU_ACTIVITIES.map((a) => {
              const reason = a.blocked(world, ch, {});
              const active = run?.id === a.id;
              return (
                <button
                  key={a.id}
                  className={`act ${active ? 'on' : ''}`}
                  disabled={Boolean(reason)}
                  title={reason ?? a.label}
                  onClick={() => startPlayerActivity(a.id)}
                >
                  <span aria-hidden>{a.icon}</span>
                  {a.label}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="hint">Lives on their own schedule. Loves {favourites(ch)}.</p>
      )}
    </section>
  );
}

function objectSummary(o: WorldObject): string[] {
  switch (o.kind) {
    case 'campfire': {
      const f = o.fire!;
      const state = !f.lit
        ? f.ember > 0.1
          ? 'Glowing embers'
          : 'Cold ashes'
        : f.intensity > 0.75
          ? 'Roaring'
          : f.intensity > 0.4
            ? 'Burning steadily'
            : 'Burning low';
      const lines = [`${state} · fuel ${Math.round((f.fuel / 1.6) * 100)}%`];
      if (f.pan) lines.push(`${FOOD_NAMES[f.pan.food]} cooking: ${Math.min(100, Math.round(f.pan.doneness * 100))}%`);
      lines.push(f.kettleHeat > 0.5 ? 'Kettle is hot' : 'Kettle is cool');
      return lines;
    }
    case 'tent': {
      const t = o.tent!;
      const inside = o.slots.filter((s) => s.kind === 'sleep' && s.occupant).map((s) => world.char(s.occupant!)?.name);
      return [
        t.pitch >= 1 ? 'Pitched' : t.pitch <= 0 ? 'Packed in its bag' : 'Being set up…',
        inside.length ? `Inside: ${inside.join(', ')}` : 'Nobody inside',
      ];
    }
    case 'woodpile':
      return [`${o.count ?? 0} logs stacked`];
    case 'fishBucket':
      return [`${o.count ?? 0} fish for dinner`];
    case 'prepTable': {
      const p = o.prep!;
      return [
        p.plates ? `${p.plates} plates of ${FOOD_NAMES[p.plateFood]} ready` : 'No food ready yet',
        p.food ? `Preparing ${FOOD_NAMES[p.food]}` : '',
      ].filter(Boolean);
    }
    case 'lantern':
      return [o.on ? 'Glowing warmly' : 'Unlit'];
    case 'basket': {
      const b = o.basket!;
      return [`🌰 ${b.pinecone}  🌼 ${b.flower}  🍄 ${b.mushroom}  🪨 ${b.stone}`];
    }
    case 'telescope':
      return [
        world.daylight() > 0.35 ? 'Waiting for nightfall' : world.env.mix.cloud > 0.7 ? 'Too cloudy tonight' : 'Clear view of the stars',
      ];
    case 'hammock':
    case 'chair':
    case 'bench':
    case 'logBench':
    case 'stool':
    case 'blanket': {
      const who = o.slots.filter((s) => s.occupant).map((s) => world.char(s.occupant!)?.name);
      return [who.length ? `In use by ${who.join(' and ')}` : 'Free'];
    }
    case 'branchSpot':
      return [o.on ? 'Dry branches for the fire' : 'Collected (more will fall)'];
    case 'collectible':
      return [o.on ? 'A little treasure for the nature basket' : 'Collected'];
    case 'dock':
      return [`Fishing spots: ${o.slots.filter((s) => !s.occupant).length} free`];
    case 'tarp':
      return ['Dry spot when it rains'];
    default:
      return [];
  }
}

export function ObjectCard({ o }: { o: WorldObject }) {
  useUI((s) => s.tick);
  const ui = useUI();
  const actions = objectActions(o);
  const building = ui.panel === 'build';
  return (
    <section className="card object-card" aria-label={`${o.name} details`}>
      <header>
        <div>
          <h2>{o.name}</h2>
          {o.custom && <span className="tag">Added by you</span>}
        </div>
        <button className="icon-btn ghost" aria-label="Close" onClick={() => ui.selectObject(null)}>
          <X size={18} />
        </button>
      </header>
      {objectSummary(o).map((l) => (
        <p className="status" key={l}>
          {l}
        </p>
      ))}
      {!building && actions.length > 0 && (
        <div className="activity-grid">
          {actions.map((a) => {
            const reason = ACTIVITIES[a.activity].blocked(world, world.player, a.params);
            return (
              <button
                key={a.label}
                className="act"
                disabled={Boolean(reason)}
                title={reason ?? a.label}
                onClick={() => startPlayerActivity(a.activity, a.params)}
              >
                <span aria-hidden>{a.icon}</span>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      {!building && actions.length > 0 && <p className="hint">{world.player.name} will walk over and do it.</p>}
      {o.movable && (
        <div className="row">
          <button
            className="chip"
            disabled={world.isInUse(o)}
            onClick={() => {
              if (ui.panel !== 'build') ui.setPanel('build');
              useUI.getState().setPlacing({ id: o.id, kind: o.kind, rot: o.rot, x: o.x, z: o.z, valid: true });
            }}
          >
            <Move size={15} /> Move
          </button>
        </div>
      )}
    </section>
  );
}
