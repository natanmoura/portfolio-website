// viewer.js — turns a scene description into three.js objects.
//
// Two material paths matter here. `texture` is an ordinary cutout on a card,
// which is the collage half. `projected` throws a station's source image onto
// geometry from the exact camera that image was solved for, which is the
// matte-painting half: the drawing sits perfectly on the blockout from the
// original angle and then tears as you move away from it. How it tears is the
// interesting part, so the shader exposes it rather than hiding it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const textureCache = new Map();

export function loadTexture(src) {
  if (textureCache.has(src)) return textureCache.get(src);
  const tex = new THREE.TextureLoader().load(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(src, tex);
  return tex;
}

/**
 * Projection matrix for a solved station, matching how calib.js defines the
 * camera. Used both to drive the preview camera and to build the projector
 * matrix for projected materials.
 */
export function stationCamera(station) {
  if (station.projection === 'orthographic') {
    // The station's camera position was chosen so a centred frustum matches its
    // projection exactly, so there are no offsets to reapply here.
    const halfW = station.width / (2 * station.scale);
    const halfH = station.height / (2 * station.scale);
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 20000);
    cam.position.fromArray(station.position);
    cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(station.rotation));
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return cam;
  }

  const px = station.principal ? station.principal[0] : station.width / 2;
  const py = station.principal ? station.principal[1] : station.height / 2;

  // A principal point away from the image centre means the frame is a crop of a
  // larger one, which is exactly what setViewOffset expresses. Build the virtual
  // full frame that would have this point at its centre, then take our image as
  // a window into it. Without this, projected textures slide off the geometry
  // for any cropped drawing.
  const fullW = 2 * Math.max(px, station.width - px);
  const fullH = 2 * Math.max(py, station.height - py);
  const offX = fullW / 2 - px;
  const offY = fullH / 2 - py;

  // The field of view belongs to the virtual full frame, not the crop.
  const fovY = 2 * Math.atan(fullH / (2 * station.focal)) * (180 / Math.PI);
  const cam = new THREE.PerspectiveCamera(fovY, fullW / fullH, 0.05, 5000);
  cam.setViewOffset(fullW, fullH, offX, offY, station.width, station.height);

  cam.position.fromArray(station.position);
  cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(station.rotation));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

const projectedVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const projectedFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform mat4 uProjView;
  uniform vec3 uProjPos;
  uniform vec3 uOutside;   // colour used where the projector has no coverage
  uniform float uOpacity;
  uniform float uFalloff;  // softens the edge of the projected frustum
  uniform float uGrazing;  // fades surfaces turned away from the projector
  varying vec3 vWorld;
  varying vec3 vNormalW;

  void main() {
    vec4 clip = uProjView * vec4(vWorld, 1.0);
    vec3 col = uOutside;
    float cover = 0.0;

    if (clip.w > 0.0) {
      vec2 uv = (clip.xy / clip.w) * 0.5 + 0.5;
      if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
        col = texture2D(uMap, uv).rgb;
        // distance from the nearest frustum edge, in uv space
        vec2 d = min(uv, 1.0 - uv);
        cover = smoothstep(0.0, max(uFalloff, 1e-4), min(d.x, d.y));
      }
    }

    // Surfaces edge-on to the projector receive smeared texels. Fading them
    // is what keeps a moving camera from reading the stretch as a bug.
    vec3 toProj = normalize(uProjPos - vWorld);
    float facing = abs(dot(normalize(vNormalW), toProj));
    cover *= mix(1.0, smoothstep(0.0, 0.6, facing), uGrazing);

    gl_FragColor = vec4(mix(uOutside, col, cover), uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeProjectedMaterial(station, opts = {}) {
  const cam = stationCamera(station);
  const projView = new THREE.Matrix4().multiplyMatrices(
    cam.projectionMatrix,
    cam.matrixWorldInverse,
  );
  return new THREE.ShaderMaterial({
    vertexShader: projectedVert,
    fragmentShader: projectedFrag,
    uniforms: {
      uMap: { value: loadTexture(station.src) },
      uProjView: { value: projView },
      uProjPos: { value: cam.position.clone() },
      uOutside: { value: new THREE.Color(opts.outside || '#1a1a1e') },
      uOpacity: { value: opts.opacity ?? 1 },
      uFalloff: { value: opts.falloff ?? 0.02 },
      uGrazing: { value: opts.grazing ?? 1 },
    },
    side: THREE.DoubleSide,
    transparent: (opts.opacity ?? 1) < 1,
  });
}

function makeMaterial(node, scene) {
  const m = node.material || { mode: 'flat', color: '#8a8a92' };

  if (m.mode === 'projected') {
    const station = scene.stations.find((s) => s.id === m.station) || scene.stations[0];
    if (station) return makeProjectedMaterial(station, m);
  }

  if (m.mode === 'texture' && m.src) {
    return new THREE.MeshBasicMaterial({
      map: loadTexture(m.src),
      transparent: true,
      // Cutouts need a real alpha test or they sort against each other badly
      // at grazing angles, which is exactly where collage cards live.
      alphaTest: m.alphaTest ?? 0.5,
      opacity: m.opacity ?? 1,
      color: m.color ? new THREE.Color(m.color) : 0xffffff,
      side: m.doubleSided === false ? THREE.FrontSide : THREE.DoubleSide,
      depthWrite: true,
    });
  }

  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(m.color || '#8a8a92'),
    transparent: (m.opacity ?? 1) < 1,
    opacity: m.opacity ?? 1,
    side: THREE.DoubleSide,
  });
}

/**
 * Extrude a 2D profile along Z and centre it, so extruded types obey the same
 * base-centred convention as the primitives.
 */
function extrude(shape, depth, height) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, -height / 2, -depth / 2);
  return geo;
}

function archGeometry(w, h, d, params = {}) {
  // Opening width and the height at which the arch starts to curve.
  const openW = Math.min(w * (params.openWidth ?? 0.7), w - 0.02);
  const radius = openW / 2;
  const spring = Math.max(0.01, Math.min(params.springHeight ?? h * 0.55, h - radius - 0.01));

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-radius, 0);
  hole.lineTo(-radius, spring);
  // From the left springing point over the crown to the right one.
  hole.absarc(0, spring, radius, Math.PI, 0, true);
  hole.lineTo(radius, 0);
  hole.closePath();
  shape.holes.push(hole);

  return extrude(shape, d, h);
}

function roofGeometry(w, h, d, params = {}) {
  const shape = new THREE.Shape();
  if (params.style === 'shed') {
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h);
    shape.closePath();
  } else {
    // Gable: ridge runs along the depth axis.
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
  }
  return extrude(shape, d, h);
}

function stairsGeometry(w, h, d, params = {}) {
  const steps = Math.max(1, Math.min(Math.round(params.steps ?? 8), 64));
  const rise = h / steps;
  const run = d / steps;

  // Solid rather than floating treads: a staircase blockout wants the mass
  // under it, which is what a camera actually sees and what occludes properly.
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const stepHeight = rise * (i + 1);
    const geo = new THREE.BoxGeometry(w, stepHeight, run);
    geo.translate(0, stepHeight / 2 - h / 2, -d / 2 + run * (i + 0.5));
    parts.push(geo);
  }
  return mergeGeometries(parts, false);
}

function makeGeometry(node) {
  const [w, h, d] = node.size || [1, 1, 1];
  const params = node.params || {};

  switch (node.type) {
    case 'box':
      return new THREE.BoxGeometry(w, h, d);
    case 'cylinder':
    case 'column':
      return new THREE.CylinderGeometry(w / 2, w / 2, h, 24);
    case 'pipe':
      // A pipe is a cylinder that is usually not upright. Its direction comes
      // from the node's rotationX and rotationZ, so the geometry stays simple.
      return new THREE.CylinderGeometry(
        w / 2,
        w / 2,
        h,
        20,
        1,
        params.open ?? false,
      );
    case 'sphere':
      return new THREE.SphereGeometry(w / 2, 28, 20);
    case 'dome': {
      // Half a sphere, for anything that reads as a bulge on a surface rather
      // than a ball sitting on it.
      const geo = new THREE.SphereGeometry(w / 2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1, (h * 2) / w || 1, 1);
      return geo;
    }
    case 'pyramid': {
      // A cone with four sides is a pyramid, but its base is inscribed in the
      // radius, so widen it and turn it a quarter step to get a square base of
      // the requested width.
      const geo = new THREE.ConeGeometry((w / 2) * Math.SQRT2, h, 4);
      geo.rotateY(Math.PI / 4);
      if (d && d !== w) geo.scale(1, 1, d / w);
      return geo;
    }
    case 'cone':
      return new THREE.ConeGeometry(w / 2, h, 24);
    case 'disc':
      // A flat circle. The distinction from a sphere is often not visible in a
      // drawing, so it is a judgement call worth having as its own type.
      return new THREE.CircleGeometry(w / 2, 32);
    case 'ramp': {
      // A wedge rising along +Z, for slopes and embankments.
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2, 0);
      shape.lineTo(d / 2, 0);
      shape.lineTo(d / 2, h);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      geo.translate(0, -h / 2, 0);
      return geo;
    }
    case 'arch':
      return archGeometry(w, h, d, params);
    case 'roof':
      return roofGeometry(w, h, d, params);
    case 'stairs':
      return stairsGeometry(w, h, d, params);
    case 'ground':
      return new THREE.PlaneGeometry(w, d || w);
    case 'card':
    default:
      return new THREE.PlaneGeometry(w, h);
  }
}

/**
 * Distance from a node's authored y to its geometry centre.
 *
 * Everything is authored base-centred, so this is normally half the height. The
 * exceptions earn themselves: a sphere's bounding height is its diameter, and a
 * pipe tilted off vertical has no meaningful "base" at all, so pipes are
 * authored by their centre instead.
 */
function centreOffset(node) {
  const [w, h] = node.size || [1, 1, 1];
  if (node.type === 'ground') return 0;
  if (node.type === 'sphere') return w / 2;
  // A hemisphere is built sitting on the origin already, so it needs no lift.
  if (node.type === 'dome') return 0;
  if (node.type === 'pipe' && (node.rotationX || node.rotationZ)) return 0;
  return h / 2;
}

/** Build (or rebuild) a three.js Group for the whole scene. */
export function buildScene(scene) {
  const group = new THREE.Group();
  group.name = 'setpiece';

  for (const node of scene.nodes) {
    const geo = makeGeometry(node);
    const mesh = new THREE.Mesh(geo, makeMaterial(node, scene));
    mesh.name = node.name || node.id;
    mesh.userData.nodeId = node.id;
    mesh.userData.billboard = node.billboard ?? 0;

    const [x, y, z] = node.position || [0, 0, 0];

    // Nodes are authored base-centred: y is where the shape meets the floor.
    // That is how you think when placing blockout from a ground contact point,
    // so the format matches the workflow rather than the renderer.
    mesh.position.set(x, y + centreOffset(node), z);

    if (node.type === 'ground') {
      mesh.rotation.set(-Math.PI / 2, 0, node.rotationY || 0);
    } else {
      mesh.rotation.set(node.rotationX || 0, node.rotationY || 0, node.rotationZ || 0);
    }

    group.add(mesh);
  }

  return group;
}

/**
 * Per-frame billboarding. A card at billboard = 1 always faces the camera; at
 * 0 it stays where it was placed. The useful range is in between, where a card
 * turns partway toward the lens and reads as breathing rather than as either
 * a sprite or a flat.
 */
export function updateBillboards(group, camera) {
  const target = new THREE.Vector3();
  for (const child of group.children) {
    const amount = child.userData.billboard || 0;
    if (amount <= 0) continue;
    if (child.userData.restY === undefined) child.userData.restY = child.rotation.y;

    target.set(camera.position.x - child.position.x, 0, camera.position.z - child.position.z);
    const facing = Math.atan2(target.x, target.z);

    // Interpolate along the shortest arc so a card never spins the long way
    // round as the camera passes behind it.
    let delta = facing - child.userData.restY;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    child.rotation.y = child.userData.restY + delta * amount;
  }
}
