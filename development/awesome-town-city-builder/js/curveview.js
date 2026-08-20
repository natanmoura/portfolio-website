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
import { flatten, settle, settleAll, pointIdOf, ribbonEdges, ribbonTriangles } from './curve.js';

const LINE = 0x6f9ff0;
const LINE_SELECTED = 0xffd166;
// The boundary is the edge of the world, so it reads as a limit rather than
// as one more line among the roads it contains. Held even while it is
// selected: it is almost always the selected curve, and a highlight that is
// on permanently is not a highlight.
const LINE_BOUNDARY = 0x63e0b6;
// A road the scene is holding, as against one the pattern is still proposing.
// This is the only place the difference between authored and generated is
// visible at a glance, and it is the difference the whole tool turns on, so it
// gets a colour of its own rather than a dash pattern or an outline.
const LINE_HELD = 0xff8a3d;
// Drawn ground. Not a thing in the town but the thing the town stands on, so
// it gets earth rather than any of the colours that mean "street" or "edge".
const LINE_LANDFORM = 0xc0894a;
const HANDLE = 0xe9e3d4;
const HANDLE_CORNER = 0xff2e6a;
const HANDLE_SELECTED = 0xffd166;

// Screen-space size of a control point, in pixels. Big enough to hit without
// aiming, small enough not to hide what is under it.
const HANDLE_PX = 9;

// World-space half-width of the halo drawn under the selected curve. Not a
// billboard like the handles are — a curve worth highlighting is usually
// several blocks long, and a screen-space-constant ribbon along its whole
// length would need to face the camera at every point independently, which
// is a real shader problem this did not need to solve to answer "which one
// is selected". A flat metre and a half reads clearly at the zoom levels
// editing actually happens at, wide enough to catch the eye against roads
// and lots without swallowing the block it runs through.
const HALO_HALF_WIDTH = 0.75;
// A hover halo has no status of its own to report — it is not held, not the
// boundary, not yet selected — so it gets a neutral colour rather than
// borrowing one that would claim a status it does not have.
const HALO_HOVER = 0xe9e3d4;

// The grip that stands for a curve nobody has selected. Smaller than a
// control point, because it is a way in rather than something to drag, and it
// must not read as "this road has one point in the middle of it".
const GRIP_SCALE = 0.62;
const HANDLE_GRIP = 0x8fa8c8;
const HANDLE_HELD = 0xff8a3d;

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
    this.lineBoundaryMat = new THREE.LineBasicMaterial({ color: LINE_BOUNDARY, depthTest: false, transparent: true });
    this.lineHeldMat = new THREE.LineBasicMaterial({ color: LINE_HELD, depthTest: false, transparent: true });
    this.lineLandformMat = new THREE.LineBasicMaterial({ color: LINE_LANDFORM, depthTest: false, transparent: true });
    this.handleGeo = new THREE.CircleGeometry(0.5, 16);

    this.selectedCurve = null;
    this.selectedPoints = new Set();
    this.hoveredCurve = null;
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

  // What the pointer is over, independent of what is selected — the answer
  // to "is this the one I am about to click" rather than "is this the one I
  // am working on". Guarded against rebuilding for no reason: hover fires on
  // every pointer move, and a full curve rebuild on every pixel of travel is
  // exactly the kind of cost this project's own drag-vs-drop split exists to
  // avoid elsewhere.
  hover(curveId) {
    if (this.hoveredCurve === curveId) return;
    this.hoveredCurve = curveId;
    this.rebuild();
  }

  // Disposes what a rebuild actually owns. The handle geometry is one shared
  // circle reused by every control point, so freeing it here would tear down
  // the buffer every other handle is still drawing from, every rebuild.
  clear(group, ownsGeometry = true) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (ownsGeometry) child.geometry?.dispose();
      // Handle materials are made per point so each can carry its own colour;
      // line materials are shared and outlive the meshes that used them.
      if (child.isMesh) child.material?.dispose?.();
    }
  }

  rebuild() {
    this.clear(this.lines);
    this.clear(this.handles, false);

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
        // What a curve *is* outranks whether it happens to be selected. A held
        // road stays orange while you work on it, because "this one is mine"
        // is a fact about the town and being selected is a fact about the last
        // click. The handles are the selection signal, and they are only ever
        // on one curve.
        const material = curve.kind === 'boundary'
          ? this.lineBoundaryMat
          : curve.kind === 'landform'
            ? this.lineLandformMat
            : curve.held
              ? this.lineHeldMat
              : curve.id === this.selectedCurve
                ? this.lineSelMat
                : this.lineMat;
        const line = new (curve.closed ? THREE.LineLoop : THREE.Line)(geo, material);
        line.frustumCulled = false;
        line.renderOrder = 900;
        this.lines.add(line);

        // The halo. A `LineBasicMaterial` cannot draw a thick line — the
        // `linewidth` property does nothing in every browser that matters —
        // so a real ribbon of triangles goes under the thin line instead,
        // built with the same mitred-edge math the road tarmac uses.
        //
        // Two curves can want one at once: the one selected, and the one the
        // pointer is merely over. They answer different questions — selected
        // is "which one am I working on", hover is "which one would a click
        // land on" — so they read differently: the selected halo is bright
        // and stays until you put the curve down, the hover halo is a dim
        // preview that follows the pointer and never accumulates points or
        // its own material colour, since it is not a decision yet. Drawing
        // one for every curve at once would be the screen-full-of-dots
        // problem again in a different shape, which is why a plain line is
        // still all every other curve gets.
        const isSelected = curve.id === this.selectedCurve;
        const isHovered = curve.id === this.hoveredCurve && !isSelected;
        if ((isSelected || isHovered) && flat.length > 1) {
          const pts2 = flat.map((p) => [p.x, p.z]);
          const edges = ribbonEdges(pts2, HALO_HALF_WIDTH, Boolean(curve.closed));
          // Settled the same way `flat` itself was, rather than borrowed from
          // it: the mitred edge points are offset from the centreline, and
          // that offset needs its own answer to "what is the ground doing
          // here" — reusing a neighbour's height would be a guess where
          // `settle` already knows.
          const yAt = (p) => settle(curve, { x: p[0], y: 0, z: p[1] }, this.groundAt).y + 0.03;
          const { pos: hp, nor: hn } = ribbonTriangles(edges, yAt);
          if (hp.length) {
            const hgeo = new THREE.BufferGeometry();
            hgeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
            hgeo.setAttribute('normal', new THREE.Float32BufferAttribute(hn, 3));
            const hmat = new THREE.MeshBasicMaterial({
              color: isSelected ? material.color : HALO_HOVER,
              transparent: true,
              opacity: isSelected ? 0.28 : 0.16,
              depthTest: false,
              side: THREE.DoubleSide,
            });
            const halo = new THREE.Mesh(hgeo, hmat);
            halo.frustumCulled = false;
            // Under the crisp line, over nothing else — a soft wide glow
            // with the exact thin edge still legible on top of it.
            halo.renderOrder = 899;
            this.lines.add(halo);
          }
        }
      }

      // Handles only for the curve you are working on. Every control point of
      // every curve at once is a screen full of dots that says nothing.
      //
      // But an unselected curve still needs somewhere to be grabbed, and
      // clicking its line does not work in practice: the line is under the
      // town, so in anything but an empty block the click lands on a building
      // standing in front of it. So every curve carries exactly one **grip**
      // at its midpoint. One dot per road is a legible number of dots, it
      // draws over everything like the other handles do, and picking it is
      // the same code path as picking a control point.
      if (curve.id !== this.selectedCurve) {
        if (flat.length > 1) {
          const at = settle(curve, flat[Math.floor(flat.length / 2)], this.groundAt);
          const grip = new THREE.Mesh(this.handleGeo, new THREE.MeshBasicMaterial({
            color: curve.held ? HANDLE_HELD : HANDLE_GRIP,
            depthTest: false,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
          }));
          grip.position.set(at.x, at.y + 0.06, at.z);
          grip.renderOrder = 901;
          grip.frustumCulled = false;
          // No pointId: picking this selects the curve rather than grabbing a
          // point, which is what `grip` tells the editor.
          grip.userData = { curveId: curve.id, grip: true, px: HANDLE_PX * GRIP_SCALE };

          this.handles.add(grip);
        }
        continue;
      }
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
      dot.scale.setScalar(perPixel * (dot.userData.px || HANDLE_PX));
    }
  }

  // What is under the pointer, nearest first. Returns the handle's own data
  // rather than the mesh, since nothing above here should have to know that a
  // control point is drawn as a circle.
  pick(raycaster) {
    // Matrices first. faceCamera writes each handle's rotation and scale and
    // leaves the renderer to flush them, so a pick between frames tests
    // against where the handles were rather than where they are. Cheap, since
    // it is one group of a few dozen billboards, and it makes picking
    // independent of when anything last drew — which a press has no way of
    // knowing.
    this.handles.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(this.handles.children, false);
    return hits.length ? { ...hits[0].object.userData, distance: hits[0].distance } : null;
  }
}
