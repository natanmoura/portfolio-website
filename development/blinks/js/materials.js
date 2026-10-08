import * as THREE from 'three';

export const REFLECT = { value: 0 };
export const REFLECT_FADE = { value: 0.9 };
export const REFLECT_SOFT = { value: 1 };
export const LIGHT_DIR = new THREE.Vector3(-0.45, 0.9, 0.55).normalize();

const GRAIN = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

// The body's colour is a slowly drifting field of soft colour blobs sampled
// along the view ray inside the body, so the swirl has real parallax when the
// camera orbits. Lighting is soft wrap plus a milky rim that fades to white.
const bodyVert = /* glsl */ `
uniform vec3 uLag;
uniform vec3 uGroupOff[4];
uniform float uWarp;
attribute vec4 groupW;
uniform vec2 uHeight;
uniform float uTime;
uniform float uTremble;
uniform float uSize;
varying vec3 vLocal;
varying vec3 vPosW;
varying vec3 vNormalW;
varying float vH;
void main() {
  vec3 p = position;
  float h = clamp((p.y - uHeight.x) / (uHeight.y - uHeight.x), 0.0, 1.0);
  vH = h;
  p += uLag * h * h;
  if (uWarp > 0.0) {
    vec3 q = position * (2.6 / uSize);
    float n = sin(q.x * 3.1 + uTime * 5.3) * sin(q.y * 2.7 - uTime * 4.1) * sin(q.z * 3.4 + uTime * 6.2)
            + 0.5 * sin(q.x * 6.3 - uTime * 7.0 + q.z * 2.0) * sin(q.y * 5.9 + uTime * 5.5);
    p += normal * n * uWarp;
  }
  p += uGroupOff[0] * groupW.x + uGroupOff[1] * groupW.y + uGroupOff[2] * groupW.z + uGroupOff[3] * groupW.w;
  p += normal * sin(uTime * 34.0 + p.y * 6.0) * uTremble * 0.018 * uSize;
  vLocal = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const bodyFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uBase;
uniform vec4 uBlobPos[4];
uniform vec3 uBlobCol[4];
uniform vec3 uCamLocal;
uniform float uSize;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uGrey;
uniform float uFlash;
uniform vec3 uLightDir;
uniform float uAlpha;
uniform float uReflect;
uniform float uReflectFade;
uniform float uReflectSoft;
uniform float uCloud;
varying vec3 vLocal;
varying vec3 vPosW;
varying vec3 vNormalW;
varying float vH;
${GRAIN}
// Blobs claim regions of the body with soft borders instead of averaging,
// so two parents' colours sit side by side rather than turning to grey.
vec3 field(vec3 p) {
  p += 0.16 * uSize * sin(p.yzx * (3.6 / uSize) + uTime * vec3(0.7, 0.83, 0.61));
  float L[4];
  float m = -1.6;
  for (int i = 0; i < 4; i++) {
    vec3 d = p - uBlobPos[i].xyz;
    float r = uBlobPos[i].w;
    L[i] = -dot(d, d) / (r * r);
    m = max(m, L[i]);
  }
  const float SHARP = 7.0;
  float wb = exp((-1.6 - m) * SHARP);
  vec3 acc = uBase * wb;
  float ws = wb;
  for (int i = 0; i < 4; i++) {
    float w = exp((L[i] - m) * SHARP);
    acc += uBlobCol[i] * w;
    ws += w;
  }
  return acc / ws;
}
void main() {
  vec3 dir = normalize(vLocal - uCamLocal);
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  float stepL = uSize * 0.11;
  for (int k = 0; k < 6; k++) {
    float w = exp(-float(k) * 0.9);
    col += field(vLocal + dir * stepL * float(k)) * w;
    wsum += w;
  }
  col /= wsum;
  col = mix(col, uTint, uTintAmt);
  // Ageing fades to one flat grey, so the drifting colour shapes disappear too.
  col = mix(col, vec3(0.64), uGrey);

  // Flat colour: no shading, highlights or rim.
  if (vPosW.y < -0.002) discard;
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vPosW);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.035;
  col = mix(col, vec3(1.0), uFlash);
  col = mix(col, vec3(1.0), uReflect * smoothstep(uReflectFade * (1.0 - uReflectSoft), uReflectFade, vPosW.y));
  gl_FragColor = vec4(col, uAlpha * (1.0 - pow(fres, 0.6) * uCloud));
}
`;

export function createBodyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: bodyVert,
    fragmentShader: bodyFrag,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Vector3() },
      uBlobPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0.4)) },
      uBlobCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
      uCamLocal: { value: new THREE.Vector3() },
      uSize: { value: 1 },
      uLag: { value: new THREE.Vector3() },
      uGroupOff: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
      uWarp: { value: 0 },
      uAlpha: { value: 1 },
      uReflect: REFLECT,
      uReflectFade: REFLECT_FADE,
      uReflectSoft: REFLECT_SOFT,
      uCloud: { value: 0 },
      uHeight: { value: new THREE.Vector2(0, 1) },
      uTremble: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 0.5, 0.6) },
      uTintAmt: { value: 0 },
      uGrey: { value: 0 },
      uFlash: { value: 0 },
      uLightDir: { value: LIGHT_DIR },
    },
  });
}

const legVert = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const legFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uReflect;
uniform float uReflectFade;
uniform float uReflectSoft;
uniform float uGrey;
uniform vec3 uTint;
uniform float uTintAmt;
uniform vec3 uLightDir;
varying vec3 vNormalW;
varying vec3 vPosW;
${GRAIN}
void main() {
  if (vPosW.y < -0.002) discard;
  vec3 col = uColor;
  col = mix(col, vec3(1.0), uReflect * smoothstep(uReflectFade * (1.0 - uReflectSoft), uReflectFade, vPosW.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createLegMaterial(color) {
  return new THREE.ShaderMaterial({
    vertexShader: legVert,
    fragmentShader: legFrag,
    uniforms: {
      uColor: { value: new THREE.Vector3(...color) },
      uReflect: REFLECT,
      uReflectFade: REFLECT_FADE,
      uReflectSoft: REFLECT_SOFT,
      uGrey: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 0.3, 0.3) },
      uTintAmt: { value: 0 },
      uLightDir: { value: LIGHT_DIR },
    },
  });
}
