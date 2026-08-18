// How an assembly arranges its parts.
//
// The split that makes this scale: an algorithm decides *where* each part
// goes, and the slot decides *what* fills it. Neither knows about the other.
// So a new algorithm gets slot randomisation for free, and a new slot rule
// works in every algorithm that already exists — which is the only way the
// UI stays honest once the arrangement stops being a simple stack.
//
// Most algorithms here place more parts than are listed. `instanceCount`
// says how many the assembly actually wants, and the parts list is cycled to
// fill it, so a colonnade of twelve is one pillar in the list and a count of
// twelve. Every instance resolves down its own path, which means a slot with
// several candidates gives twelve *different* pillars rather than twelve
// copies of one — the variation is free and comes from the same machinery
// as everything else.
//
// Algorithm settings follow the same lock model as any other parameter, so
// "between eight and sixteen of them" is sayable here exactly as it is on a
// component.

import { range, fixed, unit } from './constraints.js';

const TAU = Math.PI * 2;
const sizeOn = (b, axis) => (axis === 'x' ? b.w : axis === 'z' ? b.d : b.h);
const AXIS_I = { x: 0, y: 1, z: 2 };

function boundsOf(placed) {
  const box = { w: 0, h: 0, d: 0 };
  for (const p of placed) {
    box.w = Math.max(box.w, Math.abs(p.offset[0]) * 2 + p.bounds.w);
    box.h = Math.max(box.h, p.offset[1] + p.bounds.h);
    box.d = Math.max(box.d, Math.abs(p.offset[2]) * 2 + p.bounds.d);
  }
  return box;
}

// --- stacking ---------------------------------------------------------------

// Walk one axis, each part starting where the last one ended, less whatever
// the joint eats. The one arrangement that mirrors the UI list directly: the
// order you see is the order along the axis.
//
// `shrink` tapers the run, each step a fraction smaller than the last, which
// is the difference between a column and a spire and costs one multiply.
function stackAlong(axis) {
  return (parts, p) => {
    const overlap = p.overlap || 0;
    const gap = p.gap || 0;
    const shrink = p.shrink || 0;
    const i = AXIS_I[axis];
    let cursor = 0;
    let scale = 1;
    const placed = [];

    for (const part of parts) {
      const bounds = {
        w: part.bounds.w * (axis === 'x' ? 1 : scale),
        h: part.bounds.h * (axis === 'y' ? 1 : scale),
        d: part.bounds.d * (axis === 'z' ? 1 : scale),
      };
      const size = sizeOn(part.bounds, axis);
      const offset = [0, 0, 0];
      offset[i] = cursor;
      placed.push({ ...part, offset, scale, bounds });
      cursor += size - size * overlap + gap;
      scale *= 1 - shrink;
    }

    const box = boundsOf(placed);
    if (axis === 'x') box.w = Math.max(box.w, cursor);
    else if (axis === 'z') box.d = Math.max(box.d, cursor);
    else box.h = Math.max(box.h, cursor);
    return { placed, bounds: box };
  };
}

// --- repeats ----------------------------------------------------------------

// Evenly spaced along an axis at a spacing you set, rather than however wide
// the parts happen to be. A fence, a row of columns, sleepers under a track:
// anything whose rhythm should stay put when the parts change size.
function line(parts, p) {
  const n = parts.length;
  const spacing = p.spacing ?? 1;
  const i = AXIS_I[p.axis === 2 ? 'z' : 'x'];
  const placed = parts.map((part, k) => {
    const offset = [0, 0, 0];
    offset[i] = (k - (n - 1) / 2) * spacing;
    return { ...part, offset };
  });
  return { placed, bounds: boundsOf(placed) };
}

// Rows and columns on the ground. The most reusable arrangement there is:
// windows on a facade, tiles on a plaza, a block of huts, a car park.
function grid(parts, p) {
  const cols = Math.max(1, Math.round(p.cols ?? 3));
  const sx = p.spacingX ?? 1;
  const sz = p.spacingZ ?? 1;
  const rows = Math.max(1, Math.ceil(parts.length / cols));
  const placed = parts.map((part, k) => {
    const ix = k % cols;
    const iz = Math.floor(k / cols);
    return {
      ...part,
      offset: [(ix - (cols - 1) / 2) * sx, 0, (iz - (rows - 1) / 2) * sz],
    };
  });
  return { placed, bounds: boundsOf(placed) };
}

// Parts spaced around a circle, each turned to face outward. A colonnade, a
// fence ring, a crown of spires.
function ring(parts, p) {
  const radius = Math.max(0, p.radius ?? 1);
  const spread = (p.spread ?? 1) * TAU;
  const start = (p.start ?? 0) * TAU;
  const n = parts.length;
  const placed = parts.map((part, k) => {
    const t = n > 1 ? k / (spread >= TAU - 1e-6 ? n : Math.max(1, n - 1)) : 0;
    const a = start + t * spread;
    return {
      ...part,
      offset: [Math.cos(a) * radius, 0, Math.sin(a) * radius],
      rotY: p.faceOut === 0 ? 0 : -a,
    };
  });
  return { placed, bounds: boundsOf(placed) };
}

// A ring that climbs. Stairs, a helter-skelter, a spiral of signage up a
// tower — the arrangement that is tedious to place by hand and trivial to
// describe.
function spiral(parts, p) {
  const radius = Math.max(0, p.radius ?? 1);
  const rise = p.rise ?? 0.3;
  const turns = p.turns ?? 1;
  const n = parts.length;
  const placed = parts.map((part, k) => {
    const t = n > 1 ? k / (n - 1) : 0;
    const a = t * turns * TAU;
    return {
      ...part,
      offset: [Math.cos(a) * radius, k * rise, Math.sin(a) * radius],
      rotY: p.faceOut === 0 ? 0 : -a,
    };
  });
  const box = boundsOf(placed);
  box.h = Math.max(box.h, (n - 1) * rise + (parts[0]?.bounds.h || 0));
  return { placed, bounds: box };
}

// Deterministic jitter inside an ellipse. Rubble, trees, rocks, market
// stalls: everything that should look unplanned and still come back the same
// way every time the seed does.
function scatter(parts, p) {
  const rx = p.radiusX ?? 1.5;
  const rz = p.radiusZ ?? 1.5;
  const spin = p.spin ?? 1;
  const placed = parts.map((part, k) => {
    const a = unit(`${part.path || ''}|scatter|${k}|a`) * TAU;
    const r = Math.sqrt(unit(`${part.path || ''}|scatter|${k}|r`));
    return {
      ...part,
      offset: [Math.cos(a) * r * rx, 0, Math.sin(a) * r * rz],
      rotY: spin ? unit(`${part.path || ''}|scatter|${k}|s`) * TAU * spin : 0,
    };
  });
  return { placed, bounds: boundsOf(placed) };
}

// Half the parts, then the same run flipped. Symmetry is the cheapest way to
// make something read as built rather than grown, and doing it by hand means
// keeping two lists in step forever.
function mirror(parts, p) {
  const gap = p.gap ?? 0.8;
  const spacing = p.spacing ?? 1;
  const half = Math.ceil(parts.length / 2);
  const placed = parts.map((part, k) => {
    const side = k < half ? 1 : -1;
    const rank = k < half ? k : k - half;
    const x = side * (gap / 2 + rank * spacing);
    return { ...part, offset: [x, 0, 0], rotY: side < 0 && p.flip !== 0 ? Math.PI : 0 };
  });
  return { placed, bounds: boundsOf(placed) };
}

// Every part sharing one origin. The identity arrangement, and what you want
// when the slot below is doing the choosing and only one thing shows at a
// time.
function overlay(parts) {
  const placed = parts.map((part) => ({ ...part, offset: [0, 0, 0] }));
  return { placed, bounds: boundsOf(placed) };
}

// --- registry ---------------------------------------------------------------

const countOf = (parts, p) => Math.max(1, Math.round(p.count ?? parts.length));

export const ALGORITHMS = {
  'stack-y': {
    label: 'Stack up',
    help: 'Each part sits on the one before it. The list reads bottom to top, so the order here is the order in the world. Shrink tapers the run into a spire.',
    place: stackAlong('y'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0), shrink: fixed(0) },
  },
  'stack-x': {
    label: 'Stack along X',
    help: 'Parts laid end to end sideways, each butted against the last. A terrace, a bridge span, a train.',
    place: stackAlong('x'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0), shrink: fixed(0) },
  },
  'stack-z': {
    label: 'Stack along Z',
    help: 'The same, running the other way along the ground.',
    place: stackAlong('z'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0), shrink: fixed(0) },
  },
  line: {
    label: 'Line',
    help: 'A set number of copies at a spacing you choose, rather than however wide the parts are. Keeps its rhythm when the parts change size.',
    place: line,
    defaults: { count: range(3, 8), spacing: fixed(1), axis: fixed(0) },
    instanceCount: countOf,
  },
  grid: {
    label: 'Grid',
    help: 'Rows and columns on the ground. Windows on a facade, tiles on a plaza, a block of huts.',
    place: grid,
    defaults: { count: range(6, 12), cols: fixed(3), spacingX: fixed(1), spacingZ: fixed(1) },
    instanceCount: countOf,
  },
  ring: {
    label: 'Ring',
    help: 'Parts spaced around a circle, each turned to face outward. Spread below one leaves an arc rather than a full ring.',
    place: ring,
    defaults: { count: range(5, 10), radius: range(0.8, 1.8), spread: fixed(1), start: fixed(0), faceOut: fixed(1) },
    instanceCount: countOf,
  },
  spiral: {
    label: 'Spiral',
    help: 'A ring that climbs as it turns. Stairs, a helix of signage, anything that winds up a tower.',
    place: spiral,
    defaults: { count: range(8, 16), radius: range(0.6, 1.4), rise: fixed(0.3), turns: fixed(1), faceOut: fixed(1) },
    instanceCount: countOf,
  },
  scatter: {
    label: 'Scatter',
    help: 'Jittered about inside an ellipse, deterministically. Rubble, trees, stalls: unplanned-looking and the same every time for a given seed.',
    place: scatter,
    defaults: { count: range(4, 12), radiusX: range(1, 2.5), radiusZ: range(1, 2.5), spin: fixed(1) },
    instanceCount: countOf,
  },
  mirror: {
    label: 'Mirror',
    help: 'The run laid out once and then flipped to the other side. Symmetry without keeping two lists in step by hand.',
    place: mirror,
    defaults: { count: range(2, 6), gap: fixed(0.8), spacing: fixed(1), flip: fixed(1) },
    instanceCount: countOf,
  },
  overlay: {
    label: 'Overlay',
    help: 'Every part on the same spot. What you want when the slot is doing the choosing and only one thing shows at a time.',
    place: overlay,
    defaults: {},
  },
};

export const ALGORITHM_KEYS = Object.keys(ALGORITHMS);
export const DEFAULT_ALGORITHM = 'stack-y';
export const algorithmOf = (id) => ALGORITHMS[id] || ALGORITHMS[DEFAULT_ALGORITHM];

// A ceiling on how many instances one assembly may ask for, so a slider
// dragged to the end cannot take the page down.
export const MAX_INSTANCES = 256;

export function instanceCountFor(doc, parts, opts) {
  const algo = algorithmOf(doc.algorithm || DEFAULT_ALGORITHM);
  const n = algo.instanceCount ? algo.instanceCount(parts, opts) : parts.length;
  return Math.min(MAX_INSTANCES, Math.max(0, Math.round(n || 0)));
}
