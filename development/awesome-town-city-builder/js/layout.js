// Street layout.
//
// Roads come first, buildings follow. Every pattern here produces the same
// thing: a list of polylines, some marked as main. Buildings are then placed
// along both kerbs facing the road, which is what makes blocks read as blocks
// and gives triangular corners wherever two roads cross at an angle.
//
// Patterns are simplified versions of real ones. What matters is the family
// of shapes each produces, not that it survives a planner's inspection.

import { Rng, hashString, hashCoords } from './rng.js';
import { SpatialGrid } from './grid.js';

export const ROAD_PATTERNS = ['grid', 'boulevard', 'radial', 'organic'];

export const PATTERN_LABEL = {
  grid: 'Grid',
  boulevard: 'Boulevards',
  radial: 'Radial',
  organic: 'Old town',
};

const TAU = Math.PI * 2;

// Clip an infinite line to the square the town occupies.
function clipLine(px, pz, angle, half) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  let t0 = -1e9;
  let t1 = 1e9;
  for (const [p, d] of [
    [px, dx],
    [pz, dz],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < -half || p > half) return null;
      continue;
    }
    let a = (-half - p) / d;
    let b = (half - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (t1 - t0 < 1e-3) return null;
  return [
    [px + dx * t0, pz + dz * t0],
    [px + dx * t1, pz + dz * t1],
  ];
}

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

function pushLine(roads, pts, main, width) {
  if (!pts) return;
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
function gridPattern(roads, rng, p, half) {
  const base = rng.range(0, Math.PI / 2);
  const skew = p.roadSkew * 0.55;
  for (const family of [0, 1]) {
    const angle = base + family * (Math.PI / 2);
    const step = p.cell * (family ? p.blockDepth : p.blockWidth);
    const count = Math.ceil((half * 2.4) / step);
    for (let i = -count; i <= count; i++) {
      const offset = i * step + rng.range(-step * 0.12, step * 0.12);
      const a = angle + rng.range(-skew, skew);
      const nx = Math.cos(angle + Math.PI / 2) * offset;
      const nz = Math.sin(angle + Math.PI / 2) * offset;
      const main = i % 3 === 0;
      pushLine(roads, clipLine(nx, nz, a, half), main, main ? p.highwayWidth : p.streetWidth);
    }
  }
}

// A grid with long diagonals driven through it. The diagonals are what carve
// the triangular blocks you get in Paris or Washington.
function boulevardPattern(roads, rng, p, half) {
  gridPattern(roads, rng, p, half);
  const count = 2 + Math.round(p.roadSkew * 5);
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI);
    const offset = rng.range(-half * 0.75, half * 0.75);
    const nx = Math.cos(angle + Math.PI / 2) * offset;
    const nz = Math.sin(angle + Math.PI / 2) * offset;
    pushLine(roads, clipLine(nx, nz, angle, half), true, p.highwayWidth * 1.15);
  }
}

// Spokes from one or two centres, plus rings around them. Skew scatters the
// spoke angles so the wedges between them stop being identical.
function radialPattern(roads, rng, p, half) {
  const centres = [];
  const many = p.roadSkew > 0.55 ? 2 : 1;
  for (let i = 0; i < many; i++) {
    centres.push(
      many === 1
        ? [rng.range(-half * 0.2, half * 0.2), rng.range(-half * 0.2, half * 0.2)]
        : [rng.range(-half * 0.6, half * 0.6), rng.range(-half * 0.6, half * 0.6)]
    );
  }

  for (const [cx, cz] of centres) {
    const spokes = 5 + Math.round(rng.float() * 4);
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI + rng.range(-0.28, 0.28) * p.roadSkew;
      pushLine(roads, clipLine(cx, cz, angle, half), true, p.highwayWidth);
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
      pushLine(roads, pts, r === rings, r === rings ? p.highwayWidth : p.streetWidth);
    }
  }
  // A little grid outside the rings so the edges are not empty.
  const keep = roads.length;
  gridPattern(roads, rng, { ...p, blockWidth: p.blockWidth * 1.8, blockDepth: p.blockDepth * 1.8 }, half);
  for (let i = keep; i < roads.length; i++) roads[i].main = false;
}

// Medieval. Lines that wander instead of running straight, so nothing lines up
// and the blocks come out as irregular scraps.
function organicPattern(roads, rng, p, half) {
  const count = Math.max(4, Math.round((half * 2) / (p.cell * p.blockWidth) * 1.6));
  for (let i = 0; i < count; i++) {
    const edge = Math.floor(rng.float() * 4);
    let x = edge === 0 ? -half : edge === 1 ? half : rng.range(-half, half);
    let z = edge === 2 ? -half : edge === 3 ? half : rng.range(-half, half);
    let angle = Math.atan2(-z, -x) + rng.range(-0.6, 0.6);
    const pts = [[x, z]];
    const step = p.cell * 0.9;
    const wander = 0.12 + p.roadSkew * 0.35;
    for (let s = 0; s < 90; s++) {
      angle += rng.range(-wander, wander);
      x += Math.cos(angle) * step;
      z += Math.sin(angle) * step;
      if (Math.abs(x) > half || Math.abs(z) > half) break;
      pts.push([x, z]);
    }
    if (pts.length > 3) {
      const main = i % 4 === 0;
      pushLine(roads, pts, main, main ? p.highwayWidth : p.streetWidth);
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

function placeSites(roads, params, half) {
  const sites = [];
  const seed = params.seed >>> 0;
  const frontage = params.cell * params.lotFill;
  const depth = frontage * params.blockDepthRatio;
  const packing = new SpatialGrid(Math.max(frontage, depth) * 1.2);
  const kerbs = roadGrid(roads, Math.max(frontage, depth) * 2 + params.highwayWidth);

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
          const t4 = siteTickets(seed, road.id, slot);
          if (t4.keep >= params.density) continue;
          const jitter = (t4.jitter * 2 - 1) * step * 0.12;
          const px = ax + ux * (t + jitter) - uz * side * offset;
          const pz = az + uz * (t + jitter) + ux * side * offset;
          if (Math.abs(px) > half || Math.abs(pz) > half) continue;
          const w = frontage * (1 + (t4.w * 2 - 1) * params.lotJitter);
          const d = depth * (1 + (t4.d * 2 - 1) * params.lotJitter);
          const radius = Math.max(w, d) * 0.44;
          if (packing.overlaps(px, pz, radius)) continue;
          // Its own street already has clearance built into the offset. Every
          // other road has to be cleared by the footprint's own reach.
          if (kerbs.overlaps(px, pz, Math.max(w, d) * 0.42, (id) => id === road.id)) continue;
          packing.addDisc(px, pz, radius);
          sites.push({
            id: `${road.id}_${slot}`,
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
          });
        }
      }
    }
  });
  return sites;
}

// --- entry point -----------------------------------------------------------

export function buildLayout(params) {
  const rng = new Rng((params.seed >>> 0) ^ 0x9e3779b9);
  const half = (Math.max(params.cols, params.rows) * params.cell) / 2;
  const roads = [];

  switch (params.roadPattern) {
    case 'boulevard':
      boulevardPattern(roads, rng, params, half);
      break;
    case 'radial':
      radialPattern(roads, rng, params, half);
      break;
    case 'organic':
      organicPattern(roads, rng, params, half);
      break;
    default:
      gridPattern(roads, rng, params, half);
  }

  const sites = placeSites(roads, params, half);
  return { roads, sites, half };
}
