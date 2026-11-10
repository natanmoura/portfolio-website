// ── Projects drum ──
// The gallery rolls on an imaginary many-sided drum turning about the
// horizontal axis, like the iOS date picker. Each row of cards is one flat
// side of it. The row in the middle faces you flat. Rows above and below turn
// away with perspective and fade as they go over the top or under the
// bottom. The drum is sized so its lower curve bottoms out above the dock
// (and its upper curve below the header) and never passes behind either.
// It always comes to rest with one row square to the screen.
// Drag, flick, wheel, trackpad and keys all turn it. Remove the script tag
// from projects.html to get the plain scrolling grid back.
(function () {
  const gallery = document.getElementById('gallery');
  const main = document.getElementById('main-content');
  const work = document.getElementById('work');
  if (!gallery || !main || !work) return;
  const items = [...gallery.querySelectorAll('.gallery-item')];
  if (!items.length) return;
  const intro = work.querySelector('.page-intro');
  const root = document.documentElement;

  // Feel.
  const FLICK_TAU = 0.3;       // s of momentum a released flick carries on for
  const SPRING_W = 13;         // spring stiffness, as angular frequency (rad/s)
  const SPRING_ZETA = 0.62;    // under 1 overshoots: the springy settle
  const EDGE_GIVE = 0.6;       // rows you can pull past either end
  const PERSPECTIVE = 2.6;     // camera distance, in half-heights of the stage
  const STEP_DEG = 30;        // turn between rows; the outer pair sit at twice this, near edge on
  const DOF_MAX = 15;          // CSS-blur fallback: px radius the blur levels off toward
  // Real depth of field (js/drum-gl.js). The lens aperture: a point the
  // camera's own focus distance behind the middle row blurs into a disc
  // this many px across its radius, on the card. Larger is shallower focus.
  const APERTURE = 120;
  const MAX_BLUR = 22;         // px, the most blur anything gets, on the card (32 at most)

  root.classList.add('drum');
  const glr = window.createDrumGL ? window.createDrumGL(gallery) : null;
  if (glr) gallery.classList.add('drum--gl');

  const MIN = 0;               // the first row is as far up as it goes
  let MAX = 0;
  let cols = 0;
  let facets = [];             // facets[k] is side MIN + k
  let pitch = 300, theta = 0.4, apothem = 600, rowH = 200;

  let pos = 0;                 // which side faces you, in rows (fractional while moving)
  let raw = 0;                 // unclamped position under a finger or trackpad
  let vel = 0;                 // rows per second
  let target = 0;
  let mode = 'rest';           // rest | hold | spring | coast | fling
  let coastTau = 0.3;
  let raf = 0, lastT = 0;
  const moving = () => mode === 'spring' || mode === 'coast' || mode === 'fling';

  // ── The "have a scroll" line ──
  // Sits on its own, flat, in the empty space above the first row. It shows
  // while you're on the first row and goes for good the moment you scroll:
  // after that you know how.
  const hint = document.createElement('div');
  hint.className = 'drum-hint';
  hint.setAttribute('aria-hidden', 'true');
  if (intro) hint.appendChild(intro);
  gallery.appendChild(hint);
  // Testing switch: true forgets the visitor has scrolled on every load,
  // so the line always comes back. Keep it false in anything committed.
  const FORGET_LEARNED = false;
  let learned = false;
  try {
    if (FORGET_LEARNED) localStorage.removeItem('drumScrollLearned');
    learned = localStorage.getItem('drumScrollLearned') === '1';
  } catch (e) {}
  let touched = false;         // the visitor has turned the drum themselves
  function updateHint() {
    if (!learned && touched && Math.abs(pos - MIN) > 0.15) {
      learned = true;
      try { localStorage.setItem('drumScrollLearned', '1'); } catch (e) {}
      afterLearned();
    }
    hint.classList.toggle('is-shown', !!intro && !learned && !revealing && Math.abs(pos - MIN) < 0.5);
  }
  function userInput() {
    touched = true;
    if (revealing) { revealing = false; scheduleDock(600); }
  }

  // ── The opening ──
  // When the wizard intro plays, the projects arrive as the yellow fades:
  // the drum is already spinning up from the second-last row, runs all the
  // way to the top and bounces off it. That's when the scroll line appears.
  // A beat later the dock's buttons bob up one at a time, like floats
  // surfacing.
  // The opening spin rolls off gently, picks up speed through the middle
  // rows and eases in at the top. Its length grows with the number of rows
  // it covers, within these limits.
  const SPIN_START = 2.5;      // rows/s as it sets off
  const SPIN_ARRIVE = 1.2;     // rows/s left at the top: enough for a small bounce
  const SPIN_S_PER_ROW = 0.1, SPIN_MIN_S = 0.9, SPIN_MAX_S = 1.9;
  let spin = null;
  const DOCK_BEAT = 500;       // ms after you've learned to scroll, if sooner
  const DOCK_AFTER_BOUNCE = 700; // ms after the bounce off the top
  const introOverlay = document.getElementById('introOverlay');
  let revealing = false, revealStarted = false;
  let dockWaiting = !!introOverlay, dockDue = Infinity, dockTimer = 0;
  if (dockWaiting) document.body.classList.add('dock-await');

  function scheduleDock(ms) {
    if (!dockWaiting) return;
    const due = performance.now() + ms;
    if (due >= dockDue) return;
    dockDue = due;
    clearTimeout(dockTimer);
    dockTimer = setTimeout(revealDock, ms);
  }

  // Each button surfaces in turn, overshoots, and settles with a bob or
  // two, the four of them a rolling wave about a second and a half long.
  // (Each button's own bob is dock-bob in style.css.)
  function revealDock() {
    if (!dockWaiting) return;
    dockWaiting = false;
    const links = [...document.querySelectorAll('.dock-link')];
    links.forEach((a, i) => {
      a.style.animationDelay = (i * 0.225) + 's';
      a.classList.add('is-bobbing');
    });
    document.body.classList.remove('dock-await');
    setTimeout(() => links.forEach(a => { a.classList.remove('is-bobbing'); a.style.animationDelay = ''; }), 2000);
  }

  function hitTop() {
    revealing = false;
    updateHint();
    scheduleDock(DOCK_AFTER_BOUNCE);
  }

  function afterLearned() {
    scheduleDock(DOCK_BEAT);
  }

  function startReveal() {
    if (revealStarted) return;
    revealStarted = true;
    if (!on || MAX < 1) { skipReveal(); return; }
    revealing = true;
    pos = raw = Math.max(MIN, MAX - 1);
    const rows = pos - MIN;
    spin = { from: pos, t0: performance.now(), dur: Math.min(SPIN_MAX_S, Math.max(SPIN_MIN_S, 0.4 + rows * SPIN_S_PER_ROW)) * 1000 };
    vel = -SPIN_START;
    mode = 'fling';
    run();
  }

  // No intro this time (already seen, or skipped): just be there.
  function skipReveal() {
    revealStarted = true;
    revealing = false;
    dockWaiting = false;
    clearTimeout(dockTimer);
    document.body.classList.remove('dock-await');
    if (mode === 'fling' || pos !== MIN) { stop(); pos = raw = target = MIN; vel = 0; mode = 'rest'; }
    if (on) render();
  }

  // The spin starts as the yellow starts to lift, gently enough that the
  // second-last row is still where it begins while the yellow clears.
  document.addEventListener('introFading', startReveal);
  document.addEventListener('introDone', () => { if (!revealStarted) skipReveal(); });

  function colsFor() {
    if (matchMedia('(max-width: 720px)').matches) return 1;
    if (matchMedia('(max-width: 1000px)').matches) return 2;
    return 3;
  }

  // Regroup the cards into one side per row. Keeps the card you were on in
  // the middle when the row length changes.
  function build() {
    const c = colsFor();
    if (c === cols) return;
    const first = cols ? Math.max(0, Math.round(pos)) * cols : 0;
    cols = c;
    facets.forEach(f => f.remove());
    facets = [];
    // The grid's rise-in (each card fading up as it first scrolls into
    // view) doesn't suit the drum: cards spinning past in the opening
    // would still be invisible. On the drum every card is simply there.
    items.forEach(it => {
      it.style.transitionDelay = '';
      it.classList.add('gallery-item--visible', 'gallery-item--settled');
    });
    for (let i = 0; i < items.length; i += cols) {
      const f = document.createElement('div');
      f.className = 'drum-facet';
      items.slice(i, i + cols).forEach(it => f.appendChild(it));
      gallery.appendChild(f);
      facets.push(f);
    }
    MAX = facets.length - 1 + MIN;
    active = -1;
    pos = raw = target = Math.min(MAX, Math.floor(first / cols));
    vel = 0;
    mode = 'rest';
  }

  // Where a point on the drum's rim lands on screen, below the centre line.
  function projected(r, phi, p, a) {
    return r * Math.sin(phi) * p / (p + a - r * Math.cos(phi));
  }

  function layout() {
    if (!work.clientWidth) return;
    build();
    const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    const gap = 2 * rem;
    const cs = getComputedStyle(work);
    const avail = work.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

    // The drum fits in the clear band between the header (when shown) and
    // the top of the dock, centred in it.
    let top = 0, bottom = innerHeight;
    const hdr = document.querySelector('.site-header');
    if (hdr && getComputedStyle(hdr).display !== 'none') top = Math.max(0, hdr.getBoundingClientRect().bottom);
    const dock = document.querySelector('.dock');
    if (dock && getComputedStyle(dock).display !== 'none') bottom = dock.getBoundingClientRect().top;
    const half = Math.max(80, (bottom - top) / 2 - 12);
    const cy = (top + bottom) / 2;

    // Cards as wide as the grid would make them, unless that makes a row
    // too tall for the band, as on a phone turned sideways.
    // Each row turns a fixed angle from the next, so five rows always
    // show: the middle one, one either side, and a thin one going over
    // the edge at the top and bottom. The drum's size follows from the
    // card size. If its rim would reach past the header or the dock, the
    // cards shrink until it fits.
    theta = STEP_DEG * Math.PI / 180;
    const p = PERSPECTIVE * half;
    let cardW = (avail - gap * (cols - 1)) / cols;
    for (let n = 0; n < 60; n++) {
      const pt = cardW * 9 / 16 + gap;
      const a = pt / (2 * Math.tan(theta / 2));
      const r = a / Math.cos(theta / 2);
      let max = 0;
      for (let phi = 0; phi <= Math.min(2.5 * theta, Math.PI / 2 + theta / 2); phi += 0.01) {
        max = Math.max(max, projected(r, phi, p, a));
      }
      if (max <= half) break;
      cardW *= 0.97;
    }
    const cardH = cardW * 9 / 16;
    pitch = cardH + gap;
    rowH = cardH;
    apothem = pitch / (2 * Math.tan(theta / 2));

    gallery.style.setProperty('--card-w', cardW + 'px');
    gallery.style.setProperty('--drum-cols', cols);
    gallery.style.setProperty('--drum-cy', cy + 'px');
    gallery.style.setProperty('--drum-gap', gap + 'px');
    gallery.style.perspective = p + 'px';
    gallery.style.perspectiveOrigin = `50% ${cy}px`;
    // The scroll line goes where a row above the first one would sit.
    hint.style.top = (cy - projected(apothem, theta, p, apothem)) + 'px';
    if (glr) {
      glr.resize({ p, cy, apothem, aperture: APERTURE, maxBlur: MAX_BLUR, cardW, cardH });
      glr.warm(items);
    }
    render();
  }

  function render() {
    const deg = 180 / Math.PI;
    for (let k = 0; k < facets.length; k++) {
      const el = facets[k];
      const phi = (pos - (k + MIN)) * theta;
      const t = Math.abs(phi) / (Math.PI / 2);
      // Past square-on to the camera a side is gone. Taking it out of
      // layout also tells the video observers its clips are off screen.
      if (t >= 1) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      if (el.style.display === 'none') el.style.display = '';
      el.style.transform =
        `translate(-50%, -50%) translateZ(${-apothem}px) rotateX(${(phi * deg).toFixed(3)}deg) translateZ(${apothem}px)`;
      // Depth of field. The camera is focused on the plane of the middle
      // row, and anything nearer or further goes soft in proportion to its
      // distance from that plane. A side is flat but tilted, so its top and
      // bottom edges sit at different depths: each edge gets its own blur
      // and the filter grades between them down the side.
      const zc = apothem * (Math.cos(phi) - 1);
      const lean = rowH / 2 * Math.sin(phi);
      const rTop = coc(zc - lean), rBot = coc(zc + lean);
      if (!glr) el.style.filter = Math.max(rTop, rBot) > 0.3 ? lensFor(k, rTop, rBot) : '';
      // Only the last sliver before edge-on fades, so a side never pops
      // out of existence.
      el.style.opacity = t < 0.9 ? '' : ((1 - t) / 0.1).toFixed(3);
      el.style.zIndex = 100 - Math.round(t * 90);
      const far = t > FAR;
      if (far !== el.classList.contains('drum-facet--far')) el.classList.toggle('drum-facet--far', far);
    }
    // Rows whizzing past in the opening spin don't start their clips.
    if (mode !== 'fling') setActive(Math.round(pos) - MIN);
    updateHint();
  }

  // Only the row in the middle plays. The others pause where they are.
  // wantsPlay, thumbs and playVideo belong to main.js.
  let active = -1;
  function setActive(k) {
    if (k === active) return;
    active = k;
    facets.forEach((f, i) => {
      const idle = i !== k;
      f.classList.toggle('drum-facet--idle', idle);
      f.querySelectorAll('video').forEach(v => {
        if (idle) { wantsPlay.delete(v); v.pause(); }
        else if (on && f.style.display !== 'none') { wantsPlay.add(v); thumbs.attach(v); playVideo(v); }
      });
    });
  }

  // Blur radius for a point this far in front of or behind the focal plane.
  // Grows with distance and levels off toward DOF_MAX, like a lens's circle
  // of confusion. It is applied in the side's own flat coordinates, so the
  // perspective shrinks it further for distant sides, as it would on film.
  function coc(z) {
    const d = Math.abs(z), d0 = apothem * 0.13;
    return DOF_MAX * d / (d + d0);
  }

  // ── Lens blur ──
  // CSS blur is a Gaussian, which smears. A camera lens out of focus spreads
  // each point into a disc the shape of its aperture instead, so edges go
  // soft but stay even, and bright spots bloom. This averages copies of the
  // side shifted across a hexagonal aperture, working in linear light so
  // highlights spread the way real light does. Each side's filter makes
  // one such blur for its top edge's depth and one for its bottom edge's,
  // then blends from one to the other down the side.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const TAPS = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    TAPS.push([Math.cos(a), Math.sin(a)]);
  }
  // Top-to-bottom ramp over the side itself. The filter region runs from
  // 30% above the side to 30% below it, so the ramp starts and ends there.
  const RAMP = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' preserveAspectRatio='none'>" +
    "<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0.1875' stop-opacity='0'/><stop offset='0.8125' stop-opacity='1'/></linearGradient>" +
    "<rect width='1' height='1' fill='url(#g)'/></svg>");
  const lensDefs = document.createElementNS(SVGNS, 'svg');
  lensDefs.setAttribute('aria-hidden', 'true');
  lensDefs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(lensDefs);
  const lenses = [];

  function svg(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function gamma(parent, inp, exp, result) {
    const t = svg('feComponentTransfer', { in: inp, result }, parent);
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(f => svg(f, { type: 'gamma', exponent: exp }, t));
  }

  // One aperture blur of `inp`, written to `out`. Returns its parts so the
  // radius can be changed later.
  function aperture(f, inp, tag, out) {
    const offs = TAPS.map((_, i) => {
      const o = svg('feOffset', { in: inp, result: tag + 'o' + i }, f);
      if (i) svg('feComposite', { in: i === 1 ? tag + 'o0' : tag + 'a' + (i - 1), in2: tag + 'o' + i,
        operator: 'arithmetic', k1: 0, k2: i / (i + 1), k3: 1 / (i + 1), k4: 0, result: tag + 'a' + i }, f);
      return o;
    });
    const soft = svg('feGaussianBlur', { in: tag + 'a' + (TAPS.length - 1), result: out }, f);
    return { offs, soft, r: -1 };
  }

  function setAperture(A, r) {
    if (Math.abs(A.r - r) < 0.05) return;
    A.r = r;
    A.offs.forEach((o, i) => {
      o.setAttribute('dx', (TAPS[i][0] * r).toFixed(2));
      o.setAttribute('dy', (TAPS[i][1] * r).toFixed(2));
    });
    // Just enough smoothing to melt the copies into one disc.
    A.soft.setAttribute('stdDeviation', (r * 0.38).toFixed(2));
  }

  function lensFor(k, rTop, rBot) {
    let L = lenses[k];
    if (!L) {
      const f = svg('filter', { id: 'drum-lens-' + k, x: '-15%', y: '-30%', width: '130%', height: '160%',
        'color-interpolation-filters': 'sRGB' }, lensDefs);
      gamma(f, 'SourceGraphic', 2.2, 'lin');
      const top = aperture(f, 'lin', 't', 'top');
      const bot = aperture(f, 'lin', 'b', 'bot');
      const ramp = svg('feImage', { preserveAspectRatio: 'none', result: 'ramp' }, f);
      ramp.setAttribute('href', RAMP);
      ramp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', RAMP);
      svg('feComposite', { in: 'bot', in2: 'ramp', operator: 'in', result: 'botPart' }, f);
      svg('feComposite', { in: 'top', in2: 'ramp', operator: 'out', result: 'topPart' }, f);
      svg('feComposite', { in: 'topPart', in2: 'botPart', operator: 'arithmetic',
        k1: 0, k2: 1, k3: 1, k4: 0, result: 'mix' }, f);
      gamma(f, 'mix', 1 / 2.2, 'out');
      L = lenses[k] = { top, bot, url: `url(#drum-lens-${k})` };
    }
    setAperture(L.top, rTop);
    setAperture(L.bot, rBot);
    return L.url;
  }

  // Sides turned well away show their clip's poster frame instead of the
  // clip. Hiding the <video> lets main.js's observers unload it, which keeps
  // a phone to about five decoders, the most iOS copes with.
  const FAR = 0.45;
  items.forEach(it => {
    const v = it.querySelector('video');
    if (v && v.poster) v.parentNode.style.backgroundImage = `url("${v.poster}")`;
  });

  const clamp = x => Math.max(MIN, Math.min(MAX, x));

  // Past either end the drum gives a little, harder the further you pull.
  function rubber(x) {
    if (x < MIN) { const d = MIN - x; return MIN - EDGE_GIVE * d / (d + EDGE_GIVE); }
    if (x > MAX) { const d = x - MAX; return MAX + EDGE_GIVE * d / (d + EDGE_GIVE); }
    return x;
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (mode === 'coast') {
      const k = Math.exp(-dt / coastTau);
      pos = target - (target - pos) * k;
      vel = (target - pos) / coastTau;
      if (Math.abs(target - pos) < 0.001) { pos = target; vel = 0; mode = 'rest'; }
    } else if (mode === 'fling') {
      // The opening spin, one smooth curve (a cubic Hermite) from the
      // second-last row to the first: leaving at SPIN_START, arriving at
      // SPIN_ARRIVE, the spring then taking over for the bounce.
      const T = spin.dur / 1000, s = Math.min(1, (now - spin.t0) / spin.dur);
      const m0 = -SPIN_START * T, m1 = -SPIN_ARRIVE * T;
      const s2 = s * s, s3 = s2 * s;
      pos = (2 * s3 - 3 * s2 + 1) * spin.from + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * MIN + (s3 - s2) * m1;
      vel = ((6 * s2 - 6 * s) * spin.from + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * MIN + (3 * s2 - 2 * s) * m1) / T;
      if (s >= 1) { pos = MIN; vel = -SPIN_ARRIVE; mode = 'spring'; target = MIN; hitTop(); }
    } else if (mode === 'spring') {
      const steps = Math.ceil(dt / (1 / 240));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        const acc = -SPRING_W * SPRING_W * (pos - target) - 2 * SPRING_ZETA * SPRING_W * vel;
        vel += acc * h;
        pos += vel * h;
      }
      if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.01) { pos = target; vel = 0; mode = 'rest'; }
    }
    raw = pos;
    render();
    raf = moving() ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Head for a row. A flick already heading there glides in on its own
  // momentum. Anything else springs, with a little overshoot.
  function goTo(t) {
    target = clamp(Math.round(t));
    const d = target - pos;
    const inside = pos >= MIN && pos <= MAX;
    mode = 'spring';
    if (inside && Math.abs(vel) > 1.2 && Math.sign(vel) === Math.sign(d)) {
      const tau = d / vel;
      if (tau > 0.08 && tau < 0.7) { coastTau = tau; mode = 'coast'; }
    }
    run();
  }

  // Let go: the wheel carries on for a moment in the direction it was
  // thrown, then settles on the nearest row from there.
  function release(tau) {
    goTo(pos + vel * tau);
  }

  // Velocity from the last tenth of a second of movement.
  let samples = [];
  function sample(x) {
    const now = performance.now();
    samples.push([now, x]);
    while (samples.length > 2 && now - samples[0][0] > 100) samples.shift();
  }
  function measuredVel() {
    if (samples.length < 2) return 0;
    const [t0, x0] = samples[0], [t1, x1] = samples[samples.length - 1];
    if (performance.now() - t1 > 60) return 0;   // held still before letting go
    return t1 > t0 ? (x1 - x0) / ((t1 - t0) / 1000) : 0;
  }

  // ── Drag and flick ──
  let drag = null;
  let swallowClick = false;
  gallery.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !on) return;
    userInput();
    const wasMoving = moving();
    stop();
    mode = 'hold';
    vel = 0;
    raw = pos;
    drag = { id: e.pointerId, y: e.clientY, raw0: raw, moved: false, wasMoving };
    samples = [];
    sample(pos);
  });
  gallery.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    let dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) < 6) return;
      drag.moved = true;
      drag.y += Math.sign(dy) * 6;
      dy = e.clientY - drag.y;
      try { gallery.setPointerCapture(e.pointerId); } catch (err) {}
    }
    raw = drag.raw0 - dy / pitch;
    pos = rubber(raw);
    sample(pos);
    render();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    // A drag, or a tap that only caught a moving wheel, is not a click.
    if (drag.moved || drag.wasMoving) swallowClick = true;
    vel = drag.moved ? measuredVel() : 0;
    drag = null;
    release(FLICK_TAU);
    setTimeout(() => { swallowClick = false; }, 0);
  }
  gallery.addEventListener('pointerup', endDrag);
  gallery.addEventListener('pointercancel', endDrag);
  gallery.addEventListener('dragstart', e => e.preventDefault());

  // A tap on a row that isn't the middle one turns it to the middle. Only
  // the middle row opens projects.
  gallery.addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); return; }
    const f = e.target.closest('.drum-facet');
    if (!f) return;
    const idx = facets.indexOf(f) + MIN;
    if (idx !== Math.round(pos) || Math.abs(pos - idx) > 0.08) {
      e.stopPropagation();
      e.preventDefault();
      vel = 0;
      goTo(idx);
    }
  }, true);

  // ── Wheel and trackpad ──
  // A mouse wheel clicks round one row per notch. A trackpad turns it
  // smoothly like a finger, then settles. Told apart by the first event of
  // each gesture: notches arrive as big jumps, trackpads start small.
  let gesture = null, lastWheel = 0, wheelTimer = 0;
  addEventListener('wheel', e => {
    if (!on || e.ctrlKey) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 40;
    else if (e.deltaMode === 2) dy *= innerHeight;
    if (!dy) return;
    userInput();
    const now = performance.now();
    if (!gesture || now - lastWheel > 180) {
      gesture = Math.abs(dy) >= 50 || e.deltaMode !== 0 ? 'notch' : 'smooth';
      if (gesture === 'smooth') { stop(); mode = 'hold'; raw = pos; samples = []; }
    }
    lastWheel = now;
    if (gesture === 'notch') {
      const from = moving() ? target : Math.round(pos);
      const next = from + Math.sign(dy);
      if (Math.abs(next - pos) <= 3) { vel = vel || 0; target = clamp(next); mode = 'spring'; run(); }
      return;
    }
    raw += dy / pitch;
    pos = rubber(raw);
    sample(pos);
    render();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      gesture = null;
      vel = measuredVel();
      release(0.12);
    }, 110);
  }, { passive: false });

  // ── Keys ──
  addEventListener('keydown', e => {
    if (!on || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const from = moving() ? target : Math.round(pos);
    let to = null;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) to = from + 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) to = from - 1;
    else if (e.key === 'Home') to = MIN;
    else if (e.key === 'End') to = MAX;
    if (to == null) return;
    e.preventDefault();
    userInput();
    target = clamp(to);
    mode = 'spring';
    run();
  });

  // ── On only while the gallery is showing ──
  // An open project hides the gallery and scrolls like a normal page.
  let on = false;
  function sync() {
    const showing = main.style.display !== 'none';
    if (showing === on) return;
    on = showing;
    root.classList.toggle('drum-on', on);
    if (on) { layout(); glStart(); }
    else {
      stop();
      glStop();
      drag = null;
      if (mode === 'fling') { target = MIN; hitTop(); }
      if (moving()) { pos = raw = target; vel = 0; mode = 'rest'; }
    }
  }
  new MutationObserver(sync).observe(main, { attributes: true, attributeFilter: ['style'] });

  // ── WebGL picture ──
  // Redrawn every frame while the gallery shows: the focused row's clips
  // are always playing. drum-gl.js only re-runs the blur when something
  // out of focus has changed.
  let glRaf = 0;
  function glFrame() {
    glRaf = requestAnimationFrame(glFrame);
    const list = [];
    let centerK = -1;
    facets.forEach((f, k) => {
      if (f.style.display === 'none') return;
      const phi = (pos - (k + MIN)) * theta;
      if (Math.abs(phi) < 1e-4) centerK = k;
      // Titles: fully in at the middle, gone by halfway to the next row.
      const d = Math.min(1, Math.abs(pos - (k + MIN)) * 2);
      const focus = 1 - d * d * (3 - 2 * d);
      list.push({ f, k, phi, focus, alpha: f.style.opacity === '' ? 1 : +f.style.opacity });
    });
    // Furthest first, so nearer sides paint over them.
    list.sort((a, b) => Math.abs(b.phi) - Math.abs(a.phi));
    const atRest = centerK >= 0 && (mode === 'rest' || mode === 'hold');
    glr.frame(list, centerK, atRest);
  }
  function glStart() { if (glr && !glRaf) glRaf = requestAnimationFrame(glFrame); }
  function glStop() { if (glRaf) cancelAnimationFrame(glRaf); glRaf = 0; }

  let resizeQueued = false;
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; if (on) layout(); });
  });

  sync();
  if (!on) build();
  // Under the yellow, already parked where the opening spin starts from.
  if (introOverlay && on && MAX >= 1) { pos = raw = target = MAX - 1; revealing = true; render(); }
  // The tape labels were fitted to the grid's card widths. Refit them.
  dispatchEvent(new Event('resize'));
  if (document.fonts) document.fonts.ready.then(() => { if (glr) glr.invalidate(); if (on) layout(); });
}());
