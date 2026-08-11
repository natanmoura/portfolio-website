// shapes.js — cuboids straight out of the drawn lines.
//
// A bounding box around an object throws away almost everything the drawing
// told you. Its bottom edge is the nearest ground contact, its width is a
// silhouette, and its depth is a guess. But the lines themselves carry the real
// shape: once the camera is solved, every straight edge in the image belongs to
// one of three world directions, and a box is just three of those meeting at a
// corner.
//
// So this is hypothesise and verify, not detection:
//
//   1. Every near-vertical segment is a candidate box corner. Its foot
//      back-projects to an exact ground position, its length to an exact height.
//   2. Two corners separated along a horizontal world axis form a footprint
//      edge. Two such edges sharing a corner form a complete footprint, with no
//      depth guessing anywhere.
//   3. Project the resulting cuboid's twelve edges back into the image and ask
//      how much actual drawn ink sits under them. Real boxes score high.
//      Coincidences do not.
//
// Nothing here is learned and nothing is random. The same drawing gives the
// same boxes every time.
//
// STATUS: the approach is right, the input is not good enough yet. On a
// synthetic drawing of three boxes with known dimensions it recovers one of
// them (footprint 7.07 x 7.90 against a true 5 x 8, height 4.42 against 4.5)
// and misses the rest, and adding a paved floor drops it to zero. The reason is
// not the fitting, it is the line detector feeding it: the gradient-steered
// Hough in autocalib.js returns roughly 33 fragments for a drawing where a
// proper LSD would return 150-odd clean segments with true endpoints. Corners
// come from vertical segments, and footprints need two corners joined by a
// drawn edge, so fragmentary input starves the connectivity graph. Every
// threshold that removes a false box also removes a real one, which is the
// signature of thin evidence rather than bad tuning.
//
// The fix is a real line segment detector (LSD or EDLines), not more tuning
// here. Until then this is off by default.

import * as THREE from 'three';
import { uid } from './scene.js';

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ scoring */

/**
 * Fraction of a world-space segment that has drawn ink underneath it.
 * Sampled in image space against the thinned edge mask, with a couple of pixels
 * of slack because hand-drawn lines wobble and the solve is not perfect.
 */
function support(cam, em, a, b, samples = 28, radius = 2) {
  const pa = cam.project(a);
  const pb = cam.project(b);
  if (!pa || !pb) return 0;

  let hits = 0;
  let valid = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mx = Math.round((pa.u + (pb.u - pa.u) * t) * em.scale);
    const my = Math.round((pa.v + (pb.v - pa.v) * t) * em.scale);
    if (mx < 0 || my < 0 || mx >= em.w || my >= em.h) continue;
    valid += 1;

    let found = false;
    for (let dy = -radius; dy <= radius && !found; dy++) {
      const y = my + dy;
      if (y < 0 || y >= em.h) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = mx + dx;
        if (x < 0 || x >= em.w) continue;
        if (em.mask[y * em.w + x]) { found = true; break; }
      }
    }
    if (found) hits += 1;
  }

  // A segment mostly off-frame tells us nothing, so refuse to score it.
  if (valid < samples * 0.6) return 0;
  return hits / valid;
}

/** The three families of cuboid edge, kept apart because they are not equally
 *  informative. */
function cuboidEdges(footprint, height) {
  const top = footprint.map((p) => new THREE.Vector3(p.x, height, p.z));
  const base = [];
  const cap = [];
  const posts = [];
  for (let i = 0; i < 4; i++) {
    base.push([footprint[i], footprint[(i + 1) % 4]]);
    cap.push([top[i], top[(i + 1) % 4]]);
    posts.push([footprint[i], top[i]]);
  }
  return { base, cap, posts };
}

const bestOf = (values, n) =>
  values.sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0) / n;

/**
 * Score a cuboid hypothesis.
 *
 * The three edge families are scored separately and gated separately, because
 * a naive average over all twelve is trivially fooled. Any drawing with a
 * paved floor, a tiled interior or a road has ink lying under the base edges of
 * *every* plausible ground rectangle, so base support proves almost nothing.
 * What only a real box produces is ink standing up at its corners and running
 * along its top, so the posts and the cap carry the decision and the base is
 * left as a tie-breaker.
 *
 * Best three of four in each family, since a solid box always hides one edge of
 * each behind itself.
 */
function scoreCuboid(cam, em, footprint, height) {
  const { base, cap, posts } = cuboidEdges(footprint, height);
  const score = (edges) => bestOf(edges.map(([a, b]) => support(cam, em, a, b)), 3);

  const capScore = score(cap);
  const postScore = score(posts);
  const baseScore = score(base);

  return {
    cap: capScore,
    post: postScore,
    base: baseScore,
    total: 0.45 * capScore + 0.45 * postScore + 0.1 * baseScore,
  };
}

/**
 * Coarse check that a placed node is actually supported by the drawing.
 *
 * Deliberately crude: it scores the node's upright bounding box rather than its
 * true silhouette, so an arch is checked as the block it sits inside. That is
 * enough to catch the failure that matters, which is an object placed at the
 * wrong depth or scale, because a wrong depth puts the box somewhere with no
 * ink at all. It will not tell you an arch should have been a doorway.
 *
 * Returned as advice for a human, never used to silently drop anything.
 */
export function verifyNode(cam, edgeMask, node) {
  const [w, h, d] = node.size;
  const [x, y, z] = node.position;
  const rot = node.rotationY || 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const corner = (sx, sz) =>
    new THREE.Vector3(
      x + sx * (w / 2) * cos - sz * (d / 2) * sin,
      y,
      z + sx * (w / 2) * -sin - sz * (d / 2) * cos,
    );

  const footprint = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  const parts = scoreCuboid(cam, edgeMask, footprint, Math.max(h, 0.05));
  return {
    score: +parts.total.toFixed(3),
    cap: +parts.cap.toFixed(2),
    post: +parts.post.toFixed(2),
    base: +parts.base.toFixed(2),
  };
}

/* ------------------------------------------------------------ corner finding */

/**
 * Turn the vertical line segments into candidate box corners. This is where
 * the exactness comes from: the foot of a vertical edge is a ground contact,
 * which the solved camera converts to a world position with no ambiguity.
 */
function cornersFromVerticals(cam, segments, limits) {
  const corners = [];

  for (const s of segments) {
    // Image v grows downward, so the larger v is the foot of the edge.
    const down = s.y1 > s.y2 ? { u: s.x1, v: s.y1 } : { u: s.x2, v: s.y2 };
    const up = s.y1 > s.y2 ? { u: s.x2, v: s.y2 } : { u: s.x1, v: s.y1 };

    const base = cam.groundPoint(down.u, down.v);
    if (!base) continue; // foot is above the horizon, so it is not standing here

    const dist = Math.hypot(base.x - cam.position.x, base.z - cam.position.z);
    if (dist > limits.maxRange) continue;

    // Only a hint. Line detection truncates a vertical edge wherever it crosses
    // something else, so the same box reports wildly different post heights
    // depending on what happens to overlap each corner. The foot is trustworthy
    // because it is a real point on the floor; the top is not, and the real
    // height gets searched for later.
    corners.push({ p: base, hHint: cam.heightAt(base, up.u, up.v) });
  }

  // Merge corners that landed on the same place. Purely positional: two
  // readings of one corner disagree about height by construction, so height
  // must not be part of deciding whether they are the same corner.
  const radius = Math.max(limits.minSize, 0.35);
  const merged = [];
  for (const c of corners) {
    const near = merged.find((m) => Math.hypot(m.p.x - c.p.x, m.p.z - c.p.z) < radius);
    if (near) {
      near.hHint = Math.max(near.hHint, c.hHint);
      near.weight += 1;
    } else {
      merged.push({ ...c, weight: 1 });
    }
  }
  return merged;
}

/**
 * Find the height at which a footprint's top cap actually sits, by sweeping and
 * keeping the strongest reading.
 *
 * This replaces trusting the detected vertical extents. The cap edges are long
 * and unbroken in a way corner posts are not, so their support peaks sharply at
 * the true height. It also makes the whole thing self-policing: a footprint
 * invented from corners of two different boxes has no height at which a cap
 * appears, so it scores low everywhere and is rejected.
 */
function fitHeight(cam, em, footprint, maxHeight, limits) {
  // A cap that projects almost on top of its own base is not evidence of
  // anything: at near-zero height the "top" edges lie along the floor and
  // inherit the floor's ink, which produces a perfect score for a box half a
  // metre tall. Require real separation in the image before believing a height.
  const baseMid = cam.project(
    new THREE.Vector3((footprint[0].x + footprint[2].x) / 2, 0, (footprint[0].z + footprint[2].z) / 2),
  );

  const capAt = (h, samples) => {
    if (baseMid) {
      const topMid = cam.project(
        new THREE.Vector3((footprint[0].x + footprint[2].x) / 2, h, (footprint[0].z + footprint[2].z) / 2),
      );
      if (!topMid || Math.hypot(topMid.u - baseMid.u, topMid.v - baseMid.v) < 8) return 0;
    }
    const top = footprint.map((p) => new THREE.Vector3(p.x, h, p.z));
    return bestOf(
      [0, 1, 2, 3].map((i) => support(cam, em, top[i], top[(i + 1) % 4], samples)),
      3,
    );
  };

  const STEPS = 48;
  const lo = limits.minSize;
  const hi = Math.max(maxHeight, lo * 3);

  let best = { h: lo, score: 0 };
  for (let i = 0; i <= STEPS; i++) {
    const h = lo + ((hi - lo) * i) / STEPS;
    const score = capAt(h, 14); // coarse pass, few samples
    if (score > best.score) best = { h, score };
  }

  // Refine around the winner at full sampling.
  const span = (hi - lo) / STEPS;
  let refined = { h: best.h, score: capAt(best.h, 28) };
  for (let i = -4; i <= 4; i++) {
    const h = best.h + (span * i) / 4;
    if (h < lo || h > hi) continue;
    const score = capAt(h, 28);
    if (score > refined.score) refined = { h, score };
  }
  return refined;
}

/**
 * Is there a detected line segment lying along the image projection of a-to-b,
 * covering most of it? Checked against the tidied segments rather than the raw
 * edge mask, because the question here is whether the artist drew this edge as
 * a line, not merely whether some ink happens to fall along its path.
 */
function drawnBetween(cam, a, b, segments, tol = 9, coverage = 0.45) {
  const pa = cam.project(a);
  const pb = cam.project(b);
  if (!pa || !pb) return false;

  const dx = pb.u - pa.u;
  const dy = pb.v - pa.v;
  const len = Math.hypot(dx, dy);
  if (len < 10) return false;
  const ux = dx / len;
  const uy = dy / len;

  for (const s of segments) {
    // Perpendicular offsets of the segment's endpoints from the a-b line.
    const off = (x, y) => Math.abs(-(x - pa.u) * uy + (y - pa.v) * ux);
    if (off(s.x1, s.y1) > tol || off(s.x2, s.y2) > tol) continue;

    // Overlap of the segment with the a-b span, along the line.
    const t1 = (s.x1 - pa.u) * ux + (s.y1 - pa.v) * uy;
    const t2 = (s.x2 - pa.u) * ux + (s.y2 - pa.v) * uy;
    const lo = Math.max(0, Math.min(t1, t2));
    const hi = Math.min(len, Math.max(t1, t2));
    if (hi - lo >= len * coverage) return true;
  }
  return false;
}

/* ------------------------------------------------------------------- the run */

/**
 * @param {SolvedCamera} cam
 * @param {object} report          output of autoCalibrate
 * @param {object} [opts]
 * @returns {{nodes: Array, candidates: number, tested: number}}
 */
export function detectShapes(cam, report, opts = {}) {
  const em = report.edgeMask;
  const minScore = opts.minScore ?? 0.62;
  const gate = opts.gate ?? 0.6; // posts and cap must each clear this alone
  const angleTol = Math.cos((opts.angleTolDeg ?? 9) * DEG);

  const limits = {
    minSize: cam.camHeight * 0.12,
    maxSize: cam.camHeight * 90,
    maxRange: cam.camHeight * 250,
  };

  // Each vanishing point is a world direction: the ray through it. That is how
  // a segment learns which axis it runs along, without assuming the solve put
  // the axes anywhere in particular.
  const families = report.groups.map((g) => ({
    group: g,
    dir: cam.ray(g.vp.x, g.vp.y),
  }));

  const vertical = families.filter((f) => Math.abs(f.dir.y) > 0.85);
  const horizontal = families.filter((f) => Math.abs(f.dir.y) < 0.35);

  if (!vertical.length || horizontal.length < 2) {
    return {
      nodes: [],
      candidates: 0,
      tested: 0,
      reason: !vertical.length
        ? 'no vertical edges found, so there are no box corners to stand on'
        : 'only one horizontal direction found, so a footprint cannot be closed without guessing depth',
    };
  }

  // Flatten the two horizontal directions onto the ground.
  const axes = horizontal
    .sort((a, b) => b.group.score - a.group.score)
    .slice(0, 2)
    .map((f) => new THREE.Vector3(f.dir.x, 0, f.dir.z).normalize());

  const verticalSegments = vertical.flatMap((f) => f.group.inliers);
  const corners = cornersFromVerticals(cam, verticalSegments, limits);

  // Checked against every segment rather than only the matching axis family:
  // Hough output is fragmentary, and a base edge broken into two pieces can
  // easily land its halves in different families.
  const allSegments = report.segments;

  /**
   * Does a-to-b run along one of the two ground axes, AND was that edge
   * actually drawn?
   *
   * The second half matters more than the first. Two corners belonging to
   * different buildings are very often axis-aligned with each other by pure
   * coincidence, and pairing them invents a footprint spanning the gap. A real
   * footprint edge is a line the artist drew, so demand that a detected segment
   * lies along it and covers most of it.
   */
  const alignment = (a, b) => {
    const d = new THREE.Vector3(b.p.x - a.p.x, 0, b.p.z - a.p.z);
    const len = d.length();
    if (len < limits.minSize || len > limits.maxSize) return null;
    d.divideScalar(len);

    for (let i = 0; i < axes.length; i++) {
      if (Math.abs(d.dot(axes[i])) <= angleTol) continue;
      if (!drawnBetween(cam, a.p, b.p, allSegments)) continue;
      return { axis: i, len };
    }
    return null;
  };

  // Every pair of corners that lies along a ground axis is a candidate
  // footprint edge.
  const links = [];
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const al = alignment(corners[i], corners[j]);
      if (al) links.push({ a: i, b: j, ...al });
    }
  }

  const byCorner = new Map();
  for (const link of links) {
    if (!byCorner.has(link.a)) byCorner.set(link.a, []);
    if (!byCorner.has(link.b)) byCorner.set(link.b, []);
    byCorner.get(link.a).push({ other: link.b, axis: link.axis });
    byCorner.get(link.b).push({ other: link.a, axis: link.axis });
  }

  // Two footprint edges sharing a corner close the whole rectangle. No depth
  // guess anywhere: all four corners are measured.
  const hypotheses = [];
  const seen = new Set();

  for (const [pivot, out] of byCorner) {
    for (const p of out) {
      for (const q of out) {
        if (p.axis === q.axis || p.other === q.other) continue;

        const b = corners[pivot].p;
        const a = corners[p.other].p;
        const c = corners[q.other].p;
        const d = new THREE.Vector3(a.x + c.x - b.x, 0, a.z + c.z - b.z);

        const footprint = [a, b, c, d];
        const key = footprint
          .map((v) => `${v.x.toFixed(2)},${v.z.toFixed(2)}`)
          .sort()
          .join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        hypotheses.push({ footprint, corners: [pivot, p.other, q.other] });
      }
    }
  }

  // Tallest thing anyone saw, with headroom, bounds the height search.
  const ceiling = Math.min(
    limits.maxSize,
    Math.max(...corners.map((c) => c.hHint), limits.minSize) * 1.6,
  );

  const scored = hypotheses
    .map((h) => {
      const fit = fitHeight(cam, em, h.footprint, ceiling, limits);
      return { ...h, height: fit.h, parts: scoreCuboid(cam, em, h.footprint, fit.h) };
    })
    // Both gates must pass on their own. A hypothesis cannot buy its way in on
    // strong posts and an absent top, or vice versa.
    .filter((h) => h.parts.post >= gate && h.parts.cap >= gate && h.parts.total >= minScore)
    .map((h) => ({ ...h, score: h.parts.total }))
    .sort((a, b) => b.score - a.score);

  // Greedy non-maximum suppression on ground footprint, so a box and a slightly
  // different reading of the same box do not both survive.
  const kept = [];
  for (const h of scored) {
    const box = footprintBounds(h.footprint);
    if (kept.some((k) => iou(k.box, box) > 0.2)) continue;
    kept.push({ ...h, box });
  }

  const nodes = kept.map((h) => toNode(h, axes, opts));

  return {
    nodes,
    candidates: corners.length,
    tested: hypotheses.length,
    kept: kept.length,
    scores: kept.map((k) => +k.score.toFixed(3)),
    parts: kept.map((k) => ({
      cap: +k.parts.cap.toFixed(2),
      post: +k.parts.post.toFixed(2),
      base: +k.parts.base.toFixed(2),
    })),
  };
}

function footprintBounds(fp) {
  return {
    x0: Math.min(...fp.map((p) => p.x)),
    x1: Math.max(...fp.map((p) => p.x)),
    z0: Math.min(...fp.map((p) => p.z)),
    z1: Math.max(...fp.map((p) => p.z)),
  };
}

function iou(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const d = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  if (w <= 0 || d <= 0) return 0;
  const inter = w * d;
  const areaA = (a.x1 - a.x0) * (a.z1 - a.z0);
  const areaB = (b.x1 - b.x0) * (b.z1 - b.z0);
  return inter / (areaA + areaB - inter);
}

function toNode(h, axes, opts) {
  const [a, b, c] = h.footprint;

  // Side lengths along the two measured ground axes.
  const sideA = new THREE.Vector3(a.x - b.x, 0, a.z - b.z);
  const sideB = new THREE.Vector3(c.x - b.x, 0, c.z - b.z);

  const centre = new THREE.Vector3(
    (h.footprint[0].x + h.footprint[2].x) / 2,
    0,
    (h.footprint[0].z + h.footprint[2].z) / 2,
  );

  // three.js rotates local +X to (cos t, 0, -sin t), so this aligns the box's
  // own X axis with the footprint edge it was measured along.
  const dirA = sideA.clone().normalize();
  const rotationY = Math.atan2(-dirA.z, dirA.x);

  return {
    id: uid('sh'),
    type: 'box',
    name: opts.name || 'shape',
    position: [centre.x, 0, centre.z],
    size: [sideA.length(), h.height, sideB.length()],
    rotationY,
    material: opts.material || { mode: 'projected', station: opts.stationId },
    confidence: +h.score.toFixed(3),
    pinned: false,
  };
}
