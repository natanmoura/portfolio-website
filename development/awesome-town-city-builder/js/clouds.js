// Shadows cast by clouds nobody drew.
//
// No sky is textured and nothing is rendered above the town to cast these —
// it is a soft-edged noise field sampled directly against world XZ, scrolled
// by a wind direction, and multiplied straight into the albedo everywhere the
// ground and the buildings already read `position.xz` as world space (see
// terrain.js's own header on why that is true here). That is what lets one
// function patch both without either owning geometry the other does not have.
//
// Kept out of the light itself on purpose. A real cloud dims the sun for
// everything under it at once, but doing that here would mean reading back a
// world position in `Stage.apply`, which runs once for the whole scene rather
// than once per pixel — the whole point of a shadow that drifts is that two
// buildings ten metres apart can disagree about whether they are under one.
// Multiplying the surface colour is the cheap way to keep that per-pixel.

export const CLOUDS_GLSL = `
  uniform float uCloudAmount;
  uniform float uCloudScale;
  uniform float uCloudSpeed;
  uniform vec2 uCloudDir;

  float ccCloudHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float ccCloudNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = ccCloudHash(i);
    float b = ccCloudHash(i + vec2(1.0, 0.0));
    float c = ccCloudHash(i + vec2(0.0, 1.0));
    float d = ccCloudHash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  // Three octaves is enough for cloud-sized blobs — a fourth only adds
  // texture too fine to read as anything but noise from a moving frame.
  float ccCloudFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 3; i++) {
      v += amp * ccCloudNoise(p);
      p *= 2.05;
      amp *= 0.5;
    }
    return v;
  }
  // 1 in the clear, down to 1 - uCloudAmount under the thickest cover.
  // Shaped with smoothstep rather than used raw, so the ground reads as
  // soft-edged patches drifting past rather than a rippling grey wash.
  float ccCloudAt(vec2 worldXZ) {
    if (uCloudAmount <= 0.0) return 1.0;
    vec2 p = worldXZ / max(4.0, uCloudScale) - uCloudDir * uTime * uCloudSpeed;
    float shadow = smoothstep(0.38, 0.66, ccCloudFbm(p));
    return 1.0 - shadow * uCloudAmount;
  }
`;
