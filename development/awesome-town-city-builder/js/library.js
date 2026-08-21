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
import { note } from './provenance.js';

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

// Fired whenever the edit layer is written.
//
// `storage` only fires in *other* documents on the origin, which was fine
// while the editor and the town were two tabs and stopped being fine the
// moment they became two views of one document. Both are listened for now:
// this event for the view next door, `storage` for a second window someone
// still has open on the same library.
export const EDITS_EVENT = 'awesome-town:edits';

export function writeEdits(edits) {
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  window.dispatchEvent(new CustomEvent(EDITS_EVENT));
}

// Which shipped version an edit was made against, carried on the edit and
// never on the document.
//
// Edits shadow disk permanently: touch `box` once and your copy wins forever,
// so an improved box.json shipped later reaches everyone except the people
// who cared enough to open it. Recording the version an edit forked from is
// what makes that noticeable, and it has to be recorded from the start —
// there is no way to work out afterwards which version somebody forked.
export const EDIT_BASE = '__base';

const withoutBase = (doc) => {
  if (!doc || !(EDIT_BASE in doc)) return doc;
  const { [EDIT_BASE]: _drop, ...rest } = doc;
  return rest;
};

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
    const clean = withoutBase(over);
    out.set(id, out.has(id) ? { ...out.get(id), ...clean } : clean);
  }
  return { components: out };
}

// Edits whose shipped component has moved on underneath them. Reported, never
// resolved automatically: the whole point of an edit is that the author meant
// it, and quietly rebasing would throw away the thing they meant.
export function staleEdits(shipped, edits) {
  const out = [];
  for (const [id, over] of Object.entries(edits || {})) {
    if (!over || over.deleted) continue;
    const base = over[EDIT_BASE];
    const disk = shipped.components.get(id);
    if (base == null || !disk) continue;
    if ((disk.version ?? 1) > base) out.push({ id, from: base, to: disk.version ?? 1 });
  }
  return out;
}

// Two documents comparing equal as documents, ignoring the bookkeeping. An
// edit that has been walked all the way back to what shipped is not an edit,
// and should disappear rather than linger as a no-op that still shadows disk.
export const sameDoc = (a, b) => JSON.stringify(withoutBase(a)) === JSON.stringify(withoutBase(b));

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

// --- part identity ----------------------------------------------------------

// A part's name, which is not where it sits in the list.
//
// Slot picks used to draw from a path holding the part's position, so adding
// a plinth at the bottom of a lamp post rerolled the lamp at the top: every
// part after the insertion moved one place along and drew from a different
// stream. Exactly the failure road identity had, one layer down, and the same
// answer — a name that describes the thing rather than its turn in a queue.
//
// Minted at authoring time and written into the document, so it is stable by
// being recorded rather than by being computed. Parts on disk from before
// this fall back to their index, which is what they have always resolved
// against, so nothing already authored shifts on the way past.
export const partIdOf = (part, index) => part?.id || `p${index}`;

let minted = 0;
export const mintPartId = () =>
  `p${Date.now().toString(36).slice(-4)}${(minted++).toString(36)}`;

// A part as the editor adds one: named from birth.
export const newPart = (component, params = {}) => ({ id: mintPartId(), component, params });

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

// --- measuring --------------------------------------------------------------

// The true extent of a piece of geometry, rather than the size it was asked
// for. A cone fills a fraction of the box it was built in, and a modifier
// can push a shape well outside one, so anything that stacks or frames needs
// the real thing. Everything downstream reads these, which is why a stack of
// mixed shapes now sits flush instead of leaving the gaps a nominal box left.
export function measure(pos) {
  if (!pos || !pos.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = pos[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

export const boxSize = (box) => ({
  w: box.max[0] - box.min[0],
  h: box.max[1] - box.min[1],
  d: box.max[2] - box.min[2],
});

const emptyBox = (w, h, d) => ({ min: [-w / 2, -h / 2, -d / 2], max: [w / 2, h / 2, d / 2] });

// A box carried through the same placement its geometry gets: scaled, turned
// about Y, then moved so its base sits at the offset. Rotating an axis-
// aligned box means rotating its four horizontal corners and re-bounding,
// since the result is no longer aligned to the axes it was measured on.
function placeBox(box, offset, rotY = 0, scale = 1) {
  const lift = offset[1] - box.min[1] * scale;
  const ys = [box.min[1] * scale + lift, box.max[1] * scale + lift];
  const ca = Math.cos(rotY);
  const sa = Math.sin(rotY);
  const xs = [];
  const zs = [];
  for (const x of [box.min[0] * scale, box.max[0] * scale]) {
    for (const z of [box.min[2] * scale, box.max[2] * scale]) {
      xs.push(ca * x + sa * z + offset[0]);
      zs.push(-sa * x + ca * z + offset[2]);
    }
  }
  return {
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
  };
}

function unionBoxes(boxes) {
  if (!boxes.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let a = 0; a < 3; a++) {
      if (b.min[a] < min[a]) min[a] = b.min[a];
      if (b.max[a] > max[a]) max[a] = b.max[a];
    }
  }
  return { min, max };
}

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
    note('too-deep', { id: doc.id });
    console.warn(`library: ${doc.id} nests too deeply or references itself`);
    return { id: doc.id, bounds: { w: 0, h: 0, d: 0 }, anchors: anchorsFor(0, 0, 0), tags: [], pieces: [] };
  }

  const dims = resolveParamsWith(doc.params || {}, proposals, seed, `${p}.dims`);
  // `w`/`h`/`d` are structural rather than incidental — every component
  // occupies some size on all three axes whether or not its author bothered
  // to declare tunable params for them. A component that never mentions `w`
  // is not saying "nothing may ever propose my width", it is saying it never
  // needed a knob for it — a different thing from refusing a proposal a
  // caller (a template, a slot pin, the city's own generator) explicitly
  // offers. Without this, `resolveParamsWith` only ever answers for keys the
  // component listed, so any axis it left out silently dropped whatever was
  // proposed for it — the reason an assembly with no declared size, which is
  // most of them, never actually responded to being told how big to be.
  for (const axis of ['w', 'h', 'd']) {
    if (!(axis in (doc.params || {})) && Number.isFinite(proposals?.[axis])) dims[axis] = proposals[axis];
  }
  const tags = doc.tags || [];

  // `fit` is a uniform scale stated outright, rather than a target size to be
  // worked backwards from. It is how the town says "you are being placed at
  // this scale" without also saying how big that makes you, which is the
  // component's own business. Never a param, so no component can declare it
  // and nothing on disk changes shape.
  if (isAssembly(doc)) return resolveAssembly(doc, lib, seed, p, dims, tags, depth, seen, proposals?.fit);

  const w = dims.w ?? 1;
  const h = dims.h ?? 1;
  const d = dims.d ?? 1;
  const bounds = { w, h, d };

  if (isEmptyComponent(doc)) {
    // Nothing to measure, so an empty is exactly the size it claims. That is
    // the point of it: a hole of a stated size.
    const box = emptyBox(w, h, d);
    return { id: doc.id, doc, bounds, box, anchors: anchorsFor(w, h, d), tags, params: dims, pieces: [] };
  }

  // `blades` is not a size and has no business going through `dims` — it is
  // a shape option, like every other entry in `shapeOpts`, except one whose
  // value the *caller* decides per instance (the city rolls a blade count
  // per module the same ticket-driven way it rolls everything else) rather
  // than the author fixing once on the document. A proposal for it overrides
  // whatever the component itself declared, the same priority a locked
  // component param already gets over a proposal for `w`/`h`/`d`.
  const shapeOpts = Number.isFinite(proposals?.blades)
    ? { ...(doc.shapeOpts || {}), blades: proposals.blades }
    : doc.shapeOpts || {};
  const base = buildShape(doc.shape, w, h, d, doc.faces ?? 1, shapeOpts);
  const geometry = applyModifiers(base, doc.modifiers, seed, `${p}.mod`);
  // Measured, not assumed. A cone asked for a 1×1×1 box occupies rather less
  // of it, and a noise modifier can push a shape outside one entirely.
  const raw = measure(geometry.pos);
  const tight = boxSize(raw);
  // One invariant holds the whole system together: a resolved component is
  // positioned so its box stands on y = 0. Shapes are modelled about their
  // own centre, so the piece carries the lift that puts its measured base on
  // the floor — measured, so a shape that does not fill its box still lands
  // flush rather than hovering by the difference.
  const lift = -raw.min[1];
  const box = { min: [raw.min[0], 0, raw.min[2]], max: [raw.max[0], tight.h, raw.max[2]] };
  return {
    id: doc.id,
    doc,
    bounds: tight,
    box,
    requested: bounds,
    anchors: anchorsFor(tight.w, tight.h, tight.d),
    tags,
    params: dims,
    geometry,
    pieces: [
      {
        id: doc.id,
        geometry,
        bounds: tight,
        box,
        offset: [0, lift, 0],
        rotY: 0,
        scale: 1,
        path: p,
        partIndex: -1,
        // No `spinSpeed` here, deliberately. A leaf's own spin is already
        // reported in `params`, and `applyComponents` in generate.js reads it
        // from there into the module's `spinSpeed` — where the city constrains
        // it. Putting it on the piece as well made the renderer prefer this
        // raw, unconstrained resolve over the city's: a `spin` declaring a
        // -4..7 range drove the GPU at 6.8 rad/s while the module it belonged
        // to had settled on 0.84. Whole-component spin travels by `params`;
        // the piece field is only ever for a *part* of an assembly.
      },
    ],
  };
}

function resolveAssembly(doc, lib, seed, p, dims, tags, depth, seen, fitScale) {
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
    // Which part this is, and which time round the list. Both stable under
    // insertion: the part carries its own name, and the cycle counts this
    // part's own instances rather than every instance before it.
    const partPath = `${p}.${partIdOf(part, partIndex)}#${Math.floor(i / list.length)}`;
    const chosenId = pickSlot(part, seed, partPath);
    const child = chosenId ? lib.components.get(chosenId) : null;
    if (!child) {
      if (chosenId) {
        note('slot-missing', { parent: doc.id, id: chosenId });
        console.warn(`${doc.id}: no component "${chosenId}"`);
      }
      continue;
    }
    // A slot pins parameters on whatever it picked without touching the
    // component itself, which is how one box is a wide plinth here and a
    // narrow post there. Pins are proposals, so the child's own locks still
    // get the last word — constraints only ever tighten going inward. This
    // is the author's own hand-tuned proportion for this specific part in
    // this specific assembly, and nothing else should override it: the
    // assembly has no separate size of its own to reconcile it against (see
    // the `bounds`/`scale` comment below), so what the parts resolve to,
    // stacked, is the assembly's real size — the same way its height varies
    // when a part's own pinned range lands somewhere new.
    const proposals = part.params
      ? resolveParams(part.params, seed, `${partPath}.pin`)
      : undefined;
    const r = resolveComponent(child, lib, seed, `${partPath}:${chosenId}`, proposals, depth + 1, nextSeen);
    if (r) {
      // Turn and spin don't get w/h/d's blanket "every component has one
      // whether it says so or not" treatment — most components have no
      // business spinning, and a pin should not make one move that never
      // opted in. But a pin *is* opting a specific occurrence in, the same
      // way a size pin does, so it still has to land even when the picked
      // component never declared the param on itself. Only fills the gap:
      // if the child already resolved its own turn/spin (declared the
      // param at all, in any mode), that stands — this never overrides it.
      if (proposals && r.params) {
        const filled = { ...r.params };
        if (Number.isFinite(proposals.turn) && !Number.isFinite(filled.turn)) filled.turn = proposals.turn;
        if (Number.isFinite(proposals.spinSpeed) && !Number.isFinite(filled.spinSpeed)) filled.spinSpeed = proposals.spinSpeed;
        r.params = filled;
      }
      resolvedParts.push({ ...r, partIndex, instanceIndex: i, slotId: chosenId, path: partPath });
    }
  }

  // The arrangement's own idea of its size is discarded: it can only
  // estimate, and the union of the measured parts below is exact.
  const { placed } = algo.place(resolvedParts, opts);

  // Flatten one level: a child's own pieces are already relative to the
  // child, so they only need this placement added. Recursion means depth is
  // already handled by the time it gets here.
  const pieces = [];
  for (const part of placed) {
    const s = part.scale ?? 1;
    // The arrangement's own placement angle, plus whatever this part's own
    // component resolved its `turn` param to — a pinned or authored facing,
    // same as any other pin, riding along on top of wherever the ring or
    // stack put the part rather than replacing it.
    const spin = (part.rotY || 0) + (Number.isFinite(part.params?.turn) ? part.params.turn : 0);
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    // Every resolved part already stands on its own zero, so placing it is
    // just adding where the arrangement put it. No half-heights guessed at
    // anywhere: the lift was measured when the part was resolved.
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
        // Spin belongs to the part that pinned it, and travels down to that
        // part's own pieces only. A piece that already carries one keeps it,
        // so a spin pinned deep in a nested assembly is not overwritten by an
        // outer part that happens to spin too.
        spinSpeed: Number.isFinite(piece.spinSpeed)
          ? piece.spinSpeed
          : Number.isFinite(part.params?.spinSpeed)
            ? part.params.spinSpeed
            : undefined,
      });
    }
  }

  // The assembly's real extent: every part's own measured box, carried
  // through the placement it was given, unioned. Tight by construction, so
  // an assembly stacks against its neighbours the way a single shape does
  // rather than reserving whatever its arrangement guessed at.
  const box = unionBoxes(
    placed.map((part) => placeBox(part.box || emptyBox(part.bounds.w, part.bounds.h, part.bounds.d), part.offset, part.rotY || 0, part.scale ?? 1))
  );
  const tight = boxSize(box);

  // A component's own size params still override what the parts added up to,
  // so an assembly can be told how big it is from outside — a template, a
  // slot pin, or the city's own generator handing every module a size before
  // it is drawn.
  // **One factor for all three axes, taken from the footprint.**
  //
  // A component is authored against the shape it sits next to — a box at the
  // size the town gives a module is the measuring stick everything else was
  // drawn to. So "make this fit the lot" has to mean the amount a box would
  // have been scaled by, applied whole, not three independent stretches. Three
  // was what turned a spinner's 11.8m disc into a 4m one while leaving its
  // 27m mast alone: every number matched what was asked for and the object
  // was no longer the object.
  //
  // Driven by width and depth rather than height, and by the *smaller* of the
  // two, so the assembly sits within the ground its module was given. Height
  // is then whatever the proportion makes it, which is the point: a tall thing
  // stays tall relative to its own width, and the variation an author built
  // into its parts survives at every size.
  //
  // Height only gets a say when it is the only thing asked for, which is the
  // case for a component pinned by height alone rather than placed on a lot.
  //
  // **A stated `fitScale` skips all of that.** Squeezing an assembly inside
  // the footprint it was handed is the wrong question for something like a
  // spinner, where the mast that meets the roof is small and the disc is
  // deliberately enormous — fitting the disc to the lot shrinks the whole
  // object to a fraction of the size it was drawn at. The town works out the
  // scale from the measuring stick instead and says it plainly here, and the
  // assembly is free to overhang whatever it is standing on.
  let k = 1;
  if (Number.isFinite(fitScale) && fitScale > 0) {
    k = fitScale;
  } else {
    const fit = [];
    if (Number.isFinite(dims.w) && tight.w > 1e-6) fit.push(dims.w / tight.w);
    if (Number.isFinite(dims.d) && tight.d > 1e-6) fit.push(dims.d / tight.d);
    if (!fit.length && Number.isFinite(dims.h) && tight.h > 1e-6) fit.push(dims.h / tight.h);
    if (fit.length) k = Math.min(...fit);
  }

  const bounds = { w: tight.w * k, h: tight.h * k, d: tight.d * k };

  // Baked into the geometry here, not left as `bounds` reporting a number the
  // triangles do not agree with. That used to be the entire bug: an assembly
  // told to be a different size updated its own metadata and nothing about
  // what actually got drawn, because a child's geometry is fixed the moment
  // it resolves — a leaf regenerates itself at whatever size it is asked
  // for, but an assembly's children each resolve their own size from their
  // own params before the assembly's request is even known, so nothing
  // downstream of that ever revisits it. Rescaling the composed result,
  // after every child has already been placed, is what a request to be a
  // different size while keeping the same composition actually has to mean —
  // stretching every part in proportion to how the assembly as a whole
  // needs to change, not re-authoring each part's own independent size.
  const scale = { x: k, y: k, z: k };
  const rescaled = k === 1 ? pieces : pieces.map((piece) => scalePiece(piece, scale));

  // **Spin turns the part it was pinned on, and nothing else.**
  //
  // This used to resolve one speed for the whole merged mesh, on the reasoning
  // that no part of a rigid assembly turns without the rest — which is true of
  // a spinner's own cards and false of an assembly, where the parts are
  // separate objects that happen to be stacked. The consequence was that
  // pinning a spin on the lamp of a lamp-post span the post and its base too,
  // and there was no way to express the thing anyone actually wants: one piece
  // turning on a fixed mount.
  //
  // So the speed rides on the piece (see the flatten above) and each piece
  // turns about its own axis. An assembly may still declare `spinSpeed` on
  // itself, which now means "every piece of me that has not been given one of
  // its own", so opting a whole component in is still one pin.
  const ownSpin = dims.spinSpeed;
  if (Number.isFinite(ownSpin)) {
    for (const piece of rescaled) {
      if (!Number.isFinite(piece.spinSpeed)) piece.spinSpeed = ownSpin;
    }
  }

  return {
    id: doc.id,
    doc,
    bounds,
    box: scaleBox(box, scale),
    anchors: anchorsFor(bounds.w, bounds.h, bounds.d),
    tags,
    params: dims,
    parts: placed,
    pieces: rescaled,
    algorithm: doc.algorithm || DEFAULT_ALGORITHM,
  };
}

// A non-uniform, axis-aligned rescale of one piece's baked geometry and
// position. Everything downstream — `build.js`'s merge, the editor's
// preview, thumbnails — goes on reading `geometry.pos`, `offset` and
// `scale` exactly as before; this is where the stretch happens so nothing
// else has to know one did.
function scalePiece(piece, scale) {
  const geo = piece.geometry;
  let geometry = geo;
  if (geo?.pos?.length) {
    const pos = new Float32Array(geo.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = geo.pos[i] * scale.x;
      pos[i + 1] = geo.pos[i + 1] * scale.y;
      pos[i + 2] = geo.pos[i + 2] * scale.z;
    }
    // A non-uniform scale needs the inverse-transpose to keep a normal
    // perpendicular to the surface it describes — for an axis-aligned
    // diagonal scale that is just the reciprocal per axis, renormalised.
    const nor = new Float32Array(geo.nor.length);
    for (let i = 0; i < nor.length; i += 3) {
      const nx = geo.nor[i] / (scale.x || 1);
      const ny = geo.nor[i + 1] / (scale.y || 1);
      const nz = geo.nor[i + 2] / (scale.z || 1);
      const len = Math.hypot(nx, ny, nz) || 1;
      nor[i] = nx / len;
      nor[i + 1] = ny / len;
      nor[i + 2] = nz / len;
    }
    geometry = { ...geo, pos, nor };
  }
  return {
    ...piece,
    geometry,
    offset: [piece.offset[0] * scale.x, piece.offset[1] * scale.y, piece.offset[2] * scale.z],
  };
}

function scaleBox(box, scale) {
  return {
    min: [box.min[0] * scale.x, box.min[1] * scale.y, box.min[2] * scale.z],
    max: [box.max[0] * scale.x, box.max[1] * scale.y, box.max[2] * scale.z],
  };
}

export function resolveEntry(id, lib, seed, path, proposals) {
  const doc = lib.components.get(id);
  return doc ? resolveComponent(doc, lib, seed, path, proposals) : null;
}

// --- merging ----------------------------------------------------------------

// Flatten a resolved component into one geometry, in the same shape
// buildShape returns, so an assembly can stand wherever a single shape could.
// The city's merge loop then treats a lamp post exactly like a cube: one
// vertex buffer, one set of slots, no knowledge of what is inside.
//
// UVs are left in each sub-shape's own 0..1 space, untouched, because
// cropping to an image is the caller's business and happens after this.
export function mergeResolved(r) {
  const out = { pos: [], nor: [], uv: [], wind: [], slots: [] };
  if (!r) return finishMerge(out);

  for (const piece of r.pieces) {
    const g = piece.geometry;
    if (!g) continue;
    const s = piece.scale ?? 1;
    const a = piece.rotY || 0;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const [ox, oy, oz] = piece.offset;
    const base = out.pos.length / 3;

    for (let i = 0; i < g.pos.length; i += 3) {
      const x = g.pos[i] * s;
      const y = g.pos[i + 1] * s;
      const z = g.pos[i + 2] * s;
      // Shapes are modelled about their own centre, so a piece is lifted by
      // half its height to stand its base at the offset it was placed at.
      out.pos.push(ca * x + sa * z + ox, y + oy, -sa * x + ca * z + oz);
      const nx = g.nor[i];
      const ny = g.nor[i + 1];
      const nz = g.nor[i + 2];
      out.nor.push(ca * nx + sa * nz, ny, -sa * nx + ca * nz);
    }
    for (let i = 0; i < g.uv.length; i++) out.uv.push(g.uv[i]);
    for (let i = 0; i < (g.wind?.length || 0); i++) out.wind.push(g.wind[i]);
    while (out.wind.length < out.pos.length / 3) out.wind.push(0);

    // Slot starts shift by however many vertices came before, so every
    // sub-shape keeps its own faces and the caller can still address them.
    //
    // Each slot also carries the spin of the piece it came out of, and the
    // axis to turn about — the piece's own placement, in the merged shape's
    // local frame. Without both, the city could only turn a whole module about
    // its centre, which is the behaviour that made a pinned spin drag every
    // other part of an assembly round with it.
    for (const slot of g.slots || []) {
      out.slots.push({
        ...slot,
        start: slot.start + base,
        spinSpeed: piece.spinSpeed,
        pivot: [ox, oz],
      });
    }
  }
  return finishMerge(out);
}

function finishMerge(out) {
  return {
    pos: new Float32Array(out.pos),
    nor: new Float32Array(out.nor),
    uv: new Float32Array(out.uv),
    wind: new Float32Array(out.wind),
    slots: out.slots,
  };
}

// --- authoring --------------------------------------------------------------

// A label reduced to something safe for an id or a filename. One definition,
// because the two have to agree about what "water tower" becomes or a
// component's file stops matching the id it was minted with.
export function slug(label) {
  return (
    (label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'component'
  );
}

// The size a component sits at when nothing is asking it to be anything: the
// middle of every range it declares, and nothing at all for what it does not.
//
// This is the frame the component editor previews in, which makes it the frame
// every component in the library was authored against — an assembly is drawn
// next to a box at *its* canonical size, so the ratio between the two is the
// author's own statement of how big the thing is. `generate.js` reads that
// ratio back out to place assemblies at the size they were drawn at. If this
// ever stops matching what the editor shows, the town stops matching the
// editor with it.
export function canonicalSize(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc?.params || {})) {
    if (value?.mode === 'fixed') continue;
    const min = value?.min ?? 0;
    const max = value?.max ?? 1;
    out[key] = (min + max) / 2;
  }
  return out;
}

export function makeId(label, taken) {
  const base = slug(label);
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
