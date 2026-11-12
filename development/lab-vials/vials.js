import * as THREE from 'three';

// ── The shelf ──
// One canvas holds every vial. Each vial is a round flask of thick glass with
// a short neck, a lip and a cork. Inside sits the experiment's preview,
// filling the bulb, so the glass reads as a case around it rather than a
// window in front of it. Tap a vial: it presses in, springs back, the cork
// pops, and the camera dives in to open the project.

const EXPERIMENTS = [
  { name: 'Dragon Express', tag: 'co-op dragon riding', preview: { image: 'specimens/dragon.png' }, tint: '#ffb070' },
  { name: 'Blinks', tag: 'jelly creature breeding', preview: { image: 'specimens/eye.png' }, tint: '#ff8fc0' },
  { name: 'Awesome Town', tag: 'collage city builder', preview: { image: 'specimens/globe-americas.png' }, tint: '#6fe0c4' },
  { name: 'Equus', tag: 'procedural horses', preview: { video: '../../assets/gifs/airbnb-japan-01.mp4' }, tint: '#8fb4ff' },
  { name: 'Little Choir', tag: 'singing dolls', preview: { image: 'specimens/mouth.png' }, tint: '#b99bff' },
  { name: 'Paper Pets', tag: 'photo to papercraft', preview: { image: 'specimens/pencil.png' }, tint: '#c9ec7a' },
];

// Glass settings. The tuning panel edits these live.
const GLASS = {
  roughness: 0.07,
  thickness: 0.4,
  ior: 1.5,
  dispersion: 0.25,
  clearcoat: 1,
  envIntensity: 1.8,
  attenuation: 2.5,
  contentInset: 0.72,
  edgeShade: 0.5,
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Renderer ──
const canvas = document.getElementById('vials');
const shelfEl = document.getElementById('shelf');
const labelsEl = document.getElementById('labels');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

// ── Studio lighting, baked into an environment map ──
// Glass is mostly what it reflects. A soft window up and to the left gives
// the big highlight, two tall strips draw bright lines down the sides of the
// bulb, and dark cards behind give the edges a crisp outline against white.
function buildEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 p; void main(){
        float y = p.y;
        vec3 top = vec3(1.0), mid = vec3(0.48, 0.5, 0.56), low = vec3(0.16, 0.17, 0.2);
        vec3 c = y > 0. ? mix(mid, top, smoothstep(0., .8, y)) : mix(mid, low, smoothstep(0., -.5, y));
        gl_FragColor = vec4(c, 1.); }`,
    })
  );
  env.add(dome);
  // Soft edges on the lights, so their reflections fade out like a
  // diffused softbox rather than cutting off hard.
  const soft = canvasTexture(128, (g, s) => {
    g.filter = "blur(10px)";
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(18, 18, s - 36, s - 36, 24);
    g.fill();
  }, false);
  const panel = (w, h, intensity, pos, color = "#ffffff", map = null) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), map, transparent: !!map, side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
    return m;
  };
  panel(4, 3.2, 30, [-5, 5, 6], '#ffffff', soft);       // key window, up left in front
  panel(0.8, 12, 14, [-8, 1, 1]);       // left strip
  panel(0.8, 12, 10, [8, 1, 0]);        // right strip
  panel(10, 4, 2.5, [0, 9, 0], '#ffffff', soft);     // overhead softbox
  panel(6, 3, 1.2, [3, -1, -8], '#ffe2c4'); // warm bounce from behind
  panel(4, 10, 0.02, [-6, 0, -6], '#000000'); // dark cards for edge definition
  panel(4, 10, 0.02, [6, 0, -6], '#000000');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = buildEnvironment();

const key = new THREE.DirectionalLight('#ffffff', 1.4);
key.position.set(-3, 6, 5);
scene.add(key);

// ── Shared textures ──
function canvasTexture(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const radial = (inner, outer) => canvasTexture(256, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
});
const shadowTex = radial('rgba(0,0,0,0.42)', 'rgba(0,0,0,0)');
const glowTex = radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

const tileTex = canvasTexture(256, (g, s) => {
  g.fillStyle = '#fbfbfc';
  g.fillRect(0, 0, s, s);
  g.strokeStyle = '#f0f1f3';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, s - 3, s - 3);
});
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
tileTex.repeat.set(110, 74);

const corkTex = canvasTexture(512, (g, s) => {
  g.fillStyle = '#b98352';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const r = Math.random() * 2.2 + 0.4;
    g.fillStyle = Math.random() < 0.6 ? `rgba(90,52,24,${0.15 + Math.random() * 0.35})` : `rgba(235,190,140,${0.1 + Math.random() * 0.25})`;
    g.beginPath();
    g.ellipse(Math.random() * s, Math.random() * s, r, r * (0.5 + Math.random()), Math.random() * 3, 0, 7);
    g.fill();
  }
});

// ── Geometry ──
// The flask is a lathe: a sphere of radius 1 centred at y = 1, flattened a
// touch at the bottom so it stands, then a short narrow neck and a rolled
// lip. Sizes are in vial units (the bulb is 2 across).
const BULB_Y = 1;
function flaskProfile() {
  const pts = [];
  pts.push([0, 0.07], [0.3, 0.07]);
  for (let a = -68; a <= 70; a += 4) {
    const r = (a * Math.PI) / 180;
    pts.push([Math.cos(r), BULB_Y + Math.sin(r)]);
  }
  pts.push(
    [0.27, 2.0], [0.245, 2.08], [0.24, 2.18],   // neck, a little fillet into the bulb
    [0.25, 2.24], [0.305, 2.26], [0.32, 2.3],    // lip rolls out
    [0.305, 2.34], [0.26, 2.355], [0.215, 2.33], // and back over the top
    [0.205, 2.25], [0.2, 2.1], [0.0, 2.04]       // down inside the neck
  );
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  return curve.getPoints(220).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
}
const flaskGeo = new THREE.LatheGeometry(flaskProfile(), 96);
flaskGeo.computeVertexNormals();

function corkProfile() {
  const pts = [[0, 2.12], [0.198, 2.12], [0.205, 2.3], [0.222, 2.5], [0.222, 2.53], [0.205, 2.555], [0.18, 2.56], [0, 2.56]];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', 0.2);
  return curve.getPoints(60).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
}
const corkGeo = new THREE.LatheGeometry(corkProfile(), 48);
corkGeo.computeVertexNormals();
// Cork pivots about its own middle so it tumbles nicely when it pops.
corkGeo.translate(0, -2.34, 0);

const contentGeo = new THREE.SphereGeometry(1, 64, 48);

// ── Materials ──
const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  metalness: 0,
  transmission: 1,
  specularIntensity: 1,
  attenuationColor: new THREE.Color('#d6e9f7'),
});
const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, bumpMap: corkTex, bumpScale: 1.5, roughness: 0.9 });

function applyGlass() {
  glassMat.roughness = GLASS.roughness;
  glassMat.thickness = GLASS.thickness;
  glassMat.ior = GLASS.ior;
  glassMat.dispersion = GLASS.dispersion;
  glassMat.clearcoat = GLASS.clearcoat;
  glassMat.clearcoatRoughness = 0.02;
  glassMat.envMapIntensity = GLASS.envIntensity;
  glassMat.attenuationDistance = GLASS.attenuation;
  for (const v of vials) {
    v.content.scale.setScalar(GLASS.contentInset);
    v.contentMat.uniforms.edgeShade.value = GLASS.edgeShade;
  }
}

// The contents: a ball just inside the bulb, with the preview laid on it
// straight from the front, so from the camera it reads as the picture
// itself. The edge darkens and picks up the vial's tint, which gives it
// volume and lets the glass wall read around it.
const contentVert = `
  varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    vObj = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const contentFrag = `
  uniform sampler2D map; uniform vec2 uvScale; uniform vec3 tint; uniform float edgeShade;
  varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    vec2 uv = (vObj.xy * 0.5) * uvScale + 0.5;
    vec4 t = texture2D(map, uv);
    float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    vec3 c = t.rgb;
    c *= mix(1.0 - edgeShade, 1.0, smoothstep(0.0, 0.75, f));
    c += tint * pow(1.0 - f, 2.5) * 0.45;
    // The inner face of the glass wall: a dark seam, then a bright lip of
    // light caught in the wall itself.
    float rim = 1.0 - f;
    c *= 1.0 - 0.35 * smoothstep(0.82, 0.93, rim) * (1.0 - smoothstep(0.95, 1.0, rim));
    c = mix(c, vec3(1.0), 0.55 * smoothstep(0.955, 1.0, rim));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// An image preview gets a soft tinted backdrop so it fills the whole ball.
function imagePreview(src, tint) {
  const tex = canvasTexture(1024, () => {});
  const img = new Image();
  img.onload = () => {
    const c = tex.image, g = c.getContext('2d'), s = c.width;
    const base = new THREE.Color(tint);
    const light = '#' + base.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString();
    const deep = '#' + base.clone().multiplyScalar(0.8).getHexString();
    const gr = g.createRadialGradient(s * 0.42, s * 0.38, 0, s / 2, s / 2, s * 0.62);
    gr.addColorStop(0, light);
    gr.addColorStop(1, deep);
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    const d = s * 0.6;
    g.drawImage(img, (s - d) / 2, (s - d) / 2, d, d);
    tex.needsUpdate = true;
  };
  img.src = src;
  return { tex, uvScale: new THREE.Vector2(1, 1) };
}

function videoPreview(src) {
  const video = document.createElement('video');
  Object.assign(video, { src, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous' });
  video.setAttribute('playsinline', '');
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  const uvScale = new THREE.Vector2(1, 1);
  // Cover the ball: crop the long side.
  video.addEventListener('loadedmetadata', () => {
    const a = video.videoWidth / video.videoHeight;
    if (a > 1) uvScale.set(1 / a, 1); else uvScale.set(1, a);
  });
  video.play().catch(() => {});
  return { tex, uvScale, video };
}

// ── Build the vials ──
const world = new THREE.Group();
scene.add(world);
const vials = [];

const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: tileTex, toneMapped: false }));
backdrop.position.z = -2.5;
scene.add(backdrop);

const shelfMat = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.55, emissive: '#ffffff', emissiveIntensity: 0.55 });
const shelves = [];

EXPERIMENTS.forEach((exp, i) => {
  const root = new THREE.Group();   // placed on the shelf
  const body = new THREE.Group();   // pressed, swayed, lifted
  root.add(body);
  world.add(root);

  const glass = new THREE.Mesh(flaskGeo, glassMat);
  body.add(glass);

  const preview = exp.preview.video ? videoPreview(exp.preview.video) : imagePreview(exp.preview.image, exp.tint);
  const contentMat = new THREE.ShaderMaterial({
    vertexShader: contentVert,
    fragmentShader: contentFrag,
    uniforms: {
      map: { value: preview.tex },
      uvScale: { value: preview.uvScale },
      tint: { value: new THREE.Color(exp.tint) },
      edgeShade: { value: GLASS.edgeShade },
    },
  });
  const content = new THREE.Mesh(contentGeo, contentMat);
  content.position.y = BULB_Y;
  body.add(content);

  const cork = new THREE.Mesh(corkGeo, corkMat);
  cork.position.y = 2.34;
  body.add(cork);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  root.add(shadow);

  // Light through the glass, thrown onto the shelf in front.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.1),
    new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(exp.tint), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0.15, 0.006, 0.55);
  root.add(glow);

  const label = document.createElement('button');
  label.className = 'vial-label';
  label.innerHTML = `${exp.name}<small>${exp.tag}</small>`;
  label.addEventListener('click', () => open(vials[i]));
  labelsEl.appendChild(label);

  vials.push({
    exp, root, body, glass, content, contentMat, cork, label, video: preview.video,
    phase: Math.random() * Math.PI * 2,
    press: 0, pressV: 0, pressTarget: 0,
    hover: 0, hoverTarget: 0,
    corkPop: null,
  });
});
applyGlass();
window.__vials = vials;

// ── Layout ──
const SPACING = 2.7;
const ROW_H = 3.7;
const VIAL_TOP_PAD = 0.55;
const SHELF_SPACE = 0.75;
let cols = 3, rows = 2, worldW = 0, worldH = 0;
const camHome = new THREE.Vector3();
const lookHome = new THREE.Vector3();

function layout() {
  const w = shelfEl.clientWidth;
  cols = +new URLSearchParams(location.search).get('cols') || (w >= 960 ? 4 : w >= 600 ? 3 : 2);
  rows = Math.ceil(vials.length / cols);
  worldW = cols * SPACING;
  worldH = rows * ROW_H;

  const h = Math.round((w * worldH) / worldW);
  renderer.setSize(w, h, false);
  canvas.style.height = h + 'px';
  camera.aspect = w / h;

  // Far enough back that the whole grid fits, raised a little so we look
  // slightly down onto the shelves.
  const dist = worldH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camHome.set(0, 0.9, dist);
  lookHome.set(0, 0.2, 0);
  camera.position.copy(camHome);
  camera.lookAt(lookHome);
  camera.updateProjectionMatrix();

  shelves.forEach(s => world.remove(s));
  shelves.length = 0;
  for (let r = 0; r < rows; r++) {
    const baseY = worldH / 2 - r * ROW_H - VIAL_TOP_PAD - 2.56;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(worldW - 0.3, 0.12, 1.6), shelfMat);
    shelf.position.set(0, baseY - 0.06, 0.1);
    world.add(shelf);
    shelves.push(shelf);
  }

  vials.forEach((v, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = Math.min(cols, vials.length - r * cols);
    const x = (c - (inRow - 1) / 2) * SPACING;
    const baseY = worldH / 2 - r * ROW_H - VIAL_TOP_PAD - 2.56;
    v.root.position.set(x, baseY, 0);
    v.labelAnchor = new THREE.Vector3(x, baseY - 0.12, 0.9);
  });
  placeLabels();
}

const tmp = new THREE.Vector3();
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const v of vials) {
    tmp.copy(v.labelAnchor).project(camera);
    v.label.style.left = ((tmp.x + 1) / 2) * w + 'px';
    v.label.style.top = ((1 - tmp.y) / 2) * h + 4 + 'px';
  }
}

// ── Pointer ──
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null, pressed = null, busy = false;
const pointer = { x: 0, y: 0 };

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointer.x = ndc.x; pointer.y = ndc.y;
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(vials.flatMap(v => [v.glass, v.cork]), false)[0];
  return hit ? vials.find(v => v.glass === hit.object || v.cork === hit.object) : null;
}

canvas.addEventListener('pointermove', e => {
  if (busy) return;
  hovered = e.pointerType === 'mouse' ? pick(e) : null;
  canvas.style.cursor = hovered ? 'pointer' : '';
  if (pressed && pick(e) !== pressed) { pressed.pressTarget = 0; pressed = null; }
});
canvas.addEventListener('pointerleave', () => { hovered = null; if (pressed) { pressed.pressTarget = 0; pressed = null; } });
canvas.addEventListener('pointerdown', e => {
  if (busy) return;
  const v = pick(e);
  if (!v) return;
  pressed = v;
  v.pressTarget = 1;
});
canvas.addEventListener('pointerup', e => {
  if (busy || !pressed) return;
  const v = pressed;
  pressed = null;
  v.pressTarget = 0;
  if (pick(e) === v) open(v);
});
canvas.addEventListener('pointercancel', () => { if (pressed) { pressed.pressTarget = 0; pressed = null; } });

// ── Opening a vial ──
// Press, spring back, pop the cork, then dive in.
const flash = document.getElementById('flash');
const projectEl = document.getElementById('project');
let dive = null;

function open(v) {
  if (busy) return;
  busy = true;
  hovered = null;
  canvas.style.cursor = '';
  // A tap from the keyboard or a quick touch never held the press, so give
  // it a quick one.
  if (v.press < 0.5) { v.pressV = 9; }
  v.pressTarget = 0;
  setTimeout(() => popCork(v), reduceMotion ? 0 : 160);
  shelfEl.classList.add('diving');
  setTimeout(() => startDive(v), reduceMotion ? 120 : 620);
}

function popCork(v) {
  const side = Math.random() < 0.5 ? -1 : 1;
  v.corkPop = {
    pos: new THREE.Vector3(0, 2.34, 0),
    vel: new THREE.Vector3(side * (0.8 + Math.random() * 0.6), 6.2, 0.6),
    spin: new THREE.Vector3(Math.random() * 4, 0, -side * (7 + Math.random() * 4)),
    rot: new THREE.Euler(),
  };
}

function startDive(v) {
  const target = new THREE.Vector3();
  v.content.getWorldPosition(target);
  dive = { v, t: 0, dur: reduceMotion ? 0.25 : 0.75, from: camera.position.clone(), fromLook: lookHome.clone(), target, dir: 1 };
}

function finishDive() {
  const { v } = dive;
  document.getElementById('projectName').textContent = v.exp.name;
  document.getElementById('projectTag').textContent = v.exp.tag;
  projectEl.hidden = false;
  flash.style.transition = 'opacity 0.35s ease';
  flash.style.opacity = '0';
  document.getElementById('back').focus();
}

document.getElementById('back').addEventListener('click', () => {
  if (!dive) return;
  projectEl.hidden = true;
  const v = dive.v;
  v.corkPop = null;
  v.cork.position.set(0, 2.34, 0);
  v.cork.rotation.set(0, 0, 0);
  dive.dir = -1;
  dive.t = dive.dur;
  flash.style.transition = 'none';
  flash.style.opacity = '1';
  requestAnimationFrame(() => {
    flash.style.transition = 'opacity 0.5s ease';
    flash.style.opacity = '0';
  });
  v.label.focus({ preventScroll: true });
});

// ── Animate ──
const clock = new THREE.Clock();
const lookNow = new THREE.Vector3();
let visible = true;
new IntersectionObserver(([e]) => {
  visible = e.isIntersecting;
  for (const v of vials) if (v.video) visible ? v.video.play().catch(() => {}) : v.video.pause();
}).observe(canvas);

function frame() {
  requestAnimationFrame(frame);
  if (!visible || document.hidden) { clock.getDelta(); return; }
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;

  for (const v of vials) {
    // A stiff, slightly underdamped spring, so letting go overshoots.
    const k = 420, c = 17;
    v.pressV += (k * (v.pressTarget - v.press) - c * v.pressV) * dt;
    v.press += v.pressV * dt;

    v.hoverTarget = hovered === v ? 1 : 0;
    v.hover += (v.hoverTarget - v.hover) * Math.min(1, dt * 10);

    const sway = reduceMotion ? 0 : Math.sin(t * 0.7 + v.phase) * 0.012;
    const lean = v.hover * pointer.x * 0.05;
    v.body.rotation.z = sway - lean;
    v.body.rotation.x = v.hover * -pointer.y * 0.04;
    const s = 1 - 0.06 * v.press;
    v.body.scale.setScalar(s);
    v.body.position.z = -0.35 * v.press;
    v.body.position.y = v.hover * 0.05;

    if (v.corkPop) {
      const p = v.corkPop;
      p.vel.y -= 16 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.z += p.spin.z * dt;
      v.cork.position.copy(p.pos);
      v.cork.rotation.copy(p.rot);
    }
  }

  if (dive) {
    dive.t = THREE.MathUtils.clamp(dive.t + dt * dive.dir, 0, dive.dur);
    const k = dive.t / dive.dur;
    const e = k * k * (3 - 2 * k);
    const eIn = k * k * k;
    const end = dive.target.clone().add(new THREE.Vector3(0, 0.05, 0.6));
    camera.position.lerpVectors(dive.from, end, dive.dir > 0 ? eIn * 0.35 + e * 0.65 : e);
    lookNow.lerpVectors(dive.fromLook, dive.target, e);
    camera.lookAt(lookNow);
    if (dive.dir > 0) {
      flash.style.transition = 'none';
      flash.style.opacity = String(THREE.MathUtils.smoothstep(k, 0.55, 1));
      if (k >= 1) { finishDive(); dive.dir = 0; }
    } else if (k <= 0) {
      camera.position.copy(camHome);
      camera.lookAt(lookHome);
      dive = null;
      busy = false;
      shelfEl.classList.remove('diving');
    }
  } else {
    // A touch of parallax with the mouse, so the reflections slide.
    const px = camHome.x + pointer.x * 0.25, py = camHome.y + pointer.y * 0.15;
    camera.position.x += (px - camera.position.x) * Math.min(1, dt * 3);
    camera.position.y += (py - camera.position.y) * Math.min(1, dt * 3);
    camera.lookAt(lookHome);
  }

  renderer.render(scene, camera);
  placeLabels();
}

addEventListener('resize', layout);
layout();
frame();

// ── Tuning panel ──
// Hover any control for what it does.
const CONTROLS = [
  { key: 'roughness', label: 'Glass blur', min: 0, max: 0.4, step: 0.005, help: 'How frosted the glass is. Higher blurs the contents more as you look through it.' },
  { key: 'thickness', label: 'Wall thickness', min: 0, max: 1.5, step: 0.01, help: 'How thick the glass acts. Thicker bends the contents more around the edges of the bulb.' },
  { key: 'ior', label: 'Refraction (IOR)', min: 1, max: 2.2, step: 0.01, help: 'How strongly the glass bends light. 1.5 is real glass, 1.0 is no bending at all.' },
  { key: 'dispersion', label: 'Rainbow edges', min: 0, max: 2, step: 0.01, help: 'Splits light into colours at the thick edges, the way a prism does.' },
  { key: 'clearcoat', label: 'Polish', min: 0, max: 1, step: 0.01, help: 'An extra sharp shine on the surface, like freshly polished glass.' },
  { key: 'envIntensity', label: 'Reflections', min: 0, max: 3, step: 0.01, help: 'How bright the reflected studio lights are on the glass.' },
  { key: 'attenuation', label: 'Tint depth', min: 0.2, max: 6, step: 0.05, help: 'How far light travels before the glass tints it. Lower gives a heavier, greener-blue glass.' },
  { key: 'contentInset', label: 'Contents size', min: 0.6, max: 0.95, step: 0.005, help: 'How much of the bulb the project preview fills. Lower leaves a thicker clear wall around it.' },
  { key: 'edgeShade', label: 'Contents shading', min: 0, max: 1, step: 0.01, help: 'Darkens the edge of the preview so it reads as a round thing inside the glass, not a flat picture.' },
];

const tune = document.getElementById('tune');
const tuneToggle = document.getElementById('tuneToggle');
const help = document.getElementById('help');
tuneToggle.addEventListener('click', () => {
  tune.hidden = !tune.hidden;
  tuneToggle.setAttribute('aria-expanded', String(!tune.hidden));
});
for (const c of CONTROLS) {
  const row = document.createElement('label');
  row.innerHTML = `<span>${c.label}</span><output>${GLASS[c.key]}</output><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${GLASS[c.key]}">`;
  const input = row.querySelector('input'), out = row.querySelector('output');
  input.addEventListener('input', () => { GLASS[c.key] = +input.value; out.textContent = input.value; applyGlass(); });
  row.addEventListener('pointerenter', () => { help.textContent = c.help; help.hidden = false; });
  row.addEventListener('pointermove', e => {
    help.style.left = Math.max(8, e.clientX - 260) + 'px';
    help.style.top = e.clientY - 10 + 'px';
  });
  row.addEventListener('pointerleave', () => { help.hidden = true; });
  tune.appendChild(row);
}
const copy = document.createElement('button');
copy.className = 'copy';
copy.textContent = 'Copy settings';
copy.addEventListener('click', () => navigator.clipboard?.writeText(JSON.stringify(GLASS, null, 2)).then(() => (copy.textContent = 'Copied')));
tune.appendChild(copy);
