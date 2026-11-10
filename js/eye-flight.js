// ── Flight physics for the 👁️👄👁️ creature ──
// No DOM in here, so the same code runs on the page, in the tuning panel
// and in an offline simulation.
//
// Gravity pulls down every frame. The only lift is wing beats, applied over
// each beat's downstroke along the body's tilt. Beats come in two kinds:
// small quick ones that come in bursts, and big slow ones that heave it up
// and leave a gap for gravity to take it back down. It beats when it sits
// below its goal or is falling, and the further it has dropped, the more
// likely a big one. Each beat is lopsided, one wing pushing harder than the
// other, which kicks the body into a wobble that a spring slowly rights.
(function (root) {
  const DEFAULTS = {
    gravity: 760,
    bigLift: 500,
    smallLift: 130,
    bigBeat: 0.28,
    smallBeat: 0.14,
    bigChance: 0.08,
    dropBoost: 0.1,
    restMin: 0.1,
    restMax: 0.47,
    burstRest: 0.015,
    eagerness: 0.8,
    sidePush: 0.6,
    lopsided: 0.2,
    wobbleKick: 260,
    wobbleSpring: 26.5,
    wobbleDamp: 3.1,
    travelTilt: 12,
    maxTilt: 26,
    dragX: 1.0,
    dragY: 2.5,
    followLag: 0.45,
    hoverMin: 37,
    hoverMax: 117,
    hoverAbove: -40,
    wanderEvery: 1.3,
    wingUp: 27,
    wingDown: -60,
    wingGlide: 8,
    wingSize: 1,
    pivotX: 13,
    pivotY: 89,
    shoulderX: 0,
    shoulderY: -0.05,
    hopLines: 0.3,
    hopHover: 0.3,
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const DEG = Math.PI / 180;
  const RAISE = 0.3, DOWN = 0.45;   // shares of a beat; the rest is settling

  // P is read live every step, so a tuning panel can change it in flight.
  function create(P, x, y, rand) {
    rand = rand || ((a, b) => a + Math.random() * (b - a));
    const s = {
      x, y, vx: 0, vy: 0,
      wobble: 0, spin: 0, tilt: 0,
      beat: null,          // { t, dur, lift, push, L, R, amp }
      rest: 0,
      wingL: P.wingGlide, wingR: P.wingGlide,
      beats: 0,
    };

    function startBeat(urge, goalX, calm) {
      const bigOdds = clamp(P.bigChance + Math.max(0, urge) * P.dropBoost, 0, 0.95);
      const big = !calm && rand(0, 1) < bigOdds;
      const a = rand(-1, 1) * P.lopsided;
      const dur = (big ? P.bigBeat : P.smallBeat) * rand(0.85, 1.15);
      s.beat = {
        t: 0, dur, big,
        lift: big ? P.bigLift * rand(0.8, 1.15) * (0.85 + 0.3 * clamp(urge, 0, 1))
          : calm ? (P.smallLift + P.bigLift) / 3 * rand(0.8, 1.2)
          : P.smallLift * rand(0.7, 1.3),
        push: clamp((goalX - s.x) * 2 - s.vx * 0.6, -320, 320) * P.sidePush * (big ? 1 : 0.4) + rand(-40, 40),
        L: 1 + a, R: 1 - a,
        amp: big ? 1 : calm ? 0.75 : 0.55,
        startL: s.wingL, startR: s.wingR,
      };
      s.beats++;
    }

    // goal: where it wants to be this frame. calm: small beats only, for
    // holding a spot (the hover after the takeoff hop). Returns the state.
    function step(dt, goalX, goalY, calm) {
      let ax = 0, ay = P.gravity;

      if (!s.beat) {
        s.rest -= dt;
        const urge = ((s.y - goalY) / 90 + s.vy / 300) * P.eagerness;
        // Resting lets gravity win for a moment, but a bad drop cuts the
        // rest short: that is the catch.
        if ((s.rest <= 0 && urge > rand(-0.3, 0)) || urge > 1.6) startBeat(urge, goalX, calm);
      }

      const b = s.beat;
      if (b) {
        // A beat is three parts: raise the wings (no force), sweep them
        // down (all the force), settle back to the glide pose (no force).
        // The push follows the wings' speed through the sweep, which is
        // the derivative of the same eased curve that draws them, so the
        // body heaves exactly as the wings cut down.
        b.t += dt;
        const p = b.t / b.dur;
        const u = (p - RAISE) / DOWN;
        if (u > 0 && u < 1) {
          const k = Math.PI / 2 * Math.sin(Math.PI * u) / (DOWN * b.dur);
          const lift = b.lift * k;
          // Lift points along the body, so a tilted body drifts sideways.
          ay -= lift * Math.cos(s.tilt * DEG);
          ax += lift * Math.sin(s.tilt * DEG) + b.push * k;
          // A stronger left wing raises the left side: clockwise, tilt right.
          s.spin += (b.L - b.R) * P.wobbleKick * k * dt * (b.big ? 1 : 0.5);
        }
        const amp = (P.wingUp - P.wingDown) * b.amp;
        const top = P.wingDown + amp;
        const cos = q => (1 - Math.cos(clamp(q, 0, 1) * Math.PI)) / 2;
        const side = (start, str) => {
          const sTop = P.wingGlide + (top - P.wingGlide) * str;
          const sDown = P.wingGlide + (P.wingDown - P.wingGlide) * str;
          if (p < RAISE) return start + (sTop - start) * cos(p / RAISE);
          if (u < 1) return sTop + (sDown - sTop) * cos(u);
          return sDown + (P.wingGlide - sDown) * cos((p - RAISE - DOWN) / (1 - RAISE - DOWN));
        };
        s.wingL = side(b.startL, clamp(b.L, 0.3, 1.6));
        s.wingR = side(b.startR, clamp(b.R, 0.3, 1.6));
        if (p >= 1) {
          s.beat = null;
          s.rest = b.big ? rand(P.restMin, P.restMax) : P.burstRest * rand(0.5, 2);
        }
      } else {
        const e = 1 - Math.exp(-dt / 0.1);
        s.wingL += (P.wingGlide - s.wingL) * e;
        s.wingR += (P.wingGlide - s.wingR) * e;
      }

      s.vx += ax * dt;
      s.vy += ay * dt;
      s.vx *= Math.exp(-P.dragX * dt);
      s.vy *= Math.exp(-P.dragY * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Wobble: a damped spring the lopsided beats keep kicking.
      s.spin += (-P.wobbleSpring * s.wobble - P.wobbleDamp * s.spin) * dt;
      s.wobble += s.spin * dt;
      const travel = clamp(s.vx / 200, -1, 1) * P.travelTilt;
      const want = clamp(s.wobble + travel, -P.maxTilt, P.maxTilt);
      s.tilt += (want - s.tilt) * (1 - Math.exp(-dt / 0.06));
      return s;
    }

    function kick(vx, vy) { s.vx += vx; s.vy += vy; }

    return { state: s, step, kick };
  }

  const api = { DEFAULTS, create };
  root.EyeFlight = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
