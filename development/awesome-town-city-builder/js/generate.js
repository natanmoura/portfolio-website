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
import { MAX_SLOTS, slotCount, flatSlots } from './geometry.js';

export const BODY_KINDS = ['box', 'octagon', 'cylinder', 'pillars', 'pillars8', 'post', 'sphere', 'spin'];
export const ROOF_KINDS = ['flat', 'pyramid', 'gable', 'cone', 'dome'];
export const MODULE_KINDS = [...BODY_KINDS, 'pyramid', 'gable', 'cone', 'dome', 'flag'];

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

// Roofs that come to a point can carry a spire.
export const POINTED_ROOFS = new Set(['pyramid', 'cone']);

// What a building's material — concrete, brick, wood, or the reflective glass
// shader — is allowed to cover. Never a roof, but pillars are fair game even
// though they never take a picture: a column being made of stone or wood
// reads fine, a photo wrapped round one inch of it does not.
export const MATERIAL_KINDS = new Set(['box', 'octagon', 'cylinder', 'sphere', 'pillars', 'pillars8', 'post']);

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

export const ROOFS_BY_FAMILY = {
  boxy: ['flat', 'pyramid', 'gable'],
  round: ['flat', 'cone', 'dome'],
};

export const ROOF_SET = new Set(['pyramid', 'gable', 'cone', 'dome']);

export const DEFAULTS = {
  seed: 8114,
  cols: 10,
  rows: 10,
  cell: 6.4,
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
  // Terrain
  terrainHeight: 0,
  terrainScale: 0.6,
  terrainDetail: 3,
  // How much of each module kind exists across the town.
  moduleMix: { box: 44, octagon: 13, cylinder: 11, pillars: 7, pillars8: 5, post: 5, sphere: 4, spin: 16 },
  roofMix: { flat: 28, pyramid: 18, gable: 20, cone: 16, dome: 18 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

// Ids come from the layout now: `b{road}_{slot}` for a building and
// `b{road}_{slot}_m{i}` for a module. They stay stable as long as the street
// parameters do, which is what keeps hand edits attached to their building.
export function moduleIdFor(buildingId, i) {
  return `${buildingId}_m${i}`;
}

// --- weighted picks --------------------------------------------------------

function pickWeighted(weights, keys, ticket, allow) {
  let total = 0;
  for (const k of keys) {
    if (allow && !allow.has(k)) continue;
    total += Math.max(0, weights[k] || 0);
  }
  if (total <= 0) return allow ? [...allow][0] || keys[0] : keys[0];
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
function capSlots(kind, n) {
  // Only a real hidden base counts as a cap, and pyramid/gable/cone already
  // carry theirs in FLAT_SLOTS. A dome has no such slot — its panels are all
  // visible sides of one hemisphere — so there is nothing here for it to
  // fall back to without picking an arbitrary panel and painting it alone,
  // which is exactly the stray single-colour patch this used to produce.
  const flat = flatSlots(kind);
  return flat.length ? new Set(flat) : new Set();
}

// A colonnade is one object. Striping the columns different colours reads as a
// mistake, so they always share a colour and only the deck takes the second.
const COLONNADES = { pillars: 4, pillars8: 8 };

function paintSlots(kind, n, pattern, a, b) {
  const columns = COLONNADES[kind];
  if (columns) {
    const deck = pattern === 'solid' ? a : b;
    return Array.from({ length: n }, (_, i) => (i < columns ? a : deck));
  }
  const caps = capSlots(kind, n);
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
const NO_IMAGES = new Set(['flag', 'pillars', 'pillars8', 'post', 'sphere']);

function imagesAllowed(kind) {
  return !ROOF_SET.has(kind) && !NO_IMAGES.has(kind);
}

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

function makeModule(t, params, palette, ctx, index, id) {
  const { signature, family, scheme, collage, pickRange, isRoof, material } = ctx;

  let kind;
  if (isRoof) {
    const allow = new Set(ROOFS_BY_FAMILY[family] || ROOFS_BY_FAMILY.boxy);
    kind = pickWeighted(params.roofMix, ROOF_KINDS, t.roofKind, allow);
    if (kind === 'flat') kind = 'box';
  } else if (t.kindRoll < params.cohesion) {
    kind = signature;
  } else if (t.kindRoll < params.cohesion + (1 - params.cohesion) * 0.7) {
    const siblings = new Set(BODY_KINDS.filter((k) => FAMILY[k] === family));
    kind = pickWeighted(params.moduleMix, BODY_KINDS, t.familyPick, siblings);
  } else {
    kind = pickWeighted(params.moduleMix, BODY_KINDS, t.kindPick);
  }

  const slabbed = !isRoof && index > 0 && t.slab < params.slabChance && kind !== 'spin';
  const n = slotCount(kind, 1 + Math.floor(t.blades * 3));
  const pattern = PATTERNS[Math.floor(t.pattern * PATTERNS.length)];
  const a = scheme[Math.floor(t.colourA * 3)];
  const bChoices = scheme.filter((c) => c !== a);
  const b = bChoices[Math.floor(t.colourB * bChoices.length)] || a;
  const colours = paintSlots(kind, n, pattern, a, b);

  // Which images a module would carry is rolled regardless of its shape, and
  // then filtered by what the shape allows. Keeping the roll means switching a
  // sloped roof to a cube reveals its collage rather than losing it for good.
  // The index lands within whichever half of the pool this building committed
  // to — image or cutout, never both — via pickRange.start/count.
  const wrapOne = t.wrap < params.sameImageChance;
  const sharedImage = pickRange.count ? pickRange.start + Math.floor(t.images[0] * pickRange.count) : null;
  const allowed = imagesAllowed(kind);
  const blocked = new Set(flatSlots(kind));

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
  const usesMaterial = !isRoof && material && MATERIAL_KINDS.has(kind);

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
    blades: 1 + Math.floor(t.blades * 3),
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

// --- lot -------------------------------------------------------------------

export function generateLot(site, params, overrides, imageCount, cutoutCount, materialCount, groundAt, half) {
  const palette = getPalette(params.palette);
  const id = site.id;
  const bOver = overrides[id] || {};
  if (bOver.deleted) return null;

  const seed = (params.seed + (bOver.seedNudge || 0)) >>> 0;
  const brng = new Rng(hashId(seed, id));
  const moduleId = (i) => `${id}_m${i}`;

  // Building-level identity, rolled before anything the sliders can shift.
  const signature = pickWeighted(params.moduleMix, BODY_KINDS, brng.float());
  const family = FAMILY[signature] || 'boxy';
  const scheme = buildingScheme(brng, palette);
  // One roll decides the building's whole surface — a texture, a reflective
  // shader, one half of the collage pool, or flat colour. A hand pick from
  // the inspector overrides the material outright, including picking null to
  // strip it back to whatever the roll gave the rest of the building.
  const surfaceRoll = brng.float();
  const matPickRoll = brng.float();
  const surfaceMode = pickWeighted(params.surfaceMix, SURFACE_KINDS, surfaceRoll);
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
  const dist = clamp(Math.hypot(site.x, site.z) / Math.max(1, half), 0, 1);
  const pull = Math.pow(1 - dist, 1.6) * (site.main ? 1.15 : 0.85);
  const shape = clamp(mix(shapeRoll, clamp(pull, 0, 1), params.centerBias), 0, 1);
  const floors = Math.max(1, Math.round(mix(params.minFloors, params.maxFloors, shape)));

  let w = site.w * (1 + (sizeRollW * 2 - 1) * params.lotJitter * 0.4);
  let d = site.d * (1 + (sizeRollD * 2 - 1) * params.lotJitter * 0.4);

  const ctx = { signature, family, scheme, collage, pickRange, isRoof: false, material };
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

  const roofKind = pickWeighted(
    params.roofMix,
    ROOF_KINDS,
    roofRoll,
    new Set(ROOFS_BY_FAMILY[family] || ROOFS_BY_FAMILY.boxy)
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
    if (POINTED_ROOFS.has(m.kind) && t.spire < params.spireChance) {
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
      const cols = paintSlots('flag', 2, spire.pattern, spire.scheme[0], spire.scheme[1]);
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
  modules = modules.map((m) => applyOverride(m, overrides[m.id])).filter((m) => !m.deleted);
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
  const gx = Math.floor((x + half) / params.cell);
  const gz = Math.floor((z + half) / params.cell);

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
  const hasRoof = ROOF_SET.has(top.kind);
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

function applyOverride(module, override) {
  if (!override) return module;
  const { faces, ...rest } = override;
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
  if (rest.kind !== undefined && !MATERIAL_KINDS.has(module.kind)) {
    module.matKind = null;
    module.matIndex = null;
  }
  if (repaint) {
    const n = slotCount(module.kind, module.blades);
    const [a, b] = module.scheme;
    const colours = paintSlots(module.kind, n, module.pattern, a, b);
    const allowed = imagesAllowed(module.kind);
    const blockedSlots = new Set(flatSlots(module.kind));
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
  groundAt = null
) {
  const layout = buildLayout(params);
  const buildings = [];
  for (const site of layout.sites) {
    const b = generateLot(site, params, overrides, imageCount, cutoutCount, materialCount, groundAt, layout.half);
    if (b) buildings.push(b);
  }
  return {
    params: { ...params },
    palette: getPalette(params.palette),
    layout,
    buildings,
  };
}
