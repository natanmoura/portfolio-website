// Paints the laid-out net from the head texture: tiled fur on every facet, the face
// sheet on front-facing facets, and ear textures lifted from the photo on the ear flaps.
import { faceFrame, SHEET } from './unfold.js';

export const PX = 6; // canvas pixels per mm

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export const lum = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

const PINK = '#e8a29b';
const INK = '#1f1a18';

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * PX, y * PX) : ctx.moveTo(x * PX, y * PX)));
  ctx.closePath();
}


function circle(ctx, x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, color) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }

export function drawEye(ctx, x, y, r, pet, pal) {
  const F = pet.face;
  circle(ctx, x, y, r * 1.14, lum(pal.base) < 0.3 ? '#efe8dc' : 'rgba(255,255,255,0.85)');
  if (F.slit) {
    circle(ctx, x, y, r, F.iris);
    ellipse(ctx, x, y, r * 0.32, r * 0.78, INK);
  } else {
    circle(ctx, x, y, r, F.iris);
    circle(ctx, x, y, r * 0.72, INK);
  }
  circle(ctx, x - r * 0.32, y + r * 0.34, r * 0.3, '#ffffff');
  circle(ctx, x + r * 0.34, y - r * 0.3, r * 0.12, 'rgba(255,255,255,0.9)');
}

export function drawNose(ctx, cx, cy, w, pet) {
  const cat = pet.face.nose === 'cat';
  const h = w * (cat ? 0.62 : 0.66);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + h * 0.45);
  ctx.quadraticCurveTo(cx, cy + h * 0.62, cx + w / 2, cy + h * 0.45);
  ctx.quadraticCurveTo(cx + w * 0.12, cy - h * 0.55, cx, cy - h * 0.55);
  ctx.quadraticCurveTo(cx - w * 0.12, cy - h * 0.55, cx - w / 2, cy + h * 0.45);
  ctx.fillStyle = cat ? (pet.pattern === 'points' ? '#5a3d35' : '#d98a86') : INK;
  ctx.fill();
  if (!cat) circle(ctx, cx - w * 0.14, cy + h * 0.25, w * 0.09, 'rgba(255,255,255,0.55)');
  return cy - h * 0.55;
}

export function drawMouth(ctx, cx, top, s, pet, pal) {
  ctx.strokeStyle = pet.pattern === 'frenchie' || pet.pattern === 'points' ? 'rgba(10,8,8,0.8)' : INK;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  const d = s * 0.22, w = s * 0.24;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top - d);
  ctx.moveTo(cx - w, top - d * 0.8);
  ctx.quadraticCurveTo(cx - w / 2, top - d * 1.7, cx, top - d);
  ctx.quadraticCurveTo(cx + w / 2, top - d * 1.7, cx + w, top - d * 0.8);
  ctx.stroke();
  if (pet.face.tongue) {
    ctx.beginPath();
    ctx.ellipse(cx, top - d * 1.45, w * 0.36, d * 0.55, 0, Math.PI, 0, true);
    ctx.fillStyle = '#e07b7b';
    ctx.fill();
  }
  if (pet.kind === 'cat') {
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) circle(ctx, cx + sx * (w * 1.15 + i * w * 0.05), top - d * (0.1 + i * 0.32) + d * 0.2, s * 0.025, 'rgba(30,22,20,0.55)');
  }
}

function earInner(ctx, face, pet, pal) {
  const pts = face.pts;
  const [h0, h1] = face.hinge;
  const bm = [(pts[h0][0] + pts[h1][0]) / 2, (pts[h0][1] + pts[h1][1]) / 2];
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  const k = [c[0] * 0.7 + bm[0] * 0.3, c[1] * 0.7 + bm[1] * 0.3];
  const inner = pts.map((p) => [k[0] + (p[0] - k[0]) * 0.6, k[1] + (p[1] - k[1]) * 0.6]);
  polyPath(ctx, inner);
  ctx.fillStyle = pet.pattern === 'points' || pet.pattern === 'saddle' ? mix(PINK, pal.dark, 0.55) : PINK;
  ctx.fill();
}

// Fur on a panel: soft clumps of the pet's coat from the photo area nearest the panel,
// scattered across it and turned so the fur runs from the nose back over the head.
// Seeded per panel, so the print is the same every time.
function fillFur(ctx, face, fr, tex, nose) {
  const F = tex.furClumps;
  if (!F || !F.sprites.length) return;
  const f = [fr.c[0] - nose[0], fr.c[1] - nose[1], fr.c[2] - nose[2]];
  let fx = f[0] * fr.right[0] + f[1] * fr.right[1] + f[2] * fr.right[2];
  let fy = f[0] * fr.up[0] + f[1] * fr.up[1] + f[2] * fr.up[2];
  const l = Math.hypot(fx, fy);
  if (l < 1e-6) { fx = 0; fy = 1; } else { fx /= l; fy /= l; }
  const tp = tex.cells.toPhoto(fr.c);
  const nearest = F.points.map((p, i) => [i, (p[0] - tp[0]) ** 2 + (p[1] - tp[1]) ** 2])
    .sort((a, b) => a[1] - b[1]).slice(0, 8).map((x) => x[0]);
  const xs = face.pts.map((p) => p[0] * PX), ys = face.pts.map((p) => p[1] * PX);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = F.s * PX;
  const rS = F.r * k * Math.hypot(fr.X[0], fr.X[1]);
  const n = Math.min(120, Math.ceil(((x1 - x0) * (y1 - y0)) / (rS * rS) * 1.4) + 2);
  let seed = (face.fi + 1) * 2654435761 % 4294967296;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    const sp = F.sprites[nearest[Math.floor(rand() * nearest.length)]];
    const j = (rand() - 0.5) * 0.45;
    const gx = fx * Math.cos(j) - fy * Math.sin(j), gy = fx * Math.sin(j) + fy * Math.cos(j);
    const a = k * (fr.X[0] * gy - fr.Y[0] * gx), b = k * (fr.X[1] * gy - fr.Y[1] * gx);
    const c = k * (-fr.X[0] * gx - fr.Y[0] * gy), d = k * (-fr.X[1] * gx - fr.Y[1] * gy);
    const px = x0 + rand() * (x1 - x0), py = y0 + rand() * (y1 - y0);
    const w = sp.width / 2, h = sp.height / 2;
    ctx.setTransform(a, b, c, d, px - a * w - c * h, py - b * w - d * h);
    ctx.drawImage(sp, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// The photo of a cell's own area, laid flat on the cell at the photo's native scale and
// level with it: the cell's center goes where it sits in the photo, so fur and markings
// come from the right place without stretching onto steep cells.
function drawCellPhoto(ctx, fr, cells, alpha) {
  const pc = cells.toPhoto(fr.c);
  const co = Math.cos(cells.roll), si = Math.sin(cells.roll);
  const k = cells.s * PX;
  const a = (fr.X[0] * co + fr.Y[0] * si) * k, b = (fr.X[1] * co + fr.Y[1] * si) * k;
  const c = (fr.X[0] * si - fr.Y[0] * co) * k, d = (fr.X[1] * si - fr.Y[1] * co) * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setTransform(a, b, c, d, fr.O[0] * PX - (a * pc[0] + c * pc[1]), fr.O[1] * PX - (b * pc[0] + d * pc[1]));
  ctx.drawImage(cells.canvas, 0, 0);
  ctx.restore();
}

// lay a feature patch flat on its plane: the patch center goes on the 3D anchor point,
// one patch pixel = patch.scale head units, the patch's up = the plane's up
// fitPts (the cell's sheet outline, mm): scale the patch so it sits fully inside the
// cell, growing it toward the edges (cute, big eyes) but never past them.
function drawPatch(ctx, fr, patch, anchor, fitPts = null) {
  const d = [anchor[0] - fr.c[0], anchor[1] - fr.c[1], anchor[2] - fr.c[2]];
  const dx = d[0] * fr.right[0] + d[1] * fr.right[1] + d[2] * fr.right[2];
  const dy = d[0] * fr.up[0] + d[1] * fr.up[1] + d[2] * fr.up[2] - (patch.offset || 0);
  const O = [fr.O[0] + fr.X[0] * dx + fr.Y[0] * dy, fr.O[1] + fr.X[1] * dx + fr.Y[1] * dy];
  let fit = 1;
  if (fitPts) {
    let room = Infinity;
    for (let i = 0; i < fitPts.length; i++) {
      const p = fitPts[i], q = fitPts[(i + 1) % fitPts.length];
      const ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey) || 1;
      room = Math.min(room, Math.abs((O[0] - p[0]) * ey - (O[1] - p[1]) * ex) / L);
    }
    // measured on the solid core of the patch, not its feathered rim. Never below natural
    // size: the cell clip already keeps the feature from crossing a fold.
    const half = (Math.min(patch.canvas.width, patch.canvas.height) / 2) * 0.7 * patch.scale * Math.hypot(fr.X[0], fr.X[1]);
    fit = Math.max(1, Math.min(1.5, room / half));
  }
  const s = patch.scale * PX * fit;
  const a = fr.X[0] * s, b = fr.X[1] * s, c = -fr.Y[0] * s, e = -fr.Y[1] * s;
  const w = patch.canvas.width / 2, h = patch.canvas.height / 2;
  ctx.save();
  ctx.setTransform(a, b, c, e, O[0] * PX - a * w - c * h, O[1] * PX - b * w - e * h);
  ctx.drawImage(patch.canvas, 0, 0);
  ctx.restore();
}

// map the photo's ear triangle (inner base, outer base, tip) onto the flap's triangle
function drawEar(ctx, face, src, ear, side) {
  const pts = face.pts.map((p) => [p[0] * PX, p[1] * PX]);
  const [h0, h1] = face.hinge;
  // the right ear's hinge runs inner -> outer, the left ear's outer -> inner
  const inner = side > 0 ? pts[h0] : pts[h1], outer = side > 0 ? pts[h1] : pts[h0];
  const hm = [(inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2];
  let tip = pts[0], best = -1;
  pts.forEach((p) => { const d = Math.hypot(p[0] - hm[0], p[1] - hm[1]); if (d > best) { best = d; tip = p; } });
  const Q = [ear.baseIn, ear.baseOut, ear.tip], C = [inner, outer, tip];
  const qa = [Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]], qb = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1]];
  const ca = [C[1][0] - C[0][0], C[1][1] - C[0][1]], cb = [C[2][0] - C[0][0], C[2][1] - C[0][1]];
  const det = qa[0] * qb[1] - qb[0] * qa[1];
  if (Math.abs(det) < 1e-6) return;
  const inv = [qb[1] / det, -qb[0] / det, -qa[1] / det, qa[0] / det];
  const m00 = ca[0] * inv[0] + cb[0] * inv[2], m01 = ca[0] * inv[1] + cb[0] * inv[3];
  const m10 = ca[1] * inv[0] + cb[1] * inv[2], m11 = ca[1] * inv[1] + cb[1] * inv[3];
  ctx.save();
  ctx.setTransform(m00, m10, m01, m11, C[0][0] - (m00 * Q[0][0] + m01 * Q[0][1]), C[0][1] - (m10 * Q[0][0] + m11 * Q[0][1]));
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

function paintFaceArt(ctx, face, pet, pal, build, tex) {
  const fr = faceFrame(face);
  face.frame = fr;
  const tpl = build.template;
  const role = face.role;
  const side = fr.c[0] < tpl.center[0] ? -1 : 1;
  const darkEars = !tex.photo && ['points', 'saddle', 'frenchie'].includes(pet.pattern);
  let color = tex.colorOf(face);
  if (darkEars && (role === 'ear' || role === 'ear-back' || role === 'ear-drop')) color = pal.dark;
  polyPath(ctx, face.pts);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.fill(); ctx.stroke();
  ctx.save();
  polyPath(ctx, face.pts);
  ctx.clip();
  const onHead = role === 'head' || role === 'muzzle' || role === 'nose';
  const vis = onHead && tex.cells ? Math.max(0, Math.min(1, (fr.n[2] - 0.05) / 0.4)) : 0;
  // fur first, so any gap the photo leaves (or a panel it can't see) is coat, never blank
  if (tex.furClumps) {
    ctx.save();
    fillFur(ctx, face, fr, tex, tpl.nose);
    ctx.restore();
  }
  if (vis > 0) drawCellPhoto(ctx, fr, tex.cells, vis);
  const ear = tex.ears[side < 0 ? 0 : 1];
  if (role === 'ear') {
    if (ear) drawEar(ctx, face, tex.src, ear, side);
    else if (!tex.photo) earInner(ctx, face, pet, pal);
  } else if (role === 'ear-back') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else if (role === 'hanger' || role === 'hanger-back') {
    ctx.setTransform(fr.X[0] * PX, fr.X[1] * PX, fr.Y[0] * PX, fr.Y[1] * PX, fr.O[0] * PX, fr.O[1] * PX);
    // both layers get the hole at the same world height, so they line up when folded
    ctx.beginPath(); ctx.arc(0, 0.025, 0.035, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.006; ctx.stroke();
  }
  const feature = face.part.faces[face.fi].feature;
  if (feature === 'eye-0' || feature === 'eye-1') {
    const i = feature === 'eye-0' ? 0 : 1;
    // centered in its cell and sized to fit inside it, so the eye never crosses a fold
    drawPatch(ctx, fr, tex.eyePatches[i], fr.c, face.pts);
  } else if (feature === 'nose') {
    drawPatch(ctx, fr, tex.nosePatch, tpl.nose, face.pts);
  }
  ctx.restore();
}

export function paintArt(canvas, layout, pet, pal, build, tex) {
  canvas.width = Math.round(SHEET.w * PX);
  canvas.height = Math.round(SHEET.h * PX);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const f of layout.faces) paintFaceArt(ctx, f, pet, pal, build, tex);
}


export function paintSheet(canvas, art, layout, meta) {
  canvas.width = art.width; canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = 'round';
  ctx.drawImage(art, 0, 0);
  // tabs go on after the artwork, whose white background would otherwise hide them
  for (const isl of layout.islands) for (const t of isl.tabs) {
    polyPath(ctx, t.pts);
    ctx.fillStyle = '#e4ddd2'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.25 * PX; ctx.stroke();
  }

  ctx.lineCap = 'round';
  for (const e of layout.folds) {
    ctx.beginPath(); ctx.moveTo(e.a[0] * PX, e.a[1] * PX); ctx.lineTo(e.b[0] * PX, e.b[1] * PX);
    ctx.setLineDash(e.type === 'mountain' ? [2.2 * PX, 0.9 * PX, 0.3 * PX, 0.9 * PX] : [1.4 * PX, 1 * PX]);
    ctx.strokeStyle = 'rgba(60,50,45,0.55)'; ctx.lineWidth = 0.22 * PX; ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const e of layout.cuts) {
    ctx.beginPath(); ctx.moveTo(e.a[0] * PX, e.a[1] * PX); ctx.lineTo(e.b[0] * PX, e.b[1] * PX);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.3 * PX; ctx.stroke();
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${1.7 * PX}px "DM Sans", sans-serif`;
  for (const isl of layout.islands) {
    for (const t of isl.tabs) {
      const c = t.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
      ctx.fillStyle = '#7a6f66'; ctx.fillText(t.id, c[0] * PX, c[1] * PX);
    }
    for (const l of isl.labels) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(l.at[0] * PX, l.at[1] * PX, 1.25 * PX, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a403a'; ctx.fillText(l.id, l.at[0] * PX, l.at[1] * PX);
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${2.3 * PX}px "DM Sans", sans-serif`;
  ctx.fillStyle = '#6b5f57';
  for (const isl of layout.islands) ctx.fillText(isl.name.toUpperCase(), isl.box[0] * PX, (isl.box[1] + 2) * PX);

  ctx.fillStyle = INK;
  ctx.font = `700 ${4 * PX}px "DM Sans", sans-serif`;
  ctx.fillText(`Paper Pets · ${meta.title}`, SHEET.margin * PX, 10 * PX);
  ctx.font = `500 ${2.4 * PX}px "DM Sans", sans-serif`;
  ctx.fillStyle = '#6b5f57';
  ctx.fillText(meta.subtitle, SHEET.margin * PX, 14 * PX);
  const x0 = (SHEET.w - SHEET.margin - 20) * PX, y0 = 10 * PX;
  ctx.fillRect(x0, y0, 20 * PX, 0.6 * PX);
  ctx.fillText('20 mm', x0, y0 + 4 * PX);
}
