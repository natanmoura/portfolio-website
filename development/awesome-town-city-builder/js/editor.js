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
import { confirmDialog, promptDialog } from './dialog.js';
import { History } from './history.js';
import { initPanelResize } from './resizer.js';
import { writeStats } from './stats.js';

const shelfEl = document.getElementById('shelf');
const editEl = document.getElementById('edit-body');
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
// Undo over the edit layer. Only `edits` is snapshotted: which component is
// open and which part is selected are view state, and stepping back a change
// should not also move you somewhere else.
let history = null;
// Shelf filter. View state, so it is not saved and not undoable.
let shelfQuery = '';

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
//
// `live` is a drag in progress. The model and the viewport keep up, but the
// panel is left alone: rebuilding it would replace the very slider being
// dragged, which is what makes a control feel like it is sticking. The
// release fires again without the flag and the panel catches up then.
function mutate(patch, opts = {}, id = currentId()) {
  if (!id) return;
  const base = shipped.components.get(id);
  edits[id] = { ...(edits[id] || {}), ...(docOf(id) || {}), ...patch };
  if (base && JSON.stringify(edits[id]) === JSON.stringify(base)) delete edits[id];
  persist();
  if (opts.live) {
    refreshViewport();
    return;
  }
  // Recorded on commit only. A drag reports continuously and then once on
  // release, so history gets one entry per completed gesture rather than one
  // per pixel of travel.
  history?.record(opts.key ?? `${id}:${Object.keys(patch).join(',')}`);
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
const statsEl = document.getElementById('stats');

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
    const sc = piece.scale ?? 1;
    mesh.scale.setScalar(sc);
    mesh.position.set(piece.offset[0], piece.offset[1], piece.offset[2]);
    if (piece.rotY) mesh.rotation.y = piece.rotY;
    mesh.userData.partIndex = piece.partIndex;
    shown.add(mesh);
  }

  // The measured box, not a guess centred on the origin. For anything that
  // sits off-centre — a mirrored run, a spiral, a scatter — those are not the
  // same rectangle, and the helper is only useful if it is the real one.
  const box = r.box || { min: [-r.bounds.w / 2, 0, -r.bounds.d / 2], max: [r.bounds.w / 2, r.bounds.h, r.bounds.d / 2] };
  boundsBox.box.set(
    new THREE.Vector3(box.min[0], box.min[1], box.min[2]),
    new THREE.Vector3(box.max[0], box.max[1], box.max[2])
  );
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
  // updateStyle left on. With it off the canvas gets no CSS size and falls
  // back to its drawing buffer, which on a 2x display is twice the viewport,
  // so the view was being cropped to a quarter of itself by the container's
  // overflow. Invisible until the panels became draggable and the numbers
  // stopped matching.
  renderer.setSize(w, hgt);
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
  const rows = [['Size', `${b.w.toFixed(2)} × ${b.h.toFixed(2)} × ${b.d.toFixed(2)}`]];
  if (r.parts) rows.push(['Parts', r.parts.length]);
  rows.push(['Tris', tris.toLocaleString()]);
  writeStats(statsEl, rows);
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

  // Stepping out is the move you make most while editing nested assemblies,
  // so it gets a real target that names where it goes rather than an icon
  // you have to remember the meaning of.
  if (trail.length > 1) {
    const parent = docOf(trail[trail.length - 2]);
    const back = h(
      'button',
      { class: 'crumb-back', title: `Back to ${parent?.label || 'the assembly'}` },
      h('span', { class: 'crumb-arrow' }, '←'),
      h('span', {}, parent?.label || 'back')
    );
    back.addEventListener('click', () => popTo(trail.length - 2));
    kids.push(back);
  }

  trail.forEach((id, i) => {
    const doc = docOf(id);
    if (i) kids.push(h('span', { class: 'crumb-sep' }, '›'));
    const b = h('button', { class: `crumb${i === trail.length - 1 ? ' on' : ''}` }, doc?.label || id);
    b.addEventListener('click', () => popTo(i));
    kids.push(b);
  });

  // Rename and delete act on the component this bar names, so they belong to
  // the bar. Repeating the name below just to have somewhere to hang them
  // meant reading it twice to learn it once.
  if (current()) {
    const rename = h('button', { class: 'btn small' }, 'Rename');
    rename.addEventListener('click', () => renameComponent());
    const remove = h('button', { class: 'btn small danger' }, 'Delete');
    remove.addEventListener('click', () => deleteComponent());
    kids.push(h('span', { class: 'grow' }), rename, remove);
  }

  setChildren(crumbEl, ...kids);
}

// --- shelf ------------------------------------------------------------------

function shelfCard(doc) {
  const img = renderThumb(doc, library, 3);

  // Delete lives on the card, since that is where you are when you decide a
  // component was a mistake. Hidden until hover so a shelf of forty does not
  // read as forty ways to lose something.
  const kill = h('span', { class: 'card-x', title: `Delete ${doc.label}` }, '×');
  kill.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteComponent(doc.id);
  });

  const card = h(
    'div',
    {
      class: `card${doc.id === currentId() ? ' on' : ''}${isDirty(doc.id) ? ' dirty' : ''}`,
      draggable: 'true',
      title: `${doc.label} · ${doc.id}`,
    },
    img ? h('img', { src: img, alt: doc.label }) : h('div', { class: 'card-blank' }, '∅'),
    h('span', { class: 'card-name' }, doc.label),
    isAssembly(doc) ? h('span', { class: 'card-badge' }, String(doc.parts.length)) : null,
    kill
  );
  card.addEventListener('click', () => open(doc.id));
  card.addEventListener('dblclick', () => renameComponent(doc.id));
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/component-id', doc.id);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return card;
}

function deletedSection() {
  const gone = deletedIds();
  if (!gone.length) return null;
  const rows = gone.map((id) => {
    const doc = shipped.components.get(id);
    const b = h('button', { class: 'restore' }, h('span', {}, doc?.label || id), h('span', { class: 'restore-go' }, 'restore'));
    b.addEventListener('click', () => restoreComponent(id));
    return b;
  });
  return h('div', {}, h('div', { class: 'shelf-group' }, `Deleted (${gone.length})`), ...rows);
}

// Name, id and tags all match, because by the time a library is large enough
// to need searching you remember a component by whichever of those stuck.
function matchesQuery(doc, q) {
  if (!q) return true;
  const hay = `${doc.label} ${doc.id} ${(doc.tags || []).join(' ')}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function renderShelf() {
  const all = [...library.components.values()].filter((d) => matchesQuery(d, shelfQuery));
  const leaves = all.filter((d) => !isAssembly(d)).sort((a, b) => a.label.localeCompare(b.label));
  const built = all.filter(isAssembly).sort((a, b) => a.label.localeCompare(b.label));

  const make = h('button', { class: 'shelf-new' }, '+ New component');
  make.addEventListener('click', createComponent);

  const find = h('input', {
    type: 'search',
    class: 'shelf-find',
    placeholder: 'Find…',
    value: shelfQuery,
  });
  // Filtering as you type, with focus and caret restored across the redraw so
  // the field is not interrupted by its own results.
  find.addEventListener('input', () => {
    shelfQuery = find.value.trim().toLowerCase();
    renderShelf();
    const again = shelfEl.querySelector('.shelf-find');
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  });

  setChildren(
    shelfEl,
    h('div', { class: 'shelf-head' }, make, find),
    shelfQuery ? h('div', { class: 'shelf-group' }, `${all.length} of ${library.components.size}`) : null,
    built.length ? h('div', { class: 'shelf-group' }, 'Assemblies') : null,
    built.length ? h('div', { class: 'shelf-grid' }, ...built.map(shelfCard)) : null,
    leaves.length ? h('div', { class: 'shelf-group' }, 'Shapes') : null,
    leaves.length ? h('div', { class: 'shelf-grid' }, ...leaves.map(shelfCard)) : null,
    all.length ? null : h('p', { class: 'hint' }, 'Nothing matches.'),
    shelfQuery ? null : deletedSection()
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

async function createComponent() {
  const label = await promptDialog({
    title: 'New component',
    message: 'An empty assembly. Drag parts onto it from the shelf.',
    value: 'New Component',
    confirmLabel: 'Create',
  });
  if (!label) return;
  const doc = newAssembly(label, new Set(library.components.keys()));
  edits[doc.id] = doc;
  persist();
  history?.record(null);
  open(doc.id);
  setStatus(`Created ${doc.label}. Drag parts in from the shelf.`);
}

async function renameComponent(id = currentId()) {
  const doc = docOf(id);
  if (!doc) return;
  const label = await promptDialog({ title: 'Rename', value: doc.label, confirmLabel: 'Rename' });
  if (!label) return;
  mutate({ label }, {}, id);
}

// Deleting is reversible, because a library is a thing you accumulate and
// losing an hour's work to a stray click is not a reasonable price. A
// shipped component is only marked deleted and can be restored; one invented
// here is dropped outright, which the dialog says plainly.
async function deleteComponent(id = currentId()) {
  const doc = docOf(id);
  if (!doc) return;

  const used = dependents(doc.id, library);
  const isShipped = shipped.components.has(doc.id);

  const ok = await confirmDialog({
    title: `Delete ${doc.label}?`,
    message: used.length
      ? `It is used by ${used.length} other component${used.length > 1 ? 's' : ''}, which will lose that part.`
      : 'Nothing else uses it.',
    detail: isShipped
      ? 'It ships with the tool, so this only hides it here and can be undone from Deleted on the shelf.'
      : 'It was made here and is not on disk, so this cannot be undone.',
    confirmLabel: 'Delete',
  });
  if (!ok) return;

  if (isShipped) edits[doc.id] = { deleted: true };
  else delete edits[doc.id];
  persist();
  history?.record(null);

  trail = trail.filter((t) => t !== doc.id);
  if (!trail.length) {
    const first = [...library.components.keys()][0];
    if (first) trail = [first];
  }
  render();
  setStatus(
    `Deleted ${doc.label}.${used.length ? ` ${used.length} component${used.length > 1 ? 's' : ''} affected.` : ''}`
  );
}

function restoreComponent(id) {
  if (!edits[id]?.deleted) return;
  delete edits[id];
  persist();
  history?.record(null);
  render();
  setStatus(`Restored ${docOf(id)?.label || id}.`);
}

// Ids the shipped library has that the edits have hidden, so a delete is
// visibly undoable rather than a thing you have to remember you did.
function deletedIds() {
  return Object.keys(edits).filter((id) => edits[id]?.deleted && shipped.components.has(id));
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
  history?.record(null);
  render();
  setStatus('Reverted to the shipped version.');
}

// --- sections ---------------------------------------------------------------

// Collapsible, in the same clothes the town's control panel uses, because two
// idioms for "a group of settings" is one too many. Which are folded is
// remembered by name rather than by position, so it survives moving between a
// leaf and an assembly, whose panels hold different sections.
const SECTIONS_KEY = 'awesome-town:editor-sections';

let closedSections = (() => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SECTIONS_KEY) || '[]'));
  } catch {
    return new Set();
  }
})();

function section(title, ...kids) {
  const closed = closedSections.has(title);
  const body = h('div', { class: `sec-body${closed ? ' closed' : ''}` }, ...kids.filter(Boolean));
  const head = h(
    'button',
    { class: `sec-head${closed ? ' closed' : ''}`, type: 'button' },
    h('span', { class: 'sec-name' }, title),
    h('span', { class: 'sec-mark' })
  );
  head.addEventListener('click', () => {
    const nowClosed = !body.classList.contains('closed');
    body.classList.toggle('closed', nowClosed);
    head.classList.toggle('closed', nowClosed);
    if (nowClosed) closedSections.add(title);
    else closedSections.delete(title);
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify([...closedSections]));
    } catch {
      // Losing which panels were folded is not worth failing an edit over.
    }
  });
  return h('section', { class: 'sec' }, head, body);
}

// --- panel: parts -----------------------------------------------------------

function slotBlock(doc, part, i) {
  const ids = slotCandidates(part);
  const mix = slotMix(part);
  const chosen = pickSlot(part, seed, `editor:${doc.id}.part${i}`);
  const chosenDoc = docOf(chosen);
  const isChoice = slotIsChoice(part);

  const write = (next, o) => mutate({ parts: next }, o);
  const replace = (patch, o) => write(doc.parts.map((e, j) => (j === i ? { ...e, ...patch } : e)), o);
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
    paramRow(key, value, (next, o) => replace({ params: { ...pins, [key]: next } }, { ...o, key: `${doc.id}:pin${i}:${key}` }))
  );

  const box = h(
    'div',
    { class: `part${selectedPart === i ? ' on' : ''}` },
    head,
    cands,
    rows.length ? h('div', { class: 'part-body' }, ...rows) : null
  );

  // The whole box selects, not just the name. It is drawn as one object and
  // reads as one object, so clicking anywhere in it that is not already a
  // control should pick it. Anything interactive keeps its own job: dragging
  // a slider inside a part is not a request to select the part.
  box.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, select, .chip')) return;
    if (selectedPart === i) return;
    selectedPart = i;
    render();
  });

  return box;
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

  return section(
    'Parts',
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
    paramRow(name, value, (next, o) =>
      mutate({ algorithmParams: { ...(doc.algorithmParams || {}), [name]: next } }, { ...o, key: `${doc.id}:algo:${name}` })
    )
  );

  return section(
    'Arrangement',
    pick,
    h('p', { class: 'hint' }, def.help),
    ...rows
  );
}

// --- panel: modifiers -------------------------------------------------------

function modifierSection(doc) {
  const stack = doc.modifiers || [];
  const write = (next, o) => mutate({ modifiers: next }, o);

  const blocks = stack.map((entry, i) => {
    const def = MODIFIERS[entry.type];
    if (!def) return null;
    const replace = (patch, o) => write(stack.map((e, j) => (j === i ? { ...e, ...patch } : e)), o);
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
      paramRow(name, value, (next, o) => replace({ params: { ...params, [name]: next } }, { ...o, key: `${doc.id}:mod${i}:${name}` }))
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

  return section('Modifiers', ...blocks.filter(Boolean), add);
}

// --- panel ------------------------------------------------------------------

// Scrubbing the seed is the fastest way to see whether a component survives
// variation rather than only looking right at the value it was tuned at, so
// it has to run at the speed of the drag. Same rule as every other slider
// here: while the knob moves only the model and its label change, and the
// panel — which contains this very slider — is left alone until release.
function variantSection() {
  const slider = h('input', { type: 'range', min: '1', max: '400', step: '1', value: String(seed) });
  const label = h('span', { class: 'seed' }, `seed ${seed}`);

  const scrub = (v) => {
    seed = v;
    label.textContent = `seed ${seed}`;
    refreshViewport();
  };

  slider.addEventListener('input', () => scrub(parseInt(slider.value, 10)));
  // On release the shelf catches up too, since a new seed can change which
  // candidate a slot picked and every preview along with it.
  slider.addEventListener('change', () => render());

  const roll = h('button', { class: 'btn' }, 'Random');
  roll.addEventListener('click', () => {
    const v = 1 + Math.floor(Math.random() * 400);
    slider.value = String(v);
    scrub(v);
    render();
  });

  return section('Variant', h('div', { class: 'variant' }, slider, label, roll));
}

function paramsSection(doc) {
  const rows = Object.entries(doc.params || {}).map(([name, value]) =>
    paramRow(name, value, (next, o) => mutate({ params: { ...(doc.params || {}), [name]: next } }, { ...o, key: `${doc.id}:param:${name}` }))
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
  return section(
    'Parameters',
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
  const what = isAssembly(doc)
    ? `${doc.parts.length} parts · ${algorithmOf(doc.algorithm).label}`
    : isEmptyComponent(doc)
      ? 'no geometry'
      : doc.shape;

  const used = dependents(doc.id, library);

  // The name and its two actions live in the bar above, and the measurements
  // live on the thing being measured. What is left here is only the panel's
  // sections, plus the one fact that has consequences: what else breaks if
  // you change this.
  setChildren(
    editEl,
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
document.getElementById('btn-revert').addEventListener('click', () => revertComponent());

// Undo lives on the keyboard now rather than as a pair of buttons in the
// title bar. The status line reports depth when it changes, which is the
// only time it is worth knowing.
function updateHistoryButtons() {}

// Checked before the focus guard, so undo still works with a field focused —
// the alternative is typing in a number box and finding Ctrl+Z does nothing.
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    history?.undo();
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault();
    history?.redo();
  }
});

// Another window editing the same library, most likely the town saving a
// scene. Reload rather than assume ours is current.
window.addEventListener('storage', (e) => {
  if (e.key !== 'awesome-town:component-edits') return;
  edits = readEdits();
  rebuildLibrary();
  render();
});

initPanelResize({
  main: document.querySelector("main"),
  left: { key: "shelf", side: "left", var: "--pw-l", min: 170, max: 520, def: 236 },
  right: { key: "edit", side: "right", var: "--pw-r", min: 260, max: 620, def: 340 },
  storeKey: "awesome-town:editor-panels",
});

shipped = await loadLibrary('library');
rebuildLibrary();

history = new History(
  () => ({ edits }),
  (snap) => {
    edits = snap.edits || {};
    persist();
    // The open component may have been deleted by the step being undone, so
    // the trail is pruned to what still exists rather than left dangling.
    trail = trail.filter((id) => library.components.has(id));
    if (!trail.length) {
      const first = [...library.components.keys()][0];
      if (first) trail = [first];
    }
    selectedPart = -1;
    render();
  }
);
history.reset();
history.onChange(updateHistoryButtons);
updateHistoryButtons();

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
  scene, shown, baseMat, pickMat,
  get selectedPart() { return selectedPart; },
  get seed() { return seed; },
  set seed(v) { seed = v; render(); },
};
