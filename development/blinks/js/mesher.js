// Surface nets over a signed distance function. A coarse pass skips blocks the
// surface can't reach, so cost follows surface area rather than volume.

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const BLOCK = 4;

export function meshField(fn, min, max, cell) {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const V = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => i + nx * (j + ny * k);

  const bx = Math.ceil((nx - 1) / BLOCK) + 1, by = Math.ceil((ny - 1) / BLOCK) + 1, bz = Math.ceil((nz - 1) / BLOCK) + 1;
  const coarse = new Float32Array(bx * by * bz);
  for (let k = 0; k < bz; k++)
    for (let j = 0; j < by; j++)
      for (let i = 0; i < bx; i++)
        coarse[i + bx * (j + by * k)] = fn(min[0] + i * BLOCK * cell, min[1] + j * BLOCK * cell, min[2] + k * BLOCK * cell);

  const reach = BLOCK * cell * 2.2;
  for (let K = 0; K < bz - 1; K++)
    for (let J = 0; J < by - 1; J++)
      for (let I = 0; I < bx - 1; I++) {
        let far = true;
        const c = [];
        for (let q = 0; q < 8; q++) {
          const v = coarse[(I + CORNERS[q][0]) + bx * ((J + CORNERS[q][1]) + by * (K + CORNERS[q][2]))];
          c.push(v);
          if (Math.abs(v) < reach) far = false;
        }
        const i1 = Math.min((I + 1) * BLOCK, nx - 1), j1 = Math.min((J + 1) * BLOCK, ny - 1), k1 = Math.min((K + 1) * BLOCK, nz - 1);
        for (let k = K * BLOCK; k <= k1; k++)
          for (let j = J * BLOCK; j <= j1; j++)
            for (let i = I * BLOCK; i <= i1; i++) {
              if (far) {
                const u = (i - I * BLOCK) / BLOCK, v = (j - J * BLOCK) / BLOCK, w = (k - K * BLOCK) / BLOCK;
                V[at(i, j, k)] =
                  (c[0] * (1 - u) + c[1] * u) * (1 - v) * (1 - w) + (c[2] * (1 - u) + c[3] * u) * v * (1 - w) +
                  (c[4] * (1 - u) + c[5] * u) * (1 - v) * w + (c[6] * (1 - u) + c[7] * u) * v * w;
              } else {
                V[at(i, j, k)] = fn(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
              }
            }
      }

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let q = 0; q < 8; q++) {
          const v = V[at(i + CORNERS[q][0], j + CORNERS[q][1], k + CORNERS[q][2])];
          cv[q] = v;
          if (v < 0) mask |= 1 << q;
        }
        if (mask === 0 || mask === 255) continue;
        let ax = 0, ay = 0, az = 0, n = 0;
        for (const [a, b] of EDGES) {
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          ax += CORNERS[a][0] + t * (CORNERS[b][0] - CORNERS[a][0]);
          ay += CORNERS[a][1] + t * (CORNERS[b][1] - CORNERS[a][1]);
          az += CORNERS[a][2] + t * (CORNERS[b][2] - CORNERS[a][2]);
          n++;
        }
        cellV[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(min[0] + (i + ax / n) * cell, min[1] + (j + ay / n) * cell, min[2] + (k + az / n) * cell);
      }

  const ci = (i, j, k) => cellV[i + cx * (j + cy * k)];
  const ind = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) ind.push(a, c, b, a, d, c);
    else ind.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const in0 = V[at(i, j, k)] < 0;
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz && (V[at(i + 1, j, k)] < 0) !== in0)
          quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), in0);
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz && (V[at(i, j + 1, k)] < 0) !== in0)
          quad(ci(i - 1, j, k - 1), ci(i - 1, j, k), ci(i, j, k), ci(i, j, k - 1), in0);
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy && (V[at(i, j, k + 1)] < 0) !== in0)
          quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), in0);
      }

  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  const e = cell * 0.5;
  for (let v = 0; v < positions.length; v += 3) {
    const x = positions[v], y = positions[v + 1], z = positions[v + 2];
    let gx = fn(x + e, y, z) - fn(x - e, y, z);
    let gy = fn(x, y + e, z) - fn(x, y - e, z);
    let gz = fn(x, y, z + e) - fn(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[v] = gx / l; normals[v + 1] = gy / l; normals[v + 2] = gz / l;
  }

  // Winding is consistent by construction. Check one triangle against the
  // gradient and flip everything if the convention came out inside-out.
  if (ind.length) {
    let best = 0, flip = false;
    for (let t = 0; t < ind.length && t < 300; t += 3) {
      const a = ind[t] * 3, b = ind[t + 1] * 3, c = ind[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const wx = positions[c] - positions[a], wy = positions[c + 1] - positions[a + 1], wz = positions[c + 2] - positions[a + 2];
      const nx_ = uy * wz - uz * wy, ny_ = uz * wx - ux * wz, nz_ = ux * wy - uy * wx;
      const d = nx_ * normals[a] + ny_ * normals[a + 1] + nz_ * normals[a + 2];
      if (Math.abs(d) > Math.abs(best)) { best = d; flip = d < 0; }
    }
    if (flip) for (let t = 0; t < ind.length; t += 3) { const s = ind[t + 1]; ind[t + 1] = ind[t + 2]; ind[t + 2] = s; }
  }

  const indices = positions.length / 3 > 65535 ? new Uint32Array(ind) : new Uint16Array(ind);
  return { positions, normals, indices };
}
