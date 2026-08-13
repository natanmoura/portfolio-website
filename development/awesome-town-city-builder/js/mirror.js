// Screen-space reflection, for the mirror material only.
//
// Every other material in this city can fake its lighting with a static
// bake — a concrete texture does not need to know what is next to it, and
// even glass gets away with reflecting nothing but the sky. A mirror is the
// one surface where "reflects nothing but the sky" reads as obviously wrong:
// the whole point is seeing the rest of the city in it.
//
// Real-time reflections normally mean a cubemap per reflective object, which
// does not fit a city that merges thousands of buildings into a few dozen
// draw calls — a cubemap wants its own render of the world, and doing that
// per mirrored building is the kind of cost this project has avoided
// everywhere else. Screen space is the cheap way out: whatever is already
// visible on screen can be found again by marching the ray this pixel
// reflects through the depth buffer already sitting there for SSAO. It only
// shows what the camera can already see, and a ray that leaves the screen or
// finds nothing falls back to the same analytic sky the dome itself draws,
// so a mirror never goes black just because its reflection walked off frame.
//
// Which pixels are mirror at all travels through the alpha channel of the
// scene's own colour target — see the output_fragment hook in material.js.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform mat4 uProj;
  uniform mat4 uProjInv;
  uniform mat4 uViewInv;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uSunAmount;
  varying vec2 vUv;

  vec3 viewFromDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * clip;
    return view.xyz / view.w;
  }

  // The same gradient the sky dome itself draws, so a ray that walks off
  // screen fades into the real sky instead of an unrelated flat colour.
  vec3 skyColor(vec3 dir) {
    float t = smoothstep(-0.15, 0.55, dir.y);
    vec3 c = mix(uSkyBottom, uSkyTop, t);
    float halo = pow(max(0.0, dot(dir, normalize(uSunDir))), 6.0);
    return c + uSunColor * halo * uSunAmount;
  }

  void main() {
    vec4 base = texture2D(tDiffuse, vUv);
    // Alpha above 0.5 is everything that is not a mirror face — pass it
    // through untouched and hand the alpha channel back clean, since nothing
    // past this point in the composer should ever see the mask again.
    if (base.a > 0.5) {
      gl_FragColor = vec4(base.rgb, 1.0);
      return;
    }

    vec3 p = viewFromDepth(vUv);
    // Normal off the depth gradient, same trick SSAO uses and for the same
    // reason: geometry here can have moved in the vertex shader, so this is
    // the only normal guaranteed to match what was actually drawn.
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    if (dot(n, normalize(-p)) < 0.0) n = -n;
    vec3 viewDir = normalize(p);
    vec3 rDir = reflect(viewDir, n);

    // Step size scales with distance from the camera, so a mirror far away
    // still covers meaningful ground in a fixed number of steps instead of
    // crawling at the same pace a close-up one needs.
    float stepLen = max(0.06, -p.z * 0.025);
    vec3 rayPos = p;
    bool hit = false;
    vec2 hitUv = vec2(0.0);
    for (int i = 0; i < 48; i++) {
      rayPos += rDir * stepLen;
      stepLen *= 1.055;
      vec4 clip = uProj * vec4(rayPos, 1.0);
      if (clip.w <= 0.0) break;
      vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
      if (suv.x <= 0.0 || suv.x >= 1.0 || suv.y <= 0.0 || suv.y >= 1.0) break;
      float sceneZ = viewFromDepth(suv).z;
      // View space runs negative into the screen. Once the ray is behind
      // whatever the depth buffer says is there, it just passed through it.
      if (rayPos.z <= sceneZ) {
        hit = true;
        hitUv = suv;
        break;
      }
    }

    vec3 result;
    if (hit) {
      result = texture2D(tDiffuse, hitUv).rgb;
    } else {
      vec3 worldDir = normalize((uViewInv * vec4(rDir, 0.0)).xyz);
      result = skyColor(worldDir);
    }
    gl_FragColor = vec4(result, 1.0);
  }
`;

export class MirrorPass extends Pass {
  constructor(depthTexture) {
    super();
    this.needsSwap = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: depthTexture },
        uProj: { value: new THREE.Matrix4() },
        uProjInv: { value: new THREE.Matrix4() },
        uViewInv: { value: new THREE.Matrix4() },
        uSkyTop: { value: new THREE.Color('#8fb6ff') },
        uSkyBottom: { value: new THREE.Color('#dcd7c8') },
        uSunColor: { value: new THREE.Color('#fff0d0') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunAmount: { value: 0.5 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  // Matches the sky dome's own uniforms, so the fallback for a ray that
  // leaves the screen is the same sky the camera would otherwise be looking
  // straight at.
  setSky(top, bottom, sunColor, sunDir, sunAmount) {
    const u = this.material.uniforms;
    u.uSkyTop.value.copy(top);
    u.uSkyBottom.value.copy(bottom);
    u.uSunColor.value.copy(sunColor);
    u.uSunDir.value.copy(sunDir);
    u.uSunAmount.value = sunAmount;
  }

  apply(camera) {
    const u = this.material.uniforms;
    u.uProj.value.copy(camera.projectionMatrix);
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uViewInv.value.copy(camera.matrixWorld);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}
