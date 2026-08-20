// Picking and highlight.
//
// Modules are no longer objects in the scene, so a hit resolves through the
// chunk's per-triangle lookup and the highlight box is placed from the module
// data rather than from object bounds.

import * as THREE from 'three';
import { waveAt, waveSlope, waveState } from './wave.js';

export class Picker {
  constructor(stage, builder) {
    this.stage = stage;
    this.builder = builder;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.box = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: '#ff2e6a', depthTest: false, transparent: true })
    );
    this.box.visible = false;
    this.box.renderOrder = 999;
    this.box.frustumCulled = false;
    stage.scene.add(this.box);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 24),
      new THREE.MeshBasicMaterial({
        color: '#ff2e6a',
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      })
    );
    this.marker.visible = false;
    this.marker.renderOrder = 1000;
    stage.scene.add(this.marker);

    // Whether clicks may land on buildings at all. Off while the buildings
    // layer is anything but fully shown — see `setPickable`.
    this.pickable = true;
  }

  // **A layer you cannot see properly is a layer you cannot select.**
  //
  // Raycasting does not enforce this on its own: three.js tests `layers` and
  // geometry and ignores `object.visible` entirely, so a hidden building is
  // hit exactly as readily as a shown one. Hiding the buildings therefore
  // stopped them drawing and left every click still landing on them, which is
  // the worst of both — an invisible thing eating the gesture meant for the
  // road behind it.
  //
  // Ghosted counts as "not properly visible" too, and that is the case worth
  // fixing rather than a bonus. Ghost exists to keep the town legible while
  // you work on something else (see layers.js), which means it is context
  // rather than the working set; a faded building that still swallows clicks
  // aimed at a street is precisely the thing ghosting was supposed to get out
  // of the way.
  setPickable(on) {
    this.pickable = Boolean(on);
  }

  cast() {
    if (!this.pickable) return null;
    const hits = this.raycaster.intersectObject(this.builder.root, true);
    for (const hit of hits) {
      const found = this.builder.resolve(hit);
      if (found) {
        return {
          ...found,
          point: hit.point.clone(),
          normal: hit.face
            ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
            : new THREE.Vector3(0, 1, 0),
        };
      }
    }
    return null;
  }

  // The buffers hold resting positions and the wave lifts them on the GPU, so
  // a plain raycast would miss by however high the swell is. Cast once to find
  // out which building is under the pointer, drop the ray by that building's
  // lift, and cast again against the geometry where it actually appears.
  pick(event) {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);

    const first = this.cast();
    if (!first || waveState.amp <= 0) return first;

    const building = this.builder.find(first.buildingId);
    if (!building) return first;
    const lift = waveAt(building.x, building.z);
    this.raycaster.ray.origin.y -= lift;
    const second = this.cast() || first;
    second.point.y += lift;
    return second;
  }

  // The outline rides the swell too, or it would sit where the module is not.
  place(building, y) {
    const lift = waveAt(building.x, building.z);
    const [sx, sz] = waveSlope(building.x, building.z);
    const rel = y - (building.y || 0);
    this.box.position.set(building.x - rel * sx, y + lift, building.z - rel * sz);
    return [sx, sz];
  }

  showModule(building, module, hitPoint, normal) {
    if (!building || !module) return this.clear();
    const y = (building.y || 0) + module.y;
    const [sx, sz] = this.place(building, y);
    this.box.rotation.set(sz, (module.rotY || 0) + (building.rotY || 0), -sx);
    this.box.scale.set(module.w * 1.02, module.h * 1.02, module.d * 1.02);
    this.box.visible = true;
    if (hitPoint && normal) {
      this.marker.position.copy(hitPoint).addScaledVector(normal, 0.03);
      this.marker.lookAt(hitPoint.clone().add(normal));
      this.marker.visible = true;
    } else {
      this.marker.visible = false;
    }
  }

  showBuilding(building) {
    if (!building) return this.clear();
    let w = 0;
    let d = 0;
    for (const m of building.modules) {
      w = Math.max(w, m.w);
      d = Math.max(d, m.d);
    }
    const [sx, sz] = this.place(building, (building.y || 0) + building.height / 2);
    this.box.rotation.set(sz, building.rotY || 0, -sx);
    this.box.scale.set(w * 1.05, building.height * 1.02, d * 1.05);
    this.box.visible = true;
    this.marker.visible = false;
  }

  clear() {
    this.box.visible = false;
    this.marker.visible = false;
  }
}
