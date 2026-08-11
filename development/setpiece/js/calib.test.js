// calib.test.js — round-trip check for the camera solve.
//
// Build a camera with known focal length and orientation, project world lines
// through it, feed the resulting image lines back into the solver, and confirm
// the recovered camera measures the world the same way the original one did.
//
// Distances and heights are the things to check rather than the raw matrix:
// solveFromTwoVPs deliberately re-aligns world X and Z onto the two traced
// directions, so the recovered yaw will not match the input and should not.
//
// Load with:  import('/development/setpiece/js/calib.test.js').then(m => m.run())

import * as THREE from 'three';
import { SolvedCamera, fitVanishingPoint, solveFromTwoVPs } from './calib.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function run() {
  const W = 1600;
  const H = 1000;
  const F = 1200;
  const CH = 1.7;

  const rot = new THREE.Matrix4()
    .makeRotationY(THREE.MathUtils.degToRad(25))
    .multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(-12)));
  const truth = new SolvedCamera({ width: W, height: H, focal: F, rotation: rot, camHeight: CH });

  const seg = (a, b) => {
    const p = truth.project(a);
    const q = truth.project(b);
    return p && q ? { x1: p.u, y1: p.v, x2: q.u, y2: q.v } : null;
  };

  const linesX = [seg(V(-5, 0, -8), V(5, 0, -8)), seg(V(-5, 0, -14), V(5, 0, -14))].filter(Boolean);
  const linesZ = [seg(V(-4, 0, -6), V(-4, 0, -20)), seg(V(4, 0, -6), V(4, 0, -20))].filter(Boolean);

  const vpX = fitVanishingPoint(linesX);
  const vpZ = fitVanishingPoint(linesZ);
  const solved = solveFromTwoVPs({ vpX, vpZ, width: W, height: H, camHeight: CH });
  if (!solved) return { ok: false, reason: 'solve returned null' };

  const A = V(-5, 0, -8);
  const B = V(5, 0, -8);
  const C = V(-4, 0, -20);
  const back = (p) => {
    const q = truth.project(p);
    return q ? solved.groundPoint(q.u, q.v) : null;
  };
  const ra = back(A);
  const rb = back(B);
  const rc = back(C);

  const top = truth.project(V(-5, 3, -8));
  const heightRec = solved.heightAt(ra, top.u, top.v);

  const checks = [
    ['focal', F, solved.focal],
    ['distance A-B', A.distanceTo(B), ra.distanceTo(rb)],
    ['distance A-C', A.distanceTo(C), ra.distanceTo(rc)],
    ['post height', 3, heightRec],
    ['horizon v', truth.horizonV(), solved.horizonV()],
  ];

  const results = checks.map(([name, want, got]) => ({
    name,
    want: +want.toFixed(4),
    got: +got.toFixed(4),
    pass: Math.abs(want - got) < Math.max(1e-3, Math.abs(want) * 1e-3),
  }));

  return { ok: results.every((r) => r.pass), results };
}
