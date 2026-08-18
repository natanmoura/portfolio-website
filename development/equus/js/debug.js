// The instruments. Reading motion off a chart is faster and far less
// forgiving than reading it off the horse, so these are the primary way we
// verify the simulation rather than an afterthought.
//
// The timing chart is a footfall diagram: one row per limb, stance drawn solid
// and swing left open, with a playhead at the current stride phase. Checking a
// gait means comparing this against the published footfall table, which is a
// numeric check rather than a matter of opinion.

import { CHART_ORDER, limbPhase, isStance } from './gaits.js';

const ROW_LABEL = {
  'H.L': 'hind L',
  'H.R': 'hind R',
  'F.L': 'fore L',
  'F.R': 'fore R',
};

// Hinds warm, fores cool, matching the blockout colours so a bar and a leg are
// recognisably the same limb.
const ROW_COLOR = {
  'H.L': '#c99a72',
  'H.R': '#a97e5c',
  'F.L': '#d8b48a',
  'F.R': '#b89468',
};

export function createTimingChart(canvas) {
  const ctx = canvas.getContext('2d');

  function draw({ gait, stridePhase, duty, strideFreq, froudeNumber, speed, maxFreq }) {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Paint the ground rather than leaving it transparent for CSS to back. The
    // chart is the main verification instrument, so it has to stay readable when
    // it is saved out as an image on its own.
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, w, h);

    const padL = 54;
    const padR = 16; // room for the 1.00 axis label, which is centred on the tick
    const padT = 18;
    const padB = 42; // two lines of readout below the axis
    const trackW = w - padL - padR;
    const rows = CHART_ORDER.length;
    const rowH = (h - padT - padB) / rows;
    const barH = Math.min(14, rowH * 0.56);

    // Phase grid at quarters, because even spacing is what a four beat walk
    // should land on and the eye can check that instantly.
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.lineWidth = 1;
    for (let q = 0; q <= 4; q++) {
      const x = padL + (trackW * q) / 4;
      ctx.beginPath();
      ctx.moveTo(x, padT - 6);
      ctx.lineTo(x, h - padB + 4);
      ctx.stroke();
      ctx.textAlign = q === 0 ? 'left' : q === 4 ? 'right' : 'center';
      ctx.fillText((q / 4).toFixed(2), x, h - padB + 16);
    }

    for (let i = 0; i < rows; i++) {
      const limb = CHART_ORDER[i];
      const y = padT + rowH * i + rowH / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(ROW_LABEL[limb], padL - 8, y + 3);

      // Open track for the whole stride.
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeRect(padL, y - barH / 2, trackW, barH);

      // Stance runs from the limb's offset for `duty` of the stride, and wraps.
      const start = gait.offsets[limb] ?? 0;
      ctx.fillStyle = ROW_COLOR[limb];
      const seg = (a, b) => {
        const x0 = padL + trackW * a;
        const x1 = padL + trackW * b;
        ctx.fillRect(x0, y - barH / 2 + 0.5, Math.max(1, x1 - x0), barH - 1);
      };
      const end = start + duty;
      if (end <= 1) seg(start, end);
      else {
        seg(start, 1);
        seg(0, end - 1);
      }

      // A tick where this limb makes contact, which is the beat you would hear.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(padL + trackW * start - 0.5, y - barH / 2 - 4, 1.5, 4);

      // Solid dot while this limb is loaded, so the support set is legible
      // without decoding the bars.
      if (isStance(gait, limb, stridePhase, duty)) {
        ctx.beginPath();
        ctx.arc(padL - 44, y + 0.5, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = ROW_COLOR[limb];
        ctx.fill();
      }
    }

    // Playhead.
    const px = padL + trackW * (stridePhase - Math.floor(stridePhase));
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, padT - 8);
    ctx.lineTo(px, h - padB + 2);
    ctx.stroke();

    // Suspension marker: any phase where no limb is in stance. Reading this off
    // the chart is how we confirm a gallop actually leaves the ground and a walk
    // never does.
    let airborne = true;
    for (const limb of CHART_ORDER) {
      if (isStance(gait, limb, stridePhase, duty)) {
        airborne = false;
        break;
      }
    }

    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = airborne ? '#ffd479' : 'rgba(255,255,255,0.45)';
    ctx.fillText(airborne ? 'AIRBORNE' : 'supported', padL, 11);

    // Two short lines rather than one long one, because a single line overflows
    // a narrow panel and gets clipped at the left.
    const freqPct = maxFreq ? Math.round((strideFreq / maxFreq) * 100) : 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(`${gait.name}  ${speed.toFixed(2)} m/s  Fr ${froudeNumber.toFixed(2)}`, padL, h - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText(`duty ${duty.toFixed(2)}   ${strideFreq.toFixed(2)} Hz, ${freqPct}% of ceiling`, padL, h - 3);
  }

  return { draw };
}

// Ground reaction force per limb, drawn against the published gallop peaks so the
// simulation can be checked rather than admired. The dashed line is 14.0 N/kg,
// the measured peak for a non lead forelimb, which nothing should meaningfully
// exceed at a normal gallop.
export function createForceChart(canvas) {
  const ctx = canvas.getContext('2d');
  const ROW = { 'H.L': '#c99a72', 'H.R': '#a97e5c', 'F.L': '#d8b48a', 'F.R': '#b89468' };
  const LABEL = { 'H.L': 'hind L', 'H.R': 'hind R', 'F.L': 'fore L', 'F.R': 'fore R' };
  const REF = 14.0;

  function draw(loadState, mass) {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, w, h);

    const padL = 54;
    const padR = 46;
    const padT = 8;
    const padB = 20;
    const trackW = w - padL - padR;
    const max = REF * 1.25;
    const rows = CHART_ORDER.length;
    const rowH = (h - padT - padB) / rows;
    const barH = Math.min(13, rowH * 0.58);

    ctx.font = '10px ui-monospace, monospace';

    for (let i = 0; i < rows; i++) {
      const limb = CHART_ORDER[i];
      const y = padT + rowH * i + rowH / 2;
      const f = loadState?.[limb]?.force ?? 0;

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(LABEL[limb], padL - 8, y + 3);

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(padL, y - barH / 2, trackW, barH);

      ctx.fillStyle = ROW[limb];
      ctx.fillRect(padL, y - barH / 2 + 0.5, Math.max(0, (f / max) * trackW), barH - 1);

      ctx.fillStyle = f > 0 ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.22)';
      ctx.textAlign = 'left';
      ctx.fillText(f.toFixed(1), w - padR + 6, y + 3);
    }

    // The measured reference peak.
    const rx = padL + (REF / max) * trackW;
    ctx.strokeStyle = 'rgba(255,212,121,0.55)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(rx, padT);
    ctx.lineTo(rx, h - padB + 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,212,121,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('14.0 measured', rx, h - padB + 13);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    const total = loadState?.total ?? 0;
    ctx.fillText(
      loadState?.airborne ? 'airborne' : `${(total / 9.81).toFixed(2)}g  ${Math.round(total * mass)} N`,
      padL,
      h - padB + 13
    );
  }

  return { draw };
}

// Hoof path traces. The arc a hoof describes through space is the single most
// useful diagnostic in locomotion work, because a wrong arc is obvious on a line
// and almost invisible on a moving figure.
//
// Traces are drawn in world space and only recorded while moving, so a paused
// horse does not pile up a thousand coincident points.
export function createTraces(THREE, scene, { limbs, length = 260 } = {}) {
  const COLOR = { 'H.L': 0xc99a72, 'H.R': 0xa97e5c, 'F.L': 0xd8b48a, 'F.R': 0xb89468 };
  const group = new THREE.Group();
  group.name = 'traces';
  scene.add(group);

  const lines = {};
  for (const limb of limbs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(length * 3), 3));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: COLOR[limb] ?? 0xffffff, transparent: true, opacity: 0.9 })
    );
    line.frustumCulled = false;
    group.add(line);
    lines[limb] = { line, geo, count: 0, head: 0 };
  }

  return {
    group,
    push(state) {
      for (const limb of limbs) {
        const l = lines[limb];
        const p = state[limb].pos;
        const arr = l.geo.attributes.position.array;
        // Skip a sample that has barely moved, so the buffer covers distance
        // rather than time.
        if (l.count > 0) {
          const i = ((l.head - 1 + length) % length) * 3;
          const dx = arr[i] - p.x;
          const dy = arr[i + 1] - p.y;
          const dz = arr[i + 2] - p.z;
          if (dx * dx + dy * dy + dz * dz < 0.0009) continue;
        }
        arr[l.head * 3] = p.x;
        arr[l.head * 3 + 1] = p.y;
        arr[l.head * 3 + 2] = p.z;
        l.head = (l.head + 1) % length;
        l.count = Math.min(l.count + 1, length);
        // Drawing a ring buffer as one polyline would close it with a wrong
        // segment, so only draw up to the head until it has wrapped once.
        l.geo.setDrawRange(0, l.count < length ? l.count : length);
        l.geo.attributes.position.needsUpdate = true;
        l.geo.computeBoundingSphere();
      }
    },
    clear() {
      for (const limb of limbs) {
        const l = lines[limb];
        l.count = 0;
        l.head = 0;
        l.geo.setDrawRange(0, 0);
      }
    },
    set visible(v) {
      group.visible = v;
    },
  };
}

// Small text readout for anything that does not deserve a chart.
export function createReadout(host) {
  return {
    set(lines) {
      host.textContent = lines.join('\n');
    },
  };
}
