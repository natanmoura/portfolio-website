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
import { note } from './provenance.js';

// An absent list means "everything the role allows", so a scene saved before
// roles existed generates exactly as it did.

// The vocabulary of kinds lives here rather than in generate.js, because a
// role is exactly "which of these belong where" and the generator is only
// one consumer of the answer. generate.js re-exports these so every existing
// import keeps working.

export const BODY_KINDS = ['box', 'octagon', 'cylinder', 'pillars', 'pillars8', 'post', 'sphere', 'spin'];
export const ROOF_KINDS = ['flat', 'pyramid', 'gable', 'cone', 'dome'];
export const MODULE_KINDS = [...BODY_KINDS, 'pyramid', 'gable', 'cone', 'dome', 'flag'];

// What each shipped id is called in the UI. Defined once, in traits.js, with
// everything else that describes what a component is rather than what it does.
import { KIND_LABEL } from './traits.js';
export { KIND_LABEL };

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
  // Whatever the scene recorded, kept verbatim. It used to be filtered
  // against this file's own list, which quietly threw away any component the
  // library gained later — including every assembly. A role can hold any
  // component now, so the library is the authority on what exists and this
  // is only the authority on what was picked.
  if (!Array.isArray(chosen) || !chosen.length) {
    // Right, and worth saying out loud. Switching a role empty and getting a
    // full town back is indistinguishable from the toggles not working.
    if (Array.isArray(chosen)) note('role-empty', { role });
    return def.defaults;
  }
  return chosen;
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
  // The shipped kinds keep their usual order; anything else — a custom leaf,
  // an assembly — goes after them in whatever order it was added. Sorting
  // *against* `defaults` here, the way an earlier version of this did, threw
  // away every non-default id it was ever asked to keep: a role can hold any
  // component the library has, per the whole point of the roles refactor
  // (see the top of this file), and a component not in the shipped table is
  // not a component to silently drop.
  const ordered = [...ROLES[role].defaults.filter((x) => next.includes(x)), ...next.filter((x) => !ROLES[role].defaults.includes(x))];
  return { ...(params.roles || {}), [role]: ordered.length ? ordered : ROLES[role].defaults };
}
