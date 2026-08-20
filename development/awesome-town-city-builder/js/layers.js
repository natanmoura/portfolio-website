// The layers strip.
//
// Persistent, above the tabs, because visibility is something you change
// constantly while doing something else and a tab you have to leave to hide
// the roads is a tab you will resent.
//
// The rule this file exists to enforce: **view state is never scene state.**
// Nothing here may touch generation, export, or what gets saved. Hiding the
// traffic must not remove it from a render, and a layer switched off must
// come back exactly as it was. Easy to violate once, painful forever after,
// so visibility lives in its own store rather than in params.
//
// Three states, not two. Ghosted is the important middle: seeing four
// authored statues alone in a void tells you much less than seeing them
// faintly surrounded by everything you did not place, and binary visibility
// forces a choice between clutter and disorientation.

import { h, setChildren } from './ui.js';

export const SHOWN = 'shown';
export const GHOSTED = 'ghosted';
export const HIDDEN = 'hidden';
const CYCLE = [SHOWN, GHOSTED, HIDDEN];

const STORE_KEY = 'awesome-town:layer-view';

// The layers as they exist today. Buildings, roads and traffic are real
// things the town already draws; the rest arrive with the placement work and
// are declared here so the strip does not have to be rebuilt to hold them.
// `ghostable` is opt-in rather than assumed. Fading something means having a
// material that can be faded without breaking what it was doing: several of
// these are drawn by shaders that use the alpha channel for their own
// purposes, and a layer that claims to ghost and then does nothing is worse
// than one that only offers on and off.
export const LAYERS = [
  { id: 'buildings', label: 'Buildings', help: 'Everything stacked on a lot.', ghostable: true },
  { id: 'roads', label: 'Roads', help: 'The tarmac. Hiding it leaves the massing alone.' },
  { id: 'traffic', label: 'Traffic', help: 'Cars and flyers. Hidden without being forgotten.' },
  { id: 'particles', label: 'Particles', help: 'Whatever is rising out of the town. Hidden without losing the count.' },
  { id: 'curves', label: 'Curves', help: 'Roads, boundaries and every other linear thing, as the paths behind them.' },
  { id: 'ground', label: 'Ground', help: 'The terrain surface under everything.' },
  { id: 'grid', label: 'Grid', help: 'The reference grid.' },
];

const byId = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
const statesFor = (id) => (byId[id]?.ghostable ? CYCLE : [SHOWN, HIDDEN]);

export class Layers {
  constructor(mount, onChange) {
    this.mount = mount;
    this.onChange = onChange || (() => {});
    this.state = this.load();
    // What each layer holds, filled in as the count of things drawn. Shown in
    // the strip because scale is the thing you most want to know at a glance
    // once a layer can hold fourteen thousand of something.
    this.counts = {};
    this.render();
  }

  load() {
    const out = {};
    for (const layer of LAYERS) out[layer.id] = SHOWN;
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      for (const [id, v] of Object.entries(saved)) {
        if (id in out && statesFor(id).includes(v)) out[id] = v;
      }
    } catch {
      // A corrupt view preference is not worth failing over. Everything shown
      // is the right thing to fall back to.
    }
    return out;
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch {
      // Out of quota is survivable here: visibility resets next session and
      // nothing about the scene is lost.
    }
  }

  get(id) {
    return this.state[id] || SHOWN;
  }

  visible(id) {
    return this.get(id) !== HIDDEN;
  }

  ghosted(id) {
    return this.get(id) === GHOSTED;
  }

  set(id, value) {
    if (this.state[id] === value) return;
    this.state[id] = value;
    this.save();
    this.render();
    this.onChange(this);
  }

  cycle(id) {
    const states = statesFor(id);
    const at = states.indexOf(this.get(id));
    this.set(id, states[(at + 1) % states.length]);
  }

  // Everything else hidden, or restored if this layer is already the only one
  // showing. A toggle rather than a mode, so it is impossible to get stuck
  // wondering where the rest of the town went.
  solo(id) {
    const alone = LAYERS.every((l) => (l.id === id ? this.get(l.id) !== HIDDEN : this.get(l.id) === HIDDEN));
    for (const l of LAYERS) {
      this.state[l.id] = alone ? SHOWN : l.id === id ? SHOWN : HIDDEN;
    }
    this.save();
    this.render();
    this.onChange(this);
  }

  setCounts(counts) {
    this.counts = counts || {};
    this.render();
  }

  render() {
    if (!this.mount) return;
    const rows = LAYERS.map((layer) => {
      const state = this.get(layer.id);
      const count = this.counts[layer.id];

      const dot = h('span', { class: `lyr-dot ${state}` });
      const btn = h(
        'button',
        {
          class: `lyr ${state}`,
          title: `${layer.help}\n${
            layer.ghostable ? 'Click cycles shown, ghosted, hidden.' : 'Click shows or hides.'
          } Shift-click to solo.`,
        },
        dot,
        h('span', { class: 'lyr-name' }, layer.label),
        count != null ? h('span', { class: 'lyr-count' }, String(count)) : null
      );
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) this.solo(layer.id);
        else this.cycle(layer.id);
      });
      return btn;
    });

    // Titled, because sitting on the viewport it needs to say what it is,
    // and "view" is the word that tells you it changes nothing else.
    setChildren(
      this.mount,
      h('div', { class: 'lyr-head' }, 'View'),
      h('div', { class: 'lyr-strip' }, ...rows)
    );
  }
}
