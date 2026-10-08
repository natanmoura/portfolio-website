import * as THREE from 'three';

// Little mood marks that pop above a head, rise and fade. Only the moods the
// creatures can actually have: love, anger, sleep, and a surprise tick.

function canvasTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

const DRAW = {
  heart: (ctx) => {
    ctx.fillStyle = '#1b1a1f';
    ctx.beginPath();
    ctx.moveTo(64, 104);
    ctx.bezierCurveTo(16, 74, 14, 34, 42, 28);
    ctx.bezierCurveTo(54, 26, 62, 34, 64, 44);
    ctx.bezierCurveTo(66, 34, 74, 26, 86, 28);
    ctx.bezierCurveTo(114, 34, 112, 74, 64, 104);
    ctx.fill();
  },
  angry: (ctx) => {
    ctx.strokeStyle = '#1b1a1f';
    ctx.lineWidth = 9;
    for (const [x, a] of [[34, -0.35], [64, 0], [94, 0.35]]) {
      ctx.save();
      ctx.translate(x, 70);
      ctx.rotate(a);
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const y = 30 - i * 12;
        const px = i % 2 ? 6 : -6;
        i ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  },
  z: (ctx) => {
    ctx.strokeStyle = '#1b1a1f';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(36, 36);
    ctx.lineTo(92, 36);
    ctx.lineTo(36, 94);
    ctx.lineTo(92, 94);
    ctx.stroke();
  },
  note: (ctx) => {
    ctx.fillStyle = '#1b1a1f';
    ctx.strokeStyle = '#1b1a1f';
    ctx.save();
    ctx.translate(50, 94);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(64, 90);
    ctx.lineTo(64, 18);
    ctx.quadraticCurveTo(70, 40, 96, 50);
    ctx.stroke();
  },
  surprise: (ctx) => {
    ctx.strokeStyle = '#1b1a1f';
    ctx.lineWidth = 8;
    for (const [x1, y1, x2, y2] of [[30, 66, 14, 54], [44, 40, 34, 22], [64, 32, 64, 12], [84, 40, 94, 22], [98, 66, 114, 54]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  },
};

// Hearts and Z's are particles that drift up and fade. Surprise and anger are
// a single mark per creature that sits on its head for as long as the mood lasts.
export class Emotes {
  constructor(scene) {
    this.scene = scene;
    this.tex = {};
    for (const k in DRAW) this.tex[k] = canvasTex(DRAW[k]);
    this.live = [];
    this.marks = new Map();
  }

  sprite(type) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex[type], transparent: true, depthWrite: false }));
    s.renderOrder = 10;
    s.layers.set(4);
    this.scene.add(s);
    return s;
  }

  spawn(type, pos, size, drift = 0, rise = 1) {
    const s = this.sprite(type);
    s.position.copy(pos);
    if (type === 'heart') rise *= 1.6;
    const life = type === 'z' ? 1.8 : type === 'note' ? 1.6 : 1.3;
    this.live.push({ s, type, t: 0, life: life / Math.sqrt(rise), size, rise, vx: drift || (Math.random() - 0.5) * 0.15, ph: Math.random() * 6.3 });
  }

  // A particle flung along a velocity that slows with drag, no upward drift.
  fling(type, pos, size, vel, life = 0.7) {
    const s = this.sprite(type);
    s.position.copy(pos);
    this.live.push({ s, type, t: 0, life, size, vel: vel.clone(), fling: true });
  }

  drop(s) {
    this.scene.remove(s);
    s.material.dispose();
  }

  update(dt, creatures) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.t += dt;
      const k = e.t / e.life;
      if (k >= 1) {
        this.drop(e.s);
        this.live.splice(i, 1);
        continue;
      }
      const pop = k < 0.18 ? easeBack(k / 0.18) : 1;
      e.s.scale.setScalar(e.size * pop * (e.type === 'z' ? 0.6 + k * 0.7 : 1));
      if (e.fling) {
        e.s.position.addScaledVector(e.vel, dt);
        e.vel.multiplyScalar(1 - Math.min(1, dt * 2.5));
      } else {
        e.s.position.y += dt * (e.type === 'z' ? 0.35 : 0.5) * e.size * 2 * e.rise;
        e.s.position.x += dt * (e.type === 'z' ? 0.25 : e.vx) * e.size * 2;
        // Notes bob from side to side as they float up.
        if (e.type === 'note') {
          e.s.position.x += Math.cos(e.t * 7 + e.ph) * 7 * 0.05 * e.size * dt;
          e.s.material.rotation = Math.sin(e.t * 7 + e.ph) * 0.3;
        }
      }
      e.s.material.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    }

    const head = new THREE.Vector3();
    for (const c of creatures) {
      const want = c.meshed && !c.hideAll ? c.markType || null : null;
      let m = this.marks.get(c);
      if (want && (!m || (m.type !== want && m.fade))) {
        if (m) this.drop(m.s);
        m = { s: this.sprite(want), type: want, t: 0, fade: 0 };
        this.marks.set(c, m);
      }
      if (!m) continue;
      if (m.type !== want) m.fade += dt * 6;
      m.t += dt;
      if (m.fade >= 1) {
        this.drop(m.s);
        this.marks.delete(c);
        continue;
      }
      c.headTop(head);
      const size = c.emoteSize() * (m.type === 'surprise' ? 1.25 : 1.05);
      const pop = m.t < 0.2 ? easeBack(m.t / 0.2) : 1;
      const jit = m.type === 'angry' ? 1 + Math.sin(m.t * 30) * 0.07 : 1 + Math.sin(m.t * 9) * 0.03;
      m.s.position.copy(head);
      m.s.position.y += size * 0.25;
      m.s.scale.setScalar(size * pop * jit * (1 - m.fade * 0.4));
      m.s.material.opacity = 1 - m.fade;
    }
    for (const [c, m] of this.marks) {
      if (!creatures.includes(c)) {
        this.drop(m.s);
        this.marks.delete(c);
      }
    }
  }
}

function easeBack(t) {
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
