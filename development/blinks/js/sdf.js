// Signed distance primitives. Bodies are lists of these blended with a smooth
// min, each prim carrying the blend radius it uses against everything before it.

export const S = (x, y, z, r, k = 0) => ({ t: 0, x, y, z, r, k });
export const E = (x, y, z, rx, ry, rz, k = 0) => ({ t: 1, x, y, z, rx, ry, rz, k });
export const C = (ax, ay, az, bx, by, bz, r1, r2, k = 0) => capsule({ ax, ay, az, bx, by, bz, r1, r2, k });
export const B = (x, y, z, hx, hy, hz, r, k = 0) => ({ t: 3, x, y, z, hx, hy, hz, r, k });
export const T = (x, y, z, R, r, k = 0) => ({ t: 4, x, y, z, R, r, k });
// A ring lying flat, like a halo or a hoop on the ground.
export const H = (x, y, z, R, r, k = 0) => ({ t: 5, x, y, z, R, r, k });

function capsule(p) {
  p.t = 2;
  p.dx = p.bx - p.ax;
  p.dy = p.by - p.ay;
  p.dz = p.bz - p.az;
  p.bb = p.dx * p.dx + p.dy * p.dy + p.dz * p.dz || 1e-6;
  return p;
}

export function primDist(p, x, y, z) {
  switch (p.t) {
    case 0: {
      const dx = x - p.x, dy = y - p.y, dz = z - p.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - p.r;
    }
    case 1: {
      const dx = x - p.x, dy = y - p.y, dz = z - p.z;
      const ax = dx / p.rx, ay = dy / p.ry, az = dz / p.rz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / p.rx, by = ay / p.ry, bz = az / p.rz;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      if (k1 < 1e-9) return -Math.min(p.rx, p.ry, p.rz);
      return (k0 * (k0 - 1)) / k1;
    }
    case 2: {
      const px = x - p.ax, py = y - p.ay, pz = z - p.az;
      let h = (px * p.dx + py * p.dy + pz * p.dz) / p.bb;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      const qx = px - p.dx * h, qy = py - p.dy * h, qz = pz - p.dz * h;
      return Math.sqrt(qx * qx + qy * qy + qz * qz) - (p.r1 + (p.r2 - p.r1) * h);
    }
    case 5: {
      const dx = x - p.x, dz = z - p.z;
      const q = Math.sqrt(dx * dx + dz * dz) - p.R, dy = y - p.y;
      return Math.sqrt(q * q + dy * dy) - p.r;
    }
    case 4: {
      const dx = x - p.x, dy = y - p.y;
      const q = Math.sqrt(dx * dx + dy * dy) - p.R, dz = z - p.z;
      return Math.sqrt(q * q + dz * dz) - p.r;
    }
    default: {
      const qx = Math.abs(x - p.x) - p.hx, qy = Math.abs(y - p.y) - p.hy, qz = Math.abs(z - p.z) - p.hz;
      const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
      return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
    }
  }
}

export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function evalPrims(prims, x, y, z) {
  let d = primDist(prims[0], x, y, z);
  for (let i = 1; i < prims.length; i++) d = smin(d, primDist(prims[i], x, y, z), prims[i].k);
  return d;
}

export function primsBounds(prims, pad = 0) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const add = (x, y, z, rx, ry, rz) => {
    min[0] = Math.min(min[0], x - rx); max[0] = Math.max(max[0], x + rx);
    min[1] = Math.min(min[1], y - ry); max[1] = Math.max(max[1], y + ry);
    min[2] = Math.min(min[2], z - rz); max[2] = Math.max(max[2], z + rz);
  };
  for (const p of prims) {
    if (p.t === 0) add(p.x, p.y, p.z, p.r, p.r, p.r);
    else if (p.t === 1) add(p.x, p.y, p.z, p.rx, p.ry, p.rz);
    else if (p.t === 2) {
      const r = Math.max(p.r1, p.r2);
      add(p.ax, p.ay, p.az, r, r, r);
      add(p.bx, p.by, p.bz, r, r, r);
    } else if (p.t === 4) add(p.x, p.y, p.z, p.R + p.r, p.R + p.r, p.r);
    else if (p.t === 5) add(p.x, p.y, p.z, p.R + p.r, p.r, p.R + p.r);
    else add(p.x, p.y, p.z, p.hx + p.r, p.hy + p.r, p.hz + p.r);
  }
  for (let i = 0; i < 3; i++) { min[i] -= pad; max[i] += pad; }
  return { min, max };
}

// Stretches body prims for growth: width by w, height by h. Spheres become
// ellipsoids so a ball grows into an egg instead of staying round.
export function scalePrim(p, w, h) {
  switch (p.t) {
    case 0: return E(p.x * w, p.y * h, p.z * w, p.r * w, p.r * h, p.r * w, p.k * w);
    case 1: return E(p.x * w, p.y * h, p.z * w, p.rx * w, p.ry * h, p.rz * w, p.k * w);
    case 2: return C(p.ax * w, p.ay * h, p.az * w, p.bx * w, p.by * h, p.bz * w, p.r1 * w, p.r2 * w, p.k * w);
    case 4: return T(p.x * w, p.y * h, p.z * w, p.R * (w + h) * 0.5, p.r * w, p.k * w);
    case 5: return H(p.x * w, p.y * h, p.z * w, p.R * w, p.r * w, p.k * w);
    default: {
      const r = p.r * w;
      return B(p.x * w, p.y * h, p.z * w, (p.hx + p.r) * w - r, (p.hy + p.r) * h - r, (p.hz + p.r) * w - r, r, p.k * w);
    }
  }
}
