// exporter.js — getting the set out of the browser.
//
// Two routes on purpose:
//
//   scene.json  the authoring truth. Round-trips losslessly and is what the
//               Blender importer reads, so projected materials, station
//               cameras and scatter fields all survive.
//   .glb        a baked handoff for anything that speaks glTF. Geometry and
//               cutout cards come through cleanly. Projected materials cannot
//               (glTF has no projector node), so they export as flat colour
//               and the Blender importer is the route that keeps them.

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { serialize } from './scene.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportSceneJSON(scene, filename = 'setpiece.json') {
  download(new Blob([serialize(scene)], { type: 'application/json' }), filename);
}

/**
 * Swap any ShaderMaterial (our projected path) for something glTF understands,
 * export, then put the originals back.
 */
export async function exportGLB(group, scene, filename = 'setpiece.glb') {
  const swapped = [];
  group.traverse((obj) => {
    if (obj.isMesh && obj.material.isShaderMaterial) {
      swapped.push([obj, obj.material]);
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xb0b0b8,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
    }
  });

  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(group, { binary: true, embedImages: true });
    download(new Blob([result], { type: 'model/gltf-binary' }), filename);
  } finally {
    for (const [obj, mat] of swapped) obj.material = mat;
  }
}
