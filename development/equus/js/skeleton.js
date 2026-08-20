// The horse skeleton, as anatomy rather than as a convenient rig.
//
// Coordinate convention for the whole project:
//   +X forward, the way the nose points
//   +Y up
//   +Z to the horse's left, so -Z is its right
//
// Rest positions below are authored directly in this space for a 16 hand
// horse, 1.63 m at the withers, standing square. Authoring world positions and
// deriving parent offsets is far easier to check against a photograph than
// authoring offsets directly, so that is what we do. Every rest rotation is
// identity, which makes a local offset just the difference of two rest
// positions.
//
// Joint count is chosen by what the solvers need, not by anatomical
// completeness. The cervical chain is full because the yes joint and no joint
// have to be separable. The thoracic region is four segments because it is
// stiff and barely bends. The lumbar region is three because bascule rounds
// there more than in the thorax.

import * as THREE from 'three';

// group is used by the blockout to pick a colour and by later solvers to find
// their chains. dof is a hint for the solvers, not enforced here.
const L = [
  // Root and pelvis.
  ['root', null, 0, 0, 0, 'root'],
  ['pelvis', 'root', -0.62, 1.36, 0, 'spine'],

  // Thoracolumbar spine, running forward from the pelvis. Lumbar first.
  ['lumbar3', 'pelvis', -0.45, 1.38, 0, 'spine'],
  ['lumbar2', 'lumbar3', -0.32, 1.39, 0, 'spine'],
  ['lumbar1', 'lumbar2', -0.19, 1.4, 0, 'spine'],
  ['thorax4', 'lumbar1', -0.05, 1.4, 0, 'spine'],
  ['thorax3', 'thorax4', 0.1, 1.41, 0, 'spine'],
  ['thorax2', 'thorax3', 0.25, 1.42, 0, 'spine'],
  ['thorax1', 'thorax2', 0.42, 1.43, 0, 'spine'],

  // Cervical chain. C7 at the base, C1 at the poll.
  ['cerv7', 'thorax1', 0.52, 1.5, 0, 'neck'],
  ['cerv6', 'cerv7', 0.62, 1.58, 0, 'neck'],
  ['cerv5', 'cerv6', 0.72, 1.66, 0, 'neck'],
  ['cerv4', 'cerv5', 0.82, 1.73, 0, 'neck'],
  ['cerv3', 'cerv4', 0.92, 1.79, 0, 'neck'],
  ['axis', 'cerv3', 1.0, 1.83, 0, 'neck'], // C2, the no joint lives above this
  ['atlas', 'axis', 1.06, 1.85, 0, 'neck'], // C1, the yes joint lives above this
  ['skull', 'atlas', 1.12, 1.84, 0, 'head'],
  ['muzzle', 'skull', 1.52, 1.5, 0, 'head'],

  // Tail, off the pelvis.
  ['tail1', 'pelvis', -0.7, 1.38, 0, 'tail'],
  ['tail2', 'tail1', -0.82, 1.3, 0, 'tail'],
  ['tail3', 'tail2', -0.92, 1.18, 0, 'tail'],
  ['tail4', 'tail3', -1.0, 1.04, 0, 'tail'],
  ['tail5', 'tail4', -1.05, 0.9, 0, 'tail'],
];

// Limbs are authored once for the left side and mirrored in Z. The scapula
// hangs off thorax2 rather than off thorax1, because that is roughly where it
// rides on the ribcage, and it is a translating joint because the horse has no
// clavicle.
// Each limb is authored at a single Z, so the chain is exactly parasagittal.
//
// A real limb does taper very slightly toward the midline at the top, about a
// centimetre from scapula to hoof, but the solver treats a limb as planar and a
// step it cannot represent shows up as a permanent offset between where the hoof
// is asked to go and where it lands. A centimetre of anatomical taper is not
// worth a centimetre of hoof slide, and it is below the level of detail the
// blockout is modelling anyway.
const LIMB_L = [
  ['scapula.F', 'thorax2', 0.42, 1.52, 0.17, 'foreleg'],
  ['shoulder.F', 'scapula.F', 0.5, 1.1, 0.17, 'foreleg'],
  ['elbow.F', 'shoulder.F', 0.38, 0.85, 0.17, 'foreleg'],
  ['carpus.F', 'elbow.F', 0.44, 0.5, 0.17, 'foreleg'],
  ['fetlock.F', 'carpus.F', 0.46, 0.22, 0.17, 'foreleg'],
  ['pastern.F', 'fetlock.F', 0.52, 0.09, 0.17, 'foreleg'],
  ['hoof.F', 'pastern.F', 0.55, 0.0, 0.17, 'foreleg'],

  ['hip.H', 'pelvis', -0.58, 1.24, 0.16, 'hindleg'],
  ['stifle.H', 'hip.H', -0.4, 0.82, 0.16, 'hindleg'],
  ['hock.H', 'stifle.H', -0.62, 0.44, 0.16, 'hindleg'],
  ['fetlock.H', 'hock.H', -0.6, 0.16, 0.16, 'hindleg'],
  ['pastern.H', 'fetlock.H', -0.64, 0.07, 0.16, 'hindleg'],
  ['hoof.H', 'pastern.H', -0.66, 0.0, 0.16, 'hindleg'],
];

// Build the full flat spec, mirroring the limbs. Suffix L and R.
function buildSpec() {
  const spec = L.map(([name, parent, x, y, z, group]) => ({
    name,
    parent,
    rest: [x, y, z],
    group,
    side: null,
  }));

  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    for (const [name, parent, x, y, z, group] of LIMB_L) {
      // A limb's parent is either a spine joint, which has no side, or another
      // joint on the same limb, which does.
      const parentIsSpine = L.some((e) => e[0] === parent);
      spec.push({
        name: `${name}.${side}`,
        parent: parentIsSpine ? parent : `${parent}.${side}`,
        rest: [x, y, z * s],
        group,
        side,
      });
    }
  }
  return spec;
}

export const SPEC = buildSpec();

// Anatomical facts the solvers need, kept next to the skeleton so there is one
// place to look. Each is cited in DESIGN.md.
export const ANATOMY = {
  // The stifle and the hock can only flex or extend together, because of the
  // peroneus tertius and the superficial digital flexor tendon. The hind
  // solver treats them as one degree of freedom.
  reciprocal: [['stifle.H', 'hock.H']],

  // The yes joint does pitch and essentially no lateral flexion. The no joint
  // does yaw. Lateral bend distributes down C3 to C7 instead.
  yesJoint: 'skull', // rotates against atlas, pitch only
  noJoint: 'atlas', // rotates against axis, yaw only
  lateralBendChain: ['cerv7', 'cerv6', 'cerv5', 'cerv4', 'cerv3'],

  // Measured on a circle at trot: neck bends about 5.2 degrees, thoracolumbar
  // back about 3.75. The neck bends roughly 1.4 times the back.
  bendDeg: { neck: 5.2, back: 3.75 },
  backBendChain: ['lumbar3', 'lumbar2', 'lumbar1', 'thorax4', 'thorax3', 'thorax2'],

  // Bascule rounds the lumbar spine more than the thorax, so the weights are
  // not uniform along the chain.
  bascule: { lumbar: 1.0, thorax: 0.45 },

  // The forelimb has no bony attachment to the trunk. The scapula translates.
  slingJoints: ['scapula.F.L', 'scapula.F.R'],

  // Distal limb is tendon only, so the fetlock is a passive spring rather than
  // an animated joint. Measured stiffness between elbow and coffin joint is
  // 101 to 156 N/kg/m, mean 130.
  limbSpring: { stiffness: 130, min: 101, max: 156 },

  // Peak vertical ground reaction force at gallop, N/kg, per limb. Note the
  // asymmetry: forelimbs carry more than hinds, and the non lead limb of each
  // pair carries more than the lead limb. The hind spread is 10.6 percent
  // against 2.9 for the fore, so which lead a horse is on shows in the hinds.
  peakGRF: { foreNonLead: 14.0, foreLead: 13.6, hindNonLead: 13.6, hindLead: 12.3 },

  // IK chains, hip or shoulder through to hoof.
  chains: {
    'F.L': ['scapula.F.L', 'shoulder.F.L', 'elbow.F.L', 'carpus.F.L', 'fetlock.F.L', 'pastern.F.L', 'hoof.F.L'],
    'F.R': ['scapula.F.R', 'shoulder.F.R', 'elbow.F.R', 'carpus.F.R', 'fetlock.F.R', 'pastern.F.R', 'hoof.F.R'],
    'H.L': ['hip.H.L', 'stifle.H.L', 'hock.H.L', 'fetlock.H.L', 'pastern.H.L', 'hoof.H.L'],
    'H.R': ['hip.H.R', 'stifle.H.R', 'hock.H.R', 'fetlock.H.R', 'pastern.H.R', 'hoof.H.R'],
  },

  // Binocular overlap is 65 to 80 degrees wide and it points down the nose,
  // with a blind area straight ahead of the forehead. Head pitch is solved by
  // aiming this cone, not by focusing. The ramp retina explanation is wrong.
  vision: { binocularDeg: 72, coneAxis: 'muzzle', blindBehindDeg: 20 },
};

// Build the bone hierarchy. Rest rotations are all identity, so a local offset
// is just the difference between two rest positions.
export function buildSkeleton(spec = SPEC) {
  const byName = new Map();
  const restWorld = new Map();

  for (const j of spec) {
    const bone = new THREE.Bone();
    bone.name = j.name;
    bone.userData = { group: j.group, side: j.side, spec: j };
    byName.set(j.name, bone);
    restWorld.set(j.name, new THREE.Vector3(...j.rest));
  }

  let root = null;
  for (const j of spec) {
    const bone = byName.get(j.name);
    if (!j.parent) {
      bone.position.set(...j.rest);
      root = bone;
      continue;
    }
    const parent = byName.get(j.parent);
    if (!parent) throw new Error(`skeleton: ${j.name} wants missing parent ${j.parent}`);
    bone.position.copy(restWorld.get(j.name)).sub(restWorld.get(j.parent));
    parent.add(bone);
  }

  root.updateMatrixWorld(true);

  return { root, bones: byName, restWorld, spec, metrics: metricsFrom(restWorld) };
}

// Derived measurements. These feed the Froude normalisation, which is what lets
// one dimensionless gait table serve any body size, so a draft horse, an
// Arabian and a unicorn all get correct gait boundaries from the same data.
// The dorsal spinous processes at T3 to T5 stand well above the vertebral
// bodies, and it is their tops that a horse is measured to. We do not model
// spinous processes, so withers height is the scapula top plus this allowance.
// Named rather than inlined because it is a fudge and should look like one.
const SPINOUS_PROCESS_RISE = 0.1;

function metricsFrom(rest) {
  const y = (n) => rest.get(n).y;
  const hip = y('pelvis');
  return {
    // What a horse is actually measured to, roughly 1.62 m here, which is 16
    // hands.
    withersHeight: y('scapula.F.L') + SPINOUS_PROCESS_RISE,
    // The topline of the vertebral column, which is what the spine solver bends.
    spineTopHeight: y('thorax1'),
    // Top of the pelvis, which is the tuber sacrale a vet would palpate.
    croupHeight: hip,
    // The coxofemoral joint, which is the characteristic length Froude wants and
    // sits appreciably below the croup.
    hipHeight: y('hip.H.L'),
    foreLegLength: y('scapula.F.L') - y('hoof.F.L'),
    hindLegLength: y('hip.H.L') - y('hoof.H.L'),
    // Shoulder joint to hip joint. Shorter than the point of shoulder to point
    // of buttock figure a breeder would quote, because those are surface
    // landmarks well outside the joints.
    jointSpan: rest.get('shoulder.F.L').x - rest.get('pelvis').x,
    // Nose to tail tip, which is what the lab camera has to frame.
    totalLength: rest.get('muzzle').x - rest.get('tail5').x,
    // Middle of the animal in its own space. The root sits between the hooves,
    // well behind the middle of the silhouette, so a camera aimed at the root
    // pushes the head out of frame.
    centerX: (rest.get('muzzle').x + rest.get('tail5').x) / 2,
    centerY: y('atlas') / 2,
    // Froude uses hip joint height as the characteristic length, which is what
    // makes the gait table transfer across body sizes.
    froudeHeight: y('hip.H.L'),
    trackWidth: Math.abs(rest.get('hoof.F.L').z - rest.get('hoof.F.R').z),
  };
}

// Dimensionless speed. Gait boundaries are stored as Froude numbers so they
// transfer across body sizes, then converted per horse.
export function froude(speed, height) {
  return (speed * speed) / (9.81 * height);
}
export function speedFromFroude(fr, height) {
  return Math.sqrt(fr * 9.81 * height);
}

const GROUP_COLOR = {
  root: 0xffffff,
  spine: 0x8fa3bf,
  neck: 0x9db8d4,
  head: 0xc3d4e8,
  tail: 0x7d8ea8,
  foreleg: 0xd8b48a,
  hindleg: 0xc99a72,
};

// A visible blockout. One capsule per bone segment, drawn from a joint to its
// parent, plus a sphere at each joint. The capsule is parented to the PARENT
// bone and oriented along the rest offset, so when the parent rotates the
// segment follows without any per frame work.
export function buildBlockout(skel, { radius = 0.035 } = {}) {
  const group = new THREE.Group();
  group.name = 'blockout';

  const jointGeo = new THREE.SphereGeometry(1, 12, 10);
  // A cylinder of radius 1 and height 1, centred on the origin and running
  // along +Y. Deliberately not a capsule: a capsule's total height is its
  // length plus two radii, so scaling Y by a bone length overshoots by a radius
  // at each end and every bone grows a spike. The spheres at the joints give
  // the rounded look anyway.
  const segGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1);

  const mats = new Map();
  const matFor = (g) => {
    if (!mats.has(g)) {
      mats.set(
        g,
        new THREE.MeshStandardMaterial({
          color: GROUP_COLOR[g] ?? 0xaaaaaa,
          roughness: 0.55,
          metalness: 0.05,
        })
      );
    }
    return mats.get(g);
  };

  for (const [name, bone] of skel.bones) {
    const g = bone.userData.group;

    // The root is a placement node sitting on the ground between the hooves,
    // not a bone. Drawing it puts a spurious rod from the pelvis to the floor.
    if (g === 'root') continue;

    // Joint marker, sized down a little for the small distal joints.
    const distal = /fetlock|pastern|hoof|muzzle|tail/.test(name);
    const jr = radius * (distal ? 0.9 : 1.25);
    const joint = new THREE.Mesh(jointGeo, matFor(g));
    joint.scale.setScalar(jr);
    joint.castShadow = true;
    bone.add(joint);

    // Segment back to the parent, unless the parent is that same placement node.
    const parent = bone.parent;
    if (!parent || !parent.isBone) continue;
    if (parent.userData.group === 'root') continue;
    const off = bone.position.clone();
    const len = off.length();
    if (len < 1e-4) continue;

    const seg = new THREE.Mesh(segGeo, matFor(g));
    // Unit cylinder, so scaling maps straight onto radius and length.
    const r = radius * (distal ? 0.62 : 0.85);
    seg.scale.set(r, len, r);
    seg.position.copy(off).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), off.clone().normalize());
    seg.castShadow = true;
    parent.add(seg);
  }

  group.add(skel.root);
  return group;
}
