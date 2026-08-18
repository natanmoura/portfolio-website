// One parameter, one line.
//
// The row *is* the lock model, so the control shows exactly as much as the
// mode means and no more:
//
//   free   nothing to show, because there is no value to have an opinion on
//   range  one track, two knobs, the span randomness is allowed to use
//   fixed  one track, one knob, an authored value
//
// Dragging reports twice: continuously while the knob moves, so the model
// keeps up, and once on release. Only the release is allowed to rebuild the
// panel — redrawing a slider mid-drag pulls the DOM out from under the
// pointer and is exactly what makes a control feel like it is sticking.
//
// Switching mode never invents a number out of nowhere: collapsing a range
// keeps its midpoint, opening a fixed value spreads a band around it, so
// flipping back and forth is not destructive.

import { h } from './ui.js';

const MODES = ['free', 'range', 'fixed'];
const round = (v) => Math.round(v * 1000) / 1000;

function normalise(param) {
  if (param === null || param === undefined) return { mode: 'free', min: 0, max: 1 };
  if (typeof param === 'number') return { mode: 'fixed', value: param };
  return param;
}

// What a parameter means, by name.
//
// Deriving the track from the current value alone makes a slider that can
// never reach past where it already is — a count sitting between five and
// ten would top out at ten, so twelve of something is unaskable. These say
// how far each kind of quantity can sensibly go, and which ones are counts
// and must move in whole steps.
export const PARAM_HINTS = {
  count: { step: 1, track: { lo: 1, hi: 48 } },
  cols: { step: 1, track: { lo: 1, hi: 16 } },
  rows: { step: 1, track: { lo: 1, hi: 16 } },
  turns: { step: 0.25, track: { lo: 0, hi: 6 } },
  rise: { step: 0.05, track: { lo: 0, hi: 2 } },
  radius: { step: 0.05, track: { lo: 0, hi: 6 } },
  radiusX: { step: 0.05, track: { lo: 0, hi: 6 } },
  radiusZ: { step: 0.05, track: { lo: 0, hi: 6 } },
  spacing: { step: 0.05, track: { lo: 0, hi: 6 } },
  spacingX: { step: 0.05, track: { lo: 0, hi: 6 } },
  spacingZ: { step: 0.05, track: { lo: 0, hi: 6 } },
  gap: { step: 0.05, track: { lo: 0, hi: 4 } },
  overlap: { step: 0.01, track: { lo: 0, hi: 0.9 } },
  shrink: { step: 0.01, track: { lo: 0, hi: 0.6 } },
  spread: { step: 0.01, track: { lo: 0, hi: 1 } },
  start: { step: 0.01, track: { lo: 0, hi: 1 } },
  // Switches. One step from off to on, so the knob has two places to be.
  faceOut: { step: 1, track: { lo: 0, hi: 1 } },
  flip: { step: 1, track: { lo: 0, hi: 1 } },
  spin: { step: 1, track: { lo: 0, hi: 1 } },
  axis: { step: 1, track: { lo: 0, hi: 2 } },
  w: { step: 0.05, track: { lo: 0, hi: 6 } },
  h: { step: 0.05, track: { lo: 0, hi: 6 } },
  d: { step: 0.05, track: { lo: 0, hi: 6 } },
};

// Sensible track ends. The named hint wins, then the parameter's own bounds,
// and failing both a band around whatever value it holds — so a slider is
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
  const hint = PARAM_HINTS[name] || {};
  const track = trackFor(p, opts.track || hint.track);
  const step = opts.step ?? hint.step ?? 0.01;

  const modes = h(
    'div',
    { class: 'pm-modes' },
    ...MODES.map((mode) => {
      const b = h('button', { class: p.mode === mode ? 'on' : '', title: mode }, mode[0].toUpperCase());
      b.addEventListener('click', () => onChange(switchMode(p, mode), { live: false }));
      return b;
    })
  );

  const value = h('span', { class: 'pm-val' });
  const slot = h('div', { class: 'pm-ctl' });

  if (p.mode === 'fixed') {
    const v = Number.isFinite(p.value) ? p.value : (track.lo + track.hi) / 2;
    const input = h('input', {
      type: 'range', min: String(track.lo), max: String(track.hi),
      step: String(step), value: String(v),
    });
    const read = () => ({ mode: 'fixed', value: round(parseFloat(input.value)) });
    input.addEventListener('input', () => {
      value.textContent = String(round(parseFloat(input.value)));
      onChange(read(), { live: true });
    });
    input.addEventListener('change', () => onChange(read(), { live: false }));
    value.textContent = String(round(v));
    slot.appendChild(input);
  } else if (p.mode === 'range') {
    const lo = Number.isFinite(p.min) ? p.min : track.lo;
    const hi = Number.isFinite(p.max) ? p.max : track.hi;
    // Two overlaid inputs rather than a bespoke widget, so both knobs stay
    // keyboard reachable and behave like every other slider in the app.
    const a = h('input', {
      type: 'range', min: String(track.lo), max: String(track.hi),
      step: String(step), value: String(lo),
    });
    const b = h('input', {
      type: 'range', min: String(track.lo), max: String(track.hi),
      step: String(step), value: String(hi),
    });
    const fill = h('span', { class: 'pm-fill' });
    const read = () => {
      const x = parseFloat(a.value);
      const y = parseFloat(b.value);
      return { mode: 'range', min: round(Math.min(x, y)), max: round(Math.max(x, y)) };
    };
    const paint = () => {
      const r = read();
      const span = track.hi - track.lo || 1;
      fill.style.left = `${((r.min - track.lo) / span) * 100}%`;
      fill.style.right = `${100 - ((r.max - track.lo) / span) * 100}%`;
      value.textContent = `${r.min} – ${r.max}`;
    };
    // Whichever knob is nearer the pointer takes the drag, so grabbing the
    // track never picks the one on the far side and drags it across.
    const nearest = (e) => {
      const rect = slot.getBoundingClientRect();
      const t = track.lo + ((e.clientX - rect.left) / rect.width) * (track.hi - track.lo);
      const da = Math.abs(parseFloat(a.value) - t);
      const db = Math.abs(parseFloat(b.value) - t);
      a.style.zIndex = da <= db ? '3' : '2';
      b.style.zIndex = da <= db ? '2' : '3';
    };
    slot.addEventListener('pointermove', nearest);
    for (const input of [a, b]) {
      input.addEventListener('input', () => {
        paint();
        onChange(read(), { live: true });
      });
      input.addEventListener('change', () => onChange(read(), { live: false }));
    }
    slot.append(h('span', { class: 'pm-track' }), fill, a, b);
    slot.classList.add('dual');
    paint();
  } else {
    // Free. Nothing to show, and saying so is the point: this parameter has
    // no value here because whatever places the component decides it.
    slot.appendChild(h('span', { class: 'pm-free' }, 'set by the scene'));
  }

  return h(
    'div',
    { class: `pm-row mode-${p.mode}` },
    h('label', { title: opts.label || name }, opts.label || name),
    modes,
    slot,
    value
  );
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
