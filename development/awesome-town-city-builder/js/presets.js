// Bundled scenes shipped with the site — distinct from Scenes (scenes.js),
// which is the visitor's own library saved to localStorage. These are read
// once from disk at boot and never written back to; picking one from the
// menu loads it the same way a saved scene does, but "save" always makes a
// separate localStorage copy rather than touching the file it came from.

export async function loadPresets(dir = 'presets') {
  try {
    const res = await fetch(`${dir}/manifest.json`);
    if (!res.ok) return [];
    const { files } = await res.json();
    const scenes = await Promise.all(
      (files || []).map((name) =>
        fetch(`${dir}/${name}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    return scenes.filter((s) => s && s.params);
  } catch {
    return [];
  }
}
