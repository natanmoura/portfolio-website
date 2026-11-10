import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BREEDS, buildPet, withColors, traits, dot, faceLayout } from './construct.js';
import { unfoldPart, layoutSheet, SHEET } from './unfold.js';
import { paintArt, paintSheet, PX } from './paint.js';
import { loadImage, classify, mapPrediction, extractPalette, coatColors, loadModel, loadDetector, findAnimal, crop,
  loadSegmenter, segmentPet, ellipseMask } from './photo.js';
import { findLandmarks, loadLandmarker } from './landmarks.js';
import { facePose, proportions } from './fit.js';
import { photoTexture, cartoonTexture } from './texture.js';

const SAMPLES = [
  { key: 'frenchie', label: 'French Bulldog', photos: ['photos/frenchie-1.jpg', 'photos/frenchie-2.jpg'] },
  { key: 'lab', label: 'Labrador', photos: ['photos/lab-1.jpg', 'photos/lab-2.jpg'] },
  { key: 'golden', label: 'Golden Retriever', photos: ['photos/golden-1.jpg', 'photos/golden-2.jpg'] },
  { key: 'gsd', label: 'German Shepherd', photos: ['photos/gsd-2.jpg', 'photos/gsd-1.jpg'] },
  { key: 'tabby', label: 'Tabby', photos: ['photos/tabby-1.jpg', 'photos/tabby-2.jpg'] },
  { key: 'siamese', label: 'Siamese', photos: ['photos/siamese-1.jpg', 'photos/siamese-2.jpg'] },
  { key: 'persian', label: 'Persian', photos: ['photos/persian-1.jpg', 'photos/persian-2.jpg'] },
];

const $ = (s) => document.querySelector(s);
const state = { src: null, label: null, key: 'lab', photoColors: true, palette: null, preds: null, override: '', token: 0,
  faceMode: 'photo', seg: null, img: null, built: null, tapping: null,
  taps: {}, // manual eye/nose taps per photo (an optional override)
  autoFit: {}, // detected landmarks per photo: { eyes, nose, ears, inferred } or { failed: true }
};

// ---------- sample strip ----------
const strip = $('#samples');
for (const s of SAMPLES) {
  const card = document.createElement('div');
  card.className = 'sample';
  card.innerHTML = `<div class="thumbs">${s.photos.map((p) => `<button class="thumb" data-src="${p}" data-label="${s.label}"><img src="${p}" alt="${s.label}"></button>`).join('')}</div><span>${s.label}</span>`;
  strip.appendChild(card);
}
const up = document.createElement('label');
up.className = 'sample upload';
up.dataset.help = 'Try your own pet. Runs entirely in your browser, nothing is uploaded anywhere.';
up.innerHTML = '<input type="file" accept="image/*" hidden><div class="upload-box">+</div><span>Your photo</span>';
strip.appendChild(up);
up.querySelector('input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) select(URL.createObjectURL(f), null);
});
strip.addEventListener('click', (e) => {
  const b = e.target.closest('.thumb');
  if (b) select(b.dataset.src, b.dataset.label);
});

// ---------- controls ----------
const ov = $('#override');
ov.innerHTML = '<option value="">Auto (from detection)</option>' + Object.entries(BREEDS).map(([k, b]) => `<option value="${k}">${b.name}</option>`).join('');
ov.addEventListener('change', () => { state.override = ov.value; rebuild(); });
document.querySelectorAll('[data-colors]').forEach((b) => b.addEventListener('click', () => { state.photoColors = b.dataset.colors === 'photo'; syncSeg(); rebuild(); }));
$('#lineup').addEventListener('click', () => { state.lineup = !state.lineup; syncSeg(); rebuild(); });
function syncSeg() {
  $('#lineup').classList.toggle('on', !!state.lineup);
  document.querySelectorAll('[data-face]').forEach((b) => b.classList.toggle('on', b.dataset.face === state.faceMode));
  document.querySelectorAll('[data-colors]').forEach((b) => b.classList.toggle('on', (b.dataset.colors === 'photo') === state.photoColors));
}
syncSeg();
$('#download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `paper-pet-${state.override || state.key}-ornament.png`;
  a.href = $('#sheet').toDataURL('image/png');
  a.click();
});

// hover help: any element with data-help
const tip = $('#tip');
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-help]');
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.help;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  tip.style.left = Math.min(window.innerWidth - 270, Math.max(8, r.left)) + 'px';
  tip.style.top = r.bottom + 8 + window.scrollY + 'px';
});

// ---------- three ----------
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
camera.position.set(2.6, 2.4, 4.4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.addEventListener('start', () => { controls.autoRotate = false; });
scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb8ab9c, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(2.5, 5, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -3; sun.shadow.camera.right = 3; sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3;
sun.shadow.radius = 6;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
let model = null;
const texture = new THREE.CanvasTexture($('#art'));
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = 8;

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.paperPetsState = state;
window.paperPetsDebug = { camera, controls, renderer, scene };
// debug hook: a PNG of the current 3D view
window.paperPetsSnap = (yaw = null) => {
  if (yaw !== null) {
    controls.autoRotate = false;
    const d = camera.position.distanceTo(controls.target);
    camera.position.set(controls.target.x + Math.sin(yaw) * d * 0.94, controls.target.y + d * 0.28, controls.target.z + Math.cos(yaw) * d * 0.94);
    camera.lookAt(controls.target);
  }
  // background tabs may never have resized: match the camera to the canvas first
  camera.aspect = renderer.domElement.width / renderer.domElement.height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL();
};

function setModel(group) {
  if (model) {
    scene.remove(model);
    model.traverse((o) => { o.geometry?.dispose(); if (o.material?.map && o.material.map !== texture) o.material.map.dispose(); });
  }
  model = group;
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  controls.target.copy(c);
  const size = box.getSize(new THREE.Vector3());
  const dir = state.lineup ? new THREE.Vector3(0.12, 0.32, 1).normalize() : camera.position.clone().sub(controls.target).normalize();
  controls.autoRotate = !state.lineup && controls.autoRotate;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const half = state.lineup ? [size.x / 2, size.y / 2] : [Math.hypot(size.x, size.z) / 2, size.y / 2];
  const dist = Math.max(half[1] / t, half[0] / (t * camera.aspect)) * 1.7 + Math.max(size.z, size.x * 0.1) / 2;
  camera.position.copy(c).addScaledVector(dir, dist);
}

function makeGroup(layout, tex, W, H) {
  const model = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  const byPart = new Map();
  for (const f of layout.faces) { if (!byPart.has(f.part)) byPart.set(f.part, []); byPart.get(f.part).push(f); }
  for (const [part, faces] of byPart) {
    const pos = [], uv = [], nrm = [];
    for (const f of faces) {
      const vs = part.faces[f.fi].v;
      for (let k = 1; k < vs.length - 1; k++) {
        for (const j of [0, k, k + 1]) {
          pos.push(...part.verts[vs[j]]);
          uv.push((f.pts[j][0] * PX) / W, 1 - (f.pts[j][1] * PX) / H);
          nrm.push(...f.F.n);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    model.add(m);
    // crease lines on real folds only
    const lines = [];
    const fn = part.faces.map((_, i) => faces.find((f) => f.fi === i)?.F.n);
    const seen = new Map();
    part.faces.forEach((f, fi) => f.v.forEach((a, k) => {
      const b = f.v[(k + 1) % f.v.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key)) { if (dot(fn[seen.get(key)], fn[fi]) < 0.9995) lines.push(...part.verts[a], ...part.verts[b]); }
      else seen.set(key, fi);
    }));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    model.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2320, transparent: true, opacity: 0.22 })));
  }
  return model;
}

// Every construct side by side in model units, so proportions compare directly.
function buildLineup() {
  const row = new THREE.Group();
  let x = 0;
  for (const s of SAMPLES) {
    const pet = BREEDS[s.key];
    const build = buildPet(pet);
    const layout = layoutSheet(build.parts.map(unfoldPart), 40);
    const cv = document.createElement('canvas');
    paintArt(cv, layout, pet, pet.colors, build, cartoonTexture(pet, build.template, pet.colors));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = makeGroup(layout, tex, cv.width, cv.height);
    const b = new THREE.Box3().setFromObject(g);
    g.position.x = x - b.min.x;
    x += b.max.x - b.min.x + 0.35;
    row.add(g);
  }
  row.position.x = -x / 2;
  return row;
}

// ---------- pipeline ----------
async function select(src, label) {
  const token = ++state.token;
  state.src = src; state.label = label; state.preds = null;
  document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('on', t.dataset.src === src));
  $('#photo').src = src;
  const img = await loadImage(src);
  if (token !== state.token) return;
  $('#bbox').hidden = true;
  state.seg = null;
  state.img = img;
  try { state.palette = extractPalette(img); } catch { state.palette = null; }
  const known = SAMPLES.find((s) => s.label === label);
  if (known) state.key = known.key;
  renderDetect('loading');
  rebuild();
  try {
    let input = img;
    const found = await findAnimal(img).catch(() => null);
    if (token !== state.token) return;
    if (found) {
      const [x, y, w, h] = found.box;
      const el = $('#bbox');
      Object.assign(el.style, { left: `${(x / img.naturalWidth) * 100}%`, top: `${(y / img.naturalHeight) * 100}%`, width: `${(w / img.naturalWidth) * 100}%`, height: `${(h / img.naturalHeight) * 100}%` });
      el.dataset.label = `${found.cls} ${Math.round(found.score * 100)}%`;
      el.hidden = false;
      try { state.palette = extractPalette(img, found.box); } catch { /* keep the centered guess */ }
      input = crop(img, found.box);
    }
    state.seg = ellipseMask(img, found && found.box);
    const seg = await segmentPet(img).catch((e) => { console.warn('segmentation unavailable', e); return null; });
    if (token !== state.token) return;
    if (seg) {
      state.seg = seg;
      try { state.palette = extractPalette(img, null, seg.mask); } catch { /* keep box palette */ }
    }
    rebuild();
    const src0 = src;
    if (!state.autoFit[src0]) {
      try {
        const saved = localStorage.getItem(`paperpets-face2:${src0}`);
        if (saved) state.autoFit[src0] = JSON.parse(saved);
      } catch { /* storage unavailable */ }
    }
    const fitP = state.autoFit[src0] ? Promise.resolve().then(() => { if (state.src === src0) { tapHint(); rebuild(); } }) : findLandmarks(img, { box: found && found.box, bounds: seg && seg.bounds, headX: seg && seg.headX, mask: seg && seg.mask })
      .then((f) => {
        state.autoFit[src0] = f ? { eyes: f.eyes, nose: f.nose, ears: f.ears, inferred: f.inferred } : { failed: true };
        // remember sample photos between visits so they come back instantly
        if (!src0.startsWith('blob:')) {
          try { localStorage.setItem(`paperpets-face2:${src0}`, JSON.stringify(state.autoFit[src0])); } catch { /* storage unavailable */ }
        }
      })
      .catch((e) => { console.warn('landmarks unavailable', e); state.autoFit[src0] = { failed: true }; })
      .then(() => {
        if (state.src !== src0) return;
        tapHint();
        rebuild();
      });
    tapHint();
    const preds = await classify(input);
    if (token !== state.token) return;
    state.preds = preds;
    state.mapped = mapPrediction(preds);
    state.key = state.mapped.key;
    renderDetect();
    rebuild();
  } catch (err) {
    console.error(err);
    renderDetect('error');
  }
}

function renderDetect(status) {
  const el = $('#detect');
  const truth = state.label ? `<div class="truth">Photo source label: <b>${state.label}</b></div>` : '';
  if (status === 'loading') { el.innerHTML = `<div class="muted">Detecting breed…</div>${truth}`; return; }
  if (status === 'error') { el.innerHTML = `<div class="muted">Classifier unavailable. Using the photo's label.</div>${truth}`; return; }
  const rows = state.preds.slice(0, 3).map((p) => {
    const name = p.className.split(',')[0];
    const pct = Math.round(p.probability * 100);
    return `<div class="pred"><span>${name}</span><i style="--w:${pct}%"></i><em>${pct}%</em></div>`;
  }).join('');
  const m = state.mapped;
  const via = m.exact ? `matched “${m.via.className.split(',')[0]}”` : 'no close construct, using the nearest general shape';
  el.innerHTML = `<div class="label">Detected</div>${rows}${truth}<div class="maps">→ ${BREEDS[m.key].name} construct <small>${via}</small></div>`;
}

// ---------- photo regions ----------
// photo landmarks for the current photo: manual taps override the detected eyes and nose
function photoLandmarks() {
  const a = state.autoFit[state.src];
  const t = state.taps[state.src];
  if (t) return { eyes: [t[0], t[1]], nose: t[2], ears: a && a.ears ? a.ears : [null, null] };
  if (a && !a.failed) return a;
  return null;
}

// Shows what was found and which regions were lifted from the photo.
const guide = $('#guide');
function drawGuide() {
  const on = state.faceMode === 'photo' && state.seg && state.built && !state.lineup;
  guide.hidden = !on;
  $('#align').hidden = !on;
  $('#bbox').style.visibility = on ? 'hidden' : '';
  if (!on) return;
  const img = $('#photo');
  if (!img.naturalWidth) return;
  const dpr = window.devicePixelRatio || 1;
  guide.width = img.clientWidth * dpr; guide.height = img.clientHeight * dpr;
  const k = (img.clientWidth / img.naturalWidth) * dpr;
  const ctx = guide.getContext('2d');
  const dot = (p, c, r = 3) => {
    ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, r * dpr, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = dpr; ctx.stroke();
  };
  if (state.tapping) {
    ctx.fillStyle = 'rgba(20,14,10,0.25)';
    ctx.fillRect(0, 0, guide.width, guide.height);
    state.tapping.forEach((p, i) => dot(p, i < 2 ? '#ffd36b' : '#ff8a5c', 5));
    return;
  }
  const tex = state.built.tex;
  if (!tex.photo) return;
  ctx.lineWidth = 1.3 * dpr;
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  for (const p of tex.patches) {
    ctx.save();
    ctx.translate(p.pc[0] * k, p.pc[1] * k);
    ctx.rotate(tex.pose.roll);
    ctx.beginPath(); ctx.ellipse(0, 0, p.rx * k, p.ry * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (tex.fur.at) {
    const s = tex.fur.size * k;
    ctx.strokeStyle = '#a6f0b4';
    ctx.strokeRect(tex.fur.at[0] * k - s / 2, tex.fur.at[1] * k - s / 2, s, s);
  }
  ctx.strokeStyle = '#7fd6ff';
  for (const e of tex.ears) {
    if (!e || e.mirror) continue;
    ctx.beginPath(); ctx.moveTo(e.base[0] * k, e.base[1] * k); ctx.lineTo(e.tip[0] * k, e.tip[1] * k); ctx.stroke();
  }
  ctx.setLineDash([]);
  const lm = photoLandmarks();
  if (lm) {
    lm.eyes.forEach((p) => dot(p, '#ffd36b'));
    dot(lm.nose, '#ff8a5c');
    (lm.ears || []).filter((e) => e && e.how !== 'mirrored').forEach((e) => dot(e.tip, '#7fd6ff'));
  }
}

const TAP_STEPS = ['Tap one eye', 'Tap the other eye', 'Tap the tip of the nose'];
function tapHint() {
  const a = state.autoFit[state.src];
  const tex = state.built && state.built.tex;
  let msg;
  if (state.taps[state.src]) msg = 'Using your taps for the eyes and nose.';
  else if (!a) msg = 'Finding the face…';
  else if (a.failed) msg = 'Couldn\'t find the face. Tap the eyes and nose to place them.';
  else {
    msg = 'Lifted the eyes, nose, forehead and a fur sample (dashed) onto the structure.';
    if (tex && tex.photo && Math.abs(tex.pose.yaw) > 0.2) {
      msg += ` Head turned about ${Math.round(Math.abs(tex.pose.yaw) * 57)}°, ${tex.pose.ratio > 1.9 ? 'far side mirrored from the near side' : 'far eye widened back out'}.`;
    }
  }
  $('#align-hint').textContent = state.tapping ? TAP_STEPS[state.tapping.length] : msg;
  $('#tap').classList.toggle('on', !!state.tapping);
}
$('#tap').addEventListener('click', () => { state.tapping = state.tapping ? null : []; tapHint(); drawGuide(); });

guide.addEventListener('pointerdown', (e) => {
  if (!state.tapping) return;
  const img = $('#photo'), r = guide.getBoundingClientRect();
  const k = img.naturalWidth / r.width;
  state.tapping.push([(e.clientX - r.left) * k, (e.clientY - r.top) * k]);
  if (state.tapping.length === 3) {
    state.taps[state.src] = state.tapping;
    state.tapping = null;
    rebuild();
  } else drawGuide();
  tapHint();
});
$('#reset-align').addEventListener('click', () => { delete state.taps[state.src]; state.tapping = null; tapHint(); rebuild(); });
document.querySelectorAll('[data-face]').forEach((b) => b.addEventListener('click', () => { state.faceMode = b.dataset.face; syncSeg(); rebuild(); }));
new ResizeObserver(() => drawGuide()).observe($('#photo'));

function repaint() {
  if (!state.built) return;
  const { pet, pal, build, layout, widthMM, tex } = state.built;
  const art = $('#art');
  paintArt(art, layout, pet, pal, build, tex);
  paintSheet($('#sheet'), art, layout, {
    title: `${pet.name} ornament`,
    subtitle: `Print at 100% on Letter cardstock · about ${widthMM} mm wide · solid = cut, dashed = fold, numbered tabs glue to matching numbers`,
  });
  texture.needsUpdate = true;
  drawGuide();
}

function rebuild() {
  const key = state.override || state.key;
  let pet = BREEDS[key];
  const pal0 = pet.colors;
  let picked = null;
  if (state.photoColors && state.palette) {
    picked = coatColors(state.palette, pet.pattern);
    pet = withColors(pet, { base: picked.base, light: picked.light || pal0.light, dark: picked.dark || pal0.dark });
  }
  const pal = pet.colors;
  const lm = photoLandmarks();
  const usePhoto = state.faceMode === 'photo' && lm && state.seg && state.img && !state.lineup;
  // the structure stays the breed's shape; only eye spacing and nose height follow the pet
  const prop = usePhoto ? proportions(facePose(lm), state.seg, faceLayout(pet)) : null;
  const build = buildPet(pet, 'head', prop);
  const tex = usePhoto ? photoTexture(state.img, state.seg, lm, build.template) : cartoonTexture(pet, build.template, pal);
  const unfolds = build.parts.map(unfoldPart);
  // every ornament prints about 70 mm wide
  const xs = build.parts.flatMap((p) => p.verts.map((v) => v[0]));
  const layout = layoutSheet(unfolds, 70 / (Math.max(...xs) - Math.min(...xs)));
  const art = $('#art');
  const widthMM = Math.round((Math.max(...xs) - Math.min(...xs)) * layout.scale);
  state.built = { pet, pal, build, layout, widthMM, tex, src: state.src };
  $('#view-status').hidden = !(state.faceMode === 'photo' && !state.lineup && !usePhoto && !state.autoFit[state.src]);
  repaint();
  tapHint();
  setModel(state.lineup ? buildLineup() : makeGroup(layout, texture, art.width, art.height));

  $('#traits').innerHTML = traits(pet).map((t) => `<li>${t}</li>`).join('');
  $('#swatches').innerHTML = ['base', 'light', 'dark'].map((k) => `<span class="sw" style="--c:${pal[k]}" data-help="${k === 'base' ? 'Main coat' : k === 'light' ? 'Light markings: chest, muzzle, socks' : 'Dark markings: mask, saddle, points'}${picked && picked[k] ? ', picked from the photo' : ', breed default'}"></span>`).join('');
  const nFaces = layout.faces.length;
  const nTabs = layout.islands.reduce((s, i) => s + i.tabs.length, 0);
  $('#specs').textContent = `${layout.islands.length} piece${layout.islands.length > 1 ? 's' : ''} · ${nFaces} faces · ${nTabs} glue tabs · ${widthMM} mm wide`;
}

loadModel().catch(() => {});
loadDetector().catch(() => {});
loadSegmenter().catch(() => {});
loadLandmarker().catch(() => {});
select(SAMPLES[1].photos[0], SAMPLES[1].label);
