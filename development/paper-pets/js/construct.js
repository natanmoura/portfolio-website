// Parametric low-poly pet head ornaments, one piece each. The structure is fixed per
// breed; the photo is cut into regions and placed onto it (texture.js), not projected.
// Flaps (ears, hanging loop) are attached by explicit hinge links.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const centroid = (P) => scale(P.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / P.length);
const add3 = add;
const lerp = (a, b, t) => add(a, scale(sub(b, a), t));

export function newell(P) {
  const n = [0, 0, 0];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm(n);
}

class Part {
  constructor(name, rootRole = null) {
    this.name = name;
    this.rootRole = rootRole;
    this.verts = [];
    this.faces = [];
    this.links = [];
    this.pool = new Map();
  }
  v(p) { this.verts.push(p); return this.verts.length - 1; }
  // shared vertex by position, used where separately built polygons must meet exactly
  vAt(p) {
    const key = p.map((x) => Math.round(x * 1e5)).join(',');
    if (!this.pool.has(key)) this.pool.set(key, this.v(p));
    return this.pool.get(key);
  }
  face(idx, role, inside) {
    let P = idx.map((i) => this.verts[i]);
    if (dot(newell(P), sub(centroid(P), inside)) < 0) { idx = idx.slice().reverse(); P = P.slice().reverse(); }
    const nn = newell(P), c = centroid(P);
    // paper flexes: within ~0.3 mm at print size a panel can stay one face
    const planar = P.every((p) => Math.abs(dot(sub(p, c), nn)) < 4e-3);
    if (idx.length > 3 && !planar) {
      if (idx.length === 4) {
        const d02 = len(sub(P[0], P[2])), d13 = len(sub(P[1], P[3]));
        const tris = d02 < d13 ? [[0, 1, 2], [0, 2, 3]] : [[1, 2, 3], [1, 3, 0]];
        tris.forEach((t) => this.face(t.map((k) => idx[k]), role, inside));
      } else {
        for (let k = 1; k < idx.length - 1; k++) this.face([idx[0], idx[k], idx[k + 1]], role, inside);
      }
      return;
    }
    this.faces.push({ v: idx, role });
  }
  normalOf(fi) { return newell(this.faces[fi].v.map((i) => this.verts[i])); }

  // A flat paper flap hinged on edge (ia, ia+1) of a host face.
  // shape: [u, v] points, u along the hinge from its start, v away from the host.
  // shape[0] and shape[1] must be [0,0] and [L,0]. Folded either by `tilt` (radians
  // behind the host plane) or toward a world direction `dir`.
  // `tip`: index of the edge to fold a mirrored backing layer over.
  flap(hostIdx, ia, shape, { tilt = 0, dir = null, tip = null, role = 'flap', backRole = null, photo = false } = {}) {
    const host = this.faces[hostIdx];
    const m = host.v.length;
    const a = host.v[ia], b = host.v[(ia + 1) % m];
    const A = this.verts[a], B = this.verts[b];
    const n = this.normalOf(hostIdx);
    const ex = norm(sub(B, A));
    let d0 = norm(cross(n, ex));
    if (dot(d0, sub(centroid(host.v.map((i) => this.verts[i])), A)) > 0) d0 = scale(d0, -1);
    let th = tilt;
    if (dir) {
      const t = norm(sub(dir, scale(ex, dot(dir, ex))));
      th = Math.atan2(-dot(t, n), dot(t, d0));
    }
    const d1 = add(scale(d0, Math.cos(th)), scale(n, -Math.sin(th)));
    const n1 = add(scale(n, Math.cos(th)), scale(d0, Math.sin(th)));
    const flatPts = shape.map(([u, v]) => add(A, add(scale(ex, u), scale(d0, v))));
    const pts = shape.map(([u, v]) => add(A, add(scale(ex, u), scale(d1, v))));
    const ids = pts.map((p) => this.v(p));
    let order = ids.map((_, i) => i);
    if (dot(newell(pts), n1) < 0) order = order.reverse();
    const fi = this.faces.length;
    this.faces.push({ v: order.map((i) => ids[i]), role, flat: order.map((i) => flatPts[i]), photo,
      hinge: [order.indexOf(0), order.indexOf(1)] });
    this.links.push({ f1: hostIdx, a, b, f2: fi, a2: ids[0], b2: ids[1] });
    if (tip !== null) {
      const back = pts.map((p) => add(p, scale(n1, -0.006)));
      const bids = back.map((p) => this.v(p));
      const bOrder = order.slice().reverse();
      const bi = this.faces.length;
      this.faces.push({ v: bOrder.map((i) => bids[i]), role: backRole || `${role}-back` });
      const t2 = (tip + 1) % shape.length;
      this.links.push({ f1: fi, a: ids[tip], b: ids[t2], f2: bi, a2: bids[tip], b2: bids[t2] });
    }
    return fi;
  }
}

// rings: arrays of 3D points with equal counts. role(kind, i, k) names each face.
// tri: split every side quad into two triangles, alternating the diagonal, for a faceted look.
function loft(part, rings, role, { apex = null, capEnd = true, tri = false } = {}) {
  const ids = rings.map((r) => r.map((p) => part.vAt(p)));
  const ctr = rings.map(centroid);
  const R = (kind, i, k) => (typeof role === 'function' ? role(kind, i, k) : role);
  for (let i = 0; i < rings.length - 1; i++) {
    const inside = scale(add(ctr[i], ctr[i + 1]), 0.5);
    const K = rings[i].length;
    for (let k = 0; k < K; k++) {
      const k2 = (k + 1) % K;
      const [a, b, c, d] = [ids[i][k], ids[i][k2], ids[i + 1][k2], ids[i + 1][k]];
      if (!tri) part.face([a, b, c, d], R('side', i, k), inside);
      else if ((i + k) % 2) { part.face([a, b, c], R('side', i, k), inside); part.face([a, c, d], R('side', i, k), inside); }
      else { part.face([a, b, d], R('side', i, k), inside); part.face([b, c, d], R('side', i, k), inside); }
    }
  }
  part.face(ids[0], R('start', 0, 0), ctr[1]);
  const L = rings.length - 1;
  if (apex) {
    const a = part.v(apex);
    const inside = add(ctr[L], scale(sub(apex, ctr[L]), 0.1));
    const K = rings[L].length;
    for (let k = 0; k < K; k++) part.face([ids[L][k], ids[L][(k + 1) % K], a], R('apex', L, k), inside);
  } else if (capEnd) {
    part.face(ids[L], R('end', L, 0), ctr[L - 1]);
  }
  return ids;
}


// ---------- presets ----------

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
function merge(a, b) {
  const out = { ...a };
  for (const k in b) out[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k];
  return out;
}

const DOG = {
  kind: 'dog',
  head: { w: 1, h: 0.86, d: 0.8, front: 0.9, back: 0.66, cheek: 1.06,
    shape: { crown: 0.38, templeX: 0.82, templeY: 0.7, cheekY: 0.02, jaw: 0.86, jawY: -0.45, chin: 0.5 } },
  snout: { len: 0.32, w: 0.5, h: 0.34, taper: 0.86, lift: 0.05, drop: 0.02, bridge: 0.8, dip: 0.18 },
  ears: { type: 'drop', w: 0.3, len: 0.24, tilt: 0.7, h: 0.4, lean: 0.5, tip: 0.06, bulge: 0.04 },
  sit: { bh: 1.0, bw: 1.0, bd: 0.86, rings: [[0, 1, 1, 0], [1, 0.6, 0.62, -0.04]], headZ: 0.08, paw: { l: 0.26 } },
  stand: { L: 1.5, w: 0.68, h: 0.62, legH: 0.55, leg: 0.19, neck: 0.26, ruff: 1 },
  tail: { dir: [0.75, 0.8, -0.6], len: 0.62, tip: 0.08, bulge: 0, stand: 'hang' },
  face: { eyeR: 0.105, eyeSpace: 0.5, eyeGap: 0.05, eyeY: 0.05, iris: '#3b2618', slit: false,
    blush: true, tongue: false, nose: 'dog' },
  pattern: 'solid',
  colors: { base: '#e2bd7f', light: '#f4e3c3', dark: '#3b2a1e' },
};

const CAT = merge(DOG, {
  kind: 'cat',
  head: { w: 1, h: 0.8, d: 0.72, back: 0.62, cheek: 1.08,
    shape: { crown: 0.34, templeX: 0.84, templeY: 0.62, cheekY: -0.1, jaw: 0.7, jawY: -0.5, chin: 0.3 } },
  snout: { len: 0.12, w: 0.36, h: 0.22, taper: 0.9, lift: 0.1, drop: 0, bridge: 0.85, dip: 0.12 },
  ears: { type: 'erect', h: 0.36, lean: 0.45, tilt: 0.22, tip: 0.05, bulge: 0.02 },
  sit: { bh: 0.98, bw: 0.88, bd: 0.8, rings: [[0, 1, 1, 0], [1, 0.56, 0.6, -0.04]], paw: { l: 0.2 } },
  stand: { L: 1.3, w: 0.56, h: 0.52, legH: 0.5, leg: 0.15, neck: 0.18 },
  tail: { dir: [0.25, 1, -0.15], len: 0.95, tip: 0.06, stand: 'up' },
  face: { eyeR: 0.12, eyeSpace: 0.54, iris: '#a7b83c', slit: true, nose: 'cat' },
});

export const BREEDS = {
  frenchie: merge(DOG, {
    name: 'French Bulldog',
    head: { w: 1.08, h: 0.9, d: 0.78, back: 0.74, cheek: 1.08,
      shape: { crown: 0.5, templeX: 0.92, templeY: 0.74, jaw: 0.92, jawY: -0.4, chin: 0.6 } },
    snout: { len: 0.14, w: 0.58, h: 0.36, taper: 0.95, lift: 0.04, drop: 0 },
    ears: { type: 'erect', h: 0.5, lean: 0.55, tilt: 0.28, tip: 0.12, bulge: 0.12 },
    sit: { bh: 0.82, bw: 1.06, bd: 0.92, rings: [[0, 1, 1, 0], [0.55, 1.02, 1.0, 0], [1, 0.66, 0.66, -0.03]] },
    stand: { L: 1.15, w: 0.8, h: 0.66, legH: 0.36, leg: 0.22, neck: 0.16 },
    tail: { dir: [0.3, 0.7, -1], len: 0.14, tip: 0.06, stand: 'stub' },
    face: { eyeR: 0.12, eyeSpace: 0.58, tongue: true },
    pattern: 'frenchie',
    colors: { base: '#cfa57a', light: '#f3e9dc', dark: '#3a2d27' },
  }),
  lab: merge(DOG, {
    name: 'Labrador Retriever',
    snout: { len: 0.36 },
    ears: { w: 0.28, len: 0.22 },
    sit: { bh: 1.05 },
    tail: { len: 0.7 },
  }),
  golden: merge(DOG, {
    name: 'Golden Retriever',
    head: { h: 0.86, cheek: 1.1 },
    snout: { len: 0.34, w: 0.48 },
    ears: { w: 0.34, len: 0.32, tilt: 0.62 },
    sit: { bw: 1.04, rings: [[0, 1, 1, 0], [0.62, 1.0, 0.96, 0.02], [1, 0.62, 0.62, -0.04]] },
    stand: { ruff: 1.14 },
    tail: { len: 0.72, tip: 0.14, bulge: 0.08 },
    pattern: 'golden',
    colors: { base: '#d4974f', light: '#f0c88e', dark: '#5a3a1e' },
  }),
  gsd: merge(DOG, {
    name: 'German Shepherd',
    head: { w: 0.94, h: 0.86, d: 0.88, back: 0.62, shape: { crown: 0.3, templeX: 0.78, jaw: 0.76, chin: 0.38 } },
    snout: { len: 0.5, w: 0.42, h: 0.3, taper: 0.78, drop: 0.04 },
    ears: { type: 'erect', h: 0.6, lean: 0.72, tilt: 0.15, tip: 0.05, bulge: 0.03 },
    sit: { bh: 1.14, bw: 0.98, bd: 0.84, rings: [[0, 1, 1, 0], [1, 0.56, 0.6, -0.04]] },
    stand: { L: 1.6, w: 0.66, h: 0.62, legH: 0.6 },
    tail: { dir: [0.7, 0.25, -0.8], len: 0.78, tip: 0.1, bulge: 0.05 },
    pattern: 'saddle',
    colors: { base: '#b97a42', light: '#dcae75', dark: '#2b2321' },
  }),
  tabby: merge(CAT, {
    name: 'Tabby Shorthair',
    pattern: 'tabby',
    colors: { base: '#9a8670', light: '#ece2d2', dark: '#4a3d33' },
  }),
  siamese: merge(CAT, {
    name: 'Siamese',
    head: { w: 0.9, h: 0.82, d: 0.74, shape: { crown: 0.3, jaw: 0.6, chin: 0.2, cheekY: -0.05 } },
    snout: { len: 0.18, w: 0.3, h: 0.2, taper: 0.85, lift: 0.08 },
    ears: { h: 0.5, lean: 0.25, tilt: 0.2 },
    sit: { bh: 1.08, bw: 0.8, bd: 0.74, rings: [[0, 1, 1, 0], [1, 0.54, 0.6, -0.04]] },
    stand: { L: 1.35, w: 0.5, h: 0.48, legH: 0.56, leg: 0.13 },
    tail: { len: 1.0, tip: 0.05 },
    face: { iris: '#59a6e3', eyeR: 0.11 },
    pattern: 'points',
    colors: { base: '#efe4d2', light: '#fbf6ee', dark: '#4b372b' },
  }),
  persian: merge(CAT, {
    name: 'Persian',
    head: { w: 1.14, h: 0.92, d: 0.76, back: 0.72, cheek: 1.1,
      shape: { crown: 0.46, templeX: 0.9, templeY: 0.68, jaw: 0.9, jawY: -0.42, chin: 0.5 } },
    snout: { len: 0 },
    ears: { h: 0.17, lean: 0.3, tilt: 0.32, tip: 0.07 },
    sit: { bh: 0.9, bw: 1.12, bd: 1.0, rings: [[0, 0.84, 0.84, 0], [0.3, 1, 1, 0], [0.72, 0.9, 0.9, 0], [1, 0.62, 0.62, -0.03]] },
    stand: { L: 1.25, w: 0.74, h: 0.66, legH: 0.36, leg: 0.2, neck: 0.12 },
    tail: { dir: [0.5, 0.9, -0.3], len: 0.72, tip: 0.14, bulge: 0.08 },
    face: { iris: '#e0892b', eyeR: 0.14, eyeSpace: 0.6, eyeY: 0.06 },
    pattern: 'persian',
    colors: { base: '#ebe4da', light: '#fbf8f3', dark: '#8a7f74' },
  }),
};

export function withColors(preset, colors) {
  return merge(preset, { colors });
}

export function traits(p) {
  const t = [];
  const s = p.snout.len;
  t.push(s < 0.05 ? 'Flat face, nose on the face panel' : s < 0.2 ? 'Short muzzle' : s < 0.42 ? 'Medium muzzle' : 'Long muzzle');
  if (p.ears.type === 'drop') t.push(p.ears.len > 0.28 ? 'Long drop ears' : 'Drop ears');
  else t.push(p.ears.h > 0.55 ? 'Tall erect ears' : p.ears.h < 0.25 ? 'Small wide-set ears' : p.ears.bulge > 0.08 ? 'Big bat ears' : 'Erect ears');
  const sh = p.head.shape;
  t.push(sh.chin <= 0.25 ? 'Wedge-shaped head' : sh.crown >= 0.45 ? 'Broad, square head' : sh.chin <= 0.32 ? 'Triangular cat face' : 'Balanced head');
  const pat = { solid: 'Solid coat', golden: 'Solid coat, light feathering', frenchie: 'Dark mask, white chest',
    saddle: 'Black saddle and muzzle', tabby: 'Tabby stripes and forehead M', points: 'Colorpoint mask, ears, paws, tail',
    persian: 'Solid long coat' };
  t.push(pat[p.pattern] || p.pattern);
  return t;
}

// ---------- builders ----------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Where the eyes and nose sit on the structure, in head-local x/y (head center = 0).
// `prop` can override eye spacing and nose height with the pet's measured proportions.
export function faceLayout(p, prop = {}) {
  const W = p.head.w / 2, Hh = p.head.h / 2;
  const eyeX = clamp(prop.eyeX ?? p.face.eyeSpace * W * 0.9, W * 0.26, W * 0.52);
  const eyeY = Hh * 0.3; // roughly where the eye plane puts the eyes; sets the nose height
  const vN = prop.noseDrop ?? 0.42 + p.snout.len * 1.1;
  const noseY = eyeY - clamp(vN, 0.36, 1.25) * 2 * eyeX;
  return { W, Hh, eyeX, eyeY, noseY, eyes: [[-eyeX, eyeY], [eyeX, eyeY]], nose: [0, noseY] };
}

const DEG = Math.PI / 180;

// ---------- the head ----------
// A Pixar-style version of the breed's head, broken into flat panels. The breed alone
// sets the shape, so every dog of a breed folds into the same chunky, cute head; the
// photo only supplies what's printed on it.
//
// Rings of eight points run front to back, like the sketch: a round cranium in rows of
// four-sided panels, then the face plate, then a chunky rounded-box muzzle. Between the
// face ring and the muzzle's base, the two upper-corner panels are the eye cells and the
// top panel is the stop. The muzzle's rings are scaled copies of each other, so its
// sides are flat; a planarizing pass flattens the rest.
//
// Ring points, counter-clockwise from the top right: top-right, right-upper, right-lower,
// bottom-right, bottom-left, left-lower, left-upper, top-left.

function octRing(cx, cy, z, a, b, c1 = 0.42, c2 = 0.42) {
  return [[c1 * a, b], [a, c2 * b], [a, -c2 * b], [c1 * a, -b], [-c1 * a, -b], [-a, -c2 * b], [-a, c2 * b], [-c1 * a, b]]
    .map(([x, y]) => [cx + x, cy + y, z]);
}

// Nudge ring points until every quad between neighbouring rings, and both end caps, are
// flat, so each panel stays one face. Left and right stay mirrored. `fixed` rings (the
// muzzle, already flat by construction) don't move.
function planarize(rings, fixed = new Set(), iters = 1500) {
  const K = rings[0].length;
  const R = rings.map((r) => r.map((p) => p.slice()));
  const polys = [];
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < K; k++) polys.push([[i, k], [i, (k + 1) % K], [i + 1, (k + 1) % K], [i + 1, k]]);
  for (const i of [0, R.length - 1]) polys.push(R[i].map((_, k) => [i, k]));
  for (let it = 0; it < iters; it++) {
    const mv = R.map((r) => r.map(() => [0, 0, 0, 0]));
    for (const idx of polys) {
      const P = idx.map(([a, b]) => R[a][b]);
      const n = newell(P), c = centroid(P);
      idx.forEach(([a, b], j) => {
        const dd = dot(sub(P[j], c), n);
        const m = mv[a][b];
        m[0] -= n[0] * dd; m[1] -= n[1] * dd; m[2] -= n[2] * dd; m[3]++;
      });
    }
    for (let i = 0; i < R.length; i++) {
      if (fixed.has(i)) continue;
      for (let k = 0; k < K; k++) {
        const m = mv[i][k];
        if (m[3]) for (let j = 0; j < 3; j++) R[i][k][j] += (m[j] / m[3]) * 0.5;
      }
    }
    // mirror: point k and its partner across x = 0 (k <-> 7 - k for this ring order)
    for (const r of R) for (let k = 0; k < K / 2; k++) {
      const a = r[k], b = r[K - 1 - k];
      const x = (a[0] - b[0]) / 2, y = (a[1] + b[1]) / 2, z = (a[2] + b[2]) / 2;
      r[k] = [x, y, z]; r[K - 1 - k] = [-x, y, z];
    }
  }
  return R;
}

// The breed's Pixar head, in head units (half-width R ~ 0.5).
export function headShape(p) {
  const H = p.head, S = p.snout;
  const cat = p.kind === 'cat';
  const R = H.w / 2, ky = H.h / H.w, kz = H.d / H.w;
  // chunky, shortened muzzles, still in breed order: Shepherd > Lab > Frenchie > Persian
  const Lm = R * (0.16 + S.len * 1.15);
  const mw = R * (cat ? 0.36 : 0.5) * (S.w / (cat ? 0.36 : 0.5)) ** 0.6;
  const mh = R * (cat ? 0.28 : 0.38) * (S.h / (cat ? 0.22 : 0.34)) ** 0.6;
  return { R, ky, kz, Lm, mw, mh, cat, cheek: H.cheek };
}

function headRings(p, hc) {
  const { R, ky, kz, Lm, mw, mh, cat, cheek } = headShape(p);
  const [x0, y0, z0] = hc;
  const Ry = R * ky, Rz = R * kz;
  // cranium: rings around the front-back axis of a slightly squashed ball
  const ring = (deg, a = 1, b = 1, dy = 0) => {
    const t = deg * DEG;
    return octRing(x0, y0 + dy * Ry, z0 - Math.cos(t) * Rz, Math.sin(t) * R * a, Math.sin(t) * Ry * b);
  };
  const muzY = y0 - (cat ? 0.34 : 0.3) * Ry; // muzzle center at its base
  const faceZ = z0 + 0.66 * Rz, baseZ = faceZ + 0.1 * Rz;
  const rings = [
    ring(38, 1, 1, 0.08),
    ring(90, 1, 1, 0.02),
    ring(120, cheek, 0.98, -0.04),
    // face plate: wide, around the eyes and cheeks
    octRing(x0, y0 - 0.1 * Ry, faceZ, 0.8 * R * cheek, 0.74 * Ry, 0.5, 0.36),
    // muzzle: base, middle, nose; scaled copies so its sides are flat
    octRing(x0, muzY, baseZ, mw, mh, 0.5, 0.4),
    octRing(x0, muzY - 0.03 * Ry, baseZ + Lm * 0.55, mw * 0.96, mh * 0.96, 0.5, 0.4),
    octRing(x0, muzY - 0.06 * Ry, baseZ + Lm, mw * 0.82, mh * 0.84, 0.5, 0.4),
  ];
  return planarize(rings, new Set([4, 5, 6]));
}

// Make every face wind the same way as its neighbours (walking the mesh), then flip
// everything if the solid came out inside-out. More reliable than an inside point when
// a band of panels is nearly flat.
function orientConsistent(part) {
  const F = part.faces;
  const byEdge = new Map();
  F.forEach((f, fi) => f.v.forEach((a, k) => {
    const b = f.v[(k + 1) % f.v.length];
    const key = a < b ? a + '_' + b : b + '_' + a;
    if (!byEdge.has(key)) byEdge.set(key, []);
    byEdge.get(key).push(fi);
  }));
  const seen = new Array(F.length).fill(false);
  const dirOfEdge = (f, a, b) => { const k = f.v.indexOf(a); return f.v[(k + 1) % f.v.length] === b; };
  for (let s0 = 0; s0 < F.length; s0++) {
    if (seen[s0]) continue;
    seen[s0] = true;
    const q = [s0];
    while (q.length) {
      const fi = q.shift(), f = F[fi];
      f.v.forEach((a, k) => {
        const b = f.v[(k + 1) % f.v.length];
        for (const gi of byEdge.get(a < b ? a + '_' + b : b + '_' + a)) {
          if (gi === fi || seen[gi]) continue;
          if (dirOfEdge(F[gi], a, b)) F[gi].v.reverse();
          seen[gi] = true; q.push(gi);
        }
      });
    }
  }
  let vol = 0;
  for (const f of F) {
    const P = f.v.map((v) => part.verts[v]);
    for (let k = 1; k < P.length - 1; k++) vol += dot(P[0], cross(P[k], P[k + 1]));
  }
  if (vol < 0) F.forEach((f) => f.v.reverse());
}

function buildHead(parts, p, hc) {
  const E = p.ears;
  const F = faceLayout(p, {});
  const rings = headRings(p, hc);
  const head = new Part('Head', 'nose');
  const ids = loft(head, rings, (kind, i, k) => {
    if (kind === 'start') return 'head-back';
    if (kind === 'end') return 'nose';
    if (i >= 4) return 'muzzle';
    return 'head';
  });
  orientConsistent(head);
  parts.push(head);
  const faceWith = (a, b, c) => head.faces.findIndex((f) => [a, b, c].every((v) => f.v.includes(v)));
  // eye cells: the upper-corner panels between the face ring and the muzzle base
  const eyeFace = (k) => faceWith(ids[3][k], ids[3][(k + 1) % 8], ids[4][k]);
  const eyeR = eyeFace(0), eyeL = eyeFace(6);
  head.faces[eyeL].feature = 'eye-0';
  head.faces[eyeR].feature = 'eye-1';
  const quadCenter = (fi) => {
    const P = head.faces[fi].v.map((v) => head.verts[v]);
    // a little toward the face ring, away from the muzzle
    const c = centroid(P);
    const outer = centroid(P.filter((q) => rings[3].some((r) => len(sub(r, q)) < 1e-6)));
    return lerp(c, outer, 0.18);
  };
  const eyes = [quadCenter(eyeL), quadCenter(eyeR)];
  const nf = head.faces.findIndex((f) => f.role === 'nose');
  head.faces[nf].feature = 'nose';
  const nP = head.faces[nf].v.map((v) => head.verts[v]);
  const nC = centroid(nP);
  const nTop = nP.reduce((m2, q) => (q[1] > m2[1] ? q : m2), nP[0]);
  const nose = lerp(nC, [nC[0], nTop[1], nTop[2]], 0.3);

  // ears hinge on the crown ring (the one straight above the head's center)
  const r1 = ids[1], r2 = ids[2];
  const edgeHost = (a, b, other) => {
    const fi = faceWith(a, b, other);
    const v = head.faces[fi].v;
    let k = v.indexOf(a);
    if (v[(k + 1) % v.length] !== b) k = v.indexOf(b);
    return [fi, k];
  };
  for (const side of [-1, 1]) {
    if (E.type === 'erect') {
      // the upper-corner edge of the crown ring: ears rise from the top corners, facing front
      const [a, b] = side > 0 ? [r1[0], r1[1]] : [r1[6], r1[7]];
      const [fi, k] = edgeHost(a, b, side > 0 ? r2[0] : r2[7]);
      const L = len(sub(head.verts[head.faces[fi].v[(k + 1) % head.faces[fi].v.length]], head.verts[head.faces[fi].v[k]]));
      const h = E.h, tw = Math.max(0.04, E.tip || 0.05), c = L * 0.5;
      const bg = (E.bulge ?? 0.03) * h;
      head.flap(fi, k, [[0, 0], [L, 0], [L + bg, h * 0.45], [c + tw / 2, h], [c - tw / 2, h], [-bg, h * 0.45]],
        { dir: [side * (1 - E.lean) * 0.6, 1, -0.12], tip: 3, role: 'ear' });
    } else {
      // drop ears hinge on the front-to-back edge along the top of the skull's side, so
      // they fold down and hang along the cheeks
      const [a, b] = side > 0 ? [r1[1], r2[1]] : [r1[6], r2[6]];
      let fi = -1, cy = -Infinity;
      head.faces.forEach((f, i) => {
        if (!f.v.includes(a) || !f.v.includes(b)) return;
        const y = f.v.reduce((s2, v) => s2 + head.verts[v][1], 0) / f.v.length;
        if (y > cy) { cy = y; fi = i; }
      });
      const hv = head.faces[fi].v;
      let k = hv.indexOf(a);
      if (hv[(k + 1) % hv.length] !== b) k = hv.indexOf(b);
      const L = len(sub(head.verts[hv[(k + 1) % hv.length]], head.verts[hv[k]]));
      const h = (E.len || 0.24) + 0.26, w = Math.max(L * 0.9, E.w || 0.3);
      const fl = (w - L) / 2;
      head.flap(fi, k, [[0, 0], [L, 0], [L + fl, h * 0.6], [L * 0.72 + fl * 0.4, h], [L * 0.28 - fl * 0.4, h], [-fl, h * 0.6]],
        { dir: [side * 0.42, -1, 0.04], tip: 3, role: 'ear-drop', backRole: 'ear-back' });
    }
  }

  // hanging loop: standing straight up on the crown ring's top edge, dead center
  {
    const [fi, k] = edgeHost(r1[7], r1[0], r2[0]);
    const v = head.faces[fi].v;
    const L = len(sub(head.verts[v[(k + 1) % v.length]], head.verts[v[k]]));
    const top = Math.min(L * 0.6, 0.12), hh = 0.16;
    head.flap(fi, k, [[0, 0], [L, 0], [L / 2 + top / 2, hh], [L / 2 - top / 2, hh]], { dir: [0, 1, 0], tip: 2, role: 'hanger' });
  }

  const { R, ky } = headShape(p);
  return { center: hc, layout: F, ext: Math.max(R * 1.25, R * ky * 1.35), eyes, nose };
}

export function buildPet(p) {
  const parts = [];
  const hc = [0, p.head.h * 0.62, 0];
  const template = buildHead(parts, p, hc);
  return { parts, template, mode: 'head' };
}

export const STRUCTURES = { pixar: true };
