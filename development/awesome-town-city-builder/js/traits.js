// What a component is like, as opposed to what it is called.
//
// A module names the component it is an instance of, and until now six
// separate tables scattered across two files answered questions about that
// name by looking it up in a hardcoded list of primitives. That worked only
// because every leaf component on disk was deliberately named after a shape
// the geometry switch knows: `box`, `cone`, `sphere`.
//
// The roles refactor broke that guarantee, because a role may now hold any
// component id at all, including an assembly. Put a lamp post in the body
// role today and every one of those lookups misses: it silently becomes
// `boxy` and drags the roof choice with it, it can never wear a material, and
// the inspector offers you a cube's six faces for something with fifty-six
// slots. Nothing throws. The geometry comes out right, because build.js
// re-derives the slot count from the merged mesh, and every authoring
// decision above it was made against the wrong vocabulary.
//
// So the question moves here, and the answer comes from the component rather
// than from a list of names. A document may declare what it is:
//
//   { "traits": { "family": "round", "material": true, "images": false } }
//
// and anything it does not declare falls back to the tables below, keyed by
// id. That is what keeps the shipped library working untouched: `sphere` is
// still round because the table says so, and stays round until somebody edits
// sphere.json to say otherwise. Nothing on disk had to change for this.
//
// The one place the fallback deliberately does not apply is an id the tables
// have never heard of, which is exactly the assembly case the audit found.
// Those get the defaults at the bottom, chosen to be the safe reading rather
// than the box reading.

import { SLOT_LABELS, FLAT_SLOTS, slotCount, slotLabels } from './geometry.js';

// --- the shipped vocabulary -------------------------------------------------
// Defaults a leaf component inherits when its document says nothing. Moved
// here from generate.js rather than rewritten, so the town they describe is
// the same town.

// Family drives building cohesion: a round building reaches for round parts.
export const FAMILY = {
  box: 'boxy',
  pillars: 'boxy',
  pillars8: 'boxy',
  post: 'boxy',
  octagon: 'round',
  cylinder: 'round',
  sphere: 'round',
  spin: 'round',
  pyramid: 'boxy',
  gable: 'boxy',
  cone: 'round',
  dome: 'round',
  flat: 'boxy',
  flag: 'boxy',
};

export const ROOFS_BY_FAMILY = {
  boxy: ['flat', 'pyramid', 'gable'],
  round: ['flat', 'cone', 'dome'],
};

// Shapes that cap a building rather than stack inside it.
export const ROOF_SET = new Set(['pyramid', 'gable', 'cone', 'dome']);

// Roofs that come to a point can carry a spire.
export const POINTED_ROOFS = new Set(['pyramid', 'cone']);

// What a building's material — concrete, brick, wood, or the reflective glass
// shader — is allowed to cover. Never a roof, but pillars are fair game even
// though they never take a picture: a column being made of stone or wood
// reads fine, a photo wrapped round one inch of it does not.
export const MATERIAL_KINDS = new Set(['box', 'octagon', 'cylinder', 'sphere', 'pillars', 'pillars8', 'post']);

// Shapes with no face big enough or flat enough to carry a photograph.
const NO_IMAGES = new Set(['flag', 'pillars', 'pillars8', 'post', 'sphere']);

export const KIND_LABEL = {
  box: 'Cube',
  octagon: 'Octagon',
  cylinder: 'Cylinder',
  pillars: 'Pillars 4',
  pillars8: 'Pillars 8',
  post: 'Post',
  sphere: 'Sphere',
  spin: 'Spin',
  flat: 'Flat',
  pyramid: 'Pyramid',
  gable: 'Gable',
  cone: 'Cone',
  dome: 'Dome',
  flag: 'Flag',
};

// An id the tables were written about. Anything else is a component the
// library gained later, and gets asked rather than assumed about.
export const isPrimitive = (id) => id in FAMILY || id in SLOT_LABELS;

// --- asking a component ----------------------------------------------------

const declared = (doc, key) => {
  const t = doc?.traits;
  return t && key in t ? t[key] : undefined;
};

// Whether this thing is round or boxy, for the cohesion rule that makes a
// round building reach for round parts.
export function familyOf(id, doc) {
  return declared(doc, 'family') ?? FAMILY[id] ?? 'boxy';
}

// Whether it caps a building. An assembly says so or it does not: guessing
// from its silhouette would be worse than either answer.
export function isRoofKind(id, doc) {
  return declared(doc, 'roof') ?? ROOF_SET.has(id);
}

export function isPointedRoof(id, doc) {
  return declared(doc, 'pointed') ?? POINTED_ROOFS.has(id);
}

// Whether a building's material may cover it.
//
// The default for something the tables never heard of is no, and deliberately
// so. A material tiles across every sub-shape of an assembly at once, which
// on a lamp post means a brick bulb — a component has to opt in by saying
// `"material": true`, because there is no way to look at a bag of parts and
// tell whether that reads.
export function takesMaterial(id, doc) {
  return declared(doc, 'material') ?? MATERIAL_KINDS.has(id);
}

// Whether a photograph can live on it. Roofs never, and a handful of shapes
// with nothing flat enough to hold one.
export function takesImages(id, doc) {
  const own = declared(doc, 'images');
  if (own !== undefined) return own;
  return !isRoofKind(id, doc) && !NO_IMAGES.has(id);
}

export function labelOf(id, doc) {
  return KIND_LABEL[id] || doc?.label || id;
}

// How many paintable slots it has, and what they are called.
//
// A primitive knows from its own geometry. An assembly does not know until it
// has been resolved and merged, so build.js stamps the real count onto the
// module when it builds one, and this reads that when it is there. The box
// fallback stays for the moment before a module has ever been built, where
// six is as good a guess as any and nothing is drawn from it.
export function slotsOf(module, doc) {
  if (module?.slotCount) return module.slotCount;
  if (isAssemblyDoc(doc)) return 1;
  return slotCount(module?.kind, module?.blades);
}

export function slotNamesOf(module, doc) {
  const n = slotsOf(module, doc);
  if (isAssemblyDoc(doc)) {
    // An assembly's slots belong to its parts, not to a cube's compass.
    // Numbering them at least says what they are — many, and in order —
    // rather than claiming a lamp post has a front and a back.
    return Array.from({ length: n }, (_, i) => `face ${i + 1}`);
  }
  const labels = slotLabels(module?.kind, module?.blades);
  // A `radial` modifier can hand back more copies than the shipped table
  // for this kind was ever sized for — `module.slotCount` (stamped once the
  // module has actually been built) is the true count. Numbering the
  // overflow the same way an assembly's slots are is more honest than a
  // blank chip.
  if (n <= labels.length) return labels;
  return Array.from({ length: n }, (_, i) => labels[i] || `face ${i + 1}`);
}

const isAssemblyDoc = (doc) => Boolean(doc && Array.isArray(doc.parts));

// Which slots of a shape must stay flat colour.
export function flatSlotsOf(id, doc) {
  const own = declared(doc, 'flatSlots');
  if (own !== undefined) return own;
  return FLAT_SLOTS[id] || [];
}
