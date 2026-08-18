// The controls panel. Definitions live in params.js, wiring lives in main.js.
//
// House rule, carried over from Awesome Town: nothing ships without hover help.
// A `help` field on a definition is picked up by the tooltip layer
// automatically, and `source` becomes the citation line under it.

import { CONTROL_DEFS, TABS, PRESETS } from './params.js';

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

// A slider spanning a comfortable range, next to a box you can type into. The
// slider covers where you normally want to be. Typing a value outside that
// stretches the slider to reach it and marks the row, so going past the useful
// range is possible but never accidental.
//
// That behaviour is the whole reason this control is right for this project.
// Every default sits at a measured value, and stylising means knowingly leaving
// the measured range.
export function rangeRow({ label, value, min, max, step, hard, live = true, onInput, onLock }) {
  const [hardMin, hardMax] = hard || [min, max + (max - min) * 7];
  const clamp = (v) => Math.min(hardMax, Math.max(hardMin, v));

  const slider = h('input', { type: 'range', min, max, step, value });
  const num = h('input', { type: 'number', class: 'num', step });
  const row = h('div', { class: 'row' }, h('span', { class: 'lbl' }, label), slider, num);

  const decimals = Number(step) >= 1 ? 0 : String(step).split('.')[1]?.length || 2;
  const show = (v) => {
    num.value = Number(v.toFixed(decimals));
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

function selectRow({ label, value, options, onInput }) {
  const sel = h('select', {});
  for (const o of options) {
    sel.append(h('option', { value: o, ...(o === value ? { selected: true } : {}) }, o));
  }
  sel.addEventListener('change', () => onInput(sel.value));
  const row = h('div', { class: 'row' }, h('span', { class: 'lbl' }, label), sel);
  return { row, set: (v) => (sel.value = v) };
}

function toggleRow({ label, value, onInput }) {
  const box = h('input', { type: 'checkbox', ...(value ? { checked: true } : {}) });
  box.addEventListener('change', () => onInput(box.checked));
  const row = h('div', { class: 'row toggle' }, h('span', { class: 'lbl' }, label), box);
  return { row, set: (v) => (box.checked = v) };
}

// Build the whole panel. Returns a setters map so anything that changes a param
// from elsewhere, a preset for instance, can push the value back into the UI.
export function buildPanel(host, params, onChange) {
  const setters = new Map();
  const tabBar = h('div', { class: 'tabs' });
  const pages = new Map();

  for (const tab of TABS) {
    const page = h('div', { class: 'page' });
    pages.set(tab, page);
    const btn = h(
      'button',
      {
        class: 'tab',
        onClick: () => {
          for (const [t, p] of pages) p.classList.toggle('on', t === tab);
          for (const b of tabBar.children) b.classList.toggle('on', b === btn);
        },
      },
      tab
    );
    tabBar.append(btn);
  }

  for (const def of CONTROL_DEFS) {
    const page = pages.get(def.tab);
    if (!page) continue;
    const commit = (v) => {
      params[def.key] = v;
      onChange(def.key, v);
    };

    let built;
    if (def.type === 'select') {
      built = selectRow({ label: def.label, value: params[def.key], options: def.options, onInput: commit });
    } else if (def.type === 'toggle') {
      built = toggleRow({ label: def.label, value: params[def.key], onInput: commit });
    } else {
      built = rangeRow({
        label: def.label,
        value: params[def.key],
        min: def.min,
        max: def.max,
        step: def.step,
        hard: def.hard,
        onInput: commit,
      });
    }

    built.row.dataset.help = def.help;
    built.row.dataset.helpTitle = def.label;
    if (def.source) built.row.dataset.helpSource = def.source;
    // Dials whose consuming solver is not built yet read as inert rather than
    // being hidden, so the shape of the whole system is visible from day one.
    if (def.pending) built.row.classList.add('pending');
    page.append(built.row);
    setters.set(def.key, built.set);
  }

  // Presets are points in the style space, so applying one is just writing
  // eight numbers and refreshing eight rows.
  const presetBar = h('div', { class: 'presets' });
  for (const name of Object.keys(PRESETS)) {
    presetBar.append(
      h(
        'button',
        {
          class: 'chip',
          'data-help': `Jump the eight style axes to the ${name} point. Presets are saved positions in that space, nothing more, so you can always keep tuning from here.`,
          'data-help-title': `${name} preset`,
          onClick: () => {
            for (const [k, v] of Object.entries(PRESETS[name])) {
              params[k] = v;
              setters.get(k)?.(v);
              onChange(k, v);
            }
          },
        },
        name
      )
    );
  }
  pages.get('Style').prepend(presetBar);

  host.append(tabBar);
  for (const p of pages.values()) host.append(p);
  tabBar.children[0].click();

  return setters;
}
