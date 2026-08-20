// How high a road runs.
//
// Roads have always been paint. `setRoads` laid a ribbon on the ground, added
// six centimetres so it did not z-fight the terrain, and that was the whole of
// a road's relationship with height. This is the layer that lets one leave the
// ground: a viaduct over a valley, a raised expressway through the middle of
// town, a boardwalk on stilts, a ramp climbing to meet another road.
//
// **Height is a profile along the run, not a property of a control point.**
// That distinction is the whole design. A grid road has exactly two control
// points, both of them at the edge of town, so a model that stored height per
// point could not express "up in the middle, down at both ends" without
// inserting points — and inserting a point into `road.pts` renames the road,
// which renames every building on it, which loses every edit made to them.
// See `roadId` in layout.js. So the points are never touched. Height is:
//
//   lifts[]           the cruising height, one per control point, lerped
//                     along the run — this is what a hand-authored road
//                     carries, since dragging a point *up* is per point
//   rampIn / rampOut  metres over which the run comes down to the ground at
//                     each end, zero when that end meets another road
//
// and the height at any distance along the road is the first multiplied by
// the second. One expression covers the flat proposal, the hand-shaped run,
// and the ramp at either end, and none of it costs the road its name.
//
// **An end either meets a road or comes down.** Tested against every other
// road's whole line rather than only against its endpoints, because in a grid
// nothing meets end to end: roads cross in the middle and terminate at the
// boundary. So a T-junction counts, and takes its height from the road it
// arrives at so the two agree where they touch. An end that meets nothing
// ramps to the floor, which is what stops a raised network from ending in
// mid-air at the edge of town.
//
// Roads crossing in the middle at different heights are left alone, and read
// as flyovers, which is what they are.

import { Rng } from './rng.js';

// Below this a road is on the ground and nothing else here applies — no ramp
// worth drawing, no column worth standing up. Two centimetres of numerical
// noise should not put a town on stilts.
export const GROUNDED = 0.05;

// --- geometry helpers -------------------------------------------------------

// Cumulative distance along a polyline, and its total. Everything below works
// in metres travelled rather than in point indices, so a road with two control
// points and one with forty ramp over the same distance.
export function measure(pts) {
  const at = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    at.push(total);
  }
  return { at, total };
}

// The cruising height at a distance along the run, by walking the per-point
// lifts. Linear between control points on purpose: a road is a made thing and
// a straight grade between two heights is what one looks like.
function cruiseAt(lifts, at, d) {
  if (!lifts || !lifts.length) return 0;
  if (lifts.length === 1) return lifts[0];
  for (let i = 1; i < at.length; i++) {
    if (d > at[i] && i < at.length - 1) continue;
    const span = at[i] - at[i - 1];
    const t = span < 1e-9 ? 0 : Math.min(1, Math.max(0, (d - at[i - 1]) / span));
    return lifts[i - 1] + (lifts[i] - lifts[i - 1]) * t;
  }
  return lifts[lifts.length - 1];
}

// How much of the cruising height survives at this distance, given the ramps.
// Smoothstepped rather than linear so the road eases off the ground instead of
// leaving it at a crease — the same reasoning as a landform's falloff.
function rampAt(rampIn, rampOut, d, total) {
  let k = 1;
  if (rampIn > 0) k = Math.min(k, Math.min(1, d / rampIn));
  if (rampOut > 0) k = Math.min(k, Math.min(1, (total - d) / rampOut));
  return k * k * (3 - 2 * k);
}

// The one function everything asks. `d` in metres from the road's first point.
export function liftAt(road, d) {
  if (!road.profile) return 0;
  const { lifts, at, total, rampIn, rampOut } = road.profile;
  return cruiseAt(lifts, at, d) * rampAt(rampIn, rampOut, d, total);
}

// Whether this road ever leaves the ground, which is the cheap test every
// consumer wants before doing any of the work above.
export const isRaised = (road) => Boolean(road.profile && road.profile.peak > GROUNDED);

// The road as a dense polyline carrying its own height, for anything that
// draws it. Subdividing here rather than in `road.pts` is what keeps ramps
// smooth on a two-point road without renaming it: these vertices exist only
// for the length of a draw call and no id is ever derived from them.
export function raisedPoints(road, step = 2) {
  const pts = road.pts;
  if (!pts || pts.length < 2) return [];
  const { at, total } = road.profile || measure(pts);
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const segment = at[i] - at[i - 1];
    const steps = Math.max(1, Math.ceil(segment / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, liftAt(road, at[i - 1] + segment * t)]);
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1], liftAt(road, total)]);
  return out;
}

// --- proposing --------------------------------------------------------------

// The height the pattern proposes for one road. Seeded off the road's own
// name rather than off a running generator, the same discipline `tickets()`
// applies to modules: a road keeps its height when the road before it in the
// list disappears.
function proposedLift(road, params) {
  const base = params.roadHeight || 0;
  if (base <= 0) return 0;
  const variance = Math.min(1, Math.max(0, params.roadHeightVariance ?? 0));
  if (variance <= 0) return base;
  let h = 2166136261;
  for (let i = 0; i < road.id.length; i++) {
    h ^= road.id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const roll = new Rng(h >>> 0).float();
  return Math.max(0, base * (1 + variance * (roll * 2 - 1)));
}

// Nearest point on a road's line to somewhere, as a distance along it. Used
// only to answer "does this end touch that road, and how high is it there",
// which happens a few hundred times a rebuild at most.
function nearestOn(road, x, z) {
  const pts = road.pts;
  const { at } = road.profile;
  let best = { distance: Infinity, along: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const len2 = ex * ex + ez * ez;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / len2));
    const d = Math.hypot(x - (a[0] + ex * t), z - (a[1] + ez * t));
    if (d < best.distance) best = { distance: d, along: at[i - 1] + Math.sqrt(len2) * t };
  }
  return best;
}

// How long a ramp wants to be: six times the height it has to climb, which is
// a 1-in-6 grade — steep for a real road, right for a town you are looking at
// rather than driving, and unmistakably a ramp rather than a wall.
const RAMP_GRADE = 6;
// And the steepest it is allowed to become when the road is not long enough
// to have what it wants. Past 1-in-2.5 it stops reading as a road climbing
// and starts reading as a road broken in half.
const STEEPEST = 2.5;

// Give every road a height profile.
//
// Runs after `mergeRoads`, so held roads are already in the list carrying the
// per-point heights they were authored with, and proposals are still flat.
// Mutates rather than copies: the road records are freshly built every rebuild
// and nothing upstream is holding one.
export function liftRoads(roads, params) {
  for (const road of roads) {
    const { at, total } = measure(road.pts);
    // A held road brings its own heights, one per point, and the pattern does
    // not get a say — `fixed` beats `free`, exactly as it does for the shape.
    const authored = road.lifts && road.lifts.length === road.pts.length ? road.lifts : null;
    const lifts = authored || new Array(road.pts.length).fill(proposedLift(road, params));
    road.profile = {
      lifts,
      at,
      total,
      rampIn: 0,
      rampOut: 0,
      peak: Math.max(0, ...lifts),
      // Everything in the end pass below is the generator having an opinion,
      // and a generator does not get one about a height you set by hand. A
      // road you lifted already ramps by itself — that is what the difference
      // between two neighbouring points *is* — and the junction rule would
      // overwrite the very endpoint you dragged. `fixed` beats `free`, the
      // same as it does for the shape.
      authored: Boolean(authored),
    };
  }

  // Ends, once every road knows its cruising height. Read against the profiles
  // as they stand rather than as they end up, so two roads meeting each other's
  // ends cannot chase one another's answers.
  const cruise = roads.map((r) => r.profile.lifts.slice());
  for (let i = 0; i < roads.length; i++) {
    const road = roads[i];
    if (road.profile.authored || road.profile.peak <= GROUNDED) continue;
    const pts = road.pts;
    const ends = [
      { index: 0, x: pts[0][0], z: pts[0][1], key: 'rampIn' },
      { index: pts.length - 1, x: pts[pts.length - 1][0], z: pts[pts.length - 1][1], key: 'rampOut' },
    ];

    const ramping = [];
    for (const end of ends) {
      let met = null;
      for (let j = 0; j < roads.length; j++) {
        if (j === i) continue;
        const other = roads[j];
        if (!other.pts || other.pts.length < 2) continue;
        const tol = (road.width + other.width) / 2 + 1;
        const near = nearestOn(other, end.x, end.z);
        if (near.distance > tol) continue;
        if (!met || near.distance < met.distance) {
          met = { distance: near.distance, lift: cruiseAt(cruise[j], other.profile.at, near.along) };
        }
      }
      if (met) {
        // Meets something: agree with it at the touching point, so the two
        // surfaces line up instead of one hovering over the other.
        road.profile.lifts[end.index] = met.lift;
      } else {
        // Meets nothing: come down. Otherwise a raised network ends in
        // mid-air wherever the boundary cut it.
        ramping.push(end.key);
      }
    }

    if (ramping.length) {
      const lift = Math.max(0, ...road.profile.lifts);
      const want = Math.max(4, lift * RAMP_GRADE);
      // Two ramps share the run, so each gets half of it at most. A road that
      // has to climb and descend inside its own length is the case that
      // produced spikes: a seven-metre stub was ramping seven metres up and
      // seven back down over two and a half metres of road each way, which is
      // a pyramid rather than a bridge.
      const length = Math.min(want, road.profile.total / ramping.length);
      if (length < lift * STEEPEST) {
        // Too short to get up and down again at any grade worth drawing. This
        // road stays on the ground, which is the honest answer — an overpass
        // shorter than it is tall is not an overpass.
        road.profile.lifts = road.profile.lifts.map(() => 0);
      } else {
        for (const key of ramping) road.profile[key] = length;
      }
    }
    road.profile.peak = Math.max(0, ...road.profile.lifts);
  }
  return roads;
}
