// The water the town floats on.
//
// Two crossing sine waves, cheap enough to evaluate per vertex. The same
// function exists twice on purpose: once as GLSL for the ground, the buildings
// and the shadow pass, and once as JS so picking and the selection outline
// agree with what is on screen. If you change one, change the other.

export const WAVE_GLSL = `
  uniform float uWaveAmp;
  uniform float uWaveFreq;
  uniform float uWaveSpeed;
  uniform float uWaveRock;

  float ccWaveAt(vec2 p) {
    if (uWaveAmp <= 0.0) return 0.0;
    float a = p.x * uWaveFreq + uTime * uWaveSpeed;
    float b = (p.y * 0.87 - p.x * 0.31) * uWaveFreq * 1.37 + uTime * uWaveSpeed * 0.79;
    return uWaveAmp * (sin(a) * 0.62 + sin(b) * 0.38);
  }

  // Slope of the surface, used to tilt whatever is sitting on it.
  vec2 ccWaveSlope(vec2 p) {
    if (uWaveAmp <= 0.0) return vec2(0.0);
    float a = p.x * uWaveFreq + uTime * uWaveSpeed;
    float b = (p.y * 0.87 - p.x * 0.31) * uWaveFreq * 1.37 + uTime * uWaveSpeed * 0.79;
    float f2 = uWaveFreq * 1.37;
    return vec2(
      uWaveAmp * (cos(a) * uWaveFreq * 0.62 - cos(b) * f2 * 0.31 * 0.38),
      uWaveAmp * (cos(b) * f2 * 0.87 * 0.38)
    );
  }
`;

// Lift and tilt a building as one rigid body about its base, so a stack rides
// the swell instead of shearing apart.
export const WAVE_BODY = `
  if (uWaveAmp > 0.0) {
    vec3 ccAnchor = vec3(aSpin.x, aBaseY, aSpin.z);
    vec2 ccSlope = ccWaveSlope(ccAnchor.xz) * uWaveRock;
    vec3 ccRel = transformed - ccAnchor;
    transformed = ccAnchor + vec3(
      ccRel.x - ccRel.y * ccSlope.x,
      ccRel.y + ccRel.x * ccSlope.x + ccRel.z * ccSlope.y,
      ccRel.z - ccRel.y * ccSlope.y
    );
    transformed.y += ccWaveAt(ccAnchor.xz);
  }
`;

// Cloth. Displaced in a small circle rather than along its own normal, because
// the two sides of a flag carry opposite normals and would tear apart. Both
// faces share a weight and a phase, so they move as one piece.
export const WIND_BODY = `
  if (aWind > 0.0 && uWind > 0.0) {
    float ccW = aWind * aWind * uWind;
    float ccPh = uTime * 2.4 + aSpin.x * 0.63 + aSpin.z * 0.41;
    transformed.x += sin(ccPh) * ccW;
    transformed.z += cos(ccPh * 0.92) * ccW * 0.7;
    transformed.y += sin(ccPh * 1.7) * ccW * 0.22;
  }
`;

export const WAVE_BODY_NORMAL = `
  if (uWaveAmp > 0.0) {
    vec2 ccSlopeN = ccWaveSlope(vec2(aSpin.x, aSpin.z)) * uWaveRock;
    vec3 ccN = objectNormal;
    objectNormal = vec3(
      ccN.x - ccN.y * ccSlopeN.x,
      ccN.y + ccN.x * ccSlopeN.x + ccN.z * ccSlopeN.y,
      ccN.z - ccN.y * ccSlopeN.y
    );
  }
`;

// --- JS mirror -------------------------------------------------------------

// Wave size one puts roughly three crests across a ten by ten town, which is
// where it starts reading as water rather than as a tilted floor.
export function waveFrequency(scale) {
  return 0.35 / Math.max(0.03, scale);
}

export const waveState = { amp: 0, freq: 0.35, speed: 0.6, rock: 1, time: 0 };

export function waveAt(x, z) {
  const { amp, freq, speed, time } = waveState;
  if (amp <= 0) return 0;
  const a = x * freq + time * speed;
  const b = (z * 0.87 - x * 0.31) * freq * 1.37 + time * speed * 0.79;
  return amp * (Math.sin(a) * 0.62 + Math.sin(b) * 0.38);
}

export function waveSlope(x, z) {
  const { amp, freq, speed, time, rock } = waveState;
  if (amp <= 0) return [0, 0];
  const a = x * freq + time * speed;
  const b = (z * 0.87 - x * 0.31) * freq * 1.37 + time * speed * 0.79;
  const f2 = freq * 1.37;
  return [
    amp * (Math.cos(a) * freq * 0.62 - Math.cos(b) * f2 * 0.31 * 0.38) * rock,
    amp * (Math.cos(b) * f2 * 0.87 * 0.38) * rock,
  ];
}
