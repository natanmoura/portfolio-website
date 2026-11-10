// Textures the head plane by plane, never by projecting the photo through the model:
//   - every facet gets one flat color sampled from the matching area of the photo
//     (the low-poly look), fading to the coat color as it turns away from the camera
//   - a fur detail tile, cut from a clean patch of coat, is laid over every facet along
//     the head's flow (from the nose back over the skull), at the photo's own density
//   - the eyes are lifted as soft patches and laid flat on their eye planes, the nose and
//     mouth on the nose plane, leveled for roll and corrected for head turn
//   - each ear's triangle (tip, inner and outer base) is mapped onto its ear flap
import { facePose, maskSampler } from './fit.js';
import { drawEye, drawNose, drawMouth } from './paint.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const parse = (s) => {
  const m = s.match(/\d+(\.\d+)?/g);
  if (s[0] === '#') return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  return m.slice(0, 3).map(Number);
};
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// A fur sample: the cleanest fully-masked patch among spots around the face, mirrored
// 2x2 so it tiles without seams.
function furTile(src, seg, pose) {
  const at = maskSampler(seg);
  const { D, dir, up, mid, roll } = pose;
  const T = Math.max(12, D * 0.42);
  const spots = [[0, 0.75], [0, 1.15], [0, -2.1]];
  for (const r of [1.0, 1.45]) for (let a = 0; a < 12; a++) spots.push([Math.cos(a * Math.PI / 6) * r, Math.sin(a * Math.PI / 6) * r]);
  const nv = -pose.drop / D;
  const avoid = [[-0.5, 0], [0.5, 0], [pose.nx, nv], [pose.nx, nv - 0.45]];
  const probe = canvas(24, 24);
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  let best = null;
  for (const [u, v] of spots) {
    if (avoid.some(([au, av]) => Math.hypot(u - au, v - av) < 0.55)) continue;
    const c = [mid[0] + (dir[0] * u + up[0] * v) * D, mid[1] + (dir[1] * u + up[1] * v) * D];
    if (c[0] - T / 2 < 0 || c[1] - T / 2 < 0 || c[0] + T / 2 > src.naturalWidth || c[1] + T / 2 > src.naturalHeight) continue;
    // the whole sample has to sit well inside the pet's cutout, or background leaks into the coat
    let inside = 0, n = 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      n++;
      if (at && at(c[0] + (i / 3) * T * 0.75, c[1] + (j / 3) * T * 0.75) > 230) inside++;
    }
    if (inside < n) continue;
    pctx.clearRect(0, 0, 24, 24);
    pctx.drawImage(src, c[0] - T / 2, c[1] - T / 2, T, T, 0, 0, 24, 24);
    const d = pctx.getImageData(0, 0, 24, 24).data;
    const ls = [];
    for (let i = 0; i < d.length; i += 4) ls.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
    const sorted = ls.slice().sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1] || 1;
    const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
    const sd = Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / ls.length);
    // features (eyes, mouth, collar, shadows) show up as pixels far darker or brighter than the coat
    const odd = ls.filter((l) => l < med * 0.6 || l > med * 1.6 + 20).length / ls.length;
    const score = -sd / 40 - odd * 8 - Math.hypot(u, v) * 0.05;
    if (!best || score > best.score) best = { c, score };
  }
  const t = Math.round(T);
  const one = canvas(t, t);
  const o = one.getContext('2d', { willReadFrequently: true });
  if (best) { o.translate(t / 2, t / 2); o.rotate(-roll); o.drawImage(src, -best.c[0], -best.c[1]); }
  // detail only: the tile's luminance around mid-grey, so soft-light keeps each facet's color
  const id = o.getImageData(0, 0, t, t);
  const d = id.data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { sum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; n++; }
  const avg = sum / Math.max(1, n);
  const meanC = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    meanC[0] += d[i]; meanC[1] += d[i + 1]; meanC[2] += d[i + 2];
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const g = Math.max(0, Math.min(255, 128 + (l - avg) * 1.4));
    d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
  }
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.putImageData(id, 0, 0);
  const tile = canvas(t * 2, t * 2);
  const x = tile.getContext('2d');
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    x.save(); x.translate(sx > 0 ? 0 : t * 2, sy > 0 ? 0 : t * 2); x.scale(sx, sy); x.drawImage(one, 0, 0); x.restore();
  }
  return { tile, mean: meanC.map((v) => v / Math.max(1, n)), at: best && best.c, size: T };
}

// A soft-edged elliptical patch of the photo, leveled by roll, x-stretched by fx,
// optionally mirrored. One canvas pixel = one photo pixel.
function lift(src, pose, { pc, rx, ry, feather = 0.35, fx = 1, mirror = false }) {
  const c = canvas(2 * rx * fx, 2 * ry);
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  x.scale(fx * (mirror ? -1 : 1), 1);
  x.rotate(-pose.roll);
  x.translate(-pc[0], -pc[1]);
  x.drawImage(src, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.setTransform(c.width / 2, 0, 0, c.height / 2, c.width / 2, c.height / 2);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1 - feather, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-1, -1, 2, 2);
  return c;
}

// Photo similarity anchored on the eyes: head x/y (relative to the head center) -> photo px.
function eyeMap(pose, tpl) {
  const c = tpl.center;
  const [tl, tr] = tpl.eyes.map((e) => [e[0] - c[0], e[1] - c[1]]);
  const [pl, pr] = pose.eyes.map((p) => [p[0], -p[1]]);
  const dt = [tr[0] - tl[0], tr[1] - tl[1]], dp = [pr[0] - pl[0], pr[1] - pl[1]];
  const den = dt[0] * dt[0] + dt[1] * dt[1];
  const a = [(dp[0] * dt[0] + dp[1] * dt[1]) / den, (dp[1] * dt[0] - dp[0] * dt[1]) / den];
  const b = [pl[0] - (a[0] * tl[0] - a[1] * tl[1]), pl[1] - (a[0] * tl[1] + a[1] * tl[0])];
  return (p) => {
    const x = p[0] - c[0], y = p[1] - c[1];
    return [a[0] * x - a[1] * y + b[0], -(a[0] * y + a[1] * x + b[1])];
  };
}

export function photoTexture(img, seg, lm, tpl) {
  const pose = facePose(lm);
  const toPhoto = eyeMap(pose, tpl);
  const Dt = Math.hypot(tpl.eyes[1][0] - tpl.eyes[0][0], tpl.eyes[1][1] - tpl.eyes[0][1]);
  const s = Dt / pose.Dfront; // head units per photo px
  const fur = furTile(img, seg, pose);
  const furMean = fur.mean;

  // a small copy of the photo and mask for sampling facet colors
  const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.round(img.naturalWidth * k), sh = Math.round(img.naturalHeight * k);
  const sc = canvas(sw, sh);
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, sw, sh);
  const pix = sctx.getImageData(0, 0, sw, sh).data;
  sctx.clearRect(0, 0, sw, sh);
  sctx.drawImage(seg.mask, 0, 0, sw, sh);
  const msk = sctx.getImageData(0, 0, sw, sh).data;
  const sample = (p) => {
    const x = Math.round(p[0] * k), y = Math.round(p[1] * k);
    if (x < 0 || y < 0 || x >= sw || y >= sh) return null;
    const i = (y * sw + x) * 4;
    if (msk[i + 3] < 128) return null;
    return [pix[i], pix[i + 1], pix[i + 2]];
  };

  // one flat color per facet from the photo area it corresponds to
  const colorOf = (face) => {
    const P = face.F.P, n = face.F.n;
    const vis = smooth(0.08, 0.55, n[2]);
    if (vis <= 0) return rgb(furMean);
    const c = P.reduce((s2, p) => [s2[0] + p[0] / P.length, s2[1] + p[1] / P.length, s2[2] + p[2] / P.length], [0, 0, 0]);
    const pts = [c, ...P.map((p) => [c[0] + (p[0] - c[0]) * 0.55, c[1] + (p[1] - c[1]) * 0.55])];
    const got = pts.map((p) => sample(toPhoto(p))).filter(Boolean);
    if (!got.length) return rgb(furMean);
    const avg = got.reduce((a, b) => [a[0] + b[0] / got.length, a[1] + b[1] / got.length, a[2] + b[2] / got.length], [0, 0, 0]);
    return rgb(lerp3(furMean, avg, vis * Math.min(1, got.length / 3)));
  };

  // eyes and nose, lifted at the photo's own scale
  const { D, Dfront: Df, up, nose, eyes, near, ratio } = pose;
  const down = [-up[0], -up[1]];
  const strong = ratio > 1.9;
  const patches = [];
  const eyePatches = eyes.map((e, i) => {
    const far = i !== near;
    const o = far && strong
      ? { pc: eyes[near], rx: 0.34 * Df, ry: 0.28 * Df, mirror: true }
      : { pc: e, rx: 0.34 * Df, ry: 0.28 * Df, fx: far ? Math.min(1.6, ratio) : 1 };
    patches.push(o);
    return { canvas: lift(img, pose, o), scale: s };
  });
  const noseC = [nose[0] + down[0] * 0.18 * D, nose[1] + down[1] * 0.18 * D];
  const no = { pc: noseC, rx: 0.42 * Df, ry: 0.4 * Df, feather: 0.4 };
  patches.push(no);
  const nosePatch = { canvas: lift(img, pose, no), scale: s, offset: 0.18 * D * s };

  // The photo each cell shows, with the eyes and nose cleaned out so they only ever appear
  // on their own cells: each feature area is filled with the fur color just around it.
  const clean = canvas(img.naturalWidth, img.naturalHeight);
  const cx = clean.getContext('2d', { willReadFrequently: true });
  cx.drawImage(seg.cut || img, 0, 0);
  const ringColor = (pc, rx, ry) => {
    const got = [];
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      const p = sample([pc[0] + Math.cos(t) * rx * 1.25, pc[1] + Math.sin(t) * ry * 1.25]);
      if (p) got.push(p);
    }
    if (!got.length) return furMean;
    got.sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]));
    const mid = got.slice(Math.floor(got.length * 0.25), Math.ceil(got.length * 0.75));
    return mid.reduce((s2, p) => [s2[0] + p[0] / mid.length, s2[1] + p[1] / mid.length, s2[2] + p[2] / mid.length], [0, 0, 0]);
  };
  // both eyes (even one that was mirrored for a turned head) and the nose and mouth
  const featureAreas = [...eyes.map((e) => ({ pc: e, rx: 0.36 * Df, ry: 0.3 * Df })), { pc: noseC, rx: 0.42 * Df, ry: 0.4 * Df }];
  const inArea = (p, o, k) => {
    const dx = p[0] - o.pc[0], dy = p[1] - o.pc[1];
    const c2 = Math.cos(-pose.roll), s2 = Math.sin(-pose.roll);
    const u = (dx * c2 - dy * s2) / (o.rx * k), v = (dx * s2 + dy * c2) / (o.ry * k);
    return u * u + v * v < 1;
  };
  // Clone stamp: cover each feature with real fur (no smeared color). Several small stamps
  // per feature, each copied from the nearest clean spot whose tone matches the fur
  // around the feature. Small stamps fit between features on tight faces.
  const src0 = canvas(img.naturalWidth, img.naturalHeight);
  src0.getContext('2d').drawImage(clean, 0, 0);
  const cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  for (const o of featureAreas) {
    const col = ringColor(o.pc, o.rx, o.ry);
    const r = o.rx * 0.65;
    const spots = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * 0.6, Math.sin((i / 6) * Math.PI * 2) * 0.6 * (o.ry / o.rx)])]
      .map(([u, v]) => [o.pc[0] + (u * cr - v * sr) * o.rx, o.pc[1] + (u * sr + v * cr) * o.rx]);
    for (const ps of spots) {
      let best = null, bestD = Infinity;
      for (let a = 0; a < 24; a++) for (const dist of [1.7, 2.2, 3, 4, 5.2]) {
        const t = (a / 24) * Math.PI * 2;
        const dir = [Math.cos(t), Math.sin(t)];
        // never from straight below: that's the mouth and tongue
        if (dir[0] * down[0] + dir[1] * down[1] > 0.6) continue;
        const q = [ps[0] + dir[0] * r * dist, ps[1] + dir[1] * r * dist];
        let bad = 0;
        const got = [];
        for (let gy = -2; gy <= 2; gy++) for (let gx = -2; gx <= 2; gx++) {
          if (gx * gx + gy * gy > 5) continue;
          const p = [q[0] + (gx / 2) * r, q[1] + (gy / 2) * r];
          const c = sample(p);
          if (!c || featureAreas.some((f) => inArea(p, f, 1.1))) bad++;
          else got.push(c);
        }
        if (bad > 5 || !got.length) continue;
        const avg = got.reduce((s2, c) => [s2[0] + c[0] / got.length, s2[1] + c[1] / got.length, s2[2] + c[2] / got.length], [0, 0, 0]);
        const spread = Math.sqrt(got.reduce((s2, c) => s2 + (c[0] - avg[0]) ** 2 + (c[1] - avg[1]) ** 2 + (c[2] - avg[2]) ** 2, 0) / got.length);
        const d = Math.hypot(avg[0] - col[0], avg[1] - col[1], avg[2] - col[2]) + spread + dist * 3 + bad * 40;
        if (d < bestD) { bestD = d; best = q; }
      }
      const S = Math.ceil(r * 2);
      const st = canvas(S, S), sx = st.getContext('2d');
      if (best) sx.drawImage(src0, best[0] - r, best[1] - r, S, S, 0, 0, S, S);
      else { sx.fillStyle = rgb(col); sx.fillRect(0, 0, S, S); }
      const g = sx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, '#000'); g.addColorStop(0.6, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      sx.globalCompositeOperation = 'destination-in';
      sx.fillStyle = g; sx.fillRect(0, 0, S, S);
      cx.drawImage(st, ps[0] - r, ps[1] - r);
    }
  }
  const cells = { canvas: clean, toPhoto, s, roll: pose.roll };

  // Fur clumps: soft round samples of the pet's own coat, taken all over the cut-out
  // (away from eyes, nose and mouth). Panels the photo can't see are filled with clumps
  // from the coat nearest them, turned to flow back over the head. No tiling, no mirroring.
  const at = maskSampler(seg);
  const furR = Math.max(6, D * 0.2);
  const step = Math.max(3, D * 0.11);
  const furPts = [];
  for (let y = furR; y < img.naturalHeight - furR; y += step) {
    for (let x = furR; x < img.naturalWidth - furR; x += step) {
      if (!at || at(x, y) < 235) continue;
      let ok = true;
      for (let a = 0; a < 8 && ok; a++) {
        const t = (a / 8) * Math.PI * 2;
        if (at(x + Math.cos(t) * furR, y + Math.sin(t) * furR) < 235) ok = false;
      }
      if (!ok || featureAreas.some((o) => inArea([x, y], o, 1.35))) continue;
      furPts.push([x, y]);
    }
  }
  // keep it to a few hundred clumps, spread evenly
  const keep = Math.max(1, Math.ceil(furPts.length / 300));
  const clumpPts = furPts.filter((_, i) => i % keep === 0);
  const sprites = clumpPts.map((p) => {
    const sz = Math.ceil(furR * 2);
    const c = canvas(sz, sz);
    const x = c.getContext('2d');
    x.translate(sz / 2, sz / 2); x.rotate(-pose.roll); x.translate(-p[0], -p[1]);
    x.drawImage(clean, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    const g = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, sz, sz);
    return c;
  });
  const furClumps = { sprites, points: clumpPts, r: furR, s };

  // ears: a missing ear borrows the other one (its triangle maps inner->inner, so it mirrors)
  const tri = (e) => {
    if (!e) return null;
    if (e.baseIn && e.baseOut) return { tip: e.tip, baseIn: e.baseIn, baseOut: e.baseOut };
    const d = [e.tip[0] - e.base[0], e.tip[1] - e.base[1]], L = Math.hypot(d[0], d[1]) || 1;
    const pr = [-d[1] / L * L * 0.35, d[0] / L * L * 0.35];
    return { tip: e.tip, baseIn: [e.base[0] - pr[0], e.base[1] - pr[1]], baseOut: [e.base[0] + pr[0], e.base[1] + pr[1]] };
  };
  const ears = [0, 1].map((i) => {
    const e = lm.ears && lm.ears[i];
    if (e && e.how !== 'mirrored' && e.type === 'erect') return { ...tri(e), base: e.base, mirror: false };
    const o = lm.ears && lm.ears[1 - i];
    if (o && o.how !== 'mirrored' && o.type === 'erect') return { ...tri(o), base: o.base, mirror: true };
    return null;
  });

  // ears read from the cut-out, so background around them never prints
  return { photo: true, src: seg.cut || img, colorOf, cells, furClumps, fur, furScale: s, eyePatches, nosePatch, ears, mean: rgb(furMean), pose, patches };
}

// Cartoon mode: breed colors with drawn eyes and nose on the same planes.
export function cartoonTexture(pet, tpl, pal) {
  const R = 64; // canvas px per head unit
  const eyeR = pet.face.eyeR * 0.85;
  const eye = canvas(eyeR * 2.6 * R, eyeR * 2.6 * R);
  const ex = eye.getContext('2d');
  ex.setTransform(R, 0, 0, -R, eye.width / 2, eye.height / 2);
  drawEye(ex, 0, 0, eyeR, pet, pal);
  const nw = (tpl.layout.eyeX || 0.22) * 0.55;
  const nose = canvas(nw * 2.4 * R, nw * 2.6 * R);
  const nx = nose.getContext('2d');
  nx.setTransform(R, 0, 0, -R, nose.width / 2, nose.height * 0.3);
  const top = drawNose(nx, 0, 0, nw, pet);
  drawMouth(nx, 0, top, nw * 1.25, pet, pal);
  const dark = ['points', 'saddle', 'frenchie'].includes(pet.pattern);
  const colorOf = (face) => {
    if (face.role === 'nose' || face.role === 'muzzle') return dark ? pal.dark : pal.light;
    return pal.base;
  };
  return {
    photo: false, colorOf, fur: null, furScale: 0, mean: pal.base, ears: [null, null], patches: [],
    eyePatches: [{ canvas: eye, scale: 1 / R }, { canvas: eye, scale: 1 / R }],
    // the nose is drawn 30% from the canvas top, so its center sits below the nose point
    nosePatch: { canvas: nose, scale: 1 / R, offset: nw * 0.52 },
  };
}
