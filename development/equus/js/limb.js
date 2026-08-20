// L4 limb. Solves each leg to its hoof target.
//
// Horse limbs move almost purely in the sagittal plane, abduction is minimal, so
// the whole solve happens in 2D inside a plane whose normal is the body's lateral
// axis. That removes a whole class of IK failure and makes the anatomy cheap to
// enforce.
//
// The method is cyclic coordinate descent over the real bone chain, six links in
// front and five behind, rather than a lumped three link approximation. That
// matters more than it sounds. Lumping the scapula and the humerus into one rigid
// link leaves the foreleg 99.8 percent extended at rest, which gives it almost no
// reach at all, and every hoof then slides because it cannot get where it was
// asked to go. A real forelimb gets its reach from the shoulder and the elbow
// flexing together.
//
// Three anatomical constraints ride on top of the solve.
//
// The forelimb has no bony attachment to the trunk at all. There is no clavicle,
// so the whole ribcage hangs in a muscular sling between the two scapulae and the
// scapula slides and rotates across the ribs. That is modelled here as a limb
// root that can translate fore and aft, and it is what lets a foreleg reach
// without the body having to drop to buy the reach.
//
// The hind leg's stifle and hock can only flex or extend together, because the
// peroneus tertius on the front of the tibia and the superficial digital flexor
// tendon behind it tie them. A solver that lets them move independently reads as
// wrong instantly.
//
// The foreleg has its own version through the lacertus fibrosus, the tendon of
// the biceps brachii, which ties the elbow and the carpus. That is the forelimb
// stay apparatus, the thing that lets a horse doze standing up.
//
// Both are enforced as limits on signed joint turn, which is bounded by the
// anatomy, rather than on free angles, which are not and which diverge.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const DEG = Math.PI / 180;

// Chains as they really are, root first, hoof last.
const CHAINS = {
  F: ['scapula.F', 'shoulder.F', 'elbow.F', 'carpus.F', 'fetlock.F', 'pastern.F', 'hoof.F'],
  H: ['hip.H', 'stifle.H', 'hock.H', 'fetlock.H', 'pastern.H', 'hoof.H'],
};

// Per joint bend range, as [minBend, maxBend] in degrees of absolute turn away
// from straight. The DIRECTION a joint bends is taken from the rest pose and
// never allowed to flip, which is what stops a knee from inverting. Only the
// magnitude is bounded here.
//
// Framing it this way rather than as an allowance either side of rest matters:
// anatomy is described as how far a joint flexes from straight, and guessing
// which arithmetic direction counts as flexion gets it backwards on about half
// the joints, which then pins them at a limit and costs the leg its reach.
//
// A minimum above zero keeps the joint from passing through straight, since
// straight is where the bend direction becomes ambiguous.
const BEND = {
  'shoulder.F': [14, 72],
  'elbow.F': [12, 104], // flexes hard in swing
  'carpus.F': [1, 98], // the knee folds right up under the body
  'fetlock.F': [2, 62], // driven by force in L3, not solved here
  'pastern.F': [1, 52], // pins at its limit under load if this is much tighter
  'stifle.H': [10, 84],
  'hock.H': [8, 84],
  'fetlock.H': [2, 62],
  'pastern.H': [1, 52],
};

// Joints tied to each other by tendon. `[a, b, gain]` means b's turn tracks a's.
const COUPLED = {
  F: [['elbow.F', 'carpus.F', 0.55]], // lacertus fibrosus
  H: [['stifle.H', 'hock.H', 1.0]], // peroneus tertius and the SDF tendon
};

function signedTurn(ax, ay, bx, by) {
  // Turn from vector a to vector b, signed, in the 2D solve plane.
  return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
}

export function createLimbSolver(skel) {
  const rest = {};

  for (const key of ['F.L', 'F.R', 'H.L', 'H.R']) {
    const kind = key[0];
    const side = key.slice(2);
    const names = CHAINS[kind].map((n) => `${n}.${side}`);
    const pts = names.map((n) => skel.restWorld.get(n));

    // Rest positions flattened into the sagittal plane: u is forward, v is up.
    const u = pts.map((p) => p.x);
    const v = pts.map((p) => p.y);

    const len = [];
    for (let i = 0; i < pts.length - 1; i++) {
      len.push(Math.hypot(u[i + 1] - u[i], v[i + 1] - v[i]));
    }

    // Rest signed turn at each interior joint, index 1..n-1.
    const restTurn = [0];
    for (let i = 1; i < pts.length - 1; i++) {
      restTurn.push(
        signedTurn(u[i] - u[i - 1], v[i] - v[i - 1], u[i + 1] - u[i], v[i + 1] - v[i])
      );
    }

    // Turn limits. The bend DIRECTION comes from the rest pose and is never
    // allowed to flip, so only the magnitude is bounded. That is what keeps a
    // knee from inverting while still letting it fold all the way up.
    const lo = [0];
    const hi = [0];
    for (let i = 1; i < pts.length - 1; i++) {
      const nm = CHAINS[kind][i];
      const [minMag, maxMag] = BEND[nm] ?? [2, 70];
      const s = Math.sign(restTurn[i]) || 1;
      // Widen the range if the rest pose already sits outside it, so a skeleton
      // edit can never create a joint that starts out illegal.
      const restMag = Math.abs(restTurn[i]);
      const a = Math.min(minMag * DEG, restMag);
      const b = Math.max(maxMag * DEG, restMag);
      lo.push(s > 0 ? a : -b);
      hi.push(s > 0 ? b : -a);
    }

    rest[key] = {
      kind,
      side,
      names,
      u,
      v,
      len,
      restTurn,
      lo,
      hi,
      total: len.reduce((a, b) => a + b, 0),
      straight: Math.hypot(u[u.length - 1] - u[0], v[v.length - 1] - v[0]),
      coupled: (COUPLED[kind] ?? []).map(([a, b, g]) => [
        CHAINS[kind].indexOf(a),
        CHAINS[kind].indexOf(b),
        g,
      ]),
      // Joints whose angle is dictated by something other than the IK. Tendon
      // followers, and the fetlock, which is a passive spring answering to ground
      // reaction force rather than a joint anything actuates.
      driven: (() => {
        const d = new Array(CHAINS[kind].length).fill(false);
        for (const [, b] of COUPLED[kind] ?? []) d[CHAINS[kind].indexOf(b)] = true;
        d[CHAINS[kind].indexOf(`fetlock.${kind}`)] = true;
        return d;
      })(),

      // Fetlock spring geometry. There is no muscle below the carpus or the hock,
      // only tendon, so the fetlock sinks under load and springs back when the
      // limb goes light. Modelling it as a spring rather than animating it is what
      // makes impact absorption come out for free.
      fetlockIndex: CHAINS[kind].indexOf(`fetlock.${kind}`),
      // Straight line from the fetlock to the hoof, and its rest angle away from
      // vertical. Together these convert a vertical compression in metres into the
      // joint angle that produces it.
      pasternLen: (() => {
        const i = CHAINS[kind].indexOf(`fetlock.${kind}`);
        return Math.hypot(u[u.length - 1] - u[i], v[v.length - 1] - v[i]);
      })(),
      pasternRest: (() => {
        const i = CHAINS[kind].indexOf(`fetlock.${kind}`);
        return Math.atan2(u[u.length - 1] - u[i], -(v[v.length - 1] - v[i]));
      })(),
      // The sling. How far this limb's root may translate fore and aft, in metres
      // at unit scale, and the rest local offset it translates away from.
      //
      // The forelimb gets the most because it has no bony attachment to the trunk
      // at all: no clavicle, so the ribcage hangs in muscle between the scapulae
      // and the scapula slides across the ribs. The hind gets less, and what it
      // gets stands in for lumbosacral flexion and pelvic rotation rather than for
      // any joint sliding, since the hip genuinely is bolted to the pelvis.
      maxSlide: kind === 'F' ? 0.1 : 0.06,
      restLocal: skel.bones.get(names[0]).position.clone(),
      hoofOffsetU: u[u.length - 1] - u[0],
      slide: 0,

      // Live solve state, kept between frames so the chain starts from where it
      // was. That gives temporal coherence for free and, more importantly, keeps
      // each joint bending the way it was already bending instead of flipping.
      su: u.slice(),
      sv: v.slice(),
      seeded: false,
    };
  }

  const _fwd = new THREE.Vector3();
  const _nrm = new THREE.Vector3();
  const _rp = new THREE.Vector3();
  const _rt = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _dd = new THREE.Vector3();
  const _hoof = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _pq = new THREE.Quaternion();

  // Signed turn at interior joint j, between bone j-1 and bone j.
  function turnAt(r, j) {
    return signedTurn(
      r.su[j] - r.su[j - 1],
      r.sv[j] - r.sv[j - 1],
      r.su[j + 1] - r.su[j],
      r.sv[j + 1] - r.sv[j]
    );
  }

  // Rotate every point after j about point j.
  function rotateFrom(r, j, a) {
    if (Math.abs(a) < 1e-9) return;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ox = r.su[j];
    const oy = r.sv[j];
    for (let i = j + 1; i < r.su.length; i++) {
      const x = r.su[i] - ox;
      const y = r.sv[i] - oy;
      r.su[i] = ox + x * c - y * s;
      r.sv[i] = oy + x * s + y * c;
    }
  }

  // Put the chain back in its rest shape, hung from the current root height. Used
  // to seed the first frame, and as the escape route when the solver gets stuck.
  function seedFromRest(r, rootV, scale) {
    for (let i = 0; i < r.su.length; i++) {
      r.su[i] = (r.u[i] - r.u[0]) * scale;
      r.sv[i] = rootV + (r.v[i] - r.v[0]) * scale;
    }
  }

  // Restore exact bone lengths while keeping current directions. Needed after the
  // animal is rescaled, and cheap insurance against drift.
  function rebuild(r, rootU, rootV) {
    r.su[0] = rootU;
    r.sv[0] = rootV;
    for (let i = 1; i < r.su.length; i++) {
      let dx = r.su[i] - r.su[i - 1];
      let dy = r.sv[i] - r.sv[i - 1];
      const m = Math.hypot(dx, dy) || 1;
      r.su[i] = r.su[i - 1] + (dx / m) * r.len[i - 1];
      r.sv[i] = r.sv[i - 1] + (dy / m) * r.len[i - 1];
    }
  }

  // Tendon coupling for one leader joint. The follower is downstream of its
  // leader, so rotating the follower cannot disturb the leader's angle, which is
  // what makes it safe to enforce this in the middle of a sweep.
  function applyCoupling(r, leaderIndex) {
    for (const [ai, bi, gain] of r.coupled) {
      if (ai !== leaderIndex) continue;
      if (ai < 1 || bi < 1 || bi >= r.su.length - 1) continue;
      const want = THREE.MathUtils.clamp(
        r.restTurn[bi] + gain * (turnAt(r, ai) - r.restTurn[ai]),
        r.lo[bi],
        r.hi[bi]
      );
      rotateFrom(r, bi, want - turnAt(r, bi));
    }
  }

  function applyAllCouplings(r) {
    for (const [ai] of r.coupled) applyCoupling(r, ai);
  }

  // Drive the fetlock from limb compression. `drop` is how far the fetlock joint
  // sinks toward the ground, in metres, which comes straight from force over
  // stiffness because the distal limb is a linear spring.
  //
  // Geometry: the fetlock sits pasternLen above the hoof at pasternRest away from
  // vertical, so sinking by `drop` means the pastern lies down until its vertical
  // component has shortened by that much. At the measured gallop peak this works
  // out to roughly 30 degrees of extension, which is what a horse actually does.
  //
  // Rotating a joint leaves every joint below it unchanged, so setting this once
  // before the sweep is enough. The sweep then skips it.
  function applyFetlock(r, drop) {
    const i = r.fetlockIndex;
    if (i < 1 || i >= r.su.length - 1) return;
    const L = r.pasternLen * (r.scaleApplied ?? 1);
    if (L <= 1e-6) return;

    const target = THREE.MathUtils.clamp(Math.cos(r.pasternRest) - drop / L, -0.999, 0.999);
    const want = Math.acos(target);
    const delta = want - Math.abs(r.pasternRest);

    const s = Math.sign(r.restTurn[i]) || 1;
    const turn = THREE.MathUtils.clamp(r.restTurn[i] + s * delta, r.lo[i], r.hi[i]);
    rotateFrom(r, i, turn - turnAt(r, i));
  }

  // Cyclic coordinate descent. Each joint in turn rotates to bring the hoof as
  // close to the target as it can, and the rotation is clamped so the joint never
  // leaves its anatomical range.
  //
  // CCD rather than FABRIK on purpose. FABRIK finds positions and then has to be
  // projected back onto the joint limits, which throws away the solution it just
  // found and, with limits this tight, settles with the whole limb rotated the
  // wrong way. CCD works in angle space, so the limits are a clamp on the thing it
  // is already solving for.
  function ccd(r, rootU, rootV, tgtU, tgtV, iterations = 12, fetlockDrop = 0) {
    const last = r.su.length - 1;
    rebuild(r, rootU, rootV);
    // The fetlock answers to force, not to the target, so it is set first and then
    // left alone. Rotating a joint never disturbs the joints below it, so this
    // survives the whole sweep.
    applyFetlock(r, fetlockDrop);

    const dist = Math.hypot(tgtU - rootU, tgtV - rootV);
    const maxR = r.total * 0.995;
    let tu = tgtU;
    let tv = tgtV;
    let tooFar = false;
    if (dist > maxR) {
      // Aim at the edge of the workspace instead of somewhere impossible, so the
      // chain straightens toward the target rather than thrashing.
      tooFar = true;
      tu = rootU + ((tgtU - rootU) / dist) * maxR;
      tv = rootV + ((tgtV - rootV) / dist) * maxR;
    }

    // Bring any stale followers in line before measuring anything.
    applyAllCouplings(r);

    for (let it = 0; it < iterations; it++) {
      for (let j = last - 1; j >= 0; j--) {
        // A driven joint has no freedom of its own, its angle belongs to the
        // tendon that ties it to the joint above. Sweeping it would fight the
        // coupling and, since the segment below the carpus is half a metre long,
        // that fight throws the hoof most of a metre off target.
        if (r.driven[j]) continue;

        const ex = r.su[last] - r.su[j];
        const ey = r.sv[last] - r.sv[j];
        const tx = tu - r.su[j];
        const ty = tv - r.sv[j];
        if (Math.hypot(ex, ey) < 1e-7 || Math.hypot(tx, ty) < 1e-7) continue;

        let a = signedTurn(ex, ey, tx, ty);
        if (j >= 1) {
          // Rotating here changes this joint's turn by exactly `a`, so clamping
          // the turn clamps the rotation.
          const cur = turnAt(r, j);
          a = THREE.MathUtils.clamp(cur + a, r.lo[j], r.hi[j]) - cur;
        }
        rotateFrom(r, j, a);
        // Keep this joint's follower, if it has one, consistent immediately.
        applyCoupling(r, j);
      }
      if (Math.hypot(r.su[last] - tu, r.sv[last] - tv) < 1e-4) break;
    }

    return { tooFar, err: Math.hypot(r.su[last] - tgtU, r.sv[last] - tgtV), dist, maxR };
  }

  function solveOne(key, target, heading, scale, opts) {
    const r = rest[key];
    const rootBone = skel.bones.get(r.names[0]);

    // Sagittal plane for this limb, taken from the vertebra the limb hangs off
    // rather than from the body's heading.
    //
    // This is what makes the legs follow the spine. A forelimb hangs off the
    // thorax and a hind off the pelvis, and when the trunk bends into a turn those
    // two rotate by different amounts, so each limb's plane of travel rotates with
    // its own attachment. Driving every limb off one body heading leaves the legs
    // swinging in a plane the body has left, which reads as the legs being bolted
    // to the world instead of to the horse.
    if (rootBone.parent) {
      rootBone.parent.getWorldQuaternion(_pq);
      _fwd.set(1, 0, 0).applyQuaternion(_pq);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-8) _fwd.set(Math.cos(heading), 0, -Math.sin(heading));
      _fwd.normalize();
    } else {
      _fwd.set(Math.cos(heading), 0, -Math.sin(heading));
    }
    _nrm.crossVectors(UP, _fwd).normalize();

    // The sling. Put the root back where it rests, measure how far ahead or
    // behind the hoof is asking it to be, then let it slide part of the way.
    //
    // This is the single mechanism that unlocks stride length. A standing horse's
    // foreleg is a near straight column whose length is its own shoulder height,
    // so rotating it about a fixed pivot reaches the ground only directly below.
    // Any forward reach has to come from either shortening the column, which means
    // the body drops, or moving the pivot, which is what the sling does. Real
    // horses use the sling, which is why they reach without squatting.
    rootBone.position.copy(r.restLocal);
    if (r.maxSlide > 0) {
      rootBone.updateMatrixWorld(true);
      rootBone.getWorldPosition(_rp);
      const ahead = _fwd.dot(_dir.subVectors(target, _rp)) - r.hoofOffsetU * scale;
      // Gain chosen so the slide reaches its limit at the ends of a full stance
      // and stays proportional in between. Higher and it pins for most of the
      // cycle, which turns a moving joint into a constant offset.
      const slide = THREE.MathUtils.clamp(
        ahead * (opts.slingGain ?? 0.16),
        -r.maxSlide * scale,
        r.maxSlide * scale
      );
      // The root's local X is horse forward, so the slide goes straight in.
      rootBone.position.x += slide;
      r.slide = slide;
    } else {
      r.slide = 0;
    }
    rootBone.updateMatrixWorld(true);
    rootBone.getWorldPosition(_rp);

    // Project the target into the plane through the limb root, so a target that
    // has drifted sideways cannot pull the leg out of its plane.
    _rt.copy(target);
    _rt.addScaledVector(_nrm, -_nrm.dot(_dir.subVectors(_rt, _rp)));

    // Into 2D. u is forward from the root, v is world height.
    const rootU = 0;
    const rootV = _rp.y;
    const tgtU = _fwd.dot(_dir.subVectors(_rt, _rp));
    const tgtV = _rt.y;

    if (!r.seeded) {
      seedFromRest(r, rootV, scale);
      r.seeded = true;
    }

    // Lengths scale with the animal.
    if (Math.abs((r.scaleApplied ?? 0) - scale) > 1e-6) {
      const base = r.lenBase ?? (r.lenBase = r.len.slice());
      for (let i = 0; i < r.len.length; i++) r.len[i] = base[i] * scale;
      r.total = r.len.reduce((a, b) => a + b, 0);
      r.scaleApplied = scale;
    }

    // 40 rather than 18, because driving the fetlock yanks the hoof off target at
    // the start of every solve and the sweep has to recover from that as well as
    // track the target. It is four limbs of six joints, so the cost is nothing.
    const iters = opts.iterations ?? 40;
    const drop = opts.fetlockDrop ?? 0;
    let res = ccd(r, rootU, rootV, tgtU, tgtV, iters, drop);

    // CCD converges to a local minimum, and starting each frame from the previous
    // pose means a bad one is sticky: after a gait change a hind limb could sit 94
    // mm off target and stay there indefinitely, because every frame began from
    // the same stuck configuration.
    //
    // So if the result is poor and the target was actually reachable, throw the
    // pose away, re-seed from rest and solve again. Keep whichever came out
    // better, so the retry can never make things worse.
    const tol = 0.015 * scale;
    if (!res.tooFar && res.err > tol) {
      const su = r.su.slice();
      const sv = r.sv.slice();
      const before = res;
      seedFromRest(r, rootV, scale);
      const retry = ccd(r, rootU, rootV, tgtU, tgtV, iters, drop);
      if (retry.err < before.err) {
        res = retry;
      } else {
        r.su.set ? r.su.set(su) : (r.su = su);
        r.sv.set ? r.sv.set(sv) : (r.sv = sv);
        for (let i = 0; i < su.length; i++) {
          r.su[i] = su[i];
          r.sv[i] = sv[i];
        }
      }
    }

    // Back from the 2D solve to bone rotations.
    //
    // A bone's local rotation is what orients its children, so what we need is:
    //   localQuat x restOffsetToChild = inverse(parentWorldQuat) x desiredWorldDir
    //
    // Doing it this way, entirely against the parent's live world rotation, is the
    // only version that survives the body being rotated. An earlier version built
    // a world rotation from a rest direction pre-rotated by the heading, which
    // quietly dropped the body's own rotation out of the result: the 2D solver
    // reported half a millimetre while the rendered hoof was 350 mm from its
    // target with the horse facing the other way. It agreed only at heading zero,
    // which is exactly where every test happened to sit.
    //
    // Taking the offset straight off the child bone also means the parent chain's
    // orientation, including the spine bend, is accounted for without this code
    // having to know anything about it.
    const n = r.su.length;
    for (let i = 0; i < n - 1; i++) {
      const bone = skel.bones.get(r.names[i]);
      const child = skel.bones.get(r.names[i + 1]);
      const du = r.su[i + 1] - r.su[i];
      const dv = r.sv[i + 1] - r.sv[i];
      _dir.copy(_fwd).multiplyScalar(du).addScaledVector(UP, dv).normalize();

      if (bone.parent) {
        bone.parent.getWorldQuaternion(_pq);
        _dir.applyQuaternion(_pq.invert());
      }
      _dd.copy(child.position).normalize();
      bone.quaternion.setFromUnitVectors(_dd, _dir);
      bone.updateMatrixWorld(true);
    }

    // Where the hoof ACTUALLY ended up, in the world, after the rotations were
    // written. This is the number that matters and the one worth watching.
    //
    // `err` below is what the 2D solver believes it achieved, and the two can
    // disagree badly if anything between the solve and the bones is wrong. They
    // did: the solver read half a millimetre while the real hoof sat 350 mm away.
    // A solver grading its own homework is not verification.
    skel.bones.get(r.names[r.names.length - 1]).getWorldPosition(_hoof);
    const worldErr = _hoof.distanceTo(target);

    return {
      reached: !res.tooFar && worldErr < 0.02 * scale,
      tooFar: res.tooFar,
      // Fraction of the leg's length the target is asking for. Past 1 it is out
      // of reach and the hoof will slide, which is the failure to watch.
      load: res.dist / r.total,
      // What the 2D solver thinks it achieved.
      err: res.err,
      // What actually happened.
      worldErr,
    };
  }

  function solve(targets, heading, scale, opts = {}) {
    const out = {};
    for (const key of ['F.L', 'F.R', 'H.L', 'H.R']) {
      out[key] = solveOne(key, targets[key].pos, heading, scale, {
        ...opts,
        // Per limb, because the lead and non lead legs carry measurably different
        // peak force and so compress by different amounts.
        fetlockDrop: opts.compression?.[key] ?? 0,
      });
    }
    return out;
  }

  // Longest horizontal reach from directly below the limb root at a given root
  // height. Stride length has to stay inside this or the hooves slide.
  function reachAt(key, rootHeight, scale = 1) {
    const r = rest[key];
    const total = r.total * (r.scaleApplied ? 1 : scale) * 0.97;
    if (rootHeight >= total) return 0;
    return Math.sqrt(total * total - rootHeight * rootHeight);
  }

  return { solve, rest, reachAt };
}
