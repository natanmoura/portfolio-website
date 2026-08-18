// Renderer, lighting and the two camera rigs.
//
// The lighting brief is simply that it should look good enough that motion
// reads clearly: a warm sun for form, a cool sky bounce so the shadow side is
// not dead, soft contact shadows so hooves visibly meet the ground, and a
// gradient environment so the standard materials have something to reflect.
//
// Contact shadows matter more here than anywhere else. If you cannot see a
// hoof touch, you cannot judge whether it is planted.

import * as THREE from 'three';

const SKY_TOP = new THREE.Color(0x5b8fc7);
const SKY_HORIZON = new THREE.Color(0xd8e3ec);
const GROUND_TINT = new THREE.Color(0x6f6551);

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON.clone().lerp(GROUND_TINT, 0.15), 28, 190);

  // Sky dome. Doubles as the source for the environment map, so ambient light
  // colour and the visible sky can never disagree.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: SKY_TOP },
        horizon: { value: SKY_HORIZON },
        ground: { value: GROUND_TINT },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          vec3 c = h > 0.0
            ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(horizon, ground, pow(clamp(-h, 0.0, 1.0), 0.35));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    })
  );
  sky.name = 'sky';
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.75;

  // Warm low sun, raking across so limbs cast onto the ground and onto each
  // other. The shadow frustum is small and follows the horse, because a big
  // one over a large terrain wastes all its resolution.
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.1);
  sun.position.set(6, 7.5, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 42;
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.022;
  scene.add(sun);
  scene.add(sun.target);

  // Cool fill from the sky, warm bounce from the ground.
  const hemi = new THREE.HemisphereLight(SKY_TOP, GROUND_TINT, 0.85);
  scene.add(hemi);

  // Field camera, a normal perspective view.
  const persp = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  persp.position.set(4.5, 2.4, 5.5);

  // Lab camera, orthographic. A true side view is what makes arcs readable, and
  // perspective would bend them.
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -60, 200);
  ortho.position.set(0, 1.2, 9);

  const stage = {
    renderer,
    scene,
    sky,
    sun,
    hemi,
    persp,
    ortho,
    camera: persp,
    orthoHeight: 3.4,

    aspect() {
      return (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
    },

    // Keep the shadow frustum on the horse.
    trackShadow(target) {
      sun.target.position.copy(target);
      sun.position.copy(target).add(new THREE.Vector3(6, 7.5, 4.5));
    },

    resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      persp.aspect = aspect;
      persp.updateProjectionMatrix();
      const hh = stage.orthoHeight / 2;
      ortho.top = hh;
      ortho.bottom = -hh;
      ortho.left = -hh * aspect;
      ortho.right = hh * aspect;
      ortho.updateProjectionMatrix();
    },

    render() {
      renderer.render(scene, stage.camera);
    },
  };

  stage.resize();
  return stage;
}
