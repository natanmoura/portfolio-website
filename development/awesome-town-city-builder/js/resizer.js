// Draggable panel edges.
//
// Both windows are the same shape: a panel, the thing you are looking at, and
// another panel. How much room each deserves depends entirely on what you are
// doing, and a fixed width is a guess made once on behalf of every task.
//
// Panel widths are view state, so they live in their own store and never
// touch the scene. Same rule as layer visibility: dragging a panel wider must
// not change a single thing about what gets generated or exported.
//
// The handles are real grid columns rather than elements floating over the
// gap. Overlaying them means guessing where the seam is and re-guessing every
// time the layout shifts; making them part of the grid means the seam is
// wherever the browser put it, by construction.

const HANDLE = 5;
// The viewport is the point of the window, so it is never allowed to be
// squeezed away. Without this the panels can grow until there is nothing left
// to look at, which is easy to do by accident on a laptop and confusing to
// undo, because the thing you would drag back is off under a panel.
const MIN_VIEW = 260;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function initPanelResize({ main, left, right, storeKey }) {
  if (!main) return null;

  const sides = [left, right].filter(Boolean);
  const state = {};
  for (const s of sides) state[s.key] = s.def;

  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || '{}');
    for (const s of sides) {
      const v = Number(saved[s.key]);
      if (Number.isFinite(v)) state[s.key] = clamp(v, s.min, s.max);
    }
  } catch {
    // A corrupt width preference is not worth failing a boot over.
  }

  // How wide this side may be right now, given what the other side is taking
  // and how much the viewport must keep. Narrower than the declared maximum
  // whenever the window is small, which is exactly when it matters.
  const ceilingFor = (side) => {
    const other = sides.find((s) => s !== side);
    const taken = other ? state[other.key] : 0;
    const gutters = sides.length * HANDLE;
    const room = main.clientWidth - taken - gutters - MIN_VIEW;
    return clamp(Math.min(side.max, room), side.min, side.max);
  };

  const apply = () => {
    for (const s of sides) {
      state[s.key] = clamp(state[s.key], s.min, ceilingFor(s));
      main.style.setProperty(s.var, `${Math.round(state[s.key])}px`);
    }
    main.style.gridTemplateColumns = [
      left ? `var(${left.var})` : null,
      left ? `${HANDLE}px` : null,
      '1fr',
      right ? `${HANDLE}px` : null,
      right ? `var(${right.var})` : null,
    ]
      .filter(Boolean)
      .join(' ');
  };

  const save = () => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      // Out of quota only costs the layout resetting next session.
    }
  };

  function makeHandle(side) {
    const el = document.createElement('div');
    el.className = 'pane-handle';
    el.tabIndex = 0;
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-orientation', 'vertical');
    el.title = `Drag to resize. Double click to reset.`;

    let startX = 0;
    let startW = 0;

    const move = (e) => {
      // The left panel grows as the pointer moves right, the right panel
      // grows as it moves left, so the handle always follows the pointer.
      const dx = (e.clientX - startX) * (side.side === 'left' ? 1 : -1);
      state[side.key] = clamp(startW + dx, side.min, ceilingFor(side));
      apply();
    };

    const end = (e) => {
      el.releasePointerCapture?.(e.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      document.body.classList.remove('resizing');
      save();
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startW = state[side.key];
      el.setPointerCapture?.(e.pointerId);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      // Dragging across a viewport full of text otherwise selects all of it.
      document.body.classList.add('resizing');
    });

    el.addEventListener('dblclick', () => {
      state[side.key] = side.def;
      apply();
      save();
    });

    // Keyboard, because a divider you can only reach with a pointer is a
    // divider some people cannot reach at all.
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 8;
      const dir = side.side === 'left' ? 1 : -1;
      const hi = ceilingFor(side);
      if (e.key === 'ArrowLeft') state[side.key] = clamp(state[side.key] - step * dir, side.min, hi);
      else if (e.key === 'ArrowRight') state[side.key] = clamp(state[side.key] + step * dir, side.min, hi);
      else return;
      e.preventDefault();
      apply();
      save();
    });

    return el;
  }

  // Inserted around the middle child, so the seams land exactly where the
  // panels already meet the viewport.
  const kids = [...main.children];
  const middle = kids[left ? 1 : 0];
  if (left) main.insertBefore(makeHandle(left), middle);
  if (right) main.insertBefore(makeHandle(right), middle.nextSibling);

  apply();
  // A window narrowed after the fact would otherwise leave the panels
  // overlapping what is left of the viewport.
  new ResizeObserver(() => apply()).observe(main);
  return { apply, state };
}
