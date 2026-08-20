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
// Which way it turns, and how fast relative to the others. Zero means this
// sprite came out of the static folder and must not turn at all.
attribute float aSpin;
attribute float aColor;     // index into uColors

varying vec2 vUv;
flat varying float vLayer;
varying float vFade;
varying vec3 vColor;

uniform vec3 uColors[8];
uniform float uColorCount;

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

  // Billboard in view space, where the screen plane is XY by definition, so
  // no camera basis has to be passed in and no matrix inverted.
  //
  // **Upright means upright in the world, not upright on screen.** Those are
  // the same thing right up until the camera rolls, which the tour does every
  // time it banks into a turn — and a "static" sprite that rolled with it
  // would be the one thing static is supposed to rule out. So the quad's own
  // up axis is world up projected into the screen plane, rather than the
  // screen's up. Looking straight down there is no projection to speak of and
  // it falls back to the screen, which is the only sensible answer.
  vec3 upView = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
  vec2 up2 = upView.xy;
  float upLen = length(up2);
  up2 = upLen > 0.001 ? up2 / upLen : vec2(0.0, 1.0);
  vec2 right2 = vec2(up2.y, -up2.x);

  float size = uSize * aRoll.z;
  // A static sprite takes no rotation at all, not even its phase offset —
  // half a turn of "no rotation" is still not upright.
  vec2 corner = aCorner;
  if (aSpin != 0.0) {
    float angle = uTime * uSpin * aSpin + aRoll.x * 6.283;
    float s = sin(angle);
    float c = cos(angle);
    corner = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  }
  view.xy += (right2 * corner.x + up2 * corner.y) * size;

  vUv = aCorner + 0.5;
  vLayer = aLayer;
  int ci = int(min(aColor, max(0.0, uColorCount - 1.0)));
  vColor = uColors[ci];
  gl_Position = projectionMatrix * view;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uAtlas;
uniform sampler2D uRects;
uniform float uGlow;
uniform float uAdditive;
uniform float uOpacity;

varying vec2 vUv;
flat varying float vLayer;
varying float vFade;
varying vec3 vColor;

void main() {
  int index = int(vLayer + 0.5);
  // Same letterbox rect the city material reads, for the same reason: an
  // image is centred in a square layer and the padding around it is not part
  // of the picture.
  vec4 rect = texelFetch(uRects, ivec2(index, 0), 0);
  vec2 uv = rect.xy + vUv * rect.zw;
  vec4 texel = texture(uAtlas, vec3(uv, float(index)));

  // **A sprite is a shape, not a picture.** Only its alpha is read: the
  // colour is always one of the palette's, so what the file contains is the
  // silhouette and nothing else. That is the whole simplification — there is
  // no mode to choose, no tint to keep in step with the palette, and no way
  // for a particle field to end up a colour the town is not.
  float alpha = texel.a * vFade * uOpacity;
  if (alpha < 0.004) discard;

  // **Scaling preserves hue, clipping destroys it.** The old line multiplied
  // every channel by the same boost and let them run past 1.0, which is fine
  // for one channel and fatal for three: a warm amber at 2.5x is (2.5, 2.1,
  // 1.6), every channel clips to 1, and the particle renders pure white. That
  // is the entire reason these looked white in daylight.
  //
  // So the boost is applied and then the whole colour is rescaled until its
  // brightest channel sits at the ceiling. The ratio between channels — which
  // is the hue — comes through untouched at any glow setting, and the ceiling
  // still rises far enough past 1.0 to trip the bloom threshold.
  // The brightest channel is allowed to reach one and no further, and that
  // limit is the whole of the fix rather than a safety margin.
  //
  // A colour added to a background survives as a colour only while every
  // channel stays under one. Push the peak to 2.3 — which an unclamped glow
  // does easily — and a warm cream becomes (2.3, 2.1, 1.6), all three clip,
  // and the result is white. Not *approximately* white: exactly it. Whether
  // that happened in daylight or at midnight was only a question of which end
  // the overshoot came from.
  //
  // So glow moves the ceiling *within* the usable range instead of past it.
  // Dim at zero, full colour at one, and one is bright enough to trip bloom
  // on its own — the threshold is 0.9 falling to 0.74 after dark. Brightness
  // past that point has to come from the bloom pass, because the framebuffer
  // has nowhere else to put it.
  float ceiling = mix(0.45, 1.0, clamp(uGlow, 0.0, 1.0));
  vec3 lit = vColor;
  float peak = max(lit.r, max(lit.g, lit.b));
  lit *= ceiling / max(peak, 0.0001);

  // Premultiplied alpha, so the output alpha decides how this blends rather
  // than the material having to pick one mode for the whole scene:
  //
  //   alpha kept   -> ordinary alpha blend, an object with a colour
  //   alpha zeroed -> pure addition, a light
  //
  // Which means glow can slide between the two instead of choosing. That
  // matters most in daylight, where pure addition onto a bright sky can only
  // ever wash toward white however saturated the source is — a particle has
  // to be *drawn over* the sky to read as a colour against it. At night,
  // where addition is what makes light look like light, glow is high enough
  // to be fully additive anyway.
  gl_FragColor = vec4(lit * alpha, alpha * (1.0 - uAdditive));
}
`;

// A palette colour, pushed into the band where it is unmistakably a colour.
//
// Two failure modes to close, and they are the same one at opposite ends: a
// palette's paper white and its near-black ink are both perfectly good wall
// colours and both useless on a two-metre mote in the air — one reads as no
// colour and the other as no particle. Hue is never touched, so what comes
// out is still recognisably the palette's; only how saturated and how light
// it is are moved, and only when they are outside the band.
//
// The saturation floor is what makes a near-neutral come out tinted rather
// than grey. That is deliberate: asked for the town's colours you should get
// colours, and a monochrome palette should give a monochrome *hue*, not an
// absence of one.
function vivid(hex) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // The lightness ceiling is the load-bearing number. A pale colour cannot be
  // saturated — `(max-min)/max` on a cream is under 0.2 however high its HSL
  // saturation goes, because every channel is already near the top — so
  // letting a paper white through at lightness 0.7 produces a particle that
  // is technically tinted and reads as white anyway. Pulling the band down to
  // the middle is what turns it into a tan you can name.
  c.setHSL(
    hsl.h,
    Math.min(1, Math.max(0.55, hsl.s * 1.4)),
    Math.min(0.6, Math.max(0.4, hsl.l))
  );
  return c;
}

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
      // Eight slots, filled from the palette's glow colours or from a single
      // tint. Fixed length because a GLSL array has to have one; eight is
      // twice what any palette carries, so the cap has never been reached.
      uColors: { value: Array.from({ length: 8 }, () => new THREE.Color('#ffffff')) },
      uColorCount: { value: 1 },
      uGlow: { value: 0.6 },
      uAdditive: { value: 0.6 },
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
      // Premultiplied alpha rather than a fixed mode. `ONE, ONE_MINUS_SRC_ALPHA`
      // is an ordinary alpha blend when the fragment reports its alpha and a
      // pure add when it reports zero, so the shader gets to slide between
      // "an object with a colour" and "a light" per fragment. See FRAG.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
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
      // Baked into the attributes rather than read as a uniform, because it
      // is a property of each particle rather than of the field. So it has to
      // reach the key, unlike Speed itself.
      params.particleSpeedVariance,
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
    // Which layers spin, decided by which folder the file was in. A sprite is
    // picked uniformly across the whole pool and then *behaves* according to
    // where it came from, rather than the count being split by a ratio
    // somewhere: put more files in `rotating/` and more of the field spins,
    // which is the behaviour anyone would predict from the folders alone.
    const rotating = new Set(this.pool?.layersOfKind('rotating') || []);
    const verts = count * 6;
    const base = new Float32Array(verts * 3);
    const roll = new Float32Array(verts * 4);
    const corner = new Float32Array(verts * 2);
    const layer = new Float32Array(verts);
    const spin = new Float32Array(verts);
    const colour = new Float32Array(verts);

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
      // sheet and reads as a texture scrolling rather than as objects. The
      // spread is centred on one so that turning it down converges on exactly
      // the Speed slider's value rather than on some fraction of it — a
      // variance control that also changes the average is two controls
      // fighting.
      const spread = Math.min(1, Math.max(0, params.particleSpeedVariance ?? 0.5));
      const speed = 1 + spread * (rng.float() * 2 - 1) * 0.85;
      const scale = 0.45 + rng.float() * 1.1;
      const driftPhase = rng.float();
      const which = Math.floor(rng.float() * layers);
      // Zero is the flag for "never turn". A rotating sprite gets a direction
      // and its own rate, so a field of them does not turn in lockstep.
      const dir = rotating.has(which) ? (rng.float() < 0.5 ? -1 : 1) * (0.4 + rng.float() * 1.2) : 0;
      const tone = Math.floor(rng.float() * 8);

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
        colour[o] = tone;
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
    geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colour, 1));
    this.mesh.geometry = geo;
    this.spinning = Array.from(spin).filter((v, i) => i % 6 === 0 && v !== 0).length;
  }

  apply(params, night = 0, palette = null) {
    const u = this.uniforms;
    u.uRise.value = params.particleRise ?? 40;
    u.uSpeed.value = (params.particleSpeed ?? 1) * 0.05;
    u.uDrift.value = params.particleDrift ?? 3;
    u.uSize.value = params.particleSize ?? 1.2;
    u.uSpin.value = params.particleSpin ?? 0.3;
    u.uFloor.value = params.particleFloor ?? 0;
    u.uOpacity.value = params.particleOpacity ?? 0.7;
    // Glow no longer rides the clock, and that is a correction rather than a
    // simplification. It used to be scaled by night so one setting could work
    // at noon and midnight — but with the ceiling capped at one, a scaled
    // glow means the slider saturates at a different point every hour, and
    // most of its range is dead after dark. The hour still decides how these
    // read; it does it through `uAdditive` below, which is the mechanism that
    // was actually doing the work all along.
    u.uGlow.value = Math.min(1, Math.max(0, params.particleGlow ?? 0.6));

    // How much this reads as light rather than as an object.
    //
    // Weighted hard toward night rather than left to follow glow alone. In
    // daylight a particle has to be *drawn over* the sky to be a colour
    // against it, so it stays mostly solid however high the glow is turned;
    // after dark, addition is the whole reason light looks like light, so it
    // goes fully additive. One slider, two behaviours, and the hour decides
    // which — the same arrangement every other light in this town is under.
    u.uAdditive.value = Math.min(1, Math.max(0, u.uGlow.value)) * (0.3 + night * 0.7);

    // One answer to "what colour is this", always: the palette's.
    //
    // **Faces first, then glow.** Glow alone was the original choice and it
    // was wrong for the plain reason that a palette's glow list is its
    // *highlights* — newsprint's are `#ffd9a0`, `#fff4d6`, `#ff8f5e`, and the
    // middle one is white to two decimal places. Asking for "the palette's
    // colours" and getting three shades of hot cream is not what anybody
    // means. The faces are the colours the town is actually built out of, so
    // a particle sharing one is sharing a colour you can point at on a wall.
    //
    // Each is pushed into a band of saturation and lightness on the way
    // through, which is the step that guarantees the answer to "what colour
    // is this particle" is never "white" or "black". A palette that is nearly
    // monochrome — newsprint is — comes out as variations on its own single
    // hue rather than as grey, which is right: it should look like that town.
    const source = [...(palette?.faces || []), ...(palette?.glow || [])];
    const seen = new Set();
    const list = [];
    for (const hex of source) {
      const c = vivid(hex);
      const key = c.getHexString();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(c);
      if (list.length === 8) break;
    }
    if (!list.length) list.push(new THREE.Color('#ffffff'));
    for (let i = 0; i < 8; i++) u.uColors.value[i].copy(list[i % list.length]);
    u.uColorCount.value = list.length;
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  setVisible(on) {
    this.group.visible = Boolean(on);
  }
}
