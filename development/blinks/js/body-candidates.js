import { S, E, C, B, T } from './sdf.js';

// Candidate body shapes for curation in shapes.html. Same format as BODIES in
// genome.js: random ranges plus a build that returns prims and a description.
// Every shape is mirror symmetric across x = 0, bottom at y = 0, facing +z.

const g = (p, grp) => ((p.g = grp), p);

export const CANDIDATES = {
  ghost: {
    ranges: { r: [0.32, 0.38], h: [0.95, 1.15], n: [4, 6] },
    build: (p) => {
      const prims = [g(C(0, 0.22, 0, 0, p.h - p.r, 0, p.r, p.r), 0)];
      const n = Math.round(p.n);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * ((p.r * 1.7) / (n - 1));
        prims.push(g(S(x, 0.1, 0, 0.1, 0.06), 1 + (i % 3)));
      }
      return { prims, desc: { topW: p.r * 0.6, hw: p.r, hd: p.r, faceY: p.h * 0.62, faceW: p.r * 1.5 } };
    },
  },
  snowman: {
    ranges: { r1: [0.33, 0.38], r2: [0.24, 0.28], r3: [0.16, 0.19] },
    build: (p) => {
      const y2 = p.r1 * 2 + p.r2 * 0.7, y3 = y2 + p.r2 + p.r3 * 0.7;
      return {
        prims: [g(S(0, p.r1, 0, p.r1), 0), g(S(0, y2, 0, p.r2, 0.1), 1), g(S(0, y3, 0, p.r3, 0.08), 2)],
        desc: { topW: p.r3 * 0.6, hw: p.r1, hd: p.r1, faceY: y2, faceW: p.r2 * 1.4 },
      };
    },
  },
  tooth: {
    ranges: { w: [0.78, 0.92], h: [0.75, 0.92], root: [0.13, 0.17] },
    build: (p) => ({
      prims: [
        g(B(0, p.h * 0.6, 0, p.w / 2 - 0.16, p.h * 0.32 - 0.16, 0.3 - 0.16, 0.16), 0),
        g(C(-p.w * 0.25, p.h * 0.5, 0, -p.w * 0.22, p.root, 0, p.root * 1.3, p.root, 0.12), 1),
        g(C(p.w * 0.25, p.h * 0.5, 0, p.w * 0.22, p.root, 0, p.root * 1.3, p.root, 0.12), 2),
      ],
      desc: { topW: p.w * 0.35, hw: p.w / 2, hd: 0.3, faceY: p.h * 0.66, faceW: p.w * 0.55 },
    }),
  },
  bell: {
    ranges: { r: [0.36, 0.42], flare: [0.08, 0.12] },
    build: (p) => ({
      prims: [
        g(C(0, p.r * 0.5, 0, 0, p.r * 1.6, 0, p.r, p.r * 0.75), 0),
        g(E(0, 0.12, 0, p.r + p.flare, 0.12, p.r + p.flare, 0.14), 1),
        g(S(0, p.r * 1.9, 0, 0.09, 0.08), 2),
      ],
      desc: { topW: p.r * 0.5, hw: p.r + p.flare, hd: p.r + p.flare, faceY: p.r * 1.1, faceW: p.r * 1.3 },
    }),
  },
  acorn: {
    ranges: { r: [0.3, 0.35], cap: [0.4, 0.46] },
    build: (p) => ({
      prims: [
        g(E(0, p.r * 1.1, 0, p.r, p.r * 1.1, p.r), 0),
        g(E(0, p.r * 2.05, 0, p.cap, p.cap * 0.42, p.cap, 0.1), 1),
        g(C(0, p.r * 2.3, 0, 0, p.r * 2.3 + 0.16, 0, 0.06, 0.05, 0.05), 2),
      ],
      desc: { topW: 0.08, hw: p.cap, hd: p.cap, faceY: p.r * 1.05, faceW: p.r * 1.3 },
    }),
  },
  pancake: {
    ranges: { w: [1.0, 1.25], h: [0.42, 0.55] },
    build: (p) => ({
      prims: [g(E(0, p.h * 0.5, 0, p.w / 2, p.h * 0.5, p.w * 0.38), 0), g(E(0, p.h * 0.62, 0, p.w * 0.36, p.h * 0.38, p.w * 0.28, 0.2), 1)],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.w * 0.38, faceY: p.h * 0.52, faceW: p.w * 0.45 },
    }),
  },
  blimp: {
    ranges: { len: [0.5, 0.68], r: [0.26, 0.32] },
    build: (p) => ({
      prims: [g(C(-p.len / 2, p.r + 0.04, 0, p.len / 2, p.r + 0.04, 0, p.r, p.r), 0), g(E(0, p.r * 2 + 0.02, 0, p.len * 0.3, 0.1, p.r * 0.5, 0.12), 1)],
      desc: { topW: p.len * 0.3, hw: p.len / 2 + p.r, hd: p.r, faceY: p.r + 0.06, faceW: p.r * 1.5 },
    }),
  },
  tripod: {
    ranges: { r: [0.38, 0.44], foot: [0.14, 0.18] },
    build: (p) => {
      const cy = p.r * 0.9 + 0.1;
      const prims = [g(E(0, cy, 0, p.r, p.r * 0.95, p.r * 0.85), 0)];
      [[-0.6, 0.35], [0.6, 0.35], [0, -0.6]].forEach(([x, z], i) => prims.push(g(S(x * p.r, p.foot, z * p.r, p.foot, 0.14), 1 + i)));
      return { prims, desc: { topW: p.r * 0.5, hw: p.r, hd: p.r * 0.85, faceY: cy * 1.05, faceW: p.r * 1.3 } };
    },
  },
  boxhead: {
    ranges: { r: [0.3, 0.35], head: [0.27, 0.33] },
    build: (p) => {
      const hy = p.r * 2 + p.head * 0.7;
      return {
        prims: [g(S(0, p.r, 0, p.r), 0), g(B(0, hy, 0, p.head - 0.08, p.head * 0.8 - 0.08, p.head * 0.8 - 0.08, 0.08, 0.12), 1)],
        desc: { topW: p.head * 0.8, hw: p.r, hd: p.r, faceY: hy, faceW: p.head * 1.4 },
      };
    },
  },
  kettle: {
    ranges: { r: [0.36, 0.42], R: [0.13, 0.17] },
    build: (p) => ({
      prims: [
        g(E(0, p.r, 0, p.r, p.r * 0.95, p.r * 0.85), 0),
        g(T(-p.r * 1.05, p.r * 1.05, 0, p.R, 0.05, 0.06), 1),
        g(T(p.r * 1.05, p.r * 1.05, 0, p.R, 0.05, 0.06), 2),
      ],
      desc: { topW: p.r * 0.5, hw: p.r + p.R * 2, hd: p.r * 0.85, faceY: p.r * 1.05, faceW: p.r * 1.3 },
    }),
  },
  lamp: {
    ranges: { stem: [0.12, 0.16], shade: [0.42, 0.5], h: [1.0, 1.2] },
    build: (p) => ({
      prims: [
        g(C(0, 0.1, 0, 0, p.h * 0.6, 0, p.stem, p.stem), 0),
        g(C(0, p.h * 0.62, 0, 0, p.h - 0.08, 0, p.shade, p.shade * 0.45, 0.12), 1),
      ],
      desc: { topW: p.shade * 0.4, hw: p.shade, hd: p.shade, faceY: p.h * 0.72, faceW: p.shade * 1.0 },
    }),
  },
  cactus: {
    ranges: { r: [0.22, 0.27], h: [1.05, 1.25], arm: [0.11, 0.14] },
    build: (p) => {
      const ax = p.r + 0.16;
      return {
        prims: [
          g(C(0, p.r, 0, 0, p.h - p.r, 0, p.r, p.r), 0),
          g(C(-p.r * 0.6, p.h * 0.45, 0, -ax, p.h * 0.5, 0, p.arm, p.arm, 0.08), 1),
          g(C(-ax, p.h * 0.5, 0, -ax, p.h * 0.75, 0, p.arm, p.arm * 0.9, 0.06), 1),
          g(C(p.r * 0.6, p.h * 0.45, 0, ax, p.h * 0.5, 0, p.arm, p.arm, 0.08), 2),
          g(C(ax, p.h * 0.5, 0, ax, p.h * 0.75, 0, p.arm, p.arm * 0.9, 0.06), 2),
        ],
        desc: { topW: p.r * 0.6, hw: ax + p.arm, hd: p.r, faceY: p.h * 0.62, faceW: p.r * 1.6 },
      };
    },
  },
  bowlingpin: {
    ranges: { r1: [0.33, 0.38], r2: [0.17, 0.2], h: [1.05, 1.2] },
    build: (p) => ({
      prims: [
        g(E(0, p.r1 * 1.05, 0, p.r1, p.r1 * 1.05, p.r1), 0),
        g(C(0, p.r1 * 1.6, 0, 0, p.h - p.r2, 0, p.r1 * 0.45, p.r2 * 0.7, 0.14), 2),
        g(S(0, p.h - p.r2, 0, p.r2, 0.1), 1),
      ],
      desc: { topW: p.r2 * 0.6, hw: p.r1, hd: p.r1, faceY: p.r1 * 1.1, faceW: p.r1 * 1.3 },
    }),
  },
  icecream: {
    ranges: { r: [0.32, 0.38], cone: [0.45, 0.55] },
    build: (p) => ({
      prims: [g(C(0, 0.08, 0, 0, p.cone, 0, 0.07, p.r * 0.85), 0), g(S(0, p.cone + p.r * 0.55, 0, p.r, 0.12), 1)],
      desc: { topW: p.r * 0.6, hw: p.r, hd: p.r, faceY: p.cone + p.r * 0.5, faceW: p.r * 1.4 },
    }),
  },
  potato: {
    ranges: { w: [0.85, 1.0], h: [0.7, 0.85] },
    build: (p) => ({
      prims: [
        g(E(0, p.h * 0.45, 0, p.w * 0.42, p.h * 0.45, p.w * 0.33), 0),
        g(E(-p.w * 0.18, p.h * 0.6, 0.03, p.w * 0.25, p.h * 0.3, p.w * 0.25, 0.2), 1),
        g(E(p.w * 0.18, p.h * 0.6, 0.03, p.w * 0.25, p.h * 0.3, p.w * 0.25, 0.2), 2),
        g(E(0, p.h * 0.25, 0.05, p.w * 0.3, p.h * 0.22, p.w * 0.28, 0.2), 3),
      ],
      desc: { topW: p.w * 0.3, hw: p.w * 0.43, hd: p.w * 0.33, faceY: p.h * 0.5, faceW: p.w * 0.5 },
    }),
  },
  ufo: {
    ranges: { w: [1.05, 1.25], dome: [0.25, 0.3] },
    build: (p) => ({
      prims: [g(E(0, 0.2, 0, p.w / 2, 0.14, p.w / 2), 0), g(S(0, 0.28, 0, p.dome, 0.12), 1)],
      desc: { topW: p.dome * 0.6, hw: p.w / 2, hd: p.w / 2, faceY: 0.33, faceW: p.dome * 1.4 },
    }),
  },
  noodle: {
    ranges: { r: [0.17, 0.2], h: [1.2, 1.45] },
    build: (p) => ({
      prims: [g(C(0, p.r, 0, 0, p.h * 0.5, 0, p.r, p.r * 1.05), 0), g(C(0, p.h * 0.45, 0, 0, p.h - p.r, 0, p.r * 1.05, p.r, 0.1), 1)],
      desc: { topW: p.r * 0.7, hw: p.r, hd: p.r, faceY: p.h * 0.72, faceW: p.r * 1.8 },
    }),
  },
  barrel: {
    ranges: { r: [0.36, 0.42], h: [0.8, 0.95] },
    build: (p) => ({
      prims: [
        g(C(0, p.r * 0.5, 0, 0, p.h - p.r * 0.5, 0, p.r, p.r), 0),
        g(E(0, p.h * 0.5, 0, p.r * 1.12, p.h * 0.22, p.r * 1.12, 0.1), 1),
      ],
      desc: { topW: p.r * 0.7, hw: p.r * 1.12, hd: p.r * 1.12, faceY: p.h * 0.55, faceW: p.r * 1.3 },
    }),
  },
  mitten: {
    ranges: { r: [0.3, 0.35], h: [0.95, 1.1], thumb: [0.12, 0.15] },
    build: (p) => ({
      prims: [
        g(C(0, p.r, 0, 0, p.h - p.r, 0, p.r, p.r * 0.95), 0),
        g(C(-p.r * 0.7, p.h * 0.4, 0, -p.r * 1.25, p.h * 0.62, 0, p.thumb, p.thumb * 0.85, 0.1), 1),
        g(C(p.r * 0.7, p.h * 0.4, 0, p.r * 1.25, p.h * 0.62, 0, p.thumb, p.thumb * 0.85, 0.1), 2),
      ],
      desc: { topW: p.r * 0.6, hw: p.r * 1.25 + p.thumb, hd: p.r, faceY: p.h * 0.6, faceW: p.r * 1.5 },
    }),
  },
  lemon: {
    ranges: { r: [0.34, 0.4], tip: [0.12, 0.16] },
    build: (p) => ({
      prims: [
        g(E(0, p.r, 0, p.r * 1.15, p.r, p.r), 0),
        g(C(-p.r * 0.9, p.r, 0, -p.r * 1.3 - p.tip, p.r, 0, 0.12, 0.05, 0.1), 1),
        g(C(p.r * 0.9, p.r, 0, p.r * 1.3 + p.tip, p.r, 0, 0.12, 0.05, 0.1), 2),
      ],
      desc: { topW: p.r * 0.6, hw: p.r * 1.3 + p.tip, hd: p.r, faceY: p.r * 1.05, faceW: p.r * 1.4 },
    }),
  },
  stack: {
    ranges: { r: [0.25, 0.3], n: [3, 4] },
    build: (p) => {
      const n = Math.round(p.n);
      const prims = [];
      for (let i = 0; i < n; i++) {
        const r = p.r * (1 - i * 0.06);
        prims.push(g(E(0, p.r * 0.75 + i * p.r * 1.15, 0, r * 1.35, r * 0.75, r * 1.15, 0.12), i % 4));
      }
      return { prims, desc: { topW: p.r * 0.8, hw: p.r * 1.35, hd: p.r * 1.15, faceY: p.r * 0.75 + p.r * 1.15, faceW: p.r * 1.6 } };
    },
  },
  bean: {
    ranges: { r1: [0.33, 0.41], r2: [0.25, 0.33], h: [0.85, 1.05] },
    build: (p) => ({
      prims: [g(S(0, p.r1, 0, p.r1), 0), g(S(0, p.h - p.r2, 0, p.r2, 0.32), 1)],
      desc: { topW: p.r2 * 0.7, hw: p.r1, hd: p.r1, faceY: p.h - p.r2 * 1.1, faceW: p.r2 * 1.7 },
    }),
  },
  gumdrop: {
    ranges: { w: [0.85, 1.08], h: [0.8, 1.05] },
    build: (p) => {
      const r1 = p.w * 0.45;
      return {
        prims: [g(S(0, r1, 0, r1), 0), g(C(0, r1, 0, 0, p.h - 0.13, 0, r1 * 0.85, 0.13, 0.15), 1)],
        desc: { topW: 0.12, hw: r1, hd: r1, faceY: r1 * 0.95, faceW: p.w * 0.55 },
      };
    },
  },
  cloud: {
    ranges: { r: [0.3, 0.36], n: [5, 8], lump: [0.14, 0.18] },
    build: (p) => {
      const cy = p.r + p.lump * 0.6;
      const prims = [g(E(0, cy, 0, p.r, p.r, p.r * 0.8), 0)];
      const n = Math.round(p.n);
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i / n) * Math.PI * 2;
        prims.push(g(S(Math.cos(a) * p.r, cy + Math.sin(a) * p.r, 0, p.lump, 0.07), 1 + (Math.min(i, n - i) % 3)));
      }
      return { prims, desc: { topW: p.r * 0.5, hw: p.r + p.lump, hd: p.r * 0.8, faceY: cy, faceW: p.r * 1.3 } };
    },
  },
  caterpillar: {
    ranges: { seg: [3, 4], r: [0.21, 0.27], gap: [0.26, 0.32] },
    build: (p) => {
      const n = Math.round(p.seg);
      const prims = [];
      const z0 = ((n - 1) * p.gap) / 2;
      for (let i = 0; i < n; i++) {
        const z = z0 - i * p.gap;
        const rr = i === 0 ? p.r * 1.15 : p.r * (1 - i * 0.04);
        prims.push(g(S(0, rr + (i === 0 ? 0.06 : 0), z, rr, 0.12), i === 0 ? 2 : i % 2));
      }
      return {
        prims,
        desc: {
          topW: p.r * 0.55, partZ: z0, hw: p.r, hd: z0 + p.r, faceY: p.r * 1.15 + 0.06, faceZ: z0,
          faceW: p.r * 1.5, legN: n >= 4 ? 6 : 4,
        },
      };
    },
  },
  wide: {
    ranges: { w: [1.1, 1.35], h: [0.52, 0.66], d: [0.66, 0.8], quad: [0, 1] },
    build: (p) => ({
      prims: [g(E(0, p.h * 0.45, 0, p.w / 2, p.h * 0.45, p.d / 2), 0), g(E(0, p.h * 0.62, 0, p.w * 0.38, p.h * 0.38, p.d * 0.38, 0.22), 1)],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.d / 2, faceY: p.h * 0.5, faceW: p.w * 0.5, legN: p.quad > 0.6 ? 4 : 2 },
    }),
  },
  mushroom: {
    ranges: { cw: [0.5, 0.62], ch: [0.24, 0.3], sr: [0.23, 0.28], sh: [0.4, 0.5] },
    build: (p) => ({
      prims: [g(E(0, p.sh * 0.55, 0, p.sr, p.sh * 0.55, p.sr), 0), g(E(0, p.sh + p.ch * 0.5, 0, p.cw, p.ch, p.cw * 0.85, 0.1), 1)],
      desc: { topW: p.cw * 0.4, hw: p.cw, hd: p.cw * 0.85, faceY: p.sh + p.ch * 0.45, faceW: p.cw * 0.95 },
    }),
  },
  kidney: {
    ranges: { gap: [0.22, 0.3], r: [0.3, 0.36] },
    build: (p) => ({
      prims: [
        g(E(0, p.r * 0.9, 0, p.gap, p.r * 0.7, p.r * 0.8), 0),
        g(S(-p.gap, p.r * 1.05, 0, p.r, 0.16), 1),
        g(S(p.gap, p.r * 1.05, 0, p.r, 0.16), 2),
      ],
      desc: { topW: p.gap, hw: p.gap + p.r, hd: p.r, faceY: p.r * 1.0, faceW: (p.gap + p.r) * 1.1 },
    }),
  },
  crown: {
    ranges: { w: [0.9, 1.1], h: [0.62, 0.78], n: [3, 5], lump: [0.15, 0.19] },
    build: (p) => {
      const prims = [g(E(0, p.h * 0.48, 0, p.w / 2, p.h * 0.48, p.w * 0.36), 0)];
      const n = Math.round(p.n);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * ((p.w * 0.72) / (n - 1));
        const y = p.h * 0.48 + Math.sqrt(Math.max(0, 1 - (x / (p.w / 2)) ** 2)) * p.h * 0.42;
        prims.push(g(S(x, y, 0, p.lump, 0.08), 2 + (i % 2)));
      }
      return { prims, desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.w * 0.36, faceY: p.h * 0.45, faceW: p.w * 0.55, crowned: true } };
    },
  },
  frog: {
    ranges: { w: [0.95, 1.15], h: [0.6, 0.72], eye: [0.15, 0.19] },
    build: (p) => ({
      prims: [
        g(E(0, p.h * 0.5, 0, p.w / 2, p.h * 0.5, p.w * 0.38), 0),
        g(S(-p.w * 0.26, p.h * 0.92, p.w * 0.05, p.eye, 0.1), 2),
        g(S(p.w * 0.26, p.h * 0.92, p.w * 0.05, p.eye, 0.1), 3),
      ],
      desc: { topW: p.w * 0.12, hw: p.w / 2, hd: p.w * 0.38, faceY: p.h * 0.48, faceW: p.w * 0.55, crowned: true },
    }),
  },
  sausage: {
    ranges: { len: [0.5, 0.7], r: [0.2, 0.25] },
    build: (p) => ({
      prims: [g(C(0, p.r + 0.04, -p.len, 0, p.r + 0.04, 0, p.r, p.r), 1), g(C(0, p.r + 0.04, 0, 0, p.r + 0.06, p.len * 0.8, p.r, p.r * 1.05, 0.08), 0)],
      desc: {
        topW: p.r * 0.5, partZ: p.len * 0.8, hw: p.r, hd: p.len + p.r, faceY: p.r + 0.06,
        faceZ: p.len * 0.8, faceW: p.r * 1.5, legN: 6,
      },
    }),
  },
  carrot: {
    ranges: { top: [0.36, 0.44], h: [0.95, 1.15] },
    build: (p) => ({
      prims: [g(S(0, 0.17, 0, 0.17), 0), g(C(0, 0.17, 0, 0, p.h - p.top, 0, 0.17, p.top, 0.12), 1)],
      desc: { topW: p.top * 0.5, hw: p.top, hd: p.top, faceY: p.h - p.top * 1.1, faceW: p.top * 1.5 },
    }),
  },
  // Second pass: simple primitives.
  cone: {
    ranges: { r: [0.42, 0.5], h: [0.95, 1.15] },
    build: (p) => ({
      prims: [g(C(0, 0.12, 0, 0, p.h - 0.05, 0, p.r, 0.05), 0)],
      desc: { topW: 0.08, hw: p.r, hd: p.r, faceY: p.h * 0.32, faceW: p.r * 1.2 },
    }),
  },
  onigiri: {
    ranges: { r: [0.26, 0.3], spread: [0.22, 0.27] },
    build: (p) => {
      const base = p.r + 0.02;
      return {
        prims: [
          g(S(-p.spread, base, 0, p.r), 1),
          g(S(p.spread, base, 0, p.r, 0.3), 2),
          g(S(0, base + p.spread * 1.6, 0, p.r * 0.9, 0.3), 0),
        ],
        desc: { topW: p.r * 0.5, hw: p.spread + p.r, hd: p.r, faceY: base + p.spread * 0.6, faceW: p.r * 1.6 },
      };
    },
  },
  ball: {
    ranges: { r: [0.4, 0.46] },
    build: (p) => ({
      prims: [g(S(0, p.r, 0, p.r), 0)],
      desc: { topW: p.r * 0.5, hw: p.r, hd: p.r, faceY: p.r * 1.05, faceW: p.r * 1.3 },
    }),
  },
  egg: {
    ranges: { r: [0.34, 0.4], h: [1.0, 1.15] },
    build: (p) => ({
      prims: [g(E(0, p.h / 2, 0, p.r, p.h / 2, p.r), 0)],
      desc: { topW: p.r * 0.5, hw: p.r, hd: p.r, faceY: p.h * 0.55, faceW: p.r * 1.3 },
    }),
  },
  // Third pass: plain primitives in silly, unexpected proportions.
  coin: {
    ranges: { r: [0.42, 0.5], t: [0.13, 0.17] },
    build: (p) => ({
      // A fat disc standing on its edge, facing you.
      prims: [g(E(0, p.r, 0, p.r, p.r, p.t), 0)],
      desc: { topW: p.r * 0.5, hw: p.r, hd: p.t, faceY: p.r * 1.05, faceW: p.r * 1.2 },
    }),
  },
  tombstone: {
    ranges: { w: [0.7, 0.82], h: [0.95, 1.1], t: [0.16, 0.2] },
    build: (p) => ({
      prims: [
        g(B(0, (p.h - p.w / 2) / 2, 0, p.w / 2 - 0.06, (p.h - p.w / 2) / 2 - 0.06, p.t - 0.06, 0.06), 0),
        g(E(0, p.h - p.w / 2, 0, p.w / 2, p.w / 2, p.t, 0.04), 1),
      ],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.t, faceY: p.h * 0.6, faceW: p.w * 0.6 },
    }),
  },
  butter: {
    ranges: { w: [0.36, 0.42], h: [1.25, 1.45] },
    build: (p) => ({
      prims: [g(B(0, p.h / 2, 0, p.w / 2 - 0.05, p.h / 2 - 0.05, p.w / 2 - 0.05, 0.05), 0)],
      desc: { topW: p.w * 0.5, hw: p.w / 2, hd: p.w / 2, faceY: p.h * 0.72, faceW: p.w * 0.8 },
    }),
  },
  mochi: {
    ranges: { r: [0.6, 0.72], h: [0.42, 0.5] },
    build: (p) => ({
      prims: [g(E(0, p.h * 0.5, 0, p.r, p.h * 0.5, p.r * 0.8), 0), g(E(0, p.h * 0.62, 0, p.r * 0.6, p.h * 0.4, p.r * 0.5, 0.2), 1)],
      desc: { topW: p.r * 0.4, hw: p.r, hd: p.r * 0.8, faceY: p.h * 0.55, faceW: p.r * 0.7 },
    }),
  },
  longegg: {
    ranges: { len: [0.62, 0.74], r: [0.27, 0.32] },
    build: (p) => ({
      // An egg lying on its side, longways across.
      prims: [g(E(0, p.r, 0, p.len, p.r, p.r * 0.95), 0)],
      desc: { topW: p.len * 0.4, hw: p.len, hd: p.r, faceY: p.r * 1.05, faceW: p.r * 1.5 },
    }),
  },
  topheavy: {
    ranges: { r: [0.4, 0.46], foot: [0.12, 0.15] },
    build: (p) => {
      const cy = p.foot * 1.6 + p.r * 0.85;
      return {
        prims: [g(S(0, p.foot, 0, p.foot), 1), g(S(0, cy, 0, p.r, 0.12), 0)],
        desc: { topW: p.r * 0.5, hw: p.r, hd: p.r, faceY: cy, faceW: p.r * 1.3, stance: 0.25 },
      };
    },
  },
  bottle: {
    ranges: { w: [0.56, 0.66], h: [0.6, 0.7], neck: [0.17, 0.21] },
    build: (p) => ({
      prims: [
        g(B(0, p.h / 2, 0, p.w / 2 - 0.12, p.h / 2 - 0.12, p.w / 2 - 0.12, 0.12), 0),
        g(B(0, p.h + 0.2, 0, p.neck - 0.06, 0.2, p.neck - 0.06, 0.06, 0.1), 1),
      ],
      desc: { topW: p.neck, hw: p.w / 2, hd: p.w / 2, faceY: p.h * 0.5, faceW: p.w * 0.6 },
    }),
  },
  flan: {
    ranges: { r1: [0.48, 0.56], r2: [0.3, 0.36], h: [0.55, 0.65] },
    build: (p) => ({
      // A wobbly pudding: wide base, narrower flat-ish top.
      prims: [g(C(0, 0.14, 0, 0, p.h - 0.12, 0, p.r1, p.r2), 0)],
      desc: { topW: p.r2 * 0.8, hw: p.r1, hd: p.r1, faceY: p.h * 0.45, faceW: p.r1 * 1.0 },
    }),
  },
  funnel: {
    ranges: { r1: [0.14, 0.18], r2: [0.46, 0.54], h: [0.85, 1.0] },
    build: (p) => ({
      // Top heavy: a tiny base flaring out to a wide rounded top.
      prims: [g(C(0, p.r1, 0, 0, p.h - p.r2 * 0.7, 0, p.r1, p.r2), 0)],
      desc: { topW: p.r2 * 0.6, hw: p.r2, hd: p.r2, faceY: p.h * 0.62, faceW: p.r2 * 1.1, stance: 0.3 },
    }),
  },
  bun: {
    ranges: { w: [0.9, 1.05], h: [0.55, 0.65] },
    build: (p) => ({
      // A dome with a flat bottom, like a bread roll.
      prims: [
        g(B(0, 0.12, 0, p.w / 2 - 0.1, 0.04, p.w * 0.38 - 0.1, 0.1), 1),
        g(E(0, 0.16, 0, p.w / 2, p.h - 0.16, p.w * 0.38, 0.12), 0),
      ],
      desc: { topW: p.w * 0.3, hw: p.w / 2, hd: p.w * 0.38, faceY: p.h * 0.45, faceW: p.w * 0.5 },
    }),
  },
  snout: {
    ranges: { r: [0.38, 0.44], nose: [0.2, 0.25] },
    build: (p) => ({
      prims: [g(S(0, p.r, 0, p.r), 0), g(S(0, p.r * 0.85, p.r * 0.95, p.nose, 0.1), 1)],
      desc: { topW: p.r * 0.5, hw: p.r, hd: p.r + p.nose * 0.7, faceY: p.r * 1.35, faceW: p.r * 1.2, faceZ: p.r * 0.1 },
    }),
  },
  belly: {
    ranges: { r: [0.26, 0.3], h: [1.05, 1.2], gut: [0.3, 0.35] },
    build: (p) => ({
      prims: [g(C(0, p.r, 0, 0, p.h - p.r, 0, p.r, p.r * 0.9), 0), g(S(0, p.h * 0.32, p.r * 0.35, p.gut, 0.14), 1)],
      desc: { topW: p.r * 0.6, hw: p.gut, hd: p.r * 0.35 + p.gut, faceY: p.h * 0.75, faceW: p.r * 1.5 },
    }),
  },
  comet: {
    ranges: { r: [0.36, 0.42], tail: [0.55, 0.7] },
    build: (p) => ({
      // A teardrop lying down, round nose in front, tail trailing behind.
      prims: [g(C(0, p.r, p.r * 0.3, 0, p.r * 0.8, -p.tail, p.r, 0.08), 0)],
      desc: { topW: p.r * 0.4, hw: p.r, hd: p.r + p.tail * 0.5, faceY: p.r * 1.05, faceW: p.r * 1.3, faceZ: p.r * 0.3, partZ: p.r * 0.2 },
    }),
  },
  squish: {
    ranges: { w: [0.62, 0.72], h: [0.95, 1.1] },
    build: (p) => ({
      // A cube squeezed in the middle, pinched like an hourglass of boxes.
      prims: [
        g(B(0, p.h * 0.22, 0, p.w / 2 - 0.1, p.h * 0.22 - 0.1, p.w * 0.4 - 0.1, 0.1), 0),
        g(B(0, p.h * 0.78, 0, p.w / 2 - 0.1, p.h * 0.22 - 0.1, p.w * 0.4 - 0.1, 0.1, 0.08), 1),
        g(C(0, p.h * 0.3, 0, 0, p.h * 0.7, 0, p.w * 0.22, p.w * 0.22, 0.12), 2),
      ],
      desc: { topW: p.w * 0.35, hw: p.w / 2, hd: p.w * 0.4, faceY: p.h * 0.78, faceW: p.w * 0.6 },
    }),
  },
  molar: {
    ranges: { w: [0.78, 0.92], h: [0.6, 0.75], cusp: [0.14, 0.17] },
    build: (p) => {
      const prims = [g(B(0, p.h * 0.45, 0, p.w / 2 - 0.15, p.h * 0.45 - 0.15, 0.3 - 0.15, 0.15), 0)];
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => prims.push(g(S(sx * p.w * 0.24, p.h * 0.88, sz * 0.14, p.cusp, 0.08), 1 + (i % 3))));
      return { prims, desc: { topW: p.w * 0.35, hw: p.w / 2, hd: 0.3, faceY: p.h * 0.45, faceW: p.w * 0.55 } };
    },
  },
};
