// Convex polyhedra from planes. Each plane is { n: unit normal, d } and keeps the side
// n . x <= d. The solid is what all the planes leave, so every face is exactly flat and
// is one panel of paper: no face can ever split into extra folds.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// support of an ellipse { c, u, v, a, b } (center, two in-plane unit axes, semi-axes)
export function ellipseSupport(e, d) {
  return dot(d, e.c) + Math.hypot(e.a * dot(d, e.u), e.b * dot(d, e.v));
}

// support of an axis-aligned ellipsoid at c with semi-axes r
export function ellipsoidSupport(c, r, d) {
  return dot(d, c) + Math.hypot(r[0] * d[0], r[1] * d[1], r[2] * d[2]);
}
// where a plane with normal d touches that ellipsoid
export function ellipsoidContact(c, r, d) {
  const h = Math.hypot(r[0] * d[0], r[1] * d[1], r[2] * d[2]) || 1;
  return [c[0] + (r[0] * r[0] * d[0]) / h, c[1] + (r[1] * r[1] * d[1]) / h, c[2] + (r[2] * r[2] * d[2]) / h];
}

export function polyFromPlanes(planes, eps = 1e-7) {
  const verts = [];
  const onPlanes = [];
  const find = (p) => verts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-6);
  const N = planes.length;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) for (let k = j + 1; k < N; k++) {
    const a = planes[i], b = planes[j], c = planes[k];
    const bc = cross(b.n, c.n);
    const det = dot(a.n, bc);
    if (Math.abs(det) < 1e-9) continue;
    const p = [0, 1, 2].map((t) => (a.d * bc[t] + b.d * cross(c.n, a.n)[t] + c.d * cross(a.n, b.n)[t]) / det);
    if (planes.some((q) => dot(q.n, p) > q.d + 1e-6)) continue;
    let vi = find(p);
    if (vi < 0) { vi = verts.length; verts.push(p); onPlanes.push(new Set()); }
    onPlanes[vi].add(i); onPlanes[vi].add(j); onPlanes[vi].add(k);
  }
  const faces = [];
  planes.forEach((pl, i) => {
    const ids = verts.map((_, vi) => vi).filter((vi) => onPlanes[vi].has(i));
    if (ids.length < 3) return;
    const c = ids.reduce((s, vi) => [s[0] + verts[vi][0] / ids.length, s[1] + verts[vi][1] / ids.length, s[2] + verts[vi][2] / ids.length], [0, 0, 0]);
    const u = norm(sub(verts[ids[0]], c));
    const w = cross(pl.n, u);
    ids.sort((p, q) => {
      const dp = sub(verts[p], c), dq = sub(verts[q], c);
      return Math.atan2(dot(dp, w), dot(dp, u)) - Math.atan2(dot(dq, w), dot(dq, u));
    });
    faces.push({ v: ids, plane: i });
  });
  return { verts, faces };
}
