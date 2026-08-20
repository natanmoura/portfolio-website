// Modifiers, and the lock model they share with every other component
// parameter.
//
// A parameter is not a number. It is a number plus how free that number is:
// fixed because someone had an opinion, ranged because they had an opinion
// about the bounds only, or free because they did not care. Authoring is the
// act of progressively locking down, and whatever is left unlocked stays
// alive to the generator. That is what keeps a hand-tuned component from
// going completely static.
//
// Resolution is deterministic per parameter rather than per component: each
// draws from a hash of (seed, path, name) instead of a shared sequence, so
// adding a modifier tomorrow does not reshuffle the variation of everything
// authored today. Same reasoning as the ticket blocks in generate.js, one
// layer down.

// --- parameters ------------------------------------------------------------
// The lock model itself lives in constraints.js, since it is the vocabulary
// every layer shares rather than something modifiers own. Re-exported here so
// the existing importers are undisturbed.

import {
  free,
  range,
  fixed,
  unit,
  resolveParam,
  resolveParams,
} from './constraints.js';

export { free, range, fixed, resolveParam, resolveParams };

// --- noise -----------------------------------------------------------------

// Value noise, smoothed. Enough for shaping geometry, and cheap enough to run
// per vertex without thinking about it.
function valueNoise(x, y, z, salt) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const fade = (t) => t * t * (3 - 2 * t);
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);
  const at = (i, j, k) => unit(`${salt}|${i}|${j}|${k}`) * 2 - 1;
  const lerp = (a, b, t) => a + (b - a) * t;
  const x00 = lerp(at(xi, yi, zi), at(xi + 1, yi, zi), u);
  const x10 = lerp(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), u);
  const x01 = lerp(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), u);
  const x11 = lerp(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

// Per-axis translation noise. Separate amounts per axis on purpose: a shape
// that wanders sideways but keeps its height reads very differently from one
// that wobbles in every direction, and both are wanted.
function applyNoise(geo, p, seed, path) {
  const scale = Math.max(0.0001, p.scale || 1);
  const salt = `${seed}|${path}`;
  const pos = geo.pos;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] / scale;
    const y = pos[i + 1] / scale;
    const z = pos[i + 2] / scale;
    if (p.x) pos[i] += valueNoise(x, y, z, `${salt}|x`) * p.x;
    if (p.y) pos[i + 1] += valueNoise(x, y, z, `${salt}|y`) * p.y;
    if (p.z) pos[i + 2] += valueNoise(x, y, z, `${salt}|z`) * p.z;
  }
  return geo;
}

// --- lattice ---------------------------------------------------------------

function bounds(pos) {
  const b = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = pos[i + a];
      if (v < b.min[a]) b.min[a] = v;
      if (v > b.max[a]) b.max[a] = v;
    }
  }
  return b;
}

// A cube lattice around the object's own bounds, whose corners are displaced,
// warping everything inside it. This is what makes a shape properly wonky
// rather than merely noisy: edges stay straight and faces stay flat, the way
// a bent real object behaves, because the deformation is smooth across the
// whole volume rather than applied per vertex.
//
// Skew leans the top away from the base, taper narrows it, twist rotates the
// top about the vertical. All three are driven off normalised height, so they
// compose without fighting.
function applyLattice(geo, p, seed, path) {
  const pos = geo.pos;
  const b = bounds(pos);
  const size = [
    Math.max(1e-6, b.max[0] - b.min[0]),
    Math.max(1e-6, b.max[1] - b.min[1]),
    Math.max(1e-6, b.max[2] - b.min[2]),
  ];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;

  // Corner jitter, resolved once so every vertex agrees on where the cage is.
  const jitter = p.jitter || 0;
  const corner = (ix, iz) => ({
    x: (unit(`${seed}|${path}|c${ix}${iz}|x`) * 2 - 1) * jitter,
    z: (unit(`${seed}|${path}|c${ix}${iz}|z`) * 2 - 1) * jitter,
  });
  const c00 = corner(0, 0);
  const c10 = corner(1, 0);
  const c01 = corner(0, 1);
  const c11 = corner(1, 1);

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const z = pos[i + 2];
    // Height through the cage, 0 at the base and 1 at the top.
    const t = (y - b.min[1]) / size[1];
    // Position across the cage, for interpolating the corner jitter.
    const u = (x - b.min[0]) / size[0];
    const v = (z - b.min[2]) / size[2];

    let nx = x;
    let nz = z;

    // Taper pulls in toward the centre line with height.
    if (p.taper) {
      const k = 1 - p.taper * t;
      nx = cx + (nx - cx) * k;
      nz = cz + (nz - cz) * k;
    }

    // Twist rotates about the vertical, more the higher it goes.
    if (p.twist) {
      const a = p.twist * t;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rx = nx - cx;
      const rz = nz - cz;
      nx = cx + ca * rx - sa * rz;
      nz = cz + sa * rx + ca * rz;
    }

    // Skew leans the whole cage over.
    nx += (p.skewX || 0) * t * size[0];
    nz += (p.skewZ || 0) * t * size[2];

    // Bilinear blend of the corner jitter, scaled by height so the base stays
    // planted and the top does the moving.
    if (jitter) {
      const jx = (c00.x * (1 - u) + c10.x * u) * (1 - v) + (c01.x * (1 - u) + c11.x * u) * v;
      const jz = (c00.z * (1 - u) + c10.z * u) * (1 - v) + (c01.z * (1 - u) + c11.z * u) * v;
      nx += jx * t * size[0];
      nz += jz * t * size[2];
    }

    pos[i] = nx;
    pos[i + 2] = nz;
  }
  return geo;
}

// --- radial array -----------------------------------------------------------

// Copies the shape around the vertical axis, evenly spaced across `sweep`
// degrees. This is what a spinner's blade count, a fence's pickets or a
// wheel's spokes all turn out to be: not a special shape of their own, but
// one part repeated and turned — which is why this belongs here as a
// modifier rather than as another hardcoded case in `geometry.js`'s shape
// switch. A component authors `count` the same way it authors any other
// parameter — free, ranged, or pinned — rather than a town-level ticket
// deciding on its behalf how many copies it gets.
//
// Unlike noise or the lattice warp, this changes how much geometry there
// is, not just where it sits, so it cannot deform `pos` in place — it
// rebuilds every array at `count` times the length, one rotated copy after
// another, slots included so each copy still paints as its own face.
function applyRadialArray(geo, p, seed, path) {
  const count = Math.max(1, Math.round(p.count));
  if (count === 1) return geo;
  const sweep = ((p.sweep ?? 180) * Math.PI) / 180;

  const srcLen = geo.pos.length;
  const vertCount = srcLen / 3;
  const pos = new Float32Array(srcLen * count);
  const nor = new Float32Array(srcLen * count);
  const uv = new Float32Array(geo.uv.length * count);
  const wind = new Float32Array(vertCount * count);
  const slots = [];

  for (let c = 0; c < count; c++) {
    // Evenly spaced starting at zero, the copy never doubling back onto the
    // one before it — the same spacing spinning cards already used, just
    // read off a parameter instead of a hardcoded card count.
    const a = (c * sweep) / count;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const pOff = c * srcLen;
    const wOff = c * vertCount;
    for (let i = 0; i < srcLen; i += 3) {
      const x = geo.pos[i];
      const z = geo.pos[i + 2];
      pos[pOff + i] = ca * x + sa * z;
      pos[pOff + i + 1] = geo.pos[i + 1];
      pos[pOff + i + 2] = -sa * x + ca * z;
      const nx = geo.nor[i];
      const nz = geo.nor[i + 2];
      nor[pOff + i] = ca * nx + sa * nz;
      nor[pOff + i + 1] = geo.nor[i + 1];
      nor[pOff + i + 2] = -sa * nx + ca * nz;
    }
    uv.set(geo.uv, c * geo.uv.length);
    if (geo.wind) for (let i = 0; i < vertCount; i++) wind[wOff + i] = geo.wind[i];
    for (const slot of geo.slots) {
      // Each copy's own faces, distinguishable from the ones before it —
      // `finish`'s per-slot cropping (`cropFaces`) addresses these by
      // index, and a face painted on copy 2 should not silently repaint
      // copy 0's.
      slots.push({ ...slot, start: slot.start + c * vertCount, name: count > 1 ? `${slot.name}${c}` : slot.name });
    }
  }

  geo.pos = pos;
  geo.nor = nor;
  geo.uv = uv;
  geo.wind = wind;
  geo.slots = slots;
  return geo;
}

// --- stack -----------------------------------------------------------------

export const MODIFIERS = {
  noise: {
    label: 'Noise',
    apply: applyNoise,
    defaults: { x: range(0, 0.3), y: fixed(0), z: range(0, 0.3), scale: range(0.5, 3) },
    help: 'Pushes vertices around per axis. Separate amounts for X, Y and Z, so a shape can wander sideways without losing its height.',
  },
  lattice: {
    label: 'Lattice warp',
    apply: applyLattice,
    defaults: {
      skewX: range(-0.25, 0.25),
      skewZ: range(-0.25, 0.25),
      taper: range(0, 0.3),
      twist: range(-0.4, 0.4),
      jitter: range(0, 0.15),
    },
    help: 'A cage around the shape whose corners get pushed about, warping everything inside. Keeps edges straight, so it reads as a bent object rather than a lumpy one.',
  },
  radial: {
    label: 'Radial array',
    apply: applyRadialArray,
    defaults: { count: range(1, 4), sweep: fixed(180) },
    help: 'Repeats the shape around the vertical axis, evenly spaced across the sweep. A spinner’s blade count is just this: one card, arrayed.',
  },
};

// Normals go stale the moment vertices move. Recomputed per triangle, which
// matches how these shapes are built: flat faces, no shared smoothing.
export function recomputeNormals(geo) {
  const { pos, nor } = geo;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i];
    const ay = pos[i + 4] - pos[i + 1];
    const az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i];
    const by = pos[i + 7] - pos[i + 1];
    const bz = pos[i + 8] - pos[i + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 3; k++) {
      nor[i + k * 3] = nx;
      nor[i + k * 3 + 1] = ny;
      nor[i + k * 3 + 2] = nz;
    }
  }
  return geo;
}

// Runs a stack over a shape. Order matters and is preserved: noise then
// lattice warps the noise, lattice then noise roughens an already bent shape,
// and those look different enough that the stack is a list rather than a set.
export function applyModifiers(shape, stack, seed, path = 'mod') {
  if (!stack || !stack.length) return shape;
  // Worked on a copy, so the cached base shape stays clean for the next
  // instance that wants its own variation.
  const geo = {
    ...shape,
    pos: Float32Array.from(shape.pos),
    nor: Float32Array.from(shape.nor),
  };
  stack.forEach((entry, i) => {
    const def = MODIFIERS[entry.type];
    if (!def || entry.enabled === false) return;
    const params = resolveParams({ ...def.defaults, ...(entry.params || {}) }, seed, `${path}[${i}]`);
    def.apply(geo, params, seed, `${path}[${i}]`);
  });
  return recomputeNormals(geo);
}
