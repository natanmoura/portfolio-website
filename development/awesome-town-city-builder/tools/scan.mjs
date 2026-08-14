// Rebuilds collage/manifest.json from the three asset folders, and
// presets/manifest.json from whatever scene files are sitting in presets/.
// Drop new files in, then:
//   node tools/scan.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const collage = path.join(root, 'collage');
const presets = path.join(root, 'presets');
const OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

async function scan(dir, ok) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  return entries.filter((f) => ok.has(path.extname(f).toLowerCase())).sort();
}

const [images, cutouts, materials, sceneFiles] = await Promise.all([
  scan(path.join(collage, 'images'), OK),
  scan(path.join(collage, 'cutouts'), OK),
  scan(path.join(collage, 'materials'), OK),
  scan(presets, new Set(['.json'])),
]);

await writeFile(
  path.join(collage, 'manifest.json'),
  JSON.stringify({ images, cutouts, materials }, null, 2) + '\n'
);
console.log(
  `collage/manifest.json -> ${images.length} images, ${cutouts.length} cutouts, ${materials.length} materials`
);

const files = sceneFiles.filter((f) => f !== 'manifest.json');

// A preset's displayed name always tracks its filename — dropping in
// "big-town-day.json" and calling it that on disk is the only naming step;
// the label in the editor follows automatically rather than drifting from
// whatever the file happened to be called when it was first saved.
const titleFromFilename = (file) =>
  file
    .replace(/\.json$/i, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

let renamed = 0;
for (const file of files) {
  const full = path.join(presets, file);
  let data;
  try {
    data = JSON.parse(await readFile(full, 'utf8'));
  } catch {
    console.warn(`presets/${file} -> could not parse, left alone`);
    continue;
  }
  const wanted = titleFromFilename(file);
  if (data.name !== wanted) {
    data.name = wanted;
    await writeFile(full, JSON.stringify(data, null, 2) + '\n');
    renamed++;
  }
}

await writeFile(path.join(presets, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`presets/manifest.json -> ${files.length} presets${renamed ? `, ${renamed} renamed to match their file` : ''}`);
