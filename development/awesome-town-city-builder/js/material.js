// One material for the entire city.
//
// Everything a face needs travels as a vertex attribute rather than as a
// material property, which is what lets thousands of modules merge into a
// handful of draw calls:
//
//   color      flat colour, or white where an image takes over
//   aUv        uv already cropped and folded into the image's rect
//   aLayer     which layer of the texture array, or -1 for flat colour
//   aEmissive  glow colour times strength, black when unlit
//   aSpin      pivot xyz and turn speed, so rotation happens on the GPU
//
// Spinning modules therefore stay inside the merged buffers instead of
// needing a mesh each. The shadow depth material gets the same vertex
// transform so their shadows turn with them.

import * as THREE from 'three';
import { WAVE_GLSL, WAVE_BODY, WAVE_BODY_NORMAL, WIND_BODY, waveFrequency } from './wave.js';
import { shaderVersion } from './pcss.js';

// Uniforms the ground shares with the city, so the town rides the same water
// its reflection would.
export const shared = {
  uTime: { value: 0 },
  uWaveAmp: { value: 0 },
  uWaveFreq: { value: 0.08 },
  uWaveSpeed: { value: 0.6 },
  uWaveRock: { value: 1 },
  uWind: { value: 0.35 },
};

const PARS_VERTEX = `
  attribute float aLayer;
  attribute float aGlow;
  attribute float aBaseY;
  attribute float aWind;
  uniform float uWind;
  attribute vec3 aEmissive;
  attribute vec3 aAnim;
  attribute vec4 aSpin;
  attribute vec2 aUv;
  uniform float uTime;
  flat varying float vLayer;
  flat varying float vGlow;
  flat varying vec3 vEmissive;
  flat varying vec3 vAnim;
  varying vec2 vAtlasUv;
  varying float vUp;
  varying float vFacing;
  ${WAVE_GLSL}
`;

const SPIN_POSITION = `
  if (aSpin.w != 0.0) {
    float ang = uTime * aSpin.w;
    float cs = cos(ang);
    float sn = sin(ang);
    vec3 rel = transformed - aSpin.xyz;
    transformed = aSpin.xyz + vec3(cs * rel.x + sn * rel.z, rel.y, -sn * rel.x + cs * rel.z);
  }
`;

const SPIN_NORMAL = `
  if (aSpin.w != 0.0) {
    float ang = uTime * aSpin.w;
    float cs = cos(ang);
    float sn = sin(ang);
    objectNormal = vec3(
      cs * objectNormal.x + sn * objectNormal.z,
      objectNormal.y,
      -sn * objectNormal.x + cs * objectNormal.z
    );
  }
`;

const PARS_FRAGMENT = `
  precision highp sampler2DArray;
  uniform sampler2DArray uAtlas;
  uniform sampler2D uRects;
  uniform float uLayerCount;
  uniform float uTime;
  uniform float uDuoAmount;
  uniform vec3 uDuoInk;
  uniform vec3 uDuoPaper;
  uniform float uGlowLevel;
  uniform float uGlowChance;
  uniform float uGlowTint;
  uniform float uGlowImage;
  uniform float uScrollShare;
  uniform float uSwapShare;
  uniform float uFlickerShare;
  // These are constant across a face, so interpolating them is not just
  // wasteful, it is wrong: a layer index of 5 can arrive as 4.999997 and
  // truncate to 4 for some pixels of a triangle, which pulls the wrong rect
  // out of the lookup and makes the image tear. flat fixes that at the source.
  flat varying float vLayer;
  flat varying float vGlow;
  flat varying vec3 vEmissive;
  flat varying vec3 vAnim;
  varying vec2 vAtlasUv;
  varying float vUp;
  varying float vFacing;
  uniform float uAo;
  uniform float uAoHeight;
  float ccLum(vec3 c) { return clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0); }
  float ccHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
`;

// Sample the array, pull the result toward the palette's ink and paper pair,
// and keep it around so the glow can borrow the same colour.
//
// Lit faces behave like real billboards. Which of them scroll, swap or flicker
// is decided here by comparing per-module tickets against uniforms, so the
// shares can be scrubbed without rebuilding anything. The uv arrives in the
// image's own 0..1 space and the rect is looked up by layer, which is what
// lets a swapped-in picture of a different shape still crop correctly.
const MAP = `
  vec3 ccTexel = vec3(1.0);
  bool ccHasImage = vLayer > -0.5;
  float ccLit = step(vGlow, uGlowChance);
  float ccFlickerOn = 1.0;
  if (ccHasImage) {
    float ccLayer = vLayer;
    vec2 ccLocal = vAtlasUv;
    bool ccScrolling = false;

    if (ccLit > 0.5) {
      if (step(vAnim.x, uScrollShare) > 0.5) {
        ccScrolling = true;
        ccLocal.x += uTime * (vAnim.x * 2.0 - 1.0) * 0.11;
      }
      if (step(vAnim.y, uSwapShare) > 0.5 && uLayerCount > 1.0) {
        float ccEvery = 5.0 + vAnim.y * 5.0;
        float ccStep = floor(uTime / ccEvery + vAnim.y * 13.0);
        ccLayer = mod(vLayer + ccStep * 7.0, uLayerCount);
      }
      if (step(vAnim.z, uFlickerShare) > 0.5) {
        float ccSlot = floor(uTime * 11.0 + vAnim.z * 57.0);
        ccFlickerOn = ccHash(ccSlot + vAnim.z * 31.0) > 0.13 ? 1.0 : 0.18;
      }
    }

    int ccIndex = int(ccLayer + 0.5);
    vec4 ccRect = texelFetch(uRects, ivec2(ccIndex, 0), 0);
    // Mip selection has to come off the unwrapped uv. Derivatives taken after
    // a fract blow up at the seam, the sampler drops to the sharpest level for
    // that pixel quad, and the result is the sparkle that shows up as soon as
    // a billboard starts scrolling.
    vec2 ccDx = dFdx(vAtlasUv) * ccRect.zw;
    vec2 ccDy = dFdy(vAtlasUv) * ccRect.zw;
    // Only a scrolling face wraps. A still one clamps, because a cover crop
    // can land exactly on 1.0 and fract would send it back to the far edge.
    vec2 ccWrapped = ccScrolling ? fract(ccLocal) : clamp(ccLocal, 0.0, 1.0);
    vec2 ccUv = ccRect.xy + ccWrapped * ccRect.zw;
    vec4 ccSample = textureGrad(uAtlas, vec3(ccUv, float(ccIndex)), ccDx, ccDy);
    float ccL = pow(ccLum(ccSample.rgb), 0.4545);
    vec3 ccDuo = mix(uDuoInk, uDuoPaper, smoothstep(0.02, 0.98, ccL));
    ccTexel = mix(ccSample.rgb, ccDuo, uDuoAmount);
    diffuseColor.rgb *= ccTexel;
  }
`;

// Which modules are lit is decided here rather than baked into the buffers,
// by comparing each module's glow ticket against the global chance. Turning
// "lit modules" up therefore lights modules that are already standing instead
// of regenerating the city around a shifted random stream.
//
// A lit face glows with its own image: the hue comes from the picture and the
// bright parts burn harder than the dark ones, so a neon sign lights up and
// its shadows stay down.
const EMISSIVE = `
  // A face glows with whatever it looks like: the picture on it, or the paint
  // if there is no picture. Only the image-lit ones get the luminance shaping,
  // since a flat colour has no bright and dark parts to separate.
  vec3 ccSource = ccHasImage ? ccTexel : vColor;
  float ccGl = ccLum(ccSource);
  vec3 ccTint = clamp(ccSource / max(0.2, ccGl), 0.0, 1.9);
  vec3 ccGlow = vEmissive * mix(vec3(1.0), ccTint, uGlowTint);
  if (ccHasImage) {
    ccGlow *= mix(1.0, smoothstep(0.10, 0.90, pow(ccGl, 0.4545)) * 1.75, uGlowImage);
  }
  totalEmissiveRadiance = ccGlow * uGlowLevel * ccLit * ccFlickerOn;

  // Contact shade. Darkest at the base of a building and on anything facing
  // the ground, fading out as it climbs. Emissive is left alone, so a lit sign
  // low down still reads as lit.
  if (uAo > 0.0) {
    float ccRise = smoothstep(0.0, max(0.05, uAoHeight), vUp);
    float ccDown = clamp(-vFacing, 0.0, 1.0);
    float ccShade = 1.0 - uAo * ((1.0 - ccRise) * 0.75 + ccDown * 0.45);
    diffuseColor.rgb *= clamp(ccShade, 0.0, 1.0);
  }
`;

export class CityMaterial {
  constructor() {
    this.uniforms = {
      ...shared,
      uAtlas: { value: null },
      uRects: { value: null },
      uLayerCount: { value: 1 },
      uAo: { value: 0.35 },
      uAoHeight: { value: 5 },
      uScrollShare: { value: 0.3 },
      uSwapShare: { value: 0.35 },
      uFlickerShare: { value: 0.18 },
      uGlowLevel: { value: 0.1 },
      uGlowChance: { value: 0.22 },
      uGlowTint: { value: 0.65 },
      uGlowImage: { value: 0.7 },
      uDuoAmount: { value: 0 },
      uDuoInk: { value: new THREE.Color('#16140f') },
      uDuoPaper: { value: new THREE.Color('#f7f2e6') },
    };

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
    this.patchSurface(this.material);

    // Shadows need the same vertex motion or spinning cards cast still ones.
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });
    this.patchDepth(this.depthMaterial);
  }

  bind(shader) {
    Object.entries(this.uniforms).forEach(([k, v]) => {
      shader.uniforms[k] = v;
    });
  }

  patchSurface(material) {
    material.onBeforeCompile = (shader) => {
      this.bind(shader);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${PARS_VERTEX}\nvoid main() {`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>\n${SPIN_NORMAL}\n${WAVE_BODY_NORMAL}`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vLayer = aLayer;
           vGlow = aGlow;
           vEmissive = aEmissive;
           vAnim = aAnim;
           vAtlasUv = aUv;
           // How far this vertex sits above the ground its building stands on,
           // and how far it faces downward. Between them that is enough for a
           // convincing contact shade without an occlusion pass.
           vUp = position.y - aBaseY;
           vFacing = normal.y;
           ${WIND_BODY}
           ${SPIN_POSITION}
           ${WAVE_BODY}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${PARS_FRAGMENT}\nvoid main() {`)
        .replace('#include <map_fragment>', MAP)
        .replace('#include <emissivemap_fragment>', EMISSIVE);
    };
    material.customProgramCacheKey = () => 'awesome-town-surface-' + shaderVersion();
  }

  // Shadows need the same vertex motion, or a bobbing town casts a still one.
  patchDepth(material) {
    material.onBeforeCompile = (shader) => {
      Object.entries(shared).forEach(([k, v]) => {
        shader.uniforms[k] = v;
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `attribute vec4 aSpin;
           attribute float aBaseY;
           attribute float aWind;
           uniform float uTime;
           uniform float uWind;
           ${WAVE_GLSL}
           void main() {`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${WIND_BODY}\n${SPIN_POSITION}\n${WAVE_BODY}`
        );
    };
    material.customProgramCacheKey = () => 'awesome-town-depth-' + shaderVersion();
  }

  setAtlas(pool) {
    this.uniforms.uAtlas.value = pool.texture;
    this.uniforms.uRects.value = pool.rectTexture;
    this.uniforms.uLayerCount.value = Math.max(1, pool.length);
  }

  // What share of lit faces behave like animated billboards.
  setBillboards(scroll, swap, flicker) {
    this.uniforms.uScrollShare.value = scroll;
    this.uniforms.uSwapShare.value = swap;
    this.uniforms.uFlickerShare.value = flicker;
  }

  // Wrapped, because a float32 clock that only ever grows loses the precision
  // these animations are built on. By a few thousand seconds a scroll offset
  // starts stepping instead of sliding.
  setTime(t) {
    shared.uTime.value = t % 3600;
  }

  setWind(strength) {
    shared.uWind.value = strength;
  }

  setOcclusion(amount, height) {
    this.uniforms.uAo.value = amount;
    this.uniforms.uAoHeight.value = height;
  }

  setWaves(amp, scale, speed, rock) {
    shared.uWaveAmp.value = amp;
    shared.uWaveFreq.value = waveFrequency(scale);
    shared.uWaveSpeed.value = speed;
    shared.uWaveRock.value = rock;
  }

  // Night drives how hard lit faces push, and the chance decides how many are
  // lit at all. Both are uniforms, so scrubbing either is free.
  setGlow(chance, strength, night) {
    this.uniforms.uGlowChance.value = chance;
    this.uniforms.uGlowLevel.value = strength * (0.04 + 0.62 * night * night);
  }

  setGlowResponse(tint, image) {
    this.uniforms.uGlowTint.value = tint;
    this.uniforms.uGlowImage.value = image;
  }

  setDuotone(amount, ink, paper) {
    this.uniforms.uDuoAmount.value = amount;
    this.uniforms.uDuoInk.value.set(ink);
    this.uniforms.uDuoPaper.value.set(paper);
  }

  dispose() {
    this.material.dispose();
    this.depthMaterial.dispose();
  }
}
