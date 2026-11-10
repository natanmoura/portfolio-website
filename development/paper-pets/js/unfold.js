// Unfold closed meshes into nets, add glue tabs, and pack them onto a sheet.
import { sub, dot, cross, norm, newell, len } from './construct.js';

const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const c2 = (P) => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

function shrink(P, f) {
  const c = c2(P);
  return P.map((p) => [p[0] + (c[0] - p[0]) * f, p[1] + (c[1] - p[1]) * f]);
}

function convexOverlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const ax = [q[1] - p[1], p[0] - q[0]];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of A) { const d = v[0] * ax[0] + v[1] * ax[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const v of B) { const d = v[0] * ax[0] + v[1] * ax[1]; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 <= b0 + 1e-9 || b1 <= a0 + 1e-9) return false;
    }
  }
  return true;
}

const overlapsAny = (P, list) => { const s = shrink(P, 0.02); return list.some((Q) => convexOverlap(s, shrink(Q, 0.02))); };

// Try every face as the starting point and keep the net with the fewest pieces,
// preferring the part's root face on ties.
// If that still leaves stray pieces, retry with jittered edge priorities.
export function unfoldPart(part) {
  let best = null;
  const root = part.faces.findIndex((f) => f.role === part.rootRole);
  const order = part.faces.map((_, i) => i);
  if (root >= 0) { order.splice(root, 1); order.unshift(root); }
  for (const seed of order) {
    const u = unfoldFrom(part, seed);
    if (!best || u.islands.length < best.islands.length) best = u;
    if (best.islands.length === 1) return best;
  }
  let s = 12345;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let trial = 0; trial < 600 && best.islands.length > 1; trial++) {
    const seed = trial % 3 === 0 && root >= 0 ? root : order[Math.floor(rand() * order.length)];
    const spread = trial < 100 ? 0.9 : 1.6;
    const u = unfoldFrom(part, seed, () => 1 - spread / 2 + rand() * spread);
    if (u.islands.length < best.islands.length) best = u;
  }
  return best;
}

function unfoldFrom(part, firstSeed, jitter = null) {
  const { verts, faces } = part;
  const F = faces.map((f) => {
    const P = f.v.map((i) => verts[i]);
    const n = newell(P);
    const u = norm(sub(P[1], P[0]));
    const w = cross(n, u);
    const loc = P.map((p) => { const d = sub(p, P[0]); return [dot(d, u), dot(d, w)]; });
    return { n, P, loc, area: Math.abs(area2(loc)) / 2 };
  });
  const edges = new Map();
  faces.forEach((f, fi) => f.v.forEach((a, k) => {
    const b = f.v[(k + 1) % f.v.length];
    const key = edgeKey(a, b);
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ fi, k, a, b });
  }));

  const placed = new Array(faces.length).fill(null);
  const islands = [];
  const tree = new Set();
  let seed = firstSeed;

  while (seed !== -1) {
    const isl = islands.length;
    islands.push([seed]);
    placed[seed] = { pts: F[seed].loc.map((p) => p.slice()), island: isl };
    const cand = [];
    const push = (fi) => {
      const f = faces[fi];
      f.v.forEach((a, k) => {
        const b = f.v[(k + 1) % f.v.length];
        for (const use of edges.get(edgeKey(a, b))) {
          if (use.fi !== fi && !placed[use.fi]) {
            const g = faces[use.fi];
            const l = len(sub(verts[a], verts[b])) * (jitter ? jitter() : 1);
            cand.push({ from: fi, ia: k, ib: (k + 1) % f.v.length, to: use.fi, ja: g.v.indexOf(a), jb: g.v.indexOf(b), key: edgeKey(a, b), l });
          }
        }
      });
      // hinge links (flaps) always go first so they stay attached
      (part.links || []).forEach((L, li) => {
        let me, other;
        if (L.f1 === fi) { me = [L.a, L.b]; other = [L.f2, L.a2, L.b2]; }
        else if (L.f2 === fi) { me = [L.a2, L.b2]; other = [L.f1, L.a, L.b]; }
        else return;
        if (placed[other[0]]) return;
        const g = faces[other[0]];
        cand.push({ from: fi, ia: f.v.indexOf(me[0]), ib: f.v.indexOf(me[1]), to: other[0], ja: g.v.indexOf(other[1]), jb: g.v.indexOf(other[2]), key: `L${li}`, l: 1e9 });
      });
    };
    push(seed);
    while (cand.length) {
      let bi = 0;
      cand.forEach((c, i) => { if (c.l > cand[bi].l) bi = i; });
      const c = cand.splice(bi, 1)[0];
      if (placed[c.to]) continue;
      const A = placed[c.from].pts[c.ia], B = placed[c.from].pts[c.ib];
      const la = F[c.to].loc[c.ja], lb = F[c.to].loc[c.jb];
      const th = Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.atan2(lb[1] - la[1], lb[0] - la[0]);
      const ra = rot2(la, th);
      const pts = F[c.to].loc.map((p) => { const r = rot2(p, th); return [r[0] - ra[0] + A[0], r[1] - ra[1] + A[1]]; });
      if (overlapsAny(pts, islands[isl].map((fi) => placed[fi].pts))) continue;
      placed[c.to] = { pts, island: isl };
      islands[isl].push(c.to);
      tree.add(c.key);
      push(c.to);
    }
    seed = -1;
    let best = 0;
    F.forEach((x, i) => { if (!placed[i] && x.area > best) { best = x.area; seed = i; } });
  }
  return { part, F, placed, islands, edges, tree };
}

const SHEET = { w: 215.9, h: 279.4, margin: 9, top: 18, gap: 6 };
export { SHEET };

// Turn unfolded parts into a laid-out sheet in millimetres (y down).
export function layoutSheet(unfolds, startScale = 40) {
  let s = startScale;
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = tryLayout(unfolds, s);
    if (res) return res;
    s *= 0.94;
  }
  return tryLayout(unfolds, s, true);
}

function tryLayout(unfolds, s, force = false) {
  const faces = [];
  const islands = [];
  const cuts = [];
  const folds = [];
  let pairId = 1;

  for (const U of unfolds) {
    const base = faces.length;
    U.placed.forEach((pl, fi) => {
      const pf = U.part.faces[fi];
      faces.push({
        part: U.part, fi, role: pf.role, F: U.F[fi], flat: pf.flat || U.F[fi].P, photo: pf.photo, hinge: pf.hinge,
        pts: pl.pts.map(([x, y]) => [x * s, -y * s]),
        islandKey: `${U.part.name}#${pl.island}`,
      });
    });
    const tabsByIsland = new Map();
    U.islands.forEach((list, ii) => {
      islands.push({ key: `${U.part.name}#${ii}`, name: U.part.name + (U.islands.length > 1 ? ` ${String.fromCharCode(97 + ii)}` : ''),
        faces: list.map((fi) => faces[base + fi]), tabs: [], labels: [] });
      tabsByIsland.set(`${U.part.name}#${ii}`, islands[islands.length - 1]);
    });

    const linkEdges = new Set();
    (U.part.links || []).forEach((L, li) => {
      linkEdges.add(edgeKey(L.a, L.b)); linkEdges.add(edgeKey(L.a2, L.b2));
      const f1 = faces[base + L.f1], f2 = faces[base + L.f2];
      const v1 = U.part.faces[L.f1].v, v2 = U.part.faces[L.f2].v;
      const p1 = f1.pts[v1.indexOf(L.a)], q1 = f1.pts[v1.indexOf(L.b)];
      if (U.tree.has(`L${li}`)) {
        const n1 = f1.F.n, n2 = f2.F.n;
        if (dot(n1, n2) > 0.9995) return;
        const sign = dot(cross(n1, n2), sub(U.part.verts[L.b], U.part.verts[L.a]));
        const type = dot(n1, n2) < -0.99 ? 'mountain' : sign > 0 ? 'valley' : 'mountain';
        folds.push({ a: p1, b: q1, type, islandKey: f1.islandKey });
      } else {
        cuts.push({ a: p1, b: q1, islandKey: f1.islandKey });
        cuts.push({ a: f2.pts[v2.indexOf(L.a2)], b: f2.pts[v2.indexOf(L.b2)], islandKey: f2.islandKey });
      }
    });
    for (const [key, uses] of U.edges) {
      if (uses.length === 1 && !linkEdges.has(key)) {
        const f = faces[base + uses[0].fi], k = uses[0].k;
        cuts.push({ a: f.pts[k], b: f.pts[(k + 1) % f.pts.length], islandKey: f.islandKey });
        continue;
      }
      if (uses.length !== 2) continue;
      const [u1, u2] = uses;
      const f1 = faces[base + u1.fi], f2 = faces[base + u2.fi];
      const seg = (f, u) => [f.pts[u.k], f.pts[(u.k + 1) % f.pts.length]];
      const [p1, q1] = seg(f1, u1), [p2, q2] = seg(f2, u2);
      const coincide = f1.islandKey === f2.islandKey && Math.hypot(p1[0] - q2[0], p1[1] - q2[1]) < 1e-3 && Math.hypot(q1[0] - p2[0], q1[1] - p2[1]) < 1e-3;
      const n1 = f1.F.n, n2 = f2.F.n;
      if (U.tree.has(key) || coincide) {
        if (dot(n1, n2) > 0.9995) continue;
        const e = sub(U.part.verts[u1.b], U.part.verts[u1.a]);
        const sign = dot(cross(n1, n2), e);
        folds.push({ a: p1, b: q1, type: sign > 0 ? 'valley' : 'mountain', islandKey: f1.islandKey });
        continue;
      }
      const id = pairId++;
      const sides = [[f1, p1, q1], [f2, p2, q2]];
      let tab = null, tabSide = -1;
      for (const hmm of [3.2, 1.8]) {
        for (let si = 0; si < 2 && !tab; si++) {
          const [f, p, q] = sides[si];
          const isl = tabsByIsland.get(f.islandKey);
          const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (L < 4) continue;
          const d = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
          let nrm = [d[1], -d[0]];
          const fc = c2(f.pts), mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          if ((fc[0] - mid[0]) * nrm[0] + (fc[1] - mid[1]) * nrm[1] > 0) nrm = [-nrm[0], -nrm[1]];
          const h = Math.min(hmm, L * 0.35), ins = Math.min(h * 0.9, L * 0.3);
          const T = [p, q, [q[0] + nrm[0] * h - d[0] * ins, q[1] + nrm[1] * h - d[1] * ins], [p[0] + nrm[0] * h + d[0] * ins, p[1] + nrm[1] * h + d[1] * ins]];
          const others = isl.faces.map((x) => x.pts).concat(isl.tabs.map((t) => t.pts));
          if (!overlapsAny(T, others)) { tab = { pts: T, id }; tabSide = si; isl.tabs.push(tab); }
        }
        if (tab) break;
      }
      sides.forEach(([f, p, q], si) => {
        const isl = tabsByIsland.get(f.islandKey);
        cuts.push({ a: p, b: q, islandKey: f.islandKey });
        if (tab && si !== tabSide) {
          const fc = c2(f.pts), mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          const L = Math.hypot(fc[0] - mid[0], fc[1] - mid[1]) || 1;
          const off = Math.min(2.2, L * 0.5);
          isl.labels.push({ id, at: [mid[0] + (fc[0] - mid[0]) / L * off, mid[1] + (fc[1] - mid[1]) / L * off] });
        }
      });
    }
  }

  // orient each island: head upright, others minimum bounding box
  for (const isl of islands) {
    const pts = isl.faces.flatMap((f) => f.pts).concat(isl.tabs.flatMap((t) => t.pts));
    let ang = 0;
    const hf = isl.faces.find((f) => f.role === 'head-face');
    if (hf) {
      const fr = faceFrame(hf);
      ang = Math.atan2(-1, 0) - Math.atan2(fr.Y[1], fr.Y[0]);
    } else {
      let best = Infinity;
      for (let a = 0; a < Math.PI; a += Math.PI / 90) {
        const r = pts.map((p) => rot2(p, a));
        const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
        const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
        const tall = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs) ? 1.0001 : 1;
        if (area * tall < best) { best = area * tall; ang = a; }
      }
    }
    const R = (p) => rot2(p, ang);
    isl.faces.forEach((f) => { f.pts = f.pts.map(R); });
    isl.tabs.forEach((t) => { t.pts = t.pts.map(R); });
    isl.labels.forEach((l) => { l.at = R(l.at); });
    isl.rot = ang;
    const all = isl.faces.flatMap((f) => f.pts).concat(isl.tabs.flatMap((t) => t.pts));
    isl.min = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1]))];
    isl.size = [Math.max(...all.map((p) => p[0])) - isl.min[0], Math.max(...all.map((p) => p[1])) - isl.min[1]];
  }
  const rotOf = new Map(islands.map((i) => [i.key, i.rot]));
  for (const e of cuts.concat(folds)) { e.a = rot2(e.a, rotOf.get(e.islandKey)); e.b = rot2(e.b, rotOf.get(e.islandKey)); }

  // shelf pack
  const order = islands.slice().sort((a, b) => b.size[1] - a.size[1]);
  const W = SHEET.w - SHEET.margin * 2;
  let x = SHEET.margin, y = SHEET.top, rowH = 0;
  for (const isl of order) {
    if (isl.size[0] > W && !force) return null;
    if (x + isl.size[0] > SHEET.w - SHEET.margin) { x = SHEET.margin; y += rowH + SHEET.gap; rowH = 0; }
    isl.off = [x - isl.min[0], y + 3.5 - isl.min[1]];
    isl.box = [x, y, isl.size[0], isl.size[1] + 3.5];
    x += isl.size[0] + SHEET.gap;
    rowH = Math.max(rowH, isl.size[1] + 3.5);
  }
  if (y + rowH > SHEET.h - SHEET.margin && !force) return null;
  const offOf = new Map(islands.map((i) => [i.key, i.off]));
  const T = (p, k) => { const o = offOf.get(k); return [p[0] + o[0], p[1] + o[1]]; };
  for (const isl of islands) {
    isl.faces.forEach((f) => { f.pts = f.pts.map((p) => T(p, isl.key)); });
    isl.tabs.forEach((t) => { t.pts = t.pts.map((p) => T(p, isl.key)); });
    isl.labels.forEach((l) => { l.at = T(l.at, isl.key); });
  }
  for (const e of cuts.concat(folds)) { e.a = T(e.a, e.islandKey); e.b = T(e.b, e.islandKey); }
  return { scale: s, faces, islands, cuts, folds };
}

// Design frame for a placed face: origin at its centroid, X = model-unit right, Y = model-unit up
// (both as sheet-mm vectors). Up is world +Y projected onto the face.
export function faceFrame(face) {
  const { P, n } = face.F;
  let upW = [0, 1, 0];
  if (Math.abs(n[1]) > 0.92) upW = n[1] > 0 ? [0, 0, -1] : [0, 0, 1];
  const up = norm(sub(upW, [n[0] * dot(upW, n), n[1] * dot(upW, n), n[2] * dot(upW, n)]));
  const right = cross(up, n);
  let i2 = 2;
  const e1 = sub(P[1], P[0]);
  while (i2 < P.length - 1 && len(cross(e1, sub(P[i2], P[0]))) < 1e-6) i2++;
  const e2 = sub(P[i2], P[0]);
  const C0 = face.pts[0], C1 = face.pts[1], C2 = face.pts[i2];
  const g11 = dot(e1, e1), g12 = dot(e1, e2), g22 = dot(e2, e2), det = g11 * g22 - g12 * g12;
  const toSheet = (v) => {
    const b1 = dot(v, e1), b2 = dot(v, e2);
    const al = (b1 * g22 - b2 * g12) / det, be = (b2 * g11 - b1 * g12) / det;
    return [al * (C1[0] - C0[0]) + be * (C2[0] - C0[0]), al * (C1[1] - C0[1]) + be * (C2[1] - C0[1])];
  };
  const cW = P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length, s[2] + p[2] / P.length], [0, 0, 0]);
  const o = toSheet(sub(cW, P[0]));
  return { O: [C0[0] + o[0], C0[1] + o[1]], X: toSheet(right), Y: toSheet(up), up, right, c: cW, n };
}
