// Undo and redo.
//
// Everything the editor can change lives in two plain objects: params and
// overrides. That makes history a matter of snapshotting those rather than
// journalling individual operations, which keeps it honest — a snapshot can
// never drift from the thing it describes, the way a replayed command log
// eventually does once one command forgets to record its inverse.
//
// Rapid changes of the same kind collapse into one entry. A slider fires an
// event per pixel of travel, and without coalescing a single drag would bury
// every earlier step under a hundred near-identical ones.

const LIMIT = 80;
const COALESCE_MS = 700;

export class History {
  // read: () => ({ params, overrides }). write: (snapshot) => void.
  constructor(read, write, limit = LIMIT) {
    this.read = read;
    this.write = write;
    this.limit = limit;
    this.stack = [];
    this.index = -1;
    this.lastKey = null;
    this.lastAt = 0;
    // Set while an undo is being applied, so restoring state does not itself
    // get recorded as a new step.
    this.muted = false;
    this.listeners = new Set();
  }

  // Whatever read() hands back, cloned. Deliberately incurious about the
  // shape: the town snapshots params and overrides, the component editor
  // snapshots its edit layer, and neither needs its own history class.
  //
  // What must never go in here is view state. Which component is open, which
  // part is selected, where the camera is: undoing a change should not also
  // teleport you somewhere else, and a snapshot that carries the viewport
  // around is a snapshot that fights the user.
  snapshot() {
    return structuredClone(this.read());
  }

  reset() {
    this.stack = [this.snapshot()];
    this.index = 0;
    this.lastKey = null;
    this.emit();
  }

  // key groups changes that should collapse together while they keep coming.
  // Pass null for anything discrete — a delete or a reroll should always be
  // its own step even if two happen in quick succession.
  record(key = null) {
    if (this.muted) return;
    if (this.index < 0) return this.reset();
    const now = performance.now();
    const coalesce = key !== null && key === this.lastKey && now - this.lastAt < COALESCE_MS;
    this.lastKey = key;
    this.lastAt = now;

    const snap = this.snapshot();
    if (coalesce) {
      this.stack[this.index] = snap;
      this.emit();
      return;
    }
    // Anything that was undone is no longer reachable once a new branch starts.
    this.stack.length = this.index + 1;
    this.stack.push(snap);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    this.emit();
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.stack.length - 1;
  }

  undo() {
    if (!this.canUndo()) return false;
    this.index--;
    this.apply();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this.index++;
    this.apply();
    return true;
  }

  apply() {
    this.muted = true;
    // A restored state must not coalesce with whatever was being dragged
    // before it, or the next edit would silently overwrite this step.
    this.lastKey = null;
    this.write(structuredClone(this.stack[this.index]));
    this.muted = false;
    this.emit();
  }

  // How many steps back and forward are available, for the UI to show.
  depth() {
    return { back: Math.max(0, this.index), forward: Math.max(0, this.stack.length - 1 - this.index) };
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this));
  }
}
