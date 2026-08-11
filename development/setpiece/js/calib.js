// calib.js — single-view camera solve and image<->world mapping.
//
// The whole blockout engine is this file. No ML, no depth model, just the
// classic single-view metrology result: if you know the horizon and the camera
// height, every pixel where an object touches the ground has exactly one
// possible world position. Drawings are ideal input because their perspective
// lines are clean and deliberate.
//
// Conventions match three.js: camera looks down -Z in camera space, world Y is
// up, ground plane is y = 0. Image coords are pixels with v growing downward.
// Principal point is assumed to be the image centre.

import * as THREE from 'three';

/**
 * Fit a vanishing point to a set of 2D line segments in image space.
 * Each segment is {x1, y1, x2, y2}. Two segments give an exact intersection;
 * more than two are solved in a least-squares sense.
 *
 * A line through (x1,y1),(x2,y2) has homogeneous form l = p1 x p2. A point v
 * lies on it when l . v = 0, so stacking the segments gives A v = 0 and the
 * vanishing point is the null vector, i.e. the smallest singular vector of A.
 * With only ever a handful of lines we can get that from the eigenvector of
 * A^T A rather than pulling in an SVD.
 */
export function fitVanishingPoint(segments) {
  if (segments.length < 2) return null;

  const rows = segments.map(({ x1, y1, x2, y2 }) => {
    // cross product of the two homogeneous endpoints
    const l = [y1 - y2, x2 - x1, x1 * y2 - x2 * y1];
    const n = Math.hypot(l[0], l[1]) || 1;
    return [l[0] / n, l[1] / n, l[2] / n];
  });

  // Build the 3x3 normal matrix A^T A.
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const r of rows) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j];
    }
  }

  const v = smallestEigenvector3(M);
  if (!v || Math.abs(v[2]) < 1e-9) return null; // vanishing point at infinity
  return { x: v[0] / v[2], y: v[1] / v[2] };
}

/**
 * Smallest-eigenvalue eigenvector of a symmetric 3x3 matrix, by inverse
 * iteration on a slightly shifted matrix. Plenty for three to six lines.
 */
function smallestEigenvector3(M) {
  const trace = M[0][0] + M[1][1] + M[2][2];
  const eps = 1e-10 * (trace || 1);
  const A = [
    [M[0][0] + eps, M[0][1], M[0][2]],
    [M[1][0], M[1][1] + eps, M[1][2]],
    [M[2][0], M[2][1], M[2][2] + eps],
  ];
  let v = [0.577, 0.577, 0.577];
  for (let iter = 0; iter < 64; iter++) {
    const next = solve3(A, v);
    if (!next) return null;
    const n = Math.hypot(next[0], next[1], next[2]);
    if (n < 1e-30) return null;
    v = [next[0] / n, next[1] / n, next[2] / n];
  }
  return v;
}

/** Solve A x = b for 3x3 A by Gaussian elimination with partial pivoting. */
function solve3(A, b) {
  const m = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) {
      if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    }
    if (Math.abs(m[piv][c]) < 1e-18) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = m[r][c] / m[c][c];
      for (let j = c; j < 4; j++) m[r][j] -= k * m[c][j];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * Solve focal length from two vanishing points of mutually orthogonal
 * directions. Rays through orthogonal vanishing points are perpendicular in
 * camera space, which reduces to (V1 - p) . (V2 - p) = -f^2.
 *
 * The two points have to straddle the principal point for this to have a real
 * solution. When they do not, the lines the user drew are not orthogonal in
 * the scene (or the drawing simply has no consistent perspective) and we
 * return null so the caller can fall back to a manual field of view.
 */
export function focalFromVanishingPoints(v1, v2, cx, cy) {
  const dot = (v1.x - cx) * (v2.x - cx) + (v1.y - cy) * (v2.y - cy);
  if (dot >= -1e-6) return null;
  return Math.sqrt(-dot);
}

/**
 * A solved camera for one image. Everything downstream (placing blockout,
 * projecting the drawing as a texture, scattering onto the ground) reads from
 * this.
 */
export class SolvedCamera {
  constructor({ width, height, focal, rotation, camHeight = 1.7, cx, cy }) {
    this.width = width;
    this.height = height;
    // The principal point is only at the image centre for an uncropped,
    // unshifted frame. Artwork is very often a crop, which slides it, so it has
    // to be solved for rather than assumed.
    this.cx = cx ?? width / 2;
    this.cy = cy ?? height / 2;
    this.focal = focal;
    /** @type {THREE.Matrix4} camera-to-world rotation */
    this.rotation = rotation || new THREE.Matrix4();
    this.camHeight = camHeight;
    this.position = new THREE.Vector3(0, camHeight, 0);
  }

  /** Vertical field of view in radians, for handing to a THREE.PerspectiveCamera. */
  get fovY() {
    return 2 * Math.atan(this.height / (2 * this.focal)) * (180 / Math.PI);
  }

  /** Image pixel -> normalised world-space ray direction from the camera. */
  ray(u, v) {
    const d = new THREE.Vector3(u - this.cx, -(v - this.cy), -this.focal);
    d.applyMatrix4(this.rotation);
    return d.normalize();
  }

  /**
   * Image pixel -> point on the ground plane y = 0.
   * Returns null for pixels at or above the horizon, where the ray never
   * meets the ground.
   */
  groundPoint(u, v) {
    const r = this.ray(u, v);
    if (r.y > -1e-6) return null;
    const t = -this.position.y / r.y;
    return new THREE.Vector3(
      this.position.x + t * r.x,
      0,
      this.position.z + t * r.z,
    );
  }

  /**
   * Height of a vertical object whose base sits at ground point `base` and
   * whose top appears at image pixel (u, v).
   *
   * The camera ray through the top pixel and the vertical line through `base`
   * are skew in general, so we solve for the ray parameter that best matches
   * the base in the XZ plane and read the height off the ray at that point.
   * That is the least-squares answer and it degrades gracefully when the user
   * clicks slightly off.
   */
  heightAt(base, u, v) {
    const r = this.ray(u, v);
    const denom = r.x * r.x + r.z * r.z;
    if (denom < 1e-12) return 0;
    const t =
      ((base.x - this.position.x) * r.x + (base.z - this.position.z) * r.z) / denom;
    return Math.max(0, this.position.y + t * r.y);
  }

  /** World point -> image pixel. Returns null when behind the camera. */
  project(p) {
    const d = new THREE.Vector3().subVectors(p, this.position);
    const inv = new THREE.Matrix4().copy(this.rotation).transpose();
    d.applyMatrix4(inv);
    if (d.z > -1e-6) return null;
    const depth = -d.z;
    return {
      u: this.cx + (this.focal * d.x) / depth,
      v: this.cy - (this.focal * d.y) / depth,
    };
  }

  /**
   * Serialise to a scene station. Mirrors AxonometricCamera.toStation so the
   * rest of the tool never has to care which projection it is holding.
   */
  toStation(id, src) {
    return {
      id,
      name: 'station',
      projection: 'perspective',
      src,
      width: this.width,
      height: this.height,
      focal: this.focal,
      principal: [this.cx, this.cy],
      rotation: this.rotation.toArray(),
      position: this.position.toArray(),
    };
  }

  /** Image v coordinate of the horizon line, for drawing the calibration overlay. */
  horizonV() {
    // The horizon is where a horizontal forward ray lands. Take the camera's
    // forward direction, flatten it, and project a very distant point.
    const fwd = new THREE.Vector3(0, 0, -1).applyMatrix4(this.rotation);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (flat.lengthSq() < 1e-12) return null;
    flat.normalize().multiplyScalar(1e6);
    const p = this.project(
      new THREE.Vector3(this.position.x + flat.x, 0, this.position.z + flat.z),
    );
    return p ? p.v : null;
  }
}

/**
 * Build a camera from two orthogonal horizontal vanishing points.
 *
 * The rays through the vanishing points are the world X and Z axes expressed
 * in camera space, so stacking them (plus their cross product for Y) gives the
 * world-to-camera rotation directly. Transposing it yields camera-to-world.
 */
export function solveFromTwoVPs({ vpX, vpZ, width, height, camHeight = 1.7 }) {
  const cx = width / 2;
  const cy = height / 2;
  const focal = focalFromVanishingPoints(vpX, vpZ, cx, cy);
  if (!focal) return null;

  const axisX = new THREE.Vector3(vpX.x - cx, -(vpX.y - cy), -focal).normalize();
  const axisZ = new THREE.Vector3(vpZ.x - cx, -(vpZ.y - cy), -focal).normalize();
  const axisY = new THREE.Vector3().crossVectors(axisZ, axisX).normalize();

  // Keep world up pointing up in the image, so the solve does not silently
  // hand back an upside-down scene when the user draws the lines in the other
  // order.
  if (axisY.y < 0) axisY.negate();
  // Re-orthogonalise Z against the corrected Y so the basis stays rigid.
  axisZ.copy(new THREE.Vector3().crossVectors(axisX, axisY)).normalize();

  const worldToCam = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
  const rotation = worldToCam.clone().transpose();

  return new SolvedCamera({ width, height, focal, rotation, camHeight });
}

/**
 * Build a camera from the vertical vanishing point plus one horizontal one.
 *
 * This is the case one-point perspective needs, and drawings use one-point
 * constantly. When a scene has only one set of converging horizontal edges the
 * other set is parallel in the image and its vanishing point runs off to
 * infinity, so solveFromTwoVPs has nothing to work with. Verticals converge
 * anyway (unless the camera is dead level), and vertical is orthogonal to any
 * horizontal, so the same focal-length constraint still applies.
 */
export function solveFromVerticalAndHorizontal({ vpVertical, vpHorizontal, width, height, camHeight = 1.7 }) {
  const cx = width / 2;
  const cy = height / 2;
  const focal = focalFromVanishingPoints(vpVertical, vpHorizontal, cx, cy);
  if (!focal) return null;

  const axisY = new THREE.Vector3(vpVertical.x - cx, -(vpVertical.y - cy), -focal).normalize();
  if (axisY.y < 0) axisY.negate(); // world up must point up in the image

  const axisX = new THREE.Vector3(vpHorizontal.x - cx, -(vpHorizontal.y - cy), -focal);
  // Detected vanishing points are never exactly orthogonal, so project the
  // horizontal axis off the vertical one rather than trusting the measurement.
  axisX.addScaledVector(axisY, -axisX.dot(axisY)).normalize();

  const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

  const worldToCam = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
  return new SolvedCamera({ width, height, focal, rotation: worldToCam.clone().transpose(), camHeight });
}

/**
 * TWO-POINT PERSPECTIVE.
 *
 * The case where upright edges stay parallel in the image and two horizontal
 * directions converge. This is not a parallel projection, it is a real
 * perspective camera held level, and it is probably the most common
 * construction in drawn architecture.
 *
 * The key relation: a vanishing point at infinity along image direction d
 * forces (V - P) . d = 0 for every other vanishing point V. So both horizontal
 * vanishing points, AND the principal point, all lie on one line perpendicular
 * to the uprights. That line is the horizon.
 *
 * The principal point is therefore NOT free to sit at the image centre. It
 * slides along the horizon, which is exactly what happens when a frame is
 * cropped or the lens is shifted. One degree of freedom is left over, and the
 * honest default is the point on the horizon nearest the image centre, i.e.
 * assume the crop was horizontal-centred.
 *
 * @param {{x,y}} vpA        first horizontal vanishing point
 * @param {{x,y}} vpB        second horizontal vanishing point, perpendicular in the scene
 * @param {{x,y}} upDir      unit image direction of the upright edges
 */
export function solveTwoPoint({ vpA, vpB, upDir, width, height, camHeight = 1.7 }) {
  const d = new THREE.Vector2(upDir.x, upDir.y).normalize();

  // Both vanishing points must share a projection onto the upright direction.
  // Averaging them is the least-squares horizon given imperfect detection.
  const t = (vpA.x * d.x + vpA.y * d.y + (vpB.x * d.x + vpB.y * d.y)) / 2;

  // Principal point: the point on that horizon closest to the image centre.
  const centre = new THREE.Vector2(width / 2, height / 2);
  const shift = t - (centre.x * d.x + centre.y * d.y);
  const px = centre.x + shift * d.x;
  const py = centre.y + shift * d.y;

  const dot = (vpA.x - px) * (vpB.x - px) + (vpA.y - py) * (vpB.y - py);
  if (dot >= -1e-6) return null; // the two directions are not perpendicular in the scene
  const focal = Math.sqrt(-dot);

  // A vanishing point at infinity along image direction d corresponds to a
  // world direction parallel to the image plane, so its camera-space z is zero.
  const axisY = new THREE.Vector3(d.x, -d.y, 0).normalize();
  if (axisY.y < 0) axisY.negate();

  const axisX = new THREE.Vector3(vpA.x - px, -(vpA.y - py), -focal).normalize();
  const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();
  // Re-orthogonalise so detection error cannot leave a non-rigid basis.
  axisX.copy(new THREE.Vector3().crossVectors(axisY, axisZ)).normalize();

  const worldToCam = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
  return new SolvedCamera({
    width, height, focal, cx: px, cy: py, camHeight,
    rotation: worldToCam.clone().transpose(),
  });
}

/**
 * THREE-POINT PERSPECTIVE.
 *
 * All three directions converge, which means the camera is tilted up or down
 * enough that uprights lean too. Three mutually orthogonal vanishing points
 * determine both the focal length and the principal point outright: the
 * principal point is the orthocentre of the triangle they form.
 */
export function solveThreePoint({ vpA, vpB, vpV, width, height, camHeight = 1.7 }) {
  const P = orthocentre(vpA, vpB, vpV);
  if (!P) return null;

  const dot = (vpA.x - P.x) * (vpB.x - P.x) + (vpA.y - P.y) * (vpB.y - P.y);
  if (dot >= -1e-6) return null;
  const focal = Math.sqrt(-dot);

  const ray = (v) => new THREE.Vector3(v.x - P.x, -(v.y - P.y), -focal).normalize();
  const axisY = ray(vpV);
  if (axisY.y < 0) axisY.negate();

  const axisX = ray(vpA);
  axisX.addScaledVector(axisY, -axisX.dot(axisY)).normalize();
  const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

  const worldToCam = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
  return new SolvedCamera({
    width, height, focal, cx: P.x, cy: P.y, camHeight,
    rotation: worldToCam.clone().transpose(),
  });
}

/** Orthocentre of a triangle, which for three orthogonal VPs is the principal point. */
function orthocentre(a, b, c) {
  // Altitude from a is perpendicular to bc, and likewise from b.
  const d1x = c.x - b.x;
  const d1y = c.y - b.y;
  const d2x = c.x - a.x;
  const d2y = c.y - a.y;

  const det = d1x * d2y - d1y * d2x;
  if (Math.abs(det) < 1e-9) return null; // collinear, no triangle

  // Solve a + s*n1 = b + u*n2 where n are the altitude directions.
  const rhs1 = d1x * a.x + d1y * a.y;
  const rhs2 = d2x * b.x + d2y * b.y;
  return {
    x: (rhs1 * d2y - rhs2 * d1y) / det,
    y: (d1x * rhs2 - d2x * rhs1) / det,
  };
}

/**
 * Fallback solve for drawings with only one usable vanishing direction, or
 * where the artist wants to dial the lens by feel. The user gives a horizon
 * height and a field of view, and we derive the pitch from
 * tan(pitch) = (cy - v_horizon) / f.
 */
export function solveFromHorizon({ horizonV, fovYDeg, width, height, camHeight = 1.7, rollDeg = 0 }) {
  const cy = height / 2;
  const focal = height / (2 * Math.tan((fovYDeg * Math.PI) / 360));
  const pitch = Math.atan((cy - horizonV) / focal);
  const rotation = new THREE.Matrix4().makeRotationX(-pitch);
  if (rollDeg) {
    rotation.multiply(new THREE.Matrix4().makeRotationZ((rollDeg * Math.PI) / 180));
  }
  return new SolvedCamera({ width, height, focal, rotation, camHeight });
}
