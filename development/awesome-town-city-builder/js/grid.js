// A uniform grid over the ground plane, for "what is near here".
//
// Written before the systems that need it rather than after, which is the
// whole argument for it existing this early. `layout.js` already solved this
// twice privately — once to stop buildings overlapping each other and once to
// stop them landing on the tarmac of a crossing street — and terrain
// sampling, curve projection, volume containment and scatter rejection all
// want the same structure. Four more private copies is the default outcome if
// nothing is put down first, and unifying them afterwards is a much larger
// job than starting from one.
//
// Uniform, not a quadtree or a BVH. Everything here is roughly building-sized
// and roughly evenly spread across a bounded square, which is the case a
// uniform grid is best at and the case where a smarter structure buys nothing
// but code to maintain. When that stops being true — a scatter across a
// landscape, say — the interface below is the thing to keep and the buckets
// are the thing to replace.
//
// Two kinds of thing go in. A **disc** is a point with a radius, which is how
// a building footprint is approximated. A **capsule** is a segment with a
// radius, which is how a road is. Both answer the same question, so a caller
// asking what is near a point does not need to know which it will find.

const key = (cx, cz) => `${cx}|${cz}`;

export class SpatialGrid {
  // `cell` wants to be about the size of the things going in. Much smaller
  // and one item spans many buckets; much larger and every query walks the
  // whole town.
  constructor(cell) {
    this.cell = Math.max(1e-3, cell);
    this.map = new Map();
  }

  clear() {
    this.map.clear();
  }

  cellOf(x, z) {
    return [Math.floor(x / this.cell), Math.floor(z / this.cell)];
  }

  _push(cx, cz, entry) {
    const k = key(cx, cz);
    let list = this.map.get(k);
    if (!list) this.map.set(k, (list = []));
    list.push(entry);
  }

  // A point with a reach.
  addDisc(x, z, r, item) {
    const [cx, cz] = this.cellOf(x, z);
    this._push(cx, cz, { kind: 'disc', x, z, r, item });
  }

  // A segment with a reach, written into every bucket its span touches with
  // one cell of margin, so a query never has to look further than its own
  // neighbours however long the segment is.
  addCapsule(a, b, r, item) {
    const c = this.cell;
    const x0 = Math.floor(Math.min(a[0], b[0]) / c) - 1;
    const x1 = Math.floor(Math.max(a[0], b[0]) / c) + 1;
    const z0 = Math.floor(Math.min(a[1], b[1]) / c) - 1;
    const z1 = Math.floor(Math.max(a[1], b[1]) / c) + 1;
    const entry = { kind: 'capsule', a, b, r, item };
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) this._push(x, z, entry);
    }
  }

  // Everything in this bucket and the eight around it. Deliberately not a
  // distance test: callers each want a different one, and the point of the
  // grid is to shrink the candidate set, not to decide the answer.
  *near(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = this.map.get(key(cx + i, cz + j));
        if (!list) continue;
        for (const entry of list) yield entry;
      }
    }
  }

  // Whether a disc of this radius would touch anything already in here.
  // `skip` drops entries the caller owns — a building is allowed to sit on
  // its own street, which is the one exception the town needs.
  overlaps(x, z, r, skip) {
    for (const e of this.near(x, z)) {
      if (skip && skip(e.item)) continue;
      if (distanceTo(e, x, z) < e.r + r) return true;
    }
    return false;
  }

  // The nearest thing, or null. Used by nothing yet; curves and terrain both
  // want it, and it is four lines on top of what is already here.
  nearest(x, z, skip) {
    let best = null;
    let bestAt = Infinity;
    for (const e of this.near(x, z)) {
      if (skip && skip(e.item)) continue;
      const d = distanceTo(e, x, z);
      if (d < bestAt) {
        bestAt = d;
        best = e;
      }
    }
    return best ? { item: best.item, distance: bestAt } : null;
  }
}

// Distance from a point to whatever this entry is, ignoring its radius.
function distanceTo(e, x, z) {
  if (e.kind === 'disc') return Math.hypot(x - e.x, z - e.z);
  return pointToSegment(x, z, e.a, e.b);
}

// Squared comparison avoided for clarity, since this runs a few hundred
// thousand times at most and the profile has never shown it.
export function pointToSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
