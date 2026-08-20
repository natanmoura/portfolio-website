// Drawing curves, and nothing else.
//
// Second slice of the curve work. This puts them on screen and makes their
// control points pickable; it does not move anything. Editing is the next
// slice and it depends on this one being right, which is the reason for the
// split — a handle that renders in the wrong place is a much easier bug to
// find than a drag that lands in the wrong place, and they look identical
// once the two are built together.
//
// Two things are drawn per curve. The **line** is the curve as it actually
// resolves, flattened and settled onto whatever the ground is doing, because
// a road that draws flat and builds draped is a road you cannot trust. The
// **handles** are the control points, which are the thing you grab: they sit
// where the author put them, and on a draped curve that means they sit on the
// ground too.
//
// Handles are billboards of a fixed pixel size rather than spheres of a fixed
// world size. A control point is a UI affordance, not a thing in the town, so
// it should stay the same size on screen whether you are looking at a whole
// city or one junction. Anything else means handles you cannot hit when
// zoomed out and handles that swallow the model when zoomed in.

import * as THREE from 'three';
import { flatten, settleAll, pointIdOf } from './curve.js';

const LINE = 0x6f9ff0;
const LINE_SELECTED = 0xffd166;
const HANDLE = 0xe9e3d4;
const HANDLE_CORNER = 0xff2e6a;
const HANDLE_SELECTED = 0xffd166;

// Screen-space size of a control point, in pixels. Big enough to hit without
// aiming, small enough not to hide what is under it.
const HANDLE_PX = 9;

export class CurveView {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'curves';
    // Drawn after the town and never occluded by it. A control point behind a
    // building is still a control point you need to be able to grab, and
    // hunting for a handle that is technically there but hidden is the
    // single most irritating thing a curve editor can do.
    this.root.renderOrder = 900;
    scene.add(this.root);

    this.lines = new THREE.Group();
    this.handles = new THREE.Group();
    this.root.add(this.lines, this.handles);

    this.lineMat = new THREE.LineBasicMaterial({ color: LINE, depthTest: false, transparent: true, opacity: 0.9 });
    this.lineSelMat = new THREE.LineBasicMaterial({ color: LINE_SELECTED, depthTest: false, transparent: true });
    this.handleGeo = new THREE.CircleGeometry(0.5, 16);

    this.selectedCurve = null;
    this.selectedPoints = new Set();
    this.groundAt = null;
    this.curves = [];
  }

  setGroundAt(fn) {
    this.groundAt = fn;
  }

  setVisible(on) {
    this.root.visible = Boolean(on);
  }

  // Rebuilt wholesale rather than diffed. A handful of curves with a few
  // dozen points each is nothing, and a diffing path would be a second place
  // for the view to disagree with the data.
  set(curves) {
    this.curves = curves || [];
    this.rebuild();
  }

  select(curveId, pointIds = []) {
    this.selectedCurve = curveId;
    this.selectedPoints = new Set(pointIds);
    this.rebuild();
  }

  clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
    }
  }

  rebuild() {
    this.clear(this.lines);
    this.clear(this.handles);

    for (const curve of this.curves) {
      const flat = settleAll(curve, flatten(curve, 16), this.groundAt);
      if (flat.length > 1) {
        const pos = new Float32Array(flat.length * 3);
        flat.forEach((p, i) => {
          // Lifted a hair off the ground so a draped curve does not fight the
          // terrain for the same pixels and shimmer along its whole length.
          pos[i * 3] = p.x;
          pos[i * 3 + 1] = p.y + 0.05;
          pos[i * 3 + 2] = p.z;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const line = new (curve.closed ? THREE.LineLoop : THREE.Line)(
          geo,
          curve.id === this.selectedCurve ? this.lineSelMat : this.lineMat
        );
        line.frustumCulled = false;
        line.renderOrder = 900;
        this.lines.add(line);
      }

      // Handles only for the curve you are working on. Every control point of
      // every curve at once is a screen full of dots that says nothing.
      if (curve.id !== this.selectedCurve) continue;
      const settled = settleAll(curve, curve.points, this.groundAt);
      settled.forEach((p, i) => {
        const id = pointIdOf(curve.points[i], i);
        const chosen = this.selectedPoints.has(id);
        const mat = new THREE.MeshBasicMaterial({
          color: chosen ? HANDLE_SELECTED : curve.points[i].corner ? HANDLE_CORNER : HANDLE,
          depthTest: false,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const dot = new THREE.Mesh(this.handleGeo, mat);
        dot.position.set(p.x, p.y + 0.06, p.z);
        dot.renderOrder = 901;
        dot.frustumCulled = false;
        // Everything the picker and the drag need, so neither has to search
        // back through the data to work out what was grabbed.
        dot.userData = { curveId: curve.id, pointId: id, index: i };
        this.handles.add(dot);
      });
    }
  }

  // Handles face the camera and hold their size on screen. Called every
  // frame, so it allocates nothing and does no work with nothing to face.
  faceCamera(camera, viewportHeight) {
    const kids = this.handles.children;
    if (!kids.length) return;
    // How many world units one pixel covers at a given distance, for a
    // perspective camera. Keeps a handle the same size whether you are
    // looking at the whole town or one junction.
    const fov = (camera.fov * Math.PI) / 180;
    for (const dot of kids) {
      dot.quaternion.copy(camera.quaternion);
      const dist = camera.position.distanceTo(dot.position);
      const perPixel = (2 * Math.tan(fov / 2) * dist) / Math.max(1, viewportHeight);
      dot.scale.setScalar(perPixel * HANDLE_PX);
    }
  }

  // What is under the pointer, nearest first. Returns the handle's own data
  // rather than the mesh, since nothing above here should have to know that a
  // control point is drawn as a circle.
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.handles.children, false);
    return hits.length ? { ...hits[0].object.userData, distance: hits[0].distance } : null;
  }
}
