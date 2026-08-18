// Component editor. A separate window from the town on purpose: authoring a
// brick and arranging a city are different jobs, and the editor wants the
// whole viewport for one object rather than a corner of the town view.
//
// Editing here never touches the city. A component is loaded from the
// library, edited, and saved back to localStorage as an override layer keyed
// by id; the files on disk stay authoritative until someone downloads the
// edited json and commits it. That keeps the shipped library reproducible
// while still letting the editor be useful without a server round trip.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadLibrary, resolveComponent, isEmptyComponent } from './library.js';
import { MODIFIERS } from './modifiers.js';
import { h, setChildren } from './ui.js';

const STORE_KEY = 'awesome-town:component-edits';

const listEl = document.getElementById('list');
const editEl = document.getElementById('edit');
const viewportEl = document.getElementById('viewport');
const statusEl = document.getElementById('status');

let library = { components: new Map(), templates: new Map() };
let edits = load();
let currentId = null;
let seed = 1;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(edits));
}

function setStatus(text) {
  statusEl.textContent = text;
}

// The component as it currently reads: what shipped, plus whatever is being
// edited on top. Everything downstream works from this, so the viewport and
// the panel can never disagree about which version they are showing.
function current() {
  const base = library.components.get(currentId);
  if (!base) return null;
  return edits[currentId] ? { ...base, ...edits[currentId] } : base;
}

function isDirty(id) {
  return Boolean(edits[id]);
}

function mutate(patch) {
  const base = library.components.get(currentId);
  edits[currentId] = { ...(edits[currentId] || {}), ...patch };
  // Anything that matches the shipped file again is not an edit, so the
  // dirty marker stays honest rather than sticking once touched.
  const merged = { ...base, ...edits[currentId] };
  if (JSON.stringify(merged) === JSON.stringify(base)) delete edits[currentId];
  persist();
  renderList();
  renderEdit();
  refreshViewport();
}

// --- viewport ---------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
viewportEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1b1e);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
camera.position.set(2.8, 2.2, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.6, 0);

scene.add(new THREE.HemisphereLight(0xdfe6f2, 0x2a2a2e, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(3, 5, 2);
scene.add(key);

const grid = new THREE.GridHelper(8, 16, 0x555560, 0x333338);
scene.add(grid);

const mat = new THREE.MeshStandardMaterial({
  color: 0xc9c4b8,
  roughness: 0.75,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: true,
});
let mesh = null;
const boundsBox = new THREE.Box3Helper(new THREE.Box3(), 0x6f8fbf);
boundsBox.visible = false;
scene.add(boundsBox);

function refreshViewport() {
  const component = current();
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh = null;
  }
  if (!component) {
    boundsBox.visible = false;
    return;
  }

  const resolved = resolveComponent(component, seed, `editor:${component.id}`);
  const { w, h: hh, d } = resolved.bounds;
  boundsBox.box.set(
    new THREE.Vector3(-w / 2, 0, -d / 2),
    new THREE.Vector3(w / 2, hh, d / 2)
  );
  boundsBox.visible = true;

  if (resolved.geometry) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(resolved.geometry.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(resolved.geometry.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(resolved.geometry.uv, 2));
    mesh = new THREE.Mesh(geo, mat);
    // Shapes are built centred on their own origin; sit it on the grid so
    // the base anchor lines up with where it would stack in the town.
    mesh.position.y = hh / 2;
    scene.add(mesh);
  }
  renderStats(resolved);
}

function resize() {
  const w = viewportEl.clientWidth;
  const hgt = viewportEl.clientHeight;
  if (!w || !hgt) return;
  renderer.setSize(w, hgt, false);
  camera.aspect = w / hgt;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewportEl);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// --- parameter editing ------------------------------------------------------

const MODES = ['free', 'range', 'fixed'];

function normalise(param) {
  if (typeof param === 'number') return { mode: 'fixed', value: param };
  return param || { mode: 'free', min: 0, max: 1 };
}

function num(value, onInput) {
  const input = h('input', { type: 'number', step: '0.01', value: String(value) });
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (!Number.isNaN(v)) onInput(v);
  });
  return input;
}

// One row per parameter, and the row is where the lock model lives: pick
// free, range or fixed and the fields underneath change to match. This is
// the whole authoring gesture — progressively pinning down the things you
// have an opinion about and leaving the rest to the generator.
function lockRow(name, param, onChange) {
  const p = normalise(param);
  const modes = h(
    'div',
    { class: 'lock-modes' },
    ...MODES.map((mode) => {
      const btn = h('button', { class: p.mode === mode ? 'on' : '' }, mode);
      btn.addEventListener('click', () => {
        if (mode === 'fixed') {
          const mid = p.mode === 'fixed' ? p.value : ((p.min ?? 0) + (p.max ?? 1)) / 2;
          onChange({ mode: 'fixed', value: round(mid) });
        } else {
          const min = p.mode === 'fixed' ? round(p.value * 0.8) : (p.min ?? 0);
          const max = p.mode === 'fixed' ? round(p.value * 1.2) : (p.max ?? 1);
          onChange({ mode, min, max });
        }
      });
      return btn;
    })
  );

  const fields =
    p.mode === 'fixed'
      ? h('div', { class: 'lock-fields' }, num(p.value ?? 0, (v) => onChange({ mode: 'fixed', value: v })))
      : h(
          'div',
          { class: 'lock-fields' },
          num(p.min ?? 0, (v) => onChange({ ...p, min: v })),
          h('span', { class: 'sep' }, 'to'),
          num(p.max ?? 1, (v) => onChange({ ...p, max: v }))
        );

  return h('div', { class: 'lock-row' }, h('label', {}, name), modes, fields);
}

const round = (v) => Math.round(v * 1000) / 1000;

function paramsSection(component) {
  const rows = Object.entries(component.params || {}).map(([name, param]) =>
    lockRow(name, param, (next) =>
      mutate({ params: { ...(component.params || {}), [name]: next } })
    )
  );
  return h('div', {}, h('h3', {}, 'Parameters'), ...rows);
}

// --- modifier stack ---------------------------------------------------------

function modifierBlock(component, entry, i) {
  const def = MODIFIERS[entry.type];
  if (!def) return null;
  const stack = component.modifiers || [];

  const write = (next) => mutate({ modifiers: next });
  const replace = (patch) =>
    write(stack.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (delta) => {
    const next = stack.slice();
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  const enabled = entry.enabled !== false;
  const toggle = h('button', { title: enabled ? 'Disable' : 'Enable' }, enabled ? '◉' : '○');
  toggle.addEventListener('click', () => replace({ enabled: !enabled }));

  const up = h('button', { title: 'Move up' }, '↑');
  up.addEventListener('click', () => move(-1));
  const down = h('button', { title: 'Move down' }, '↓');
  down.addEventListener('click', () => move(1));
  const del = h('button', { title: 'Remove' }, '✕');
  del.addEventListener('click', () => write(stack.filter((_, j) => j !== i)));

  const params = { ...def.defaults, ...(entry.params || {}) };
  const rows = Object.entries(params).map(([name, param]) =>
    lockRow(name, param, (next) => replace({ params: { ...params, [name]: next } }))
  );

  return h(
    'div',
    { class: `mod${enabled ? '' : ' off'}` },
    h(
      'div',
      { class: 'mod-head' },
      toggle,
      h('span', { class: 'name' }, def.label),
      h('span', { class: 'grow' }),
      up,
      down,
      del
    ),
    h('div', { class: 'mod-body' }, ...rows)
  );
}

function modifiersSection(component) {
  const stack = component.modifiers || [];
  const add = h('select', {});
  add.appendChild(h('option', { value: '' }, 'Add modifier…'));
  for (const [type, def] of Object.entries(MODIFIERS)) {
    add.appendChild(h('option', { value: type }, def.label));
  }
  add.addEventListener('change', () => {
    if (!add.value) return;
    mutate({ modifiers: [...stack, { type: add.value, enabled: true, params: {} }] });
    add.value = '';
  });

  return h(
    'div',
    {},
    h('h3', {}, 'Modifiers'),
    ...stack.map((entry, i) => modifierBlock(component, entry, i)).filter(Boolean),
    stack.length ? null : h('p', { class: 'stat-line' }, 'No modifiers. The shape is used as built.'),
    add
  );
}

// --- variants ---------------------------------------------------------------

// Scrubbing the seed is how you check that a component survives variation
// rather than only looking right at the one value it was tuned at. Same
// hash-per-parameter resolution the town uses, so what is seen here is
// exactly what a lot with that seed would get.
function variantSection() {
  const slider = h('input', { type: 'range', min: '1', max: '400', step: '1', value: String(seed) });
  const label = h('span', { class: 'seed' }, `seed ${seed}`);
  slider.addEventListener('input', () => {
    seed = parseInt(slider.value, 10);
    label.textContent = `seed ${seed}`;
    refreshViewport();
  });
  const roll = h('button', { class: 'btn' }, 'Random');
  roll.addEventListener('click', () => {
    seed = 1 + Math.floor(Math.random() * 400);
    slider.value = String(seed);
    label.textContent = `seed ${seed}`;
    refreshViewport();
  });
  return h('div', {}, h('h3', {}, 'Variant'), h('div', { class: 'variant' }, slider, label, roll));
}

let statsEl = null;
function renderStats(resolved) {
  if (!statsEl) return;
  const b = resolved.bounds;
  const tris = resolved.geometry ? resolved.geometry.pos.length / 9 : 0;
  statsEl.textContent = `${b.w.toFixed(2)} × ${b.h.toFixed(2)} × ${b.d.toFixed(2)}  ·  ${tris} tris`;
}

// --- panels -----------------------------------------------------------------

function renderList() {
  const byTag = new Map();
  for (const c of library.components.values()) {
    const tag = (c.tags || ['untagged'])[0];
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(c);
  }
  const kids = [];
  for (const [tag, items] of [...byTag.entries()].sort()) {
    kids.push(h('div', { class: 'lib-group' }, tag));
    for (const c of items.sort((a, b) => a.label.localeCompare(b.label))) {
      const btn = h(
        'button',
        { class: `lib-item${c.id === currentId ? ' on' : ''}${isDirty(c.id) ? ' dirty' : ''}` },
        h('span', {}, c.label),
        h('span', { class: 'tag' }, (c.tags || []).slice(1).join(' '))
      );
      btn.addEventListener('click', () => select(c.id));
      kids.push(btn);
    }
  }
  setChildren(listEl, ...kids);
}

function renderEdit() {
  const component = current();
  if (!component) {
    setChildren(editEl, h('p', { class: 'stat-line' }, 'Pick a component.'));
    return;
  }
  statsEl = h('p', { class: 'stat-line' });
  setChildren(
    editEl,
    h('h2', {}, component.label),
    h(
      'p',
      { class: 'stat-line' },
      `${component.id} · v${component.version} · ${isEmptyComponent(component) ? 'no geometry' : component.shape}`
    ),
    statsEl,
    variantSection(),
    paramsSection(component),
    modifiersSection(component)
  );
}

function select(id) {
  currentId = id;
  renderList();
  renderEdit();
  refreshViewport();
}

// --- save / revert ----------------------------------------------------------

// Saving downloads the component as json, because a browser cannot write into
// library/ itself. Drop the file back in the folder, run tools/scan.mjs, and
// the edit becomes part of the shipped library like any other.
document.getElementById('btn-save').addEventListener('click', () => {
  const component = current();
  if (!component) return;
  const doc = { ...component, version: (component.version || 1) + 1 };
  const blob = new Blob([JSON.stringify(doc, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `${component.id}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Downloaded ${component.id}.json — drop it in library/components and rescan.`);
});

document.getElementById('btn-revert').addEventListener('click', () => {
  if (!currentId || !edits[currentId]) return;
  delete edits[currentId];
  persist();
  renderList();
  renderEdit();
  refreshViewport();
  setStatus('Reverted to the shipped version.');
});

// --- boot -------------------------------------------------------------------

library = await loadLibrary('library');
resize();
renderList();
const first = [...library.components.keys()][0];
if (first) select(first);
setStatus(`${library.components.size} components loaded.`);

window.ed = { get library() { return library; }, get edits() { return edits; }, select, refreshViewport };
