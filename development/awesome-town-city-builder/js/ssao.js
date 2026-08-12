// Screen-space ambient occlusion.
//
// The contact shade baked into the city material is analytic: it darkens the
// bottom of a building and anything facing down, but it cannot see the corner
// where two buildings meet, or under an overhang, because nothing in that
// shader knows another building is there. This does, because it works off the
// depth buffer.
//
// Normals are reconstructed from depth rather than rendered into a buffer of
// their own. That matters here: the town's vertices are moved in the vertex
// shader by spin, wave, wind and bend, so a separate normal pass rendered with
// an override material would describe geometry that is not where it looks.
// Depth is whatever actually got drawn.
//
// Two draws: occlusion at half resolution into its own target, then a blurred
// composite. Half res is the standard saving and costs nothing visible,
// because the result is blurred anyway.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const COMMON = /* glsl */ `
  uniform sampler2D tDepth;
  uniform mat4 uProj;
  uniform mat4 uProjInv;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 viewFromDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * clip;
    return view.xyz / view.w;
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const OCCLUSION_FRAG = /* glsl */ `
  ${COMMON}
  uniform float uRadius;
  uniform float uBias;
  uniform int uSamples;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 p = viewFromDepth(vUv);
    // Nothing was drawn here, so nothing can be occluded.
    if (-p.z > 5000.0) { gl_FragColor = vec4(1.0); return; }

    // A normal from the depth gradient. Cheap, and correct for whatever the
    // vertex shaders actually produced.
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    if (dot(n, normalize(-p)) < 0.0) n = -n;

    vec3 t = normalize(abs(n.z) < 0.99 ? cross(vec3(0.0, 0.0, 1.0), n) : cross(vec3(1.0, 0.0, 0.0), n));
    vec3 b = cross(n, t);
    mat3 tbn = mat3(t, b, n);

    float spin = hash(floor(vUv * uResolution)) * 6.2831853;
    float occ = 0.0;
    for (int i = 0; i < 24; i++) {
      if (i >= uSamples) break;
      float fi = float(i) + 0.5;
      float a = fi * 2.39996323 + spin;
      float rr = sqrt(fi / float(uSamples));
      // Cosine-weighted hemisphere, scaled so samples cluster near the point.
      vec3 dir = tbn * vec3(cos(a) * rr, sin(a) * rr, sqrt(max(0.0, 1.0 - rr * rr)));
      vec3 sp = p + dir * uRadius * (0.35 + 0.65 * hash(vec2(fi, 7.3)));

      vec4 clip = uProj * vec4(sp, 1.0);
      vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;

      float sceneZ = viewFromDepth(suv).z;
      // View space runs negative into the screen, so a larger z is nearer.
      float blocked = sceneZ >= sp.z + uBias ? 1.0 : 0.0;
      // Ignore blockers far outside the sample radius, or a distant wall
      // shadows everything in front of it.
      float range = smoothstep(0.0, 1.0, uRadius / max(1e-4, abs(p.z - sceneZ)));
      occ += blocked * range;
    }

    gl_FragColor = vec4(vec3(1.0 - occ / float(uSamples)), 1.0);
  }
`;

// Separable Gaussian, run once across and once down. A single box blur over a
// noisy buffer still reads as noise with soft edges; two Gaussian passes
// actually remove it. Weighted by depth so the blur does not drag occlusion
// across a silhouette and halo it.
const BLUR_FRAG = /* glsl */ `
  ${COMMON}
  uniform sampler2D tAo;
  uniform vec2 uDirection;
  uniform float uDepthSensitivity;

  void main() {
    float centreDepth = -viewFromDepth(vUv).z;
    const float W[5] = float[5](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

    float sum = texture2D(tAo, vUv).r * W[0];
    float weight = W[0];
    for (int i = 1; i < 5; i++) {
      vec2 step = uDirection * float(i);
      for (int s = 0; s < 2; s++) {
        vec2 uv = vUv + (s == 0 ? step : -step);
        float d = -viewFromDepth(uv).z;
        // Falls off with depth difference, so a foreground edge does not
        // smear its occlusion onto whatever is behind it.
        float w = W[i] * exp(-abs(d - centreDepth) * uDepthSensitivity);
        sum += texture2D(tAo, uv).r * w;
        weight += w;
      }
    }
    gl_FragColor = vec4(vec3(sum / max(1e-4, weight)), 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tAo;
  uniform vec2 uAoTexel;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    // The blur passes did the smoothing; this is a light final average across
    // the half-res grid so upscaling does not reintroduce steps.
    float ao = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        ao += texture2D(tAo, vUv + vec2(float(x), float(y)) * uAoTexel).r;
      }
    }
    ao /= 9.0;
    // Smoothstep rather than a hard power: it eases both ends, so occlusion
    // arrives gradually instead of stepping in.
    ao = clamp(ao, 0.0, 1.0);
    ao = mix(1.0, smoothstep(0.0, 1.0, ao), clamp(uIntensity, 0.0, 1.0));

    vec4 base = texture2D(tDiffuse, vUv);
    // Tint toward the shade colour rather than straight to black, so corners
    // read as being lit by the sky rather than as holes.
    gl_FragColor = vec4(base.rgb * mix(uColor, vec3(1.0), ao), base.a);
  }
`;

export class SsaoPass extends Pass {
  constructor(depthTexture) {
    super();
    this.needsSwap = true;

    const targetOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    };
    this.aoTarget = new THREE.WebGLRenderTarget(1, 1, targetOpts);
    this.blurTarget = new THREE.WebGLRenderTarget(1, 1, targetOpts);

    this.occlusionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: depthTexture },
        uProj: { value: new THREE.Matrix4() },
        uProjInv: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 2.2 },
        uBias: { value: 0.06 },
        uSamples: { value: 16 },
      },
      vertexShader: VERT,
      fragmentShader: OCCLUSION_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tAo: { value: this.aoTarget.texture },
        uAoTexel: { value: new THREE.Vector2(1, 1) },
        uIntensity: { value: 1.4 },
        uColor: { value: new THREE.Color('#2a3550') },
      },
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDepth: { value: depthTexture },
        tAo: { value: null },
        uProj: { value: new THREE.Matrix4() },
        uProjInv: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uDepthSensitivity: { value: 0.4 },
      },
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.occlusionQuad = new FullScreenQuad(this.occlusionMaterial);
    this.blurQuad = new FullScreenQuad(this.blurMaterial);
    this.compositeQuad = new FullScreenQuad(this.compositeMaterial);
    this.scale = 0.5;
  }

  setSize(width, height) {
    const w = Math.max(1, Math.round(width * this.scale));
    const h = Math.max(1, Math.round(height * this.scale));
    this.aoTarget.setSize(w, h);
    this.blurTarget.setSize(w, h);
    this.occlusionMaterial.uniforms.uResolution.value.set(w, h);
    this.blurMaterial.uniforms.uResolution.value.set(w, h);
    this.compositeMaterial.uniforms.uAoTexel.value.set(1 / w, 1 / h);
    this.texel = new THREE.Vector2(1 / w, 1 / h);
  }

  apply(camera, params) {
    const u = this.occlusionMaterial.uniforms;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uRadius.value = params.aoRadius ?? 2.2;
    u.uBias.value = params.aoBias ?? 0.06;
    u.uSamples.value = Math.max(4, Math.min(24, Math.round(params.aoSamples ?? 16)));

    const b = this.blurMaterial.uniforms;
    b.uProj.value.copy(camera.projectionMatrix);
    b.uProjInv.value.copy(camera.projectionMatrixInverse);
    b.uDepthSensitivity.value = params.aoDepthSensitivity ?? 0.4;
    this.blurPasses = Math.max(1, Math.min(4, Math.round(params.aoSmoothing ?? 2)));

    this.compositeMaterial.uniforms.uIntensity.value = params.ao ?? 0;
    this.compositeMaterial.uniforms.uColor.value.set(params.aoColor ?? '#2a3550');
    this.enabled = (params.ao ?? 0) > 0.001;
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.aoTarget);
    renderer.clear();
    this.occlusionQuad.render(renderer);

    // Across then down, repeated. Each round widens the kernel without paying
    // for a wider one, which is how the noise actually goes away.
    const passes = this.blurPasses ?? 2;
    for (let i = 0; i < passes; i++) {
      const spread = i + 1;
      this.blurMaterial.uniforms.tAo.value = this.aoTarget.texture;
      this.blurMaterial.uniforms.uDirection.value.set(this.texel.x * spread, 0);
      renderer.setRenderTarget(this.blurTarget);
      renderer.clear();
      this.blurQuad.render(renderer);

      this.blurMaterial.uniforms.tAo.value = this.blurTarget.texture;
      this.blurMaterial.uniforms.uDirection.value.set(0, this.texel.y * spread);
      renderer.setRenderTarget(this.aoTarget);
      renderer.clear();
      this.blurQuad.render(renderer);
    }

    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.compositeQuad.render(renderer);
  }

  dispose() {
    this.aoTarget.dispose();
    this.blurTarget.dispose();
    this.occlusionMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.occlusionQuad.dispose();
    this.blurQuad.dispose();
    this.compositeQuad.dispose();
  }
}
