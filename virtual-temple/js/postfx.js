import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Minimal post pipeline: HDR scene target -> tilt-shift blur (horizontal, vertical) -> bloom and light shafts -> painterly grade.
// The tilt-shift gives the campus its handcrafted-miniature look; in the prayer hall the
// blur band is opened up so the sanctum stays sharp. Disabled on the low quality tier.

const quadVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer; this.enabled = true;
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rtC = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.5 }, uBand: { value: 0.18 }, uAmount: { value: 2.4 } },
      vertexShader: quadVS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; uniform float uFocus; uniform float uBand; uniform float uAmount; varying vec2 vUv;
        void main(){ float d = max(0.0, abs(vUv.y - uFocus) - uBand); float r = clamp(d*uAmount*3.0, 0.0, 1.0) * 3.2;
          vec2 st = uDir / uRes * r; vec4 c = texture2D(tDiffuse, vUv)*0.2270270270;
          c += texture2D(tDiffuse, vUv + st*1.3846153846)*0.3162162162; c += texture2D(tDiffuse, vUv - st*1.3846153846)*0.3162162162;
          c += texture2D(tDiffuse, vUv + st*3.2307692308)*0.0702702703; c += texture2D(tDiffuse, vUv - st*3.2307692308)*0.0702702703;
          gl_FragColor = c; }`,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, tShafts: { value: null }, uShafts: { value: 0.0 }, uBloom: { value: 0.0 }, uVignette: { value: 0.32 }, uWarm: { value: 0.0 }, uSat: { value: 1.2 }, uGrade: { value: 1.0 } },
      vertexShader: quadVS, depthTest: false, depthWrite: false, toneMapped: true,
      fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform sampler2D tShafts; uniform float uShafts; uniform float uBloom; uniform float uVignette; uniform float uWarm; uniform float uSat; uniform float uGrade; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb += texture2D(tBloom, vUv).rgb * uBloom; c.rgb += texture2D(tShafts, vUv).rgb * vec3(1.0,0.86,0.62) * uShafts;
          float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat);
          c.rgb *= mix(vec3(1.0), vec3(1.08,0.98,0.86), uWarm);
          // a painterly grade: shadows lean violet, highlights lean gold
          float lg = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
          c.rgb = mix(c.rgb, c.rgb*vec3(0.95,0.91,1.12), (1.0-smoothstep(0.0,0.42,lg))*0.32*uGrade);
          c.rgb = mix(c.rgb, c.rgb*vec3(1.1,1.0,0.84), smoothstep(0.42,1.5,lg)*0.3*uGrade);
          vec2 q = vUv - 0.5; c.rgb *= 1.0 - dot(q,q)*uVignette*2.0;
          gl_FragColor = c;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    // bloom: bright pass at quarter resolution, blurred twice, added before tone mapping
    this.rtD = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rtE = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.brightMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uTh: { value: 1.0 } }, vertexShader: quadVS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTh; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uTh, uTh*1.8, l), 1.0); }` });
    this.gaussMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } }, vertexShader: quadVS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; varying vec2 vUv;
        void main(){ vec2 st = uDir/uRes*1.6; vec4 c = texture2D(tDiffuse, vUv)*0.2270270270;
          c += (texture2D(tDiffuse, vUv+st*1.3846153846)+texture2D(tDiffuse, vUv-st*1.3846153846))*0.3162162162;
          c += (texture2D(tDiffuse, vUv+st*3.2307692308)+texture2D(tDiffuse, vUv-st*3.2307692308))*0.0702702703; gl_FragColor = c; }` });
    this.bloom = { strength: 0.55, threshold: 1.0 };
    // light shafts: the glow of the sun and the lanterns, blurred outward along lines from the sun's place on screen
    this.shafts = { sun: new THREE.Vector2(0.5, 1.2), strength: 0 };
    this.rtF = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.shaftMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uSun: { value: this.shafts.sun } }, vertexShader: quadVS, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; varying vec2 vUv;
        void main(){ vec2 d = (vUv - uSun) * (0.85 / 36.0); vec2 uv = vUv; vec3 c = vec3(0.0); float w = 1.0;
          for (int i = 0; i < 36; i++) { uv -= d; vec2 q = clamp(uv, 0.0, 1.0); c += texture2D(tDiffuse, q).rgb * w; w *= 0.955; }
          gl_FragColor = vec4(c / 18.0, 1.0); }` });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad); this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.tilt = { focus: 0.5, band: 0.16, amount: 2.2 };
  }
  setSize(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.rtA.setSize(W, H); this.rtB.setSize(Math.floor(W / 2), Math.floor(H / 2)); this.rtC.setSize(Math.floor(W / 2), Math.floor(H / 2));
    this.blurMat.uniforms.uRes.value.set(W / 2, H / 2);
    this.rtD.setSize(Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4))); this.rtE.setSize(Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4))); this.rtF.setSize(Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4)));
    this.gaussMat.uniforms.uRes.value.set(W / 4, H / 4);
  }
  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.rtA); r.render(scene, camera);
    const u = this.blurMat.uniforms; u.uFocus.value = this.tilt.focus; u.uBand.value = this.tilt.band; u.uAmount.value = this.tilt.amount;
    let src = this.rtA.texture;
    if (this.tilt.amount > 0.01) {
      this.quad.material = this.blurMat;
      u.tDiffuse.value = src; u.uDir.value.set(1, 0); r.setRenderTarget(this.rtB); r.render(this.qScene, this.qCam);
      u.tDiffuse.value = this.rtB.texture; u.uDir.value.set(0, 1); r.setRenderTarget(this.rtC); r.render(this.qScene, this.qCam);
      // composite: sharp band from full-res, blurred elsewhere
      this.mixMat = this.mixMat || new THREE.ShaderMaterial({
        uniforms: { tSharp: { value: null }, tBlur: { value: null }, uFocus: { value: 0.5 }, uBand: { value: 0.16 } }, vertexShader: quadVS, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tSharp; uniform sampler2D tBlur; uniform float uFocus; uniform float uBand; varying vec2 vUv;
          void main(){ float d = smoothstep(uBand, uBand+0.22, abs(vUv.y-uFocus)); gl_FragColor = mix(texture2D(tSharp,vUv), texture2D(tBlur,vUv), d); }`,
      });
      this.rtMix = this.rtMix || new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
      if (this.rtMix.width !== this.rtA.width) this.rtMix.setSize(this.rtA.width, this.rtA.height);
      this.mixMat.uniforms.tSharp.value = this.rtA.texture; this.mixMat.uniforms.tBlur.value = this.rtC.texture; this.mixMat.uniforms.uFocus.value = this.tilt.focus; this.mixMat.uniforms.uBand.value = this.tilt.band;
      this.quad.material = this.mixMat; r.setRenderTarget(this.rtMix); r.render(this.qScene, this.qCam);
      src = this.rtMix.texture;
    }
    if (this.bloom.strength > 0) {
      this.quad.material = this.brightMat; this.brightMat.uniforms.tDiffuse.value = this.rtA.texture; this.brightMat.uniforms.uTh.value = this.bloom.threshold; r.setRenderTarget(this.rtD); r.render(this.qScene, this.qCam);
      const g = this.gaussMat.uniforms; this.quad.material = this.gaussMat;
      for (let i = 0; i < 3; i++) { g.tDiffuse.value = this.rtD.texture; g.uDir.value.set(1, 0); r.setRenderTarget(this.rtE); r.render(this.qScene, this.qCam); g.tDiffuse.value = this.rtE.texture; g.uDir.value.set(0, 1); r.setRenderTarget(this.rtD); r.render(this.qScene, this.qCam); }
      this.finalMat.uniforms.tBloom.value = this.rtD.texture; this.finalMat.uniforms.uBloom.value = this.bloom.strength;
      if (this.shafts.strength > 0.01) { this.quad.material = this.shaftMat; this.shaftMat.uniforms.tDiffuse.value = this.rtD.texture; r.setRenderTarget(this.rtF); r.render(this.qScene, this.qCam); }
      this.finalMat.uniforms.tShafts.value = this.rtF.texture; this.finalMat.uniforms.uShafts.value = this.shafts.strength;
    } else { this.finalMat.uniforms.uBloom.value = 0; this.finalMat.uniforms.uShafts.value = 0; }
    this.quad.material = this.finalMat; this.finalMat.uniforms.tDiffuse.value = src;
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
  }
}
