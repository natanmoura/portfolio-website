// City generation. Pure data in, pure data out, no three.js here.
//
// Two rules keep this predictable to edit:
//
// 1. Every module draws from its own stream, seeded from (seed, lot, index).
//    Traits are rolled as a fixed block of tickets no matter what the sliders
//    say, and the sliders only decide how to read those tickets. So turning
//    "lit modules" up lights modules that were already there instead of
//    reshuffling the city, and the same goes for every other distribution.
//
// 2. Edits live as sparse overrides keyed by module id, so a global reroll
//    happens around them rather than through them.

import { Rng, hashId, hashIdModule } from './rng.js';
import { getPalette } from './palettes.js';
import { buildLayout } from './layout.js';
import { defaultHalf } from './region.js';
import { MAX_SLOTS, slotCount, flatSlots } from './geometry.js';
import { resolveParamsWith } from './constraints.js';
import { resolveComponent } from './library.js';
import { note } from './provenance.js';

// The kind vocabulary and the role definitions live in roles.js; what a given
// component is *like* lives in traits.js. Both re-exported here so the many
// existing importers of these names are undisturbed.
//
// A module's `kind` is the id of the component it is an instance of. It used
// to double as a key into six hardcoded tables of primitives, which is why
// traits.js exists: a role may hold any component now, and a name is no
// longer enough to answer what something is made of. Every question below
// goes through a `…Of(id, doc)` call that asks the component first.
import { BODY_KINDS, ROOF_KINDS, MODULE_KINDS, KIND_LABEL, includedFor } from './roles.js';
import {
  FAMILY,
  ROOFS_BY_FAMILY,
  ROOF_SET,
  MATERIAL_KINDS,
  POINTED_ROOFS,
  familyOf,
  isRoofKind,
  isPointedRoof,
  takesMaterial,
  takesImages,
  flatSlotsOf,
} from './traits.js';

export { BODY_KINDS, ROOF_KINDS, MODULE_KINDS, KIND_LABEL };
export { FAMILY, ROOFS_BY_FAMILY, ROOF_SET, MATERIAL_KINDS, POINTED_ROOFS };

// What a building's whole surface can be, as one weighted pick instead of a
// chain of independent chances — the wheel in the Surface tab edits this
// directly. Texture and colour draw from flat sources (a texture pool, a flat
// tint); glass and mirror are shaders with nothing to point an index at;
// image and cutout each restrict the building to one half of the collage
// pool, rather than mixing photos and stickers on the same building.
export const SURFACE_KINDS = ['texture', 'glass', 'mirror', 'image', 'cutout', 'colour'];
export const SURFACE_LABEL = {
  texture: 'Texture',
  glass: 'Glass',
  mirror: 'Mirror',
  image: 'Image',
  cutout: 'Cutout',
  colour: 'Colour',
};

export const DEFAULTS = {
  seed: 8114,
  // Terrain and the road pattern each draw from their own seed, so one can
  // be locked and rerolled without the other two moving. `null` means
  // "follow the city seed" and is the state every scene starts in and every
  // scene saved before this existed loads into — a fixed literal default
  // here would desync an old scene's terrain from its own `seed` the moment
  // it loaded, which is worse than the field simply not existing. The
  // fallback is resolved wherever the value is read, not normalised on load,
  // so "following" is a live relationship and not a one-time copy: rerolling
  // the city seed carries an unlocked terrain or road seed along with it
  // right up until you give that seed a roll of its own.
  terrainSeed: null,
  roadSeed: null,
  cols: 10,
  rows: 10,
  cell: 6.4,
  // The outline of the town, as a closed curve, or null for the square that
  // cols and rows imply. A scene that never draws one saves nothing extra and
  // generates exactly as it always did — see region.js. It lives in params
  // rather than beside them because it is authoring, not view state: it
  // saves, loads, undoes and exports with everything else that decides what
  // the town is.
  boundary: null,
  // Roads you have taken hold of, by road id. A road in here is emitted every
  // rebuild from the curve stored with it and the pattern never touches it
  // again; everything not in here is proposed fresh each time. Empty in every
  // scene that has never held one, which is why a town with no road edits
  // generates exactly as it did before roads could be held. See `heldRoads`
  // in layout.js for why the key is the road's original id.
  roadEdits: {},
  // Roads deleted outright, by id. Different from letting one go with `L`:
  // releasing hands a road back to the pattern, deleting says you do not want
  // that road at all. It persists across rebuilds the same way a hold does —
  // by id — so it stays gone for as long as the pattern keeps proposing the
  // same road in the same place, and lapses harmlessly the moment something
  // upstream changes enough that it no longer would.
  roadRemoved: {},
  // Lots merged into one, as `{ plotId: howManyPlots }`. A building with a
  // span of four stands on its own plot and the three after it along the same
  // kerb — a department store rather than four shops. See `applySpans` in
  // layout.js.
  lotSpans: {},
  density: 0.86,
  lotFill: 0.72,
  lotJitter: 0.16,
  // Streets
  roadPattern: 'grid',
  roadSkew: 0.25,
  blockWidth: 1.9,
  blockDepth: 2.4,
  blockDepthRatio: 0.85,
  frontageSpacing: 1.12,
  setback: 0.5,
  highwayWidth: 5.2,
  streetWidth: 2.6,
  showRoads: true,
  // How far off the ground the pattern proposes its roads. Zero is every road
  // on the ground, which is every scene that predates this. See elevation.js:
  // an end that meets another road agrees with it, an end that meets nothing
  // ramps back down, and anything you have lifted by hand ignores all of it.
  roadHeight: 0,
  roadHeightVariance: 0,
  roadColumnSpacing: 8,
  // Whether a road is allowed to bridge ground it cannot climb. On by
  // default and a no-op on flat terrain, so nothing that predates drawn
  // ground notices it. See elevation.js.
  roadBridging: true,
  // How far a road is willing to leave the ground to keep its own slope
  // reasonable. Zero glues it to the terrain exactly; higher refuses steeper
  // ground, eases the descent over a longer run, and leaves a taller gap for
  // the columns to fill. See elevation.js.
  roadEase: 0.3,
  // Thin. A pier is read against a whole town, and at anything chunkier the
  // supports under a street start competing with the buildings beside it for
  // attention — which is backwards, since the thing worth looking at is the
  // road being up in the air, not what is holding it there.
  roadColumnWidth: 0.25,
  // How steep the ground under a plot may be, in degrees, before nothing is
  // built there. Ninety is off — no slope can exceed it — which is what every
  // scene saved before this had.
  maxBuildSlope: 38,
  // Traffic
  carCount: 110,
  flyerCount: 16,
  mainRoadBias: 0.7,
  carSpeed: 7,
  carSize: 1,
  flyerHeight: 18,
  minFloors: 2,
  maxFloors: 12,
  centerBias: 0.6,
  floorHeight: 2.2,
  floorJitter: 0.28,
  setbackChance: 0.3,
  setbackAmount: 0.2,
  bend: 0.12,
  cohesion: 0.75,
  // What a building's whole surface is, as one dial rather than several
  // chained chances. imageChance and sameImageChance still shape the result
  // within an image or cutout building — this just decides which pool, if
  // any, a building draws from at all.
  surfaceMix: { texture: 8, glass: 5, mirror: 3, image: 50, cutout: 18, colour: 16 },
  imageChance: 0.62,
  sameImageChance: 0.3,
  zoomJitter: 0.3,
  slabChance: 0.16,
  rotateChance: 0.25,
  glowChance: 0.22,
  glowStrength: 1,
  glowTint: 0.65,
  glowImage: 0.7,
  palette: 'newsprint',
  duotone: 0,
  spireChance: 0.35,
  // Billboard behaviour, as a share of the lit faces.
  scrollShare: 0.28,
  swapShare: 0.32,
  flickerShare: 0.16,
  // Terrain. `terrainMode` picks which of the two kinds of ground is in
  // effect — noise you tune, or shapes you place — and they never mix. See
  // landform.js. A scene saved before this existed has neither field, reads
  // as hills with no terracing, and generates exactly as it did.
  terrainMode: 'hills',
  terrainHeight: 0,
  terrainScale: 0.6,
  terrainDetail: 3,
  // Flat shelves with hard risers between them, applied to whichever kind of
  // ground is in effect. Zero is off, which is what every existing scene has.
  terrainStep: 0,
  // The drawn ground itself: closed curves carrying a height and a falloff,
  // stacked in order. Empty until you place one.
  landforms: [],
  // How much of each module kind exists across the town.
  moduleMix: { box: 44, octagon: 13, cylinder: 11, pillars: 7, pillars8: 5, post: 5, sphere: 4, spin: 16 },
  roofMix: { flat: 28, pyramid: 18, gable: 20, cone: 16, dome: 18 },
  // Which library entries each role may use. Undefined means all of them,
  // which is what every scene saved before roles existed will have.
  roles: { body: [...BODY_KINDS], roof: [...ROOF_KINDS] },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

// Ids come from the layout: `{roadId}_{segment}.{step}{kerb}` for a building
// and that plus `_m{i}` for a module. Every part of it describes where the
// building is rather than when it was made, so a plot keeps its id when a
// neighbour appears or disappears, and a hand edit stays on the building it
// was made against. See `roadId` and `placeSites` in layout.js.
export function moduleIdFor(buildingId, i) {
  return `${buildingId}_m${i}`;
}

// --- weighted picks --------------------------------------------------------

function pickWeighted(weights, keys, ticket, allow, wheel) {
  let total = 0;
  for (const k of keys) {
    if (allow && !allow.has(k)) continue;
    total += Math.max(0, weights[k] || 0);
  }
  if (total <= 0) {
    // Every share zero, or none of the allowed ones carrying any. Right to
    // answer with something rather than nothing, and worth recording: a wheel
    // that appears to be ignored is otherwise unexplainable.
    if (wheel) note(allow ? 'mix-blocked' : 'mix-zero', { wheel });
    return allow ? [...allow][0] || keys[0] : keys[0];
  }
  let acc = ticket * total;
  for (const k of keys) {
    if (allow && !allow.has(k)) continue;
    acc -= Math.max(0, weights[k] || 0);
    if (acc <= 0) return k;
  }
  return keys[keys.length - 1];
}

// --- tickets ---------------------------------------------------------------
// A fixed block of uniform values per module, always rolled in the same order
// and the same quantity. Parameters read these, never the generator.

function tickets(rng) {
  const t = {
    kindRoll: rng.float(),
    kindPick: rng.float(),
    familyPick: rng.float(),
    slab: rng.float(),
    height: rng.float(),
    rot: rng.float(),
    blades: rng.float(),
    spinDir: rng.float(),
    spinSpeed: rng.float(),
    spinIs: rng.float(),
    glow: rng.float(),
    glowStrength: rng.float(),
    glowColour: rng.float(),
    pattern: rng.float(),
    colourA: rng.float(),
    colourB: rng.float(),
    setback: rng.float(),
    wrap: rng.float(),
    zoom: rng.float(),
    panU: rng.float(),
    panV: rng.float(),
    roofKind: rng.float(),
    scroll: rng.float(),
    swap: rng.float(),
    flicker: rng.float(),
    spire: rng.float(),
    images: [],
    hasImage: [],
  };
  for (let i = 0; i < MAX_SLOTS; i++) t.images.push(rng.float());
  for (let i = 0; i < MAX_SLOTS; i++) t.hasImage.push(rng.float());
  return t;
}

// --- colour ----------------------------------------------------------------

const PATTERNS = ['solid', 'alternate', 'half', 'mirror', 'caps', 'banded'];

// Two colours per module, laid out geometrically. Which slots count as caps
// depends on the shape, so a colour break lands where the form breaks.
function capSlots(kind, n, doc) {
  // Only a real hidden base counts as a cap, and pyramid/gable/cone already
  // carry theirs in FLAT_SLOTS. A dome has no such slot — its panels are all
  // visible sides of one hemisphere — so there is nothing here for it to
  // fall back to without picking an arbitrary panel and painting it alone,
  // which is exactly the stray single-colour patch this used to produce.
  const flat = flatSlotsOf(kind, doc);
  return flat.length ? new Set(flat) : new Set();
}

// A colonnade is one object. Striping the columns different colours reads as a
// mistake, so they always share a colour and only the deck takes the second.
const COLONNADES = { pillars: 4, pillars8: 8 };

function paintSlots(kind, n, pattern, a, b, doc) {
  const columns = COLONNADES[kind];
  if (columns) {
    const deck = pattern === 'solid' ? a : b;
    return Array.from({ length: n }, (_, i) => (i < columns ? a : deck));
  }
  const caps = capSlots(kind, n, doc);
  const out = [];
  for (let i = 0; i < n; i++) {
    let useB = false;
    switch (pattern) {
      case 'alternate':
        useB = i % 2 === 1;
        break;
      case 'half':
        useB = i >= Math.ceil(n / 2);
        break;
      case 'mirror':
        useB = i % 4 >= 2;
        break;
      case 'caps':
        useB = caps.has(i);
        break;
      case 'banded':
        useB = Math.floor(i / 2) % 2 === 1;
        break;
      default:
        useB = false;
    }
    out.push(useB ? b : a);
  }
  return out;
}

// A sloped roof carries no collage, but a cube used as a cap is still a cube.
// Spires, colonnades and the single thick post are structure, not surface: an
// image wrapped round a column a few inches wide is unreadable smear. A
// sphere is never a canvas either — a picture curved fully around a ball
// reads as a mistake from every angle.
// These are defaults in traits.js now, where a component can overrule them
// for itself rather than being told what it is by a list of other names.

// Three colours per building, spread across the palette rather than adjacent
// to each other, so a scheme reads as a choice.
function buildingScheme(rng, palette) {
  const pool = [...palette.faces];
  const scheme = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    scheme.push(pool.splice(Math.floor(rng.float() * pool.length), 1)[0]);
  }
  while (scheme.length < 3) scheme.push(scheme[0] || '#cccccc');
  return scheme;
}

// --- modules ---------------------------------------------------------------

// Which roof ids a building may draw from. The family rule — a round
// building reaches for round caps — only ever governed the classic shapes it
// was written about; a library component chosen for the roof role was
// chosen deliberately and is allowed on any building regardless of family.
//
// One function rather than two copies of the same three lines: this used to
// be computed twice, once here and once inside `makeModule`'s own `isRoof`
// branch, and the two drifted — the copy inside `makeModule`, the one that
// actually decides a roof module's `kind`, kept the older family-only
// restriction and could never select anything outside the five shipped
// roof shapes no matter how a scene's role list or mix weighted it. A
// custom roof component was includable, weighted, even chosen by the outer
// pick that only ever asked "is this building capped or flat" — and then
// silently overruled by the inner one that actually mattered.
function roofAllowFor(roofKeys, family) {
  const classic = new Set(ROOF_KINDS);
  const byFamily = ROOFS_BY_FAMILY[family] || ROOFS_BY_FAMILY.boxy;
  const allow = new Set(roofKeys.filter((k) => !classic.has(k) || byFamily.includes(k)));
  return allow.size ? allow : null;
}

function makeModule(t, params, palette, ctx, index, id) {
  const { signature, family, scheme, collage, pickRange, isRoof, material, lib } = ctx;
  // What a component says about itself, or nothing when the library has not
  // loaded. Every trait call below falls back to the shipped tables in that
  // case, which is what the whole town did before this existed.
  const docOf = (k) => lib?.components?.get(k) || null;

  // Which entries this role may draw from at all. Family cohesion then
  // narrows that further, rather than the two competing: excluding a shape
  // from the town excludes it everywhere, and cohesion picks among whatever
  // survives.
  const bodyKeys = includedFor(params, 'body');
  const roofKeys = includedFor(params, 'roof');

  let kind;
  if (isRoof) {
    // A family with none of its roofs included falls back to the role's own
    // list (`roofAllowFor` returns null when its filtered set is empty), so
    // a round building still gets capped by something.
    kind = pickWeighted(params.roofMix, roofKeys, t.roofKind, roofAllowFor(roofKeys, family), 'the roof mix');
    if (kind === 'flat') kind = 'box';
  } else if (t.kindRoll < params.cohesion && bodyKeys.includes(signature)) {
    kind = signature;
  } else if (t.kindRoll < params.cohesion + (1 - params.cohesion) * 0.7) {
    const siblings = new Set(bodyKeys.filter((k) => familyOf(k, docOf(k)) === family));
    kind = pickWeighted(params.moduleMix, bodyKeys, t.familyPick, siblings.size ? siblings : null, 'the shape mix');
  } else {
    kind = pickWeighted(params.moduleMix, bodyKeys, t.kindPick, null, 'the shape mix');
  }

  const slabbed = !isRoof && index > 0 && t.slab < params.slabChance && kind !== 'spin';
  const n = slotCount(kind, 1 + Math.floor(t.blades * 3));
  const pattern = PATTERNS[Math.floor(t.pattern * PATTERNS.length)];
  const a = scheme[Math.floor(t.colourA * 3)];
  const bChoices = scheme.filter((c) => c !== a);
  const b = bChoices[Math.floor(t.colourB * bChoices.length)] || a;
  const doc = docOf(kind);
  const colours = paintSlots(kind, n, pattern, a, b, doc);

  // Which images a module would carry is rolled regardless of its shape, and
  // then filtered by what the shape allows. Keeping the roll means switching a
  // sloped roof to a cube reveals its collage rather than losing it for good.
  // The index lands within whichever half of the pool this building committed
  // to — image or cutout, never both — via pickRange.start/count.
  const wrapOne = t.wrap < params.sameImageChance;
  const sharedImage = pickRange.count ? pickRange.start + Math.floor(t.images[0] * pickRange.count) : null;
  const allowed = takesImages(kind, doc);
  const blocked = new Set(flatSlotsOf(kind, doc));

  const faces = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const wants = collage && pickRange.count > 0 && i < n && t.hasImage[i] < params.imageChance;
    const raw = wants ? (wrapOne ? sharedImage : pickRange.start + Math.floor(t.images[i] * pickRange.count)) : null;
    const shown = allowed && !blocked.has(i) ? raw : null;
    faces.push({
      imageRaw: raw,
      image: shown,
      color: shown != null ? '#ffffff' : colours[Math.min(i, n - 1)] || a,
      zoom: 1 + t.zoom * params.zoomJitter,
      panU: 0.25 + t.panU * 0.5,
      panV: 0.25 + t.panV * 0.5,
    });
  }

  const spins = kind === 'spin' || (kind === 'cylinder' && t.spinIs < 0.45);

  // A building wears at most one material, and every eligible module in it
  // wears the same one — that consistency is the whole point, so this is a
  // straight shape check against the building's single choice rather than a
  // per-module roll. A roof never qualifies regardless of what shape it
  // resolved to, since a flat roof is a box underneath.
  const usesMaterial = !isRoof && material && takesMaterial(kind, doc);

  // The glow ticket travels to the shader rather than being resolved here, so
  // the "lit modules" slider switches existing modules on and off instead of
  // shifting the random stream and rebuilding the city around it. An explicit
  // edit pins the ticket outside 0..1 to force lit or unlit.
  return {
    id,
    index,
    kind,
    slab: slabbed,
    rotY: t.rot < params.rotateChance ? Math.PI / 2 : 0,
    // Blade count used to be set here, straight from a ticket. Now the spin
    // component's own `radial` modifier decides it, resolved deterministically
    // off (modSeed, modPath) same as any other authored parameter — see
    // spin.json and modifiers.js. `t.blades` stays drawn above so nothing
    // later in the ticket block shifts.
    spinSpeed: spins ? mix(0.18, 0.85, t.spinSpeed) * (t.spinDir < 0.5 ? 1 : -1) : 0,
    glowTicket: t.glow,
    glowColor: palette.glow[Math.floor(t.glowColour * palette.glow.length)],
    glowStrength: mix(0.6, 1.4, t.glowStrength),
    matKind: usesMaterial ? material.kind : null,
    matIndex: usesMaterial && material.kind === 'material' ? material.index : null,
    // Billboard tickets, read against the global shares in the shader.
    anim: [t.scroll, t.swap, t.flicker],
    pattern,
    scheme: [a, b],
    faces,
  };
}

// --- components ------------------------------------------------------------

// Where the library meets the town.
//
// A module's kind is a component id, so every module already names the
// component it is an instance of. This pass hands the town's proposed size
// to that component's constraints and takes back whatever survives, then
// attaches the modifier stack for the builder to run at geometry time.
//
// Deliberately the only place the two systems touch. The town keeps
// proposing sizes the way it always did, in complete ignorance of whether
// anything is locked; the component keeps its opinions in one place. Nothing
// is cached, so unlocking a parameter in the editor and regenerating is the
// whole update path — there is no baked state to invalidate.
function applyComponents(modules, params, library, seed, id) {
  if (!library) return;
  for (const m of modules) {
    const component = library.components.get(m.kind);
    if (!component) continue;

    const path = `lot:${id}/${m.id}`;
    // Turn and spin travel through the same proposal the town always sent —
    // the ticket-rolled facing and speed — so a component that never
    // mentions either keeps drawing exactly as it did before this existed.
    // One that does gets the same priority any other authored param gets:
    // fixed overrules the roll outright, range keeps it inside a leash, free
    // just watches it go by.
    const motion = { turn: m.rotY, spinSpeed: m.spinSpeed };

    if (component.parts) {
      // An assembly's height is not a knob the town gets to turn — it is
      // whatever its parts, each pinned to its own proportion by whoever
      // authored it, add up to once stacked. Only the footprint gets fit to
      // the town's own proposal, the way "the scene scales it into place"
      // has to mean for a spire or a lamp: narrow or widen it to sit on the
      // lot it landed on, but do not flatten a signed tower to floor height
      // because that is what a roof cap happens to need. Measured with the
      // same (seed, path) `m.modSeed`/`m.modPath` are about to be set to, so
      // the real resolve in `build.js` lands on this exact number and the
      // assembly's own scale-to-fit leaves height untouched (a scale of 1).
      const measured = resolveComponent(component, library, seed, path, { w: m.w, d: m.d, ...motion });
      if (measured && Number.isFinite(measured.bounds?.h)) m.h = measured.bounds.h;
      if (Number.isFinite(measured?.params?.turn)) m.rotY = measured.params.turn;
      if (Number.isFinite(measured?.params?.spinSpeed)) m.spinSpeed = measured.params.spinSpeed;
    } else {
      const dims = resolveParamsWith(
        component.params,
        { w: m.w, h: m.h, d: m.d, ...motion },
        seed,
        path
      );
      if (Number.isFinite(dims.w)) m.w = dims.w;
      if (Number.isFinite(dims.h)) m.h = dims.h;
      if (Number.isFinite(dims.d)) m.d = dims.d;
      if (Number.isFinite(dims.turn)) m.rotY = dims.turn;
      if (Number.isFinite(dims.spinSpeed)) m.spinSpeed = dims.spinSpeed;
    }

    // A sphere stays a sphere even after a component has had its say.
    if (m.kind === 'sphere') m.w = m.d = m.h = Math.min(m.w, m.d);

    // Carried rather than applied: geometry does not exist yet. The seed and
    // path travel with it so the builder resolves exactly what was intended
    // here, and the same module deforms the same way on every rebuild. Set
    // for every module, not only modified ones, because an assembly is
    // resolved from them too and has to land on the same variant each time
    // the scene is reopened.
    m.modSeed = seed;
    m.modPath = path;
    if (component.modifiers && component.modifiers.length) m.mods = component.modifiers;
  }
}

// --- override fingerprints -------------------------------------------------

// What an override was authored against, stamped when it is first written.
//
// Since Tier 0.1 a building id already encodes where the building is, so two
// different buildings cannot share one — the old failure, where an edit
// landed on somebody else's building, is structurally gone. This is the belt
// to that pair of braces, and it earns its place on the cases ids cannot
// cover: a scene saved before ids changed shape, a library or pattern that
// moves a road without renaming it, and hand-edited scene files.
// `w`, `d` and `angle` joined `x`/`z`/`road` for one reason: they are what
// `anchorMissingClaims` in layout.js needs to rebuild a plot from nothing
// when its road is gone and stay a footprint rather than a point. A scene
// saved before they existed has a fingerprint short of them, and the anchor
// pass skips those rather than guessing — the building goes back to being
// reported unplaced, exactly as it always was, instead of appearing with an
// invented size.
export const fingerprint = (site) => ({
  x: Math.round(site.x * 100) / 100,
  z: Math.round(site.z * 100) / 100,
  road: site.roadId || null,
  angle: Math.round(site.angle * 1000) / 1000,
  w: Math.round(site.w * 100) / 100,
  d: Math.round(site.d * 100) / 100,
});

// Tolerant of a shift, strict about a swap.
//
// Nudging setback or frontage moves every building in town by a little, and
// rejecting every edit in the scene over that would make the fingerprint far
// more destructive than the problem it guards against. A plot that has moved
// further than a cell and a half, though, is not the plot the edit was made
// on, whatever the id says.
export function overrideMoved(over, site, params) {
  const at = over?.at;
  if (!at) return false;
  if (at.road && site.roadId && at.road !== site.roadId) return true;
  // A plot on a street you are holding has a reference frame, and it is the
  // street. Dragging a road three blocks moves every plot on it three blocks,
  // and that is the whole point of dragging it — reading that as drift would
  // throw away every edit on the road the moment you touched it, which is the
  // exact failure this check exists to prevent. The road id still has to
  // match, so an edit still cannot cross to a different street.
  if (site.held) return false;
  return Math.hypot(site.x - at.x, site.z - at.z) > params.cell * 1.5;
}

// Which stored edits have nothing to land on. Reported rather than silently
// dropped, and pruned only when the author says so: an edit whose building
// vanished because a slider is mid-drag should still be there when the
// slider comes back.
export function reconcileOverrides(overrides, city) {
  // Plots, not buildings, are what an edit needs in order to mean something.
  // A building deleted by its own override is absent from the town and still
  // perfectly well placed: the plot is there and the edit is the reason
  // nothing stands on it. Anchoring on the built list instead would report
  // every deletion as a failure, every rebuild, forever.
  const plots = new Set(city.layout.sites.map((s) => s.id));
  const live = new Set();
  for (const b of city.buildings) for (const m of b.modules) live.add(m.id);

  const unplaced = [];
  for (const key of Object.keys(overrides)) {
    const isModule = key.includes('_m');
    const plot = isModule ? key.slice(0, key.lastIndexOf('_m')) : key;
    if (!plots.has(plot)) {
      unplaced.push(key);
      continue;
    }
    if (!isModule || live.has(key)) continue;
    // The module is gone from a plot that still exists. If this edit is what
    // removed it, it has done its job; otherwise the building lost floors
    // under it and there is nothing left for it to describe.
    if (!overrides[key]?.deleted) unplaced.push(key);
  }
  return { unplaced };
}

// --- lot -------------------------------------------------------------------

// `region` is the shape the town occupies — see region.js. Two things here
// need it: how far downtown a building is, which is a distance from the
// middle of town measured against its size, and which chunk a building meshes
// into, which is a grid laid from one corner of it.
export function generateLot(site, params, overrides, imageCount, cutoutCount, materialCount, groundAt, region, library = null) {
  const palette = getPalette(params.palette);
  const id = site.id;
  const bOver = overrides[id] || {};
  if (bOver.deleted) return null;

  // An override remembers the plot it was authored against. If the plot that
  // holds this id today is somewhere else entirely, the edit was meant for a
  // different building and applying it would be worse than dropping it — a
  // silently wrong town reads as the tool being unpredictable, where a
  // reported one reads as a thing that happened. See `overrideMoved`.
  if (overrideMoved(bOver, site, params))
    return generateLot(site, params, {}, imageCount, cutoutCount, materialCount, groundAt, region, library);

  const seed = (params.seed + (bOver.seedNudge || 0)) >>> 0;
  const brng = new Rng(hashId(seed, id));
  const moduleId = (i) => `${id}_m${i}`;

  // Building-level identity, rolled before anything the sliders can shift.
  const signature = pickWeighted(params.moduleMix, includedFor(params, 'body'), brng.float(), null, 'the shape mix');
  const family = familyOf(signature, library?.components?.get(signature));
  const scheme = buildingScheme(brng, palette);
  // One roll decides the building's whole surface — a texture, a reflective
  // shader, one half of the collage pool, or flat colour. A hand pick from
  // the inspector overrides the material outright, including picking null to
  // strip it back to whatever the roll gave the rest of the building.
  const surfaceRoll = brng.float();
  const matPickRoll = brng.float();
  const surfaceMode = pickWeighted(params.surfaceMix, SURFACE_KINDS, surfaceRoll, null, 'the surface mix');
  let material = null;
  if (surfaceMode === 'glass') material = { kind: 'glass' };
  else if (surfaceMode === 'mirror') material = { kind: 'mirror' };
  else if (surfaceMode === 'texture') {
    material =
      materialCount > 0 ? { kind: 'material', index: Math.floor(matPickRoll * materialCount) } : { kind: 'glass' };
  }
  if (bOver.material !== undefined) material = bOver.material;
  const collage = surfaceMode === 'image' || surfaceMode === 'cutout';
  // Images and cutouts each occupy a contiguous range of the pool, images
  // first — see ImagePool. A building committed to one never dips into the
  // other, so a photo-heavy town and a sticker-heavy one are dialled apart.
  const pickRange =
    surfaceMode === 'image'
      ? { start: 0, count: imageCount }
      : surfaceMode === 'cutout'
        ? { start: imageCount, count: cutoutCount }
        : { start: 0, count: 0 };
  const shapeRoll = brng.float();
  const sizeRollW = brng.float();
  const sizeRollD = brng.float();
  const roofRoll = brng.float();
  const roofSizeRoll = brng.float();
  const bendDir = brng.float();
  const bendRoll = brng.float();

  // Distance from the middle of town, and a lift for anything on a main road,
  // which is how real height clusters: downtown and along the arterials.
  const dist = clamp(
    Math.hypot(site.x - region.center.x, site.z - region.center.z) / Math.max(1, region.half),
    0,
    1
  );
  const pull = Math.pow(1 - dist, 1.6) * (site.main ? 1.15 : 0.85);
  const shape = clamp(mix(shapeRoll, clamp(pull, 0, 1), params.centerBias), 0, 1);
  const floors = Math.max(1, Math.round(mix(params.minFloors, params.maxFloors, shape)));

  let w = site.w * (1 + (sizeRollW * 2 - 1) * params.lotJitter * 0.4);
  let d = site.d * (1 + (sizeRollD * 2 - 1) * params.lotJitter * 0.4);

  // The library travels in the context so every trait question can be put to
  // the component itself rather than to a list of primitive names. Null before
  // it loads, which is the case the fallbacks in traits.js exist for.
  const ctx = { signature, family, scheme, collage, pickRange, isRoof: false, material, lib: library };
  let modules = [];
  for (let i = 0; i < floors; i++) {
    const t = tickets(new Rng(hashIdModule(seed, id, i)));
    if (i > 0 && t.setback < params.setbackChance) {
      const k = 1 - params.setbackAmount * mix(0.5, 1, t.setback / Math.max(1e-6, params.setbackChance));
      w *= k;
      d *= k;
    }
    const m = makeModule(t, params, palette, ctx, i, moduleId(i));
    // Thinner than a normal storey, but not so thin it reads as a squashed
    // mistake rather than a deliberate accent band.
    m.h = m.slab
      ? params.floorHeight * mix(0.32, 0.46, t.height)
      : params.floorHeight * (1 + (t.height * 2 - 1) * params.floorJitter);
    if (m.kind === 'spin') m.h *= 1.25;
    m.w = m.slab ? w * 1.12 : w;
    m.d = m.slab ? d * 1.12 : d;
    // A sphere is a sphere. Its box is cubed so it never squashes into an egg
    // to fit a storey, and so the selection outline matches what is drawn.
    if (m.kind === 'sphere') m.w = m.d = m.h = Math.min(m.w, m.d);
    modules.push(m);
  }

  // Whether this building gets a roof at all is decided against the same
  // include list the roof module will draw from, or a town with roofs
  // switched off would still reserve a storey for one.
  const roofKeys = includedFor(params, 'roof');
  const roofKind = pickWeighted(
    params.roofMix,
    roofKeys,
    roofRoll,
    roofAllowFor(roofKeys, family),
    'the roof mix'
  );
  if (roofKind !== 'flat') {
    const i = modules.length;
    const t = tickets(new Rng(hashIdModule(seed, id, i)));
    const m = makeModule(t, params, palette, { ...ctx, isRoof: true }, i, moduleId(i));
    m.h = params.floorHeight * mix(0.5, 1.15, roofSizeRoll);
    m.w = w * mix(1.0, 1.12, roofSizeRoll);
    m.d = d * mix(1.0, 1.12, roofSizeRoll);
    m.rotY = roofSizeRoll < 0.5 ? 0 : Math.PI / 2;
    modules.push(m);

    // A roof that comes to a point can carry a spire.
    if (isPointedRoof(m.kind, library?.components?.get(m.kind)) && t.spire < params.spireChance) {
      const j = modules.length;
      const st = tickets(new Rng(hashIdModule(seed, id, j)));
      const spire = makeModule(st, params, palette, { ...ctx, isRoof: true }, j, moduleId(j));
      spire.kind = 'flag';
      spire.h = params.floorHeight * mix(0.7, 1.3, st.height);
      spire.w = Math.min(w, d) * 0.6;
      spire.d = spire.w;
      spire.rotY = st.rot * Math.PI * 2;
      spire.spinSpeed = 0;
      // Repaint for the flag's own two slots.
      const cols = paintSlots('flag', 2, spire.pattern, spire.scheme[0], spire.scheme[1], library?.components?.get('flag'));
      spire.faces.forEach((f, k) => {
        f.image = null;
        f.color = cols[Math.min(k, 1)];
      });
      modules.push(spire);
    }
  }

  // Building-level floor edits, then per-module overrides.
  const delta = bOver.floorsDelta || 0;
  if (delta) modules = adjustFloors(modules, delta, params, palette, ctx, seed, id);

  modules.forEach((m, i) => {
    m.id = moduleId(i);
    m.index = i;
  });
  modules = modules.map((m) => applyOverride(m, overrides[m.id], library)).filter((m) => !m.deleted);
  if (!modules.length) return null;
  modules.forEach((m, i) => {
    m.index = i;
    // Convenience for the editor. The shader makes the same comparison.
    m.glow = m.glowTicket < params.glowChance;
  });

  const scale = bOver.footprintScale || 1;
  if (scale !== 1) {
    modules.forEach((m) => {
      m.w *= scale;
      m.d *= scale;
    });
  }

  // The last word on size belongs to the component, not the town. Everything
  // above proposed w/h/d from lot size, floor height and setbacks; this is
  // where a component that pinned one of them overrules that, and where a
  // component that ranged one clamps it. Run after every proposal is in and
  // before restack, so the stack is built from sizes that will actually be
  // drawn rather than ones the components are about to reject.
  applyComponents(modules, params, library, seed, id);

  const x = site.x + (bOver.offsetX || 0);
  const z = site.z + (bOver.offsetZ || 0);
  const height = restack(modules);
  bendStack(
    modules,
    height,
    params.bend * (0.25 + bendRoll * 1.5) * (bOver.bendScale ?? 1),
    bendDir * Math.PI * 2
  );
  // Cell coordinates exist only so the renderer can group buildings into
  // chunks. Nothing about the layout depends on them any more.
  //
  // Anchored to the square cols/rows/cell imply, not to `region.bounds`. It
  // was the region's own corner briefly, on the reasoning that a town sited
  // far from the origin should not need a hundred empty chunk numbers to
  // reach it — true, but `region.bounds` moves with every boundary edit,
  // which meant nudging one corner reflowed the *entire* chunk grid a cell
  // or two, one frame after the same edit already gave every touched road a
  // fresh id. Buildings nowhere near the edit do not need a second reason to
  // rebuild. The default square only moves when cols, rows or cell actually
  // does, which is the one case a full reflow is genuinely warranted.
  const originX = -defaultHalf(params);
  const originZ = originX;
  const gx = Math.floor((x - originX) / params.cell);
  const gz = Math.floor((z - originZ) / params.cell);

  // Sit on the lowest corner of the footprint so nothing floats on a slope.
  let y = 0;
  if (groundAt) {
    const hw = w / 2;
    const hd = d / 2;
    y = Math.min(
      groundAt(x - hw, z - hd),
      groundAt(x + hw, z - hd),
      groundAt(x + hw, z + hd),
      groundAt(x - hw, z + hd)
    );
  }

  return {
    id,
    gx,
    gz,
    x,
    y,
    z,
    // Where the plot is, before any hand offset. What an edit fingerprints
    // itself against, so the stamp does not drift every time the building is
    // nudged.
    site: fingerprint(site),
    // The site angle turns the building to face its street. A hand rotation
    // adds on top of that rather than replacing it.
    rotY: site.angle + (bOver.rotY || 0),
    height,
    main: site.main,
    signature,
    family,
    scheme,
    collage,
    material,
    modules,
  };
}

function adjustFloors(modules, delta, params, palette, ctx, seed, buildingId) {
  const top = modules[modules.length - 1];
  const hasRoof = isRoofKind(top.kind, ctx.lib?.components?.get(top.kind));
  const body = hasRoof ? modules.slice(0, -1) : modules;
  if (delta < 0) {
    const keep = Math.max(1, body.length + delta);
    return hasRoof ? [...body.slice(0, keep), top] : body.slice(0, keep);
  }
  const added = [];
  for (let i = 0; i < delta; i++) {
    const idx = body.length + i;
    const t = tickets(new Rng(hashIdModule(seed, buildingId, idx + 500)));
    const src = body[body.length - 1] || modules[0];
    const m = makeModule(t, params, palette, ctx, idx, moduleIdFor(buildingId, idx));
    m.h = src.h;
    m.w = src.w;
    m.d = src.d;
    added.push(m);
  }
  return hasRoof ? [...body, ...added, top] : [...body, ...added];
}

// Stack bottom-up, so a module made taller by hand pushes what is above it up.
export function restack(modules) {
  let y = 0;
  for (const m of modules) {
    m.y = y + m.h / 2;
    y += m.h;
  }
  return y;
}

// Lean a whole stack along one direction, more the higher it goes. The offset
// grows with the square of the height so the base stays planted and the top
// swings, and each module tilts by the slope of that curve so the building
// bends rather than shears into a staircase.
export function bendStack(modules, height, amount, direction) {
  const dirX = Math.cos(direction);
  const dirZ = Math.sin(direction);
  const reach = amount * height * 0.42;
  for (const m of modules) {
    const t = height > 0 ? m.y / height : 0;
    const lean = reach * t * t;
    m.bendX = dirX * lean;
    m.bendZ = dirZ * lean;
    // Slope of that curve at this height, which is how far to tilt.
    const slope = height > 0 ? (2 * reach * t) / height : 0;
    m.tiltX = slope * dirZ;
    m.tiltZ = -slope * dirX;
  }
}

function applyOverride(module, override, lib) {
  if (!override) return module;
  const { faces, ...rest } = override;
  // Read after the shape change lands, not before: a hand edit that turns a
  // cube into a sphere has to be judged as a sphere.
  const docAfter = () => lib?.components?.get(module.kind) || null;
  // Changing the shape, the pattern or the pair of colours re-lays the colour
  // across the slots. Explicit per-face edits are applied after, so they win.
  const repaint =
    rest.pattern !== undefined || rest.scheme !== undefined || rest.kind !== undefined;
  Object.assign(module, rest);
  // Switching a module to a sphere by hand has to cube its box too.
  if (rest.kind === 'sphere') module.w = module.d = module.h = Math.min(module.w, module.d);
  // A hand shape change can move a module off of material-eligible ground —
  // pillars and roofs never wear a material regardless of what they wore a
  // moment ago.
  if (rest.kind !== undefined && !takesMaterial(module.kind, docAfter())) {
    module.matKind = null;
    module.matIndex = null;
  }
  if (repaint) {
    const doc = docAfter();
    const n = slotCount(module.kind, module.blades);
    const [a, b] = module.scheme;
    const colours = paintSlots(module.kind, n, module.pattern, a, b, doc);
    const allowed = takesImages(module.kind, doc);
    const blockedSlots = new Set(flatSlotsOf(module.kind, doc));
    module.faces.forEach((f, i) => {
      f.image = allowed && !blockedSlots.has(i) ? f.imageRaw ?? null : null;
      if (f.image == null) f.color = colours[Math.min(i, n - 1)] || a;
      else f.color = '#ffffff';
    });
  }
  if (faces) {
    faces.forEach((f, i) => {
      if (f) module.faces[i] = { ...module.faces[i], ...f };
    });
  }
  return module;
}

export function generateCity(
  params,
  overrides = {},
  imageCount = 0,
  cutoutCount = 0,
  materialCount = 0,
  groundAt = null,
  library = null
) {
  // Which plots carry a hand edit, so the layout can offer them their ground
  // before it offers it to anything procedural. Module edits name their plot
  // in their own id, so both kinds fold down to the same set.
  const claims = new Set();
  // Every override's fingerprint, by plot id. A module-level override (a
  // single floor's height, most edits) never itself carries a key the
  // building's own plot id would match, so this has to walk every override
  // and derive the plot each belongs to, the same as `claims` does — a plot
  // id computed once and then thrown away would have missed most edits.
  const fingerprints = new Map();
  for (const [key, over] of Object.entries(overrides)) {
    const cut = key.lastIndexOf('_m');
    const plotId = cut > 0 ? key.slice(0, cut) : key;
    claims.add(plotId);
    if (over?.at && !fingerprints.has(plotId)) fingerprints.set(plotId, over.at);
  }
  // A merged lot is authored too, and it has more to lose than an edit does:
  // if the plot it is anchored to fails to place, the whole span goes with it.
  for (const id of Object.keys(params.lotSpans || {})) claims.add(id);

  // Which claimed plots can be rebuilt outright if the road they were on
  // stops proposing them at all — see `anchorMissingClaims` in layout.js.
  // Skips a plot whose own building-level override says it was deleted:
  // resurrecting a plot just to immediately hide it again is wasted work for
  // no visible difference from leaving it alone.
  const anchors = new Map();
  for (const [plotId, at] of fingerprints) {
    if (overrides[plotId]?.deleted) continue;
    anchors.set(plotId, at);
  }

  // The ground goes in now, not just to `generateLot` afterwards. Two things
  // in the layout need it: a plot has to know whether it is standing on a
  // cliff, and a road has to know whether it can follow the terrain or has to
  // bridge it. Both were decisions the layout was making blind.
  const layout = buildLayout(params, undefined, claims, anchors, groundAt);
  const buildings = [];
  for (const site of layout.sites) {
    const b = generateLot(
      site,
      params,
      overrides,
      imageCount,
      cutoutCount,
      materialCount,
      groundAt,
      layout.region,
      library
    );
    if (b) buildings.push(b);
  }
  return {
    params: { ...params },
    palette: getPalette(params.palette),
    layout,
    buildings,
  };
}
