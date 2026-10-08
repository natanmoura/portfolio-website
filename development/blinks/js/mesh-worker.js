import { evalPrims } from './sdf.js';
import { meshField } from './mesher.js';
import { gooField } from './goo.js';
import { groupWeights } from './genome.js';

self.onmessage = ({ data }) => {
  const { id, min, max, cell } = data;
  const fn = data.goo
    ? gooField(data.goo.parts, data.goo.kAB, data.goo.kC)
    : (x, y, z) => evalPrims(data.prims, x, y, z);
  const m = meshField(fn, min, max, cell);
  const out = { id, ...m };
  const transfer = [m.positions.buffer, m.normals.buffer, m.indices.buffer];
  if (!data.goo) {
    const n = m.positions.length / 3;
    const w = new Float32Array(n * 4);
    const tmp = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      groupWeights(data.prims, m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2], tmp);
      w.set(tmp, i * 4);
    }
    out.weights = w;
    transfer.push(w.buffer);
  }
  self.postMessage(out, transfer);
};
