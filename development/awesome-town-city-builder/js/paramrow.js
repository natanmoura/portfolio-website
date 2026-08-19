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

import { h, setChildren } from './ui.js';

const MODES = ['free', 'range', 'fixed'];
const round = (v) => Math.round(v * 1000) / 1000;

// The modes keep their data names, which are used throughout, but not their
// labels. "Free" and "Fixed" both start with F, so a row of initials made you
// read the tooltip every time to tell the two apart.
//
// The glyphs say what the control below is about to become, which is the
// thing you are actually choosing: nothing to set, a span between two knobs,
// or one exact value.
const MODE_META = {
  free: { icon: '~', label: 'Any', help: 'Any value. Whatever places this decides.' },
  range: { icon: '↔', label: 'Range', help: 'Anywhere between two bounds.' },
  fixed: { icon: '=', label: 'Exact', help: 'This value, every time.' },
};

// Parameters are stored under short keys because they are written by hand in
// json and read in tight loops. That is no reason to show them that way: w, h
// and d are only obvious once somebody has told you.
export const PARAM_LABELS = {
  w: 'Width',
  h: 'Height',
  d: 'Depth',
  x: 'X drift',
  y: 'Y drift',
  z: 'Z drift',
  scale: 'Scale',
  skewX: 'Skew X',
  skewZ: 'Skew Z',
  taper: 'Taper',
  twist: 'Twist',
  jitter: 'Jitter',
  overlap: 'Overlap',
  gap: 'Gap',
  shrink: 'Shrink',
  count: 'Count',
  cols: 'Columns',
  rows: 'Rows',
  spacing: 'Spacing',
  spacingX: 'Spacing X',
  spacingZ: 'Spacing Z',
  radius: 'Radius',
  radiusX: 'Radius X',
  radiusZ: 'Radius Z',
  spread: 'Spread',
  start: 'Start',
  turns: 'Turns',
  rise: 'Rise',
  faceOut: 'Face outward',
  flip: 'Flip copy',
  spin: 'Random spin',
  axis: 'Axis',
};

// Anything unnamed falls back to its key with the first letter raised, so a
// parameter added tomorrow reads acceptably without being listed here first.
export const labelFor = (name) =>
  PARAM_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);

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
// `track` is where the knob travels: the range you normally want. `hard` is
// the wall typing runs into, and it is deliberately far out — the slider is a
// convenience, not a ceiling, and a tool that will not let you ask for
// forty of something because someone guessed eight was plenty is a tool that
// makes the decision for you. Values past the track stretch it to reach them
// and mark the row, so going out there is possible but never accidental.
export const PARAM_HINTS = {
  count: { step: 1, track: { lo: 1, hi: 48 }, hard: [1, 256] },
  cols: { step: 1, track: { lo: 1, hi: 16 }, hard: [1, 128] },
  rows: { step: 1, track: { lo: 1, hi: 16 }, hard: [1, 128] },
  turns: { step: 0.25, track: { lo: 0, hi: 6 }, hard: [-40, 40] },
  rise: { step: 0.05, track: { lo: 0, hi: 2 }, hard: [-50, 50] },
  radius: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 400] },
  radiusX: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 400] },
  radiusZ: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 400] },
  spacing: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [-200, 200] },
  spacingX: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [-200, 200] },
  spacingZ: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [-200, 200] },
  gap: { step: 0.05, track: { lo: 0, hi: 4 }, hard: [-200, 200] },
  // A share of a part's own size, so past one it starts eating the next one.
  overlap: { step: 0.01, track: { lo: 0, hi: 0.9 }, hard: [-4, 0.99] },
  shrink: { step: 0.01, track: { lo: 0, hi: 0.6 }, hard: [-2, 0.99] },
  spread: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-8, 8] },
  start: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-8, 8] },
  // Switches. One step from off to on, so the knob has two places to be.
  faceOut: { step: 1, track: { lo: 0, hi: 1 }, hard: [0, 1] },
  flip: { step: 1, track: { lo: 0, hi: 1 }, hard: [0, 1] },
  spin: { step: 1, track: { lo: 0, hi: 1 }, hard: [0, 1] },
  axis: { step: 1, track: { lo: 0, hi: 2 }, hard: [0, 2] },
  w: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 1000] },
  h: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 1000] },
  d: { step: 0.05, track: { lo: 0, hi: 6 }, hard: [0, 1000] },
  // Modifier amounts, which are displacements and can sensibly go negative.
  x: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-100, 100] },
  y: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-100, 100] },
  z: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-100, 100] },
  scale: { step: 0.05, track: { lo: 0.1, hi: 6 }, hard: [0.001, 500] },
  skewX: { step: 0.01, track: { lo: -1, hi: 1 }, hard: [-50, 50] },
  skewZ: { step: 0.01, track: { lo: -1, hi: 1 }, hard: [-50, 50] },
  taper: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-10, 10] },
  twist: { step: 0.01, track: { lo: -2, hi: 2 }, hard: [-50, 50] },
  jitter: { step: 0.01, track: { lo: 0, hi: 1 }, hard: [-50, 50] },
};

// Failing a named hint, typing may go a long way past the track either way.
// Generous on purpose: the guess about where a slider should stop is far
// more likely to be wrong than the number someone deliberately typed.
function hardFor(hint, track) {
  if (hint?.hard) return hint.hard;
  const span = (track.hi - track.lo) || 1;
  return [track.lo - span * 8, track.hi + span * 8];
}

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

// A typed field that stretches its slider to reach whatever it is given,
// clamped only by the hard wall. Commits on change and on Enter, and puts
// itself back if handed something that is not a number.
function numField(get, set, step, hard, cls = '') {
  const decimals = Number(step) >= 1 ? 0 : String(step).split('.')[1]?.length || 2;
  const input = h('input', { type: 'number', class: `pm-num ${cls}`.trim(), step: String(step) });
  const show = (v) => {
    input.value = String(Number(Number(v).toFixed(decimals)));
  };
  show(get());
  const commit = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v)) return show(get());
    const next = Math.min(hard[1], Math.max(hard[0], v));
    show(next);
    set(next);
  };
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    // The editor listens for keys globally; a number being typed is not a
    // shortcut.
    e.stopPropagation();
  });
  return { el: input, show };
}

export function paramRow(name, param, onChange, opts = {}) {
  const p = normalise(param);
  const hint = PARAM_HINTS[name] || {};
  const track = trackFor(p, opts.track || hint.track);
  const step = opts.step ?? hint.step ?? 0.01;
  const hard = opts.hard || hardFor(hint, track);
  // Whether a value has been pushed past where the knob normally travels.
  // Worth marking, because a row sitting well outside its usual range is
  // usually the reason something looks wrong three edits later.
  const beyond = (v) => v < track.lo - 1e-9 || v > track.hi + 1e-9;

  const modes = h(
    'div',
    { class: 'pm-modes' },
    ...MODES.map((mode) => {
      const meta = MODE_META[mode];
      const b = h(
        'button',
        { class: `${p.mode === mode ? 'on' : ''} m-${mode}`.trim(), title: `${meta.label}. ${meta.help}` },
        meta.icon
      );
      b.addEventListener('click', () => onChange(switchMode(p, mode), { live: false }));
      return b;
    })
  );

  const value = h('span', { class: 'pm-val' });
  const slot = h('div', { class: 'pm-ctl' });
  // The row exists before the controls do, so they can mark it extended as
  // they are built rather than needing a second pass afterwards.
  const shownName = opts.label || labelFor(name);
  const row = h(
    'div',
    { class: `pm-row mode-${p.mode}` },
    // The key stays in the tooltip, since that is what you need when reading
    // the json or the code, and the readable name is what you need here.
    h('label', { title: `${shownName} (${name})` }, shownName),
    modes,
    slot,
    value
  );
  let loField = null;
  let hiField = null;

  if (p.mode === 'fixed') {
    const v = Number.isFinite(p.value) ? p.value : (track.lo + track.hi) / 2;
    const input = h('input', {
      type: 'range',
      min: String(Math.min(track.lo, v)),
      max: String(Math.max(track.hi, v)),
      step: String(step), value: String(v),
    });
    const read = () => ({ mode: 'fixed', value: round(parseFloat(input.value)) });

    const field = numField(
      () => parseFloat(input.value),
      (n) => {
        // Stretch the track so the knob can still reach a typed extreme,
        // rather than silently clamping the number back to the slider.
        input.min = String(Math.min(track.lo, n));
        input.max = String(Math.max(track.hi, n));
        input.value = String(n);
        row.classList.toggle('extended', beyond(n));
        onChange({ mode: 'fixed', value: round(n) }, { live: false });
      },
      step,
      hard
    );

    input.addEventListener('input', () => {
      const n = parseFloat(input.value);
      field.show(n);
      row.classList.toggle('extended', beyond(n));
      onChange(read(), { live: true });
    });
    input.addEventListener('change', () => onChange(read(), { live: false }));
    slot.appendChild(input);
    setChildren(value, field.el);
    // Marked at build time as well as on edit: the row is rebuilt from the
    // stored value after every change, so a value that was pushed out stays
    // visibly out rather than looking ordinary again on the next redraw.
    row.classList.toggle('extended', beyond(v));
  } else if (p.mode === 'range') {
    const lo = Number.isFinite(p.min) ? p.min : track.lo;
    const hi = Number.isFinite(p.max) ? p.max : track.hi;
    // The track is widened to hold the stored values *before* the inputs are
    // made. A range input clamps its value to its max the moment it is set,
    // so building at the nominal track would throw away an overridden bound
    // on every redraw — which is every keystroke that commits.
    const t0lo = String(Math.min(track.lo, lo, hi));
    const t0hi = String(Math.max(track.hi, lo, hi));
    // Two overlaid inputs rather than a bespoke widget, so both knobs stay
    // keyboard reachable and behave like every other slider in the app.
    const a = h('input', {
      type: 'range', min: t0lo, max: t0hi,
      step: String(step), value: String(lo),
    });
    const b = h('input', {
      type: 'range', min: t0lo, max: t0hi,
      step: String(step), value: String(hi),
    });
    const fill = h('span', { class: 'pm-fill' });
    const read = () => {
      const x = parseFloat(a.value);
      const y = parseFloat(b.value);
      return { mode: 'range', min: round(Math.min(x, y)), max: round(Math.max(x, y)) };
    };
    // Both knobs share one track, and either end may have been typed out
    // past where the knob normally travels, so the drawn span is measured
    // against the stretched track rather than the nominal one.
    const ends = () => ({ lo: parseFloat(a.min), hi: parseFloat(a.max) });
    const paint = () => {
      const r = read();
      const t = ends();
      const span = t.hi - t.lo || 1;
      fill.style.left = `${((r.min - t.lo) / span) * 100}%`;
      fill.style.right = `${100 - ((r.max - t.lo) / span) * 100}%`;
      row.classList.toggle('extended', beyond(r.min) || beyond(r.max));
      if (loField) loField.show(r.min);
      if (hiField) hiField.show(r.max);
    };

    // Typing either end stretches the shared track to hold both. The widening
    // has to happen *before* the value is assigned: a range input clamps
    // whatever it is given to its current max, so setting the number first
    // would quietly throw away exactly the overshoot being asked for.
    const stretch = (incoming) => {
      const vals = [parseFloat(a.value), parseFloat(b.value)];
      if (Number.isFinite(incoming)) vals.push(incoming);
      const lo = String(Math.min(track.lo, ...vals));
      const hi = String(Math.max(track.hi, ...vals));
      a.min = lo; b.min = lo;
      a.max = hi; b.max = hi;
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

    loField = numField(
      () => Math.min(parseFloat(a.value), parseFloat(b.value)),
      (n) => {
        stretch(n);
        a.value = String(n);
        paint();
        onChange(read(), { live: false });
      },
      step,
      hard,
      'lo'
    );
    hiField = numField(
      () => Math.max(parseFloat(a.value), parseFloat(b.value)),
      (n) => {
        stretch(n);
        b.value = String(n);
        paint();
        onChange(read(), { live: false });
      },
      step,
      hard,
      'hi'
    );

    slot.append(h('span', { class: 'pm-track' }), fill, a, b);
    slot.classList.add('dual');
    stretch();
    setChildren(value, loField.el, hiField.el);
    paint();
    row.classList.toggle('extended', beyond(lo) || beyond(hi));
  } else {
    // Free. Nothing to show, and saying so is the point: this parameter has
    // no value here because whatever places the component decides it.
    slot.appendChild(h('span', { class: 'pm-free' }, 'set by the scene'));
  }

  return row;
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
