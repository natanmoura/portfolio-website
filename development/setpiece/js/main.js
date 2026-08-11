// main.js — wiring.
//
// Left pane: the drawing, with everything the solve knows drawn back on top of
// it. Right pane: the world. The whole tool is the loop between those two.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { emptyScene, uid, deserialize } from './scene.js';
import { fitVanishingPoint, solveTwoPoint, SolvedCamera } from './calib.js';
import { autoCalibrate } from './autocalib.js';
import { familyDirection, axonometricFromStation } from './ortho.js';
import { buildScene, updateBillboards } from './viewer.js';
import { rectToNode } from './blockout.js';
import { slideDepth, depthOf, screenDrift } from './depth.js';
import { applyAllFields } from './scatter.js';
import { exportSceneJSON, exportGLB } from './exporter.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  scene: emptyScene(),
  cam: null,
  stationId: null,
  image: null,        // the drawing being blocked out
  gridImage: null,    // optional perspective-grid reference to calibrate from
  gridReport: null,
  mode: 'block',
  lines: { vpX: [], vpZ: [] },
  drag: null,
  detected: null,
  selected: null,
  showBlockout: false,
  showGroundGrid: false,
  worldScale: 10,
  fly: false,
  flyT: 0,
};

/* ------------------------------------------------------------------ 3D view */

const canvas3d = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const world = new THREE.Scene();
world.background = new THREE.Color('#14141a');

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 20000);
camera.position.set(0, 12, 40);

const controls = new OrbitControls(camera, canvas3d);
controls.target.set(0, 0, -20);
controls.enableDamping = true;

let grid = null;
let group = new THREE.Group();
world.add(group);

/** A regular world grid, sized to the scene so it reads at any scale. */
function refreshWorldGrid() {
  if (grid) { world.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  const span = Math.max(40, state.worldScale * 12);
  grid = new THREE.GridHelper(span, 40, 0x3a3a48, 0x25252f);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  world.add(grid);
}
refreshWorldGrid();

let edgeCache = null;

function rebuild() {
  world.remove(group);
  group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  group = buildScene(state.scene);
  world.add(group);
  edgeCache = null;
  renderNodeList();
  drawOverlay();
}

function resize() {
  const w = canvas3d.clientWidth;
  const h = canvas3d.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas3d);

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();

  if (state.fly && state.cam) {
    state.flyT += dt * 0.1;
    const t = (Math.sin(state.flyT * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const fwd = new THREE.Vector3(0, 0, -1).applyMatrix4(state.cam.rotation);
    camera.position.copy(state.cam.position).addScaledVector(fwd, t * state.worldScale * 6);
    camera.quaternion.setFromRotationMatrix(state.cam.rotation);
  } else {
    controls.update();
  }

  updateBillboards(group, camera);
  renderer.render(world, camera);
  $('#hud').textContent = `${state.scene.nodes.length} objects`;
}
tick();
resize();

/* -------------------------------------------------------------- image pane */

const img = $('#source');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');

function layoutOverlay() {
  if (!state.image) return;
  const r = img.getBoundingClientRect();
  const stage = $('#image-stage').getBoundingClientRect();
  overlay.style.left = `${r.left - stage.left}px`;
  overlay.style.top = `${r.top - stage.top}px`;
  overlay.style.width = `${r.width}px`;
  overlay.style.height = `${r.height}px`;
  overlay.width = Math.round(r.width * devicePixelRatio);
  overlay.height = Math.round(r.height * devicePixelRatio);
  octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  drawOverlay();
}
new ResizeObserver(layoutOverlay).observe($('#image-stage'));

const toImage = (px, py) => {
  const r = img.getBoundingClientRect();
  return { x: (px / r.width) * state.image.width, y: (py / r.height) * state.image.height };
};
const toView = (ix, iy) => {
  const r = img.getBoundingClientRect();
  return { x: (ix / state.image.width) * r.width, y: (iy / state.image.height) * r.height };
};

overlay.addEventListener('pointerdown', (e) => {
  if (!state.image) return;
  overlay.setPointerCapture(e.pointerId);
  const r = overlay.getBoundingClientRect();
  const p = toImage(e.clientX - r.left, e.clientY - r.top);
  state.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
});

overlay.addEventListener('pointermove', (e) => {
  if (!state.drag) return;
  const r = overlay.getBoundingClientRect();
  const p = toImage(e.clientX - r.left, e.clientY - r.top);
  state.drag.x1 = p.x;
  state.drag.y1 = p.y;
  drawOverlay();
});

overlay.addEventListener('pointerup', () => {
  const d = state.drag;
  state.drag = null;
  if (!d) return;
  if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 8) { drawOverlay(); return; }

  if (state.mode === 'vpX' || state.mode === 'vpZ') {
    state.lines[state.mode].push({ x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1 });
    solveFromTracedLines();
  } else if (state.cam) {
    const node = rectToNode(state.cam, d, state.mode === 'card' ? 'card' : 'box', {
      stationId: state.stationId,
      axisAligned: true,
    });
    if (node) {
      state.scene.nodes.push(node);
      rebuild();
      select(node.id);
      setStatus(`placed ${node.type}: ${node.size.map((v) => v.toFixed(1)).join(' x ')}`, 'ok');
    } else {
      setStatus('that bottom edge is above the horizon, so it has no ground contact', 'warn');
    }
  } else {
    setStatus('solve the camera first', 'warn');
  }
  drawOverlay();
});

overlay.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const set = state.lines[state.mode];
  if (set && set.length) { set.pop(); solveFromTracedLines(); }
});

/* -------------------------------------------------------- overlay rendering */

function strokeWorld(a, b, steps = 10) {
  octx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const p = new THREE.Vector3().lerpVectors(a, b, i / steps);
    const q = state.cam.project(p);
    if (!q) { started = false; continue; }
    const v = toView(q.u, q.v);
    if (!started) { octx.moveTo(v.x, v.y); started = true; }
    else octx.lineTo(v.x, v.y);
  }
  octx.stroke();
}

/** Outline segments of every built mesh, cached until geometry changes. */
function blockoutEdges() {
  if (edgeCache) return edgeCache;
  edgeCache = [];
  for (const mesh of group.children) {
    mesh.updateMatrixWorld(true);
    const eg = new THREE.EdgesGeometry(mesh.geometry, 25);
    const pos = eg.attributes.position;
    if (pos.count >= 2) {
      for (let i = 0; i < pos.count; i += 2) {
        edgeCache.push([
          new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld),
          new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(mesh.matrixWorld),
        ]);
      }
      eg.dispose();
      continue;
    }
    eg.dispose();
    // Smooth shapes have no hard edges, so show a silhouette ring instead.
    mesh.geometry.computeBoundingSphere();
    const c = mesh.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);
    const r = mesh.geometry.boundingSphere.radius * mesh.scale.x;
    for (let i = 0; i < 24; i++) {
      const t0 = (i / 24) * Math.PI * 2;
      const t1 = ((i + 1) / 24) * Math.PI * 2;
      edgeCache.push([
        new THREE.Vector3(c.x + Math.cos(t0) * r, c.y + Math.sin(t0) * r, c.z),
        new THREE.Vector3(c.x + Math.cos(t1) * r, c.y + Math.sin(t1) * r, c.z),
      ]);
    }
  }
  return edgeCache;
}

function drawOverlay() {
  if (!state.image) return;
  const w = overlay.width / devicePixelRatio;
  const h = overlay.height / devicePixelRatio;
  octx.clearRect(0, 0, w, h);

  // The solved ground plane, drawn as a regular world grid. If this lies on the
  // floor of the drawing, the perspective is right and everything else follows.
  if (state.showGroundGrid && state.cam) {
    const step = Math.max(1, Math.round(state.worldScale / 2));
    const reach = step * 40;
    octx.strokeStyle = 'rgba(0,170,120,0.55)';
    octx.lineWidth = 1;
    for (let i = -reach; i <= reach; i += step) {
      strokeWorld(new THREE.Vector3(i, 0, -reach), new THREE.Vector3(i, 0, reach));
      strokeWorld(new THREE.Vector3(-reach, 0, i), new THREE.Vector3(reach, 0, i));
    }
    const hv = state.cam.horizonV();
    if (hv != null) {
      const y = toView(0, hv).y;
      octx.strokeStyle = 'rgba(255,255,255,0.65)';
      octx.setLineDash([7, 5]);
      octx.beginPath();
      octx.moveTo(0, y);
      octx.lineTo(w, y);
      octx.stroke();
      octx.setLineDash([]);
    }
  }

  // The blockout's own outline. Where red sits on the drawn lines, it is right.
  if (state.showBlockout && state.cam) {
    octx.strokeStyle = 'rgba(255,40,40,0.9)';
    octx.lineWidth = 1.4;
    for (const [a, b] of blockoutEdges()) {
      const pa = state.cam.project(a);
      const pb = state.cam.project(b);
      if (!pa || !pb) continue;
      const va = toView(pa.u, pa.v);
      const vb = toView(pb.u, pb.v);
      octx.beginPath();
      octx.moveTo(va.x, va.y);
      octx.lineTo(vb.x, vb.y);
      octx.stroke();
    }
  }

  // Hand-traced calibration lines.
  for (const [key, color] of [['vpX', '#ff7a45'], ['vpZ', '#58c4dd']]) {
    octx.strokeStyle = color;
    octx.lineWidth = 2;
    for (const s of state.lines[key]) {
      const a = toView(s.x1, s.y1);
      const b = toView(s.x2, s.y2);
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
    }
  }

  if (state.drag) {
    const a = toView(state.drag.x0, state.drag.y0);
    const b = toView(state.drag.x1, state.drag.y1);
    octx.strokeStyle = '#fff';
    octx.lineWidth = 1.5;
    if (state.mode === 'vpX' || state.mode === 'vpZ') {
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
    } else {
      octx.setLineDash([5, 4]);
      octx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      octx.setLineDash([]);
    }
  }
}

function setStatus(text, cls = '') {
  $('#solve-status').textContent = text;
  $('#solve-status').className = `status ${cls}`;
}

/* ------------------------------------------------------------------- solving */

/**
 * Solve the camera.
 *
 * A separate perspective-grid reference is the best possible input, because it
 * is nothing but clean converging lines. But a bare ground grid contains no
 * upright edges, so on its own it cannot pin the principal point down. The
 * drawing supplies exactly that missing piece. Using both is strictly better
 * than either alone, which is the whole reason to accept two images.
 */
function solveCamera() {
  if (!state.image) return setStatus('load a drawing first', 'warn');

  const drawingReport = autoCalibrate(img, state.worldScale);
  state.detected = drawingReport;

  const uprightOf = (report) =>
    report.groups
      .map((g) => ({ g, dir: familyDirection(g.inliers) }))
      .filter((f) => Math.abs(f.dir.y) > 0.85)
      .sort((a, b) => b.g.inliers.length - a.g.inliers.length)[0];

  // Preferred path: vanishing points from the grid, uprights from the drawing.
  if (state.gridReport && state.gridReport.groups.length >= 2) {
    const ground = state.gridReport.groups
      .map((g) => ({ g, dir: familyDirection(g.inliers) }))
      .filter((f) => Math.abs(f.dir.y) < 0.85)
      .sort((a, b) => b.g.inliers.length - a.g.inliers.length);

    const up = uprightOf(drawingReport);

    if (ground.length >= 2 && up) {
      const cam = solveTwoPoint({
        vpA: ground[0].g.vp,
        vpB: ground[1].g.vp,
        upDir: up.dir,
        width: state.image.width,
        height: state.image.height,
        camHeight: state.worldScale,
      });
      if (cam) {
        adopt(cam,
          `grid + drawing · two-point · focal ${Math.round(cam.focal)}px · fov ${cam.fovY.toFixed(1)}°`,
          `vanishing points from ${ground[0].g.inliers.length} and ${ground[1].g.inliers.length} grid lines, ` +
          `uprights from ${up.g.inliers.length} lines in the drawing`);
        return;
      }
    }
  }

  // Otherwise fall back to solving from the drawing alone.
  if (!drawingReport.camera) {
    setStatus(`could not solve: ${drawingReport.reason || 'not enough converging lines'}`, 'warn');
    return;
  }
  adopt(drawingReport.camera, drawingReport.method, `${drawingReport.segments.length} edges in the drawing`);
}

function adopt(cam, headline, detail) {
  state.cam = cam;
  upsertStation(cam);
  state.lines.vpX = [];
  state.lines.vpZ = [];

  $('#cam-info').className = 'sel-name';
  $('#cam-info').textContent = cam.isOrthographic
    ? 'parallel projection'
    : `focal ${Math.round(cam.focal)}px · fov ${cam.fovY.toFixed(1)}° · principal ${Math.round(cam.cx)},${Math.round(cam.cy)}`;

  state.showGroundGrid = true;
  $('#btn-grid3d').classList.add('on');

  rebuild();
  matchCamera();
  setStatus(`${headline}. ${detail}. Green grid is the solved floor: check it lies on the drawing.`, 'ok');
}

/** Manual fallback: two traced line families. */
function solveFromTracedLines() {
  const a = state.lines.vpX;
  const b = state.lines.vpZ;
  if (a.length < 2 || b.length < 2) {
    setStatus(`Lines A: ${a.length}/2 · Lines B: ${b.length}/2`);
    drawOverlay();
    return;
  }
  const vpA = fitVanishingPoint(a);
  const vpB = fitVanishingPoint(b);
  if (!vpA || !vpB) return setStatus('those lines do not converge', 'warn');

  const up = state.detected && state.detected.groups
    .map((g) => ({ g, dir: familyDirection(g.inliers) }))
    .filter((f) => Math.abs(f.dir.y) > 0.85)
    .sort((x, y) => y.g.inliers.length - x.g.inliers.length)[0];

  const cam = solveTwoPoint({
    vpA, vpB,
    upDir: up ? up.dir : { x: 0, y: 1 },
    width: state.image.width,
    height: state.image.height,
    camHeight: state.worldScale,
  });
  if (!cam) return setStatus('those two directions are not perpendicular in the scene', 'warn');
  adopt(cam, 'traced by hand · two-point', 'from your Lines A and Lines B');
}

function upsertStation(cam) {
  const station = cam.toStation(state.stationId || uid('st'), state.image.src);
  state.stationId = station.id;
  const i = state.scene.stations.findIndex((s) => s.id === station.id);
  if (i >= 0) state.scene.stations[i] = station;
  else state.scene.stations.push(station);
}

/* --------------------------------------------------------- selection + depth */

function centreLift(node) {
  const [w, h] = node.size || [1, 1, 1];
  if (node.type === 'ground' || node.type === 'dome') return 0;
  if (node.type === 'sphere') return w / 2;
  if (node.type === 'pipe' && (node.rotationX || node.rotationZ)) return 0;
  return h / 2;
}

function select(id) {
  state.selected = id;
  const node = state.scene.nodes.find((n) => n.id === id);
  const slider = $('#sel-depth');

  if (!node) {
    $('#sel-name').textContent = 'nothing selected';
    $('#sel-name').className = 'sel-name none';
    slider.disabled = true;
  } else {
    $('#sel-name').textContent = `${node.name} · ${node.type} · ${node.size.map((v) => v.toFixed(1)).join(' x ')}`;
    $('#sel-name').className = 'sel-name';
    slider.disabled = !state.cam;
    $('#sel-depth-out').textContent = state.cam
      ? depthOf(node, state.cam, centreLift(node)).toFixed(1) : '0';
  }
  slider.value = 0;
  for (const row of $('#nodes').children) row.classList.toggle('on', row.dataset.id === id);
  highlight();
}

function highlight() {
  group.traverse((o) => {
    if (!o.isMesh) return;
    const on = o.userData.nodeId === state.selected;
    if (o.userData.baseColor === undefined && o.material.color) {
      o.userData.baseColor = o.material.color.getHex();
    }
    if (o.material.color && o.userData.baseColor !== undefined) {
      o.material.color.setHex(on ? 0xff7a45 : o.userData.baseColor);
    }
  });
}

function nudgeDepth(delta) {
  const node = state.scene.nodes.find((n) => n.id === state.selected);
  if (!node || !state.cam) return;
  const lift = centreLift(node);
  const before = new THREE.Vector3(node.position[0], node.position[1] + lift, node.position[2]);
  slideDepth(node, state.cam, delta, lift);
  const after = new THREE.Vector3(node.position[0], node.position[1] + centreLift(node), node.position[2]);

  // The promise of this control is that nothing moves on screen. Check it every
  // time rather than trusting the maths.
  const drift = screenDrift(state.cam, before, after);
  node.pinned = true;
  rebuild();
  select(node.id);
  setStatus(
    `${node.name}: depth ${depthOf(node, state.cam, centreLift(node)).toFixed(1)}` +
    (drift > 0.5 ? ` · WARNING drifted ${drift.toFixed(1)}px` : ' · unchanged on screen'),
    drift > 0.5 ? 'warn' : 'ok',
  );
}

let lastSlider = 0;
$('#sel-depth').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  nudgeDepth(v - lastSlider);
  lastSlider = v;
});
$('#sel-depth').addEventListener('change', (e) => { e.target.value = 0; lastSlider = 0; });
$('#sel-clear').addEventListener('click', () => select(null));

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '[') nudgeDepth(-Math.max(0.5, state.worldScale / 20));
  if (e.key === ']') nudgeDepth(Math.max(0.5, state.worldScale / 20));
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!state.selected) return;
    state.scene.nodes = state.scene.nodes.filter((n) => n.id !== state.selected);
    select(null);
    rebuild();
  }
});

const picker = new THREE.Raycaster();
canvas3d.addEventListener('pointerdown', (e) => {
  const r = canvas3d.getBoundingClientRect();
  picker.setFromCamera(new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1,
  ), camera);
  const hit = picker.intersectObjects(group.children, false)[0];
  if (hit) select(hit.object.userData.nodeId);
});

function renderNodeList() {
  const host = $('#nodes');
  host.innerHTML = '';
  for (const n of state.scene.nodes) {
    if (n.field) continue;
    const row = document.createElement('div');
    row.className = 'row' + (n.id === state.selected ? ' on' : '');
    row.dataset.id = n.id;
    row.innerHTML = `<span>${n.name || n.id}</span><span class="t">${n.type}</span>`;
    row.addEventListener('click', () => select(n.id));
    host.appendChild(row);
  }
  highlight();
}

/* ----------------------------------------------------------------- controls */

function matchCamera() {
  if (!state.cam) return;
  state.fly = false;
  $('#btn-fly').classList.remove('on');
  const fwd = new THREE.Vector3(0, 0, -1).applyMatrix4(state.cam.rotation);

  if (state.cam.isOrthographic) {
    const span = state.cam.height / state.cam.scale;
    const dist = span / (2 * Math.tan((12 * Math.PI) / 360));
    camera.fov = 12;
    camera.position.copy(state.cam.groundPoint(state.cam.cx, state.cam.cy) || new THREE.Vector3())
      .addScaledVector(fwd, -dist);
  } else {
    camera.fov = state.cam.fovY;
    camera.position.copy(state.cam.position);
  }
  camera.quaternion.setFromRotationMatrix(state.cam.rotation);
  camera.updateProjectionMatrix();
  controls.target.copy(camera.position).addScaledVector(fwd, state.worldScale * 3);
}

$('#btn-solve').addEventListener('click', solveCamera);
$('#btn-match').addEventListener('click', matchCamera);

$('#btn-overlay').addEventListener('click', (e) => {
  if (!state.cam) return setStatus('solve the camera first', 'warn');
  state.showBlockout = !state.showBlockout;
  e.target.classList.toggle('on', state.showBlockout);
  drawOverlay();
});

$('#btn-grid3d').addEventListener('click', (e) => {
  if (!state.cam) return setStatus('solve the camera first', 'warn');
  state.showGroundGrid = !state.showGroundGrid;
  e.target.classList.toggle('on', state.showGroundGrid);
  drawOverlay();
});

$('#btn-fly').addEventListener('click', (e) => {
  state.fly = !state.fly;
  state.flyT = 0;
  e.target.classList.toggle('on', state.fly);
});

$('#modes').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.mode = btn.dataset.mode;
  for (const b of $('#modes').children) b.classList.toggle('on', b === btn);
});

$('#cam-height').addEventListener('input', (e) => {
  state.worldScale = parseFloat(e.target.value);
  $('#cam-height-out').textContent = state.worldScale.toFixed(0);
  refreshWorldGrid();
  if (!state.cam) return;

  // World scale is a uniform rescale: the picture is unchanged, so rescale the
  // camera and everything in the scene together and nothing shifts on screen.
  const ratio = state.worldScale / (state.cam.isOrthographic ? state.cam.camHeight : state.cam.position.y);
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  state.cam.camHeight = state.worldScale;
  if (!state.cam.isOrthographic) state.cam.position.y = state.worldScale;
  for (const node of state.scene.nodes) {
    node.position = node.position.map((v) => v * ratio);
    node.size = node.size.map((v) => v * ratio);
  }
  upsertStation(state.cam);
  rebuild();
});

/* ------------------------------------------------------------------ loading */

function readImage(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const probe = new Image();
    probe.onload = () => done(reader.result, probe);
    probe.src = reader.result;
  };
  reader.readAsDataURL(file);
}

$('#load-image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readImage(file, (src, probe) => {
    state.image = { src, width: probe.naturalWidth, height: probe.naturalHeight };
    state.cam = null;
    state.detected = null;
    state.lines.vpX = [];
    state.lines.vpZ = [];
    img.src = src;
    img.onload = () => { layoutOverlay(); setStatus('drawing loaded. Press Solve camera.'); };
  });
});

$('#load-grid').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readImage(file, (src, probe) => {
    state.gridImage = { src, width: probe.naturalWidth, height: probe.naturalHeight };
    state.gridReport = autoCalibrate(probe, state.worldScale);
    const n = state.gridReport.groups.length;
    setStatus(
      `perspective grid loaded: ${state.gridReport.segments.length} lines, ${n} vanishing direction${n === 1 ? '' : 's'}. ` +
      'Press Solve camera to combine it with the drawing.',
      n >= 2 ? 'ok' : 'warn',
    );
  });
});

/* ------------------------------------------------------------- scenes and IO */

function frameScene() {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.6;
  const dist = radius / Math.tan((camera.fov * Math.PI) / 360) + radius * 0.4;
  state.fly = false;
  $('#btn-fly').classList.remove('on');
  camera.position.set(centre.x + dist * 0.55, centre.y + radius * 0.75, centre.z + dist * 0.85);
  controls.target.copy(centre);
  controls.update();
}

function loadSceneData(text, label) {
  state.scene = deserialize(text);
  applyAllFields(state.scene);

  const st = state.scene.stations[0];
  if (st) {
    state.stationId = st.id;
    state.image = { src: st.src, width: st.width, height: st.height };
    state.cam = st.projection === 'orthographic'
      ? axonometricFromStation(st)
      : new SolvedCamera({
          width: st.width, height: st.height, focal: st.focal,
          cx: st.principal ? st.principal[0] : undefined,
          cy: st.principal ? st.principal[1] : undefined,
          rotation: new THREE.Matrix4().fromArray(st.rotation),
          camHeight: st.position[1],
        });
    $('#cam-info').className = 'sel-name';
    $('#cam-info').textContent = st.projection === 'orthographic'
      ? 'parallel projection'
      : `focal ${Math.round(st.focal)}px · principal ${Math.round(state.cam.cx)},${Math.round(state.cam.cy)}`;
    img.src = st.src;
    img.onload = () => { layoutOverlay(); drawOverlay(); };
  }
  select(null);
  rebuild();
  frameScene();
  setStatus(`${label}: ${state.scene.nodes.length} objects.`, 'ok');
}

$('#pick-scene').addEventListener('change', async (e) => {
  const name = e.target.value;
  if (!name) return;
  try {
    const res = await fetch(`scenes/${name}.json`);
    if (!res.ok) throw new Error(`scenes/${name}.json (${res.status})`);
    loadSceneData(await res.text(), name);
  } catch (err) { setStatus(String(err.message || err), 'warn'); }
});

$('#load-scene').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) loadSceneData(await file.text(), file.name);
});

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.json')) loadSceneData(await file.text(), file.name);
});

$('#btn-json').addEventListener('click', () => exportSceneJSON(state.scene));
$('#btn-glb').addEventListener('click', () => exportGLB(group, state.scene));

renderNodeList();
