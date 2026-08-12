// Module shapes.
//
// Builders emit raw triangle arrays rather than BufferGeometry, because
// everything gets merged into chunk buffers anyway. Each shape reports its
// slots: the separately colourable faces the editor and the colour patterns
// address.
//
// UVs are emitted slot-local in 0..1, then cropped to cover the face without
// distortion and folded into the image's rect inside the texture array. Doing
// that here is what lets every module in the city share one material.
//
// Winding is counter-clockwise seen from outside. For the ring shapes the
// corner order is upper-a0, upper-a1, lower-a1, lower-a0, which is the order
// that puts the normal outward.

const TAU = Math.PI * 2;

export const SLOT_LABELS = {
  box: ['right', 'left', 'top', 'bottom', 'front', 'back'],
  octagon: ['side 1', 'side 2', 'side 3', 'side 4', 'side 5', 'side 6', 'side 7', 'side 8', 'top', 'bottom'],
  cylinder: ['front', 'right', 'back', 'left'],
  pillars: ['pillar 1', 'pillar 2', 'pillar 3', 'pillar 4', 'deck'],
  pillars8: ['pillar 1', 'pillar 2', 'pillar 3', 'pillar 4', 'pillar 5', 'pillar 6', 'pillar 7', 'pillar 8', 'deck'],
  post: ['right', 'left', 'top', 'bottom', 'front', 'back'],
  sphere: ['front', 'right', 'back', 'left'],
  spin: ['card 1', 'card 2', 'card 3', 'card 4'],
  flag: ['pole', 'flag'],
  pyramid: ['front', 'right', 'back', 'left', 'base'],
  gable: ['front slope', 'back slope', 'right end', 'left end', 'base'],
  cone: ['front', 'right', 'back', 'left', 'base'],
  dome: ['panel 1', 'panel 2', 'panel 3', 'panel 4', 'panel 5', 'panel 6', 'panel 7', 'panel 8'],
};

export const MAX_SLOTS = 10;

// Faces that point at the sky or the ground. Images never land on these: a
// picture on a roof deck reads as a mistake from every angle, and nothing ever
// sees the underside.
export const FLAT_SLOTS = {
  box: [2, 3],
  post: [2, 3],
  octagon: [8, 9],
  pillars: [4],
  pillars8: [8],
  pyramid: [4],
  gable: [4],
  cone: [4],
};

// --- builder ---------------------------------------------------------------

class Raw {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    // How much each vertex is allowed to flutter. Zero everywhere except the
    // free edge of a flag, so poles stay put and cloth stays attached.
    this.wind = [];
    this.slots = [];
    this.cur = null;
  }

  slot(label, w, h) {
    this.cur = { label, w, h, start: this.pos.length / 3, count: 0 };
    this.slots.push(this.cur);
    return this.cur.start;
  }

  tri(p0, p1, p2, uv0, uv1, uv2, n0, n1, n2) {
    if (!n0) {
      const ax = p1[0] - p0[0];
      const ay = p1[1] - p0[1];
      const az = p1[2] - p0[2];
      const bx = p2[0] - p0[0];
      const by = p2[1] - p0[1];
      const bz = p2[2] - p0[2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      n0 = n1 = n2 = [nx, ny, nz];
    }
    this.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    this.nor.push(n0[0], n0[1], n0[2], n1[0], n1[1], n1[2], n2[0], n2[1], n2[2]);
    this.uv.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
    this.wind.push(0, 0, 0);
    this.cur.count += 3;
  }

  quad(p0, p1, p2, p3, u0, u1, v0, v1, n0, n1, n2, n3) {
    this.tri(p0, p1, p2, [u0, v0], [u1, v0], [u1, v1], n0, n1, n2);
    this.tri(p0, p2, p3, [u0, v0], [u1, v1], [u0, v1], n0, n2, n3);
  }

  // Duplicate everything since `from` facing the other way, for hollow tubes
  // and double-sided cards.
  mirrorFrom(from) {
    const end = this.pos.length / 3;
    for (let i = from; i < end; i += 3) {
      const p = (k) => [this.pos[k * 3], this.pos[k * 3 + 1], this.pos[k * 3 + 2]];
      const n = (k) => [-this.nor[k * 3], -this.nor[k * 3 + 1], -this.nor[k * 3 + 2]];
      const u = (k) => [this.uv[k * 2], this.uv[k * 2 + 1]];
      this.tri(p(i), p(i + 2), p(i + 1), u(i), u(i + 2), u(i + 1), n(i), n(i + 2), n(i + 1));
    }
  }

  // Both faces of a flag have to share a flutter weight, or the two sides of
  // the cloth pull apart. Reading it off the vertex position does that for
  // free, since the mirrored copy sits at the same place.
  windFromX(from, x0, span) {
    for (let i = from; i < this.pos.length / 3; i++) {
      const t = (this.pos[i * 3] - x0) / Math.max(1e-4, span);
      this.wind[i] = Math.max(0, Math.min(1, t));
    }
  }

  finish(faces) {
    this.slots.forEach((slot, i) => applyFace(this.uv, slot, faces && faces[i]));
    return {
      pos: new Float32Array(this.pos),
      nor: new Float32Array(this.nor),
      uv: new Float32Array(this.uv),
      wind: new Float32Array(this.wind),
      slots: this.slots,
    };
  }
}

// Crop the image to cover the face without distorting it. The result stays in
// the image's own 0..1 space: folding it into the image's rect inside the
// texture array happens in the shader, so a lit billboard can scroll or swap
// to a picture of a different shape and still crop correctly.
function applyFace(uv, slot, face) {
  if (!face || !face.aspect) return;
  const faceAspect = Math.max(0.0001, slot.w) / Math.max(0.0001, slot.h);
  let rx = 1;
  let ry = 1;
  if (face.aspect > faceAspect) rx = faceAspect / face.aspect;
  else ry = face.aspect / faceAspect;
  const zoom = Math.max(1, face.zoom || 1);
  rx /= zoom;
  ry /= zoom;
  const ox = (1 - rx) * (face.panU ?? 0.5);
  const oy = (1 - ry) * (face.panV ?? 0.5);

  for (let i = slot.start; i < slot.start + slot.count; i++) {
    uv[i * 2] = ox + uv[i * 2] * rx;
    uv[i * 2 + 1] = oy + uv[i * 2 + 1] * ry;
  }
}

function norm(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// --- shapes ----------------------------------------------------------------

// Six quads into six slots.
function box(r, w, h, d) {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const A = [-x, -y, -z];
  const B = [x, -y, -z];
  const C = [x, -y, z];
  const D = [-x, -y, z];
  const E = [-x, y, -z];
  const F = [x, y, -z];
  const G = [x, y, z];
  const H = [-x, y, z];
  r.slot('right', d, h);
  r.quad(C, B, F, G, 0, 1, 0, 1);
  r.slot('left', d, h);
  r.quad(A, D, H, E, 0, 1, 0, 1);
  r.slot('top', w, d);
  r.quad(H, G, F, E, 0, 1, 0, 1);
  r.slot('bottom', w, d);
  r.quad(A, B, C, D, 0, 1, 0, 1);
  r.slot('front', w, h);
  r.quad(D, C, G, H, 0, 1, 0, 1);
  r.slot('back', w, h);
  r.quad(B, A, E, F, 0, 1, 0, 1);
}

// Six quads into whatever slot is already open. Used for axles and decks.
function boxInto(r, w, h, d, cx = 0, cy = 0, cz = 0) {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const P = (sx, sy, sz) => [cx + sx * x, cy + sy * y, cz + sz * z];
  const A = P(-1, -1, -1);
  const B = P(1, -1, -1);
  const C = P(1, -1, 1);
  const D = P(-1, -1, 1);
  const E = P(-1, 1, -1);
  const F = P(1, 1, -1);
  const G = P(1, 1, 1);
  const H = P(-1, 1, 1);
  r.quad(C, B, F, G, 0, 1, 0, 1);
  r.quad(A, D, H, E, 0, 1, 0, 1);
  r.quad(H, G, F, E, 0, 1, 0, 1);
  r.quad(A, B, C, D, 0, 1, 0, 1);
  r.quad(D, C, G, H, 0, 1, 0, 1);
  r.quad(B, A, E, F, 0, 1, 0, 1);
}

// Shared by the eight-sided block and the hollow cylinder.
function prism(r, w, h, d, sides, slotCount, smooth, capped, hollow, labels) {
  const rx = w / 2;
  const rz = d / 2;
  const y = h / 2;
  const perSlot = sides / slotCount;
  const chord = (Math.PI * (rx + rz)) / sides;

  for (let s = 0; s < slotCount; s++) {
    const from = r.slot(labels[s], chord * perSlot, h);
    for (let k = 0; k < perSlot; k++) {
      const i = s * perSlot + k;
      const a0 = (i / sides) * TAU;
      const a1 = ((i + 1) / sides) * TAU;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const upper0 = [rx * c0, y, rz * s0];
      const upper1 = [rx * c1, y, rz * s1];
      const lower1 = [rx * c1, -y, rz * s1];
      const lower0 = [rx * c0, -y, rz * s0];
      const u0 = k / perSlot;
      const u1 = (k + 1) / perSlot;
      if (smooth) {
        const n0 = norm([c0 * rz, 0, s0 * rx]);
        const n1 = norm([c1 * rz, 0, s1 * rx]);
        r.quad(upper0, upper1, lower1, lower0, u0, u1, 1, 0, n0, n1, n1, n0);
      } else {
        r.quad(upper0, upper1, lower1, lower0, u0, u1, 1, 0);
      }
    }
    if (hollow) r.mirrorFrom(from);
  }

  if (!capped) return;
  for (const top of [true, false]) {
    r.slot(top ? 'top' : 'bottom', w, d);
    const cy = top ? y : -y;
    const n = [0, top ? 1 : -1, 0];
    const c = [0, cy, 0];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * TAU;
      const a1 = ((i + 1) / sides) * TAU;
      const p0 = [rx * Math.cos(a0), cy, rz * Math.sin(a0)];
      const p1 = [rx * Math.cos(a1), cy, rz * Math.sin(a1)];
      const uvc = [0.5, 0.5];
      const uv0 = [0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5];
      const uv1 = [0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5];
      if (top) r.tri(c, p1, p0, uvc, uv1, uv0, n, n, n);
      else r.tri(c, p0, p1, uvc, uv0, uv1, n, n, n);
    }
  }
}

// Slender round columns. The eight-column variant adds one at the midpoint of
// each edge, which reads as a colonnade rather than as four legs.
function pillars(r, w, h, d, count = 4) {
  const rad = Math.min(w, d) * 0.026;
  const ox = w / 2 - rad * 3.4;
  const oz = d / 2 - rad * 3.4;
  const spots =
    count === 8
      ? [
          [-ox, -oz],
          [0, -oz],
          [ox, -oz],
          [ox, 0],
          [ox, oz],
          [0, oz],
          [-ox, oz],
          [-ox, 0],
        ]
      : [
          [-ox, -oz],
          [ox, -oz],
          [ox, oz],
          [-ox, oz],
        ];
  const seg = 12;
  const deckH = Math.min(h * 0.09, 0.25);
  const inner = h - deckH * 2;

  spots.forEach(([cx, cz], idx) => {
    r.slot(`pillar ${idx + 1}`, rad * TAU, inner);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU;
      const a1 = ((i + 1) / seg) * TAU;
      const at = (a, sy) => [cx + rad * Math.cos(a), (sy * inner) / 2, cz + rad * Math.sin(a)];
      const n0 = norm([Math.cos(a0), 0, Math.sin(a0)]);
      const n1 = norm([Math.cos(a1), 0, Math.sin(a1)]);
      r.quad(at(a0, 1), at(a1, 1), at(a1, -1), at(a0, -1), i / seg, (i + 1) / seg, 1, 0, n0, n1, n1, n0);
    }
  });

  // Deck slabs top and bottom, so a run of pillars still reads as a storey.
  r.slot('deck', w, d);
  boxInto(r, w, deckH, d, 0, h / 2 - deckH / 2, 0);
  boxInto(r, w, deckH, d, 0, -h / 2 + deckH / 2, 0);
}

// Always a ball, never an egg. A sphere squashed to fit a storey stops
// reading as a sphere, so it takes one radius from whichever dimension is
// smallest and ignores the rest.
function sphere(r, w, h, d) {
  const rx = Math.min(w, h, d) / 2;
  const ry = rx;
  const rz = rx;
  // Kept coarse on purpose. A sphere is the most expensive shape per module,
  // and a faceted one suits the rest of the city anyway.
  const rings = 8;
  const seg = 4;
  const P = (a, t) => [rx * Math.sin(t) * Math.cos(a), ry * Math.cos(t), rz * Math.sin(t) * Math.sin(a)];
  const N = (a, t) =>
    norm([(Math.sin(t) * Math.cos(a)) / rx, Math.cos(t) / ry, (Math.sin(t) * Math.sin(a)) / rz]);

  for (let q = 0; q < 4; q++) {
    r.slot(SLOT_LABELS.sphere[q], ((rx + rz) * Math.PI) / 4, ry * Math.PI);
    for (let s = 0; s < seg; s++) {
      const i = q * seg + s;
      const a0 = (i / (seg * 4)) * TAU;
      const a1 = ((i + 1) / (seg * 4)) * TAU;
      for (let j = 0; j < rings; j++) {
        const t0 = (j / rings) * Math.PI;
        const t1 = ((j + 1) / rings) * Math.PI;
        r.quad(
          P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1),
          s / seg, (s + 1) / seg, 1 - j / rings, 1 - (j + 1) / rings,
          N(a0, t0), N(a1, t0), N(a1, t1), N(a0, t1)
        );
      }
    }
  }
}

// Free-standing double-sided cards. No axle: a box down the middle just reads
// as a stray block once the cards are turning.
function spinCards(r, w, h, d, blades = 1) {
  const width = Math.max(w, d) * 0.98;
  const n = Math.max(1, Math.min(4, blades));
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n;
    const hx = (width / 2) * Math.cos(a);
    const hz = (width / 2) * Math.sin(a);
    const y = h / 2;
    const from = r.slot(SLOT_LABELS.spin[i], width, h);
    r.quad([-hx, y, -hz], [hx, y, hz], [hx, -y, hz], [-hx, -y, -hz], 0, 1, 1, 0);
    r.mirrorFrom(from);
  }
}

// One square column down the middle. Heavier than the colonnade columns and
// flat-faced, so it can still take an image.
function post(r, w, h, d) {
  const side = Math.min(w, d) * 0.2;
  box(r, side, h, side);
}

// A pole with a triangular flag, for the top of a pointed roof.
function flag(r, w, h, d) {
  const rad = Math.max(0.02, Math.min(w, d) * 0.022);
  const seg = 8;
  const y = h / 2;

  r.slot('pole', rad * TAU, h);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU;
    const a1 = ((i + 1) / seg) * TAU;
    const at = (a, sy) => [rad * Math.cos(a), sy * y, rad * Math.sin(a)];
    const n0 = norm([Math.cos(a0), 0, Math.sin(a0)]);
    const n1 = norm([Math.cos(a1), 0, Math.sin(a1)]);
    r.quad(at(a0, 1), at(a1, 1), at(a1, -1), at(a0, -1), i / seg, (i + 1) / seg, 1, 0, n0, n1, n1, n0);
  }

  // Hangs off one side of the pole, near the top.
  const span = Math.max(w, d) * 0.42;
  const drop = h * 0.34;
  const top = y - h * 0.06;
  const from = r.slot('flag', span, drop);
  r.tri(
    [rad, top, 0],
    [rad, top - drop, 0],
    [rad + span, top - drop * 0.5, 0],
    [0, 1],
    [0, 0],
    [1, 0.5]
  );
  r.mirrorFrom(from);
  r.windFromX(from, rad, span);
}

function pyramid(r, w, h, d) {
  const x = w / 2;
  const z = d / 2;
  const y = h / 2;
  const A = [-x, -y, -z];
  const B = [x, -y, -z];
  const C = [x, -y, z];
  const D = [-x, -y, z];
  const P = [0, y, 0];
  const slopeW = Math.hypot(h, z);
  const slopeD = Math.hypot(h, x);
  const face = (p0, p1, label, fw, fh) => {
    r.slot(label, fw, fh);
    r.tri(p0, p1, P, [0, 0], [1, 0], [0.5, 1]);
  };
  face(D, C, 'front', w, slopeW);
  face(C, B, 'right', d, slopeD);
  face(B, A, 'back', w, slopeW);
  face(A, D, 'left', d, slopeD);
  r.slot('base', w, d);
  r.quad(A, B, C, D, 0, 1, 0, 1);
}

function gable(r, w, h, d) {
  const x = w / 2;
  const z = d / 2;
  const y = h / 2;
  const A = [-x, -y, -z];
  const B = [x, -y, -z];
  const C = [x, -y, z];
  const D = [-x, -y, z];
  const R0 = [-x, y, 0];
  const R1 = [x, y, 0];
  const slope = Math.hypot(h, z);
  r.slot('front slope', w, slope);
  r.quad(D, C, R1, R0, 0, 1, 0, 1);
  r.slot('back slope', w, slope);
  r.quad(B, A, R0, R1, 0, 1, 0, 1);
  r.slot('right end', d, h);
  r.tri(C, B, R1, [0, 0], [1, 0], [0.5, 1]);
  r.slot('left end', d, h);
  r.tri(A, D, R0, [0, 0], [1, 0], [0.5, 1]);
  r.slot('base', w, d);
  r.quad(A, B, C, D, 0, 1, 0, 1);
}

function cone(r, w, h, d) {
  const rx = w / 2;
  const rz = d / 2;
  const y = h / 2;
  const sides = 16;
  const per = sides / 4;
  const P = [0, y, 0];
  for (let q = 0; q < 4; q++) {
    r.slot(SLOT_LABELS.cone[q], ((rx + rz) * Math.PI) / 4, Math.hypot(h, rx));
    for (let k = 0; k < per; k++) {
      const i = q * per + k;
      const a0 = (i / sides) * TAU;
      const a1 = ((i + 1) / sides) * TAU;
      const p0 = [rx * Math.cos(a0), -y, rz * Math.sin(a0)];
      const p1 = [rx * Math.cos(a1), -y, rz * Math.sin(a1)];
      r.tri(p1, p0, P, [(k + 1) / per, 0], [k / per, 0], [0.5, 1]);
    }
  }
  r.slot('base', w, d);
  const n = [0, -1, 0];
  const c = [0, -y, 0];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * TAU;
    const a1 = ((i + 1) / sides) * TAU;
    r.tri(
      c,
      [rx * Math.cos(a0), -y, rz * Math.sin(a0)],
      [rx * Math.cos(a1), -y, rz * Math.sin(a1)],
      [0.5, 0.5],
      [0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5],
      [0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5],
      n, n, n
    );
  }
}

// A faceted gazebo dome: eight panels curving in, flaring at the eave.
function dome(r, w, h, d) {
  const rx = w / 2;
  const rz = d / 2;
  const steps = 5;
  const sides = 8;
  const profile = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    profile.push({
      r: Math.sin(t * (Math.PI / 2)) ** 0.75,
      y: h * (Math.cos(t * (Math.PI / 2)) - 0.5),
    });
  }
  profile[steps].r = 1.14;
  profile[steps].y = -h * 0.56;

  const P = (ring, a) => [rx * ring.r * Math.cos(a), ring.y, rz * ring.r * Math.sin(a)];
  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * TAU;
    const a1 = ((s + 1) / sides) * TAU;
    r.slot(SLOT_LABELS.dome[s], ((rx + rz) * Math.PI) / sides, h);
    for (let i = 0; i < steps; i++) {
      const up = profile[i];
      const low = profile[i + 1];
      const v0 = 1 - i / steps;
      const v1 = 1 - (i + 1) / steps;
      if (up.r < 1e-5) {
        r.tri(P(up, a0), P(low, a1), P(low, a0), [0.5, v0], [1, v1], [0, v1]);
      } else {
        r.quad(P(up, a0), P(up, a1), P(low, a1), P(low, a0), 0, 1, v0, v1);
      }
    }
  }
}

// --- entry points ----------------------------------------------------------

export function buildShape(kind, w, h, d, faces, opts = {}) {
  const r = new Raw();
  switch (kind) {
    case 'octagon':
      prism(r, w, h, d, 8, 8, false, true, false, SLOT_LABELS.octagon);
      break;
    case 'cylinder':
      // Hollow, so every side is emitted twice. Sixteen segments is the point
      // where the silhouette stops reading as a polygon.
      prism(r, w, h, d, 16, 4, true, false, true, SLOT_LABELS.cylinder);
      break;
    case 'pillars':
      pillars(r, w, h, d, 4);
      break;
    case 'pillars8':
      pillars(r, w, h, d, 8);
      break;
    case 'post':
      post(r, w, h, d);
      break;
    case 'flag':
      flag(r, w, h, d);
      break;
    case 'sphere':
      sphere(r, w, h, d);
      break;
    case 'spin':
      spinCards(r, w, h, d, opts.blades);
      break;
    case 'pyramid':
      pyramid(r, w, h, d);
      break;
    case 'gable':
      gable(r, w, h, d);
      break;
    case 'cone':
      cone(r, w, h, d);
      break;
    case 'dome':
      dome(r, w, h, d);
      break;
    default:
      box(r, w, h, d);
  }
  return r.finish(faces);
}

export function slotCount(kind, blades = 1) {
  if (kind === 'spin') return Math.max(1, Math.min(4, blades));
  return (SLOT_LABELS[kind] || SLOT_LABELS.box).length;
}

export function slotLabels(kind, blades = 1) {
  if (kind === 'spin') return SLOT_LABELS.spin.slice(0, slotCount(kind, blades));
  return SLOT_LABELS[kind] || SLOT_LABELS.box;
}

// Which slots of a shape must stay flat colour.
export function flatSlots(kind) {
  return FLAT_SLOTS[kind] || [];
}
