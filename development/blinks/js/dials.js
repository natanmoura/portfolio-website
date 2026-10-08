// The Look panel: a few live sliders for the blur, saved per browser.
// Each control carries its own help text, shown on hover.

const DIALS = [
  {
    key: 'bodyMin', label: 'Body blur, least', min: 0, max: 20, step: 0.5,
    help: 'The softest a body edge gets in its sharpest spots. Blur wanders between this and the most value across the screen.',
  },
  {
    key: 'bodyMax', label: 'Body blur, most', min: 0, max: 24, step: 0.5,
    help: 'The blurriest a body gets. Raising it spreads the fuzzy airbrush edge. Set it equal to the least value for an even blur.',
  },
  {
    key: 'fadeAt', label: 'Reflection fade height', min: 0.05, max: 3, step: 0.05,
    help: 'How high above the floor a reflection has fully faded to white. Small values keep only feet in the glass.',
  },
  {
    key: 'fadeSoft', label: 'Reflection fade softness', min: 0.05, max: 1, step: 0.05,
    help: 'How gradual the fade is. At one it fades all the way from the floor up. Low values keep reflections crisp until a sharp cut near the fade height.',
  },
  {
    key: 'cloud', label: 'Merge cloud blur', min: 0, max: 60, step: 1,
    help: 'How soft the spinning cloud is while two creatures merge. Higher values turn it into a hazy puff of colour.',
  },
  {
    key: 'holdWobble', label: 'Held wobble', min: 0, max: 8, step: 0.1,
    help: 'How far a creature sways and squirms while you hold it. Zero hangs still apart from your own dragging.',
  },
  {
    key: 'holdWobbleSpeed', label: 'Held wobble speed', min: 0.3, max: 8, step: 0.05,
    help: 'How quickly that sway goes back and forth. One is a slow, heavy swing.',
  },
  {
    key: 'ground', label: 'Ground blur', min: 0, max: 6, step: 0.1,
    help: 'How soft the reflections in the glass floor are. Zero is a clear mirror, higher values smear the reflections into colour.',
  },
];

// Kept from the project's working name so saved dial settings carry over.
const STORE = 'goo-garden-look';

export function setupDials(stage) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    // Older saves predate new defaults for the held wobble, so those reset once.
    if (saved && saved.v !== 2) { delete saved.holdWobble; delete saved.holdWobbleSpeed; }
    if (saved) Object.assign(stage.look, saved);
    stage.look.v = 2;
  } catch {}
  stage.applyLook();

  const root = document.getElementById('dials');
  const body = document.getElementById('dials-body');
  const toggle = document.getElementById('dials-toggle');
  toggle.addEventListener('click', () => {
    const open = root.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  for (const d of DIALS) {
    const row = document.createElement('div');
    row.className = 'dial';
    row.dataset.help = d.help;
    // The number can be typed in directly, past either end of the slider.
    row.innerHTML = `<label>${d.label} <input class="dial-num" type="number" step="any"></label><input class="dial-range" type="range" min="${d.min}" max="${d.max}" step="${d.step}">`;
    const input = row.querySelector('.dial-range');
    const out = row.querySelector('.dial-num');
    input.value = stage.look[d.key];
    out.value = stage.look[d.key];
    const set = (v) => {
      stage.look[d.key] = v;
      stage.applyLook();
      try { localStorage.setItem(STORE, JSON.stringify(stage.look)); } catch {}
    };
    input.addEventListener('input', () => { out.value = input.value; set(+input.value); });
    out.addEventListener('input', () => {
      const v = parseFloat(out.value);
      if (!Number.isFinite(v)) return;
      input.value = v;
      set(v);
    });
    out.addEventListener('keydown', (e) => { if (e.key === 'Enter') out.blur(); });
    body.appendChild(row);
  }

  const tip = document.getElementById('help-tip');
  root.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-help]');
    if (!el) return;
    tip.textContent = el.dataset.help;
    const r = el.getBoundingClientRect();
    tip.style.left = `${Math.max(8, r.left - 250)}px`;
    tip.style.top = `${r.top}px`;
    tip.classList.add('show');
  });
  root.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest?.('[data-help]')) tip.classList.remove('show');
  });
}
