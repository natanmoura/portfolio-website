// Reads the pet's pose and proportions from the eyes, nose and silhouette.
// Pose: roll (eye-line tilt) and yaw (head turn, from where the nose sits between the
// eyes). Proportions: eye spacing vs face width, and how far the nose sits below the eyes.
// These place the eyes and nose on the fixed structure; the structure itself stays a
// simplified breed shape.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function facePose(lm) {
  const [eL, eR] = lm.eyes[0][0] < lm.eyes[1][0] ? lm.eyes : [lm.eyes[1], lm.eyes[0]];
  const D = Math.hypot(eR[0] - eL[0], eR[1] - eL[1]);
  const dir = [(eR[0] - eL[0]) / D, (eR[1] - eL[1]) / D];
  const up = [dir[1], -dir[0]];
  const mid = [(eL[0] + eR[0]) / 2, (eL[1] + eR[1]) / 2];
  const N = lm.nose;
  const rel = [N[0] - mid[0], N[1] - mid[1]];
  const nx = (rel[0] * dir[0] + rel[1] * dir[1]) / D; // nose offset along the eye line
  const drop = -(rel[0] * up[0] + rel[1] * up[1]); // nose below the eye line, px
  // horizontal eye-to-nose spans: the side turned toward the camera has the longer span
  const dl = Math.max(1e-3, D / 2 + nx * D), dr = Math.max(1e-3, D / 2 - nx * D);
  const near = dl >= dr ? 0 : 1;
  const ratio = Math.max(dl, dr) / Math.min(dl, dr);
  // the nose sits ahead of the eyes, so a turned head shifts it toward the far side
  const yaw = Math.atan2(nx, 0.55);
  const Dfront = D / Math.max(0.6, Math.cos(yaw));
  return { eyes: [eL, eR], nose: N, D, Dfront, dir, up, mid, drop, nx, yaw, near, ratio, roll: Math.atan2(dir[1], dir[0]) };
}

function maskAt(seg) {
  if (!seg) return null;
  if (!seg.alpha) {
    const c = seg.mask;
    seg.alpha = { W: c.width, H: c.height, d: c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data };
  }
  const { W, H, d } = seg.alpha;
  return (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : d[(yi * W + xi) * 4 + 3];
  };
}

export function maskSampler(seg) { return maskAt(seg); }

// how far the silhouette reaches from p along unit dir, in photo px
function reach(at, p, dir, maxLen) {
  let last = 0;
  const step = Math.max(1, maxLen / 120);
  for (let s = 0; s <= maxLen; s += step) {
    if (at(p[0] + dir[0] * s, p[1] + dir[1] * s) > 127) last = s;
    else if (s - last > maxLen * 0.06) break;
  }
  return last;
}

// prop for construct.faceLayout: eye spacing from eye-distance / face-width at eye level,
// nose drop in frontal eye distances
export function proportions(pose, seg, layout0) {
  const prop = { noseDrop: pose.drop / pose.Dfront };
  const at = maskAt(seg);
  if (at) {
    const { D, dir, mid } = pose;
    const l = reach(at, mid, [-dir[0], -dir[1]], D * 2.5), r = reach(at, mid, dir, D * 2.5);
    if (l > D * 0.55 && r > D * 0.55) {
      // eye distance over face width is fairly stable under a head turn
      const q = clamp(D / (l + r), 0.22, 0.55);
      prop.eyeX = q * 0.97 * layout0.W;
    }
  }
  return prop;
}
