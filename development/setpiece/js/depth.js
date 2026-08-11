// depth.js — move an object toward or away from the camera without changing
// the picture.
//
// A single image cannot tell you how far away anything is along the view axis.
// That is not a shortcoming of the solve, it is a property of the projection:
// infinitely many arrangements produce the same picture. The tool has to guess
// something, and it guesses "standing on the ground", which is right often
// enough to be useful and wrong often enough to need fixing by hand.
//
// So rather than pretend, expose the ambiguity as the control it actually is.
// Sliding an object along the view ray, with size compensated, leaves it
// looking identical from the station camera while changing what it sits behind
// and in front of. That is the entire depth-authoring surface, and it cannot
// break the match to the drawing no matter how far it is pushed.
//
// The two projections behave differently, and the difference is worth knowing:
//
//   parallel     depth is completely free. Nothing changes on screen at all,
//                not even by a pixel, and no rescaling is needed.
//   perspective  depth trades against size. Moving twice as far away needs the
//                object twice as large to hold its place in frame.

import * as THREE from 'three';

/** Centre of a node in world space, accounting for base-centred authoring. */
function centreOf(node, offset) {
  return new THREE.Vector3(node.position[0], node.position[1] + offset, node.position[2]);
}

/**
 * Slide a node along the view axis.
 *
 * @param {object} node        scene node, mutated in place
 * @param {object} cam         solved camera, perspective or axonometric
 * @param {number} delta       world units. Positive pushes away from camera.
 * @param {number} centreLift  distance from node.position.y to the geometry
 *                             centre, from the viewer's centreOffset
 * @returns {{moved:number, scaled:number}}
 */
export function slideDepth(node, cam, delta, centreLift = 0) {
  const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(cam.rotation).normalize();

  if (cam.isOrthographic) {
    // Parallel projection: pure translation, no size change, no image change.
    node.position[0] += forward.x * delta;
    node.position[1] += forward.y * delta;
    node.position[2] += forward.z * delta;
    return { moved: delta, scaled: 1 };
  }

  // Perspective: move along the ray from the camera through this object, and
  // grow it by the same ratio so it keeps its exact place in frame.
  const centre = centreOf(node, centreLift);
  const toObj = new THREE.Vector3().subVectors(centre, cam.position);
  const dist = toObj.length();
  if (dist < 1e-6) return { moved: 0, scaled: 1 };

  const next = Math.max(dist * 0.02, dist + delta); // never through the camera
  const ratio = next / dist;

  const newCentre = cam.position.clone().addScaledVector(toObj.divideScalar(dist), next);
  node.size = node.size.map((v) => v * ratio);

  // Convert the centre back to the authored base position, with the lift
  // rescaled too since the object just changed size.
  node.position[0] = newCentre.x;
  node.position[1] = newCentre.y - centreLift * ratio;
  node.position[2] = newCentre.z;

  return { moved: next - dist, scaled: ratio };
}

/**
 * How far a node currently sits from the camera, so the UI can show it and
 * offer a sensible slider range.
 */
export function depthOf(node, cam, centreLift = 0) {
  const centre = centreOf(node, centreLift);
  if (cam.isOrthographic) {
    const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(cam.rotation).normalize();
    // No viewpoint exists, so measure along the view axis from the world origin.
    return centre.dot(forward);
  }
  return centre.distanceTo(cam.position);
}

/**
 * Verify a slide really was invisible. Used by the tests, and worth keeping:
 * if this ever reports a drift, the depth control has stopped being safe and
 * every manual correction made with it is suspect.
 */
export function screenDrift(cam, before, after) {
  const a = cam.project(before);
  const b = cam.project(after);
  if (!a || !b) return Infinity;
  return Math.hypot(a.u - b.u, a.v - b.v);
}
