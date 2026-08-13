// The image pool, packed into one DataArrayTexture.
//
// Every image gets its own layer, so there is no atlas bleed at distance, and
// the whole pool binds as a single sampler. That is what lets every module in
// the city share one material and merge into a handful of draw calls.
//
// Each image is letterboxed into its square layer over a stretched copy of
// itself, so mip levels blur into something related rather than into black.
// The used sub-rect is recorded and folded into the UVs at build time.
//
// Two kinds share this pool: photographs ("image") and alpha-cut stickers
// ("cutout"). They are picked and cropped identically — the only difference
// is that a cutout's transparent pixels should punch through instead of
// rendering as an opaque rectangle. Which layers are cutouts is recorded in
// its own small texture, indexed by layer, so a billboard that swaps to a
// different picture at runtime looks up the flag for whatever it swapped to
// rather than the flag baked in at build time.
//
// A separate pool (same class, different fit) holds tileable materials —
// concrete, brick, wood. Those cover their whole layer with no letterbox,
// since they are read by repeating the UV rather than cropping to a rect.

import * as THREE from 'three';

const LAYER = 512;

export class ImagePool {
  constructor() {
    this.items = []; // { name, kind, aspect, rect, hot, avg, url }
    this.texture = null;
    this.listeners = new Set();
    this.canvas = document.createElement('canvas');
    this.canvas.width = LAYER;
    this.canvas.height = LAYER;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.layers = [];
    // Tracked separately so a building can be restricted to one half of the
    // pool. Images load before cutouts (see loadManifest), so the two stay
    // contiguous ranges — images at [0, imageCount), cutouts right after.
    this.imageCount = 0;
    this.cutoutCount = 0;
  }

  get length() {
    return this.items.length;
  }

  get(index) {
    if (!this.items.length) return null;
    return this.items[((index % this.items.length) + this.items.length) % this.items.length];
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // Loads the images/ and cutouts/ folders into one combined pool. Both crop
  // to cover their face the same way; only the cutout flag differs.
  async loadManifest(dir = 'collage', onProgress = () => {}) {
    const manifest = await this.fetchManifest(dir);
    const groups = [
      { sub: 'images', kind: 'image', names: manifest.images || [] },
      { sub: 'cutouts', kind: 'cutout', names: manifest.cutouts || [] },
    ];
    await this.loadGroups(dir, groups, 'contain', onProgress);
    return this.items.length;
  }

  // Loads materials/ into its own pool (a separate ImagePool instance in
  // practice), covering the whole layer with no letterbox since these tile.
  async loadMaterialManifest(dir = 'collage', onProgress = () => {}) {
    const manifest = await this.fetchManifest(dir);
    const groups = [{ sub: 'materials', kind: 'material', names: manifest.materials || [] }];
    await this.loadGroups(dir, groups, 'cover', onProgress);
    return this.items.length;
  }

  async fetchManifest(dir) {
    const res = await fetch(`${dir}/manifest.json`);
    if (!res.ok) throw new Error(`No ${dir}/manifest.json — run: node tools/scan.mjs`);
    return res.json();
  }

  async loadGroups(dir, groups, fit, onProgress) {
    const total = groups.reduce((n, g) => n + g.names.length, 0) || 1;
    let done = 0;
    const batch = 6;
    for (const g of groups) {
      for (let i = 0; i < g.names.length; i += batch) {
        const slice = g.names.slice(i, i + batch);
        const blobs = await Promise.all(
          slice.map((name) =>
            fetch(`${dir}/${g.sub}/${name}`)
              .then((r) => (r.ok ? r.blob() : null))
              .catch(() => null)
          )
        );
        for (let k = 0; k < slice.length; k++) {
          if (blobs[k]) await this.addBlob(blobs[k], slice[k], { kind: g.kind, fit });
        }
        done += slice.length;
        onProgress(done, total);
      }
    }
    this.rebuildTexture();
    this.listeners.forEach((fn) => fn(this));
  }

  async addBlob(blob, name, opts = {}) {
    const { kind = 'image', fit = 'contain' } = opts;
    // texture.flipY does nothing for bitmap and raw-data sources, so the flip
    // happens at decode time. Drawing a flipped bitmap into the canvas puts
    // row 0 of the pixel data at v = 0, which is what the sampler expects.
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
    } catch {
      return null;
    }
    const aspect = bitmap.width / bitmap.height;
    const { ctx } = this;
    ctx.clearRect(0, 0, LAYER, LAYER);

    let rect;
    if (fit === 'cover') {
      // A material tiles across its whole layer in the shader, so there is no
      // letterbox to hide — crop to fill instead of contain.
      const w = aspect >= 1 ? LAYER * aspect : LAYER;
      const h = aspect >= 1 ? LAYER : LAYER / aspect;
      ctx.drawImage(bitmap, (LAYER - w) / 2, (LAYER - h) / 2, w, h);
      rect = [0, 0, 1, 1];
    } else {
      const w = aspect >= 1 ? LAYER : Math.round(LAYER * aspect);
      const h = aspect >= 1 ? Math.round(LAYER / aspect) : LAYER;
      const x = Math.round((LAYER - w) / 2);
      const y = Math.round((LAYER - h) / 2);
      // Stretched underlay first, so mip levels bleed into related colour
      // instead of the letterbox padding. Skipped for cutouts: their padding
      // is meant to stay fully transparent, and a stretched copy of the same
      // source showed straight through the sticker's own transparent gaps as
      // a second, distorted exposure of the same picture.
      if (kind !== 'cutout') ctx.drawImage(bitmap, 0, 0, LAYER, LAYER);
      ctx.drawImage(bitmap, x, y, w, h);
      rect = [x / LAYER, y / LAYER, w / LAYER, h / LAYER];
    }
    bitmap.close();

    const pixels = ctx.getImageData(0, 0, LAYER, LAYER).data;
    this.layers.push(new Uint8Array(pixels));
    this.items.push({
      name,
      kind,
      aspect,
      rect,
      ...sampleColours(pixels),
      url: this.thumbnail(),
    });
    if (kind === 'image') this.imageCount++;
    else if (kind === 'cutout') this.cutoutCount++;
    return this.items[this.items.length - 1];
  }

  // The layer canvas holds the image flipped, because that is the orientation
  // the sampler wants. Flip it back for the picker so thumbnails read the
  // right way up.
  thumbnail() {
    const size = 112;
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas');
      this.thumbCanvas.width = size;
      this.thumbCanvas.height = size;
      this.thumbCtx = this.thumbCanvas.getContext('2d');
    }
    const c = this.thumbCtx;
    c.save();
    c.translate(0, size);
    c.scale(1, -1);
    c.drawImage(this.canvas, 0, 0, size, size);
    c.restore();
    return this.thumbCanvas.toDataURL('image/jpeg', 0.6);
  }

  rebuildTexture() {
    if (this.texture) this.texture.dispose();
    const depth = Math.max(1, this.layers.length);
    const data = new Uint8Array(LAYER * LAYER * 4 * depth);
    this.layers.forEach((layer, i) => data.set(layer, i * LAYER * LAYER * 4));

    const texture = new THREE.DataArrayTexture(data, LAYER, LAYER, depth);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    this.texture = texture;
    this.buildRects();
    this.buildCutoutFlags();
    return texture;
  }

  // Where each image sits inside its square layer, as a lookup the shader can
  // read by layer index. A billboard that swaps to another picture needs the
  // new picture's rect, not the one baked in at build time.
  buildRects() {
    if (this.rectTexture) this.rectTexture.dispose();
    const n = Math.max(1, this.items.length);
    const data = new Float32Array(n * 4);
    this.items.forEach((item, i) => data.set(item.rect, i * 4));
    const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    this.rectTexture = tex;
    return tex;
  }

  // Whether a layer is a cutout, indexed by layer. Read at whatever layer is
  // actually being sampled — including a swapped-to layer, not just the one
  // baked into the vertex at build time — so a lit billboard swapping between
  // a photo and a sticker still discards the sticker's transparent pixels
  // instead of drawing them as an opaque black rectangle.
  buildCutoutFlags() {
    if (this.cutoutTexture) this.cutoutTexture.dispose();
    const n = Math.max(1, this.items.length);
    const data = new Float32Array(n);
    this.items.forEach((item, i) => {
      data[i] = item.kind === 'cutout' ? 1 : 0;
    });
    const tex = new THREE.DataTexture(data, n, 1, THREE.RedFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    this.cutoutTexture = tex;
    return tex;
  }

  // Drag-and-drop additions, for the current session only. Copy the files into
  // collage/images/ and rerun the scan to keep them.
  async addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    for (const file of files) await this.addBlob(file, file.name, { kind: 'image', fit: 'contain' });
    if (files.length) {
      this.rebuildTexture();
      this.listeners.forEach((fn) => fn(this));
    }
    return files.length;
  }
}

// Average colour, plus the average of the brightest pixels. The hot colour is
// what a lit face glows with, so a neon sign glows neon and a night sky glows
// blue.
function sampleColours(pixels) {
  const step = 4 * 37; // stride through the layer, prime so it does not align
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const bright = [];
  for (let i = 0; i < pixels.length; i += step) {
    const pr = pixels[i];
    const pg = pixels[i + 1];
    const pb = pixels[i + 2];
    r += pr;
    g += pg;
    b += pb;
    n++;
    const lum = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
    bright.push([lum, pr, pg, pb]);
  }
  if (!n) return { avg: '#888888', hot: '#ffffff' };

  bright.sort((a, c) => c[0] - a[0]);
  const top = bright.slice(0, Math.max(1, Math.floor(bright.length * 0.12)));
  let hr = 0;
  let hg = 0;
  let hb = 0;
  for (const [, pr, pg, pb] of top) {
    hr += pr;
    hg += pg;
    hb += pb;
  }
  return {
    avg: hex(r / n, g / n, b / n),
    hot: saturate(hex(hr / top.length, hg / top.length, hb / top.length)),
  };
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (r, g, b) =>
  `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;

// The brightest pixels of a photo tend toward white. Push the hue back out so
// the glow carries some of the image's colour instead of washing to paper.
function saturate(color) {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 2.1 + 0.08), Math.min(0.82, Math.max(0.55, hsl.l)));
  return `#${c.getHexString()}`;
}
