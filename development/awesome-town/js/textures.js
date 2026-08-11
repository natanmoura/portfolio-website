// The image pool, packed into one DataArrayTexture.
//
// Every image gets its own layer, so there is no atlas bleed at distance, and
// the whole pool binds as a single sampler. That is what lets every module in
// the city share one material and merge into a handful of draw calls.
//
// Each image is letterboxed into its square layer over a stretched copy of
// itself, so mip levels blur into something related rather than into black.
// The used sub-rect is recorded and folded into the UVs at build time.

import * as THREE from 'three';

const LAYER = 512;

export class ImagePool {
  constructor() {
    this.items = []; // { name, aspect, rect, hot, avg, url }
    this.texture = null;
    this.listeners = new Set();
    this.canvas = document.createElement('canvas');
    this.canvas.width = LAYER;
    this.canvas.height = LAYER;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.layers = [];
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

  async loadManifest(dir = 'collage', onProgress = () => {}) {
    const res = await fetch(`${dir}/manifest.json`);
    if (!res.ok) throw new Error(`No ${dir}/manifest.json — run: node tools/scan.mjs`);
    const { images } = await res.json();
    let done = 0;
    const batch = 6;
    for (let i = 0; i < images.length; i += batch) {
      const slice = images.slice(i, i + batch);
      const blobs = await Promise.all(
        slice.map((name) =>
          fetch(`${dir}/${name}`)
            .then((r) => (r.ok ? r.blob() : null))
            .catch(() => null)
        )
      );
      for (let k = 0; k < slice.length; k++) {
        if (blobs[k]) await this.addBlob(blobs[k], slice[k]);
      }
      done += slice.length;
      onProgress(done, images.length);
    }
    this.rebuildTexture();
    this.listeners.forEach((fn) => fn(this));
    return this.items.length;
  }

  async addBlob(blob, name) {
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

    // Stretched underlay first, so mip levels bleed into related colour.
    ctx.clearRect(0, 0, LAYER, LAYER);
    ctx.drawImage(bitmap, 0, 0, LAYER, LAYER);

    const w = aspect >= 1 ? LAYER : Math.round(LAYER * aspect);
    const h = aspect >= 1 ? Math.round(LAYER / aspect) : LAYER;
    const x = Math.round((LAYER - w) / 2);
    const y = Math.round((LAYER - h) / 2);
    ctx.drawImage(bitmap, x, y, w, h);
    bitmap.close();

    const pixels = ctx.getImageData(0, 0, LAYER, LAYER).data;
    this.layers.push(new Uint8Array(pixels));
    this.items.push({
      name,
      aspect,
      rect: [x / LAYER, y / LAYER, w / LAYER, h / LAYER],
      ...sampleColours(pixels),
      url: this.thumbnail(),
    });
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

  // Drag-and-drop additions, for the current session only. Copy the files into
  // collage/ and rerun the scan to keep them.
  async addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    for (const file of files) await this.addBlob(file, file.name);
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
