// Photo side: breed detection (MobileNet / ImageNet) and coat color extraction.

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

let modelP = null;
export function loadModel() {
  if (!modelP) {
    modelP = (async () => {
      for (let i = 0; i < 100 && !(window.mobilenet && window.tf); i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.mobilenet) throw new Error('mobilenet script did not load');
      return window.mobilenet.load({ version: 2, alpha: 1.0 });
    })();
  }
  return modelP;
}

let detP = null;
export function loadDetector() {
  if (!detP) {
    detP = (async () => {
      for (let i = 0; i < 100 && !(window.cocoSsd && window.tf); i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.cocoSsd) throw new Error('coco-ssd script did not load');
      return window.cocoSsd.load();
    })();
  }
  return detP;
}

// Largest dog or cat box in the image, as [x, y, w, h] in natural pixels.
export async function findAnimal(img) {
  const det = await loadDetector();
  const hits = (await det.detect(img, 10, 0.25)).filter((d) => d.class === 'dog' || d.class === 'cat');
  if (!hits.length) return null;
  hits.sort((a, b) => b.bbox[2] * b.bbox[3] * b.score - a.bbox[2] * a.bbox[3] * a.score);
  return { box: hits[0].bbox, cls: hits[0].class, score: hits[0].score };
}

export function crop(img, box, pad = 0.08) {
  const [x, y, w, h] = box;
  const x0 = Math.max(0, x - w * pad), y0 = Math.max(0, y - h * pad);
  const x1 = Math.min(img.naturalWidth, x + w * (1 + pad)), y1 = Math.min(img.naturalHeight, y + h * (1 + pad));
  const cv = document.createElement('canvas');
  cv.width = Math.round(x1 - x0); cv.height = Math.round(y1 - y0);
  cv.getContext('2d').drawImage(img, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
  return cv;
}

let segP = null;
export function loadSegmenter() {
  if (!segP) {
    segP = (async () => {
      for (let i = 0; i < 100 && !(window.deeplab && window.tf); i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.deeplab) throw new Error('deeplab script did not load');
      return window.deeplab.load({ base: 'pascal', quantizationBytes: 2 });
    })();
  }
  return segP;
}

// Pet mask (alpha = dog/cat pixels) at the image's natural size, plus its bounds.
export async function segmentPet(img) {
  const model = await loadSegmenter();
  const { legend, height, width, segmentationMap } = await model.segment(img);
  const want = ['dog', 'cat'].map((k) => legend[k]).filter(Boolean);
  const small = document.createElement('canvas');
  small.width = width; small.height = height;
  const sctx = small.getContext('2d');
  const id = sctx.createImageData(width, height);
  let n = 0;
  for (let i = 0; i < width * height; i++) {
    const r = segmentationMap[i * 4], g = segmentationMap[i * 4 + 1], b = segmentationMap[i * 4 + 2];
    const hit = want.some((c) => c[0] === r && c[1] === g && c[2] === b);
    if (hit) { id.data[i * 4 + 3] = 255; n++; }
  }
  if (n < width * height * 0.01) return null;
  sctx.putImageData(id, 0, 0);
  return maskInfo(img, small);
}

// Fallback when segmentation is unavailable: a soft ellipse in the detection box.
export function ellipseMask(img, box) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const [x, y, w, h] = box || [W * 0.1, H * 0.05, W * 0.8, H * 0.9];
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.48, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  return maskInfo(img, cv);
}

function maskInfo(img, small) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.filter = `blur(${Math.max(1.5, W / 260)}px)`;
  mctx.drawImage(small, 0, 0, W, H);
  mctx.filter = 'none';
  const sw = small.width, sh = small.height;
  const d = small.getContext('2d').getImageData(0, 0, sw, sh).data;
  let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
  const rows = new Array(sh).fill(0), rowX = new Array(sh).fill(0);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (d[(y * sw + x) * 4 + 3] > 127) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      rows[y]++; rowX[y] += x;
    }
  }
  const kx = W / sw, ky = H / sh;
  // horizontal center of the top part of the animal, where the head usually is
  let sx = 0, sn = 0;
  for (let y = y0; y <= y0 + (y1 - y0) * 0.4; y++) { sx += rowX[y]; sn += rows[y]; }
  const cut = document.createElement('canvas');
  cut.width = W; cut.height = H;
  const cctx = cut.getContext('2d');
  cctx.drawImage(img, 0, 0);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(mask, 0, 0);
  return { mask, cut, bounds: [x0 * kx, y0 * ky, (x1 + 1) * kx, (y1 + 1) * ky], headX: sn ? (sx / sn + 0.5) * kx : (x0 + x1) / 2 * kx };
}

export async function classify(img) {
  const model = await loadModel();
  return model.classify(img, 5);
}

// ImageNet label fragments -> construct. Order matters: first hit in the top-5 wins.
const MAP = [
  ['frenchie', ['french bulldog', 'boston bull', 'pug', 'bull mastiff', 'boxer', 'staffordshire', 'american staffordshire']],
  ['lab', ['labrador', 'chesapeake', 'flat-coated', 'curly-coated', 'vizsla', 'weimaraner', 'rhodesian']],
  ['golden', ['golden retriever', 'irish setter', 'english setter', 'cocker spaniel', 'sussex spaniel', 'clumber', 'leonberg', 'tibetan terrier']],
  ['gsd', ['german shepherd', 'malinois', 'siberian husky', 'malamute', 'eskimo dog', 'kelpie', 'norwegian elkhound', 'dingo', 'timber wolf']],
  ['siamese', ['siamese']],
  ['persian', ['persian']],
  ['tabby', ['tabby', 'tiger cat', 'egyptian cat', 'lynx']],
];
const CATWORDS = ['cat', 'lynx', 'cougar'];

export function mapPrediction(preds) {
  for (const p of preds) {
    const name = p.className.toLowerCase();
    for (const [key, words] of MAP) if (words.some((w) => name.includes(w))) return { key, via: p, exact: true };
  }
  const top = preds[0];
  const cat = top && CATWORDS.some((w) => top.className.toLowerCase().includes(w));
  return { key: cat ? 'tabby' : 'lab', via: top, exact: false };
}

// ---- color extraction ----
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function kmeans(px, w, k, iters = 12) {
  const order = px.map((_, i) => i).sort((a, b) => w[b] - w[a]);
  const C = [];
  for (const i of order) { if (C.length >= k) break; if (C.every((c) => dist2(c, px[i]) > 900)) C.push(px[i].slice()); }
  while (C.length < k) C.push(px[Math.floor(Math.random() * px.length)].slice());
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < iters; it++) {
    assign = px.map((p) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = dist2(c, p); if (d < bd) { bd = d; b = j; } }); return b; });
    const S = C.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = S[assign[i]]; s[0] += p[0] * w[i]; s[1] += p[1] * w[i]; s[2] += p[2] * w[i]; s[3] += w[i]; });
    S.forEach((s, j) => { if (s[3] > 0) C[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const W = C.map(() => 0);
  px.forEach((_, i) => { W[assign[i]] += w[i]; });
  return C.map((c, j) => ({ c, w: W[j] })).sort((a, b) => b.w - a.w);
}

const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const L = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

// Brighten and soften a bit so it prints like coloured card, not a photo.
function paperize(c) {
  const l = L(c);
  // boosting saturation on near-black fur turns it maroon, so only boost mid tones
  const g = l * 255;
  const k = l < 0.25 ? 1 : 1.3;
  const sat = c.map((v) => g + (v - g) * k);
  const lift = l < 0.12 ? (0.12 - l) * 255 : 0;
  return sat.map((v) => v + lift + (255 - v - lift) * 0.06);
}

// box: animal bounding box [x, y, w, h] in natural pixels, or null for "assume centered"
export function extractPalette(img, box = null, mask = null) {
  if (mask) return paletteFromMask(img, mask);
  const S = 128;
  const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
  const cv = document.createElement('canvas');
  const r = nw / nh;
  cv.width = r >= 1 ? S : Math.round(S * r);
  cv.height = r >= 1 ? Math.round(S / r) : S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const { data, width: W, height: H } = ctx.getImageData(0, 0, cv.width, cv.height);
  const [bx0, by0, bw, bh] = box ? [box[0] / nw, box[1] / nh, box[2] / nw, box[3] / nh] : [0.18, 0.09, 0.64, 0.72];
  const border = [], inner = [], iw = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, p = [data[i], data[i + 1], data[i + 2]];
    const u = (x / W - bx0) / bw, v = (y / H - by0) / bh;
    const inBox = u >= 0 && u <= 1 && v >= 0 && v <= 1;
    if (!inBox) { if ((x + y) % 2 === 0) border.push(p); continue; }
    const dx = (u - 0.5) / 0.34, dy = (v - 0.45) / 0.38;
    const g = Math.exp(-(dx * dx + dy * dy));
    if (g > 0.08) { inner.push(p); iw.push(g); }
  }
  if (border.length < 30) for (let x = 0; x < W; x++) border.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]]);
  const bg = kmeans(border, border.map(() => 1), 3, 6).filter((b) => b.w > border.length * 0.15).map((b) => b.c);
  // fur is never green or blue: down-weight those hues hard (grass, sky, blankets)
  const furLike = ([r, g, b]) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
    if (s < 0.06 || mx < 40) return 1;
    let h = 0;
    if (mx === r) h = ((g - b) / (mx - mn)) * 60; else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60; else h = (4 + (r - g) / (mx - mn)) * 60;
    h = (h + 360) % 360;
    if (h > 62 && h < 290) return s > 0.14 ? 0.03 : 0.3;
    return 1;
  };
  const w = inner.map((p, i) => iw[i] * furLike(p) * (bg.some((b) => dist2(b, p) < 1600) ? 0.12 : 1));
  const cl = kmeans(inner, w, 4);
  const total = cl.reduce((s, c) => s + c.w, 0);
  return cl.map((c) => ({ c: c.c, share: c.w / total }));
}

// With a segmentation mask every sampled pixel is the animal, so no background guessing.
function paletteFromMask(img, mask) {
  const S = 128;
  const W = img.naturalWidth, H = img.naturalHeight, r = W / H;
  const w = r >= 1 ? S : Math.round(S * r), h = r >= 1 ? Math.round(S / r) : S;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(mask, 0, 0, w, h);
  const m = ctx.getImageData(0, 0, w, h).data;
  const pts = [], wt = [];
  for (let i = 0; i < w * h; i++) {
    const a = m[i * 4 + 3] / 255;
    if (a > 0.6) { pts.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]); wt.push(a); }
  }
  if (pts.length < 40) return extractPalette(img);
  const cl = kmeans(pts, wt, 4);
  const total = cl.reduce((s, c) => s + c.w, 0);
  return cl.map((c) => ({ c: c.c, share: c.w / total }));
}

// Assign coat roles from clusters. Two-tone patterns take the darkest cluster as the
// marking color first, so a Shepherd's black saddle doesn't become its base coat.
export function coatColors(clusters, pattern) {
  const sig = clusters.filter((c) => c.share > 0.08);
  const darkest = sig.reduce((a, b) => (L(b.c) < L(a.c) ? b : a));
  const twoTone = ['saddle', 'points', 'tabby', 'frenchie'].includes(pattern);
  let pool = sig;
  // a mostly-dark coat (black Frenchie, black Lab) keeps the dark cluster as its base
  if (twoTone && sig.length > 1 && darkest.share < 0.45) pool = sig.filter((c) => c !== darkest);
  const base = pool[0].c;
  const lightest = sig.reduce((a, b) => (L(b.c) > L(a.c) ? b : a));
  const dark = (twoTone ? L(base) - L(darkest.c) > 0.12 : L(base) - L(darkest.c) > 0.22) ? darkest.c : null;
  return {
    base: toHex(paperize(base)),
    light: L(lightest.c) - L(base) > 0.15 ? toHex(paperize(lightest.c)) : null,
    dark: dark ? toHex(paperize(dark)) : null,
  };
}
