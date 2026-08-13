// Rebuilds collage/manifest.json from the three asset folders, and
// presets/manifest.json from whatever scene files are sitting in presets/.
// Drop new files in, then:
//   node tools/scan.mjs
import { readdir, writeFile } from 'node:fs/promises';
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
await writeFile(path.join(presets, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`presets/manifest.json -> ${files.length} presets`);
