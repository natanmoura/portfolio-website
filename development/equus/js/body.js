// L0 body. Rider intent in, momentum out.
//
// This is where starting and stopping get their weight. A 500 kg animal does not
// change speed or direction on demand, and the two limits that matter are not the
// same limit:
//
//   Longitudinal. How hard the horse can push or brake, bounded by what the hooves
//   can grip. Braking beats acceleration, because a horse can plant all four and
//   slide but can only push with the hinds.
//
//   Lateral. How hard it can corner, also bounded by grip. This is the one that
//   makes speed feel real, because a fixed lateral limit means turn RATE has to
//   fall as speed rises. At a gallop the horse simply cannot pivot, it has to
//   describe an arc, and that single constraint does more for the feel of mass
//   than any amount of animation.
//
// Turn rate follows from centripetal acceleration rather than being authored:
// a = v squared over r, and turn rate is v over r, so turn rate is a over v.

import * as THREE from 'three';

export function createBody({ position = new THREE.Vector3(), heading = 0 } = {}) {
  const state = {
    position: position.clone(),
    heading,
    speed: 0,
    // Signed, radians per second, for the spine solver to bend against.
    turnRate: 0,
    // Metres per second squared, for the load layer and for lean.
    accel: 0,
    lateralAccel: 0,
    // Set when the rider is asking for more than the ground will give.
    slipping: false,
    crouch: 0,
    sink: 0,
    scale: 1,
  };

  const _fwd = new THREE.Vector3();

  function forward(out = _fwd) {
    return out.set(Math.cos(state.heading), 0, -Math.sin(state.heading));
  }

  // `intent.speed` is the speed being asked for, `intent.turn` is a steering input
  // in [-1, 1] where positive is left, matching the sign of the heading angle.
  function update(dt, intent, limits) {
    const {
      accelLimit = 3.4,
      // A horse stops harder than it starts. All four feet can brake, only the
      // hinds can drive.
      brakeLimit = accelLimit * 1.7,
      lateralLimit = 5.0,
      // Below this speed the horse is turning on the spot rather than cornering,
      // so the lateral limit stops being the binding constraint.
      pivotRate = 1.6,
      // Above this the rider is asking for more grip than exists.
      slipMargin = 1.05,
    } = limits ?? {};

    // Longitudinal.
    const wantSpeed = Math.max(0, intent.speed ?? 0);
    const dv = wantSpeed - state.speed;
    const cap = (dv >= 0 ? accelLimit : brakeLimit) * dt;
    const applied = THREE.MathUtils.clamp(dv, -cap, cap);
    state.accel = dt > 0 ? applied / dt : 0;
    state.speed = Math.max(0, state.speed + applied);

    // Lateral. The available turn rate is the cornering limit divided by speed,
    // which is what stops a galloping horse from pivoting, plus a floor so a
    // near stationary horse can still turn about itself.
    const v = Math.max(0.05, state.speed);
    const maxRate = Math.max(pivotRate * Math.max(0, 1 - v / 2.5), lateralLimit / v);
    const wantRate = THREE.MathUtils.clamp(intent.turn ?? 0, -1, 1) * pivotRate;
    const rate = THREE.MathUtils.clamp(wantRate, -maxRate, maxRate);

    // Ease into the turn rather than snapping to it, because the horse has to
    // set itself up to corner.
    const k = 1 - Math.exp(-7 * dt);
    state.turnRate += (rate - state.turnRate) * k;
    state.heading += state.turnRate * dt;

    state.lateralAccel = state.turnRate * state.speed;
    state.slipping =
      Math.hypot(state.lateralAccel, state.accel) > lateralLimit * slipMargin;

    // Travel. Height is settled later, once the ground and the limb springs have
    // had their say.
    state.position.addScaledVector(forward(), state.speed * dt);

    return state;
  }

  return { state, update, forward };
}

// Keyboard intent. Kept separate from the body so the same momentum model can be
// driven by a gamepad, a script, or the speed dial without knowing the difference.
export function createInput(params) {
  const keys = new Set();
  const state = { turn: 0, active: false, brake: false };

  const TURN_KEYS = { arrowleft: 1, a: 1, arrowright: -1, d: -1 };
  const THROTTLE = { arrowup: 1, w: 1, arrowdown: -1, s: -1 };

  addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k in TURN_KEYS || k in THROTTLE || k === 'shift') {
      keys.add(k);
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  function update(dt) {
    let turn = 0;
    for (const [k, dir] of Object.entries(TURN_KEYS)) if (keys.has(k)) turn += dir;
    let throttle = 0;
    for (const [k, dir] of Object.entries(THROTTLE)) if (keys.has(k)) throttle += dir;

    state.turn = THREE.MathUtils.clamp(turn, -1, 1);
    state.brake = keys.has('shift');
    state.active = turn !== 0 || throttle !== 0 || state.brake;

    // Throttle writes back into the speed dial rather than shadowing it, so the
    // panel and the keyboard are always describing the same number and the dial
    // moves while you drive.
    if (throttle !== 0) {
      params.speed = THREE.MathUtils.clamp(params.speed + throttle * 6 * dt, 0, 30);
    }
    if (state.brake) {
      params.speed = Math.max(0, params.speed - 12 * dt);
    }
    return state;
  }

  return { state, update, keys };
}
