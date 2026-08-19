// The corner readout, shared by both windows.
//
// One fact per row, label left and number right. Same reasoning as the
// shortcut list: this exists to be glanced at while you are doing something
// else, and a glance down an aligned column is faster than reading a sentence
// of numbers separated by dots. Keeping the values in their own column also
// means a changing number does not shuffle the words beside it, which is what
// made the old inline version twitch every half second.
//
// Rows are `[label, value]`, and the caller decides which rows exist. Nothing
// here knows whether it is describing a town or a component.

export function writeStats(el, rows) {
  if (!el) return;
  el.textContent = '';
  for (const [label, value] of rows) {
    const k = document.createElement('span');
    k.textContent = label;
    const v = document.createElement('b');
    v.textContent = String(value);
    el.append(k, v);
  }
}
