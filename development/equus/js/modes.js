// Lab mode and field mode.
//
// The one rule that matters here: these differ only in camera rig and backdrop,
// and no mode flag ever reaches the locomotion code. If the two modes could
// diverge in the simulation then they would, and tuning in the lab would stop
// predicting behaviour in the field.
//
// Lab mode is therefore NOT a treadmill. The horse genuinely travels, the
// camera is welded to its side, and the ground is an endless reference grid
// that the horse moves across. Sliding the feet backwards under a stationary
// horse would break the world locked hoof invariant, which is the exact bug
// the whole design exists to avoid.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Lab camera placements, in horse local space. Offsets are scaled by body size
// at use, so a pony and a warmblood frame the same way.
//
// `fit` is the world span in metres that must stay visible, width by height.
// The orthographic height is then solved against the live aspect ratio rather
// than being a fixed number, because a fixed height crops the horse the moment
// the panel layout changes the viewport shape.
const LAB_VIEWS = {
  side: {
    offset: [0, 0.62, 9],
    fit: [3.3, 2.5],
    help: 'True side view. Orthographic, so hoof arcs read as their real shape rather than being bent by perspective.',
  },
  front: {
    offset: [9, 0.62, 0],
    fit: [1.7, 2.5],
    help: 'Head on. This is the view that shows lateral swing, track width and whether the limbs are moving in one plane.',
  },
  three: {
    offset: [6.4, 1.5, 6.4],
    fit: [3.4, 2.7],
    help: 'Three quarter. Reads depth and turning while still showing the limbs clearly.',
  },
  top: {
    offset: [0.01, 9, 0],
    fit: [3.4, 3.0],
    help: 'From above. Shows footfall placement and lateral tracking, which is where a turn either looks right or does not.',
  },
};

export function createModes(stage, { terrain, labGround }) {
  // Held in a slot rather than captured, because regenerating the heightfield
  // replaces the whole object and `ground()` must hand out the current one.
  let field = terrain;

  const state = {
    mode: 'lab',
    labView: 'side',
    // Field camera follow state, kept as a smoothed position so the camera has
    // its own inertia rather than being welded to the horse.
    followPos: new THREE.Vector3(0, 2.2, 6),
    followLook: new THREE.Vector3(),
    orbit: { yaw: 0.6, pitch: 0.28, dist: 6.5 },
  };

  function applyBackdrop() {
    const lab = state.mode === 'lab';
    labGround.group.visible = lab;
    field.mesh.visible = !lab;
  }

  function rebindTerrain(next) {
    field = next;
    applyBackdrop();
  }

  function setMode(mode) {
    state.mode = mode;
    stage.camera = mode === 'lab' ? stage.ortho : stage.persp;
    applyBackdrop();
    stage.resize();
  }

  // Solve the orthographic height so the view's required span fits in both axes
  // at the current aspect. Called on view change and on every resize.
  function fitLab(scale = 1) {
    const view = LAB_VIEWS[state.labView];
    const aspect = stage.aspect();
    const [w, h] = view.fit;
    stage.orthoHeight = Math.max(h, w / Math.max(0.2, aspect)) * scale;
    stage.resize();
  }

  function setLabView(name, scale = 1) {
    if (!LAB_VIEWS[name]) return;
    state.labView = name;
    fitLab(scale);
  }

  // The ground the simulation should query. Lab is flat, field is the
  // heightfield. This is the only thing that differs, and it is data handed to
  // the solver rather than a branch inside it.
  function ground() {
    return state.mode === 'lab' ? labGround : field;
  }

  const _o = new THREE.Vector3();
  const _t = new THREE.Vector3();

  function update(dt, horse) {
    const scale = horse.scale ?? 1;
    // Aim at the middle of the silhouette, not the root. The root sits between
    // the hooves, so aiming there pushes the head out of frame. centerX is in
    // horse space, so it has to be rotated by the heading.
    const cx = (horse.centerX ?? 0) * scale;
    const cy = (horse.centerY ?? 1.0) * scale;
    const hd = horse.heading ?? 0;
    _t.copy(horse.position);
    _t.x += Math.cos(hd) * cx;
    _t.z += -Math.sin(hd) * cx;
    _t.y += cy;

    if (state.mode === 'lab') {
      const view = LAB_VIEWS[state.labView];
      _o.fromArray(view.offset).multiplyScalar(scale);
      // Into the horse's own frame. The lab views are named for the horse, not for
      // the world, so "side" has to stay the horse's side once it has turned.
      _o.applyAxisAngle(UP, hd);
      // Welded, with no smoothing. In the lab you want a rock steady frame so
      // that any movement you see belongs to the horse.
      stage.ortho.position.copy(_t).add(_o);
      stage.ortho.lookAt(_t);
      // Reframe if the aspect or the body size changed under us.
      const want = Math.max(view.fit[1], view.fit[0] / Math.max(0.2, stage.aspect())) * scale;
      if (Math.abs(want - stage.orthoHeight) > 1e-3) {
        stage.orthoHeight = want;
        stage.resize();
      }
      stage.ortho.updateProjectionMatrix();
    } else {
      const { yaw, pitch, dist } = state.orbit;
      _o.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 0.6,
        Math.cos(yaw) * Math.cos(pitch) * dist
      ).multiplyScalar(scale);
      const want = _t.clone().add(_o);
      // Critically damped follow, so the camera lags a hard acceleration and
      // the speed reads on screen.
      const k = 1 - Math.exp(-6 * dt);
      state.followPos.lerp(want, k);
      state.followLook.lerp(_t, 1 - Math.exp(-9 * dt));
      stage.persp.position.copy(state.followPos);
      stage.persp.lookAt(state.followLook);
    }

    // The lab ground follows the horse, because the horse genuinely travels and
    // would otherwise walk off the edge of the plane. Snapped to the major grid
    // spacing so the lines stay world aligned and still slide past at the real
    // speed, which is the whole point of not using a treadmill.
    const snap = 5;
    labGround.group.position.set(
      Math.round(horse.position.x / snap) * snap,
      0,
      Math.round(horse.position.z / snap) * snap
    );

    stage.trackShadow(_t);
  }

  applyBackdrop();
  setMode('lab');

  return { state, setMode, setLabView, fitLab, update, ground, rebindTerrain, LAB_VIEWS };
}
