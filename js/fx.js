import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { softDot } from './textures.js';

// GPU flame sprites: one draw call for every diya flame in a scene. Each flame has its own
// phase so flicker timing and intensity differ lamp to lamp.
export class FlameField {
  constructor(max = 256) {
    this.max = max; this.count = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.phase = new Float32Array(max); this.scale = new Float32Array(max);
    for (let i = 0; i < max; i++) this.phase[i] = Math.random() * 100;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(this.phase, 1));
    g.setAttribute('aScale', new THREE.BufferAttribute(this.scale, 1));
    g.setDrawRange(0, 0);
    this.uniforms = { uTime: { value: 0 }, uPx: { value: 1 }, uBoost: { value: 1 }, uMotion: { value: 1 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aPhase; attribute float aScale; uniform float uTime; uniform float uPx; uniform float uBoost; uniform float uMotion;
        varying float vFl; varying float vPh;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
          float t = uTime*uMotion + aPhase;
          float fl = 0.86 + 0.08*sin(t*7.3) + 0.05*sin(t*13.1+1.7) + 0.04*sin(t*23.7);
          vFl = fl; vPh = aPhase;
          gl_PointSize = aScale * fl * uBoost * uPx * 640.0 / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform float uMotion; varying float vFl; varying float vPh;
        void main(){ vec2 p = vec2(gl_PointCoord.x-0.5, 0.5-gl_PointCoord.y);
          float sway = sin(uTime*uMotion*3.1+vPh)*0.025*(p.y+0.3);
          p.x -= sway;
          float w = mix(0.15, 0.02, smoothstep(-0.22, 0.3, p.y));
          float flame = 1.0 - smoothstep(0.55, 1.0, length(vec2(p.x/w, (p.y+0.04)/(0.24*vFl))));
          float core = 1.0 - smoothstep(0.2, 0.75, length(vec2(p.x/(w*0.55), (p.y+0.1)/0.08)));
          float glow = exp(-length(p+vec2(0.0,0.06))*7.0)*0.55;
          vec3 col = vec3(1.0,0.45,0.08)*flame + vec3(1.0,0.92,0.7)*core*1.2 + vec3(1.0,0.55,0.18)*glow;
          float a = clamp(flame + glow, 0.0, 1.0);
          gl_FragColor = vec4(col*a, a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 10;
  }
  add(p, scale = 0.35) {
    if (this.count >= this.max) return -1;
    const i = this.count++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.scale[i] = scale;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aScale.needsUpdate = true; g.setDrawRange(0, this.count);
    return i;
  }
  set(i, p, scale) {
    if (i < 0) return; if (p) this.pos.set([p.x, p.y, p.z], i * 3); if (scale !== undefined) this.scale[i] = scale;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aScale.needsUpdate = true;
  }
  position(i) { return new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); }
  update(t) { this.uniforms.uTime.value = t; }
}

// Thin incense smoke: CPU-simulated particles drawn as soft, slowly expanding sprites.
export class SmokeSystem {
  constructor(max = 400) {
    this.max = max; this.parts = []; this.emitters = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = { uMap: { value: softDot() }, uPx: { value: 1 }, uColor: { value: new THREE.Color('#d9d4cc') } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uPx; varying float vA;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vA=aAlpha; gl_PointSize = aSize*uPx*300.0/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if(a<0.003) discard; gl_FragColor = vec4(uColor, a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 11;
    this.enabled = true; this.density = 1;
  }
  addEmitter(pos, { rate = 9, life = 90, spread = 0.02 } = {}) {
    const e = { pos: pos.clone(), rate, life, age: 0, acc: 0, spread }; this.emitters.push(e); return e;
  }
  clear() { this.parts.length = 0; this.emitters.length = 0; }
  update(dt, t) {
    for (const e of this.emitters) {
      e.age += dt; if (e.age > e.life) continue;
      if (!this.enabled) continue;
      e.acc += dt * e.rate * this.density;
      while (e.acc > 1 && this.parts.length < this.max) {
        e.acc -= 1;
        this.parts.push({ x: e.pos.x + (Math.random() - 0.5) * e.spread, y: e.pos.y, z: e.pos.z + (Math.random() - 0.5) * e.spread, age: 0, life: 5 + Math.random() * 3, seed: Math.random() * 10 });
      }
    }
    this.emitters = this.emitters.filter(e => e.age <= e.life);
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.age += dt;
      if (p.age > p.life) { this.parts.splice(i, 1); continue; }
      const k = p.age / p.life;
      p.y += dt * (0.32 - k * 0.12);
      p.x += Math.sin(t * 0.9 + p.seed + p.y * 2.4) * dt * 0.06 * (0.3 + k * 2);
      p.z += Math.cos(t * 0.7 + p.seed * 1.3 + p.y * 1.9) * dt * 0.05 * (0.3 + k * 2);
    }
    for (const p of this.parts) {
      if (n >= this.max) break;
      const k = p.age / p.life;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.alpha[n] = Math.min(1, p.age * 3) * (1 - k) * 0.38;
      this.size[n] = 0.06 + k * 0.7;
      n++;
    }
    const g = this.points.geometry; g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}

// Floating dust motes, animated entirely on the GPU, used inside sunbeams.
export function dustMotes(count, box, color = '#ffe9c4') {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) { p[i * 3] = box.min.x + Math.random() * (box.max.x - box.min.x); p[i * 3 + 1] = box.min.y + Math.random() * (box.max.y - box.min.y); p[i * 3 + 2] = box.min.z + Math.random() * (box.max.z - box.min.z); s[i] = Math.random() * 100; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const u = { uTime: { value: 0 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(color) }, uMap: { value: softDot() }, uOpacity: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ vec3 q = position; q.x += sin(uTime*0.13+aSeed)*0.35; q.y += sin(uTime*0.09+aSeed*1.7)*0.4; q.z += cos(uTime*0.11+aSeed*0.6)*0.35;
        vec4 mv = modelViewMatrix*vec4(q,1.0); vA = 0.5+0.5*sin(uTime*0.7+aSeed*3.0); gl_PointSize = uPx*14.0/-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a*vA*0.7*uOpacity; gl_FragColor = vec4(uColor*a, a); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.uniforms = u; return pts;
}

// Fountain water: droplets follow parabolic arcs computed on the GPU.
export function fountainJets(count, origin, { height = 1.6, radius = 1.4, color = '#dff3f5' } = {}) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3), a = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { a[i * 2] = Math.random(); a[i * 2 + 1] = Math.floor(Math.random() * 8) / 8 * Math.PI * 2 + (Math.random() - 0.5) * 0.12; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(a, 2));
  const u = { uTime: { value: 0 }, uPx: { value: 1 }, uMap: { value: softDot() }, uH: { value: height }, uR: { value: radius }, uO: { value: origin.clone() }, uColor: { value: new THREE.Color(color) } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `attribute vec2 aSeed; uniform float uTime; uniform float uPx; uniform float uH; uniform float uR; uniform vec3 uO; varying float vA;
      void main(){ float k = fract(uTime*0.55 + aSeed.x); float ang = aSeed.y;
        vec3 q = uO + vec3(cos(ang)*uR*k, uH*4.0*k*(1.0-k), sin(ang)*uR*k);
        vec4 mv = modelViewMatrix*vec4(q,1.0); vA = smoothstep(0.0,0.08,k)*(1.0-smoothstep(0.85,1.0,k)); gl_PointSize = uPx*5.0/ -mv.z * 6.0; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).a*vA*0.75; gl_FragColor = vec4(uColor, a); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.uniforms = u; return pts;
}

// Make a MeshStandardMaterial sway in the wind (flags, foliage, garlands) via a vertex hook.
export function windify(material, { amp = 0.1, freq = 1.5, axis = 'z', weightBy = 'uv' } = {}, timeUniform) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uWindTime = timeUniform;
    sh.vertexShader = 'uniform float uWindTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wW = ${weightBy === 'uv' ? 'uv.x' : weightBy === 'uvy' ? '(1.0-uv.y)' : 'clamp(position.y*0.5,0.0,1.0)'};
      #ifdef USE_INSTANCING
        float wPh = instanceMatrix[3].x*0.3 + instanceMatrix[3].z*0.2;
      #else
        float wPh = 0.0;
      #endif
      float wv = sin(uWindTime*${freq.toFixed(2)} + position.x*2.0 + position.y*1.3 + wPh) * ${amp.toFixed(3)} * wW;
      transformed.${axis} += wv; transformed.y += wv*0.15;`);
  };
  material.customProgramCacheKey = () => `wind${amp}${freq}${axis}${weightBy}`;
  return material;
}

// Petals that arc from the devotee's hands to the offering plate and stay there.
export class PetalOffering {
  constructor(max = 600) {
    const geo = new THREE.SphereGeometry(0.035, 6, 4); geo.scale(1, 0.25, 0.6);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), max);
    this.mesh.count = 0; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.max = max; this.flying = []; this.landed = 0; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this.colors = ['#f2a516', '#ffcc33', '#e8442e', '#ffffff', '#f06a8c', '#ff8c1a'].map(c => new THREE.Color(c));
    this.mesh.frustumCulled = false;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.colors[i % this.colors.length]);
  }
  throw(from, to, n = 24) {
    for (let i = 0; i < n; i++) {
      if (this.mesh.count >= this.max) break;
      const idx = this.mesh.count++;
      const tgt = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.45, Math.random() * 0.06, (Math.random() - 0.5) * 0.3));
      this.flying.push({ idx, from: from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1)), to: tgt, t: -i * 0.03, dur: 1.1 + Math.random() * 0.5, rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), arc: 0.8 + Math.random() * 0.7 });
      this.mesh.setColorAt(idx, this.colors[Math.floor(Math.random() * this.colors.length)]);
      this._m.makeScale(0, 0, 0); this.mesh.setMatrixAt(idx, this._m);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    if (!this.flying.length) return;
    const v = new THREE.Vector3();
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]; f.t += dt;
      const k = Math.max(0, Math.min(1, f.t / f.dur));
      v.lerpVectors(f.from, f.to, k); v.y += Math.sin(k * Math.PI) * f.arc;
      const spin = (1 - k) * 4;
      this._e.set(f.rot.x * spin, f.rot.y * spin + f.rot.y, f.rot.z * spin); this._q.setFromEuler(this._e);
      const s = f.t < 0 ? 0 : 1;
      this._m.compose(v, this._q, new THREE.Vector3(s, s, s)); this.mesh.setMatrixAt(f.idx, this._m);
      if (k >= 1) this.flying.splice(i, 1);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
