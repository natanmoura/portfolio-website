// ── Lab: the rainbow flipper ──
// An eye and six coloured balls, tumbling end over end round the edge of the
// screen. One end stays planted while the other heaves itself up, swings
// over and slaps down ahead. Then the ends swap. It moves in fits: a flip
// starts heavy and lands at full speed with a wobble, the pauses between
// vary, and now and then it stops for a moment.
//
// The page opens with its pieces raining down from above the screen, and it
// builds itself from there. Tap it and it bursts. The balls fly apart and fall to the floor, and the
// eye rolls off to fetch the nearest one. Close enough, a ball is drawn in
// and joins on, and the two flip off together after the next. Short bodies
// take short quick flips, long ones slow far-reaching ones. Once it has
// everything back it carries on round the edge.
//
// The body is a curve of fixed length between its two ends (a circular arc,
// bulging away from the surface), with the balls evenly along it.
(function () {
  const home = document.getElementById('main-content');
  const face = document.getElementById('eyeFace');
  if (!home) return;

  const here = document.currentScript.src;
  const art = name => new URL('../assets/emoji/png/' + name + '.png', here).href;
  // The eye first: it leads, and it's what goes and fetches the rest.
  const PARTS = ['eye', 'red-circle', 'orange-circle', 'yellow-circle', 'green-circle', 'blue-circle', 'purple-circle'];

  // ── Gait ──
  // Short bodies are quick little things: their flips and their pauses
  // shrink with length to this power (higher, the smaller it is the zippier).
  const FLIP_S = 1.0;       // one flip at full length
  const FLIP_MIN_S = 0.16;  // the quickest flip
  const QUICK = 0.85;
  // A flip starts from a standstill, heavy, and is still moving when it
  // lands: this many times its average speed. Higher hits harder.
  const LAND_SPEED = 1.0;
  // Going for a ball, the last two steps are one planned move:
  const SETUP_FLIP = 1.15;  // the step before the last takes this much longer
  const SETUP_LAND = 0.5;   // and comes down this gently (LAND_SPEED is the usual)
  const REACH_FLIP = 1.35;  // the last step, easing all the way in, this much longer
  const ROLL_EASE = 2.5;    // ball sizes out, the eye alone starts slowing for a ball
  // The body's length never changes (only how it bends), so a shorter
  // stride stands it up in a taller hump. Whole, it strides this much of
  // its length:
  const STRIDE_MIN = 0.6;   // stride, as a fraction of the body length
  const STRIDE_MAX = 0.78;
  // Three balls barely bend, striding this much of their length, and each
  // ball that joins brings the stride closer to the whole body's, quickly
  // at first (higher CURVE_GROW is quicker), so the curve is near its
  // final shape well before the last ball is on. Two balls are a rigid
  // pair that just flips end over end.
  const STRIDE_SHORT = 0.95;
  const CURVE_GROW = 0.35;
  const BEND_REACH = 40;    // degrees per joint it may crouch to on the planned steps onto a ball
  const GAP = 0.9;          // ball spacing, in ball sizes: overlapping just a touch
  // Between flips
  const REST_MIN = 0.05, REST_MAX = 0.35;   // s, the usual breather
  const PAUSE_CHANCE = 0.1;                  // now and then it stops a while
  const PAUSE_MIN = 0.8, PAUSE_MAX = 1.8;
  // The landing is taken in the body, by a spring: the middle carries on
  // down as the ends stop, presses the hump flatter, comes back up a little
  // past where it was, and settles. THUD is how much of the speed it came
  // down with goes into the spring, THUD_HZ how quick the spring is,
  // THUD_DAMP how soon it settles (1 is no overshoot at all).
  const THUD = 1, THUD_HZ = 2.0, THUD_DAMP = 0.4;
  const JOIN_EASE = 7;      // per second: how quickly the body settles into its new shape when a ball joins
  const ROLL_SPEED = 120;   // px/s, the eye on its own
  // Rebuilding after a burst it's in a hurry: no stops, barely a breath
  // between flips, flips this much quicker. Whole again, it goes back to
  // its usual amble.
  const HURRY_REST_MIN = 0.01, HURRY_REST_MAX = 0.06;
  const HURRY_FLIP = 0.55;
  const HURRY_FLIP_MIN_S = 0.09;   // two balls long: a frantic little scurry

  // ── Bursting ──
  const GRAVITY = 1600;     // px/s²
  const BOUNCE = 0.42;      // of the speed into a wall kept on the bounce
  const BLAST_MIN = 180, BLAST_MAX = 360, BLAST_UP = 280;  // px/s
  const SPIN = 900;         // deg/s, at most, on the eye as it flies
  const SETTLED_S = 0.25;   // still this long on the floor and a ball can be fetched
  const SETTLE_WAIT = 8;    // s: the longest it waits for every ball to settle before picking one
  const REACH = 1.7;        // ball sizes: how near the eye on its own gets before a ball is drawn in
  const PULL = 9;           // how hard it's drawn in, per second

  const wrap = document.createElement('div');
  wrap.className = 'inchworm';
  wrap.setAttribute('aria-hidden', 'true');
  const parts = PARTS.map(p => {
    const img = document.createElement('img');
    img.src = art(p);
    img.alt = '';
    img.draggable = false;
    wrap.appendChild(img);
    return { el: img, state: 'body', x: 0, y: 0, vx: 0, vy: 0, still: 0, s: 0, sx: NaN, sy: NaN, rx: 0, ry: 0, rot: 0, spin: 0 };
  });
  const eye = parts[0];
  home.appendChild(wrap);

  // Reads the phone's safe-area insets (notch, home bar), which only CSS
  // can see.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);

  const rand = (a, b) => a + Math.random() * (b - a);

  // ── Size ──
  // The same size as the flying creature's emoji: the text size of the
  // line it takes off from.
  let size = 16, gapPx = 13, LFULL = 80;
  function measure() {
    size = face ? parseFloat(getComputedStyle(face).fontSize) : 16;
    if (!size || size < 8) size = 16;
    gapPx = size * GAP;
    LFULL = (PARTS.length - 1) * gapPx;
    parts.forEach(p => { p.el.style.width = p.el.style.height = size + 'px'; });
  }

  // ── The path: the screen's edge, as a rounded rectangle ──
  // s runs clockwise round it from the top-left. Each point carries the
  // inward direction, which is "up" for anything standing on that edge.
  let box = null;
  function path() {
    const cs = getComputedStyle(probe);
    const cover = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vv-cover')) || 0;
    const x0 = parseFloat(cs.paddingLeft), y0 = parseFloat(cs.paddingTop);
    const x1 = innerWidth - parseFloat(cs.paddingRight);
    const y1 = innerHeight - parseFloat(cs.paddingBottom) - cover;
    const R = Math.min(size * 2.5, (x1 - x0) / 4, (y1 - y0) / 4);
    const w = x1 - x0 - 2 * R, h = y1 - y0 - 2 * R, q = Math.PI * R / 2;
    box = { x0, y0, x1, y1, R, w, h, q, P: 2 * w + 2 * h + 4 * q };
  }

  function at(s) {
    const { x0, y0, x1, y1, R, w, h, q, P } = box;
    s = ((s % P) + P) % P;
    const corner = (cx, cy, a0, t) => {
      const a = a0 + (t / q) * (Math.PI / 2);
      return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), nx: -Math.cos(a), ny: -Math.sin(a) };
    };
    if (s < w) return { x: x0 + R + s, y: y0, nx: 0, ny: 1 };                         // ceiling, going right
    s -= w; if (s < q) return corner(x1 - R, y0 + R, -Math.PI / 2, s);
    s -= q; if (s < h) return { x: x1, y: y0 + R + s, nx: -1, ny: 0 };                // right wall, going down
    s -= h; if (s < q) return corner(x1 - R, y1 - R, 0, s);
    s -= q; if (s < w) return { x: x1 - R - s, y: y1, nx: 0, ny: -1 };                // floor, going left
    s -= w; if (s < q) return corner(x0 + R, y1 - R, Math.PI / 2, s);
    s -= q; if (s < h) return { x: x0, y: y1 - R - s, nx: 1, ny: 0 };                 // left wall, going up
    s -= h; return corner(x0 + R, y0 + R, Math.PI, Math.min(s, q));
  }

  // A ball resting on the path at s: its centre, a radius off the surface.
  function onPath(s) {
    const p = at(s), r = size / 2;
    return { x: p.x + p.nx * r, y: p.y + p.ny * r, nx: p.nx, ny: p.ny };
  }
  // The shortest way round from a to b, signed.
  function toward(a, b) {
    const P = box.P;
    let d = ((b - a) % P + P) % P;
    if (d > P / 2) d -= P;
    return d;
  }
  // Where a loose ball sits on the path, as an s near `near`.
  function sOf(p, near) {
    if (!(Math.abs(p.x - p.sx) <= 0.5 && Math.abs(p.y - p.sy) <= 0.5)) {
      let best = 0, bd = Infinity;
      for (let s = 0; s < box.P; s += 3) {
        const q = onPath(s), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      for (let s = best - 3; s <= best + 3; s += 0.25) {
        const q = onPath(s), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      p.s = best; p.sx = p.x; p.sy = p.y;
    }
    return near + toward(near, p.s);
  }

  // ── The body: a chain of n balls, each touching the next ──
  // Neighbours are always exactly one gap apart, and the bend is shared
  // evenly between the joints, so the balls lie on a circle. Described by
  // where it starts (P), where it ends (M) and its bend: half the angle it
  // turns through end to end, signed. Positive bulges to the left of the
  // line from P to M, negative to the right, 0 is straight. A flip drives
  // the bend and lets the reach follow from it, so it passes through
  // straight smoothly instead of being solved for there, where it can't be.
  const sinc = x => Math.abs(x) < 1e-6 ? 1 - x * x / 6 : Math.sin(x) / x;
  // How far apart the ends of an n-ball chain are at bend phi.
  const reachOf = (phi, n) => (n - 1) * gapPx * sinc(phi) / sinc(phi / (n - 1));
  // The most an n-ball body bends, end to end, at deg per joint.
  const bendMax = (n, deg) => Math.min(Math.PI * 0.95, deg * Math.PI / 180 * (n - 1) / 2);
  // How bent (0 to pi) an n-ball chain is with its ends D apart.
  function bendFor(D, n) {
    if (n < 3 || D >= (n - 1) * gapPx) return 0;
    let lo = 0, hi = Math.PI;
    for (let i = 0; i < 40; i++) { const p = (lo + hi) / 2; if (reachOf(p, n) > D) lo = p; else hi = p; }
    return (lo + hi) / 2;
  }
  // The bend from P to M that bulges toward (ux, uy).
  function bendToward(P, M, ux, uy, n) {
    const cx = M.x - P.x, cy = M.y - P.y, p = bendFor(Math.hypot(cx, cy), n);
    return -cy * ux + cx * uy >= 0 ? p : -p;
  }
  // The balls' centres, fracs 0 (P) to 1 (M).
  function arcPoints(P, M, phi, n, fracs) {
    const cx = M.x - P.x, cy = M.y - P.y, D = Math.hypot(cx, cy) || 1;
    const ux = cx / D, uy = cy / D;
    // Along a circle, so far round that each gap's chord is one ball gap.
    const L = (n - 1) * gapPx / sinc(phi / (n - 1));
    // It leaves P turned phi off the line to M and turns back 2 phi by M.
    const tx = ux * Math.cos(phi) - uy * Math.sin(phi), ty = ux * Math.sin(phi) + uy * Math.cos(phi);
    const k = 2 * phi / L;
    return fracs.map(f => {
      const s = f * L, x = k * s;
      const along = s * sinc(x), across = Math.abs(x) < 1e-6 ? s * x / 2 : s * (1 - Math.cos(x)) / x;
      return { x: P.x + along * tx + across * ty, y: P.y + along * ty - across * tx };
    });
  }

  // ── State ──
  // body: the parts joined up, eye first. sEye and sTail are where its two
  // ends stand on the path. dir is the way it's heading: +1 clockwise.
  let body = parts.map((_, i) => i);
  let mode = 'walk';          // walk (two or more joined) | roll (the eye alone) | air (just burst)
  let sEye = 0, sTail = 0, dir = 1;
  let phase = 'rest', t = 0, restFor = 0;
  let flipT = 1, pivotS = 0, fromS = 0, landS = 0, moverIsEye = false, reaching = false, settingUp = false;
  let rejoined = false;       // a ball just joined: smooth the shift (see draw)
  const give = { s: 0, v: 0 }; // the landing spring: how far the middle is pressed in, px
  let bend0 = 0, bend1 = 0;   // a flip's bend as it lifts and as it lands
  let pulling = null, slotS = 0;
  let aim = null;             // the ball it's going for
  let unsettled = false, settleWait = 0;   // some loose ball is still moving, and for how long

  const L = () => (body.length - 1) * gapPx;

  // Drawn front to back from the eye: each ball behind the one it hangs
  // from, the tail at the very back. Loose balls sit behind all of it.
  function restack() {
    parts.forEach(p => { p.el.style.zIndex = 21; });
    body.forEach((i, j) => { parts[i].el.style.zIndex = 21 + parts.length - j; });
  }
  const complete = () => body.length === parts.length;

  // The page opens with every piece raining in from above the top of the
  // screen, at random spots and heights so they land one after another.
  // Then the eye builds itself the same way it does after a burst.
  const DROP_ABOVE_MIN = 1, DROP_ABOVE_MAX = 70;   // ball sizes above the top edge
  function start() {
    measure();
    path();
    const { x0, x1, R } = box;
    parts.forEach(p => {
      p.state = 'loose';
      p.entering = true;
      p.x = rand(x0 + R, x1 - R);
      p.y = box.y0 - size * rand(DROP_ABOVE_MIN, DROP_ABOVE_MAX);
      p.vx = rand(-40, 40); p.vy = 0;
      p.still = 0; p.sx = NaN;
      p.spin = p === eye ? rand(-SPIN, SPIN) / 3 : 0;
      p.rx = p.x; p.ry = p.y;
    });
    body = [0];
    mode = 'air';
    dir = 1;
  }

  // 1 at full length, smaller as the body gets shorter.
  const quickness = () => Math.pow(Math.max(L(), gapPx) / LFULL, QUICK);

  function rest() {
    phase = 'rest'; t = 0;
    if (!complete()) { restFor = rand(HURRY_REST_MIN, HURRY_REST_MAX); return; }
    restFor = (Math.random() < PAUSE_CHANCE ? rand(PAUSE_MIN, PAUSE_MAX) : rand(REST_MIN, REST_MAX)) *
      (0.3 + 0.7 * quickness());
  }

  // The nearest ball lying still on the floor, or null.
  // The closest ball lying still on the floor, measured round the edge from
  // whichever end is nearer, or null. It goes for the closest every time it
  // looks, so a closer ball settling meanwhile takes over, but only once
  // it's clearly closer than the one it's already going for (a ball-gap),
  // so two about as far don't have it dithering between them.
  function nearestLoose(a, b) {
    // It waits until every ball has come to rest before it picks one, so
    // it heads for the closest of all of them. (Not forever: a ball that
    // somehow never settles stops holding it up after SETTLE_WAIT.)
    if (unsettled && settleWait < SETTLE_WAIT) return null;
    const dist = p => Math.min(Math.abs(toward(a, sOf(p, a))), Math.abs(toward(b, sOf(p, b))));
    let best = null, bd = Infinity;
    parts.forEach(p => {
      if (p.state !== 'loose' || p.still < SETTLED_S) return;
      const d = dist(p);
      if (d < bd) { bd = d; best = p; }
    });
    if (aim && aim.state === 'loose' && best !== aim && dist(aim) <= bd + gapPx) return aim;
    return best;
  }

  function startPull(p, s) {
    pulling = p; slotS = s;
    p.state = 'pull';
    phase = 'pull'; t = 0;
  }

  // The spot ahead of the planted end that's `chord` away in a straight line.
  function landAt(chord) {
    const P = onPath(pivotS);
    for (let d = 1; d < chord * 3; d += 1) {
      const Q = onPath(pivotS + dir * d);
      if (Math.hypot(Q.x - P.x, Q.y - P.y) >= chord) return pivotS + dir * d;
    }
    return pivotS + dir * chord;
  }

  // The strides a body of its length takes, in px: from nearly its whole
  // length at three balls to the whole body's range at full length.
  function strides() {
    const n = body.length, len = L();
    if (n < 3) return { lo: len, hi: len };
    const g = Math.pow(Math.min(1, (n - 3) / (PARTS.length - 3)), CURVE_GROW);
    return { lo: len * (STRIDE_SHORT + (STRIDE_MIN - STRIDE_SHORT) * g), hi: len * (STRIDE_SHORT + (STRIDE_MAX - STRIDE_SHORT) * g) };
  }
  // Heading for a ball, the tail is to come down touching it, right where
  // it joins on, so the ball adds one ball's length and nothing has to fold
  // to fit it. The steps left are planned together and split evenly, as
  // many as keep each one closest to its usual stride. The tail lands every
  // other step, so the count is odd when it's the one swinging next. A
  // stiff short body can't always make the distance come out exactly; then
  // it never oversteps the ball, it comes down just short and the ball
  // rolls the rest of the way in.
  // Returns { steps, stride } for the coming step, or null when no step
  // fits short of the ball (then it should just draw the ball in).
  function planToBall(target, frontS, tailSwings) {
    const usual = strides(), mid = (usual.lo + usual.hi) / 2;
    const lo = Math.min(usual.lo, reachOf(bendMax(body.length, BEND_REACH), body.length));
    const hi = Math.max(lo, usual.hi);
    const D = dir * (sOf(target, frontS) - frontS) - gapPx;
    let best = 0, fits = false;
    for (let m = tailSwings ? 1 : 2; m * lo <= D; m += 2) {
      const ok = m * hi >= D;
      if (ok && (!fits || Math.abs(D / m - mid) < Math.abs(D / best - mid))) best = m;
      else if (!ok && !fits) best = m;
      fits = fits || ok;
    }
    return best ? { steps: best, stride: Math.min(hi, D / best), far: D > 4 * hi } : null;
  }

  // The next flip: the end behind swings over the one in front.
  function startFlip(target) {
    const eyeFront = dir * (sEye - sTail) > 0;
    moverIsEye = !eyeFront;
    pivotS = eyeFront ? sEye : sTail;
    fromS = eyeFront ? sTail : sEye;
    const n = body.length, len = L(), range = strides();
    const maxStride = range.hi;
    let stride = rand(range.lo, range.hi);
    let planned = false;
    reaching = settingUp = false;
    // Close to a ball, the last steps are planned. The last one (the
    // tail's) eases all the way in; the one before lands gently, setting up.
    const plan = target && planToBall(target, pivotS, !moverIsEye);
    if (plan && !plan.far) {
      stride = plan.stride;
      planned = true;
      reaching = plan.steps === 1;
      settingUp = plan.steps === 2;
    }
    if (planned) landS = pivotS + dir * stride;
    else {
      // A stride is the straight-line distance to where it lands, not the
      // distance round the edge. Round a corner that carries it further, so
      // it spans the corner in one wide arc. If a corner is anywhere in the
      // next step it takes its longest one, for the widest bend over it.
      const far = landAt(maxStride), P = onPath(pivotS), Q = onPath(far);
      landS = P.nx * Q.nx + P.ny * Q.ny < 0.98 ? far : landAt(stride);
    }
    flipT = (complete()
      ? Math.max(FLIP_MIN_S, FLIP_S * quickness())
      : Math.max(HURRY_FLIP_MIN_S, FLIP_S * quickness() * HURRY_FLIP)) * rand(0.9, 1.12);
    // The two planned steps slow down: a bit for setting up, more for the last.
    if (reaching) flipT *= REACH_FLIP;
    if (settingUp) flipT *= SETUP_FLIP;
    // Standing, the body bulges away from the surface under its front end:
    // the planted end now, the swinging one once it's down.
    const P = onPath(pivotS), from = onPath(fromS), to = onPath(landS);
    bend0 = bendToward(P, from, P.nx, P.ny, n);
    bend1 = bendToward(P, to, to.nx, to.ny, n);
    phase = 'flip';
    t = 0;
  }

  // The flip, k (0 to 1) through. The swinging end goes round the planted
  // one, over the top, from where it lifted to exactly where it will land,
  // so round a corner it already heads for the next wall. The bend eases
  // from how it stood, through straight at the top, to how it will stand,
  // and the reach is whatever that bend leaves: the length never changes.
  // Returns the planted end P, the swinging end M and the bend from P to M.
  function flipShape(k) {
    const P = onPath(pivotS), from = onPath(fromS), to = onPath(landS);
    const a0 = Math.atan2(from.y - P.y, from.x - P.x), a1 = Math.atan2(to.y - P.y, to.x - P.x);
    // Always over the top: on screen that's the angle going down when
    // heading clockwise, up when heading back.
    const twoPi = 2 * Math.PI, d = ((a1 - a0) % twoPi + twoPi) % twoPi;
    const sweep = dir > 0 ? d - twoPi : d;
    // Progress: no speed at the start, and at the end LAND_SPEED times the
    // average, or none when it's easing in beside a ball.
    const land = reaching ? 0 : settingUp ? SETUP_LAND : LAND_SPEED;
    const e = (land - 2) * k * k * k + (3 - land) * k * k;
    const s = e * e * (3 - 2 * e);
    // Exactly the standing bend at both ends, whichever side each bulges:
    // cos runs 1 to -1 over the flip, so the landing bend goes in negated.
    const phi = Math.cos(Math.PI * e) * (bend0 * (1 - s) - bend1 * s);
    const r = reachOf(phi, body.length), a = a0 + sweep * e;
    return { P, M: { x: P.x + r * Math.cos(a), y: P.y + r * Math.sin(a) }, phi };
  }

  function stepWalk(dt) {
    t += dt;
    if (phase === 'rest') {
      if (t < restFor) return;
      if (complete()) {
        if (dir !== 1) dir = 1;
        startFlip(null);
        return;
      }
      // Before every step, the closest ball.
      aim = nearestLoose(sEye, sTail);
      const target = aim;
      if (!target) { restFor = t + 0.25; return; }
      const tS = sOf(target, sTail);
      const fromTail = toward(sTail, tS), fromEye = toward(sEye, tS);
      // Lying under the body (between the two ends), or too close for any
      // step to land short of it: just draw it in. Anywhere else it flips
      // over to it, heading the way that brings the tail to it.
      const under = Math.sign(fromTail) !== Math.sign(fromEye);
      const way = Math.sign(fromTail) || 1;
      const tailFront = way * (sTail - sEye) > 0;
      dir = way;
      if (under || !planToBall(target, tailFront ? sTail : sEye, !tailFront)) {
        const out = under ? (Math.sign(sTail - sEye) || way) : way;
        startPull(target, sTail + out * gapPx);
        return;
      }
      startFlip(target);
    } else if (phase === 'flip') {
      if (t >= flipT) {
        // The ends stop dead, but the middle carries on with the speed it
        // came down with, into the spring. A soft landing barely presses it.
        landingGive();
        if (moverIsEye) sEye = landS; else sTail = landS;
        // Touching down against the ball, it takes it: the ball becomes the
        // new tail where it lies. If the ball was too close for a step this
        // short a body can take, it came down past it instead, and draws the
        // ball in from under itself next.
        const ballAt = reaching && aim && aim.state === 'loose' ? dir * toward(landS, sOf(aim, landS)) : NaN;
        if (ballAt > 0.5 * gapPx && ballAt < 1.5 * gapPx) {
          aim.state = 'body';
          body.push(parts.indexOf(aim));
          restack();
          sTail = landS + dir * ballAt;
          rejoined = true;
          phase = 'rest'; t = 0;
          restFor = complete() ? rand(0.5, 0.9) : rand(HURRY_REST_MIN, HURRY_REST_MAX);
          return;
        }
        rest();
      }
    } else if (phase === 'pull') {
      stepPull(dt, () => { sTail = slotS; });
    }
  }

  // A ball drawn in to its place on the end, faster as it nears, then
  // joined on for good.
  function stepPull(dt, joined) {
    const p = pulling, to = onPath(slotS);
    const k = 1 - Math.exp(-PULL * dt * (1 + 3 * Math.min(1, t / 0.4)));
    p.x += (to.x - p.x) * k;
    p.y += (to.y - p.y) * k;
    p.rx = p.x; p.ry = p.y;
    if (Math.hypot(to.x - p.x, to.y - p.y) < 0.6) {
      p.state = 'body';
      body.push(parts.indexOf(p));
      restack();
      pulling = null;
      joined();
      rejoined = true;
      phase = 'rest'; t = 0;
      // Whole again: a proper breather before it ambles off.
      restFor = complete() ? rand(0.5, 0.9) : rand(HURRY_REST_MIN, HURRY_REST_MAX);
    }
  }

  function stepRoll(dt) {
    t += dt;
    if (phase === 'pull') {
      stepPull(dt, () => {
        sTail = slotS;
        mode = 'walk';
        dir = Math.sign(slotS - sEye) || 1;
      });
      return;
    }
    aim = nearestLoose(sEye, sEye);
    const target = aim;
    if (!target) return;
    const tS = sOf(target, sEye), d = toward(sEye, tS);
    if (Math.abs(d) <= REACH * size) {
      startPull(target, sEye + Math.sign(d) * gapPx);
      return;
    }
    // Gets going from a standstill rather than shooting off, and slows as it
    // comes up on the ball.
    const near = Math.min(1, 0.25 + (Math.abs(d) - REACH * size) / (ROLL_EASE * size));
    const v = Math.sign(d) * ROLL_SPEED * Math.min(1, 0.3 + t) * near;
    sEye += v * dt;
    eye.rot -= (v * dt) / (size / 2) * 180 / Math.PI;
  }

  // ── Loose balls ──
  // Gravity, bouncing off the screen's edge (the same rounded rectangle the
  // walking path follows), and nudging each other apart.
  function stepLoose(dt) {
    const r = size / 2, { x0, y0, x1, y1, R } = box, inner = R - r;
    const loose = parts.filter(p => p.state === 'loose');
    loose.forEach(p => {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      // Still falling in from above the screen: nothing to hit yet.
      if (p.entering) {
        if (p.y < y0 + R) { p.still = 0; return; }
        p.entering = false;
      }
      const cx = Math.min(Math.max(p.x, x0 + R), x1 - R), cy = Math.min(Math.max(p.y, y0 + R), y1 - R);
      let dx = p.x - cx, dy = p.y - cy;
      const len = Math.hypot(dx, dy);
      let onEdge = false;
      if (len > inner) {
        dx /= len; dy /= len;
        p.x = cx + dx * inner; p.y = cy + dy * inner;
        const vn = p.vx * dx + p.vy * dy;
        if (vn > 0) {
          p.vx -= (1 + BOUNCE) * vn * dx; p.vy -= (1 + BOUNCE) * vn * dy;
          p.spin *= 0.6;
        }
        onEdge = true;
        // Rolling on the floor slows it down.
        if (dy > 0.5) {
          const f = Math.exp(-3 * dt);
          p.vx *= f;
          if (p === eye) p.rot += (p.vx * dt) / r * 180 / Math.PI;
        }
      }
      const slow = Math.hypot(p.vx, p.vy) < 12;
      p.still = onEdge && slow ? p.still + dt : 0;
    });
    for (let i = 0; i < loose.length; i++) {
      for (let j = i + 1; j < loose.length; j++) {
        const a = loose[i], b = loose[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = size * 0.92;
        if (d >= min || d < 1e-6) continue;
        dx /= d; dy /= d;
        const push = (min - d) / 2;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
        const rel = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (rel < 0) {
          const j2 = -rel * 0.65;
          a.vx -= dx * j2; a.vy -= dy * j2;
          b.vx += dx * j2; b.vy += dy * j2;
        }
      }
    }
  }

  // ── Tap: burst ──
  function burst() {
    const members = body.map(i => parts[i]);
    let cx = 0, cy = 0;
    members.forEach(p => { cx += p.rx; cy += p.ry; });
    cx /= members.length; cy /= members.length;
    members.forEach(p => {
      p.state = 'loose';
      p.x = p.rx; p.y = p.ry;
      let dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const v = rand(BLAST_MIN, BLAST_MAX);
      p.vx = dx / d * v + rand(-60, 60);
      p.vy = dy / d * v - rand(BLAST_UP * 0.6, BLAST_UP);
      p.still = 0;
      p.sx = NaN;
      p.ox = p.oy = 0;
      p.spin = p === eye ? rand(-SPIN, SPIN) : 0;
    });
    if (pulling) { pulling.state = 'loose'; pulling = null; }
    body = [0];
    give.s = give.v = 0;
    restack();
    mode = 'air';
    if (window.haptic) haptic.tick();
  }

  document.addEventListener('pointerdown', e => {
    if (mode !== 'walk' || body.length < 2 || home.style.display === 'none') return;
    if (e.target.closest && e.target.closest('a, button, input, textarea, select')) return;
    // Generous: it's small and it moves, and fingers are big.
    const hit = body.some(i => Math.hypot(parts[i].rx - e.clientX, parts[i].ry - e.clientY) < size * 1.6);
    if (hit) burst();
  }, { passive: true });

  // ── Each frame ──
  function step(dt) {
    if (mode === 'walk') stepWalk(dt);
    else if (mode === 'roll') stepRoll(dt);
    // The give: one spring for the whole body, how far its middle is pushed
    // off its shape. It runs all the time, through rests and flips alike, so
    // nothing ever cuts it off or restarts it. It runs after the walk, so a
    // landing carries the middle on in the very frame the ends stop.
    const w = 2 * Math.PI * THUD_HZ, kd = 2 * THUD_DAMP * w;
    give.v += (-w * w * give.s - kd * give.v) * dt;
    give.s += give.v * dt;
    // A ball just joined: the body eases into its new shape, no bounce.
    const ease = Math.exp(-JOIN_EASE * dt);
    body.forEach(i => { const p = parts[i]; p.ox = (p.ox || 0) * ease; p.oy = (p.oy || 0) * ease; });
    stepLoose(dt);
    unsettled = parts.some(p => p.state === 'loose' && p.still < SETTLED_S);
    settleWait = unsettled ? settleWait + dt : 0;
    if (mode === 'air' && eye.still >= SETTLED_S) {
      eye.state = 'body';
      sEye = sOf(eye, sEye);
      mode = 'roll'; phase = 'roll'; t = 0;
    }
    // Joined to something, the eye turns back upright.
    if (mode === 'walk') {
      const upright = Math.round(eye.rot / 360) * 360;
      eye.rot += (upright - eye.rot) * (1 - Math.exp(-8 * dt));
    }
  }

  // Where each ball of the body sits on its arc, eye first, k through a flip.
  function bodyPoints(k) {
    const n = body.length, len = L();
    const fracs = body.map((_, i) => i / (n - 1));
    if (phase === 'flip') {
      const { P, M, phi } = flipShape(k);
      // P is the planted end. The eye is at M when it's the one swinging.
      return arcPoints(P, M, phi, n, moverIsEye ? fracs.map(f => 1 - f) : fracs);
    }
    const A = onPath(sEye), B = onPath(sTail);
    const front = dir * (sEye - sTail) > 0 ? A : B;
    return arcPoints(A, B, bendToward(A, B, front.nx, front.ny, n), n, fracs);
  }
  // The middle of the body (between two balls when the count is even), and
  // the way in from there to the line between the ends. The way in fades
  // out as the body goes straight, where there's no hump to press, so it
  // never flips round.
  function middle(pts) {
    const n = pts.length, u = (n - 1) / 2, j = Math.floor(u), f = u - j, q = pts[Math.min(n - 1, j + 1)];
    const m = { x: pts[j].x + (q.x - pts[j].x) * f, y: pts[j].y + (q.y - pts[j].y) * f };
    const A = pts[0], B = pts[n - 1], bx = B.x - A.x, by = B.y - A.y, bb = bx * bx + by * by || 1;
    const k = ((m.x - A.x) * bx + (m.y - A.y) * by) / bb;
    const dx = A.x + bx * k - m.x, dy = A.y + by * k - m.y, d = Math.hypot(dx, dy) || 1;
    const fade = d / Math.hypot(d, size * 0.3);
    return { m, ix: dx / d * fade, iy: dy / d * fade };
  }
  // Short bodies are firmer: the give scales with how many balls there are.
  const giveScale = () => (body.length - 1) / (PARTS.length - 1);

  // Touching down, the ends stop dead but the middle carries on with the
  // speed it came down with, pressing the hump in toward the line between
  // the ends (or lifting it, if it was rising).
  function landingGive() {
    const h = 0.02, a = middle(bodyPoints(1)), b = middle(bodyPoints(1 - h));
    const vin = ((a.m.x - b.m.x) * a.ix + (a.m.y - b.m.y) * a.iy) / (h * flipT);
    give.v += THUD * giveScale() * vin;
  }

  function draw() {
    const r = size / 2;
    if (mode === 'walk') {
      const pts = bodyPoints(Math.min(1, t / flipT));
      const n = body.length, way = middle(pts);
      // The give is shared out along the body: all of it in the middle,
      // tapering smoothly to none at the two ends, which are planted.
      const off = j => { const w = give.s * Math.sin(Math.PI * j / (n - 1)); return { x: way.ix * w, y: way.iy * w }; };
      // Just joined a ball: each ball keeps how far it is from its new
      // place, and eases it away (see step).
      if (rejoined) {
        rejoined = false;
        body.forEach((i, j) => { const p = parts[i], o = off(j); p.ox = p.rx - pts[j].x - o.x; p.oy = p.ry - pts[j].y - o.y; });
      }
      body.forEach((i, j) => {
        const p = parts[i], o = off(j);
        p.rx = pts[j].x + o.x + (p.ox || 0);
        p.ry = pts[j].y + o.y + (p.oy || 0);
      });
    } else if (mode === 'roll') {
      const q = onPath(sEye);
      eye.rx = q.x; eye.ry = q.y;
    }
    parts.forEach(p => {
      if (p.state === 'loose') { p.rx = p.x; p.ry = p.y; }
      p.el.style.transform = `translate(${(p.rx - r).toFixed(1)}px, ${(p.ry - r).toFixed(1)}px)` +
        (p === eye && eye.rot ? ` rotate(${eye.rot.toFixed(1)}deg)` : '');
    });
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (home.style.display === 'none') { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    step(dt);
    draw(dt);
  }

  // Resizing changes the path's length: keep the same place round it.
  addEventListener('resize', () => {
    const P0 = box.P;
    measure();
    path();
    const k = box.P / P0;
    sEye *= k; sTail *= k; pivotS *= k; fromS *= k; landS *= k; slotS *= k;
    parts.forEach(p => { p.sx = NaN; });
  });

  start();
  restack();
  draw(0);
  requestAnimationFrame(frame);
})();
