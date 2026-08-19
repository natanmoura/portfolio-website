// The curve primitive.
//
// One type, serving every linear thing in the world: roads, rivers, walls,
// fences, pipes, cables, powerlines, hedgerows, balustrades — and boundaries,
// which are the same object closed. That list is the entire argument for
// building this before any of them. Each is a curve, a distribution and a
// component slot, and writing a road-shaped editor first would mean
// generalising it afterwards, which is the expensive order.
//
// Three decisions are baked in here because they are expensive to undo.
//
// **Points are 3D, but a curve declares how it meets the ground.** Roads,
// boundaries, rivers and fences want their height to come from the terrain:
// you author them in plan and they drape. Powerlines and pipes want authored
// height. Building only the first means rebuilding for cables; building only
// the second means every road point carries a hand-set Y and the whole road
// drops through the floor the day terrain arrives. So a curve carries a
// ground mode and both behaviours come from one type.
//
// **Catmull-Rom through the control points, not Bezier.** Bezier doubles the
// handles and the UI for control you almost never want on a road: what you
// want is the curve to pass through the points you placed. A point can be
// marked a corner to go sharp, which is what a junction or a city block
// needs. Bezier stays a later upgrade to this same type if something ever
// genuinely demands independent tangents.
//
// **Points have minted ids.** Third time in this project — see ids.js. Insert
// a point halfway along a road and everything keyed to the points after it
// must not move.
//
// Nothing here renders or handles input. A curve you can build, sample and
// measure with nothing consuming it yet is a complete thing that can be
// proved on its own, which is the only reason the layers above it can be
// trusted later.

import { mintId, idOf } from './ids.js';

// How a curve's height is decided.
export const DRAPE = 'drape';   // Y comes from the ground, whatever it is
export const OFFSET = 'offset'; // ground plus a constant: a bridge, a cable run
export const FREE = 'free';     // Y is authored, point by point

export const GROUND_MODES = [DRAPE, OFFSET, FREE];

export const GROUND_LABEL = {
  [DRAPE]: 'On the ground',
  [OFFSET]: 'Above the ground',
  [FREE]: 'Wherever you put it',
};

// --- building ---------------------------------------------------------------

export function newPoint(x, y, z, opts = {}) {
  return { id: mintId('c'), x, y: y || 0, z, corner: Boolean(opts.corner) };
}

export function newCurve(points = [], opts = {}) {
  return {
    id: opts.id || mintId('curve'),
    label: opts.label || 'Curve',
    kind: opts.kind || 'path',
    closed: Boolean(opts.closed),
    ground: opts.ground || DRAPE,
    // Only read in OFFSET mode. Kept on the curve rather than per point
    // because "three metres up" is a property of the run, not of each pole.
    lift: opts.lift ?? 0,
    // How much the curve bulges through its points. Zero is a polyline, which
    // is what the road patterns already produce and what a city grid wants.
    tension: opts.tension ?? 0.5,
    points: points.map((p) => (p.id ? p : newPoint(p.x ?? p[0], p.y ?? p[1] ?? 0, p.z ?? p[2], p))),
  };
}

// A curve from a bare polyline, which is what every road pattern emits today.
// Corners on, tension zero: identical geometry to the polyline it came from,
// so adopting the type changes nothing until somebody smooths it.
export const curveFromPolyline = (pts, opts = {}) =>
  newCurve(
    pts.map(([x, z]) => ({ x, y: 0, z, corner: true })),
    { tension: 0, ...opts }
  );

export const pointIdOf = (point, index) => idOf(point, index, 'c');

// --- sampling ---------------------------------------------------------------

// Catmull-Rom, evaluated between p1 and p2 with p0 and p3 as the neighbours
// that decide the tangents. A corner point kills the tangent on its side,
// which is what makes a sharp turn sharp rather than a tight bulge.
function segmentAt(p0, p1, p2, p3, t, tension) {
  const t2 = t * t;
  const t3 = t2 * t;
  const k = tension * 2;
  const out = {};
  for (const a of ['x', 'y', 'z']) {
    const m1 = (k * (p2[a] - p0[a])) / 2;
    const m2 = (k * (p3[a] - p1[a])) / 2;
    out[a] =
      (2 * t3 - 3 * t2 + 1) * p1[a] +
      (t3 - 2 * t2 + t) * m1 +
      (-2 * t3 + 3 * t2) * p2[a] +
      (t3 - t2) * m2;
  }
  return out;
}

// The four points a segment needs, with the ends handled by folding back on
// themselves rather than by inventing phantom points outside the curve. A
// closed curve wraps, which is what makes a boundary have no seam.
function quadFor(curve, i) {
  const pts = curve.points;
  const n = pts.length;
  const at = (j) => {
    if (curve.closed) return pts[((j % n) + n) % n];
    return pts[Math.max(0, Math.min(n - 1, j))];
  };
  const p1 = at(i);
  const p2 = at(i + 1);
  // A corner has no tangent on the inside, so the neighbour collapses onto
  // the point itself and the segment leaves and arrives in a straight line.
  const p0 = p1.corner ? p1 : at(i - 1);
  const p3 = p2.corner ? p2 : at(i + 2);
  return [p0, p1, p2, p3];
}

export const segmentCount = (curve) =>
  Math.max(0, curve.closed ? curve.points.length : curve.points.length - 1);

// A point on the curve, by segment and position within it. The parameter is
// not arc length — see `resample` for even spacing, which is what anything
// distributing objects actually wants.
export function pointAt(curve, segment, t) {
  const [p0, p1, p2, p3] = quadFor(curve, segment);
  return segmentAt(p0, p1, p2, p3, t, curve.tension ?? 0.5);
}

// Direction of travel, by difference rather than by deriving the polynomial.
// A tenth of a segment is finer than anything downstream cares about and it
// costs two evaluations instead of a second implementation that could drift
// from the first.
export function tangentAt(curve, segment, t) {
  const e = 1e-3;
  const a = pointAt(curve, segment, Math.max(0, t - e));
  const b = pointAt(curve, segment, Math.min(1, t + e));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

// The whole curve as a polyline, at a given subdivision. A curve with every
// point a corner and no tension emits its control points unchanged, which is
// what keeps a grid road exactly straight rather than nearly straight.
export function flatten(curve, perSegment = 12) {
  const out = [];
  const segs = segmentCount(curve);
  if (!curve.points.length) return out;
  if (segs === 0) return [{ ...curve.points[0] }];

  for (let s = 0; s < segs; s++) {
    const [, p1, p2] = quadFor(curve, s);
    const straight = (curve.tension ?? 0.5) === 0 || (p1.corner && p2.corner);
    const steps = straight ? 1 : perSegment;
    for (let i = 0; i < steps; i++) out.push(pointAt(curve, s, i / steps));
  }
  if (!curve.closed) out.push(pointAt(curve, segs - 1, 1));
  return out;
}

export function length(curve, perSegment = 12) {
  const pts = flatten(curve, perSegment);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
  }
  return total;
}

// Points spaced evenly along the curve by distance, which is what every
// consumer wants and what the raw parameter cannot give: a Catmull-Rom
// segment covers more ground where it is straight, so stepping t evenly
// bunches lamp posts on the bends.
//
// `spacing` in metres. Walks the flattened polyline and interpolates within
// whichever piece each step lands in.
export function resample(curve, spacing, perSegment = 12) {
  const pts = flatten(curve, perSegment);
  if (pts.length < 2 || !(spacing > 0)) return pts.slice(0, 1);

  const out = [pts[0]];
  let carried = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (seg <= 1e-9) continue;
    let travelled = spacing - carried;
    while (travelled <= seg) {
      const t = travelled / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      travelled += spacing;
    }
    carried = seg - (travelled - spacing);
  }
  return out;
}

// --- ground -----------------------------------------------------------------

// Settle a sampled point onto whatever the world is doing underneath it.
//
// Kept out of sampling on purpose. The shape of a curve is a decision the
// author made; where it sits vertically is a consequence of the terrain it is
// laid on, and mixing the two would mean re-authoring every road the first
// time somebody raises a hill.
export function settle(curve, point, groundAt) {
  const mode = curve.ground || DRAPE;
  if (mode === FREE || !groundAt) return point;
  const ground = groundAt(point.x, point.z) || 0;
  return { ...point, y: mode === OFFSET ? ground + (curve.lift || 0) : ground };
}

export const settleAll = (curve, points, groundAt) =>
  points.map((p) => settle(curve, p, groundAt));

// --- editing ----------------------------------------------------------------

// Where along the curve a point would go if inserted here, and the position
// it would take. Used by click-to-add, which wants the new point to land on
// the line rather than wherever the pointer happened to be.
export function insertAt(curve, segment, t) {
  const at = pointAt(curve, segment, t);
  const points = curve.points.slice();
  points.splice(segment + 1, 0, newPoint(at.x, at.y, at.z));
  return { ...curve, points };
}

export function removePoint(curve, id) {
  // A curve needs two points to be a curve. Refusing rather than deleting
  // means the last delete does nothing instead of leaving something that
  // cannot be drawn or reasoned about.
  if (curve.points.length <= 2) return curve;
  return { ...curve, points: curve.points.filter((p, i) => pointIdOf(p, i) !== id) };
}

export function movePoint(curve, id, to) {
  return {
    ...curve,
    points: curve.points.map((p, i) =>
      pointIdOf(p, i) === id ? { ...p, ...to } : p
    ),
  };
}

export function setCorner(curve, id, corner) {
  return {
    ...curve,
    points: curve.points.map((p, i) =>
      pointIdOf(p, i) === id ? { ...p, corner: Boolean(corner) } : p
    ),
  };
}

// --- queries ----------------------------------------------------------------

// Nearest place on the curve to a point in the world, as a segment and a
// position within it. What click-to-insert needs, and what "which road is
// this building on" will need later.
export function closestOn(curve, x, z, perSegment = 12) {
  const segs = segmentCount(curve);
  let best = { segment: 0, t: 0, distance: Infinity, point: null };
  for (let s = 0; s < segs; s++) {
    for (let i = 0; i <= perSegment; i++) {
      const t = i / perSegment;
      const p = pointAt(curve, s, t);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best.distance) best = { segment: s, t, distance: d, point: p };
    }
  }
  return best;
}

// The box a curve occupies in plan, for culling and for framing the camera.
export function bounds(curve, perSegment = 12) {
  const pts = flatten(curve, perSegment);
  if (!pts.length) return null;
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of pts) {
    box.minX = Math.min(box.minX, p.x);
    box.maxX = Math.max(box.maxX, p.x);
    box.minZ = Math.min(box.minZ, p.z);
    box.maxZ = Math.max(box.maxZ, p.z);
  }
  return box;
}
