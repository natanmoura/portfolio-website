// The gait table, as data. No solver lives here.
//
// A gait is not a mode. A gait is a vector of four phase offsets plus a duty
// factor, so walk, trot, canter and gallop are four points in one continuous
// space and a transition is a path between points. That is why nothing in this
// project ever blends two poses, and therefore why blend artifacts are not an
// available failure mode.
//
// `structure` is the load bearing field. Walk and trot alternate hind, fore,
// hind, fore. Canter and gallop group into couplets, hind hind then fore fore.
// You cannot get between those two structures by retiming, because the grouping
// itself has to change, and changing the grouping means breaking a pair. That is
// the mechanical reason the literature sees a diagonal dissociate on the way
// into canter, and it collapses the whole transition system into one rule:
// morph freely within a structure, and pass through a dissociation event when
// crossing between structures.
//
// Speeds are stored as Froude numbers, v squared over g times hip height, so
// they are dimensionless and transfer across body sizes. The published metre
// per second figures come from Icelandic horses, roughly 1.35 m at the withers,
// which the timing confirms: a 1.5 m/s walk with 0.9 s stride period gives only
// a 1.35 m stride where a full size horse walks nearer 1.7. Storing Froude
// numbers means one table serves a pony, a warmblood and a unicorn.

// Reference hip height of the horses the source data was measured on. The study
// covered tolt and pace, so Icelandic horses, around 1.35 m at the withers. The
// characteristic length for Froude is the height of the hip joint, which sits
// well below the withers, roughly 0.76 of it on a horse. So 1.35 times 0.76.
const SOURCE_HIP_HEIGHT = 1.03;

const fr = (mps) => (mps * mps) / (9.81 * SOURCE_HIP_HEIGHT);

export const LIMBS = ['F.L', 'F.R', 'H.L', 'H.R'];

// Rows are ordered hind then fore so the timing chart reads bottom up the way
// footfall actually propagates.
export const CHART_ORDER = ['H.L', 'H.R', 'F.L', 'F.R'];

export const GAITS = {
  walk: {
    name: 'walk',
    beats: 4,
    structure: 'alternating',
    // Four beat lateral sequence, LH then LF then RH then RF, evenly spaced.
    offsets: { 'H.L': 0.0, 'F.L': 0.25, 'H.R': 0.5, 'F.R': 0.75 },
    duty: 0.6,
    suspension: 0,
    froude: [fr(0.6), fr(3.2)],
    preferred: [0, fr(2.0)],
    // Peak bone strain relative to walk, which is the auto selector's cost.
    strain: 1.0,
    symmetric: true,
  },
  trot: {
    name: 'trot',
    beats: 2,
    structure: 'alternating',
    // Diagonal pairs.
    offsets: { 'H.L': 0.0, 'F.R': 0.0, 'H.R': 0.5, 'F.L': 0.5 },
    duty: 0.38,
    suspension: 0.06,
    froude: [fr(1.8), fr(6.7)],
    preferred: [fr(2.0), fr(4.5)],
    // Trot costs 59 percent more peak strain than walk, which is why it is a
    // transitional gait rather than a cruising gait, and why a horse asked for
    // more speed would rather change gait than trot harder.
    strain: 1.59,
    symmetric: true,
  },
  canter: {
    name: 'canter',
    beats: 3,
    structure: 'couplet',
    // Left lead. Trailing hind, then the diagonal, then the leading fore.
    //
    // Note the numbers are 0.32 and 0.63 rather than an even 0.33 and 0.67. Evenly
    // spaced thirds tile the stride exactly at duty one third, so the footfalls
    // butt up against each other and no suspension can ever open however low the
    // duty goes. A real canter is a three beat gait WITH a moment of suspension
    // after the leading foreleg, so the beats have to sit slightly early.
    offsets: { 'H.R': 0.0, 'H.L': 0.32, 'F.R': 0.32, 'F.L': 0.63 },
    duty: 0.33,
    suspension: 0.12,
    froude: [fr(4.0), fr(8.9)],
    preferred: [fr(4.0), fr(7.0)],
    // Canter is measurably cheaper than trot, 42 percent less peak strain.
    strain: 0.92,
    symmetric: false,
    lead: 'left',
  },
  gallop: {
    name: 'gallop',
    beats: 4,
    structure: 'couplet',
    // Left lead. Hind couplet, then fore couplet, then a single suspension.
    // The horse gallops transversely: the centre of mass redirection is
    // initiated by a hind contact, which is why the hinds come first and close
    // together. A cheetah's rotary gallop inverts that and gains a second
    // suspension.
    offsets: { 'H.R': 0.0, 'H.L': 0.15, 'F.R': 0.42, 'F.L': 0.57 },
    duty: 0.31,
    suspension: 0.18,
    froude: [fr(4.7), fr(8.8)],
    preferred: [fr(7.0), fr(30)],
    strain: 0.95,
    symmetric: false,
    lead: 'left',
  },
  'rein back': {
    name: 'rein back',
    beats: 2,
    structure: 'alternating',
    // Diagonal pairs like trot but with no suspension at all. The mechanics
    // invert though: the forelimb protracts while weight bearing to push the
    // body backwards, retracts while unloaded, and touches down toe first.
    // Playing a walk backwards is the standard mistake and it is why most game
    // horses look wrong in reverse.
    offsets: { 'H.L': 0.0, 'F.R': 0.0, 'H.R': 0.5, 'F.L': 0.5 },
    duty: 0.55,
    suspension: 0,
    froude: [0, fr(1.2)],
    preferred: [0, fr(1.2)],
    strain: 1.1,
    symmetric: true,
    reverse: true,
  },
};

// Mirror an asymmetric gait's offsets to the other lead. Swapping left for right
// is a relabel, not a different table.
export function withLead(gait, lead) {
  if (gait.symmetric || lead === gait.lead) return gait;
  const swap = { 'F.L': 'F.R', 'F.R': 'F.L', 'H.L': 'H.R', 'H.R': 'H.L' };
  const offsets = {};
  for (const [limb, v] of Object.entries(gait.offsets)) offsets[swap[limb]] = v;
  return { ...gait, offsets, lead };
}

// Where a limb sits in its own cycle, 0 at contact and wrapping at 1.
export function limbPhase(gait, limb, stridePhase) {
  const p = stridePhase - (gait.offsets[limb] ?? 0);
  return p - Math.floor(p);
}

// Contact happens at limb phase 0 and lasts for the duty factor.
export function isStance(gait, limb, stridePhase, duty = gait.duty) {
  return limbPhase(gait, limb, stridePhase) < duty;
}

// How far through its stance or swing a limb is, 0 to 1. This is what the
// footfall planner and the limb solver actually want.
export function limbProgress(gait, limb, stridePhase, duty = gait.duty) {
  const p = limbPhase(gait, limb, stridePhase);
  return p < duty ? { stance: true, t: p / duty } : { stance: false, t: (p - duty) / (1 - duty) };
}

// Stride length as a multiple of hip height. Calibrated against observed stride
// lengths for a 16 hand horse, roughly 1.7 m walking, 2.7 trotting, 3.5
// cantering and 4.5 galloping, rather than against duty factor. Duty then falls
// out of the clock instead of being fitted twice.
export const STRIDE_FACTOR = {
  walk: 1.37,
  trot: 2.18,
  canter: 2.82,
  gallop: 3.63,
  'rein back': 0.62,
};

// Swing time is not a constant across body sizes. A limb in swing is a pendulum,
// and a pendulum's period goes as the square root of its length, so a taller
// horse swings a leg more slowly. Without this the model fits one body size and
// drifts for every other, which then shows up as the wrong duty factor and the
// wrong gait choice.
//
// The swing time on the dial is the value for the horses the data came from, and
// this scales it to the animal actually being simulated.
export function swingFor(swingTime, hipHeight) {
  return swingTime * Math.sqrt(hipHeight / SOURCE_HIP_HEIGHT);
}

// The stride clock, solved from speed. This is where the invariant swing law
// does its work and where the fantastical speed rule is implemented literally
// rather than as a special case.
//
// Normally stride length is a property of the gait and the period follows from
// speed. Once the period would drop below the anatomical floor set by swing time
// and the duty floor, the period is held at that floor and stride length grows
// instead. So past real gallop speed the horse floats further per stride rather
// than cycling faster, which is exactly the difference between powerful and
// scrabbling.
export function solveClock({ speed, gait, hipHeight, swingTime, dutyFloor, strideScale = 1, cadence = 1 }) {
  const swing = swingFor(swingTime, hipHeight);
  const minPeriod = swing / (1 - dutyFloor) / Math.max(0.2, cadence);
  const base = (STRIDE_FACTOR[gait.name] ?? 1) * hipHeight * strideScale;
  const v = Math.max(1e-3, speed);

  let strideLength = base;
  let period = strideLength / v;
  let overdriven = false;

  if (period < minPeriod) {
    period = minPeriod;
    strideLength = v * period;
    overdriven = true;
  }

  const duty = dutyFor(period, swing, dutyFloor);
  return {
    period,
    strideLength,
    frequency: 1 / period,
    duty,
    swing,
    // True once the horse is past what stride frequency alone can deliver, which
    // is the point where any further speed is coming from reach.
    overdriven,
    reachRatio: strideLength / base,
  };
}

// Duty factor derived rather than authored. Swing duration barely changes with
// speed or gait, measured at 340 to 364 ms walking and 346 to 347 ms trotting,
// so swing is the input and stance follows from stride period.
export function dutyFor(stridePeriod, swingTime, floor) {
  if (stridePeriod <= 0) return 1;
  return Math.max(floor, Math.min(0.95, 1 - swingTime / stridePeriod));
}

// The frequency ceiling, derived from two independent measurements rather than
// chosen. With 0.35 s swing and a 0.29 duty floor this gives 2.03 Hz, and real
// gallop stride frequency is 2.0 to 2.2 Hz. Scaled by body size through the
// pendulum relation, so a bigger horse has a lower ceiling, which is correct.
export function maxStrideFrequency(swingTime, dutyFloor, hipHeight = SOURCE_HIP_HEIGHT) {
  return (1 - dutyFloor) / swingFor(swingTime, hipHeight);
}

// Pick the cheapest gait for a dimensionless speed. Cost is peak bone strain
// plus a penalty for being away from the band the gait is actually used in,
// which gives auto selection a real objective instead of a set of thresholds.
// Because trot carries a strain penalty the curve is not monotonic in speed,
// which is where the feeling of a horse being eager to canter comes from.
//
// Two ranges per gait matter here. `froude` is the full observed range, which is
// wide and heavily overlapping, so penalising against it lets canter win at
// gallop speeds purely because canter costs less strain. `preferred` is the band
// a horse actually chooses, so that is what the penalty uses.
// A gait is also defined by its duty factor, not only by its footfall pattern.
// The standard classification splits walking from running at duty 0.5, so a
// "walk" whose duty has fallen to 0.33 is mechanically a running gait wearing a
// walk's footfall order, and it must not be selected. Penalising this is what
// makes the walk hand over to the trot at the right speed, because walk duty
// crosses 0.5 at almost exactly the speed a real horse breaks into trot.
const DUTY_RANGE = {
  walk: [0.5, 0.92],
  trot: [0.28, 0.5],
  canter: [0.28, 0.42],
  gallop: [0.24, 0.38],
  'rein back': [0.45, 0.9],
};

export function cheapestGait(froudeNumber, ctx = {}) {
  const { allowReverse = false, hipHeight, swingTime, dutyFloor, speed, strideScale = 1, cadence = 1 } = ctx;
  let best = null;
  let bestCost = Infinity;

  for (const g of Object.values(GAITS)) {
    if (g.reverse && !allowReverse) continue;

    const [lo, hi] = g.preferred ?? g.froude;
    let penalty = 0;
    if (froudeNumber < lo) penalty += (lo - froudeNumber) * 1.4;
    else if (froudeNumber > hi) penalty += (froudeNumber - hi) * 1.4;

    // What duty factor would this gait actually run at, at this speed? If it is
    // outside the band that makes it that gait, it is disqualified in all but
    // name.
    if (hipHeight && swingTime != null) {
      const solved = solveClock({ speed, gait: g, hipHeight, swingTime, dutyFloor, strideScale, cadence });
      const [dLo, dHi] = DUTY_RANGE[g.name] ?? [0, 1];
      if (solved.duty < dLo) penalty += (dLo - solved.duty) * 14;
      else if (solved.duty > dHi) penalty += (solved.duty - dHi) * 14;
    }

    const cost = g.strain + penalty;
    if (cost < bestCost) {
      bestCost = cost;
      best = g;
    }
  }
  return best;
}

export { DUTY_RANGE };

// Transitions. Within a structure the phase vector can morph directly. Across
// structures a pair has to break first, and that dissociation is only legal in
// a particular window of the cycle, which is why a real horse does not change
// gait mid step either.
export function transitionRoute(from, to) {
  if (from.structure === to.structure) {
    return { kind: 'morph', window: null, dissociate: null };
  }
  const intoCouplet = to.structure === 'couplet';
  return {
    kind: 'dissociate',
    // Trot to canter is observed as an early and short forelimb placement just
    // before one diagonal pair comes apart. Canter to trot breaks out of the
    // diagonal phase or out of the lead fore single support.
    dissociate: intoCouplet ? 'diagonal' : 'couplet',
    window: intoCouplet ? [0.42, 0.62] : [0.28, 0.46],
    lead: intoCouplet ? 'fore-early-short' : 'from-diagonal',
  };
}
