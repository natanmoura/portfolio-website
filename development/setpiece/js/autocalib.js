// autocalib.js — find the camera automatically, with no model involved.
//
// Perspective is not a perception problem, it is a measurement problem. The
// vanishing points are already in the image, encoded in which way its straight
// edges lean. Classic computer vision recovers them exactly and deterministically
// in a couple of hundred milliseconds. A vision model asked for a focal length
// would be guessing, and would guess differently every time you asked.
//
// Pipeline: greyscale -> Sobel -> thin the edges -> gradient-steered Hough for
// straight lines -> walk each line to recover a real segment -> RANSAC the
// segments into vanishing points -> hand the two best to the solver in calib.js.

import {
  fitVanishingPoint,
  solveFromTwoVPs,
  solveFromVerticalAndHorizontal,
  solveTwoPoint,
  solveThreePoint,
} from './calib.js';
import { AxonometricCamera, solveAxonometricBasis, familyDirection } from './ortho.js';

const MAX_SIDE = 800; // detection resolution; results are scaled back up

/* ------------------------------------------------------------ edge detection */

function toGrayscale(image) {
  // naturalWidth, not width: an <img> in the page reports its CSS size, which
  // would silently run detection on a downscaled copy and lose half the edges.
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;

  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  return { gray, w, h, scale };
}

/**
 * Sobel gradients, then non-maximum suppression across the gradient direction
 * so a thick pencil stroke collapses to a one-pixel ridge. Without the thinning
 * step every stroke votes several times and the Hough peaks smear.
 */
function detectEdges({ gray, w, h }) {
  const mag = new Float32Array(w * h);
  const dir = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
      dir[i] = Math.atan2(gy, gx);
    }
  }

  // Adaptive threshold: keep the strongest few percent of pixels, so the same
  // settings work for a faint pencil sketch and a hard-inked drawing.
  const sorted = Float32Array.from(mag).sort();
  const cut = sorted[Math.floor(sorted.length * 0.94)] || 1;

  const edges = [];
  const mask = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mag[i] < cut) continue;

      // Step one pixel each way along the gradient and keep only ridge tops.
      const ux = Math.round(Math.cos(dir[i]));
      const uy = Math.round(Math.sin(dir[i]));
      const a = mag[i + uy * w + ux];
      const b = mag[i - uy * w - ux];
      if (mag[i] < a || mag[i] < b) continue;

      mask[i] = 1;
      edges.push({ x, y, theta: dir[i] });
    }
  }
  return { edges, mask, w, h };
}

/* --------------------------------------------------------------- line finding */

const THETA_STEPS = 360; // 0.5 degree resolution over 180 degrees

/**
 * Hough transform, but each edge pixel only votes for line orientations near
 * perpendicular to its own gradient. That is a ~10x speedup and, more usefully,
 * it stops texture noise from smearing votes across the whole accumulator.
 */
function houghLines({ edges, mask, w, h }, maxLines = 90, diag_out = {}) {
  const diag = Math.ceil(Math.hypot(w, h));
  const rhoBins = diag * 2 + 1;
  const acc = new Float32Array(THETA_STEPS * rhoBins);

  const cos = new Float32Array(THETA_STEPS);
  const sin = new Float32Array(THETA_STEPS);
  for (let t = 0; t < THETA_STEPS; t++) {
    const a = (t * Math.PI) / THETA_STEPS;
    cos[t] = Math.cos(a);
    sin[t] = Math.sin(a);
  }

  const SPREAD = 12; // bins either side of the steered centre
  for (const e of edges) {
    // The Hough angle t is the direction of the line's NORMAL, and the image
    // gradient already points along that normal. So t is the gradient angle
    // folded into [0, pi), with no extra quarter turn.
    const centre = Math.round((((e.theta % Math.PI) + Math.PI) % Math.PI) * (THETA_STEPS / Math.PI));
    for (let d = -SPREAD; d <= SPREAD; d++) {
      const t = (centre + d + THETA_STEPS) % THETA_STEPS;
      const rho = Math.round(e.x * cos[t] + e.y * sin[t]) + diag;
      if (rho >= 0 && rho < rhoBins) acc[t * rhoBins + rho] += 1;
    }
  }

  // Peak picking with a suppression window, so one strong edge yields one line.
  const minVotes = Math.max(18, Math.hypot(w, h) * 0.06);
  const peaks = [];
  for (let t = 0; t < THETA_STEPS; t++) {
    for (let r = 1; r < rhoBins - 1; r++) {
      const v = acc[t * rhoBins + r];
      if (v < minVotes) continue;
      let best = true;
      for (let dt = -4; dt <= 4 && best; dt++) {
        const tt = (t + dt + THETA_STEPS) % THETA_STEPS;
        for (let dr = -6; dr <= 6; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rhoBins) continue;
          if (acc[tt * rhoBins + rr] > v) { best = false; break; }
        }
      }
      if (best) peaks.push({ t, rho: r - diag, votes: v });
    }
  }

  peaks.sort((a, b) => b.votes - a.votes);
  diag_out.peaks = peaks.length;
  diag_out.topVotes = peaks.slice(0, 5).map((p) => p.votes | 0);
  diag_out.minVotes = minVotes | 0;
  let tooShort = 0;

  // Turn each infinite line into an actual segment by walking it and keeping
  // the longest supported run. This is what rejects lines that scored well by
  // clipping several unrelated strokes.
  const segments = [];
  const minLen = Math.hypot(w, h) * 0.08;
  for (const peak of peaks.slice(0, maxLines * 2)) {
    const c = cos[peak.t];
    const s = sin[peak.t];
    const px = peak.rho * c;
    const py = peak.rho * s;
    const dx = -s;
    const dy = c;

    let run = null;
    let best = null;
    let gap = 0;
    for (let k = -diag; k <= diag; k++) {
      const x = Math.round(px + dx * k);
      const y = Math.round(py + dy * k);
      const inside = x >= 0 && y >= 0 && x < w && y < h;
      const hit = inside && (mask[y * w + x] || mask[y * w + Math.min(w - 1, x + 1)]);

      if (hit) {
        gap = 0;
        if (!run) run = { k0: k, k1: k };
        else run.k1 = k;
      } else if (run) {
        gap += 1;
        if (gap > 6) { // tolerate small breaks in a hand-drawn stroke
          if (!best || run.k1 - run.k0 > best.k1 - best.k0) best = run;
          run = null;
        }
      }
    }
    if (run && (!best || run.k1 - run.k0 > best.k1 - best.k0)) best = run;
    if (!best) continue;

    const len = best.k1 - best.k0;
    if (len < minLen) { tooShort += 1; continue; }

    segments.push({
      x1: px + dx * best.k0,
      y1: py + dy * best.k0,
      x2: px + dx * best.k1,
      y2: py + dy * best.k1,
      length: len,
    });
    if (segments.length >= maxLines) break;
  }

  diag_out.tooShort = tooShort;
  diag_out.minLen = minLen | 0;
  return segments;
}

/* ------------------------------------------------------- vanishing point RANSAC */

/**
 * How well a segment agrees with a candidate vanishing point: the angle between
 * the segment's own direction and the direction from its midpoint to the point.
 * Angle rather than pixel distance, because a distant vanishing point makes
 * pixel error meaningless.
 */
function consistency(seg, vp) {
  const mx = (seg.x1 + seg.x2) / 2;
  const my = (seg.y1 + seg.y2) / 2;
  let dx = seg.x2 - seg.x1;
  let dy = seg.y2 - seg.y1;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;

  let vx = vp.x - mx;
  let vy = vp.y - my;
  const vl = Math.hypot(vx, vy) || 1;
  vx /= vl; vy /= vl;

  // Absolute value because direction along the line is arbitrary.
  return Math.acos(Math.min(1, Math.abs(dx * vx + dy * vy)));
}

function intersect(a, b) {
  const l1 = [a.y1 - a.y2, a.x2 - a.x1, a.x1 * a.y2 - a.x2 * a.y1];
  const l2 = [b.y1 - b.y2, b.x2 - b.x1, b.x1 * b.y2 - b.x2 * b.y1];
  const x = l1[1] * l2[2] - l1[2] * l2[1];
  const y = l1[2] * l2[0] - l1[0] * l2[2];
  const wgt = l1[0] * l2[1] - l1[1] * l2[0];
  if (Math.abs(wgt) < 1e-9) return null; // parallel in the image
  return { x: x / wgt, y: y / wgt };
}

const TOL = (2.0 * Math.PI) / 180;

/**
 * Seeded RNG. RANSAC must be reproducible: re-running the tool on the same
 * drawing has to give the same camera, or every downstream position shifts and
 * a set stops being a set.
 */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Greedily pull the strongest vanishing point out of a segment pool. */
function bestVanishingPoint(segments, iterations = 1500) {
  if (segments.length < 3) return null;
  let winner = null;
  // Seed off the pool size so successive passes explore differently while any
  // single pass stays reproducible.
  const rand = rng(0x5e7c17 + segments.length);

  for (let i = 0; i < iterations; i++) {
    const a = segments[(rand() * segments.length) | 0];
    const b = segments[(rand() * segments.length) | 0];
    if (a === b) continue;
    const vp = intersect(a, b);
    if (!vp || !Number.isFinite(vp.x) || !Number.isFinite(vp.y)) continue;

    let score = 0;
    const inliers = [];
    for (const s of segments) {
      if (consistency(s, vp) < TOL) {
        inliers.push(s);
        score += s.length; // long edges are better evidence than short ones
      }
    }
    if (inliers.length >= 3 && (!winner || score > winner.score)) {
      winner = { vp, inliers, score };
    }
  }

  if (!winner) return null;

  // Refit against every inlier rather than keeping the two random seeds.
  const refined = fitVanishingPoint(winner.inliers);
  if (refined) {
    const kept = segments.filter((s) => consistency(s, refined) < TOL);
    if (kept.length >= winner.inliers.length * 0.8) {
      return { vp: refined, inliers: kept, score: kept.reduce((n, s) => n + s.length, 0) };
    }
  }
  return winner;
}

function findVanishingPoints(segments) {
  const found = [];
  let pool = segments.slice();
  for (let i = 0; i < 3 && pool.length >= 3; i++) {
    const hit = bestVanishingPoint(pool);
    if (!hit) break;
    found.push(hit);
    const used = new Set(hit.inliers);
    pool = pool.filter((s) => !used.has(s));
  }
  return found;
}

/** Mean absolute lean of a group's segments away from image vertical. */
function verticalness(group) {
  let sum = 0;
  for (const s of group.inliers) {
    const a = Math.atan2(Math.abs(s.y2 - s.y1), Math.abs(s.x2 - s.x1));
    sum += a;
  }
  return sum / group.inliers.length; // near PI/2 means near-vertical
}

/* ------------------------------------------------------------------- the entry */

/**
 * Look at an image, return a solved camera plus everything needed to show the
 * user what it found and let them overrule it.
 *
 * @param {HTMLImageElement} image  already loaded
 * @param {number} camHeight        world scale, in metres
 */
export function autoCalibrate(image, camHeight = 1.7) {
  const t0 = performance.now();

  const diag = {};
  const grayData = toGrayscale(image);
  const edgeData = detectEdges(grayData);
  diag.edgePixels = edgeData.edges.length;
  diag.detectSize = [grayData.w, grayData.h];
  const small = houghLines(edgeData, 90, diag);

  // Everything so far ran on the downscaled copy. Put it back in source pixels.
  const k = 1 / grayData.scale;
  const segments = small.map((s) => ({
    x1: s.x1 * k, y1: s.y1 * k, x2: s.x2 * k, y2: s.y2 * k, length: s.length * k,
  }));

  const groups = findVanishingPoints(segments);
  const report = {
    ms: 0,
    segments,
    groups,
    diag,
    // Kept rather than thrown away: shape fitting scores its hypotheses by
    // asking how much real drawn edge sits under each predicted cuboid edge,
    // and that needs the raw mask, not the tidied-up segments.
    edgeMask: { mask: edgeData.mask, w: edgeData.w, h: edgeData.h, scale: grayData.scale },
    camera: null,
    method: null,
    reason: null,
  };

  if (groups.length < 2) {
    report.reason = groups.length
      ? 'only one vanishing direction found. The drawing may be flat-on, or the lines are too broken to trace.'
      : 'no converging lines found. Is there any straight-edged structure in this image?';
    report.ms = performance.now() - t0;
    return report;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  // Classify each family: which world axis it runs along, and whether its
  // vanishing point is close enough to be usable or has run off to infinity.
  //
  // This distinction is the whole game. A vanishing point at infinity does NOT
  // mean the image is a parallel projection. Uprights staying parallel while
  // two horizontal directions converge is precisely the definition of TWO-POINT
  // perspective, which is a real camera held level and probably the most common
  // construction in drawn architecture.
  const maxDim = Math.max(width, height);
  const INFINITY_FACTOR = 12; // vanishing points beyond this are treated as parallel

  const families = groups.map((g) => {
    const dir = familyDirection(g.inliers);
    const dist = Math.hypot(g.vp.x - width / 2, g.vp.y - height / 2);
    return {
      group: g,
      dir,
      dist,
      atInfinity: dist > maxDim * INFINITY_FACTOR,
      upright: Math.abs(dir.y) > Math.cos((30 * Math.PI) / 180),
    };
  });

  const uprights = families.filter((f) => f.upright).sort((a, b) => b.group.score - a.group.score);
  const grounds = families.filter((f) => !f.upright).sort((a, b) => b.group.score - a.group.score);
  const finiteGrounds = grounds.filter((f) => !f.atInfinity);

  report.classification = {
    uprights: uprights.length,
    uprightAtInfinity: uprights[0] ? uprights[0].atInfinity : null,
    groundDirections: grounds.length,
    groundConverging: finiteGrounds.length,
  };

  // THREE-POINT: everything converges, so the camera is tilted and even the
  // uprights lean. Determines focal length and principal point outright.
  if (uprights.length && !uprights[0].atInfinity && finiteGrounds.length >= 2) {
    const cam = solveThreePoint({
      vpA: finiteGrounds[0].group.vp,
      vpB: finiteGrounds[1].group.vp,
      vpV: uprights[0].group.vp,
      width, height, camHeight,
    });
    if (cam) {
      report.camera = cam;
      report.method = 'three-point perspective';
      report.used = [finiteGrounds[0].group, finiteGrounds[1].group, uprights[0].group];
    }
  }

  // TWO-POINT: uprights parallel, two horizontal directions converging. The
  // principal point slides along the horizon rather than sitting at the image
  // centre, which is what a cropped or shifted frame does.
  if (!report.camera && uprights.length && uprights[0].atInfinity && finiteGrounds.length >= 2) {
    const cam = solveTwoPoint({
      vpA: finiteGrounds[0].group.vp,
      vpB: finiteGrounds[1].group.vp,
      upDir: uprights[0].dir,
      width, height, camHeight,
    });
    if (cam) {
      report.camera = cam;
      report.method = 'two-point perspective';
      report.used = [finiteGrounds[0].group, finiteGrounds[1].group];
      report.principalPoint = [Math.round(cam.cx), Math.round(cam.cy)];
    }
  }

  // ONE-POINT: only a single horizontal direction converges. The other is
  // parallel in the image, so its vanishing point gives nothing, and the
  // uprights have to supply the second constraint.
  if (!report.camera && uprights.length && !uprights[0].atInfinity && finiteGrounds.length === 1) {
    const cam = solveFromVerticalAndHorizontal({
      vpVertical: uprights[0].group.vp,
      vpHorizontal: finiteGrounds[0].group.vp,
      width, height, camHeight,
    });
    if (cam) {
      report.camera = cam;
      report.method = 'one-point perspective';
      report.used = [uprights[0].group, finiteGrounds[0].group];
    }
  }

  // Last perspective attempt: two converging ground directions with no usable
  // upright family at all.
  if (!report.camera && finiteGrounds.length >= 2) {
    const cam = solveFromTwoVPs({
      vpX: finiteGrounds[0].group.vp,
      vpZ: finiteGrounds[1].group.vp,
      width, height, camHeight,
    });
    if (cam) {
      report.camera = cam;
      report.method = 'two horizontal vanishing points, principal point assumed centred';
      report.used = [finiteGrounds[0].group, finiteGrounds[1].group];
    }
  }

  // A perspective solve can succeed numerically and still be meaningless. As
  // the vanishing points run off toward infinity the focal length formula
  // divides by a vanishing convergence and returns something enormous, which is
  // the arithmetic telling us the projection is parallel, not that the lens is
  // a 2000mm. Catch that here rather than passing a fantasy camera downstream.
  if (report.camera && (report.camera.focal > maxDim * 6 || report.camera.fovY < 12)) {
    report.perspectiveRejected =
      `perspective solve gave focal ${Math.round(report.camera.focal)}px ` +
      `(${report.camera.fovY.toFixed(1)}° field of view), which means the vanishing points are ` +
      'effectively at infinity. Treating the image as a parallel projection instead.';
    report.camera = null;
    report.method = null;
  }

  // Axonometric fallback, and it must be a genuine last resort. It applies only
  // when NOTHING converges: uprights parallel AND both ground directions
  // parallel too. If the ground directions converge, the image is two-point
  // perspective and was already solved above.
  if (!report.camera) {
    const ground = grounds;

    if (ground.length >= 2) {
      const basis = solveAxonometricBasis(ground[0].dir, ground[1].dir);
      if (basis) {
        const scale = height / (camHeight * 18); // pixels per world unit, adjustable later
        report.camera = new AxonometricCamera({
          width, height,
          dirX: ground[0].dir,
          dirZ: ground[1].dir,
          basis,
          scale,
        });
        report.method = 'axonometric, parallel projection';
        report.used = [ground[0].group, ground[1].group];
        report.axonometric = {
          foreshortening: {
            x: +basis.a.toFixed(3),
            z: +basis.b.toFixed(3),
            y: +basis.h.toFixed(3),
          },
          angles: [
            +((Math.atan2(ground[0].dir.y, ground[0].dir.x) * 180) / Math.PI).toFixed(1),
            +((Math.atan2(ground[1].dir.y, ground[1].dir.x) * 180) / Math.PI).toFixed(1),
          ],
        };
      } else {
        report.reason =
          'two ground directions were found but no rotation could produce them, so this is neither ' +
          'a consistent perspective nor a consistent parallel projection.';
      }
    }
  }

  if (!report.camera && !report.reason) {
    report.reason =
      'found vanishing directions, but no pair of them is perpendicular in the scene, so there is no real focal length. Trace the lines by hand.';
  }

  report.ms = performance.now() - t0;
  return report;
}
