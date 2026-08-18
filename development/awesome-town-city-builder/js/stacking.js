// The stacking algorithm, pulled out on its own.
//
// A building is parts stacked up Y. An elevated highway is parts stacked
// along its length. A pipe run is the same again on an arbitrary axis. They
// only ever differed in which axis they walked and what they did at the
// joints, so the shared part lives here and the systems above it supply the
// axis, the parts and the joint rules.
//
// Everything works from a part's declared bounds rather than its geometry,
// which is the whole reason components expose bounds and anchors at all: a
// stack can be laid out without ever looking at a vertex.

export const AXES = { x: 0, y: 1, z: 2 };

// How much of a part's own size is consumed at each joint. Overlap pulls
// parts into each other so a stack reads as one object rather than a tower
// of touching boxes; gap does the reverse.
function jointShift(part, axis, opts) {
  const size = sizeAlong(part.bounds, axis);
  const overlap = opts.overlap || 0;
  const gap = opts.gap || 0;
  return size - size * overlap + gap;
}

export function sizeAlong(bounds, axis) {
  if (axis === 'x') return bounds.w;
  if (axis === 'z') return bounds.d;
  return bounds.h;
}

// Lay parts out along one axis, returning each with the offset it sits at.
// The caller keeps ownership of what a "part" is — this only needs bounds —
// so the same call serves resolved components and resolved templates.
export function stack(parts, opts = {}) {
  const axis = opts.axis || 'y';
  const i = AXES[axis];
  let cursor = opts.start || 0;
  const placed = [];

  for (const part of parts) {
    const size = sizeAlong(part.bounds, axis);
    const offset = [0, 0, 0];
    offset[i] = cursor;

    // Cross-axis alignment. Centred is the default because a stack of
    // differently sized parts should share a centre line, not a corner.
    if (opts.jitter) {
      const other = axis === 'y' ? ['x', 'z'] : ['y'];
      for (const a of other) {
        const j = AXES[a];
        offset[j] += (opts.jitter[a] || 0);
      }
    }

    placed.push({ ...part, offset, sizeAlong: size });
    cursor += jointShift(part, axis, opts);
  }

  return { parts: placed, length: cursor - (opts.start || 0), axis };
}

// The bounds a stack occupies as a whole, so a template can hand a single
// box up to whatever places it without the caller walking the parts.
export function stackBounds(placed, axis = 'y') {
  const box = { w: 0, h: 0, d: 0 };
  let total = 0;
  for (const p of placed) {
    box.w = Math.max(box.w, p.bounds.w);
    box.h = Math.max(box.h, p.bounds.h);
    box.d = Math.max(box.d, p.bounds.d);
    total += p.sizeAlong ?? sizeAlong(p.bounds, axis);
  }
  if (axis === 'x') box.w = total;
  else if (axis === 'z') box.d = total;
  else box.h = total;
  return box;
}
