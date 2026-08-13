// Percent-closer soft shadows.
//
// Plain PCF blurs every shadow by the same amount, which is why a building
// meeting the ground looks like it is hovering: the contact edge is as soft as
// the shadow fifty metres away. PCSS searches the shadow map for how far the
// blocker actually is, and widens the filter with that distance. Contact stays
// sharp, distance goes soft.
//
// This works by rewriting three's shadow chunk, so it applies to every
// material that receives shadows without any of them knowing about it. The
// light size is compiled in as a define, so changing it bumps a version that
// the materials' cache keys include, forcing a recompile. That is why the
// softness control commits on release rather than while dragging.

import * as THREE from 'three';

const ORIGINAL = THREE.ShaderChunk.shadowmap_pars_fragment;

let version = 0;
let installed = false;

// Materials fold this into their program cache key. Without it three would
// happily hand back the previously compiled program and the new light size
// would never take.
export function shaderVersion() {
  return version;
}

function chunk(lightSize, near, blockerSamples, filterSamples) {
  return /* glsl */ `
    #define PCSS_BLOCKER_SAMPLES ${blockerSamples}
    #define PCSS_FILTER_SAMPLES ${filterSamples}
    #define PCSS_LIGHT_SIZE ${lightSize.toFixed(5)}
    #define PCSS_NEAR ${near.toFixed(5)}

    float pcssRand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Vogel disk: golden-angle spiral with a sqrt radius, so sample density is
    // even across the disk. The previous ring-based layout bunched samples into
    // eleven rings, and a shadow edge crossing those rings scallops into the
    // regular comb of triangles that shows up along a soft edge.
    vec2 pcssVogel(int i, int count, float phase) {
      float r = sqrt((float(i) + 0.5) / float(count));
      float theta = float(i) * 2.39996323 + phase;
      return vec2(cos(theta), sin(theta)) * r;
    }

    // Rotation seeded off the continuous shadow coordinate, not the floored
    // texel. Flooring gives whole blocks of pixels the same rotation, which is
    // what makes the stepping visible as a pattern rather than dissolving it.
    // Continuous keeps it per-pixel while still being fixed to the world, so
    // it neither bands nor crawls when the camera moves.
    float pcssPhase(vec2 uv, vec2 mapSize) {
      return pcssRand(uv * mapSize * 0.37) * 6.2831853;
    }

    // How far away, on average, is whatever is casting onto this pixel.
    float pcssBlocker(sampler2D shadowMap, vec2 uv, float zReceiver, float searchRadius, float phase) {
      float sum = 0.0;
      float found = 0.0;
      for (int i = 0; i < PCSS_BLOCKER_SAMPLES; i++) {
        vec2 o = pcssVogel(i, PCSS_BLOCKER_SAMPLES, phase) * searchRadius;
        float depth = unpackRGBAToDepth(texture2D(shadowMap, uv + o));
        // Weighted rather than counted: a hard in-or-out test makes the
        // average jump as each sample crosses, and every jump is a step in the
        // penumbra width, which is a visible notch in the edge.
        float w = 1.0 - smoothstep(0.0, 0.0016, depth - zReceiver + 0.0016);
        sum += depth * w;
        found += w;
      }
      if (found < 0.001) return -1.0;
      return sum / found;
    }

    float pcssFilter(sampler2D shadowMap, vec2 uv, float zReceiver, float radius, float phase) {
      float sum = 0.0;
      for (int i = 0; i < PCSS_FILTER_SAMPLES; i++) {
        vec2 o = pcssVogel(i, PCSS_FILTER_SAMPLES, phase) * radius;
        float depth = unpackRGBAToDepth(texture2D(shadowMap, uv + o));
        // Soft compare, so a sample easing across the boundary contributes a
        // ramp instead of flipping the whole sample's worth at once.
        sum += smoothstep(-0.0007, 0.0007, depth - zReceiver);
      }
      return sum / float(PCSS_FILTER_SAMPLES);
    }

    float PCSS(sampler2D shadowMap, vec4 coords, vec2 mapSize, float scale) {
      vec2 uv = coords.xy;
      float zReceiver = coords.z;
      float phase = pcssPhase(uv, mapSize);

      float lightSize = PCSS_LIGHT_SIZE * clamp(scale, 0.05, 8.0);
      float searchRadius = lightSize * max(0.0, zReceiver - PCSS_NEAR) / max(1e-4, zReceiver);
      float blocker = pcssBlocker(shadowMap, uv, zReceiver, searchRadius, phase);
      // Nothing between this pixel and the light.
      if (blocker == -1.0) return 1.0;

      // The further the blocker sits above the receiver, the wider the
      // penumbra. This ratio is the whole trick.
      float penumbra = (zReceiver - blocker) / max(1e-4, blocker);
      // Never narrower than a texel, or the filter collapses to a point on
      // contact and the edge goes back to raw shadow-map stairs.
      float minRadius = 1.4 / max(mapSize.x, 1.0);
      float radius = clamp(penumbra * lightSize, minRadius, 0.03);
      return pcssFilter(shadowMap, uv, zReceiver, radius, phase);
    }
  `;
}

// lightSize is in shadow-map uv units: how wide the light appears from the
// receiver's point of view. Bigger means a softer, faster-spreading penumbra.
// In three's chunk the soft branch is an `#elif`, not an `#if` — matching the
// wrong one fails silently and leaves PCSS defined but never called, which
// looks exactly like it working badly. Hence the explicit check.
const SOFT_BRANCH = '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )';

// Filter samples decide how smooth an edge is; blocker samples decide how
// steadily the penumbra width is estimated. The filter needs more of the two.
export function installPCSS({ lightSize = 0.006, near = 0.02, quality = 32 } = {}) {
  if (!ORIGINAL.includes(SOFT_BRANCH)) {
    console.warn('PCSS: three shadow chunk changed shape, leaving stock shadows in place');
    return version;
  }
  const filterSamples = Math.max(8, Math.min(64, Math.round(quality)));
  const blockerSamples = Math.max(8, Math.round(filterSamples * 0.6));
  const source = ORIGINAL.replace(
    '#ifdef USE_SHADOWMAP',
    `#ifdef USE_SHADOWMAP\n${chunk(lightSize, near, blockerSamples, filterSamples)}`
  ).replace(
    SOFT_BRANCH,
    // Take over the soft branch, so the renderer's shadow type stays the
    // switch between soft (PCSS) and fast (plain PCF). The dead branch keeps
    // the original body attached to a define nothing sets.
    // shadowRadius and shadowMapSize are already parameters of getShadow, so
    // the softness control and the texel-stable seed both come free.
    `${SOFT_BRANCH}\n\t\t\treturn PCSS( shadowMap, shadowCoord, shadowMapSize, shadowRadius );\n\t\t#elif defined( AWESOME_TOWN_UNUSED_SOFT )`
  );
  THREE.ShaderChunk.shadowmap_pars_fragment = source;
  installed = true;
  version++;
  return version;
}

export function isInstalled() {
  return installed;
}
