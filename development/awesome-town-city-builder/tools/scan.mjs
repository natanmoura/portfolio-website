// Rebuilds collage/manifest.json from the three asset folders.
// Drop new files into collage/images, collage/cutouts or collage/materials, then:
//   node tools/scan.mjs
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const collage = path.join(here, '..', 'collage');
const OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

async function scan(name) {
  const dir = path.join(collage, name);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  return entries.filter((f) => OK.has(path.extname(f).toLowerCase())).sort();
}

const [images, cutouts, materials] = await Promise.all([
  scan('images'),
  scan('cutouts'),
  scan('materials'),
]);

await writeFile(
  path.join(collage, 'manifest.json'),
  JSON.stringify({ images, cutouts, materials }, null, 2) + '\n'
);
console.log(
  `manifest.json -> ${images.length} images, ${cutouts.length} cutouts, ${materials.length} materials`
);
