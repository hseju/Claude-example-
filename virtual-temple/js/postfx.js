import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Minimal post pipeline: HDR scene target -> tilt-shift blur (horizontal, vertical) -> grade.
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
      uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uWarm: { value: 0.0 }, uSat: { value: 1.06 } },
      vertexShader: quadVS, depthTest: false, depthWrite: false, toneMapped: true,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform float uWarm; uniform float uSat; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat);
          c.rgb *= mix(vec3(1.0), vec3(1.08,0.98,0.86), uWarm);
          vec2 q = vUv - 0.5; c.rgb *= 1.0 - dot(q,q)*uVignette*2.0;
          gl_FragColor = c;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad); this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.tilt = { focus: 0.5, band: 0.16, amount: 2.2 };
  }
  setSize(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.rtA.setSize(W, H); this.rtB.setSize(Math.floor(W / 2), Math.floor(H / 2)); this.rtC.setSize(Math.floor(W / 2), Math.floor(H / 2));
    this.blurMat.uniforms.uRes.value.set(W / 2, H / 2);
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
    this.quad.material = this.finalMat; this.finalMat.uniforms.tDiffuse.value = src;
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
  }
}
