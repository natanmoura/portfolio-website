// Component editor.
//
// Three panes, and the middle one is the only one that draws. The shelf on
// the left is every component in the library; the viewport shows the one
// being edited; the panel on the right is that component's parts,
// parameters and modifiers.
//
// Editing is prefab-shaped. A part inside an assembly can be opened, edited
// in its own right, and stepped back out of, with the trail kept as a
// breadcrumb. Because a part stores an id and never a copy, editing a sphere
// two levels down changes every component that reaches a sphere, everywhere,
// immediately. That is the reason for storing ids, and it is what makes the
// library accumulate instead of fragment.
//
// Edits live in localStorage layered over the shipped files. The town reads
// the same key and listens for changes, so with both windows open the city
// retunes as parameters are locked.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadLibrary,
  applyEdits,
  readEdits,
  writeEdits,
  resolveComponent,
  isAssembly,
  isEmptyComponent,
  slotCandidates,
  slotMix,
  slotIsChoice,
  pickSlot,
  newAssembly,
  dependents,
} from './library.js';
import { ALGORITHMS, DEFAULT_ALGORITHM, algorithmOf } from './algorithms.js';
import { MODIFIERS } from './modifiers.js';
import { renderThumb } from './thumbs.js';
import { paramRow } from './paramrow.js';
import { h, setChildren } from './ui.js';

const shelfEl = document.getElementById('shelf');
const editEl = document.getElementById('edit');
const viewportEl = document.getElementById('viewport');
const statusEl = document.getElementById('status');
const crumbEl = document.getElementById('crumbs');

let shipped = { components: new Map() };
let library = { components: new Map() };
let edits = readEdits();
let seed = 1;
// The drill-in trail. Last entry is what is being edited; everything before
// it is what to come back out to.
let trail = [];
let selectedPart = -1;

const currentId = () => trail[trail.length - 1] || null;
const docOf = (id) => library.components.get(id) || null;
const current = () => docOf(currentId());

function setStatus(text) {
  statusEl.textContent = text;
}

function rebuildLibrary() {
  library = applyEdits(shipped, edits);
}

function persist() {
  writeEdits(edits);
  rebuildLibrary();
}

// Every write goes through here, so there is exactly one place that decides
// what "changed" means and one place that refreshes.
function mutate(patch, id = currentId()) {
  if (!id) return;
  const base = shipped.components.get(id);
  edits[id] = { ...(edits[id] || {}), ...(docOf(id) || {}), ...patch };
  if (base && JSON.stringify(edits[id]) === JSON.stringify(base)) delete edits[id];
  persist();
  render();
}

const isDirty = (id) => Boolean(edits[id]);

// --- viewport ---------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
viewportEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1b1e);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
camera.position.set(2.8, 2.2, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.6, 0);

scene.add(new THREE.HemisphereLight(0xdfe6f2, 0x2a2a2e, 1.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(3, 5, 2);
scene.add(keyLight);
scene.add(new THREE.GridHelper(8, 16, 0x555560, 0x333338));

const baseMat = new THREE.MeshStandardMaterial({
  color: 0xc9c4b8, roughness: 0.75, metalness: 0.02,
  side: THREE.DoubleSide, flatShading: true,
});
// Selection reads on the model itself, so clicking a part in the list and
// seeing which lump of the thing it is takes no hunting.
const pickMat = new THREE.MeshStandardMaterial({
  color: 0x6f9ff0, roughness: 0.5, metalness: 0.05,
  side: THREE.DoubleSide, flatShading: true, emissive: 0x14305e,
});

const shown = new THREE.Group();
scene.add(shown);
const boundsBox = new THREE.Box3Helper(new THREE.Box3(), 0x6f8fbf);
boundsBox.visible = false;
scene.add(boundsBox);

const raycaster = new THREE.Raycaster();
let statsEl = null;

function clearShown() {
  for (const child of [...shown.children]) {
    shown.remove(child);
    child.geometry.dispose();
  }
}

function refreshViewport() {
  const doc = current();
  clearShown();
  if (!doc) {
    boundsBox.visible = false;
    return;
  }

  const r = resolveComponent(doc, library, seed, `editor:${doc.id}`);
  if (!r) return;

  for (const piece of r.pieces) {
    if (!piece.geometry) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(piece.geometry.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(piece.geometry.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(piece.geometry.uv, 2));
    const mesh = new THREE.Mesh(geo, piece.partIndex === selectedPart ? pickMat : baseMat);
    // Shapes are built centred on their origin, so a piece sitting at offset
    // y needs lifting by half its height to put its base there.
    mesh.position.set(piece.offset[0], piece.offset[1] + piece.bounds.h / 2, piece.offset[2]);
    if (piece.rotY) mesh.rotation.y = piece.rotY;
    mesh.userData.partIndex = piece.partIndex;
    shown.add(mesh);
  }

  const { w, h: hh, d } = r.bounds;
  boundsBox.box.set(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, hh, d / 2));
  boundsBox.visible = true;
  renderStats(r);
}

// Clicking the model selects the part it belongs to, and double-clicking
// opens that part for editing — the same gesture as the list, so the model
// and the list are two views of one thing rather than two interfaces.
function pickAt(event, open) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(shown.children, false)[0];
  if (!hit) {
    selectedPart = -1;
    render();
    return;
  }
  const index = hit.object.userData.partIndex;
  if (open && index >= 0) openPart(index);
  else {
    selectedPart = index;
    render();
  }
}
renderer.domElement.addEventListener('click', (e) => pickAt(e, false));
renderer.domElement.addEventListener('dblclick', (e) => pickAt(e, true));

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

function renderStats(r) {
  if (!statsEl) return;
  const b = r.bounds;
  const tris = r.pieces.reduce((n, p) => n + (p.geometry ? p.geometry.pos.length / 9 : 0), 0);
  const parts = r.parts ? `${r.parts.length} parts · ` : '';
  statsEl.textContent = `${b.w.toFixed(2)} × ${b.h.toFixed(2)} × ${b.d.toFixed(2)} · ${parts}${tris} tris`;
}

// --- navigation -------------------------------------------------------------

function open(id, { reset = true } = {}) {
  if (!docOf(id)) return;
  trail = reset ? [id] : [...trail, id];
  selectedPart = -1;
  render();
}

// Stepping into a part. The trail keeps where it came from, so coming back
// out lands on the assembly rather than on wherever the shelf was pointing.
function openPart(index) {
  const doc = current();
  if (!isAssembly(doc)) return;
  const part = doc.parts[index];
  const id = pickSlot(part, seed, `editor:${doc.id}.part${index}`);
  if (!id || !docOf(id)) return;
  trail = [...trail, id];
  selectedPart = -1;
  render();
}

function popTo(depth) {
  trail = trail.slice(0, depth + 1);
  selectedPart = -1;
  render();
}

function renderCrumbs() {
  const kids = [];
  trail.forEach((id, i) => {
    const doc = docOf(id);
    if (i) kids.push(h('span', { class: 'crumb-sep' }, '›'));
    const b = h('button', { class: `crumb${i === trail.length - 1 ? ' on' : ''}` }, doc?.label || id);
    b.addEventListener('click', () => popTo(i));
    kids.push(b);
  });
  if (trail.length > 1) {
    const up = h('button', { class: 'crumb-up', title: 'Back out one level' }, '↰ out');
    up.addEventListener('click', () => popTo(trail.length - 2));
    kids.push(up);
  }
  setChildren(crumbEl, ...kids);
}

// --- shelf ------------------------------------------------------------------

function shelfCard(doc) {
  const img = renderThumb(doc, library, 3);
  const card = h(
    'button',
    {
      class: `card${doc.id === currentId() ? ' on' : ''}${isDirty(doc.id) ? ' dirty' : ''}`,
      draggable: 'true',
      title: `${doc.label} · ${doc.id}`,
    },
    img ? h('img', { src: img, alt: doc.label }) : h('div', { class: 'card-blank' }, '∅'),
    h('span', { class: 'card-name' }, doc.label),
    isAssembly(doc) ? h('span', { class: 'card-badge' }, String(doc.parts.length)) : null
  );
  card.addEventListener('click', () => open(doc.id));
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/component-id', doc.id);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return card;
}

function renderShelf() {
  const all = [...library.components.values()];
  const leaves = all.filter((d) => !isAssembly(d)).sort((a, b) => a.label.localeCompare(b.label));
  const built = all.filter(isAssembly).sort((a, b) => a.label.localeCompare(b.label));

  const make = h('button', { class: 'shelf-new' }, '+ New component');
  make.addEventListener('click', createComponent);

  setChildren(
    shelfEl,
    h('div', { class: 'shelf-head' }, make),
    built.length ? h('div', { class: 'shelf-group' }, 'Assemblies') : null,
    built.length ? h('div', { class: 'shelf-grid' }, ...built.map(shelfCard)) : null,
    h('div', { class: 'shelf-group' }, 'Shapes'),
    h('div', { class: 'shelf-grid' }, ...leaves.map(shelfCard))
  );
}

// Dropping a card onto the viewport or the parts list adds it as a part,
// which is the fastest path from "I want one of those in here" to having it.
function bindDrop(el) {
  el.addEventListener('dragover', (e) => {
    if (!isAssembly(current())) return;
    e.preventDefault();
    el.classList.add('drop-on');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-on'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drop-on');
    const id = e.dataTransfer.getData('text/component-id');
    const doc = current();
    if (!id || !isAssembly(doc)) return;
    e.preventDefault();
    mutate({ parts: [...doc.parts, { component: id, params: {} }] });
    setStatus(`Added ${docOf(id)?.label || id}.`);
  });
}
bindDrop(viewportEl);

// --- authoring --------------------------------------------------------------

function createComponent() {
  const label = prompt('Name the new component', 'New Component');
  if (!label) return;
  const doc = newAssembly(label.trim(), new Set(library.components.keys()));
  edits[doc.id] = doc;
  persist();
  open(doc.id);
  setStatus(`Created ${doc.label}. Drag parts in from the shelf.`);
}

function renameComponent() {
  const doc = current();
  if (!doc) return;
  const label = prompt('Rename', doc.label);
  if (!label) return;
  mutate({ label: label.trim() });
}

function deleteComponent() {
  const doc = current();
  if (!doc) return;
  const used = dependents(doc.id, library);
  const warn = used.length
    ? `${doc.label} is used by ${used.length} other component${used.length > 1 ? 's' : ''} (${used.join(', ')}). Delete anyway?`
    : `Delete ${doc.label}?`;
  if (!confirm(warn)) return;
  edits[doc.id] = { deleted: true };
  persist();
  trail = trail.filter((id) => id !== doc.id);
  if (!trail.length) {
    const first = [...library.components.keys()][0];
    if (first) trail = [first];
  }
  render();
  setStatus(`Deleted ${doc.label}.`);
}

function saveComponent() {
  const doc = current();
  if (!doc) return;
  const out = { ...doc, version: (doc.version || 1) + 1 };
  const blob = new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `${doc.id}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Downloaded ${doc.id}.json — drop it in library/components and rescan.`);
}

function revertComponent() {
  const id = currentId();
  if (!id || !edits[id]) return;
  delete edits[id];
  persist();
  render();
  setStatus('Reverted to the shipped version.');
}

// --- panel: parts -----------------------------------------------------------

function slotBlock(doc, part, i) {
  const ids = slotCandidates(part);
  const mix = slotMix(part);
  const chosen = pickSlot(part, seed, `editor:${doc.id}.part${i}`);
  const chosenDoc = docOf(chosen);
  const isChoice = slotIsChoice(part);

  const write = (next) => mutate({ parts: next });
  const replace = (patch) => write(doc.parts.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (delta) => {
    const next = doc.parts.slice();
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };

  const head = h('div', { class: 'part-head' });
  const openBtn = h('button', { class: 'part-open', title: 'Open this part' }, '⤢');
  openBtn.addEventListener('click', () => openPart(i));
  const up = h('button', { title: 'Move up' }, '↑');
  up.addEventListener('click', () => move(-1));
  const down = h('button', { title: 'Move down' }, '↓');
  down.addEventListener('click', () => move(1));
  const del = h('button', { title: 'Remove this part' }, '✕');
  del.addEventListener('click', () => write(doc.parts.filter((_, j) => j !== i)));

  const name = h(
    'button',
    { class: 'part-name' },
    chosenDoc ? chosenDoc.label : chosen || 'empty slot',
    isChoice ? h('span', { class: 'part-choice' }, `1 of ${ids.length}`) : null
  );
  name.addEventListener('click', () => {
    selectedPart = selectedPart === i ? -1 : i;
    render();
  });

  head.append(name, h('span', { class: 'grow' }), openBtn, up, down, del);

  // Candidates. A slot with more than one is where variety comes from, and
  // the weights are the same kind of dial the city's mix wheel is, so the
  // idea only has to be learnt once.
  const cands = h('div', { class: 'slot-cands' });
  for (const id of ids) {
    const c = docOf(id);
    const chip = h(
      'span',
      { class: `chip${id === chosen ? ' on' : ''}`, title: id },
      h('span', {}, c?.label || id)
    );
    if (isChoice) {
      const weight = h('input', {
        type: 'number', class: 'chip-w', min: '0', step: '5',
        value: String(mix[id] ?? 1),
      });
      weight.addEventListener('change', () => {
        replace({ component: { oneOf: ids, mix: { ...mix, [id]: Math.max(0, parseFloat(weight.value) || 0) } } });
      });
      chip.appendChild(weight);
    }
    const drop = h('button', { class: 'chip-x', title: 'Remove this option' }, '×');
    drop.addEventListener('click', () => {
      const next = ids.filter((x) => x !== id);
      if (!next.length) return;
      replace({ component: next.length === 1 ? next[0] : { oneOf: next, mix } });
    });
    chip.appendChild(drop);
    cands.appendChild(chip);
  }

  const add = h('select', { class: 'slot-add' });
  add.appendChild(h('option', { value: '' }, '+ option'));
  for (const c of [...library.components.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    if (c.id === doc.id || ids.includes(c.id)) continue;
    add.appendChild(h('option', { value: c.id }, c.label));
  }
  add.addEventListener('change', () => {
    if (!add.value) return;
    const next = [...ids, add.value];
    replace({ component: { oneOf: next, mix: { ...mix, [add.value]: mix[add.value] ?? 25 } } });
  });
  cands.appendChild(add);

  // Pins: parameters this slot fixes on whatever it picked, without editing
  // the component itself.
  const pins = part.params || {};
  const schema = { ...(chosenDoc?.params || {}), ...pins };
  const rows = Object.entries(schema).map(([key, value]) =>
    paramRow(key, value, (next) => replace({ params: { ...pins, [key]: next } }))
  );

  return h(
    'div',
    { class: `part${selectedPart === i ? ' on' : ''}` },
    head,
    cands,
    rows.length ? h('div', { class: 'part-body' }, ...rows) : null
  );
}

function partsSection(doc) {
  const add = h('select', { class: 'add-part' });
  add.appendChild(h('option', { value: '' }, 'Add part…'));
  for (const c of [...library.components.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    if (c.id === doc.id) continue;
    add.appendChild(h('option', { value: c.id }, c.label));
  }
  add.addEventListener('change', () => {
    if (!add.value) return;
    mutate({ parts: [...doc.parts, { component: add.value, params: {} }] });
  });

  const list = h('div', { class: 'part-list' }, ...doc.parts.map((p, i) => slotBlock(doc, p, i)));
  bindDrop(list);

  return h(
    'section',
    {},
    h('h3', {}, 'Parts'),
    doc.parts.length ? list : h('p', { class: 'hint' }, 'No parts yet. Drag one in from the shelf.'),
    add
  );
}

// --- panel: algorithm -------------------------------------------------------

function algorithmSection(doc) {
  const key = doc.algorithm || DEFAULT_ALGORITHM;
  const def = algorithmOf(key);

  const pick = h('select', {});
  for (const [id, a] of Object.entries(ALGORITHMS)) {
    pick.appendChild(h('option', { value: id, ...(id === key ? { selected: '' } : {}) }, a.label));
  }
  pick.addEventListener('change', () => mutate({ algorithm: pick.value, algorithmParams: {} }));

  const params = { ...def.defaults, ...(doc.algorithmParams || {}) };
  const rows = Object.entries(params).map(([name, value]) =>
    paramRow(name, value, (next) =>
      mutate({ algorithmParams: { ...(doc.algorithmParams || {}), [name]: next } })
    )
  );

  return h(
    'section',
    {},
    h('h3', {}, 'Arrangement'),
    pick,
    h('p', { class: 'hint' }, def.help),
    ...rows
  );
}

// --- panel: modifiers -------------------------------------------------------

function modifierSection(doc) {
  const stack = doc.modifiers || [];
  const write = (next) => mutate({ modifiers: next });

  const blocks = stack.map((entry, i) => {
    const def = MODIFIERS[entry.type];
    if (!def) return null;
    const replace = (patch) => write(stack.map((e, j) => (j === i ? { ...e, ...patch } : e)));
    const move = (delta) => {
      const next = stack.slice();
      const j = i + delta;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      write(next);
    };
    const on = entry.enabled !== false;
    const toggle = h('button', { title: on ? 'Disable' : 'Enable' }, on ? '◉' : '○');
    toggle.addEventListener('click', () => replace({ enabled: !on }));
    const up = h('button', { title: 'Move up' }, '↑');
    up.addEventListener('click', () => move(-1));
    const down = h('button', { title: 'Move down' }, '↓');
    down.addEventListener('click', () => move(1));
    const del = h('button', { title: 'Remove' }, '✕');
    del.addEventListener('click', () => write(stack.filter((_, j) => j !== i)));

    const params = { ...def.defaults, ...(entry.params || {}) };
    const rows = Object.entries(params).map(([name, value]) =>
      paramRow(name, value, (next) => replace({ params: { ...params, [name]: next } }))
    );

    return h(
      'div',
      { class: `part${on ? '' : ' off'}` },
      h('div', { class: 'part-head' }, toggle, h('span', { class: 'part-name' }, def.label), h('span', { class: 'grow' }), up, down, del),
      h('div', { class: 'part-body' }, ...rows)
    );
  });

  const add = h('select', {});
  add.appendChild(h('option', { value: '' }, 'Add modifier…'));
  for (const [type, def] of Object.entries(MODIFIERS)) {
    add.appendChild(h('option', { value: type }, def.label));
  }
  add.addEventListener('change', () => {
    if (!add.value) return;
    write([...stack, { type: add.value, enabled: true, params: {} }]);
  });

  return h('section', {}, h('h3', {}, 'Modifiers'), ...blocks.filter(Boolean), add);
}

// --- panel ------------------------------------------------------------------

function variantSection() {
  const slider = h('input', { type: 'range', min: '1', max: '400', step: '1', value: String(seed) });
  const label = h('span', { class: 'seed' }, `seed ${seed}`);
  const apply = (v) => {
    seed = v;
    label.textContent = `seed ${seed}`;
    render();
  };
  slider.addEventListener('input', () => apply(parseInt(slider.value, 10)));
  const roll = h('button', { class: 'btn' }, 'Random');
  roll.addEventListener('click', () => {
    const v = 1 + Math.floor(Math.random() * 400);
    slider.value = String(v);
    apply(v);
  });
  return h('section', {}, h('h3', {}, 'Variant'), h('div', { class: 'variant' }, slider, label, roll));
}

function paramsSection(doc) {
  const rows = Object.entries(doc.params || {}).map(([name, value]) =>
    paramRow(name, value, (next) => mutate({ params: { ...(doc.params || {}), [name]: next } }))
  );
  const add = h('button', { class: 'btn small' }, '+ size params');
  add.addEventListener('click', () =>
    mutate({
      params: {
        w: { mode: 'free', min: 0.4, max: 2.4 },
        h: { mode: 'free', min: 0.4, max: 2.4 },
        d: { mode: 'free', min: 0.4, max: 2.4 },
        ...(doc.params || {}),
      },
    })
  );
  return h(
    'section',
    {},
    h('h3', {}, 'Parameters'),
    rows.length ? h('div', {}, ...rows) : h('p', { class: 'hint' }, 'Size follows the parts.'),
    rows.length ? null : add
  );
}

function renderPanel() {
  const doc = current();
  if (!doc) {
    setChildren(editEl, h('p', { class: 'hint' }, 'Pick a component from the shelf.'));
    return;
  }
  statsEl = h('p', { class: 'stat-line' });
  const what = isAssembly(doc)
    ? `${doc.parts.length} parts · ${algorithmOf(doc.algorithm).label}`
    : isEmptyComponent(doc)
      ? 'no geometry'
      : doc.shape;

  const rename = h('button', { class: 'btn small' }, 'Rename');
  rename.addEventListener('click', renameComponent);
  const remove = h('button', { class: 'btn small danger' }, 'Delete');
  remove.addEventListener('click', deleteComponent);

  const used = dependents(doc.id, library);

  setChildren(
    editEl,
    h('div', { class: 'panel-head' }, h('h2', {}, doc.label), rename, remove),
    h('p', { class: 'stat-line' }, `${doc.id} · v${doc.version || 1} · ${what}`),
    statsEl,
    used.length ? h('p', { class: 'hint' }, `Used by ${used.length}: ${used.join(', ')}`) : null,
    variantSection(),
    isAssembly(doc) ? algorithmSection(doc) : null,
    isAssembly(doc) ? partsSection(doc) : null,
    paramsSection(doc),
    isAssembly(doc) ? null : modifierSection(doc)
  );
}

function render() {
  renderCrumbs();
  renderShelf();
  renderPanel();
  refreshViewport();
}

// --- boot -------------------------------------------------------------------

document.getElementById('btn-save').addEventListener('click', saveComponent);
document.getElementById('btn-revert').addEventListener('click', revertComponent);

// Another window editing the same library, most likely the town saving a
// scene. Reload rather than assume ours is current.
window.addEventListener('storage', (e) => {
  if (e.key !== 'awesome-town:component-edits') return;
  edits = readEdits();
  rebuildLibrary();
  render();
});

shipped = await loadLibrary('library');
rebuildLibrary();
resize();
const first = [...library.components.values()].find(isAssembly) || [...library.components.values()][0];
if (first) trail = [first.id];
render();
setStatus(`${library.components.size} components.`);

window.ed = {
  get library() { return library; },
  get edits() { return edits; },
  get trail() { return trail; },
  open, openPart, popTo, render,
  get seed() { return seed; },
  set seed(v) { seed = v; render(); },
};
