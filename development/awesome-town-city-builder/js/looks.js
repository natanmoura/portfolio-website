// Post effects that change how the town reads, rather than just polishing it.
//
// All four are one pass, because each is cheap on its own and reading the
// frame buffer once is most of the cost:
//
//   miniature  a band of focus with everything above and below thrown out,
//              which flips the whole scene from city to model on a table
//   halftone   a print screen of dots, which is where the collage came from
//   posterise  a handful of tones, like a screen print
//   vignette   plus grain, to stop flat colour reading as digital
//
// It runs after tone mapping so it works on the colours you actually see.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const LooksShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uNear: { value: 0.5 },
    uFar: { value: 1000 },
    uDof: { value: 0 },
    uFocus: { value: 40 },
    uFocusRange: { value: 30 },
    uBokeh: { value: 0.4 },
    uHalftone: { value: 0 },
    uHalftoneScale: { value: 4 },
    uPosterize: { value: 0 },
    uPosterizeSteps: { value: 6 },
    uVignette: { value: 0.2 },
    uGrain: { value: 0.05 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uShadowTint: { value: new THREE.Color('#ffffff') },
    uHighlightTint: { value: new THREE.Color('#ffffff') },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uNear;
    uniform float uFar;
    uniform float uDof;
    uniform float uFocus;
    uniform float uFocusRange;
    uniform float uBokeh;
    uniform float uHalftone;
    uniform float uHalftoneScale;
    uniform float uPosterize;
    uniform float uPosterizeSteps;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    varying vec2 vUv;

    float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // Ordered dither. Quantising against this instead of rounding turns
    // posterising from flat banding into a screen-print stipple.
    const float BAYER[16] = float[16](
      0.0, 8.0, 2.0, 10.0,
      12.0, 4.0, 14.0, 6.0,
      3.0, 11.0, 1.0, 9.0,
      15.0, 7.0, 13.0, 5.0
    );
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      return BAYER[y * 4 + x] / 16.0;
    }

    // Contrast, saturation, then a split tone that warms or cools the two ends
    // of the range against each other.
    vec3 grade(vec3 c) {
      c = (c - 0.5) * uContrast + 0.5;
      float l = lum(c);
      c = mix(vec3(l), c, uSaturation);
      c *= mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.9, l));
      return max(c, vec3(0.0));
    }

    // Depth buffer to world distance from the eye.
    float viewDepth(vec2 uv) {
      float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    // Circle of confusion: zero inside the sharp band, growing either side of
    // it. Measured off real scene depth, so a near object blurs as readily as
    // a far one and the effect survives the camera moving.
    float circleOfConfusion() {
      if (uDof <= 0.0) return 0.0;
      float d = viewDepth(vUv);
      float away = abs(d - uFocus) - uFocusRange;
      return clamp(away / max(1.0, uFocusRange * 1.6), 0.0, 1.0) * uDof;
    }

    // Twenty-one taps on a golden-angle spiral. Weighted toward the bright
    // samples when bokeh is up, which is what turns a smear into highlights
    // that bloom into discs.
    vec3 blurred(float amount) {
      if (amount <= 0.002) return texture2D(tDiffuse, vUv).rgb;
      vec2 texel = 1.0 / uResolution;
      float radius = amount * amount * 15.0;
      // Rotate the spiral by a per-pixel amount. Without this the same 28 taps
      // land in the same places on every pixel and undersampling shows up as
      // streaks rather than as the grain it should be.
      float spin = hash(floor(vUv * uResolution)) * 6.2831853;
      vec3 sum = texture2D(tDiffuse, vUv).rgb;
      float weight = 1.0;
      for (int i = 1; i <= 28; i++) {
        float fi = float(i);
        float a = fi * 2.39996323 + spin;
        float r = radius * sqrt(fi / 28.0);
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * texel * r).rgb;
        // Out-of-focus highlights should stay bright rather than average away.
        float w = 1.0 + uBokeh * 5.0 * pow(lum(s), 3.0);
        sum += s * w;
        weight += w;
      }
      return sum / weight;
    }

    void main() {
      vec3 color = blurred(circleOfConfusion());
      vec2 px = vUv * uResolution;

      color = grade(color);

      if (uPosterize > 0.0) {
        float steps = max(2.0, uPosterizeSteps);
        float d = (bayer(px) - 0.5) / steps;
        vec3 flat_ = floor((color + d) * steps + 0.5) / steps;
        color = mix(color, flat_, uPosterize);
      }

      if (uHalftone > 0.0) {
        // Rotated screen, so the dot grid does not line up with the pixels.
        float s = max(0.5, uHalftoneScale);
        vec2 p = vUv * uResolution / s;
        float c = cos(0.4363), sn = sin(0.4363);
        vec2 rot = vec2(p.x * c - p.y * sn, p.x * sn + p.y * c);
        vec2 cell = fract(rot) - 0.5;
        float dot_ = length(cell) * 2.0;
        float tone = lum(color);
        // Dots grow as the picture darkens.
        float mask = smoothstep(dot_ - 0.35, dot_ + 0.35, sqrt(tone) * 1.25);
        color = mix(color, color * mask + vec3(0.02) * (1.0 - mask), uHalftone);
      }

      if (uVignette > 0.0) {
        vec2 d = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
        float v = smoothstep(0.85, 0.25, length(d));
        color *= mix(1.0, v, uVignette);
      }

      if (uGrain > 0.0) {
        float n = hash(vUv * uResolution + fract(uTime) * 331.0) - 0.5;
        color += n * uGrain * 0.16;
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class LooksPass extends ShaderPass {
  constructor() {
    super(LooksShader);
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(width, height);
  }

  // camera supplies the near and far planes and, when focus is automatic, how
  // far away the thing being orbited is.
  apply(params, time, camera, pivotDistance) {
    const u = this.uniforms;
    u.uTime.value = time;
    if (camera) {
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
    }
    u.uDof.value = params.dof ?? 0;
    u.uFocus.value = params.dofAuto ? Math.max(1, pivotDistance || 40) : params.dofFocus ?? 40;
    u.uFocusRange.value = Math.max(0.1, params.dofRange ?? 30);
    u.uBokeh.value = params.bokeh ?? 0.4;
    u.uHalftone.value = params.halftone ?? 0;
    u.uHalftoneScale.value = params.halftoneScale ?? 4;
    u.uPosterize.value = params.posterize ?? 0;
    u.uPosterizeSteps.value = params.posterizeSteps ?? 6;
    u.uVignette.value = params.vignette ?? 0;
    u.uGrain.value = params.grain ?? 0;
    // A tint that is switched off has to be white, not merely unset, or it
    // would keep grading after you turned it off.
    u.uContrast.value = params.contrast ?? 1;
    u.uSaturation.value = params.saturation ?? 1;
    u.uShadowTint.value.set(params.shadowTintOn ? params.shadowTint || '#ffffff' : '#ffffff');
    u.uHighlightTint.value.set(params.highlightTintOn ? params.highlightTint || '#ffffff' : '#ffffff');
    // Skip the pass entirely when nothing is turned on.
    this.enabled =
      u.uDof.value > 0 ||
      u.uHalftone.value > 0 ||
      u.uPosterize.value > 0 ||
      u.uVignette.value > 0 ||
      u.uGrain.value > 0 ||
      Math.abs(u.uContrast.value - 1) > 0.001 ||
      Math.abs(u.uSaturation.value - 1) > 0.001;
  }
}
