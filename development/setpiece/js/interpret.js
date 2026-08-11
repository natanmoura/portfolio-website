// interpret.js — the half that genuinely needs vision.
//
// The camera is already solved by autocalib.js, exactly and without a model.
// What is left is meaning: which regions are objects, where each one meets the
// floor, whether it reads as a box or a cylinder or a flat. That is perception,
// and a model is the right tool for it.
//
// The one rule this file exists to enforce: the model never returns a 3D
// coordinate. It returns 2D observations about the picture, which is what it is
// good at. Every world position and size comes from the solved camera, which is
// exact. Ask a model for metric depth and it will invent a plausible number and
// invent a different one next time.

import { uid } from './scene.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const KEY_STORE = 'setpiece.anthropicKey';

export function getKey() {
  return localStorage.getItem(KEY_STORE) || '';
}

export function setKey(value) {
  if (value) localStorage.setItem(KEY_STORE, value);
  else localStorage.removeItem(KEY_STORE);
}

/**
 * Forced-output schema: a scene program, not a picture description.
 *
 * Everything is in world units read off the scaffold grid drawn on the image.
 * That is the whole design: asking a model for metric depth fails, but asking
 * it to read coordinates off a ruler that is already lying correctly on the
 * floor of the drawing is a different and much easier question.
 */
const READ_SCENE_TOOL = {
  name: 'build_scene',
  description:
    'Rebuild the drawing as typed 3D primitives positioned on the labelled ground grid.',
  input_schema: {
    type: 'object',
    properties: {
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'what it is, two or three words' },
            type: {
              type: 'string',
              enum: ['box', 'cylinder', 'column', 'pipe', 'sphere', 'arch', 'roof', 'stairs', 'card'],
              description:
                'box for flat-faced masses and buildings. cylinder or column for round uprights. ' +
                'pipe for a round tube that is NOT upright. sphere for balls and domes. ' +
                'arch for an opening with a curved top. roof for a sloped cap sitting on something. ' +
                'stairs for a flight of steps. card for thin flat things like foliage or figures.',
            },
            position: {
              type: 'array',
              description:
                'Ground position [x, z] in the same units as the printed grid labels. This is ' +
                'the CENTRE of the object footprint, projected straight down onto the floor.',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
            },
            elevation: {
              type: 'number',
              description:
                'Height of the object base above the floor, in metres. 0 for anything standing on ' +
                'the ground. Use this for a roof on top of a wall, or a pipe running overhead.',
            },
            size: {
              type: 'array',
              description:
                'Size in metres as [width, height, depth]. Use the orange poles, which are of ' +
                'known height and standing on the grid, to judge vertical scale, and the grid ' +
                'squares to judge width and depth.',
              items: { type: 'number' },
              minItems: 3,
              maxItems: 3,
            },
            rotationY: {
              type: 'number',
              description: 'Rotation about the vertical axis in degrees. 0 means aligned to the grid.',
            },
            params: {
              type: 'object',
              description:
                'Extra shape controls. steps (number) for stairs. style ("gable" or "shed") for ' +
                'roof. openWidth (0..1) for how much of an arch is opening.',
              properties: {
                steps: { type: 'number' },
                style: { type: 'string', enum: ['gable', 'shed'] },
                openWidth: { type: 'number' },
              },
            },
            tilt: {
              type: 'array',
              description:
                'Only for pipes that are not upright: [rotationX, rotationZ] in degrees. ' +
                'A horizontal pipe running along the grid X axis is [0, 90].',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
            },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description:
                'How sure you are of the POSITION AND SIZE, not of what the object is. Low is a ' +
                'perfectly good answer for something whose base is hidden.',
            },
          },
          required: ['label', 'type', 'position', 'size', 'confidence'],
        },
      },
    },
    required: ['elements'],
  },
};

function buildPrompt(scaffold) {
  return [
    'You are rebuilding a drawing as a rough 3D blockout for a film background.',
    '',
    'The camera has already been solved exactly, and the result is drawn on the image for you:',
    '',
    `- The BLUE GRID lies flat on the ground plane of the drawing. Its lines are ${scaffold.spacing}`,
    '  metres apart and the labelled intersections give you world coordinates as "x,z".',
    '- The RED line is the world X axis and the GREEN line is the world Z axis. They cross at the',
    '  origin. Z becomes more negative as things get further from the camera.',
    '- The ORANGE POLES are standing on the grid and are each exactly',
    `  ${scaffold.poleHeight} metres tall. Use them to judge the height of everything else.`,
    '- The dashed line is the horizon, which is camera eye level.',
    '',
    'This grid is correct. Trust it completely, and read positions off it rather than estimating',
    'depth by eye. If an object stands on a spot where the grid is visible, report the coordinates',
    'of that spot. If the grid is hidden behind the object, follow the grid lines that run past it',
    'and interpolate.',
    '',
    'List the 5 to 25 elements that carry the composition. This is a blockout, so a whole building',
    'is one box, a colonnade is one column per pillar, and individual bricks are not elements.',
    'Pick the primitive type that matches the real form: a chimney is a box, a drainpipe is a pipe,',
    'a doorway with a curved top is an arch, a pitched roof is a roof and not a box.',
    '',
    'Report size in metres. Getting the footprint position right matters more than getting the',
    'depth of a mass exactly right, because position is measurable from the grid and depth often',
    'is not visible at all. When depth is genuinely not visible, make it similar to the width and',
    'mark confidence low.',
    '',
    'Do not report the grid, the poles, the horizon, lighting, mood or style. Only objects.',
  ].join('\n');
}

/** Strip a data URL down to what the API wants. */
function splitDataUrl(dataUrl) {
  const [header, payload] = dataUrl.split(',');
  const match = /data:([^;]+)/.exec(header);
  return { mediaType: match ? match[1] : 'image/png', data: payload };
}

/**
 * @param {string} imageDataUrl
 * @param {object} opts
 * @param {number|null} opts.horizonFraction  horizon as a 0..1 fraction of image height
 * @param {string} opts.model
 * @returns {Promise<{elements: Array, usage: object}>}
 */
export async function interpretImage(scaffold, { model = 'claude-sonnet-5' } = {}) {
  const key = getKey();
  if (!key) throw new Error('no API key set');

  const { mediaType, data } = splitDataUrl(scaffold.dataUrl);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required for calling the API straight from a page rather than a server.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      tools: [READ_SCENE_TOOL],
      tool_choice: { type: 'tool', name: 'describe_scene' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: buildPrompt(scaffold) },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const block = (json.content || []).find((c) => c.type === 'tool_use');
  if (!block) throw new Error('model did not return structured output');

  return { elements: block.input.elements || [], usage: json.usage };
}

const DEG = Math.PI / 180;

/**
 * Turn the returned scene program into scene nodes.
 *
 * Almost a straight mapping, because the model was reading a correct ruler
 * rather than guessing. The work here is sanity, not conversion: reject sizes
 * that cannot be real, and score every placement against the drawing so a human
 * knows which ones to look at first.
 */
export function elementsToNodes(elements, cam, stationId, opts = {}) {
  const { verify = null, edgeMask = null } = opts;
  const nodes = [];
  const rejected = [];

  const maxSize = cam.camHeight * 120;
  const minSize = cam.camHeight * 0.02;

  for (const el of elements) {
    const size = (el.size || []).map(Number);
    if (size.length < 3 || size.some((v) => !Number.isFinite(v) || v <= 0)) {
      rejected.push(`${el.label}: no usable size`);
      continue;
    }
    if (Math.max(...size) > maxSize || Math.max(...size) < minSize) {
      rejected.push(`${el.label}: size ${size.map((v) => v.toFixed(1)).join(' x ')} is out of range`);
      continue;
    }

    const [x, z] = (el.position || [0, 0]).map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      rejected.push(`${el.label}: no usable position`);
      continue;
    }

    const node = {
      id: uid('m'),
      type: el.type || 'box',
      name: el.label || el.type,
      position: [x, Number(el.elevation) || 0, z],
      size,
      rotationY: (Number(el.rotationY) || 0) * DEG,
      material: { mode: 'projected', station: stationId },
      confidence: el.confidence || 'medium',
      pinned: false,
    };

    if (el.params && Object.keys(el.params).length) node.params = el.params;
    if (Array.isArray(el.tilt) && el.tilt.length === 2) {
      node.rotationX = (Number(el.tilt[0]) || 0) * DEG;
      node.rotationZ = (Number(el.tilt[1]) || 0) * DEG;
    }

    // Independent check against the drawing itself. Advice only: a low score
    // marks something for a human to look at, it never silently deletes work.
    if (verify && edgeMask) {
      const v = verify(cam, edgeMask, node);
      node.support = v.score;
    }

    nodes.push(node);
  }

  return { nodes, rejected };
}
