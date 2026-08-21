// Ground you drew, as against ground that was rolled.
//
// The terrain has always been one thing: layered noise, three sliders, take it
// or leave it. You could make it rougher or wider but you could never say
// "there is a hill *here*". This is the other kind, and the two do not mix —
// a town is either standing on noise or standing on shapes, chosen once, for
// exactly the reason a drawn hill blended into a procedural one is neither: a
// slider nudge moves ground you placed by hand, which is the corruption this
// whole project is built to refuse.
//
// **A landform is a closed curve with a height and a falloff.** The shape you
// draw is the flat top. The falloff is how far out the slope runs before it
// meets whatever was underneath — so a falloff near zero is a cliff and a
// falloff of thirty metres is a swell you could drive up. That is the whole
// model, and it is deliberately not a brush: a brush paints pixels you cannot
// re-edit, where a curve stays a handful of draggable points forever, saves
// as four lines of JSON, and undoes cleanly. It is also the same object the
// boundary and the roads already are, so it inherits the view, the editor,
// the drag, the halo and the delete key without any of them learning a new
// type.
//
// **They stack in order, each layering over the last.** Not summed, not
// maxed: `h = h + (height - h) * weight`, so a landform's own `height` is
// exactly the height its top sits at, whatever it is standing on. That is the
// property that makes terracing predictable — draw a plateau at 8, draw a
// smaller one inside it at 16, and the second is at 16 rather than at 24.
// Summing would mean every plateau's real height depended on the list above
// it, which is unusable the moment there are three of them.
//
// **The field is rastered, not evaluated.** See `landformRaster`. A point-in-
// polygon plus a distance-to-outline is fifty-odd edge tests, and the ground
// mesh alone asks for it a quarter of a million times. Rastering once at the
// mesh's own resolution and sampling bilinearly makes every later query free —
// and it is not a loss of fidelity but a gain in agreement, since the mesh
// cannot draw a cliff finer than its own cell anyway, and buildings, traffic
// and the camera now stand on exactly the surface that was drawn rather than
// on a more precise one nobody can see.

import { newCurve } from './curve.js';
import { fbm2D } from './noise.js';
import { regionFromCurve } from './region.js';
import { Rng } from './rng.js';
import { mintId } from './ids.js';

export const LANDFORM_SHAPES = ['round', 'blob', 'square'];

export const LANDFORM_LABEL = {
  round: 'Round',
  blob: 'Blob',
  square: 'Square',
};

// A first landform you can see without touching a slider. Eight metres is
// two or three storeys — plainly a hill, not a bump — and a six metre skirt
// reads as a slope rather than as either a cliff or a smear.
export const LANDFORM_HEIGHT = 8;
export const LANDFORM_FALLOFF = 6;

const TAU = Math.PI * 2;

// --- shapes -----------------------------------------------------------------

// The same three starting outlines the boundary offers, for the same reason:
// the one thing worse than no tool is a tool that opens on an empty canvas
// and asks you to click. `at` offsets the shape so a second landform does not
// land exactly on top of the first and read as nothing having happened.
export function landformShape(kind, radius, seed = 1, at = { x: 0, z: 0 }) {
  const points = [];
  if (kind === 'square') {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      points.push({ x: at.x + sx * radius, z: at.z + sz * radius, corner: true });
    }
    return finishShape(points, 0, kind);
  }
  if (kind === 'blob') {
    const rng = new Rng(seed >>> 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const r = radius * (0.6 + rng.float() * 0.4);
      points.push({ x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r });
    }
    return finishShape(points, 0.5, kind);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    points.push({ x: at.x + Math.cos(a) * radius, z: at.z + Math.sin(a) * radius });
  }
  return finishShape(points, 0.5, kind);
}

// A landform is a curve with two extra fields, rather than a record wrapping
// one. That is what lets it go straight into the curve list beside the roads
// and the boundary — the view, the picker and the editor all take curves, and
// a wrapper would mean unwrapping at every one of those doors.
function finishShape(points, tension, source) {
  return {
    ...newCurve(points, {
      closed: true,
      tension,
      kind: 'landform',
      label: 'Landform',
      id: mintId('land'),
    }),
    height: LANDFORM_HEIGHT,
    falloff: LANDFORM_FALLOFF,
    // Which button minted it, cleared the moment it is dragged. Same
    // machinery as the boundary's, and here it is what lets the list row show
    // "round, untouched" rather than claiming every shape is hand-drawn.
    source,
  };
}

// --- the field --------------------------------------------------------------

// One landform, prepared for sampling: its region (which answers containment
// and distance against a ring flattened once) plus the box outside which it
// can have no effect at all. That box is most of the performance story — a
// hill in one corner of town costs nothing at all to evaluate in the other.
function prepare(landform) {
  const region = regionFromCurve(landform, { perSegment: 8, fallbackHalf: 1 });
  const falloff = Math.max(0, landform.falloff ?? LANDFORM_FALLOFF);
  const b = region.bounds;
  // Its own seed, from its own name, so two shapes with the same roughness
  // do not wear the same crumple and a shape keeps its own when another is
  // added or removed.
  let seed = 2166136261;
  for (let i = 0; i < landform.id.length; i++) {
    seed ^= landform.id.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return {
    region,
    falloff,
    height: landform.height ?? 0,
    // Per shape rather than global, which is the whole point: the Terrain
    // panel's roughness and terracing describe how the *noise* is made and
    // have no business reaching ground somebody placed by hand.
    rough: Math.max(0, landform.rough ?? 0),
    roughScale: Math.max(0.05, landform.roughScale ?? 1),
    step: Math.max(0, landform.step ?? 0),
    seed: seed >>> 0,
    minX: b.minX - falloff,
    maxX: b.maxX + falloff,
    minZ: b.minZ - falloff,
    maxZ: b.maxZ + falloff,
  };
}

// Smoothstep rather than a straight ramp. A linear falloff meets the flat top
// at a visible crease all the way round the shape — the exact artefact that
// makes a procedural hill look procedural — where this arrives tangent at
// both ends and reads as ground.
const ease = (t) => t * t * (3 - 2 * t);

function weightAt(shape, x, z) {
  if (x < shape.minX || x > shape.maxX || z < shape.minZ || z > shape.maxZ) return 0;
  if (shape.region.contains(x, z)) return 1;
  if (shape.falloff <= 1e-6) return 0;
  const d = shape.region.distanceToEdge(x, z);
  if (d >= shape.falloff) return 0;
  return ease(1 - d / shape.falloff);
}

// The stack, evaluated exactly. Correct and slow, and only ever called by the
// raster below — everything else samples the raster.
export function landformHeightAt(shapes, x, z) {
  let h = 0;
  for (const shape of shapes) {
    const w = weightAt(shape, x, z);
    if (w <= 0) continue;
    h += (shape.height - h) * w;

    // Roughness, then terracing — the same order the noise ground uses, so
    // stepping a rough shape gives stepped crumple rather than crumpled steps.
    //
    // Scaled by the weight so it fades out exactly where the shape does. Any
    // other choice leaves a rim of noise standing on ground this landform is
    // supposed to have finished influencing, which is visible as a ring of
    // static around a smooth hill.
    if (shape.rough > 0) {
      const f = 0.06 / shape.roughScale;
      h += fbm2D(shape.seed, x * f, z * f, 4) * shape.rough * w;
    }
    // Terracing applies wherever this shape has any say at all, including its
    // flat top — which therefore lands on the nearest shelf rather than
    // exactly on its stated height. That is the consistent choice: stepping
    // only the slope would leave a riser of some leftover height where the
    // slope meets the top, which is the one place a terrace should not have
    // one.
    if (shape.step > 0) h = Math.round(h / shape.step) * shape.step;
  }
  return h;
}

// The stack baked into a grid, sampled bilinearly.
//
// `cell` should match the ground mesh's own spacing: sampled at a mesh vertex
// this then returns the stored value with no interpolation at all, so the
// surface a building stands on is the surface that was drawn, to the bit.
export function landformRaster(landforms, minX, minZ, size, cell) {
  const shapes = (landforms || []).map(prepare);
  const n = Math.max(2, Math.round(size / cell) + 1);
  const step = size / (n - 1);
  const data = new Float32Array(n * n);

  if (shapes.length) {
    for (let j = 0; j < n; j++) {
      const z = minZ + j * step;
      for (let i = 0; i < n; i++) {
        data[j * n + i] = landformHeightAt(shapes, minX + i * step, z);
      }
    }
  }

  // Outside the raster the height clamps to the edge rather than dropping to
  // zero. A building one metre past the last row should stand on the same
  // ground as its neighbour, not fall off the end of the world.
  const sample = (x, z) => {
    if (!shapes.length) return 0;
    const fx = Math.min(n - 1, Math.max(0, (x - minX) / step));
    const fz = Math.min(n - 1, Math.max(0, (z - minZ) / step));
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const i1 = Math.min(n - 1, i0 + 1);
    const j1 = Math.min(n - 1, j0 + 1);
    const tx = fx - i0;
    const tz = fz - j0;
    const a = data[j0 * n + i0];
    const b = data[j0 * n + i1];
    const c = data[j1 * n + i0];
    const d = data[j1 * n + i1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  };

  let relief = 0;
  for (let i = 0; i < data.length; i++) relief = Math.max(relief, Math.abs(data[i]));

  return { sample, relief, count: shapes.length };
}

// --- housekeeping -----------------------------------------------------------

// What the extent key needs: a short string that changes whenever anything
// about the drawn ground changes and never when nothing has. Cheaper than
// keeping the whole JSON in the key and, unlike a length or a count, it
// actually notices a single point moving half a metre.
export function landformKey(landforms) {
  if (!landforms || !landforms.length) return '0';
  let h = 2166136261;
  const mix = (v) => {
    h ^= v >>> 0;
    h = Math.imul(h, 16777619);
  };
  for (const l of landforms) {
    mix(Math.round((l.height ?? 0) * 1000));
    mix(Math.round((l.falloff ?? 0) * 1000));
    mix(Math.round((l.tension ?? 0) * 1000));
    // The per-shape terrain settings have to reach the key too, or typing a
    // roughness changes nothing until something else happens to move.
    mix(Math.round((l.rough ?? 0) * 1000));
    mix(Math.round((l.roughScale ?? 0) * 1000));
    mix(Math.round((l.step ?? 0) * 1000));
    for (const p of l.points || []) {
      mix(Math.round(p.x * 1000));
      mix(Math.round(p.z * 1000));
      mix(p.corner ? 1 : 0);
    }
  }
  return `${landforms.length}:${(h >>> 0).toString(36)}`;
}

// The radius a fresh landform starts at, against the town it is being drawn
// in. A quarter of the extent is big enough to see from the default camera
// and small enough that the first thing you do is not shrink it.
export const landformRadius = (half) => Math.max(4, half * 0.28);
