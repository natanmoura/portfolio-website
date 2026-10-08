import { evalPrims, smin } from './sdf.js';

// The blended field of creatures mid-merge. Pure data in, so it runs in a worker.
// Each part: { prims, inv (16 floats, world to body local), s, center, R }.
export function gooField(parts, kAB, kC) {
  const fns = parts.map(({ prims, inv: e, s, center, R }) => (x, y, z) => {
    const dx = x - center[0], dy = y - center[1], dz = z - center[2];
    const dc = Math.sqrt(dx * dx + dy * dy + dz * dz) - R;
    if (dc > 0.25) return dc;
    const lx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const ly = e[1] * x + e[5] * y + e[9] * z + e[13];
    const lz = e[2] * x + e[6] * y + e[10] * z + e[14];
    return evalPrims(prims, lx, ly, lz) * s;
  });
  const [fa, fb, fc] = fns;
  return (x, y, z) => {
    let d = smin(fa(x, y, z), fb(x, y, z), kAB);
    if (fc) d = smin(d, fc(x, y, z), kC);
    return d;
  };
}
