import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { REFLECT, REFLECT_FADE, REFLECT_SOFT } from './materials.js';

// Bodies render to their own target and get depth of field. Floor, limbs,
// faces and emotes stay sharp. Colours are authored in display space.

const FloorShader = {
  name: 'GlassFloor',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.22 },
    uRadius: { value: 6 },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    uGroundBlur: { value: 1.6 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vW;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uRadius;
    uniform vec2 uTexel;
    uniform float uGroundBlur;
    varying vec4 vUv;
    varying vec3 vW;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 r = vec3(0.0);
      float ws = 0.0;
      for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) {
        float w = exp(-float(i * i + j * j) * 0.2);
        r += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * uTexel * uGroundBlur).rgb * w;
        ws += w;
      }
      r /= ws;
      float d = length(vW.xz);
      float fade = 1.0 - smoothstep(uRadius * 0.7, uRadius * 1.7, d);
      vec3 col = mix(vec3(1.0), r, uStrength * fade);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Radians per second of the idle camera drift.
const AUTO_YAW = 0.065;

export const LAYER = { FLOOR: 0, SHADOW: 1, BODY: 2, SHARP: 3, OVERLAY: 4, CLOUD: 5 };

// Heavy separable blur for the merge cloud. Input and output are premultiplied.
const CloudBlurShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
      vec4 acc = vec4(0.0);
      float ws = 0.0;
      for (int i = -14; i <= 14; i++) {
        float x = float(i) / 14.0;
        float w = exp(-x * x * 3.0);
        acc += texture2D(tMap, vUv + uStep * x) * w;
        ws += w;
      }
      gl_FragColor = acc / ws;
    }`,
};

// Body blur is a pyramid: each level is half the size of the one before and
// gets a short Gaussian, so level k is roughly twice as blurry as level k-1.
// Every pixel blends the two levels that bracket its blur amount, which stays
// smooth at any radius. Colour is premultiplied by coverage throughout so the
// edges fade cleanly instead of picking up the clear colour.
const PYR_LEVELS = 7;
const levels = [...Array(PYR_LEVELS).keys()].map((k) => k + 1);

// A second, tiny pyramid of the nearest body depth around each pixel. The
// composite reads it to blur every body in proportion to its own size on
// screen, so a creature near the camera and one far away look the same.
const DepthDownShader = {
  vertexShader: `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uTexel;
    uniform float uFirst, uNear, uFar;
    varying vec2 vUv;
    float lin(float d) {
      if (d >= 1.0) return 10000.0;
      float z = d * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    float tap(vec2 o) {
      float v = texture2D(tMap, vUv + o * uTexel).r;
      return uFirst > 0.5 ? lin(v) : v;
    }
    void main() {
      float m = min(min(tap(vec2(-0.5, -0.5)), tap(vec2(0.5, -0.5))), min(tap(vec2(-0.5, 0.5)), tap(vec2(0.5, 0.5))));
      gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
    }`,
};

const pyrVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PyrDownShader = {
  vertexShader: pyrVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uTexel;
    uniform float uPremul;
    varying vec2 vUv;
    vec4 pm(vec4 c) { return uPremul > 0.5 ? vec4(c.rgb * c.a, c.a) : c; }
    void main() {
      vec2 o = uTexel * 0.5;
      gl_FragColor = 0.25 * (pm(texture2D(tMap, vUv + vec2(-o.x, -o.y))) + pm(texture2D(tMap, vUv + vec2(o.x, -o.y)))
                          + pm(texture2D(tMap, vUv + vec2(-o.x, o.y))) + pm(texture2D(tMap, vUv + vec2(o.x, o.y))));
    }`,
};

const PyrBlurShader = {
  vertexShader: pyrVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
      vec4 acc = vec4(0.0);
      float ws = 0.0;
      for (int i = -4; i <= 4; i++) {
        float x = float(i);
        float w = exp(-x * x / (2.0 * 1.6 * 1.6));
        acc += texture2D(tMap, vUv + uStep * x) * w;
        ws += w;
      }
      gl_FragColor = acc / ws;
    }`,
};

const DofShader = {
  vertexShader: pyrVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tL0, ${levels.map((k) => 'tL' + k).join(', ')};
    uniform sampler2D ${levels.map((k) => 'tD' + k).join(', ')};
    uniform vec2 ${levels.map((k) => 'uT' + k).join(', ')};
    uniform vec2 uRes;
    uniform float uMin, uMax, uScale, uRef;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    // A small tent around each lookup hides the bilinear grid of tiny levels.
    vec4 tent(sampler2D t, vec2 tx) {
      vec2 o = tx * 0.5;
      return 0.25 * (texture2D(t, vUv + vec2(-o.x, -o.y)) + texture2D(t, vUv + vec2(o.x, -o.y))
                   + texture2D(t, vUv + vec2(-o.x, o.y)) + texture2D(t, vUv + vec2(o.x, o.y)));
    }
    vec4 level(int k) {
      if (k <= 0) { vec4 c = texture2D(tL0, vUv); return vec4(c.rgb * c.a, c.a); }
${levels.slice(0, -1).map((k) => `      if (k == ${k}) return tent(tL${k}, uT${k});`).join('\n')}
      return tent(tL${PYR_LEVELS}, uT${PYR_LEVELS});
    }
    // Nearest body depth in a small neighbourhood at level k.
    float dmin(sampler2D t, vec2 tx) {
      vec2 o = tx;
      return min(min(texture2D(t, vUv + vec2(-o.x, -o.y)).r, texture2D(t, vUv + vec2(o.x, -o.y)).r),
                 min(texture2D(t, vUv + vec2(-o.x, o.y)).r, texture2D(t, vUv + vec2(o.x, o.y)).r));
    }
    float depthAt(int k) {
${levels.slice(0, -1).map((k) => `      if (k <= ${k}) return dmin(tD${k}, uT${k});`).join('\n')}
      return dmin(tD${PYR_LEVELS}, uT${PYR_LEVELS});
    }
    float toLevel(float sigma) {
      // Level 1 is about 3.4px sigma, and each level after doubles it.
      float f = sigma < 3.4 ? sigma / 3.4 : 1.0 + log2(sigma / 3.4);
      return clamp(f, 0.0, ${PYR_LEVELS}.0);
    }
    void main() {
      // Broad, gentle noise so blurrier and sharper patches melt into each other.
      vec2 np = vUv * uRes / (150.0 * uScale);
      float n = vnoise(np) * 0.75 + vnoise(np * 2.1) * 0.25;
      float base = mix(uMin, uMax, smoothstep(-0.1, 1.1, n));
      // How big the body here is on screen, from its distance to the camera.
      float est = toLevel(base * uScale * 0.5);
      float z = depthAt(int(clamp(ceil(est) + 1.0, 1.0, ${PYR_LEVELS}.0)));
      float scale = z > 5000.0 ? uScale : uRef / z;
      float f = toLevel(base * scale * 0.5);
      int i = int(floor(f));
      vec4 c = mix(level(i), level(i + 1), f - float(i));
      gl_FragColor = vec4(c.rgb / max(c.a, 1e-4), c.a);
    }`,
};

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(13, 1, 1, 220);
    this.orbit = { yaw: 0.35, pitch: 0.68, zoom: 0.62, target: new THREE.Vector3(0, 0.45, 0) };
    this.yawVel = AUTO_YAW;
    this.dragging = false;

    this.floor = new Reflector(new THREE.CircleGeometry(80, 64), {
      textureWidth: 512, textureHeight: 512, clipBias: 0.002, shader: FloorShader, multisample: 0,
    });
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.camera.layers.enable(LAYER.BODY);
    this.floor.camera.layers.enable(LAYER.SHARP);
    this.floor.camera.layers.enable(LAYER.CLOUD);
    const reflect = this.floor.onBeforeRender;
    this.floor.onBeforeRender = (...args) => {
      REFLECT.value = 1;
      reflect.apply(this.floor, args);
      REFLECT.value = 0;
    };
    this.scene.add(this.floor);

    this.rtBody = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    this.rtBody.depthTexture = new THREE.DepthTexture(1, 1);
    this.rtBody.depthTexture.type = THREE.UnsignedIntType;
    this.rtBlur = new THREE.WebGLRenderTarget(1, 1);
    this.rtCloud = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rtCloudB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.cloudBlur = new THREE.ShaderMaterial({
      ...CloudBlurShader,
      uniforms: { tMap: { value: null }, uStep: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    this.cloudComp = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap;
        uniform float uDepth;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tMap, vUv); gl_FragDepth = uDepth; }`,
      uniforms: { tMap: { value: this.rtCloud.texture }, uDepth: { value: 0.5 } },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: true,
      depthWrite: false,
    });
    this.cloudDepthMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap;
        uniform float uDepth;
        varying vec2 vUv;
        void main() {
          if (texture2D(tMap, vUv).a < 0.5) discard;
          gl_FragDepth = uDepth;
          gl_FragColor = vec4(0.0);
        }`,
      uniforms: { tMap: { value: this.rtCloud.texture }, uDepth: this.cloudComp.uniforms.uDepth },
      depthTest: true,
      depthWrite: true,
      colorWrite: false,
    });
    this.cloudDepth = 0.5;
    this.cloudActive = false;

    this.pyr = Array.from({ length: PYR_LEVELS }, () => ({
      a: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
      b: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
      d: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }),
      w: 1, h: 1,
    }));
    this.depthDown = new THREE.ShaderMaterial({
      ...DepthDownShader,
      uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 1 }, uNear: { value: 1 }, uFar: { value: 100 } },
      depthTest: false,
      depthWrite: false,
    });
    this.pyrDown = new THREE.ShaderMaterial({
      ...PyrDownShader,
      uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uPremul: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.pyrBlur = new THREE.ShaderMaterial({
      ...PyrBlurShader,
      uniforms: { tMap: { value: null }, uStep: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const dofUniforms = {
      tL0: { value: this.rtBody.texture },
      uRes: { value: new THREE.Vector2() },
      uMax: { value: 8 },
      uMin: { value: 2 },
      uScale: { value: 1 },
      uRef: { value: 40 },
    };
    this.pyr.forEach((p, k) => {
      dofUniforms['tL' + (k + 1)] = { value: p.a.texture };
      dofUniforms['tD' + (k + 1)] = { value: p.d.texture };
      dofUniforms['uT' + (k + 1)] = { value: new THREE.Vector2() };
    });
    this.dof = new THREE.ShaderMaterial({ ...DofShader, uniforms: dofUniforms, depthTest: false, depthWrite: false });
    // Blurred bodies over the floor, then their depth on its own so sharp
    // limbs, faces and emotes behind a body are still hidden by it.
    this.compColor = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tBlur;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tBlur, vUv); }`,
      uniforms: { tBlur: { value: this.rtBlur.texture } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.compDepth = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDepth;
        varying vec2 vUv;
        void main() {
          float d = texture2D(tDepth, vUv).x;
          if (d >= 0.99999) discard;
          gl_FragDepth = d;
          gl_FragColor = vec4(0.0);
        }`,
      uniforms: { tDepth: { value: this.rtBody.depthTexture } },
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      depthWrite: true,
      colorWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dof);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.arena = 6;
    this.look = { bodyMin: 3, bodyMax: 11.5, ground: 1.4, cloud: 10, fadeAt: 0.7, fadeSoft: 0.4, holdWobble: 4.4, holdWobbleSpeed: 3.05 };
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const [w, h] = this.forced || [this.canvas.clientWidth || innerWidth || 1280, this.canvas.clientHeight || innerHeight || 800];
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const pw = Math.floor(w * dpr), ph = Math.floor(h * dpr);
    this.rtBody.setSize(pw, ph);
    this.rtBlur.setSize(pw, ph);
    this.rtCloud.setSize(Math.ceil(pw / 2), Math.ceil(ph / 2));
    this.rtCloudB.setSize(Math.ceil(pw / 2), Math.ceil(ph / 2));
    this.cloudPx = [Math.ceil(pw / 2), Math.ceil(ph / 2)];
    this.floor.getRenderTarget().setSize(Math.floor(pw / 2), Math.floor(ph / 2));
    this.floor.material.uniforms.uTexel.value.set(2 / pw, 2 / ph);
    this.dof.uniforms.uRes.value.set(pw, ph);
    let lw = pw, lh = ph;
    this.pyr.forEach((p, k) => {
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
      p.w = lw;
      p.h = lh;
      p.a.setSize(lw, lh);
      p.b.setSize(lw, lh);
      p.d.setSize(lw, lh);
      this.dof.uniforms['uT' + (k + 1)].value.set(1 / lw, 1 / lh);
    });
    this.pxScale = ph / 1000;
    this.applyLook();
    this.camera.aspect = w / h;
    this.arena = w / h < 0.9 ? 5 : 7.4;
    this.homeZoom = w / h < 0.9 ? 0.72 : 0.66;
    // Tall screens look more steeply down so the garden fills the height.
    if (!this.userOrbited) this.orbit.pitch = w / h < 0.9 ? 0.98 : 0.68;
    if (!this.userZoomed && !this.intro) this.orbit.zoom = this.homeZoom;
    this.floor.material.uniforms.uRadius.value = this.arena;
    this.updateCamera();
  }

  fitDistance() {
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const byH = (this.arena * 0.95) / t;
    const byW = (this.arena * 1.08) / (t * this.camera.aspect);
    return Math.max(byH, byW);
  }

  // The default framing's camera distance, used as the blur's reference.
  refDistance() { return this.fitDistance() * (this.homeZoom || 0.66); }
  viewScale() { return this.refDistance() / this.camera.position.distanceTo(this.orbit.target); }

  // First load: start close on the garden and pull back to the default frame.
  startIntro() {
    this.intro = { t: 0, dur: 1.7, from: (this.homeZoom || 0.66) * 0.72 };
    this.orbit.zoom = this.intro.from;
    this.updateCamera();
  }

  updateIntro(dt) {
    const it = this.intro;
    if (!it) return;
    if (this.userZoomed) { this.intro = null; return; }
    it.t = Math.min(it.dur, it.t + dt);
    const k = it.t / it.dur;
    // Already moving on the first frame, then easing to a stop.
    const e = 1 - Math.pow(1 - k, 3);
    this.orbit.zoom = it.from + (this.homeZoom - it.from) * e;
    this.updateCamera();
    if (it.t >= it.dur) this.intro = null;
  }

  // A slow idle turn around the garden. A swipe sets the turn speed, which
  // glides back down to the idle drift once you let go.
  updateOrbit(dt) {
    this.yawVel ??= AUTO_YAW;
    if (this.dragging || this.holding) return;
    this.yawVel = Math.max(-4, Math.min(4, this.yawVel));
    this.yawVel += (AUTO_YAW - this.yawVel) * Math.min(1, dt * 1.5);
    this.orbit.yaw += this.yawVel * dt;
    this.updateCamera();
  }

  updateCamera() {
    const o = this.orbit;
    const d = this.fitDistance() * o.zoom;
    const cp = Math.cos(o.pitch);
    this.camera.position.set(Math.sin(o.yaw) * cp * d, Math.sin(o.pitch) * d, Math.cos(o.yaw) * cp * d).add(o.target);
    this.camera.lookAt(o.target);
    this.camera.near = Math.max(1, d - 30);
    this.camera.far = d + 60;
    this.camera.updateProjectionMatrix();
    if (this.look) this.floor.material.uniforms.uGroundBlur.value = this.look.ground * Math.min(2.5, this.viewScale());
    if (this.dof) {
      this.dof.uniforms.uScale.value = this.viewScale();
      this.dof.uniforms.uRef.value = this.refDistance();
    }
  }

  // Dial values are in pixels at a 1000px tall view, scaled to the real size.
  applyLook() {
    const L = this.look, s = this.pxScale || 1;
    this.dof.uniforms.uMin.value = Math.min(L.bodyMin, L.bodyMax) * s;
    this.dof.uniforms.uMax.value = Math.max(L.bodyMin, L.bodyMax) * s;
    this.floor.material.uniforms.uGroundBlur.value = L.ground * Math.min(2.5, this.viewScale());
    this.cloudRadius = L.cloud * s;
    REFLECT_FADE.value = Math.max(0.02, L.fadeAt);
    REFLECT_SOFT.value = L.fadeSoft;
  }

  // The merge cloud renders on its own, gets a wide blur, and lays over the scene.
  drawCloud() {
    const r = this.renderer, cam = this.camera;
    const prevLayers = cam.layers.mask;
    cam.layers.set(LAYER.CLOUD);
    r.setRenderTarget(this.rtCloud);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, cam);
    const [w, h] = this.cloudPx, rad = (this.cloudRadius || 10) * 0.5 * this.viewScale();
    const u = this.cloudBlur.uniforms;
    u.tMap.value = this.rtCloud.texture;
    u.uStep.value.set(rad / w, 0);
    r.setRenderTarget(this.rtCloudB);
    r.clear();
    this.drawQuad(this.cloudBlur);
    u.tMap.value = this.rtCloudB.texture;
    u.uStep.value.set(0, rad / h);
    r.setRenderTarget(this.rtCloud);
    r.clear();
    this.drawQuad(this.cloudBlur);
    r.setRenderTarget(null);
    r.setClearColor(0xffffff, 1);
    this.cloudComp.uniforms.uDepth.value = this.cloudDepth;
    this.drawQuad(this.cloudComp);
    this.drawQuad(this.cloudDepthMat);
    cam.layers.mask = prevLayers;
  }

  buildPyramid() {
    const r = this.renderer;
    let src = this.rtBody.texture, sw = this.rtBody.width, sh = this.rtBody.height;
    this.pyr.forEach((p, k) => {
      const d = this.pyrDown.uniforms;
      d.tMap.value = src;
      d.uTexel.value.set(1 / sw, 1 / sh);
      d.uPremul.value = k === 0 ? 1 : 0;
      r.setRenderTarget(p.a);
      this.drawQuad(this.pyrDown);
      const b = this.pyrBlur.uniforms;
      b.tMap.value = p.a.texture;
      b.uStep.value.set(1 / p.w, 0);
      r.setRenderTarget(p.b);
      this.drawQuad(this.pyrBlur);
      b.tMap.value = p.b.texture;
      b.uStep.value.set(0, 1 / p.h);
      r.setRenderTarget(p.a);
      this.drawQuad(this.pyrBlur);
      src = p.a.texture;
      sw = p.w;
      sh = p.h;
    });
    const dd = this.depthDown.uniforms;
    dd.uNear.value = this.camera.near;
    dd.uFar.value = this.camera.far;
    let dsrc = this.rtBody.depthTexture, dw = this.rtBody.width, dh = this.rtBody.height;
    this.pyr.forEach((p, k) => {
      dd.tMap.value = dsrc;
      dd.uTexel.value.set(1 / dw, 1 / dh);
      dd.uFirst.value = k === 0 ? 1 : 0;
      r.setRenderTarget(p.d);
      this.drawQuad(this.depthDown);
      dsrc = p.d.texture;
      dw = p.w;
      dh = p.h;
    });
  }

  drawQuad(mat) {
    this.quad.material = mat;
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(time = 0) {
    const r = this.renderer, cam = this.camera;

    cam.layers.set(LAYER.BODY);
    r.setRenderTarget(this.rtBody);
    r.setClearColor(0xffffff, 0);
    r.clear();
    r.render(this.scene, cam);

    this.buildPyramid();
    r.setRenderTarget(this.rtBlur);
    r.clear();
    this.drawQuad(this.dof);

    r.setRenderTarget(null);
    r.setClearColor(0xffffff, 1);
    r.clear();
    cam.layers.set(LAYER.FLOOR);
    cam.layers.enable(LAYER.SHADOW);
    r.render(this.scene, cam);
    this.drawQuad(this.compColor);
    this.drawQuad(this.compDepth);
    if (this.cloudActive) this.drawCloud();
    cam.layers.set(LAYER.SHARP);
    cam.layers.enable(LAYER.OVERLAY);
    r.render(this.scene, cam);
    cam.layers.set(LAYER.FLOOR);
  }
}
