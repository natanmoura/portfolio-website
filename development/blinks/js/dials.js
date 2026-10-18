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
  {
    tab: 'type', key: 'textSize', label: 'Text size', min: 12, max: 48, step: 1,
    help: 'How big the welcome text is, in pixels.',
  },
  {
    tab: 'type', key: 'textAngle', label: 'Text angle', min: -30, max: 30, step: 0.5,
    help: 'Turns the whole block of text, in degrees. Positive tilts it clockwise, negative counter-clockwise. Zero sits level.',
  },
  {
    tab: 'type', key: 'lineAngle', label: 'Line zigzag', min: -15, max: 15, step: 0.5,
    help: 'Tilts each line a little on top of the text angle, alternating direction: the first and third lines one way, the second line the other. Zero keeps the lines parallel.',
  },
  {
    tab: 'type', key: 'textDelay', label: 'Start delay', min: 0, max: 5, step: 0.1,
    help: 'Seconds after the page opens before the first letter appears. Use Replay to see it from the start.',
  },
  {
    tab: 'type', key: 'typeSpeed', label: 'Typing speed', min: 4, max: 80, step: 1,
    help: 'Letters typed per second.',
  },
  {
    tab: 'type', key: 'lineGap', label: 'Pause between lines', min: 0, max: 3, step: 0.05,
    help: 'Seconds to wait after a line finishes before the next one starts typing.',
  },
  {
    tab: 'type', key: 'popTime', label: 'Pop time', min: 0.02, max: 0.6, step: 0.01,
    help: 'How long each letter takes to pop in, in seconds. Small values snap in hard.',
  },
  {
    tab: 'type', key: 'popOver', label: 'Pop overshoot', min: 1, max: 2, step: 0.01,
    help: 'How big a letter swells as it pops in before settling. One is no overshoot.',
  },
  {
    tab: 'type', key: 'floatAmp', label: 'Float height', min: 0, max: 20, step: 0.5,
    help: 'How far letters bob up and down, in pixels.',
  },
  {
    tab: 'type', key: 'floatSpeed', label: 'Float speed', min: 0, max: 6, step: 0.05,
    help: 'How quickly the bobbing, drifting and tilting move. Low values feel heavy and underwater.',
  },
  {
    tab: 'type', key: 'driftAmp', label: 'Side drift', min: 0, max: 15, step: 0.5,
    help: 'How far letters sway side to side, in pixels.',
  },
  {
    tab: 'type', key: 'tilt', label: 'Tilt', min: 0, max: 30, step: 0.5,
    help: 'How far letters rock back and forth, in degrees.',
  },
  {
    tab: 'type', key: 'ripple', label: 'Ripple', min: 0, max: 2, step: 0.01,
    help: 'How out of step neighbouring letters are. Zero moves each line as one block. Small values send a gentle wave along the line, large values make every letter move on its own.',
  },
];

// Kept from the project's working name so saved dial settings carry over.
const STORE = 'goo-garden-look';

// The Look panel is a tuning tool, not part of the experience. It only
// appears in edit mode (open the page with ?edit). Outside edit mode the
// defaults in stage.js are used and saved tweaks are ignored, so what you see
// is exactly what ships.
const TABS = [['scene', 'Scene'], ['type', 'Type']];

export function setupDials(stage, onReplay) {
  if (!new URLSearchParams(location.search).has('edit')) {
    stage.applyLook();
    return;
  }
  document.getElementById('dials').hidden = false;
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

  // Tabs split the scene dials from the type dials.
  const tabs = document.createElement('div');
  tabs.className = 'dial-tabs';
  body.appendChild(tabs);
  let tab = 'scene';
  try { tab = localStorage.getItem(STORE + '-tab') || 'scene'; } catch {}
  const replay = document.createElement('button');
  replay.className = 'dial-replay';
  replay.textContent = 'Replay text';
  replay.addEventListener('click', () => onReplay?.());
  const show = () => {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
    for (const r of body.querySelectorAll('.dial')) r.hidden = r.dataset.tab !== tab;
    replay.hidden = tab !== 'type';
  };
  for (const [key, name] of TABS) {
    const b = document.createElement('button');
    b.dataset.tab = key;
    b.textContent = name;
    b.addEventListener('click', () => { tab = key; try { localStorage.setItem(STORE + '-tab', tab); } catch {} show(); });
    tabs.appendChild(b);
  }

  for (const d of DIALS) {
    const row = document.createElement('div');
    row.className = 'dial';
    row.dataset.tab = d.tab || 'scene';
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

  body.appendChild(replay);
  show();

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
