// The shared component library: load, resolve, author, save.
//
// There is one kind of thing here, not two. A component either has a shape,
// making it a leaf, or has parts, making it an assembly — and since a part
// names another component by id, assemblies nest without any of this knowing
// how deep it goes. A template was never a different object, only a
// component that happened to be made of others.
//
// Nothing is ever copied at author time. A part holds an id, and the id is
// looked up during resolve, so improving the sphere improves every assembly
// that reaches one, however indirectly. That is the whole reason ids are
// stored rather than contents.
//
// Two things fill a slot with something other than a fixed choice:
//
//   - a slot may list several candidates and a mix, and the seed picks one
//   - a slot may pin parameters on whatever it picked, without editing it
//
// Which is the same include-list-and-mix the city uses to fill its roles.
// A part slot is a role, one layer down.

import { buildShape } from './geometry.js';
import { applyModifiers } from './modifiers.js';
import { resolveParams, resolveParamsWith, unit } from './constraints.js';
import { algorithmOf, DEFAULT_ALGORITHM, instanceCountFor } from './algorithms.js';

export const EMPTY_SHAPE = 'empty';
export const MAX_DEPTH = 8;

export const isAssembly = (doc) => Boolean(doc && Array.isArray(doc.parts));
export const isLeaf = (doc) => Boolean(doc && !isAssembly(doc));
export const isEmptyComponent = (doc) => !doc || doc.shape === EMPTY_SHAPE;

// --- loading ----------------------------------------------------------------

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function loadFolder(dir) {
  const manifest = await fetchJson(`${dir}/manifest.json`);
  const files = manifest?.files || [];
  const docs = await Promise.all(files.map((name) => fetchJson(`${dir}/${name}`)));
  const out = new Map();
  docs.forEach((doc, i) => {
    if (doc && doc.id) out.set(doc.id, doc);
    else if (doc) console.warn(`library: ${dir}/${files[i]} has no id, skipped`);
  });
  return out;
}

export async function loadLibrary(root = 'library') {
  return { components: await loadFolder(`${root}/components`) };
}

// Where the editor keeps work not yet committed back to disk. The town reads
// the same key, which is what makes locking a parameter in the editor change
// the city with no build step in between.
export const EDITS_KEY = 'awesome-town:component-edits';

export function readEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeEdits(edits) {
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
}

// Layered over the shipped files rather than merged into them, so the
// library on disk stays recoverable and reverting is a delete. An edit whose
// id is not on disk is a component the author invented here, and is kept.
export function applyEdits(lib, edits) {
  const out = new Map(lib.components);
  for (const [id, over] of Object.entries(edits || {})) {
    if (over?.deleted) {
      out.delete(id);
      continue;
    }
    out.set(id, out.has(id) ? { ...out.get(id), ...over } : over);
  }
  return { components: out };
}

export async function loadEditedLibrary(root = 'library') {
  return applyEdits(await loadLibrary(root), readEdits());
}

// --- slots ------------------------------------------------------------------

// What a slot may contain, normalised. A bare string is the common case and
// stays writable by hand in the json.
export function slotCandidates(part) {
  const c = part?.component;
  if (!c) return [];
  if (typeof c === 'string') return [c];
  return Array.isArray(c.oneOf) ? c.oneOf : [];
}

export function slotMix(part) {
  const c = part?.component;
  return typeof c === 'object' && c && c.mix ? c.mix : {};
}

export const slotIsChoice = (part) => slotCandidates(part).length > 1;

// Which candidate this seed lands on. Weighted the same way the city picks a
// module kind, and drawn from the slot's own path so adding a candidate
// tomorrow does not reshuffle unrelated slots.
export function pickSlot(part, seed, path) {
  const ids = slotCandidates(part);
  if (ids.length <= 1) return ids[0] || null;
  const mix = slotMix(part);
  let total = 0;
  for (const id of ids) total += Math.max(0, mix[id] ?? 1);
  if (total <= 0) return ids[0];
  let acc = unit(`${seed}|${path}|slot`) * total;
  for (const id of ids) {
    acc -= Math.max(0, mix[id] ?? 1);
    if (acc <= 0) return id;
  }
  return ids[ids.length - 1];
}

// --- resolve ----------------------------------------------------------------

// Bounds and anchors follow from resolved size, which is what lets a system
// stack onto a component without knowing anything inside it.
function anchorsFor(w, h, d) {
  return {
    base: { pos: [0, 0, 0], normal: [0, -1, 0] },
    top: { pos: [0, h, 0], normal: [0, 1, 0] },
    sides: [
      { pos: [w / 2, h / 2, 0], normal: [1, 0, 0] },
      { pos: [-w / 2, h / 2, 0], normal: [-1, 0, 0] },
      { pos: [0, h / 2, d / 2], normal: [0, 0, 1] },
      { pos: [0, h / 2, -d / 2], normal: [0, 0, -1] },
    ],
  };
}

// resolve(component, seed) -> concrete instance.
//
// `proposals` is how an outer system drives size: the city offers w/h/d and
// the component's own locks decide what survives, per constraints.js. The
// editor passes none, so everything unlocked draws for itself.
//
// Returns `pieces` in every case — a flat list of geometry with offsets
// relative to this component's origin — so a caller that only wants to draw
// something never has to care whether it got a leaf or six levels of nesting.
export function resolveComponent(doc, lib, seed, path, proposals, depth = 0, seen = new Set()) {
  if (!doc) return null;
  const p = path || `component:${doc.id}`;

  if (depth > MAX_DEPTH || seen.has(doc.id)) {
    // A component that reaches itself would recurse forever. Stopping with
    // empty bounds keeps the rest of the town rendering rather than taking
    // the page down over one bad edit.
    console.warn(`library: ${doc.id} nests too deeply or references itself`);
    return { id: doc.id, bounds: { w: 0, h: 0, d: 0 }, anchors: anchorsFor(0, 0, 0), tags: [], pieces: [] };
  }

  const dims = resolveParamsWith(doc.params || {}, proposals, seed, `${p}.dims`);
  const tags = doc.tags || [];

  if (isAssembly(doc)) return resolveAssembly(doc, lib, seed, p, dims, tags, depth, seen);

  const w = dims.w ?? 1;
  const h = dims.h ?? 1;
  const d = dims.d ?? 1;
  const bounds = { w, h, d };

  if (isEmptyComponent(doc)) {
    return { id: doc.id, doc, bounds, anchors: anchorsFor(w, h, d), tags, params: dims, pieces: [] };
  }

  const base = buildShape(doc.shape, w, h, d, doc.faces ?? 1, doc.shapeOpts || {});
  const geometry = applyModifiers(base, doc.modifiers, seed, `${p}.mod`);
  return {
    id: doc.id,
    doc,
    bounds,
    anchors: anchorsFor(w, h, d),
    tags,
    params: dims,
    geometry,
    pieces: [{ id: doc.id, geometry, bounds, offset: [0, 0, 0], rotY: 0, scale: 1, path: p, partIndex: -1 }],
  };
}

function resolveAssembly(doc, lib, seed, p, dims, tags, depth, seen) {
  const nextSeen = new Set(seen).add(doc.id);
  const list = doc.parts || [];

  const algo = algorithmOf(doc.algorithm || DEFAULT_ALGORITHM);
  const opts = resolveParams({ ...algo.defaults, ...(doc.algorithmParams || {}) }, seed, `${p}.algo`);
  // How many the arrangement wants, which for most is more than are listed:
  // the list is cycled to fill the count. Resolved before the parts, because
  // the count decides how many there are to resolve.
  const total = list.length ? instanceCountFor(doc, list, opts) : 0;

  const resolvedParts = [];
  for (let i = 0; i < total; i++) {
    const partIndex = i % list.length;
    const part = list[partIndex];
    // Each instance draws down its own path, so a slot with several
    // candidates gives a row of different pillars rather than one pillar
    // repeated — the variation costs nothing extra.
    const partPath = `${p}.i${i}`;
    const chosenId = pickSlot(part, seed, partPath);
    const child = chosenId ? lib.components.get(chosenId) : null;
    if (!child) {
      if (chosenId) console.warn(`${doc.id}: no component "${chosenId}"`);
      continue;
    }
    // A slot pins parameters on whatever it picked without touching the
    // component itself, which is how one box is a wide plinth here and a
    // narrow post there. Pins are proposals, so the child's own locks still
    // get the last word — constraints only ever tighten going inward.
    const proposals = part.params
      ? resolveParams(part.params, seed, `${partPath}.pin`)
      : undefined;
    const r = resolveComponent(child, lib, seed, `${partPath}:${chosenId}`, proposals, depth + 1, nextSeen);
    if (r) resolvedParts.push({ ...r, partIndex, instanceIndex: i, slotId: chosenId, path: partPath });
  }

  const { placed, bounds } = algo.place(resolvedParts, opts);

  // Flatten one level: a child's own pieces are already relative to the
  // child, so they only need this placement added. Recursion means depth is
  // already handled by the time it gets here.
  const pieces = [];
  for (const part of placed) {
    const s = part.scale ?? 1;
    const spin = part.rotY || 0;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    for (const piece of part.pieces) {
      // A child's pieces are positioned in the child's own frame, so turning
      // the child has to turn where its pieces sit, not only which way they
      // face. Without this an assembly placed round a ring would face
      // outward while its innards stayed put.
      const px = piece.offset[0] * s;
      const pz = piece.offset[2] * s;
      pieces.push({
        ...piece,
        offset: [
          part.offset[0] + px * cos - pz * sin,
          part.offset[1] + piece.offset[1] * s,
          part.offset[2] + px * sin + pz * cos,
        ],
        rotY: (piece.rotY || 0) + spin,
        scale: (piece.scale ?? 1) * s,
        partIndex: part.partIndex,
        instanceIndex: part.instanceIndex,
      });
    }
  }

  // A component's own size params override what the parts added up to, so an
  // assembly can still be told how big it is from outside.
  const box = {
    w: Number.isFinite(dims.w) ? dims.w : bounds.w,
    h: Number.isFinite(dims.h) ? dims.h : bounds.h,
    d: Number.isFinite(dims.d) ? dims.d : bounds.d,
  };

  return {
    id: doc.id,
    doc,
    bounds: box,
    anchors: anchorsFor(box.w, box.h, box.d),
    tags,
    params: dims,
    parts: placed,
    pieces,
    algorithm: doc.algorithm || DEFAULT_ALGORITHM,
  };
}

export function resolveEntry(id, lib, seed, path, proposals) {
  const doc = lib.components.get(id);
  return doc ? resolveComponent(doc, lib, seed, path, proposals) : null;
}

// --- authoring --------------------------------------------------------------

export function makeId(label, taken) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'component';
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

export function newAssembly(label, taken) {
  return {
    id: makeId(label, taken),
    version: 1,
    label,
    tags: [],
    algorithm: DEFAULT_ALGORITHM,
    algorithmParams: {},
    params: {},
    parts: [],
  };
}

// Which components a given one reaches, so the editor can warn before a
// delete and so a change can be traced to everything it affects.
export function dependents(id, lib) {
  const out = [];
  for (const doc of lib.components.values()) {
    if (!isAssembly(doc)) continue;
    if (doc.parts.some((part) => slotCandidates(part).includes(id))) out.push(doc.id);
  }
  return out;
}

export function componentsForTags(components, tags) {
  const wanted = tags || [];
  return [...components.values()].filter((c) => wanted.every((t) => (c.tags || []).includes(t)));
}
