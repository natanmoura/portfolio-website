// ── 👁️👄👁️ grows wings and flies ──
// The face fades in on its line, hops up about two lines, sprouts a wing on
// each side and hovers there flapping for a moment, then flies off. The
// flight itself lives in eye-flight.js.
// Desktop: it trails the cursor and hovers close to it, never on it.
// Touch: it picks spots on screen and hovers around each for a while.
// Add ?tune to the URL for a panel that edits every value live.
(() => {
  const face = document.getElementById('eyeFace');
  if (!face || !window.EyeFlight) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const here = document.currentScript.src;
  const WING = new URL('../assets/emoji/wing.svg', here).href;
  new Image().src = WING;

  const TUNE_KEY = 'eyeCreatureTune';
  const tuning = new URLSearchParams(location.search).has('tune');
  const P = Object.assign({}, EyeFlight.DEFAULTS);
  if (tuning) {
    try { Object.assign(P, JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')); } catch (e) {}
    const s = document.createElement('script');
    s.src = new URL('eye-tuner.js?v=4', here).href;
    document.body.appendChild(s);
  }

  const FADE_MS = 3000;
  const followsCursor = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

  let mouse = null;
  if (followsCursor) {
    addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
    }, { passive: true });
  }

  let bird = null, wingL = null, wingR = null, headEm = { w: 3, emojiTop: 0 };

  // Each wing sits in line with the face like one more emoji on the same
  // line: same size, same height, right against the outer eye. Shoulder
  // out/height shift it from that slot. The pivot only sets where on the
  // art it hinges. The art is a right wing, so the left one is mirrored
  // and its pivot mirrored with it.
  function layoutWings() {
    if (!bird) return;
    const sz = P.wingSize;
    const top = headEm.emojiTop + (1 - sz) / 2 + P.shoulderY;
    Object.assign(wingR.style, {
      width: sz + 'em', height: sz + 'em', top: top + 'em',
      left: (headEm.w + P.shoulderX) + 'em',
      transformOrigin: `${P.pivotX}% ${P.pivotY}%`,
    });
    Object.assign(wingL.style, {
      width: sz + 'em', height: sz + 'em', top: top + 'em',
      left: (-sz - P.shoulderX) + 'em',
      transformOrigin: `${100 - P.pivotX}% ${P.pivotY}%`,
    });
  }

  window.__eyeCreature = {
    P, DEFAULTS: EyeFlight.DEFAULTS, TUNE_KEY, relayout: () => layoutWings(),
  };

  const header = document.querySelector('.site-header');
  setTimeout(takeOff, FADE_MS);

  function takeOff() {
    const r = face.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(face).fontSize);
    const lineH = parseFloat(getComputedStyle(face.parentElement).lineHeight) || fs * 1.75;
    bird = document.createElement('div');
    bird.className = 'eye-creature';
    bird.setAttribute('aria-hidden', 'true');
    bird.style.fontSize = fs + 'px';
    bird.innerHTML =
      `<span class="ec-wing ec-wing--l"><img src="${WING}" alt="" draggable="false"></span>` +
      `<span class="ec-head">${face.innerHTML}</span>` +
      `<span class="ec-wing ec-wing--r"><img src="${WING}" alt="" draggable="false"></span>`;
    document.body.appendChild(bird);
    face.style.visibility = 'hidden';
    wingL = bird.querySelector('.ec-wing--l');
    wingR = bird.querySelector('.ec-wing--r');
    const w = r.width, h = r.height;
    const head = bird.querySelector('.ec-head');
    const firstEmoji = head.querySelector('img') || head;
    headEm = {
      w: head.getBoundingClientRect().width / fs,
      emojiTop: (firstEmoji.getBoundingClientRect().top - bird.getBoundingClientRect().top) / fs,
    };
    layoutWings();

    const x0 = r.left + w / 2, y0 = r.top + h / 2;
    const flight = EyeFlight.create(P, x0, y0);
    const s = flight.state;

    // The hop: enough upward speed to rise about hopLines lines, then it
    // holds that spot for hopHover seconds before going anywhere.
    const hopY = y0 - P.hopLines * lineH;
    flight.kick(0, -Math.sqrt(2 * P.gravity * P.hopLines * lineH));
    let hopUntil = P.hopHover;

    let follow = { x: x0, y: hopY };
    let offset = { x: 0, y: 0 }, offsetGoal = { x: 0, y: 0 };
    let nextOffset = 0, nextSpot = 0, spot = { x: x0, y: hopY };
    let grow = 0, t = 0, last = performance.now();

    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;
      const vw = innerWidth, vh = innerHeight, margin = 30;
      // Ceiling: the bottom of the header bar, plus room for the raised
      // wings, so no part of it ever slips under the bar.
      const reach = h / 2 + P.wingSize * fs;
      const top = (header ? header.getBoundingClientRect().bottom : 0) + reach + 4;
      // Floor: the top of the bottom dock when it is showing (phones only),
      // else the bottom of the screen.
      const dock = document.querySelector('.dock');
      const dockShown = dock && dock.getClientRects().length > 0;
      const floor = (dockShown ? dock.getBoundingClientRect().top : vh) - h / 2 - 4;

      let goalX, goalY;
      if (t < hopUntil) {
        goalX = x0; goalY = hopY;
      } else {
        // ── Anchor: the cursor, or a spot it picked ──
        let anchor;
        if (followsCursor) anchor = mouse || spot;
        else {
          if (t > nextSpot) {
            spot = { x: rand(margin + 40, vw - margin - 40), y: rand(top + 60, Math.max(top + 60, Math.min(vh * 0.75, floor - 60))) };
            nextSpot = t + rand(4, 8);
          }
          anchor = spot;
        }
        follow.x += (anchor.x - follow.x) * ease(dt, P.followLag);
        follow.y += (anchor.y - follow.y) * ease(dt, P.followLag);

        // ── Wander near it, never settling on it ──
        if (t > nextOffset) {
          const a = rand(0, Math.PI * 2);
          const rad = rand(P.hoverMin, P.hoverMax);
          offsetGoal = { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.6 - P.hoverAbove };
          nextOffset = t + P.wanderEvery * rand(0.5, 1.5);
        }
        offset.x += (offsetGoal.x - offset.x) * ease(dt, 0.6);
        offset.y += (offsetGoal.y - offset.y) * ease(dt, 0.6);
        goalX = clamp(follow.x + offset.x, margin, vw - margin);
        goalY = clamp(follow.y + offset.y, top + 20, floor - 20);
      }

      flight.step(dt, goalX, goalY, t < hopUntil);

      // Soft walls: nudge back in rather than bounce.
      if (s.x < margin) s.vx += (margin - s.x) * 8 * dt;
      if (s.x > vw - margin) s.vx -= (s.x - (vw - margin)) * 8 * dt;
      // The ceiling is hard: it bumps its head and drops.
      if (s.y < top) { s.y = top; if (s.vy < 0) s.vy *= -0.2; }
      // So is the floor: it never sinks behind the dock.
      if (s.y > floor) { s.y = floor; if (s.vy > 0) s.vy *= -0.2; }

      // Wings grow in with a small overshoot.
      grow = Math.min(1, grow + dt / 0.35);
      const g = grow < 1 ? 1 + 2.2 * Math.pow(grow - 1, 3) + 1.2 * Math.pow(grow - 1, 2) : 1;

      bird.style.transform = `translate(${s.x - w / 2}px, ${s.y - h / 2}px) rotate(${s.tilt}deg)`;
      wingR.style.transform = `rotate(${-s.wingR}deg) scale(${g})`;
      wingL.style.transform = `rotate(${s.wingL}deg) scale(${g})`;

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
