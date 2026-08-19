// Asking before doing something that cannot be taken back.
//
// The browser's own confirm() would do, but it cannot say what is about to
// break — and for a library where components reference each other, what is
// about to break is the entire question. Deleting a sphere used by four
// assemblies is a different decision from deleting one nothing points at,
// and the dialog is only worth showing if it tells you which one this is.

import { h, setChildren } from './ui.js';

let open = null;

export function confirmDialog({ title, message, detail, confirmLabel = 'Delete', danger = true }) {
  close();

  return new Promise((resolve) => {
    const finish = (answer) => {
      close();
      resolve(answer);
    };

    const cancel = h('button', { class: 'btn' }, 'Cancel');
    cancel.addEventListener('click', () => finish(false));

    const go = h('button', { class: `btn ${danger ? 'danger-solid' : 'primary'}` }, confirmLabel);
    go.addEventListener('click', () => finish(true));

    const panel = h(
      'div',
      { class: 'dlg-panel' },
      h('h2', {}, title),
      message ? h('p', { class: 'dlg-msg' }, message) : null,
      detail ? h('p', { class: 'dlg-detail' }, detail) : null,
      h('div', { class: 'dlg-actions' }, h('span', { class: 'grow' }), cancel, go)
    );

    open = h('div', { class: 'dlg-overlay' }, panel);
    // Clicking away and Escape both mean no. The only way to the destructive
    // answer is the button that names it.
    open.addEventListener('click', (e) => {
      if (e.target === open) finish(false);
    });
    open._onKey = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    document.addEventListener('keydown', open._onKey);
    document.body.appendChild(open);
    go.focus();
  });
}

export function close() {
  if (!open) return;
  if (open._onKey) document.removeEventListener('keydown', open._onKey);
  open.remove();
  open = null;
}

// A small prompt for a name, in the same clothes as the confirm, so creating
// and renaming do not drop out of the app into a browser chrome dialog.
export function promptDialog({ title, message, value = '', confirmLabel = 'Save' }) {
  close();

  return new Promise((resolve) => {
    const finish = (answer) => {
      close();
      resolve(answer);
    };

    const input = h('input', { type: 'text', class: 'dlg-input', value });

    const cancel = h('button', { class: 'btn' }, 'Cancel');
    cancel.addEventListener('click', () => finish(null));

    const go = h('button', { class: 'btn primary' }, confirmLabel);
    const submit = () => {
      const text = input.value.trim();
      finish(text || null);
    };
    go.addEventListener('click', submit);

    const panel = h(
      'div',
      { class: 'dlg-panel' },
      h('h2', {}, title),
      message ? h('p', { class: 'dlg-msg' }, message) : null,
      input,
      h('div', { class: 'dlg-actions' }, h('span', { class: 'grow' }), cancel, go)
    );

    open = h('div', { class: 'dlg-overlay' }, panel);
    open.addEventListener('click', (e) => {
      if (e.target === open) finish(null);
    });
    open._onKey = (e) => {
      if (e.key === 'Escape') finish(null);
      if (e.key === 'Enter') submit();
    };
    document.addEventListener('keydown', open._onKey);
    document.body.appendChild(open);
    input.focus();
    input.select();
  });
}
