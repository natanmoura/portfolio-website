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

import * as THREE from 'three';
import { Rng } from './rng.js';

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
  }

  // Stitch a loop out of the road network. Falls back to a circle over the
  // town when there are not enough roads to walk.
  // `region` is the shape the town occupies, which the fallback circle is
  // drawn against. Taken from the layout rather than worked out again from
  // cols and rows, so a tour of a town with a drawn boundary circles the town
  // rather than the square it would have filled.
  build(roads, params, region = null) {
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
      const walk = forward ? current.pts : [...current.pts].reverse();
      for (const p of walk) points.push(new THREE.Vector3(p[0], 0, p[1]));
      at = walk[walk.length - 1];

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
    if (thinned.length < 4) return this.build([], params);
    this.setCurve(thinned);
  }

  setCurve(points) {
    this.curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
    this.distance = 0;
    this._prevHeading = null;
  }

  start() {
    if (!this.curve || this.active) return;
    this.active = true;
    this.roll = 0;
    this._prevHeading = null;
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

    const groundY = groundAt ? groundAt(this._pos.x, this._pos.z) : 0;
    const eye = groundY + params.flybyHeight;
    const aheadY = (groundAt ? groundAt(this._ahead.x, this._ahead.z) : 0) + params.flybyHeight;

    const { camera, controls } = this.stage;
    camera.position.set(this._pos.x, eye, this._pos.z);
    // Roll by tilting the up vector, which keeps lookAt doing the rest.
    this._up.set(Math.sin(this.roll) * Math.sin(heading), Math.cos(this.roll), -Math.sin(this.roll) * Math.cos(heading));
    camera.up.copy(this._up);
    camera.lookAt(this._ahead.x, aheadY + params.flybyPitch, this._ahead.z);
    controls.target.set(this._ahead.x, aheadY, this._ahead.z);
  }
}
