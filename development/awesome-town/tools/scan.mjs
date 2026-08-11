// Rebuilds collage/manifest.json from whatever is sitting in collage/.
// Drop new images into that folder, then:  node tools/scan.mjs
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'collage');
const OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

const files = (await readdir(dir))
  .filter((f) => OK.has(path.extname(f).toLowerCase()))
  .sort();

await writeFile(
  path.join(dir, 'manifest.json'),
  JSON.stringify({ images: files }, null, 2) + '\n'
);
console.log(`manifest.json -?" ${files.length} images`);
