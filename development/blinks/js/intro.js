// The welcome text. It types itself out one letter at a time, each letter
// popping into place and then bobbing, drifting and tilting on its own like
// something suspended in water. All of the timing and motion reads its
// numbers from the Look settings, so it can be tuned live.

// Words between asterisks are key and print bold black, words between carets
// are the call to action and print bold red. The rest is grey. A line starting
// with > carries on typing from the line above, with no pause between them.
const SOURCE = [
  'Meet the *Blinks*.',
  'They only live one minute...',
  '^Drag them together^',
  '>to grow new ones!',
];
const MARKS = { '*': 'key', '^': 'key cta' };
const CARRIES = SOURCE.map((s) => s.startsWith('>'));
const LINES = SOURCE.map((s) => s.replace(/^>/, '').replace(/[*^]/g, ''));
const KEY = SOURCE.map((s) => s.replace(/^>/, '')).map((s) => {
  const out = [];
  let on = '';
  for (const ch of s) {
    if (MARKS[ch]) on = on ? '' : MARKS[ch];
    else out.push(on);
  }
  return out;
});

export class Intro {
  constructor(el, look) {
    this.el = el;
    this.look = look;
    this.t = 0;
    this.letters = [];
    el.textContent = '';
    const text = document.createElement('div');
    text.className = 'intro-text';
    // All the white haze lives in one layer underneath every line of text, so
    // one line's haze never covers the line above it.
    const haze = document.createElement('div');
    haze.className = 'intro-haze';
    text.appendChild(haze);
    this.rows = [];
    this.hazes = [];
    LINES.forEach((line, li) => {
      const row = document.createElement('div');
      // The call to action sits a blank line's worth below the lines above it.
      row.className = li === 2 ? 'intro-line spaced' : 'intro-line';
      this.rows.push(row);
      const h = document.createElement('div');
      h.className = 'intro-haze-line';
      haze.appendChild(h);
      this.hazes.push(h);
      [...line].forEach((ch, k) => {
        const span = document.createElement('span');
        span.className = `intro-letter ${KEY[li][k]}`.trim();
        // A plain space collapses inside an inline-block, so use a fixed one.
        span.textContent = ch === ' ' ? '\u00a0' : ch;
        span.style.visibility = 'hidden';
        row.appendChild(span);
        // Every letter gets its own phase so the line ripples rather than
        // moving as one block.
        this.letters.push({ span, line: li, index: k, seed: Math.random() * Math.PI * 2 });
      });
      text.appendChild(row);
    });
    el.appendChild(text);
  }

  replay() {
    this.t = 0;
    for (const h of this.hazes) h.classList.remove('live');
    this.el.classList.remove('gone');
  }

  // The first tap anywhere fades the text out over a second.
  dismiss() { this.el.classList.add('gone'); }

  // When a letter appears, in seconds: letters type at a steady rate, and
  // each new line waits for the pause after the last one finishes, unless it
  // carries on from it, where the break only takes as long as a space.
  appearAt(l) {
    const L = this.look;
    const per = 1 / Math.max(1, L.typeSpeed ?? 22);
    let at = L.textDelay ?? 1.2;
    for (let i = 0; i < l.line; i++) at += LINES[i].length * per + (CARRIES[i + 1] ? per : L.lineGap ?? 1);
    return at + l.index * per;
  }

  // landed: whether the opening drop has finished. The typing clock, start
  // delay included, only begins once every first creature is on the ground.
  update(dt, landed = true) {
    const L = this.look;
    if (landed) this.started = true;
    if (this.started) this.t += dt;
    const t = this.started ? this.t : -1;
    const speed = L.floatSpeed ?? 1.3;
    const amp = L.floatAmp ?? 4;
    const drift = L.driftAmp ?? 2.5;
    const tilt = L.tilt ?? 5;
    const ripple = L.ripple ?? 0.45;
    const popTime = Math.max(0.01, L.popTime ?? 0.12);
    const over = L.popOver ?? 1.35;
    this.el.style.setProperty('--intro-size', `${L.textSize ?? 24}px`);
    this.el.style.setProperty('--intro-angle', `${L.textAngle ?? 0}deg`);
    // Lines alternate a little either way on top of the overall angle.
    const zig = L.lineAngle ?? 0;
    this.rows.forEach((row, i) => {
      row.style.transform = `rotate(${(i % 2 ? -zig : zig).toFixed(2)}deg)`;
      // Each line's haze sits exactly where its line is and turns with it.
      const h = this.hazes[i].style;
      h.left = `${row.offsetLeft}px`;
      h.top = `${row.offsetTop}px`;
      h.width = `${row.offsetWidth}px`;
      h.height = `${row.offsetHeight}px`;
      h.transform = row.style.transform;
    });
    this.letters.forEach((l, i) => {
      const age = t - this.appearAt(l);
      if (age < 0) { l.span.style.visibility = 'hidden'; return; }
      l.span.style.visibility = 'visible';
      if (l.index === 0) this.hazes[l.line].classList.add('live');
      // Pop: snaps up past full size, then settles back to it.
      const k = Math.min(1, age / popTime);
      const scale = k < 0.5 ? (k / 0.5) * over : over + (1 - over) * ((k - 0.5) / 0.5) ** 0.7;
      const ph = i * ripple + l.seed * 0.35;
      const w = t * speed;
      const y = amp * (Math.sin(w + ph) + 0.45 * Math.sin(w * 1.73 + ph * 0.6));
      const x = drift * Math.sin(w * 0.81 + ph * 1.3 + l.seed);
      const r = tilt * Math.sin(w * 1.12 + ph * 0.9);
      l.span.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    });
  }
}
