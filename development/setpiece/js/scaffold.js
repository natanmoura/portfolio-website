// scaffold.js — turn the solved camera into a ruler the model can read.
//
// Vision models are poor at estimating metric depth and good at reading a
// diagram. So rather than asking "how far away is that column", we draw the
// solved ground plane back onto the drawing with its world coordinates printed
// on it, stand a few poles of known height on it, and ask the model to report
// where things sit *on the grid it can see*.
//
// The scaffold is exact, because it comes from the camera solve. That turns the
// model's job from inventing a coordinate system into interpolating inside a
// correct one, which is a completely different and much easier task. Anything
// it reports can then be checked against the drawing by verify.js.

import * as THREE from 'three';

const NICE = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 250, 500];
const nearest = (want) =>
  NICE.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), NICE[0]);

/**
 * Sample where the ground actually lands in frame, in world units.
 *
 * Everything about the scaffold should be driven by this rather than by camera
 * height. A camera 40 units up but pitched steeply down sees a few dozen units
 * of floor, while the same camera held level sees hundreds, and a grid sized
 * from height alone is unusable in one of those cases.
 */
function visibleGround(cam) {
  const pts = [];
  for (const fx of [0.1, 0.5, 0.9]) {
    for (const fy of [0.55, 0.75, 0.98]) {
      const g = cam.groundPoint(fx * cam.width, fy * cam.height);
      if (g) pts.push(g);
    }
  }
  if (!pts.length) return null;

  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return {
    pts,
    centre: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
    span: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)),
  };
}

/** Grid spacing that puts roughly eight lines across the visible floor. */
function chooseSpacing(cam, ground) {
  if (ground && ground.span > 0) return nearest(ground.span / 8);
  return nearest(cam.isOrthographic ? 110 / cam.scale : cam.camHeight * 2);
}

/** A pole tall enough to measure against without dominating the frame. */
function choosePoleHeight(cam, ground) {
  if (ground && ground.span > 0) return nearest(ground.span / 6);
  if (cam.isOrthographic) return nearest(cam.height / 5 / cam.stepY);
  return Math.max(1, Math.round(cam.camHeight));
}

/**
 * Render the drawing with a measured overlay on top.
 *
 * @param {HTMLImageElement} image
 * @param {SolvedCamera} cam
 * @param {object} [opts]
 * @returns {{dataUrl: string, spacing: number, extent: number, poleHeight: number}}
 */
export function buildScaffold(image, cam, opts = {}) {
  const W = cam.width;
  const H = cam.height;
  const ground = visibleGround(cam);
  const spacing = opts.spacing || chooseSpacing(cam, ground);
  const poleHeight = opts.poleHeight || choosePoleHeight(cam, ground);

  // Cover the visible floor, plus margin, without drawing thousands of
  // off-screen lines.
  const extent =
    opts.extent ||
    (ground
      ? Math.ceil((Math.max(Math.abs(ground.centre[0]), Math.abs(ground.centre[1])) + ground.span) / spacing) * spacing
      : spacing * 12);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0, W, H);

  // Wash the drawing back so the overlay reads clearly. The model still needs
  // to see the artwork, so this is a veil rather than a mask.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, W, H);

  const project = (x, y, z) => cam.project(new THREE.Vector3(x, y, z));

  /** Draw a world-space segment, subdivided so it curves correctly in frame. */
  const stroke = (a, b, steps = 12) => {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / steps);
      const q = project(p.x, p.y, p.z);
      if (!q) { started = false; continue; }
      if (!started) { ctx.moveTo(q.u, q.v); started = true; }
      else ctx.lineTo(q.u, q.v);
    }
    ctx.stroke();
  };

  // Ground grid.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,120,255,0.55)';
  for (let v = -extent; v <= extent; v += spacing) {
    stroke(new THREE.Vector3(v, 0, -extent), new THREE.Vector3(v, 0, extent));
    stroke(new THREE.Vector3(-extent, 0, v), new THREE.Vector3(extent, 0, v));
  }

  // Axes through the origin, heavier, so the model can orient itself.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(220,0,90,0.85)';
  stroke(new THREE.Vector3(-extent, 0, 0), new THREE.Vector3(extent, 0, 0));
  ctx.strokeStyle = 'rgba(0,160,60,0.85)';
  stroke(new THREE.Vector3(0, 0, -extent), new THREE.Vector3(0, 0, extent));

  // Horizon.
  const horizonV = cam.horizonV();
  if (horizonV != null && horizonV > 0 && horizonV < H) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, horizonV);
    ctx.lineTo(W, horizonV);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('horizon (eye level)', 10, horizonV - 7);
  }

  // Coordinate labels at grid intersections. Only every other one, and only
  // where they are far enough apart on screen to stay legible.
  ctx.font = '600 14px ui-monospace, monospace';
  const placed = [];
  for (let x = -extent; x <= extent; x += spacing * 2) {
    for (let z = -extent; z <= extent; z += spacing * 2) {
      const q = project(x, 0, z);
      if (!q || q.u < 24 || q.u > W - 24 || q.v < 12 || q.v > H - 8) continue;
      if (placed.some((p) => Math.hypot(p.u - q.u, p.v - q.v) < 62)) continue;
      placed.push(q);

      const text = `${x},${z}`;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(q.u - w / 2 - 3, q.v - 15, w + 6, 17);
      ctx.fillStyle = 'rgba(0,60,150,0.95)';
      ctx.fillText(text, q.u - w / 2, q.v - 2);

      ctx.fillStyle = 'rgba(0,120,255,0.9)';
      ctx.beginPath();
      ctx.arc(q.u, q.v, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Height poles. Without these the model has a floor plan but no vertical
  // scale, and every height it reports would be a guess again.
  // Stand the poles where the floor is genuinely visible, found by
  // back-projecting from the image rather than assumed world positions. Fixed
  // coordinates land off-frame the moment the camera is not a street-level one.
  const poleSpots = ground
    ? [
        [0.25, 0.7], [0.5, 0.85], [0.75, 0.7], [0.5, 0.6],
      ]
        .map(([fx, fy]) => cam.groundPoint(fx * W, fy * H))
        .filter(Boolean)
        .map((p) => [p.x, p.z])
    : [
        [0, -spacing * 2],
        [-spacing * 3, -spacing * 5],
        [spacing * 3, -spacing * 5],
      ];
  ctx.lineWidth = 3;
  for (const [x, z] of poleSpots) {
    const foot = project(x, 0, z);
    const head = project(x, poleHeight, z);
    if (!foot || !head) continue;
    if (foot.u < 0 || foot.u > W || foot.v < 0 || foot.v > H) continue;

    ctx.strokeStyle = 'rgba(255,110,0,0.95)';
    ctx.beginPath();
    ctx.moveTo(foot.u, foot.v);
    ctx.lineTo(head.u, head.v);
    ctx.stroke();

    // Tick at the top so the pole reads as a measurement, not a drawn object.
    ctx.beginPath();
    ctx.moveTo(head.u - 7, head.v);
    ctx.lineTo(head.u + 7, head.v);
    ctx.stroke();

    const label = `${poleHeight}m`;
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(head.u + 9, head.v - 12, w + 6, 16);
    ctx.fillStyle = 'rgba(190,70,0,1)';
    ctx.fillText(label, head.u + 12, head.v);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    spacing,
    extent,
    poleHeight,
    horizonFraction: horizonV == null ? null : horizonV / H,
  };
}
