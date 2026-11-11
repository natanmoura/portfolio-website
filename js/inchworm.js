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
  const LAND_SPEED = 1.3;
  const REACH_FLIP = 1.35;  // the flip easing in beside a ball takes this much longer
  const ROLL_EASE = 2.5;    // ball sizes out, the eye alone starts slowing for a ball
  // The body's length never changes (only how it bends), so a shorter
  // stride stands it up in a taller hump.
  const STRIDE_MIN = 0.6;   // stride, as a fraction of the body length
  const STRIDE_MAX = 0.78;
  const GAP = 0.9;          // ball spacing, in ball sizes: overlapping just a touch
  // Between flips
  const REST_MIN = 0.05, REST_MAX = 0.35;   // s, the usual breather
  const PAUSE_CHANCE = 0.1;                  // now and then it stops a while
  const PAUSE_MIN = 0.8, PAUSE_MAX = 1.8;
  // The landing is taken in the body: its hump squashes toward the surface,
  // comes back up past where it was by a little, and settles. Both ends stay
  // put. THUD is how far the middle sinks, in ball sizes.
  const THUD = 0.45, THUD_HZ = 2.6, THUD_DECAY = 0.16;
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
  const REACH = 1.7;        // ball sizes: how near an end must get before a ball is drawn in
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

  // ── The body: an arc of length L from end A to end B ──
  // Bulges toward `up`. fracs run 0 (A) to 1 (B).
  function arc(A, B, ux, uy, fracs, L) {
    const cx = B.x - A.x, cy = B.y - A.y, D = Math.hypot(cx, cy);
    if (D >= L * 0.999 || D < 1e-6) return fracs.map(f => ({ x: A.x + cx * f, y: A.y + cy * f }));
    // Half the arc's angle: solve sin(p)/p = D/L.
    const target = D / L;
    let lo = 1e-4, hi = Math.PI - 1e-4;
    for (let i = 0; i < 40; i++) { const p = (lo + hi) / 2; if (Math.sin(p) / p > target) lo = p; else hi = p; }
    const phi = (lo + hi) / 2, R = L / (2 * phi);
    let nx = -cy / D, ny = cx / D;
    if (nx * ux + ny * uy < 0) { nx = -nx; ny = -ny; }
    const ox = (A.x + B.x) / 2 - nx * R * Math.cos(phi), oy = (A.y + B.y) / 2 - ny * R * Math.cos(phi);
    const an = Math.atan2(ny, nx), ta = an - phi, tb = an + phi;
    const near = Math.hypot(ox + R * Math.cos(ta) - A.x, oy + R * Math.sin(ta) - A.y) < 1;
    const [a0, a1] = near ? [ta, tb] : [tb, ta];
    return fracs.map(f => { const a = a0 + (a1 - a0) * f; return { x: ox + R * Math.cos(a), y: oy + R * Math.sin(a) }; });
  }

  // ── State ──
  // body: the parts joined up, eye first. sEye and sTail are where its two
  // ends stand on the path. dir is the way it's heading: +1 clockwise.
  let body = parts.map((_, i) => i);
  let mode = 'walk';          // walk (two or more joined) | roll (the eye alone) | air (just burst)
  let sEye = 0, sTail = 0, dir = 1;
  let phase = 'rest', t = 0, restFor = 0;
  let flipT = 1, pivotS = 0, fromS = 0, landS = 0, moverIsEye = false, reaching = false;
  let sinceLand = 9, blend = 0;
  let bodyL = 0, up = { x: 0, y: -1 };
  let pulling = null, slotS = 0;
  let aim = null;             // the ball it's going for

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
  function nearestLoose(from) {
    let best = null, bd = Infinity;
    parts.forEach(p => {
      if (p.state !== 'loose' || p.still < SETTLED_S) return;
      const d = Math.abs(toward(from, sOf(p, from)));
      if (d < bd) { bd = d; best = p; }
    });
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

  // The next flip: the end behind swings over the one in front.
  function startFlip(target) {
    const eyeFront = dir * (sEye - sTail) > 0;
    moverIsEye = !eyeFront;
    pivotS = eyeFront ? sEye : sTail;
    fromS = eyeFront ? sTail : sEye;
    const len = L(), maxStride = len * STRIDE_MAX, minStride = size * 0.3;
    let stride = len * rand(STRIDE_MIN, STRIDE_MAX);
    let planned = false;
    reaching = false;
    // Heading for a ball, the last steps are planned so the tail sets down
    // right beside it, one ball-gap short, where the ball joins on without
    // having to move much. Within two strides the eye's step and then the
    // tail's step split what's left evenly. The tail's step is the one that
    // eases in deliberately.
    if (target) {
      const tS = sOf(target, pivotS);
      const tailTo = tS - dir * gapPx;           // where the tail should end up
      const left = dir * (tailTo - pivotS);      // from the planted end to there
      if (!moverIsEye && left <= maxStride) {
        stride = Math.max(minStride, left);
        reaching = planned = true;
      } else if (moverIsEye && left <= 2 * maxStride) {
        stride = Math.min(maxStride, Math.max(minStride, left / 2));
        planned = true;
      }
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
    // The flip that sets the tail beside a ball takes a touch longer.
    if (reaching) flipT *= REACH_FLIP;
    phase = 'flip';
    t = 0;
  }

  // The swinging end, k (0 to 1) through its flip. It swings round the
  // planted end from where it lifted to exactly where it will land, so
  // round a corner it already heads for the next wall. The body keeps its
  // length all the way over. At the top the end reaches out the full body
  // length, so the body stands straight for that instant, which is where
  // its bend changes side without a jump.
  function flipPoint(k) {
    const P = onPath(pivotS), from = onPath(fromS), to = onPath(landS);
    const a0 = Math.atan2(from.y - P.y, from.x - P.x), a1 = Math.atan2(to.y - P.y, to.x - P.x);
    // Always over the top: on screen that's the angle going down when
    // heading clockwise, up when heading back.
    const twoPi = 2 * Math.PI, d = ((a1 - a0) % twoPi + twoPi) % twoPi;
    const sweep = dir > 0 ? d - twoPi : d;
    // Progress: no speed at the start, and at the end LAND_SPEED times the
    // average, or none when it's easing in beside a ball.
    const land = reaching ? 0 : LAND_SPEED;
    const e = (land - 2) * k * k * k + (3 - land) * k * k;
    const lift = Math.pow(Math.sin(Math.PI * e), 1.5);
    const len = L();
    const base = Math.hypot(from.x - P.x, from.y - P.y) * (1 - e) + Math.hypot(to.x - P.x, to.y - P.y) * e;
    const r = base + (len - base) * lift;
    const a = a0 + sweep * e, mid = a0 + sweep / 2;
    bodyL = len;
    up = { x: Math.cos(mid), y: Math.sin(mid) };
    return { x: P.x + r * Math.cos(a), y: P.y + r * Math.sin(a) };
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
      // Pick a ball and stick with it until it's on.
      if (!aim || aim.state !== 'loose') aim = nearestLoose((sEye + sTail) / 2);
      const target = aim;
      if (!target) { restFor = t + 0.25; return; }
      const tS = sOf(target, sTail);
      const fromTail = toward(sTail, tS), fromEye = toward(sEye, tS);
      // Lying under the body (between the two ends): just draw it in.
      const under = Math.sign(fromTail) !== Math.sign(fromEye);
      if (under || Math.abs(fromTail) <= REACH * size) {
        const out = under ? (Math.sign(sTail - sEye) || dir) : (Math.sign(fromTail) || dir);
        startPull(target, sTail + out * gapPx);
        return;
      }
      // Head the way that brings the tail to it.
      dir = Math.sign(fromTail) || 1;
      startFlip(target);
    } else if (phase === 'flip') {
      if (t >= flipT) {
        if (moverIsEye) sEye = landS; else sTail = landS;
        sinceLand = 0;
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
      blend = 0.3;
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
    if (!aim || aim.state !== 'loose') aim = nearestLoose(sEye);
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
      p.spin = p === eye ? rand(-SPIN, SPIN) : 0;
    });
    if (pulling) { pulling.state = 'loose'; pulling = null; }
    body = [0];
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
    sinceLand += dt;
    blend = Math.max(0, blend - dt);
    if (mode === 'walk') stepWalk(dt);
    else if (mode === 'roll') stepRoll(dt);
    stepLoose(dt);
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

  function bodyPoints() {
    const n = body.length;
    let A = onPath(sEye), B = onPath(sTail);
    const front = onPath(dir * (sEye - sTail) > 0 ? sEye : sTail);
    bodyL = L(); up = { x: front.nx, y: front.ny };
    if (phase === 'flip') {
      const f = flipPoint(Math.min(1, t / flipT));
      if (moverIsEye) A = f; else B = f;
    }
    const fracs = body.map((_, i) => i / (n - 1));
    const pts = arc(A, B, up.x, up.y, fracs, bodyL);
    // The landing: the middle of the body gives with the hit and springs
    // back, most in the middle and none at the ends. Starts from nothing, so
    // there's no jump. (Not after easing in beside a ball: that one sets down
    // softly.)
    if (phase !== 'flip' && !reaching && sinceLand < 1) {
      const give = THUD * size * Math.sqrt(L() / LFULL) * Math.sin(2 * Math.PI * THUD_HZ * sinceLand) * Math.exp(-sinceLand / THUD_DECAY);
      pts.forEach((p, i) => {
        const w = Math.sin(Math.PI * fracs[i]);
        p.x -= up.x * give * w;
        p.y -= up.y * give * w;
      });
    }
    return pts;
  }

  function draw(dt) {
    const r = size / 2;
    if (mode === 'walk') {
      const pts = bodyPoints();
      const k = blend > 0 ? 1 - Math.exp(-dt * 18) : 1;
      body.forEach((i, j) => {
        const p = parts[i];
        p.rx += (pts[j].x - p.rx) * k;
        p.ry += (pts[j].y - p.ry) * k;
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
