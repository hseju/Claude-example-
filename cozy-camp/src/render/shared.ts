import * as THREE from 'three';
import { createSkyState } from './sky';

/** Point the camera orbits around (also where the shadow frustum is centred). */
export const focusPoint = new THREE.Vector3(1, 0, 0);

/** Sky and light values for this frame, computed once by the environment driver. */
export const skyState = createSkyState();

/** World-space rod tip per character, published by avatars for fishing lines. */
export const rodTips = new Map<string, THREE.Vector3>();

/** Camera yaw, used to turn WASD input into world directions. */
export const cameraInfo = { yaw: 0, distance: 20 };

/** Runtime quality switches mirrored from preferences. */
export const quality = { high: true };
