import * as THREE from 'three';

/**
 * Uniforms shared by every stylised material: time, wind and ground cover.
 * Updated once per frame by the environment driver.
 */
export const GLOBAL_UNIFORMS = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uWindStrength: { value: 0.2 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
};

export interface StylizedOptions {
  roughness?: number;
  metalness?: number;
  /** Vertex sway amount for wind (0 = rigid). Scales with height above the mesh origin. */
  sway?: number;
  /** Accumulates snow on upward-facing surfaces in winter. */
  snow?: boolean;
  vertexColors?: boolean;
  flatShading?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  map?: THREE.Texture | null;
}

function inject(mat: THREE.MeshStandardMaterial, sway: number, snow: boolean) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = GLOBAL_UNIFORMS.uTime;
    shader.uniforms.uWindDir = GLOBAL_UNIFORMS.uWindDir;
    shader.uniforms.uWindStrength = GLOBAL_UNIFORMS.uWindStrength;
    shader.uniforms.uSnow = GLOBAL_UNIFORMS.uSnow;
    shader.uniforms.uWet = GLOBAL_UNIFORMS.uWet;
    shader.uniforms.uSway = { value: sway };
    shader.uniforms.uSnowable = { value: snow ? 1 : 0 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform float uSway;
        varying float vUpness;`,
      )
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
        vec3 cozyN = objectNormal;
        #ifdef USE_INSTANCING
          cozyN = mat3(instanceMatrix) * cozyN;
        #endif
        vUpness = normalize(mat3(modelMatrix) * cozyN).y;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 cozyWorld = modelMatrix * mvPosition;
        if (uSway > 0.0) {
          float hgt = max(transformed.y, 0.0) * uSway;
          vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #ifdef USE_INSTANCING
            origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float phase = origin.x * 0.37 + origin.z * 0.23;
          float gust = sin(uTime * 1.25 + phase) * 0.55 + sin(uTime * 2.9 + phase * 1.7) * 0.22;
          float bend = (gust + 0.65) * uWindStrength;
          cozyWorld.xz += uWindDir * bend * hgt * hgt * 0.06;
          cozyWorld.xz += vec2(sin(uTime * 3.7 + phase * 3.1), cos(uTime * 3.1 + phase * 2.3)) * 0.012 * hgt * uWindStrength;
        }
        mvPosition = viewMatrix * cozyWorld;
        gl_Position = projectionMatrix * mvPosition;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSnow;
        uniform float uWet;
        uniform float uSnowable;
        varying float vUpness;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float snowMask = smoothstep(0.35, 0.8, vUpness) * uSnow * uSnowable;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), snowMask);
        diffuseColor.rgb *= 1.0 - uWet * 0.22 * (1.0 - snowMask);`,
      );
  };
  mat.customProgramCacheKey = () => `cozy-${sway}-${snow}`;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared, cached stylised material. Same options return the same instance. */
export function mat(color: string, opts: StylizedOptions = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, { ...opts, map: opts.map ? opts.map.uuid : null }]);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: opts.vertexColors ? '#ffffff' : color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    vertexColors: opts.vertexColors ?? false,
    flatShading: opts.flatShading ?? false,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    map: opts.map ?? null,
  });
  inject(m, opts.sway ?? 0, opts.snow ?? true);
  cache.set(key, m);
  return m;
}

/** A fresh (uncached) stylised material for things that animate their own colour. */
export function uniqueMat(color: string, opts: StylizedOptions = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: opts.flatShading ?? false,
    map: opts.map ?? null,
  });
  inject(m, opts.sway ?? 0, opts.snow ?? true);
  return m;
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit glowing material (flames, glass, stars). Not tone mapped so bloom can pick it up. */
export function glow(color: string, opacity = 1, additive = false): THREE.MeshBasicMaterial {
  const key = `${color}-${opacity}-${additive}`;
  const hit = basicCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1 || additive,
    opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive && opacity >= 1,
    toneMapped: false,
  });
  basicCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------

let glowTex: THREE.Texture | null = null;
/** Soft round sprite used for halos, fireflies and sparks. */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let waterNormals: THREE.DataTexture | null = null;
/** Tileable normal map of soft ripples, built from summed sine waves. */
export function waterNormalTexture(): THREE.DataTexture {
  if (waterNormals) return waterNormals;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const waves = [
    [1, 2, 0.9],
    [3, -1, 0.5],
    [-2, 3, 0.4],
    [5, 4, 0.18],
    [-6, 5, 0.14],
    [7, -6, 0.1],
  ];
  const height = (x: number, y: number) => {
    let h = 0;
    for (const [a, b, amp] of waves) h += Math.sin(((a * x + b * y) / size) * Math.PI * 2) * amp;
    return h;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  waterNormals = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  waterNormals.needsUpdate = true;
  return waterNormals;
}

let gingham: THREE.Texture | null = null;
export function ginghamTexture(): THREE.Texture {
  if (gingham) return gingham;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4ede0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(196,72,72,0.55)';
  for (let i = 0; i < 4; i++) {
    g.fillRect(i * 16, 0, 8, 64);
    g.fillRect(0, i * 16, 64, 8);
  }
  gingham = new THREE.CanvasTexture(c);
  gingham.wrapS = gingham.wrapT = THREE.RepeatWrapping;
  gingham.repeat.set(3, 2.4);
  gingham.colorSpace = THREE.SRGBColorSpace;
  gingham.magFilter = THREE.NearestFilter;
  return gingham;
}
