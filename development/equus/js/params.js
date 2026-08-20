// Every tunable in one object, plus the control definitions that describe it.
//
// House rule from DESIGN.md: a dial's help text is a three part contract. What
// it changes in the motion, the measured default and where it came from, and
// what happens when you push past it. So the panel teaches the biomechanics
// while you tune, and exceeding a real value stays a knowing act.
//
// `pending` marks a dial whose value is stored but not yet read by a solver,
// because the phase that consumes it is not built. The panel shows those
// greyed rather than hiding them, so the shape of the whole system is visible
// from the start.

export const params = {
  // Rider intent and the master speed input.
  speed: 1.5,
  gaitMode: 'auto',
  lead: 'left',

  // The stride clock. Swing duration barely changes with speed or gait, which
  // is the single most useful fact in the research, so it is an input and
  // stance is derived.
  swingTime: 0.35,
  dutyFloor: 0.29,
  strideScale: 1.0,

  // The eight style axes. Style is a point in this space, so a preset is just a
  // saved point and there is nothing special about the presets.
  collection: 0.0,
  impulsion: 1.0,
  engagement: 0.0,
  cadence: 1.0,
  trunkCompliance: 0.0,
  headCarriage: 0.5,
  bendGain: 1.0,
  limbStiffness: 130,

  // The animal itself.
  scale: 1.0,
  mass: 500,
  accelLimit: 3.4,
  lateralGrip: 5.0,

  // World.
  terrainSeed: 7,
  terrainAmplitude: 3.2,
  terrainFrequency: 0.016,

  // Look.
  exposure: 1.05,
  sunAzimuth: 38,
  sunElevation: 42,
  fogNear: 28,
  fogFar: 190,

  // Lab instruments.
  timeScale: 1.0,
  onionCount: 0,
  showTraces: true,
  showSkeleton: true,
  showTimingChart: true,
};

export const PRESETS = {
  // Presets are points in the eight axis space, nothing more.
  real: { collection: 0, impulsion: 1, engagement: 0, cadence: 1, trunkCompliance: 0, headCarriage: 0.5, bendGain: 1, limbStiffness: 130 },
  draft: { collection: 0.1, impulsion: 0.55, engagement: 0.1, cadence: 0.78, trunkCompliance: 0, headCarriage: 0.32, bendGain: 0.8, limbStiffness: 104 },
  arabian: { collection: 0.45, impulsion: 1.35, engagement: 0.35, cadence: 1.12, trunkCompliance: 0.05, headCarriage: 0.82, bendGain: 1.15, limbStiffness: 148 },
  dressage: { collection: 0.85, impulsion: 1.25, engagement: 0.8, cadence: 0.92, trunkCompliance: 0, headCarriage: 0.7, bendGain: 1.1, limbStiffness: 140 },
  unicorn: { collection: 0.3, impulsion: 2.1, engagement: 0.55, cadence: 1.0, trunkCompliance: 0.75, headCarriage: 0.78, bendGain: 1.5, limbStiffness: 152 },
};

// tab groups the row. min and max are the comfortable range, and typing past
// them is allowed and marks the row, which is exactly how a measured default
// stays the default while stylising remains reachable.
export const CONTROL_DEFS = [
  // Drive
  {
    key: 'speed', tab: 'Drive', label: 'Speed', type: 'range', min: 0, max: 9, step: 0.05,
    help: 'How fast the horse is asked to travel, in metres per second. Gait follows from it rather than being chosen.',
    source: 'Walk 0.6 to 3.2, trot 1.8 to 6.7, canter 4.0 to 8.9, gallop 4.7 to 8.8 m/s. Journal of Experimental Biology.',
  },
  {
    key: 'gaitMode', tab: 'Drive', label: 'Gait', type: 'select',
    options: ['auto', 'walk', 'trot', 'canter', 'gallop', 'rein back'],
    help: 'Auto picks the cheapest gait for the current speed. The named settings hold a gait so you can watch it outside its comfortable range.',
    source: 'Auto minimises peak bone strain, which rises 59 percent from walk to trot then falls 42 percent into canter.',
  },
  {
    key: 'lead', tab: 'Drive', label: 'Lead', type: 'select', options: ['left', 'right'],
    help: 'Which foreleg leads at canter and gallop. Watch the hind legs to see it, not the front.',
    source: 'Hind pair peak force spread is 10.6 percent against 2.9 for the fore, so the tell lives in the hindquarters.',
  },
  {
    key: 'accelLimit', tab: 'Drive', label: 'Acceleration', type: 'range', min: 0.5, max: 6, step: 0.1,
    help: 'Ceiling on how fast speed may change, which is what gives starting and stopping their weight. Braking is allowed to be harder, since all four feet can brake but only the hinds can push.',
    source: 'A 500 kg horse accelerating harder than about 3.5 m/s squared would need more grip than turf gives.',
  },
  {
    key: 'lateralGrip', tab: 'Drive', label: 'Cornering grip', type: 'range', min: 1, max: 12, step: 0.1,
    help: 'How hard the horse may corner. Because cornering force is speed squared over radius, a fixed limit means the faster it goes the wider it has to turn. This one dial is most of why speed feels like mass.',
    source: 'About 5 m/s squared on turf. At a 9 m/s gallop that works out to a turn radius near 16 metres, which is roughly what a racehorse needs.',
  },

  // Clock
  {
    key: 'swingTime', tab: 'Clock', label: 'Swing time', type: 'range', min: 0.2, max: 0.55, step: 0.005,
    help: 'How long a leg spends in the air per stride. Held near constant while stance shortens with speed, so duty factor falls out rather than being authored.',
    source: 'Measured 340 to 364 ms at a 1.5 m/s walk and 346 to 347 ms at a 4.0 m/s trot, essentially unchanged.',
    pending: true,
  },
  {
    key: 'dutyFloor', tab: 'Clock', label: 'Duty floor', type: 'range', min: 0.15, max: 0.45, step: 0.005,
    help: 'The least time a hoof may spend on the ground, as a fraction of the stride. With swing time it sets the stride frequency ceiling.',
    source: 'Measured floor 0.29 to 0.33. With 0.35 s swing that gives 2.03 Hz, and real gallop is 2.0 to 2.2 Hz.',
    pending: true,
  },
  {
    key: 'strideScale', tab: 'Clock', label: 'Stride length', type: 'range', min: 0.6, max: 1.8, step: 0.01,
    help: 'Multiplier on how far the body travels per stride. This is the honest way to go faster once the frequency ceiling is reached.',
    source: 'Frequency is capped near 2.03 Hz by limb inertia, so past real gallop speed only stride length is left.',
    pending: true,
  },

  // Style
  {
    key: 'collection', tab: 'Style', label: 'Collection', type: 'range', min: 0, max: 1, step: 0.01,
    help: 'Trades reach for elevation. Raises duty factor and shortens stride together, so the horse carries itself higher and travels less per step.',
    source: 'Collection measurably lowers speed and stride length while lengthening stance. At the far end suspension vanishes, which is piaffe.',
    pending: true,
  },
  {
    key: 'impulsion', tab: 'Style', label: 'Impulsion', type: 'range', min: 0, max: 2.5, step: 0.01,
    help: 'How much of the stride is spent airborne. Low sits the horse down into the ground, high makes it float.',
    source: '1.0 is the measured suspension fraction for the current gait. Past about 1.4 you are beyond any real horse.',
    pending: true,
  },
  {
    key: 'engagement', tab: 'Style', label: 'Engagement', type: 'range', min: 0, max: 1, step: 0.01,
    help: 'Shifts load from the forehand onto the hindquarters, which reads as the horse sitting into its hocks. Watch the ground force chart while you move it.',
    source: 'A standing horse carries about 59 percent in front. At gallop that falls to about 52, so speed engages the hind naturally before this dial adds anything.',
  },
  {
    key: 'cadence', tab: 'Style', label: 'Cadence', type: 'range', min: 0.7, max: 1.15, step: 0.01, hard: [0.5, 1.15],
    help: 'Stride frequency against the anatomical ceiling. This is the one dial capped hard, because exceeding it is exactly what makes fast animals look like they are scrabbling.',
    source: 'Ceiling is 2.03 Hz, derived from 0.35 s swing and a 0.29 duty floor, and matching the observed 2.0 to 2.2 Hz.',
    pending: true,
  },
  {
    key: 'trunkCompliance', tab: 'Style', label: 'Trunk compliance', type: 'range', min: 0, max: 1, step: 0.01,
    help: 'How much the spine contributes to stride length. At zero the gallop is a true horse gallop. Raising it moves toward the double suspension gait a cheetah uses.',
    source: 'Horses gallop transversely with one suspension and a stiff ungulate trunk. Carnivores gallop rotary with two, using spine flex to reach past the limbs.',
    pending: true,
  },
  {
    key: 'headCarriage', tab: 'Style', label: 'Head carriage', type: 'range', min: 0, max: 1, step: 0.01,
    help: 'Where the neck holds the head, from a low stock horse outline to a high Arabian one.',
    source: 'Neck posture also aims the binocular cone, which points down the nose and is only 65 to 80 degrees wide.',
    pending: true,
  },
  {
    key: 'bendGain', tab: 'Style', label: 'Bend gain', type: 'range', min: 0, max: 3, step: 0.01,
    help: 'Multiplier on how much the body curves into a turn. At 1.0 the bend is exactly what was measured on a real horse, which is far less than illustration and games usually show.',
    source: 'On a circle at trot the neck bends 5.2 degrees and the back 3.75, with the neck taking about 1.4 times the back. Real bend is subtle, so 1.0 will look understated. Push it for the drawing rather than the animal.',
  },
  {
    key: 'limbStiffness', tab: 'Style', label: 'Limb stiffness', type: 'range', min: 90, max: 170, step: 1,
    help: 'The leg spring, in newtons per kilogram per metre. Lower compresses more under load and reads heavier, higher reads springy. It drives the fetlock directly, so you can see it in the pasterns.',
    source: 'Measured 101 to 156 with a mean of 130 between elbow and coffin joint. The distal limb is a genuinely linear spring, and at 130 the fetlock extends about 39 degrees at the gallop peak, which is what a real horse does.',
  },

  // Animal
  {
    key: 'scale', tab: 'Animal', label: 'Size', type: 'range', min: 0.7, max: 1.35, step: 0.01,
    help: 'Overall body size. Gait boundaries move with it automatically, so a pony breaks to trot at a slower speed than a warmblood.',
    source: 'Gait speeds are stored as Froude numbers, v squared over g times hip height, so one table serves any body size.',
  },
  {
    key: 'mass', tab: 'Animal', label: 'Mass', type: 'range', min: 250, max: 900, step: 5,
    help: 'Body mass in kilograms. Scales the forces shown on the ground force chart. Compression is per kilogram, so a heavier horse of the same build sinks the same amount.',
    source: 'Peak vertical force at gallop is about 14 N per kg per limb, roughly 1.4 times body weight.',
  },

  // World
  {
    key: 'terrainAmplitude', tab: 'World', label: 'Relief', type: 'range', min: 0, max: 9, step: 0.1,
    help: 'How tall the hills are. The ground under the origin stays flat regardless, so the horse always starts level.',
  },
  {
    key: 'terrainFrequency', tab: 'World', label: 'Roughness', type: 'range', min: 0.004, max: 0.05, step: 0.001,
    help: 'How closely spaced the hills are. High values give broken ground that makes each hoof land at a different height.',
  },
  {
    key: 'terrainSeed', tab: 'World', label: 'Seed', type: 'range', min: 0, max: 200, step: 1,
    help: 'Reroll the landscape. The same seed always gives the same ground, so a tuning session stays repeatable.',
  },

  // Look
  {
    key: 'exposure', tab: 'Look', label: 'Exposure', type: 'range', min: 0.4, max: 2, step: 0.01,
    help: 'Overall image brightness after tone mapping.',
  },
  {
    key: 'sunAzimuth', tab: 'Look', label: 'Sun direction', type: 'range', min: 0, max: 360, step: 1,
    help: 'Where the sun sits around the horizon. Raking light across the horse makes limb separation easiest to read.',
  },
  {
    key: 'sunElevation', tab: 'Look', label: 'Sun height', type: 'range', min: 4, max: 88, step: 1,
    help: 'How high the sun is. Low sun lengthens shadows, which makes it much easier to see whether a hoof is truly touching.',
  },

  // View
  {
    key: 'showSkeleton', tab: 'View', label: 'Skeleton', type: 'toggle',
    help: 'Show the anatomical blockout. Until a mesh is attached this is the horse.',
  },
  {
    key: 'showTraces', tab: 'View', label: 'Hoof traces', type: 'toggle',
    help: 'Draw the arc each hoof describes through space, which is the single most useful diagnostic for reading locomotion.',
    pending: true,
  },
  {
    key: 'showTimingChart', tab: 'View', label: 'Timing chart', type: 'toggle',
    help: 'Stance and swing bars per limb, so the footfall pattern can be read directly instead of guessed at from motion.',
    pending: true,
  },
  {
    key: 'onionCount', tab: 'View', label: 'Onion skin', type: 'range', min: 0, max: 12, step: 1,
    help: 'How many earlier poses to leave behind as ghosts, for reading arcs and spacing the way a lightbox would.',
    pending: true,
  },
  {
    key: 'timeScale', tab: 'View', label: 'Time scale', type: 'range', min: 0.05, max: 2, step: 0.01,
    help: 'Slows the simulation without changing it. Everything is derived from a clock, so slow motion is exact rather than interpolated.',
  },
];

export const TABS = ['Drive', 'Clock', 'Style', 'Animal', 'World', 'Look', 'View'];
