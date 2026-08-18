// The shared component library: load, resolve, save. One library, not one
// per system, so a component authored for the city is usable by whatever
// system comes after it without being copied.
//
// A component on disk is just a shape name, a parameter schema (the lock
// model from modifiers.js), a modifier stack, and tags. Nothing about
// anchors or resolved bounds is stored, because those depend on the
// resolved size, which is only known once a seed picks concrete numbers.
// resolveComponent() is what turns "a component" into "this component,
// placed here, with this seed" the same way generate.js turns a ticket into
// a module.

import { buildShape } from './geometry.js';
import { resolveParams, applyModifiers } from './modifiers.js';
import { stack, stackBounds } from './stacking.js';

export const EMPTY_SHAPE = 'empty';

export function isEmptyComponent(component) {
  return !component || component.shape === EMPTY_SHAPE;
}

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

// Components and templates are separate folders but one library conceptually
// — a template's parts reference component ids, and both get handed to
// callers as flat id -> doc maps.
export async function loadLibrary(root = 'library') {
  const [components, templates] = await Promise.all([
    loadFolder(`${root}/components`),
    loadFolder(`${root}/templates`),
  ]);
  return { components, templates };
}

// Where the editor keeps work that has not been committed back to disk yet.
// The town reads the same key, which is what makes locking a parameter in
// the editor change the city without a build step in between.
export const EDITS_KEY = 'awesome-town:component-edits';

export function readEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
  } catch {
    return {};
  }
}

// Layered rather than merged into the files, so the shipped library stays
// recoverable and reverting an edit is a delete rather than an undo.
export function applyEdits(lib, edits) {
  const patch = (map) => {
    const out = new Map(map);
    for (const [id, over] of Object.entries(edits || {})) {
      if (out.has(id)) out.set(id, { ...out.get(id), ...over });
    }
    return out;
  };
  return { components: patch(lib.components), templates: patch(lib.templates) };
}

export async function loadEditedLibrary(root = 'library') {
  return applyEdits(await loadLibrary(root), readEdits());
}

// Bounds and anchors follow directly from resolved w/h/d — a box's top is
// always at y=h regardless of what shape it is, which is exactly what lets
// a system stack onto a component without knowing what is inside it.
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

// resolve(component, seed) -> concrete instance, per COMPONENTS.md. Every
// free or ranged parameter draws from a hash of (seed, path, name), so the
// same component placed a thousand times gives a thousand variants, the
// same slot always gives the same one, and a component added tomorrow does
// not reshuffle anything already placed.
export function resolveComponent(component, seed, path) {
  const p = path || `component:${component.id}`;
  const dims = resolveParams(component.params || {}, seed, `${p}.dims`);
  const w = dims.w ?? 1;
  const h = dims.h ?? 1;
  const d = dims.d ?? 1;
  const bounds = { w, h, d };
  const anchors = anchorsFor(w, h, d);
  const tags = component.tags || [];

  if (isEmptyComponent(component)) {
    return { id: component.id, bounds, anchors, tags, geometry: null };
  }

  const base = buildShape(component.shape, w, h, d, component.faces ?? 1, component.shapeOpts || {});
  const geometry = applyModifiers(base, component.modifiers, seed, `${p}.mod`);
  return { id: component.id, bounds, anchors, tags, geometry };
}

// Components eligible for a role are those carrying every tag the role
// asks for — include-list semantics live one level up, in whatever mix the
// scene records, this just answers "could this ever qualify."
export function componentsForTags(components, tags) {
  const wanted = tags || [];
  return [...components.values()].filter((c) => wanted.every((t) => (c.tags || []).includes(t)));
}

// --- templates --------------------------------------------------------------

// A template is parts plus a construction rule, and resolving one gives back
// the same shape of object a component does: bounds, anchors, tags. That
// sameness is the point — a system stacking a template onto a building asks
// it the same questions it asks a plain box, and never learns which it got.
export function resolveTemplate(template, lib, seed, path) {
  const p = path || `template:${template.id}`;
  const parts = [];

  (template.parts || []).forEach((entry, i) => {
    const base = lib.components.get(entry.component);
    if (!base) {
      console.warn(`template ${template.id}: no component "${entry.component}"`);
      return;
    }
    // A part may pin some of the component's parameters without editing the
    // component itself, which is how one box serves as a wide plinth here
    // and a narrow post there.
    const merged = entry.params ? { ...base, params: { ...base.params, ...entry.params } } : base;
    // Each part resolves down its own path, so a template using the same
    // component twice gets two different draws rather than a mirrored pair.
    parts.push(resolveComponent(merged, seed, `${p}.part${i}:${entry.component}`));
  });

  const opts = {
    axis: template.axis || 'y',
    overlap: template.overlap || 0,
    gap: template.gap || 0,
  };
  const laid = stack(parts, opts);
  const bounds = stackBounds(laid.parts, opts.axis);

  return {
    id: template.id,
    isTemplate: true,
    bounds,
    anchors: anchorsFor(bounds.w, bounds.h, bounds.d),
    tags: template.tags || [],
    parts: laid.parts,
    axis: opts.axis,
  };
}

// One call for "resolve whatever this id is", so callers that genuinely do
// not care — the mix wheel, a role pick — can stay ignorant of the split.
export function resolveEntry(id, lib, seed, path) {
  const template = lib.templates.get(id);
  if (template) return resolveTemplate(template, lib, seed, path);
  const component = lib.components.get(id);
  if (component) return resolveComponent(component, seed, path);
  return null;
}
