// ortho.js — the axonometric case.
//
// A large amount of stylised 3D art, and most of the diorama look, is rendered
// with parallel projection or a lens so long it may as well be. Vertical edges
// stay vertical, nothing converges, and there is no horizon anywhere in frame.
//
// Perspective solving has no answer here and should not pretend otherwise. The
// focal length formula divides by the convergence, so as the vanishing points
// run off to infinity it returns a confidently enormous number rather than an
// error. Detecting this case and switching projection is the fix.
//
// The good news is that axonometric is easier, not harder. There is no depth
// foreshortening to undo, so the map from image to ground plane is a plain 2x2
// linear system, exact everywhere, with no horizon to fall foul of.

import * as THREE from 'three';

/**
 * Recover an axonometric basis from the two ground-axis image directions.
 *
 * With world up projecting straight up the image, the projection is fully
 * described by how far one world unit travels along each axis in pixels. Write
 * those as a·uX, b·uZ and h for the vertical, and requiring the projection to
 * be a genuine rotation gives three constraints:
 *
 *     |row0| = 1 , |row1| = 1 , row0 . row1 = 0
 *
 * which are linear in a², b² and h². So the whole thing is a closed form, not a
 * fit, and it also tells you when an image is not axonometric at all: any of
 * the three coming out negative means no rotation could have produced these
 * directions.
 *
 * @param {{x:number,y:number}} dirX unit image direction of one ground axis
 * @param {{x:number,y:number}} dirZ unit image direction of the other
 */
export function solveAxonometricBasis(dirX, dirZ) {
  const p = dirX.x * dirX.x;
  const q = dirZ.x * dirZ.x;
  const r = dirX.x * dirX.y;
  const t = dirZ.x * dirZ.y;

  const D = q * r - t * p;
  if (Math.abs(D) < 1e-9) return null; // the two axes are indistinguishable

  const A = -t / D;
  const B = r / D;
  if (A <= 0 || B <= 0) return null;

  const H = 1 - A * dirX.y * dirX.y - B * dirZ.y * dirZ.y;
  if (H <= 0) return null;

  return { a: Math.sqrt(A), b: Math.sqrt(B), h: Math.sqrt(H) };
}

/**
 * A solved parallel-projection camera. Deliberately exposes the same surface as
 * SolvedCamera so blockout, scaffolding and annotation all work unchanged.
 */
export class AxonometricCamera {
  /**
   * @param {object} cfg
   * @param {number} cfg.width  image pixels
   * @param {number} cfg.height
   * @param {{x,y}} cfg.dirX    unit image direction of world +X
   * @param {{x,y}} cfg.dirZ    unit image direction of world +Z
   * @param {object} cfg.basis  from solveAxonometricBasis
   * @param {number} cfg.scale  pixels per world unit
   * @param {number[]} [cfg.origin] image pixel where the world origin sits
   */
  constructor({ width, height, dirX, dirZ, basis, scale, origin }) {
    this.isOrthographic = true;
    this.width = width;
    this.height = height;
    this.cx = width / 2;
    this.cy = height / 2;

    this.dirX = dirX;
    this.dirZ = dirZ;
    this.basis = basis;
    this.scale = scale;
    this.origin = origin || [width / 2, height * 0.72];

    // Pixel displacement of one world unit along each axis.
    this.stepX = { u: basis.a * dirX.x * scale, v: basis.a * dirX.y * scale };
    this.stepZ = { u: basis.b * dirZ.x * scale, v: basis.b * dirZ.y * scale };
    this.stepY = basis.h * scale; // upward, so it subtracts from v

    // World-to-camera rotation, assembled from the same three numbers.
    const row0 = new THREE.Vector3(basis.a * dirX.x, 0, basis.b * dirZ.x);
    const row1 = new THREE.Vector3(-basis.a * dirX.y, basis.h, -basis.b * dirZ.y);
    const row2 = new THREE.Vector3().crossVectors(row0, row1).normalize();

    const worldToCam = new THREE.Matrix4().set(
      row0.x, row0.y, row0.z, 0,
      row1.x, row1.y, row1.z, 0,
      row2.x, row2.y, row2.z, 0,
      0, 0, 0, 1,
    );
    this.rotation = worldToCam.clone().transpose();

    // Parallel projection has no viewpoint, only a direction, so the camera
    // position is ours to choose. Choose it so that a plain centred
    // OrthographicCamera reproduces this projection exactly, which saves
    // carrying frustum offsets around everywhere downstream.
    //
    // The rows are orthonormal, so sliding the camera by alpha along row0 and
    // beta along row1 shifts the image by exactly those amounts. Solving for
    // the shift that lands the world origin on `origin` gives:
    const alpha = (this.cx - this.origin[0]) / scale;
    const beta = (this.origin[1] - this.cy) / scale;
    const depth = (Math.max(width, height) / scale) * 2;

    this.position = new THREE.Vector3()
      .addScaledVector(row0, alpha)
      .addScaledVector(row1, beta)
      .addScaledVector(row2, depth);
    this.camHeight = height / (2 * this.stepY); // world units visible above centre
    this.focal = Infinity;
  }

  get fovY() {
    return 0; // parallel projection has no field of view
  }

  /** World point -> image pixel. Always defined: nothing is ever behind. */
  project(p) {
    return {
      u: this.origin[0] + p.x * this.stepX.u + p.z * this.stepZ.u,
      v: this.origin[1] + p.x * this.stepX.v + p.z * this.stepZ.v - p.y * this.stepY,
    };
  }

  /**
   * Image pixel -> point on the ground plane.
   *
   * A 2x2 solve, and unlike the perspective case it never fails: there is no
   * horizon, so every pixel maps to exactly one place on the floor.
   */
  groundPoint(u, v) {
    const du = u - this.origin[0];
    const dv = v - this.origin[1];
    const det = this.stepX.u * this.stepZ.v - this.stepZ.u * this.stepX.v;
    if (Math.abs(det) < 1e-12) return null;
    return new THREE.Vector3(
      (du * this.stepZ.v - dv * this.stepZ.u) / det,
      0,
      (this.stepX.u * dv - this.stepX.v * du) / det,
    );
  }

  /** Height of a vertical object based at `base` whose top is at pixel row v. */
  heightAt(base, u, v) {
    const foot = this.project(base);
    return Math.max(0, (foot.v - v) / this.stepY);
  }

  /** Direction of view, constant everywhere in a parallel projection. */
  ray() {
    return new THREE.Vector3(0, 0, -1).applyMatrix4(this.rotation).normalize();
  }

  /** There is no horizon in a parallel projection, and saying so matters. */
  horizonV() {
    return null;
  }

  /** Matching three.js camera for the viewer. */
  makeThreeCamera() {
    const halfW = this.width / (2 * this.scale);
    const halfH = this.height / (2 * this.scale);
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 10000);
    cam.position.copy(this.position);
    cam.quaternion.setFromRotationMatrix(this.rotation);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return cam;
  }

  toStation(id, src) {
    return {
      id,
      name: 'station',
      projection: 'orthographic',
      src,
      width: this.width,
      height: this.height,
      scale: this.scale,
      origin: this.origin.slice(),
      dirX: [this.dirX.x, this.dirX.y],
      dirZ: [this.dirZ.x, this.dirZ.y],
      basis: { ...this.basis },
      rotation: this.rotation.toArray(),
      position: this.position.toArray(),
      focal: 0,
    };
  }
}

/** Rebuild a solved camera from a saved station. */
export function axonometricFromStation(st) {
  return new AxonometricCamera({
    width: st.width,
    height: st.height,
    dirX: { x: st.dirX[0], y: st.dirX[1] },
    dirZ: { x: st.dirZ[0], y: st.dirZ[1] },
    basis: st.basis,
    scale: st.scale,
    origin: st.origin,
  });
}

/**
 * Average, sign-normalised image direction of a family of segments.
 * Signs are folded so that segments pointing opposite ways along the same line
 * do not cancel each other to nothing.
 */
export function familyDirection(segments) {
  let ux = 0;
  let uy = 0;
  for (const s of segments) {
    let dx = s.x2 - s.x1;
    let dy = s.y2 - s.y1;
    if (dx < 0 || (dx === 0 && dy < 0)) { dx = -dx; dy = -dy; }
    const len = Math.hypot(dx, dy) || 1;
    ux += dx / len;
    uy += dy / len;
  }
  const len = Math.hypot(ux, uy) || 1;
  return { x: ux / len, y: uy / len };
}
