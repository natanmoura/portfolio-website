// Street layout.
//
// Roads come first, buildings follow. Every pattern here produces the same
// thing: a list of polylines, some marked as main. Buildings are then placed
// along both kerbs facing the road, which is what makes blocks read as blocks
// and gives triangular corners wherever two roads cross at an angle.
//
// Patterns are simplified versions of real ones. What matters is the family
// of shapes each produces, not that it survives a planner's inspection.
//
// Every pattern is given the region the town occupies rather than the number
// that used to stand for it. A pattern asks the region where its edges are,
// clips its lines against it, and never learns whether it is filling a
// square, a peninsula or something drawn by hand. See region.js.

import { Rng, hashString, hashCoords } from './rng.js';
import { SpatialGrid } from './grid.js';
import { regionFor } from './region.js';
import { flatten } from './curve.js';

export const ROAD_PATTERNS = ['grid', 'boulevard', 'radial', 'organic'];

// Not in `ROAD_PATTERNS`, deliberately: that list is also what the dice pick
// a random pattern from, and "randomise everything" landing on a roadless,
// buildingless town one time in five would be a bad surprise rather than a
// fun one. `NONE_PATTERN` is a fifth, separate value the dropdown offers on
// its own, for a town where every road is one you drew — see the case for it
// in `buildLayout`.
export const NONE_PATTERN = 'none';

export const PATTERN_LABEL = {
  grid: 'Grid',
  boulevard: 'Boulevards',
  radial: 'Radial',
  organic: 'Old town',
  [NONE_PATTERN]: 'None',
};

const TAU = Math.PI * 2;

// A road's identity comes from where it is, not from when it was made.
//
// It used to be the array index, and the array index was also half of every
// building id. So adding one ring to a radial pattern, or changing a
// parameter that made `clipLine` reject a line it used to accept, renumbered
// every road after it and therefore every building in town — and the
// overrides keyed to those buildings did not become orphaned, they landed on
// different buildings. Position is the only thing about a road that a user
// would call the same road tomorrow, so position is what the id is made of.
//
// Quantised to a tenth of a metre, which is far finer than any road moves
// without being a different road, and coarse enough that float noise between
// two runs of the same pattern cannot shift it.
function roadId(pts) {
  const q = (n) => Math.round(n * 10);
  let key = `${pts.length}`;
  for (const [x, z] of pts) key += `|${q(x)},${q(z)}`;
  return `r${hashString(key).toString(36)}`;
}

// One clipped line can come back as several roads. A straight line crossing a
// square enters once and leaves once, but the same line across a crescent, a
// valley floor or anything drawn by hand is inside, outside and inside again
// — and a road that jumps its own gap is not a road. So the region hands back
// every span that is genuinely in town and each becomes a road in its own
// right, with its own id, its own kerbs and its own buildings.
function pushLines(roads, spans, main, width) {
  for (const pts of spans || []) pushLine(roads, pts, main, width);
}

function pushLine(roads, pts, main, width) {
  if (!pts || pts.length < 2) return;
  const id = roadId(pts);
  // Two roads landing on the same quantised polyline would share an id and
  // therefore share building ids. It takes a degenerate pattern to manage it,
  // but a duplicate id is the one failure this whole change exists to
  // prevent, so it is worth the four lines to make it impossible.
  let unique = id;
  for (let n = 2; roads.some((r) => r.id === unique); n++) unique = `${id}.${n}`;
  roads.push({ id: unique, pts, main, width });
}

// --- patterns --------------------------------------------------------------

// Manhattan. Two families of parallel lines. Skew lets each line wander off
// its family angle, which turns clean rectangles into wedges.
function gridPattern(roads, rng, p, region) {
  const base = rng.range(0, Math.PI / 2);
  const skew = p.roadSkew * 0.55;
  const half = region.half;
  const { x: cx, z: cz } = region.center;
  for (const family of [0, 1]) {
    const angle = base + family * (Math.PI / 2);
    const step = p.cell * (family ? p.blockDepth : p.blockWidth);
    const count = Math.ceil((half * 2.4) / step);
    for (let i = -count; i <= count; i++) {
      const offset = i * step + rng.range(-step * 0.12, step * 0.12);
      const a = angle + rng.range(-skew, skew);
      const nx = cx + Math.cos(angle + Math.PI / 2) * offset;
      const nz = cz + Math.sin(angle + Math.PI / 2) * offset;
      const main = i % 3 === 0;
      pushLines(roads, region.clip(nx, nz, a), main, main ? p.highwayWidth : p.streetWidth);
    }
  }
}

// A grid with long diagonals driven through it. The diagonals are what carve
// the triangular blocks you get in Paris or Washington.
function boulevardPattern(roads, rng, p, region) {
  gridPattern(roads, rng, p, region);
  const half = region.half;
  const { x: cx, z: cz } = region.center;
  const count = 2 + Math.round(p.roadSkew * 5);
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI);
    const offset = rng.range(-half * 0.75, half * 0.75);
    const nx = cx + Math.cos(angle + Math.PI / 2) * offset;
    const nz = cz + Math.sin(angle + Math.PI / 2) * offset;
    pushLines(roads, region.clip(nx, nz, angle), true, p.highwayWidth * 1.15);
  }
}

// Spokes from one or two centres, plus rings around them. Skew scatters the
// spoke angles so the wedges between them stop being identical.
function radialPattern(roads, rng, p, region) {
  const half = region.half;
  const centres = [];
  const many = p.roadSkew > 0.55 ? 2 : 1;
  for (let i = 0; i < many; i++) {
    centres.push(
      many === 1
        ? [
            region.center.x + rng.range(-half * 0.2, half * 0.2),
            region.center.z + rng.range(-half * 0.2, half * 0.2),
          ]
        : [
            region.center.x + rng.range(-half * 0.6, half * 0.6),
            region.center.z + rng.range(-half * 0.6, half * 0.6),
          ]
    );
  }

  for (const [cx, cz] of centres) {
    const spokes = 5 + Math.round(rng.float() * 4);
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI + rng.range(-0.28, 0.28) * p.roadSkew;
      pushLines(roads, region.clip(cx, cz, angle), true, p.highwayWidth);
    }
    const rings = 2 + Math.round(rng.float() * 2);
    for (let r = 1; r <= rings; r++) {
      const radius = (half * 0.9 * r) / (rings + 0.4);
      const sides = 12 + Math.round(rng.float() * 8);
      const spin = rng.range(0, TAU);
      const pts = [];
      for (let s = 0; s <= sides; s++) {
        const a = spin + (s / sides) * TAU;
        const wobble = 1 + rng.range(-0.05, 0.05) * p.roadSkew;
        pts.push([cx + Math.cos(a) * radius * wobble, cz + Math.sin(a) * radius * wobble]);
      }
      // A ring is drawn around its centre with no idea where the town ends,
      // so the parts of it that fall outside are cut away rather than pushed
      // whole. On a square that never happens — the rings are sized to fit
      // — and on a drawn boundary it is the difference between a ring road
      // and a ring road hanging over the sea.
      pushLines(
        roads,
        region.clipPolyline(pts),
        r === rings,
        r === rings ? p.highwayWidth : p.streetWidth
      );
    }
  }
  // A little grid outside the rings so the edges are not empty.
  const keep = roads.length;
  gridPattern(roads, rng, { ...p, blockWidth: p.blockWidth * 1.8, blockDepth: p.blockDepth * 1.8 }, region);
  for (let i = keep; i < roads.length; i++) roads[i].main = false;
}

// Medieval. Lines that wander instead of running straight, so nothing lines up
// and the blocks come out as irregular scraps.
function organicPattern(roads, rng, p, region) {
  const { minX, minZ, maxX, maxZ } = region.bounds;
  const count = Math.max(4, Math.round(((region.half * 2) / (p.cell * p.blockWidth)) * 1.6));
  for (let i = 0; i < count; i++) {
    const edge = Math.floor(rng.float() * 4);
    let x = edge === 0 ? minX : edge === 1 ? maxX : rng.range(minX, maxX);
    let z = edge === 2 ? minZ : edge === 3 ? maxZ : rng.range(minZ, maxZ);
    // Aimed at the middle of town and then allowed to wander off it. On a
    // shape that is not centred on the origin, the middle is the region's,
    // not the world's — otherwise every lane in a town sited off to one side
    // would set out for a point outside it.
    let angle = Math.atan2(region.center.z - z, region.center.x - x) + rng.range(-0.6, 0.6);
    const pts = [[x, z]];
    const step = p.cell * 0.9;
    const wander = 0.12 + p.roadSkew * 0.35;
    for (let s = 0; s < 90; s++) {
      angle += rng.range(-wander, wander);
      x += Math.cos(angle) * step;
      z += Math.sin(angle) * step;
      // Walking stops at the bounding box; what falls outside the shape
      // inside that box is cut below. Both are needed: the box is what ends
      // the walk, the shape is what keeps the road.
      if (x < minX || x > maxX || z < minZ || z > maxZ) break;
      pts.push([x, z]);
    }
    const main = i % 4 === 0;
    for (const run of region.clipPolyline(pts)) {
      if (run.length > 3) pushLine(roads, run, main, main ? p.highwayWidth : p.streetWidth);
    }
  }
}

// --- placement -------------------------------------------------------------

// Both of the things this file needs to know about proximity are now one
// structure, in grid.js, because terrain, curves, volumes and scatter all want
// the same one and four private copies is the default outcome otherwise.
//
// Circles are a good enough stand-in for footprints, and they let a whole town
// be packed without a real collision pass. Roads go in as capsules, so a
// candidate plot only tests the tarmac near it — without that a building
// placed against one street happily lands in the middle of the street
// crossing it.
const roadGrid = (roads, cell) => {
  const grid = new SpatialGrid(cell);
  for (const road of roads) {
    for (let i = 0; i < road.pts.length - 1; i++) {
      grid.addCapsule(road.pts[i], road.pts[i + 1], road.width / 2, road.id);
    }
  }
  return grid;
};

// Walk both kerbs of every road, dropping buildings that face it.
//
// Every candidate plot draws from its own stream, keyed by the road it is on
// and how far along that road it sits — never from a running one. That is the
// same discipline `tickets()` already applies to modules in generate.js, and
// it is here for the same reason: a shared stream means a plot rejected for
// density shifts the jitter and the footprint of every plot after it, so
// nudging one slider moves buildings that had nothing to do with it.
//
// The tickets are drawn as a fixed block, always four, always in this order,
// whether or not the plot survives. Turning density down now removes plots
// and leaves the survivors exactly where they were.
function siteTickets(seed, roadId, slot) {
  const rng = new Rng(hashCoords(hashString(`${roadId}|${slot}`), seed, 0x2545f491));
  return { keep: rng.float(), jitter: rng.float(), w: rng.float(), d: rng.float() };
}

// `claims` is the set of plot ids that carry a hand edit, and it buys them one
// thing: they are offered the ground before anything else is.
//
// Without it, a plot is placed in whatever order the walk reaches it and the
// first to claim a piece of ground keeps it — fine while everything is
// procedural, wrong the moment some of it is not. **Turning "Lot fill" up is
// the case this exists for.** Footprints grow, neighbours start overlapping,
// and whichever plot the walk happened to reach first survives — so a
// building somebody spent an hour on is evicted by one nobody has ever
// looked at. Measured over one town: of 592 edited plots put through a range
// of lot-fill, frontage and depth settings, 96 survive with this and not
// without, and none go the other way.
//
// It is a no-op on a town nothing has moved in, and that is provable rather
// than hopeful: a plot carrying an edit is by definition a plot that was
// placed, so it does not overlap any survivor that preceded it, so offering
// it the ground earlier takes nothing from anybody.
//
// **What it deliberately does not fix**, because it cannot and should not:
// a plot that has ended up inside another street. That is the kerb test, not
// a contest between plots, and no amount of priority makes a building in the
// middle of a road a good outcome. It is the usual reason a held road that
// moves loses a plot, the edit is reported rather than dropped, and the
// building comes back when the road moves clear again.
function placeSites(roads, params, region, claims = null, anchors = null) {
  const sites = [];
  const seed = params.seed >>> 0;
  const frontage = params.cell * params.lotFill;
  const depth = frontage * params.blockDepthRatio;
  const packing = new SpatialGrid(Math.max(frontage, depth) * 1.2);
  const kerbs = roadGrid(roads, Math.max(frontage, depth) * 2 + params.highwayWidth);
  // Two passes only when there is something to prioritise. A town with no
  // edits does one walk and comes out exactly as it always did, which is what
  // keeps the digest honest.
  const passes = claims && claims.size ? [true, false] : [false];
  const taken = new Set();

  for (const claimed of passes) {
  roads.forEach((road, ri) => {
    for (let s = 0; s < road.pts.length - 1; s++) {
      const [ax, az] = road.pts[s];
      const [bx, bz] = road.pts[s + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const ux = dx / len;
      const uz = dz / len;
      const angle = Math.atan2(uz, ux);
      const step = frontage * params.frontageSpacing;
      const offset = road.width / 2 + params.setback + depth / 2;

      let k = 0;
      for (let t = step * 0.5; t < len; t += step, k++) {
        for (const side of [-1, 1]) {
          // The slot is where this plot sits on this road, and it does not
          // move when a neighbour comes or goes. Segment, step and kerb are
          // all the identity a plot needs, and all of it is stable.
          const slot = `${s}.${k}${side < 0 ? 'l' : 'r'}`;
          const plotId = `${road.id}_${slot}`;
          // On the first pass, only plots carrying an edit. On the second,
          // everything the first pass did not already stand up.
          if (claimed && !claims.has(plotId)) continue;
          if (!claimed && taken.has(plotId)) continue;
          const t4 = siteTickets(seed, road.id, slot);
          if (t4.keep >= params.density) continue;
          const jitter = (t4.jitter * 2 - 1) * step * 0.12;
          const px = ax + ux * (t + jitter) - uz * side * offset;
          const pz = az + uz * (t + jitter) + ux * side * offset;
          // A plot sits beside its road, so a road running along the edge of
          // town puts half its plots outside it. The region is what says so.
          if (!region.contains(px, pz)) continue;
          const w = frontage * (1 + (t4.w * 2 - 1) * params.lotJitter);
          const d = depth * (1 + (t4.d * 2 - 1) * params.lotJitter);
          const radius = Math.max(w, d) * 0.44;
          if (packing.overlaps(px, pz, radius)) continue;
          // Its own street already has clearance built into the offset. Every
          // other road has to be cleared by the footprint's own reach.
          if (kerbs.overlaps(px, pz, Math.max(w, d) * 0.42, (id) => id === road.id)) continue;
          packing.addDisc(px, pz, radius);
          taken.add(plotId);
          sites.push({
            id: plotId,
            x: px,
            z: pz,
            // A Y rotation of theta sends local +X to (cos, -sin), so negating
            // the road angle lines a building's frontage up with the kerb and
            // leaves it presenting a face to the street.
            angle: -angle,
            w,
            d,
            main: road.main,
            roadIndex: ri,
            roadId: road.id,
            // Whether the street this plot fronts is one you are holding. An
            // edit on it is anchored to the road rather than to the world, so
            // the plot moving is expected and must not be read as drift.
            held: Boolean(road.held),
          });
        }
      }
    }
  });
  }
  // Claimed plots were placed first and are therefore first in the list.
  // Sorting them back into the order the walk would have produced keeps the
  // list meaning "every plot, road by road" for everything downstream that
  // reads it as such.
  if (passes.length > 1) sites.sort((a, b) => a.roadIndex - b.roadIndex);
  return anchors && anchors.size ? anchorMissingClaims(sites, anchors) : sites;
}

// A hand edit surviving the road it was made on going away entirely.
//
// Every plot above comes from walking a road that exists right now. An
// edited plot whose road was reclipped into a new id, or whose road a
// pattern stopped proposing, simply never turns up in that walk — and until
// this, that meant the edit sat in `overrides` unreachable, reported as
// "nowhere to go" and never drawn, however carefully it was made. Holding a
// road already solved this for the road itself; this is the same idea one
// level down; an edited *building* becomes, in effect, a held road of one.
//
// `anchors` is a plotId -> fingerprint map, built once in generate.js from
// every override's `at` — the same fingerprint `overrideMoved` already uses
// to tell a nudge from a swap, extended (see `fingerprint`) to carry enough
// of the footprint to rebuild the plot outright rather than only recognise
// it. Anything still missing after the normal walk gets reconstructed from
// exactly that: the plot as it last existed, no road required.
//
// An anchor wins its ground the way a held road's plots already do — by
// evicting whatever procedural site is standing on it — because the
// alternative is an edit that came back only to be immediately rejected for
// colliding with the thing that replaced it.
function anchorMissingClaims(sites, anchors) {
  const present = new Set(sites.map((s) => s.id));
  const missing = [...anchors].filter(([id]) => !present.has(id));
  if (!missing.length) return sites;

  const out = sites.slice();
  for (const [id, at] of missing) {
    // An old scene's fingerprint predates `w`/`d`/`angle` and has nothing to
    // rebuild a footprint from. Left exactly as before: reported unplaced,
    // not resurrected with an invented size.
    if (!(at.w > 0) || !(at.d > 0)) continue;
    const radius = Math.max(at.w, at.d) * 0.44;
    for (let i = out.length - 1; i >= 0; i--) {
      const s = out[i];
      // A held road's own plots are equally authored, and evicting one to
      // make room for a different authored thing would just move the loss
      // rather than prevent it.
      if (s.held) continue;
      if (Math.hypot(s.x - at.x, s.z - at.z) < radius + Math.max(s.w, s.d) * 0.44) out.splice(i, 1);
    }
    out.push({
      id,
      x: at.x,
      z: at.z,
      angle: at.angle ?? 0,
      w: at.w,
      d: at.d,
      main: false,
      roadIndex: -1,
      // No current road, on purpose: `at.road` names the street this was
      // edited on, and that street may not exist under that id any more,
      // which is the entire reason this site exists at all. Leaving it null
      // rather than stale keeps every consumer of `roadId` honest about
      // what they actually know.
      roadId: null,
      held: false,
      // Not read anywhere yet, but a site that exists without a road under
      // it is worth being able to ask about later — the inspector's "why is
      // this here" readout is the obvious place this surfaces first.
      anchored: true,
    });
  }
  return out;
}

// --- held roads ------------------------------------------------------------

// A road you have taken hold of.
//
// The pattern functions above are *proposals*. Hold one — by dragging a
// control point, or by saying so outright — and it stops being a proposal and
// becomes something the scene owns: stored as a curve in `params.roadEdits`,
// emitted every rebuild whether or not the pattern would have produced it,
// and never overwritten by the pattern again. `free` and `fixed` from
// constraints.js, applied to geometry instead of to a number.
//
// **Holding a road freezes its name, and that is the point.** A road's id is
// a hash of where it is, and a building's id is that road's id plus which
// kerb and how far along — so a building is *addressed relative to its road*.
// Drag a road whose name is derived from its position and every building on
// it is renamed, which loses every edit made to them. Drag a road whose name
// was frozen when you took hold of it and the buildings keep their names,
// keep their edits, and travel with the street. That is not a workaround for
// the id scheme; it is the id scheme working, and it is the reason a held
// road is stored under the id it had rather than under a fresh one.
function heldRoads(params) {
  const edits = params.roadEdits || {};
  const out = [];
  for (const [id, edit] of Object.entries(edits)) {
    const points = edit?.curve?.points;
    if (!points || points.length < 2) continue;
    // A road adopted from a polyline has every point a corner and no tension,
    // so flattening returns exactly the control points. Segment indices and
    // control points stay one to one, which is what keeps the plot ids on a
    // road stable while its shape is being pulled about.
    const pts = flatten(edit.curve, 16).map((p) => [p.x, p.z]);
    if (pts.length < 2) continue;
    out.push({ id, pts, main: Boolean(edit.main), width: edit.width, held: true });
  }
  return out;
}

// Same road, to the tenth of a metre — the tolerance road ids are minted at,
// so anything this calls the same road would have been given the same name.
function samePolyline(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const q = (n) => Math.round(n * 10);
  for (let i = 0; i < a.length; i++) {
    if (q(a[i][0]) !== q(b[i][0]) || q(a[i][1]) !== q(b[i][1])) return false;
  }
  return true;
}

// The held roads and the proposed ones, as one list.
//
// Order is not cosmetic here. `placeSites` walks this list once and the first
// plot to claim a piece of ground keeps it, so where a road sits in the list
// decides which frontages survive a contest for the same corner. Two things
// have to be true at once, and they pull in opposite directions:
//
//   **Holding a road where it already is must change nothing.** Otherwise
//   "keep this street and reroll the rest" quietly rearranges the rest, which
//   is the exact behaviour holding exists to stop. So a held road that has
//   not moved takes its proposal's place in the list, and the town comes out
//   identical.
//
//   **A road you moved must win the ground it now covers.** Otherwise you
//   drag a street into a gap and half its buildings fail to appear because
//   procedural plots got there first. So a road that has moved — or that the
//   pattern no longer proposes at all — goes to the front and claims first.
//
// The test between them is the geometry, not a flag: a hold that never moved
// anything is indistinguishable from the proposal it came from, and should be
// treated as one.
function mergeRoads(held, proposed) {
  const proposals = new Map(proposed.map((road) => [road.id, road]));
  const front = [];
  const inPlace = new Map();
  for (const road of held) {
    const proposal = proposals.get(road.id);
    if (proposal && samePolyline(proposal.pts, road.pts)) inPlace.set(road.id, road);
    else front.push(road);
  }

  const roads = [...front];
  const names = new Set(held.map((road) => road.id));
  for (const road of proposed) {
    const kept = inPlace.get(road.id);
    if (kept) {
      roads.push(kept);
      continue;
    }
    // Superseded: this proposal is a road you are holding somewhere else now.
    if (names.has(road.id)) continue;
    roads.push(road);
  }
  return roads;
}

// --- merged lots -----------------------------------------------------------

// One building standing on several plots.
//
// This is the only thing in the tool that changes a town's *silhouette*
// rather than its surface. Every plot is one cell wide give or take the
// jitter, so however much the modules and the collage vary, the massing
// repeats at one scale and the town reads as a single texture applied evenly.
// A department store, a market hall, a station shed, a car park: all of them
// are one footprint that is four plots long, and none of them can exist while
// a lot is a lot.
//
// A merge is stored as a **span**: `{ plotId: n }`, meaning this plot and the
// n-1 plots after it along the same kerb are one. Spans rather than arbitrary
// groups, for three reasons. A plot id already says which road, which segment
// and how far along, so the neighbours are named without storing them. A
// frontage is what a big building actually wants — depth is set by the block,
// length is the decision. And a span survives regeneration for free: it names
// positions on a street rather than a set of buildings that might not all
// come back.
//
// Merging happens after placement rather than during it, which is what keeps
// it safe: the ground a merged lot covers is exactly the ground its members
// already held plus the gaps between them, and those gaps are empty by
// construction. Nothing else has to move.
const SLOT = /^(.+)_(\d+)\.(\d+)([lr])$/;

function applySpans(sites, params) {
  const spans = params.lotSpans || {};
  const ids = Object.keys(spans);
  if (!ids.length) return sites;

  const byId = new Map(sites.map((s) => [s.id, s]));
  const absorbed = new Set();

  for (const id of ids) {
    const n = Math.round(spans[id]);
    const head = byId.get(id);
    if (!head || !(n > 1) || absorbed.has(id)) continue;
    const parts = SLOT.exec(id);
    if (!parts) continue;
    const [, road, segment, step, kerb] = parts;

    const members = [head];
    for (let i = 1; i < n; i++) {
      const next = byId.get(`${road}_${segment}.${Number(step) + i}${kerb}`);
      // Stop at the first gap. A span that runs past the end of its street,
      // or over a plot the density roll removed, takes what is there and no
      // more — silently, because the alternative is a scene that reports
      // every slider nudge as a problem.
      if (!next || absorbed.has(next.id)) break;
      members.push(next);
      absorbed.add(next.id);
    }
    if (members.length < 2) continue;

    // Measured along the street, since that is the direction the plots run
    // in. A site's angle is the negated road angle — see `placeSites` — so
    // this is the road's own direction vector.
    const theta = -head.angle;
    const ux = Math.cos(theta);
    const uz = Math.sin(theta);
    let lo = Infinity;
    let hi = -Infinity;
    let depth = 0;
    for (const s of members) {
      const along = s.x * ux + s.z * uz;
      lo = Math.min(lo, along - s.w / 2);
      hi = Math.max(hi, along + s.w / 2);
      depth = Math.max(depth, s.d);
    }
    // Slide the head along the street to the middle of what it now covers,
    // leaving its distance from the kerb exactly as it was so the frontage
    // still lines up with its neighbours.
    const shift = (lo + hi) / 2 - (head.x * ux + head.z * uz);
    head.x += shift * ux;
    head.z += shift * uz;
    head.w = hi - lo;
    head.d = depth;
    head.span = members.length;
  }

  return absorbed.size ? sites.filter((s) => !absorbed.has(s.id)) : sites;
}

// --- entry point -----------------------------------------------------------

// The first two links of the generation chain: a region, then the roads that
// fill it, then the lots along those roads. The region arrives from
// `regionFor`, which reads a boundary if the scene has one and derives the
// old square from cols and rows if it does not — so nothing that never draws
// a boundary can tell the difference.
export function buildLayout(params, region = regionFor(params), claims = null, anchors = null) {
  // The road pattern's own seed, falling back to the city seed until it is
  // given one of its own. See `terrainSeed`/`roadSeed` in generate.js.
  const roadSeed = (params.roadSeed ?? params.seed) >>> 0;
  const rng = new Rng(roadSeed ^ 0x9e3779b9);
  const proposed = [];

  switch (params.roadPattern) {
    case 'boulevard':
      boulevardPattern(proposed, rng, params, region);
      break;
    case 'radial':
      radialPattern(proposed, rng, params, region);
      break;
    case 'organic':
      organicPattern(proposed, rng, params, region);
      break;
    case NONE_PATTERN:
      // Proposes nothing, on purpose — not a fifth pattern the randomiser
      // should ever land on (it isn't in `ROAD_PATTERNS`, only in the
      // dropdown), but a real destination for a town built entirely from
      // roads you drew yourself. Held roads are unaffected either way:
      // `mergeRoads` puts them in ahead of whatever `proposed` holds, and an
      // empty `proposed` here just means there is nothing procedural left to
      // merge them with.
      break;
    default:
      gridPattern(proposed, rng, params, region);
  }

  // A held road is not clipped to the boundary, and that is deliberate rather
  // than an oversight. The boundary decides where the *town* is; a road you
  // took hold of is a decision you made, and `fixed` means the proposal is
  // ignored — including the boundary's proposal about where this road should
  // stop. Its plots are still rejected outside the region by `placeSites`, so
  // pulling the boundary in empties a held road of buildings and leaves the
  // street you drew. Pull the boundary back out and the buildings return.
  const merged = mergeRoads(heldRoads(params), proposed);
  // Deleted roads never reach the kerb walk at all, so nothing is placed on
  // one and it draws nothing — the difference between this and releasing a
  // held road, which keeps the street and only lets its shape go back to
  // being generated.
  const removed = params.roadRemoved;
  const roads = removed && Object.keys(removed).length ? merged.filter((r) => !removed[r.id]) : merged;

  const sites = applySpans(placeSites(roads, params, region, claims, anchors), params);
  // `half` stays on the layout because plenty of things still want one number
  // for how big the town is — the camera framing, the tour, the shadow span.
  // It is the region's now rather than a separate calculation that could
  // disagree with it.
  return { roads, sites, region, half: region.half };
}
