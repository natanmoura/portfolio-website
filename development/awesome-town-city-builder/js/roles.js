// Roles: what a system is willing to put where, and which library entries
// the scene has switched on for each.
//
// The change from what came before is include rather than exclude. Every
// shape used to be permanently present in the mix wheel and had to be zeroed
// to be silenced, which conflates two different statements: "I want none of
// this right now" and "this does not belong in this town at all." A role
// carries a real include list, so the wheel only ever shows what was chosen
// and only controls proportion among those.
//
// An absent list means "everything the role allows", so a scene saved before
// roles existed generates exactly as it did.

// The vocabulary of kinds lives here rather than in generate.js, because a
// role is exactly "which of these belong where" and the generator is only
// one consumer of the answer. generate.js re-exports these so every existing
// import keeps working.

export const BODY_KINDS = ['box', 'octagon', 'cylinder', 'pillars', 'pillars8', 'post', 'sphere', 'spin'];
export const ROOF_KINDS = ['flat', 'pyramid', 'gable', 'cone', 'dome'];
export const MODULE_KINDS = [...BODY_KINDS, 'pyramid', 'gable', 'cone', 'dome', 'flag'];

export const KIND_LABEL = {
  box: 'Cube',
  octagon: 'Octagon',
  cylinder: 'Cylinder',
  pillars: 'Pillars 4',
  pillars8: 'Pillars 8',
  post: 'Post',
  sphere: 'Sphere',
  spin: 'Spin',
  flat: 'Flat',
  pyramid: 'Pyramid',
  gable: 'Gable',
  cone: 'Cone',
  dome: 'Dome',
  flag: 'Flag',
};

export const ROLES = {
  body: {
    label: 'Body',
    tags: ['structural'],
    defaults: BODY_KINDS,
    help: 'The shapes a building is stacked out of.',
  },
  roof: {
    label: 'Roof',
    tags: ['roof'],
    defaults: ROOF_KINDS,
    help: 'What caps a building. Flat leaves the top module square.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export const roleLabel = (id) => KIND_LABEL[id] || id;

// The ids a role may pick from right now. Falling back to the defaults on an
// empty list is deliberate: switching everything off is almost always a slip
// mid-edit, and a town of nothing is not a useful thing to render while
// someone is halfway through choosing.
export function includedFor(params, role) {
  const def = ROLES[role];
  if (!def) return [];
  const chosen = params?.roles?.[role];
  if (!Array.isArray(chosen) || !chosen.length) return def.defaults;
  const valid = chosen.filter((id) => def.defaults.includes(id));
  return valid.length ? valid : def.defaults;
}

// Whether a role is at its default, which is what the UI needs to show
// "everything" rather than listing every id back at the user.
export function isRoleDefault(params, role) {
  const chosen = params?.roles?.[role];
  return !Array.isArray(chosen) || !chosen.length || chosen.length === ROLES[role].defaults.length;
}

// Toggling one id on or off, returned as a new roles object so it drops into
// the params the same way any other setting does.
export function toggleInRole(params, role, id) {
  const current = includedFor(params, role);
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  const ordered = ROLES[role].defaults.filter((x) => next.includes(x));
  return { ...(params.roles || {}), [role]: ordered.length ? ordered : ROLES[role].defaults };
}
