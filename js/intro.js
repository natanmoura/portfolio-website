// ── Intro "hello" animation ──
// Full-screen yellow takeover: a bouncing wizard, typed greeting, a small shake,
// then the wizard flies up off the top of the screen as the yellow fades away.
// Plays once per browser session (gate disabled during testing).
(function () {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;

  const textEl = document.getElementById('introText');
  const wizard = document.getElementById('introWizard');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || window.location.hash || sessionStorage.getItem('introPlayed')) {
    overlay.remove();
    document.dispatchEvent(new CustomEvent('introDone'));
    return;
  }
  sessionStorage.setItem('introPlayed', '1');

  document.body.style.overflow = 'hidden';

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
      let elapsed = 0;
      const id = setInterval(() => {
        const wr = wizard.getBoundingClientRect();
        const or = overlay.getBoundingClientRect();
        const s = document.createElement('span');
        s.className = 'intro-trail-sparkle';
        s.textContent = '✨';
        s.style.left = (wr.left + wr.width  / 2 - or.left + (Math.random() * 16 - 8)) + 'px';
        s.style.top  = (wr.top  + wr.height / 2 - or.top  + (Math.random() * 16 - 8)) + 'px';
        overlay.appendChild(s);
        setTimeout(() => s.remove(), 920);
        elapsed += interval;
        if (elapsed >= duration) { clearInterval(id); resolve(); }
      }, interval);
    });
  }

  async function run() {
    wizard.classList.add('bouncing');
    ghost.textContent = 'Hello magical creature!';
    await typeLine('Hello magical creature!');
    await sleep(1000);

    typed.textContent = '';
    ghost.textContent = 'Welcome to my corner\nof the internet...';
    // Complete the current bounce cycle before stopping.
    await Promise.race([
      new Promise(resolve => wizard.addEventListener('animationiteration', resolve, { once: true })),
      sleep(500)
    ]);
    wizard.classList.remove('bouncing');
    await typeLine('Welcome to my corner\nof the internet...');
    await sleep(1000);

    // Text disappears, brief pause, then shake.
    typed.textContent = '';
    ghost.textContent = '';
    cursor.style.display = 'none';
    await sleep(300);

    await shake(800);

    // Wizard flies up; sparkles trail it for the full duration.
    // Fade starts halfway through the fly so the reveal overlaps the exit.
    wizard.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 1, 1)';
    wizard.style.transform = 'translateY(-160vh)';
    const trailDone = spawnSparkleTrail(850);
    await sleep(400);
    overlay.style.pointerEvents = 'none';
    const fadeDone = fadeOut(overlay, 600);
    await Promise.all([trailDone, fadeDone]);
    document.body.style.overflow = '';
    overlay.remove();
    document.dispatchEvent(new CustomEvent('introDone'));
  }

  run();
})();
