// Proof that routing a leaf module through the component library produces
// the same geometry the hardcoded path does, for the shapes the whole town
// is already built from.
//
// `digest.mjs` cannot answer this question — it hashes generated *data*
// (positions, sizes, ids), never the triangles a shape resolves to. This is
// its counterpart one layer down: for every default kind, at a spread of
// sizes, face patterns and blade counts, it builds the geometry two ways —
// the direct `buildShape` call `build.js` uses today, and the
// `resolveComponent` → `mergeResolved` → `cropFaces` path being proposed to
// replace it, with the base-vs-centre convention difference between them
// corrected the same way `shapeFor` will — and diffs every vertex, normal
// and UV value.
//
//   node development/awesome-town-city-builder/tools/geom-diff.mjs

import { buildShape, cropFaces } from '../js/geometry.js';
import { resolveComponent, mergeResolved } from '../js/library.js';

// `spin` used to be included here too, back when its card count was a
// `blades` shape option the direct path and the library path could both be
// handed and expected to agree on. It now carries a `radial` modifier in
// spin.json that decides the count itself, seeded off (seed, path) same as
// any other authored parameter — so the library path legitimately produces
// more geometry than a bare `buildShape('spin', ...)` call, on purpose, and
// comparing them here would just be re-litigating a design decision rather
// than catching a regression. See modifiers.js's `radial` entry.
const KINDS = ['box', 'octagon', 'cylinder', 'pillars', 'pillars8', 'post', 'sphere', 'cone', 'dome', 'gable', 'pyramid'];

// Loaded the same way the app does at boot — from the shipped files, not
// hand-built stand-ins, so a change to a component's own json is covered by
// this too.
const lib = { components: new Map() };
for (const kind of KINDS) {
  const doc = (await import(`../library/components/${kind}.json`, { with: { type: 'json' } })).default;
  lib.components.set(kind, doc);
}

const SIZES = [
  [1, 1, 1],
  [4, 2.4, 3.6],
  [0.6, 5.2, 0.6],
  [2.8, 1.1, 2.2],
];

// A face pattern with a mix of images and flat colour, so cropping is
// actually exercised on both paths rather than trivially skipped.
function facesFor(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(i % 3 === 0 ? null : { aspect: 1.4 + i * 0.1, zoom: 0.2, panU: 0.1, panV: -0.05 });
  }
  return out;
}

function closeArrays(a, b, eps, label) {
  if (a.length !== b.length) return `${label}: length ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > eps) return `${label}[${i}]: ${a[i]} vs ${b[i]}`;
  }
  return null;
}

let failures = 0;
let cases = 0;

for (const kind of KINDS) {
  const doc = lib.components.get(kind);
  const blades = kind === 'spin' ? [1, 2, 3, 4] : [1];

  for (const [w, h, d] of SIZES) {
    for (const bl of blades) {
      cases++;
      const n = kind === 'spin' ? Math.max(1, Math.min(4, bl)) : undefined;
      const faces = facesFor(n ?? 6);

      // Today: the direct path build.js calls for every leaf module.
      const direct = buildShape(kind, w, h, d, faces, { blades: bl, tile: false });

      // Proposed: through the library, then undone the same way `shapeFor`
      // will undo it — not by an approximation (half the *measured* height
      // is the wrong number the moment a shape does not fill its box
      // symmetrically, which `dome` turned out to prove, drawn here
      // regardless of blades or width). `resolveComponent` calls the exact
      // same `buildShape` with the exact same w/h/d and then records how far
      // it lifted the result to sit the measured base at zero — subtracting
      // that recorded lift is the exact inverse of that one step, for any
      // shape, symmetric or not, because it was computed from this very
      // geometry rather than guessed from its nominal size.
      const resolved = resolveComponent(doc, lib, 1, `geomdiff:${kind}`, { w, h, d, blades: bl });
      const lift = resolved.pieces[0]?.offset[1] ?? 0;
      const merged = mergeResolved(resolved);
      const routed = cropFaces(merged, faces, { tile: false });
      const shifted = new Float32Array(routed.pos.length);
      for (let i = 0; i < routed.pos.length; i += 3) {
        shifted[i] = routed.pos[i];
        shifted[i + 1] = routed.pos[i + 1] - lift;
        shifted[i + 2] = routed.pos[i + 2];
      }

      const label = `${kind} ${w}x${h}x${d}${n ? ` blades=${bl}` : ''}`;
      const problems = [
        closeArrays(direct.pos, shifted, 1e-4, 'pos'),
        closeArrays(direct.nor, routed.nor, 1e-3, 'nor'),
        closeArrays(direct.uv, routed.uv, 1e-4, 'uv'),
        direct.slots.length !== routed.slots.length ? `slots: ${direct.slots.length} vs ${routed.slots.length}` : null,
      ].filter(Boolean);

      if (problems.length) {
        failures++;
        console.log(`FAIL ${label}`);
        for (const p of problems) console.log(`  ${p}`);
      }
    }
  }
}

console.log(`\n${cases - failures}/${cases} cases matched.`);
if (failures) process.exit(1);
