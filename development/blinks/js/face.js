import { makeRng } from './rng.js';

// Faces are flat, graphic and high contrast so they read at a glance on a
// phone. Eyes are always plain dots or simple strokes, never pupils.

export const FACE_PX = 256;
const INK = '#1b1a1f';

export function drawFace(ctx, expr, face) {
  const r = makeRng(face.seed);
  const j = () => r.range(-1.3, 1.3);
  const W = FACE_PX, cx = W / 2;
  const gap = 30 + face.gap * 24;
  const ey = 112, my = 146;
  const L = cx - gap, R = cx + gap;
  ctx.clearRect(0, 0, W, W);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;

  const stroke = (w, fn) => { ctx.lineWidth = w; ctx.beginPath(); fn(); ctx.stroke(); };
  const dot = (x, y, rad) => { ctx.beginPath(); ctx.arc(x + j() * 0.4, y + j() * 0.4, rad, 0, Math.PI * 2); ctx.fill(); };
  const poly = (pts) => { ctx.moveTo(pts[0][0] + j(), pts[0][1] + j()); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + j(), pts[i][1] + j()); };
  const eyeR = 10.5 * face.eye;
  const mw = 15 * face.mouth;

  const blush = (hatch) => {
    for (const x of [L - 8, R + 8]) {
      const g = ctx.createRadialGradient(x, my - 2, 2, x, my - 2, 26);
      g.addColorStop(0, 'rgba(255,105,140,0.55)');
      g.addColorStop(1, 'rgba(255,105,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 30, my - 32, 60, 60);
      if (hatch) {
        ctx.strokeStyle = '#ff5a86';
        for (let i = -1; i <= 1; i++) stroke(4.5, () => poly([[x + i * 8 - 3, my + 4], [x + i * 8 + 3, my - 8]]));
        ctx.strokeStyle = INK;
      }
    }
    ctx.fillStyle = INK;
  };

  switch (expr) {
    case 'blink':
      stroke(8, () => { poly([[L - 9, ey], [L + 9, ey]]); poly([[R - 9, ey], [R + 9, ey]]); });
      stroke(8, () => ctx.arc(cx, my - mw * 0.7, mw, 0.18 * Math.PI, 0.82 * Math.PI));
      break;
    case 'curious':
      dot(L, ey - 3, eyeR * 1.1);
      dot(R, ey - 3, eyeR * 1.1);
      stroke(7, () => ctx.ellipse(cx, my + 4, 6.5, 8, 0, 0, Math.PI * 2));
      break;
    case 'surprise':
      stroke(7, () => { ctx.arc(L, ey - 4, 12, 0, Math.PI * 2); });
      stroke(7, () => { ctx.arc(R, ey - 4, 12, 0, Math.PI * 2); });
      stroke(8, () => {
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const k = 1 + 0.13 * Math.sin(a * 3 + 0.6);
          const x = cx + Math.cos(a) * 19 * k, y = my + 12 + Math.sin(a) * 14 * k;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      });
      break;
    case 'happy':
      stroke(8, () => ctx.arc(L, ey + 4, 11, Math.PI * 1.08, Math.PI * 1.92));
      stroke(8, () => ctx.arc(R, ey + 4, 11, Math.PI * 1.08, Math.PI * 1.92));
      ctx.beginPath();
      ctx.arc(cx, my - 2, mw * 1.05, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      break;
    case 'love':
      blush(true);
      stroke(8, () => ctx.arc(L, ey + 4, 11, Math.PI * 1.08, Math.PI * 1.92));
      stroke(8, () => ctx.arc(R, ey + 4, 11, Math.PI * 1.08, Math.PI * 1.92));
      stroke(7.5, () => poly([[cx - 8, my - 2], [cx, my + 7], [cx + 8, my - 2]]));
      break;
    case 'angry':
      stroke(8.5, () => { poly([[L - 11, ey - 11], [L + 9, ey], [L - 11, ey + 11]]); poly([[R + 11, ey - 11], [R - 9, ey], [R + 11, ey + 11]]); });
      stroke(7.5, () => {
        const pts = [];
        for (let i = 0; i <= 6; i++) pts.push([cx - 27 + i * 9, my + (i % 2 ? 2 : 13)]);
        poly(pts);
      });
      break;
    case 'sleep':
      stroke(7.5, () => ctx.arc(L, ey - 6, 10, Math.PI * 0.12, Math.PI * 0.88));
      stroke(7.5, () => ctx.arc(R, ey - 6, 10, Math.PI * 0.12, Math.PI * 0.88));
      stroke(6.5, () => ctx.ellipse(cx, my + 6, 5, 6, 0, 0, Math.PI * 2));
      break;
    case 'tired':
      dot(L, ey + 3, eyeR * 0.85);
      dot(R, ey + 3, eyeR * 0.85);
      ctx.clearRect(L - 16, ey - 20, 32, 22);
      ctx.clearRect(R - 16, ey - 20, 32, 22);
      stroke(7, () => { poly([[L - 12, ey + 1], [L + 12, ey + 1]]); poly([[R - 12, ey + 1], [R + 12, ey + 1]]); });
      stroke(7, () => poly([[cx - 10, my + 4], [cx + 10, my + 4]]));
      break;
    case 'dead':
      stroke(8, () => {
        for (const x of [L, R]) { poly([[x - 10, ey - 10], [x + 10, ey + 10]]); poly([[x + 10, ey - 10], [x - 10, ey + 10]]); }
      });
      stroke(7, () => {
        for (let i = 0; i <= 12; i++) {
          const x = cx - 18 + i * 3, y = my + 6 + Math.sin(i * 1.1) * 3;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      });
      break;
    default:
      dot(L, ey, eyeR);
      dot(R, ey, eyeR);
      stroke(8, () => ctx.arc(cx, my - mw * 0.7, mw, 0.18 * Math.PI, 0.82 * Math.PI));
  }
}
