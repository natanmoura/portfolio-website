// Paper cutout title lettering. Each letter is traced from the Troika glyph outlines
// into polygons, then cut, backed, thickened and lifted as real geometry in SVG.
// Size-like params are percentages of the font size so a preset works at any size.

import * as OT from 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.module.js';

const opentype = OT.default ?? OT;
const FONT_URL = new URL('../fonts/troika.otf', import.meta.url);
const NS = 'http://www.w3.org/2000/svg';

export const fontReady = fetch(FONT_URL)
  .then((r) => r.arrayBuffer())
  .then((buf) => opentype.parse(buf));

export const DEFAULTS = {
  seed: 7,
  heft: 0,
  spacing: 7,

  rot: 0,
  baseline: 4,
  shiftX: 0,
  scaleJit: 0,
  skew: 0,
  arc: 0,

  colorMode: 'single',
  face: '#d0643b',
  palette: '#d0643b,#e9b44c,#5b8e7d,#3d5a80,#221d1a',
  edgeDarken: 29,
  backing: 0,
  backingColor: '#fbf8f2',

  depth: 2.8,
  depthAngle: 147,

  lift: 5,
  shadowBlur: 0,
  shadowOpacity: 0,
  lightAngle: 68,

  fps: 4,
  motion: 'drift',
  speed: 0.5,
  animRot: 3.3,
  animY: 2.4,
  animLift: 24,

  rough: 0,
  roughScale: 0.1,
  edgeBoil: false,
};

let uid = 0;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (a, b, c) => rng((a * 73856093) ^ (b * 19349663) ^ (c * 83492791))();
const sgn = (r) => r * 2 - 1;

function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const s = f * f * (3 - 2 * f);
  return sgn(hash(i, seed, 11)) * (1 - s) + sgn(hash(i + 1, seed, 11)) * s;
}

function darken(color, pct) {
  let rgb;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) rgb = m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  else {
    const n = parseInt(color.replace('#', ''), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const k = 1 - pct / 100;
  return `rgb(${rgb.map((v) => Math.round(v * k)).join(',')})`;
}

// Glyph outline at 1000 units per em, y down, origin on the baseline, as closed polylines.
function traceGlyph(glyph, upm, step = 8) {
  const k = 1000 / upm;
  const contours = [];
  let cur = null, x = 0, y = 0;
  const push = (px, py) => cur.push([px, py]);
  const line = (x1, y1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x, y1 - y) / step));
    for (let i = 1; i <= n; i++) push(x + ((x1 - x) * i) / n, y + ((y1 - y) * i) / n);
  };
  for (const c of glyph.path.commands) {
    const X = (v) => v * k, Y = (v) => -v * k;
    if (c.type === 'M') {
      if (cur && cur.length > 2) contours.push(cur);
      cur = [];
      x = X(c.x); y = Y(c.y);
      push(x, y);
    } else if (c.type === 'L') {
      line(X(c.x), Y(c.y));
      x = X(c.x); y = Y(c.y);
    } else if (c.type === 'Q' || c.type === 'C') {
      const p0 = [x, y], p3 = [X(c.x), Y(c.y)];
      const p1 = [X(c.x1), Y(c.y1)];
      const p2 = c.type === 'C' ? [X(c.x2), Y(c.y2)] : null;
      const est = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p3[0] - (p2 ?? p1)[0], p3[1] - (p2 ?? p1)[1]);
      const n = Math.max(2, Math.ceil(est / step));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        if (p2) push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                     u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
        else push(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p3[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p3[1]);
      }
      x = p3[0]; y = p3[1];
    } else if (c.type === 'Z') {
      if (cur && cur.length) {
        const [sx, sy] = cur[0];
        if (Math.hypot(sx - x, sy - y) > 0.01) line(sx, sy);
        cur.pop();
        x = sx; y = sy;
      }
    }
  }
  if (cur && cur.length > 2) contours.push(cur);
  return contours;
}

// Scissor wobble: push each traced point along its normal by smooth noise over arc length.
function cut(contours, amp, freq, seed) {
  let d = '';
  contours.forEach((pts, ci) => {
    const n = pts.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      if (i) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
      let ox = x, oy = y;
      if (amp > 0) {
        const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
        const tx = b[0] - a[0], ty = b[1] - a[1];
        const l = Math.hypot(tx, ty) || 1;
        const w = noise1(s * freq, seed * 31 + ci) * 0.7 + noise1(s * freq * 2.7 + 5.3, seed * 17 + ci) * 0.3;
        ox += (ty / l) * w * amp;
        oy += (-tx / l) * w * amp;
      }
      d += (i ? 'L' : 'M') + ox.toFixed(1) + ' ' + oy.toFixed(1);
    }
    d += 'Z';
  });
  return d;
}

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function cutout(host, params = {}) {
  const id = `ct-${++uid}`;
  const text = host.dataset.ctText ?? host.textContent;
  host.dataset.ctText = text;
  host.setAttribute('aria-label', text);
  let p = { ...DEFAULTS, ...params };
  let font = null;
  let letters = [];
  let raf = 0;
  let lastStep = -1;
  let size = 16;
  let words = text;

  function glyphFor(ch) {
    let g = font.charToGlyph(ch);
    if (!g || g.index === 0) g = font.charToGlyph(ch.toUpperCase());
    if (!g || g.index === 0) g = font.charToGlyph(ch.toLowerCase());
    return g;
  }

  function build() {
    host.textContent = '';
    host.classList.add('ct');
    letters = [];
    if (!font) { host.textContent = words; return; }
    const upm = font.unitsPerEm;
    const asc = (font.ascender / upm) * 1000;
    const desc = (-font.descender / upm) * 1000;
    const spaceAdv = (glyphFor(' ').advanceWidth / upm) * 1000;
    let i = 0;
    for (const w of words.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) {
        const sp = document.createElement('span');
        sp.className = 'ct-sp';
        sp.dataset.adv = spaceAdv;
        host.append(sp, document.createTextNode('​'));
        continue;
      }
      const word = document.createElement('span');
      word.className = 'ct-w';
      word.setAttribute('aria-hidden', 'true');
      const chars = [...w];
      chars.forEach((ch, ci) => {
        const g = glyphFor(ch);
        if (!g || g.index === 0) {
          const plain = document.createElement('span');
          plain.className = 'ct-txt';
          plain.textContent = ch;
          word.appendChild(plain);
          return;
        }
        const adv = (g.advanceWidth / upm) * 1000;
        const next = chars[ci + 1];
        const kern = next ? (font.getKerningValue(g, glyphFor(next)) / upm) * 1000 : 0;
        const svg = el('svg', { class: 'ct-l', viewBox: `0 ${-asc} ${adv} ${asc + desc}`, overflow: 'visible' });
        const sh = el('g', { filter: `url(#${id}-blur)` });
        const shPath = el('path');
        sh.appendChild(shPath);
        const bkDepth = el('g'), bk = el('path'), fcDepth = el('g'), fc = el('path');
        svg.append(sh, bkDepth, bk, fcDepth, fc);
        word.appendChild(svg);
        letters.push({ svg, sh, shPath, bkDepth, bk, fcDepth, fc, adv, kern, asc, desc, contours: traceGlyph(g, upm), i: i++ });
      });
      host.appendChild(word);
    }
    const defs = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
    const f = el('filter', { id: `${id}-blur`, x: '-50%', y: '-50%', width: '200%', height: '200%' });
    blurNode = el('feGaussianBlur', { stdDeviation: 0 });
    f.appendChild(blurNode);
    defs.appendChild(f);
    host.appendChild(defs);
  }
  let blurNode = null;

  function depthCopies(group, n, color, stroke) {
    while (group.childNodes.length > n) group.lastChild.remove();
    while (group.childNodes.length < n) group.appendChild(el('path'));
    group.setAttribute('fill', color);
    group.setAttribute('stroke', color);
    group.setAttribute('stroke-width', stroke);
    group.setAttribute('stroke-linejoin', 'round');
  }

  function style() {
    size = parseFloat(getComputedStyle(host).fontSize) || 16;
    if (!font) return;
    const em = size / 1000;
    const pal = p.palette.split(',').map((s) => s.trim()).filter(Boolean);
    const n = letters.length;
    const textColor = getComputedStyle(host).color;
    // Everything below is in glyph units, 1000 per em, so % of size = value * 10.
    const heft = p.heft * 10;
    const back = p.backing * 10;
    const depth = p.depth * 10;
    const steps = Math.max(1, Math.min(24, Math.ceil(depth * em)));
    if (blurNode) blurNode.setAttribute('stdDeviation', (p.shadowBlur * 10).toFixed(1));

    for (const s of host.querySelectorAll('.ct-sp')) s.style.width = `${(+s.dataset.adv * em).toFixed(2)}px`;

    for (const L of letters) {
      const r = rng(p.seed * 1000 + L.i * 7 + 1);
      L.base = {
        rot: sgn(r()) * p.rot,
        y: sgn(r()) * p.baseline * size / 100,
        x: sgn(r()) * p.shiftX * size / 100,
        s: 1 + sgn(r()) * p.scaleJit / 100,
        skew: sgn(r()) * p.skew,
        phase: r() * Math.PI * 2,
        phase2: r() * Math.PI * 2,
        col: r(),
      };
      const t = n > 1 ? L.i / (n - 1) : 0.5;
      L.base.y += -p.arc * size / 100 * (1 - Math.pow(2 * t - 1, 2));

      const face = p.colorMode === 'palette' && pal.length ? pal[Math.floor(L.base.col * pal.length) % pal.length]
        : p.colorMode === 'text' ? textColor
        : p.face;
      L.face = face;

      L.svg.style.width = `${(L.adv * em).toFixed(2)}px`;
      L.svg.style.height = `${((L.asc + L.desc) * em).toFixed(2)}px`;
      L.svg.style.verticalAlign = `${(-L.desc * em).toFixed(2)}px`;
      L.svg.style.marginRight = `${((L.kern + p.spacing * 10) * em).toFixed(2)}px`;

      const bkStroke = heft + back * 2;
      L.fc.setAttribute('fill', face);
      L.fc.setAttribute('stroke', face);
      L.fc.setAttribute('stroke-width', heft);
      L.fc.setAttribute('stroke-linejoin', 'round');
      L.bk.style.display = back > 0 ? '' : 'none';
      L.bkDepth.style.display = back > 0 ? '' : 'none';
      L.bk.setAttribute('fill', p.backingColor);
      L.bk.setAttribute('stroke', p.backingColor);
      L.bk.setAttribute('stroke-width', bkStroke);
      L.bk.setAttribute('stroke-linejoin', 'round');
      depthCopies(L.bkDepth, back > 0 ? steps : 0, darken(p.backingColor, p.edgeDarken), bkStroke);
      const faceSteps = back > 0 ? Math.max(1, Math.min(steps, Math.ceil(6 * em))) : steps;
      const faceDepth = back > 0 ? Math.min(depth, 6) : depth;
      depthCopies(L.fcDepth, depth > 0 ? faceSteps : 0, darken(face, p.edgeDarken), heft);
      const a = (p.depthAngle * Math.PI) / 180;
      const off = (g, dist) => [...g.childNodes].forEach((c, k, arr) => {
        const d = (dist * (k + 1)) / arr.length;
        c.setAttribute('transform', `translate(${(Math.cos(a) * d).toFixed(1)} ${(Math.sin(a) * d).toFixed(1)})`);
      });
      off(L.bkDepth, depth);
      off(L.fcDepth, faceDepth);

      L.sh.setAttribute('opacity', p.shadowOpacity);
      L.shPath.setAttribute('fill', '#000');
      L.shPath.setAttribute('stroke', '#000');
      L.shPath.setAttribute('stroke-width', bkStroke);
      L.shPath.setAttribute('stroke-linejoin', 'round');
      L.cutStep = null;
    }
    lastStep = -1;
    frame(performance.now());
  }

  function recut(L, step) {
    const amp = p.rough * 10 * 0.5;
    const freq = p.roughScale * 0.05;
    const d = cut(L.contours, amp, freq, p.seed * 101 + L.i * 13 + step);
    for (const node of [L.fc, L.bk, L.shPath, ...L.fcDepth.childNodes, ...L.bkDepth.childNodes]) node.setAttribute('d', d);
  }

  function frame(now) {
    if (!font) return;
    const t = now / 1000;
    const step = p.fps > 0 ? Math.floor(t * p.fps) : 0;
    if (step === lastStep) return;
    lastStep = step;
    const ts = p.fps > 0 ? step / p.fps : 0;
    const u = size / 100;
    const la = (p.lightAngle * Math.PI) / 180;
    const lx = Math.cos(la), ly = Math.sin(la);
    const cutStep = p.edgeBoil && p.fps > 0 && p.rough > 0 ? step % 7 : 0;

    for (const L of letters) {
      if (L.cutStep !== cutStep) { recut(L, cutStep); L.cutStep = cutStep; }
      const b = L.base;
      let mr = 0, my = 0, ml = 0;
      if (p.fps > 0) {
        if (p.motion === 'boil') {
          mr = sgn(hash(step, L.i, 1));
          my = sgn(hash(step, L.i, 2));
          ml = sgn(hash(step, L.i, 3));
        } else {
          const w = ts * Math.PI * 2 * p.speed;
          mr = Math.sin(w + b.phase);
          my = Math.sin(w * 1.3 + b.phase2);
          ml = Math.sin(w * 0.9 + b.phase + 1.7);
        }
      }
      const rot = b.rot + mr * p.animRot;
      const y = b.y + my * p.animY * u;
      const lift = p.lift * u * (1 + (ml * p.animLift) / 100);
      L.svg.style.transform =
        `translate(${b.x.toFixed(2)}px, ${(y - lift * 0.35).toFixed(2)}px) rotate(${rot.toFixed(2)}deg) skewX(${b.skew.toFixed(2)}deg) scale(${b.s.toFixed(3)})`;
      const k = 1000 / size;
      L.sh.setAttribute('transform', `translate(${(lx * lift * k).toFixed(1)} ${(ly * lift * k).toFixed(1)})`);
    }
  }

  function loop(now) {
    frame(now);
    raf = requestAnimationFrame(loop);
  }

  build();
  style();
  raf = requestAnimationFrame(loop);
  fontReady.then((f) => { font = f; build(); style(); });

  const ro = new ResizeObserver(() => {
    const s = parseFloat(getComputedStyle(host).fontSize);
    if (s !== size) style();
  });
  ro.observe(host);

  return {
    get params() { return { ...p }; },
    set(next) { p = { ...p, ...next }; style(); },
    setText(t) { words = t; host.dataset.ctText = t; host.setAttribute('aria-label', t); build(); style(); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); host.textContent = host.dataset.ctText; },
  };
}

export const CSS = `
.ct { white-space: normal; }
.ct-w { display: inline-block; white-space: nowrap; }
.ct-l { display: inline-block; overflow: visible; transform-origin: 50% 60%; }
.ct-sp { display: inline-block; }
.ct-txt { display: inline-block; margin: 0 .15em; }
`;

export function injectCSS() {
  if (document.getElementById('ct-css')) return;
  const s = document.createElement('style');
  s.id = 'ct-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
