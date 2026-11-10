// ── 👁️👄👁️ grows wings and flies ──
// The face fades in on its line, hops up about two lines, sprouts a wing on
// each side and hovers there flapping for a moment, then flies off. The
// flight itself lives in eye-flight.js.
// With a mouse or trackpad in use (outside the phone layout): it trails the
// cursor and hovers close to it, never on it. Otherwise (touch, phones,
// no pointer yet): it picks spots on screen and hovers around each a while.
// Add ?tune to the URL for a panel that edits every value live.
(() => {
  const face = document.getElementById('eyeFace');
  if (!face || !window.EyeFlight) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const here = document.currentScript.src;
  const WING = new URL('../assets/emoji/wing.svg', here).href;
  const DEAD_EYE = new URL('../assets/emoji/multiply.svg', here).href;
  const DEAD_MOUTH = new URL('../assets/emoji/biting-lip.svg', here).href;
  [WING, DEAD_EYE, DEAD_MOUTH].forEach(src => { new Image().src = src; });

  const TUNE_KEY = 'eyeCreatureTune';
  const tuning = new URLSearchParams(location.search).has('tune');
  const P = Object.assign({}, EyeFlight.DEFAULTS);
  if (tuning) {
    try { Object.assign(P, JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')); } catch (e) {}
    const s = document.createElement('script');
    s.src = new URL('eye-tuner.js?v=4', here).href;
    document.body.appendChild(s);
  }

  const FADE_MS = 2000;           // must match the eye-face-in fade in style.css
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

  // Follow the cursor or wander? Decided live from what is actually in use,
  // not from what the device claims at load. A mouse or trackpad moving the
  // pointer turns following on, and a finger touching the screen turns it
  // off again, so an iPad flips between the two as a trackpad comes and
  // goes. The phone layout always wanders, mouse or not, the same as phones.
  const phoneLayout = matchMedia('(max-width: 720px)');
  let mouse = null;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') mouse = null;
  }, { passive: true });
  const following = () => mouse !== null && !phoneLayout.matches;

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
      `<span class="ec-hit"></span>` +
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

    // ── Tap it and it dies ──
    // It freezes where it is, eyes to multiply signs and mouth to a bitten
    // lip, holds for HOLD seconds, then peels off the page: the lower end stays stuck
    // like the last corner of a sticker while the raised end swings down
    // around it, slow at first. At PEEL_RELEASE degrees from horizontal
    // (45° short of hanging straight down) it comes unstuck and falls,
    // keeping its spin, until it drops off the bottom of the screen.
    const HOLD = 0.8;
    const PEEL_ACCEL = 125;     // deg/s² at full lever
    const PEEL_RELEASE = 45;
    let dead = null;

    // The dead face is built off-screen and fully decoded before it replaces
    // the live one. Changing src on the live images instead left them blank
    // for a frame, which showed as a flash on the tap.
    function deadFace() {
      return [...bird.querySelectorAll('.ec-head img')].map((live, i) => {
        const img = live.cloneNode();
        img.src = i === 1 ? DEAD_MOUTH : DEAD_EYE;
        return img;
      });
    }

    bird.addEventListener('pointerdown', e => {
      if (dead) return;
      e.preventDefault();
      e.stopPropagation();
      bird.classList.add('is-dead');
      dead = { phase: 'hold', t: 0, tilt: s.tilt };
      const fresh = deadFace();
      const live = [...bird.querySelectorAll('.ec-head img')];
      Promise.all(fresh.map(img => img.decode().catch(() => {})))
        .then(() => fresh.forEach((img, i) => live[i].replaceWith(img)));
    });

    // Where a point of the bird box (local px) is on screen, given the box's
    // top-left translate T, its transform origin O and its rotation φ.
    const toWorld = (T, O, phi, L) => {
      const a = phi * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      const dx = L.x - O.x, dy = L.y - O.y;
      return { x: T.x + O.x + dx * c - dy * sn, y: T.y + O.y + dx * sn + dy * c };
    };

    function deathFrame(dt) {
      const bw = bird.offsetWidth, bh = bird.offsetHeight;
      const C = { x: bw / 2, y: bh / 2 };
      dead.t += dt;

      if (dead.phase === 'hold') {
        if (dead.t < HOLD) return;
        // Stuck end: whichever end sits lower.
        const right = dead.tilt > 0.5 ? true : dead.tilt < -0.5 ? false : Math.random() < 0.5;
        const pivotLocal = { x: right ? bw : 0, y: bh / 2 };
        const T = { x: s.x - w / 2, y: s.y - h / 2 };
        dead.pivot = toWorld(T, C, dead.tilt, pivotLocal);
        dead.pivotLocal = pivotLocal;
        dead.dir = right ? -1 : 1;     // the free end swings down this way
        dead.phi = dead.tilt;
        dead.omega = 0;
        dead.peelT = 0;
        dead.phase = 'peel';
        bird.style.transformOrigin = `${pivotLocal.x}px ${pivotLocal.y}px`;
      }

      if (dead.phase === 'peel') {
        dead.peelT += dt;
        // Torque from the free end's weight: strongest while it sticks out
        // level, easing as it swings toward hanging. The first second is a
        // slow creep, like glue letting go.
        const lever = Math.cos(dead.phi * Math.PI / 180);
        const creep = Math.min(1, 0.2 + dead.peelT / 1.0);
        dead.omega += dead.dir * PEEL_ACCEL * lever * creep * dt;
        dead.phi += dead.omega * dt;
        const T = { x: dead.pivot.x - dead.pivotLocal.x, y: dead.pivot.y - dead.pivotLocal.y };
        bird.style.transform = `translate(${T.x}px, ${T.y}px) rotate(${dead.phi}deg)`;
        if (dead.dir * dead.phi >= PEEL_RELEASE) {
          // Unstick: carry on as a free body from the middle, moving the way
          // the swing was already carrying it.
          const center = toWorld(T, dead.pivotLocal, dead.phi, C);
          const w_ = dead.omega * Math.PI / 180;
          const rx = center.x - dead.pivot.x, ry = center.y - dead.pivot.y;
          dead.fall = { x: center.x, y: center.y, vx: -w_ * ry, vy: w_ * rx };
          dead.phase = 'fall';
          // Switch back to turning about the middle and restate the position
          // for that in the same frame. Changing the origin alone left it
          // drawn off to one side for a frame, which showed as a flash.
          bird.style.transformOrigin = '';
          bird.style.transform = `translate(${center.x - C.x}px, ${center.y - C.y}px) rotate(${dead.phi}deg)`;
        }
        return;
      }

      if (dead.phase === 'fall') {
        const f = dead.fall;
        f.vy += P.gravity * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        dead.omega *= Math.exp(-0.3 * dt);
        dead.phi += dead.omega * dt;
        bird.style.transform = `translate(${f.x - C.x}px, ${f.y - C.y}px) rotate(${dead.phi}deg)`;
        if (f.y - bh > innerHeight + 60) dead.phase = 'gone';
      }
    }

    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;
      if (dead) {
        deathFrame(dt);
        if (dead.phase === 'gone') { bird.remove(); return; }
        requestAnimationFrame(frame);
        return;
      }
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
        if (following()) anchor = mouse;
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

      // Side cushions: within EDGE_ZONE of a side, it is pushed back in,
      // harder the deeper it goes, and speed carrying it outward is soaked
      // up, so it eases to a stop rather than hitting a wall. The edge
      // itself is the backstop: its middle never passes the screen edge, so
      // at most half of it is ever off screen.
      const EDGE_ZONE = 90, PUSH = 8, SOAK = 26;
      const cushion = depth => {
        const k = Math.min(1, depth / EDGE_ZONE);
        return { push: depth * PUSH * dt, soak: Math.exp(-SOAK * k * dt) };
      };
      if (s.x < EDGE_ZONE) {
        const c = cushion(EDGE_ZONE - s.x);
        s.vx += c.push;
        if (s.vx < 0) s.vx *= c.soak;
      }
      if (s.x > vw - EDGE_ZONE) {
        const c = cushion(s.x - (vw - EDGE_ZONE));
        s.vx -= c.push;
        if (s.vx > 0) s.vx *= c.soak;
      }
      if (s.x < 0) { s.x = 0; if (s.vx < 0) s.vx = 0; }
      if (s.x > vw) { s.x = vw; if (s.vx > 0) s.vx = 0; }
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
