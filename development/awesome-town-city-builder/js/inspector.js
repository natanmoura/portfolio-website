// The selection panel.
//
// Everything here goes through the `actions` object, which writes sparse
// overrides so a hand edit outlives every later reroll of the global sliders.
//
// The panel refuses to redraw itself while a slider is being dragged. Without
// that, the first input event rebuilds the city, the rebuild rerenders the
// panel, and the element under the pointer is replaced mid-drag, which is why
// the module sliders used to move one step and stop.

import { h, rangeRow } from './ui.js';
import { withHelp } from './tooltip.js';
import { slotCount, slotLabels } from './geometry.js';
import { MODULE_KINDS, BODY_KINDS, KIND_LABEL, ROOF_SET, MATERIAL_KINDS } from './generate.js';

const KIND_HELP = {
  box: 'Six flat faces. The workhorse.',
  octagon: 'Eight sided, with a top and bottom. A cube edging toward a cylinder.',
  cylinder: 'A hollow tube, open at both ends and visible from inside. Often turning.',
  pillars: 'A column at each corner with a deck above and below, so the storey reads as open.',
  sphere: 'A ball. Rare on purpose.',
  spin: 'One to four double-sided cards turning on an axle. Signage and rooftop clutter.',
  pyramid: 'A four-sided roof.',
  gable: 'A ridged roof. Turn the module to swing the ridge round.',
  cone: 'A round roof, faceted.',
  dome: 'A gazebo dome, eight panels with a flared eave.',
};

const PATTERNS = ['solid', 'alternate', 'half', 'mirror', 'caps', 'banded'];
const PATTERN_HELP =
  'How the module two colours are laid across its faces. Solid is one colour, alternate flips face to face, half splits it down the middle, mirror matches opposite faces, caps picks out the top and bottom, banded runs them in pairs.';

const HELP = {
  width: 'Footprint across. Neighbouring modules do not move, so a wide floor overhangs the ones below it.',
  height: 'How tall this module is. Everything stacked above shifts up to keep the building solid.',
  depth: 'Footprint front to back.',
  turn: 'Spins the module on its own axis, which changes which face points at the street.',
  speed: 'How fast the module turns, and which way. Zero parks it. The turn happens on the GPU, so a city full of them costs nothing extra.',
  cards: 'How many cards share the axle, spread evenly around it. Each card gets its own face slot.',
  glow: 'Lights this module from within. The image itself does the glowing, so a lit face reads like a lightbox rather than a lamp. Setting it here pins the module lit or unlit regardless of where the global lit-modules slider sits.',
  glowColour: 'Base colour of the light. How much of it survives depends on the glow-takes-image-colour slider, since a lit picture mostly glows with its own colours.',
  strength: 'How hard this one module pushes, on top of the global glow strength.',
  scheme: 'The two colours this module is allowed. They come from the building three, which is what keeps a block reading as one object.',
  faces: 'Which face the image and colour controls below are aimed at. Number keys do the same. Turn on all faces to hit every side at once.',
  images: 'Swap the image on the selected face. Reframe keeps the same picture and picks a new crop of it.',
  crop: 'How far into the image this face is cropped. Higher pulls tighter.',
  thumbs: 'Every image in the pool. Click one to put it on the selected face. Drop image files onto the window to add more for this session.',
  moduleActions: 'Add floor grows the building under its roof. Delete removes this module and drops everything above it. Reset throws away every hand edit on this module and lets the sliders decide again.',
  floors: 'Adds or removes a floor just below the roof. The roof stays on top.',
  scale: 'Grows or shrinks the whole footprint without touching the heights.',
  bRotate: 'Turns the entire building on its base.',
  nudge: 'Slides the building off its lot centre, for breaking up the grid.',
  bActions: 'Reroll gives this lot a fresh random building and drops its module edits. Light it up pins every module lit or unlit. Demolish empties the lot. Reset returns the lot to what the sliders alone would make.',
  material: 'What this building is made of, if anything. At most one material per building — every cube, octagon, cylinder, sphere and set of pillars in it wears the same one. Glass and mirror are reflective shaders rather than a picture — glass is tinted and soft, mirror is colourless and sharp enough to show the rest of the city in it.',
  materialUse: 'Whether this module wears the building material. Off falls back to its own colour or image.',
};

export class Inspector {
  constructor(root, pool, actions, matPool) {
    this.root = root;
    this.pool = pool;
    this.matPool = matPool;
    this.actions = actions;
    this.locked = false;
    this.applyAll = false;
    this.body = h('div', { class: 'insp-body' });
    this.root.append(
      h('header', { class: 'insp-head' }, h('h2', {}, 'Nothing selected')),
      this.body
    );
    this.head = this.root.querySelector('h2');
    this.thumbs = null;
    this.pool.onChange(() => {
      this.thumbs = null;
    });

    // A drag can end anywhere, so the release is caught on the window.
    addEventListener('pointerup', () => this.unlock());
    this.hide();
  }

  unlock() {
    if (!this.locked) return;
    this.locked = false;
    if (this.actions.refresh) this.actions.refresh();
  }

  hide() {
    this.root.classList.add('empty');
    this.head.textContent = 'Nothing selected';
    this.body.replaceChildren(
      h('p', { class: 'hint' }, 'Click a module to edit it. Shift-click selects the whole building.'),
      h('p', { class: 'hint' }, 'Hover any control for a note on what it does.')
    );
  }

  show(selection, module, building, palette) {
    if (this.locked) return; // a slider is mid-drag, leave the DOM alone
    this.root.classList.remove('empty');
    this.selection = selection;
    if (selection.mode === 'building') this.renderBuilding(building);
    else this.renderModule(selection, module, building, palette);
  }

  tabs(selection) {
    const tab = (mode, label, help) =>
      withHelp(
        h(
          'button',
          {
            class: `tab${selection.mode === mode ? ' on' : ''}`,
            onclick: () => this.actions.setMode(mode),
          },
          label
        ),
        help,
        label
      );
    return h(
      'div',
      { class: 'tabs' },
      tab('module', 'Module', 'Edit the single block you clicked. B switches between the two.'),
      tab('building', 'Building', 'Edit the whole stack this block belongs to. Shift-click in the viewport selects a building directly.')
    );
  }

  // --- module --------------------------------------------------------------

  renderModule(selection, module, building, palette) {
    const { actions } = this;
    const id = module.id;
    this.head.textContent = `Module ${module.index + 1} of ${building.modules.length}`;

    const isRoof = ROOF_SET.has(module.kind);
    const kindRow = h(
      'div',
      { class: 'chips' },
      MODULE_KINDS.map((k) =>
        withHelp(
          h(
            'button',
            {
              class: `chip sm${module.kind === k ? ' on' : ''}${BODY_KINDS.includes(k) ? '' : ' roof'}`,
              onclick: () => actions.setModule(id, { kind: k }),
            },
            KIND_LABEL[k]
          ),
          KIND_HELP[k],
          KIND_LABEL[k]
        )
      )
    );

    const size = (key, label, min, max, help) =>
      this.slider(label, module[key], min, max, 0.02, (v) => actions.setModule(id, { [key]: v }), help);

    const n = slotCount(module.kind, module.blades);
    const labels = slotLabels(module.kind, module.blades);
    const slot = Math.min(selection.slot || 0, n - 1);
    const face = module.faces[slot] || module.faces[0];
    const setFace = (patch) => actions.setFace(id, slot, patch, this.applyAll, n);

    const schemeRow = withHelp(
      h(
        'div',
        { class: 'swatches' },
        [0, 1].map((slotIndex) =>
          h(
            'span',
            { class: 'pair' },
            building.scheme.map((c) =>
              h('button', {
                class: `sw${module.scheme[slotIndex] === c ? ' on' : ''}`,
                style: `background:${c}`,
                onclick: () => {
                  const next = [...module.scheme];
                  next[slotIndex] = c;
                  actions.setModule(id, { scheme: next });
                },
              })
            )
          )
        )
      ),
      HELP.scheme,
      'Module colours'
    );

    const patternRow = withHelp(
      h(
        'div',
        { class: 'chips' },
        PATTERNS.map((p) =>
          h(
            'button',
            {
              class: `chip sm${module.pattern === p ? ' on' : ''}`,
              onclick: () => actions.setModule(id, { pattern: p }),
            },
            p
          )
        )
      ),
      PATTERN_HELP,
      'Colour pattern'
    );

    const faceChips = withHelp(
      h(
        'div',
        { class: 'chips' },
        Array.from({ length: n }, (_, i) =>
          h(
            'button',
            {
              class: `chip sm${i === slot ? ' on' : ''}`,
              onclick: () => actions.setFaceIndex(i),
            },
            labels[i]
          )
        ),
        h(
          'button',
          {
            class: `chip sm${this.applyAll ? ' on' : ''}`,
            onclick: (e) => {
              this.applyAll = !this.applyAll;
              e.currentTarget.classList.toggle('on', this.applyAll);
            },
          },
          'all faces'
        )
      ),
      HELP.faces,
      'Faces'
    );

    const imageRow = withHelp(
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip sm', onclick: () => setFace({ image: this.randomImage() }) }, 'random image'),
        h('button', { class: 'chip sm', onclick: () => setFace({ image: step(face.image, -1, this.pool.length) }) }, '‹'),
        h('button', { class: 'chip sm', onclick: () => setFace({ image: step(face.image, 1, this.pool.length) }) }, '›'),
        h('button', { class: 'chip sm', onclick: () => setFace({ image: null, color: module.scheme[0] }) }, 'no image'),
        h(
          'button',
          {
            class: 'chip sm',
            onclick: () =>
              setFace({
                zoom: 1 + Math.random() * 0.9,
                panU: 0.2 + Math.random() * 0.6,
                panV: 0.2 + Math.random() * 0.6,
              }),
          },
          'reframe'
        )
      ),
      HELP.images,
      'Image'
    );

    const glowRow = withHelp(
      h(
        'div',
        { class: 'chips' },
        h(
          'button',
          {
            class: `chip${module.glow ? ' on' : ''}`,
            onclick: () => actions.setModule(id, { glowTicket: module.glow ? 2 : -1 }),
          },
          module.glow ? 'lit' : 'unlit'
        ),
        palette.glow.map((c) =>
          h('button', {
            class: `sw${module.glowColor === c ? ' on' : ''}`,
            style: `background:${c}`,
            onclick: () => actions.setModule(id, { glowColor: c }),
          })
        )
      ),
      `${HELP.glow} ${HELP.glowColour}`,
      'Glow'
    );

    const materialEligible = !isRoof && MATERIAL_KINDS.has(module.kind);
    const usesMaterial = !!module.matKind;
    const materialRow =
      materialEligible &&
      building.material &&
      withHelp(
        h(
          'div',
          { class: 'chips' },
          h(
            'button',
            {
              class: `chip${usesMaterial ? ' on' : ''}`,
              onclick: () =>
                actions.setModule(
                  id,
                  usesMaterial
                    ? { matKind: null, matIndex: null }
                    : { matKind: building.material.kind, matIndex: building.material.index ?? null }
                ),
            },
            usesMaterial
              ? `on: ${building.material.kind === 'material' ? 'material' : building.material.kind}`
              : 'off'
          )
        ),
        HELP.materialUse,
        'Building material'
      );

    this.body.replaceChildren(
      this.tabs(selection),
      label('Shape'),
      kindRow,
      label('Size'),
      size('w', 'Width', 0.2, 20, HELP.width),
      size('h', 'Height', 0.15, 16, HELP.height),
      size('d', 'Depth', 0.2, 20, HELP.depth),
      this.slider('Turn', module.rotY || 0, 0, Math.PI * 2, 0.01, (v) => actions.setModule(id, { rotY: v }), HELP.turn),
      this.slider('Spin', module.spinSpeed || 0, -3, 3, 0.01, (v) => actions.setModule(id, { spinSpeed: v }), HELP.speed),
      module.kind === 'spin' &&
        this.slider('Cards', module.blades || 1, 1, 4, 1, (v) => actions.setModule(id, { blades: Math.round(v) }), HELP.cards),
      label('Colour'),
      schemeRow,
      patternRow,
      label('Glow'),
      glowRow,
      this.slider('Strength', module.glowStrength ?? 1, 0, 4, 0.02, (v) => actions.setModule(id, { glowStrength: v }), HELP.strength),
      materialRow && label('Material'),
      materialRow,
      label(isRoof ? 'Faces (roofs stay flat colour)' : 'Faces'),
      faceChips,
      !isRoof && !usesMaterial && imageRow,
      !isRoof && !usesMaterial && this.slider('Crop', face.zoom || 1, 1, 3, 0.01, (v) => setFace({ zoom: v }), HELP.crop),
      !isRoof && !usesMaterial && label('Images'),
      !isRoof && !usesMaterial && withHelp(this.thumbGrid(face, setFace), HELP.thumbs, 'Image pool'),
      !isRoof && usesMaterial && h('p', { class: 'hint' }, 'This module is wearing the building material — every face, no picture.'),
      withHelp(
        h(
          'div',
          { class: 'chips actions' },
          h('button', { class: 'chip sm', onclick: () => actions.addFloor(building.id) }, 'add floor'),
          h('button', { class: 'chip sm', onclick: () => actions.deleteModule(id) }, 'delete'),
          h('button', { class: 'chip sm', onclick: () => actions.clearModule(id) }, 'reset')
        ),
        HELP.moduleActions,
        'Module actions'
      )
    );
  }

  randomImage() {
    return this.pool.length ? Math.floor(Math.random() * this.pool.length) : null;
  }

  thumbGrid(face, setFace) {
    if (!this.thumbs) {
      this.thumbs = h(
        'div',
        { class: 'thumbs' },
        this.pool.items.map((item, i) =>
          h('button', {
            class: 'thumb',
            style: `background-image:url(${item.url})`,
            title: item.name,
            'data-i': i,
          })
        )
      );
    }
    this.thumbs.onclick = (e) => {
      const btn = e.target.closest('.thumb');
      if (btn) setFace({ image: Number(btn.dataset.i), color: '#ffffff' });
    };
    this.thumbs.querySelectorAll('.thumb').forEach((btn, i) => {
      btn.classList.toggle('on', face.image === i);
    });
    return this.thumbs;
  }

  // --- building ------------------------------------------------------------

  materialPicker(building) {
    const { actions } = this;
    const id = building.id;
    const current = building.material;
    const pick = (value) => actions.setBuilding(id, { material: value });

    const toggles = h(
      'div',
      { class: 'chips' },
      h('button', { class: `chip sm${!current ? ' on' : ''}`, onclick: () => pick(null) }, 'none'),
      h(
        'button',
        { class: `chip sm${current?.kind === 'glass' ? ' on' : ''}`, onclick: () => pick({ kind: 'glass' }) },
        'glass'
      ),
      h(
        'button',
        { class: `chip sm${current?.kind === 'mirror' ? ' on' : ''}`, onclick: () => pick({ kind: 'mirror' }) },
        'mirror'
      )
    );
    if (!this.matPool.length) return toggles;

    const grid = h(
      'div',
      { class: 'thumbs' },
      this.matPool.items.map((item, i) =>
        h('button', {
          class: `thumb${current?.kind === 'material' && current.index === i ? ' on' : ''}`,
          style: `background-image:url(${item.url})`,
          title: item.name,
          onclick: () => pick({ kind: 'material', index: i }),
        })
      )
    );
    return h('div', {}, toggles, grid);
  }

  renderBuilding(building) {
    const { actions } = this;
    const id = building.id;
    this.head.textContent = `Building ${building.gx + 1},${building.gz + 1}`;
    const over = actions.buildingOverride(id);

    this.body.replaceChildren(
      this.tabs({ mode: 'building' }),
      label(
        `${building.modules.length} modules · ${building.height.toFixed(1)} tall · ${building.family}`
      ),
      withHelp(
        h(
          'div',
          { class: 'swatches' },
          building.scheme.map((c) => h('span', { class: 'sw locked', style: `background:${c}` }))
        ),
        'The three colours every module in this building draws from. Reroll the building for a different set.',
        'Building colours'
      ),
      label('Material'),
      withHelp(this.materialPicker(building), HELP.material, 'Building material'),
      withHelp(
        h(
          'div',
          { class: 'chips' },
          h('button', { class: 'chip', onclick: () => actions.addFloor(id) }, 'add floor'),
          h('button', { class: 'chip', onclick: () => actions.removeFloor(id) }, 'drop floor')
        ),
        HELP.floors,
        'Floors'
      ),
      label('Footprint'),
      this.slider('Scale', over.footprintScale || 1, 0.3, 2, 0.01, (v) => actions.setBuilding(id, { footprintScale: v }), HELP.scale),
      this.slider('Turn', over.rotY || 0, 0, Math.PI * 2, 0.01, (v) => actions.setBuilding(id, { rotY: v }), HELP.bRotate),
      this.slider('Nudge X', over.offsetX || 0, -4, 4, 0.01, (v) => actions.setBuilding(id, { offsetX: v }), HELP.nudge),
      this.slider('Nudge Z', over.offsetZ || 0, -4, 4, 0.01, (v) => actions.setBuilding(id, { offsetZ: v }), HELP.nudge),
      label('Whole building'),
      withHelp(
        h(
          'div',
          { class: 'chips actions' },
          h('button', { class: 'chip sm', onclick: () => actions.rerollBuilding(id) }, 'reroll'),
          h('button', { class: 'chip sm', onclick: () => actions.glowBuilding(id) }, 'light it up'),
          h('button', { class: 'chip sm', onclick: () => actions.deleteBuilding(id) }, 'demolish'),
          h('button', { class: 'chip sm', onclick: () => actions.clearBuilding(id) }, 'reset')
        ),
        HELP.bActions,
        'Building actions'
      )
    );
  }

  // --- bits ----------------------------------------------------------------

  slider(name, value, min, max, step, onInput, help, hard) {
    const { row } = rangeRow({
      label: name,
      value,
      min,
      max,
      step,
      hard,
      onLock: () => {
        this.locked = true;
      },
      onInput,
    });
    return withHelp(row, help, name);
  }
}

function label(text) {
  return h('h3', { class: 'grp' }, text);
}

function step(current, dir, len) {
  if (!len) return null;
  const base = current == null ? (dir > 0 ? -1 : 0) : current;
  return (((base + dir) % len) + len) % len;
}
