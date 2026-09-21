// ── Site-wide emoji restyle ──
// Replaces native emoji with Microsoft Fluent "Color" SVGs so every visitor
// sees the same artwork regardless of their device.
//
// Load this as a plain (non-deferred) script in <head>. It observes the DOM
// while the parser builds it, so emoji are swapped before first paint (no
// native-emoji flash), and it prefetches + decodes every SVG up front so
// emoji inserted later (typed tagline, intro sparkles, slay/wave animations)
// render on the frame they appear.
//
// SVGs are self-hosted in assets/emoji/ (optimized with svgo). To add one,
// drop the Fluent SVG there and add a line to FILES.
// To revert to native emoji: remove the <script src="js/emoji-fluent.js"> tag.
(function () {
  const script = document.currentScript;
  const BASE = new URL('../assets/emoji/', script ? script.src : location.href).href;

  // Keys are written without the U+FE0F variation selector, which is matched
  // optionally, so "✏" and "✏️" both resolve.
  const FILES = {
    '🪄': 'magic-wand',
    '🧙': 'mage',
    '🔮': 'crystal-ball',
    '🔨': 'hammer',
    '✏': 'pencil',
    '🏆': 'trophy',
    '🧠': 'brain',
    '🌎': 'globe-americas',
    '❤': 'red-heart',
    '🌱': 'seedling',
    '🎲': 'game-die',
    '🌅': 'sunrise',
    '🥭': 'mango',
    '💀': 'skull',
    '🚲': 'bicycle',
    '✊': 'raised-fist',
    '🖐': 'hand-splayed',
    '✌': 'victory-hand',
    '🧝': 'elf',
    '🐉': 'dragon',
    '🕷': 'spider',
    '🦇': 'bat',
    '🗡': 'dagger',
    '🪓': 'axe',
    '🪃': 'boomerang',
    '💥': 'collision',
    '✨': 'sparkles',
    '⭐': 'star',
    '❗': 'exclamation'
  };

  const URLS = {};
  Object.keys(FILES).forEach(function (ch) { URLS[ch] = BASE + FILES[ch] + '.svg'; });

  const keys = Object.keys(URLS).sort(function (a, b) { return b.length - a.length; });
  const escaped = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  const RE = new RegExp('(' + escaped.join('|') + ')\\uFE0F?', 'gu');

  // Prefetch and decode everything now. Holding the Image objects keeps the
  // decoded bitmaps in memory so later swaps don't flash blank.
  const warm = [];
  keys.forEach(function (ch) {
    const img = new Image();
    img.src = URLS[ch];
    if (img.decode) img.decode().catch(function () {});
    warm.push(img);
  });

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, NOSCRIPT: 1, IMG: 1 };

  function makeImg(match) {
    const ch = match.replace(/️/g, '');
    const img = document.createElement('img');
    img.className = 'emoji-img';
    img.src = URLS[ch];
    img.alt = match;
    img.setAttribute('draggable', 'false');
    return img;
  }

  function hasEmoji(text) {
    RE.lastIndex = 0;
    return RE.test(text);
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentNode) return;
    if (SKIP_TAGS[node.parentNode.nodeName]) return;
    const text = node.nodeValue;
    if (!hasEmoji(text)) return;
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
    if (!root) return;
    if (root.nodeType === 3) { processTextNode(root); return; }
    if (root.nodeType !== 1 || SKIP_TAGS[root.nodeName]) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const found = [];
    let n;
    while ((n = tw.nextNode())) {
      if (n.parentNode && SKIP_TAGS[n.parentNode.nodeName]) continue;
      if (hasEmoji(n.nodeValue)) found.push(n);
    }
    found.forEach(processTextNode);
  }

  const target = document.documentElement;
  const observer = new MutationObserver(function (mutations) {
    observer.disconnect();
    mutations.forEach(function (mu) {
      if (mu.type === 'characterData') processTextNode(mu.target);
      else mu.addedNodes.forEach(walk);
    });
    connect();
  });
  function connect() {
    observer.observe(target, { childList: true, characterData: true, subtree: true });
  }

  walk(document.body);
  connect();

  // Parsers can append to an existing text node without a mutation record,
  // so sweep once more when parsing finishes.
  function sweep() {
    observer.disconnect();
    walk(document.body);
    connect();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sweep);
  else sweep();
})();
