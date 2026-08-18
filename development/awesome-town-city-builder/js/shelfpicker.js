// The shelf, as an overlay.
//
// Picking which components a role may use is the same act as browsing the
// library, so it is the same surface: cards with previews, not a column of
// checkbox labels. Names alone stop being enough the moment the library has
// two dozen entries and half of them are assemblies whose names describe
// what they are for rather than what they look like.
//
// It commits on close rather than per click, so a run of selections is one
// change to undo instead of nine.

import { h, setChildren } from './ui.js';
import { renderThumb } from './thumbs.js';
import { isAssembly } from './library.js';

let overlay = null;

export function openShelfPicker({ title, help, candidates, selected, library, onCommit }) {
  close();

  const chosen = new Set(selected);

  const count = h('span', { class: 'sp-count' });
  const paint = () => {
    count.textContent = `${chosen.size} of ${candidates.length} in use`;
  };

  const card = (doc) => {
    const on = chosen.has(doc.id);
    const el = h(
      'button',
      { class: `sp-card${on ? ' on' : ''}`, title: doc.id },
      h('img', { src: renderThumb(doc, library, 3), alt: doc.label }),
      h('span', { class: 'sp-name' }, doc.label),
      isAssembly(doc) ? h('span', { class: 'sp-badge' }, 'assembly') : null,
      h('span', { class: 'sp-tick' }, on ? '✓' : '')
    );
    el.addEventListener('click', () => {
      // Never let the last one out: a role with nothing in it has no way to
      // build anything, and silently falling back would hide the mistake.
      if (chosen.has(doc.id) && chosen.size === 1) return;
      if (chosen.has(doc.id)) chosen.delete(doc.id);
      else chosen.add(doc.id);
      el.classList.toggle('on', chosen.has(doc.id));
      el.querySelector('.sp-tick').textContent = chosen.has(doc.id) ? '✓' : '';
      paint();
    });
    return el;
  };

  const all = h('button', { class: 'btn small' }, 'All');
  all.addEventListener('click', () => {
    candidates.forEach((d) => chosen.add(d.id));
    redraw();
  });
  const none = h('button', { class: 'btn small' }, 'None but one');
  none.addEventListener('click', () => {
    const keep = candidates.find((d) => chosen.has(d.id)) || candidates[0];
    chosen.clear();
    if (keep) chosen.add(keep.id);
    redraw();
  });

  const grid = h('div', { class: 'sp-grid' });
  const redraw = () => {
    setChildren(grid, ...candidates.map(card));
    paint();
  };

  const done = h('button', { class: 'btn primary' }, 'Done');
  done.addEventListener('click', () => {
    // Kept in the candidate order rather than click order, so the wheel does
    // not reshuffle itself every time something is switched on.
    onCommit(candidates.filter((d) => chosen.has(d.id)).map((d) => d.id));
    close();
  });

  const panel = h(
    'div',
    { class: 'sp-panel' },
    h(
      'div',
      { class: 'sp-head' },
      h('h2', {}, title),
      count,
      h('span', { class: 'grow' }),
      all,
      none,
      done
    ),
    help ? h('p', { class: 'sp-help' }, help) : null,
    grid
  );

  overlay = h('div', { class: 'sp-overlay' }, panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  redraw();

  document.addEventListener('keydown', onKey);
  return overlay;
}

function onKey(e) {
  if (e.key === 'Escape') close();
}

export function close() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', onKey);
}
