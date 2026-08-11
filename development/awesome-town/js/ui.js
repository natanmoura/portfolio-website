// Global controls panel. Definitions live here, wiring lives in main.js.
//
// House rule: nothing ships without hover help. `help` on a definition is
// picked up by the tooltip layer automatically.
//
// live:  redraw while dragging rather than on release.
// cheap: a uniform or a light setting, so it never rebuilds the city.

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

export const CONTROL_DEFS = [
  {
    section: 'City',
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
    section: 'Massing',
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
    ],
  },
  {
    section: 'Module mix',
    items: [
      {
        key: 'moduleMix',
        label: 'Body modules',
        type: 'wheel',
        help: 'How much of each shape exists across town. Drag any dot to trade weight between two kinds, or drag one onto its neighbour to remove a kind. Click a row to nudge it, shift-click to nudge it down.',
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
    section: 'Surfaces',
    items: [
      R('collageChance', 'Collaged buildings', 0, 1, 0.01, 'Odds a building carries images at all. The rest are pure colour, to rest the eye.', { hard: [0, 1] }),
      R('imageChance', 'Image vs colour', 0, 1, 0.01, 'Within a collaged building, odds a face takes an image over a colour.', { hard: [0, 1] }),
      R('sameImageChance', 'Wrap one image', 0, 1, 0.01, 'Odds a module wraps one image around every side, so the block reads as one object.', { hard: [0, 1] }),
      R('zoomJitter', 'Crop variance', 0, 1.5, 0.01, 'How far images crop in past a plain fit, so one picture reads differently everywhere.', { hard: [0, 12] }),
      R('slabChance', 'Cornice slabs', 0, 1, 0.01, 'Odds of a thin overhanging slab between floors. Breaks up a tall stack and catches a shadow.', { hard: [0, 1] }),
      R('rotateChance', 'Quarter turns', 0, 1, 0.01, 'Odds a module is turned ninety degrees, changing which face meets the street.', { hard: [0, 1] }),
      R('spireChance', 'Spires', 0, 1, 0.01, 'Odds a pointed roof gets a flag on a pole.', { hard: [0, 1] }),
    ],
  },
  {
    section: 'Palette',
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
    items: [
      R('glowChance', 'Lit modules', 0, 1, 0.01, 'How many modules are lit from within. Switches existing ones on and off, so the town never changes shape.', { cheap: true, hard: [0, 1] }),
      R('glowStrength', 'Glow strength', 0, 3, 0.01, 'How hard lit modules push. Past 1.5 the images inside start to wash out.', { cheap: true }),
      R('glowTint', 'Glow takes image colour', 0, 1, 0.01, 'How much a lit face glows with the picture on it rather than the palette glow colour. At one, neon glows neon.', { cheap: true, hard: [0, 1] }),
      R('glowImage', 'Bright parts glow more', 0, 1, 0.01, 'At zero the whole face glows evenly like a lightbox. At one only the bright areas burn.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Billboards',
    items: [
      R('scrollShare', 'Scrolling', 0, 1, 0.01, 'Share of lit faces whose image crawls sideways, like a running sign.', { cheap: true, hard: [0, 1] }),
      R('swapShare', 'Changing', 0, 1, 0.01, 'Share of lit faces that cut to a different picture every five to ten seconds.', { cheap: true, hard: [0, 1] }),
      R('flickerShare', 'Flickering', 0, 1, 0.01, 'Share of lit faces with a bad tube. A few go a long way.', { cheap: true, hard: [0, 1] }),
    ],
  },
  {
    section: 'Terrain',
    items: [
      R('terrainHeight', 'Hill height', 0, 20, 0.1, 'How far the ground rises and falls. Buildings stay planted on a slope.', { live: false, hard: [0, 300] }),
      R('terrainScale', 'Hill size', 0.1, 4, 0.01, 'How wide the bumps are. Large gives a few broad hills the town drapes over.', { live: false, hard: [0.02, 40] }),
      R('terrainDetail', 'Roughness', 1, 5, 1, 'Layers of noise. One is smooth swells, five adds fine crumple on top.', { live: false, hard: [1, 8] }),
    ],
  },
  {
    section: 'Water',
    items: [
      R('waveHeight', 'Swell', 0, 4, 0.01, 'How far the water lifts the town. Each building rides its own patch as one piece.', { cheap: true, hard: [0, 60] }),
      R('waveScale', 'Wave size', 0.2, 4, 0.01, 'How far apart the crests are. Small is chop, large is a long ocean swell.', { cheap: true, hard: [0.03, 40] }),
      R('waveSpeed', 'Wave speed', 0, 3, 0.01, 'How fast the water moves. Slow is a tide, fast is a storm.', { cheap: true, hard: [0, 40] }),
      R('waveRock', 'Rocking', 0, 2, 0.01, 'How much buildings lean with the water. Zero bobs upright, past one they lurch.', { cheap: true, hard: [0, 12] }),
    ],
  },
  {
    section: 'Light and sky',
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
      R('bloomStrength', 'Bloom', 0, 3, 0.01, 'Soft halo around anything bright. It is what sells the glow at night.', { cheap: true }),
      {
        key: 'bloomOn',
        label: 'Bloom on',
        type: 'check',
        cheap: true,
        help: 'Turns the bloom pass off. Worth doing while editing a large town.',
      },
      {
        key: 'shadows',
        label: 'Shadows',
        type: 'check',
        cheap: true,
        help: 'Cast shadows from the sun. First thing to turn off if it stutters.',
      },
      {
        key: 'showGrid',
        label: 'Street grid',
        type: 'check',
        cheap: true,
        help: 'The lot grid on the ground. Useful while laying out, off for a final look.',
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
];

export class Controls {
  // onChange(key, value, def)
  constructor(root, defs, values, onChange) {
    this.root = root;
    this.values = values;
    this.onChange = onChange;
    this.inputs = new Map();
    this.ranges = new Map();
    this.mounts = new Map();
    defs.forEach((group) => root.append(this.renderSection(group)));
  }

  renderSection(group) {
    const body = h('div', { class: 'sec-body' }, group.items.map((def) => this.renderItem(def)));
    const head = h(
      'button',
      {
        class: 'sec-head',
        onclick: () => {
          const closed = body.classList.toggle('closed');
          head.classList.toggle('closed', closed);
        },
      },
      group.section
    );
    return h('section', { class: 'sec' }, head, body);
  }

  renderItem(def) {
    const row = this.buildItem(def);
    if (def.help) {
      row.dataset.help = def.help;
      row.dataset.helpTitle = def.label;
    }
    return row;
  }

  buildItem(def) {
    const value = this.values[def.key];

    if (def.type === 'wheel') {
      const mount = h('div', { class: 'wheel-mount' });
      this.mounts.set(def.key, mount);
      return h('div', { class: 'wheel-block' }, h('h3', { class: 'grp' }, def.label), mount);
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
