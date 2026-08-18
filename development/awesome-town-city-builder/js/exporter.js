// Export for Blender.
//
// The geometry is baked here rather than described here, because the shapes
// already exist in geometry.js and a second implementation in Python would
// drift from this one the first time a shape changed. The importer on the
// other side stays dumb: it reads vertices and builds meshes, and never needs
// to know what a gable is.
//
// Two files come out. A .json carrying structure, materials, sun and the
// index of every building, and a .bin carrying the vertex data those records
// point into. Splitting them keeps the numbers out of text, which is the
// difference between a 3MB export and a 20MB one.
//
// Grouping is per building rather than per module or per chunk. A lighter
// thinks in buildings, so that is the unit that arrives selectable in the
// outliner.

import { buildShape, slotCount } from './geometry.js';

const VERSION = 1;

// Rounded before writing, since a millimetre of a metre is far past what any
// of this needs and the digits are pure file size.
const r = (n, places = 4) => Number(n.toFixed(places));

function hexToRgb(hex) {
  const n = parseInt(String(hex || '#cccccc').slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Walks one module's shape and writes its transformed vertices into the sink.
// Mirrors the same rotate, tilt and bend the renderer applies in build.js, so
// what lands in Blender is what was on screen.
function emitModule(sink, building, module, opts) {
  const faces = [];
  const n = slotCount(module.kind, module.blades);
  for (let i = 0; i < n; i++) {
    const f = module.faces[i] || module.faces[0];
    const item = f.image == null ? null : opts.pool.get(f.image);
    faces.push(item ? { aspect: item.aspect, zoom: f.zoom, panU: f.panU, panV: f.panV } : null);
  }

  // Proxy export replaces every shape with its bounding box, which is what a
  // blockout wants and cuts the vertex count by an order of magnitude.
  const kind = opts.proxy ? 'box' : module.kind;
  const shape = buildShape(kind, module.w, module.h, module.d, faces, {
    blades: module.blades,
    tile: !!module.matKind,
  });

  const angle = (module.rotY || 0) + (building.rotY || 0);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tx = module.tiltX || 0;
  const tz = module.tiltZ || 0;
  const tilted = tx !== 0 || tz !== 0;
  const cx = Math.cos(tx);
  const sx = Math.sin(tx);
  const cz2 = Math.cos(tz);
  const sz2 = Math.sin(tz);
  const ox = building.x + (module.bendX || 0);
  const oy = (building.y || 0) + module.y;
  const oz = building.z + (module.bendZ || 0);

  const matIndex =
    module.matKind === 'material'
      ? module.matIndex ?? 0
      : module.matKind === 'glass'
        ? -2
        : module.matKind === 'mirror'
          ? -3
          : -1;

  shape.slots.forEach((slot, si) => {
    const face = module.faces[si] || module.faces[0];
    const imageIndex = matIndex !== -1 || face.image == null ? -1 : face.image;
    const [cr, cg, cb] = hexToRgb(imageIndex >= 0 || matIndex !== -1 ? '#ffffff' : face.color);

    for (let i = slot.start; i < slot.start + slot.count; i++) {
      const px = shape.pos[i * 3];
      const py = shape.pos[i * 3 + 1];
      const pz = shape.pos[i * 3 + 2];
      const nx = shape.nor[i * 3];
      const ny = shape.nor[i * 3 + 1];
      const nz = shape.nor[i * 3 + 2];

      let vx = ca * px + sa * pz;
      let vy = py;
      let vz = -sa * px + ca * pz;
      let mx = ca * nx + sa * nz;
      let my = ny;
      let mz = -sa * nx + ca * nz;
      if (tilted) {
        let a = cz2 * vx - sz2 * vy;
        const byy = sz2 * vx + cz2 * vy;
        vx = a;
        vy = cx * byy - sx * vz;
        vz = sx * byy + cx * vz;
        a = cz2 * mx - sz2 * my;
        const nyy = sz2 * mx + cz2 * my;
        mx = a;
        my = cx * nyy - sx * mz;
        mz = sx * nyy + cx * mz;
      }

      sink.pos.push(vx + ox, vy + oy, vz + oz);
      sink.nor.push(mx, my, mz);
      sink.uv.push(shape.uv[i * 2], shape.uv[i * 2 + 1]);
      sink.col.push(cr, cg, cb);
      if ((sink.pos.length / 3) % 3 === 1) {
        sink.triImage.push(imageIndex);
        sink.triMat.push(matIndex);
        sink.triGlow.push(module.glow ? 1 : 0);
      }
    }
  });
}

export function buildExport({ city, params, pool, matPool, stage, name, proxy = false }) {
  const sink = { pos: [], nor: [], uv: [], col: [], triImage: [], triMat: [], triGlow: [] };
  const buildings = [];

  for (const b of city.buildings) {
    const vertexStart = sink.pos.length / 3;
    for (const m of b.modules) emitModule(sink, b, m, { pool, proxy });
    const vertexCount = sink.pos.length / 3 - vertexStart;
    if (!vertexCount) continue;
    buildings.push({
      id: b.id,
      pos: [r(b.x), r(b.y || 0), r(b.z)],
      rot: r(b.rotY || 0),
      height: r(b.height),
      family: b.family,
      material: b.material || null,
      modules: b.modules.length,
      vertexStart,
      vertexCount,
    });
  }

  const vertices = sink.pos.length / 3;
  const triangles = vertices / 3;

  // One flat buffer, sections laid end to end. The json records where each
  // one starts so the importer can take typed views without parsing numbers.
  const f32 = (arr) => Float32Array.from(arr);
  const sections = [
    ['position', f32(sink.pos)],
    ['normal', f32(sink.nor)],
    ['uv', f32(sink.uv)],
    ['color', f32(sink.col)],
    ['triImage', Int32Array.from(sink.triImage)],
    ['triMaterial', Int32Array.from(sink.triMat)],
    ['triGlow', Int32Array.from(sink.triGlow)],
  ];

  let offset = 0;
  const layout = {};
  for (const [key, arr] of sections) {
    layout[key] = { offset, count: arr.length, type: arr instanceof Float32Array ? 'f32' : 'i32' };
    offset += arr.byteLength;
  }
  const bin = new Uint8Array(offset);
  for (const [key, arr] of sections) {
    bin.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), layout[key].offset);
  }

  const sun = stage?.sun;
  const sunDir = sun ? sun.position.clone().normalize() : null;

  const json = {
    format: 'awesome-town-scene',
    version: VERSION,
    generator: 'Awesome Town City Builder',
    name: name || 'awesome-town',
    mode: proxy ? 'proxy' : 'full',
    // three.js is Y up, Blender is Z up. The importer does the swap, but
    // recording it means the file is not silently handed-orientation.
    up: 'Y',
    counts: { buildings: buildings.length, vertices, triangles },
    buffer: { file: `${name || 'awesome-town'}.bin`, bytes: offset, layout },
    sun: sun
      ? {
          hour: params.hour,
          azimuth: params.sunAzimuth,
          direction: [r(sunDir.x), r(sunDir.y), r(sunDir.z)],
          color: `#${sun.color.getHexString()}`,
          intensity: r(sun.intensity, 3),
        }
      : null,
    world: {
      palette: params.palette,
      skyColor: params.skyCustom ? params.skyColor : null,
      fog: params.fog,
      exposure: params.exposure,
    },
    // Paths are relative to the tool's own folder, so the importer can find
    // the actual picture files rather than receiving bare indices.
    images: pool.items.map((it, i) => ({
      index: i,
      name: it.name,
      kind: it.kind,
      path: `collage/${it.kind === 'cutout' ? 'cutouts' : 'images'}/${it.name}`,
      rect: it.rect.map((v) => r(v)),
      avg: it.avg,
    })),
    materials: matPool.items.map((it, i) => ({
      index: i,
      name: it.name,
      path: `collage/materials/${it.name}`,
    })),
    roads: (city.layout?.roads || []).map((road) => ({
      main: !!road.main,
      width: r(road.width),
      pts: road.pts.map((p) => [r(p[0]), r(p[1])]),
    })),
    buildings,
  };

  return { json, bin };
}

export function downloadExport({ json, bin }, name) {
  const base = (name || 'awesome-town').replace(/\s+/g, '-').toLowerCase();
  const save = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  json.buffer.file = `${base}.bin`;
  save(new Blob([JSON.stringify(json)], { type: 'application/json' }), `${base}.json`);
  // Staggered, because some browsers drop the second of two downloads fired
  // in the same tick.
  setTimeout(() => save(new Blob([bin], { type: 'application/octet-stream' }), `${base}.bin`), 350);
}
