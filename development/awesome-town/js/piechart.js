// Draggable mix wheel.
//
// Each wedge is one module kind's share of the city. Dragging a boundary moves
// weight between the two kinds either side of it and leaves everything else
// alone, which is the whole point: you are dividing a fixed hundred percent,
// not editing sliders that fight each other.
//
// There is a handle on every boundary, including the one where the last wedge
// meets the first. That one has nowhere fixed to sit, so the wheel carries a
// rotation: dragging it turns the whole ring while trading between the two
// kinds it separates. Without it the first and last kinds could never trade
// directly, and one seam of the wheel would have no grip at all.

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function arcPath(cx, cy, rOuter, rInner, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const span = a1 - a0;
  // A wedge at or past a full turn cannot be drawn as one arc.
  if (span >= TAU - 1e-6) {
    const mid = a0 + Math.PI;
    return `${arcPath(cx, cy, rOuter, rInner, a0, mid)} ${arcPath(cx, cy, rOuter, rInner, mid, a1)}`;
  }
  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOuter, a0);
  const [x1, y1] = p(rOuter, a1);
  const [x2, y2] = p(rInner, a1);
  const [x3, y3] = p(rInner, a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3}`,
    'Z',
  ].join(' ');
}

// Shortest signed distance between two fractions on a circle.
function wrapDelta(a, b) {
  return (((a - b + 0.5) % 1) + 1) % 1 - 0.5;
}

export class MixWheel {
  // keys: kind ids. meta: { [key]: { label, color } }
  constructor(root, keys, meta, values, onChange) {
    this.keys = keys;
    this.meta = meta;
    this.values = { ...values };
    this.onChange = onChange;
    this.rotation = 0;
    this.size = 168;
    this.cx = this.size / 2;
    this.cy = this.size / 2;
    this.rOuter = this.size / 2 - 14;
    this.rInner = this.rOuter * 0.52;

    this.svg = el('svg', { viewBox: `0 0 ${this.size} ${this.size}`, class: 'wheel' });
    this.wedges = el('g');
    this.handles = el('g');
    this.centre = el('text', {
      x: this.cx,
      y: this.cy,
      class: 'wheel-centre',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    this.svg.append(this.wedges, this.handles, this.centre);

    this.legend = document.createElement('div');
    this.legend.className = 'wheel-legend';

    root.append(this.svg, this.legend);
    this.bind();
    this.render();
  }

  total() {
    return this.keys.reduce((s, k) => s + Math.max(0, this.values[k] || 0), 0);
  }

  // Cumulative boundaries, relative to the rotation. cum[0] is always 0 and
  // cum[n] is always 1, which is why the seam between them needs its own case.
  cumulative() {
    const total = this.total() || 1;
    const cum = [0];
    this.keys.forEach((k, i) => cum.push(cum[i] + Math.max(0, this.values[k] || 0) / total));
    cum[this.keys.length] = 1;
    return cum;
  }

  angleFor(fraction) {
    return (this.rotation + fraction) * TAU - Math.PI / 2;
  }

  render() {
    const cum = this.cumulative();
    this.wedges.replaceChildren();
    this.handles.replaceChildren();

    this.keys.forEach((key, i) => {
      const a0 = this.angleFor(cum[i]);
      const a1 = this.angleFor(cum[i + 1]);
      if (a1 - a0 < 0.0004) return;
      const path = el('path', {
        d: arcPath(this.cx, this.cy, this.rOuter, this.rInner, a0, a1),
        fill: this.meta[key].color,
        'data-key': key,
      });
      const title = el('title');
      title.textContent = this.meta[key].label;
      path.append(title);
      this.wedges.append(path);
    });

    // One handle per boundary, the seam at index 0 included.
    const r = (this.rOuter + this.rInner) / 2;
    for (let i = 0; i < this.keys.length; i++) {
      const a = this.angleFor(cum[i]);
      const x = this.cx + r * Math.cos(a);
      const y = this.cy + r * Math.sin(a);
      const group = el('g', { class: 'wheel-handle', 'data-boundary': i });
      // A generous invisible target, so the grip is easier than it looks.
      group.append(
        el('circle', { cx: x, cy: y, r: 11, fill: 'transparent' }),
        el('circle', { cx: x, cy: y, r: 5, class: 'wheel-dot' })
      );
      this.handles.append(group);
    }

    const total = this.total() || 1;
    this.legend.replaceChildren(
      ...this.keys.map((key) => {
        const row = document.createElement('button');
        row.className = 'wheel-row';
        row.dataset.key = key;
        const pct = Math.round((Math.max(0, this.values[key] || 0) / total) * 100);
        row.innerHTML = `<i style="background:${this.meta[key].color}"></i><span>${this.meta[key].label}</span><b>${pct}%</b>`;
        return row;
      })
    );
  }

  showCentre(text) {
    this.centre.textContent = text || '';
  }

  bind() {
    let dragging = null;

    const fractionAt = (event) => {
      const rect = this.svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * this.size - this.cx;
      const y = ((event.clientY - rect.top) / rect.height) * this.size - this.cy;
      const a = Math.atan2(y, x) + Math.PI / 2;
      return (((a / TAU) % 1) + 1) % 1;
    };

    this.svg.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.wheel-handle');
      if (!handle) return;
      dragging = Number(handle.dataset.boundary);
      this.svg.setPointerCapture(e.pointerId);
      this.svg.classList.add('dragging');
      e.preventDefault();
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (dragging == null) return;
      const n = this.keys.length;
      const cum = this.cumulative();
      const total = this.total() || 1;
      const target = fractionAt(e);
      const i = dragging;

      if (i === 0) {
        // The seam. Turning it clockwise takes from the first kind and gives
        // to the last, and rotates the ring so the handle follows the pointer.
        const raw = wrapDelta(target, this.rotation);
        const first = this.keys[0];
        const last = this.keys[n - 1];
        const delta = Math.max(-cum[n] + cum[n - 1], Math.min(cum[1], raw));
        this.rotation = (((this.rotation + delta) % 1) + 1) % 1;
        this.values[first] = Math.max(0, (cum[1] - delta) * total);
        this.values[last] = Math.max(0, (1 - cum[n - 1] + delta) * total);
        this.showCentre(`${this.meta[last].label} · ${this.meta[first].label}`);
      } else {
        const rel = (((target - this.rotation) % 1) + 1) % 1;
        const frac = Math.min(cum[i + 1], Math.max(cum[i - 1], rel));
        this.values[this.keys[i - 1]] = (frac - cum[i - 1]) * total;
        this.values[this.keys[i]] = (cum[i + 1] - frac) * total;
        this.showCentre(`${this.meta[this.keys[i - 1]].label} · ${this.meta[this.keys[i]].label}`);
      }

      this.render();
      this.onChange({ ...this.values });
    });

    const stop = (e) => {
      if (dragging == null) return;
      dragging = null;
      this.svg.classList.remove('dragging');
      this.showCentre('');
      try {
        this.svg.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    };
    this.svg.addEventListener('pointerup', stop);
    this.svg.addEventListener('pointercancel', stop);

    // Clicking a legend row nudges that kind up, shift-click nudges it down.
    this.legend.addEventListener('click', (e) => {
      const row = e.target.closest('.wheel-row');
      if (!row) return;
      const key = row.dataset.key;
      const total = this.total() || 1;
      const step = total * 0.05;
      const next = Math.max(0, (this.values[key] || 0) + (e.shiftKey ? -step : step));
      // Never let the last of the weight disappear, or there is nothing to
      // pick from and nothing left to drag back.
      if (next === 0 && this.total() - (this.values[key] || 0) <= 0) return;
      this.values[key] = next;
      this.render();
      this.onChange({ ...this.values });
    });

    this.legend.addEventListener('pointerover', (e) => {
      const row = e.target.closest('.wheel-row');
      if (row) this.showCentre(this.meta[row.dataset.key].label);
    });
    this.legend.addEventListener('pointerout', () => this.showCentre(''));
  }

  set(values) {
    this.values = { ...values };
    this.render();
  }
}
