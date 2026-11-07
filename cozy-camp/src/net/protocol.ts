/**
 * Multiplayer message contract (planned phase, not wired up yet).
 *
 * The simulation in src/sim is plain TypeScript with no rendering or DOM
 * dependencies, so a server can run the authoritative World headless. Clients
 * send intents; the server validates them with the same activity rules the
 * single-player game uses (ActivityDef.blocked) and streams state back.
 * Human-controlled campers use `controller: 'remote'` and get a distinct name
 * tag (◆) so autonomous campers (🍃) stay distinguishable from real people.
 */
import type { ActParams } from '../sim/activities/core';
import type { AnimName, Appearance, EnvState, HeldItem, ObjectKind, WorldObject } from '../sim/types';

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------- client → server

export type ClientMessage =
  | { t: 'hello'; v: typeof PROTOCOL_VERSION; name: string; appearance: Appearance; token?: string }
  | { t: 'move'; seq: number; x: number; z: number; run: boolean }
  | { t: 'walkTo'; seq: number; x: number; z: number }
  | { t: 'activity'; seq: number; id: string; params?: ActParams }
  | { t: 'cancel'; seq: number }
  | { t: 'choice'; seq: number; option: string }
  | { t: 'place'; seq: number; kind: ObjectKind; id?: string; x: number; z: number; rot: number }
  | { t: 'remove'; seq: number; id: string }
  | { t: 'chat'; text: string };

// ---------------------------------------------------------------- server → client

/** Compact per-camper state, sent every network tick (10–15 Hz) for interpolation. */
export interface CharacterFrame {
  id: string;
  x: number;
  z: number;
  y: number;
  heading: number;
  anim: AnimName;
  moving: boolean;
  held: HeldItem | null;
  heldState: number;
  expression: string;
  bubble?: { icon: string; text?: string };
  status: string;
}

export type ServerMessage =
  | {
      t: 'welcome';
      you: string;
      envId: string;
      /** Full snapshot so a joining client can build the scene. */
      snapshot: {
        objects: WorldObject[];
        env: EnvState;
        characters: { id: string; name: string; controller: 'ai' | 'remote'; appearance: Appearance }[];
      };
    }
  | {
      t: 'frame';
      simTime: number;
      ack: number;
      characters: CharacterFrame[];
      env: Pick<EnvState, 'time' | 'mix' | 'windStrength' | 'windDir' | 'lightning'>;
    }
  | { t: 'objects'; changed: WorldObject[]; removed: string[] }
  | { t: 'joined'; id: string; name: string; appearance: Appearance }
  | { t: 'left'; id: string }
  | { t: 'rejected'; seq: number; reason: string }
  | { t: 'event'; icon: string; text: string }
  | { t: 'chat'; from: string; text: string };

/** What a networked client needs from a transport (WebSocket, WebRTC data channel, ...). */
export interface Transport {
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void;
  close(): void;
}
