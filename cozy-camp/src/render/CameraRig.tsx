import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../sim/math';
import { useUI, world } from '../state/store';
import { cameraInfo, focusPoint } from './shared';

/** Joystick input from the on-screen touch control (x right, y forward, -1..1). */
export const joystick = { x: 0, y: 0, active: false };

const OVERVIEW = { pitch: 0.68, dist: 21, minDist: 7, maxDist: 46, minPitch: 0.32, maxPitch: 1.32 };
const FOLLOW = { pitch: 0.36, dist: 6.2, minDist: 2.6, maxDist: 14, minPitch: 0.08, maxPitch: 1.1 };

const keys = new Set<string>();

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * One camera with two behaviours. Both share yaw/pitch/distance/target, so
 * switching modes just changes the goals and the camera glides between them.
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  const goal = useRef({ yaw: 0.42, pitch: OVERVIEW.pitch, dist: OVERVIEW.dist, target: new THREE.Vector3(1.5, 0, -0.5) });
  const cur = useRef({ yaw: 0.42, pitch: 1.1, dist: 34, target: new THREE.Vector3(1.5, 0, -0.5) });
  const overviewMemory = useRef({ yaw: 0.42, pitch: OVERVIEW.pitch, dist: OVERVIEW.dist, target: new THREE.Vector3(1.5, 0, -0.5) });
  const followMemory = useRef({ dist: FOLLOW.dist, pitch: FOLLOW.pitch, yawOffset: 0 });
  const lastDrag = useRef(0);
  const lastFocus = useRef(0);
  const mode = useUI((s) => s.cameraMode);
  const prevMode = useRef(mode);
  const pointers = useMemo(() => new Map<number, { x: number; y: number; button: number; shift: boolean }>(), []);
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null);

  // Debug hook (?debug): lets automated checks frame the camera instantly.
  useEffect(() => {
    const dbg = (window as unknown as { cozy?: Record<string, unknown> }).cozy;
    if (dbg) dbg.camera = { goal: goal.current, cur: cur.current };
  }, []);

  // Remember / restore the overview framing across mode switches.
  useEffect(() => {
    if (prevMode.current === mode) return;
    if (mode === 'follow') {
      overviewMemory.current = { ...goal.current, target: goal.current.target.clone() };
      goal.current.dist = followMemory.current.dist;
      goal.current.pitch = followMemory.current.pitch;
    } else {
      followMemory.current.dist = goal.current.dist;
      followMemory.current.pitch = goal.current.pitch;
      const m = overviewMemory.current;
      goal.current.dist = m.dist;
      goal.current.pitch = m.pitch;
      goal.current.yaw = m.yaw;
      // Keep looking at whoever we followed.
      goal.current.target.copy(cur.current.target).setY(0);
    }
    prevMode.current = mode;
  }, [mode]);

  useEffect(() => {
    const el = gl.domElement;
    const limits = () => (useUI.getState().cameraMode === 'follow' ? FOLLOW : OVERVIEW);
    const rotate = (dx: number, dy: number) => {
      const g = goal.current;
      const L = limits();
      g.yaw -= dx * 0.006;
      g.pitch = clamp(g.pitch + dy * 0.004, L.minPitch, L.maxPitch);
      if (useUI.getState().cameraMode === 'follow') {
        followMemory.current.yawOffset -= dx * 0.006;
        lastDrag.current = performance.now();
      }
    };
    const pan = (dx: number, dy: number) => {
      if (useUI.getState().cameraMode === 'follow') return;
      const g = goal.current;
      const s = g.dist * 0.0016;
      // Grab-and-drag: the ground follows the pointer.
      const fx = -Math.sin(g.yaw);
      const fz = -Math.cos(g.yaw);
      const rx = -fz;
      const rz = fx;
      g.target.x += (-dx * rx + dy * fx) * s;
      g.target.z += (-dx * rz + dy * fz) * s;
      clampTarget(g.target);
    };
    const zoom = (factor: number) => {
      const g = goal.current;
      const L = limits();
      g.dist = clamp(g.dist * factor, L.minDist, L.maxDist);
    };

    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (useUI.getState().placing) return;
      if (pointers.size === 2 && pinch.current) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (pinch.current.d > 0) zoom(pinch.current.d / d);
        pan(mx - pinch.current.mx, my - pinch.current.my);
        pinch.current = { d, mx, my };
        return;
      }
      if (p.button === 2 || p.shift || p.button === 1) pan(dx, dy);
      else rotate(dx, dy);
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch.current = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0012));
    };
    const ctx = (e: Event) => e.preventDefault();
    const kd = (e: KeyboardEvent) => {
      if (typing(e)) return;
      keys.add(e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', ctx);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('contextmenu', ctx);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, [gl, pointers]);

  useFrame((_, rdt) => {
    const dt = Math.min(rdt, 0.05);
    const ui = useUI.getState();
    const g = goal.current;
    const c = cur.current;
    const follow = ui.cameraMode === 'follow';
    const followed = follow ? world.char(ui.followId) : undefined;

    // Keyboard: move the avatar in follow mode, pan the view otherwise.
    let ix = 0;
    let iz = 0;
    if (keys.has('w') || keys.has('arrowup')) iz += 1;
    if (keys.has('s') || keys.has('arrowdown')) iz -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (joystick.active) {
      ix = joystick.x;
      iz = joystick.y;
    }
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    const rx = -fz;
    const rz = fx;
    const controllingPlayer = follow && followed?.controller === 'player' && !ui.placing;
    if (controllingPlayer) {
      world.playerInput.x = fx * iz + rx * ix;
      world.playerInput.z = fz * iz + rz * ix;
      world.playerInput.run = keys.has('shift');
    } else {
      world.playerInput.x = 0;
      world.playerInput.z = 0;
      if (!follow && (ix || iz)) {
        const s = g.dist * 0.9 * dt;
        g.target.x += (fx * iz + rx * ix) * s;
        g.target.z += (fz * iz + rz * ix) * s;
        clampTarget(g.target);
      }
    }
    if (!follow) {
      if (keys.has('q')) g.yaw += dt * 1.4;
      if (keys.has('e') && !ui.selectedObject) g.yaw -= dt * 1.4;
    }

    // Glide to a focus request (e.g. selecting a camper or an event).
    if (ui.focus && ui.focus.at !== lastFocus.current) {
      lastFocus.current = ui.focus.at;
      if (!follow) g.target.set(ui.focus.x, 0, ui.focus.z);
    }

    if (followed) {
      const head = world.terrain.surfaceHeight(followed.x, followed.z) + followed.yOffset + 0.9;
      g.target.set(followed.x, head, followed.z);
      // Swing behind the avatar while it walks, unless the user is orbiting.
      if (followed.moving && performance.now() - lastDrag.current > 1500) {
        const behind = followed.heading + Math.PI;
        g.yaw = dampAngle(g.yaw, behind, 1.6, dt);
      }
    } else if (!follow) {
      g.target.y = damp(g.target.y, Math.max(0, world.terrain.height(g.target.x, g.target.z)), 4, dt);
    }

    const k = follow ? 6 : 7;
    c.yaw = dampAngle(c.yaw, g.yaw, k, dt);
    c.pitch = damp(c.pitch, g.pitch, k, dt);
    c.dist = damp(c.dist, g.dist, 5, dt);
    c.target.x = damp(c.target.x, g.target.x, follow ? 9 : 5, dt);
    c.target.y = damp(c.target.y, g.target.y, follow ? 9 : 5, dt);
    c.target.z = damp(c.target.z, g.target.z, follow ? 9 : 5, dt);

    const cp = Math.cos(c.pitch);
    let px = c.target.x + Math.sin(c.yaw) * cp * c.dist;
    let pz = c.target.z + Math.cos(c.yaw) * cp * c.dist;
    let py = c.target.y + Math.sin(c.pitch) * c.dist;
    const ground = world.terrain.height(px, pz) + 0.6;
    if (py < ground) py = ground;
    // Keep inside the sky dome.
    const r = Math.hypot(px, pz);
    if (r > 120) {
      px *= 120 / r;
      pz *= 120 / r;
    }
    camera.position.set(px, py, pz);
    camera.lookAt(c.target);
    focusPoint.copy(c.target);
    cameraInfo.yaw = c.yaw;
    cameraInfo.distance = c.dist;
  });

  return null;
}

function clampTarget(t: THREE.Vector3) {
  const r = Math.hypot(t.x, t.z);
  const max = world.def.walkRadius + 2;
  if (r > max) {
    t.x *= max / r;
    t.z *= max / r;
  }
}
