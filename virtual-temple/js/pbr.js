import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Photographed surfaces (CC0, Poly Haven; see textures/CREDITS.md): colour, normal and an AO/roughness/metal map
// per surface, sized for phones. Images load once and are shared; each material gets its own tiling.

const loader = new THREE.TextureLoader();
const images = new Map();
let aniso = 4;
export function setPBRAnisotropy(a) { aniso = a; }

function base(file, srgb) {
  if (!images.has(file)) {
    const t = loader.load(`textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    images.set(file, t);
  }
  return images.get(file);
}
function tiled(file, srgb, repeat, rotation) {
  const t = base(file, srgb).clone();   // a clone shares the image, so it uploads once
  t.repeat.set(repeat[0], repeat[1]); t.rotation = rotation; t.needsUpdate = true;
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
