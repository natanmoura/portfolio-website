// ── Site-wide emoji restyle ──
// Replaces native emoji with Microsoft Fluent "Color" SVGs so every visitor
// sees the same artwork regardless of their device. Handles static content on
// load plus dynamically inserted emoji (typed tagline, intro wizard, contact
// slay animation) via a MutationObserver.
//
// To revert to native emoji: remove the <script src="js/emoji-fluent.js"> tag.
// To try a different Fluent style: swap "Color"/"color" in the URLs below for
// "Flat"/"flat" or "High Contrast"/"high_contrast" (both SVG), or "3D"/"3d" (PNG).
(function () {
  const BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

  // emoji character → Fluent Color SVG path (relative to BASE)
  const PATHS = {
    '🪄': 'Magic%20wand/Color/magic_wand_color.svg',
    '🧙': 'Man%20mage/Default/Color/man_mage_color_default.svg',
    '🔮': 'Crystal%20ball/Color/crystal_ball_color.svg',
    '🔨': 'Hammer/Color/hammer_color.svg',
    '✏️': 'Pencil/Color/pencil_color.svg',
    '🏆': 'Trophy/Color/trophy_color.svg',
    '🧠': 'Brain/Color/brain_color.svg',
    '🌎': 'Globe%20showing%20americas/Color/globe_showing_americas_color.svg',
    '❤️': 'Red%20heart/Color/red_heart_color.svg',
    '🌱': 'Seedling/Color/seedling_color.svg',
    '🎲': 'Game%20die/Color/game_die_color.svg',
    '🌅': 'Sunrise/Color/sunrise_color.svg',
    '🥭': 'Mango/Color/mango_color.svg',
    '💀': 'Skull/Color/skull_color.svg',
    '🚲': 'Bicycle/Color/bicycle_color.svg',
    '✊': 'Raised%20fist/Default/Color/raised_fist_color_default.svg',
    '🖐️': 'Hand%20with%20fingers%20splayed/Default/Color/hand_with_fingers_splayed_color_default.svg',
    '✌️': 'Victory%20hand/Default/Color/victory_hand_color_default.svg',
    '🧝': 'Man%20elf/Default/Color/man_elf_color_default.svg',
    '🐉': 'Dragon/Color/dragon_color.svg',
    '🕷️': 'Spider/Color/spider_color.svg',
    '🦇': 'Bat/Color/bat_color.svg',
    '🗡️': 'Dagger/Color/dagger_color.svg',
    '🪓': 'Axe/Color/axe_color.svg',
    '🪃': 'Boomerang/Color/boomerang_color.svg',
    '💥': 'Collision/Color/collision_color.svg',
    '✨': 'Sparkles/Color/sparkles_color.svg',
    '⭐': 'Star/Color/star_color.svg'
  };

  const MAP = {};
  Object.keys(PATHS).forEach(function (ch) { MAP[ch] = BASE + '/' + PATHS[ch]; });

  // Longest keys first so multi-codepoint emoji (with variation selectors) win.
  const keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  const escaped = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  const RE = new RegExp('(' + escaped.join('|') + ')', 'gu');

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, IMG: 1 };

  function makeImg(ch) {
    const img = document.createElement('img');
    img.className = 'emoji-img';
    img.src = MAP[ch];
    img.alt = ch;
    img.setAttribute('draggable', 'false');
    return img;
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentNode) return;
    if (SKIP_TAGS[node.parentNode.nodeName]) return;
    const text = node.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(makeImg(m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function walk(root) {
    if (!root || root.nodeType !== 1) {
      if (root && root.nodeType === 3) processTextNode(root);
      return;
    }
    if (SKIP_TAGS[root.nodeName]) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const found = [];
    let n;
    while ((n = tw.nextNode())) {
      if (n.parentNode && SKIP_TAGS[n.parentNode.nodeName]) continue;
      RE.lastIndex = 0;
      if (RE.test(n.nodeValue)) found.push(n);
    }
    found.forEach(processTextNode);
  }

  let observer;
  function connect() {
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function start() {
    walk(document.body);
    observer = new MutationObserver(function (mutations) {
      observer.disconnect();
      mutations.forEach(function (mu) {
        if (mu.type === 'characterData') {
          processTextNode(mu.target);
        } else {
          mu.addedNodes.forEach(function (added) {
            if (added.nodeType === 3) processTextNode(added);
            else if (added.nodeType === 1) walk(added);
          });
        }
      });
      connect();
    });
    connect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
