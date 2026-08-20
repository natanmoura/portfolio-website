// L2 contact. Decides where each hoof goes and, far more importantly, keeps it
// there.
//
// The invariant this module exists to protect: a hoof in stance is locked in
// world space and the body moves relative to it. Never the reverse. Every
// treadmill looking quadruped in every game is a violation of that one rule.
//
// Landing position is chosen so the hoof sits at the limb's neutral stance point
// at MID stance rather than at contact. That makes the stance symmetric about
// the neutral point for free, which is both what a real horse does and the thing
// that stops the legs from looking like they trail or reach too far.
//
// Swing follows Muybridge rather than the flying gallop: the foot folds up under
// the body before it reaches forward, so the horizontal path deliberately lags
// early on. Legs gather beneath the animal, they do not stretch fore and aft.

import * as THREE from 'three';
import { LIMBS, limbProgress } from './gaits.js';

export function createFootfall(skel) {
  // Neutral stance point per limb, in horse local space, taken from where the
  // hoof rests in the skeleton spec. This is the single source of truth for
  // track width and fore-aft stance, so changing the skeleton moves the
  // footfalls with it.
  const neutral = {};
  for (const limb of LIMBS) {
    const p = skel.restWorld.get(`hoof.${limb}`);
    neutral[limb] = new THREE.Vector3(p.x, 0, p.z);
  }

  const state = {};
  for (const limb of LIMBS) {
    state[limb] = {
      // Where the hoof is right now, in world space.
      pos: new THREE.Vector3(),
      // The locked plant for the current stance.
      plant: new THREE.Vector3(),
      // Where it left the ground, which is the start of the swing path.
      liftoff: new THREE.Vector3(),
      // Where it is headed.
      target: new THREE.Vector3(),
      stance: false,
      t: 0,
      // Set once the first plant has been committed, so frame one does not
      // interpolate from the origin.
      seeded: false,
      // Diagnostic. World space drift while planted should be exactly zero.
      drift: 0,
    };
  }

  const _v = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  // Where the limb's neutral point will be, in world space, at a time `ahead`
  // seconds from now, assuming the body holds its current heading and speed.
  function neutralAt(limb, body, ahead, scale, ground) {
    const c = Math.cos(body.heading);
    const s = Math.sin(body.heading);
    const n = neutral[limb];
    // Rotate the local offset into world, matching the convention that +X is
    // forward and heading rotates about Y.
    const ox = n.x * c - n.z * -s;
    const oz = n.x * -s + n.z * c;
    _fwd.set(c, 0, -s);
    _v.copy(body.position)
      .addScaledVector(_fwd, body.speed * ahead)
      .add(new THREE.Vector3(ox * scale, 0, oz * scale));
    _v.y = ground.heightAt(_v.x, _v.z);
    return _v;
  }

  // Horizontal easing for swing. Lags a linear path early so the hoof stays
  // under the body while it folds, then catches up. This is what makes the
  // gathered suspension of Muybridge's plates rather than the flying gallop of
  // the paintings he disproved.
  const gather = (t) => t * t * (3 - 2 * t) * 0.5 + t * t * 0.5;

  // Vertical arc, peaking early. A horse snaps a hoof up and then reaches, it
  // does not sail through a symmetric parabola.
  const lift = (t) => Math.sin(Math.PI * Math.pow(t, 0.78));

  function update({ gait, stridePhase, duty, period, body, scale, ground, swingHeightScale = 1 }) {
    for (const limb of LIMBS) {
      const st = state[limb];
      const { stance, t } = limbProgress(gait, limb, stridePhase, duty);

      if (!st.seeded) {
        // First frame. Put the hoof at its neutral point and treat it as planted
        // so nothing interpolates from nowhere.
        st.plant.copy(neutralAt(limb, body, 0, scale, ground));
        st.pos.copy(st.plant);
        st.liftoff.copy(st.plant);
        st.target.copy(st.plant);
        st.seeded = true;
        st.stance = stance;
        st.t = t;
        continue;
      }

      const justLanded = stance && !st.stance;
      const justLifted = !stance && st.stance;

      if (justLanded) {
        // Commit. From here until liftoff this position does not move, whatever
        // else happens.
        st.plant.copy(st.target);
        st.pos.copy(st.plant);
      } else if (justLifted) {
        st.liftoff.copy(st.pos);
      }

      if (stance) {
        // The one line that matters in this file.
        const before = st.pos.clone();
        st.pos.copy(st.plant);
        st.drift = before.distanceTo(st.pos);
      } else {
        // Airborne. Plan the landing continuously rather than once, so a change
        // of speed mid swing is absorbed instead of causing a skate on contact.
        const timeToLand = (1 - t) * (1 - duty) * period;
        const toMidStance = timeToLand + (duty * period) / 2;
        st.target.copy(neutralAt(limb, body, toMidStance, scale, ground));

        const h = gather(t);
        st.pos.lerpVectors(st.liftoff, st.target, h);
        // Clear the ground along the way, not just at the ends.
        const groundY = ground.heightAt(st.pos.x, st.pos.z);
        const legLen = limb.startsWith('F') ? skel.metrics.foreLegLength : skel.metrics.hindLegLength;
        st.pos.y = groundY + lift(t) * legLen * 0.17 * scale * swingHeightScale;
        st.drift = 0;
      }

      st.stance = stance;
      st.t = t;
    }

    return state;
  }

  // Total drift across all planted hooves. Should read exactly zero. Anything
  // else is the treadmill bug and is the first thing to check when the walk
  // looks wrong.
  function totalDrift() {
    let d = 0;
    for (const limb of LIMBS) if (state[limb].stance) d += state[limb].drift;
    return d;
  }

  // Which limbs are currently loaded. The spine and body solvers need this as a
  // support polygon.
  function supportSet() {
    return LIMBS.filter((l) => state[l].stance);
  }

  // Mean ground height under the planted hooves, which is the height the body
  // should actually ride on. Sampling the terrain under the body's centre instead
  // is wrong the moment the ground is not flat, because the hooves are metres away
  // and on a slope they sit well above or below that sample. Getting this wrong
  // shows up as the legs failing to reach on rolling ground.
  //
  // Falls back to the swing hooves when nothing is planted, so a suspension phase
  // does not lose the reference.
  function supportHeight(fallback) {
    let sum = 0;
    let n = 0;
    for (const l of LIMBS) {
      if (!state[l].stance) continue;
      sum += state[l].plant.y;
      n++;
    }
    if (n === 0) {
      for (const l of LIMBS) {
        sum += state[l].target.y;
        n++;
      }
    }
    return n > 0 ? sum / n : fallback;
  }

  return { state, update, totalDrift, supportSet, supportHeight, neutral };
}
