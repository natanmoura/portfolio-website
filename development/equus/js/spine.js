// L5 spine. Posture: how the trunk sits on the ground, and how it curves into a
// turn.
//
// This layer runs BEFORE the limb solver, not after, because the limbs hang off
// the trunk. Solve the spine first and the limb roots are already where they
// belong; solve it after and every leg is answering to a body that has since
// moved.
//
// The bend numbers here are the ones most likely to look wrong at first glance.
// Measured on a circle at trot, a horse bends about 5.2 degrees through the neck
// and 3.75 through the thoracolumbar back. That is far less than games and
// illustration usually show, and at a bend gain of 1.0 it will read as
// understated next to anything else. It is also what a horse actually does. The
// dial goes to 3 for when you want the drawing rather than the animal.

import * as THREE from 'three';
import { ANATOMY } from './skeleton.js';

// Reference for the measured bend: a 10 m radius circle, which is the kind of
// circle the kinematics were recorded on. Expressed as curvature, one over the
// radius, rather than as a turn rate.
//
// Curvature is the right variable and turn rate is not. A horse on a 10 m circle
// bends the same amount whether it is walking or trotting round it, because bend
// is about how tightly the body has to conform to the arc. Scaling by turn rate
// instead makes a fast horse bend absurdly on a wide, gentle curve.
const REF_CURVATURE = 1 / 10;

// The thoracolumbar spine is stiff and does not have much more to give than the
// measured figure, so the underlying bend is capped before the style dial gets
// hold of it. Pushing past a real horse stays the dial's job, not an accident of
// driving into a tight corner.
const MAX_BEND_FACTOR = 2;

export function createSpine(skel) {
  const back = ANATOMY.backBendChain.filter((n) => skel.bones.has(n));
  const neck = ANATOMY.lateralBendChain.filter((n) => skel.bones.has(n));

  const state = { pitch: 0, roll: 0, bend: 0, neckBendDeg: 0, backBendDeg: 0 };

  // Read the ground under the horse. Sampling the heightfield directly is both
  // cheaper and steadier than fitting a plane to the stance hooves, which jumps
  // every time the support set changes.
  function groundPose(ground, position, heading, bodyLength, trackWidth) {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const hx = bodyLength * 0.5;
    const hz = trackWidth * 0.5;

    const at = (du, dv) =>
      ground.heightAt(position.x + c * du - -s * dv, position.z + -s * du + c * dv);

    const front = at(hx, 0);
    const rear = at(-hx, 0);
    const left = at(0, hz);
    const right = at(0, -hz);

    return {
      // Nose down going downhill.
      pitch: Math.atan2(rear - front, bodyLength),
      roll: Math.atan2(left - right, trackWidth),
    };
  }

  // Lateral bend into a turn, distributed down the chains. The neck takes roughly
  // 1.4 times what the back takes, which is the measured ratio, and each chain
  // shares its total evenly across its joints.
  function applyBend(turnRate, speed, gain = 1) {
    // Curvature, one over the turn radius, signed. Guard the speed so a horse
    // turning about itself reads as a very tight arc rather than a division by
    // zero.
    const curvature = turnRate / Math.max(0.35, speed);
    const f = THREE.MathUtils.clamp(
      curvature / REF_CURVATURE,
      -MAX_BEND_FACTOR,
      MAX_BEND_FACTOR
    );
    state.bend = f;

    const backTotal = ANATOMY.bendDeg.back * f * gain * (Math.PI / 180);
    const neckTotal = ANATOMY.bendDeg.neck * f * gain * (Math.PI / 180);
    state.backBendDeg = (backTotal * 180) / Math.PI;
    state.neckBendDeg = (neckTotal * 180) / Math.PI;

    const perBack = back.length ? backTotal / back.length : 0;
    const perNeck = neck.length ? neckTotal / neck.length : 0;

    // Bending is a rotation about the vertical axis at each vertebra. The trunk
    // chain runs forward from the pelvis, so a positive turn curls the whole line
    // toward the inside of the circle.
    for (const n of back) skel.bones.get(n).rotation.y = perBack;
    for (const n of neck) skel.bones.get(n).rotation.y = perNeck;
  }

  // Smoothed so the body settles onto a slope rather than snapping to it. A horse
  // has mass and its trunk lags the ground it is crossing.
  function update({ ground, position, heading, turnRate, speed, bendGain, metrics, scale, dt }) {
    const want = groundPose(
      ground,
      position,
      heading,
      metrics.jointSpan * scale,
      Math.max(0.2, metrics.trackWidth * scale)
    );
    const k = 1 - Math.exp(-6 * dt);
    state.pitch += (want.pitch - state.pitch) * k;
    state.roll += (want.roll - state.roll) * k;

    applyBend(turnRate, speed, bendGain);
    return state;
  }

  return { state, update, groundPose, applyBend };
}
