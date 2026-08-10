/* ═══════════════════════════════════════════════════════════════
   build-prices.mjs — regenerate recipes/js/prices.js
   ───────────────────────────────────────────────────────────────
   The site is static, so it can't read the shopping databases at
   runtime. This flattens them into one small JS file it can.

   Those databases live OUTSIDE this repo on purpose — they hold
   personal purchase history, and only the per-unit rate is needed
   here. Product names, brands, URLs and the buying notes all stay
   where they are.

   Run after a shopping run, once prices have been written back:

     node recipes/tools/build-prices.mjs

   ADDING A STORE: add an entry to STORES below and point `active`
   at it. Every store already listed keeps its prices — moving away
   from a store doesn't discard what it knew, so moving back later
   costs nothing.
   ═══════════════════════════════════════════════════════════════ */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'js', 'prices.js');

const STORES = {
  saveonfoods: {
    name: 'Save-On-Foods',
    currency: 'CAD',
    history: 'D:/Dropbox/Projects/saveonfoods-shopping/saveonfoods-purchase-history.json',
  },
};

/* Which store the site prices against right now. */
const ACTIVE = 'saveonfoods';

async function readStore(id, cfg) {
  if (!existsSync(cfg.history)) {
    console.warn(`  ${id}: no history file at ${cfg.history} — skipping`);
    return null;
  }

  const raw = JSON.parse(await readFile(cfg.history, 'utf8'));
  const items = {};
  let priced = 0;
  let skipped = 0;
  let newest = null;

  for (const [key, it] of Object.entries(raw.items || {})) {
    const ppu = it.pricePerUnit;
    // A null price is a real answer — "searched for it, the store
    // doesn't carry it" — but it still can't be costed, so it's left
    // out rather than counted as zero.
    if (!ppu || typeof ppu.value !== 'number' || !ppu.unit) { skipped++; continue; }
    items[key.toLowerCase()] = { v: Number(ppu.value.toFixed(5)), u: ppu.unit };
    priced++;
    if (it.lastPurchased && (!newest || it.lastPurchased > newest)) newest = it.lastPurchased;
  }

  console.log(`  ${id}: ${priced} priced, ${skipped} without a usable price`);
  return { name: cfg.name, currency: cfg.currency, updated: newest, items };
}

const stores = {};
console.log('Reading shopping history…');
for (const [id, cfg] of Object.entries(STORES)) {
  const s = await readStore(id, cfg);
  if (s) stores[id] = s;
}

if (!stores[ACTIVE]) {
  throw new Error(`Active store "${ACTIVE}" produced no data — refusing to write an empty price file.`);
}

const body = `/* ═══════════════════════════════════════════════════════════════
   Moura Boys Forever Recipes — ingredient prices
   ───────────────────────────────────────────────────────────────
   GENERATED FILE — do not edit by hand.
   Rebuild with: node recipes/tools/build-prices.mjs

   Prices are per-unit rates (per g, per mL, or per whole item),
   keyed by the same grocery merge name the recipes use — so an
   ingredient's buyAs, or its n when there's no buyAs.

   Kept per store. Changing shops means pointing ACTIVE_STORE at a
   different key; the old store's prices stay put and still work if
   you go back.
   ═══════════════════════════════════════════════════════════════ */

const PRICE_STORES = ${JSON.stringify(stores, null, 2)};

const ACTIVE_STORE = ${JSON.stringify(ACTIVE)};

if (typeof window !== 'undefined') {
  window.PRICE_STORES = PRICE_STORES;
  window.ACTIVE_STORE = ACTIVE_STORE;
}
`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, body, 'utf8');
console.log(`\nWrote ${path.relative(process.cwd(), OUT)} — active store: ${ACTIVE}`);
