// Renderer, camera, and the day/night rig.
//
// One directional light walks an arc and turns into moonlight on the far side.
// Bloom rides the same night curve. Fog and sky are pulled out as their own
// controls, since haze depth and sky colour are what a shot is usually built
// around.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Ground } from './terrain.js';

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#dcd7c8', 60, 400);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
    this.camera.position.set(60, 40, 70);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1500;

    this.sun = new THREE.DirectionalLight('#fff3e0', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#bfd3ff', '#8a7f6e', 0.6);
    this.scene.add(this.hemi);

    this.ground = new Ground();
    this.scene.add(this.ground.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.useBloom = true;
    this.night = 0;
    this.extent = 64;
    this.viewDist = 140;

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  setExtent(params) {
    this.extent = Math.max(params.cols, params.rows) * params.cell;
    this.ground.update(params);

    const r = this.extent * 0.8 + 12 + (params.terrainHeight || 0) * 2;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = r * 8;
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

  setGridVisible(on) {
    this.ground.setGridVisible(on);
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
  }

  setBloom(on) {
    this.useBloom = on;
    this.bloom.enabled = on;
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
    this.sun.position.set(
      Math.cos(azimuth) * horizontal * dist,
      y * dist,
      Math.sin(azimuth) * horizontal * dist
    );
    this.sun.target.position.set(0, 0, 0);

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
    this.scene.background = sky;

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

    this.renderer.toneMappingExposure = params.exposure ?? 1.05;
    const bloomAmount = params.bloomStrength ?? 1;
    this.bloom.strength = (0.07 + this.night * 0.38) * bloomAmount;
    this.bloom.radius = 0.4 + this.night * 0.3;
    this.bloom.threshold = 0.9 - this.night * 0.16;

    return this.night;
  }

  render() {
    this.controls.update();
    // The composer renders several passes and each one would reset the
    // counters, so accumulate across the whole frame by hand.
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    if (this.useBloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
