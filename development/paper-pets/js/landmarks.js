// Finds a pet's eyes and nose automatically, so the photo can be fit to the head
// without the customer tapping anything. Uses an open-vocabulary detector (OWL-ViT,
// in the browser via transformers.js) on a few candidate face crops, then keeps the
// detections that form a plausible face: two level eyes with a nose below them.

let worker = null, nextId = 0;
const pending = new Map();

function call(url, labels, opts) {
  if (!worker) {
    worker = new Worker(new URL('./landmark-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, url, labels, opts });
  });
}

// warms the model up in the worker
export function loadLandmarker() {
  return call(null);
}
const getDetector = async () => call;

function cropURL(img, [x, y, w, h]) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.92);
}

function clampBox(img, [x, y, w, h]) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  return [x0, y0, Math.min(W, x + w) - x0, Math.min(H, y + h) - y0];
}

const center = (b) => [(b.xmin + b.xmax) / 2, (b.ymin + b.ymax) / 2];

// best eye pair + nose inside one crop, in full-image pixels
function bestFace(dets, crop) {
  const [cx0, cy0, cw] = crop;
  const eyes = [], noses = [];
  for (const d of dets) {
    if (d.label.includes('ear')) continue;
    const [x, y] = center(d.box);
    const c = { p: [cx0 + x, cy0 + y], s: d.score, w: d.box.xmax - d.box.xmin };
    (d.label.includes('eye') ? eyes : noses).push(c);
  }
  let best = null;
  for (let i = 0; i < eyes.length; i++) for (let j = i + 1; j < eyes.length; j++) {
    const a = eyes[i], b = eyes[j];
    const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], d = Math.hypot(dx, dy);
    if (d < cw * 0.12 || d > cw * 0.8 || Math.abs(dy) / d > 0.5) continue;
    if (a.w / b.w > 2.2 || b.w / a.w > 2.2) continue;
    if (Math.min(a.w, b.w) > d * 0.9) continue;
    const dir = dx >= 0 ? [dx / d, dy / d] : [-dx / d, -dy / d];
    const perp = [-dir[1], dir[0]];
    const mid = [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2];
    let nose = null, ns = 0;
    for (const n of noses) {
      const v = [n.p[0] - mid[0], n.p[1] - mid[1]];
      const along = (v[0] * perp[0] + v[1] * perp[1]) / d, side = (v[0] * dir[0] + v[1] * dir[1]) / d;
      if (along < 0.3 || along > 1.6 || Math.abs(side) > 0.4) continue;
      const s = n.s * (1 - Math.abs(side));
      if (s > ns) { ns = s; nose = n.p; }
    }
    const inferred = !nose;
    if (!nose) nose = [mid[0] + perp[0] * d * 0.75, mid[1] + perp[1] * d * 0.75];
    const score = a.s + b.s + ns * 0.8;
    if (!best || score > best.score) best = { eyes: [a.p, b.p], nose, score, inferred };
  }
  return best;
}

// hints: { box: COCO box [x,y,w,h] | null, bounds: mask bounds [x0,y0,x1,y1] | null, headX }
export async function findLandmarks(img, hints = {}) {
  const det = await getDetector();
  const W = img.naturalWidth, H = img.naturalHeight;
  const crops = [];
  const full = cropURL(img, [0, 0, W, H]);
  const faces = await det(full, ["a dog's face", "a cat's face"], { threshold: 0.03, top_k: 2 });
  for (const f of faces) {
    const b = f.box, w = b.xmax - b.xmin, h = b.ymax - b.ymin;
    crops.push(clampBox(img, [b.xmin - w * 0.12, b.ymin - h * 0.12, w * 1.24, h * 1.24]));
  }
  // head guess from the segmentation: the top of the animal, roughly square
  if (hints.bounds) {
    const [x0, y0, x1, y1] = hints.bounds;
    const s = Math.min(x1 - x0, (y1 - y0) * 0.75);
    crops.push(clampBox(img, [hints.headX - s / 2, y0, s, s]));
    const s2 = Math.min(x1 - x0, y1 - y0) * 0.55;
    crops.push(clampBox(img, [hints.headX - s2 / 2, y0 + s2 * 0.05, s2, s2]));
  }
  if (hints.box) {
    const [x, y, w, h] = hints.box;
    crops.push(clampBox(img, [x, y, w, Math.min(h, w)]));
  }
  let best = null;
  for (const crop of crops.slice(0, 4)) {
    if (crop[2] < 24 || crop[3] < 24) continue;
    const dets = await det(cropURL(img, crop), ['an eye', 'a nose', 'an animal eye', 'an animal nose', 'an ear'], { threshold: 0.01, top_k: 20 });
    const f = bestFace(dets, crop);
    if (f && (!best || f.score > best.score)) best = { ...f, crop, dets };
  }
  if (!best || best.score < 0.04) return null;
  best.ears = findEars(best, hints.mask);
  return best;
}

// ---------- ears ----------
// Frame aligned to the eye line: origin at the eye midpoint, unit = eye distance,
// x toward the right eye, y up the face.
function eyeFrame(face) {
  const [a, b] = face.eyes[0][0] < face.eyes[1][0] ? face.eyes : [face.eyes[1], face.eyes[0]];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const D = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir = [(b[0] - a[0]) / D, (b[1] - a[1]) / D];
  const up = [dir[1], -dir[0]];
  return {
    D, mid,
    toImg: (u, v) => [mid[0] + (dir[0] * u + up[0] * v) * D, mid[1] + (dir[1] * u + up[1] * v) * D],
    toFace: (p) => { const q = [p[0] - mid[0], p[1] - mid[1]]; return [(q[0] * dir[0] + q[1] * dir[1]) / D, (q[0] * up[0] + q[1] * up[1]) / D]; },
  };
}

function maskSampler(mask) {
  if (!mask) return null;
  const W = mask.width, H = mask.height;
  const d = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  return (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 0;
    return d[(yi * W + xi) * 4 + 3];
  };
}

// Erect ears show up as two peaks in the top of the pet's silhouette. Drop ears don't,
// so those fall back to the detector's "an ear" boxes.
function findEars(face, mask) {
  const F = eyeFrame(face);
  const at = maskSampler(mask);
  const ears = [null, null];
  if (at) {
    const us = [];
    for (let u = -2.4; u <= 2.4001; u += 0.04) us.push(u);
    const top = us.map((u) => {
      let last = -1;
      for (let v = -0.2; v <= 3.2; v += 0.02) {
        const [x, y] = F.toImg(u, v);
        if (at(x, y) > 127) last = v; else if (last >= 0 && v - last > 0.12) break;
      }
      return last;
    });
    const crown = top[us.findIndex((u) => Math.abs(u) < 0.021)];
    for (const side of [-1, 1]) {
      let bi = -1;
      us.forEach((u, i) => { if (u * side > 0.35 && u * side < 2.2 && top[i] > 0 && (bi < 0 || top[i] > top[bi])) bi = i; });
      if (bi < 0) continue;
      // lowest point of the silhouette between the peak and the face center = inner ear base
      let lo = bi;
      for (let i = bi; Math.abs(us[i]) > 0.02; i -= side) if (top[i] >= 0 && top[i] < top[lo]) lo = i;
      const prom = top[bi] - top[lo];
      if (prom < 0.28 || top[bi] < crown + 0.2) continue;
      // the ear as a triangle: tip, inner base (the dip toward the crown) and outer base
      // (where the silhouette drops back down on the far side)
      let out = bi;
      for (let i = bi; i >= 0 && i < us.length; i += side) { out = i; if (top[i] < top[lo] + prom * 0.2) break; }
      ears[side < 0 ? 0 : 1] = {
        tip: F.toImg(us[bi], top[bi]),
        base: F.toImg((us[lo] + us[bi]) / 2, top[lo]),
        baseIn: F.toImg(us[lo], top[lo]),
        baseOut: F.toImg(us[out], Math.max(top[lo], top[out])),
        type: 'erect', how: 'silhouette',
      };
    }
  }
  // detector boxes for anything the silhouette didn't explain
  const [cx0, cy0] = face.crop;
  const boxes = (face.dets || []).filter((d) => d.label.includes('ear') && d.score > 0.03).map((d) => {
    const b = d.box;
    const c = F.toFace([cx0 + (b.xmin + b.xmax) / 2, cy0 + (b.ymin + b.ymax) / 2]);
    return { b, c, s: d.score };
  });
  for (const side of [-1, 1]) {
    const k = side < 0 ? 0 : 1;
    if (ears[k]) continue;
    const cand = boxes.filter((e) => {
      const drop = e.c[1] < 0.3;
      // drop ears hang well outside the eyes, at or below eye level; erect ears sit above
      return drop ? e.c[0] * side > 0.75 && e.c[0] * side < 2.2 && e.c[1] > -1.9
        : e.c[0] * side > 0.45 && e.c[0] * side < 2.2 && e.c[1] < 2.6;
    }).sort((a, b) => b.s - a.s)[0];
    if (!cand) continue;
    const b = cand.b;
    const drop = cand.c[1] < 0.3;
    const corner = (x, y) => [cx0 + x, cy0 + y];
    const outerX = side > 0 ? b.xmax : b.xmin, innerX = side > 0 ? b.xmin : b.xmax;
    ears[k] = drop
      ? { tip: corner((b.xmin + b.xmax) / 2 * 0.5 + outerX * 0.5, b.ymax), base: corner((b.xmin + b.xmax) / 2, b.ymin),
        baseIn: corner(innerX, b.ymin), baseOut: corner(outerX, b.ymin), type: 'drop', how: 'detector', s: cand.s }
      : { tip: corner((b.xmin + b.xmax) / 2 * 0.6 + outerX * 0.4, b.ymin), base: corner(innerX * 0.5 + outerX * 0.5, b.ymax),
        baseIn: corner(innerX, b.ymax), baseOut: corner(outerX, b.ymax), type: 'erect', how: 'detector', s: cand.s };
  }
  return symmetrize(ears, F);
}

// Ears in a frontal photo roughly mirror each other. If one is missing, or the two
// disagree, mirror the more trustworthy one across the face's center line.
function symmetrize(ears, F) {
  const conf = (e) => (!e ? -1 : e.how === 'silhouette' ? 1 : e.s || 0);
  const mirror = (e) => {
    const m = (p) => { const [u, v] = F.toFace(p); return F.toImg(-u, v); };
    return { tip: m(e.tip), base: m(e.base), baseIn: e.baseIn && m(e.baseIn), baseOut: e.baseOut && m(e.baseOut), type: e.type, how: 'mirrored' };
  };
  const [L, R] = ears;
  if (!L && !R) return ears;
  if (!L) return [mirror(R), R];
  if (!R) return [L, mirror(L)];
  const [lu, lv] = F.toFace(L.tip), [ru, rv] = F.toFace(R.tip);
  const agree = L.type === R.type && Math.abs(lv - rv) < 0.7 && Math.abs(lu + ru) < 0.7;
  if (agree) return ears;
  return conf(L) >= conf(R) ? [L, mirror(L)] : [mirror(R), R];
}
