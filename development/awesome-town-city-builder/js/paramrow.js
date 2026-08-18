// One parameter, one line.
//
// The row *is* the lock model, so the control shows exactly as much as the
// mode means and no more:
//
//   free   nothing to show, because there is no value to have an opinion on
//   range  one track, two handles, the span randomness is allowed to use
//   fixed  one track, one handle, an authored value
//
// Switching mode never invents a number out of nowhere: collapsing a range
// keeps its midpoint, opening a fixed value spreads a band around it, so
// flipping back and forth is not destructive.

import { h } from './ui.js';

const MODES = ['free', 'range', 'fixed'];
const round = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function normalise(param) {
  if (param === null || param === undefined) return { mode: 'free', min: 0, max: 1 };
  if (typeof param === 'number') return { mode: 'fixed', value: param };
  return param;
}

// Sensible track ends. A parameter carries its own bounds when it has them,
// and otherwise gets a band around whatever value it holds, so a slider is
// always useful rather than pinned at one end.
function trackFor(p, hint) {
  if (hint && Number.isFinite(hint.lo) && Number.isFinite(hint.hi)) return hint;
  const vals = [p.min, p.max, p.value].filter(Number.isFinite);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals);
  const pad = (hi - lo) * 0.25 || 0.5;
  return { lo: round(lo - (lo < 0 ? pad : 0)), hi: round(hi + pad) };
}

export function paramRow(name, param, onChange, opts = {}) {
  const p = normalise(param);
  const track = trackFor(p, opts.track);
  const step = opts.step ?? 0.01;

  const modes = h(
    'div',
    { class: 'pm-modes' },
    ...MODES.map((mode) => {
      const b = h('button', { class: p.mode === mode ? 'on' : '', title: mode }, mode[0].toUpperCase());
      b.addEventListener('click', () => onChange(switchMode(p, mode)));
      return b;
    })
  );

  const value = h('span', { class: 'pm-val' });
  const slot = h('div', { class: 'pm-ctl' });

  if (p.mode === 'fixed') {
    const v = Number.isFinite(p.value) ? p.value : (track.lo + track.hi) / 2;
    const input = h('input', {
      type: 'range',
      class: 'pm-one',
      min: String(track.lo),
      max: String(track.hi),
      step: String(step),
      value: String(v),
    });
    input.addEventListener('input', () => {
      const n = parseFloat(input.value);
      value.textContent = String(round(n));
      onChange({ mode: 'fixed', value: round(n) }, { live: true });
    });
    value.textContent = String(round(v));
    slot.appendChild(input);
  } else if (p.mode === 'range') {
    const lo = Number.isFinite(p.min) ? p.min : track.lo;
    const hi = Number.isFinite(p.max) ? p.max : track.hi;
    // Two overlaid inputs rather than a bespoke widget, so the handles stay
    // keyboard reachable and behave the way every other slider here does.
    const a = h('input', {
      type: 'range', class: 'pm-lo', min: String(track.lo), max: String(track.hi),
      step: String(step), value: String(lo),
    });
    const b = h('input', {
      type: 'range', class: 'pm-hi', min: String(track.lo), max: String(track.hi),
      step: String(step), value: String(hi),
    });
    const fill = h('span', { class: 'pm-fill' });
    const paint = () => {
      const x = parseFloat(a.value);
      const y = parseFloat(b.value);
      const span = track.hi - track.lo || 1;
      fill.style.left = `${((Math.min(x, y) - track.lo) / span) * 100}%`;
      fill.style.right = `${100 - ((Math.max(x, y) - track.lo) / span) * 100}%`;
      value.textContent = `${round(Math.min(x, y))} – ${round(Math.max(x, y))}`;
    };
    const push = () => {
      const x = parseFloat(a.value);
      const y = parseFloat(b.value);
      paint();
      onChange({ mode: 'range', min: round(Math.min(x, y)), max: round(Math.max(x, y)) }, { live: true });
    };
    a.addEventListener('input', push);
    b.addEventListener('input', push);
    paint();
    slot.append(h('span', { class: 'pm-track' }, fill), a, b);
    slot.classList.add('dual');
  } else {
    // Free. Nothing to show, and saying so is the point: this parameter has
    // no value here because whatever places the component decides it.
    slot.appendChild(h('span', { class: 'pm-free' }, 'driven by the scene'));
  }

  return h('div', { class: `pm-row mode-${p.mode}` }, h('label', { title: name }, opts.label || name), modes, slot, value);
}

// Mode changes carry the number across rather than resetting it, so trying
// range and going back to fixed does not lose what was tuned.
function switchMode(p, mode) {
  if (mode === p.mode) return p;
  if (mode === 'fixed') {
    const v = p.mode === 'fixed' ? p.value : ((p.min ?? 0) + (p.max ?? 1)) / 2;
    return { mode: 'fixed', value: round(v) };
  }
  const mid = p.mode === 'fixed' ? p.value : ((p.min ?? 0) + (p.max ?? 1)) / 2;
  const min = Number.isFinite(p.min) && p.mode !== 'fixed' ? p.min : round(mid * 0.75);
  const max = Number.isFinite(p.max) && p.mode !== 'fixed' ? p.max : round(mid * 1.25);
  return { mode, min, max: max > min ? max : round(min + 0.5) };
}

export { clamp };
