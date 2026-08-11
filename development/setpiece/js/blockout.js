// blockout.js — image rectangle to world primitive.
//
// This is the fast path the whole tool exists for. Drag a box around something
// in the drawing, and because the camera is solved, its footprint and height
// are already determined. No depth guessing, no dragging things around in 3D
// until they look right. One gesture, one correctly placed volume.

import * as THREE from 'three';
import { uid } from './scene.js';

/**
 * @param {SolvedCamera} cam
 * @param {{x0:number,y0:number,x1:number,y1:number}} rect  in image pixels
 * @param {'box'|'cylinder'|'card'} type
 */
export function rectToNode(cam, rect, type = 'box', opts = {}) {
  const left = Math.min(rect.x0, rect.x1);
  const right = Math.max(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const bottom = Math.max(rect.y0, rect.y1);

  // The bottom edge is where the object meets the floor. That single
  // assumption is what makes the placement exact, and it is also the tool's
  // one real limitation: anything not touching the ground has to be placed by
  // hand or hung off something that is.
  const baseL = cam.groundPoint(left, bottom);
  const baseR = cam.groundPoint(right, bottom);
  if (!baseL || !baseR) return null; // contact point is above the horizon

  const center = new THREE.Vector3().addVectors(baseL, baseR).multiplyScalar(0.5);
  const width = baseL.distanceTo(baseR);

  // Height comes from the top edge, measured on the vertical line rising out
  // of the footprint centre.
  const height = cam.heightAt(center, (left + right) / 2, top);

  // Face the volume along the camera's view direction so a box drawn around a
  // building sits square to how it was drawn rather than to the world axes.
  const toCam = new THREE.Vector3(
    cam.position.x - center.x,
    0,
    cam.position.z - center.z,
  );
  const rotationY = opts.axisAligned ? 0 : Math.atan2(toCam.x, toCam.z);

  // Depth is unknowable from one view, so we make an honest guess and let the
  // user pull it. Square-ish reads better than paper-thin for a blockout.
  const depth = opts.depth ?? (type === 'card' ? 0 : width * (opts.depthRatio ?? 0.8));

  return {
    id: uid('b'),
    type,
    name: opts.name || type,
    position: [center.x, 0, center.z],
    size: type === 'cylinder' ? [width, height, width] : [width, height, depth],
    rotationY,
    billboard: type === 'card' ? (opts.billboard ?? 0) : 0,
    material: opts.material || { mode: 'projected', station: opts.stationId },
    pinned: true,
  };
}

/**
 * A card carrying one region of the image, hung at a chosen distance.
 *
 * This is what anything without visible ground contact becomes: sky, clouds,
 * distant hills, a roof whose base is hidden behind the building in front. The
 * rectangle is unprojected onto a plane square to the camera, so from the
 * solved angle it sits exactly where it was drawn, and it only reveals itself
 * as a flat once the camera moves. Which, for collage, is the point.
 */
export function rectToCardAtDistance(cam, rect, distance, opts = {}) {
  const left = Math.min(rect.x0, rect.x1);
  const right = Math.max(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const bottom = Math.max(rect.y0, rect.y1);

  const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(cam.rotation).normalize();

  // Push each corner along its own ray until it reaches the plane at `distance`.
  const corner = (u, v) => {
    const r = cam.ray(u, v);
    const along = r.dot(forward);
    if (along <= 1e-6) return null;
    return cam.position.clone().addScaledVector(r, distance / along);
  };

  const tl = corner(left, top);
  const br = corner(right, bottom);
  const bl = corner(left, bottom);
  if (!tl || !br || !bl) return null;

  const center = new THREE.Vector3().addVectors(tl, br).multiplyScalar(0.5);
  const width = bl.distanceTo(br);
  const height = tl.distanceTo(bl);

  return {
    id: uid('c'),
    type: 'card',
    name: opts.name || 'card',
    // Cards are authored base-centred like everything else.
    position: [center.x, center.y - height / 2, center.z],
    size: [width, height, 0],
    rotationY: Math.atan2(-forward.x, -forward.z),
    billboard: opts.billboard ?? 0,
    material: opts.material || { mode: 'projected', station: opts.stationId },
    pinned: true,
  };
}

/**
 * A backdrop card placed at a chosen distance, filling the camera frustum.
 * Useful for skies and far hills, which have no ground contact and so cannot
 * come from rectToNode.
 */
export function backdropNode(cam, distance, opts = {}) {
  const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(cam.rotation);

  let halfW;
  let halfH;
  let center;

  if (cam.isOrthographic) {
    // A parallel projection does not spread with distance, so the backdrop is
    // the same size wherever it is hung, and there is no viewpoint to measure
    // the distance from. Measure from the middle of the visible ground instead.
    halfW = cam.width / (2 * cam.scale);
    halfH = cam.height / (2 * cam.scale);
    const anchor = cam.groundPoint(cam.cx, cam.cy) || new THREE.Vector3();
    center = anchor.clone().addScaledVector(forward, distance);
  } else {
    halfH = (distance * cam.height) / (2 * cam.focal);
    halfW = (distance * cam.width) / (2 * cam.focal);
    center = cam.position.clone().addScaledVector(forward, distance);
  }

  return {
    id: uid('bg'),
    type: 'card',
    name: opts.name || 'backdrop',
    position: [center.x, center.y - halfH, center.z],
    size: [halfW * 2, halfH * 2, 0],
    rotationY: Math.atan2(-forward.x, -forward.z),
    billboard: 0,
    material: opts.material || { mode: 'projected', station: opts.stationId },
    pinned: true,
  };
}

/** A large ground plane under everything, textured by projection. */
export function groundNode(size, opts = {}) {
  return {
    id: uid('g'),
    type: 'ground',
    name: 'ground',
    position: [0, 0, -size / 4],
    size: [size, 0, size],
    rotationY: 0,
    material: opts.material || { mode: 'projected', station: opts.stationId },
    pinned: true,
  };
}
