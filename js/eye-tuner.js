// ── Tuning panel for the 👁️👄👁️ creature (lab.html?tune) ──
// Every slider edits the live flight values. Changes are kept in this
// browser only, and only while ?tune is in the URL, so visitors always get
// the defaults in eye-flight.js. "Copy values" puts the changed ones on the
// clipboard to paste back into chat and bake in.
(() => {
  const C = window.__eyeCreature;
  if (!C) return;
  const { P, DEFAULTS, TUNE_KEY } = C;

  const GROUPS = [
    ['Gravity and lift', [
      ['gravity', 'Gravity', 300, 1500, 10, 'How hard it is pulled down every moment. Higher means it drops faster between beats and has to work harder to stay up.'],
      ['bigLift', 'Big beat lift', 100, 1200, 10, 'How much upward speed one big slow beat adds. Higher heaves it further up before gravity takes over again.'],
      ['smallLift', 'Small beat lift', 0, 500, 5, 'Upward speed from one small quick beat. These come in bursts to keep it from sinking. At 0 they do nothing.'],
      ['bigChance', 'Big beat chance', 0, 1, 0.01, 'Odds that a beat is a big one when it is level. The odds climb on their own the further it has dropped. At 0 it mostly flutters, at 1 every beat is a heave.'],
      ['dropBoost', 'Big beats when dropping', 0, 1, 0.01, 'How much a drop raises the odds of a big beat. At 0 drops get caught with small beats only, so big ones stay rare. High turns every catch into a heave.'],
      ['eagerness', 'Eagerness', 0.3, 3, 0.05, 'How quickly it reacts to dropping below where it wants to be. Low lets it sag a long way before catching itself. High keeps it tight to its spot.'],
      ['dragY', 'Air drag up/down', 0, 4, 0.05, 'Slows vertical movement. Low feels floaty and loose, high feels heavy and damped.'],
    ]],
    ['Beat rhythm', [
      ['bigBeat', 'Big beat length', 0.1, 0.6, 0.01, 'Seconds one big beat takes, down and back up. Longer reads as slow, deliberate flaps.'],
      ['smallBeat', 'Small beat length', 0.04, 0.3, 0.01, 'Seconds one small beat takes. Shorter reads as a frantic flutter.'],
      ['restMin', 'Rest after big, min', 0, 1.5, 0.01, 'Shortest glide after a big beat before it may beat again. A bad drop still cuts the rest short.'],
      ['restMax', 'Rest after big, max', 0, 2, 0.01, 'Longest glide after a big beat. More rest means bigger drops between heaves.'],
      ['burstRest', 'Gap between small beats', 0, 0.3, 0.005, 'Pause between small beats in a burst. Near 0 the small beats run together into a buzz.'],
    ]],
    ['Wobble and tilt', [
      ['lopsided', 'Lopsided beats', 0, 1, 0.01, 'How unevenly the two wings push on each beat. At 0 both wings match and it flies level. Higher makes it lurch and roll.'],
      ['wobbleKick', 'Wobble kick', 0, 800, 5, 'How much one lopsided beat rolls the body. Higher means bigger lurches.'],
      ['wobbleSpring', 'Self-righting', 0, 60, 0.5, 'How strongly it rolls back to upright. Low lets it hang at an angle, high snaps it back.'],
      ['wobbleDamp', 'Wobble damping', 0, 20, 0.1, 'How fast a wobble settles. Low rocks back and forth several times, high settles in one swing.'],
      ['travelTilt', 'Lean into travel', 0, 30, 0.5, 'Degrees it leans toward the way it is moving at full speed.'],
      ['maxTilt', 'Max tilt', 0, 60, 1, 'The most it can ever tilt either way, in degrees.'],
    ]],
    ['Steering', [
      ['sidePush', 'Side push', 0, 2, 0.01, 'How much each beat steers it toward its goal sideways. Low drifts lazily, high darts.'],
      ['dragX', 'Air drag sideways', 0, 4, 0.05, 'Slows sideways movement. Low slides past its goal, high stops sharply.'],
      ['followLag', 'Follow delay', 0.05, 3, 0.05, 'Seconds of lag behind the cursor (or its chosen spot on touch). Higher feels like it is chasing you.'],
      ['hoverMin', 'Hover distance, min', 0, 200, 1, 'Closest it hovers to the cursor, in pixels. 0 lets it fly right onto it.'],
      ['hoverMax', 'Hover distance, max', 0, 300, 1, 'Farthest it wanders from the cursor while hovering, in pixels.'],
      ['hoverAbove', 'Hover above', -100, 150, 1, 'Pixels it prefers to sit above the cursor. Negative sits below.'],
      ['wanderEvery', 'Wander every', 0.2, 5, 0.1, 'Average seconds before it picks a new spot near the cursor to hover at.'],
    ]],
    ['Wings', [
      ['wingUp', 'Wing up angle', -30, 90, 1, 'Degrees the wings rise at the top of a full beat, from their drawn pose.'],
      ['wingDown', 'Wing down angle', -90, 30, 1, 'Degrees the wings sweep at the bottom of a beat. More negative is a deeper stroke.'],
      ['wingGlide', 'Wing glide angle', -60, 60, 1, 'Where the wings settle while gliding between beats.'],
      ['wingSize', 'Wing size', 0.4, 3, 0.05, 'Wing size relative to the face text. 1 is one emoji tall.'],
      ['pivotX', 'Pivot across', 0, 100, 1, 'Where on the wing art it hinges, left to right, in percent. Mirrored for the left wing.'],
      ['pivotY', 'Pivot down', 0, 100, 1, 'Where on the wing art it hinges, top to bottom, in percent.'],
      ['shoulderX', 'Shoulder out', -2, 2, 0.05, 'Shifts each wing away from its slot beside the face, in emoji widths. At 0 it sits right against the eye like the next emoji on the line. Negative tucks it behind the eye.'],
      ['shoulderY', 'Shoulder height', -2, 2, 0.05, 'Shifts each wing up or down from the line the face sits on, in emoji heights. At 0 it lines up with the eyes. Negative is higher.'],
    ]],
    ['Takeoff (replay to see)', [
      ['hopLines', 'Hop height', 0, 8, 0.1, 'How many text lines it pops up off its line at takeoff.'],
      ['hopHover', 'Hover before leaving', 0, 5, 0.1, 'Seconds it hovers flapping at the top of the hop before flying off.'],
    ]],
  ];

  const css = `
    .ect{position:fixed;right:12px;bottom:12px;z-index:200;width:300px;max-height:calc(100vh - 110px);overflow:auto;background:#fff;border:1px solid #ddd;border-radius:8px;font:12px/1.4 'DM Mono',monospace;color:#111;box-shadow:0 4px 16px rgba(0,0,0,.08)}
    .ect-head{position:sticky;top:0;background:#fff;display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #eee;z-index:1}
    .ect-head strong{flex:1}
    .ect button{font:inherit;padding:3px 7px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer}
    .ect button:hover{background:#f3f3f3}
    .ect-body{padding:4px 10px 10px}
    .ect.is-closed .ect-body{display:none}
    .ect h4{margin:10px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#777}
    .ect-row{display:grid;grid-template-columns:1fr 58px;gap:2px 8px;align-items:center;margin:3px 0;cursor:help}
    .ect-row label{grid-column:1/-1;display:flex;justify-content:space-between}
    .ect-row.is-changed label span:first-child{color:#c04a1a}
    .ect-row input[type=range]{grid-column:1;width:100%}
    .ect-row input[type=number]{grid-column:2;width:58px;font:inherit;padding:1px 2px}
    .ect-tip{position:fixed;z-index:201;max-width:240px;padding:7px 9px;background:#111;color:#fff;border-radius:6px;font:12px/1.45 'DM Mono',monospace;pointer-events:none;opacity:0;transition:opacity .12s}
    .ect-tip.is-on{opacity:1}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'ect';
  panel.innerHTML = `<div class="ect-head"><strong>Creature</strong>
    <button data-act="copy" data-help="Copies every value you changed from the defaults. Paste it into chat to make them the new defaults.">Copy values</button>
    <button data-act="reset" data-help="Throws away all your changes and reloads with the defaults.">Reset</button>
    <button data-act="replay" data-help="Reloads the page to watch the fade, hop and takeoff again with your values.">Replay</button>
    <button data-act="fold" data-help="Hide or show the sliders.">–</button></div><div class="ect-body"></div>`;
  const body = panel.querySelector('.ect-body');
  const fmt = (v, step) => (step >= 1 ? Math.round(v) : +v.toFixed(String(step).split('.')[1]?.length || 2));

  GROUPS.forEach(([title, items]) => {
    const h = document.createElement('h4');
    h.textContent = title;
    body.appendChild(h);
    items.forEach(([key, label, min, max, step, help]) => {
      const row = document.createElement('div');
      row.className = 'ect-row';
      row.dataset.help = help + ` Default ${fmt(DEFAULTS[key], step)}.`;
      row.innerHTML = `<label><span>${label}</span></label>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${P[key]}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${fmt(P[key], step)}">`;
      const [range, num] = row.querySelectorAll('input');
      const set = v => {
        v = +v;
        if (!isFinite(v)) return;
        P[key] = v;
        range.value = v;
        num.value = fmt(v, step);
        row.classList.toggle('is-changed', v !== DEFAULTS[key]);
        if (/^(pivot|shoulder|wingSize)/.test(key)) C.relayout();
        save();
      };
      range.addEventListener('input', () => set(range.value));
      num.addEventListener('change', () => set(num.value));
      row.classList.toggle('is-changed', P[key] !== DEFAULTS[key]);
      body.appendChild(row);
    });
  });

  function changed() {
    const out = {};
    Object.keys(DEFAULTS).forEach(k => { if (P[k] !== DEFAULTS[k]) out[k] = P[k]; });
    return out;
  }
  function save() {
    try { localStorage.setItem(TUNE_KEY, JSON.stringify(changed())); } catch (e) {}
  }

  panel.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'copy') {
      const text = 'Creature values: ' + JSON.stringify(changed());
      navigator.clipboard.writeText(text).then(() => {
        b.textContent = 'Copied';
        setTimeout(() => { b.textContent = 'Copy values'; }, 1200);
      });
    } else if (act === 'reset') {
      try { localStorage.removeItem(TUNE_KEY); } catch (e) {}
      location.reload();
    } else if (act === 'replay') {
      location.reload();
    } else if (act === 'fold') {
      panel.classList.toggle('is-closed');
      b.textContent = panel.classList.contains('is-closed') ? '+' : '–';
    }
  });

  // One shared hover overlay for every control, fed by data-help.
  const tip = document.createElement('div');
  tip.className = 'ect-tip';
  document.body.append(panel, tip);
  let over = null;
  panel.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-help]');
    if (el === over) return;
    over = el;
    if (!el) { tip.classList.remove('is-on'); return; }
    tip.textContent = el.dataset.help;
    const r = el.getBoundingClientRect();
    tip.classList.add('is-on');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, r.left - tw - 10) + 'px';
    tip.style.top = Math.min(innerHeight - th - 8, Math.max(8, r.top)) + 'px';
  });
  panel.addEventListener('mouseleave', () => { over = null; tip.classList.remove('is-on'); });
})();
