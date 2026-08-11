// annotate.js — build a scene from pixel observations of a drawing.
//
// The straightforward path, and the one that needs no API key at all.
//
// Someone looks at the drawing and writes down, in pixels, where things sit:
// where a building meets the floor, how high its top edge is, which primitive
// it should be. That someone can be a person with a screenshot and a colour
// picker, or a vision model in a chat window, or an API call. It does not
// matter, because none of them are asked to estimate depth. They report what
// they can see in the picture, in the picture's own coordinates.
//
// This file turns those observations into exact world geometry using the solved
// camera. Nothing here guesses.

import * as THREE from 'three';
import { uid } from './scene.js';
import { rectToNode } from './blockout.js';

/**
 * @typedef {Object} Annotation
 * @property {string} label
 * @property {string} type   box | cylinder | column | pipe | sphere | arch | roof | stairs | card
 *
 * Give EITHER a rect or a footprint:
 * @property {number[]} [rect]      [x0, y0, x1, y1] in pixels. Fast and rough:
 *                                  the bottom edge is read as ground contact,
 *                                  so widths run over for turned volumes.
 * @property {number[]} [footprint] [[ux,vy], [ux,vy], [ux,vy]] three pixel
 *                                  points where the base corners meet the
 *                                  floor, in order around the shape. Exact.
 * @property {number} [topV]        pixel row of the object's top edge, used
 *                                  with footprint to measure height.
 * @property {number} [height]      world height in metres, if you already know
 *                                  it and would rather not measure it
 * @property {number} [elevation]   base height above the floor, for roofs and
 *                                  overhead pipes
 * @property {object} [params]      steps, style, openWidth
 * @property {number[]} [tilt]      [rotationX, rotationZ] in degrees, for pipes
 */

const DEG = Math.PI / 180;

/**
 * Exact box from three base corners seen on the floor.
 *
 * Three corners fully determine a rectangle, so there is no depth guess: the
 * fourth corner is a + c - b. This is the accurate path, and the reason to
 * spend an extra two clicks per object rather than dragging a rectangle.
 */
function fromFootprint(cam, ann) {
  const pts = ann.footprint.map(([u, v]) => cam.groundPoint(u, v));
  if (pts.some((p) => !p)) return null;

  const [a, b, c] = pts;
  const sideA = new THREE.Vector3().subVectors(a, b);
  const sideB = new THREE.Vector3().subVectors(c, b);
  const centre = new THREE.Vector3()
    .addVectors(a, c)
    .multiplyScalar(0.5); // a and c are opposite corners of the rectangle

  let height = ann.height;
  if (height == null && ann.topV != null) {
    // Measure on the vertical through the corner nearest the camera, which is
    // the one least likely to be occluded.
    const near = pts.reduce((best, p) =>
      p.distanceTo(cam.position) < best.distanceTo(cam.position) ? p : best,
    );
    const q = cam.project(near);
    height = cam.heightAt(near, q ? q.u : (ann.footprint[0][0]), ann.topV);
  }
  if (!height || height <= 0) height = Math.max(sideA.length(), sideB.length()) * 0.5;

  const dirA = sideA.clone().normalize();

  return {
    id: uid('a'),
    type: ann.type || 'box',
    name: ann.label || ann.type || 'object',
    position: [centre.x, ann.elevation || 0, centre.z],
    size: [sideA.length(), height, sideB.length()],
    // three.js sends local +X to (cos t, 0, -sin t).
    rotationY: Math.atan2(-dirA.z, dirA.x),
  };
}

/**
 * Convert a list of annotations into scene nodes.
 *
 * @param {SolvedCamera} cam
 * @param {Annotation[]} annotations
 * @param {object} [opts] stationId to project the drawing onto the geometry
 */
export function annotationsToNodes(cam, annotations, opts = {}) {
  const nodes = [];
  const problems = [];

  for (const ann of annotations) {
    let node = null;

    if (Array.isArray(ann.footprint) && ann.footprint.length >= 3) {
      node = fromFootprint(cam, ann);
      if (!node) {
        problems.push(`${ann.label}: a footprint corner is above the horizon`);
        continue;
      }
    } else if (Array.isArray(ann.rect) && ann.rect.length === 4) {
      const [x0, y0, x1, y1] = ann.rect;
      node = rectToNode(cam, { x0, y0, x1, y1 }, ann.type === 'card' ? 'card' : 'box', {
        name: ann.label,
        axisAligned: ann.axisAligned,
      });
      if (!node) {
        problems.push(`${ann.label}: base is above the horizon`);
        continue;
      }
      node.type = ann.type || 'box';
      if (ann.height) node.size[1] = ann.height;
      if (ann.elevation) node.position[1] = ann.elevation;
    } else {
      problems.push(`${ann.label}: needs either a rect or a footprint`);
      continue;
    }

    if (ann.params) node.params = ann.params;
    if (Array.isArray(ann.tilt) && ann.tilt.length === 2) {
      node.rotationX = (ann.tilt[0] || 0) * DEG;
      node.rotationZ = (ann.tilt[1] || 0) * DEG;
    }
    node.material = opts.stationId
      ? { mode: 'projected', station: opts.stationId }
      : { mode: 'flat', color: opts.color || '#a09a8e' };
    node.pinned = true;

    nodes.push(node);
  }

  return { nodes, problems };
}
