// Moving control points.
//
// Third and last slice of the curve primitive. The type could be sampled, the
// view could draw it and pick it, and this is the part that changes it.
//
// The gesture is direct: press on a handle and drag it. Not a mode you enter,
// not a tool you select first. Roads and boundaries are shaped by nudging
// things until they look right, and a mode switch between every nudge is the
// difference between sketching and filling in a form.
//
// Dragging happens on a plane, and which plane is the whole question. A
// curve laid on the ground is authored in plan, so its points move in XZ and
// their height comes from the terrain: dragging on the horizontal plane is
// the only thing that makes sense, and trying to drag "in 3D" against a
// perspective camera without a gizmo is how you end up with a road two
// hundred metres in the air. A curve with authored height gets the vertical
// plane facing the camera, because that is the one case where Y is a thing
// you are choosing rather than a thing you are told.
//
// The transform gizmo the roadmap wants belongs on top of this rather than
// instead of it: select a point, get a gizmo for precision and for the
// awkward axis. Direct dragging is what you use for ninety percent of the
// work and it should cost one gesture.

import * as THREE from 'three';
import { FREE, OFFSET, movePoint, pointIdOf, insertAt, removePoint, setCorner, closestOn } from './curve.js';

// Where a control point actually sits in the world, which is not what the
// point stores: a raised road's point holds a lift above the terrain, and the
// grab has to start at the handle you can see rather than at the number.
function groundYOf(point, curve, groundAt) {
  if ((curve.ground || '') === FREE) return point.y || 0;
  const ground = groundAt ? groundAt(point.x, point.z) || 0 : 0;
  return ground + (point.lift ?? curve.lift ?? 0);
}

export class CurveEditor {
  constructor(stage, view, opts = {}) {
    this.stage = stage;
    this.view = view;
    // Called with the changed curve whenever a drag commits, so the owner
    // decides what a change means — rebuild the town, mark the scene dirty,
    // push history. Nothing here knows what a curve is for.
    this.onChange = opts.onChange || (() => {});
    // Called continuously during a drag. The town is far too expensive to
    // rebuild per frame, so the owner gets the cheap live signal and the
    // expensive one separately — the same split the component editor's
    // sliders already use.
    this.onLive = opts.onLive || (() => {});
    this.onSelect = opts.onSelect || (() => {});
    // Called when a gesture picks a curve up, as against the owner re-pointing
    // the selection at one after a rebuild.
    this.onPick = opts.onPick || null;
    // Called with the whole curve when it is deleted outright, as against
    // `onChange`, which is a shape edit. Deleting a curve is not a shape —
    // there is nothing left afterward for the owner to store a new version
    // of, so it gets its own callback rather than being shoehorned through
    // the one that hands back an edited curve.
    this.onDelete = opts.onDelete || null;

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane();
    this.hitPoint = new THREE.Vector3();
    this.grabOffset = new THREE.Vector3();

    this.curves = [];
    this.selectedCurve = null;
    this.selectedPoints = new Set();
    this.drag = null;
    this.enabled = false;
  }

  setCurves(curves) {
    this.curves = curves || [];
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (!on) this.cancel();
  }

  curveById(id) {
    return this.curves.find((c) => c.id === id) || null;
  }

  select(curveId, pointIds = []) {
    this.selectedCurve = curveId;
    this.selectedPoints = new Set(pointIds);
    this.view.select(curveId, [...this.selectedPoints]);
    this.onSelect(curveId, [...this.selectedPoints]);
  }

  // The curve under the pointer, by its line rather than by its handles.
  //
  // Handles are only drawn for the selected curve, which leaves no way to
  // select a different one — a real gap while the boundary was the only thing
  // being edited, and a blocking one the moment there are forty roads. Lines
  // are close to unhittable with a raycast at any sensible tolerance, so this
  // drops to the ground plane and asks each curve how far away it is, which
  // is the question `closestOn` already answers.
  //
  // `maxDistance` is in world units, so the caller passes something scaled to
  // the town — a block, usually — rather than this file guessing.
  pickCurve(e, maxDistance = Infinity) {
    if (!this.enabled) return null;
    this.castFrom(e);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!this.raycaster.ray.intersectPlane(ground, this.hitPoint)) return null;
    let best = null;
    for (const curve of this.curves) {
      const near = closestOn(curve, this.hitPoint.x, this.hitPoint.z, 8);
      if (near.distance > maxDistance) continue;
      if (!best || near.distance < best.distance) best = { curve, distance: near.distance };
    }
    return best;
  }

  // Pointer position in normalised device coordinates, which is what the
  // raycaster wants and the only place this file should know about pixels.
  ndc(e) {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  castFrom(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.stage.camera);
    return this.raycaster;
  }

  // The plane a point moves in. Horizontal for anything that lives on the
  // ground, which is almost everything; camera-facing vertical for a curve
  // whose height is authored, and for any curve while alt is held.
  //
  // Alt is the whole gesture for raising a road, and it is a modifier rather
  // than a mode for the same reason dragging is not a tool you select first:
  // shaping a viaduct is nudging it in plan, then nudging it in height, then
  // in plan again, and a mode switch between every nudge is the difference
  // between sketching and filling in a form. Which axis you are working in is
  // decided at the moment you press, so a drag never changes meaning halfway
  // through.
  planeFor(curve, at, vertical = false) {
    if (vertical || (curve.ground || '') === FREE) {
      const normal = this.stage.camera.getWorldDirection(new THREE.Vector3()).negate();
      normal.y = 0;
      if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
      normal.normalize();
      return this.plane.setFromNormalAndCoplanarPoint(normal, at);
    }
    return this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), at);
  }

  // Press. Returns true when it took the event, which is how the caller knows
  // to leave the orbit controls alone — otherwise dragging a handle would
  // spin the camera at the same time.
  pointerDown(e) {
    if (!this.enabled) return false;
    const hit = this.view.pick(this.castFrom(e));
    if (!hit) return false;

    const curve = this.curveById(hit.curveId);
    if (!curve) return false;

    // A grip stands for a whole curve rather than for a point on it. Taking
    // it selects that curve and stops there: the control points it reveals
    // are what you drag, and a grip that also dragged would move a point you
    // could not see until you pressed on it.
    if (hit.grip) {
      this.select(hit.curveId, []);
      // Fired only from a gesture, unlike onSelect, which also runs every
      // time the town rebuilds and re-points the selection at the same curve.
      // Anything that talks to the user belongs on this one.
      this.onPick?.(curve);
      return true;
    }

    const index = curve.points.findIndex((p, i) => pointIdOf(p, i) === hit.pointId);
    if (index < 0) return false;
    const point = curve.points[index];

    // Shift adds to the selection, so several points can be moved together.
    // Anything else replaces it, which is what a click on empty space means
    // everywhere else in this tool.
    if (e.shiftKey) {
      if (this.selectedPoints.has(hit.pointId)) this.selectedPoints.delete(hit.pointId);
      else this.selectedPoints.add(hit.pointId);
      this.select(hit.curveId, [...this.selectedPoints]);
      return true;
    }
    if (this.selectedCurve !== hit.curveId || !this.selectedPoints.has(hit.pointId)) {
      this.select(hit.curveId, [hit.pointId]);
    }

    // Alt raises and lowers instead of moving in plan. Only offered where
    // height is a thing the curve can hold: a draped curve's Y is the
    // terrain's answer, and writing to it would be a value thrown away on the
    // next settle.
    const lifting = e.altKey && (curve.ground || '') === OFFSET;
    const at = new THREE.Vector3(point.x, groundYOf(point, curve, this.view.groundAt), point.z);
    this.planeFor(curve, at, lifting);
    if (!this.castFrom(e).ray.intersectPlane(this.plane, this.hitPoint)) return false;

    // Grabbing offset, so the point does not jump to the pointer on the first
    // frame. You picked it up somewhere, and it should stay picked up there.
    this.grabOffset.copy(at).sub(this.hitPoint);

    this.drag = {
      curveId: hit.curveId,
      lifting,
      // Every selected point moves, each remembering where it started, so a
      // multi-point drag translates the group rather than collapsing it.
      start: [...this.selectedPoints]
        .map((id) => {
          const i = curve.points.findIndex((p, j) => pointIdOf(p, j) === id);
          return i < 0
            ? null
            : {
                id,
                x: curve.points[i].x,
                y: curve.points[i].y || 0,
                z: curve.points[i].z,
                lift: curve.points[i].lift || 0,
              };
        })
        .filter(Boolean),
      origin: at.clone(),
      moved: false,
    };
    return true;
  }

  pointerMove(e) {
    if (!this.drag) return false;
    if (!this.castFrom(e).ray.intersectPlane(this.plane, this.hitPoint)) return true;

    const to = this.hitPoint.clone().add(this.grabOffset);
    const dx = to.x - this.drag.origin.x;
    const dy = to.y - this.drag.origin.y;
    const dz = to.z - this.drag.origin.z;
    if (!this.drag.moved && Math.hypot(dx, dy, dz) < 1e-4) return true;
    this.drag.moved = true;

    let curve = this.curveById(this.drag.curveId);
    if (!curve) return true;
    const free = (curve.ground || '') === FREE;
    for (const s of this.drag.start) {
      if (this.drag.lifting) {
        // Never below the ground it is measured from. Dragging a pier down
        // past zero should put the road back on the terrain and stop, not
        // bury it — and zero is exactly the state that means "this point is
        // on the ground", which is the one every road starts in.
        curve = movePoint(curve, s.id, { lift: Math.max(0, s.lift + dy) });
        continue;
      }
      curve = movePoint(curve, s.id, {
        x: s.x + dx,
        z: s.z + dz,
        // Height only moves for a curve that owns its height. On anything
        // draped it is the terrain's answer and writing to it here would be
        // a value that gets thrown away on the next settle.
        ...(free ? { y: s.y + dy } : {}),
      });
    }
    this.replace(curve);
    this.onLive(curve);
    return true;
  }

  pointerUp() {
    if (!this.drag) return false;
    const moved = this.drag.moved;
    const curve = this.curveById(this.drag.curveId);
    this.drag = null;
    // A press that never moved is a selection, not an edit, and committing it
    // would put a no-op on the undo stack for every click.
    if (moved && curve) this.onChange(curve);
    return moved;
  }

  cancel() {
    this.drag = null;
  }

  get dragging() {
    return Boolean(this.drag);
  }

  // --- structure ------------------------------------------------------------

  replace(curve) {
    const i = this.curves.findIndex((c) => c.id === curve.id);
    if (i >= 0) this.curves[i] = curve;
    this.view.set(this.curves);
    this.view.select(this.selectedCurve, [...this.selectedPoints]);
  }

  // Add a point where the pointer is, on the nearest part of the selected
  // curve. Lands on the line rather than under the pointer, because a control
  // point that appears off the curve has changed its shape before you have
  // touched it.
  //
  // `maxDistance` is how close to the line the click has to land. Without it
  // this steals every double-click in the viewport from whatever else wanted
  // one, since a click anywhere at all has a nearest point on the curve.
  addPointAt(e, opts = {}) {
    if (!this.enabled) return false;
    const curve = this.curveById(this.selectedCurve);
    if (!curve) return false;
    this.castFrom(e);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!this.raycaster.ray.intersectPlane(ground, this.hitPoint)) return false;
    const near = closestOn(curve, this.hitPoint.x, this.hitPoint.z);
    if (near.distance > (opts.maxDistance ?? Infinity)) return false;
    const next = insertAt(curve, near.segment, near.t);
    this.replace(next);
    this.onChange(next);
    return true;
  }

  deleteSelected() {
    const before = this.curveById(this.selectedCurve);
    if (!before || !this.selectedPoints.size) return false;
    let curve = before;
    for (const id of this.selectedPoints) curve = removePoint(curve, id);
    this.selectedPoints.clear();
    this.replace(curve);
    // `removePoint` refuses to take a curve below two points and hands back
    // the identical object rather than a copy, so a reference check is
    // exactly the question "did this do anything". It has to be asked:
    // `onChange` now means "hold this road", now that curves are consumed
    // rather than only drawn, and firing it on a delete that was refused
    // would silently promote an untouched road to held the moment you tried
    // and failed to remove its last-but-one point.
    if (curve !== before) this.onChange(curve);
    return curve !== before;
  }

  // The whole curve, not a point on it. What that means is the owner's
  // decision — the boundary going away is different from a road going away —
  // which is exactly why this only reports the curve and does not touch
  // `this.curves` itself. Whatever `onDelete` does will end in a fresh
  // `setCurves` call once the state that produced this list has changed.
  deleteCurve() {
    const curve = this.curveById(this.selectedCurve);
    if (!curve || !this.onDelete) return false;
    this.onDelete(curve);
    return true;
  }

  toggleCorner() {
    let curve = this.curveById(this.selectedCurve);
    if (!curve || !this.selectedPoints.size) return false;
    const first = curve.points.find((p, i) => this.selectedPoints.has(pointIdOf(p, i)));
    const next = !first?.corner;
    for (const id of this.selectedPoints) curve = setCorner(curve, id, next);
    this.replace(curve);
    this.onChange(curve);
    return true;
  }
}
