// Things rising off the town.
//
// Stars, sparks, motes, whatever is in `collage/particles/` — drifting up out
// of the streets and fading out somewhere above the roofline. The whole point
// is that a still frame of this town is a collage of photographs, and a
// *moving* frame of it should have something in the air that says the picture
// is alive. Traffic already does that at ground level; this does it in the
// volume above.
//
// **Every particle is animated in the vertex shader.** Nothing here runs per
// frame on the CPU: position, drift, spin, fade and size are all functions of
// one `uTime` uniform and a handful of per-particle attributes rolled once at
// build time. Ten thousand of them cost one uniform write a frame, which is
// what makes it reasonable to have ten thousand.
//
// **They are billboarded quads, not points.** `THREE.Points` would have been
// less code and is the wrong tool twice over: gl_PointSize is clamped by the
// driver at values this scene reaches, and a point sprite cannot be rotated,
// so every star would sit at the same angle. Two triangles each, expanded
// along the camera's own right and up vectors in view space.
//
// **The hologram look is transparency plus additive light, not a colour.**
// Additive blending is what makes overlapping motes brighten instead of
// occluding each other, `depthWrite: false` is what stops them punching holes
// in one another, and the emissive push feeding the bloom pass is what makes a
// small bright shape read as light rather than as a sticker. All three
// together, or it looks like confetti.

import * as THREE from 'three';
import { Rng } from './rng.js';

const VERT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uRise;        // metres travelled over one life
uniform float uSpeed;       // lives per second
uniform float uDrift;       // how far it wanders sideways on the way up
uniform float uSize;
uniform float uSpin;
uniform float uFloor;       // where a life starts, relative to its own base

attribute vec3 aBase;       // where this one lives, in world XZ plus ground Y
attribute vec4 aRoll;       // phase, speed scale, size scale, drift phase
attribute vec2 aCorner;     // which corner of the quad, in [-0.5, 0.5]
attribute float aLayer;
attribute float aSpinDir;

varying vec2 vUv;
flat varying float vLayer;
varying float vFade;

void main() {
  // One life, wrapped. Every particle is at a different point in the same
  // cycle because its phase was rolled once, which is why this needs no
  // spawner, no pool and no per-particle state on the CPU.
  float life = fract(uTime * uSpeed * aRoll.y + aRoll.x);

  vec3 world = aBase;
  world.y += uFloor + life * uRise;

  // Sideways wander. Two sines at unrelated rates so the path never reads as
  // a circle, scaled by height so a mote leaves the street straight and only
  // starts to wander once it is clear of it.
  float wander = life * uDrift;
  world.x += sin(uTime * 0.21 + aRoll.w * 6.283) * wander;
  world.z += cos(uTime * 0.17 + aRoll.w * 8.977) * wander;

  // In at the bottom, out at the top, and never fully on at either end. A
  // particle that pops into existence at full strength is the single thing
  // that gives away a looping system.
  vFade = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.55, 1.0, life));

  vec4 view = viewMatrix * vec4(world, 1.0);

  // Billboard in view space, where right and up are the axes by definition,
  // so no camera basis has to be passed in and no matrix inverted.
  float size = uSize * aRoll.z;
  float angle = uTime * uSpin * aSpinDir + aRoll.x * 6.283;
  float s = sin(angle);
  float c = cos(angle);
  vec2 corner = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c) * size;
  view.xy += corner;

  vUv = aCorner + 0.5;
  vLayer = aLayer;
  gl_Position = projectionMatrix * view;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uAtlas;
uniform sampler2D uRects;
uniform vec3 uTint;
uniform float uTintAmount;
uniform float uGlow;
uniform float uOpacity;

varying vec2 vUv;
flat varying float vLayer;
varying float vFade;

void main() {
  int index = int(vLayer + 0.5);
  // Same letterbox rect the city material reads, for the same reason: an
  // image is centred in a square layer and the padding around it is not part
  // of the picture.
  vec4 rect = texelFetch(uRects, ivec2(index, 0), 0);
  vec2 uv = rect.xy + vUv * rect.zw;
  vec4 texel = texture(uAtlas, vec3(uv, float(index)));

  // Cheap cutouts. These are drawn additively, so a black background
  // contributes nothing anyway — but a source with a hard alpha channel
  // should not have its edge pixels smeared by the mip chain either.
  float alpha = texel.a * vFade * uOpacity;
  if (alpha < 0.004) discard;

  vec3 colour = mix(texel.rgb, uTint, uTintAmount);
  // Glow multiplies rather than adds, so a dark part of a sprite stays dark
  // and a bright one runs past 1.0 into the bloom pass. That difference is
  // what makes the shape legible while it glows instead of dissolving into a
  // uniform blob of light.
  gl_FragColor = vec4(colour * (1.0 + uGlow * 3.0) * alpha, alpha);
}
`;

export class Particles {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uRise: { value: 40 },
      uSpeed: { value: 0.05 },
      uDrift: { value: 3 },
      uSize: { value: 1.2 },
      uSpin: { value: 0.3 },
      uFloor: { value: 0 },
      uAtlas: { value: null },
      uRects: { value: null },
      uTint: { value: new THREE.Color('#8fd8ff') },
      uTintAmount: { value: 0 },
      uGlow: { value: 0.6 },
      uOpacity: { value: 0.7 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      // No depth write, or two particles at the same distance each punch a
      // hole in the other and the whole field flickers as the camera moves.
      depthWrite: false,
      // Depth *test* stays on: a mote behind a building is behind it.
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.count = 0;
    this.key = '';
  }

  setPool(pool) {
    this.pool = pool;
    this.uniforms.uAtlas.value = pool?.texture || null;
    this.uniforms.uRects.value = pool?.rectTexture || null;
    // A pool that arrived after the field was built leaves every quad pointing
    // at a layer that did not exist yet, so the field has to be rebuilt rather
    // than merely re-pointed.
    this.key = '';
  }

  // Where the particles live. `region` gives the town's real footprint, so a
  // boundary you drew is the shape they rise out of rather than the square it
  // sits in — the same reasoning the tour's fallback circle already uses.
  build(params, region, groundAt) {
    const layers = this.pool?.length || 0;
    const count = layers ? Math.max(0, Math.round(params.particleCount || 0)) : 0;
    const bounds = region?.bounds || { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    // Rebuilt only when something structural changed. Everything expressive —
    // size, speed, glow, tint, how high they climb — is a uniform, so dragging
    // any of those sliders costs nothing at all.
    const key = [
      count,
      layers,
      params.seed,
      Math.round(bounds.minX),
      Math.round(bounds.maxX),
      Math.round(bounds.minZ),
      Math.round(bounds.maxZ),
    ].join('|');
    if (key === this.key) return;
    this.key = key;
    this.count = count;

    this.mesh.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    if (!count) {
      this.mesh.geometry = geo;
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const rng = new Rng(((params.seed >>> 0) ^ 0x5bf03635) >>> 0);
    const verts = count * 6;
    const base = new Float32Array(verts * 3);
    const roll = new Float32Array(verts * 4);
    const corner = new Float32Array(verts * 2);
    const layer = new Float32Array(verts);
    const spin = new Float32Array(verts);

    // Two triangles, as six loose vertices. Indexing would save a third of the
    // buffer and cost a shared attribute per corner, which is the one thing
    // these quads cannot have — every vertex needs its own corner offset.
    const CORNERS = [
      [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5],
      [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5],
    ];

    for (let i = 0; i < count; i++) {
      const x = bounds.minX + rng.float() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + rng.float() * (bounds.maxZ - bounds.minZ);
      const y = groundAt ? groundAt(x, z) : 0;
      const phase = rng.float();
      // Speed and size vary per particle, or the whole field moves as one
      // sheet and reads as a texture scrolling rather than as objects.
      const speed = 0.55 + rng.float() * 0.9;
      const scale = 0.45 + rng.float() * 1.1;
      const driftPhase = rng.float();
      const which = Math.floor(rng.float() * layers);
      const dir = rng.float() < 0.5 ? -1 : 1;

      for (let v = 0; v < 6; v++) {
        const o = i * 6 + v;
        base[o * 3] = x;
        base[o * 3 + 1] = y;
        base[o * 3 + 2] = z;
        roll[o * 4] = phase;
        roll[o * 4 + 1] = speed;
        roll[o * 4 + 2] = scale;
        roll[o * 4 + 3] = driftPhase;
        corner[o * 2] = CORNERS[v][0];
        corner[o * 2 + 1] = CORNERS[v][1];
        layer[o] = which;
        spin[o] = dir;
      }
    }

    // `position` has to exist and be sane even though the shader never reads
    // it: three.js sizes the draw call from it and computes bounds from it,
    // and frustum culling is off precisely because those bounds are a lie
    // once the vertex shader starts moving things.
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aRoll', new THREE.BufferAttribute(roll, 4));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
    geo.setAttribute('aSpinDir', new THREE.BufferAttribute(spin, 1));
    this.mesh.geometry = geo;
  }

  apply(params, night = 0) {
    const u = this.uniforms;
    u.uRise.value = params.particleRise ?? 40;
    u.uSpeed.value = (params.particleSpeed ?? 1) * 0.05;
    u.uDrift.value = params.particleDrift ?? 3;
    u.uSize.value = params.particleSize ?? 1.2;
    u.uSpin.value = params.particleSpin ?? 0.3;
    u.uFloor.value = params.particleFloor ?? 0;
    u.uOpacity.value = params.particleOpacity ?? 0.7;
    u.uTintAmount.value = params.particleTintAmount ?? 0;
    u.uTint.value.set(params.particleTint || '#8fd8ff');
    // Glow rides the clock the way every other light in the town does: the
    // same setting has to survive noon without washing the frame out and
    // still register at midnight, and a fixed value cannot do both.
    u.uGlow.value = (params.particleGlow ?? 0.6) * (0.45 + night * 0.9);
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  setVisible(on) {
    this.group.visible = Boolean(on);
  }
}
