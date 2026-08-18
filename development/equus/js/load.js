// L3 load. Works out how hard each hoof is pressing on the ground.
//
// This is the layer most games skip, and it is where weight comes from. Without
// it a leg is a stick that happens to touch the floor. With it the limb springs
// compress by different amounts on different legs, the body sinks at peak load
// and rises when it goes light, and none of that has to be animated.
//
// The physics that makes it honest: over one stride the vertical impulse has to
// equal the weight of the horse times the stride period, or the animal would
// accelerate into the sky or through the floor. So rather than authoring peak
// forces, the profile shape is authored and then scaled so the stride average
// comes out at exactly one gravity. The peaks fall out.
//
// That is worth stating because the peaks it produces land on the measured
// numbers without being told them. At gallop the published per limb peaks are
// 12.3 to 14.0 N/kg, and normalising a plausible stance profile against gravity
// lands in the same place. Two independent routes to the same answer is the best
// evidence available that the model is not being fudged.

import { LIMBS, limbProgress } from './gaits.js';

const G = 9.81;

// Measured peak vertical ground reaction force at gallop, N/kg, per limb. These
// set the RELATIVE weighting between limbs. Their absolute scale is discarded by
// the normalisation, which is the point.
//
// Two asymmetries live in here and both are real. Forelimbs carry more than
// hinds. And within each pair the non lead limb, which is the one that lands
// first, carries more than the lead limb. The hind spread is 10.6 percent against
// 2.9 for the fore, so which lead a horse is on shows up in the hindquarters
// rather than in front.
const PEAK = { foreNonLead: 14.0, foreLead: 13.6, hindNonLead: 13.6, hindLead: 12.3 };

// Vertical force through a stance, as a fraction of that limb's peak. A smooth
// hump, skewed a little early because a limb loads faster than it unloads.
function profile(t) {
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * Math.pow(t, 0.88));
}

export function createLoad() {
  const state = {};
  for (const limb of LIMBS) state[limb] = { force: 0, compression: 0, peak: 0 };

  // The normaliser depends only on the gait shape and the duty factor, so it is
  // worth caching rather than integrating every frame.
  const cache = new Map();

  // The measured peaks carry two separate asymmetries and they must not be applied
  // twice. The WITHIN pair ratio, lead against non lead, comes from the table. The
  // BETWEEN pair split, fore against hind, comes from engagement. So the table is
  // normalised to a mean of one inside each pair first, and only then scaled by
  // the fore or hind share.
  const foreMean = (PEAK.foreNonLead + PEAK.foreLead) / 2;
  const hindMean = (PEAK.hindNonLead + PEAK.hindLead) / 2;

  function weightFor(limb, gait, engagement, speedFactor) {
    const isFore = limb.startsWith('F');
    const mean = isFore ? foreMean : hindMean;

    let within;
    if (gait.symmetric || !gait.lead) {
      // No lead, so no within pair asymmetry to apply.
      within = 1;
    } else {
      const isLead = limb.endsWith(gait.lead === 'left' ? 'L' : 'R');
      const raw = isFore
        ? isLead
          ? PEAK.foreLead
          : PEAK.foreNonLead
        : isLead
          ? PEAK.hindLead
          : PEAK.hindNonLead;
      within = raw / mean;
    }

    // Engagement. A standing horse carries about 59 percent on the forehand
    // because its centre of mass sits forward. At gallop that falls to about 52,
    // so speed engages the hindquarters on its own, and the style dial pushes
    // further in the same direction rather than inventing a new axis.
    const foreShare = 0.59 - 0.07 * speedFactor - 0.09 * engagement;
    return within * (isFore ? foreShare : 1 - foreShare);
  }

  // Average of the summed weighted profile over one stride. Dividing by this makes
  // the stride average total force exactly one gravity.
  function normaliser(gait, duty, engagement, speedFactor) {
    const key = `${gait.name}|${gait.lead ?? '-'}|${duty.toFixed(3)}|${engagement.toFixed(2)}|${speedFactor.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const N = 180;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const phase = i / N;
      for (const limb of LIMBS) {
        const { stance, t } = limbProgress(gait, limb, phase, duty);
        if (!stance) continue;
        sum += weightFor(limb, gait, engagement, speedFactor) * profile(t);
      }
    }
    const avg = sum / N;
    const value = avg > 1e-6 ? G / avg : 0;
    if (cache.size > 400) cache.clear();
    cache.set(key, value);
    return value;
  }

  // `stiffness` is the limb spring in N/kg/m. Measured between elbow and coffin
  // joint at 101 to 156 with a mean of 130, and the distal limb behaves as a
  // genuinely linear spring, so compression is just force over stiffness.
  function update({ gait, stridePhase, duty, engagement = 0, speedFactor = 0, stiffness = 130, scale = 1 }) {
    const k = normaliser(gait, duty, engagement, speedFactor);
    let total = 0;

    for (const limb of LIMBS) {
      const s = state[limb];
      const { stance, t } = limbProgress(gait, limb, stridePhase, duty);
      const w = weightFor(limb, gait, engagement, speedFactor);
      s.peak = w * k;
      s.force = stance ? s.peak * profile(t) : 0;
      // Metres of limb compression. Scales with the animal, since a bigger horse
      // is both heavier and longer legged.
      s.compression = (s.force / Math.max(1, stiffness)) * scale;
      total += s.force;
    }

    state.total = total;
    // Airborne when nothing is pressing. At gallop this is the suspension phase
    // and the legs genuinely go slack.
    state.airborne = total < 1e-4;
    return state;
  }

  // How far the body should sink, given what the loaded legs are doing. Weighted
  // by force so a lightly loaded leg does not drag the body down with it.
  function bodySink() {
    let num = 0;
    let den = 0;
    for (const limb of LIMBS) {
      const s = state[limb];
      if (s.force <= 0) continue;
      num += s.compression * s.force;
      den += s.force;
    }
    return den > 0 ? num / den : 0;
  }

  return { state, update, bodySink, PEAK };
}
