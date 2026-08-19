// Renderer, camera, and the day/night rig.
//
// One directional light walks an arc and turns into moonlight on the far side.
// Bloom rides the same night curve. Fog and sky are pulled out as their own
// controls, since haze depth and sky colour are what a shot is usually built
// around.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Ground } from './terrain.js';
import { LooksPass } from './looks.js';
import { SsaoPass } from './ssao.js';
import { MirrorPass } from './mirror.js';
import { installPCSS, shaderVersion } from './pcss.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

export class Stage {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // so snapshots can read the canvas back
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    // Plain PCF rather than the soft variant, because only this one honours
    // light.shadow.radius, which is what makes softness adjustable at all.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#dcd7c8', 60, 400);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
    this.camera.position.set(60, 40, 70);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // Almost all the way round, so you can stand in the street and look up at
    // the towers. Going under the ground is prevented by a floor check after
    // the controls have had their say, rather than by locking the angle.
    this.controls.maxPolarAngle = Math.PI * 0.97;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 1500;

    this.sun = new THREE.DirectionalLight('#fff3e0', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#bfd3ff', '#8a7f6e', 0.6);
    this.scene.add(this.hemi);

    // A cool fill from behind and opposite the sun. Costs one more light and
    // does most of the work of separating one grey block from the next, which
    // ambient alone flattens.
    this.fill = new THREE.DirectionalLight('#9ec4ff', 0.5);
    this.scene.add(this.fill);

    // A vertical gradient instead of a flat background colour. Sits on the far
    // side of everything with depth writing off, so it costs one quad.
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color('#8fb6ff') },
        uBottom: { value: new THREE.Color('#dcd7c8') },
        uSun: { value: new THREE.Color('#fff0d0') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunAmount: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSun;
        uniform vec3 uSunDir; uniform float uSunAmount;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float t = smoothstep(-0.15, 0.55, d.y);
          vec3 c = mix(uBottom, uTop, t);
          // A broad warm lift where the sun is, so the sky has a direction.
          float halo = pow(max(0.0, dot(d, normalize(uSunDir))), 6.0);
          c += uSun * halo * uSunAmount;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.skyMaterial);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // A cheap, low-res bake of the same gradient sky, so the glass shader has
    // something believable to reflect without a real-time cubemap. Reuses the
    // sky's own uniforms, so it only ever needs a small standalone scene.
    this.envScene = new THREE.Scene();
    // Radius well clear of the bake camera's near plane — at radius 1 the
    // sphere sits exactly on it and gets clipped away, which is what a black
    // "reflection" actually was.
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8), this.skyMaterial));
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this._envKey = '';
    this._envAt = -Infinity;

    this.ground = new Ground();
    this.scene.add(this.ground.group);

    // The scene is rendered into a target this class owns, rather than into
    // one of the composer's ping-pong buffers. Depth of field needs the scene
    // depth, and a depth texture hung off the composer's buffers never gets
    // written: they swap every pass, and only one framebuffer can own a given
    // depth attachment. Owning the target makes it unambiguous.
    this.depthTexture = new THREE.DepthTexture(1, 1);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthTexture: this.depthTexture,
    });

    this.composer = new EffectComposer(this.renderer);
    this.inputPass = new TexturePass(this.sceneTarget.texture);
    this.inputPass.material.blending = THREE.NoBlending;
    this.inputPass.clear = true;
    this.composer.addPass(this.inputPass);

    // Occlusion goes in before bloom, because it is a lighting term: a corner
    // that should be dark must not be allowed to bloom first and then be
    // darkened afterwards.
    this.ssao = new SsaoPass(this.depthTexture);
    this.composer.addPass(this.ssao);

    // After occlusion, so a mirror reflects buildings with their contact
    // shade already on them, and before bloom, so a bright reflected sign
    // still blooms rather than pasting in an already-tonemapped pixel.
    this.mirror = new MirrorPass(this.depthTexture);
    this.composer.addPass(this.mirror);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // After tone mapping, so posterising and the dot screen work on the
    // colours that actually reach the screen.
    this.looks = new LooksPass();
    this.looks.uniforms.tDepth.value = this.depthTexture;
    this.composer.addPass(this.looks);

    // Rendering through a composer means the canvas MSAA never applies, so
    // edges have been aliased this whole time. One cheap screen-space pass
    // buys them back.
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);

    this.useBloom = true;
    this.night = 0;
    this.extent = 64;
    this.viewDist = 140;

    // Scratch for the light-space texel snapping, kept off the hot path.
    this._lightRot = new THREE.Matrix4();
    this._lightRotInv = new THREE.Matrix4();
    this._snap = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this.resize();
    // Watching the container rather than only the window, because the panels
    // beside it are draggable and the viewport changes size without the
    // window ever doing so.
    new ResizeObserver(() => this.resize()).observe(this.container);
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const ratio = this.renderer.getPixelRatio();
    const pw = Math.round(w * ratio);
    const ph = Math.round(h * ratio);
    this.sceneTarget.setSize(pw, ph);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.ssao.setSize(pw, ph);
    this.fxaa.material.uniforms.resolution.value.set(1 / pw, 1 / ph);
    this.looks.setSize(w, h);
  }

  setExtent(params) {
    this.extent = Math.max(params.cols, params.rows) * params.cell;
    this.ground.update(params);

    this.shadowSpan = this.extent * 0.8 + 12 + (params.terrainHeight || 0) * 2;
    this.fitShadows();
  }

  // Shadow texels are spent where you are looking rather than spread evenly
  // over the whole town, so zooming in buys real resolution.
  //
  // The catch, and the entire cause of shadow shimmer: if the frustum resizes
  // every frame then texel size does too, every world point lands in a
  // different texel each frame, and edges boil. That reads as "not enough
  // resolution" and no amount of map size fixes it. So the extent is
  // quantised to powers of two, and the centre is snapped to whole texels in
  // the light's own frame rather than along world axes, which is where the
  // grid actually lives.
  fitShadows() {
    const span = this.shadowSpan || this.extent;
    const want = Math.min(span, Math.max(span * 0.2, this.viewDist * 0.62));
    const half = Math.pow(2, Math.ceil(Math.log2(Math.max(1, want))));

    const cam = this.sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = span * 10 + half * 4;

    const size = this.sun.shadow.mapSize.x;
    const texel = (half * 2) / size;

    // Rotation into light space. Matrix4.lookAt writes rotation only, which is
    // all that is needed to align the snapping grid with the shadow map.
    this._lightRot.lookAt(this.sun.position, this.controls.target, this._worldUp);
    this._lightRotInv.copy(this._lightRot).transpose();

    const p = this._snap.copy(this.controls.target).applyMatrix4(this._lightRotInv);
    p.x = Math.round(p.x / texel) * texel;
    p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(this._lightRot);

    this.sun.target.position.copy(p);
    this.sun.target.updateMatrixWorld();
    // The eye must move with the snapped centre, not the raw one. Positioning
    // the light from the unsnapped target while aiming it at the snapped one
    // tilts the light by up to a texel every frame, and a light direction that
    // will not sit still is a shadow that will not sit still.
    if (this.sunOffset) this.sun.position.copy(p).add(this.sunOffset);

    // Bias has to track texel size or a big map acnes where a small one did
    // not, which looks like flicker of a different flavour.
    this.sun.shadow.normalBias = Math.max(0.01, texel * 1.6);
    this.sun.shadow.bias = -Math.max(0.00005, texel * 0.00012);
    cam.updateProjectionMatrix();
  }

  // Fit the built geometry exactly: solve for the distance at which every
  // corner of the bounding box sits inside the frustum. A city block is wide
  // and flat, so a bounding-sphere fit would push the camera much too far.
  frame(target) {
    const box = new THREE.Box3();
    if (target) box.setFromObject(target);
    if (box.isEmpty()) {
      const r = this.extent * 0.5;
      box.set(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, r * 0.4, r));
    }
    const center = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(0.58, 0.44, 0.68).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const tanV = Math.tan(((this.camera.fov * Math.PI) / 180) / 2);
    const tanH = tanV * this.camera.aspect;

    let dist = 0;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      );
      const v = corner.sub(center);
      const along = v.dot(dir);
      dist = Math.max(
        dist,
        Math.abs(v.dot(right)) / tanH + along,
        Math.abs(v.dot(camUp)) / tanV + along
      );
    }
    dist *= 1.06;

    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.far = Math.max(800, dist * 6);
    this.camera.updateProjectionMatrix();
    this.viewDist = dist;
    this.controls.update();
  }

  // Glide the orbit pivot onto a point without moving the camera through the
  // town to get there: the eye keeps its offset, so the view swings around the
  // new centre rather than cutting to it.
  focusOn(point, pullIn = 0) {
    this.focus = { target: point.clone(), pullIn };
  }

  clearFocus() {
    this.focus = null;
  }

  updateFocus(dt) {
    if (!this.focus) return;
    const t = 1 - Math.pow(0.001, Math.min(0.1, dt)); // frame-rate independent
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.lerp(this.focus.target, t);
    if (this.focus.pullIn > 0) {
      const want = Math.max(this.controls.minDistance * 2, this.focus.pullIn);
      const len = offset.length();
      if (len > want) offset.multiplyScalar(1 - (1 - want / len) * t);
    }
    this.camera.position.copy(this.controls.target).add(offset);
    if (this.controls.target.distanceToSquared(this.focus.target) < 0.0004) this.focus = null;
  }

  setGridVisible(on) {
    this.ground.setGridVisible(on);
  }

  // Soft mode routes through PCSS, which three reaches via its soft shadow
  // type. Fast mode is plain PCF, where the radius is a flat blur.
  setShadowQuality(soft, lightSize, quality = 32) {
    const wantType = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const changed = soft && (lightSize !== this.pcssLightSize || quality !== this.pcssQuality);
    if (soft && (!this.pcssInstalled || changed)) {
      installPCSS({ lightSize, quality });
      this.pcssLightSize = lightSize;
      this.pcssQuality = quality;
      this.pcssInstalled = true;
      this.onShaderVersion?.(shaderVersion());
    }
    if (this.renderer.shadowMap.type !== wantType) {
      this.renderer.shadowMap.type = wantType;
      this.onShaderVersion?.(shaderVersion());
    }
  }

  setShadows(on, softness = 2, detail = 4096) {
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    this.sun.shadow.radius = Math.max(0.001, softness);
    const size = Math.max(256, Math.round(detail / 256) * 256);
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      // The old map has to go or the change never takes.
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
      this.fitShadows();
    }
  }

  setBloom(on) {
    this.useBloom = on;
    this.bloom.enabled = on;
  }

  setAntialias(on) {
    this.fxaa.enabled = on;
  }

  // Everything time-of-day and atmosphere. Returns the night factor so the
  // caller can drive glow with the same curve.
  apply(params, palette) {
    const hour = params.hour;
    const elevation = Math.sin(((hour - 6) / 12) * Math.PI);
    // A wider ramp than the real thing, so golden hour is a usable stretch of
    // the slider rather than a couple of minutes either side of the horizon.
    const day = smoothstep(-0.35, 0.35, elevation);
    const dusk = 1 - Math.abs(elevation) ** 0.7;
    this.night = 1 - day;

    const dist = this.extent * 1.6 + 60;
    const azimuth = ((hour - 6) / 12) * Math.PI + ((params.sunAzimuth || 0) * Math.PI) / 180;
    const y = Math.max(0.18, elevation);
    const horizontal = Math.sqrt(Math.max(0.02, 1 - y * y));
    // Direction only. Where the light sits is decided by fitShadows, relative
    // to the snapped shadow centre, so the direction never wobbles.
    this.sunOffset = (this.sunOffset || new THREE.Vector3()).set(
      Math.cos(azimuth) * horizontal * dist,
      y * dist,
      Math.sin(azimuth) * horizontal * dist
    );
    this.sun.position.copy(this.controls.target).add(this.sunOffset);
    this.fitShadows();

    const warm = new THREE.Color('#fff3d8');
    const sunset = new THREE.Color('#ff8a4c');
    const moon = new THREE.Color('#7f97dd');
    this.sun.color.copy(warm).lerp(sunset, dusk * day).lerp(moon, this.night);
    this.sun.intensity = (0.3 + day * 2.4) * (params.sunStrength ?? 1);

    this.hemi.color.set('#bfd3ff').lerp(new THREE.Color('#16203c'), this.night);
    this.hemi.groundColor.set('#8a7f6e').lerp(new THREE.Color('#0c0d14'), this.night);
    this.hemi.intensity = (0.26 + day * 0.4) * (params.ambient ?? 1);

    const dayColor = new THREE.Color(params.skyCustom ? params.skyColor : palette.sky.day);
    const nightColor = params.skyCustom
      ? dayColor.clone().multiplyScalar(0.08)
      : new THREE.Color(palette.sky.night);
    const sky = nightColor.clone().lerp(dayColor, day);
    this.scene.background = null; // the gradient dome stands in for it

    // Overhead runs cooler and deeper than the horizon, which is what makes a
    // flat background read as air instead of paper.
    const zenith = sky.clone().lerp(new THREE.Color(this.night > 0.5 ? '#05060f' : '#6f9bec'), 0.55);
    this.skyMaterial.uniforms.uTop.value.copy(zenith);
    this.skyMaterial.uniforms.uBottom.value.copy(sky);
    this.skyMaterial.uniforms.uSun.value.copy(this.sun.color);
    this.skyMaterial.uniforms.uSunDir.value.copy(this.sun.position).normalize();
    this.skyMaterial.uniforms.uSunAmount.value = 0.35 + day * 0.5;
    this.sky.scale.setScalar(Math.max(200, this.camera.far * 0.45));
    this.updateEnvironment(zenith, sky);
    this.mirror.setSky(zenith, sky, this.sun.color, this.skyMaterial.uniforms.uSunDir.value, this.skyMaterial.uniforms.uSunAmount.value);

    // Fill comes from the opposite side and a little above, cooling as it gets
    // dark so night reads as moonlight rather than as a second sun.
    this.fill.position.set(-this.sun.position.x, Math.abs(this.sun.position.y) * 0.55 + 20, -this.sun.position.z);
    this.fill.color.copy(new THREE.Color('#9ec4ff')).lerp(new THREE.Color('#3b4a7a'), this.night);
    this.fill.intensity = (0.18 + day * 0.42) * (params.ambient ?? 1);

    const fogColor = params.fogCustom ? new THREE.Color(params.fogColor) : sky;
    this.scene.fog.color.copy(fogColor);
    const amount = params.fog ?? 0.25;
    const base = Math.max(this.viewDist, this.extent);
    this.scene.fog.near = base * mix(1.5, 0.02, amount);
    this.scene.fog.far = base * mix(7.0, 0.75, amount);

    this.ground.setColor(
      new THREE.Color(palette.ground.night).lerp(new THREE.Color(palette.ground.day), day)
    );
    this.ground.setGridOpacity(0.05 + day * 0.1);

    // Held so the render loop can refresh the pass every frame. Focus follows
    // the camera, and the camera moves without any parameter changing.
    this.lookParams = params;
    this.renderer.toneMappingExposure = params.exposure ?? 1.05;
    const bloomAmount = params.bloomStrength ?? 1;
    this.bloom.strength = (0.07 + this.night * 0.38) * bloomAmount;
    this.bloom.radius = 0.4 + this.night * 0.3;
    this.bloom.threshold = 0.9 - this.night * 0.16;

    return this.night;
  }

  // Rebaked only when the sky actually changed colour, and not more than a
  // handful of times a second even then — an hour slider dragged fast still
  // shifts colour every frame, but reflections do not need to keep up with
  // that, only with where the light generally is.
  updateEnvironment(zenith, ground) {
    const key = `${zenith.getHexString()}|${ground.getHexString()}`;
    if (key === this._envKey) return;
    const now = performance.now();
    if (now - this._envAt < 150) return;
    this._envKey = key;
    this._envAt = now;
    const rt = this.pmremGenerator.fromScene(this.envScene, 0, 1, 100);
    const previous = this.envRT;
    this.envRT = rt;
    this.scene.environment = rt.texture;
    if (previous) previous.dispose();
  }

  render(dt = 0.016, time = 0) {
    this.clockTime = time;
    this.looks.uniforms.uTime.value = time;
    // The sky dome travels with the eye, so it never clips or falls behind.
    this.sky.position.copy(this.camera.position);
    this.updateFocus(dt);
    this.controls.update();
    // Depth of field is refreshed here rather than on parameter change,
    // because focus tracks the pivot and near/far move with the camera.
    if (this.lookParams) {
      this.looks.apply(
        this.lookParams,
        time,
        this.camera,
        this.camera.position.distanceTo(this.controls.target)
      );
    }
    // Keep the eye above the ground rather than locking how far round it can
    // swing. That way looking up from street level stays possible.
    if (this.controls.enabled) {
      const floor = this.ground.heightAt(this.camera.position.x, this.camera.position.z) + 0.5;
      if (this.camera.position.y < floor) this.camera.position.y = floor;
    }
    // The composer renders several passes and each one would reset the
    // counters, so accumulate across the whole frame by hand.
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();

    // The scene goes into a target this class owns, which is the only way the
    // depth attachment reliably survives for the passes that read it. The
    // composer then starts from that colour texture.
    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    // Occlusion and the mirror pass both need the camera matrices from the
    // frame that was just drawn.
    if (this.lookParams) this.ssao.apply(this.camera, this.lookParams);
    this.mirror.apply(this.camera);
    this.composer.render();
  }
}
