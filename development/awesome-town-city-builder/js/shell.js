// The shell that holds both views.
//
// City Builder and Components were two documents, so crossing between them
// threw away the image pool, the component library and every rendered
// thumbnail, then spent a second and a half rebuilding them. It is one
// editing session — you lock a parameter on a component to see what it does
// to the town, and look back — and nothing about that is two documents.
//
// Both views still own their own module state and their own renderer. This
// only decides which one is on screen, and stops the hidden one drawing.
//
// The town loads first and the editor waits until you ask for it, because the
// town is what you came for. Once mounted, a view is never torn down: its
// scene, its camera position and its selection are all still there when you
// come back, which is the whole point.

const views = new Map();
let active = null;

function show(name) {
  if (active === name) return;
  active = name;

  for (const el of document.querySelectorAll('main[id^="view-"]')) {
    el.hidden = el.id !== `view-${name}`;
  }
  for (const el of document.querySelectorAll('.bar-tools')) {
    el.hidden = el.dataset.view !== name;
  }
  for (const el of document.querySelectorAll('.apptab')) {
    el.classList.toggle('on', el.dataset.view === name);
  }

  // A hidden renderer has nothing to draw and no size to measure. Telling
  // each view whether it is on screen is cheaper and more honest than either
  // one guessing from the DOM.
  for (const [key, view] of views) view.setActive?.(key === name);

  // The canvas was sized against a hidden element the first time it mounted,
  // so it has to re-measure on the way in. Every view has to answer this.
  views.get(name)?.resize?.();

  // Deep-linkable, and back and forward do the obvious thing.
  const url = new URL(location.href);
  if (name === 'city') url.searchParams.delete('view');
  else url.searchParams.set('view', name);
  history.replaceState(null, '', url);
}

const wanted = () => (new URL(location.href).searchParams.get('view') === 'components' ? 'components' : 'city');

const loadingEl = document.getElementById('loading');

async function open(name) {
  if (!views.has(name)) {
    // Whoever mounts first is who the curtain is waiting for. It used to be
    // dismissed at the end of the town's boot, so arriving straight at the
    // components view left it up over a perfectly finished editor.
    loadingEl.classList.remove('gone');
    // Loaded on first use. The editor is a renderer, an orbit control and a
    // library walk, and none of it is worth doing for someone who never
    // opens it.
    const mod = name === 'city' ? await import('./main.js') : await import('./editor.js');
    views.set(name, await mod.mount());
    loadingEl.classList.add('gone');
  }
  show(name);
}

for (const tab of document.querySelectorAll('.apptab')) {
  tab.addEventListener('click', () => open(tab.dataset.view));
}

window.addEventListener('popstate', () => open(wanted()));

open(wanted());
