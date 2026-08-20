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

// A sampled array of the bridge, read at a distance along the road.
//
// **The bridge stores the road's absolute height, not its height above the
// ground, and that distinction is a bug fix rather than bookkeeping.** Storing
// a lift and rebuilding the surface as `ground + lift` is only correct where
// the ground between two samples is a straight line — and the one place this
// system exists for is precisely where it is not. At a cliff, interpolating a
// lift across a sample interval while the real ground drops eighteen metres
// inside it produced a deck that dived after the terrain and came back: eight
// bridged roads, every one with a spike in it, worst case nearly nine metres
// of rise inside one metre of road. Interpolating the surface itself cannot
// do that, because the surface is the thing the slope limit was applied to.
function sampleBridge(array, step, d) {
  const f = Math.min(array.length - 1, Math.max(0, d / step));
  const i = Math.floor(f);
  const j = Math.min(array.length - 1, i + 1);
  const t = f - i;
  return array[i] + (array[j] - array[i]) * t;
}

// The one function everything asks. `d` in metres from the road's first point.
//
// The two contributions are taken at whichever is higher rather than summed.
// They are answers to different questions — "how high did you ask this road to
// run" and "how high does it have to be to cross this ground at a sane grade"
// — and a road needs to satisfy both, which is the maximum. Summing would put
// a road you raised six metres twenty metres up over a ravine that only
// needed fourteen.
// `groundHere` is the terrain height at the exact point being asked about.
// Callers almost always have it already and should pass it: the fallback is
// the ground *sampled* along the road, which is right on open terrain and
// wrong by the height of a cliff at the one place that matters.
export function liftAt(road, d, groundHere = null) {
  if (!road.profile) return 0;
  const { lifts, at, total, rampIn, rampOut, bridge } = road.profile;
  const cruise = cruiseAt(lifts, at, d) * rampAt(rampIn, rampOut, d, total);
  if (!bridge) return cruise;
  const ground = groundHere ?? sampleBridge(bridge.ground, bridge.step, d);
  const above = sampleBridge(bridge.surface, bridge.step, d) - ground;
  return Math.max(cruise, above > 0 ? above : 0);
}

// Whether this road ever leaves the ground, which is the cheap test every
// consumer wants before doing any of the work above.
export const isRaised = (road) => Boolean(road.profile && road.profile.peak > GROUNDED);

// The road as a dense polyline carrying its own height, for anything that
// draws it. Subdividing here rather than in `road.pts` is what keeps ramps
// smooth on a two-point road without renaming it: these vertices exist only
// for the length of a draw call and no id is ever derived from them.
// Each entry is `[x, z, lift, surfaceY]` — how far off the ground the road is
// there, and where its surface actually sits in the world. Both, because the
// two consumers want different ones: a column is `lift` tall, and a deck is
// drawn at `surfaceY` regardless of what the ground beneath its edges is
// doing.
export function raisedPoints(road, step = 2, groundAt = null) {
  const pts = road.pts;
  if (!pts || pts.length < 2) return [];
  const { at, total } = road.profile || measure(pts);
  const out = [];
  const emit = (x, z, d) => {
    const ground = groundAt ? groundAt(x, z) || 0 : 0;
    const lift = liftAt(road, d, groundAt ? ground : null);
    out.push([x, z, lift, ground + lift]);
  };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const segment = at[i] - at[i - 1];
    const steps = Math.max(1, Math.ceil(segment / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      emit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, at[i - 1] + segment * t);
    }
  }
  const last = pts[pts.length - 1];
  emit(last[0], last[1], total);
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

// The steepest a ramp is allowed to become when the road is not long enough
// to come down at the scene's grade. Past 1-in-2 it stops reading as a road
// climbing and starts reading as a road broken in half, and a road that
// cannot manage even that stays on the ground instead.
const STEEPEST = 2;

// --- bridging ---------------------------------------------------------------

// One slider decides everything about how a road meets a hill, and it runs
// from "glued to the terrain" to "long gradual viaducts".
//
// It was a maximum grade in degrees before, which is the number the algorithm
// actually wants but exactly backwards as a control: larger meant steeper
// meant *less* bridging, and zero would have meant a road that cannot climb
// at all. Turning it round so that zero is the identity — the road lies on
// the ground, nothing is bridged, nothing is smoothed — makes every increase
// mean one thing: the descent gets longer, gentler, and stands further off
// the hill, with more column underneath it.
//
// Both halves of that come from the same number. The grade limit falls as the
// slider rises, so the road refuses steeper and steeper ground; and the
// smoothing radius rises with it, so the descent it substitutes is rounded
// over a longer run.
const EASE_MIN_DEG = 70; // just short of a cliff: effectively refuse nothing
const EASE_MAX_DEG = 4;  // a motorway ramp: refuse almost everything
// A smoothstep's steepest point is one and a half times its average slope.
// Every ramp is built at the grade divided by this and then curved back up to
// it, so the number the slider names is the slope the road actually reaches.
const S_PEAK = 1.5;

const easeOf = (params) => Math.min(1, Math.max(0, params.roadEase ?? 0.3));
const gradeOf = (params) => {
  const t = easeOf(params);
  const deg = EASE_MIN_DEG + (EASE_MAX_DEG - EASE_MIN_DEG) * t;
  return Math.tan((deg * Math.PI) / 180);
};
// How far apart the ground is sampled along a road. Finer than the terrain
// mesh can express, so a cliff edge is never stepped over.
const BRIDGE_STEP = 1;
// Extra ground samples each side of every step, used to take the highest
// point in the interval rather than the value at its centre. Three is enough
// to catch a cliff lip at this spacing without turning one road into a
// thousand terrain queries.
const SUB_SAMPLES = 3;
// Below this the road is simply on the ground. Ordinary terrain wobble should
// not put a town on stilts a few centimetres high.
const BRIDGE_MIN = 0.15;

// The road surface, as the lowest line that stays above the ground and never
// climbs or falls faster than `MAX_ROAD_GRADE`.
//
// This is the whole of "a road bridges what it cannot climb", and it is one
// classical sweep rather than any kind of decision about where a bridge goes.
// Walk forward limiting how fast the surface may drop; walk back doing the
// same, which limits how fast it may rise going forward. What survives both
// passes is the minimal slope-limited upper envelope of the terrain — level
// where the ground falls away under it, back down on the ground the moment
// the ground comes up to meet it.
//
// So a ravine gets a deck across it and columns underneath, a cliff gets an
// approach at a walkable grade instead of a wall, and a gentle hill gets
// nothing at all because the terrain already satisfies the constraint. No
// threshold anywhere decides "this is steep enough to bridge" — the grade
// limit is the only input, and everything else falls out of it.
function bridgeTerrain(road, groundAt, grade) {
  const { total } = road.profile;
  const n = Math.max(2, Math.ceil(total / BRIDGE_STEP) + 1);
  const step = total / (n - 1);
  const pts = road.pts;
  const at = road.profile.at;

  const groundOn = (d) => {
    let i = 1;
    while (i < at.length - 1 && at[i] < d) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const span = Math.max(1e-6, at[i] - at[i - 1]);
    const t = Math.min(1, Math.max(0, (d - at[i - 1]) / span));
    return groundAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) || 0;
  };

  // The ground under the road, taken as the **highest** point in each
  // interval rather than the value at its centre.
  //
  // A point sample is not conservative, and on the shape this exists to cross
  // that bites: a ridge or a cliff lip thinner than the sample spacing sits
  // between two samples that both miss it, the envelope is built under it,
  // and the deck comes out below ground for a metre — which reads as the road
  // diving into the hill and back out. Sub-sampling and keeping the maximum
  // makes the envelope an upper bound of the real terrain, so the deck can
  // only ever be at or above it.
  const ground = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const d = k * step;
    let peak = groundOn(d);
    for (let s = 1; s <= SUB_SAMPLES; s++) {
      const o = (step * s) / (SUB_SAMPLES + 1);
      peak = Math.max(peak, groundOn(Math.max(0, d - o)), groundOn(Math.min(total, d + o)));
    }
    ground[k] = peak;
  }

  // The sweeps run at a *gentler* grade than the one asked for, because the
  // S below spends its slope unevenly: a smoothstep's steepest point is one
  // and a half times its average, so a ramp built at two thirds of the limit
  // comes out peaking at exactly the limit once it is curved. Building at the
  // limit and then curving would overshoot it by half.
  const drop = (grade / S_PEAK) * step;
  const surface = Float32Array.from(ground);
  for (let k = 1; k < n; k++) surface[k] = Math.max(surface[k], surface[k - 1] - drop);
  for (let k = n - 2; k >= 0; k--) surface[k] = Math.max(surface[k], surface[k + 1] - drop);

  // **The two sweeps give the right line and the wrong shape.** What comes out
  // is piecewise linear: flat along the top of a plateau, a dead-straight ramp
  // at exactly the grade, then flat again, with a hard crease at each end. A
  // road does not leave a hill that way. It eases out of the flat, runs at its
  // steepest in the middle, and eases back in.
  //
  // The obvious repair — relax the surface toward its neighbours a few hundred
  // times — does not work, and it is worth saying why, because it looks like
  // it should. Averaging a straight line returns the same straight line, so
  // the only thing it can touch is the two corners; and the upper corner sits
  // exactly on the plateau, where the clamp that keeps the road above ground
  // pins it. The result is a ramp with one slightly rounded foot and a crease
  // at the top, which is what it produced: a slope profile reading 50°, 50°,
  // 50°, 50°, 50°, 50°, 0°.
  //
  // So each straight run is replaced outright. Walk the surface, find every
  // maximal stretch that climbs or falls without turning round, and rewrite
  // its interior as a smoothstep between the two ends it already has. That
  // gives zero slope at both ends by construction — no crease at the lip, no
  // crease at the foot — and the peak lands in the middle where the ground is
  // furthest below, which is exactly where a bridge wants its tallest columns.
  //
  // Nothing here has to cut into the hill to do it. The curve leaves the lip
  // at plateau height and only starts falling once it is out over open air,
  // where the ground is far below and no constraint is binding.
  let i = 0;
  while (i < n - 1) {
    const dir = Math.sign(surface[i + 1] - surface[i]);
    if (dir === 0) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < n - 1 && Math.sign(surface[j + 1] - surface[j]) === dir) j++;
    const span = j - i;
    if (span >= 2) {
      const a = surface[i];
      const b = surface[j];
      for (let k = i + 1; k < j; k++) {
        const t = (k - i) / span;
        const eased = a + (b - a) * (t * t * (3 - 2 * t));
        // Still never below the ground. The S sags under the straight line
        // through the first half of a run, and while that stays clear of open
        // air it can graze a rise the run was passing over.
        surface[k] = eased > ground[k] ? eased : ground[k];
      }
    }
    i = j;
  }

  // Both arrays are kept: the surface is what gets interpolated (see
  // `sampleBridge`) and the ground is the fallback for callers that cannot
  // say what the terrain is doing where they are asking.
  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, surface[k] - ground[k]);
  if (peak <= BRIDGE_MIN) return null;
  return { bridge: { surface, ground, step }, peak };
}

// Give every road a height profile.
//
// Runs after `mergeRoads`, so held roads are already in the list carrying the
// per-point heights they were authored with, and proposals are still flat.
// Mutates rather than copies: the road records are freshly built every rebuild
// and nothing upstream is holding one.
export function liftRoads(roads, params, groundAt = null) {
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

    // What the ground forces, independent of what anyone asked for. Runs even
    // on an authored road: raising a road by hand says how high you want it,
    // not that you are willing to have it dive through a cliff on the way.
    // Zero easing is the identity: the road lies on the ground exactly as the
    // terrain does, nothing is bridged and nothing is smoothed. Short-circuited
    // rather than left to a very permissive grade, so "glued" means glued
    // even against a sheer face.
    if (groundAt && params.roadBridging !== false && easeOf(params) > 0) {
      const bridged = bridgeTerrain(road, groundAt, gradeOf(params));
      if (bridged) {
        road.profile.bridge = bridged.bridge;
        // Kept as its own field rather than folded into `peak`, because the
        // junction pass below recomputes `peak` from the cruise lifts and
        // would otherwise wipe it — which it did: eight bridged roads all
        // reported a peak of zero, so none of them counted as raised, none
        // got columns, and none were drawn subdivided.
        road.profile.bridgePeak = bridged.peak;
        road.profile.peak = Math.max(road.profile.peak, bridged.peak);
      }
    }
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
      // The same grade the bridging uses, so a road has exactly one idea of
      // how steep it is allowed to be whether it is coming down off a viaduct
      // or climbing out of a ravine.
      const want = Math.max(4, lift / gradeOf(params));
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
    road.profile.peak = Math.max(0, road.profile.bridgePeak || 0, ...road.profile.lifts);
  }
  return roads;
}
