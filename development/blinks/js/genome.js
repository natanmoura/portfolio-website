import { S, E, C, B, T, H, evalPrims, primDist, primsBounds, scalePrim } from './sdf.js';

// Genome units: a newborn body is about 1 tall, bottom at y = 0, facing +z.
// Every shape is mirror symmetric across x = 0.
//
// Bodies are a few blended lobes, each tagged with a wobble group (0-3). The
// mesh carries per-vertex group weights so lobes can bob and lag on their own
// springs, which keeps the creatures reading as metaballs, not rigid shells.
//
// Growth stretches the body only. Parts, legs, arms and face keep their size
// and are re-seated on the bigger body.

const g = (p, grp) => ((p.g = grp), p);

const BODIES = {
  blob: {
    ranges: { w: [0.8, 1.05], h: [0.75, 1.0], d: [0.66, 0.84] },
    build: (p) => ({
      prims: [g(E(0, p.h * 0.42, 0, p.w / 2, p.h * 0.42, p.d / 2), 0), g(E(0, p.h * 0.6, 0, p.w * 0.4, p.h * 0.4, p.d * 0.4, 0.3), 1)],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.d / 2, faceY: p.h * 0.5, faceW: p.w * 0.6 },
    }),
  },
  tall: {
    ranges: { r: [0.29, 0.35], h: [1.0, 1.25], taper: [0.8, 1.05] },
    build: (p) => ({
      prims: [
        g(C(0, p.r, 0, 0, p.h * 0.5, 0, p.r, p.r * 0.97), 0),
        g(C(0, p.h * 0.45, 0, 0, p.h - p.r * p.taper, 0, p.r * 0.97, p.r * p.taper, 0.2), 1),
      ],
      desc: { topW: p.r * p.taper * 0.6, hw: p.r, hd: p.r, faceY: p.h * 0.62, faceW: p.r * 1.7 },
    }),
  },
  box: {
    ranges: { w: [0.68, 0.92], h: [0.62, 0.9], d: [0.52, 0.7], rd: [0.12, 0.2] },
    build: (p) => ({
      prims: [g(B(0, p.h / 2, 0, p.w / 2 - p.rd, p.h / 2 - p.rd, p.d / 2 - p.rd, p.rd), 0)],
      desc: { topW: p.w * 0.32, hw: p.w / 2, hd: p.d / 2, faceY: p.h * 0.55, faceW: p.w * 0.62 },
    }),
  },
  pear: {
    ranges: { r1: [0.36, 0.44], r2: [0.2, 0.27], h: [0.88, 1.08] },
    build: (p) => ({
      prims: [g(S(0, p.r1, 0, p.r1), 0), g(S(0, p.h - p.r2, 0, p.r2, 0.3), 1)],
      desc: { topW: p.r2 * 0.6, hw: p.r1, hd: p.r1, faceY: p.r1 * 1.05, faceW: p.r1 * 1.25 },
    }),
  },
  pig: {
    ranges: { w: [0.38, 0.46], h: [0.34, 0.42], len: [0.52, 0.66], head: [0.25, 0.31] },
    build: (p) => ({
      prims: [g(E(0, p.h, 0, p.w, p.h, p.len), 0), g(S(0, p.h * 1.25, p.len * 0.85, p.head, 0.16), 2)],
      desc: { topW: p.head * 0.6, partZ: p.len * 0.85, hw: p.w, hd: p.len + 0.1, faceY: p.h * 1.25, faceZ: p.len * 0.85, faceW: p.head * 1.6, legN: 4 },
    }),
  },
  twin: {
    ranges: { gap: [0.22, 0.28], r: [0.21, 0.26], h: [0.88, 1.08] },
    build: (p) => ({
      prims: [
        g(E(0, 0.28, 0, p.gap + p.r * 0.9, 0.28, p.r * 1.05), 0),
        g(E(-p.gap, p.h * 0.58, 0, p.r, p.h * 0.42, p.r, 0.14), 1),
        g(E(p.gap, p.h * 0.58, 0, p.r, p.h * 0.42, p.r, 0.14), 2),
      ],
      desc: { topW: p.gap, hw: p.gap + p.r, hd: p.r * 1.05, faceY: 0.32, faceW: (p.gap + p.r) * 1.2 },
    }),
  },
  drop: {
    ranges: { r: [0.36, 0.43], h: [1.0, 1.22] },
    build: (p) => ({
      prims: [g(S(0, p.r, 0, p.r), 0), g(C(0, p.r, 0, 0, p.h - 0.06, 0, p.r * 0.92, 0.06, 0.12), 1)],
      desc: { topW: 0.06, hw: p.r, hd: p.r, faceY: p.r * 0.95, faceW: p.r * 1.35 },
    }),
  },
  jelly: {
    ranges: { w: [0.82, 1.0], h: [0.8, 0.98], n: [5, 7] },
    build: (p) => {
      const prims = [g(E(0, p.h * 0.58, 0, p.w / 2, p.h * 0.42, p.w * 0.44), 0)];
      const n = Math.round(p.n);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 2;
        prims.push(g(S(Math.cos(a) * p.w * 0.38, p.h * 0.22, Math.sin(a) * p.w * 0.34, 0.15, 0.12), 1 + (i % 3)));
      }
      return { prims, desc: { topW: p.w * 0.25, hw: p.w / 2, hd: p.w * 0.44, faceY: p.h * 0.55, faceW: p.w * 0.6, legN: 4 } };
    },
  },
  donut: {
    ranges: { R: [0.3, 0.36], r: [0.15, 0.19] },
    build: (p) => {
      const cy = p.R + p.r;
      return {
        prims: [g(T(0, cy, 0, p.R, p.r), 0), g(S(0, p.r * 0.9, 0, p.r * 1.05, 0.12), 1)],
        desc: { topW: p.R * 0.6, hw: p.R + p.r, hd: p.r, faceY: cy - p.R * 0.95, faceW: p.R * 1.2 },
      };
    },
  },
  totem: {
    ranges: { r: [0.26, 0.32], n: [2, 3], shrink: [0.72, 0.85] },
    build: (p) => {
      const n = Math.round(p.n), prims = [];
      let y = p.r, r = p.r;
      const faceY = y;
      for (let i = 0; i < n; i++) {
        prims.push(g(S(0, y, 0, r, 0.1), i));
        const nr = r * p.shrink;
        y += r + nr * 0.75;
        r = nr;
      }
      return { prims, desc: { topW: r * 0.6, hw: p.r, hd: p.r, faceY, faceW: p.r * 1.6 } };
    },
  },
  vee: {
    ranges: { spread: [0.28, 0.38], h: [0.9, 1.1], r: [0.19, 0.23] },
    build: (p) => ({
      prims: [
        g(S(0, 0.3, 0, 0.3), 0),
        g(C(0, 0.3, 0, -p.spread, p.h - p.r, 0, p.r * 1.1, p.r, 0.14), 1),
        g(C(0, 0.3, 0, p.spread, p.h - p.r, 0, p.r * 1.1, p.r, 0.14), 2),
      ],
      desc: { topW: p.spread, hw: p.spread + p.r, hd: 0.3, faceY: 0.34, faceW: 0.55 },
    }),
  },
  bowtie: {
    ranges: { r: [0.28, 0.33], side: [0.22, 0.27], off: [0.38, 0.46] },
    build: (p) => ({
      prims: [
        g(S(0, p.r + 0.02, 0, p.r), 0),
        g(S(-p.off, p.r + 0.1, 0, p.side, 0.12), 1),
        g(S(p.off, p.r + 0.1, 0, p.side, 0.12), 2),
      ],
      desc: { topW: p.r * 0.5, hw: p.off + p.side, hd: p.r, faceY: p.r, faceW: p.r * 1.5 },
    }),
  },
  signpost: {
    ranges: { w: [0.62, 0.78], hh: [0.42, 0.52], neck: [0.3, 0.42] },
    build: (p) => ({
      prims: [
        g(C(0, 0.14, 0, 0, p.neck + 0.1, 0, 0.14, 0.12), 0),
        g(B(0, p.neck + p.hh * 0.5 + 0.08, 0, p.w / 2 - 0.08, p.hh / 2 - 0.08, 0.12, 0.08, 0.06), 1),
      ],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: 0.2, faceY: p.neck + p.hh * 0.5 + 0.08, faceW: p.w * 0.7 },
    }),
  },
  lungs: {
    ranges: { gap: [0.18, 0.23], r: [0.2, 0.24], h: [0.9, 1.05] },
    build: (p) => ({
      prims: [
        g(E(0, 0.28, 0, p.gap + p.r * 0.6, 0.24, p.r * 0.9), 0),
        g(E(-p.gap, p.h * 0.5, 0, p.r, p.h * 0.48, p.r, 0.1), 1),
        g(E(p.gap, p.h * 0.5, 0, p.r, p.h * 0.48, p.r, 0.1), 2),
      ],
      desc: { topW: p.gap, hw: p.gap + p.r, hd: p.r, faceY: p.h * 0.42, faceW: (p.gap + p.r) * 1.2 },
    }),
  },
  crab: {
    ranges: { r: [0.38, 0.45], ball: [0.14, 0.18] },
    build: (p) => ({
      prims: [
        g(E(0, p.r * 0.95, 0, p.r * 1.05, p.r * 0.85, p.r * 0.85), 0),
        g(S(-p.r * 0.95, p.r * 1.55, 0, p.ball, 0.08), 2),
        g(S(p.r * 0.95, p.r * 1.55, 0, p.ball, 0.08), 3),
      ],
      desc: { topW: p.r * 0.35, hw: p.r * 1.05, hd: p.r * 0.85, faceY: p.r * 0.9, faceW: p.r * 1.4 },
    }),
  },
  peanut: {
    ranges: { r: [0.3, 0.36], gap: [0.22, 0.3] },
    build: (p) => ({
      prims: [g(S(-p.gap, p.r, 0, p.r), 0), g(S(p.gap, p.r, 0, p.r, 0.18), 1)],
      desc: { topW: p.r * 0.5, hw: p.gap + p.r, hd: p.r, faceY: p.r * 1.1, faceW: p.r * 1.4 },
    }),
  },
  onion: {
    ranges: { r: [0.36, 0.42], tip: [0.32, 0.46] },
    build: (p) => ({
      prims: [g(S(0, p.r, 0, p.r), 0), g(C(0, p.r * 1.2, 0, 0, p.r * 2 + p.tip, 0, p.r * 0.6, 0.05, 0.22), 1)],
      desc: { topW: 0.08, hw: p.r, hd: p.r, faceY: p.r * 0.95, faceW: p.r * 1.3 },
    }),
  },
  hourglass: {
    ranges: { r1: [0.32, 0.38], r2: [0.28, 0.34], waist: [0.1, 0.15] },
    build: (p) => {
      const top = p.r1 * 2 + p.r2 * 0.9;
      return {
        prims: [g(S(0, p.r1, 0, p.r1), 0), g(C(0, p.r1, 0, 0, top, 0, p.waist, p.waist, 0.12), 2), g(S(0, top, 0, p.r2, 0.12), 1)],
        desc: { topW: p.r2 * 0.6, hw: p.r1, hd: p.r1, faceY: top, faceW: p.r2 * 1.4 },
      };
    },
  },
  tiers: {
    ranges: { w: [0.75, 0.9], step: [0.24, 0.3] },
    build: (p) => {
      const prims = [];
      for (let i = 0; i < 3; i++) {
        const w = p.w * (1 - i * 0.22);
        prims.push(g(B(0, p.step * (i + 0.5), 0, w / 2 - 0.1, p.step / 2 - 0.08, w * 0.35 - 0.1, 0.1, 0.1), i));
      }
      return { prims, desc: { topW: p.w * 0.25, hw: p.w / 2, hd: p.w * 0.35, faceY: p.step * 1.5, faceW: p.w * 0.5 } };
    },
  },
  heart: {
    ranges: { r: [0.26, 0.31], h: [0.9, 1.05] },
    build: (p) => ({
      prims: [
        g(S(-p.r * 0.78, p.h - p.r, 0, p.r), 1),
        g(S(p.r * 0.78, p.h - p.r, 0, p.r, 0.1), 2),
        g(C(0, p.h - p.r * 1.3, 0, 0, 0.12, 0, p.r * 1.25, 0.1, 0.16), 0),
      ],
      desc: { topW: p.r, hw: p.r * 1.78, hd: p.r, faceY: p.h * 0.6, faceW: p.r * 1.6 },
    }),
  },
  star: {
    ranges: { r: [0.3, 0.35], arm: [0.14, 0.17], reach: [0.38, 0.46] },
    build: (p) => {
      const cy = p.r + p.reach * 0.75;
      const prims = [g(E(0, cy, 0, p.r, p.r, p.r * 0.75), 0)];
      [90, 162, 18, 234, 306].forEach((deg, i) => {
        const a = (deg * Math.PI) / 180;
        prims.push(g(C(0, cy, 0, Math.cos(a) * p.reach, cy + Math.sin(a) * p.reach, 0, p.arm * 1.4, p.arm, 0.1), 1 + Math.min(i, 2)));
      });
      return { prims, desc: { topW: p.arm, hw: p.reach + p.arm, hd: p.r * 0.75, faceY: cy, faceW: p.r * 1.2 } };
    },
  },
  dumbbell: {
    ranges: { r: [0.27, 0.32], neck: [0.08, 0.11], len: [0.42, 0.55] },
    build: (p) => {
      const top = p.r * 2 + p.len;
      return {
        prims: [g(S(0, p.r, 0, p.r), 0), g(C(0, p.r, 0, 0, top - p.r, 0, p.neck, p.neck, 0.1), 2), g(S(0, top - p.r, 0, p.r, 0.1), 1)],
        desc: { topW: p.r * 0.6, hw: p.r, hd: p.r, faceY: top - p.r, faceW: p.r * 1.5 },
      };
    },
  },
  loaf: {
    ranges: { w: [0.9, 1.1], h: [0.55, 0.7], bump: [0.17, 0.21] },
    build: (p) => {
      const prims = [g(B(0, p.h * 0.4, 0, p.w / 2 - 0.14, p.h * 0.4 - 0.14, 0.32 - 0.14, 0.14), 0)];
      [-1, 0, 1].forEach((i) => prims.push(g(S(i * p.w * 0.3, p.h * 0.8, 0, p.bump, 0.1), 1 + Math.abs(i))));
      return { prims, desc: { topW: p.w * 0.35, hw: p.w / 2, hd: 0.32, faceY: p.h * 0.45, faceW: p.w * 0.5 } };
    },
  },
  gourd: {
    ranges: { r: [0.36, 0.42], neck: [0.1, 0.13], h: [1.05, 1.25] },
    build: (p) => ({
      prims: [
        g(S(0, p.r, 0, p.r), 0),
        g(C(0, p.r * 1.6, 0, 0, p.h - 0.12, 0, p.neck * 1.5, p.neck, 0.14), 1),
        g(S(0, p.h - 0.12, 0, p.neck * 1.6, 0.08), 2),
      ],
      desc: { topW: p.neck, hw: p.r, hd: p.r, faceY: p.r * 1.0, faceW: p.r * 1.3 },
    }),
  },
  bubbles: {
    ranges: { r: [0.22, 0.26], spread: [0.22, 0.28] },
    build: (p) => {
      const prims = [g(S(0, p.r * 1.3, 0, p.r * 1.3), 0)];
      [[1, 0.9, 0.85], [1, 2.1, 0.7], [0, 2.6, 0.8]].forEach(([sx, y, s], i) => {
        if (sx) {
          prims.push(g(S(-p.spread * 1.3, p.r * y, 0, p.r * s, 0.1), 1 + i));
          prims.push(g(S(p.spread * 1.3, p.r * y, 0, p.r * s, 0.1), 1 + i));
        } else prims.push(g(S(0, p.r * y + p.r * 0.4, 0, p.r * s, 0.1), 3));
      });
      return { prims, desc: { topW: p.r * 0.6, hw: p.spread * 1.3 + p.r, hd: p.r * 1.3, faceY: p.r * 1.4, faceW: p.r * 2 } };
    },
  },
  pill: {
    ranges: { len: [0.3, 0.42], r: [0.3, 0.36] },
    build: (p) => ({
      prims: [g(C(-p.len / 2, p.r, 0, p.len / 2, p.r, 0, p.r, p.r), 0)],
      desc: { topW: p.len * 0.5, hw: p.len / 2 + p.r, hd: p.r, faceY: p.r * 1.05, faceW: p.r * 1.5 },
    }),
  },
  arch: {
    ranges: { R: [0.3, 0.36], r: [0.15, 0.18] },
    // A rainbow standing on its two ends: one smooth bent tube. Many short
    // capsules of equal radius joined with a hard union meet exactly, so the
    // tube stays even with no blobby joints.
    build: (p) => {
      const n = 16, cy = p.r;
      const pt = (i) => { const a = (i / n) * Math.PI; return [Math.cos(a) * p.R, cy + Math.sin(a) * p.R]; };
      const prims = [];
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pt(i), [bx, by] = pt(i + 1);
        prims.push(g(C(ax, ay, 0, bx, by, 0, p.r, p.r, 0), i < n / 2 ? 1 : 2));
      }
      return { prims, desc: { topW: p.R * 0.6, hw: p.R + p.r, hd: p.r, faceY: cy + p.R, faceW: p.R * 1.1, stance: p.R / (p.R + p.r) } };
    },
  },
  bigbottom: {
    ranges: { r: [0.48, 0.56], head: [0.13, 0.16] },
    build: (p) => ({
      prims: [g(E(0, p.r * 0.8, 0, p.r, p.r * 0.8, p.r * 0.85), 0), g(S(0, p.r * 1.6 + p.head * 0.6, 0, p.head, 0.08), 1)],
      desc: { topW: p.head, hw: p.r, hd: p.r * 0.85, faceY: p.r * 0.9, faceW: p.r * 1.1 },
    }),
  },
  wobbletower: {
    ranges: { a: [0.2, 0.24], b: [0.36, 0.42], c: [0.16, 0.19] },
    build: (p) => {
      const y2 = p.a * 2 + p.b * 0.75, y3 = y2 + p.b + p.c * 0.6;
      return {
        prims: [g(S(0, p.a, 0, p.a), 0), g(S(0, y2, 0, p.b, 0.1), 1), g(S(0, y3, 0, p.c, 0.08), 2)],
        desc: { topW: p.c * 0.6, hw: p.b, hd: p.b, faceY: y2, faceW: p.b * 1.3, stance: 0.4 },
      };
    },
  },
  halo: {
    ranges: { r: [0.36, 0.42], R: [0.24, 0.3] },
    build: (p) => ({
      // A ball wearing a ring floating flat over its head, like a halo.
      prims: [g(S(0, p.r, 0, p.r), 0), g(H(0, p.r * 2 + 0.16, 0, p.R, 0.09, 0.06), 1)],
      desc: { topW: 0.05, hw: p.r, hd: p.r, faceY: p.r * 1.05, faceW: p.r * 1.3 },
    }),
  },
};

const X_FIELDS = ['topW', 'hw', 'hd', 'faceW', 'partZ', 'faceZ'];
const Y_FIELDS = ['faceY'];

// Parts are chunky on purpose so silhouettes stay clean and readable.
const PARTS = {
  roundEars: {
    group: 'top', ranges: { r: [0.14, 0.2], spread: [0.7, 1.0] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const x = s * Math.min(q.topW * p.spread + p.r * 0.4, q.hw * 0.8);
      const y = q.surfTop(x, q.partZ);
      return y == null ? [] : [g(S(x, y - p.r * 0.2, q.partZ, p.r, 0.06), 2)];
    }),
  },
  pointyEars: {
    group: 'top', ranges: { len: [0.26, 0.36], r: [0.12, 0.16], splay: [0.15, 0.45], spread: [0.7, 1.0] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const x = s * Math.min(q.topW * p.spread + 0.04, q.hw * 0.8);
      const y = q.surfTop(x, q.partZ);
      if (y == null) return [];
      return [g(C(x, y - 0.06, q.partZ, x + s * Math.sin(p.splay) * p.len, y - 0.06 + Math.cos(p.splay) * p.len, q.partZ, p.r, 0.05, 0.06), 2)];
    }),
  },
  bunnyEars: {
    group: 'top', ranges: { len: [0.38, 0.52], r: [0.095, 0.12], splay: [0.05, 0.28], spread: [0.45, 0.8] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const x = s * Math.min(q.topW * p.spread + 0.05, q.hw * 0.7);
      const y = q.surfTop(x, q.partZ);
      if (y == null) return [];
      return [g(C(x, y - 0.06, q.partZ, x + s * Math.sin(p.splay) * p.len, y - 0.06 + Math.cos(p.splay) * p.len, q.partZ - 0.04, p.r, p.r * 0.9, 0.06), 2)];
    }),
  },
  antennae: {
    group: 'top', ranges: { len: [0.24, 0.34], ball: [0.1, 0.13], splay: [0.2, 0.5], spread: [0.4, 0.75] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const x = s * (q.topW * p.spread + 0.04);
      const y = q.surfTop(x, q.partZ);
      if (y == null) return [];
      const tx = x + s * Math.sin(p.splay) * p.len, ty = y + Math.cos(p.splay) * p.len;
      return [g(C(x, y - 0.04, q.partZ, tx, ty, q.partZ, 0.06, 0.055, 0.04), 2), g(S(tx, ty, q.partZ, p.ball, 0.03), 2)];
    }),
  },
  sprout: {
    group: 'top', ranges: { len: [0.14, 0.22], leaf: [0.12, 0.16] },
    build: (p, q) => {
      const y = q.surfTop(0, q.partZ);
      if (y == null) return [];
      const ty = y + p.len;
      return [
        g(C(0, y - 0.04, q.partZ, 0, ty, q.partZ, 0.06, 0.055, 0.05), 2),
        ...[-1, 1].map((s) => g(E(s * p.leaf * 0.8, ty + p.leaf * 0.35, q.partZ, p.leaf, p.leaf * 0.5, p.leaf * 0.55, 0.04), 2)),
      ];
    },
  },
  tuft: {
    group: 'top', ranges: { r: [0.1, 0.13] },
    build: (p, q) => [-1, 0, 1].flatMap((o) => {
      const x = o * p.r * 1.3;
      const y = q.surfTop(x, q.partZ);
      return y == null ? [] : [g(S(x, y + p.r * (o ? 0 : 0.3), q.partZ, p.r * (o ? 0.85 : 1), 0.05), o ? 3 : 2)];
    }),
  },
  bump: {
    group: 'top', ranges: { r: [0.17, 0.25] },
    build: (p, q) => {
      const y = q.surfTop(0, q.partZ);
      return y == null ? [] : [g(S(0, y + p.r * 0.5, q.partZ, p.r, 0.1), 2)];
    },
  },
  horns: {
    group: 'top', ranges: { len: [0.18, 0.26], r: [0.1, 0.13], spread: [0.5, 0.9] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const x = s * (q.topW * p.spread + 0.05);
      const y = q.surfTop(x, q.partZ);
      if (y == null) return [];
      return [g(C(x, y - 0.05, q.partZ, x + s * p.len * 0.6, y + p.len, q.partZ + 0.05, p.r, 0.04, 0.05), 2)];
    }),
  },
  frills: {
    group: 'top', ranges: { len: [0.14, 0.19] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const yb = q.faceY + 0.04 + i * 0.08;
        const xb = q.surfSide(yb, s, q.partZ);
        if (xb == null) continue;
        const a = 0.1 + i * 0.42;
        const tx = xb + s * Math.cos(a) * p.len, ty = yb + Math.sin(a) * p.len;
        out.push(g(C(xb - s * 0.03, yb, q.partZ, tx, ty, q.partZ, 0.06, 0.055, 0.04), 2), g(S(tx, ty, q.partZ, 0.075, 0.02), 2));
      }
      return out;
    }),
  },
  sideEars: {
    group: 'top', ranges: { r: [0.13, 0.18], y: [0.55, 0.75] },
    build: (p, q) => [-1, 1].flatMap((s) => {
      const y = q.h * p.y;
      const x = q.surfSide(y, s, q.partZ);
      return x == null ? [] : [g(E(x + s * p.r * 0.45, y, q.partZ, p.r * 0.75, p.r, p.r * 0.55, 0.05), 2)];
    }),
  },
  tail: {
    group: 'back', ranges: { len: [0.16, 0.24], r: [0.065, 0.08], up: [0.3, 1.0], ball: [0, 1] },
    build: (p, q) => {
      const y = q.h * 0.3;
      const z0 = q.surfBack(y);
      if (z0 == null) return [];
      const ty = y + Math.sin(p.up) * p.len, tz = z0 - Math.cos(p.up) * p.len;
      const out = [g(C(0, y, z0 + 0.04, 0, ty, tz, p.r, p.r * 0.8, 0.05), 3)];
      if (p.ball > 0.5) out.push(g(S(0, ty, tz, p.r * 1.6, 0.03), 3));
      return out;
    },
  },
  spikes: {
    group: 'back', ranges: { n: [3, 4], h: [0.11, 0.15] },
    build: (p, q) => {
      const n = Math.round(p.n), out = [];
      for (let i = 0; i < n; i++) {
        const z = q.partZ + 0.08 - i * 0.13;
        const y = q.surfTop(0, z);
        if (y != null) out.push(g(C(0, y - 0.04, z, 0, y + p.h, z - 0.06, 0.08, 0.03, 0.04), 3));
      }
      return out;
    },
  },
  // Arms are animated limbs, not part of the body field.
  arms: { group: 'limb', ranges: { y: [0.38, 0.55] }, build: () => [] },
};

export const LEG_SIZES = [0.26, 0.52, 1.04];
// Arms are a quarter shorter than the shortest legs.
export const ARM_LEN = LEG_SIZES[0] * 0.75 * 2;
function pickLegs(r) {
  const x = r.next();
  return x < 0.35 ? LEG_SIZES[0] : x < 0.85 ? LEG_SIZES[1] : LEG_SIZES[2];
}
const BODY_TYPES = Object.keys(BODIES);
export { BODIES, PARTS, OFF_PARTS };
// Parts Natan has turned off. They stay defined so the picker can show them.
const OFF_PARTS = ['tail'];
const LIVE_PARTS = Object.keys(PARTS).filter((k) => !OFF_PARTS.includes(k));
const TOP_PARTS = LIVE_PARTS.filter((k) => PARTS[k].group === 'top');
// Arms can be switched off here. Only two-legged creatures ever get them.
const ARMS_ON = true;
const OTHER_PARTS = LIVE_PARTS.filter((k) => PARTS[k].group !== 'top' && (ARMS_ON || k !== 'arms'));

function sample(ranges, r) {
  const p = {};
  for (const k in ranges) p[k] = r.range(ranges[k][0], ranges[k][1]);
  return p;
}

function jitter(p, ranges, r, amt = 0.12) {
  const out = {};
  for (const k in ranges) {
    const [lo, hi] = ranges[k];
    const span = hi - lo;
    const v = p[k] ?? (lo + hi) / 2;
    out[k] = Math.min(hi + span * 0.15, Math.max(lo - span * 0.15, v + r.range(-amt, amt) * span));
  }
  return out;
}

const makePart = (type, r) => ({ type, p: sample(PARTS[type].ranges, r) });
const groupOf = (t) => PARTS[t].group;

// ---------- colour ----------

export function hsl(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function makePalette(r, hue) {
  const s = r.range(0.68, 0.92);
  const l = r.range(0.54, 0.64);
  return {
    base: [hue, s, l],
    cols: [
      [hue + r.range(-5, 5), s, l + 0.08],
      [hue + r.range(-5, 5), Math.min(1, s * 1.05), l - 0.08],
      [hue, s * 0.95, Math.min(0.8, l + 0.14)],
    ],
  };
}

function makeBlobs(r) {
  return [0, 1, 2, 3].map(() => ({
    f: [r.range(0.3, 0.75), r.range(0.3, 0.75), r.range(0.3, 0.75)],
    ph: [r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28)],
    amp: r.range(0.35, 0.55),
    r: r.range(0.45, 0.7),
  }));
}

function makeFace(r) {
  return { gap: r.range(0, 1), eye: r.range(0.85, 1.15), mouth: r.range(0.8, 1.2), seed: r.int(1, 1e9) };
}

function makeGrowth(r, has) {
  const out = [];
  const tops = TOP_PARTS.filter((t) => !has.includes(t));
  const others = OTHER_PARTS.filter((t) => !has.includes(t) && !has.some((h) => groupOf(h) === groupOf(t)));
  if (r.chance(0.55) && !has.some((t) => groupOf(t) === 'top')) out.push({ at: r.range(0.25, 0.45), ...makePart(r.pick(tops), r) });
  if (r.chance(0.5) && others.length) out.push({ at: r.range(0.55, 0.8), ...makePart(r.pick(others), r) });
  return out;
}

let nextId = 1;

export function randomGenome(r, opts = {}) {
  const type = opts.body || r.pick(BODY_TYPES);
  const parts = [];
  const nParts = opts.nParts ?? (r.chance(0.3) ? 0 : r.chance(0.6) ? 1 : 2);
  if (nParts >= 1) parts.push(makePart(opts.top || r.pick(TOP_PARTS), r));
  if (nParts >= 2) parts.push(makePart(r.pick(OTHER_PARTS), r));
  const has = parts.map((p) => p.type);
  return {
    id: nextId++,
    gen: 1,
    body: { type, p: sample(BODIES[type].ranges, r) },
    parts,
    growth: makeGrowth(r, has),
    palette: makePalette(r, opts.hue ?? r.range(0, 360)),
    legs: { len: pickLegs(r) },
    face: makeFace(r),
    blobs: makeBlobs(r),
  };
}

export function seedPopulation(r, n) {
  const start = r.range(0, 360);
  const hues = r.shuffle(Array.from({ length: n }, (_, i) => start + (i * 360) / n + r.range(-12, 12)));
  let bodies = [], tops = [];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!bodies.length) bodies = r.shuffle(BODY_TYPES);
    if (!tops.length) tops = r.shuffle(TOP_PARTS);
    out.push(randomGenome(r, { hue: hues[i], body: bodies.pop(), top: tops.pop(), nParts: i % 3 === 0 ? 0 : i % 3 }));
  }
  return out;
}

export function breed(a, b, r) {
  const src = r.chance(0.5) ? a : b;
  let body = { type: src.body.type, p: jitter(src.body.p, BODIES[src.body.type].ranges, r) };
  if (r.chance(0.15)) {
    const type = r.pick(BODY_TYPES);
    body = { type, p: sample(BODIES[type].ranges, r) };
  }

  const pool = r.shuffle([...a.parts, ...b.parts].filter((p) => PARTS[p.type]));
  const parts = [];
  for (const part of pool) {
    if (parts.some((q) => groupOf(q.type) === groupOf(part.type))) continue;
    if (r.chance(0.6)) parts.push({ type: part.type, p: jitter(part.p, PARTS[part.type].ranges, r) });
  }
  if (r.chance(0.2)) {
    const t = r.pick(LIVE_PARTS);
    if (!parts.some((q) => groupOf(q.type) === groupOf(t))) parts.push(makePart(t, r));
  }

  const [pa, pb] = r.chance(0.5) ? [a.palette, b.palette] : [b.palette, a.palette];
  const tweak = ([h, s, l]) => [h + r.range(-6, 6), Math.min(1, Math.max(0.15, s + r.range(-0.05, 0.05))), Math.min(0.72, Math.max(0.46, l + r.range(-0.04, 0.04)))];
  const pick = (p) => r.pick([p.base, ...p.cols]);
  const palette = {
    base: tweak(pa.base),
    cols: [tweak(pick(pb)), tweak(pick(pa)), tweak(pick(pb))],
  };
  if (r.chance(0.1)) palette.cols[r.int(0, 2)] = [r.range(0, 360), r.range(0.7, 0.9), r.range(0.55, 0.65)];

  const has = parts.map((p) => p.type);
  return {
    id: nextId++,
    gen: Math.max(a.gen, b.gen) + 1,
    body,
    parts,
    growth: makeGrowth(r, has),
    palette,
    legs: { len: (r.chance(0.5) ? a : b).legs.len },
    face: { ...(r.chance(0.5) ? a.face : b.face), seed: r.int(1, 1e9) },
    blobs: makeBlobs(r),
  };
}

// ---------- compile ----------

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function growthScale(t) {
  const e = Math.pow(t, 0.85);
  return { w: 1 + 1.1 * e, h: 1 + 2 * e };
}

// Soft membership of a point in each wobble group. Matches the per-vertex
// weights the worker bakes, so anchors move with the surface under them.
export function groupWeights(prims, x, y, z, out = [0, 0, 0, 0]) {
  const d = [Infinity, Infinity, Infinity, Infinity];
  for (const p of prims) {
    const v = primDist(p, x, y, z);
    if (v < d[p.g || 0]) d[p.g || 0] = v;
  }
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    out[i] = d[i] === Infinity ? 0 : Math.exp(-Math.max(d[i], 0) * 14);
    sum += out[i];
  }
  for (let i = 0; i < 4; i++) out[i] = sum > 0 ? out[i] / sum : i === 0 ? 1 : 0;
  return out;
}

function queries(prims, bounds) {
  const f = (x, y, z) => evalPrims(prims, x, y, z);
  return {
    surfTop(x, z) {
      for (let y = bounds.max[1] + 0.05; y > bounds.min[1]; y -= 0.01) if (f(x, y, z) < 0) return y;
      return null;
    },
    surfBottom(x, z) {
      for (let y = bounds.min[1] - 0.05; y < bounds.max[1]; y += 0.01) if (f(x, y, z) < 0) return y;
      return null;
    },
    surfSide(y, s, z) {
      if (f(0, y, z) >= 0) return null;
      for (let x = 0; Math.abs(x) < 3; x += s * 0.01) if (f(x, y, z) >= 0) return x;
      return null;
    },
    surfBack(y) {
      if (f(0, y, 0) >= 0) return null;
      for (let z = 0; z > -3; z -= 0.01) if (f(0, y, z) >= 0) return z;
      return null;
    },
  };
}

export const MIN_PART_R = 0.085;
function thicken(p) {
  const m = MIN_PART_R;
  if (p.t === 0) p.r = Math.max(p.r, m);
  else if (p.t === 1) { p.rx = Math.max(p.rx, m); p.ry = Math.max(p.ry, m); p.rz = Math.max(p.rz, m); }
  else if (p.t === 2) { p.r1 = Math.max(p.r1, m); p.r2 = Math.max(p.r2, m); }
  return p;
}

const ANGLE_KEYS = ['spread', 'splay', 'up', 'y', 'n', 'ball'];
function scaleSize(p, f) {
  const out = {};
  for (const k in p) out[k] = ANGLE_KEYS.includes(k) ? p[k] : p[k] * f;
  return out;
}

export function compileGenome(gn, t) {
  const def = BODIES[gn.body.type];
  const base = def.build(gn.body.p);
  const gs = growthScale(t);
  const bodyPrims = base.prims.map((p) => { const q = scalePrim(p, gs.w, gs.h); q.g = p.g || 0; return q; });
  const desc = { partZ: 0, faceZ: 0, legN: 2, ...base.desc };
  for (const k of X_FIELDS) desc[k] *= gs.w;
  for (const k of Y_FIELDS) desc[k] *= gs.h;

  const bodyBounds = primsBounds(bodyPrims);
  const q = { ...desc, h: bodyBounds.max[1], ...queries(bodyPrims, bodyBounds) };

  const prims = bodyPrims.slice();
  const sprouts = [];
  let arms = null;
  // Heights taken up on the body's sides by ears and frills. Arms keep clear.
  const sideBands = [];
  const addPart = (part, f) => {
    if (part.type === 'arms') { if (ARMS_ON) arms = { ...part.p, f }; return; }
    const pp = f === 1 ? part.p : scaleSize(part.p, f);
    if (part.type === 'sideEars') sideBands.push([q.h * pp.y - pp.r, q.h * pp.y + pp.r]);
    if (part.type === 'frills') sideBands.push([q.faceY, q.faceY + 0.2 + pp.len]);
    prims.push(...PARTS[part.type].build(pp, q).map(thicken));
  };
  for (const part of gn.parts) if (PARTS[part.type]) addPart(part, 1);
  for (const gp of gn.growth) {
    const f = smooth(gp.at, gp.at + 0.08, t);
    sprouts.push(f);
    if (!PARTS[gp.type]) continue;
    if (gp.type === 'arms' ? f > 0.01 : f >= 0.2) addPart(gp, f);
  }

  const bounds = primsBounds(prims, 0.06 + Math.max(...prims.map((p) => p.k)) * 0.3);
  const center = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  const radius = Math.hypot(...bounds.max.map((v, i) => v - center[i]));
  const qa = queries(prims, bounds);

  // Legs hang from the underside and never grow. Pairs run front to back.
  const n = desc.legN;
  // Stance width follows body width, set closer together than the body edge.
  // A body can ask for its own stance, as a fraction of its half width.
  const sx = desc.hw * (desc.stance ?? (n === 2 ? 0.45 : 0.55) * 0.65);
  const zs = n === 2 ? [0] : n === 4 ? [desc.hd * 0.5, -desc.hd * 0.5] : [desc.hd * 0.62, 0, -desc.hd * 0.62];
  const hips = zs.flatMap((z) => [-1, 1].map((s) => {
    const x = s * sx;
    const y = q.surfBottom(x, z) ?? 0.05;
    const hip = { x, y: y + 0.09, z };
    hip.w = groupWeights(prims, x, hip.y, z);
    return hip;
  }));

  let armInfo = null;
  if (arms && n === 2) {
    // Shoulders drop below any ear or frill on the sides. With no room left
    // below, the creature goes without arms rather than overlap them.
    let y = q.h * arms.y;
    const gap = 0.1;
    for (const [lo, hi] of [...sideBands].sort((a, b) => b[0] - a[0])) {
      if (y > lo - gap && y < hi + gap) y = lo - gap;
    }
    if (y >= q.h * 0.2) armInfo = [-1, 1].map((s) => {
      const x = (q.surfSide(y, s, 0) ?? s * desc.hw) - s * 0.01;
      return { x, y, z: 0.02, s, len: ARM_LEN * arms.f, w: groupWeights(prims, x, y, 0.02) };
    });
  }

  // Face sits on the surface in front of its anchor, tilted only partly toward
  // the surface normal so it stays readable.
  let fz = desc.faceZ;
  const f = (x, y, z) => evalPrims(prims, x, y, z);
  while (f(0, desc.faceY, fz) < 0 && fz < 3) fz += 0.01;
  const e = 0.01;
  const ny = f(0, desc.faceY + e, fz) - f(0, desc.faceY - e, fz);
  const nz = f(0, desc.faceY, fz + e) - f(0, desc.faceY, fz - e);
  const nl = Math.hypot(ny, nz) || 1;
  // The drawn features span about half the face plane; keep that inside the
  // head's width at face height.
  const headHalf = qa.surfSide(desc.faceY, 1, desc.faceZ) ?? desc.hw;
  const face = {
    pos: [0, desc.faceY, fz + 0.015],
    normal: [0, (ny / nl) * 0.5, (nz / nl) * 0.5 + 0.5],
    w: Math.max(0.6, Math.min(Math.min(1.15, Math.max(0.92, base.desc.faceW * 1.8)), headHalf * 3.2)),
    weights: groupWeights(prims, 0, desc.faceY, fz),
  };
  const top = { y: bounds.max[1], w: groupWeights(prims, 0, bounds.max[1] - 0.05, desc.partZ) };

  const footprint = Math.max(bodyBounds.max[0], -bodyBounds.min[0], bodyBounds.max[2], -bodyBounds.min[2]);

  return { prims, bounds, center, radius, hips, arms: armInfo, face, top, desc, footprint, height: bounds.max[1], sprouts };
}
