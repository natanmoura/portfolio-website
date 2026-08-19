import { buildIndex, search } from './search.js';

// Global controls panel. Definitions live here, wiring lives in main.js.
//
// House rule: nothing ships without hover help. `help` on a definition is
// picked up by the tooltip layer automatically.
//
// live:  redraw while dragging rather than on release.
// cheap: a uniform or a light setting, so it never rebuilds the city.

// replaceChildren stringifies anything that is not a Node, so the common
// `condition && element` idiom renders the literal text "false" or "null"
// into the panel whenever the condition fails. h() already filters those out
// for its own children; this is the same guard for the places that write to
// an existing node instead of building a new one.
export function setChildren(node, ...kids) {
  node.replaceChildren(
    ...kids.flat().filter((kid) => kid !== null && kid !== undefined && kid !== false && kid !== true)
  );
}

export function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  kids.flat().forEach((kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  });
  return node;
}

const R = (key, label, min, max, step, help, extra = {}) => ({
  key,
  label,
  type: 'range',
  min,
  max,
  step,
  help,
  live: true,
  ...extra,
});

// A slider spanning a comfortable range, next to a box you can type into. The
// slider covers where you normally want to be. Typing a value outside that
// stretches the slider to reach it and marks the row, so going past the useful
// range is possible but never accidental.
//
// `hard` is the absolute limit typing is clamped to. It defaults to the
// slider's own range multiplied out, and is set tight for values where there
// is genuinely nothing beyond, like a probability.
export function rangeRow({ label, value, min, max, step, hard, live = true, onInput, onLock }) {
  const [hardMin, hardMax] = hard || [min, max + (max - min) * 7];
  const clamp = (v) => Math.min(hardMax, Math.max(hardMin, v));

  const slider = h('input', { type: 'range', min, max, step, value });
  const num = h('input', { type: 'number', class: 'num', step });
  const row = h('div', { class: 'row' }, h('span', { class: 'lbl' }, label), slider, num);

  const decimals = Number(step) >= 1 ? 0 : String(step).split('.')[1]?.length || 2;
  const show = (v) => {
    num.value = Number(v.toFixed(decimals));
    // Stretch the track so the handle can still reach a typed-in extreme.
    slider.min = Math.min(min, v);
    slider.max = Math.max(max, v);
    slider.value = v;
    row.classList.toggle('extended', v < min - 1e-9 || v > max + 1e-9);
  };
  show(value);

  slider.addEventListener('pointerdown', () => onLock && onLock());
  slider.addEventListener('keydown', () => onLock && onLock());
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    num.value = Number(v.toFixed(decimals));
    row.classList.toggle('extended', v < min - 1e-9 || v > max + 1e-9);
    if (live) onInput(v);
  });
  slider.addEventListener('change', () => {
    if (!live) onInput(Number(slider.value));
  });

  const commit = () => {
    const v = Number(num.value);
    if (!Number.isFinite(v)) return show(Number(slider.value));
    const next = clamp(v);
    show(next);
    onInput(next);
  };
  num.addEventListener('change', commit);
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') num.blur();
    e.stopPropagation();
  });

  return { row, set: show, slider, num };
}

// One word each, and each word says what it owns. In pipeline order: plan the
// town, clad it, put it somewhere, point a camera at it, decide how that
// camera's output is processed, then the housekeeping.
//
//   Town     the plan: size, streets, traffic, massing, which shapes exist
//   Surface  what the buildings are clad in: collage, palette, glow, signs
//   World    what it stands in: terrain, water, sky and sun
//   Camera   where the lens is and what it focuses on, including the tour
//   Render   what happens to the picture after the scene is drawn
//   Scene    saving, loading, starting over
//   Keys     shortcuts
export const TABS = [
  { id: 'town', label: 'Town' },
  { id: 'surface', label: 'Surface' },
  { id: 'world', label: 'World' },
  { id: 'camera', label: 'Camera' },
  { id: 'render', label: 'Render' },
  { id: 'scene', label: 'Scene' },
  { id: 'keys', label: 'Keys' },
];

export const CONTROL_DEFS = [
  {
    section: 'Size',
    tab: 'town',
    items: [
      {
        key: 'seed',
        label: 'Seed',
        type: 'seed',
        help: 'Every random choice grows from this. Same seed, same town.',
      },
      R('cols', 'Columns', 1, 40, 1, 'How many lots wide. Resizing leaves the lots you already have alone.', { live: false, hard: [1, 100] }),
      R('rows', 'Rows', 1, 40, 1, 'How many lots deep the grid runs.', { live: false, hard: [1, 100] }),
      R('cell', 'Block size', 3, 16, 0.1, 'Distance between lot centres. Up widens the streets, down packs the blocks.'),
      R('density', 'Lots built', 0, 1, 0.01, 'Odds a lot gets a building. Lower it for gaps and plazas.', { hard: [0, 1] }),
    ],
  },
  {
    section: 'Streets',
    tab: 'town',
    items: [
      {
        key: 'roadPattern',
        label: 'Pattern',
        type: 'select',
        options: [],
        help: 'Which real street plan the town is cut from. Grid is Manhattan, Boulevards drives diagonals through a grid, Radial is spokes and rings, Old town wanders.',
      },
      R('roadSkew', 'Skew', 0, 1, 0.01, 'How far roads drift off parallel. Zero is a clean grid, high gives the triangular blocks you get where avenues cut across.', { live: false, hard: [0, 1] }),
      R('blockWidth', 'Block width', 0.6, 6, 0.05, 'Spacing of the streets running one way, in block sizes.', { live: false }),
      R('blockDepth', 'Block depth', 0.6, 6, 0.05, 'Spacing of the streets running the other way. Unequal values give long thin blocks.', { live: false }),
      R('highwayWidth', 'Highway width', 1, 14, 0.1, 'Width of the main roads. Every third street is one.', { live: false }),
      R('streetWidth', 'Street width', 0.5, 8, 0.1, 'Width of the smaller streets cutting between them.', { live: false }),
      R('setback', 'Setback', 0, 6, 0.05, 'Gap between the kerb and the buildings facing it.', { live: false }),
      R('frontageSpacing', 'Frontage gap', 0.6, 3, 0.01, 'How far apart buildings sit along a street. One packs them shoulder to shoulder.', { live: false, hard: [0.4, 12] }),
      R('blockDepthRatio', 'Building depth', 0.3, 2.5, 0.01, 'How deep buildings are relative to their street frontage.', { live: false }),
    ],
  },
  {
    section: 'Traffic',
    tab: 'town',
    items: [
      R('carCount', 'Cars', 0, 400, 1, 'How many vehicles drive the streets. They follow their road exactly and keep to a lane.', { live: false, hard: [0, 1200] }),
      R('flyerCount', 'Flyers', 0, 300, 1, 'How many fly. They use the roads as corridors but weave off the centreline.', { live: false, hard: [0, 1200] }),
      R('mainRoadBias', 'Highway bias', 0, 1, 0.01, 'How much ground traffic prefers the main roads over the side streets.', { live: false, hard: [0, 1] }),
      R('carSpeed', 'Speed', 0, 40, 0.1, 'How fast traffic moves.', { cheap: true }),
      R('carSize', 'Size', 0.2, 4, 0.01, 'Scale of the vehicles against the buildings.', { live: false }),
      R('flyerHeight', 'Flying height', 2, 60, 0.5, 'How high the flyers cruise above the ground.', { live: false }),
    ],
  },
  {
    section: 'Massing',
    tab: 'town',
    items: [
      R('minFloors', 'Floors min', 1, 30, 1, 'Shortest a building can be, before the roof.', { hard: [1, 200] }),
      R('maxFloors', 'Floors max', 1, 60, 1, 'Tallest a building can be, before the roof.', { hard: [1, 200] }),
      R('centerBias', 'Downtown pull', 0, 1, 0.01, 'How much height follows distance from the middle. At one the towers cluster downtown.', { hard: [0, 1] }),
      R('floorHeight', 'Floor height', 0.6, 5, 0.05, 'Base height of one module. Scales the whole skyline against the block size.'),
      R('floorJitter', 'Floor variance', 0, 0.8, 0.01, 'How far floors stray from the base height. Zero is even layers, high is hand-stacked.', { hard: [0, 0.98] }),
      R('lotFill', 'Lot fill', 0.2, 1, 0.01, 'How much of its lot a building covers. Past one they swallow the streets.', { hard: [0.02, 3] }),
      R('lotJitter', 'Lot variance', 0, 0.6, 0.01, 'How much footprints differ building to building. Zero makes every block the same.', { hard: [0, 0.98] }),
      R('setbackChance', 'Setbacks', 0, 1, 0.01, 'Odds a building steps inward on the way up. Rolled per floor.', { hard: [0, 1] }),
      R('setbackAmount', 'Setback depth', 0, 0.6, 0.01, 'How far each step goes in. Small is a taper, large is a ziggurat.', { hard: [0, 0.98] }),
      R('bend', 'Bend', 0, 1, 0.01, 'Leans each building along one direction, more the higher it goes, so the stack curves instead of shearing. A little is whimsical, a lot is a fairground.', { hard: [0, 4] }),
    ],
  },
  {
    section: 'Module mix',
    tab: 'town',
    items: [
      {
        key: 'bodyRole',
        label: 'Body shapes in use',
        type: 'mount',
        help: 'Which shapes this town builds with at all. Switching one off removes it from the wheel entirely, which is different from turning its share down to nothing.',
      },
      {
        key: 'moduleMix',
        label: 'Body modules',
        type: 'wheel',
        help: 'How much of each shape exists across town. Drag any dot to trade weight between two kinds, or drag one onto its neighbour to remove a kind. Click a row to nudge it, shift-click to nudge it down.',
      },
      {
        key: 'roofRole',
        label: 'Roof shapes in use',
        type: 'mount',
        help: 'Which caps this town uses at all. Switch them all off but Flat for a town of flat tops.',
      },
      {
        key: 'roofMix',
        label: 'Roof modules',
        type: 'wheel',
        help: 'How buildings are capped. A round tower takes cones and domes, a boxy one gables.',
      },
      R('cohesion', 'Cohesion', 0, 1, 0.01, 'How strongly a building sticks to one shape family. At zero it turns to confetti.', { hard: [0, 1] }),
    ],
  },
  {
    section: 'Surface mix',
    tab: 'surface',
    items: [
      {
        key: 'surfaceMix',
        label: 'Building surfaces',
        type: 'wheel',
        help: 'What a building is made of, as a share of the whole town: a texture, a reflective shader, one half of the collage pool, or flat colour. Drag any dot to trade weight between two, or drag one onto its neighbour to remove it. Click a row to nudge it, shift-click to nudge it down.',
      },
      R('imageChance', 'Image vs colour', 0, 1, 0.01, 'Within an image or cutout building, odds a face takes a picture over a colour.', { hard: [0, 1] }),
      R('sameImageChance', 'Wrap one image', 0, 1, 0.01, 'Odds a module wraps one image around every side, so the block reads as one object.', { hard: [0, 1] }),
      R('zoomJitter', 'Crop variance', 0, 1.5, 0.01, 'How far images crop in past a plain fit, so one picture reads differently everywhere.', { hard: [0, 12] }),
      R('slabChance', 'Cornice slabs', 0, 1, 0.01, 'Odds of a thin overhanging slab between floors. Breaks up a tall stack and catches a shadow.', { hard: [0, 1] }),
      R('rotateChance', 'Quarter turns', 0, 1, 0.01, 'Odds a module is turned ninety degrees, changing which face meets the street.', { hard: [0, 1] }),
      R('spireChance', 'Spires', 0, 1, 0.01, 'Odds a pointed roof gets a flag on a pole.', { hard: [0, 1] }),
      R('wind', 'Wind', 0, 2, 0.01, 'How hard the flags flutter. Poles stay put, cloth moves most at its free edge.', { cheap: true }),
    ],
  },
  {
    section: 'Palette',
    tab: 'surface',
    items: [
      {
        key: 'palette',
        label: 'Palette',
        type: 'select',
        options: [],
        help: 'Colours, glow, duotone pair, sky and ground. Each building takes three from it, each module two.',
      },
      R('duotone', 'Duotone', 0, 1, 0.01, 'Pushes images toward the palette ink and paper. The main lever for making the collage feel like one town.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Glow',
    tab: 'surface',
    items: [
      R('glowChance', 'Lit modules', 0, 1, 0.01, 'How many modules are lit from within. Switches existing ones on and off, so the town never changes shape.', { cheap: true, hard: [0, 1] }),
      R('glowStrength', 'Glow strength', 0, 3, 0.01, 'How hard lit modules push. Past 1.5 the images inside start to wash out.', { cheap: true }),
      R('glowTint', 'Glow takes image colour', 0, 1, 0.01, 'How much a lit face glows with the picture on it rather than the palette glow colour. At one, neon glows neon.', { cheap: true, hard: [0, 1] }),
      R('glowImage', 'Bright parts glow more', 0, 1, 0.01, 'At zero the whole face glows evenly like a lightbox. At one only the bright areas burn.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Billboards',
    tab: 'surface',
    items: [
      R('scrollShare', 'Scrolling', 0, 1, 0.01, 'Share of lit faces whose image crawls sideways, like a running sign.', { cheap: true, hard: [0, 1] }),
      R('swapShare', 'Changing', 0, 1, 0.01, 'Share of lit faces that cut to a different picture every five to ten seconds.', { cheap: true, hard: [0, 1] }),
      R('flickerShare', 'Flickering', 0, 1, 0.01, 'Share of lit faces with a bad tube. A few go a long way.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Terrain',
    tab: 'world',
    items: [
      R('terrainHeight', 'Hill height', 0, 20, 0.1, 'How far the ground rises and falls. Buildings stay planted on a slope.', { live: false, hard: [0, 300] }),
      R('terrainScale', 'Hill size', 0.1, 4, 0.01, 'How wide the bumps are. Large gives a few broad hills the town drapes over.', { live: false, hard: [0.02, 40] }),
      R('terrainDetail', 'Roughness', 1, 5, 1, 'Layers of noise. One is smooth swells, five adds fine crumple on top.', { live: false, hard: [1, 8] }),
    ],
  },
  {
    section: 'Water',
    tab: 'world',
    items: [
      R('waveHeight', 'Swell', 0, 4, 0.01, 'How far the water lifts the town. Each building rides its own patch as one piece.', { cheap: true, hard: [0, 60] }),
      R('waveScale', 'Wave size', 0.2, 4, 0.01, 'How far apart the crests are. Small is chop, large is a long ocean swell.', { cheap: true, hard: [0.03, 40] }),
      R('waveSpeed', 'Wave speed', 0, 3, 0.01, 'How fast the water moves. Slow is a tide, fast is a storm.', { cheap: true, hard: [0, 40] }),
      R('waveRock', 'Rocking', 0, 2, 0.01, 'How much buildings lean with the water. Zero bobs upright, past one they lurch.', { cheap: true, hard: [0, 12] }),
    ],
  },
  {
    section: 'Sky and sun',
    tab: 'world',
    items: [
      R('hour', 'Hour', 0, 24, 0.1, 'Time of day. Sky, shadows, glow and bloom all follow it. Golden hour is near 6 and 18.', { cheap: true, hard: [0, 24] }),
      R('sunAzimuth', 'Sun compass', -180, 180, 1, 'Swings the arc of the sun around the town without changing the hour.', { cheap: true, hard: [-360, 360] }),
      R('sunStrength', 'Sun strength', 0, 2.5, 0.01, 'Brightness of the key light. Near zero goes flat and overcast.', { cheap: true }),
      R('ambient', 'Ambient', 0, 3, 0.01, 'Fill from sky and ground. Raise to open the shadows, lower for contrast.', { cheap: true }),
      R('exposure', 'Exposure', 0.2, 2.5, 0.01, 'Overall brightness after tone mapping. The last thing to touch.', { cheap: true, hard: [0.01, 12] }),
      {
        key: 'skyColor',
        toggleKey: 'skyCustom',
        label: 'Sky',
        type: 'colorToggle',
        cheap: true,
        help: 'Overrides the palette sky. Night is a darkened form of whatever you pick.',
      },
      R('fog', 'Fog', 0, 1, 0.01, 'Depth haze. The strongest single control for making a wide shot read as deep.', { cheap: true, hard: [0, 1] }),
      {
        key: 'fogColor',
        toggleKey: 'fogCustom',
        label: 'Fog colour',
        type: 'colorToggle',
        cheap: true,
        help: 'Haze takes the sky colour by default. Override to push the distance warm or cold.',
      },
      {
        key: 'showStats',
        label: 'Performance readout',
        type: 'check',
        cheap: true,
        help: 'Frame time, draw calls and triangles. The whole town merges into a few dozen draws.',
      },
    ],
  },
  {
    section: 'Shadows',
    tab: 'world',
    items: [
      {
        key: 'shadows',
        label: 'Cast shadows',
        type: 'check',
        cheap: true,
        help: 'Shadows from the sun. First thing to turn off if it stutters.',
      },
      {
        key: 'softShadows',
        label: 'Contact hardening',
        type: 'check',
        cheap: true,
        help: 'Widens a shadow with distance from whatever casts it, so the base of a building stays sharp and the far end goes soft. Costs more shadow samples and recompiles when switched.',
      },
      R('shadowLightSize', 'Sun size', 0.001, 0.03, 0.001, 'How large the sun appears from the ground, which is what sets how fast a shadow softens with distance from whatever casts it. Commits when you let go, because it recompiles.', { live: false, hard: [0.0001, 0.2] }),
      R('shadowSoftness', 'Softness', 0.1, 4, 0.05, 'Scales the whole penumbra on top of sun size. One is the natural result.', { cheap: true, hard: [0.05, 8] }),
      R('shadowSamples', 'Edge samples', 12, 48, 4, 'How many taps go into a soft shadow edge. Too few and the edge speckles instead of grading smoothly. Commits when you let go, because it recompiles.', { live: false, hard: [8, 64] }),
      R('shadowDetail', 'Detail', 1024, 8192, 1024, 'Resolution of the shadow map. Note that shimmer is almost never a resolution problem, so reach for this last. 8192 costs 256MB of video memory and 16384 costs a full gigabyte.', { live: false, hard: [256, 16384] }),
    ],
  },
  {
    section: 'Occlusion',
    tab: 'world',
    items: [
      R('ao', 'Ambient occlusion', 0, 1, 0.01, 'Darkens where surfaces face each other, read off the depth buffer. Finds the corner between two buildings and under an overhang. Off by default, since the analytic contact shade below is cleaner for most shots.', { cheap: true, hard: [0, 1] }),
      R('aoRadius', 'Reach', 0.3, 12, 0.1, 'How far out it looks for a neighbouring surface. Small catches creases, large shades whole streets.', { cheap: true, hard: [0.05, 60] }),
      R('aoSmoothing', 'Smoothing', 1, 4, 1, 'Rounds of blur over the occlusion. Each one widens the kernel, so this is the control that decides grainy against soft.', { cheap: true, hard: [1, 4] }),
      R('aoBias', 'Bias', 0, 0.4, 0.005, 'Nudge up if flat walls look dirty, down if corners look clean.', { cheap: true, hard: [0, 2] }),
      R('aoSamples', 'Samples', 4, 24, 1, 'More samples means less noise and more cost. It is blurred afterwards, so this can stay low.', { cheap: true, hard: [4, 24] }),
      {
        key: 'aoColor',
        toggleKey: 'aoTint',
        label: 'Shade colour',
        type: 'colorToggle',
        cheap: true,
        help: 'What occluded corners are tinted toward. A cool blue reads as skylight rather than as a hole.',
      },
      R('occlusion', 'Contact shade', 0, 1, 0.01, 'The cheap analytic version: darkens the base of every building and anything facing down. Costs nothing and stacks with the above.', { cheap: true, hard: [0, 1] }),
      R('occlusionHeight', 'Contact reach', 0.5, 20, 0.1, 'How far up a building the contact shade climbs.', { cheap: true, hard: [0.1, 200] }),
    ],
  },
  {
    section: 'Depth of field',
    tab: 'camera',
    items: [
      R('dof', 'Blur', 0, 1, 0.01, 'How far out of focus the background and foreground go. Real depth of field, measured off the scene depth rather than faked by screen height.', { cheap: true, hard: [0, 1] }),
      {
        key: 'dofAuto',
        label: 'Focus on pivot',
        type: 'check',
        cheap: true,
        help: 'Keeps whatever you are orbiting sharp. Turn it off to set the distance by hand.',
      },
      R('dofFocus', 'Focus distance', 1, 300, 0.5, 'How far away the sharp plane sits, in world units. Only used when focus on pivot is off.', { cheap: true, hard: [0.1, 4000] }),
      R('dofRange', 'Sharp depth', 2, 300, 1, 'How deep the sharp zone is, in world units either side of the focus. Make it shallow against a far focus and the town reads as a model on a table.', { cheap: true, hard: [0.5, 4000] }),
      R('bokeh', 'Bokeh', 0, 1, 0.01, 'How much the blur clumps into highlights rather than smearing evenly.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Grade',
    tab: 'render',
    items: [
      R('contrast', 'Contrast', 0.3, 2.2, 0.01, 'Pushes the tones apart around the midpoint.', { cheap: true, hard: [0, 6] }),
      R('saturation', 'Saturation', 0, 2.5, 0.01, 'Zero is greyscale, past one is poster ink.', { cheap: true, hard: [0, 8] }),
      {
        key: 'shadowTint',
        toggleKey: 'shadowTintOn',
        label: 'Shadow tint',
        type: 'colorToggle',
        cheap: true,
        help: 'Colours the dark end of the range. Cool shadows against warm light is most of what makes a frame feel graded.',
      },
      {
        key: 'highlightTint',
        toggleKey: 'highlightTintOn',
        label: 'Light tint',
        type: 'colorToggle',
        cheap: true,
        help: 'Colours the bright end. Push it against the shadow tint rather than with it.',
      },
    ],
  },
  {
    section: 'Print',
    tab: 'render',
    items: [
      R('halftone', 'Halftone', 0, 1, 0.01, 'Breaks the image into a print screen of dots, which suits the collage the town is made of.', { cheap: true, hard: [0, 1] }),
      R('halftoneScale', 'Dot size', 1, 14, 0.1, 'How coarse the dot screen is.', { cheap: true, hard: [0.5, 60] }),
      R('posterize', 'Posterise', 0, 1, 0.01, 'Collapses the picture to a handful of tones, dithered so it stipples like a screen print instead of banding.', { cheap: true, hard: [0, 1] }),
      R('posterizeSteps', 'Tones', 2, 16, 1, 'How many tones survive posterising.', { cheap: true, hard: [2, 64] }),
    ],
  },
  {
    section: 'Film',
    tab: 'render',
    items: [
      R('vignette', 'Vignette', 0, 1, 0.01, 'Darkens the corners and pulls the eye to the middle.', { cheap: true, hard: [0, 1] }),
      R('grain', 'Grain', 0, 1, 0.01, 'Film grain over the whole frame. A little stops flat colour looking digital.', { cheap: true, hard: [0, 1] }),
      R('bloomStrength', 'Bloom', 0, 3, 0.01, 'Soft halo around anything bright. It is what sells the glow at night.', { cheap: true }),
      {
        key: 'bloomOn',
        label: 'Bloom on',
        type: 'check',
        cheap: true,
        help: 'Turns the bloom pass off. Worth doing while editing a large town.',
      },
    ],
  },
  {
    section: 'Tour',
    tab: 'camera',
    items: [
      { key: 'tourTools', type: 'mount' },
      R('flybySpeed', 'Speed', 1, 60, 0.5, 'How fast the tour drives the town.', { cheap: true }),
      R('flybyHeight', 'Eye height', 0.5, 60, 0.1, 'Low is a car on the street, high is a drone over the roofs.', { cheap: true }),
      R('flybyLookAhead', 'Look ahead', 2, 80, 0.5, 'How far down the road the camera aims. Short feels urgent, long feels smooth.', { cheap: true }),
      R('flybyBank', 'Bank', 0, 2, 0.01, 'How hard the camera leans into a turn.', { cheap: true, hard: [0, 6] }),
      R('flybyPitch', 'Aim', -10, 20, 0.1, 'Raises or lowers where the camera is pointed relative to the road.', { cheap: true }),
    ],
  },
  {
    section: 'Scenes',
    tab: 'scene',
    items: [{ key: 'sceneTools', type: 'mount' }],
  },
  {
    section: 'Shortcuts',
    tab: 'keys',
    items: [{ key: 'shortcuts', type: 'mount' }],
  },
];

export class Controls {
  // onChange(key, value, def)
  constructor(root, defs, values, onChange, locks = {}, onLockChange = null) {
    this.root = root;
    this.values = values;
    this.onChange = onChange;
    // Which parameters the dice must leave alone. Owned by the caller so it
    // travels with the scene rather than living in two places.
    this.locks = locks;
    this.onLockChange = onLockChange;
    this.lockPainters = new Map();
    this.inputs = new Map();
    this.ranges = new Map();
    this.mounts = new Map();
    this.pages = new Map();
    // Where every control ended up, so search can jump to one.
    this.entries = [];
    this.tab = 'town';

    this.tabBar = h('nav', { class: 'tabbar' });
    this.pageWrap = h('div', { class: 'pages' });
    root.append(this.buildSearch(), this.tabBar, this.pageWrap);

    for (const tab of TABS) {
      const page = h('div', { class: 'page' });
      this.pages.set(tab.id, page);
      this.pageWrap.append(page);
      const button = h(
        'button',
        { class: 'tabbtn', 'data-tab': tab.id, onclick: () => this.show(tab.id) },
        tab.label
      );
      this.tabBar.append(button);
    }

    defs.forEach((group) => {
      const page = this.pages.get(group.tab) || this.pages.get('town');
      page.append(this.renderSection(group));
    });
    this.index = buildIndex(this.entries);
    this.show('town');
  }

  // --- search --------------------------------------------------------------

  buildSearch() {
    const input = h('input', {
      type: 'search',
      class: 'search-input',
      placeholder: 'Search settings',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const results = h('div', { class: 'search-results' });

    // Sits beside the search because both answer "show me less of this". It
    // reports how many, so an empty count tells you nothing has drifted from
    // where the scene loaded.
    const only = h('button', { class: 'changed-only', type: 'button', title: 'Show only what you changed' }, 'changed');
    only.addEventListener('click', () => {
      const on = !only.classList.contains('on');
      only.classList.toggle('on', on);
      this.setModifiedOnly(on);
    });
    this.changedButton = only;

    const wrap = h('div', { class: 'search' }, input, only, results);
    this.searchInput = input;

    let active = -1;
    const close = () => {
      results.replaceChildren();
      wrap.classList.remove('open');
      active = -1;
    };

    const run = () => {
      const found = search(this.index, input.value);
      if (!found.length) {
        if (!input.value.trim()) return close();
        results.replaceChildren(h('div', { class: 'search-empty' }, 'Nothing matches that'));
        wrap.classList.add('open');
        return;
      }
      active = -1;
      results.replaceChildren(
        ...found.map((entry, i) =>
          h(
            'button',
            {
              class: 'search-hit',
              'data-i': i,
              onclick: () => {
                this.reveal(entry.key);
                input.value = '';
                close();
              },
            },
            h('span', { class: 'search-hit-label' }, entry.label),
            h('span', { class: 'search-hit-where' }, `${entry.tabLabel} · ${entry.section}`)
          )
        )
      );
      wrap.classList.add('open');
    };

    input.addEventListener('input', run);
    input.addEventListener('focus', () => input.value.trim() && run());
    input.addEventListener('keydown', (e) => {
      const hits = [...results.querySelectorAll('.search-hit')];
      if (e.key === 'Escape') {
        input.value = '';
        close();
        input.blur();
        return;
      }
      if (!hits.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
        hits.forEach((b, i) => b.classList.toggle('on', i === active));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        (hits[Math.max(0, active)] || hits[0]).click();
      }
    });
    // Clicking anywhere else puts the list away.
    addEventListener('pointerdown', (e) => {
      if (!wrap.contains(e.target)) close();
    });

    return wrap;
  }

  // Switch to the right tab, open the section if it was collapsed, scroll to
  // the control and flash it, so the answer to "where is that" is visible
  // rather than merely navigated to.
  reveal(key) {
    const entry = this.entries.find((e) => e.key === key);
    if (!entry) return;
    this.show(entry.tab);
    entry.body?.classList.remove('closed');
    entry.head?.classList.remove('closed');
    entry.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    entry.row.classList.remove('found');
    // Restart the animation rather than letting a repeat search do nothing.
    void entry.row.offsetWidth;
    entry.row.classList.add('found');
    setTimeout(() => entry.row.classList.remove('found'), 1600);
  }

  show(id) {
    this.tab = id;
    this.pages.forEach((page, key) => page.classList.toggle('on', key === id));
    this.tabBar.querySelectorAll('.tabbtn').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === id);
    });
  }

  renderSection(group) {
    const tabLabel = (TABS.find((t) => t.id === group.tab) || {}).label || group.tab;
    const rows = (group.items || []).map((def) => {
      const row = this.renderItem(def);
      // Unlabelled mounts are holes other code fills in, with no label worth
      // finding. A labelled one is a real control and belongs in the index.
      if (def.type !== 'mount' || def.label) {
        this.entries.push({
          key: def.key,
          label: def.label || def.key,
          help: def.help || '',
          section: group.section,
          tab: group.tab,
          tabLabel,
          row,
        });
      }
      return row;
    });
    const body = h('div', { class: 'sec-body' }, rows);
    // Late binding, because the section elements do not exist until below.
    for (const entry of this.entries) {
      if (entry.section === group.section && !entry.body) entry.body = body;
    }
    // Open by default. Collapsing is there for when a section is in the way,
    // not as the resting state.
    const head = h(
      'button',
      {
        class: 'sec-head',
        onclick: () => {
          const closed = body.classList.toggle('closed');
          head.classList.toggle('closed', closed);
        },
      },
      h('span', { class: 'sec-name' }, group.section),
      h('span', { class: 'sec-mark' })
    );
    for (const entry of this.entries) {
      if (entry.body === body && !entry.head) entry.head = head;
    }
    return h('section', { class: 'sec' }, head, body);
  }

  renderItem(def) {
    const row = this.buildItem(def);
    if (def.help) {
      row.dataset.help = def.help;
      row.dataset.helpTitle = def.label;
    }
    if (def.key && def.type !== 'mount' && def.type !== 'wheel') this.addLock(row, def);
    return row;
  }

  // A padlock on every parameter, hidden until you go looking for it.
  //
  // A locked parameter is skipped by the dice. That is all it does, and it is
  // the whole point: the randomiser is the one action that can undo an hour
  // of tuning in a keystroke, and the seed in particular takes the entire town
  // with it. Being able to say "keep this, roll the rest" is what makes the
  // dice usable as a tool rather than a party trick.
  //
  // Locking is authoring intent, so unlike layer visibility it belongs to the
  // scene and is saved with it.
  addLock(row, def) {
    const lock = h('button', {
      class: 'lockbtn',
      type: 'button',
      title: 'Keep this when rolling the dice',
    });
    const paint = () => {
      const on = Boolean(this.locks && this.locks[def.key]);
      lock.textContent = on ? '\u{1F512}' : '\u{1F513}';
      lock.classList.toggle('on', on);
      row.classList.toggle('locked', on);
      lock.title = on ? 'Locked: the dice will leave this alone' : 'Keep this when rolling the dice';
    };
    lock.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.locks) return;
      if (this.locks[def.key]) delete this.locks[def.key];
      else this.locks[def.key] = true;
      paint();
      this.onLockChange?.(def.key, Boolean(this.locks[def.key]));
    });
    this.lockPainters.set(def.key, paint);
    paint();
    row.appendChild(lock);
    row.classList.add('lockable');
  }

  // Called when locks arrive from elsewhere, such as loading a scene.
  syncLocks() {
    this.lockPainters.forEach((paint) => paint());
  }

  // Which parameters differ from where they started.
  //
  // A hundred controls and no way to see what you touched makes returning to
  // a scene after a week an exercise in hunting. The baseline is whatever the
  // scene loaded with, not the factory defaults, so "changed" means "changed
  // by me, since I opened this" rather than "differs from a preset I never
  // used".
  setBaseline(values) {
    this.baseline = structuredClone(values);
    this.refreshModified();
  }

  refreshModified() {
    if (!this.baseline) return 0;
    let count = 0;
    for (const entry of this.entries) {
      if (!entry.row || !entry.key) continue;
      const before = this.baseline[entry.key];
      const now = this.values[entry.key];
      const changed = before !== undefined && JSON.stringify(before) !== JSON.stringify(now);
      entry.row.classList.toggle('changed', changed);
      if (changed) count++;
    }
    this.modifiedCount = count;
    if (this.changedButton) {
      this.changedButton.textContent = count ? `changed ${count}` : 'changed';
      this.changedButton.classList.toggle('none', count === 0);
    }
    if (this.modifiedOnly) this.applyModifiedFilter();
    return count;
  }

  // Folds the panel down to only what you changed. A filter rather than a
  // separate view, so everything stays where you learned it was.
  setModifiedOnly(on) {
    this.modifiedOnly = on;
    this.applyModifiedFilter();
  }

  applyModifiedFilter() {
    for (const entry of this.entries) {
      if (!entry.row) continue;
      const hide = this.modifiedOnly && !entry.row.classList.contains('changed');
      entry.row.classList.toggle('filtered-out', hide);
    }
    // A section whose every row is filtered away is noise, so it goes too.
    for (const entry of this.entries) {
      if (!entry.body) continue;
      const rows = [...entry.body.querySelectorAll('.row, .wheel-block, .mount-block')];
      const anyLeft = rows.some((r) => !r.classList.contains('filtered-out'));
      entry.body.parentElement?.classList.toggle('filtered-out', this.modifiedOnly && !anyLeft);
    }
  }

  buildItem(def) {
    const value = this.values[def.key];

    if (def.type === 'wheel') {
      const mount = h('div', { class: 'wheel-mount' });
      this.mounts.set(def.key, mount);
      return h('div', { class: 'wheel-block' }, h('h3', { class: 'grp' }, def.label), mount);
    }

    // A hole for main.js to fill: scene management, the shortcut list.
    if (def.type === 'mount') {
      const mount = h('div', { class: 'mount' });
      this.mounts.set(def.key, mount);
      // A labelled mount gets a heading like a wheel does; the unlabelled
      // ones (scene tools, shortcuts) stay bare holes as before.
      if (!def.label) return mount;
      const block = h('div', { class: 'mount-block' }, h('h3', { class: 'grp' }, def.label), mount);
      if (def.help) {
        block.dataset.help = def.help;
        block.dataset.helpTitle = def.label;
      }
      return block;
    }

    if (def.type === 'check') {
      const input = h('input', { type: 'checkbox', ...(value ? { checked: '' } : {}) });
      input.addEventListener('change', () => this.onChange(def.key, input.checked, def));
      this.inputs.set(def.key, input);
      return h('label', { class: 'row check' }, input, h('span', {}, def.label));
    }

    if (def.type === 'colorToggle') {
      const toggle = h('input', {
        type: 'checkbox',
        ...(this.values[def.toggleKey] ? { checked: '' } : {}),
      });
      const color = h('input', { type: 'color', class: 'swatch-input', value: value || '#ffffff' });
      toggle.addEventListener('change', () => this.onChange(def.toggleKey, toggle.checked, def));
      color.addEventListener('input', () => {
        if (!toggle.checked) {
          toggle.checked = true;
          this.onChange(def.toggleKey, true, def);
        }
        this.onChange(def.key, color.value, def);
      });
      this.inputs.set(def.toggleKey, toggle);
      this.inputs.set(def.key, color);
      return h('label', { class: 'row colour' }, toggle, h('span', { class: 'lbl' }, def.label), color);
    }

    if (def.type === 'select') {
      const select = h(
        'select',
        {},
        def.options.map(([val, label]) =>
          h('option', { value: val, ...(val === value ? { selected: '' } : {}) }, label)
        )
      );
      select.addEventListener('change', () => this.onChange(def.key, select.value, def));
      this.inputs.set(def.key, select);
      return h('label', { class: 'row' }, h('span', { class: 'lbl' }, def.label), select);
    }

    if (def.type === 'seed') {
      const input = h('input', { type: 'number', value, class: 'seed-input' });
      input.addEventListener('change', () => this.onChange(def.key, Number(input.value) | 0, def));
      const dice = h(
        'button',
        {
          class: 'mini',
          onclick: () => {
            const next = Math.floor(Math.random() * 100000);
            input.value = next;
            this.onChange(def.key, next, def);
          },
        },
        'reroll'
      );
      this.inputs.set(def.key, input);
      return h('label', { class: 'row' }, h('span', { class: 'lbl' }, def.label), input, dice);
    }

    const control = rangeRow({
      label: def.label,
      value,
      min: def.min,
      max: def.max,
      step: def.step,
      hard: def.hard,
      live: def.live !== false,
      onInput: (v) => this.onChange(def.key, v, def),
    });
    this.ranges.set(def.key, control);
    return control.row;
  }

  sync(values) {
    this.values = values;
    for (const [key, control] of this.ranges) {
      if (values[key] !== undefined) control.set(Number(values[key]));
    }
    for (const [key, input] of this.inputs) {
      const v = values[key];
      if (v === undefined) continue;
      if (input.type === 'checkbox') input.checked = !!v;
      else input.value = v;
    }
  }
}
