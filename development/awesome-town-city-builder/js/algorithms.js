// How an assembly arranges its parts.
//
// The split that makes this scale: an algorithm decides *where* each part
// goes, and the slot decides *what* fills it. Neither knows about the other.
// So a new algorithm gets slot randomisation for free, and a new slot rule
// works in every algorithm that already exists — which is the only way the
// UI stays honest once the arrangement stops being a simple stack.
//
// Every algorithm takes resolved parts (it only ever needs their bounds) and
// returns an offset per part plus the bounds of the whole. Its own settings
// follow the same lock model as everything else, so "overlap between 0 and
// 0.2" is sayable here exactly as it is on a component parameter.

import { range, fixed } from './constraints.js';

const sizeOn = (b, axis) => (axis === 'x' ? b.w : axis === 'z' ? b.d : b.h);

// Walk one axis, each part starting where the last one ended, less whatever
// the joint eats. This is the one that mirrors the UI list directly: the
// order you see is the order up the axis.
function stackAlong(axis) {
  return (parts, p) => {
    const overlap = p.overlap || 0;
    const gap = p.gap || 0;
    const i = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
    let cursor = 0;
    const placed = [];
    const box = { w: 0, h: 0, d: 0 };

    for (const part of parts) {
      const size = sizeOn(part.bounds, axis);
      const offset = [0, 0, 0];
      offset[i] = cursor;
      placed.push({ ...part, offset });
      cursor += size - size * overlap + gap;
      box.w = Math.max(box.w, part.bounds.w);
      box.h = Math.max(box.h, part.bounds.h);
      box.d = Math.max(box.d, part.bounds.d);
    }

    if (axis === 'x') box.w = Math.max(0, cursor - (parts.length ? 0 : 0));
    else if (axis === 'z') box.d = Math.max(0, cursor);
    else box.h = Math.max(0, cursor);
    return { placed, bounds: box };
  };
}

// Parts spaced evenly around a circle, each turned to face outward. Included
// deliberately as the first algorithm whose arrangement has no natural
// top-to-bottom reading, which is what proves the slot UI does not secretly
// depend on the list order meaning "stacked".
function ring(parts, p) {
  const radius = Math.max(0, p.radius ?? 1);
  const spread = (p.spread ?? 1) * Math.PI * 2;
  const start = (p.start ?? 0) * Math.PI * 2;
  const placed = [];
  const box = { w: 0, h: 0, d: 0 };

  parts.forEach((part, i) => {
    const t = parts.length > 1 ? i / parts.length : 0;
    const a = start + t * spread;
    placed.push({
      ...part,
      offset: [Math.cos(a) * radius, 0, Math.sin(a) * radius],
      rotY: p.faceOut === 0 ? 0 : -a,
    });
    box.h = Math.max(box.h, part.bounds.h);
  });

  const reach = radius * 2 + Math.max(0, ...parts.map((x) => Math.max(x.bounds.w, x.bounds.d)));
  box.w = reach;
  box.d = reach;
  return { placed, bounds: box };
}

// Every part sharing one origin. Useful for a slot that swaps between
// alternatives, and as the identity arrangement for a single-part assembly.
function overlay(parts) {
  const box = { w: 0, h: 0, d: 0 };
  const placed = parts.map((part) => {
    box.w = Math.max(box.w, part.bounds.w);
    box.h = Math.max(box.h, part.bounds.h);
    box.d = Math.max(box.d, part.bounds.d);
    return { ...part, offset: [0, 0, 0] };
  });
  return { placed, bounds: box };
}

export const ALGORITHMS = {
  'stack-y': {
    label: 'Stack up',
    help: 'Each part sits on the one before it. The list reads bottom to top, so the order here is the order in the world.',
    place: stackAlong('y'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0) },
  },
  'stack-x': {
    label: 'Stack along X',
    help: 'Parts laid end to end sideways. A terrace, a bridge span, a train.',
    place: stackAlong('x'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0) },
  },
  'stack-z': {
    label: 'Stack along Z',
    help: 'The same, running the other way along the ground.',
    place: stackAlong('z'),
    defaults: { overlap: range(0, 0.12), gap: fixed(0) },
  },
  ring: {
    label: 'Ring',
    help: 'Parts spaced around a circle, each turned to face outward. A colonnade, a fence, a ring of lamps.',
    place: ring,
    defaults: { radius: range(0.6, 1.6), spread: fixed(1), start: fixed(0), faceOut: fixed(1) },
  },
  overlay: {
    label: 'Overlay',
    help: 'Every part on the same spot. Useful when the slot below is doing the choosing and only one part shows at a time.',
    place: overlay,
    defaults: {},
  },
};

export const ALGORITHM_KEYS = Object.keys(ALGORITHMS);
export const DEFAULT_ALGORITHM = 'stack-y';

export const algorithmOf = (id) => ALGORITHMS[id] || ALGORITHMS[DEFAULT_ALGORITHM];
