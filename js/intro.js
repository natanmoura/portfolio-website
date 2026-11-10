// ── Intro "hello" animation ──
// Full-screen yellow takeover: a bouncing wizard, typed greeting, a small shake,
// then the wizard flies up off the top of the screen as the yellow fades away.
// Plays once per session, never in a background tab; ?intro in the URL forces a replay.
(function () {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;

  const textEl = document.getElementById('introText');
  const wizard = document.getElementById('introWizard');

  // Both greetings, written once each. Use \n for a line break.
  const LINE1 = "Hi, I'm Natan!";
  const LINE2 = 'Welcome to my corner\nof the internet...';

  // Testing switch: true plays the intro on every load. Keep it false in
  // anything committed (?intro on the URL replays it once instead).
  const ALWAYS_PLAY = false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ALWAYS_PLAY && !/[?&]intro\b/.test(location.search) && (reduceMotion || document.hidden || window.location.hash || sessionStorage.getItem('introPlayed'))) {
    overlay.remove();
    document.dispatchEvent(new CustomEvent('introDone'));
    return;
  }
  sessionStorage.setItem('introPlayed', '1');

  document.body.style.overflow = 'hidden';

  // One way out, taken once, however the intro ends. Browsers throttle timers
  // and stop rAF in a backgrounded tab, so the sequence below cannot be relied
  // on to reach its own last line — and until it does, the page cannot scroll.
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    document.body.style.overflow = '';
    overlay.remove();
    document.dispatchEvent(new CustomEvent('introDone'));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  setTimeout(finish, 15000);          // backstop: never leave the page locked

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // JS-driven fade — bypasses CSS transitions entirely.
  function fadeOut(el, duration) {
    return new Promise(resolve => {
      const start = performance.now();
      (function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        el.style.opacity = String(1 - t);
        if (t < 1) requestAnimationFrame(tick);
        else { el.style.opacity = '0'; resolve(); }
      })(performance.now());
    });
  }

  // Ghost reserves the centered box size; live types over it, left-aligned.
  const ghost = document.createElement('span');
  ghost.className = 'intro-text-ghost';
  const live = document.createElement('span');
  live.className = 'intro-text-live';
  const typed = document.createElement('span');
  const cursor = document.createElement('span');
  cursor.className = 'intro-cursor';
  cursor.textContent = '_';
  live.appendChild(typed);
  live.appendChild(cursor);
  textEl.appendChild(ghost);
  textEl.appendChild(live);

  // Reserve the biggest greeting's box up front: tallest so the wizard below
  // holds its place, widest so this centred box never resizes and the cursor
  // starts at the same point on every line. The spare column is for the cursor
  // itself, which would otherwise wrap at the end of a full line.
  const allLines = (LINE1 + '\n' + LINE2).split('\n');
  textEl.style.setProperty('--intro-lines',
    String(Math.max(LINE1.split('\n').length, LINE2.split('\n').length)));
  const introCols = Math.max.apply(null, allLines.map(l => l.length)) + 1;
  textEl.style.setProperty('--intro-cols', String(introCols));
  // The first greeting is one short line, so start it at the offset that
  // centres it (cursor included) in the box. Monospace, so ch is exact.
  const line1Indent = Math.max(0, (introCols - (LINE1.length + 1)) / 2);

  async function typeLine(str) {
    typed.textContent = '';
    for (const ch of str) {
      typed.textContent += ch;
      if (ch === '\n') continue;
      await sleep(25 + Math.random() * 40 + (Math.random() < 0.1 ? 80 : 0));
    }
  }

  // Side-to-side jitter on X axis only.
  function shake(duration) {
    return new Promise(resolve => {
      const start = performance.now();
      (function frame(t) {
        if (t - start >= duration) { wizard.style.transform = ''; resolve(); return; }
        const x = (Math.random() * 2 - 1) * 3;
        wizard.style.transform = `translateX(${x}px)`;
        requestAnimationFrame(frame);
      })(start);
    });
  }

  // Spawn ✨ sparkles at the wizard's current position while it flies up.
  function spawnSparkleTrail(duration) {
    return new Promise(resolve => {
      const interval = 75;
      const start = performance.now();
      const id = setInterval(() => {
        // Against the clock, not a tick count: a throttled tab stretches each
        // tick to ~1s, which used to drag this out to twelve seconds.
        if (finished || performance.now() - start >= duration) {
          clearInterval(id); resolve(); return;
        }
        const wr = wizard.getBoundingClientRect();
        const or = overlay.getBoundingClientRect();
        const s = document.createElement('span');
        s.className = 'intro-trail-sparkle';
        s.textContent = '✨';
        s.style.left = (wr.left + wr.width  / 2 - or.left + (Math.random() * 16 - 8)) + 'px';
        s.style.top  = (wr.top  + wr.height / 2 - or.top  + (Math.random() * 16 - 8)) + 'px';
        overlay.appendChild(s);
        setTimeout(() => s.remove(), 900);   // must match intro-sparkle-fade in style.css
      }, interval);
    });
  }

  async function run() {
    wizard.classList.add('bouncing');
    ghost.textContent = LINE1;
    live.style.left = line1Indent + 'ch';
    // A beat on the empty cursor before the greeting starts.
    await sleep(700);
    await typeLine(LINE1);
    await sleep(800);

    typed.textContent = '';
    ghost.textContent = LINE2;
    live.style.left = '';
    // Restart the blink so the cursor is solid the instant the line clears.
    // Left mid-cycle it can sit invisible through the whole pause, which reads
    // as the text being erased rather than as a cursor waiting to type.
    cursor.style.animation = 'none';
    void cursor.offsetWidth;
    cursor.style.animation = '';
    // Complete the current bounce cycle before stopping.
    await Promise.race([
      new Promise(resolve => wizard.addEventListener('animationiteration', resolve, { once: true })),
      sleep(400)
    ]);
    wizard.classList.remove('bouncing');
    await typeLine(LINE2);
    await sleep(800);

    // Text disappears, brief pause, then shake.
    typed.textContent = '';
    ghost.textContent = '';
    cursor.style.display = 'none';
    await sleep(100);

    await shake(600);

    // Wizard flies up; sparkles trail it for the full duration.
    // Fade starts partway through the fly so the reveal overlaps the exit.
    wizard.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 1, 1)';
    wizard.style.transform = 'translateY(-160vh)';
    const trailDone = spawnSparkleTrail(850);
    await sleep(400);
    overlay.style.pointerEvents = 'none';
    // The page underneath can start its entrance as the yellow lifts.
    document.dispatchEvent(new CustomEvent('introFading'));
    const fadeDone = fadeOut(overlay, 500);
    await Promise.all([trailDone, fadeDone]);
    finish();
  }

  run();
})();
