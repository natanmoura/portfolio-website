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
    const usable = (roads || []).filter((r) => r.pts && r.pts.length > 1);
    const half = region ? region.half : (Math.max(params.cols, params.rows) * params.cell) / 2;
    const centre = region ? region.center : { x: 0, z: 0 };
    const rng = new Rng(((params.seed >>> 0) ^ 0x2f7a1c93) >>> 0);

    const graph = usable.length ? roadGraph(usable) : null;
    const legs = graph && graph.edges.length ? walkNetwork(graph, rng, half * 6) : null;

    if (legs && legs.length) {
      const points = [];
      for (const leg of legs) sampleLeg(leg, RESAMPLE, groundAt, points);
      // Points almost on top of each other kink the curve; the joins between
      // legs land on the same junction twice by construction.
      const thinned = [];
      for (const p of points) {
        if (!thinned.length || thinned[thinned.length - 1].distanceToSquared(p) > 1) thinned.push(p);
      }
      if (thinned.length >= 4) return this.setCurve(thinned);
    }

    // Nothing to walk. A circle over the town beats no tour at all, and it is
    // drawn against the region so a town with an outline is circled rather
    // than the square it would have filled.
    const ring = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ring.push(new THREE.Vector3(centre.x + Math.cos(a) * half * 0.6, 0, centre.z + Math.sin(a) * half * 0.6));
    }
    this.setCurve(ring);
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

// One graph edge, sampled along the road it is a piece of.
//
// Height comes from the road's own profile at the true distance along it, so a
// leg that happens to sit on a viaduct is toured on the deck rather than down
// among the columns holding it up.
function sampleLeg(leg, spacing, groundAt, out) {
  const road = leg.edge.road;
  const { at } = road.profile || measure(road.pts);
  const s0 = leg.forward ? leg.edge.s0 : leg.edge.s1;
  const s1 = leg.forward ? leg.edge.s1 : leg.edge.s0;
  const posAt = (s) => {
    const i = Math.min(road.pts.length - 2, Math.max(0, Math.floor(s)));
    const f = s - i;
    const a = road.pts[i];
    const b = road.pts[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const distAt = (s) => {
    const i = Math.min(at.length - 2, Math.max(0, Math.floor(s)));
    return at[i] + (at[i + 1] - at[i]) * (s - i);
  };
  const steps = Math.max(1, Math.round(leg.edge.length / spacing));
  // The far end is left off: the next leg starts on the same junction and
  // would otherwise contribute it twice.
  for (let k = 0; k < steps; k++) {
    const s = s0 + (s1 - s0) * (k / steps);
    const [x, z] = posAt(s);
    const ground = groundAt ? groundAt(x, z) || 0 : 0;
    out.push(new THREE.Vector3(x, liftAt(road, distAt(s), groundAt ? ground : null), z));
  }
}

// --- the road network as a graph ---------------------------------------------

// Where two roads actually cross, as a position along each.
//
// A position is `segment + fraction`, which is the only description that
// survives a road whose segments are different lengths. Everything below works
// in it, and converts to metres only when it needs a distance.
function crossing(a1, a2, b1, b2) {
  const rx = a2[0] - a1[0];
  const rz = a2[1] - a1[1];
  const sx = b2[0] - b1[0];
  const sz = b2[1] - b1[1];
  const denom = rx * sz - rz * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qx = b1[0] - a1[0];
  const qz = b1[1] - a1[1];
  const t = (qx * sz - qz * sx) / denom;
  const u = (qx * rz - qz * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

const boxOf = (pts) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, maxX, minZ, maxZ };
};

const boxesApart = (a, b, pad) =>
  a.maxX + pad < b.minX || b.maxX + pad < a.minX || a.maxZ + pad < b.minZ || b.maxZ + pad < a.minZ;

// The street network, as junctions joined by pieces of road.
//
// **This is the whole of "the tour stays on roads".** The route used to be
// stitched by walking one road end to end and then jumping to whichever unused
// road passed nearest — with no limit on how near that had to be. On a town
// where the main roads happen to meet, that looks fine; on one where they do
// not, the jump is a straight line drawn across whatever stands in between,
// which is why the camera flew through buildings.
//
// A graph removes the possibility rather than bounding it. Every edge is a
// piece of an actual road between two actual junctions, so any walk of it is
// on the network by construction and there is no hop to get wrong.
export function roadGraph(roads) {
  const boxes = roads.map((r) => boxOf(r.pts));
  const cuts = roads.map((r) => new Set([0, r.pts.length - 1]));

  for (let a = 0; a < roads.length; a++) {
    for (let b = a + 1; b < roads.length; b++) {
      // Roads whose bounding boxes miss each other cannot cross, and in a grid
      // that is almost every pair.
      if (boxesApart(boxes[a], boxes[b], 1)) continue;
      const pa = roads[a].pts;
      const pb = roads[b].pts;
      for (let i = 1; i < pa.length; i++) {
        for (let j = 1; j < pb.length; j++) {
          const hit = crossing(pa[i - 1], pa[i], pb[j - 1], pb[j]);
          if (!hit) continue;
          cuts[a].add(i - 1 + hit.t);
          cuts[b].add(j - 1 + hit.u);
        }
      }
    }
  }

  // A junction is a place, not a pair of roads: four roads meeting at one
  // corner have to agree they are at the same node or the walk cannot turn
  // there. Quantised to a quarter metre, which is far below anything the
  // street patterns produce and far above floating-point noise.
  const nodes = new Map();
  const nodeAt = (x, z) => {
    const key = `${Math.round(x * 4)},${Math.round(z * 4)}`;
    let node = nodes.get(key);
    if (!node) {
      node = { key, x, z, out: [] };
      nodes.set(key, node);
    }
    return node;
  };

  const posOn = (road, s) => {
    const i = Math.min(road.pts.length - 2, Math.max(0, Math.floor(s)));
    const f = s - i;
    const a = road.pts[i];
    const b = road.pts[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };

  const edges = [];
  roads.forEach((road, ri) => {
    const sorted = [...cuts[ri]].sort((m, n) => m - n);
    for (let k = 1; k < sorted.length; k++) {
      const s0 = sorted[k - 1];
      const s1 = sorted[k];
      const p0 = posOn(road, s0);
      const p1 = posOn(road, s1);
      const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      // A piece too short to drive is a junction's own width, not a street.
      if (length < 1) continue;
      const from = nodeAt(p0[0], p0[1]);
      const to = nodeAt(p1[0], p1[1]);
      if (from === to) continue;
      const edge = { id: edges.length, road, ri, s0, s1, from, to, length, main: Boolean(road.main) };
      edges.push(edge);
      from.out.push({ edge, to, forward: true });
      to.out.push({ edge, to: from, forward: false });
    }
  });

  return { nodes: [...nodes.values()], edges };
}

// A closed route that never leaves the network.
//
// Walk from a junction, and at each one take an edge that is not the one just
// arrived on — that is "turn down a different road at an intersection", and at
// a dead end the only edge available is the way back, which is the honest
// answer for a cul-de-sac. When the walk has gone far enough, the shortest way
// home along the network is appended, so the loop closes on real streets
// instead of on a straight line back to the start.
export function walkNetwork(graph, rng, targetLength) {
  const start = pickStart(graph, rng);
  if (!start) return null;

  const legs = [];
  let node = start;
  let last = null;
  let total = 0;

  for (let step = 0; step < 200 && total < targetLength; step++) {
    const options = node.out.filter((o) => o.edge !== last);
    const from = options.length ? options : node.out;
    if (!from.length) break;
    // Main roads are twice as likely to be taken, so a tour of a town with
    // avenues spends its time on them without ever being unable to turn off.
    const weighted = [];
    for (const o of from) {
      weighted.push(o);
      if (o.edge.main) weighted.push(o);
    }
    const pick = weighted[Math.floor(rng.float() * weighted.length)];
    legs.push(pick);
    total += pick.edge.length;
    last = pick.edge;
    node = pick.to;
  }

  const home = shortestPath(node, start, last);
  if (home) legs.push(...home);
  return legs.length ? legs : null;
}

// Prefer a real junction to a dead end, so a tour opens on a street with
// somewhere to turn rather than in a cul-de-sac.
function pickStart(graph, rng) {
  const junctions = graph.nodes.filter((n) => n.out.length > 2);
  const pool = junctions.length ? junctions : graph.nodes.filter((n) => n.out.length);
  if (!pool.length) return null;
  return pool[Math.floor(rng.float() * pool.length)];
}

// Breadth first, over junctions. The route has to come home along streets --
// closing a Catmull-Rom loop across open ground is exactly the straight line
// through buildings this whole rewrite exists to remove.
function shortestPath(from, to, avoid) {
  if (from === to) return [];
  const previous = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const node = queue.shift();
    for (const o of node.out) {
      if (o.edge === avoid && node === from) continue;
      if (previous.has(o.to)) continue;
      previous.set(o.to, { node, o });
      if (o.to === to) {
        const path = [];
        let at = o.to;
        while (previous.get(at)) {
          const hop = previous.get(at);
          path.unshift(hop.o);
          at = hop.node;
        }
        return path;
      }
      queue.push(o.to);
    }
  }
  return null;
}
