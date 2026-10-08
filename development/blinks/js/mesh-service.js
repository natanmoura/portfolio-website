// Meshing runs in workers so growth and merge goo never stall a frame.
// Goo jobs jump the queue because they are on screen right now.

const POOL = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
const workers = [];
const busy = [];
const queue = [];
const waiting = new Map();
let nextId = 1;

function pump() {
  for (let i = 0; i < workers.length && queue.length; i++) {
    if (busy[i]) continue;
    const msg = queue.shift();
    busy[i] = true;
    workers[i].postMessage(msg);
  }
}

for (let i = 0; i < POOL; i++) {
  const w = new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }) => {
    busy[i] = false;
    const resolve = waiting.get(data.id);
    waiting.delete(data.id);
    resolve?.(data);
    pump();
  };
  workers.push(w);
  busy.push(false);
}

function submit(msg, urgent) {
  const id = nextId++;
  msg.id = id;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    urgent ? queue.unshift(msg) : queue.push(msg);
    pump();
  });
}

export function meshAsync(prims, bounds, cell) {
  return submit({ prims, min: bounds.min, max: bounds.max, cell }, false);
}

export function meshGooAsync(goo, min, max, cell) {
  return submit({ goo, min, max, cell }, true);
}
