// The tour.
//
// A camera that drives the town rather than orbiting it. The route is stitched
// out of the main roads: follow one, hop to whichever road passes closest to
// where you ended up, follow that, and so on. Smoothed into a closed curve so
// the joins do not read as corners.
//
// Banking comes from how fast the heading is changing, which is what makes a
// turn feel driven instead of panned. Height and look-ahead are separate
// controls because a low short-sighted camera reads as a car and a high
// far-sighted one reads as a drone.
//
// **Three things decide whether this reads as a shot or as a debug flythrough,
// and all three are about smoothness rather than about the path.**
//
// *Centripetal Catmull-Rom, not uniform.* Uniform parameterisation is what
// the curve used before, and on road points — which are spaced anywhere from
// half a metre to forty apart, because they are junctions and not samples — it
// overshoots into cusps and little loops wherever the spacing changes sharply.
// Those are the jolts. Centripetal is the standard fix and provably produces
// no cusps or self-intersections between control points.
//
// *The route is resampled before it becomes a curve.* Even after centripetal
// fixes the shape, evenly spaced control points are what make `getPointAt`
// return an even speed, and a road's own points are not evenly spaced.
//
// *Position and aim are low-passed, not read raw.* Even a perfect curve
// carries the road's real corners, and a camera bolted rigidly to a corner
// snaps through it. Both the eye and the point it is looking at trail their
// targets through a critically-damped filter, which is a camera operator's
// hand: it arrives everywhere the curve goes, slightly late and without
// the corner.
//
// The route rides whatever the road is doing vertically — a tour of a town on
// viaducts drives the viaduct rather than the ground under it. See
// elevation.js.

import * as THREE from 'three';
import { Rng } from './rng.js';
import { liftAt, measure } from './elevation.js';

// How far apart the resampled route points sit, in metres. Fine enough that a
// junction keeps its shape, coarse enough that the curve is not carrying a
// hundred control points per block for no gain.
const RESAMPLE = 6;

export class Flyby {
  constructor(stage) {
    this.stage = stage;
    this.curve = null;
    this.active = false;
    this.distance = 0;
    this.roll = 0;
    this.length = 0;
    this._pos = new THREE.Vector3();
    this._ahead = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._prevHeading = null;
    this.saved = null;
    // Where the camera and its aim actually are, as against where the curve
    // says they should be. The gap between the two is the whole smoothing.
    this._eye = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._settled = false;
  }

  // Stitch a loop out of the road network. Falls back to a circle over the
  // town when there are not enough roads to walk.
  // `region` is the shape the town occupies, which the fallback circle is
  // drawn against. Taken from the layout rather than worked out again from
  // cols and rows, so a tour of a town with a drawn boundary circles the town
  // rather than the square it would have filled.
  build(roads, params, region = null, groundAt = null) {
    const usable = (roads || []).filter((r) => r.pts.length > 1);
    const mains = usable.filter((r) => r.main);
    const pool = mains.length >= 2 ? mains : usable;
    const half = region ? region.half : (Math.max(params.cols, params.rows) * params.cell) / 2;
    const centre = region ? region.center : { x: 0, z: 0 };

    if (pool.length < 2) {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        pts.push(new THREE.Vector3(centre.x + Math.cos(a) * half * 0.6, 0, centre.z + Math.sin(a) * half * 0.6));
      }
      this.setCurve(pts);
      return;
    }

    const rng = new Rng(((params.seed >>> 0) ^ 0x2f7a1c93) >>> 0);
    const points = [];
    const used = new Set();
    let current = pool[Math.floor(rng.float() * pool.length)];
    let at = [current.pts[0][0], current.pts[0][1]];

    for (let leg = 0; leg < Math.min(7, pool.length); leg++) {
      used.add(current);
      // Walk the road from whichever end we arrived nearest.
      const first = current.pts[0];
      const last = current.pts[current.pts.length - 1];
      const forward =
        (at[0] - first[0]) ** 2 + (at[1] - first[1]) ** 2 <
        (at[0] - last[0]) ** 2 + (at[1] - last[1]) ** 2;
      // Walked at a fixed spacing rather than point to point, and carrying
      // the road's own height. Two birds: the curve gets evenly spaced
      // control points, which is what makes its speed even, and a road that
      // runs on a viaduct is toured on the viaduct rather than through the
      // piers holding it up.
      for (const p of walkRoad(current, forward, RESAMPLE, groundAt)) points.push(p);
      at = forward ? last : first;

      // Hop to the nearest unused road.
      let best = null;
      let bestD = Infinity;
      for (const road of pool) {
        if (used.has(road)) continue;
        for (const end of [road.pts[0], road.pts[road.pts.length - 1]]) {
          const d = (at[0] - end[0]) ** 2 + (at[1] - end[1]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = road;
          }
        }
      }
      if (!best) break;
      current = best;
    }

    // Drop points that sit almost on top of each other, or the curve kinks.
    const thinned = [];
    for (const p of points) {
      if (!thinned.length || thinned[thinned.length - 1].distanceToSquared(p) > 4) thinned.push(p);
    }
    if (thinned.length < 4) return this.build([], params, region, groundAt);
    this.setCurve(thinned);
  }

  setCurve(points) {
    // Centripetal rather than uniform. Road points arrive at wildly uneven
    // spacing — they are junctions, not samples — and uniform Catmull-Rom
    // answers uneven spacing with overshoot: cusps and small loops right where
    // the spacing changes, which is exactly where a junction is. Those loops
    // are the jolts. Centripetal is the standard result that cannot produce
    // one between control points, and it costs nothing.
    this.curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    // The default 200 divisions is a coarse ruler for a route that can be two
    // kilometres long: `getPointAt` inverts arc length against this table, so
    // between two entries the camera is interpolating a straight line at a
    // guessed speed, and the pulse that produces is a real wobble you can see
    // at street level. Sized against the route rather than against the point
    // count — two divisions per metre, so the ruler is always finer than the
    // distance one frame covers.
    let rough = 0;
    for (let i = 1; i < points.length; i++) rough += points[i].distanceTo(points[i - 1]);
    this.curve.arcLengthDivisions = Math.min(6000, Math.max(400, Math.ceil(rough * 2)));
    this.length = this.curve.getLength();
    this.distance = 0;
    this._prevHeading = null;
    this._settled = false;
  }

  start() {
    if (!this.curve || this.active) return;
    this.active = true;
    this.roll = 0;
    this._prevHeading = null;
    this._settled = false;
    const { camera, controls } = this.stage;
    this.saved = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      up: camera.up.clone(),
    };
    controls.enabled = false;
    this.stage.clearFocus();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    const { camera, controls } = this.stage;
    controls.enabled = true;
    if (this.saved) {
      camera.up.copy(this.saved.up);
      camera.position.copy(this.saved.position);
      controls.target.copy(this.saved.target);
      camera.lookAt(controls.target);
      controls.update();
    }
    this.saved = null;
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
    return this.active;
  }

  update(dt, params, groundAt) {
    if (!this.active || !this.curve || this.length <= 0) return;
    const step = Math.min(0.1, dt);
    this.distance = (this.distance + params.flybySpeed * step) % this.length;

    const t = this.distance / this.length;
    const lead = Math.max(0.001, params.flybyLookAhead / this.length);
    this.curve.getPointAt(t, this._pos);
    this.curve.getPointAt((t + lead) % 1, this._ahead);

    const heading = Math.atan2(this._ahead.z - this._pos.z, this._ahead.x - this._pos.x);
    // Shortest signed change, so crossing north does not throw the camera.
    let turn = 0;
    if (this._prevHeading !== null) {
      turn = (((heading - this._prevHeading + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    }
    this._prevHeading = heading;

    // Lean into the turn, eased so the camera settles rather than snapping.
    const want = THREE.MathUtils.clamp((-turn / step) * 0.35 * params.flybyBank, -0.8, 0.8);
    this.roll += (want - this.roll) * Math.min(1, step * 3.5);

    // The route already carries its own Y — the road's deck where there is
    // one, zero where the roads are on the ground — so the terrain is added
    // underneath rather than replacing it. A tour of a viaduct drives the
    // viaduct; a tour of a hill town climbs the hill.
    const groundY = (groundAt ? groundAt(this._pos.x, this._pos.z) : 0) + this._pos.y;
    const aheadGround = (groundAt ? groundAt(this._ahead.x, this._ahead.z) : 0) + this._ahead.y;
    const eyeY = groundY + params.flybyHeight;
    // What the camera is pointed at, which is deliberately not "the road, a
    // bit up". At street level the interesting thing is the building above
    // you, so the aim rises with distance: `flybyPitch` is metres of climb per
    // ten metres of look-ahead, which keeps the same setting reading the same
    // way whether you are creeping or racing.
    const aimY = aheadGround + params.flybyHeight + (params.flybyPitch || 0) * (params.flybyLookAhead / 10);

    // Critically-damped smoothing, frame-rate independent. Even a clean curve
    // carries the road's real corners, and a camera bolted to one snaps
    // through it; this is the operator's hand, arriving everywhere the curve
    // goes slightly late and without the corner. Aim lags harder than the
    // body, which is what makes a turn read as looking into it rather than as
    // the whole rig rotating at once.
    const ease = (rate) => 1 - Math.exp(-rate * step);
    if (!this._settled) {
      this._eye.set(this._pos.x, eyeY, this._pos.z);
      this._look.set(this._ahead.x, aimY, this._ahead.z);
      this._settled = true;
    } else {
      this._eye.lerp(this._tmpSet(this._pos.x, eyeY, this._pos.z), ease(params.flybySmoothing ?? 6));
      this._look.lerp(this._tmpSet(this._ahead.x, aimY, this._ahead.z), ease((params.flybySmoothing ?? 6) * 0.55));
    }

    const { camera, controls } = this.stage;
    camera.position.copy(this._eye);
    // Roll by tilting the up vector, which keeps lookAt doing the rest.
    this._up.set(Math.sin(this.roll) * Math.sin(heading), Math.cos(this.roll), -Math.sin(this.roll) * Math.cos(heading));
    camera.up.copy(this._up);
    camera.lookAt(this._look);
    controls.target.copy(this._look);
  }

  // One scratch vector for the two lerp targets, so a camera update running
  // every frame allocates nothing.
  _tmpSet(x, y, z) {
    (this._tmp || (this._tmp = new THREE.Vector3())).set(x, y, z);
    return this._tmp;
  }
}

// A road walked at even spacing, carrying its deck height in Y. Spacing is
// what the tour curve wants and the road's own points cannot give: they are
// junctions, placed where the street plan needed one, so a grid road two
// hundred metres long has two of them and a bend has six in a row.
function walkRoad(road, forward, spacing, groundAt) {
  const pts = forward ? road.pts : [...road.pts].reverse();
  const { at, total } = measure(pts);
  const out = [];
  const steps = Math.max(1, Math.round(total / spacing));
  for (let s = 0; s <= steps; s++) {
    const d = (total * s) / steps;
    let i = 1;
    while (i < at.length - 1 && at[i] < d) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const span = Math.max(1e-6, at[i] - at[i - 1]);
    const k = (d - at[i - 1]) / span;
    const x = a[0] + (b[0] - a[0]) * k;
    const z = a[1] + (b[1] - a[1]) * k;
    // Height is asked of the road in its own direction, which is why the
    // distance is flipped for a reversed walk rather than the profile being
    // rebuilt: a ramp belongs to an end of the road, not to an end of the
    // tour's journey through it. The ground goes in too, so a tour of a
    // bridge drives the bridge rather than dipping into the ravine under it.
    const lift = liftAt(road, forward ? d : total - d, groundAt ? groundAt(x, z) || 0 : null);
    out.push(new THREE.Vector3(x, lift, z));
  }
  return out;
}
