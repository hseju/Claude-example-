import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Photographed surfaces (CC0, Poly Haven; see textures/CREDITS.md): colour, normal and an AO/roughness/metal map
// per surface, sized for phones. Images load once and are shared; each material gets its own tiling.

const loader = new THREE.TextureLoader();
const images = new Map();
let aniso = 4;
export function setPBRAnisotropy(a) { aniso = a; }

const clones = new Map();   // tiled copies to refresh once their shared image has arrived
function base(file, srgb) {
  if (!images.has(file)) {
    const t = loader.load(`textures/${file}`, () => { for (const c of clones.get(file) || []) c.needsUpdate = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    images.set(file, t);
  }
  return images.get(file);
}
function tiled(file, srgb, repeat, rotation) {
  const src = base(file, srgb), t = src.clone();   // a clone shares the image, so it uploads once
  t.repeat.set(repeat[0], repeat[1]); t.rotation = rotation;
  if (src.image) t.needsUpdate = true; else { if (!clones.has(file)) clones.set(file, []); clones.get(file).push(t); }
  return t;
}

// a material for one surface: name is the texture set ('thatch', 'flagstone', 'sandstone', 'grass', 'planks', 'teak', 'bark', 'mossstone')
export function pbr(name, { repeat = [1, 1], rotation = 0, color = '#ffffff', normal = 1, roughness = 1, ao = 1, side, ...rest } = {}) {
  return new THREE.MeshStandardMaterial({
    map: tiled(`${name}_diff.jpg`, true, repeat, rotation),
    normalMap: tiled(`${name}_nor.jpg`, false, repeat, rotation), normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: tiled(`${name}_arm.jpg`, false, repeat, rotation), roughness,
    aoMap: tiled(`${name}_arm.jpg`, false, repeat, rotation), aoMapIntensity: ao,
    color: new THREE.Color(color), side: side ?? THREE.FrontSide, ...rest,
  });
}

// give a geometry UVs projected from its own shape, so a tiled texture keeps a true scale on any form:
// each vertex takes the two axes across its strongest normal direction, divided by the tile size in metres
export function boxUV(geo, tile = 1) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ---------------------------------------------------------------- stone projected from world position
// For the many temple pieces built in code (walls, plinths, pillars, steps, paving), the photographed surface is
// projected along the three world axes and blended by the surface normal, so it keeps a true scale on any shape
// without per-piece texture coordinates. A tint is given as the colour the stone should read as on average.
const MEAN = { slabs: [0.444, 0.337, 0.194], ashlar: [0.377, 0.288, 0.176], sandstone: [0.562, 0.376, 0.216], flagstone: [0.22, 0.149, 0.097], cave: [0.227, 0.141, 0.081], granite: [0.083, 0.07, 0.056] };
const TP_VERT_DECL = 'varying vec3 vTpPos;\nvarying vec3 vTpNormal;\n';
const TP_VERT = `
  vec4 tpW = vec4(transformed, 1.0);
  vec3 tpN = objectNormal;
  #ifdef USE_INSTANCING
    tpW = instanceMatrix * tpW; tpN = mat3(instanceMatrix) * tpN;
  #endif
  tpW = modelMatrix * tpW; vTpPos = tpW.xyz; vTpNormal = normalize(mat3(modelMatrix) * tpN);`;
const TP_FRAG_DECL = 'varying vec3 vTpPos;\nvarying vec3 vTpNormal;\nuniform sampler2D tpMap; uniform sampler2D tpNor; uniform sampler2D tpArm; uniform float uTpScale; uniform float uTpNormal; uniform float uTpAO;\n';
const TP_MAP = `
  vec3 tpWn = normalize(vTpNormal);
  vec3 tpw = pow(abs(tpWn), vec3(4.0)); tpw /= (tpw.x + tpw.y + tpw.z);
  vec2 tpUX = vTpPos.zy * uTpScale, tpUY = vTpPos.xz * uTpScale, tpUZ = vTpPos.xy * uTpScale;
  diffuseColor.rgb *= (texture2D(tpMap, tpUX) * tpw.x + texture2D(tpMap, tpUY) * tpw.y + texture2D(tpMap, tpUZ) * tpw.z).rgb;
  vec3 tpArmS = (texture2D(tpArm, tpUX) * tpw.x + texture2D(tpArm, tpUY) * tpw.y + texture2D(tpArm, tpUZ) * tpw.z).rgb;`;
const TP_ROUGH = 'float roughnessFactor = roughness * tpArmS.g;';
const TP_NORMAL = `
  {
    vec3 nX = texture2D(tpNor, tpUX).xyz * 2.0 - 1.0, nY = texture2D(tpNor, tpUY).xyz * 2.0 - 1.0, nZ = texture2D(tpNor, tpUZ).xyz * 2.0 - 1.0;
    nX.xy *= uTpNormal; nY.xy *= uTpNormal; nZ.xy *= uTpNormal;
    nX = vec3(nX.xy + tpWn.zy, abs(nX.z) * tpWn.x); nY = vec3(nY.xy + tpWn.xz, abs(nY.z) * tpWn.y); nZ = vec3(nZ.xy + tpWn.xy, abs(nZ.z) * tpWn.z);
    vec3 tpNW = normalize(nX.zyx * tpw.x + nY.xzy * tpw.y + nZ.xyz * tpw.z);
    normal = normalize((viewMatrix * vec4(tpNW, 0.0)).xyz);
    #ifdef DOUBLE_SIDED
      normal *= faceDirection;
    #endif
  }`;
const TP_AO = 'reflectedLight.indirectDiffuse *= mix(1.0, tpArmS.r, uTpAO); reflectedLight.indirectSpecular *= mix(1.0, tpArmS.r, uTpAO);';

const _tpCache = new Map();
export function triplanar(name, { tile = 2, tint, normal = 1, ao = 1, roughness = 1, cacheKey, ...rest } = {}) {
  const key = cacheKey && `${name}|${tile}|${tint}|${cacheKey}`;
  if (key && _tpCache.has(key)) return _tpCache.get(key);
  const color = new THREE.Color(1, 1, 1);
  if (tint) { const t = new THREE.Color(tint), m = MEAN[name] || [0.5, 0.5, 0.5]; color.setRGB(Math.min(3.6, t.r / m[0]), Math.min(3.6, t.g / m[1]), Math.min(3.6, t.b / m[2])); }   // enough range to turn the warm photo pale grey for Shiva's stone
  const mat = new THREE.MeshStandardMaterial({ color, roughness, ...rest });
  const u = { tpMap: { value: base(`${name}_diff.jpg`, true) }, tpNor: { value: base(`${name}_nor.jpg`, false) }, tpArm: { value: base(`${name}_arm.jpg`, false) }, uTpScale: { value: 1 / tile }, uTpNormal: { value: normal }, uTpAO: { value: ao } };
  mat.userData.triplanar = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = TP_VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + TP_VERT);
    sh.fragmentShader = TP_FRAG_DECL + sh.fragmentShader.replace('#include <map_fragment>', TP_MAP).replace('#include <roughnessmap_fragment>', TP_ROUGH)
      .replace('#include <normal_fragment_maps>', TP_NORMAL).replace('#include <aomap_fragment>', TP_AO);
  };
  mat.customProgramCacheKey = () => 'triplanar1';
  if (key) _tpCache.set(key, mat);
  return mat;
}
