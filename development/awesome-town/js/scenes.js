// Named scenes.
//
// A scene is just params plus overrides, so the whole library is a few
// kilobytes and lives in localStorage. Files exported from here are the same
// shape, which means a saved file can be dropped back into the menu.

const KEY = 'awesome-town-scenes-v1';
const AUTO = 'awesome-town-auto-v1';

// The project was called Collage City before it was Awesome Town. Carry over
// anything saved under the old names once, so a rename costs nobody their work.
(function migrate() {
  try {
    for (const [from, to] of [
      ['collage-city-scenes-v1', KEY],
      ['collage-city-auto-v1', AUTO],
      ['collage-city-v1', AUTO],
    ]) {
      const old = localStorage.getItem(from);
      if (old && !localStorage.getItem(to)) localStorage.setItem(to, old);
    }
  } catch {
    /* private mode, nothing to carry over */
  }
})();

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export const Scenes = {
  list() {
    const all = readAll();
    return Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
  },

  get(name) {
    return readAll()[name] || null;
  },

  save(name, params, overrides) {
    const all = readAll();
    all[name] = {
      version: 2,
      name,
      savedAt: Date.now(),
      params: { ...params },
      overrides: JSON.parse(JSON.stringify(overrides)),
    };
    return writeAll(all);
  },

  remove(name) {
    const all = readAll();
    delete all[name];
    return writeAll(all);
  },

  rename(from, to) {
    const all = readAll();
    if (!all[from] || from === to) return false;
    all[to] = { ...all[from], name: to, savedAt: Date.now() };
    delete all[from];
    return writeAll(all);
  },

  // The working state, restored on reload so a session survives a refresh.
  saveAuto(params, overrides, current) {
    try {
      localStorage.setItem(AUTO, JSON.stringify({ params, overrides, current }));
    } catch {
      /* private mode or quota, not worth interrupting the session */
    }
  },

  loadAuto() {
    try {
      return JSON.parse(localStorage.getItem(AUTO) || 'null');
    } catch {
      return null;
    }
  },
};
