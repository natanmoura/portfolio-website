// Where the town is, as a shape rather than a number.
//
// The extent used to be `half`: one scalar, `max(cols, rows) * cell / 2`,
// computed at the top of `buildLayout` and threaded through every pattern
// function as an axis-aligned square. `clipLine` tested against it,
// `placeSites` rejected against it, and the generator divided by it to work
// out how far downtown a building was. Four different questions, one number,
// and no way to answer any of them about a town that is not a square.
//
// This is that scalar becoming an interface. A region answers three things:
//
//   contains(x, z)          is this spot in town
//   clip(x, z, angle)       the parts of this infinite line that are
//   bounds / half / center  how big, and where
//
// The square derived from cols and rows is then just the default region, so
// a scene that never draws a boundary is unchanged down to the last float —
// and the moment you want a town that follows a coastline, sits in a valley
// or fills a shape you drew, it is the same interface with a different
// implementation behind it.
//
// **Why clip returns a list.** A line crossing a square enters once and
// leaves once. A line crossing a crescent can be inside, outside and inside
// again, and a road that jumps its own gap is not a road. So clipping hands
// back every span that is genuinely inside, and the caller makes one road of
// each. For a box there is always exactly one, which is why adopting this
// changed nothing.
//
// Nothing here knows about roads, lots or curves as such. It takes points and
// answers questions about them.

import { flatten, newCurve } from './curve.js';
import { Rng } from './rng.js';

// Ignore a span this short. Two roads at a hair's crossing produce a segment
// nobody can see and a building nobody can reach.
const MIN_SPAN = 1e-3;

// --- box --------------------------------------------------------------------

// The axis-aligned box, kept as its own implementation rather than as a
// four-sided polygon. Not premature: the slab clip below is the arithmetic
// the town has always used, and running the same box through the general
// polygon path would give answers that differ in the last bits of a float —
// which is enough to renumber a road id and move an override onto a
// different building. The specialisation is the compatibility guarantee.
export function boxRegion(minX, minZ, maxX, maxZ) {
  const clip = (px, pz, angle) => {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    let t0 = -1e9;
    let t1 = 1e9;
    for (const [p, d, lo, hi] of [
      [px, dx, minX, maxX],
      [pz, dz, minZ, maxZ],
    ]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) return [];
        continue;
      }
      let a = (lo - p) / d;
      let b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (t1 - t0 < MIN_SPAN) return [];
    return [
      [
        [px + dx * t0, pz + dz * t0],
        [px + dx * t1, pz + dz * t1],
      ],
    ];
  };

  return finish({
    kind: 'box',
    bounds: { minX, minZ, maxX, maxZ },
    contains: (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ,
    clip,
    distanceToEdge: (x, z) => {
      const dx = Math.max(minX - x, 0, x - maxX);
      const dz = Math.max(minZ - z, 0, z - maxZ);
      if (dx > 0 || dz > 0) return Math.hypot(dx, dz);
      return Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
    },
  });
}

export const squareRegion = (half) => boxRegion(-half, -half, half, half);

// --- polygon ----------------------------------------------------------------

// Any closed outline, convex or not. Points are `{ x, z }` and the ring is
// implicitly closed, so the last point joins the first without repeating it.
export function polygonRegion(points, opts = {}) {
  const ring = dedupe(points);
  if (ring.length < 3) return squareRegion(opts.fallbackHalf ?? 1);

  const bounds = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const p of ring) {
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minZ = Math.min(bounds.minZ, p.z);
    bounds.maxZ = Math.max(bounds.maxZ, p.z);
  }

  // Even-odd ray cast, along +X. The half-open test on z is what keeps a
  // point level with a vertex from being counted twice and reported outside
  // the shape it is plainly in.
  const cast = (x, z) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };

  // A point exactly on the outline is in town. Ray casting cannot say so —
  // it answers with whichever side the arithmetic fell on — and the case is
  // not hypothetical: the old-town generator starts every lane on the edge of
  // the extent, so half of them would begin one step outside the shape they
  // are filling. Only points the cast already rejected pay for this, and only
  // those inside the bounding box, so the cost falls on the handful of places
  // where the answer was in doubt rather than on the hundreds of thousands
  // where it was not.
  const EDGE = 1e-9;
  const onEdge = (x, z) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len2 = ex * ex + ez * ez;
      if (len2 < 1e-18) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / len2));
      const dx = x - (a.x + ex * t);
      const dz = z - (a.z + ez * t);
      if (dx * dx + dz * dz <= EDGE * EDGE) return true;
    }
    return false;
  };

  const contains = (x, z) => {
    if (cast(x, z)) return true;
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
    return onEdge(x, z);
  };

  // Every place the infinite line crosses the outline, as distances along it,
  // then the gaps between consecutive crossings that have their midpoint
  // inside. Midpoint testing rather than parity counting because parity is
  // the thing that goes wrong on a vertex hit, and one containment test per
  // gap is cheap next to being subtly wrong on the one road that runs
  // through a corner.
  const clip = (px, pz, angle) => {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const ts = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const denom = dx * ez - dz * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const s = (dx * (pz - a.z) - dz * (px - a.x)) / denom;
      if (s < 0 || s > 1) continue;
      ts.push(Math.abs(dx) > Math.abs(dz) ? (a.x + ex * s - px) / dx : (a.z + ez * s - pz) / dz);
    }
    if (ts.length < 2) return [];
    ts.sort((m, n) => m - n);

    const spans = [];
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i];
      const t1 = ts[i + 1];
      if (t1 - t0 < MIN_SPAN) continue;
      const mid = (t0 + t1) / 2;
      if (!contains(px + dx * mid, pz + dz * mid)) continue;
      spans.push([
        [px + dx * t0, pz + dz * t0],
        [px + dx * t1, pz + dz * t1],
      ]);
    }
    return spans;
  };

  // How far the outline is, ignoring which side of it you are on. Callers
  // that need a signed answer ask `contains` as well — separate because the
  // two questions have very different costs and most callers want only one.
  //
  // Landforms are the customer: the whole idea of a falloff is "how far past
  // the edge am I", and there was no way to ask it. Kept here rather than in
  // landform.js so the ring being walked is the same deduped ring `contains`
  // answers against, which is the only way the two can agree at the edge.
  const distanceToEdge = (x, z) => {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len2 = ex * ex + ez * ez;
      const t = len2 < 1e-18 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / len2));
      const dx = x - (a.x + ex * t);
      const dz = z - (a.z + ez * t);
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  return finish({ kind: 'polygon', bounds, contains, clip, distanceToEdge, ring });
}

// A closed curve is a boundary. Flattened once at region-build time rather
// than sampled per query: containment is asked hundreds of thousands of times
// during a rebuild and the outline does not move while it is being asked.
export const regionFromCurve = (curve, opts = {}) =>
  polygonRegion(flatten(curve, opts.perSegment ?? 16), opts);

// --- shared -----------------------------------------------------------------

// Consecutive duplicates break the crossing test by giving an edge no
// direction. Cheaper to drop them here than to guard every loop that walks
// the ring.
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-9 && Math.abs(last.z - p.z) < 1e-9) continue;
    out.push({ x: p.x, z: p.z });
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.z - last.z) < 1e-9) out.pop();
  return out;
}

// The two numbers every consumer wants and nobody should derive twice.
//
// `half` is the town's working radius — what the patterns scale their
// spacing against and what the generator divides by to say how far downtown
// something is. Taking it from the longer side of the bounding box means a
// square region reports exactly the `half` it replaced.
function finish(region) {
  const { minX, minZ, maxX, maxZ } = region.bounds;
  region.half = Math.max(maxX - minX, maxZ - minZ) / 2;
  region.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  region.clipOne = (x, z, angle) => region.clip(x, z, angle)[0] || null;
  region.clipPolyline = (pts) => clipPolyline(region, pts);
  return region;
}

// The inside runs of a walked polyline, for generators that wander rather
// than draw straight lines. Where a run crosses the outline the crossing is
// found by bisection instead of by intersecting edges, so this works for any
// region that can answer `contains` — including whatever replaces a polygon
// later.
function clipPolyline(region, pts) {
  const runs = [];
  let run = null;
  let previous = null;
  let previousIn = false;

  for (const p of pts) {
    const inside = region.contains(p[0], p[1]);
    if (inside && !previousIn) {
      run = [];
      if (previous) run.push(crossing(region, p, previous));
      run.push(p);
    } else if (inside) {
      run.push(p);
    } else if (previousIn) {
      run.push(crossing(region, previous, p));
      runs.push(run);
      run = null;
    }
    previous = p;
    previousIn = inside;
  }
  if (run && run.length > 1) runs.push(run);
  return runs;
}

// Where the edge is, between a point known inside and a point known outside.
// Eight halvings puts it within a two hundred and fiftieth of the step, which
// is finer than the wander it is cutting.
function crossing(region, inside, outside) {
  let a = inside;
  let b = outside;
  for (let i = 0; i < 8; i++) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (region.contains(m[0], m[1])) a = m;
    else b = m;
  }
  return a;
}

// --- what the town uses -----------------------------------------------------

// The region a set of params describes: the boundary you drew, or the square
// cols and rows imply. One place decides this, so nothing downstream has to
// know a boundary is optional.
export function regionFor(params) {
  const half = defaultHalf(params);
  const boundary = params.boundary;
  if (!boundary || !boundary.points || boundary.points.length < 3) return squareRegion(half);
  return regionFromCurve(boundary, { fallbackHalf: half });
}

// The square cols and rows imply, which is the town's extent until somebody
// draws one.
export const defaultHalf = (params) => (Math.max(params.cols, params.rows) * params.cell) / 2;

// --- starting shapes --------------------------------------------------------

// What you get when you ask for a boundary. Not generators in the Tier 4.3
// sense — nothing re-proposes these — just the three outlines worth starting
// from, because the one thing worse than no boundary tool is a boundary tool
// that opens on an empty canvas and asks you to click.
//
// They live here rather than in curve.js because a curve does not know what
// it is for and this is the one place that does.

export const BOUNDARY_SHAPES = ['square', 'round', 'blob'];

export const BOUNDARY_LABEL = {
  square: 'Square',
  round: 'Round',
  blob: 'Blob',
};

const TAU = Math.PI * 2;

const closed = (points, tension) =>
  newCurve(points, { closed: true, tension, kind: 'boundary', label: 'Town boundary', id: BOUNDARY_ID });

// The id is fixed rather than minted. There is exactly one boundary, and
// everything that has to recognise it — the editor deciding whether an edit
// rebuilds the town, the view drawing it differently — is asking "is this the
// boundary", which a minted id cannot answer without somewhere else to look
// it up.
export const BOUNDARY_ID = 'boundary';

// A square that lands on the extent it replaces. Its corners are corners, so
// adopting it changes the town's outline not at all: the same four edges in
// the same places, now with handles on them.
export function squareBoundary(half) {
  return closed(
    [
      { x: -half, z: -half, corner: true },
      { x: half, z: -half, corner: true },
      { x: half, z: half, corner: true },
      { x: -half, z: half, corner: true },
    ],
    0
  );
}

// Twelve points on a circle, smoothed. Enough to pull an ellipse, a lozenge
// or a horseshoe out of without adding any, and few enough that dragging one
// changes something you can see.
export function roundBoundary(half, points = 12) {
  const out = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    out.push({ x: Math.cos(a) * half, z: Math.sin(a) * half });
  }
  return closed(out, 0.5);
}

// The circle with its radius pushed about, which is what a town that grew
// rather than being planned looks like from above. Seeded, so the same seed
// gives the same outline and rolling the dice does not quietly redraw a
// boundary you were happy with.
export function blobBoundary(half, seed = 1, points = 14) {
  const rng = new Rng(seed >>> 0);
  const out = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    const r = half * (0.62 + rng.float() * 0.38);
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  return closed(out, 0.5);
}

export function boundaryShape(kind, half, seed = 1) {
  if (kind === 'round') return roundBoundary(half);
  if (kind === 'blob') return blobBoundary(half, seed);
  return squareBoundary(half);
}
